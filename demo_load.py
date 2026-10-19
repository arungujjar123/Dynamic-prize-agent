"""
Demo Load Generator — fires rapid agent runs to populate Grafana with rich metric data.
Run this before/during your session: python demo_load.py
"""
import asyncio
import random
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from backend.db.session import init_db, seed_demo_products, AsyncSessionLocal
from backend.db.models import Product
from backend.agents.pricing_agent import run_agent
from backend.metrics.prometheus import guardrail_triggers_total, llm_errors_total
from sqlalchemy import select
from loguru import logger


async def randomize_product_states():
    """Randomize inventory + prices to get diverse strategy decisions"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Product))
        products = result.scalars().all()
        for p in products:
            # Vary inventory to trigger SURGE / CLEARANCE
            p.inventory_count = random.choice([2, 3, 5, 15, 40, 80, 120, 200])
            await db.flush()
        logger.info("🎲 Randomized product states")


async def main(runs: int = 8, delay: float = 3.0):
    logger.info("🔥 Demo Load Generator starting...")
    await init_db()
    await seed_demo_products()

    for i in range(runs):
        logger.info(f"\n{'='*50}")
        logger.info(f"📍 Demo run {i+1}/{runs}")

        # Randomize states every 2 runs to get diverse strategies
        if i % 2 == 0:
            await randomize_product_states()

        # Occasionally simulate a guardrail trigger for the demo
        if random.random() < 0.3:
            rule = random.choice(["min_margin", "max_velocity", "price_floor"])
            guardrail_triggers_total.labels(rule=rule).inc()
            logger.info(f"🛡️  Injected guardrail trigger: {rule}")

        await run_agent(triggered_by="demo_load")
        await asyncio.sleep(delay)

    logger.success(f"\n✅ Load generation complete — {runs} runs done.")
    logger.info("📊 Open Grafana at http://localhost:3001 to see the data.")


if __name__ == "__main__":
    runs = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    asyncio.run(main(runs=runs))
