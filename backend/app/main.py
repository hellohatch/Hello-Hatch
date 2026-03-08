from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from enum import Enum
import base64
from html import escape
import hashlib
import hmac
import json
import math
import os
import sqlite3
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator

app = FastAPI(title="Leadership Risk Intelligence Platform API")

_signals: list["Signal"] = []
_next_signal_id = 1
_default_db_path = Path(__file__).resolve().parents[2] / "database" / "assessments.db"
_frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
_frontend_index_path = _frontend_dir / "index.html"
_auth_secret = os.getenv("LSI_JWT_SECRET", "dev-secret-change")
_auth_password = os.getenv("LSI_API_PASSWORD", "change-me")
_token_ttl_minutes = int(os.getenv("LSI_TOKEN_TTL_MINUTES", "480"))
_auth_bearer = HTTPBearer(auto_error=False)

LIKERT_SCALE: dict[int, str] = {
    1: "Rarely true for me",
    2: "Occasionally true for me",
    3: "Sometimes true for me",
    4: "Often true for me",
    5: "Consistently true for me",
}

LSI_DOMAIN_QUESTION_MAP: dict[str, list[int]] = {
    "Stress Regulation": [1, 2, 3, 4],
    "Cognitive Breadth": [5, 6, 7, 8],
    "Trust Climate": [9, 10, 11, 12],
    "Ethical Integrity": [13, 14, 15, 16],
    "Leadership Durability": [17, 18, 19, 20],
    "Adaptive Capacity": [21, 22, 23, 24],
}

LEADERSHIP_LOAD_QUESTION_MAP: dict[str, list[int]] = {
    "Decision Volume": [25, 26],
    "Interpretive Demand": [27, 28],
    "Strategic Complexity": [29, 30],
    "Leadership Span Pressure": [31, 32],
    "Cognitive Carryover": [33, 34],
}

LSI_STABILITY_WEIGHTS: dict[str, float] = {
    "Stress Regulation": 0.15,
    "Cognitive Breadth": 0.15,
    "Trust Climate": 0.15,
    "Ethical Integrity": 0.15,
    "Leadership Durability": 0.25,
    "Adaptive Capacity": 0.15,
}

CEI_STAGE_MODIFIERS: dict[str, int] = {
    "Healthy Distribution": 0,
    "Exposure": 10,
    "Concentration": 20,
    "Structural Risk": 30,
}

DOMAIN_DEFINITIONS: dict[str, str] = {
    "Stress Regulation": "Stress Regulation measures whether your leadership remains calm and deliberate when priorities and pressures compete.",
    "Cognitive Breadth": "Cognitive Breadth measures how consistently you explore multiple options and perspectives before decisions converge.",
    "Trust Climate": "Trust Climate measures whether your leadership environment supports candid challenge, dissent, and constructive dialogue.",
    "Ethical Integrity": "Ethical Integrity measures the consistency with which your decisions remain anchored in principles under pressure.",
    "Leadership Durability": "Leadership Durability measures whether your leadership pace remains sustainable across repeated cycles of demand.",
    "Adaptive Capacity": "Adaptive Capacity measures how effectively you adjust direction and help others interpret change without confusion.",
}

SECTION_1_QUESTIONS: list[tuple[int, str, str]] = [
    (
        1,
        "Stress Regulation",
        "When multiple priorities compete for attention, I remain calm and deliberate in how I approach decisions.",
    ),
    (
        2,
        "Stress Regulation",
        "Even during demanding periods, I am able to think clearly before responding to complex issues.",
    ),
    (
        3,
        "Stress Regulation",
        "When pressure increases, I avoid reacting impulsively and instead pause to consider the broader implications.",
    ),
    (
        4,
        "Stress Regulation",
        "People around me experience my leadership as steady even when situations become complicated.",
    ),
    (
        5,
        "Cognitive Breadth",
        "Before committing to a decision, I intentionally explore several possible approaches.",
    ),
    (
        6,
        "Cognitive Breadth",
        "I actively seek perspectives that challenge my initial assumptions.",
    ),
    (
        7,
        "Cognitive Breadth",
        "In strategic conversations, I encourage discussion of alternative solutions before selecting a path forward.",
    ),
    (
        8,
        "Cognitive Breadth",
        "When evaluating options, I consider both short term outcomes and long term consequences.",
    ),
    (
        9,
        "Trust Climate",
        "Members of my team feel comfortable raising concerns or offering differing perspectives.",
    ),
    (
        10,
        "Trust Climate",
        "During discussions, I encourage people to speak candidly even when their views differ from mine.",
    ),
    (
        11,
        "Trust Climate",
        "I make an effort to ensure that quieter voices are included in important conversations.",
    ),
    (
        12,
        "Trust Climate",
        "When someone challenges an idea, I focus on understanding their reasoning rather than defending my position.",
    ),
    (
        13,
        "Ethical Integrity",
        "I maintain consistent standards for how decisions should be made, even under pressure.",
    ),
    (
        14,
        "Ethical Integrity",
        "When facing difficult tradeoffs, I prioritize what is right for the organization rather than what is easiest in the moment.",
    ),
    (
        15,
        "Ethical Integrity",
        "People around me understand the principles that guide my decisions.",
    ),
    (
        16,
        "Ethical Integrity",
        "I am willing to delay action if a decision does not align with my standards.",
    ),
    (
        17,
        "Leadership Durability",
        "My leadership pace feels sustainable across repeated cycles of demand.",
    ),
    (
        18,
        "Leadership Durability",
        "Even during busy periods, I maintain enough mental space to think strategically.",
    ),
    (
        19,
        "Leadership Durability",
        "I am able to recover mentally between demanding conversations or major decisions.",
    ),
    (
        20,
        "Leadership Durability",
        "The volume of decisions requiring my input does not consistently feel overwhelming.",
    ),
    (
        21,
        "Adaptive Capacity",
        "When circumstances change, I am able to adjust direction without creating confusion for the team.",
    ),
    (
        22,
        "Adaptive Capacity",
        "I remain open to new information that may alter the course of a decision.",
    ),
    (
        23,
        "Adaptive Capacity",
        "I help others interpret unexpected developments in a constructive way.",
    ),
    (
        24,
        "Adaptive Capacity",
        "When plans change, I focus on helping the organization move forward rather than defending previous decisions.",
    ),
]

