"""
AI Agent Observability Metrics — 4 Pillars
1. Agent Health
2. LLM Economics
3. Decision Quality
4. Business Impact
"""
import time
from prometheus_client import (
    Counter, Histogram, Gauge,
    CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST
)

registry = CollectorRegistry(auto_describe=True)

# ══════════════════════════════════════════════════════════════
# PILLAR 1: AGENT HEALTH
# ══════════════════════════════════════════════════════════════

agent_runs_total = Counter(
    "pricing_agent_runs_total",
    "Total agent runs",
    ["status", "triggered_by"],
    registry=registry,
)

agent_last_successful_run_timestamp = Gauge(
    "pricing_agent_last_successful_run_timestamp",
    "Unix timestamp of last successful run — used for stale alert",
    registry=registry,
)

agent_last_run_age_seconds = Gauge(
    "pricing_agent_last_run_age_seconds",
    "Seconds since last successful run",
    registry=registry,
)

agent_consecutive_failures = Gauge(
    "pricing_agent_consecutive_failures_total",
    "Number of consecutive failed runs — resets on success",
    registry=registry,
)

agent_run_duration_seconds = Histogram(
    "pricing_agent_run_duration_seconds",
    "Total agent run duration",
    buckets=[5, 10, 30, 60, 120, 300],
    registry=registry,
)

# Per-phase breakdown — the key demo metric
agent_phase_duration_seconds = Histogram(
    "pricing_agent_phase_duration_seconds",
    "Duration of each agent phase: scraping | llm_inference | guardrails | db_write",
    ["phase"],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30],
    registry=registry,
)

# ══════════════════════════════════════════════════════════════
# PILLAR 2: LLM ECONOMICS
# ══════════════════════════════════════════════════════════════

llm_requests_total = Counter(
    "pricing_llm_requests_total",
    "Total LLM API calls",
    ["model", "status"],  # status: success | error | fallback
    registry=registry,
)

llm_request_duration_seconds = Histogram(
    "pricing_llm_request_duration_seconds",
    "LLM API call latency",
    ["model"],
    buckets=[0.5, 1, 2, 3, 5, 8, 15, 30],
    registry=registry,
)

llm_tokens_total = Counter(
    "pricing_llm_tokens_total",
    "Total tokens used",
    ["model", "type"],  # type: prompt | completion
    registry=registry,
)

llm_cost_usd_total = Counter(
    "pricing_llm_cost_usd_total",
    "Estimated USD cost of LLM calls",
    ["model"],
    registry=registry,
)

llm_errors_total = Counter(
    "pricing_llm_errors_total",
    "LLM API errors by type",
    ["error_type"],  # rate_limit | timeout | invalid_response | api_error
    registry=registry,
)

llm_fallback_total = Counter(
    "pricing_llm_fallback_total",
    "Times agent fell back to cost-plus due to LLM failure",
    registry=registry,
)

# ══════════════════════════════════════════════════════════════
# PILLAR 3: DECISION QUALITY
# ══════════════════════════════════════════════════════════════

decision_confidence_histogram = Histogram(
    "pricing_decision_confidence",
    "Distribution of agent confidence scores",
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    registry=registry,
)

decision_strategy_total = Counter(
    "pricing_decision_strategy_total",
    "Decisions made per strategy and direction",
    ["strategy", "direction"],  # direction: increase | decrease | hold
    registry=registry,
)

price_change_magnitude = Histogram(
    "pricing_price_change_magnitude_percent",
    "Absolute magnitude of price changes",
    buckets=[0, 1, 2, 5, 10, 15, 20, 30, 40],
    registry=registry,
)

guardrail_triggers_total = Counter(
    "pricing_guardrail_triggers_total",
    "How often each guardrail rule fires",
    ["rule"],  # min_margin | max_velocity | price_floor | price_ceiling
    registry=registry,
)

scraper_requests_total = Counter(
    "pricing_scraper_requests_total",
    "Competitor scrape attempts",
    ["source", "status"],  # source: scraped|simulated
    registry=registry,
)

scraper_duration_seconds = Histogram(
    "pricing_scraper_duration_seconds",
    "Scraper request duration",
    ["source"],
    buckets=[0.5, 1, 2, 5, 10, 20],
    registry=registry,
)

# ══════════════════════════════════════════════════════════════
# PILLAR 4: BUSINESS IMPACT
# ══════════════════════════════════════════════════════════════

