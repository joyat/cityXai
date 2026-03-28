from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class IngestJob(BaseModel):
    job_id: str
    status: Literal["processing", "ready", "failed"]
    filename: str
    doc_id: str | None = None
    chunks_created: int = 0
    preview_md: str = ""
    error: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class QueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    namespace: str = Field(min_length=1, max_length=64)
    conversation_history: list[dict[str, str]] = Field(default_factory=list, max_length=50)
    retrieval_mode: Literal["hybrid", "dense"] = "hybrid"


class QueryResponse(BaseModel):
    answer: str
    sources: list[dict[str, Any]]
    confidence: float
    flagged: bool
    latency_ms: int
    session_id: str | None = None
    retrieved_chunks: list[dict[str, Any]] = Field(default_factory=list)
    retrieval_scores: list[float] = Field(default_factory=list)
    expanded_queries: list[str] = Field(default_factory=list)


class AuditEvent(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    municipality: str
    user_role: str
    user_id_hash: str
    query_hash: str
    retrieved_doc_ids: list[str]
    model_used: str
    response_tokens: int
    latency_ms: int
    flagged: bool


class UserClaim(BaseModel):
    sub: str
    email: str | None = None
    preferred_username: str | None = None
    roles: list[str] = Field(default_factory=list)
    municipality: str


class DocumentMeta(BaseModel):
    doc_id: str
    filename: str
    content_type: str
    municipality: str
    department: str
    classification: Literal["internal", "public"]
    uploader_id_hash: str
    chunk_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    extra: dict[str, Any] = Field(default_factory=dict)
