from __future__ import annotations

from io import BytesIO

import pandas as pd
from bs4 import BeautifulSoup
from markdownify import markdownify


def extract_csv(file_bytes: bytes) -> tuple[str, dict]:
    dataframe = pd.read_csv(BytesIO(file_bytes))
    return dataframe.to_markdown(index=False), {"rows": int(dataframe.shape[0]), "columns": int(dataframe.shape[1])}


def extract_html(file_bytes: bytes) -> tuple[str, dict]:
    soup = BeautifulSoup(file_bytes, "html.parser")
    for tag in soup.find_all(["nav", "footer", "header"]):
        tag.decompose()
    return markdownify(str(soup), heading_style="ATX"), {"converter": "beautifulsoup4"}
