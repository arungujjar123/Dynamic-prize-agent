"""
SQLAlchemy models for Dynamic Pricing Agent
"""
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime,
    Text, ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.orm import declarative_base, relationship
import enum

Base = declarative_base()


class PricingStrategy(str, enum.Enum):
    COMPETITIVE = "competitive"
    DEMAND_BASED = "demand_based"
    CLEARANCE = "clearance"
    SURGE = "surge"
    COST_PLUS = "cost_plus"


class AgentStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    sku = Column(String, unique=True, nullable=False)
    category = Column(String)
    cost_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=False)
    min_price = Column(Float, nullable=False)
    max_price = Column(Float, nullable=False)
    inventory_count = Column(Integer, default=0)
    inventory_threshold = Column(Integer, default=10)  # low stock threshold
    is_active = Column(Boolean, default=True)
    external_url = Column(String)  # URL for competitor scraping
    competitor_urls = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    price_decisions = relationship("PriceDecision", back_populates="product")
    competitor_prices = relationship("CompetitorPrice", back_populates="product")
    demand_signals = relationship("DemandSignal", back_populates="product")


class PriceDecision(Base):
    __tablename__ = "price_decisions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    old_price = Column(Float, nullable=False)
    new_price = Column(Float, nullable=False)
    price_change_pct = Column(Float)
    strategy = Column(SAEnum(PricingStrategy))
    reasoning = Column(Text)
    confidence_score = Column(Float)  # 0.0 - 1.0
    agent_run_id = Column(String)
    applied = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="price_decisions")


class CompetitorPrice(Base):
    __tablename__ = "competitor_prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    competitor_name = Column(String, nullable=False)
    competitor_url = Column(String)
    price = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    availability = Column(String)
    scraped_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="competitor_prices")


class DemandSignal(Base):
    __tablename__ = "demand_signals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    page_views = Column(Integer, default=0)
    cart_adds = Column(Integer, default=0)
    purchases_last_24h = Column(Integer, default=0)
    sell_through_rate = Column(Float, default=0.0)  # % sold in last 7 days
    demand_score = Column(Float, default=0.5)  # 0-1 normalized
    recorded_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="demand_signals")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(String, primary_key=True)
    status = Column(SAEnum(AgentStatus), default=AgentStatus.PENDING)
    products_processed = Column(Integer, default=0)
    decisions_made = Column(Integer, default=0)
    prices_updated = Column(Integer, default=0)
    errors = Column(JSON, default=list)
    total_tokens_used = Column(Integer, default=0)
    duration_seconds = Column(Float)
    triggered_by = Column(String, default="scheduler")  # scheduler | manual | webhook
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
