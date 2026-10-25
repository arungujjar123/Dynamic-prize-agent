"""
Pricing guardrails — pure functions, no I/O, so they can be unit tested.

Order matters:
  1. Velocity limit (soft) — max ±X% change per run
  2. Price ceiling (max_price)
  3. Hard floors (min_price, cost × (1 + min_margin)) — applied LAST so
     nothing can ever push the final price below them.
"""
from typing import Callable, Optional


def apply_guardrails(
    price: float,
    current_price: float,
    cost_price: float,
    min_price: float,
    max_price: float,
    min_margin: float,
    max_velocity: float,
    on_trigger: Optional[Callable[[str], None]] = None,
) -> float:
    """Clamp a recommended price to all guardrails. Returns price rounded to nearest rupee."""
    def hit(rule: str):
        if on_trigger:
            on_trigger(rule)

    # 1. Velocity: max % change per run
    # rounded to whole rupees so a price a few paise past the cap (e.g. ₹362 vs
    # ₹362.40) doesn't count as "capped" and then round back to the same price
    max_up = round(current_price * (1 + max_velocity))
    max_down = round(current_price * (1 - max_velocity))
    if price > max_up:
        hit("max_velocity")
        price = max_up
    elif price < max_down:
        hit("max_velocity")
        price = max_down

    # 2. Ceiling: max_price
    if price > max_price:
        hit("price_ceiling")
        price = max_price

    # 3. Hard floors — never sell below min_price or the margin floor
    if price < min_price:
        hit("price_floor")
        price = min_price

    margin_floor = cost_price * (1 + min_margin)
    if price < margin_floor:
        hit("min_margin")
        price = margin_floor

    return round(price, 0)


def enforce_strategy_direction(
    strategy: str,
    price: float,
    current_price: float,
    lowest_competitor: Optional[float],
) -> tuple[float, Optional[str]]:
    """
    Correct LLM outputs whose price contradicts the chosen strategy.
    Returns (price, correction_message or None).
    """
    if strategy == "SURGE" and price <= current_price:
        return round(current_price * 1.08, 0), "SURGE must raise the price → set to +8%"

    if strategy == "CLEARANCE" and price >= current_price:
        return round(current_price * 0.92, 0), "CLEARANCE must lower the price → set to −8%"

    if strategy == "COMPETITIVE" and lowest_competitor and price > lowest_competitor:
        return round(lowest_competitor * 0.97, 0), (
            f"COMPETITIVE must undercut the lowest competitor (₹{lowest_competitor:,.0f}) → set 3% below"
        )

    return price, None


def describe_guardrail(
    rule: str,
    current_price: float,
    cost_price: float,
    min_price: float,
    max_price: float,
    min_margin: float,
    max_velocity: float,
) -> str:
    """Human-readable explanation of a triggered guardrail, shown next to the decision."""
    if rule == "max_velocity":
        return f"Capped at ±{max_velocity * 100:.0f}% change per run"
    if rule == "price_ceiling":
        return f"Capped at max price ₹{max_price:,.0f}"
    if rule == "price_floor":
        return f"Raised to min price ₹{min_price:,.0f}"
    if rule == "min_margin":
        return f"Raised to margin floor ₹{cost_price * (1 + min_margin):,.0f}"
    return rule
