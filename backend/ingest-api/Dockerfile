FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-deu pandoc curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/ingest-api/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY backend /app/backend

RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

ENV PYTHONPATH=/app
WORKDIR /app/backend/ingest-api

EXPOSE 8002
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD curl -fsS http://127.0.0.1:8002/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
