from __future__ import annotations

import os

import httpx



def _language_copy(response_language: str) -> dict[str, str]:
    if response_language == "en":
        return {
            "source_label": "Source",
            "section_label": "Section",
            "context_label": "Context",
            "history_label": "History",
            "question_label": "Question",
            "system_prompt": (
                "You are cityXai, a municipal AI assistant for German public administrations. "
                "Answer exclusively in English. "
                "Be precise, factual, and concise. "
                "Use only statements grounded in the provided context that directly answer the question. "
                "Ignore irrelevant passages even if they were ranked highly. "
                "Summarize the answer in 2 to 4 sentences and prefer concrete facts or rules over file metadata. "
                "Cite sources with square brackets like [1]. "
                "If the evidence is weak, include the notice: 'The answer is uncertain.' "
                "For citizen-facing answers, end with: 'Notice under the AI Act: This answer was generated automatically.'"
            ),
        }
    return {
        "source_label": "Quelle",
        "section_label": "Abschnitt",
        "context_label": "Kontext",
        "history_label": "Verlauf",
        "question_label": "Frage",
        "system_prompt": (
            "Du bist cityXai, ein kommunaler KI-Assistent für deutsche Verwaltungen. "
            "Antworte ausschließlich auf Deutsch. "
            "Antworte präzise, sachlich und knapp. "
            "Nutze nur Aussagen aus dem bereitgestellten Kontext, die die Frage direkt beantworten. "
            "Ignoriere irrelevante Fundstellen, auch wenn sie hoch gerankt sind. "
            "Fasse die Antwort in 2 bis 4 Sätzen zusammen und nenne konkrete Regeln oder Fakten statt Dateimetadaten. "
            "Zitiere Quellen mit eckigen Klammern wie [1]. "
            "Wenn die Evidenz schwach ist, nutze den Hinweis: 'Die Antwort ist mit Unsicherheit behaftet.' "
            "Bei Bürgeranfragen füge am Ende hinzu: 'Hinweis nach KI-Verordnung: Diese Antwort wurde automatisiert erzeugt.'"
        ),
    }


def call_ollama(
    prompt: str,
    model: str,
    context_chunks: list[dict],
    conversation_history: list[dict],
    response_language: str,
) -> str:
    copy = _language_copy(response_language)
    context = "\n\n".join(
        f"[{copy['source_label']} {idx}] {chunk['metadata'].get('filename')} / {chunk['metadata'].get('section_heading', copy['section_label'])}\n{chunk['document']}"
        for idx, chunk in enumerate(context_chunks, start=1)
    )
    history = "\n".join(f"{item.get('role', 'user')}: {item.get('content', '')}" for item in conversation_history)
    full_prompt = (
        f"{copy['system_prompt']}\n\n"
        f"{copy['context_label']}:\n{context}\n\n"
        f"{copy['history_label']}:\n{history}\n\n"
        f"{copy['question_label']}:\n{prompt}\n"
    )
    with httpx.Client(timeout=120.0) as client:
        response = client.post(
            f"{os.getenv('OLLAMA_URL', 'http://ollama:11434')}/api/generate",
            json={"model": model, "prompt": full_prompt, "stream": False},
        )
        response.raise_for_status()
        answer = response.json()["response"].strip()
    return answer
