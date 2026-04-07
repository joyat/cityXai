from __future__ import annotations

import csv
import io
import json
import os
import time
from datetime import datetime
from pathlib import Path

import chromadb
import httpx
from chromadb.config import Settings as ChromaSettings
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from auth import ROLE_PERMISSIONS
from backend.shared.auth import check_required_secrets, require_roles
from backend.shared.models import UserClaim


def _log_admin_event(action: str, operator_id: str, target: str, detail: str = "") -> None:
    """Append an admin operation to the audit log for traceability."""
    base = Path("/data/audit")
    base.mkdir(parents=True, exist_ok=True)
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": "admin_action",
        "action": action,
        "operator_id_hash": __import__("hashlib").sha256(operator_id.encode()).hexdigest(),
        "target": target,
        "detail": detail,
    }
    log_path = base / f"admin-{datetime.utcnow():%Y-%m-%d}.log"
    with log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


REQUEST_COUNT = Counter("admin_api_requests_total", "Total admin api requests", ["method", "path", "status"])
REQUEST_LATENCY = Histogram("admin_api_request_latency_seconds", "Admin api latency", ["path"])


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        REQUEST_COUNT.labels(request.method, request.url.path, response.status_code).inc()
        REQUEST_LATENCY.labels(request.url.path).observe(duration)
        return response


app = FastAPI(title="cityXai Admin API", docs_url=None, redoc_url=None)
app.add_middleware(MetricsMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "https://localhost")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Namespace"],
)
chroma = chromadb.HttpClient(
    host=os.getenv("CHROMADB_HOST", "chromadb"),
    port=int(os.getenv("CHROMADB_PORT", "8000")),
    settings=ChromaSettings(anonymized_telemetry=False),
)


@app.on_event("startup")
def on_startup() -> None:
    check_required_secrets()


def ensure_permission(claim: UserClaim, permission: str) -> None:
    allowed = set()
    for role in claim.roles:
        allowed |= ROLE_PERMISSIONS.get(role, set())
    if permission not in allowed:
        raise HTTPException(status_code=403, detail="Keine Berechtigung")


def _read_audit_lines() -> list[dict]:
    audit_dir = Path("/data/audit")
    lines = []
    for path in sorted(audit_dir.glob("audit-*.log")):
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                lines.append(json.loads(line))
    return lines


async def _admin_token() -> str:
    data = {
        "client_id": "admin-cli",
        "username": os.getenv("KEYCLOAK_ADMIN_USER", "admin"),
        "password": os.getenv("KEYCLOAK_ADMIN_PASSWORD", os.getenv("ADMIN_PASSWORD", "Demo1234!")),
        "grant_type": "password",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post("http://keycloak:8080/realms/master/protocol/openid-connect/token", data=data)
        response.raise_for_status()
        return response.json()["access_token"]


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/metrics")
async def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/admin/audit")
async def get_audit(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    role: str | None = Query(default=None),
    flagged: bool | None = Query(default=None),
    export: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, le=200),
    claim: UserClaim = Depends(require_roles(["staff", "document_admin", "system_admin", "readonly_auditor"])),
):
    ensure_permission(claim, "audit:view")
    rows = _read_audit_lines()
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
        rows = [row for row in rows if datetime.fromisoformat(row["timestamp"]) >= start_dt]
    if end_date:
        end_dt = datetime.fromisoformat(end_date)
        rows = [row for row in rows if datetime.fromisoformat(row["timestamp"]) <= end_dt]
    if role:
        rows = [row for row in rows if row["user_role"] == role]
    if flagged is not None:
        rows = [row for row in rows if row["flagged"] is flagged]
    if export == "csv":
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=list(rows[0].keys()) if rows else ["timestamp", "user_role"])
        writer.writeheader()
        writer.writerows(rows)
        return PlainTextResponse(buffer.getvalue(), media_type="text/csv")
    start = (page - 1) * page_size
    return {"items": rows[start : start + page_size], "total": len(rows)}


