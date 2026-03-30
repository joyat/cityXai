from __future__ import annotations


def extract_markdown(file_bytes: bytes) -> tuple[str, dict]:
    text = file_bytes.decode("utf-8-sig")
    line_count = len(text.splitlines())
    heading_count = sum(1 for line in text.splitlines() if line.lstrip().startswith("#"))
    return text, {"converter": "markdown", "line_count": line_count, "heading_count": heading_count}
