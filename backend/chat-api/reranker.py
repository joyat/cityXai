from __future__ import annotations


class TermOverlapReranker:
    """
    Lightweight reranker based on term-overlap density between query and chunk text.
    This is a heuristic scorer suitable for demos — not an ML cross-encoder model.
    Replace with sentence-transformers CrossEncoder for production-quality ranking.
    """

    def __init__(self) -> None:
        pass

    def rerank(self, query: str, chunks: list[dict], top_n: int = 5) -> list[dict]:
        if not chunks:
            return []
        query_terms = {term for term in query.lower().split() if term}
        scores = []
        for chunk in chunks:
            document_terms = {term for term in chunk["document"].lower().split() if term}
            overlap = len(query_terms & document_terms)
            density = overlap / max(len(query_terms), 1)
            score = density + (chunk.get("rrf") or chunk.get("score") or 0.0)
            scores.append(score)
        ranked = sorted(
            [{**chunk, "rerank_score": float(score)} for chunk, score in zip(chunks, scores)],
            key=lambda item: item["rerank_score"],
            reverse=True,
        )
        return ranked[:top_n]
