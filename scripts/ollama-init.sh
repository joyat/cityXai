#!/bin/sh
set -eu

retry_pull() {
  model="$1"
  attempts=0
  until [ "$attempts" -ge 5 ]
  do
    if ollama pull "$model"; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep $((attempts * 5))
  done
  echo "failed to pull $model after retries" >&2
  return 1
}

retry_pull "${OLLAMA_PRIMARY_MODEL}"
retry_pull "${OLLAMA_FALLBACK_MODEL}"
retry_pull "${EMBED_MODEL}"
