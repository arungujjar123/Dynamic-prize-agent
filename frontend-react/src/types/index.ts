export interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string | null;
  cost_price: number;
  current_price: number;
  min_price: number;
  max_price: number;
  inventory_count: number;
  inventory_threshold: number;
  is_active: boolean;
  competitor_urls: string[];
  gross_margin_pct: number;
  updated_at?: string | null;
}

export type PricingStrategy =
  | 'surge'
  | 'competitive'
  | 'clearance'
  | 'demand_based'
  | 'cost_plus';

export interface PriceDecision {
  id: string;
  product_id: string;
  old_price: number;
  new_price: number;
  price_change_pct: number | null;
  strategy: PricingStrategy | string | null;
  reasoning?: string | null;
  confidence_score?: number | null;
  applied: boolean;
  created_at: string | null;
}

export interface DecisionStats {
  total: number;
  increases?: number;
  decreases?: number;
  holds?: number;
  avg_change_pct?: number;
  avg_confidence?: number;
  by_strategy?: Record<string, number>;
}

export interface AgentRun {
  id: string;
  status: 'completed' | 'running' | 'failed' | string | null;
  products_processed: number;
  decisions_made: number;
  prices_updated: number;
  errors: string[];
  total_tokens_used: number;
  duration_seconds: number;
  triggered_by?: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface AgentStatus {
  is_running: boolean;
  active_run_ids: string[];
}

export interface DashboardSummary {
  active_products: number;
  total_decisions: number;
  recent_runs: number;
  estimated_revenue_impact: number;
  avg_margin_pct: number;
  low_stock_products: number;
  last_run?: AgentRun | null;
}

export interface SchedulerJob {
  id: string;
  name: string;
  next_run?: string | null;
}

export interface SchedulerStatus {
  running: boolean;
  jobs: SchedulerJob[];
}
