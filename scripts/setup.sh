#!/usr/bin/env bash
# setup.sh — First-time setup for cityXai demo
# Generates a .env with secure random secrets if one doesn't already exist.
set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env"
EXAMPLE_FILE="$(dirname "$0")/../.env.example"

if [ -f "$ENV_FILE" ]; then
  echo "✓ .env already exists — skipping generation."
  echo "  Delete it and re-run to regenerate secrets."
  exit 0
fi

if ! command -v openssl &>/dev/null; then
  echo "✗ openssl not found. Install it and retry." >&2
  exit 1
fi

echo "Generating .env with secure random secrets…"

JWT_SECRET=$(openssl rand -hex 32)
DB_ENCRYPT_KEY=$(openssl rand -hex 32)

# Prompt for municipality details
read -rp "Municipality name (e.g. Stadt Paderborn): " MUNICIPALITY_NAME
MUNICIPALITY_NAME="${MUNICIPALITY_NAME:-Stadt Paderborn}"

read -rp "Municipality namespace / slug (e.g. paderborn): " MUNICIPALITY_NAMESPACE
MUNICIPALITY_NAMESPACE="${MUNICIPALITY_NAMESPACE:-paderborn}"

read -rp "Admin e-mail address: " ADMIN_EMAIL
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@demo.de}"

read -rsp "Admin password (leave blank to auto-generate): " ADMIN_PASSWORD
echo
if [ -z "$ADMIN_PASSWORD" ]; then
  ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -dc 'A-Za-z0-9!@#%^&*' | head -c 16)
  echo "  Generated admin password: $ADMIN_PASSWORD"
  echo "  ⚠  Save this now — it won't be shown again."
fi

cat > "$ENV_FILE" <<EOF
COMPOSE_PROJECT_NAME=cityxai

# Municipality
MUNICIPALITY_NAME=${MUNICIPALITY_NAME}
MUNICIPALITY_NAMESPACE=${MUNICIPALITY_NAMESPACE}

# Admin account
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# Security — auto-generated, do not share
JWT_SECRET=${JWT_SECRET}
DB_ENCRYPT_KEY=${DB_ENCRYPT_KEY}

# Models (ollama-lite stub — no GPU needed for demo)
OLLAMA_PRIMARY_MODEL=qwen3:8b-q4_K_M
OLLAMA_FALLBACK_MODEL=mistral:7b-q4_K_M
EMBED_MODEL=nomic-embed-text:v1.5

# RAG tuning
CHUNK_SIZE=512
CHUNK_OVERLAP=50
RETRIEVAL_K=10
RERANK_TOP_N=5
CONFIDENCE_THRESHOLD=0.5
EOF

echo ""
echo "✓ .env created at $ENV_FILE"
echo ""
echo "Next steps:"
echo "  make up     — start the stack"
echo "  make seed   — load demo documents"
echo ""
