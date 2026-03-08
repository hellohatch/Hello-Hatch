import httpx
from pathlib import Path

import pytest

from backend.app import main


@pytest.fixture(autouse=True)
def reset_state(tmp_path: Path) -> None:
    main._signals.clear()
    main._next_signal_id = 1
    main.configure_database(str(tmp_path / "assessments_test.db"))


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def auth_headers(
    organization_id: str = "org-test",
    username: str = "tester",
) -> dict[str, str]:
    token = main.create_access_token(username=username, organization_id=organization_id)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.anyio
async def test_auth_token_endpoint_returns_bearer_token() -> None:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/auth/token",
            json={
                "username": "alice",
                "password": main._auth_password,
                "organization_id": "org-alpha",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["token_type"] == "bearer"
    assert payload["username"] == "alice"
    assert payload["organization_id"] == "org-alpha"
    assert isinstance(payload["access_token"], str)
    assert len(payload["access_token"].split(".")) == 3


@pytest.mark.anyio
async def test_assessment_endpoints_require_auth() -> None:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
    ) as client:
        response = await client.get("/assessments/template")

    assert response.status_code == 401


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
    assert "Leadership Risk Intelligence Platform" in response.text
    assert "Access Control" in response.text


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
    assert response.json()["id"] == 1


@pytest.mark.anyio
async def test_assessment_template_includes_scale_and_context_question() -> None:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
        headers=auth_headers("org-a"),
    ) as client:
        response = await client.get("/assessments/template")

    assert response.status_code == 200
    payload = response.json()
    assert payload["scale"]["1"] == "Rarely true for me"
    assert payload["scale"]["5"] == "Consistently true for me"
    assert payload["context_question_35"]["number"] == 35


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
        headers=auth_headers("org-a"),
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
    assert payload["lsi_overall"] == 3.33
    assert payload["leadership_load_index_overall"] == 3.0
    assert payload["leadership_stability_score"] == 3.1
    assert payload["leadership_stability_risk"] == 1.9
    assert payload["concentration_exposure_stage"] in {
        "Healthy Distribution",
        "Exposure",
        "Concentration",
        "Structural Risk",
    }
    assert 0 <= payload["leadership_risk_score"] <= 100


@pytest.mark.anyio
async def test_assessment_submit_and_get_enforces_org_scope() -> None:
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
            },
            headers=auth_headers("org-42"),
        )
        assert submit_response.status_code == 201
        assessment_id = submit_response.json()["id"]

        same_org_get = await client.get(
            f"/assessments/{assessment_id}", headers=auth_headers("org-42")
        )
        other_org_get = await client.get(
            f"/assessments/{assessment_id}", headers=auth_headers("org-other")
        )

    assert same_org_get.status_code == 200
    assert same_org_get.json()["organization_id"] == "org-42"
    assert other_org_get.status_code == 403


@pytest.mark.anyio
async def test_assessment_submit_rejects_payload_org_mismatch() -> None:
    responses = {q: 3 for q in range(1, 35)}
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
        headers=auth_headers("org-a"),
    ) as client:
        response = await client.post(
            "/assessments/submit",
            json={
                "participant_id": "leader-1",
                "organization_id": "org-b",
                "responses": responses,
            },
        )

    assert response.status_code == 403


@pytest.mark.anyio
async def test_assessment_trend_returns_improving_capacity_signal() -> None:
    first = {q: 3 for q in range(1, 35)}
    second = {q: 4 for q in range(1, 25)}
    second.update({q: 2 for q in range(25, 35)})

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
        headers=auth_headers("org-trend"),
    ) as client:
        first_response = await client.post(
            "/assessments/submit",
            json={"participant_id": "leader-trend", "responses": first},
        )
        second_response = await client.post(
            "/assessments/submit",
            json={
                "participant_id": "leader-trend",
                "responses": second,
                "leadership_complexity_outlook_90_days": "decrease",
            },
        )
        trend_response = await client.get(
            f"/assessments/{second_response.json()['id']}/trend"
        )

    assert first_response.status_code == 201
    assert second_response.status_code == 201
    assert trend_response.status_code == 200
    trend = trend_response.json()
    assert trend["prediction_signal"] == "improving_capacity"
    assert trend["lsi_overall_change"] == 1.0
    assert trend["leadership_load_index_overall_change"] == -1.0


@pytest.mark.anyio
async def test_dashboard_summary_and_signals_are_org_scoped() -> None:
    responses_a = {q: 4 for q in range(1, 25)}
    responses_a.update({q: 2 for q in range(25, 35)})
    responses_b = {q: 2 for q in range(1, 25)}
    responses_b.update({q: 4 for q in range(25, 35)})

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=main.app),
        base_url="http://test",
    ) as client:
        await client.post(
            "/assessments/submit",
            json={
                "participant_id": "leader-dashboard",
                "responses": responses_a,
                "leadership_complexity_outlook_90_days": "increase",
            },
            headers=auth_headers("org-a"),
        )
        await client.post(
            "/assessments/submit",
            json={
                "participant_id": "leader-dashboard",
                "responses": responses_b,
                "leadership_complexity_outlook_90_days": "decrease",
            },
            headers=auth_headers("org-a"),
        )
        await client.post(
            "/assessments/submit",
            json={
                "participant_id": "other-leader",
                "responses": {q: 3 for q in range(1, 35)},
            },
            headers=auth_headers("org-b"),
        )

        summary_response = await client.get(
            "/dashboard/summary", headers=auth_headers("org-a")
        )
        signals_response = await client.get(
            "/dashboard/signals", headers=auth_headers("org-a")
        )
        forbidden_summary = await client.get(
            "/dashboard/summary?organization_id=org-b",
            headers=auth_headers("org-a"),
        )

    assert summary_response.status_code == 200
    summary = summary_response.json()
    assert summary["organization_id"] == "org-a"
    assert summary["total_assessments"] == 2
    assert summary["unique_participants"] == 1
    assert "avg_leadership_risk_score" in summary
    assert isinstance(summary["cei_stage_counts"], dict)
    assert signals_response.status_code == 200
    assert len(signals_response.json()["items"]) == 1
    first_signal = signals_response.json()["items"][0]
    assert "leadership_risk_score" in first_signal
    assert "concentration_exposure_stage" in first_signal
    assert forbidden_summary.status_code == 403