SECTION_2_QUESTIONS: list[tuple[int, str, str]] = [
    (
        25,
        "Decision Volume",
        "A significant number of high impact decisions require my involvement each week.",
    ),
    (
        26,
        "Decision Volume",
        "Teams frequently seek my perspective before moving forward with important issues.",
    ),
    (
        27,
        "Interpretive Demand",
        "Colleagues often ask for my input when they are unsure how to approach a complex situation.",
    ),
    (
        28,
        "Interpretive Demand",
        "I am frequently asked to help resolve ambiguity between teams or priorities.",
    ),
    (
        29,
        "Strategic Complexity",
        "I am currently managing several initiatives that influence multiple parts of the organization.",
    ),
    (
        30,
        "Strategic Complexity",
        "Many of the decisions I participate in have consequences across multiple teams or functions.",
    ),
    (
        31,
        "Leadership Span Pressure",
        "Several leaders depend on my guidance to move forward with their own decisions.",
    ),
    (
        32,
        "Leadership Span Pressure",
        "I am often involved in conversations that affect teams beyond my direct reporting structure.",
    ),
    (
        33,
        "Cognitive Carryover",
        "I often continue thinking about work related decisions outside normal working hours.",
    ),
    (
        34,
        "Cognitive Carryover",
        "Major decisions frequently remain on my mind after the workday ends.",
    ),
]


class SignalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    source: str | None = Field(default=None, max_length=200)
    summary: str | None = Field(default=None, max_length=1000)


class Signal(BaseModel):
    id: int
    title: str
    source: str | None = None
    summary: str | None = None


class LeadershipComplexityOutlook(str, Enum):
    decrease = "decrease"
    stay_about_the_same = "stay_about_the_same"
    increase = "increase"


class AuthTokenRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=200)
    organization_id: str = Field(min_length=1, max_length=120)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: str
    username: str
    organization_id: str


class AuthPrincipal(BaseModel):
    username: str
    organization_id: str


class AssessmentQuestion(BaseModel):
    number: int
    domain: str
    text: str
    options: list[str] | None = None


class AssessmentTemplate(BaseModel):
    scale: dict[int, str]
    section_1: list[AssessmentQuestion]
    section_2: list[AssessmentQuestion]
    context_question_35: AssessmentQuestion
    lsi_domain_map: dict[str, list[int]]
    leadership_load_map: dict[str, list[int]]


class AssessmentSubmission(BaseModel):
    responses: dict[int, int]
    leadership_complexity_outlook_90_days: LeadershipComplexityOutlook | None = None

    @model_validator(mode="after")
    def validate_responses(self) -> "AssessmentSubmission":
        expected = set(range(1, 35))
        received = set(self.responses.keys())
        missing = sorted(expected - received)
        extra = sorted(received - expected)

        if missing or extra:
            details: list[str] = []
            if missing:
                details.append(f"missing questions: {missing}")
            if extra:
                details.append(f"unexpected questions: {extra}")
            raise ValueError(", ".join(details))

        invalid_scores = sorted(
            q_num for q_num, score in self.responses.items() if score not in LIKERT_SCALE
        )
        if invalid_scores:
            raise ValueError(
                f"invalid score for questions {invalid_scores}; allowed scale is 1-5"
            )

        return self


class AssessmentScoreResponse(BaseModel):
    lsi_domains: dict[str, float]
    leadership_load_index_dimensions: dict[str, float]
    lsi_overall: float
    leadership_load_index_overall: float
    leadership_stability_score: float
    leadership_stability_risk: float
    leadership_load_score: float
    concentration_exposure_stage: str
    leadership_risk_score: float
    leadership_cost_cascade_stage: str
    leadership_complexity_outlook_90_days: LeadershipComplexityOutlook | None = None


class AssessmentSubmitRequest(AssessmentSubmission):
    participant_id: str | None = Field(default=None, max_length=120)
    organization_id: str | None = Field(default=None, max_length=120)


class AssessmentRecord(AssessmentScoreResponse):
    id: int
    participant_id: str | None = None
    organization_id: str | None = None
    created_at: str
    responses: dict[int, int]


class AssessmentTrendResponse(BaseModel):
    assessment_id: int
    participant_id: str | None = None
    organization_id: str | None = None
    created_at: str
    baseline_assessment_id: int | None = None
    days_between: int | None = None
    lsi_overall_change: float | None = None
    leadership_load_index_overall_change: float | None = None
    complexity_outlook_90_days: LeadershipComplexityOutlook | None = None
    prediction_signal: str
    interpretation: str


class DashboardSummaryResponse(BaseModel):
    organization_id: str | None = None
    participant_id: str | None = None
    days: int
    total_assessments: int
    unique_participants: int
    avg_lsi_overall: float | None = None
    avg_leadership_load_overall: float | None = None
    avg_leadership_risk_score: float | None = None
    signal_counts: dict[str, int]
    cei_stage_counts: dict[str, int]
    complexity_outlook_distribution: dict[str, int]


class DashboardTimeseriesPoint(BaseModel):
    assessment_id: int
    created_at: str
    participant_id: str | None = None
    organization_id: str | None = None
    lsi_overall: float
    leadership_load_index_overall: float
    leadership_risk_score: float
    concentration_exposure_stage: str
    prediction_signal: str


class DashboardTimeseriesResponse(BaseModel):
    organization_id: str | None = None
    participant_id: str | None = None
    days: int
    points: list[DashboardTimeseriesPoint]


class DashboardSignalEntry(BaseModel):
    participant_id: str
    organization_id: str | None = None
    assessment_id: int
    created_at: str
    prediction_signal: str
    interpretation: str
    lsi_overall: float
    leadership_load_index_overall: float
    leadership_risk_score: float
    concentration_exposure_stage: str
    lsi_overall_change: float | None = None
    leadership_load_index_overall_change: float | None = None


class DashboardSignalsResponse(BaseModel):
    organization_id: str | None = None
    participant_id: str | None = None
    days: int
    items: list[DashboardSignalEntry]


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("utf-8"))


