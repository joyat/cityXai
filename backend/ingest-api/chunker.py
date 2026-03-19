from __future__ import annotations

import re
import uuid


class SemanticChunker:
    def __init__(self, chunk_size: int = 512, overlap: int = 50) -> None:
        self.chunk_size = chunk_size
        self.overlap = overlap

    def _token_count(self, text: str) -> int:
        return len(text.split())

    def split(self, markdown: str, doc_id: str) -> list[dict]:
        lines = markdown.splitlines()
        sections: list[tuple[str, list[str]]] = []
        current_heading = "Einleitung"
        buffer: list[str] = []
        for line in lines:
            if line.startswith("## "):
                if buffer:
                    sections.append((current_heading, buffer[:]))
                    buffer.clear()
                current_heading = line[3:].strip()
            else:
                buffer.append(line)
        if buffer:
            sections.append((current_heading, buffer[:]))

        chunks: list[dict] = []
        position = 0
        for heading, section_lines in sections:
            text = "\n".join(section_lines).strip()
            if not text:
                continue
            sentences = re.split(r"(?<=[.!?])\s+", text)
            current = ""
            for sentence in sentences:
                candidate = f"{current} {sentence}".strip()
                if self._token_count(candidate) > self.chunk_size and current:
                    chunks.append(self._chunk_record(doc_id, position, current, heading))
                    position += 1
                    tail = current.split()
                    current = " ".join(tail[-self.overlap :]) if self.overlap else ""
                current = f"{current} {sentence}".strip()
            if current:
                while self._token_count(current) > self.chunk_size:
                    words = current.split()
                    segment = " ".join(words[: self.chunk_size])
                    chunks.append(self._chunk_record(doc_id, position, segment, heading))
                    position += 1
                    current = " ".join(words[self.chunk_size - self.overlap :])
                if current:
                    chunks.append(self._chunk_record(doc_id, position, current, heading))
                    position += 1
        return chunks

    def _chunk_record(self, doc_id: str, position: int, text: str, heading: str) -> dict:
        return {
            "chunk_id": str(uuid.uuid4()),
            "doc_id": doc_id,
            "position": position,
            "token_count": self._token_count(text),
            "section_heading": heading,
            "text": text.strip(),
        }
