# Leadership Risk Intelligence Platform

FastAPI full-stack application for leadership behavior measurement, structural exposure detection, and predictive leadership risk scoring.

Core reference docs:

- `docs/ARCHITECTURE.md`
- `docs/PLATFORM_STANDARDS.md`
- `docs/PRODUCT_STACK.md`
- `docs/MARKET_NARRATIVE.md`

## Prerequisites

- Python 3.12+
- `pip`
- `make`

## Build and test

Run the full build pipeline:

`make build`

This runs:
1. dependency install (`pip install -r requirements.txt`)
2. automated tests (`pytest`)
3. Python bytecode compile checks (`compileall`)

## Run locally

Start the API:

`make run`

API base URL:

`http://127.0.0.1:8000`

Frontend URL:

`http://127.0.0.1:8000/`

Dashboard:

Use the `Dashboard` tab in the UI at `http://127.0.0.1:8000/`.

## Go live (one command with HTTPS)

This repository includes a production `docker-compose` stack with:

- FastAPI app container
- Caddy reverse proxy with automatic TLS certificates
- Persistent volumes for SQLite data and Caddy state

Prerequisites:

- Docker + Docker Compose plugin installed on your server
- DNS `A` record pointing your domain to that server

Setup once:

1. `cp .env.production.example .env.production`
2. Edit `.env.production` and set:
   - `LSI_API_PASSWORD`
   - `LSI_JWT_SECRET`
   - `LRI_DOMAIN`
   - `LETSENCRYPT_EMAIL`

Deploy (single command):

`make deploy-prod`

Useful operations:

- Tail logs: `make deploy-prod-logs`
- Stop stack: `make deploy-prod-down`

### Optional: auto-deploy on every push (GitHub Actions)

Workflow file:

- `.github/workflows/deploy-prod.yml`

Trigger:

- Push to branch `cursor/project-next-steps-ed26`
- Manual `workflow_dispatch`

Repository secrets required:

- `DEPLOY_HOST` (server hostname/IP)
- `DEPLOY_USER` (SSH user)
- `DEPLOY_SSH_KEY` (private key for `DEPLOY_USER`)
- `DEPLOY_PATH` (absolute path to this repo on server)
- `DEPLOY_ENV_FILE` (full multiline `.env.production` contents)
- Optional: `DEPLOY_PORT` (defaults to `22`)
- Optional: `DEPLOY_KNOWN_HOSTS` (recommended fixed host key entry)

Server prerequisites for auto-deploy:

1. Repo already cloned at `DEPLOY_PATH` with `origin` set to GitHub.
2. Docker + Docker Compose plugin installed.
3. `make` installed.
4. `DEPLOY_USER` has permissions to run Docker commands.

Smoke test:

`curl -sS https://<your-domain>/health`

Open:

- `https://<your-domain>/` (frontend + sign in)
- `https://<your-domain>/docs` (interactive API docs)

Production checklist:

1. Keep `.env.production` private and rotate secrets on schedule.
2. Restrict inbound ports to `80/443`; do not expose app port `8000`.
3. Back up the Docker volume `lri_data` routinely.
4. Monitor certificate renewal and container health logs.

## Authentication and organization scope

Assessment and dashboard APIs are protected with bearer tokens and scoped by organization.

- Token endpoint: `POST /auth/token`
- Default password: `change-me` (override with `LSI_API_PASSWORD`)
- Token signing secret: `LSI_JWT_SECRET` (set this in non-dev environments)
- Token TTL minutes: `LSI_TOKEN_TTL_MINUTES` (default `480`)

In the browser UI, use the `Access Control` panel to sign in before loading templates or dashboard data.

## API endpoints

### Health

- `GET /health`

### Auth

- `POST /auth/token`
  - Request: `username`, `password`, `organization_id`
  - Response: bearer token + expiration metadata

### Signals

- `POST /signals`
- `GET /signals`

### Assessment

- `GET /assessments/template`
  - Returns question bank, domains, scoring maps, and Likert scale.
- `POST /assessments/score`
  - Expects responses for questions `1..34` on a strict `1..5` scale.
  - Optional context field: `leadership_complexity_outlook_90_days` with:
    - `decrease`
    - `stay_about_the_same`
    - `increase`
  - Returns:
    - LSI domain scores
    - Leadership Load Index dimension scores
    - Leadership Stability score and stability risk
    - Concentration Exposure Index (CEI) stage
    - Leadership Risk Score (`0..100`)
    - Leadership Cost Cascade stage
- `POST /assessments/submit`
  - Persists a scored assessment (`participant_id`, `organization_id`, responses, optional Q35 context).
- `GET /assessments/{id}`
  - Returns a persisted assessment record with raw responses and computed scores.
- `GET /assessments/{id}/trend`
  - Compares assessment with prior submission for that participant and returns trend signal.
  - Access requires a token from the same `organization_id` as the record.

### Dashboard

- `GET /dashboard/summary`
  - Aggregated KPI metrics (volume, averages, signal counts, CEI distribution, Q35 outlook distribution).
- `GET /dashboard/timeseries`
  - Ordered LSI/load/risk points for charting over a selected date window.
- `GET /dashboard/signals`
  - Latest signal row per participant, including current metrics and deltas.
  - Supported query params on all dashboard endpoints:
    - `organization_id` (optional)
    - `participant_id` (optional)
    - `days` (optional, defaults vary by endpoint)
  - Calls are constrained to the token’s organization scope.

### Reports

- `GET /reports/{assessment_id}/executive-brief`
  - Generates the Executive Insight Brief™ HTML report with embedded standardized visuals.
  - Optional query param: `download=true` to return as attachment.

## Quick verification

After `make run`, validate:

`curl -sS http://127.0.0.1:8000/health`

Then open `http://127.0.0.1:8000/`, sign in using the `Access Control` panel, and complete/submit assessments from the browser UI.
