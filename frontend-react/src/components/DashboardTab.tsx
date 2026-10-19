import React from 'react';
import { 
  Package, 
  TrendingUp, 
  Percent, 
  DollarSign, 
  AlertTriangle, 
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis 
} from 'recharts';
import { DashboardSummary, DecisionStats, PriceDecision, Product } from '../types';
import { StrategyBadge, PriceDelta } from './StrategyBadge';

interface DashboardTabProps {
  summary: DashboardSummary | null;
  stats: DecisionStats | null;
  decisions: PriceDecision[];
  products: Product[];
  onSelectProductHistory: (productId: string) => void;
  onNavigateToProducts: () => void;
  onRunAgent: () => void;
  isAgentRunning: boolean;
}

const STRATEGY_COLORS: Record<string, string> = {
  surge: '#ef4444',
  competitive: '#3b82f6',
  clearance: '#10b981',
  demand_based: '#a855f7',
  cost_plus: '#f59e0b',
  unknown: '#64748b',
};

export const DashboardTab: React.FC<DashboardTabProps> = ({
  summary,
  stats,
  decisions,
  products,
  onSelectProductHistory,
  onNavigateToProducts,
  onRunAgent,
  isAgentRunning,
}) => {
  // Format Strategy data for Recharts Pie
  const strategyData = React.useMemo(() => {
    if (!stats?.by_strategy) return [];
    return Object.entries(stats.by_strategy).map(([key, value]) => ({
      name: key.replace('_', ' ').toUpperCase(),
      rawKey: key,
      value,
    }));
  }, [stats]);

  // Decision Breakdown (Increases, Holds, Decreases)
  const breakdownData = React.useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Increases', count: stats.increases || 0, color: '#34d399' },
      { name: 'Holds', count: stats.holds || 0, color: '#64748b' },
      { name: 'Decreases', count: stats.decreases || 0, color: '#f87171' },
    ];
  }, [stats]);

  // Product map for quick lookup
  const productMap = React.useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  return (
    <div className="space-y-6">
      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Active Products */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-slate-900/60 p-4 border border-slate-800 shadow-sm hover:border-slate-700 transition-all">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Active Products</span>
            <Package className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 text-2xl font-bold font-mono text-blue-400">
            {summary?.active_products ?? products.length ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">Catalog items monitored</div>
        </div>

        {/* Total Decisions */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-slate-900/60 p-4 border border-slate-800 shadow-sm hover:border-slate-700 transition-all">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Decisions Made</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3 text-2xl font-bold font-mono text-indigo-400">
            {summary?.total_decisions ?? stats?.total ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">AI price optimizations</div>
        </div>

        {/* Avg Margin */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-slate-900/60 p-4 border border-slate-800 shadow-sm hover:border-slate-700 transition-all">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Avg Gross Margin</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-2xl font-bold font-mono text-emerald-400">
            {summary?.avg_margin_pct !== undefined ? `${summary.avg_margin_pct.toFixed(1)}%` : '—'}
          </div>
          <div className="mt-1 text-xs text-emerald-500/80">≥ 15% Floor enforced</div>
        </div>

        {/* Revenue Impact */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-slate-900/60 p-4 border border-slate-800 shadow-sm hover:border-slate-700 transition-all">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Revenue Impact</span>
            <DollarSign className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 text-2xl font-bold font-mono text-cyan-300">
            {summary?.estimated_revenue_impact !== undefined
              ? `${summary.estimated_revenue_impact >= 0 ? '+' : ''}$${summary.estimated_revenue_impact.toFixed(0)}`
              : '$0'}
          </div>
          <div className="mt-1 text-xs text-slate-500">Net price shift benefit</div>
        </div>

        {/* Low Stock Alert */}
        <div className={`relative overflow-hidden rounded-xl p-4 border transition-all ${
          (summary?.low_stock_products || 0) > 0 
            ? 'bg-rose-950/20 border-rose-800/40' 
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-rose-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400">Low Stock Alert</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 text-2xl font-bold font-mono text-amber-400">
            {summary?.low_stock_products ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">Products near threshold</div>
        </div>
      </div>

      {/* Main Grid: Left 60% Decisions Stream, Right 40% Charts & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recent Decisions Feed */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-400">
                Recent Price Decisions
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300">
                {decisions.length}
              </span>
            </div>
            <button
              onClick={onNavigateToProducts}
              className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
            >
              <span>View All Products</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {decisions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center bg-slate-900/40">
              <Sparkles className="w-8 h-8 text-blue-400 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-slate-300">No pricing decisions recorded yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Trigger the AI Pricing Agent to scrape competitors, analyze margins, and apply dynamic pricing.
              </p>
              <button
                onClick={onRunAgent}
                disabled={isAgentRunning}
                className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/30"
              >
                {isAgentRunning ? 'Running...' : 'Run Agent Now'}
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {decisions.slice(0, 10).map((d) => {
                const product = productMap.get(d.product_id);
                const changePct = d.price_change_pct ?? 0;
                const confidencePct = d.confidence_score ? Math.round(d.confidence_score * 100) : 85;

                return (
                  <div
                    key={d.id}
                    onClick={() => onSelectProductHistory(d.product_id)}
                    className="group rounded-xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-900/90 hover:border-blue-500/50 p-3.5 transition-all cursor-pointer shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-100 group-hover:text-blue-300 transition-colors">
                            {product?.name || d.product_id}
                          </span>
                          <StrategyBadge strategy={d.strategy} size="sm" />
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                          <span>{product?.sku || d.product_id}</span>
                          <span>•</span>
                          <span>{product?.category || 'General'}</span>
                          {product?.cost_price && (
                            <>
                              <span>•</span>
                              <span>Cost: ${product.cost_price.toFixed(2)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Pricing Delta */}
                      <div className="flex items-center sm:justify-end gap-3 font-mono">
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 line-through">${d.old_price.toFixed(2)}</span>
                            <ArrowRight className="w-3 h-3 text-slate-600" />
                            <span className="text-sm font-bold text-blue-400">${d.new_price.toFixed(2)}</span>
                            <PriceDelta pct={changePct} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Reasoning Preview */}
                    {d.reasoning && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800/60 text-xs text-slate-400 font-mono line-clamp-1 italic">
                        "{d.reasoning}"
                      </div>
                    )}

                    {/* Footer metadata */}
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                      <div className="flex items-center gap-2">
                        <span>Confidence:</span>
                        <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                            style={{ width: `${confidencePct}%` }}
                          ></div>
                        </div>
                        <span className="text-slate-300">{confidencePct}%</span>
                      </div>
                      <div>
                        {d.created_at ? new Date(d.created_at).toLocaleString() : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Charts & Intelligence */}
        <div className="lg:col-span-5 space-y-5">
          {/* Strategy Distribution Chart */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-400 border-b border-slate-800/80 pb-2">
              Strategy Distribution
            </h2>
            {strategyData.length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={strategyData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {strategyData.map((entry) => (
                        <Cell
                          key={entry.rawKey}
                          fill={STRATEGY_COLORS[entry.rawKey] || '#3b82f6'}
                          stroke="#0a0e1a"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#1e293b',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-xs text-slate-500">
                No strategy data available
              </div>
            )}

            {/* Strategy Legends */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
              {strategyData.map((s) => (
                <div key={s.rawKey} className="flex items-center justify-between p-1.5 rounded bg-slate-800/40">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: STRATEGY_COLORS[s.rawKey] || '#3b82f6' }}
                    ></span>
                    <span className="text-[11px] capitalize">{s.rawKey.replace('_', ' ')}</span>
                  </span>
                  <span className="font-bold text-slate-200">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Decisions Breakdown */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-400 border-b border-slate-800/80 pb-2">
              Decisions Breakdown
            </h2>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdownData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {breakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Guardrails Verification Banner */}
          <div className="rounded-xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/20 to-slate-900 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>GUARDRAIL VERIFICATION ENGINE ACTIVE</span>
            </div>
            <p className="text-xs text-slate-400">
              Every AI pricing decision is validated before database persistence:
            </p>
            <ul className="text-xs space-y-1.5 text-slate-300 font-mono">
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Margin Floor: Price ≥ Cost × 1.15 (15% Floor)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Velocity Cap: Maximum ±20% single shift</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Strategy Direction: Auto-corrects inverse LLM moves</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
