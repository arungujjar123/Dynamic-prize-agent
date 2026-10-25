"""
FastAPI routers — Products, Decisions, Agent Control, E-com API simulation
"""
import os
import secrets
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from loguru import logger

from backend.db.session import get_db
from backend.db.models import (
    Product, PriceDecision, AgentRun, DemandSignal,
    CompetitorPrice, AgentStatus
)

# ── Auth ──────────────────────────────────────────────────────────────────────

async def require_api_key(x_api_key: Optional[str] = Header(default=None)):
    """Protects write endpoints when API_KEY is set. Unset = open (local dev only)."""
    expected = os.getenv("API_KEY")
    if not expected:
        return
    if not x_api_key or not secrets.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


def _utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """DB timestamps are naive UTC; mark them as UTC so browsers convert to local time"""
    return dt.isoformat() + "Z" if dt else None


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    id: str
    name: str
    sku: str
    category: Optional[str] = None
    cost_price: float
    current_price: float
    min_price: float
    max_price: float
    inventory_count: int = 0
    inventory_threshold: int = 10
    competitor_urls: list[str] = []

class ProductUpdate(BaseModel):
    current_price: Optional[float] = None
    inventory_count: Optional[int] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    is_active: Optional[bool] = None
    competitor_urls: Optional[list[str]] = None

class AgentRunRequest(BaseModel):
    triggered_by: str = "manual"
    product_id: Optional[str] = None  # None = run for all products


# ── Products Router ───────────────────────────────────────────────────────────
products_router = APIRouter(prefix="/products", tags=["Products"])

@products_router.get("/")
async def list_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.is_active == True))
    products = result.scalars().all()
    return [_product_to_dict(p) for p in products]

@products_router.get("/{product_id}")
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _product_to_dict(product)

@products_router.post("/", dependencies=[Depends(require_api_key)])
async def create_product(data: ProductCreate, db: AsyncSession = Depends(get_db)):
    product = Product(**data.model_dump())
    db.add(product)
    await db.flush()
    return _product_to_dict(product)

@products_router.patch("/{product_id}", dependencies=[Depends(require_api_key)])
async def update_product(product_id: str, data: ProductUpdate, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    changes = data.model_dump(exclude_none=True)
    if "competitor_urls" in changes and changes["competitor_urls"] != (product.competitor_urls or []):
        # cached prices belong to the old URLs — drop them so the next run scrapes the new pages
        from sqlalchemy import delete
        from backend.scrapers.competitor import forget_failures
        await db.execute(delete(CompetitorPrice).where(CompetitorPrice.product_id == product_id))
        forget_failures(product_id)
    for k, v in changes.items():
        setattr(product, k, v)
    product.updated_at = datetime.utcnow()
    return _product_to_dict(product)

@products_router.get("/{product_id}/price-history")
async def price_history(product_id: str, limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PriceDecision)
        .where(PriceDecision.product_id == product_id)
        .order_by(desc(PriceDecision.created_at))
        .limit(limit)
    )
    decisions = result.scalars().all()
    return [_decision_to_dict(d) for d in decisions]

def _product_to_dict(p: Product) -> dict:
    margin = ((p.current_price - p.cost_price) / p.current_price * 100) if p.current_price else 0
    return {
        "id": p.id, "name": p.name, "sku": p.sku, "category": p.category,
        "cost_price": p.cost_price, "current_price": p.current_price,
        "min_price": p.min_price, "max_price": p.max_price,
        "inventory_count": p.inventory_count, "inventory_threshold": p.inventory_threshold,
        "is_active": p.is_active, "competitor_urls": p.competitor_urls or [],
        "gross_margin_pct": round(margin, 1),
        "updated_at": _utc_iso(p.updated_at),
    }


# ── Decisions Router ──────────────────────────────────────────────────────────
decisions_router = APIRouter(prefix="/decisions", tags=["Price Decisions"])

@decisions_router.get("/")
async def list_decisions(limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PriceDecision).order_by(desc(PriceDecision.created_at)).limit(limit)
    )
    return [_decision_to_dict(d) for d in result.scalars().all()]

