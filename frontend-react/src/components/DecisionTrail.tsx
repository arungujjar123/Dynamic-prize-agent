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
