import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  History, 
  Edit3, 
  Bot, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUpDown,
  TrendingUp,
  Percent,
  Plus
} from 'lucide-react';
import { Product } from '../types';

interface ProductsTabProps {
  products: Product[];
  onSelectProductHistory: (productId: string) => void;
  onEditProduct: (product: Product) => void;
  onOptimizeProduct: (productId: string) => void;
  onAddProduct: () => void;
  isAgentRunning: boolean;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  products,
  onSelectProductHistory,
  onEditProduct,
  onOptimizeProduct,
  onAddProduct,
  isAgentRunning,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'NORMAL'>('ALL');
  const [sortBy, setSortBy] = useState<'margin' | 'price' | 'inventory' | 'name'>('margin');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered & Sorted products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesSearch =
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesCategory =
          categoryFilter === 'ALL' || (p.category && p.category.toUpperCase() === categoryFilter.toUpperCase());

        const isLow = p.inventory_count <= p.inventory_threshold;
        const matchesStock =
          stockFilter === 'ALL' || (stockFilter === 'LOW' && isLow) || (stockFilter === 'NORMAL' && !isLow);

        return matchesSearch && matchesCategory && matchesStock;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'margin') diff = (a.gross_margin_pct ?? 0) - (b.gross_margin_pct ?? 0);
        else if (sortBy === 'price') diff = a.current_price - b.current_price;
        else if (sortBy === 'inventory') diff = a.inventory_count - b.inventory_count;
        else if (sortBy === 'name') diff = a.name.localeCompare(b.name);

        return sortDirection === 'desc' ? -diff : diff;
      });
  }, [products, searchTerm, categoryFilter, stockFilter, sortBy, sortDirection]);

  const toggleSort = (field: 'margin' | 'price' | 'inventory' | 'name') => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by product name, SKU, or category..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL" className="bg-slate-900">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat} className="bg-slate-900">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
            <span className="text-slate-500">Stock:</span>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              aria-label="Filter by stock status"
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL" className="bg-slate-900">All Inventory</option>
              <option value="LOW" className="bg-slate-900">⚠️ Low Stock Only</option>
              <option value="NORMAL" className="bg-slate-900">Healthy Stock</option>
            </select>
          </div>

          {/* Results Counter */}
          <div className="text-xs font-mono text-slate-400 px-2 py-1">
            Showing <span className="text-blue-400 font-bold">{filteredProducts.length}</span> of {products.length}
          </div>

          {/* Add Product Button */}
          <button
            onClick={onAddProduct}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-sm shadow-blue-600/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead>
            <tr className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
              <th className="py-3 px-4">
                <button
                  onClick={() => toggleSort('name')}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span>Product & SKU</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-4">Cost Price</th>
              <th className="py-3 px-4">
                <button
                  onClick={() => toggleSort('price')}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span>Current Price</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-4">Price Bounds</th>
              <th className="py-3 px-4">
                <button
                  onClick={() => toggleSort('margin')}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span>Gross Margin</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-4">
                <button
                  onClick={() => toggleSort('inventory')}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span>Inventory</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-4">Competitors</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredProducts.map((p) => {
              const isLowStock = p.inventory_count <= p.inventory_threshold;
              const margin = p.gross_margin_pct ?? 0;
              const marginColor =
                margin >= 30
                  ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
                  : margin >= 15
                  ? 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                  : 'text-rose-400 bg-rose-950/40 border-rose-800/40';

              return (
                <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                  {/* Name & SKU */}
                  <td className="py-3.5 px-4 font-sans">
                    <div className="font-semibold text-sm text-slate-100">{p.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                      <span>{p.sku}</span>
                      <span>•</span>
                      <span className="text-slate-400">{p.category || 'General'}</span>
                    </div>
                  </td>

                  {/* Cost Price */}
                  <td className="py-3.5 px-4 font-mono text-slate-400">
                    ${p.cost_price.toFixed(2)}
                  </td>

                  {/* Current Price */}
                  <td className="py-3.5 px-4 font-mono font-bold text-sm text-blue-400">
                    ${p.current_price.toFixed(2)}
                  </td>

                  {/* Bounds */}
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                    <span>${p.min_price.toFixed(2)}</span>
                    <span className="mx-1 text-slate-600">—</span>
                    <span>${p.max_price.toFixed(2)}</span>
                  </td>

                  {/* Gross Margin */}
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-semibold border ${marginColor}`}
                    >
                      <Percent className="w-3 h-3" />
                      <span>{margin.toFixed(1)}%</span>
                    </span>
                  </td>

                  {/* Inventory */}
                  <td className="py-3.5 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {isLowStock ? (
                          <span className="inline-flex items-center gap-1 text-xs text-rose-400 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            <span>{p.inventory_count} units</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{p.inventory_count} units</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">Threshold: {p.inventory_threshold}</div>
                    </div>
                  </td>

                  {/* Competitor Links */}
                  <td className="py-3.5 px-4">
                    {p.competitor_urls && p.competitor_urls.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2 py-0.5 rounded">
                        <span>{p.competitor_urls.length} tracked</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-600">None</span>
                    )}
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onSelectProductHistory(p.id)}
                        title="View Price History & Reasoning"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      >
                        <History className="w-4 h-4 text-blue-400" />
                      </button>
                      <button
                        onClick={() => onEditProduct(p)}
                        title="Edit Price & Thresholds"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-indigo-400" />
                      </button>
                      <button
                        onClick={() => onOptimizeProduct(p.id)}
                        disabled={isAgentRunning}
                        title="Run Agent for this product"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors disabled:opacity-40"
                      >
                        <Bot className="w-4 h-4 text-cyan-400 hover:text-white" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
