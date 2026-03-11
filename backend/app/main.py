from fastapi import FastAPI

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
