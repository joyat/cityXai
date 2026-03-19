from __future__ import annotations

from io import BytesIO

import fitz
import pdfplumber
import pytesseract
from PIL import Image


def _page_to_markdown(page) -> str:
    tables = page.extract_tables()
    table_blocks = []
    for table in tables or []:
        if not table:
            continue
        rows = [["" if cell is None else str(cell).strip() for cell in row] for row in table]
        header = "| " + " | ".join(rows[0]) + " |"
        divider = "| " + " | ".join(["---"] * len(rows[0])) + " |"
        body = ["| " + " | ".join(row) + " |" for row in rows[1:]]
        table_blocks.append("\n".join([header, divider, *body]))
    text = page.extract_text(x_tolerance=2, y_tolerance=2) or ""
    return "\n\n".join(filter(None, [text.strip(), *table_blocks]))


def extract_pdf(file_bytes: bytes) -> tuple[str, dict]:
    markdown_pages: list[str] = []
    low_conf_pages: list[int] = []
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        extracted = "\n\n".join(_page_to_markdown(page) for page in pdf.pages).strip()
    if extracted:
        return extracted, {"ocr_used": False, "low_confidence_pages": []}

    doc = fitz.open(stream=file_bytes, filetype="pdf")
    for index, page in enumerate(doc, start=1):
        pix = page.get_pixmap(dpi=200)
        image = Image.open(BytesIO(pix.tobytes("png")))
        data = pytesseract.image_to_data(image, lang="deu", output_type=pytesseract.Output.DICT)
        words = [word for word in data["text"] if word.strip()]
        confidences = [float(conf) for conf in data["conf"] if conf not in {"-1", ""}]
        confidence = (sum(confidences) / len(confidences) / 100.0) if confidences else 0.0
        if confidence < 0.6:
            low_conf_pages.append(index)
        markdown_pages.append(f"## Seite {index}\n\n{' '.join(words).strip()}")
    return "\n\n".join(markdown_pages).strip(), {"ocr_used": True, "low_confidence_pages": low_conf_pages}
