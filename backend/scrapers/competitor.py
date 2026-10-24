"""
Competitor Price Scraper — Amazon.in + Flipkart
Falls back to realistic INR simulated prices when scraping is blocked.
"""
import asyncio
import random
import re
from typing import Optional
import httpx
from bs4 import BeautifulSoup
from loguru import logger
import os

SCRAPER_DELAY = float(os.getenv("SCRAPER_DELAY_SECONDS", 2))

HEADERS_POOL = [
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-IN,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36",
        "Accept-Language": "en-IN,en;q=0.9",
    },
]

# CSS selectors for Indian e-commerce sites
DOMAIN_SELECTORS = {
    "amazon.in": {
        "price": [
            "span.a-price-whole",
            ".a-offscreen",
            "#priceblock_ourprice",
            "#priceblock_dealprice",
            ".apexPriceToPay span.a-offscreen",
        ],
        "availability": ["#availability span"],
    },
    "flipkart.com": {
        "price": [
            "._30jeq3._16Jk6d",   # current selling price
            "._30jeq3",            # fallback price class
            "[class*='_30jeq3']",
        ],
        "availability": ["._6ojW4j"],  # out of stock indicator
    },
}

# Realistic INR price bands per product category/keyword
INR_PRICE_BANDS = {
    "boat":           (899,  1799),
    "headphone":      (799,  2499),
    "smartwatch":     (1299, 3999),
    "noise":          (1499, 3299),
    "mixer":          (1999, 4999),
    "grinder":        (1799, 4499),
    "prestige":       (2499, 4999),
    "backpack":       (699,  1999),
    "wildcraft":      (899,  1799),
    "serum":          (299,  699),
    "mamaearth":      (349,  649),
    "vitamin c":      (299,  599),
    "fan":            (2499, 5999),
    "crompton":       (2999, 5499),
    "ceiling fan":    (2799, 5299),
    "default":        (499,  2999),
}


def _get_domain(url: str) -> str:
    from urllib.parse import urlparse
    return urlparse(url).netloc.replace("www.", "")


def _extract_inr_price(text: str) -> Optional[float]:
    """Extract INR price — handles ₹1,499 / 1499 / 1,499.00 formats"""
    # Remove ₹ symbol and whitespace
    text = text.replace("₹", "").replace(",", "").strip()
    matches = re.findall(r"\d+(?:\.\d{1,2})?", text)
    for m in matches:
        try:
            val = float(m)
            # Valid INR range for our products: ₹100 to ₹1,00,000
            if 100 < val < 100000:
                return val
        except ValueError:
            continue
    return None


async def scrape_competitor_price(url: str, product_name: str) -> dict:
    """
    Scrape Amazon.in or Flipkart for price.
    Falls back to realistic INR simulation if blocked (very common for both sites).
    """
    domain = _get_domain(url)
    selectors = DOMAIN_SELECTORS.get(domain, {})
    headers = random.choice(HEADERS_POOL)

    try:
        await asyncio.sleep(SCRAPER_DELAY + random.uniform(0.5, 1.5))
        async with httpx.AsyncClient(
            timeout=12,
            follow_redirects=True,
            headers=headers,
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()

            # Both Amazon.in and Flipkart heavily use JS — check if we got a real page
            if len(resp.text) < 5000 or "robot" in resp.text.lower():
                raise ValueError("Bot detection triggered")

            soup = BeautifulSoup(resp.text, "lxml")
            price = None

            # Try domain-specific selectors
            for selector in selectors.get("price", []):
                el = soup.select_one(selector)
                if el:
                    price = _extract_inr_price(el.get_text())
                    if price:
                        break

            # Try meta tags (og:price)
            if not price:
                for meta in soup.find_all("meta", {"property": ["og:price:amount", "product:price:amount"]}):
                    price = _extract_inr_price(meta.get("content", ""))
                    if price:
                        break

            if price:
                logger.info(f"✅ Scraped {domain}: ₹{price} for '{product_name}'")
                return {
                    "competitor_name": domain,
                    "competitor_url": url,
                    "price": price,
                    "currency": "INR",
                    "availability": "in_stock",
                    "source": "scraped",
                }

    except Exception as e:
        logger.warning(f"⚠️ Scrape blocked/failed for {domain}: {type(e).__name__} — using simulated INR price")

    return _simulate_inr_price(url, domain, product_name)


def _simulate_inr_price(url: str, domain: str, product_name: str) -> dict:
    """
    Realistic INR competitor price simulation.
    - Seeded by product name for consistency within a session
    - Amazon.in tends to be 2-8% cheaper than us (aggressive pricing)
    - Flipkart tends to be 0-5% cheaper (competitive but less aggressive)
    """
    name_lower = product_name.lower()
    low, high = INR_PRICE_BANDS["default"]
    for keyword, band in INR_PRICE_BANDS.items():
        if keyword in name_lower:
            low, high = band
            break

    # Seed for consistency — same product+domain = same base price
    seed = sum(ord(c) for c in product_name) + sum(ord(c) for c in domain)
    rng = random.Random(seed)
    base = rng.uniform(low, high)

    # Amazon.in is more aggressive on price
    if "amazon" in domain:
        multiplier = rng.uniform(0.88, 0.98)   # 2-12% cheaper than our range top
    elif "flipkart" in domain:
        multiplier = rng.uniform(0.92, 1.02)   # 0-8% cheaper, sometimes same
    else:
        multiplier = rng.uniform(0.90, 1.05)

    price = round(base * multiplier, 0)  # Round to nearest rupee
    availability = rng.choices(
        ["in_stock", "in_stock", "in_stock", "limited_stock", "out_of_stock"],
        weights=[50, 20, 15, 10, 5]
    )[0]

    logger.debug(f"🤖 Simulated ₹{price} from {domain} for '{product_name}'")
    return {
        "competitor_name": domain,
        "competitor_url": url,
        "price": price,
        "currency": "INR",
        "availability": availability,
        "source": "simulated",
    }


async def get_all_competitor_prices(product_name: str, competitor_urls: list[str]) -> list[dict]:
    """Fetch competitor prices from Amazon.in and Flipkart concurrently"""
    if not competitor_urls:
        # Default to Amazon.in + Flipkart simulations
        return [
            _simulate_inr_price("https://www.amazon.in", "amazon.in", product_name),
            _simulate_inr_price("https://www.flipkart.com", "flipkart.com", product_name),
        ]

    tasks = [scrape_competitor_price(url, product_name) for url in competitor_urls]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    valid = []
    for r in results:
        if isinstance(r, dict):
            valid.append(r)
        else:
            logger.error(f"Scraper exception: {r}")
    return valid