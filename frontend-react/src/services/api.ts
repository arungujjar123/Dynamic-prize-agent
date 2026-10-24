import {
  Product,
  PriceDecision,
  DecisionStats,
  AgentRun,
  AgentStatus,
  DashboardSummary,
  SchedulerStatus
} from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/api/v1';
const API_KEY = (import.meta as any).env?.VITE_API_KEY;

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // ignore
      }
      throw new Error(errorJson?.detail || errorText || `HTTP ${res.status} ${res.statusText}`);
    }

    return await res.json();
  } catch (error: any) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

export const api = {
  // Dashboard & Analytics
  async getDashboardSummary(): Promise<DashboardSummary> {
    return request<DashboardSummary>('/analytics/dashboard');
  },

  async getDecisionStats(): Promise<DecisionStats> {
    return request<DecisionStats>('/decisions/stats');
  },

  // Decisions
  async getDecisions(limit = 100): Promise<PriceDecision[]> {
    return request<PriceDecision[]>(`/decisions/?limit=${limit}`);
  },

  // Products
  async getProducts(): Promise<Product[]> {
    return request<Product[]>('/products/');
  },

  async getProduct(id: string): Promise<Product> {
    return request<Product>(`/products/${id}`);
  },

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    return request<Product>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async createProduct(data: Omit<Product, 'gross_margin_pct' | 'updated_at'>): Promise<Product> {
    return request<Product>('/products/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getProductPriceHistory(productId: string, limit = 50): Promise<PriceDecision[]> {
    return request<PriceDecision[]>(`/products/${productId}/price-history?limit=${limit}`);
  },

  // Agent Control & Monitoring
  async getAgentStatus(): Promise<AgentStatus> {
    return request<AgentStatus>('/agent/status');
  },

  async getAgentRuns(limit = 20): Promise<AgentRun[]> {
    return request<AgentRun[]>(`/agent/runs?limit=${limit}`);
  },

  async triggerAgentRun(triggeredBy = 'manual', productId?: string): Promise<{ status: string; run_id: string; message: string }> {
    return request('/agent/run', {
      method: 'POST',
      body: JSON.stringify({
        triggered_by: triggeredBy,
        ...(productId ? { product_id: productId } : {}),
      }),
    });
  },

  async getSchedulerStatus(): Promise<SchedulerStatus> {
    return request<SchedulerStatus>('/scheduler/status');
  },

  async checkHealth(): Promise<{ status: string; scheduler_running: boolean; timestamp: string }> {
    // /health lives at the backend root, next to /api/v1 (works for relative and absolute API_BASE)
    const res = await fetch(`${API_BASE.replace(/\/api\/v1\/?$/, '')}/health`);
    return res.json();
  }
};
