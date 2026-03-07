from collections.abc import Sequence

from fastapi import FastAPI, status
from pydantic import BaseModel, Field

app = FastAPI(title="Leadership Signal Intelligence Platform API")

_signals: list["Signal"] = []
_next_signal_id = 1


class SignalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    source: str | None = Field(default=None, max_length=200)
    summary: str | None = Field(default=None, max_length=1000)


class Signal(BaseModel):
    id: int
    title: str
    source: str | None = None
    summary: str | None = None


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/signals", response_model=Signal, status_code=status.HTTP_201_CREATED)
async def create_signal(payload: SignalCreate) -> Signal:
    global _next_signal_id

    signal = Signal(id=_next_signal_id, **payload.model_dump())
    _signals.append(signal)
    _next_signal_id += 1
    return signal


@app.get("/signals", response_model=list[Signal])
async def list_signals() -> Sequence[Signal]:
    return _signals
