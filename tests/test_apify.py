import httpx
import pytest

from backend.scrapers import apify, competitor


@pytest.fixture(autouse=True)
def fresh_failure_memory(monkeypatch):
    monkeypatch.setattr(competitor, "_apify_failures", {})


@pytest.mark.parametrize("item,expected", [
    ({"price": {"value": 1299, "currency": "INR"}}, 1299),
    ({"price": "₹1,49,999"}, 149999),
    ({"sellingPrice": 1215, "price": 1499}, 1215),          # selling price beats MRP
    ({"pricing": {"finalPrice": "1,240.50"}}, 1240.5),
    ({"title": "no price here"}, None),
    ({"price": True}, None),
])
def test_extract_price(item, expected):
    assert apify.extract_price(item) == expected


def test_input_template_override(monkeypatch):
    monkeypatch.setenv("APIFY_FLIPKART_INPUT", '{"links": ["{url}"], "limit": 1}')
    assert apify.build_input("flipkart", "https://flipkart.com/p/1") == {"links": ["https://flipkart.com/p/1"], "limit": 1}
    assert apify.actor_for("amazon") == "junglee~amazon-crawler"


async def test_fetch_price_calls_actor_and_parses(monkeypatch):
    monkeypatch.setenv("APIFY_TOKEN", "tok")
    seen = {}

    def handler(request: httpx.Request):
        seen["path"] = request.url.path
        seen["token"] = request.url.params["token"]
        return httpx.Response(200, json=[{"title": "boAt", "price": {"value": 1199}}])

    real_client = httpx.AsyncClient
    monkeypatch.setattr(apify.httpx, "AsyncClient",
                        lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw))
    assert await apify.fetch_price("https://www.amazon.in/dp/B07QF3TRS9") == 1199
    assert seen == {"path": "/v2/acts/junglee~amazon-crawler/run-sync-get-dataset-items", "token": "tok"}


async def test_fetch_price_failure_returns_none(monkeypatch):
    monkeypatch.setenv("APIFY_TOKEN", "tok")
    real_client = httpx.AsyncClient
    monkeypatch.setattr(apify.httpx, "AsyncClient",
                        lambda **kw: real_client(transport=httpx.MockTransport(lambda r: httpx.Response(402)), **kw))
    assert await apify.fetch_price("https://www.flipkart.com/p/itm1") is None


async def test_competitor_price_falls_back_to_simulated_when_apify_has_no_price(monkeypatch):
    monkeypatch.setenv("APIFY_TOKEN", "tok")

    async def no_price(url):
        return None

    monkeypatch.setattr(apify, "fetch_price", no_price)
    result = await competitor.get_competitor_price("https://www.amazon.in/dp/X", "boAt Rockerz 450")
    assert result["source"] == "simulated"


async def test_competitor_price_uses_apify_result(monkeypatch):
    monkeypatch.setenv("APIFY_TOKEN", "tok")

    async def price(url):
        return 1199.0

    monkeypatch.setattr(apify, "fetch_price", price)
    result = await competitor.get_competitor_price("https://www.amazon.in/dp/X", "boAt Rockerz 450")
    assert (result["source"], result["price"], result["competitor_name"]) == ("scraped", 1199.0, "amazon.in")


async def test_failed_apify_lookup_is_not_retried_every_run(monkeypatch):
    monkeypatch.setenv("APIFY_TOKEN", "tok")
    calls = []

    async def no_price(url):
        calls.append(url)
        return None

    async def no_cache(product_id, domain):
        return None

    monkeypatch.setattr(apify, "fetch_price", no_price)
    monkeypatch.setattr(competitor, "_cached_price", no_cache)
    for _ in range(3):
        result = await competitor.get_competitor_price("https://www.flipkart.com/p/1", "Fan", product_id="p1")
        assert result["source"] == "simulated"
    assert len(calls) == 1


def test_forget_failures_only_clears_that_product(monkeypatch):
    from datetime import datetime
    competitor._apify_failures.update({"p1|amazon.in": datetime.utcnow(), "p2|amazon.in": datetime.utcnow()})
    competitor.forget_failures("p1")
    assert list(competitor._apify_failures) == ["p2|amazon.in"]
