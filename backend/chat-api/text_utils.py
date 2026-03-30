"""Shared text-processing utilities for retrieval and reranking."""
from __future__ import annotations

import re

# Metadata lines prepended by the ingest pipeline that should be excluded
# from BM25 indexing and rerank scoring to avoid noise in relevance signals.
METADATA_PREFIXES: tuple[str, ...] = (
    "Source:",
    "Last scraped:",
    "Department:",
    "Category:",
    "Tags:",
)

STOPWORDS: frozenset[str] = frozenset({
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "eines",
    "und", "oder", "ist", "sind", "war", "was", "welche", "welcher", "welches",
    "in", "im", "am", "an", "auf", "zu", "zum", "zur", "mit", "für", "von", "vom",
    "als", "auch", "nach", "bei", "über", "unter", "durch", "enthält",
})


def strip_metadata_lines(text: str) -> str:
    """Remove ingest-pipeline metadata lines from chunk text."""
    return "\n".join(
        line for line in text.splitlines()
        if not line.lstrip().startswith(METADATA_PREFIXES)
    )


def tokenize(text: str) -> list[str]:
    """Lowercase word-token list (no stopword filtering), used for BM25."""
    return re.findall(r"[a-zA-Z0-9äöüÄÖÜß]+", text.lower())


def normalize_tokens(text: str) -> set[str]:
    """Lowercase word-token set with stopword filtering, used for reranking."""
    return {
        token
        for token in re.findall(r"[a-zA-Z0-9äöüÄÖÜß]+", text.lower())
        if token and token not in STOPWORDS
    }
