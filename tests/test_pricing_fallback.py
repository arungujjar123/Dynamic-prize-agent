from types import SimpleNamespace

import backend.agents.pricing_agent as agent


async def test_llm_failure_holds_current_price(monkeypatch):
    async def fake_competitors(name, urls):
        return [{"competitor_name": "amazon.in", "price": 1400.0}]

    class BrokenClient:
        class chat:
            class completions:
                @staticmethod
                async def create(**kwargs):
                    raise RuntimeError("api down")

    monkeypatch.setattr(agent, "get_all_competitor_prices", fake_competitors)
    monkeypatch.setattr(agent, "_get_client", lambda: BrokenClient)

    product = SimpleNamespace(
        id="p1", name="Test Headphones", category="Electronics",
        cost_price=800.0, current_price=1499.0, min_price=999.0, max_price=2199.0,
        inventory_count=40, inventory_threshold=10, competitor_urls=[],
    )
    decision, tokens = await agent.run_pricing_for_product(product, "run-1")

    assert decision.new_price == 1499.0
    assert decision.price_change_pct == 0
    assert tokens == 0


async def test_corrections_are_recorded_on_the_decision(monkeypatch):
    import json

    async def fake_competitors(name, urls):
        return [{"competitor_name": "amazon.in", "price": 1240.0, "source": "simulated"}]

    class InconsistentLLM:
        """Says COMPETITIVE but prices above the lowest competitor"""
        class chat:
            class completions:
                @staticmethod
                async def create(**kwargs):
                    body = {"recommended_price": 1740, "strategy": "COMPETITIVE",
                            "reasoning": "priced slightly above the lowest competitor",
                            "confidence_score": 0.95}
                    message = SimpleNamespace(content=json.dumps(body))
                    usage = SimpleNamespace(prompt_tokens=100, completion_tokens=20)
                    return SimpleNamespace(choices=[SimpleNamespace(message=message)], usage=usage)

    monkeypatch.setattr(agent, "get_all_competitor_prices", fake_competitors)
    monkeypatch.setattr(agent, "_get_client", lambda: InconsistentLLM)

    product = SimpleNamespace(
        id="p2", name="Crompton Fan", category="Home",
        cost_price=2200.0, current_price=3999.0, min_price=2699.0, max_price=5499.0,
        inventory_count=18, inventory_threshold=8, competitor_urls=[],
    )
    decision, tokens = await agent.run_pricing_for_product(product, "run-2")

    assert decision.llm_price == 1740
    assert decision.new_price == 3199  # 3% below ₹1,240 = ₹1,203, then capped at −20%
    assert decision.adjustments == [
        "COMPETITIVE must undercut the lowest competitor (₹1,240) → set 3% below",
        "Capped at ±20% change per run",
    ]
    assert tokens == 120


async def test_fallback_has_no_llm_price(monkeypatch):
    async def fake_competitors(name, urls):
        return []

    class BrokenClient:
        class chat:
            class completions:
                @staticmethod
                async def create(**kwargs):
                    raise RuntimeError("down")

    monkeypatch.setattr(agent, "get_all_competitor_prices", fake_competitors)
    monkeypatch.setattr(agent, "_get_client", lambda: BrokenClient)
    product = SimpleNamespace(
        id="p3", name="X", category="Y", cost_price=100.0, current_price=200.0,
        min_price=150.0, max_price=300.0, inventory_count=5, inventory_threshold=2, competitor_urls=[],
    )
    decision, _ = await agent.run_pricing_for_product(product, "run-3")
    assert decision.llm_price is None
    assert decision.adjustments == []
