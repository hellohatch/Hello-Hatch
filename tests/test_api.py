import pytest
import httpx

from backend.app import main


def setup_function() -> None:
    main._signals.clear()
    main._next_signal_id = 1


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
