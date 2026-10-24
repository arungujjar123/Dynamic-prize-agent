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