def _sign_token_payload(encoded_header: str, encoded_payload: str) -> str:
    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
    signature = hmac.new(
        _auth_secret.encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    return _b64url_encode(signature)


def create_access_token(
    username: str, organization_id: str, expires_at: datetime | None = None
) -> str:
    if expires_at is None:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=_token_ttl_minutes)

    payload = {
        "sub": username,
        "organization_id": organization_id,
        "exp": int(expires_at.timestamp()),
    }
    encoded_header = _b64url_encode(
        json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode("utf-8")
    )
    encoded_payload = _b64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signature = _sign_token_payload(encoded_header, encoded_payload)
    return f"{encoded_header}.{encoded_payload}.{signature}"


def _decode_access_token(token: str) -> dict[str, str | int]:
    try:
        encoded_header, encoded_payload, signature = token.split(".")
    except ValueError as exc:
        raise ValueError("invalid token format") from exc

    expected_signature = _sign_token_payload(encoded_header, encoded_payload)
    if not hmac.compare_digest(signature, expected_signature):
        raise ValueError("invalid token signature")

    try:
        payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as exc:
        raise ValueError("invalid token payload") from exc

    exp = payload.get("exp")
    if not isinstance(exp, int):
        raise ValueError("invalid token expiration")
    now_ts = int(datetime.now(timezone.utc).timestamp())
    if exp < now_ts:
        raise ValueError("token expired")

    if not isinstance(payload.get("sub"), str) or not isinstance(
        payload.get("organization_id"), str
    ):
        raise ValueError("invalid token claims")
    return payload


def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(_auth_bearer),
) -> AuthPrincipal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing bearer token",
        )

    try:
        payload = _decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    return AuthPrincipal(
        username=str(payload["sub"]),
        organization_id=str(payload["organization_id"]),
    )


def _enforce_org_scope(principal: AuthPrincipal, organization_id: str) -> None:
    if organization_id != principal.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="organization scope violation",
        )


def _average(responses: dict[int, int], question_numbers: Sequence[int]) -> float:
    return round(sum(responses[q] for q in question_numbers) / len(question_numbers), 2)


def _classify_cei_stage(
    leadership_load_score: float, leadership_durability_score: float, cognitive_breadth_score: float
) -> str:
    if leadership_load_score >= 4.2 and (
        leadership_durability_score <= 2.8 or cognitive_breadth_score <= 2.8
    ):
        return "Structural Risk"
    if leadership_load_score >= 3.6 and (
        leadership_durability_score <= 3.2 or cognitive_breadth_score <= 3.2
    ):
        return "Concentration"
    if leadership_load_score >= 3.0 and (
        leadership_durability_score <= 3.6 or cognitive_breadth_score <= 3.6
    ):
        return "Exposure"
    return "Healthy Distribution"


def _derive_risk_metrics_from_domain_scores(
    lsi_domains: dict[str, float],
    load_dimensions: dict[str, float],
) -> dict[str, float | str]:
    leadership_stability_score = round(
        sum(lsi_domains[domain] * weight for domain, weight in LSI_STABILITY_WEIGHTS.items()),
        2,
    )
    leadership_stability_risk = round(5 - leadership_stability_score, 2)
    leadership_load_score = round(
        sum(load_dimensions.values()) / len(load_dimensions),
        2,
    )
    cei_stage = _classify_cei_stage(
        leadership_load_score=leadership_load_score,
        leadership_durability_score=lsi_domains["Leadership Durability"],
        cognitive_breadth_score=lsi_domains["Cognitive Breadth"],
    )
    stability_component = (leadership_stability_risk / 4) * 40
    load_component = ((leadership_load_score - 1) / 4) * 40
    raw_risk_score = stability_component + load_component + CEI_STAGE_MODIFIERS[cei_stage]
    leadership_risk_score = round(max(0.0, min(100.0, raw_risk_score)), 2)

    return {
        "leadership_stability_score": leadership_stability_score,
        "leadership_stability_risk": leadership_stability_risk,
        "leadership_load_score": leadership_load_score,
        "concentration_exposure_stage": cei_stage,
        "leadership_risk_score": leadership_risk_score,
        "leadership_cost_cascade_stage": cei_stage,
    }


def _compute_assessment_scores(payload: AssessmentSubmission) -> AssessmentScoreResponse:
    lsi_domains = {
        domain: _average(payload.responses, questions)
        for domain, questions in LSI_DOMAIN_QUESTION_MAP.items()
    }
    load_dimensions = {
        dimension: _average(payload.responses, questions)
        for dimension, questions in LEADERSHIP_LOAD_QUESTION_MAP.items()
    }
    risk_metrics = _derive_risk_metrics_from_domain_scores(lsi_domains, load_dimensions)

    return AssessmentScoreResponse(
        lsi_domains=lsi_domains,
        leadership_load_index_dimensions=load_dimensions,
        lsi_overall=round(sum(lsi_domains.values()) / len(lsi_domains), 2),
        leadership_load_index_overall=round(
            sum(load_dimensions.values()) / len(load_dimensions), 2
        ),
        leadership_stability_score=float(risk_metrics["leadership_stability_score"]),
        leadership_stability_risk=float(risk_metrics["leadership_stability_risk"]),
        leadership_load_score=float(risk_metrics["leadership_load_score"]),
        concentration_exposure_stage=str(risk_metrics["concentration_exposure_stage"]),
        leadership_risk_score=float(risk_metrics["leadership_risk_score"]),
        leadership_cost_cascade_stage=str(risk_metrics["leadership_cost_cascade_stage"]),
        leadership_complexity_outlook_90_days=payload.leadership_complexity_outlook_90_days,
    )


def _current_db_path() -> str:
    return app.state.db_path


def _get_db_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(_current_db_path())
    connection.row_factory = sqlite3.Row
    return connection


