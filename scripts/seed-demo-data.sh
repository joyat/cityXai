#!/bin/sh
set -eu

BASE_URL="${BASE_URL:-https://localhost}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
INGEST_CONTAINER="${INGEST_CONTAINER:-cityxai-ingest-api-1}"
ENV_FILE="${ENV_FILE:-.env}"

read_env_file_var() {
  key="$1"
  if [ -f "$ENV_FILE" ]; then
    awk -F= -v target="$key" '$1 == target { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
  fi
}

JWT_SECRET="${JWT_SECRET:-$(read_env_file_var JWT_SECRET)}"
MUNICIPALITY_NAMESPACE="${MUNICIPALITY_NAMESPACE:-$(read_env_file_var MUNICIPALITY_NAMESPACE)}"
export JWT_SECRET MUNICIPALITY_NAMESPACE

wait_for_container_health() {
  container="$1"
  retries="${2:-60}"
  i=0
  while [ "$i" -lt "$retries" ]; do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"
    if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
      return 0
    fi
    i=$((i + 1))
    sleep 2
  done
  echo "Container $container did not become healthy" >&2
  return 1
}

curl_download() {
  url="$1"
  output="$2"
  curl -kfsSL "$url" -o "$output" || return 1
}

make_fallback_docs() {
  docker exec "$INGEST_CONTAINER" sh -lc "mkdir -p /tmp/cityxai-seed"
  docker exec -i "$INGEST_CONTAINER" python - <<'PY'
import fitz
from docx import Document
from openpyxl import Workbook

pdf_path = "/tmp/cityxai-seed/bebauungsplan.pdf"
doc = fitz.open()
page = doc.new_page()
page.insert_text((72, 72), "# Bebauungsplan Musterquartier\n\nNutzung: Das Gebiet ist als allgemeines Wohngebiet festgesetzt.\n\nErschließung: Die Zufahrt erfolgt über die Musterstraße.")
doc.save(pdf_path)

document = Document()
document.add_heading("Haushaltssatzung 2026", level=1)
document.add_heading("Erträge", level=2)
document.add_paragraph("Die ordentlichen Erträge betragen 120.000.000 EUR.")
document.add_heading("Aufwendungen", level=2)
document.add_paragraph("Die ordentlichen Aufwendungen betragen 118.500.000 EUR.")
document.save("/tmp/cityxai-seed/haushaltssatzung.docx")

wb = Workbook()
ws = wb.active
ws.title = "Abfallkalender"
ws.append(["Datum", "Bezirk", "Fraktion"])
ws.append(["2026-04-02", "Mitte", "Restmüll"])
ws.append(["2026-04-09", "Mitte", "Bioabfall"])
ws.append(["2026-04-16", "Mitte", "Papier"])
wb.save("/tmp/cityxai-seed/abfallkalender.xlsx")
PY
  docker cp "$INGEST_CONTAINER:/tmp/cityxai-seed/bebauungsplan.pdf" "$TMP_DIR/bebauungsplan.pdf"
  docker cp "$INGEST_CONTAINER:/tmp/cityxai-seed/haushaltssatzung.docx" "$TMP_DIR/haushaltssatzung.docx"
  docker cp "$INGEST_CONTAINER:/tmp/cityxai-seed/abfallkalender.xlsx" "$TMP_DIR/abfallkalender.xlsx"
}

if ! curl_download "https://www.stadt-paderborn.de" "$TMP_DIR/source.html"; then
  :
fi

wait_for_container_health cityxai-nginx-1
wait_for_container_health cityxai-ingest-api-1
wait_for_container_health cityxai-chat-api-1

make_fallback_docs

token_response="$(curl -kfsS -X POST "$BASE_URL/keycloak/realms/cityxai/protocol/openid-connect/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=cityxai-frontend' \
  -d 'grant_type=password' \
  -d 'username=docadmin@demo.de' \
  -d 'password=Demo1234!' 2>/dev/null || true)"

TOKEN="$(printf '%s' "$token_response" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))' 2>/dev/null || true)"

if [ -z "$TOKEN" ]; then
  TOKEN="$(python3 - <<'PY'
import base64
import hashlib
import hmac
import json
import os
import time

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

secret = os.getenv("JWT_SECRET", "dev-secret")
header = {"alg": "HS256", "typ": "JWT"}
now = int(time.time())
payload = {
    "sub": "seed-docadmin",
    "email": "docadmin@demo.de",
    "preferred_username": "docadmin@demo.de",
    "municipality": os.getenv("MUNICIPALITY_NAMESPACE", "paderborn"),
    "realm_access": {"roles": ["document_admin", "staff"]},
    "iat": now,
    "exp": now + 3600,
}
header_b64 = b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
payload_b64 = b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
signature = b64url(hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest())
print(f"{header_b64}.{payload_b64}.{signature}")
PY
)"
fi

for file in "$TMP_DIR/bebauungsplan.pdf" "$TMP_DIR/haushaltssatzung.docx" "$TMP_DIR/abfallkalender.xlsx"
do
  curl -kfsS -X POST "$BASE_URL/api/ingest/upload" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Namespace: ${MUNICIPALITY_NAMESPACE:-paderborn}" \
    -F "classification=public" \
    -F "department=Demo" \
    -F "file=@$file"
done

for i in $(seq 1 24)
do
  curl -kfsS -X POST "$BASE_URL/api/chat/query" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Namespace: ${MUNICIPALITY_NAMESPACE:-paderborn}" \
    -H "Content-Type: application/json" \
    -d '{"query":"Welche Regeln gelten im Musterquartier?","namespace":"public","conversation_history":[]}' >/dev/null || true
done

echo "Demo data seeded."
