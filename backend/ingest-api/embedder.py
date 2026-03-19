from __future__ import annotations

import os
from typing import Iterable

import chromadb
import httpx


class Embedder:
    def __init__(self) -> None:
        self.client = chromadb.HttpClient(host=os.getenv("CHROMADB_HOST", "chromadb"), port=int(os.getenv("CHROMADB_PORT", "8000")))
        self.ollama_url = os.getenv("OLLAMA_URL", "http://ollama:11434")
        self.embed_model = os.getenv("EMBED_MODEL", "nomic-embed-text:v1.5")
        self.namespace = os.getenv("MUNICIPALITY_NAMESPACE", "paderborn")

    def embed(self, texts: Iterable[str]) -> list[list[float]]:
        vectors = []
        with httpx.Client(timeout=60.0) as client:
            for text in texts:
                response = client.post(f"{self.ollama_url}/api/embeddings", json={"model": self.embed_model, "prompt": text})
                response.raise_for_status()
                vectors.append(response.json()["embedding"])
        return vectors

    def upsert_chunks(self, chunks: list[dict], metadata: dict, classification: str) -> int:
        if not chunks:
            return 0
        collection = self.client.get_or_create_collection(name=f"{self.namespace}_{classification}")
        documents = [chunk["text"] for chunk in chunks]
        vectors = self.embed(documents)
        metadatas = []
        ids = []
        for chunk in chunks:
            combined = dict(metadata)
            combined.update(
                {
                    "chunk_id": chunk["chunk_id"],
                    "doc_id": chunk["doc_id"],
                    "position": chunk["position"],
                    "token_count": chunk["token_count"],
                    "section_heading": chunk["section_heading"],
                    "text": chunk["text"],
                }
            )
            metadatas.append(combined)
            ids.append(chunk["chunk_id"])
        collection.upsert(ids=ids, documents=documents, embeddings=vectors, metadatas=metadatas)
        return len(ids)

    def delete_document(self, classification: str, doc_id: str) -> None:
        collection = self.client.get_or_create_collection(name=f"{self.namespace}_{classification}")
        collection.delete(where={"doc_id": doc_id})

    def list_documents(self) -> list[dict]:
        documents = {}
        for classification in ("internal", "public"):
            collection = self.client.get_or_create_collection(name=f"{self.namespace}_{classification}")
            items = collection.get(include=["metadatas"])
            for meta in items.get("metadatas", []):
                doc_id = meta["doc_id"]
                if doc_id not in documents:
                    documents[doc_id] = {
                        "doc_id": doc_id,
                        "filename": meta.get("filename"),
                        "classification": classification,
                        "department": meta.get("department"),
                        "created_at": meta.get("created_at"),
                        "chunk_count": 0,
                        "content_type": meta.get("content_type"),
                    }
                documents[doc_id]["chunk_count"] += 1
        return list(documents.values())