def configure_database(db_path: str) -> None:
    db_file = Path(db_path)
    db_file.parent.mkdir(parents=True, exist_ok=True)
    app.state.db_path = str(db_file)
    with _get_db_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                participant_id TEXT,
                organization_id TEXT,
                responses_json TEXT NOT NULL,
                leadership_complexity_outlook_90_days TEXT,
                lsi_domains_json TEXT NOT NULL,
                leadership_load_index_dimensions_json TEXT NOT NULL,
                lsi_overall REAL NOT NULL,
                leadership_load_index_overall REAL NOT NULL,
                leadership_stability_score REAL,
                leadership_stability_risk REAL,
                leadership_load_score REAL,
                concentration_exposure_stage TEXT,
                leadership_risk_score REAL,
                leadership_cost_cascade_stage TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        existing_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(assessments)").fetchall()
        }
        required_columns: dict[str, str] = {
            "leadership_stability_score": "REAL",
            "leadership_stability_risk": "REAL",
            "leadership_load_score": "REAL",
            "concentration_exposure_stage": "TEXT",
            "leadership_risk_score": "REAL",
            "leadership_cost_cascade_stage": "TEXT",
        }
        for column, column_type in required_columns.items():
            if column not in existing_columns:
                connection.execute(
                    f"ALTER TABLE assessments ADD COLUMN {column} {column_type}"
                )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_assessments_participant_id
            ON assessments (participant_id, id)
            """
        )


def _row_to_assessment_record(row: sqlite3.Row) -> AssessmentRecord:
    responses = {int(k): v for k, v in json.loads(row["responses_json"]).items()}
    lsi_domains = {k: float(v) for k, v in json.loads(row["lsi_domains_json"]).items()}
    load_dimensions = {
        k: float(v)
        for k, v in json.loads(row["leadership_load_index_dimensions_json"]).items()
    }
    risk_metrics = _derive_risk_metrics_from_domain_scores(lsi_domains, load_dimensions)
    outlook_value = row["leadership_complexity_outlook_90_days"]
    outlook = (
        LeadershipComplexityOutlook(outlook_value) if outlook_value is not None else None
    )
    leadership_stability_score = row["leadership_stability_score"]
    leadership_stability_risk = row["leadership_stability_risk"]
    leadership_load_score = row["leadership_load_score"]
    concentration_exposure_stage = row["concentration_exposure_stage"]
    leadership_risk_score = row["leadership_risk_score"]
    leadership_cost_cascade_stage = row["leadership_cost_cascade_stage"]
    return AssessmentRecord(
        id=int(row["id"]),
        participant_id=row["participant_id"],
        organization_id=row["organization_id"],
        created_at=row["created_at"],
        responses=responses,
        lsi_domains=lsi_domains,
        leadership_load_index_dimensions=load_dimensions,
        lsi_overall=float(row["lsi_overall"]),
        leadership_load_index_overall=float(row["leadership_load_index_overall"]),
        leadership_stability_score=(
            float(leadership_stability_score)
            if leadership_stability_score is not None
            else float(risk_metrics["leadership_stability_score"])
        ),
        leadership_stability_risk=(
            float(leadership_stability_risk)
            if leadership_stability_risk is not None
            else float(risk_metrics["leadership_stability_risk"])
        ),
        leadership_load_score=(
            float(leadership_load_score)
            if leadership_load_score is not None
            else float(risk_metrics["leadership_load_score"])
        ),
        concentration_exposure_stage=(
            str(concentration_exposure_stage)
            if concentration_exposure_stage is not None
            else str(risk_metrics["concentration_exposure_stage"])
        ),
        leadership_risk_score=(
            float(leadership_risk_score)
            if leadership_risk_score is not None
            else float(risk_metrics["leadership_risk_score"])
        ),
        leadership_cost_cascade_stage=(
            str(leadership_cost_cascade_stage)
            if leadership_cost_cascade_stage is not None
            else str(risk_metrics["leadership_cost_cascade_stage"])
        ),
        leadership_complexity_outlook_90_days=outlook,
    )


def _fetch_assessment_record(assessment_id: int) -> AssessmentRecord | None:
    with _get_db_connection() as connection:
        row = connection.execute(
            """
            SELECT
                id,
                participant_id,
                organization_id,
                responses_json,
                leadership_complexity_outlook_90_days,
                lsi_domains_json,
                leadership_load_index_dimensions_json,
                lsi_overall,
                leadership_load_index_overall,
                leadership_stability_score,
                leadership_stability_risk,
                leadership_load_score,
                concentration_exposure_stage,
                leadership_risk_score,
                leadership_cost_cascade_stage,
                created_at
            FROM assessments
            WHERE id = ?
            """,
            (assessment_id,),
        ).fetchone()
    if row is None:
        return None
    return _row_to_assessment_record(row)


def _fetch_previous_assessment_record(
    participant_id: str, organization_id: str, assessment_id: int
) -> AssessmentRecord | None:
    with _get_db_connection() as connection:
        row = connection.execute(
            """
            SELECT
                id,
                participant_id,
                organization_id,
                responses_json,
                leadership_complexity_outlook_90_days,
                lsi_domains_json,
                leadership_load_index_dimensions_json,
                lsi_overall,
                leadership_load_index_overall,
                leadership_stability_score,
                leadership_stability_risk,
                leadership_load_score,
                concentration_exposure_stage,
                leadership_risk_score,
                leadership_cost_cascade_stage,
                created_at
            FROM assessments
            WHERE participant_id = ? AND organization_id = ? AND id < ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (participant_id, organization_id, assessment_id),
        ).fetchone()
    if row is None:
        return None
    return _row_to_assessment_record(row)


def _store_assessment(
    payload: AssessmentSubmitRequest, score: AssessmentScoreResponse
) -> AssessmentRecord:
    created_at = datetime.now(timezone.utc).isoformat()
    with _get_db_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO assessments (
                participant_id,
                organization_id,
                responses_json,
                leadership_complexity_outlook_90_days,
                lsi_domains_json,
                leadership_load_index_dimensions_json,
                lsi_overall,
                leadership_load_index_overall,
                leadership_stability_score,
                leadership_stability_risk,
                leadership_load_score,
                concentration_exposure_stage,
                leadership_risk_score,
                leadership_cost_cascade_stage,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.participant_id,
                payload.organization_id,
                json.dumps(payload.responses),
                (
                    payload.leadership_complexity_outlook_90_days.value
                    if payload.leadership_complexity_outlook_90_days is not None
                    else None
                ),
                json.dumps(score.lsi_domains),
                json.dumps(score.leadership_load_index_dimensions),
                score.lsi_overall,
                score.leadership_load_index_overall,
                score.leadership_stability_score,
                score.leadership_stability_risk,
                score.leadership_load_score,
                score.concentration_exposure_stage,
                score.leadership_risk_score,
                score.leadership_cost_cascade_stage,
                created_at,
            ),
        )
        new_id = cursor.lastrowid
    record = _fetch_assessment_record(int(new_id))
    if record is None:
        raise RuntimeError("assessment insert succeeded but record could not be loaded")
    return record


