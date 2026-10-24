from backend.agents.guardrails import apply_guardrails, enforce_strategy_direction

DEFAULTS = dict(current_price=1000, cost_price=800, min_price=900, max_price=1500,
                min_margin=0.15, max_velocity=0.20)


def clamp(price, **overrides):
    hits = []
    result = apply_guardrails(price, **{**DEFAULTS, **overrides}, on_trigger=hits.append)
    return result, hits


def test_price_within_limits_is_untouched():
    assert clamp(1050) == (1050, [])


def test_velocity_caps_increase():
    assert clamp(1400) == (1200, ["max_velocity"])


def test_velocity_never_breaks_margin_floor():
    # Old bug: velocity ran last and could pull the price below the hard floors.
    # margin floor = 800 * 1.15 = 920; current 1000 → velocity floor 800
    price, hits = clamp(500)
    assert price == 920
    assert hits == ["max_velocity", "price_floor", "min_margin"]


def test_floors_win_when_current_price_is_already_too_low():
    # current price below margin floor: velocity alone would keep it too low
    price, _ = clamp(600, current_price=700)
    assert price >= 800 * 1.15


def test_ceiling_applied():
    price, hits = clamp(1190, current_price=1400, max_price=1100)
    assert price == 1100
    assert hits == ["price_ceiling"]


def test_rounds_to_nearest_rupee():
    assert clamp(1049.6)[0] == 1050


def test_surge_must_raise_price():
    price, msg = enforce_strategy_direction("SURGE", 990, 1000, None)
    assert price == 1080 and msg


def test_clearance_must_lower_price():
    price, msg = enforce_strategy_direction("CLEARANCE", 1000, 1000, None)
    assert price == 920 and msg


def test_competitive_goes_below_lowest_competitor():
    price, msg = enforce_strategy_direction("COMPETITIVE", 1100, 1000, 1050)
    assert price == round(1050 * 0.97) and msg


def test_consistent_decision_is_unchanged():
    assert enforce_strategy_direction("DEMAND_BASED", 1100, 1000, 900) == (1100, None)
    assert enforce_strategy_direction("SURGE", 1100, 1000, None) == (1100, None)
