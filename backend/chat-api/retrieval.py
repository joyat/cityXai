from __future__ import annotations

import os
from collections import defaultdict

import chromadb
import httpx
from rank_bm25 import BM25Okapi


class HybridRetriever:
    def __init__(self) -> None:
        self.namespace_prefix = os.getenv("MUNICIPALITY_NAMESPACE", "paderborn")
        self.k = int(os.getenv("RETRIEVAL_K", "10"))
        self.client = chromadb.HttpClient(host=os.getenv("CHROMADB_HOST", "chromadb"), port=int(os.getenv("CHROMADB_PORT", "8000")))
        self.ollama_url = os.getenv("OLLAMA_URL", "http://ollama:11434")
        self.embed_model = os.getenv("EMBED_MODEL", "nomic-embed-text:v1.5")
        self.bm25_indexes: dict[str, tuple[BM25Okapi, list[dict]]] = {}

    def _collection(self, namespace: str):
        return self.client.get_or_create_collection(name=f"{self.namespace_prefix}_{namespace}")

    def _embed(self, text: str) -> list[float]:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(f"{self.ollama_url}/api/embeddings", json={"model": self.embed_model, "prompt": text})
            response.raise_for_status()
            return response.json()["embedding"]

    def rebuild_sparse_index(self, namespace: str) -> None:
        collection = self._collection(namespace)
        payload = collection.get(include=["documents", "metadatas"])
        corpus = payload.get("documents", [])
        metas = payload.get("metadatas", [])
        tokenized = [doc.lower().split() for doc in corpus]
        self.bm25_indexes[namespace] = (BM25Okapi(tokenized if tokenized else [["leer"]]), [{"document": doc, "metadata": meta} for doc, meta in zip(corpus, metas)])

    def dense_search(self, query_embed: list[float], namespace: str, k: int | None = None) -> list[dict]:
        collection = self._collection(namespace)
        results = collection.query(query_embeddings=[query_embed], n_results=k or self.k, include=["documents", "metadatas", "distances"])
        dense = []
        for doc, meta, distance in zip(results["documents"][0], results["metadatas"][0], results["distances"][0]):
            dense.append({"document": doc, "metadata": meta, "score": 1.0 / (1.0 + distance), "source": "dense"})
        return dense

    def sparse_search(self, query_text: str, namespace: str, k: int | None = None) -> list[dict]:
        self.rebuild_sparse_index(namespace)
        index, docs = self.bm25_indexes[namespace]
        scores = index.get_scores(query_text.lower().split())
        ranked = sorted(zip(scores, docs), key=lambda item: item[0], reverse=True)[: k or self.k]
        return [{"document": doc["document"], "metadata": doc["metadata"], "score": float(score), "source": "sparse"} for score, doc in ranked]

    def reciprocal_rank_fusion(self, dense_results: list[dict], sparse_results: list[dict]) -> list[dict]:
        merged = defaultdict(lambda: {"rrf": 0.0})
        for rank, item in enumerate(dense_results, start=1):
            key = item["metadata"]["chunk_id"]
            merged[key].update(item)
            merged[key]["rrf"] += 1.0 / (60 + rank)
        for rank, item in enumerate(sparse_results, start=1):
            key = item["metadata"]["chunk_id"]
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
                response = client.post(f"{self.ollama_url}/api/generate", json={"model": os.getenv("OLLAMA_PRIMARY_MODEL"), "prompt": prompt, "stream": False})
                response.raise_for_status()
                text = response.json()["response"]
            lines = [line.strip('-* "') for line in text.splitlines() if line.strip()]
            candidates = [query_text]
            for line in lines:
                if line not in candidates:
                    candidates.append(line)
                if len(candidates) == 3:
                    break
            return candidates
        except Exception:
            return [query_text]
