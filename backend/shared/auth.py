from __future__ import annotations

import os
from functools import lru_cache
from typing import Iterable

import httpx
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JOSEError

from backend.shared.models import UserClaim


bearer = HTTPBearer(auto_error=False)


@lru_cache
def get_jwks() -> dict:
    realm_url = os.getenv(
        "KEYCLOAK_JWKS_URL",
        "http://keycloak:8080/realms/paderobot/protocol/openid-connect/certs",
    )
    try:
        with httpx.Client(timeout=5.0) as client:
            return client.get(realm_url).json()
    except Exception:
        return {"keys": []}


def decode_token(token: str) -> UserClaim:
    header = jwt.get_unverified_header(token)
    if header.get("alg") == "HS256":
        secret = os.getenv("JWT_SECRET")
        if not secret:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="JWT_SECRET fehlt")
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_at_hash": False, "verify_aud": False, "verify_iss": False},
            )
        except ExpiredSignatureError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token abgelaufen") from exc
        except JOSEError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ungültiges Token") from exc
    else:
        key = next((item for item in get_jwks().get("keys", []) if item.get("kid") == header.get("kid")), None)
        if not key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unbekannter Signaturschlüssel")
        try:
            payload = jwt.decode(
                token,
                key,
                algorithms=[header.get("alg", "RS256")],
                options={"verify_at_hash": False, "verify_aud": False, "verify_iss": False},
            )
        except ExpiredSignatureError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token abgelaufen") from exc
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
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentifizierung erforderlich")
        claim = decode_token(credentials.credentials)
        if not allowed_set.intersection(claim.roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unzureichende Berechtigung")
        requested_namespace = x_namespace or os.getenv("MUNICIPALITY_NAMESPACE", "paderborn")
        if claim.municipality != requested_namespace:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Falscher Mandant")
        return claim

    return dependency
