import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, ShieldCheck, Check } from 'lucide-react';
import { Product } from '../types';
import { api } from '../services/api';
import { formatINR } from '../utils/format';

interface EditProductModalProps {
  product: Product | null;
  onClose: () => void;
  onSuccess: (updated: Product) => void;
}

export const EditProductModal: React.FC<EditProductModalProps> = ({
  product,
  onClose,
  onSuccess,
}) => {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [inventoryCount, setInventoryCount] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [competitorUrls, setCompetitorUrls] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setCurrentPrice(product.current_price);
      setMinPrice(product.min_price);
      setMaxPrice(product.max_price);
      setInventoryCount(product.inventory_count);
      setIsActive(product.is_active);
      setCompetitorUrls((product.competitor_urls ?? []).join('\n'));
      setError(null);
    }
  }, [product]);

  if (!product) return null;

  // Real-time Margin calculation
  const calculatedMargin = currentPrice > 0 ? ((currentPrice - product.cost_price) / currentPrice) * 100 : 0;
  const isBelowFloor = calculatedMargin < 15;
  const isOutOfRange = currentPrice < minPrice || currentPrice > maxPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const updated = await api.updateProduct(product.id, {
        current_price: Number(currentPrice),
        min_price: Number(minPrice),
        max_price: Number(maxPrice),
        inventory_count: Number(inventoryCount),
        is_active: isActive,
        competitor_urls: competitorUrls
          .split('\n')
          .map((u) => u.trim())
          .filter(Boolean),
      });
      onSuccess(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0f172a] border border-slate-800 shadow-2xl p-6 text-slate-100 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Edit Product & Bounds</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {product.name} ({product.sku})
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
          <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Static Info: Cost Price */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Fixed Cost Price:</span>
            <span className="text-slate-200 font-bold">{formatINR(product.cost_price)}</span>
          </div>

          {/* Current Price & Live Margin */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
              <span>Current Price (₹)</span>
              <span
                className={`font-semibold ${
                  isBelowFloor ? 'text-rose-400' : calculatedMargin > 30 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                Live Margin: {calculatedMargin.toFixed(1)}%
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={currentPrice}
              onChange={(e) => setCurrentPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm font-mono text-blue-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Margin Guardrail Warning */}
          {isBelowFloor && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-[11px] text-rose-300 flex items-center gap-2 font-mono">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Warning: Margin is below the 15% guardrail floor ({formatINR(product.cost_price * 1.15)}).</span>
            </div>
          )}

          {isOutOfRange && (
            <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-[11px] text-amber-300 flex items-center gap-2 font-mono">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Current price is outside min/max bounds.</span>
            </div>
          )}

          {/* Min & Max Price Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Min Allowed Price (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={minPrice}
                onChange={(e) => setMinPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">Max Allowed Price (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={maxPrice}
                onChange={(e) => setMaxPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Inventory Count */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-400 flex items-center justify-between">
              <span>Inventory Count (Units)</span>
              <span className="text-[11px] text-slate-500">Threshold: {product.inventory_threshold}</span>
            </label>
            <input
              type="number"
              step="1"
              required
              value={inventoryCount}
              onChange={(e) => setInventoryCount(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Competitor product pages scraped via Apify */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-400 flex items-center justify-between">
              <span>Competitor URLs (one per line)</span>
              <span className="text-[11px] text-slate-500">Amazon.in / Flipkart product pages</span>
            </label>
            <textarea
              rows={3}
              value={competitorUrls}
              onChange={(e) => setCompetitorUrls(e.target.value)}
              placeholder={'https://www.amazon.in/dp/...\nhttps://www.flipkart.com/.../p/itm...'}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-200 focus:outline-none focus:border-blue-500 resize-y"
            />
          </div>

          {/* Active Switch */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer w-4 h-4"
            />
            <label htmlFor="isActiveCheck" className="text-xs text-slate-300 cursor-pointer font-mono">
              Product is active for automated AI pricing
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-md shadow-blue-600/30 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
