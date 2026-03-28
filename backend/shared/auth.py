from __future__ import annotations

import logging
import os
import time
from typing import Iterable

import httpx
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JOSEError

from backend.shared.models import UserClaim

logger = logging.getLogger(__name__)

_WEAK_SECRETS = {"change-me", "change-me-too", "", "secret", "password"}


def check_required_secrets() -> None:
    """Call at app startup — logs warnings for any weak/default secret values."""
    problems = []
    jwt_secret = os.getenv("JWT_SECRET", "")
    if jwt_secret.lower() in _WEAK_SECRETS:
        problems.append("JWT_SECRET is set to a weak default value")
    db_key = os.getenv("DB_ENCRYPT_KEY", "")
    if db_key.lower() in _WEAK_SECRETS:
        problems.append("DB_ENCRYPT_KEY is set to a weak default value")
    keycloak_pw = os.getenv("KEYCLOAK_ADMIN_PASSWORD", os.getenv("ADMIN_PASSWORD", ""))
    if keycloak_pw.lower() in _WEAK_SECRETS or keycloak_pw == "Demo1234!":
        problems.append("KEYCLOAK_ADMIN_PASSWORD is set to a weak/demo value")
    if problems:
        for p in problems:
            logger.warning("SECURITY WARNING: %s — set a strong value in .env before production use", p)


bearer = HTTPBearer(auto_error=False)

# JWKS cache with TTL — refreshed every 10 minutes so key rotations take effect
_jwks_cache: dict = {"keys": []}
_jwks_fetched_at: float = 0.0
_JWKS_TTL = 600  # seconds


def get_jwks() -> dict:
    global _jwks_cache, _jwks_fetched_at
    now = time.monotonic()
    if now - _jwks_fetched_at < _JWKS_TTL and _jwks_cache.get("keys"):
        return _jwks_cache
    realm_url = os.getenv(
        "KEYCLOAK_JWKS_URL",
        "http://keycloak:8080/realms/cityxai/protocol/openid-connect/certs",
    )
    try:
        with httpx.Client(timeout=5.0) as client:
            fresh = client.get(realm_url).json()
            if fresh.get("keys"):  # only update cache on successful response
                _jwks_cache = fresh
                _jwks_fetched_at = now
    except Exception:
        pass  # return stale cache rather than empty keys
    return _jwks_cache


def _find_key(kid: str | None) -> dict | None:
    keys = get_jwks().get("keys", [])
    if kid:
        return next((k for k in keys if k.get("kid") == kid), None)
    # No kid hint — try first available key
    return keys[0] if keys else None


def decode_token(token: str) -> UserClaim:
    header = jwt.get_unverified_header(token)
    alg = header.get("alg", "RS256")

    if alg == "HS256":
        secret = os.getenv("JWT_SECRET")
        if not secret:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="JWT_SECRET fehlt")
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                # HS256 is the dev-login path; issuer is not set in dev tokens
                options={"verify_at_hash": False, "verify_aud": False, "verify_iss": False},
            )
        except ExpiredSignatureError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token abgelaufen",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        except JOSEError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ungültiges Token") from exc
    else:
        key = _find_key(header.get("kid"))
        if not key:
            # Attempt a forced cache refresh before giving up
            global _jwks_fetched_at
            _jwks_fetched_at = 0.0
            key = _find_key(header.get("kid"))
        if not key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unbekannter Signaturschlüssel")
        expected_issuer = os.getenv(
            "KEYCLOAK_ISSUER",
            "http://keycloak:8080/realms/cityxai",
        )
        decode_options: dict = {"verify_at_hash": False, "verify_aud": False}
        decode_kwargs: dict = {"algorithms": [alg]}
        if expected_issuer:
            decode_kwargs["issuer"] = expected_issuer
        else:
            decode_options["verify_iss"] = False
        try:
            payload = jwt.decode(
                token,
                key,
                options=decode_options,
                **decode_kwargs,
            )
        except ExpiredSignatureError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token abgelaufen",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        except JOSEError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ungültiges Token") from exc

    roles = payload.get("realm_access", {}).get("roles", [])
    municipality = payload.get("municipality", os.getenv("MUNICIPALITY_NAMESPACE", "paderborn"))
    return UserClaim(
        sub=payload["sub"],
        email=payload.get("email"),
        preferred_username=payload.get("preferred_username"),
        roles=roles,
        municipality=municipality,
    )


def require_roles(allowed: Iterable[str]):
    allowed_set = set(allowed)

    def dependency(
        credentials: HTTPAuthorizationCredentials = Depends(bearer),
        x_namespace: str | None = Header(default=None),
    ) -> UserClaim:
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentifizierung erforderlich",
                headers={"WWW-Authenticate": "Bearer"},
            )
        claim = decode_token(credentials.credentials)
        if not allowed_set.intersection(claim.roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unzureichende Berechtigung")
        requested_namespace = x_namespace or os.getenv("MUNICIPALITY_NAMESPACE", "paderborn")
        if claim.municipality != requested_namespace:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Falscher Mandant")
        return claim

    return dependency
