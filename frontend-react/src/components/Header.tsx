import React from 'react';
import { Play, RefreshCw, Zap, Clock, ExternalLink, Activity, ShieldCheck } from 'lucide-react';
import { AgentStatus, SchedulerStatus } from '../types';
import { GRAFANA_URL, PROMETHEUS_URL } from '../services/api';

interface HeaderProps {
  agentStatus: AgentStatus;
  schedulerStatus: SchedulerStatus;
  isRunningAgent: boolean;
  onRunAgent: () => Promise<void>;
  onRefresh: () => void;
  isRefreshing: boolean;
  autoRefreshInterval: number;
  setAutoRefreshInterval: (interval: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  agentStatus,
  schedulerStatus,
  isRunningAgent,
  onRunAgent,
  onRefresh,
  isRefreshing,
  autoRefreshInterval,
  setAutoRefreshInterval,
}) => {
  const isAgentActive = agentStatus.is_running || isRunningAgent;
  const nextJob = schedulerStatus.jobs?.[0];

  const formatNextRun = (dateStr?: string | null) => {
    if (!dateStr) return 'Not scheduled';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0d1220]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Status */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 shadow-lg shadow-blue-500/20">
            <Zap className="w-5 h-5 text-white" />
            {isAgentActive && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                TMLCStore
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                  AGENT v1.0
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400">Autonomous Dynamic Pricing & Competitor Intelligence Engine</p>
          </div>

          {/* Live Status Pill */}
          <div className="ml-2 hidden sm:flex items-center">
            {isAgentActive ? (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs font-mono font-medium animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>AGENT RUNNING</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 text-xs font-mono font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>AGENT IDLE</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Scheduler info badge */}
          {schedulerStatus.running && nextJob && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-400 font-mono">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Next Run:</span>
              <span className="text-slate-200 font-medium">{formatNextRun(nextJob.next_run)}</span>
            </div>
          )}

          {/* Observability quick links — only when the monitoring stack is reachable */}
          {(PROMETHEUS_URL || GRAFANA_URL) && (
          <div className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800">
            {PROMETHEUS_URL && (
            <a
              href={PROMETHEUS_URL}
              target="_blank"
              rel="noreferrer"
              title="Prometheus Metrics"
              className="px-2 py-1 text-xs text-slate-400 hover:text-cyan-400 hover:bg-slate-800/80 rounded transition-colors flex items-center gap-1 font-mono"
            >
              <Activity className="w-3 h-3 text-cyan-400" />
              <span>Prometheus</span>
            </a>
            )}
            {GRAFANA_URL && (
            <a
              href={GRAFANA_URL}
              target="_blank"
              rel="noreferrer"
              title="Grafana Observability Dashboard"
              className="px-2 py-1 text-xs text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 rounded transition-colors flex items-center gap-1 font-mono"
            >
              <ExternalLink className="w-3 h-3 text-amber-400" />
              <span>Grafana</span>
            </a>
            )}
          </div>
          )}

          {/* Auto Refresh dropdown */}
          <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300">
            <span className="text-slate-500 mr-1.5">Auto:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              aria-label="Auto refresh interval"
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value={0} className="bg-slate-900 text-slate-200">Off</option>
              <option value={5000} className="bg-slate-900 text-slate-200">5s</option>
              <option value={10000} className="bg-slate-900 text-slate-200">10s</option>
              <option value={30000} className="bg-slate-900 text-slate-200">30s</option>
            </select>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh All Data"
            aria-label="Refresh All Data"
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {/* Primary Run Agent Button */}
          <button
            onClick={onRunAgent}
            disabled={isAgentActive}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-xs sm:text-sm shadow-md transition-all ${
              isAgentActive
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/30 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0'
            }`}
          >
            {isAgentActive ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Running Agent...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Run Agent Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