def _fetch_filtered_assessment_records(
    organization_id: str | None,
    participant_id: str | None,
    days: int,
) -> list[AssessmentRecord]:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    where_clauses = ["created_at >= ?"]
    params: list[str | int] = [cutoff]

    if organization_id is not None:
        where_clauses.append("organization_id = ?")
        params.append(organization_id)
    if participant_id is not None:
        where_clauses.append("participant_id = ?")
        params.append(participant_id)

    query = f"""
        SELECT
            id,
            participant_id,
            organization_id,
            responses_json,
            leadership_complexity_outlook_90_days,
            lsi_domains_json,
            leadership_load_index_dimensions_json,
            lsi_overall,
            leadership_load_index_overall,
                leadership_stability_score,
                leadership_stability_risk,
                leadership_load_score,
                concentration_exposure_stage,
                leadership_risk_score,
                leadership_cost_cascade_stage,
            created_at
        FROM assessments
        WHERE {" AND ".join(where_clauses)}
        ORDER BY id ASC
    """

    with _get_db_connection() as connection:
        rows = connection.execute(query, tuple(params)).fetchall()
    return [_row_to_assessment_record(row) for row in rows]


def _derive_trend_signal(
    current: AssessmentRecord, baseline: AssessmentRecord | None
) -> AssessmentTrendResponse:
    if current.participant_id is None:
        return AssessmentTrendResponse(
            assessment_id=current.id,
            participant_id=current.participant_id,
            organization_id=current.organization_id,
            created_at=current.created_at,
            complexity_outlook_90_days=current.leadership_complexity_outlook_90_days,
            prediction_signal="insufficient_history",
            interpretation="Trend modeling requires participant_id on submissions.",
        )

    if baseline is None:
        return AssessmentTrendResponse(
            assessment_id=current.id,
            participant_id=current.participant_id,
            organization_id=current.organization_id,
            created_at=current.created_at,
            complexity_outlook_90_days=current.leadership_complexity_outlook_90_days,
            prediction_signal="insufficient_history",
            interpretation="A prior assessment for this participant is required.",
        )

    lsi_change = round(current.lsi_overall - baseline.lsi_overall, 2)
    load_change = round(
        current.leadership_load_index_overall - baseline.leadership_load_index_overall, 2
    )
    current_ts = datetime.fromisoformat(current.created_at)
    baseline_ts = datetime.fromisoformat(baseline.created_at)
    days_between = max(0, (current_ts - baseline_ts).days)

    signal = "mixed_signal"
    interpretation = "LSI and Load moved in different directions; monitor trend with next pulse."
    if abs(lsi_change) <= 0.25 and abs(load_change) <= 0.25:
        signal = "stability_watch"
        interpretation = "Profile is stable; next pulse confirms if this remains steady."
    elif lsi_change >= 0.5 and load_change <= -0.5:
        signal = "improving_capacity"
        interpretation = "Capacity trend is improving (higher LSI with lower Load)."
    elif lsi_change <= -0.5 and load_change >= 0.5:
        signal = "rising_strain"
        interpretation = "Strain trend is rising (lower LSI with higher Load)."

    return AssessmentTrendResponse(
        assessment_id=current.id,
        participant_id=current.participant_id,
        organization_id=current.organization_id,
        created_at=current.created_at,
        baseline_assessment_id=baseline.id,
        days_between=days_between,
        lsi_overall_change=lsi_change,
        leadership_load_index_overall_change=load_change,
        complexity_outlook_90_days=current.leadership_complexity_outlook_90_days,
        prediction_signal=signal,
        interpretation=interpretation,
    )


def _score_band(score: float) -> tuple[str, str]:
    if score >= 4.3:
        return "Strong signal", "This signal is a reliable strength in your current decision environment."
    if score >= 3.5:
        return "Stable signal", "This signal is stable, with room to harden under sustained complexity."
    if score >= 3.0:
        return "Early compression", "This signal is showing early compression and should be reinforced before pressure compounds."
    return "Strained signal", "This signal is strained and should be addressed immediately to reduce structural exposure."


def _build_domain_narrative(domain: str, score: float) -> str:
    label, interpretation = _score_band(score)
    definition = DOMAIN_DEFINITIONS[domain]
    return (
        f"<h4>{escape(domain)} — {score:.2f} ({escape(label)})</h4>"
        f"<p><strong>What this signal measures:</strong> {escape(definition)}</p>"
        f"<p><strong>What your score suggests:</strong> {escape(interpretation)}</p>"
        f"<p><strong>What this likely looks like in your role:</strong> In your week, this typically appears in how you pace decisions, include competing perspectives, and help your teams maintain clarity while complexity rises.</p>"
        f"<p><strong>What signal compression would look like:</strong> You would likely notice shorter decision cycles, narrower option exploration, and more interpretation pressure routing back to you.</p>"
        f"<p><strong>Why this matters for the organization:</strong> This signal directly affects how confidently teams interpret uncertainty, escalate decisions, and distribute leadership accountability.</p>"
    )


