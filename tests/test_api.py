import pytest
import httpx
from pathlib import Path

from backend.app import main


@pytest.fixture(autouse=True)
def reset_state(tmp_path: Path) -> None:
    main._signals.clear()
    main._next_signal_id = 1
    main.configure_database(str(tmp_path / "assessments_test.db"))


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_health_endpoint_returns_ok() -> None:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
    ) as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.anyio
async def test_frontend_root_serves_html() -> None:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
    ) as client:
        response = await client.get("/")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Leadership Signal Intelligence Platform" in response.text


@pytest.mark.anyio
async def test_frontend_static_asset_is_available() -> None:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
    ) as client:
        response = await client.get("/static/app.js")

    assert response.status_code == 200
    assert "javascript" in response.headers["content-type"]


@pytest.mark.anyio
async def test_create_signal_returns_created_signal() -> None:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/signals",
            json={
                "title": "Quarterly leadership memo",
                "source": "internal-news",
                "summary": "Exec team shared direction for Q2.",
            },
        )

    assert response.status_code == 201
    assert response.json() == {
        "id": 1,
        "title": "Quarterly leadership memo",
        "source": "internal-news",
        "summary": "Exec team shared direction for Q2.",
    }


@pytest.mark.anyio
async def test_list_signals_returns_created_items() -> None:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
    ) as client:
        create_response = await client.post(
            "/signals",
            json={
                "title": "Board interview published",
                "source": "external-press",
                "summary": "CEO discussed expansion plans.",
            },
        )
        assert create_response.status_code == 201

        list_response = await client.get("/signals")

    assert create_response.status_code == 201
    assert list_response.status_code == 200
    assert list_response.json() == [
        {
            "id": 1,
            "title": "Board interview published",
            "source": "external-press",
            "summary": "CEO discussed expansion plans.",
        }
    ]


@pytest.mark.anyio
async def test_assessment_template_includes_scale_and_context_question() -> None:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
    ) as client:
        response = await client.get("/assessments/template")

    assert response.status_code == 200
    payload = response.json()
    assert payload["scale"]["1"] == "Rarely true for me"
    assert payload["scale"]["5"] == "Consistently true for me"
    assert payload["context_question_35"]["number"] == 35
    assert payload["context_question_35"]["options"] == [
        "Decrease",
        "Stay about the same",
        "Increase",
    ]


@pytest.mark.anyio
async def test_assessment_score_returns_expected_domain_and_index_values() -> None:
    responses: dict[int, int] = {}
    responses.update({q: 5 for q in range(1, 5)})
    responses.update({q: 4 for q in range(5, 9)})
    responses.update({q: 3 for q in range(9, 13)})
    responses.update({q: 2 for q in range(13, 17)})
    responses.update({q: 1 for q in range(17, 21)})
    responses.update({q: 5 for q in range(21, 25)})
    responses.update({q: 1 for q in range(25, 27)})
    responses.update({q: 2 for q in range(27, 29)})
    responses.update({q: 3 for q in range(29, 31)})
    responses.update({q: 4 for q in range(31, 33)})
    responses.update({q: 5 for q in range(33, 35)})

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/assessments/score",
            json={
                "responses": responses,
                "leadership_complexity_outlook_90_days": "increase",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["lsi_domains"] == {
        "Operational Stability": 5.0,
        "Cognitive Breadth": 4.0,
        "Trust Climate": 3.0,
        "Ethical Integrity": 2.0,
        "Leadership Durability": 1.0,
        "Adaptive Capacity": 5.0,
    }
    assert payload["leadership_load_index_dimensions"] == {
        "Decision Volume": 1.0,
        "Interpretive Demand": 2.0,
        "Strategic Complexity": 3.0,
        "Leadership Span Pressure": 4.0,
        "Cognitive Carryover": 5.0,
    }
    assert payload["lsi_overall"] == 3.33
    assert payload["leadership_load_index_overall"] == 3.0
    assert payload["leadership_complexity_outlook_90_days"] == "increase"


@pytest.mark.anyio
async def test_assessment_score_rejects_missing_questions() -> None:
    responses = {q: 3 for q in range(1, 34)}

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
    ) as client:
        response = await client.post("/assessments/score", json={"responses": responses})

    assert response.status_code == 422


@pytest.mark.anyio
async def test_assessment_score_rejects_invalid_scale_value() -> None:
    responses = {q: 3 for q in range(1, 35)}
    responses[7] = 6

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
    ) as client:
        response = await client.post("/assessments/score", json={"responses": responses})

    assert response.status_code == 422


@pytest.mark.anyio
async def test_assessment_submit_and_get_returns_persisted_record() -> None:
    responses = {q: 3 for q in range(1, 35)}

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
    ) as client:
        submit_response = await client.post(
            "/assessments/submit",
            json={
                "participant_id": "leader-1",
                "organization_id": "org-42",
                "responses": responses,
                "leadership_complexity_outlook_90_days": "increase",
            },
        )
        assert submit_response.status_code == 201
        assessment_id = submit_response.json()["id"]
        get_response = await client.get(f"/assessments/{assessment_id}")

    assert get_response.status_code == 200
    payload = get_response.json()
    assert payload["participant_id"] == "leader-1"
    assert payload["organization_id"] == "org-42"
    assert len(payload["responses"]) == 34
    assert payload["lsi_overall"] == 3.0
    assert payload["leadership_load_index_overall"] == 3.0
    assert payload["leadership_complexity_outlook_90_days"] == "increase"


@pytest.mark.anyio
async def test_assessment_trend_returns_improving_capacity_signal() -> None:
    first = {q: 3 for q in range(1, 35)}
    second = {q: 4 for q in range(1, 25)}
    second.update({q: 2 for q in range(25, 35)})

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
    ) as client:
        first_response = await client.post(
            "/assessments/submit",
            json={"participant_id": "leader-trend", "responses": first},
        )
        assert first_response.status_code == 201
        first_id = first_response.json()["id"]

        second_response = await client.post(
            "/assessments/submit",
            json={
                "participant_id": "leader-trend",
                "responses": second,
                "leadership_complexity_outlook_90_days": "decrease",
            },
        )
        assert second_response.status_code == 201
        second_id = second_response.json()["id"]

        trend_response = await client.get(f"/assessments/{second_id}/trend")

    assert trend_response.status_code == 200
    trend = trend_response.json()
    assert trend["assessment_id"] == second_id
    assert trend["baseline_assessment_id"] == first_id
    assert trend["prediction_signal"] == "improving_capacity"
    assert trend["lsi_overall_change"] == 1.0
    assert trend["leadership_load_index_overall_change"] == -1.0
    assert trend["complexity_outlook_90_days"] == "decrease"


@pytest.mark.anyio
async def test_assessment_trend_handles_missing_history() -> None:
    responses = {q: 3 for q in range(1, 35)}

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
    ) as client:
        submit_response = await client.post(
            "/assessments/submit",
            json={"responses": responses},
        )
        assert submit_response.status_code == 201
        assessment_id = submit_response.json()["id"]
        trend_response = await client.get(f"/assessments/{assessment_id}/trend")

    assert trend_response.status_code == 200
    trend = trend_response.json()
    assert trend["prediction_signal"] == "insufficient_history"
    assert trend["baseline_assessment_id"] is None
