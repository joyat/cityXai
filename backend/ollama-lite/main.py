from __future__ import annotations

import hashlib
import math
import time
from typing import Any

from fastapi import FastAPI
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


REQUEST_COUNT = Counter("ollama_requests_total", "Total ollama-lite requests", ["path", "status"])
REQUEST_LATENCY = Histogram("ollama_request_latency_seconds", "Ollama-lite latency", ["path"])
TOKENS_PER_SEC = Gauge("cityxai_ollama_tokens_per_sec", "Synthetic Ollama throughput")


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        REQUEST_COUNT.labels(request.url.path, response.status_code).inc()
        REQUEST_LATENCY.labels(request.url.path).observe(time.perf_counter() - start)
        return response


app = FastAPI(title="Ollama Lite")
app.add_middleware(MetricsMiddleware)
TOKENS_PER_SEC.set(22.5)


def embed_text(text: str, size: int = 256) -> list[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    values = []
    for idx in range(size):
        byte = digest[idx % len(digest)]
        values.append(round(((byte / 255.0) * 2.0) - 1.0, 6))
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]


def make_answer(prompt: str) -> str:
    question = prompt.split("Frage:")[-1].strip() if "Frage:" in prompt else prompt[-1200:]
    context = prompt.split("Kontext:")[-1].split("Verlauf:")[0].strip() if "Kontext:" in prompt else ""
    snippets = [line.strip() for line in context.splitlines() if line.strip() and not line.startswith("[Quelle")]
    evidence = " ".join(snippets[:4])[:700]
    if not evidence:
        return (
            "Ich konnte in den lokalen Unterlagen keine belastbare Passage finden. "
            "Die Antwort ist mit Unsicherheit behaftet. Hinweis nach KI-Verordnung: Diese Antwort wurde automatisiert erzeugt."
        )
    return (
        f"Auf Basis der lokal verfügbaren Unterlagen lässt sich zur Frage \"{question}\" Folgendes zusammenfassen: "
        f"{evidence} [1]\n\nHinweis nach KI-Verordnung: Diese Antwort wurde automatisiert erzeugt."
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/metrics")
async def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/api/version")
async def version() -> dict[str, str]:
    return {"version": "0.0.1-demo"}


@app.post("/api/pull")
async def pull(payload: dict[str, Any]) -> dict[str, Any]:
    return {"status": "success", "model": payload.get("name") or payload.get("model")}


@app.post("/api/embeddings")
async def embeddings(payload: dict[str, Any]) -> dict[str, Any]:
    prompt = payload.get("prompt", "")
    return {"embedding": embed_text(prompt)}


@app.post("/api/generate")
async def generate(payload: dict[str, Any]) -> dict[str, Any]:
    prompt = payload.get("prompt", "")
    return {"response": make_answer(prompt), "done": True}
