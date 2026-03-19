from __future__ import annotations

import os

import httpx


def call_ollama(prompt: str, model: str, context_chunks: list[dict], conversation_history: list[dict]) -> str:
    context = "\n\n".join(
        f"[Quelle {idx}] {chunk['metadata'].get('filename')} / {chunk['metadata'].get('section_heading', 'Abschnitt')}\n{chunk['document']}"
        for idx, chunk in enumerate(context_chunks, start=1)
    )
    history = "\n".join(f"{item.get('role', 'user')}: {item.get('content', '')}" for item in conversation_history)
    system_prompt = (
        "Du bist PadeRoBot+, ein kommunaler KI-Assistent für deutsche Verwaltungen. "
        "Antworte präzise, sachlich und in der Sprache der Anfrage. "
        "Zitiere die Quellen mit eckigen Klammern wie [1]. "
        "Wenn die Evidenz schwach ist, nutze den Hinweis: 'Die Antwort ist mit Unsicherheit behaftet.' "
        "Bei Bürgeranfragen füge am Ende transparent hinzu: 'Hinweis nach KI-Verordnung: Diese Antwort wurde automatisiert erzeugt.'"
    )
    full_prompt = f"{system_prompt}\n\nKontext:\n{context}\n\nVerlauf:\n{history}\n\nFrage:\n{prompt}\n"
    with httpx.Client(timeout=120.0) as client:
        response = client.post(
            f"{os.getenv('OLLAMA_URL', 'http://ollama:11434')}/api/generate",
            json={"model": model, "prompt": full_prompt, "stream": False},
        )
        response.raise_for_status()
        return response.json()["response"].strip()
