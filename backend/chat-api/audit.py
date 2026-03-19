from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path

from backend.shared.models import AuditEvent


def _today_path(base: Path) -> Path:
    return base / f"audit-{datetime.utcnow():%Y-%m-%d}.log"


def log_query_event(
    municipality: str,
    user_role: str,
    user_id: str,
    query_text: str,
    retrieved_doc_ids: list[str],
    model_used: str,
    response_tokens: int,
    latency_ms: int,
    flagged: bool,
) -> AuditEvent:
    base = Path("/data/audit")
    base.mkdir(parents=True, exist_ok=True)
    event = AuditEvent(
        municipality=municipality,
        user_role=user_role,
        user_id_hash=hashlib.sha256(user_id.encode("utf-8")).hexdigest(),
        query_hash=hashlib.sha256(query_text.encode("utf-8")).hexdigest(),
        retrieved_doc_ids=retrieved_doc_ids,
        model_used=model_used,
        response_tokens=response_tokens,
        latency_ms=latency_ms,
        flagged=flagged,
    )
    path = _today_path(base)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event.model_dump(mode="json"), ensure_ascii=False) + "\n")
    latest = base / "audit.log"
    latest.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    return event
