import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { Navigation, TabId } from './components/Navigation';
import { DashboardTab } from './components/DashboardTab';
import { ProductsTab } from './components/ProductsTab';
import { AgentRunsTab } from './components/AgentRunsTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { GuardrailsTab } from './components/GuardrailsTab';
import { ProductHistoryModal } from './components/ProductHistoryModal';
import { EditProductModal } from './components/EditProductModal';
import { AddProductModal } from './components/AddProductModal';
import { api } from './services/api';
import { 
  DashboardSummary, 
  DecisionStats, 
  PriceDecision, 
  Product, 
  AgentRun, 
  AgentStatus, 
  SchedulerStatus 
} from './types';
import { AlertTriangle, CheckCircle, RefreshCw, ServerOff } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  // Core Data States
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [stats, setStats] = useState<DecisionStats | null>(null);
  const [decisions, setDecisions] = useState<PriceDecision[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({ is_running: false, active_run_ids: [] });
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus>({ running: false, jobs: [] });

  // UI States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunningAgent, setIsRunningAgent] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10000); // 10s default
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Modals
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState<boolean>(false);

  const toastTimerRef = useRef<any>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

  // Fetch all live data from backend
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const [
        summaryRes,
        statsRes,
        decisionsRes,
        productsRes,
        runsRes,
        statusRes,
        schedulerRes,
      ] = await Promise.allSettled([
        api.getDashboardSummary(),
        api.getDecisionStats(),
        api.getDecisions(100),
        api.getProducts(),
        api.getAgentRuns(20),
        api.getAgentStatus(),
        api.getSchedulerStatus(),
      ]);

      let hasSuccess = false;

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value);
        hasSuccess = true;
      }
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (decisionsRes.status === 'fulfilled') setDecisions(decisionsRes.value);
      if (productsRes.status === 'fulfilled') setProducts(productsRes.value);
      if (runsRes.status === 'fulfilled') setRuns(runsRes.value);
      if (statusRes.status === 'fulfilled') setAgentStatus(statusRes.value);
      if (schedulerRes.status === 'fulfilled') setSchedulerStatus(schedulerRes.value);

      setApiConnected(hasSuccess);
    } catch (err) {
      console.error('Failed to load pricing dashboard data:', err);
      setApiConnected(false);
    } finally {
      if (!isSilent) setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      loadData(true);
    }, autoRefreshInterval);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, loadData]);

  // Trigger manual agent run
  const handleRunAgent = async (productId?: string) => {
    try {
      setIsRunningAgent(true);
      const res = await api.triggerAgentRun('manual', productId);
      showToast(res.message || 'AI Dynamic Pricing run initiated!', 'success');
      // Optimistically update agent status
      setAgentStatus({ is_running: true, active_run_ids: [res.run_id] });
      // Poll a few times after starting
      setTimeout(() => loadData(true), 2000);
      setTimeout(() => loadData(true), 6000);
    } catch (err: any) {
      showToast(err.message || 'Failed to trigger agent run', 'error');
    } finally {
      setIsRunningAgent(false);
    }
  };

  // Product edit success handler
  const handleProductUpdated = (updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingProduct(null);
    showToast(`Updated pricing & limits for ${updated.name}`, 'success');
    loadData(true);
  };

  const selectedProductForHistory = products.find((p) => p.id === historyProductId) || null;
  const lowStockCount = products.filter((p) => p.inventory_count <= p.inventory_threshold).length;

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border animate-bounce font-mono text-xs text-white"
          style={{
            backgroundColor: toast.type === 'error' ? '#881337' : toast.type === 'info' ? '#1e3a8a' : '#064e3b',
            borderColor: toast.type === 'error' ? '#f43f5e' : toast.type === 'info' ? '#3b82f6' : '#10b981',
          }}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-300" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-300" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* API Disconnected Notice */}
      {apiConnected === false && (
        <div className="bg-amber-950/80 border-b border-amber-800/80 px-4 py-2.5 text-xs font-mono text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ServerOff className="w-4 h-4 text-amber-400" />
            <span>
              <strong>Backend Disconnected:</strong> FastAPI backend is not responding on port 8000. Start it via <code className="bg-slate-900 px-1 py-0.5 rounded text-white">uvicorn backend.main:app --port 8000</code> to receive real-time AI updates.
            </span>
          </div>
          <button
            onClick={() => loadData(false)}
            className="px-2.5 py-1 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-100 font-semibold transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Top Header */}
      <Header
        agentStatus={agentStatus}
        schedulerStatus={schedulerStatus}
        isRunningAgent={isRunningAgent}
        onRunAgent={() => handleRunAgent()}
        onRefresh={() => loadData(false)}
        isRefreshing={isRefreshing}
        autoRefreshInterval={autoRefreshInterval}
        setAutoRefreshInterval={setAutoRefreshInterval}
      />

      {/* Tab Navigation */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        productsCount={products.length}
        lowStockCount={lowStockCount}
        runsCount={runs.length}
        isAgentRunning={agentStatus.is_running || isRunningAgent}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <DashboardTab
            summary={summary}
            stats={stats}
            decisions={decisions}
            products={products}
            onSelectProductHistory={(id) => setHistoryProductId(id)}
            onNavigateToProducts={() => setActiveTab('products')}
            onRunAgent={() => handleRunAgent()}
            isAgentRunning={agentStatus.is_running || isRunningAgent}
          />
        )}

        {activeTab === 'products' && (
          <ProductsTab
            products={products}
            onSelectProductHistory={(id) => setHistoryProductId(id)}
            onEditProduct={(p) => setEditingProduct(p)}
            onOptimizeProduct={(id) => handleRunAgent(id)}
            onAddProduct={() => setIsAddingProduct(true)}
            isAgentRunning={agentStatus.is_running || isRunningAgent}
          />
        )}

        {activeTab === 'runs' && (
          <AgentRunsTab
            runs={runs}
            agentStatus={agentStatus}
            products={products}
            onTriggerRun={(id) => handleRunAgent(id)}
            isTriggering={isRunningAgent}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab
            decisions={decisions}
            products={products}
            stats={stats}
          />
        )}

        {activeTab === 'guardrails' && (
          <GuardrailsTab
            schedulerStatus={schedulerStatus}
          />
        )}
      </main>

      {/* Add Product Modal */}
      {isAddingProduct && (
        <AddProductModal
          onClose={() => setIsAddingProduct(false)}
          onSuccess={(newProd) => {
            setProducts((prev) => [newProd, ...prev]);
            setIsAddingProduct(false);
            showToast(`Added ${newProd.name} to catalog!`, 'success');
            loadData(true);
          }}
        />
      )}

      {/* Price History Modal */}
      {historyProductId && (
        <ProductHistoryModal
          productId={historyProductId}
          product={selectedProductForHistory}
          onClose={() => setHistoryProductId(null)}
        />
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={handleProductUpdated}
        />
      )}
    </div>
  );
};

export default App;
