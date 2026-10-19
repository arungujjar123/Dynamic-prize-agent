"""
Dynamic Pricing Agent — TMLCStore (India)
- All prices in INR
- Competitors: Amazon.in + Flipkart
- Strategy-direction consistency enforced
- Per-phase Prometheus instrumentation
"""
import json
import uuid
import time
import os
from datetime import datetime
from typing import Optional
from loguru import logger
from openai import AsyncOpenAI

from backend.db.models import (
    Product, PriceDecision, DemandSignal,
    AgentRun, AgentStatus, PricingStrategy
)
from backend.db.session import get_db_context
from backend.scrapers.competitor import get_all_competitor_prices
from backend.metrics.prometheus import (
    record_agent_run_complete, record_phase,
    record_llm_call, record_llm_error,
    record_decision, record_guardrail,
    update_product_metrics, active_products_total,
    revenue_impact_usd,
)
from sqlalchemy import select
import random

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
MIN_MARGIN = float(os.getenv("MIN_MARGIN_PERCENT", 15)) / 100
MAX_VELOCITY = float(os.getenv("MAX_PRICE_CHANGE_VELOCITY", 20)) / 100

SYSTEM_PROMPT = f"""You are an expert dynamic pricing agent for TMLCStore, an Indian e-commerce store.
All prices are in Indian Rupees (INR ₹). Competitors are Amazon.in and Flipkart.

Analyze the product data and return a pricing decision.

STRATEGY SELECTION GUIDE:
- SURGE: demand_score > 0.7 AND inventory <= low_stock_threshold → raise price 5-15%
- COMPETITIVE: normal stock + competitor prices available → price 2-5% below lowest competitor
- DEMAND_BASED: demand_score 0.4-0.7, normal inventory → adjust by demand level
- CLEARANCE: inventory is very high (> 50 units in slow category) OR sell_through < 0.2 → lower 5-15%
- COST_PLUS: use ONLY as last resort fallback → cost × 1.40

MANDATORY DIRECTION RULES — never violate:
- SURGE strategy → recommended_price MUST be strictly GREATER than current_price
- CLEARANCE strategy → recommended_price MUST be strictly LESS than current_price
- COMPETITIVE strategy → recommended_price should be BELOW lowest competitor price
- DEMAND_BASED → can go either direction based on demand_score

HARD GUARDRAILS (non-negotiable):
- recommended_price >= margin_floor_price (cost × {1 + MIN_MARGIN:.2f})
- recommended_price >= min_price
- recommended_price <= max_price
- Change must be within ±{int(MAX_VELOCITY * 100)}% of current_price

Respond ONLY with valid JSON, no markdown, no extra text:
{{
  "recommended_price": <number in INR, rounded to nearest rupee>,
  "strategy": "<SURGE|COMPETITIVE|DEMAND_BASED|CLEARANCE|COST_PLUS>",
  "reasoning": "<1-2 sentences with specific INR numbers>",
  "confidence_score": <0.0-1.0>
}}"""


def _simulate_demand(product: Product) -> dict:
    """Simulate demand signals — replace with real analytics in production"""
    rng = random.Random(hash(product.id) + int(time.time() / 3600))
    base = rng.uniform(0.2, 0.9)
    return {
        "page_views": rng.randint(50, 1500),
        "cart_adds": rng.randint(2, 200),
        "purchases_last_24h": rng.randint(0, 30),
        "sell_through_rate": round(base, 2),
        "demand_score": round(base, 2),
    }


async def _apply_guardrails(product: Product, price: float) -> float:
    """Hard guardrail enforcement — records metric for each triggered rule"""
    # Floor: min_price
    if price < product.min_price:
        record_guardrail("price_floor")
        price = product.min_price

    # Floor: margin
    margin_floor = product.cost_price * (1 + MIN_MARGIN)
    if price < margin_floor:
        record_guardrail("min_margin")
        price = margin_floor

    # Ceiling: max_price
    if price > product.max_price:
        record_guardrail("price_ceiling")
        price = product.max_price

    # Velocity: max % change per run
    max_up = product.current_price * (1 + MAX_VELOCITY)
    max_down = product.current_price * (1 - MAX_VELOCITY)
    if price > max_up:
        record_guardrail("max_velocity")
        price = max_up
    if price < max_down:
        record_guardrail("max_velocity")
        price = max_down

    return round(price, 0)  # Round to nearest rupee


