from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()


class AssessmentStartRequest(BaseModel):
    participant_id: str | None = Field(default=None, max_length=120)
    organization_id: str | None = Field(default=None, max_length=120)


class AssessmentStartResponse(BaseModel):
    session_id: str
    status: str
    started_at: str


class AssessmentResponsesRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=120)
    responses: dict[int, int]


class AssessmentAnalyzeRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=120)


_assessment_sessions: dict[str, dict[str, object]] = {}


@router.post("/assessment/start", response_model=AssessmentStartResponse)
def start_assessment(payload: AssessmentStartRequest) -> AssessmentStartResponse:
    session_id = uuid4().hex
    started_at = datetime.now(timezone.utc).isoformat()
    _assessment_sessions[session_id] = {
        "participant_id": payload.participant_id,
        "organization_id": payload.organization_id,
        "started_at": started_at,
        "responses": {},
    }
    return AssessmentStartResponse(
        session_id=session_id,
        status="started",
        started_at=started_at,
    )


@router.post("/assessment/responses")
def submit_assessment_responses(payload: AssessmentResponsesRequest) -> dict[str, object]:
    session = _assessment_sessions.get(payload.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="assessment session not found")

    invalid_values = [q for q, score in payload.responses.items() if score < 1 or score > 5]
    if invalid_values:
        raise HTTPException(
            status_code=400,
            detail=f"invalid scores for questions: {sorted(invalid_values)}; expected 1..5",
        )

    session["responses"] = dict(payload.responses)
    return {
        "session_id": payload.session_id,
        "stored_questions": len(payload.responses),
        "status": "responses_saved",
    }


@router.post("/assessment/analyze")
def analyze_assessment(payload: AssessmentAnalyzeRequest) -> dict[str, object]:
    session = _assessment_sessions.get(payload.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="assessment session not found")

    responses = session.get("responses", {})
    if not responses:
        raise HTTPException(status_code=400, detail="no responses submitted for this session")

    scores = [int(value) for value in responses.values()]
    average_score = round(sum(scores) / len(scores), 2)
    return {
        "session_id": payload.session_id,
        "status": "analyzed",
        "response_count": len(scores),
        "average_score": average_score,
    }
