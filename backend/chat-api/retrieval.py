from __future__ import annotations

import json
import os
import time
from collections import defaultdict

import chromadb
import httpx
from rank_bm25 import BM25Okapi

from text_utils import normalize_tokens, strip_metadata_lines, tokenize

# BM25 index TTL — rebuild at most once per minute per namespace.
# This prevents a full corpus scan on every single query.
_BM25_TTL = 60  # seconds


class HybridRetriever:
    def __init__(self) -> None:
        self.namespace_prefix = os.getenv("MUNICIPALITY_NAMESPACE", "paderborn")
        self.k = int(os.getenv("RETRIEVAL_K", "10"))
        self.client = chromadb.HttpClient(
            host=os.getenv("CHROMADB_HOST", "chromadb"),
            port=int(os.getenv("CHROMADB_PORT", "8000")),
        )
        self.ollama_url = os.getenv("OLLAMA_URL", "http://ollama:11434")
        self.embed_model = os.getenv("EMBED_MODEL", "nomic-embed-text:v1.5")
        # {namespace: (BM25Okapi, docs_list, built_at_monotonic)}
        self._bm25_cache: dict[str, tuple[BM25Okapi, list[dict], float]] = {}

    def _collection(self, namespace: str):
        return self.client.get_or_create_collection(name=f"{self.namespace_prefix}_{namespace}")

    def _embed(self, text: str) -> list[float]:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{self.ollama_url}/api/embeddings",
                json={"model": self.embed_model, "prompt": text},
            )
            response.raise_for_status()
            return response.json()["embedding"]

    def _get_or_build_bm25(self, namespace: str) -> tuple[BM25Okapi, list[dict]]:
        """Return a cached BM25 index, rebuilding only if the TTL has expired."""
        cached = self._bm25_cache.get(namespace)
        if cached and time.monotonic() - cached[2] < _BM25_TTL:
            return cached[0], cached[1]

        collection = self._collection(namespace)
        payload = collection.get(include=["documents", "metadatas"])
        corpus = payload.get("documents") or []
        metas = payload.get("metadatas") or []
        tokenized = [tokenize(strip_metadata_lines(doc)) for doc in corpus] if corpus else [["leer"]]
        index = BM25Okapi(tokenized)
        docs = [{"document": doc, "metadata": meta} for doc, meta in zip(corpus, metas)]
        self._bm25_cache[namespace] = (index, docs, time.monotonic())
        return index, docs

    def invalidate_bm25(self, namespace: str) -> None:
        """Force a rebuild on the next sparse search (call after ingest)."""
        self._bm25_cache.pop(namespace, None)

    def dense_search(self, query_embed: list[float], namespace: str, k: int | None = None) -> list[dict]:
        collection = self._collection(namespace)
        results = collection.query(
            query_embeddings=[query_embed],
            n_results=k or self.k,
            include=["documents", "metadatas", "distances"],
        )
        dense = []
        for doc, meta, distance in zip(
            results["documents"][0], results["metadatas"][0], results["distances"][0]
        ):
            dense.append({"document": doc, "metadata": meta, "score": 1.0 / (1.0 + distance), "source": "dense"})
        return dense

    def sparse_search(self, query_text: str, namespace: str, k: int | None = None) -> list[dict]:
        index, docs = self._get_or_build_bm25(namespace)
        scores = index.get_scores(tokenize(query_text))
        ranked = sorted(zip(scores, docs), key=lambda item: item[0], reverse=True)[: k or self.k]
        return [
            {"document": d["document"], "metadata": d["metadata"], "score": float(s), "source": "sparse"}
            for s, d in ranked
        ]

    def reciprocal_rank_fusion(self, dense_results: list[dict], sparse_results: list[dict]) -> list[dict]:
        merged: dict[str, dict] = defaultdict(lambda: {"rrf": 0.0})
        for rank, item in enumerate(dense_results, start=1):
            key = item["metadata"].get("chunk_id", id(item))
            merged[key].update(item)
            merged[key]["rrf"] += 1.0 / (60 + rank)
        for rank, item in enumerate(sparse_results, start=1):
            key = item["metadata"].get("chunk_id", id(item))
            merged[key].update(item)
            merged[key]["rrf"] += 1.0 / (60 + rank)
        return sorted(merged.values(), key=lambda item: item["rrf"], reverse=True)

    def expand_query(self, query_text: str) -> list[str]:
        prompt = (
            "Erzeuge genau zwei deutsche Paraphrasen für die folgende Verwaltungsfrage. "
            "Antworte als JSON-Array mit drei Einträgen inklusive Originalfrage.\n"
            f"Frage: {query_text}"
        )
        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.post(
                    f"{self.ollama_url}/api/generate",
                    json={"model": os.getenv("OLLAMA_PRIMARY_MODEL"), "prompt": prompt, "stream": False},
                )
                response.raise_for_status()
                text = response.json()["response"]
            payload = json.loads(text)
            if not isinstance(payload, list):
                return [query_text]
            candidates = []
            for item in payload:
                if isinstance(item, str):
                    normalized = item.strip()
                    if normalized and normalized not in candidates:
                        candidates.append(normalized)
                if len(candidates) == 3:
                    break
            if query_text not in candidates:
                candidates.insert(0, query_text)
            return candidates[:3] if candidates else [query_text]
        except Exception:
            return [query_text]