async def run_pricing_for_product(product: Product, agent_run_id: str):
    logger.info(f"🤖 {product.name} — current ₹{product.current_price:.0f}")

    # ── Phase 1: Scraping ──────────────────────────────────────────
    t0 = time.time()
    competitor_data = await get_all_competitor_prices(product.name, product.competitor_urls or [])
    record_phase("scraping", time.time() - t0)

    competitor_prices = [c["price"] for c in competitor_data if c.get("price")]
    lowest_competitor = min(competitor_prices) if competitor_prices else None
    avg_competitor = sum(competitor_prices) / len(competitor_prices) if competitor_prices else None

    # ── Phase 2: Demand signals ────────────────────────────────────
    demand = _simulate_demand(product)

    context = {
        "store": "TMLCStore (India)",
        "currency": "INR",
        "product": {
            "name": product.name,
            "category": product.category,
            "cost_price": product.cost_price,
            "current_price": product.current_price,
            "min_price": product.min_price,
            "max_price": product.max_price,
            "margin_floor_price": round(product.cost_price * (1 + MIN_MARGIN), 0),
            "inventory_count": product.inventory_count,
            "low_stock_threshold": product.inventory_threshold,
            "is_low_stock": product.inventory_count <= product.inventory_threshold,
        },
        "competitors": {
            "amazon_in": next((c["price"] for c in competitor_data if "amazon" in c.get("competitor_name", "")), None),
            "flipkart": next((c["price"] for c in competitor_data if "flipkart" in c.get("competitor_name", "")), None),
            "lowest_price": lowest_competitor,
            "avg_price": round(avg_competitor, 0) if avg_competitor else None,
        },
        "demand": demand,
    }

    # ── Phase 3: LLM Inference ─────────────────────────────────────
    t1 = time.time()
    status = "success"
    prompt_tokens = completion_tokens = 0
    result = None

    try:
        response = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(context, indent=2)},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,   # lower temp = more consistent strategy-direction alignment
            max_tokens=400,
        )
        result = json.loads(response.choices[0].message.content)
        if response.usage:
            prompt_tokens = response.usage.prompt_tokens
            completion_tokens = response.usage.completion_tokens

    except Exception as e:
        error_type = "rate_limit" if "rate" in str(e).lower() else \
                     "timeout" if "timeout" in str(e).lower() else "api_error"
        record_llm_error(error_type)
        status = "fallback"
        fallback_price = round(product.cost_price * 1.40, 0)
        result = {
            "recommended_price": fallback_price,
            "strategy": "COST_PLUS",
            "reasoning": f"LLM unavailable, cost-plus fallback: ₹{fallback_price:.0f}",
            "confidence_score": 0.3,
        }
        logger.warning(f"⚠️ LLM fallback for {product.name}: {e}")

    llm_duration = time.time() - t1
    record_phase("llm_inference", llm_duration)
    record_llm_call(MODEL, status, llm_duration, prompt_tokens, completion_tokens)

    # ── Phase 4: Strategy-direction consistency + Guardrails ───────
    t2 = time.time()
    raw_price = float(result.get("recommended_price", product.current_price))
    strategy_str = result.get("strategy", "COST_PLUS").upper()

    # Catch and correct strategy-direction mismatches
    if strategy_str == "SURGE" and raw_price <= product.current_price:
        logger.warning(f"⚠️  SURGE price not raised — auto-correcting +8%")
        raw_price = round(product.current_price * 1.08, 0)

    elif strategy_str == "CLEARANCE" and raw_price >= product.current_price:
        logger.warning(f"⚠️  CLEARANCE price not lowered — auto-correcting -8%")
        raw_price = round(product.current_price * 0.92, 0)

    elif strategy_str == "COMPETITIVE" and lowest_competitor and raw_price > lowest_competitor:
        logger.warning(f"⚠️  COMPETITIVE price above competitor — auto-correcting to -3%")
        raw_price = round(lowest_competitor * 0.97, 0)

    final_price = await _apply_guardrails(product, raw_price)
    record_phase("guardrails", time.time() - t2)

    price_change_pct = ((final_price - product.current_price) / product.current_price) * 100
    confidence = float(result.get("confidence_score", 0.5))

    strategy_map = {
        "SURGE": PricingStrategy.SURGE,
        "COMPETITIVE": PricingStrategy.COMPETITIVE,
        "DEMAND_BASED": PricingStrategy.DEMAND_BASED,
        "CLEARANCE": PricingStrategy.CLEARANCE,
        "COST_PLUS": PricingStrategy.COST_PLUS,
    }
    strategy = strategy_map.get(strategy_str, PricingStrategy.COST_PLUS)

    # ── Record metrics ─────────────────────────────────────────────
    record_decision(strategy.value, product.current_price, final_price, confidence)
    update_product_metrics(
        product.id, product.name, final_price, product.cost_price,
        product.inventory_count, demand["demand_score"], lowest_competitor
    )

    logger.success(
        f"✅ {product.name}: ₹{product.current_price:.0f} → ₹{final_price:.0f} "
        f"({price_change_pct:+.1f}%) [{strategy.value}] conf={confidence:.2f}"
    )

    decision = PriceDecision(
        product_id=product.id,
        old_price=product.current_price,
        new_price=final_price,
        price_change_pct=round(price_change_pct, 2),
        strategy=strategy,
        reasoning=result.get("reasoning", ""),
        confidence_score=confidence,
        agent_run_id=agent_run_id,
        applied=False,
    )
    return decision, prompt_tokens + completion_tokens


