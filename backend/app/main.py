from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes_analysis import router as analysis_router
from app.api.routes_assessment import router as assessment_router
from app.api.routes_health import router as health_router

app = FastAPI(
    title="Leadership Signal Intelligence API",
    version="0.1.0",
)

app.include_router(health_router)
app.include_router(analysis_router)
app.include_router(assessment_router)

_FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
_INDEX_FILE = _FRONTEND_DIR / "index.html"
_ASSETS_DIR = _FRONTEND_DIR / "assets"

if _ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=_ASSETS_DIR), name="assets")


@app.get("/", response_class=HTMLResponse)
def serve_homepage() -> str:
    if _INDEX_FILE.exists():
        return _INDEX_FILE.read_text(encoding="utf-8")
    return (
        "<!DOCTYPE html><html><body><h1>Hatch</h1>"
        "<p>Homepage not found. Add frontend/index.html.</p></body></html>"
    )
