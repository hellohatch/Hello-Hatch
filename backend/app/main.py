from fastapi import FastAPI

from backend.app.api.health import router as health_router

app = FastAPI(title="Leadership Signal Intelligence Platform API")


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "Leadership Signal Intelligence API",
        "status": "running",
    }

app.include_router(health_router)
