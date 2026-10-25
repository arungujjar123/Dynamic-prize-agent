"""
Dynamic Pricing Agent — FastAPI Main Application
Includes: REST API, Background Scheduler, Prometheus metrics endpoint
"""
import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime

import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

from backend.db.session import init_db, seed_demo_products, reset_demo_data_once
from backend.routers.api import products_router, decisions_router, agent_router, analytics_router
from backend.metrics.prometheus import get_metrics_output, active_products_total

PRICING_INTERVAL = int(os.getenv("PRICING_AGENT_INTERVAL_MINUTES", 60))
scheduler = AsyncIOScheduler()


async def scheduled_agent_run():
    """Called by APScheduler every N minutes"""
    logger.info(f"⏰ Scheduled agent run triggered at {datetime.utcnow().isoformat()}")
    try:
        from backend.agents.pricing_agent import run_agent
        await run_agent(triggered_by="scheduler")
    except Exception as e:
        logger.error(f"❌ Scheduled run failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("🚀 Starting Dynamic Pricing Agent...")

    # Initialize DB
    await init_db()
    if os.getenv("RESET_DEMO_DATA_ID"):
        await reset_demo_data_once(os.environ["RESET_DEMO_DATA_ID"])
    await seed_demo_products()

    # Update active products gauge
    from backend.db.session import AsyncSessionLocal
    from backend.db.models import Product
    from sqlalchemy import select, func
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(func.count()).where(Product.is_active == True))
        count = result.scalar()
        active_products_total.set(count or 0)

    # Start scheduler
    scheduler.add_job(
        scheduled_agent_run,
        trigger=IntervalTrigger(minutes=PRICING_INTERVAL),
        id="pricing_agent",
        name="Dynamic Pricing Agent",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info(f"⏰ Scheduler started — pricing every {PRICING_INTERVAL} minutes")

    yield  # App is running

    # Shutdown
    scheduler.shutdown(wait=False)
    logger.info("👋 Shutting down Dynamic Pricing Agent")


app = FastAPI(
    title="Dynamic Pricing Agent API",
    description="AI-powered e-commerce dynamic pricing engine using OpenAI",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — credentials are never combined with a wildcard origin
allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials="*" not in allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(products_router, prefix="/api/v1")
app.include_router(decisions_router, prefix="/api/v1")
app.include_router(agent_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "service": "Dynamic Pricing Agent",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "metrics": "/metrics",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "scheduler_running": scheduler.running,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    data, content_type = get_metrics_output()
    return Response(content=data, media_type=content_type)


@app.get("/api/v1/scheduler/status")
async def scheduler_status():
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
        })
    return {"running": scheduler.running, "jobs": jobs}


if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )