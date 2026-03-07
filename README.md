# Leadership Signal Intelligence Platform

Early-stage FastAPI scaffold for leadership signal and assessment scoring APIs.

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

## API endpoints

### Health

- `GET /health`

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
    - LSI overall average
    - Leadership Load Index overall average
- `POST /assessments/submit`
  - Persists a scored assessment (`participant_id`, `organization_id`, responses, optional Q35 context).
- `GET /assessments/{id}`
  - Returns a persisted assessment record with raw responses and computed scores.
- `GET /assessments/{id}/trend`
  - Compares assessment with prior submission for that participant and returns trend signal.

### Dashboard

- `GET /dashboard/summary`
  - Aggregated KPI metrics (volume, averages, signal counts, Q35 outlook distribution).
- `GET /dashboard/timeseries`
  - Ordered LSI/load points for charting over a selected date window.
- `GET /dashboard/signals`
  - Latest signal row per participant, including current metrics and deltas.
  - Supported query params on all dashboard endpoints:
    - `organization_id` (optional)
    - `participant_id` (optional)
    - `days` (optional, defaults vary by endpoint)

## Quick verification

After `make run`, validate:

`curl -sS http://127.0.0.1:8000/health`

Then open `http://127.0.0.1:8000/` to complete and submit the full assessment from the browser UI.
