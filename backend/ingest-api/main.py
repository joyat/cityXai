from __future__ import annotations

import hashlib
import json
import os
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from backend.shared.auth import check_required_secrets, require_roles
from backend.shared.models import IngestJob, UserClaim
from chunker import SemanticChunker
from embedder import Embedder
from metadata import inject_metadata
from router import route_document
from watcher import start_watcher


REQUEST_COUNT = Counter("ingest_api_requests_total", "Total ingest api requests", ["method", "path", "status"])
REQUEST_LATENCY = Histogram("ingest_api_request_latency_seconds", "Ingest api latency", ["path"])
INGEST_FAILURES = Counter("ingest_api_failed_total", "Failed ingest jobs")
DOCUMENT_COUNT = Counter("ingest_api_documents_total", "Documents ingested", ["classification"])


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        REQUEST_COUNT.labels(request.method, request.url.path, response.status_code).inc()
        REQUEST_LATENCY.labels(request.url.path).observe(duration)
        return response


_MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "100")) * 1024 * 1024

app = FastAPI(title="cityXai Ingest API", docs_url=None, redoc_url=None)
app.add_middleware(MetricsMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "https://localhost")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Namespace"],
)
jobs: dict[str, IngestJob] = {}
embedder = Embedder()
chunker = SemanticChunker(chunk_size=int(os.getenv("CHUNK_SIZE", "512")), overlap=int(os.getenv("CHUNK_OVERLAP", "50")))


def _normalize_metadata(metadata: dict) -> dict:
    normalized = {}
    for key, value in metadata.items():
        if isinstance(value, (str, int, float, bool)) or value is None:
            normalized[key] = value
        else:
            normalized[key] = json.dumps(value, ensure_ascii=True)
    return normalized


def process_document(filename: str, file_bytes: bytes, classification: str, uploader_id: str, department: str = "Allgemein") -> IngestJob:
    job_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())
    job = IngestJob(job_id=job_id, status="processing", filename=filename, doc_id=doc_id)
    jobs[job_id] = job
    try:
        markdown, metadata = route_document(filename, None, file_bytes)
        uploader_hash = hashlib.sha256(uploader_id.encode("utf-8")).hexdigest()
        markdown = inject_metadata(
            markdown=markdown,
            filename=filename,
            municipality=os.getenv("MUNICIPALITY_NAME", "Stadt Paderborn"),
            department=department,
            classification=classification,
            uploader_id_hash=uploader_hash,
        )
        doc_meta = _normalize_metadata({
            "filename": filename,
            "department": department,
            "classification": classification,
            "created_at": datetime.utcnow().isoformat(),
            "municipality": os.getenv("MUNICIPALITY_NAME", "Stadt Paderborn"),
            "uploader_id_hash": uploader_hash,
            "doc_id": doc_id,
            **metadata,
        })
        chunks = chunker.split(markdown, doc_id=doc_id)
        created = embedder.upsert_chunks(chunks, doc_meta, classification)
        DOCUMENT_COUNT.labels(classification).inc()
        job.status = "ready"
        job.chunks_created = created
        job.preview_md = markdown[:4000]
        return job
    except Exception as exc:
        INGEST_FAILURES.inc()
        job.status = "failed"
        job.error = str(exc)
        return job


@app.on_event("startup")
def on_startup() -> None:
    check_required_secrets()
    start_watcher(process_document)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/metrics")
async def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


_ALLOWED_CLASSIFICATIONS = {"public", "internal"}


@app.post("/ingest/upload")
async def upload_document(
    file: UploadFile = File(...),
    classification: str = Form("public"),
    department: str = Form("Allgemein"),
    claim: UserClaim = Depends(require_roles(["document_admin", "system_admin"])),
):
    if classification not in _ALLOWED_CLASSIFICATIONS:
        raise HTTPException(status_code=400, detail=f"Ungültige Klassifizierung. Erlaubt: {_ALLOWED_CLASSIFICATIONS}")
    file_bytes = await file.read()
    if len(file_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Datei zu groß. Maximale Größe: {_MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
        )
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Leere Datei")
    job = process_document(file.filename or "unnamed", file_bytes, classification, claim.sub, department)
    return {"job_id": job.job_id, "doc_id": job.doc_id}


@app.get("/ingest/status/{job_id}")
async def ingest_status(job_id: str, claim: UserClaim = Depends(require_roles(["document_admin", "staff", "system_admin", "readonly_auditor"]))):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job nicht gefunden")
    return job.model_dump()


@app.delete("/ingest/document/{doc_id}")
async def delete_document(doc_id: str, claim: UserClaim = Depends(require_roles(["document_admin", "system_admin"]))):
    for classification in ("internal", "public"):
        embedder.delete_document(classification, doc_id)
    return JSONResponse({"status": "deleted", "doc_id": doc_id})


@app.get("/ingest/documents")
async def list_documents(claim: UserClaim = Depends(require_roles(["document_admin", "staff", "system_admin", "readonly_auditor"]))):
    return {"documents": embedder.list_documents()}