product_current_price = Gauge(
    "pricing_product_current_price_inr",
    "Current price per product (INR)",
    ["product_id", "product_name"],
    registry=registry,
)

product_margin_percent = Gauge(
    "pricing_product_margin_percent",
    "Current gross margin % per product",
    ["product_id", "product_name"],
    registry=registry,
)

product_inventory_level = Gauge(
    "pricing_product_inventory_level",
    "Current inventory count",
    ["product_id", "product_name"],
    registry=registry,
)

product_demand_score = Gauge(
    "pricing_product_demand_score",
    "Demand score 0-1 per product",
    ["product_id"],
    registry=registry,
)

competitor_price_gap_percent = Gauge(
    "pricing_competitor_price_gap_percent",
    "% gap vs lowest competitor (positive = we are higher)",
    ["product_id"],
    registry=registry,
)

revenue_impact_inr = Gauge(
    "pricing_estimated_revenue_impact_inr",
    "Estimated cumulative revenue impact (INR) from all price changes",
    registry=registry,
)

active_products_total = Gauge(
    "pricing_active_products_total",
    "Number of active products being monitored",
    registry=registry,
)


# ══════════════════════════════════════════════════════════════
# HELPER FUNCTIONS — called from pricing_agent.py
# ══════════════════════════════════════════════════════════════

_TOKEN_COST = {"prompt": 0.000005, "completion": 0.000015}  # GPT-4o per token
_consecutive_failures = 0


def record_agent_run_complete(status: str, triggered_by: str, duration: float):
    global _consecutive_failures
    agent_runs_total.labels(status=status, triggered_by=triggered_by).inc()
    agent_run_duration_seconds.observe(duration)
    if status == "completed":
        _consecutive_failures = 0
        ts = time.time()
        agent_last_successful_run_timestamp.set(ts)
        agent_last_run_age_seconds.set(0)
        agent_consecutive_failures.set(0)
    else:
        _consecutive_failures += 1
        agent_consecutive_failures.set(_consecutive_failures)


def tick_run_age():
    """Call on a background tick to keep age gauge current"""
    last = agent_last_successful_run_timestamp._value.get()
    if last:
        agent_last_run_age_seconds.set(time.time() - last)


def record_phase(phase: str, duration: float):
    agent_phase_duration_seconds.labels(phase=phase).observe(duration)


def record_llm_call(model: str, status: str, duration: float,
                    prompt_tokens: int, completion_tokens: int):
    llm_requests_total.labels(model=model, status=status).inc()
    llm_request_duration_seconds.labels(model=model).observe(duration)
    llm_tokens_total.labels(model=model, type="prompt").inc(prompt_tokens)
    llm_tokens_total.labels(model=model, type="completion").inc(completion_tokens)
    cost = (prompt_tokens * _TOKEN_COST["prompt"]) + (completion_tokens * _TOKEN_COST["completion"])
    llm_cost_usd_total.labels(model=model).inc(cost)
    if status == "fallback":
        llm_fallback_total.inc()


def record_llm_error(error_type: str):
    llm_errors_total.labels(error_type=error_type).inc()


def record_decision(strategy: str, old_price: float, new_price: float, confidence: float):
    change_pct = ((new_price - old_price) / old_price) * 100
    direction = "increase" if change_pct > 0.5 else "decrease" if change_pct < -0.5 else "hold"
    decision_strategy_total.labels(strategy=strategy, direction=direction).inc()
    decision_confidence_histogram.observe(confidence)
    price_change_magnitude.observe(abs(change_pct))


def record_guardrail(rule: str):
    guardrail_triggers_total.labels(rule=rule).inc()


def update_product_metrics(product_id: str, name: str, price: float,
                           cost: float, inventory: int, demand: float,
                           competitor_low: float = None):
    margin = ((price - cost) / price * 100) if price else 0
    product_current_price.labels(product_id=product_id, product_name=name).set(price)
    product_margin_percent.labels(product_id=product_id, product_name=name).set(round(margin, 1))
    product_inventory_level.labels(product_id=product_id, product_name=name).set(inventory)
    product_demand_score.labels(product_id=product_id).set(demand)
    if competitor_low and competitor_low > 0:
        gap = ((price - competitor_low) / competitor_low) * 100
        competitor_price_gap_percent.labels(product_id=product_id).set(round(gap, 1))


def get_metrics_output() -> tuple[bytes, str]:
    return generate_latest(registry), CONTENT_TYPE_LATEST
