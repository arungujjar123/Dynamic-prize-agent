"""
Dynamic Pricing Agent — Streamlit Dashboard
Rich UI with real-time data, price history charts, agent control panel
"""
import streamlit as st
import requests
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime
import time
import os

API_BASE = os.getenv("API_BASE", "http://backend:8000/api/v1")

st.set_page_config(
    page_title="Dynamic Pricing Agent",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS ────────────────────────────────────────────────────────────────
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;600;700&display=swap');

    html, body, [class*="css"] {
        font-family: 'IBM Plex Sans', sans-serif;
    }
    .stApp { background: #0a0e1a; color: #e2e8f0; }

    .metric-card {
        background: linear-gradient(135deg, #111827 0%, #1a2035 100%);
        border: 1px solid #1e3a5f;
        border-radius: 12px;
        padding: 20px 24px;
        margin: 4px 0;
        position: relative;
        overflow: hidden;
    }
    .metric-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 2px;
        background: linear-gradient(90deg, #3b82f6, #06b6d4);
    }
    .metric-value {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 2rem;
        font-weight: 600;
        color: #60a5fa;
        line-height: 1;
    }
    .metric-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #64748b;
        margin-top: 4px;
    }
    .metric-delta { font-size: 0.85rem; margin-top: 6px; }
    .delta-pos { color: #34d399; }
    .delta-neg { color: #f87171; }

    .product-row {
        background: #111827;
        border: 1px solid #1e293b;
        border-radius: 8px;
        padding: 16px;
        margin: 6px 0;
        transition: border-color 0.2s;
    }
    .product-row:hover { border-color: #3b82f6; }

    .badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 20px;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .badge-surge { background: #7f1d1d; color: #fca5a5; }
    .badge-competitive { background: #1e3a5f; color: #93c5fd; }
    .badge-clearance { background: #1a2e05; color: #86efac; }
    .badge-demand { background: #312e81; color: #c4b5fd; }
    .badge-cost { background: #1c1917; color: #a8a29e; }

    .agent-status-running { color: #fbbf24; animation: pulse 1s infinite; }
    .agent-status-idle { color: #34d399; }

    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    .section-header {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: #3b82f6;
        border-bottom: 1px solid #1e293b;
        padding-bottom: 8px;
        margin-bottom: 16px;
    }

    .stButton > button {
        background: linear-gradient(135deg, #1d4ed8, #2563eb) !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        font-weight: 600 !important;
        padding: 10px 24px !important;
        transition: all 0.2s !important;
    }
    .stButton > button:hover {
        background: linear-gradient(135deg, #2563eb, #3b82f6) !important;
        transform: translateY(-1px) !important;
    }
    div[data-testid="stSidebarContent"] {
        background: #0d1220;
        border-right: 1px solid #1e293b;
    }
    .reasoning-box {
        background: #0f172a;
        border-left: 3px solid #3b82f6;
        padding: 12px 16px;
        border-radius: 0 8px 8px 0;
        font-size: 0.85rem;
        color: #94a3b8;
        font-family: 'IBM Plex Mono', monospace;
        line-height: 1.6;
    }
    [data-testid="stMetricValue"] { color: #60a5fa !important; }
</style>
""", unsafe_allow_html=True)


# ── Helpers ───────────────────────────────────────────────────────────────────

def api_get(path: str, default=None):
    try:
        r = requests.get(f"{API_BASE}{path}", timeout=5)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return default


def api_post(path: str, payload: dict = {}):
    try:
        r = requests.post(f"{API_BASE}{path}", json=payload, timeout=30)
        r.raise_for_status()
        return r.json(), None
    except Exception as e:
        return None, str(e)


def strategy_badge(strategy: str) -> str:
    colors = {
        "surge": "badge-surge", "competitive": "badge-competitive",
        "clearance": "badge-clearance", "demand_based": "badge-demand",
        "cost_plus": "badge-cost",
    }
    cls = colors.get(strategy or "", "badge-cost")
    icons = {"surge": "🔥", "competitive": "⚔️", "clearance": "🏷️", "demand_based": "📈", "cost_plus": "💰"}
    icon = icons.get(strategy or "", "•")
    return f'<span class="badge {cls}">{icon} {strategy or "unknown"}</span>'


def price_arrow(pct: float) -> str:
    if pct is None:
        return ""
    if pct > 0.5:
        return f'<span class="delta-pos">▲ +{pct:.1f}%</span>'
    if pct < -0.5:
        return f'<span class="delta-neg">▼ {pct:.1f}%</span>'
    return '<span style="color:#64748b">— hold</span>'


# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## ⚡ Pricing Agent")
    st.markdown("---")

    # Agent Status
    agent_status = api_get("/agent/status", {"is_running": False})
    is_running = agent_status.get("is_running", False)
    status_html = (
        '<span class="agent-status-running">⟳ RUNNING</span>'
        if is_running else
        '<span class="agent-status-idle">● IDLE</span>'
    )
    st.markdown(f"**Agent Status:** {status_html}", unsafe_allow_html=True)

    st.markdown("---")
    st.markdown("### 🎮 Agent Control")

    if st.button("▶ Run Agent Now", disabled=is_running, use_container_width=True):
        result, err = api_post("/agent/run", {"triggered_by": "manual"})
        if err:
            st.error(f"Error: {err}")
        else:
            st.success("✅ Agent started!")
            time.sleep(1)
            st.rerun()

    st.markdown("---")
    st.markdown("### 🔧 Scheduler")
    sched = api_get("/scheduler/status", {})
    if sched.get("running"):
        for job in sched.get("jobs", []):
            st.markdown(f"**{job['name']}**")
            if job.get("next_run"):
                dt = datetime.fromisoformat(job["next_run"].replace("Z", "+00:00"))
                st.caption(f"Next run: {dt.strftime('%H:%M:%S UTC')}")
    else:
        st.caption("Scheduler not running")

    # page = st.radio(
    #     "Navigation",
    #     ["📊 Dashboard", "📦 Products", "🤖 Agent Runs", "📈 Analytics"],
    #     label_visibility="collapsed"
    # )

    st.markdown("---")
    if st.button("🔄 Refresh", use_container_width=True):
        st.rerun()

tab1, tab2, tab3, tab4 = st.tabs(["📊 Dashboard", "📦 Products", "🤖 Agent Runs", "📈 Analytics"])

# ── Dashboard Page ────────────────────────────────────────────────────────────
with tab1:
    st.markdown("# Dynamic Pricing Agent")
    st.markdown("*Real-time AI-powered price optimization*")
    st.markdown("---")

    dashboard = api_get("/analytics/dashboard", {})
    stats = api_get("/decisions/stats", {})

    # KPI Cards
    col1, col2, col3, col4, col5 = st.columns(5)

    kpis = [
        (col1, "Active Products", dashboard.get("active_products", 0), None),
        (col2, "Decisions Made", dashboard.get("total_decisions", 0), None),
        (col3, "Avg Margin", f"{dashboard.get('avg_margin_pct', 0):.1f}%", None),
        (col4, "Revenue Impact", f"${dashboard.get('estimated_revenue_impact', 0):+.0f}", None),
        (col5, "Low Stock", dashboard.get("low_stock_products", 0), "⚠️"),
    ]

    for col, label, value, icon in kpis:
        with col:
            prefix = f"{icon} " if icon else ""
            st.markdown(f"""
            <div class="metric-card">
                <div class="metric-value">{prefix}{value}</div>
                <div class="metric-label">{label}</div>
            </div>
            """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    col_left, col_right = st.columns([3, 2])

    with col_left:
        st.markdown('<div class="section-header">Recent Price Decisions</div>', unsafe_allow_html=True)
        decisions = api_get("/decisions/?limit=20", [])

        if decisions:
            for d in decisions[:8]:
                change_pct = d.get("price_change_pct", 0) or 0
                st.markdown(f"""
                <div class="product-row">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="color:#e2e8f0">{d['product_id']}</strong>
                            {strategy_badge(d.get('strategy'))}
                        </div>
                        <div style="text-align:right; font-family:'IBM Plex Mono',monospace">
                            <span style="color:#64748b">${d['old_price']:.2f}</span>
                            <span style="color:#475569"> → </span>
                            <strong style="color:#60a5fa">${d['new_price']:.2f}</strong>
                            &nbsp;{price_arrow(change_pct)}
                        </div>
                    </div>
                    <div style="margin-top:8px; font-size:0.78rem; color:#475569">
                        Confidence: {d.get('confidence_score', 0):.0%} &nbsp;·&nbsp;
                        {d.get('created_at', '')[:19].replace('T', ' ')}
                    </div>
                </div>
                """, unsafe_allow_html=True)
        else:
            st.info("No decisions yet. Run the agent to generate pricing decisions.")

    with col_right:
        st.markdown('<div class="section-header">Strategy Distribution</div>', unsafe_allow_html=True)
        by_strategy = stats.get("by_strategy", {})
        if by_strategy:
            colors = ["#3b82f6", "#06b6d4", "#8b5cf6", "#f59e0b", "#10b981"]
            fig = go.Figure(go.Pie(
                labels=list(by_strategy.keys()),
                values=list(by_strategy.values()),
                hole=0.55,
                marker=dict(colors=colors, line=dict(color="#0a0e1a", width=2)),
                textfont=dict(color="white", size=11),
            ))
            fig.update_layout(
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                font=dict(color="#94a3b8"),
                margin=dict(t=0, b=0, l=0, r=0),
                height=220,
                showlegend=True,
                legend=dict(font=dict(color="#94a3b8"), bgcolor="rgba(0,0,0,0)"),
            )
            st.plotly_chart(fig, use_container_width=True)

        st.markdown('<div class="section-header">Decision Breakdown</div>', unsafe_allow_html=True)
        total = stats.get("total", 0)
        if total:
            inc = stats.get("increases", 0)
            dec = stats.get("decreases", 0)
            hold = stats.get("holds", 0)
            fig2 = go.Figure(go.Bar(
                x=["Increases", "Holds", "Decreases"],
                y=[inc, hold, dec],
                marker_color=["#34d399", "#64748b", "#f87171"],
                text=[inc, hold, dec], textposition="auto",
            ))
            fig2.update_layout(
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                font=dict(color="#94a3b8"),
                margin=dict(t=10, b=0, l=0, r=0),
                height=180,
                xaxis=dict(showgrid=False),
                yaxis=dict(showgrid=False, showticklabels=False),
            )
            st.plotly_chart(fig2, use_container_width=True)


# ── Products Page ─────────────────────────────────────────────────────────────
with tab2:
    st.markdown("# Products")
    st.markdown("---")

    products = api_get("/products/", [])

    if not products:
        st.warning("No products found.")
    else:
        selected_product = None

        for p in products:
            col1, col2, col3, col4, col5 = st.columns([3, 2, 2, 2, 1])
            with col1:
                st.markdown(f"**{p['name']}**")
                st.caption(f"{p['sku']} · {p.get('category', '—')}")
            with col2:
                st.markdown(f"**${p['current_price']:.2f}**")
                st.caption(f"Cost: ${p['cost_price']:.2f}")
            with col3:
                margin = p.get("gross_margin_pct", 0)
                color = "green" if margin > 30 else "orange" if margin > 15 else "red"
                st.markdown(f":{color}[{margin:.1f}% margin]")
            with col4:
                inv = p["inventory_count"]
                thresh = p.get("inventory_threshold", 10)
                inv_color = "red" if inv <= thresh else "orange" if inv <= thresh * 2 else "green"
                st.markdown(f":{inv_color}[{inv} units]")
            with col5:
                if st.button("History", key=f"hist_{p['id']}"):
                    selected_product = p["id"]

            st.markdown("---")

        if selected_product:
            st.markdown(f"### Price History: {selected_product}")
            history = api_get(f"/products/{selected_product}/price-history?limit=30", [])
            if history:
                df = pd.DataFrame(history)
                df["created_at"] = pd.to_datetime(df["created_at"])
                df = df.sort_values("created_at")

                fig = go.Figure()
                fig.add_trace(go.Scatter(
                    x=df["created_at"], y=df["new_price"],
                    mode="lines+markers",
                    line=dict(color="#3b82f6", width=2),
                    marker=dict(size=6, color="#60a5fa"),
                    name="Price",
                ))
                fig.add_trace(go.Scatter(
                    x=df["created_at"], y=df["old_price"],
                    mode="lines",
                    line=dict(color="#475569", width=1, dash="dot"),
                    name="Previous Price",
                ))
                fig.update_layout(
                    paper_bgcolor="rgba(0,0,0,0)",
                    plot_bgcolor="rgba(0,0,0,0)",
                    font=dict(color="#94a3b8"),
                    xaxis=dict(gridcolor="#1e293b"),
                    yaxis=dict(gridcolor="#1e293b"),
                    height=300,
                    margin=dict(t=10, b=0),
                )
                st.plotly_chart(fig, use_container_width=True)

                # Show reasoning for latest decision
                latest = history[0] if history else None
                if latest and latest.get("reasoning"):
                    st.markdown("**Latest AI Reasoning:**")
                    st.markdown(f'<div class="reasoning-box">{latest["reasoning"]}</div>', unsafe_allow_html=True)


# ── Agent Runs Page ───────────────────────────────────────────────────────────
with tab3:
    st.markdown("# Agent Run History")
    st.markdown("---")

    runs = api_get("/agent/runs?limit=20", [])

    if not runs:
        st.info("No agent runs yet. Click 'Run Agent Now' in the sidebar.")
    else:
        for run in runs:
            status = run.get("status", "unknown")
            status_color = {"completed": "green", "running": "orange", "failed": "red"}.get(status, "gray")
            errors = run.get("errors", [])

            with st.expander(
                f":{status_color}[{status.upper()}] {run['id']} — "
                f"{run.get('products_processed', 0)} products · "
                f"{run.get('decisions_made', 0)} decisions · "
                f"{run.get('duration_seconds', 0):.1f}s"
            ):
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Products Processed", run.get("products_processed", 0))
                    st.metric("Prices Updated", run.get("prices_updated", 0))
                with col2:
                    st.metric("Decisions Made", run.get("decisions_made", 0))
                    st.metric("Duration (s)", run.get("duration_seconds", 0))
                with col3:
                    st.metric("Tokens Used", run.get("total_tokens_used", 0))
                    st.metric("Triggered By", run.get("triggered_by", "—"))

                st.caption(f"Started: {run.get('started_at', '—')}")
                st.caption(f"Completed: {run.get('completed_at', '—')}")

                if errors:
                    st.error(f"Errors: {errors}")


# ── Analytics Page ────────────────────────────────────────────────────────────
with tab4:
    st.markdown("# Analytics & Insights")
    st.markdown("---")

    decisions = api_get("/decisions/?limit=200", [])
    products = api_get("/products/", [])

    if decisions:
        df = pd.DataFrame(decisions)
        df["created_at"] = pd.to_datetime(df["created_at"])
        df["date"] = df["created_at"].dt.date

        col1, col2 = st.columns(2)

        with col1:
            st.markdown('<div class="section-header">Price Change % Distribution</div>', unsafe_allow_html=True)
            fig = px.histogram(
                df, x="price_change_pct", nbins=20,
                color_discrete_sequence=["#3b82f6"],
                title=None,
            )
            fig.update_layout(
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                font=dict(color="#94a3b8"),
                xaxis=dict(gridcolor="#1e293b", title="Price Change %"),
                yaxis=dict(gridcolor="#1e293b", title="Count"),
                height=280, margin=dict(t=10, b=0),
            )
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            st.markdown('<div class="section-header">Confidence Score Distribution</div>', unsafe_allow_html=True)
            fig2 = px.histogram(
                df, x="confidence_score", nbins=10,
                color_discrete_sequence=["#06b6d4"],
                title=None,
            )
            fig2.update_layout(
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                font=dict(color="#94a3b8"),
                xaxis=dict(gridcolor="#1e293b", title="Confidence"),
                yaxis=dict(gridcolor="#1e293b", title="Count"),
                height=280, margin=dict(t=10, b=0),
            )
            st.plotly_chart(fig2, use_container_width=True)

        st.markdown('<div class="section-header">Decisions Over Time by Strategy</div>', unsafe_allow_html=True)
        strategy_time = df.groupby(["date", "strategy"]).size().reset_index(name="count")
        fig3 = px.bar(strategy_time, x="date", y="count", color="strategy",
                      color_discrete_sequence=["#3b82f6", "#06b6d4", "#8b5cf6", "#f59e0b", "#10b981"])
        fig3.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#94a3b8"),
            xaxis=dict(gridcolor="#1e293b"),
            yaxis=dict(gridcolor="#1e293b"),
            height=300, margin=dict(t=10, b=0),
            legend=dict(bgcolor="rgba(0,0,0,0)"),
        )
        st.plotly_chart(fig3, use_container_width=True)

    if products:
        st.markdown('<div class="section-header">Product Margin Overview</div>', unsafe_allow_html=True)
        pf = pd.DataFrame(products)
        fig4 = px.bar(
            pf, x="name", y="gross_margin_pct",
            color="gross_margin_pct",
            color_continuous_scale=["#ef4444", "#f59e0b", "#10b981"],
            text="gross_margin_pct",
        )
        fig4.update_traces(texttemplate='%{text:.1f}%', textposition='outside')
        fig4.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#94a3b8"),
            xaxis=dict(gridcolor="#1e293b", title=None),
            yaxis=dict(gridcolor="#1e293b", title="Gross Margin %"),
            height=320, margin=dict(t=10, b=0),
            showlegend=False, coloraxis_showscale=False,
        )
        st.plotly_chart(fig4, use_container_width=True)

    else:
        st.info("No data yet. Run the agent to generate analytics.")
