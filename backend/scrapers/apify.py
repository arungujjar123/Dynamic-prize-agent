"""
Apify integration — real Amazon.in / Flipkart prices via Apify Actors.

Amazon and Flipkart block plain HTTP scraping, so when APIFY_TOKEN is set we
run a store Actor per product URL and read the price from its dataset.

Store Actors don't share an input/output format, so:
- the input sends the URL under the field names Actors commonly use
  (override per site with APIFY_<SITE>_INPUT, a JSON template with "{url}")
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


def build_input(site: str, url: str) -> dict:
    template = os.getenv(f"APIFY_{site.upper()}_INPUT")
    if template:
        return json.loads(template.replace("{url}", url))
    return {
        "startUrls": [{"url": url}],
        "categoryOrProductUrls": [{"url": url}],
        "productUrls": [url],
        "urls": [url],
        "maxItems": 1,
        "maxItemsPerStartUrl": 1,
        "maxResults": 1,
    }


def _to_price(value: Any) -> Optional[float]:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        price = float(value)
    elif isinstance(value, str):
        match = re.search(r"\d[\d,]*(?:\.\d+)?", value.replace("₹", ""))
        if not match:
            return None
        price = float(match.group().replace(",", ""))
    elif isinstance(value, dict):
        # e.g. {"value": 1299, "currency": "INR"}
        for key in ("value", "amount", "price"):
            if key in value:
                return _to_price(value[key])
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
    return None


async def fetch_price(url: str) -> Optional[float]:
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
                json=build_input(site, url),
            )
            resp.raise_for_status()
            items = resp.json()
    except Exception as e:
        # never log str(e): httpx includes the request URL, which carries the token
        status = e.response.status_code if isinstance(e, httpx.HTTPStatusError) else ""
        logger.warning(f"⚠️ Apify {actor} failed for {site}: {type(e).__name__} {status}")
        return None

    for item in items if isinstance(items, list) else []:
        if isinstance(item, dict):
            price = extract_price(item)
            if price:
                logger.info(f"✅ Apify {site}: ₹{price:,.0f}")
                return price

    sample = items[0] if isinstance(items, list) and items and isinstance(items[0], dict) else {}
    logger.warning(
        f"⚠️ Apify {actor} returned {len(items) if isinstance(items, list) else 0} items "
        f"but no price — item keys: {sorted(sample.keys())[:30]}"
    )
    return None
