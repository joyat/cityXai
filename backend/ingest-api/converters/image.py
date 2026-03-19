from __future__ import annotations

from io import BytesIO

import pytesseract
from PIL import Image, ImageEnhance, ImageOps


def extract_image(file_bytes: bytes) -> tuple[str, dict]:
    image = Image.open(BytesIO(file_bytes)).convert("L")
    image = ImageOps.autocontrast(image)
    image = ImageEnhance.Contrast(image).enhance(1.5)
    text = pytesseract.image_to_string(image, lang="deu+eng").strip()
    word_count = len(text.split())
    if word_count < 5:
        return "", {"skipped": True, "word_count": word_count}
    return text, {"skipped": False, "word_count": word_count}
