# cityXai

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![Stack: Local-first](https://img.shields.io/badge/Stack-Local--first-0f766e.svg)](#architecture)
[![UI: Next.js%2014](https://img.shields.io/badge/UI-Next.js%2014-111827.svg)](#services)
[![APIs: FastAPI](https://img.shields.io/badge/APIs-FastAPI-0ea5e9.svg)](#services)

cityXai is a locally hosted, GDPR-oriented municipal AI demo for German municipalities. The stack includes ingestion, hybrid RAG, role-based access control with Keycloak, a Next.js 14 admin portal, a citizen chat widget, audit logging, and observability with Prometheus and Grafana.

## Highlights

- Local-first municipal AI demo with document ingestion, hybrid retrieval, and source-grounded answers
- Role-based workflows for document admins, staff, auditors, system admins, and citizens
- Demo-ready observability with Prometheus and Grafana
- LM Studio-compatible inference bridge for laptop demos without external dependencies
- Citizen-facing chat widget and internal admin portal in one stack

## Repository Guide

- [Contributing](./.github/CONTRIBUTING.md)
- [Code of Conduct](./.github/CODE_OF_CONDUCT.md)
- [Security Policy](./.github/SECURITY.md)
- [Pull Request Template](./.github/pull_request_template.md)

## Quick start

```bash
cp .env.example .env
make up
make seed
```

Open:

- [https://localhost](https://localhost) for the admin portal
- [https://localhost/grafana](https://localhost/grafana) for Grafana
- [http://localhost/demo/](http://localhost/demo/) for the mock municipal website

Demo credentials:

- `docadmin@demo.de` / `Demo1234!`
- `staff@demo.de` / `Demo1234!`
- `auditor@demo.de` / `Demo1234!`
- `admin@demo.de` / `Demo1234!`
- `citizen@demo.de` / `Demo1234!`

## Demo walkthrough

1. Run `make up && make seed`.
2. Open `https://localhost`.
3. Log in as `docadmin@demo.de`.
4. Open `Dokumente` and show the three demo documents already ingested.
5. Upload a new document and show the live status changing to `ready`.
6. Log in as `staff@demo.de`.
7. Open `Fachchat` and ask a question about the uploaded file.
8. Point out the source footnotes and enable `Dev-Modus` to show retrieval scores and chunks.
9. Switch from `Hybrid` to `Dense-only` to demonstrate lower retrieval quality, then switch back.
10. Open `Audit` and show hashed user/query values in the stored logs.
11. Open `https://localhost/grafana` and show the prebuilt dashboard.
12. Log in as `auditor@demo.de` and show read-only audit access.
13. Open `http://localhost/demo/` and show the citizen widget embedded on a municipal homepage.
14. Copy a `.md`, `.txt`, `.csv`, or `.html` file into `./data/incoming/` and show it appear automatically after watcher ingestion.

## Hardware requirements

| Profile | CPU | RAM | Disk | Notes |
|---|---|---:|---:|---|
| Minimum demo | 6 vCPU | 16 GB | 30 GB | Small-model local demo |
| Recommended | 8 vCPU | 32 GB | 60 GB | Better Ollama responsiveness |
| GPU-accelerated | 8 vCPU + CUDA GPU | 32 GB | 60 GB | Optional faster local inference |

## Architecture

```text
                       +-----------------------+
 Browser / Widget ---> |        nginx          |
                       | TLS, routing, limits  |
                       +----+----+----+---+----+
                            |    |    |   |
                            |    |    |   +--> Grafana
                            |    |    +------> Keycloak
                            |    +-----------> Next.js Admin Portal
                            |
             +--------------+---------------+
             |                              |
      +------+-------+                +-----+------+
      |   chat-api   |                | ingest-api |
      | Hybrid RAG   |                | converters |
      | rerank + LLM |                | chunking   |
      +------+-------+                +-----+------+
             |                              |
             +---------------+--------------+
                             |
                     +-------+-------+
                     |    ChromaDB   |
                     | vectors/meta  |
                     +-------+-------+
                             |
                        +----+----+
                        | Ollama  |
                        | LLM/emb |
                        +---------+

        admin-api ---> Keycloak admin APIs, audit logs, metrics summaries
        Prometheus -> scrapes chat-api, ingest-api, admin-api, ChromaDB, Ollama, Keycloak
```

## Compliance mapping

| Feature | Compliance mapping |
|---|---|
| Local hosting and on-prem capable deployment | GDPR Art. 5, Art. 24, data sovereignty |
| Namespace isolation per municipality | GDPR Art. 32, tenant separation |
| Role-based access control via Keycloak | GDPR Art. 25, Art. 32 |
| Audit logging with hashed identifiers | AI Act Art. 12, GDPR data minimisation |
| Source-grounded answers with confidence flagging | AI Act transparency and human oversight support |
| Citizen transparency footer | AI Act transparency obligations |
| Zero external calls from widget | Data transfer control, GDPR Chapter V risk reduction |
| Local model inference with Ollama | Sovereign processing, no third-country transfer by default |

## Services

| Service | Purpose |
|---|---|
| `nginx` | TLS termination, security headers, rate limiting, reverse proxy |
| `frontend` | Next.js 14 admin portal |
| `chat-api` | Hybrid RAG, reranking, LLM answer generation, audit writes |
| `ingest-api` | File upload, format conversion, chunking, embedding, watcher |
| `admin-api` | Audit export, user management, metrics summary |
| `ollama` | Local inference and embeddings |
| `chromadb` | Vector store and metadata store |
| `keycloak` | OIDC/OAuth2 auth and RBAC |
| `prometheus` | Metrics scraping |
| `grafana` | Dashboard visualisation |

## Notes on the demo implementation

- All user-facing copy is in German.
- Python code comments were intentionally kept minimal.
- The system uses two Chroma collections by convention: `{MUNICIPALITY_NAMESPACE}_internal` and `{MUNICIPALITY_NAMESPACE}_public`.
- The seed script attempts to create demo content in PDF, DOCX, and XLSX form and pushes it through the ingest API.
- The citizen widget uses same-origin requests only and stores only a session token in `sessionStorage`.

## Troubleshooting

### `make up` fails during model startup

- The demo can use a local LM Studio-compatible server through the `ollama` bridge service.
- Check logs with `make logs`.
- If the configured model tags are unavailable on your machine, edit `.env` to match models that are actually loaded locally.

### HTTPS certificate warning in the browser

- nginx generates a self-signed certificate on first boot.
- Accept the local certificate warning for demo purposes.

### Login fails

- Confirm Keycloak imported the realm and demo users.
- Wait until the `keycloak` healthcheck is green before logging in.

### No data in Grafana

- Run `make seed` after all services are healthy.
- Verify Prometheus can scrape the APIs at `/metrics`.

### File watcher does not ingest

- Place the file into `data/incoming/`.
- Confirm `ingest-api` is healthy and has access to the mounted `/data` volume.

## Useful commands

```bash
make up
make down
make logs
make seed
make reset
make test
```