async def run_agent(triggered_by: str = "scheduler") -> AgentRun:
    run_id = str(uuid.uuid4())
    start_time = time.time()
    errors = []
    total_tokens = 0
    decisions_made = 0
    prices_updated = 0
    cumulative_impact = 0.0

    logger.info(f"🚀 TMLCStore agent run {run_id[:8]} — triggered_by={triggered_by}")

    async with get_db_context() as db:
        run = AgentRun(
            id=run_id, status=AgentStatus.RUNNING,
            triggered_by=triggered_by, started_at=datetime.utcnow(),
        )
        db.add(run)
        await db.flush()

        result = await db.execute(select(Product).where(Product.is_active == True))
        products = result.scalars().all()
        active_products_total.set(len(products))

        for product in products:
            try:
                decision, tokens = await run_pricing_for_product(product, run_id)

                # Save demand signal
                db.add(DemandSignal(
                    product_id=product.id,
                    **_simulate_demand(product),
                    recorded_at=datetime.utcnow(),
                ))

                # ── Phase 5: DB write ──────────────────────────────
                t3 = time.time()
                if abs(decision.price_change_pct or 0) > 0.1:
                    cumulative_impact += (decision.new_price - decision.old_price)
                    product.current_price = decision.new_price
                    product.updated_at = datetime.utcnow()
                    decision.applied = True
                    prices_updated += 1
                db.add(decision)
                record_phase("db_write", time.time() - t3)

                decisions_made += 1
                total_tokens += tokens

            except Exception as e:
                logger.error(f"❌ {product.name}: {e}")
                errors.append({"product_id": product.id, "error": str(e)})

        duration = time.time() - start_time
        status = "completed" if not errors else "partial"

        run.status = AgentStatus.COMPLETED if status == "completed" else AgentStatus.FAILED
        run.products_processed = len(products)
        run.decisions_made = decisions_made
        run.prices_updated = prices_updated
        run.errors = errors
        run.total_tokens_used = total_tokens
        run.duration_seconds = round(duration, 2)
        run.completed_at = datetime.utcnow()
        await db.flush()

    revenue_impact_usd.set(round(cumulative_impact, 2))
    record_agent_run_complete(status, triggered_by, duration)

    logger.success(
        f"🎉 Run done: {len(products)} products, {decisions_made} decisions, "
        f"{prices_updated} updated, {len(errors)} errors, {duration:.1f}s, {total_tokens} tokens"
    )
    return run