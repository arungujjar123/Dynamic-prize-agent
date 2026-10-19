"""
Run this ONCE to clear old demo products and reseed with Indian TMLCStore products.
Usage: python reset_products.py
"""
import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from backend.db.session import init_db, seed_demo_products, AsyncSessionLocal
from backend.db.models import Product, PriceDecision, DemandSignal
from sqlalchemy import delete
from loguru import logger


async def main():
    await init_db()
    async with AsyncSessionLocal() as session:
        # Clear all existing data
        await session.execute(delete(PriceDecision))
        await session.execute(delete(DemandSignal))
        await session.execute(delete(Product))
        await session.commit()
        logger.info("🗑️  Cleared all old products and decisions")

    await seed_demo_products()
    logger.success("✅ Done — TMLCStore Indian products loaded. Restart the backend now.")


if __name__ == "__main__":
    asyncio.run(main())