import React, { useEffect, useState } from 'react';
import { X, Sparkles, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { PriceDecision, Product } from '../types';
import { api } from '../services/api';
import { StrategyBadge, PriceDelta } from './StrategyBadge';
import { formatINR } from '../utils/format';

interface ProductHistoryModalProps {
  productId: string | null;
  product?: Product | null;
  onClose: () => void;
}

export const ProductHistoryModal: React.FC<ProductHistoryModalProps> = ({
  productId,
  product,
  onClose,
}) => {
  const [history, setHistory] = useState<PriceDecision[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    api
      .getProductPriceHistory(productId, 50)
      .then((data) => setHistory(data))
      .catch((err) => setError(err.message || 'Failed to fetch price history'))
      .finally(() => setLoading(false));
  }, [productId]);

  if (!productId) return null;

  // Chart data sorted chronologically
  const chartData = [...history]
    .reverse()
    .map((d) => ({
      date: d.created_at ? new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
      fullDate: d.created_at ? new Date(d.created_at).toLocaleString() : '',
      price: d.new_price,
      oldPrice: d.old_price,
      strategy: d.strategy,
      confidence: d.confidence_score ? Math.round(d.confidence_score * 100) : null,
    }));

  const latestDecision = history[0];
  const costFloor = product ? product.cost_price * 1.15 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0f172a] border border-slate-800 shadow-2xl p-6 text-slate-100 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">
                {product?.name || productId}
              </h2>
              {product?.sku && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  {product.sku}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Historical Pricing Trajectory & AI Decision Audit
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Metrics Overview */}
        {product && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800/80 font-mono text-xs">
            <div>
              <span className="text-slate-500">Current Price:</span>
              <div className="text-base font-bold text-blue-400 mt-0.5">{formatINR(product.current_price)}</div>
            </div>
            <div>
              <span className="text-slate-500">Cost Price:</span>
              <div className="text-base font-bold text-slate-300 mt-0.5">{formatINR(product.cost_price)}</div>
            </div>
            <div>
              <span className="text-slate-500">15% Margin Floor:</span>
              <div className="text-base font-bold text-emerald-400 mt-0.5">{formatINR(costFloor)}</div>
            </div>
            <div>
              <span className="text-slate-500">Inventory:</span>
              <div className="text-base font-bold text-amber-400 mt-0.5">{product.inventory_count} units</div>
            </div>
          </div>
        )}

        {/* Latest AI Reasoning Box */}
        {latestDecision?.reasoning && (
          <div className="rounded-xl border border-blue-900/50 bg-gradient-to-r from-blue-950/40 via-indigo-950/20 to-slate-900 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-300">
                  Latest AI Reasoning
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StrategyBadge strategy={latestDecision.strategy} size="sm" />
                {latestDecision.confidence_score && (
                  <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    {Math.round(latestDecision.confidence_score * 100)}% Confidence
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm font-mono text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/60">
              "{latestDecision.reasoning}"
            </p>
          </div>
        )}

        {/* Price History Chart */}
        <div className="space-y-2">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
            Price Movements vs Margin Floor
          </h3>
          {loading ? (
            <div className="h-60 flex items-center justify-center text-sm text-slate-400 font-mono">
              Loading price history...
            </div>
          ) : chartData.length > 0 ? (
            <div className="h-64 bg-slate-900/60 rounded-xl p-3 border border-slate-800">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''}
                    formatter={(val: any) => [formatINR(Number(val)), 'Price']}
                  />
                  {costFloor > 0 && (
                    <ReferenceLine
                      y={costFloor}
                      stroke="#10b981"
                      strokeDasharray="3 3"
                      label={{ value: '15% Floor', fill: '#10b981', fontSize: 10, position: 'insideTopLeft' }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#priceGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-slate-500 font-mono bg-slate-900/30 rounded-xl border border-slate-800">
              No historical price points recorded yet.
            </div>
          )}
        </div>

        {/* History Log Table */}
        <div className="space-y-2">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
            Decision Audit Trail ({history.length} records)
          </h3>
          <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full text-left text-xs text-slate-300 font-mono">
              <thead className="bg-slate-900/90 text-slate-400 sticky top-0 text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Strategy</th>
                  <th className="py-2.5 px-3">Price Shift</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 text-slate-400">
                      {d.created_at ? new Date(d.created_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3">
                      <StrategyBadge strategy={d.strategy} size="sm" />
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-100">
                      {formatINR(d.old_price)} → <span className="text-blue-400">{formatINR(d.new_price)}</span>
                      <span className="ml-2">
                        <PriceDelta pct={d.price_change_pct} />
                      </span>
                      {d.llm_price != null && (d.adjustments?.length ?? 0) > 0 && (
                        <div
                          className="mt-1 text-[10px] font-normal text-amber-300/90"
                          title={d.adjustments!.join('\n')}
                        >
                          AI suggested {formatINR(d.llm_price)} · adjusted by guardrails
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-cyan-400">
                      {d.confidence_score ? `${Math.round(d.confidence_score * 100)}%` : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      {d.applied ? (
                        <span className="text-emerald-400 font-semibold">Yes</span>
                      ) : (
                        <span className="text-slate-500">No change</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
