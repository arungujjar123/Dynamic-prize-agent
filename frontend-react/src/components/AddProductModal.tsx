import React, { useState } from 'react';
import { X, Plus, AlertTriangle, Check, Sparkles } from 'lucide-react';
import { Product } from '../types';
import { api } from '../services/api';
import { formatINR } from '../utils/format';

interface AddProductModalProps {
  onClose: () => void;
  onSuccess: (product: Product) => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [costPrice, setCostPrice] = useState<number>(50);
  const [currentPrice, setCurrentPrice] = useState<number>(75);
  const [minPrice, setMinPrice] = useState<number>(60);
  const [maxPrice, setMaxPrice] = useState<number>(100);
  const [inventoryCount, setInventoryCount] = useState<number>(25);
  const [inventoryThreshold, setInventoryThreshold] = useState<number>(10);
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [competitorUrls, setCompetitorUrls] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto generate ID and SKU when name changes
  const handleNameChange = (val: string) => {
    setName(val);
    if (!sku) {
      const generatedSku = val
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '-')
        .slice(0, 10);
      setSku(generatedSku ? `SKU-${generatedSku}` : '');
    }
  };

  const handleAddUrl = () => {
    if (competitorUrl.trim()) {
      setCompetitorUrls([...competitorUrls, competitorUrl.trim()]);
      setCompetitorUrl('');
    }
  };

  const handleRemoveUrl = (index: number) => {
    setCompetitorUrls(competitorUrls.filter((_, i) => i !== index));
  };

  // Real-time margin
  const calculatedMargin = currentPrice > 0 ? ((currentPrice - costPrice) / currentPrice) * 100 : 0;
  const isBelowFloor = calculatedMargin < 15;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const productId = `prod_${Date.now()}`;

    try {
      const created = await api.createProduct({
        id: productId,
        name,
        sku: sku || `SKU-${productId.slice(-6)}`,
        category: category || 'General',
        cost_price: Number(costPrice),
        current_price: Number(currentPrice),
        min_price: Number(minPrice),
        max_price: Number(maxPrice),
        inventory_count: Number(inventoryCount),
        inventory_threshold: Number(inventoryThreshold),
        is_active: true,
        competitor_urls: competitorUrls,
      });

      onSuccess(created);
    } catch (err: any) {
      setError(err.message || 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0f172a] border border-slate-800 shadow-2xl p-6 text-slate-100 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-400" />
              <span>Add New Product to Catalog</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Product will be tracked by the Autonomous AI Pricing Agent
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2 font-mono">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          {/* Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-300">Product Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Wireless Noise Canceling Headphones"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-300">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Electronics, Footwear"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* SKU */}
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-300">SKU (Stock Keeping Unit)</label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. SKU-WH-1000XM5"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Pricing Row: Cost, Current Price, Margin */}
          <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
            <div className="space-y-1">
              <label className="text-slate-400">Cost Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={costPrice}
                onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-slate-400">Current Price (₹) *</label>
                <span className={`font-bold ${isBelowFloor ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {calculatedMargin.toFixed(1)}% Margin
                </span>
              </div>
              <input
                type="number"
                step="0.01"
                required
                value={currentPrice}
                onChange={(e) => setCurrentPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-blue-400 font-bold focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {isBelowFloor && (
            <div className="p-2 rounded bg-rose-950/40 border border-rose-800/40 text-[11px] text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Warning: Margin is below 15% floor ({formatINR(costPrice * 1.15)}). Agent will auto-correct.</span>
            </div>
          )}

          {/* Bounds: Min Price & Max Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-400">Min Price Floor (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={minPrice}
                onChange={(e) => setMinPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400">Max Price Ceiling (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={maxPrice}
                onChange={(e) => setMaxPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Inventory & Threshold */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-400">Initial Inventory (Units)</label>
              <input
                type="number"
                step="1"
                required
                value={inventoryCount}
                onChange={(e) => setInventoryCount(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400">Low Stock Threshold</label>
              <input
                type="number"
                step="1"
                required
                value={inventoryThreshold}
                onChange={(e) => setInventoryThreshold(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Competitor URLs */}
          <div className="space-y-1.5">
            <label className="text-slate-400">Competitor Product URLs (For AI Scraping)</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={competitorUrl}
                onChange={(e) => setCompetitorUrl(e.target.value)}
                placeholder="https://competitor.com/product/..."
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAddUrl}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Add URL
              </button>
            </div>
            {competitorUrls.length > 0 && (
              <div className="space-y-1 pt-1">
                {competitorUrls.map((url, i) => (
                  <div key={i} className="flex items-center justify-between p-1.5 rounded bg-slate-950 border border-slate-800/80 text-[11px]">
                    <span className="truncate max-w-sm text-slate-300">{url}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveUrl(i)}
                      className="text-rose-400 hover:text-rose-300 ml-2"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-600/30 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{saving ? 'Creating Product...' : 'Create & Monitor Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
