import pytest
from fastapi import HTTPException

from backend.routers.api import require_api_key


@pytest.mark.asyncio
async def test_open_when_api_key_not_configured(monkeypatch):
    monkeypatch.delenv("API_KEY", raising=False)
    await require_api_key(None)


@pytest.mark.asyncio
async def test_rejects_missing_or_wrong_key(monkeypatch):
    monkeypatch.setenv("API_KEY", "secret")
    for key in (None, "wrong"):
        with pytest.raises(HTTPException) as exc:
            await require_api_key(key)
        assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_accepts_correct_key(monkeypatch):
    monkeypatch.setenv("API_KEY", "secret")
    await require_api_key("secret")


def test_timestamps_are_marked_utc():
    from datetime import datetime
    from backend.routers.api import _utc_iso

    assert _utc_iso(datetime(2026, 10, 25, 8, 4, 34)) == "2026-10-25T08:04:34Z"
    assert _utc_iso(None) is None
