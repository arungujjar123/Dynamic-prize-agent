# ⚡ TMLCStore — Dynamic Pricing Agent

AI-powered dynamic pricing engine for an Indian e-commerce store. The agent monitors **Amazon.in** and **Flipkart** competitor prices, analyzes demand signals and inventory, and uses **OpenAI GPT-4o** to recommend optimal prices in **INR** — automatically, on a schedule.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DYNAMIC PRICING AGENT                        │
├──────────────┬───────────────┬──────────────┬───────────────────────┤
│  Streamlit   │   FastAPI     │  OpenAI      │  Prometheus + Grafana │
│  Dashboard   │   Backend     │  GPT-4o      │  Observability        │
│  :8501       │   :8000       │  Agent Brain │  :9090 / :3001        │
├──────────────┴───────────────┴──────────────┴───────────────────────┤
│                        PostgreSQL  :5432                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Execution Flow
```
APScheduler (every 60 min) / Manual Trigger
        │
        ▼
  For each active product:
        │
        ├─► Phase 1: Scrape Amazon.in + Flipkart (or simulate if blocked)
        ├─► Phase 2: Compute demand signals (page views, cart adds, sell-through)
        ├─► Phase 3: OpenAI GPT-4o reasons over all signals → price + strategy
        ├─► Phase 4: Strategy-direction check + Guardrails enforcement
        └─► Phase 5: Save to PostgreSQL + emit Prometheus metrics
```

---

## 📁 Project Structure

```
dynamic-pricing-agent/
├── backend/
│   ├── main.py                    # FastAPI app + APScheduler
│   ├── agents/
│   │   └── pricing_agent.py       # OpenAI agent brain (INR, TMLCStore)
│   ├── scrapers/
│   │   └── competitor.py          # Amazon.in + Flipkart scraper
│   ├── db/
│   │   ├── models.py              # SQLAlchemy models
│   │   └── session.py             # DB session + Indian product seeds
│   ├── routers/
│   │   └── api.py                 # REST API endpoints
│   └── metrics/
│       └── prometheus.py          # 4-pillar observability metrics
├── frontend/
│   └── app.py                     # Streamlit dashboard
├── monitoring/
│   ├── prometheus.yml             # Prometheus scrape config
│   ├── alerts.yml                 # 7 Prometheus alert rules
│   ├── grafana-dashboard.json     # Pre-built 4-row Grafana dashboard
│   ├── grafana-datasources.yml    # Grafana auto-provisioning
│   └── grafana-dashboards.yml     # Grafana auto-provisioning
├── docker/
│   ├── Dockerfile.backend
│   └── Dockerfile.frontend
├── docker-compose.yml
├── requirements.txt
├── .env.example
├── reset_products.py              # Reseed Indian products (run once)
├── clear_db.py                    # Wipe all DB rows
└── demo_load.py                   # Load generator for session demos
```

---

## 🛍️ Products (TMLCStore — INR)

| Product | SKU | Cost | Current Price | Competitors |
|---|---|---|---|---|
| boAt Rockerz 450 Headphones | TMLC-BOAT-450 | ₹800 | ₹1,499 | Amazon.in, Flipkart |
| Noise ColorFit Pro 4 Smartwatch | TMLC-NOISE-CFP4 | ₹1,200 | ₹2,499 | Amazon.in, Flipkart |
| Prestige Iris 750W Mixer Grinder | TMLC-PRESTIGE-IRIS | ₹1,800 | ₹3,299 | Amazon.in, Flipkart |
| Wildcraft Laptop Backpack 30L | TMLC-WC-BP30 | ₹600 | ₹1,299 | Amazon.in, Flipkart |
| Mamaearth Vitamin C Face Serum | TMLC-ME-VCS30 | ₹180 | ₹499 | Amazon.in, Flipkart |
| Crompton Aura Prime Ceiling Fan | TMLC-CROMP-AURA | ₹2,200 | ₹3,999 | Amazon.in, Flipkart |

---

## 🤖 Pricing Strategies

| Strategy | When Applied | Direction |
|---|---|---|
| `SURGE` | demand_score > 0.7 **AND** inventory ≤ threshold | ▲ Price goes UP 5–15% |
| `COMPETITIVE` | Normal stock, competitor prices available | ▼ 2–5% below lowest competitor |
| `DEMAND_BASED` | demand_score 0.4–0.7, normal inventory | ↕ Tracks demand level |
| `CLEARANCE` | Excess inventory or low sell-through | ▼ Price goes DOWN 5–15% |
| `COST_PLUS` | LLM fallback only | = Cost × 1.40 |

> Strategy-direction consistency is **enforced in code** — if the LLM says SURGE but returns a lower price, the agent auto-corrects to +8%.

---

## ⚙️ Configuration (`.env`)

Copy `.env.example` to `.env` and fill in your values:

