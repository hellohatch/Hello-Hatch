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

## Quick verification

After `make run`, validate:

`curl -sS http://127.0.0.1:8000/health`

Then open `http://127.0.0.1:8000/`, sign in using the `Access Control` panel, and complete/submit assessments from the browser UI.
