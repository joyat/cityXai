from __future__ import annotations

import subprocess
import tempfile

from docx import Document


def extract_docx(file_bytes: bytes) -> tuple[str, dict]:
    try:
        with tempfile.NamedTemporaryFile(suffix=".docx") as handle:
            handle.write(file_bytes)
            handle.flush()
            document = Document(handle.name)
        blocks = []
        for para in document.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            style = (para.style.name or "").lower()
            if "heading 1" in style:
                blocks.append(f"# {text}")
            elif "heading 2" in style:
                blocks.append(f"## {text}")
            elif "heading 3" in style:
                blocks.append(f"### {text}")
            else:
                blocks.append(text)
        return "\n\n".join(blocks).strip(), {"converter": "python-docx"}
    except Exception:
        with tempfile.NamedTemporaryFile(suffix=".docx") as source, tempfile.NamedTemporaryFile(suffix=".md") as target:
            source.write(file_bytes)
            source.flush()
            subprocess.run(["pandoc", source.name, "-t", "gfm", "-o", target.name], check=True)
            return target.read().decode("utf-8"), {"converter": "pandoc"}
