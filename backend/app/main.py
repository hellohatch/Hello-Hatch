from fastapi import FastAPI

app = FastAPI(title="Leadership Signal Intelligence Platform API")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