def _build_radar_svg(lsi_domains: dict[str, float]) -> str:
    ordered = list(LSI_DOMAIN_QUESTION_MAP.keys())
    cx = 200
    cy = 200
    radius = 130

    points: list[tuple[float, float]] = []
    labels: list[str] = []
    for idx, domain in enumerate(ordered):
        angle = (-math.pi / 2) + (idx * (2 * math.pi / len(ordered)))
        score = lsi_domains[domain]
        scaled_r = (score / 5) * radius
        x = cx + math.cos(angle) * scaled_r
        y = cy + math.sin(angle) * scaled_r
        points.append((x, y))

        lx = cx + math.cos(angle) * (radius + 22)
        ly = cy + math.sin(angle) * (radius + 22)
        labels.append(
            f'<text x="{lx:.1f}" y="{ly:.1f}" font-size="11" text-anchor="middle">{escape(domain)}</text>'
        )

    polyline = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    rings = []
    for ring in range(1, 6):
        ring_r = (ring / 5) * radius
        rings.append(
            f'<circle cx="{cx}" cy="{cy}" r="{ring_r:.1f}" fill="none" stroke="#d6e0ea" stroke-width="1"/>'
        )
    spokes = []
    for idx in range(len(ordered)):
        angle = (-math.pi / 2) + (idx * (2 * math.pi / len(ordered)))
        sx = cx + math.cos(angle) * radius
        sy = cy + math.sin(angle) * radius
        spokes.append(
            f'<line x1="{cx}" y1="{cy}" x2="{sx:.1f}" y2="{sy:.1f}" stroke="#d6e0ea" stroke-width="1"/>'
        )

    return (
        '<svg id="leadership-signal-radar" viewBox="0 0 400 420" width="100%" height="340">'
        + "".join(rings)
        + "".join(spokes)
        + f'<polygon points="{polyline}" fill="rgba(36,99,235,0.2)" stroke="#2463eb" stroke-width="2"/>'
        + "".join(labels)
        + "</svg>"
    )


def _build_stage_blocks(active_stage: str, element_id: str, title: str) -> str:
    stages = ["Healthy Distribution", "Exposure", "Concentration", "Structural Risk"]
    block_width = 180
    svg_parts = [
        f'<svg id="{element_id}" viewBox="0 0 760 120" width="100%" height="120">',
        f'<text x="0" y="16" font-size="14" font-weight="700">{escape(title)}</text>',
    ]
    for idx, stage in enumerate(stages):
        x = idx * (block_width + 8)
        fill = "#2463eb" if stage == active_stage else "#eff4fa"
        text_color = "#ffffff" if stage == active_stage else "#2f4359"
        svg_parts.append(
            f'<rect x="{x}" y="28" width="{block_width}" height="54" rx="8" fill="{fill}" stroke="#c6d5e4"/>'
        )
        svg_parts.append(
            f'<text x="{x + block_width / 2}" y="60" font-size="12" text-anchor="middle" fill="{text_color}">{escape(stage)}</text>'
        )
    svg_parts.append("</svg>")
    return "".join(svg_parts)


