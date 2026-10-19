import React from 'react';

interface StrategyBadgeProps {
  strategy?: string | null;
  size?: 'sm' | 'md';
}

export const StrategyBadge: React.FC<StrategyBadgeProps> = ({ strategy, size = 'md' }) => {
  const strat = strategy?.toLowerCase() || 'unknown';

  const config: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
    surge: {
      label: 'Surge Pricing',
      bg: 'bg-red-950/60',
      text: 'text-red-300',
      border: 'border-red-800/60',
      icon: '🔥',
    },
    competitive: {
      label: 'Competitive',
      bg: 'bg-blue-950/60',
      text: 'text-blue-300',
      border: 'border-blue-800/60',
      icon: '⚔️',
    },
    clearance: {
      label: 'Clearance',
      bg: 'bg-emerald-950/60',
      text: 'text-emerald-300',
      border: 'border-emerald-800/60',
      icon: '🏷️',
    },
    demand_based: {
      label: 'Demand-Based',
      bg: 'bg-purple-950/60',
      text: 'text-purple-300',
      border: 'border-purple-800/60',
      icon: '📈',
    },
    cost_plus: {
      label: 'Cost-Plus',
      bg: 'bg-amber-950/60',
      text: 'text-amber-300',
      border: 'border-amber-800/60',
      icon: '💰',
    },
    unknown: {
      label: strat || 'Standard',
      bg: 'bg-slate-800/60',
      text: 'text-slate-300',
      border: 'border-slate-700/60',
      icon: '⚙️',
    },
  };

  const c = config[strat] || config.unknown;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${c.bg} ${c.text} ${c.border} ${padding} backdrop-blur-sm shadow-sm tracking-wide`}
    >
      <span>{c.icon}</span>
      <span>{c.label}</span>
    </span>
  );
};

export const PriceDelta: React.FC<{ pct?: number | null; oldPrice?: number; newPrice?: number }> = ({ pct }) => {
  if (pct === undefined || pct === null) return <span className="text-slate-500 font-mono text-xs">—</span>;

  if (pct > 0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-400 font-mono font-semibold text-xs bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/30">
        ▲ +{pct.toFixed(1)}%
      </span>
    );
  }
  if (pct < -0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-rose-400 font-mono font-semibold text-xs bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-800/30">
        ▼ {pct.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-slate-400 font-mono text-xs bg-slate-800/40 px-1.5 py-0.5 rounded border border-slate-700/30">
      — hold
    </span>
  );
};
