from collections.abc import Sequence
from datetime import datetime, timezone
from enum import Enum
import json
import sqlite3
from pathlib import Path

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator

app = FastAPI(title="Leadership Signal Intelligence Platform API")

_signals: list["Signal"] = []
_next_signal_id = 1
_default_db_path = Path(__file__).resolve().parents[2] / "database" / "assessments.db"
_frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
_frontend_index_path = _frontend_dir / "index.html"

LIKERT_SCALE: dict[int, str] = {
    1: "Rarely true for me",
    2: "Occasionally true for me",
    3: "Sometimes true for me",
    4: "Often true for me",
    5: "Consistently true for me",
}

LSI_DOMAIN_QUESTION_MAP: dict[str, list[int]] = {
    "Operational Stability": [1, 2, 3, 4],
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

SECTION_1_QUESTIONS: list[tuple[int, str, str]] = [
    (
        1,
        "Operational Stability",
        "When multiple priorities compete for attention, I remain calm and deliberate in how I approach decisions.",
    ),
    (
        2,
        "Operational Stability",
        "Even during demanding periods, I am able to think clearly before responding to complex issues.",
    ),
    (
        3,
        "Operational Stability",
        "When pressure increases, I avoid reacting impulsively and instead pause to consider the broader implications.",
    ),
    (
        4,
        "Operational Stability",
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


def _average(responses: dict[int, int], question_numbers: Sequence[int]) -> float:
    return round(sum(responses[q] for q in question_numbers) / len(question_numbers), 2)


def _compute_assessment_scores(payload: AssessmentSubmission) -> AssessmentScoreResponse:
    lsi_domains = {
        domain: _average(payload.responses, questions)
        for domain, questions in LSI_DOMAIN_QUESTION_MAP.items()
    }
    load_dimensions = {
        dimension: _average(payload.responses, questions)
        for dimension, questions in LEADERSHIP_LOAD_QUESTION_MAP.items()
    }

    return AssessmentScoreResponse(
        lsi_domains=lsi_domains,
        leadership_load_index_dimensions=load_dimensions,
        lsi_overall=round(sum(lsi_domains.values()) / len(lsi_domains), 2),
        leadership_load_index_overall=round(
            sum(load_dimensions.values()) / len(load_dimensions), 2
        ),
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
                created_at TEXT NOT NULL
            )
            """
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
    outlook_value = row["leadership_complexity_outlook_90_days"]
    outlook = (
        LeadershipComplexityOutlook(outlook_value) if outlook_value is not None else None
    )
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
    participant_id: str, assessment_id: int
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
                created_at
            FROM assessments
            WHERE participant_id = ? AND id < ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (participant_id, assessment_id),
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
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                created_at,
            ),
        )
        new_id = cursor.lastrowid
    record = _fetch_assessment_record(int(new_id))
    if record is None:
        raise RuntimeError("assessment insert succeeded but record could not be loaded")
    return record


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


configure_database(str(_default_db_path))
if _frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(_frontend_dir)), name="static")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


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
async def get_assessment_template() -> AssessmentTemplate:
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
async def score_assessment(payload: AssessmentSubmission) -> AssessmentScoreResponse:
    return _compute_assessment_scores(payload)


@app.post(
    "/assessments/submit",
    response_model=AssessmentRecord,
    status_code=status.HTTP_201_CREATED,
)
async def submit_assessment(payload: AssessmentSubmitRequest) -> AssessmentRecord:
    score = _compute_assessment_scores(payload)
    return _store_assessment(payload, score)


@app.get("/assessments/{assessment_id}", response_model=AssessmentRecord)
async def get_assessment(assessment_id: int) -> AssessmentRecord:
    record = _fetch_assessment_record(assessment_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="assessment not found"
        )
    return record


@app.get("/assessments/{assessment_id}/trend", response_model=AssessmentTrendResponse)
async def get_assessment_trend(assessment_id: int) -> AssessmentTrendResponse:
    current = _fetch_assessment_record(assessment_id)
    if current is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="assessment not found"
        )

    baseline = None
    if current.participant_id is not None:
        baseline = _fetch_previous_assessment_record(current.participant_id, assessment_id)
    return _derive_trend_signal(current, baseline)
