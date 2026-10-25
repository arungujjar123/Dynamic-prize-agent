"""
Apify integration — real Amazon.in / Flipkart prices via Apify Actors.

Amazon and Flipkart block plain HTTP scraping, so when APIFY_TOKEN is set we
run a store Actor per product URL and read the price from its dataset.

Store Actors don't share an input/output format, so:
- the input sends the URL under the field names Actors commonly use
  (override per site with APIFY_<SITE>_INPUT, a JSON template where "{url}"
  is the product URL and "{query}" the product name — for search Actors)
- when an Actor returns several products (search results), the one whose
  URL carries the same product ID as ours is picked, else the closest title
- the price is searched for under common field names and formats
If no price can be found, the item's keys are logged so the Actor or parser
can be adjusted, and the caller falls back to simulated prices.
"""
import json
import os
import re
from typing import Any, Optional

import httpx
from loguru import logger

APIFY_API = "https://api.apify.com/v2"

# Actor IDs use "username~actor-name"; override with APIFY_AMAZON_ACTOR / APIFY_FLIPKART_ACTOR
DEFAULT_ACTORS = {
    "amazon": "junglee~amazon-crawler",
    "flipkart": "sourabhbgp~flipkart-product-scraper",
}

# Field names that hold the selling price, most specific first
PRICE_KEYS = (
    "sellingPrice", "salePrice", "finalPrice", "offerPrice", "discountedPrice",
    "currentPrice", "price", "priceValue", "amount", "value",
)


def site_for_url(url: str) -> Optional[str]:
    if "amazon." in url:
        return "amazon"
    if "flipkart." in url:
        return "flipkart"
    return None


def is_configured() -> bool:
    return bool(os.getenv("APIFY_TOKEN"))


def actor_for(site: str) -> str:
    return os.getenv(f"APIFY_{site.upper()}_ACTOR") or DEFAULT_ACTORS[site]


def build_input(site: str, url: str, query: str = "") -> dict:
    template = os.getenv(f"APIFY_{site.upper()}_INPUT")
    if template:
        # json.dumps(...)[1:-1] escapes quotes/backslashes for use inside a JSON string
        return json.loads(
            template.replace("{url}", json.dumps(url)[1:-1]).replace("{query}", json.dumps(query)[1:-1])
        )
    return {
        "startUrls": [{"url": url}],
        "categoryOrProductUrls": [{"url": url}],
        "productUrls": [url],
        "urls": [url],
        "maxItems": 1,
        "maxItemsPerStartUrl": 1,
        "maxResults": 1,
    }


def _to_price(value: Any, depth: int = 0) -> Optional[float]:
    if isinstance(value, bool) or value is None or depth > 3:
        return None
    if isinstance(value, list):
        # e.g. [{"value": 1299}] — first parseable entry wins
        for entry in value:
            price = _to_price(entry, depth + 1)
            if price:
                return price
        return None
    if isinstance(value, (int, float)):
        price = float(value)
    elif isinstance(value, str):
        match = re.search(r"\d[\d,]*(?:\.\d+)?", value.replace("₹", ""))
        if not match:
            return None
        price = float(match.group().replace(",", ""))
    elif isinstance(value, dict):
        # e.g. {"value": 1299, "currency": "INR"} or {"sellingPrice": {"decimalValue": "1299"}}
        for key in PRICE_KEYS + ("decimalValue", "raw"):
            if key in value:
                price = _to_price(value[key], depth + 1)
                if price:
                    return price
        return None
    else:
        return None
    return price if 1 <= price <= 10_000_000 else None


def extract_price(item: dict) -> Optional[float]:
    """Find the selling price in an Actor dataset item, whatever its exact shape."""
    for key in PRICE_KEYS:
        if key in item:
            price = _to_price(item[key])
            if price:
                return price
    # one level down, e.g. {"pricing": {"sellingPrice": ...}}
    for nested in item.values():
        if isinstance(nested, dict):
            for key in PRICE_KEYS:
                if key in nested:
                    price = _to_price(nested[key])
                    if price:
                        return price
    # Some Actors give only MRP + discount, e.g. {"mrp": 2999, "discountAmount": 500}
    mrp, discount = _to_price(item.get("mrp")), _to_price(item.get("discountAmount"))
    if mrp and discount and discount < mrp:
        return mrp - discount
    return None