@decisions_router.get("/stats")
async def decision_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PriceDecision))
    decisions = result.scalars().all()
    if not decisions:
        return {"total": 0}
    total = len(decisions)
    increases = sum(1 for d in decisions if d.price_change_pct and d.price_change_pct > 0.5)
    decreases = sum(1 for d in decisions if d.price_change_pct and d.price_change_pct < -0.5)
    avg_change = sum(d.price_change_pct or 0 for d in decisions) / total
    avg_confidence = sum(d.confidence_score or 0 for d in decisions) / total
    strategies = {}
    for d in decisions:
        s = d.strategy.value if d.strategy else "unknown"
        strategies[s] = strategies.get(s, 0) + 1
    return {
        "total": total,
        "increases": increases,
        "decreases": decreases,
        "holds": total - increases - decreases,
        "avg_change_pct": round(avg_change, 2),
        "avg_confidence": round(avg_confidence, 2),
        "by_strategy": strategies,
    }

def _decision_to_dict(d: PriceDecision) -> dict:
    return {
        "id": d.id, "product_id": d.product_id,
        "old_price": d.old_price, "new_price": d.new_price,
        "price_change_pct": d.price_change_pct,
        "strategy": d.strategy.value if d.strategy else None,
        "reasoning": d.reasoning, "confidence_score": d.confidence_score,
        "llm_price": d.llm_price, "adjustments": d.adjustments or [],
        "competitor_data": d.competitor_data or [],
        "applied": d.applied,
        "created_at": _utc_iso(d.created_at),
    }


# ── Agent Router ──────────────────────────────────────────────────────────────
agent_router = APIRouter(prefix="/agent", tags=["Agent Control"])

_running_runs: set[str] = set()

@agent_router.post("/run", dependencies=[Depends(require_api_key)])
async def trigger_agent_run(
    request: AgentRunRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    if len(_running_runs) > 0:
        raise HTTPException(status_code=409, detail="An agent run is already in progress")

    run_id = f"run_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

    async def _run():
        _running_runs.add(run_id)
        try:
            from backend.agents.pricing_agent import run_agent
            await run_agent(triggered_by=request.triggered_by)
        finally:
            _running_runs.discard(run_id)

    background_tasks.add_task(_run)
    return {"status": "started", "run_id": run_id, "message": "Agent run started in background"}

@agent_router.get("/runs")
async def list_runs(limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentRun).order_by(desc(AgentRun.started_at)).limit(limit)
    )
    return [_run_to_dict(r) for r in result.scalars().all()]

@agent_router.get("/runs/{run_id}")
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await db.get(AgentRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return _run_to_dict(run)

@agent_router.get("/status")
async def agent_status():
    return {
        "is_running": len(_running_runs) > 0,
        "active_run_ids": list(_running_runs),
    }

def _run_to_dict(r: AgentRun) -> dict:
    return {
        "id": r.id, "status": r.status.value if r.status else None,
        "products_processed": r.products_processed,
        "decisions_made": r.decisions_made, "prices_updated": r.prices_updated,
        "errors": r.errors or [], "total_tokens_used": r.total_tokens_used,
        "duration_seconds": r.duration_seconds, "triggered_by": r.triggered_by,
        "started_at": _utc_iso(r.started_at),
        "completed_at": _utc_iso(r.completed_at),
    }


# ── Analytics Router ──────────────────────────────────────────────────────────
analytics_router = APIRouter(prefix="/analytics", tags=["Analytics"])

@analytics_router.get("/dashboard")
async def dashboard_summary(db: AsyncSession = Depends(get_db)):
    products_result = await db.execute(select(Product).where(Product.is_active == True))
    products = products_result.scalars().all()

    decisions_result = await db.execute(select(PriceDecision).order_by(desc(PriceDecision.created_at)).limit(200))
    decisions = decisions_result.scalars().all()

    runs_result = await db.execute(select(AgentRun).order_by(desc(AgentRun.started_at)).limit(10))
    runs = runs_result.scalars().all()

    total_revenue_impact = sum(
        (d.new_price - d.old_price) for d in decisions if d.applied
    )
    applied_changes = [d.price_change_pct for d in decisions if d.applied and d.price_change_pct is not None]

    return {
        "active_products": len(products),
        "total_decisions": len(decisions),
        "recent_runs": len([r for r in runs if r.status and r.status.value == "completed"]),
        "estimated_revenue_impact": round(total_revenue_impact, 2),
        "applied_changes": len(applied_changes),
        "avg_applied_change_pct": round(sum(applied_changes) / len(applied_changes), 1) if applied_changes else None,
        "avg_margin_pct": round(
            sum(((p.current_price - p.cost_price) / p.current_price * 100) for p in products) / max(len(products), 1),
            1
        ),
        "low_stock_products": sum(1 for p in products if p.inventory_count <= p.inventory_threshold),
        "last_run": _run_to_dict(runs[0]) if runs else None,
    }
