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

    async def no_price(url, product_name=''):
        return None

    monkeypatch.setattr(apify, "fetch_price", no_price)
    result = await competitor.get_competitor_price("https://www.amazon.in/dp/X", "boAt Rockerz 450")
    assert result["source"] == "simulated"


async def test_competitor_price_uses_apify_result(monkeypatch):
    monkeypatch.setenv("APIFY_TOKEN", "tok")

    async def price(url, product_name=''):
        return 1199.0

    monkeypatch.setattr(apify, "fetch_price", price)
    result = await competitor.get_competitor_price("https://www.amazon.in/dp/X", "boAt Rockerz 450")
    assert (result["source"], result["price"], result["competitor_name"]) == ("scraped", 1199.0, "amazon.in")


async def test_failed_apify_lookup_is_not_retried_every_run(monkeypatch):
    monkeypatch.setenv("APIFY_TOKEN", "tok")
    calls = []

    async def no_price(url, product_name=''):
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


@pytest.mark.parametrize("item,expected", [
    ({"price": [{"value": 2125}]}, 2125),
    ({"price": {"sellingPrice": {"decimalValue": "2,125.00"}}}, 2125),
    ({"price": None, "mrp": 2999, "discountAmount": 874}, 2125),
    ({"price": 0, "mrp": 2999}, None),                      # MRP alone is not a selling price
])
def test_extract_price_more_shapes(item, expected):
    assert apify.extract_price(item) == expected


NOISE_URL = ("https://www.flipkart.com/noise-colorfit-pro4-bluetooth-calling-1-72-truview-display-functional-crown-smartwatch"
             "/p/itm081878581e874?pid=SMWGEQFXT4AA9UVW&lid=LSTSMWGEQFXT4AA9UVWCD6XPC&marketplace=FLIPKART")
# shape of zaver.api/flipkart-scraper search results
SEARCH_RESULTS = [
    {"title": "Noise Icon 4 with Stunning 1.96\" AMOLED Display", "price": 1899, "originalPrice": 6999,
     "url": "https://www.flipkart.com/noise-icon-4/p/itmb7800093c5c95?pid=SMWGWZVPQWQSG2UH"},
    {"title": "Noise ColorFit Pro4 Bluetooth Calling with 1.72\" TruView Display", "price": 2999, "originalPrice": 5999,
     "url": "https://www.flipkart.com/noise-colorfit-pro4/p/itmd32f591cb52c6?pid=SMWGE6YXFRKJGBGD"},
    {"title": "Noise ColorFit Pro4 Bluetooth Calling with 1.72\" TruView Display", "price": 2899, "originalPrice": 5999,
     "url": "https://www.flipkart.com/noise-colorfit-pro4/p/itm081878581e874?pid=SMWGEQFXT4AA9UVW"},
]


def test_product_ids():
    assert apify.product_ids(NOISE_URL) == ["SMWGEQFXT4AA9UVW", "itm081878581e874"]
    assert apify.product_ids("https://www.amazon.in/Mamaearth/dp/B07WQTJ5ZP?th=1") == ["B07WQTJ5ZP"]


def test_pick_item_matches_exact_variant_in_search_results():
    assert apify.pick_item(SEARCH_RESULTS, NOISE_URL, "Noise ColorFit Pro 4 Smartwatch")["price"] == 2899


def test_pick_item_falls_back_to_title_and_refuses_bad_matches():
    other_url = "https://www.flipkart.com/x/p/itmzzz?pid=NOTINRESULTS"
    picked = apify.pick_item(SEARCH_RESULTS, other_url, "Noise ColorFit Pro4 Bluetooth Calling TruView Display")
    assert picked["price"] in (2999, 2899)
    assert apify.pick_item(SEARCH_RESULTS, other_url, "Crompton Aura Prime LED Ceiling Fan") is None
    # a single result (product-page Actors) is taken as-is
    assert apify.pick_item(SEARCH_RESULTS[:1], other_url, "anything")["price"] == 1899


def test_input_template_fills_query_and_url_safely(monkeypatch):
    monkeypatch.setenv("APIFY_FLIPKART_INPUT", '{"query": "{query}", "maxItems": 20}')
    assert apify.build_input("flipkart", NOISE_URL, 'Noise 1.72" Watch') == {"query": 'Noise 1.72" Watch', "maxItems": 20}