```env
# Required
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o

# Database (change host to 'postgres' when using Docker)
DATABASE_URL=postgresql+asyncpg://pricing_user:pricing_pass@localhost:5432/pricing_db
SYNC_DATABASE_URL=postgresql://pricing_user:pricing_pass@localhost:5432/pricing_db

# Pricing guardrails
MIN_MARGIN_PERCENT=15           # Never price below this margin
MAX_PRICE_CHANGE_VELOCITY=20    # Max % change per agent run
PRICING_AGENT_INTERVAL_MINUTES=60  # How often scheduler runs
```

---

## 🐳 Option A — Docker Setup (Recommended)

All 5 services start with a single command. No local Python or PostgreSQL needed.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Steps

**1. Go to Directory**
```bash
cd dynamic-pricing-agent

cp .env.example .env
# Open .env and set your OPENAI_API_KEY
```

**2. Start all services**
```bash
docker compose up -d
```

Wait ~30 seconds for all services to become healthy. Check status:
```bash
docker compose ps
```

**3. Seed Indian products**
```bash
docker compose exec backend python reset_products.py
```

**4. Access the services**

| Service | URL | Credentials |
|---|---|---|
| Streamlit Dashboard | http://localhost:8501 | — |
| FastAPI Docs (Swagger) | http://localhost:8000/docs | — |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3001 | admin / admin |

**5. Run the pricing agent**

Option A — via Streamlit: click **"▶ Run Agent Now"** in the sidebar

Option B — via API:
```bash
curl -X POST http://localhost:8000/api/v1/agent/run \
  -H "Content-Type: application/json" \
  -d '{"triggered_by": "manual"}'
```

**6. (Optional) Generate demo data for a session**
```bash
docker compose exec backend python demo_load.py 10
```

### Docker useful commands
```bash
# View logs
docker compose logs -f backend

# Restart just the backend
docker compose restart backend

# Stop everything
docker compose down

# Stop and wipe all volumes (full reset)
docker compose down -v
```

---

## 💻 Option B — Local Setup (Windows / Mac / Linux)

### Prerequisites
- Python 3.12+
- PostgreSQL 14+ installed and running
- OpenAI API key

### Steps

**1. Clone and create virtual environment**
```bash
git clone <your-repo-url>
cd dynamic-pricing-agent

python -m venv venv

# Windows
venv\Scripts\activate

# Mac / Linux
source venv/bin/activate
```

**2. Install dependencies**
```bash
pip install -r requirements.txt
```

**3. Create PostgreSQL database**
```bash
# Connect to PostgreSQL
psql -U postgres

# Run these commands inside psql:
CREATE DATABASE pricing_db;
CREATE USER pricing_user WITH PASSWORD 'pricing_pass';
GRANT ALL PRIVILEGES ON DATABASE pricing_db TO pricing_user;
\q
```

**4. Configure environment**
```bash
cp .env.example .env
```

Open `.env` and set:
```env
OPENAI_API_KEY=sk-your-key-here

# For local setup, keep localhost:
DATABASE_URL=postgresql+asyncpg://pricing_user:pricing_pass@localhost:5432/pricing_db
SYNC_DATABASE_URL=postgresql://pricing_user:pricing_pass@localhost:5432/pricing_db
```

**5. Set Python path**
```bash
# Windows
set PYTHONPATH=.

# Mac / Linux
export PYTHONPATH=.
```

**6. Seed the database with Indian products**
```bash
python reset_products.py
```

Expected output:
```
✅ Database tables initialized
🗑️  Cleared all old products and decisions
✅ TMLCStore Indian products seeded — 6 products, INR pricing, Amazon.in + Flipkart competitors
```

**7. Start the FastAPI backend**
```bash
# Terminal 1
uvicorn backend.main:app --reload --port 8000
```

You should see:
```
✅ Database tables initialized
✅ TMLCStore Indian products seeded
⏰ Scheduler started — pricing every 60 minutes
INFO: Uvicorn running on http://0.0.0.0:8000
```

**8. Start the Streamlit dashboard**
```bash
# Terminal 2
streamlit run frontend/app.py
```

Dashboard opens at http://localhost:8501

**9. Run the pricing agent manually**

Via Streamlit: click **"▶ Run Agent Now"** in the left sidebar

Via terminal:
```bash
curl -X POST http://localhost:8000/api/v1/agent/run \
  -H "Content-Type: application/json" \
  -d '{"triggered_by": "manual"}'
```

**10. Start Prometheus + Grafana (optional but recommended)**

Install and run Prometheus:
```bash
# Mac
brew install prometheus
prometheus --config.file=monitoring/prometheus.yml

# Ubuntu
sudo apt install prometheus
sudo cp monitoring/prometheus.yml /etc/prometheus/prometheus.yml
sudo systemctl restart prometheus
```

Install and run Grafana:
```bash
# Mac
brew install grafana
brew services start grafana

# Ubuntu
sudo apt install grafana
sudo systemctl start grafana-server
```

Then open Grafana at http://localhost:3000 (admin / admin), add Prometheus as a datasource (`http://localhost:9090`), and import `monitoring/grafana-dashboard.json`.

---

