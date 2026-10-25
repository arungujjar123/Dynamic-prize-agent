from types import SimpleNamespace

import backend.agents.pricing_agent as agent


async def test_llm_failure_holds_current_price(monkeypatch):
    async def fake_competitors(name, urls, product_id=None):
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

    async def fake_competitors(name, urls, product_id=None):
        return [{"competitor_name": "amazon.in", "price": 1240.0, "source": "scraped"}]

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
        id="p2", name="boAt Headphones", category="Electronics",
        cost_price=800.0, current_price=1499.0, min_price=999.0, max_price=2199.0,
        inventory_count=42, inventory_threshold=10, competitor_urls=[],
    )
    decision, tokens = await agent.run_pricing_for_product(product, "run-2")

    assert decision.llm_price == 1740
    assert decision.new_price == 1203  # 3% below ₹1,240, above the ₹999 floor
    assert decision.adjustments == [
        "COMPETITIVE must undercut the lowest competitor (₹1,240) → set 3% below",
    ]
    assert tokens == 120


async def test_fallback_has_no_llm_price(monkeypatch):
    async def fake_competitors(name, urls, product_id=None):
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


def _llm_returning(body):
    import json

    class FakeLLM:
        class chat:
            class completions:
                @staticmethod
                async def create(**kwargs):
                    FakeLLM.last_context = json.loads(kwargs["messages"][1]["content"])
                    message = SimpleNamespace(content=json.dumps(body))
                    usage = SimpleNamespace(prompt_tokens=10, completion_tokens=5)
                    return SimpleNamespace(choices=[SimpleNamespace(message=message)], usage=usage)
    return FakeLLM


async def test_simulated_competitor_data_limits_changes(monkeypatch):
    async def simulated(name, urls, product_id=None):
        return [{"competitor_name": "amazon.in", "price": 1240.0, "source": "simulated"}]

    llm = _llm_returning({"recommended_price": 2500, "strategy": "COMPETITIVE",
                          "reasoning": "match competitor", "confidence_score": 0.5})
    monkeypatch.setattr(agent, "get_all_competitor_prices", simulated)
    monkeypatch.setattr(agent, "_get_client", lambda: llm)

    product = SimpleNamespace(
        id="p4", name="Crompton Fan", category="Home",
        cost_price=2200.0, current_price=3999.0, min_price=2699.0, max_price=5499.0,
        inventory_count=18, inventory_threshold=8, competitor_urls=[],
    )
    decision, _ = await agent.run_pricing_for_product(product, "run-4")

    # no "undercut simulated competitor" correction; cap tightened to ±5%
    assert decision.new_price == 3799
    assert decision.adjustments == ["Capped at ±5% change per run (no live competitor price)"]
    assert llm.last_context["product"]["max_change_pct_this_run"] == 5
    assert llm.last_context["competitors"]["data_source"] == "simulated"
    assert decision.competitor_data == [{"name": "amazon.in", "price": 1240.0, "source": "simulated"}]