def _build_executive_brief_html(
    record: AssessmentRecord, trend: AssessmentTrendResponse
) -> str:
    leader_name = record.participant_id or "Leader"
    radar_svg = _build_radar_svg(record.lsi_domains)
    cei_svg = _build_stage_blocks(
        record.concentration_exposure_stage,
        "cei-stage-graphic",
        "Concentration Exposure Index™",
    )
    cascade_svg = _build_stage_blocks(
        record.leadership_cost_cascade_stage,
        "cost-cascade-graphic",
        "Leadership Cost Cascade™ Placement",
    )

    section_1 = (
        f"Your current leadership profile indicates a CEI stage of {record.concentration_exposure_stage} and a Leadership Risk Score of {record.leadership_risk_score:.2f}. "
        f"You are operating with Leadership Stability at {record.leadership_stability_score:.2f} and Leadership Load at {record.leadership_load_score:.2f}. "
        "This combination shows where your leadership system is resilient and where structural dependency can accumulate if demand keeps concentrating."
    )
    section_2 = (
        "Your environment appears to require sustained interpretation across competing priorities. "
        f"The trend signal is currently {trend.prediction_signal}, and the most recent outlook for role complexity is "
        f"{record.leadership_complexity_outlook_90_days.value if record.leadership_complexity_outlook_90_days else 'not provided'}. "
        "In practical terms, your decision context is not just about workload volume; it is about how often your judgment becomes the routing point for organizational clarity."
    )
    section_4 = "".join(
        _build_domain_narrative(domain, score)
        for domain, score in record.lsi_domains.items()
    )
    section_5 = (
        "Before visible performance issues appear, the clearest early indicators are durability compression, faster decision convergence, and repeated escalation back to your role. "
        "Your current metrics suggest this risk can be observed and managed proactively, rather than reactively, if distribution of interpretation remains intentional."
    )
    section_6 = (
        "Over the next six to twelve months, risk trajectory depends on whether Leadership Load remains stable relative to your behavioral durability. "
        "If load rises while durability or cognitive breadth compresses, CEI stage progression can accelerate toward concentration. "
        "If load is redistributed and decision interpretation broadens, risk can stabilize even in high-complexity conditions."
    )
    section_9 = (
        "Over the next 30 days, focus on three interventions: "
        "1) map recurring interpretation bottlenecks, "
        "2) delegate decision framing responsibilities to adjacent leaders, and "
        "3) protect time blocks for strategic breadth before major decision forums."
    )
    section_10 = (
        "Your signal pattern affects the full system. "
        "When your role absorbs too much interpretive demand, team-level decision latency and escalation dependency can increase. "
        "Strengthening distributed interpretation capacity improves resilience, continuity, and succession readiness."
    )
    section_11 = (
        "Your leadership profile shows meaningful capability and a measurable structural signature. "
        "The strategic opportunity is to preserve your strengths while preventing concentration around your role from becoming a hidden organizational constraint."
    )

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Executive Insight Brief — Assessment {record.id}</title>
  <style>
    body {{ font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #1d2f44; line-height: 1.45; }}
    h1 {{ margin: 0 0 4px 0; }}
    h2 {{ margin: 22px 0 8px; border-bottom: 1px solid #dbe4ee; padding-bottom: 6px; }}
    h3 {{ margin: 16px 0 6px; }}
    h4 {{ margin: 12px 0 4px; }}
    .meta {{ color: #4a6078; font-size: 14px; }}
    .panel {{ border: 1px solid #dbe4ee; border-radius: 10px; padding: 14px; margin-bottom: 14px; background: #fbfdff; }}
  </style>
</head>
<body>
  <h1>Executive Insight Brief™</h1>
  <p class="meta">Leader: {escape(leader_name)} | Organization: {escape(record.organization_id or "not provided")} | Assessment ID: {record.id} | Generated: {escape(datetime.now(timezone.utc).isoformat())}</p>

  <h2>1 Executive Structural Overview</h2>
  <p>{escape(section_1)}</p>

  <h2>2 The Environment You Are Operating In</h2>
  <p>{escape(section_2)}</p>

  <h2>3 Leadership Signal Profile</h2>
  <div class="panel">{radar_svg}</div>

  <h2>4 Domain Interpretation and Analysis</h2>
  <div class="panel">{section_4}</div>

  <h2>5 Snapshot of Risk Before Anything Breaks</h2>
  <p>{escape(section_5)}</p>

  <h2>6 Six to Twelve Month Structural Projection</h2>
  <p>{escape(section_6)}</p>

  <h2>7 Concentration Exposure Index</h2>
  <div class="panel">{cei_svg}</div>
  <p>Your current CEI stage is <strong>{escape(record.concentration_exposure_stage)}</strong>.</p>

  <h2>8 Leadership Cost Cascade Placement</h2>
  <div class="panel">{cascade_svg}</div>
  <p>Your current cascade placement is <strong>{escape(record.leadership_cost_cascade_stage)}</strong>.</p>

  <h2>9 Thirty Day Structural Strengthening Plan</h2>
  <p>{escape(section_9)}</p>

  <h2>10 Organizational Implications</h2>
  <p>{escape(section_10)}</p>

  <h2>11 Final Perspective</h2>
  <p>{escape(section_11)}</p>

  <h2>Appendix A Advisory Integration Pathway</h2>
  <p>Integrate this brief into weekly decision governance by reviewing load-routing patterns, CEI stage movement, and reinforcement actions with direct reports and peer leaders.</p>

  <h2>Appendix B Leadership Signal Definitions</h2>
  <ul>
    {''.join(f"<li><strong>{escape(domain)}:</strong> {escape(text)}</li>" for domain, text in DOMAIN_DEFINITIONS.items())}
  </ul>
</body>
</html>"""


configure_database(str(_default_db_path))
if _frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(_frontend_dir)), name="static")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/token", response_model=AuthTokenResponse)
async def create_auth_token(payload: AuthTokenRequest) -> AuthTokenResponse:
    if payload.password != _auth_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid credentials",
        )

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=_token_ttl_minutes)
    access_token = create_access_token(
        payload.username, payload.organization_id, expires_at=expires_at
    )
    return AuthTokenResponse(
        access_token=access_token,
        expires_at=expires_at.isoformat(),
        username=payload.username,
        organization_id=payload.organization_id,
    )


@app.get("/", include_in_schema=False)
async def serve_frontend() -> FileResponse:
    if not _frontend_index_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="frontend is not available"
        )
    return FileResponse(_frontend_index_path)


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


@app.get("/assessments/template", response_model=AssessmentTemplate)
async def get_assessment_template(
    _: AuthPrincipal = Depends(get_current_principal),
) -> AssessmentTemplate:
    return AssessmentTemplate(
        scale=LIKERT_SCALE,
        section_1=[
            AssessmentQuestion(number=num, domain=domain, text=text)
            for num, domain, text in SECTION_1_QUESTIONS
        ],
        section_2=[
            AssessmentQuestion(number=num, domain=domain, text=text)
            for num, domain, text in SECTION_2_QUESTIONS
        ],
        context_question_35=AssessmentQuestion(
            number=35,
            domain="Context",
            text="Over the next 90 days, do you expect the complexity of your leadership role to:",
            options=["Decrease", "Stay about the same", "Increase"],
        ),
        lsi_domain_map=LSI_DOMAIN_QUESTION_MAP,
        leadership_load_map=LEADERSHIP_LOAD_QUESTION_MAP,
    )


@app.post("/assessments/score", response_model=AssessmentScoreResponse)
async def score_assessment(
    payload: AssessmentSubmission,
    _: AuthPrincipal = Depends(get_current_principal),
) -> AssessmentScoreResponse:
    return _compute_assessment_scores(payload)


@app.post(
    "/assessments/submit",
    response_model=AssessmentRecord,
    status_code=status.HTTP_201_CREATED,
)
async def submit_assessment(
    payload: AssessmentSubmitRequest,
    principal: AuthPrincipal = Depends(get_current_principal),
) -> AssessmentRecord:
    if payload.organization_id is not None:
        _enforce_org_scope(principal, payload.organization_id)

    scoped_payload = payload.model_copy(update={"organization_id": principal.organization_id})
    score = _compute_assessment_scores(scoped_payload)
    return _store_assessment(scoped_payload, score)


@app.get("/assessments/{assessment_id}", response_model=AssessmentRecord)
async def get_assessment(
    assessment_id: int,
    principal: AuthPrincipal = Depends(get_current_principal),
) -> AssessmentRecord:
    record = _fetch_assessment_record(assessment_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="assessment not found"
        )
    if record.organization_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="assessment missing organization scope",
        )
    _enforce_org_scope(principal, record.organization_id)
    return record


@app.get("/assessments/{assessment_id}/trend", response_model=AssessmentTrendResponse)
async def get_assessment_trend(
    assessment_id: int,
    principal: AuthPrincipal = Depends(get_current_principal),
) -> AssessmentTrendResponse:
    current = _fetch_assessment_record(assessment_id)
    if current is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="assessment not found"
        )
    if current.organization_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="assessment missing organization scope",
        )
    _enforce_org_scope(principal, current.organization_id)

    baseline = None
    if current.participant_id is not None:
        baseline = _fetch_previous_assessment_record(
            current.participant_id, current.organization_id, assessment_id
        )
    return _derive_trend_signal(current, baseline)


@app.get("/reports/{assessment_id}/executive-brief", response_class=HTMLResponse)
async def get_executive_brief(
    assessment_id: int,
    download: bool = Query(default=False),
    principal: AuthPrincipal = Depends(get_current_principal),
) -> HTMLResponse:
    record = _fetch_assessment_record(assessment_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="assessment not found",
        )
    if record.organization_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="assessment missing organization scope",
        )
    _enforce_org_scope(principal, record.organization_id)

    baseline = None
    if record.participant_id is not None:
        baseline = _fetch_previous_assessment_record(
            record.participant_id, record.organization_id, record.id
        )
    trend = _derive_trend_signal(record, baseline)
    html = _build_executive_brief_html(record, trend)
    headers = {}
    if download:
        headers["Content-Disposition"] = (
            f'attachment; filename="executive_insight_brief_{assessment_id}.html"'
        )
    return HTMLResponse(content=html, headers=headers)


@app.get("/dashboard/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    organization_id: str | None = Query(default=None, max_length=120),
    participant_id: str | None = Query(default=None, max_length=120),
    days: int = Query(default=90, ge=1, le=3650),
    principal: AuthPrincipal = Depends(get_current_principal),
) -> DashboardSummaryResponse:
    scoped_org = organization_id or principal.organization_id
    _enforce_org_scope(principal, scoped_org)
    records = _fetch_filtered_assessment_records(scoped_org, participant_id, days)

    if not records:
        return DashboardSummaryResponse(
            organization_id=scoped_org,
            participant_id=participant_id,
            days=days,
            total_assessments=0,
            unique_participants=0,
            signal_counts={},
            cei_stage_counts={},
            complexity_outlook_distribution={},
        )

    signal_counts: dict[str, int] = {}
    outlook_counts: dict[str, int] = {}
    cei_stage_counts: dict[str, int] = {}
    for record in records:
        baseline = None
        if record.participant_id is not None:
            baseline = _fetch_previous_assessment_record(
                record.participant_id, record.organization_id, record.id
            )
        signal = _derive_trend_signal(record, baseline).prediction_signal
        signal_counts[signal] = signal_counts.get(signal, 0) + 1
        cei_stage = record.concentration_exposure_stage
        cei_stage_counts[cei_stage] = cei_stage_counts.get(cei_stage, 0) + 1

        outlook = (
            record.leadership_complexity_outlook_90_days.value
            if record.leadership_complexity_outlook_90_days is not None
            else "not_provided"
        )
        outlook_counts[outlook] = outlook_counts.get(outlook, 0) + 1

    participants = {record.participant_id for record in records if record.participant_id}
    avg_lsi = round(sum(record.lsi_overall for record in records) / len(records), 2)
    avg_load = round(
        sum(record.leadership_load_index_overall for record in records) / len(records), 2
    )
    avg_risk_score = round(sum(record.leadership_risk_score for record in records) / len(records), 2)

    return DashboardSummaryResponse(
        organization_id=scoped_org,
        participant_id=participant_id,
        days=days,
        total_assessments=len(records),
        unique_participants=len(participants),
        avg_lsi_overall=avg_lsi,
        avg_leadership_load_overall=avg_load,
        avg_leadership_risk_score=avg_risk_score,
        signal_counts=signal_counts,
        cei_stage_counts=cei_stage_counts,
        complexity_outlook_distribution=outlook_counts,
    )


@app.get("/dashboard/timeseries", response_model=DashboardTimeseriesResponse)
async def get_dashboard_timeseries(
    organization_id: str | None = Query(default=None, max_length=120),
    participant_id: str | None = Query(default=None, max_length=120),
    days: int = Query(default=180, ge=1, le=3650),
    principal: AuthPrincipal = Depends(get_current_principal),
) -> DashboardTimeseriesResponse:
    scoped_org = organization_id or principal.organization_id
    _enforce_org_scope(principal, scoped_org)
    records = _fetch_filtered_assessment_records(scoped_org, participant_id, days)

    points: list[DashboardTimeseriesPoint] = []
    for record in records:
        baseline = None
        if record.participant_id is not None:
            baseline = _fetch_previous_assessment_record(
                record.participant_id, record.organization_id, record.id
            )
        trend = _derive_trend_signal(record, baseline)
        points.append(
            DashboardTimeseriesPoint(
                assessment_id=record.id,
                created_at=record.created_at,
                participant_id=record.participant_id,
                organization_id=record.organization_id,
                lsi_overall=record.lsi_overall,
                leadership_load_index_overall=record.leadership_load_index_overall,
                leadership_risk_score=record.leadership_risk_score,
                concentration_exposure_stage=record.concentration_exposure_stage,
                prediction_signal=trend.prediction_signal,
            )
        )

    return DashboardTimeseriesResponse(
        organization_id=scoped_org,
        participant_id=participant_id,
        days=days,
        points=points,
    )


@app.get("/dashboard/signals", response_model=DashboardSignalsResponse)
async def get_dashboard_signals(
    organization_id: str | None = Query(default=None, max_length=120),
    participant_id: str | None = Query(default=None, max_length=120),
    days: int = Query(default=90, ge=1, le=3650),
    principal: AuthPrincipal = Depends(get_current_principal),
) -> DashboardSignalsResponse:
    scoped_org = organization_id or principal.organization_id
    _enforce_org_scope(principal, scoped_org)
    records = _fetch_filtered_assessment_records(scoped_org, participant_id, days)

    latest_by_participant: dict[str, AssessmentRecord] = {}
    for record in records:
        if not record.participant_id:
            continue
        existing = latest_by_participant.get(record.participant_id)
        if existing is None or record.id > existing.id:
            latest_by_participant[record.participant_id] = record

    items: list[DashboardSignalEntry] = []
    for participant, latest in latest_by_participant.items():
        baseline = _fetch_previous_assessment_record(
            participant, latest.organization_id, latest.id
        )
        trend = _derive_trend_signal(latest, baseline)
        items.append(
            DashboardSignalEntry(
                participant_id=participant,
                organization_id=latest.organization_id,
                assessment_id=latest.id,
                created_at=latest.created_at,
                prediction_signal=trend.prediction_signal,
                interpretation=trend.interpretation,
                lsi_overall=latest.lsi_overall,
                leadership_load_index_overall=latest.leadership_load_index_overall,
                leadership_risk_score=latest.leadership_risk_score,
                concentration_exposure_stage=latest.concentration_exposure_stage,
                lsi_overall_change=trend.lsi_overall_change,
                leadership_load_index_overall_change=trend.leadership_load_index_overall_change,
            )
        )

    items.sort(key=lambda item: item.assessment_id, reverse=True)
    return DashboardSignalsResponse(
        organization_id=scoped_org,
        participant_id=participant_id,
        days=days,
        items=items,
    )