## 🗄️ Database Management

### Clear all rows (keep tables)
```bash
python clear_db.py
```

### Reseed with Indian products (clears first, then seeds)
```bash
python reset_products.py
```

### Generate demo data (for sessions / testing)
```bash
python demo_load.py       # 8 runs (default)
python demo_load.py 15    # 15 runs
```

---

## 📊 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/products/` | List all products |
| `POST` | `/api/v1/products/` | Add a product |
| `PATCH` | `/api/v1/products/{id}` | Update product |
| `GET` | `/api/v1/products/{id}/price-history` | Price history |
| `GET` | `/api/v1/decisions/` | All pricing decisions |
| `GET` | `/api/v1/decisions/stats` | Aggregated stats |
| `POST` | `/api/v1/agent/run` | Trigger agent manually |
| `GET` | `/api/v1/agent/runs` | Agent run history |
| `GET` | `/api/v1/agent/status` | Is agent running? |
| `GET` | `/api/v1/analytics/dashboard` | KPI summary |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Swagger UI |

---

## 📈 Prometheus Metrics (4 Pillars)

### Pillar 1 — Agent Health
| Metric | Type | Description |
|---|---|---|
| `pricing_agent_runs_total` | Counter | Total runs by status + trigger |
| `pricing_agent_last_run_age_seconds` | Gauge | Seconds since last successful run |
| `pricing_agent_consecutive_failures_total` | Gauge | Consecutive failures (resets on success) |
| `pricing_agent_run_duration_seconds` | Histogram | Total run duration |
| `pricing_agent_phase_duration_seconds` | Histogram | Per-phase: scraping / llm_inference / guardrails / db_write |

### Pillar 2 — LLM Economics
| Metric | Type | Description |
|---|---|---|
| `pricing_llm_requests_total` | Counter | LLM API calls by model + status |
| `pricing_llm_request_duration_seconds` | Histogram | LLM latency |
| `pricing_llm_tokens_total` | Counter | Tokens by type: prompt / completion |
| `pricing_llm_cost_usd_total` | Counter | Estimated USD cost |
| `pricing_llm_errors_total` | Counter | Errors by type: rate_limit / timeout / api_error |
| `pricing_llm_fallback_total` | Counter | Times fell back to cost-plus |

### Pillar 3 — Decision Quality
| Metric | Type | Description |
|---|---|---|
| `pricing_decision_confidence` | Histogram | Confidence score distribution |
| `pricing_decision_strategy_total` | Counter | Decisions by strategy + direction |
| `pricing_price_change_magnitude_percent` | Histogram | Absolute % change distribution |
| `pricing_guardrail_triggers_total` | Counter | Guardrail fires by rule |
| `pricing_scraper_requests_total` | Counter | Scrape attempts by source + status |

### Pillar 4 — Business Impact
| Metric | Type | Description |
|---|---|---|
| `pricing_product_current_price_usd` | Gauge | Live price per product |
| `pricing_product_margin_percent` | Gauge | Gross margin % per product |
| `pricing_product_inventory_level` | Gauge | Inventory count per product |
| `pricing_competitor_price_gap_percent` | Gauge | % gap vs lowest competitor |
| `pricing_estimated_revenue_impact_usd` | Gauge | Cumulative revenue impact |

---

## 🔔 Alert Rules (`monitoring/alerts.yml`)

| Alert | Severity | Condition |
|---|---|---|
| `AgentStalled` | critical | No successful run in 2+ hours |
| `AgentConsecutiveFailures` | critical | 3+ consecutive failures |
| `HighLLMErrorRate` | warning | LLM errors > 20% over 10 min |
| `HighFallbackRate` | warning | Fallback rate > 0.3/s over 15 min |
| `LowDecisionConfidence` | warning | Median confidence < 40% over 30 min |
| `GuardrailsFiringTooOften` | warning | Guardrails > 1 trigger/s over 5 min |
| `SlowLLMResponse` | warning | LLM p95 latency > 10s |
| `ProductMarginTooLow` | critical | Any product margin drops below 10% |

---

## 🔧 Troubleshooting

**`ImportError: cannot import name 'active_products_gauge'`**
→ Replace `backend/main.py` with the latest version. The gauge was renamed to `active_products_gauge` → `active_products_total`.

**Products showing USD prices / old products**
→ Run `python reset_products.py` to clear old data and reseed Indian products.

**Agent always using COST_PLUS**
→ Check your `OPENAI_API_KEY` in `.env`. If the LLM call fails, it falls back to cost-plus.

**Prometheus showing no data**
→ Make sure the backend is running on port 8000 and `/metrics` is reachable. In Docker, Prometheus uses `host.docker.internal:8000`.

**Flipkart / Amazon.in scraping blocked**
→ Expected — both sites heavily block scrapers. The agent automatically falls back to realistic INR simulated prices. This is normal behaviour.

**`PYTHONPATH` errors on Windows**
```bash
set PYTHONPATH=.
# or add to your .env file:
# PYTHONPATH=.
```