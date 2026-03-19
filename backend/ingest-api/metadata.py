from __future__ import annotations

import hashlib

import yaml


def inject_metadata(
    markdown: str,
    filename: str,
    municipality: str,
    department: str,
    classification: str,
    uploader_id_hash: str,
) -> str:
    frontmatter = {
        "filename": filename,
        "municipality": municipality,
        "department": department,
        "classification": classification,
        "uploader_id_hash": uploader_id_hash,
        "checksum": hashlib.sha256(markdown.encode("utf-8")).hexdigest(),
    }
    return f"---\n{yaml.safe_dump(frontmatter, sort_keys=False)}---\n\n{markdown}"
