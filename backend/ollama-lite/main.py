from __future__ import annotations

import hashlib
import math
import os
import time
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
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


LM_STUDIO_BASE_URL = os.getenv("LM_STUDIO_BASE_URL", "http://host.docker.internal:1234/v1").rstrip("/")
LM_STUDIO_TIMEOUT = float(os.getenv("LM_STUDIO_TIMEOUT_SECONDS", "180"))


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


def _upstream_available() -> bool:
    return os.getenv("USE_LM_STUDIO", "true").lower() in {"1", "true", "yes", "on"}


def _to_openai_messages(prompt: str) -> list[dict[str, str]]:
    return [{"role": "user", "content": prompt}]


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str):
                parts.append(item["text"])
        if parts:
            return "".join(parts)
    raise HTTPException(status_code=502, detail="LM Studio returned an unsupported message format")


def _extract_response_text(payload: dict[str, Any]) -> str:
    output = payload.get("output")
    if not isinstance(output, list):
        raise HTTPException(status_code=502, detail="LM Studio response was missing output")
    for item in output:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if not isinstance(content, list):
            continue
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "output_text" and isinstance(block.get("text"), str):
                parts.append(block["text"])
        if parts:
            return "".join(parts).strip()
    raise HTTPException(status_code=502, detail="LM Studio response did not contain output_text")


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
    if not _upstream_available():
        return {"embedding": embed_text(prompt)}
    model = payload.get("model") or os.getenv("EMBED_MODEL")
    try:
        with httpx.Client(timeout=LM_STUDIO_TIMEOUT) as client:
            response = client.post(
                f"{LM_STUDIO_BASE_URL}/embeddings",
                json={"model": model, "input": prompt},
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"LM Studio embeddings request failed: {exc}") from exc
    data = response.json().get("data") or []
    if not data or not isinstance(data[0], dict) or "embedding" not in data[0]:
        raise HTTPException(status_code=502, detail="LM Studio embeddings response was missing data[0].embedding")
    return {"embedding": data[0]["embedding"]}


@app.post("/api/generate")
async def generate(payload: dict[str, Any]) -> dict[str, Any]:
    prompt = payload.get("prompt", "")
    if not _upstream_available():
        return {"response": make_answer(prompt), "done": True}
    model = payload.get("model") or os.getenv("OLLAMA_PRIMARY_MODEL")
    try:
        with httpx.Client(timeout=LM_STUDIO_TIMEOUT) as client:
            response = client.post(
                f"{LM_STUDIO_BASE_URL}/responses",
                json={
                    "model": model,
                    "input": prompt,
                    "temperature": 0.2,
                },
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"LM Studio generate request failed: {exc}") from exc
    return {"response": _extract_response_text(response.json()), "done": True}
