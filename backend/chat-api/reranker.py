from __future__ import annotations

from text_utils import normalize_tokens, strip_metadata_lines


def _content_text(chunk: dict) -> str:
    return strip_metadata_lines(chunk["document"])


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
        query_terms = normalize_tokens(query)
        scores = []
        for chunk in chunks:
            metadata = chunk.get("metadata", {})
            document_terms = normalize_tokens(_content_text(chunk))
            filename_terms = normalize_tokens(metadata.get("filename", ""))
            section_terms = normalize_tokens(metadata.get("section_heading", ""))
            content_overlap = len(query_terms & document_terms)
            title_overlap = len(query_terms & (filename_terms | section_terms))
            coverage = content_overlap / max(len(query_terms), 1)
            title_boost = title_overlap / max(len(query_terms), 1)
            score = (chunk.get("rrf") or chunk.get("score") or 0.0) + coverage + (title_boost * 1.5)
            scores.append(score)
        ranked = sorted(
            [{**chunk, "rerank_score": float(score)} for chunk, score in zip(chunks, scores)],
            key=lambda item: item["rerank_score"],
            reverse=True,
        )
        return ranked[:top_n]
