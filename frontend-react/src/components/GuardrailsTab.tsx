import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  ExternalLink, 
  Server, 
  Cpu, 
  Lock,
  Layers,
  ArrowRight
} from 'lucide-react';
import { SchedulerStatus } from '../types';
import { api } from '../services/api';

interface GuardrailsTabProps {
  schedulerStatus: SchedulerStatus;
}

export const GuardrailsTab: React.FC<GuardrailsTabProps> = ({ schedulerStatus }) => {
  const [health, setHealth] = useState<{ status: string; scheduler_running: boolean; timestamp: string } | null>(null);

  useEffect(() => {
    api.checkHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  const strategies = [
    {
      name: 'Surge Pricing',
      icon: '🔥',
      color: 'border-red-800/40 bg-red-950/20 text-red-300',
      condition: 'Demand > 1.5× baseline & Inventory < 20% threshold',
      action: 'Increases price by +8% to +20% to maximize gross profit per unit.',
    },
    {
      name: 'Competitive Matching',
      icon: '⚔️',
      color: 'border-blue-800/40 bg-blue-950/20 text-blue-300',
      condition: 'Competitor lower than store price & store margin allows',
      action: 'Undercuts or matches competitor by 2–5% while guarding minimum margin floor.',
    },
    {
      name: 'Clearance Discount',
      icon: '🏷️',
      color: 'border-emerald-800/40 bg-emerald-950/20 text-emerald-300',
      condition: 'Inventory > 2× threshold & velocity < 0.5 units/day',
      action: 'Gradually reduces price by 5–15% to clear capital and reduce holding cost.',
    },
    {
      name: 'Demand-Based',
      icon: '📈',
      color: 'border-purple-800/40 bg-purple-950/20 text-purple-300',
      condition: 'Cart additions / pageviews surging above 7-day average',
      action: 'Adjusts price upward by +3% to +10% testing customer price elasticity.',
    },
    {
      name: 'Cost-Plus',
      icon: '💰',
      color: 'border-amber-800/40 bg-amber-950/20 text-amber-300',
      condition: 'Default fallback or zero external demand signals available',
      action: 'Guarantees standard target margin (Cost Price × 1.25).',
    },
  ];

  const guardrails = [
    {
      title: 'Margin Floor Guardrail',
      formula: 'Price ≥ Cost Price × 1.15',
      desc: 'No AI decision can ever set a price below a 15% gross profit margin. Enforced strictly at the Python validation layer.',
      status: 'Active & Verified',
    },
    {
      title: 'Velocity Shock Cap',
      formula: 'Max Jump / Drop: ±20%',
      desc: 'Prevents sudden market shocks or hallucinated volatility by restricting single-cycle price shifts to a maximum of 20%.',
      status: 'Active & Verified',
    },
    {
      title: 'Strategy-Direction Auto Correction',
      formula: 'Direction Validator (LLM Overrule)',
      desc: 'If OpenAI selects SURGE strategy but outputs a price decrease, the agent engine immediately overrules LLM and increases price by +8%.',
      status: 'Active & Verified',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner: Guardrail Engine Status */}
      <div className="rounded-2xl border border-emerald-800/50 bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-900 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Autonomous Pricing Guardrails & Safety Architecture</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-900/60 text-emerald-300 border border-emerald-700/60">
                100% ENFORCED
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Deterministic Python code-level validation rules that overrule LLM hallucinations before DB updates.
            </p>
          </div>
        </div>

        {/* Live Health Badge */}
        <div className="flex items-center gap-2 font-mono text-xs bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800">
          <Server className="w-4 h-4 text-blue-400" />
          <span className="text-slate-400">API Health:</span>
          <span className={health?.status === 'healthy' ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
            {health?.status ? health.status.toUpperCase() : 'CONNECTING...'}
          </span>
        </div>
      </div>

      {/* 3 Hard Guardrails Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
          Deterministic Guardrails (Code-Level Hard Rules)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {guardrails.map((g, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2.5 hover:border-slate-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-200">{g.title}</span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Enforced</span>
                </span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 text-xs font-mono text-blue-400 font-semibold">
                {g.formula}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">{g.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 5 Dynamic Pricing Strategies */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
          Autonomous Pricing Strategies (Agent Decision Matrix)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategies.map((s, i) => (
            <div
              key={i}
              className={`rounded-xl border p-4 space-y-2 transition-all ${s.color} hover:brightness-110`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{s.icon}</span>
                <span className="font-bold text-sm text-white">{s.name}</span>
              </div>
              <div className="text-xs text-slate-300 font-mono">
                <strong className="text-slate-200">Trigger:</strong> {s.condition}
              </div>
              <p className="text-xs text-slate-400 font-sans leading-relaxed pt-1">
                {s.action}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Observability & Diagnostic Stack */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-400 border-b border-slate-800 pb-2">
          Enterprise Observability & Microservices Architecture
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          {/* FastAPI */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500">FastAPI Backend</span>
            <div className="text-sm font-bold text-slate-200">Port 8000</div>
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline flex items-center gap-1 pt-1"
            >
              <span>Swagger API Docs</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Scheduler */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500">APScheduler</span>
            <div className="text-sm font-bold text-slate-200">
              {schedulerStatus.running ? 'Running (Interval 60m)' : 'Standby'}
            </div>
            <span className="text-slate-400 block pt-1">
              Active Jobs: {schedulerStatus.jobs?.length || 0}
            </span>
          </div>

          {/* Prometheus */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500">Prometheus Engine</span>
            <div className="text-sm font-bold text-cyan-400">Port 9090</div>
            <a
              href="http://localhost:9090"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:underline flex items-center gap-1 pt-1"
            >
              <span>Prometheus Web UI</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Grafana */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-500">Grafana Dashboards</span>
            <div className="text-sm font-bold text-amber-400">Port 3001</div>
            <a
              href="http://localhost:3001"
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:underline flex items-center gap-1 pt-1"
            >
              <span>Grafana 4-Pillars</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