def product_ids(url: str) -> list[str]:
    """IDs that identify the exact product in a marketplace URL, most specific first."""
    ids = []
    pid = re.search(r"[?&]pid=([A-Z0-9]+)", url)              # Flipkart variant id
    if pid:
        ids.append(pid.group(1))
    itm = re.search(r"/p/(itm[a-z0-9]+)", url)                # Flipkart listing id
    if itm:
        ids.append(itm.group(1))
    asin = re.search(r"/(?:dp|gp/product)/([A-Z0-9]{10})", url)  # Amazon ASIN
    if asin:
        ids.append(asin.group(1))
    return ids


def _item_urls(item: dict) -> str:
    return " ".join(str(item[k]) for k in ("url", "link", "productUrl", "productLink", "canonicalUrl") if item.get(k))


def _title_tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 1}


def pick_item(items: list[dict], url: str, product_name: str) -> Optional[dict]:
    """
    Choose the item for our product from an Actor's results.
    A single item is taken as-is (product-page Actors). From search results,
    prefer an exact product-ID match in the item's URL, then the closest title;
    return None rather than guess when nothing matches well.
    """
    priced = [i for i in items if isinstance(i, dict) and extract_price(i)]
    if len(priced) <= 1:
        return priced[0] if priced else None

    for product_id in product_ids(url):
        for item in priced:
            if product_id in _item_urls(item):
                return item

    wanted = _title_tokens(product_name)
    if not wanted:
        return None
    best, best_score = None, 0.0
    for item in priced:
        title = str(item.get("title") or item.get("name") or item.get("newTitle") or "")
        score = len(wanted & _title_tokens(title)) / len(wanted)
        if score > best_score:
            best, best_score = item, score
    return best if best_score >= 0.7 else None


def _preview(value: Any) -> str:
    text = json.dumps(value, ensure_ascii=False, default=str)
    return text if len(text) <= 200 else text[:200] + "…"


async def fetch_price(url: str, product_name: str = "") -> Optional[float]:
    """Run the site's Actor for one product URL and return its price, or None."""
    site = site_for_url(url)
    token = os.getenv("APIFY_TOKEN")
    if not site or not token:
        return None

    actor = actor_for(site)
    timeout = float(os.getenv("APIFY_TIMEOUT_SECONDS", 120))
    try:
        async with httpx.AsyncClient(timeout=timeout + 15) as client:
            resp = await client.post(
                f"{APIFY_API}/acts/{actor}/run-sync-get-dataset-items",
                params={"token": token, "timeout": int(timeout), "format": "json"},
                json=build_input(site, url, product_name),
            )
            resp.raise_for_status()
            items = resp.json()
    except Exception as e:
        # never log str(e): httpx includes the request URL, which carries the token
        status = e.response.status_code if isinstance(e, httpx.HTTPStatusError) else ""
        logger.warning(f"⚠️ Apify {actor} failed for {site}: {type(e).__name__} {status}")
        return None

    item = pick_item(items, url, product_name) if isinstance(items, list) else None
    if item:
        price = extract_price(item)
        logger.info(f"✅ Apify {site}: ₹{price:,.0f} ({len(items)} results)")
        return price
    if isinstance(items, list) and sum(1 for i in items if isinstance(i, dict) and extract_price(i)) > 1:
        logger.warning(
            f"⚠️ Apify {actor} returned {len(items)} priced results but none matched "
            f"product IDs {product_ids(url)} or the name '{product_name}'"
        )
        return None

    sample = items[0] if isinstance(items, list) and items and isinstance(items[0], dict) else {}
    if "error" in sample:
        logger.warning(f"⚠️ Apify {actor} could not scrape this URL: {_preview(sample.get('error'))}")
        return None
    price_fields = {k: sample[k] for k in ("price", "mrp", "discountAmount", "offers", "availabilityStatus", "inStock") if k in sample}
    logger.warning(
        f"⚠️ Apify {actor} returned {len(items) if isinstance(items, list) else 0} items "
        f"but no price — item keys: {sorted(sample.keys())[:30]}; price fields: {_preview(price_fields)}"
    )
    return None
