from __future__ import annotations

import os
import time
import uuid
from collections import defaultdict

from fastapi import Depends, FastAPI, Header
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from audit import log_query_event
from backend.shared.auth import require_roles
from backend.shared.models import QueryRequest, QueryResponse, UserClaim
from llm import call_ollama
from reranker import CrossEncoderReranker
from retrieval import HybridRetriever


REQUEST_COUNT = Counter("chat_api_requests_total", "Total chat requests", ["method", "path", "status"])
REQUEST_LATENCY = Histogram("chat_api_request_latency_seconds", "Chat api latency", ["path"])
AVG_RETRIEVAL_SCORE = Gauge("cityxai_avg_retrieval_score", "Average retrieval score")
OLLAMA_TOKENS_PER_SEC = Gauge("cityxai_ollama_tokens_per_sec", "Synthetic Ollama throughput")
QUERY_VOLUME = Counter("cityxai_queries_total", "Total queries", ["namespace"])


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        REQUEST_COUNT.labels(request.method, request.url.path, response.status_code).inc()
        REQUEST_LATENCY.labels(request.url.path).observe(duration)
        return response


app = FastAPI(title="cityXai Chat API")
app.add_middleware(MetricsMiddleware)
retriever = HybridRetriever()
reranker = CrossEncoderReranker()
history_store: dict[str, list[dict]] = defaultdict(list)


@app.on_event("startup")
def seed_metrics() -> None:
    OLLAMA_TOKENS_PER_SEC.set(18.4)
    AVG_RETRIEVAL_SCORE.set(0.74)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/metrics")
async def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/chat/query")
async def chat_query(
    payload: QueryRequest,
    claim: UserClaim = Depends(require_roles(["citizen", "staff", "document_admin", "system_admin", "readonly_auditor"])),
    x_dev_mode: str | None = Header(default="false"),
):
    started = time.perf_counter()
    expanded_queries = retriever.expand_query(payload.query)
    dense_results = []
    sparse_results = []
    for query in expanded_queries:
        dense_results.extend(retriever.dense_search(retriever._embed(query), payload.namespace))
        if payload.retrieval_mode == "hybrid":
            sparse_results.extend(retriever.sparse_search(query, payload.namespace))
    fused = dense_results if payload.retrieval_mode == "dense" else retriever.reciprocal_rank_fusion(dense_results, sparse_results)
    reranked = reranker.rerank(payload.query, fused, top_n=int(os.getenv("RERANK_TOP_N", "5")))
    retrieval_scores = [round(chunk.get("rerank_score", chunk.get("rrf", chunk.get("score", 0.0))), 4) for chunk in reranked]
    AVG_RETRIEVAL_SCORE.set(sum(retrieval_scores) / len(retrieval_scores) if retrieval_scores else 0.0)
    answer = call_ollama(payload.query, os.getenv("OLLAMA_PRIMARY_MODEL", "qwen3:8b-q4_K_M"), reranked, payload.conversation_history)
    latency_ms = int((time.perf_counter() - started) * 1000)
    flagged = (sum(retrieval_scores) / len(retrieval_scores) if retrieval_scores else 0.0) < float(os.getenv("CONFIDENCE_THRESHOLD", "0.5"))
    event = log_query_event(
        municipality=os.getenv("MUNICIPALITY_NAME", "Stadt Paderborn"),
        user_role=claim.roles[0],
        user_id=claim.sub,
        query_text=payload.query,
        retrieved_doc_ids=[chunk["metadata"]["doc_id"] for chunk in reranked],
        model_used=os.getenv("OLLAMA_PRIMARY_MODEL", "qwen3:8b-q4_K_M"),
        response_tokens=max(len(answer.split()), 1),
        latency_ms=latency_ms,
        flagged=flagged,
    )
    session_id = str(uuid.uuid4())
    history_store[session_id] = payload.conversation_history + [{"role": "user", "content": payload.query}, {"role": "assistant", "content": answer}]
    QUERY_VOLUME.labels(payload.namespace).inc()
    response = QueryResponse(
        answer=answer,
        sources=[
            {
                "filename": chunk["metadata"].get("filename"),
                "doc_id": chunk["metadata"]["doc_id"],
                "section_heading": chunk["metadata"].get("section_heading"),
                "score": retrieval_scores[idx],
            }
            for idx, chunk in enumerate(reranked)
        ],
        confidence=max(0.0, min(1.0, sum(retrieval_scores) / len(retrieval_scores) if retrieval_scores else 0.0)),
        flagged=event.flagged,
        latency_ms=latency_ms,
        retrieved_chunks=reranked if x_dev_mode.lower() == "true" else [],
        retrieval_scores=retrieval_scores if x_dev_mode.lower() == "true" else [],
        expanded_queries=expanded_queries if x_dev_mode.lower() == "true" else [],
    )
    return response.model_dump()


@app.get("/chat/history/{session_id}")
async def chat_history(session_id: str, claim: UserClaim = Depends(require_roles(["citizen", "staff", "document_admin", "system_admin", "readonly_auditor"]))):
    return {"session_id": session_id, "history": history_store.get(session_id, [])}
