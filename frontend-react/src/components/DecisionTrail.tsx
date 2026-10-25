import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { PriceDecision } from '../types';
import { formatINR } from '../utils/format';

/**
 * Shows how the final price was reached: the LLM's suggestion, then every
 * correction or guardrail the agent applied on top of it.
 */
export const DecisionTrail: React.FC<{ decision: PriceDecision }> = ({ decision }) => {
  const adjustments = decision.adjustments ?? [];
  if (decision.llm_price == null || adjustments.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200/90 space-y-1">
      <div className="flex items-center gap-1.5 font-semibold text-amber-300">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Guardrails adjusted the AI's price</span>
      </div>
      <ol className="space-y-0.5 text-amber-100/80">
        <li>AI suggested {formatINR(decision.llm_price)}</li>
        {adjustments.map((a, i) => (
          <li key={i}>→ {a}</li>
        ))}
        <li className="font-semibold text-amber-200">= Final {formatINR(decision.new_price)}</li>
      </ol>
    </div>
  );
};

const SITE_LABELS: Record<string, string> = { 'amazon.in': 'Amazon.in', 'flipkart.com': 'Flipkart' };

/** Competitor prices the decision was based on, marked live (scraped) or simulated. */
export const CompetitorQuotes: React.FC<{ decision: PriceDecision }> = ({ decision }) => {
  const quotes = (decision.competitor_data ?? []).filter((q) => q.price != null);
  if (quotes.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-slate-500">Competitors:</span>
      {quotes.map((q, i) => {
        const live = q.source === 'scraped';
        return (
          <span
            key={i}
            title={live ? 'Scraped via Apify' : 'Simulated — no live price available'}
            className={`px-2 py-0.5 rounded-md border ${
              live
                ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-300'
                : 'border-slate-700 bg-slate-800/50 text-slate-400'
            }`}
          >
            {SITE_LABELS[q.name ?? ''] ?? q.name} {formatINR(q.price)} · {live ? 'live' : 'simulated'}
          </span>
        );
      })}
    </div>
  );
};
