import React, { useState } from 'react';
import { 
  Bot, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Coins, 
  Tag, 
  RefreshCw, 
  Check, 
  Layers,
  Sparkles
} from 'lucide-react';
import { AgentRun, AgentStatus, Product } from '../types';

interface AgentRunsTabProps {
  runs: AgentRun[];
  agentStatus: AgentStatus;
  products: Product[];
  onTriggerRun: (productId?: string) => Promise<void>;
  isTriggering: boolean;
}

export const AgentRunsTab: React.FC<AgentRunsTabProps> = ({
  runs,
  agentStatus,
  products,
  onTriggerRun,
  isTriggering,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const isAgentActive = agentStatus.is_running || isTriggering;

  const handleRun = () => {
    onTriggerRun(selectedProduct ? selectedProduct : undefined);
  };

  return (
    <div className="space-y-6">
      {/* Agent Control & Status Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-[#111827] border border-slate-800 p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>AI Pricing Agent Execution Center</span>
                  {isAgentActive ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-amber-950/60 text-amber-300 border border-amber-800/60 animate-pulse">
                      RUNNING
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-950/50 text-emerald-300 border border-emerald-800/50">
                      IDLE
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  5-Phase Lifecycle: Scrape Competitors → Inventory Check → LLM Reasoning → Guardrail Audit → Atomic DB Update
                </p>
              </div>
            </div>
          </div>

          {/* Trigger Panel */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              disabled={isAgentActive}
              aria-label="Target catalog or specific product"
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">Full Catalog ({products.length} Products)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>

            <button
              onClick={handleRun}
              disabled={isAgentActive}
              className={`flex items-center justify-center gap-2 px-5 py-2 rounded-lg font-medium text-xs shadow-md transition-all ${
                isAgentActive
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0'
              }`}
            >
              {isAgentActive ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Agent Running...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Execute Pricing Run</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Execution History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
            Execution Log & Token Economics ({runs.length} runs)
          </h3>
        </div>

        {runs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center bg-slate-900/40 text-xs text-slate-400 font-mono">
            No agent runs logged yet. Click "Execute Pricing Run" above.
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => {
              const status = run.status?.toLowerCase() || 'unknown';
              const isCompleted = status === 'completed';
              const isFailed = status === 'failed';
              const isRunning = status === 'running';

              return (
                <div
                  key={run.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
                    <div className="flex items-center gap-2.5">
                      {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {isRunning && <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />}
                      {isFailed && <AlertCircle className="w-4 h-4 text-rose-400" />}
                      
                      <span className="font-mono font-bold text-sm text-slate-200">
                        {run.id}
                      </span>

                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono uppercase rounded-full border ${
                          isCompleted
                            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                            : isRunning
                            ? 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                            : 'bg-rose-950/40 text-rose-300 border-rose-800/40'
                        }`}
                      >
                        {run.status}
                      </span>

                      <span className="text-xs text-slate-500 font-mono">
                        via {run.triggered_by || 'manual'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{run.duration_seconds ? `${run.duration_seconds.toFixed(1)}s` : '—'}</span>
                      </div>
                      <span>•</span>
                      <span>
                        {run.started_at ? new Date(run.started_at).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                      <span className="text-slate-500 text-[11px] block">Products Scanned</span>
                      <span className="text-base font-bold text-slate-200 mt-0.5 block">
                        {run.products_processed}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                      <span className="text-slate-500 text-[11px] block">Decisions Made</span>
                      <span className="text-base font-bold text-indigo-400 mt-0.5 block">
                        {run.decisions_made}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                      <span className="text-slate-500 text-[11px] block">Prices Updated</span>
                      <span className="text-base font-bold text-blue-400 mt-0.5 block">
                        {run.prices_updated}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                      <span className="text-slate-500 text-[11px] block">LLM Tokens</span>
                      <span className="text-base font-bold text-amber-400 mt-0.5 block">
                        {run.total_tokens_used?.toLocaleString() || 0}
                      </span>
                    </div>
                  </div>

                  {/* Error notifications */}
                  {run.errors && run.errors.length > 0 && (
                    <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/50 text-xs font-mono text-rose-300 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Execution Warnings / Errors:</span>
                      </div>
                      {run.errors.map((err, i) => (
                        <div key={i} className="text-rose-400 pl-5">
                          • {err}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
