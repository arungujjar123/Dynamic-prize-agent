import React from 'react';
import { LayoutDashboard, Package, Bot, BarChart3, ShieldCheck } from 'lucide-react';

export type TabId = 'dashboard' | 'products' | 'runs' | 'analytics' | 'guardrails';

interface NavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  productsCount: number;
  lowStockCount: number;
  runsCount: number;
  isAgentRunning: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  productsCount,
  lowStockCount,
  runsCount,
  isAgentRunning,
}) => {
  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: React.ReactNode }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'products',
      label: 'Products Catalog',
      icon: <Package className="w-4 h-4" />,
      badge: (
        <div className="flex items-center gap-1">
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
            {productsCount}
          </span>
          {lowStockCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-950/80 text-rose-300 border border-rose-800/40" title={`${lowStockCount} items low on stock`}>
              {lowStockCount} low
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'runs',
      label: 'Agent Runs',
      icon: <Bot className="w-4 h-4" />,
      badge: isAgentRunning ? (
        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 animate-pulse border border-amber-500/30">
          Running
        </span>
      ) : (
        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
          {runsCount}
        </span>
      ),
    },
    {
      id: 'analytics',
      label: 'Analytics & Insights',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: 'guardrails',
      label: 'Guardrails & System',
      icon: <ShieldCheck className="w-4 h-4" />,
      badge: (
        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
          Enforced
        </span>
      ),
    },
  ];

  return (
    <nav className="bg-[#0c101d] border-b border-slate-800/60 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-2 overflow-x-auto py-2.5 no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <span className={isActive ? 'text-blue-400' : 'text-slate-500'}>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && <span className="ml-1">{tab.badge}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