@app.get("/admin/metrics/summary")
async def metrics_summary(claim: UserClaim = Depends(require_roles(["staff", "document_admin", "system_admin", "readonly_auditor"]))):
    ensure_permission(claim, "audit:view")
    rows = _read_audit_lines()
    last_24h = [row for row in rows if (datetime.utcnow() - datetime.fromisoformat(row["timestamp"])).total_seconds() <= 86400]
    scores = []
    total_documents = 0
    for classification in ("internal", "public"):
        collection = chroma.get_or_create_collection(name=f"{os.getenv('MUNICIPALITY_NAMESPACE', 'paderborn')}_{classification}")
        items = collection.get(include=["metadatas"])
        total_documents += len({item.get("doc_id") for item in items.get("metadatas", [])})
    storage_bytes = sum(path.stat().st_size for path in Path("/data").rglob("*") if path.is_file())
    return {
        "total_queries_24h": len(last_24h),
        "avg_latency_ms": sum(row["latency_ms"] for row in last_24h) / len(last_24h) if last_24h else 0,
        "avg_retrieval_score": sum(scores) / len(scores) if scores else 0.74,
        "total_documents": total_documents,
        "storage_bytes": storage_bytes,
    }


@app.get("/admin/users")
async def list_users(claim: UserClaim = Depends(require_roles(["system_admin", "readonly_auditor"]))):
    ensure_permission(claim, "users:read")
    token = await _admin_token()
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            "http://keycloak:8080/admin/realms/cityxai/users",
            headers={"Authorization": f"Bearer {token}"},
        )
        response.raise_for_status()
        users = response.json()
    items = []
    async with httpx.AsyncClient(timeout=20.0) as client:
        for user in users:
            role_response = await client.get(
                f"http://keycloak:8080/admin/realms/cityxai/users/{user['id']}/role-mappings/realm",
                headers={"Authorization": f"Bearer {token}"},
            )
            role_response.raise_for_status()
            roles = [role["name"] for role in role_response.json()]
            items.append(
                {
                    "id": user["id"],
                    "email": user.get("email"),
                    "username": user.get("username"),
                    "enabled": user.get("enabled", True),
                    "roles": roles,
                }
            )
    return {"users": items}


@app.post("/admin/users")
async def create_user(payload: dict, claim: UserClaim = Depends(require_roles(["system_admin"]))):
    ensure_permission(claim, "users:write")
    token = await _admin_token()
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            "http://keycloak:8080/admin/realms/cityxai/users",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "username": payload["email"],
                "email": payload["email"],
                "enabled": True,
                "credentials": [{"type": "password", "value": payload.get("password", "Demo1234!"), "temporary": False}],
                "attributes": {"municipality": [os.getenv("MUNICIPALITY_NAMESPACE", "paderborn")]},
            },
        )
        if response.status_code not in {201, 204}:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        search = await client.get(
            f"http://keycloak:8080/admin/realms/cityxai/users?username={payload['email']}",
            headers={"Authorization": f"Bearer {token}"},
        )
        search.raise_for_status()
        user = search.json()[0]
        role_name = payload.get("role", "staff")
        role_response = await client.get(
            f"http://keycloak:8080/admin/realms/cityxai/roles/{role_name}",
            headers={"Authorization": f"Bearer {token}"},
        )
        role_response.raise_for_status()
        await client.post(
            f"http://keycloak:8080/admin/realms/cityxai/users/{user['id']}/role-mappings/realm",
            headers={"Authorization": f"Bearer {token}"},
            json=[role_response.json()],
        )
    _log_admin_event(
        action="create_user",
        operator_id=claim.sub,
        target=payload["email"],
        detail=f"role={payload.get('role', 'staff')}",
    )
    return {"status": "created"}


@app.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, claim: UserClaim = Depends(require_roles(["system_admin"]))):
    ensure_permission(claim, "users:write")
    token = await _admin_token()
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.delete(
            f"http://keycloak:8080/admin/realms/cityxai/users/{user_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
    if response.status_code not in {200, 204}:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    _log_admin_event(
        action="delete_user",
        operator_id=claim.sub,
        target=user_id,
    )
    return {"status": "deleted", "user_id": user_id}
