"""
Async database session management
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from contextlib import asynccontextmanager
from loguru import logger
import os
from dotenv import load_dotenv

load_dotenv()

def _normalize_urls(url: str) -> tuple[str, str]:
    """Accept plain postgres:// URLs (as given by Render/Heroku/Railway) and derive async + sync variants"""
    base = url.split("://", 1)[1]
    return f"postgresql+asyncpg://{base}", f"postgresql://{base}"


DATABASE_URL, _derived_sync_url = _normalize_urls(
    os.getenv("DATABASE_URL", "postgresql+asyncpg://pricing_user:pricing_pass@localhost:5432/pricing_db")
)
SYNC_DATABASE_URL = os.getenv("SYNC_DATABASE_URL") or _derived_sync_url

async_engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

sync_engine = create_engine(SYNC_DATABASE_URL, echo=False)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    from backend.db.models import Base
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables initialized")


async def seed_demo_products():
    """Seed TMLCStore Indian products — all prices in INR, competitors: Amazon.in + Flipkart"""
    from backend.db.models import Product
    from sqlalchemy import select

    demo_products = [
        Product(
            id="prod_001",
            name="boAt Rockerz 450 Bluetooth Headphones",
            sku="TMLC-BOAT-450",
            category="Electronics",
            cost_price=800.0,
            current_price=1499.0,
            min_price=999.0,
            max_price=2199.0,
            inventory_count=42,
            inventory_threshold=10,
            competitor_urls=[
                "https://www.amazon.in/dp/B07QF3TRS9",
                "https://www.flipkart.com/boat-rockerz-450-bluetooth-headphone/p/itmfb5vzmhqwdj7h",
            ],
        ),
        Product(
            id="prod_002",
            name="Noise ColorFit Pro 4 Smartwatch",
            sku="TMLC-NOISE-CFP4",
            category="Wearables",
            cost_price=1200.0,
            current_price=2499.0,
            min_price=1499.0,
            max_price=3499.0,
            inventory_count=6,
            inventory_threshold=10,
            competitor_urls=[
                "https://www.amazon.in/noise-colorfit-pro-4/dp/B0C1XYZ123",
                "https://www.flipkart.com/noise-colorfit-pro-4-smartwatch/p/itm00noise4",
            ],
        ),
        Product(
            id="prod_003",
            name="Prestige Iris 750W Mixer Grinder",
            sku="TMLC-PRESTIGE-IRIS",
            category="Kitchen Appliances",
            cost_price=1800.0,
            current_price=3299.0,
            min_price=2199.0,
            max_price=4499.0,
            inventory_count=85,
            inventory_threshold=15,
            competitor_urls=[
                "https://www.amazon.in/dp/B00IIZBZ06",
                "https://www.flipkart.com/prestige-iris-750-w-mixer-grinder/p/itme8zaqwkggfhzz",
            ],
        ),
        Product(
            id="prod_004",
            name="Wildcraft Unisex Laptop Backpack 30L",
            sku="TMLC-WC-BP30",
            category="Bags",
            cost_price=600.0,
            current_price=1299.0,
            min_price=799.0,
            max_price=1899.0,
            inventory_count=4,
            inventory_threshold=10,
            competitor_urls=[
                "https://www.amazon.in/Wildcraft-laptop-backpack/dp/B07D5L7G8H",
                "https://www.flipkart.com/wildcraft-30-ltrs-laptop-backpack/p/itm456wildcraft",
            ],
        ),
        Product(
            id="prod_005",
            name="Mamaearth Vitamin C Face Serum 30ml",
            sku="TMLC-ME-VCS30",
            category="Skincare",
            cost_price=180.0,
            current_price=499.0,
            min_price=249.0,
            max_price=699.0,
            inventory_count=130,
            inventory_threshold=20,
            competitor_urls=[
                "https://www.amazon.in/Mamaearth-Vitamin-Serum/dp/B07WQTJ5ZP",
                "https://www.flipkart.com/mamaearth-vitamin-c-face-serum-30ml/p/itm789mamaearth",
            ],
        ),
        Product(
            id="prod_006",
            name="Crompton Aura Prime LED Ceiling Fan",
            sku="TMLC-CROMP-AURA",
            category="Home Appliances",
            cost_price=2200.0,
            current_price=3999.0,
            min_price=2699.0,
            max_price=5499.0,
            inventory_count=18,
            inventory_threshold=8,
            competitor_urls=[
                "https://www.amazon.in/Crompton-Aura-Prime-Ceiling-Fan/dp/B08Y5MGQSN",
                "https://www.flipkart.com/crompton-aura-prime-ceiling-fan/p/itm345crompton",
            ],
        ),
    ]

    async with AsyncSessionLocal() as session:
        for product in demo_products:
            existing = await session.execute(select(Product).where(Product.id == product.id))
            if not existing.scalar_one_or_none():
                session.add(product)
        await session.commit()
        logger.info("✅ TMLCStore Indian products seeded — 6 products, INR pricing, Amazon.in + Flipkart competitors")