from __future__ import annotations

import mimetypes
import os

from converters.csv_html import extract_csv, extract_html
from converters.docx import extract_docx
from converters.image import extract_image
from converters.pdf import extract_pdf
from converters.pptx import extract_pptx
from converters.xlsx import extract_xlsx


ROUTES = {
    ".pdf": extract_pdf,
    ".docx": extract_docx,
    ".xlsx": extract_xlsx,
    ".pptx": extract_pptx,
    ".csv": extract_csv,
    ".html": extract_html,
    ".htm": extract_html,
    ".png": extract_image,
    ".jpg": extract_image,
    ".jpeg": extract_image,
}


def route_document(filename: str, content_type: str | None, file_bytes: bytes) -> tuple[str, dict]:
    extension = os.path.splitext(filename.lower())[1]
    guessed_type = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    converter = ROUTES.get(extension)
    if converter is None and guessed_type.startswith("image/"):
        converter = extract_image
    if converter is None:
        raise ValueError(f"Nicht unterstütztes Dateiformat: {filename}")
    markdown, metadata = converter(file_bytes)
    metadata.update({"content_type": guessed_type, "extension": extension})
    return markdown.strip(), metadata
