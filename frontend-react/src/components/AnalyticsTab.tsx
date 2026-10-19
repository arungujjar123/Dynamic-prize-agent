import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  ReferenceLine,
  LineChart,
  Line
} from 'recharts';
import { PriceDecision, Product, DecisionStats } from '../types';

interface AnalyticsTabProps {
  decisions: PriceDecision[];
  products: Product[];
  stats: DecisionStats | null;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ decisions, products, stats }) => {
  // 1. Price Change % Histogram
  const priceChangeBuckets = useMemo(() => {
    const buckets: Record<string, number> = {
      '<-15%': 0,
      '-15% to -5%': 0,
      '-5% to 0%': 0,
      '0% (Hold)': 0,
      '0% to +5%': 0,
      '+5% to +15%': 0,
      '>+15%': 0,
    };

    decisions.forEach((d) => {
      const p = d.price_change_pct ?? 0;
      if (p < -15) buckets['<-15%']++;
      else if (p < -5) buckets['-15% to -5%']++;
      else if (p < -0.5) buckets['-5% to 0%']++;
      else if (p <= 0.5) buckets['0% (Hold)']++;
      else if (p <= 5) buckets['0% to +5%']++;
      else if (p <= 15) buckets['+5% to +15%']++;
      else buckets['>+15%']++;
    });

    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }, [decisions]);

  // 2. Confidence Score Distribution
  const confidenceBuckets = useMemo(() => {
    const buckets: Record<string, number> = {
      '50-60%': 0,
      '60-70%': 0,
      '70-80%': 0,
      '80-90%': 0,
      '90-100%': 0,
    };

    decisions.forEach((d) => {
      const score = (d.confidence_score ?? 0.85) * 100;
      if (score < 60) buckets['50-60%']++;
      else if (score < 70) buckets['60-70%']++;
      else if (score < 80) buckets['70-80%']++;
      else if (score < 90) buckets['80-90%']++;
      else buckets['90-100%']++;
    });

    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }, [decisions]);

  // 3. Product Margins Comparison
  const productMargins = useMemo(() => {
    return products.map((p) => ({
      name: p.name.length > 15 ? p.name.slice(0, 15) + '...' : p.name,
      fullName: p.name,
      margin: p.gross_margin_pct ?? 0,
      price: p.current_price,
      cost: p.cost_price,
    }));
  }, [products]);

  // 4. Decisions Over Time by Strategy
  const decisionsByDate = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    decisions.forEach((d) => {
      if (!d.created_at) return;
      const date = d.created_at.slice(0, 10);
      if (!map.has(date)) {
        map.set(date, { date: date as any, surge: 0, competitive: 0, clearance: 0, demand_based: 0, cost_plus: 0 });
      }
      const record = map.get(date)!;
      const s = (d.strategy || 'cost_plus').toLowerCase();
      record[s] = (record[s] || 0) + 1;
    });

    return Array.from(map.values()).sort((a, b) => (a.date as any).localeCompare(b.date as any));
  }, [decisions]);

  return (
    <div className="space-y-6">
      {/* Top Insights Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-mono uppercase text-slate-400">Average AI Confidence</span>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-2">
            {stats?.avg_confidence ? `${Math.round(stats.avg_confidence * 100)}%` : '85%'}
          </div>
          <span className="text-xs text-slate-500 font-mono">Calibrated across pricing runs</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-mono uppercase text-slate-400">Average Price Shift</span>
          <div className="text-2xl font-bold font-mono text-blue-400 mt-2">
            {stats?.avg_change_pct ? `${stats.avg_change_pct > 0 ? '+' : ''}${stats.avg_change_pct.toFixed(2)}%` : '0.00%'}
          </div>
          <span className="text-xs text-slate-500 font-mono">Governed by ±20% velocity cap</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-mono uppercase text-slate-400">Total Analyzed Decisions</span>
          <div className="text-2xl font-bold font-mono text-indigo-400 mt-2">
            {stats?.total ?? decisions.length}
          </div>
          <span className="text-xs text-slate-500 font-mono">Across catalog inventory</span>
        </div>
      </div>

      {/* Grid 1: Price Change % & Confidence Histograms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price Change % Distribution */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-400 border-b border-slate-800/80 pb-2">
            Price Change % Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priceChangeBuckets} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="range" stroke="#64748b" fontSize={10} tickLine={false} angle={-25} textAnchor="end" />
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
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Confidence Score Distribution */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400 border-b border-slate-800/80 pb-2">
            AI Decision Confidence Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confidenceBuckets} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="range" stroke="#64748b" fontSize={10} tickLine={false} />
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
                <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grid 2: Product Gross Margin Comparison */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
            Catalog Gross Margin Overview vs 15% Floor
          </h3>
          <span className="text-[11px] font-mono text-emerald-400">
            Green: &gt;30% | Amber: 15-30% | Red: &lt;15%
          </span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={productMargins} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} angle={-30} textAnchor="end" />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
                formatter={(val: any, _, item) => [
                  `${Number(val).toFixed(1)}% (Price: $${item.payload.price.toFixed(2)}, Cost: $${item.payload.cost.toFixed(2)})`,
                  'Gross Margin',
                ]}
              />
              <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '15% Floor', fill: '#ef4444', fontSize: 10 }} />
              <Bar dataKey="margin" radius={[4, 4, 0, 0]}>
                {productMargins.map((entry, index) => {
                  const color = entry.margin >= 30 ? '#10b981' : entry.margin >= 15 ? '#f59e0b' : '#ef4444';
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
