# ⚡ TMLCStore — React Frontend Dashboard

Modern, clean, and real-time React dashboard for the **Autonomous Dynamic Pricing Agent**.

---

## 🚀 Quick Start

### 1. Install Dependencies (Already Completed)
```bash
cd frontend-react
npm install
```

### 2. Start Vite Development Server
```bash
npm run dev
```
The dashboard will open at **`http://localhost:3000`**.
All API calls to `/api/v1` and health endpoints are automatically proxied to the FastAPI backend at `http://localhost:8000`.

### 3. Build for Production
```bash
npm run build
```
Production assets are generated in `dist/`.

---

## ✨ Features & Architecture

- **📊 Executive Dashboard:**
  - 5 Real-time KPI Metric Cards: Monitored Products, Total AI Pricing Decisions, Average Gross Margin %, Revenue Impact, Low Stock Alerts.
  - Live Recent Decisions feed with Strategy Badges, Price Shifts, Confidence Meters, and AI Reasoning.
  - Interactive Recharts Donut & Bar Charts for Strategy Breakdown and Decision Direction.

- **📦 Products Catalog & Live Pricing:**
  - Fast search by Product Name, SKU, or Category.
  - Filters for Categories & Stock Risks (Low stock warning).
  - Price bounds (Min vs Max allowed boundaries).
  - Color-coded Gross Margin badges (Green >30%, Amber 15-30%, Red <15%).
  - Targeted "Optimize Solo" agent trigger for single products.

- **📈 Price History & AI Audit Modal:**
  - Area chart displaying historical price changes against cost price and the 15% margin floor.
  - Full AI Reasoning callout explaining why prices were shifted or held.

- **✏️ Manual Override Modal:**
  - Edit current price, inventory count, and min/max limits with real-time gross margin calculation and safety warnings if below the 15% margin floor.

- **🤖 AI Agent Execution Center:**
  - Single-click "Run Agent Now" with live execution spinners.
  - Detailed audit cards for past agent runs: scan duration, tokens consumed, and error alerts.

- **📈 Market Intelligence & Analytics:**
  - Price Change % Distribution Histogram.
  - AI Decision Confidence Distribution.
  - Catalog Gross Margin Overview with 15% floor indicator.

- **🛡️ Guardrails & Observability:**
  - Explicit verification of the 3 Hard Rules: Margin Floor (15%), Velocity Cap (±20%), Strategy Direction Overrule.
  - Direct links to Swagger API (`:8000/docs`), Prometheus (`:9090`), and Grafana (`:3001`).
