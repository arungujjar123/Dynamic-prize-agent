"""
Clear all rows from all tables in the pricing DB.
Usage: python clear_db.py
"""
import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from backend.db.session import init_db, AsyncSessionLocal
from backend.db.models import AgentRun, PriceDecision, DemandSignal, CompetitorPrice, Product
from sqlalchemy import delete
from loguru import logger


async def main():
    await init_db()

    async with AsyncSessionLocal() as session:
        # Order matters — delete child tables before parents
        r1 = await session.execute(delete(AgentRun))
        r2 = await session.execute(delete(PriceDecision))
        r3 = await session.execute(delete(DemandSignal))
        r4 = await session.execute(delete(CompetitorPrice))
        r5 = await session.execute(delete(Product))
        await session.commit()

        logger.success("✅ All rows deleted:")
        logger.info(f"   agent_runs      → {r1.rowcount} rows deleted")
        logger.info(f"   price_decisions → {r2.rowcount} rows deleted")
        logger.info(f"   demand_signals  → {r3.rowcount} rows deleted")
        logger.info(f"   competitor_prices → {r4.rowcount} rows deleted")
        logger.info(f"   products        → {r5.rowcount} rows deleted")


if __name__ == "__main__":
    asyncio.run(main())