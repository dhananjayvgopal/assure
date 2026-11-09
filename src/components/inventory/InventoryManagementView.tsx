/**
 * Retail Inventory Tools & Physical Audit Management
 * Low-stock threshold alerts, supplier restocking, damage write-offs,
 * and USB barcode scanner physical audit cycle counts.
 */

import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import { garmentColorHex } from '../../utils/garmentColor';
import { formatDateTimeDisplay } from '../../utils/dateFormat';
import { StockAdjustment } from '../../types/pos';
import { BarcodeHangtagPrinter } from './BarcodeHangtagPrinter';
import {
  Boxes,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Barcode,
  Tag,
  Download,
  Plus,
  Minus,
  Search,
  FileText,
  Printer,
  ClipboardList,
} from 'lucide-react';

export const InventoryManagementView: React.FC = () => {
  const {
    products,
    adjustments,
    adjustStock,
    batchAuditCount,
    lowStockItems,
    settings,
    hasPermission,
  } = usePOS();

  // Active view sub-tab: 'low_stock' | 'adjust' | 'audit' | 'history'
  const [activeSubTab, setActiveSubTab] = useState<'low_stock' | 'adjust' | 'audit' | 'history'>(
    lowStockItems.length > 0 ? 'low_stock' : 'adjust'
  );

  // Hangtag printer modal state
  const [isTagPrinterOpen, setIsTagPrinterOpen] = useState(false);

  // Stock Adjustment Form States
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [adjQty, setAdjQty] = useState<number>(5);
  const [adjType, setAdjType] = useState<StockAdjustment['type']>('restock');
  const [adjReason, setAdjReason] = useState<string>('Supplier shipment received');
  const [stockScanInput, setStockScanInput] = useState('');
  const [scannedStockVariantId, setScannedStockVariantId] = useState('');
  const [stockScanError, setStockScanError] = useState('');
  const [receiveQty, setReceiveQty] = useState(1);
  const [receiveReason, setReceiveReason] = useState('Supplier delivery received');

  // Physical Audit Mode States
  const [auditScanInput, setAuditScanInput] = useState<string>('');
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});
  const [isAuditActive, setIsAuditActive] = useState<boolean>(false);

  // Flattened all variants list for selectors
  const allVariants = useMemo(() => {
    const list: {
      productId: string;
      productName: string;
      variantId: string;
      sku: string;
      barcode: string;
      size: string;
      color: string;
      stock: number;
    }[] = [];
    products.forEach((p) => {
      p.variants.forEach((v) => {
        list.push({
          productId: p.id,
          productName: p.name,
          variantId: v.id,
          sku: v.sku,
          barcode: v.barcode,
          size: v.size,
          color: v.color,
          stock: v.stock,
        });
      });
    });
    return list;
  }, [products]);

  // Set initial selected variant
  if (!selectedVariantId && allVariants.length > 0) {
    setSelectedVariantId(allVariants[0].variantId);
  }

  // Handle single adjustment submit
  const handleApplyAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId) return;

    const qty = adjType === 'restock' || adjType === 'return_restock' ? Math.abs(adjQty) : -Math.abs(adjQty);
    adjustStock(selectedVariantId, qty, adjType, adjReason);

    alert('Stock adjustment recorded successfully.');
    setAdjQty(5);
    setAdjReason('');
  };

  const handleStockBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = stockScanInput.trim().toUpperCase();
    if (!code) return;
    const match = allVariants.find((variant) =>
      variant.barcode.trim().toUpperCase() === code || variant.sku.trim().toUpperCase() === code
    );
    if (!match) {
      setScannedStockVariantId('');
      setStockScanError(`No garment variant matches “${stockScanInput.trim()}”. Check the tag or add this barcode to a garment first.`);
      return;
    }
    setScannedStockVariantId(match.variantId);
    setStockScanError('');
    setStockScanInput('');
  };

  const handleReceiveScannedStock = (e: React.FormEvent) => {
    e.preventDefault();
    const variant = allVariants.find((item) => item.variantId === scannedStockVariantId);
    if (!variant) return setStockScanError('Scan a known garment barcode before receiving stock.');
    if (!Number.isSafeInteger(receiveQty) || receiveQty < 1 || receiveQty > 100000) {
      return setStockScanError('Enter a whole number from 1 to 100,000.');
    }
    const newStock = variant.stock + receiveQty;
    if (!window.confirm(`Confirm stock intake\n\n${variant.productName}\n${variant.color} / Size ${variant.size}\nBarcode: ${variant.barcode || variant.sku}\nCurrent stock: ${variant.stock}\nAdd: ${receiveQty}\nNew stock: ${newStock}\n\nContinue?`)) return;
    adjustStock(variant.variantId, receiveQty, 'restock', receiveReason.trim() || 'Barcode stock intake');
    setScannedStockVariantId('');
    setReceiveQty(1);
    setReceiveReason('Supplier delivery received');
    setStockScanError('');
  };

  // Start physical audit
  const handleStartAudit = () => {
    // Initialize audit counts with current stock
    const initial: Record<string, number> = {};
    allVariants.forEach((v) => {
      initial[v.variantId] = v.stock;
    });
    setAuditCounts(initial);
    setIsAuditActive(true);
  };

  // Handle barcode scanned during physical audit
  const handleAuditScan = (e: React.FormEvent) => {
    e.preventDefault();
    const query = auditScanInput.trim();
    if (!query) return;

    const match = allVariants.find(
      (v) => v.barcode === query || v.sku.toUpperCase() === query.toUpperCase()
    );

    if (match) {
      setAuditCounts((prev) => ({
        ...prev,
        [match.variantId]: (prev[match.variantId] || 0) + 1,
      }));
      setAuditScanInput('');
    } else {
      alert(`Barcode "${query}" not found in garment catalog.`);
    }
  };

  // Commit physical audit results
  const handleCommitAudit = () => {
    const results = Object.entries(auditCounts).map(([variantId, count]) => ({
      variantId,
      actualCount: count,
      reason: 'Physical cycle count verified by inventory staff',
    }));

    batchAuditCount(results);
    setIsAuditActive(false);
    alert('Physical cycle count synchronized into database.');
  };

  // Export reorder CSV
  const handleExportReorderCSV = () => {
    const rows = [
      ['Garment Name', 'SKU', 'Barcode', 'Size', 'Color', 'Current Stock', 'Reorder Threshold', 'Suggested Order Qty']
    ];

    lowStockItems.forEach(({ product, variant }) => {
      const suggested = Math.max(10, (variant.minStockThreshold || 4) * 3 - variant.stock);
      rows.push([
        `"${product.name.replace(/"/g, '""')}"`,
        variant.sku,
        variant.barcode,
        variant.size,
        variant.color,
        variant.stock.toString(),
        (variant.minStockThreshold || settings.lowStockThresholdDefault).toString(),
        suggested.toString(),
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reorder_sheet_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="inventory-view" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-stone-200">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Inventory Operations & Audits</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Monitor low-stock thresholds, record damage/restock adjustments, and perform physical barcode audits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTagPrinterOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 border border-stone-300 rounded transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Price Tags</span>
          </button>
        </div>
      </div>

      {/* Sub Navigation Controls */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
        <button
          onClick={() => setActiveSubTab('low_stock')}
          className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'low_stock'
              ? 'bg-stone-900 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Low-Stock Alerts</span>
          {lowStockItems.length > 0 && (
            <span className="font-mono text-[11px] bg-amber-500 text-stone-950 px-1.5 py-0.2 rounded font-bold">
              {lowStockItems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('adjust')}
          className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'adjust'
              ? 'bg-stone-900 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Stock Adjustments</span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'audit'
              ? 'bg-stone-900 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Physical Cycle Count</span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'history'
              ? 'bg-stone-900 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Adjustment Logs ({adjustments.length})</span>
        </button>
      </div>

      {/* SUB-VIEW 1: LOW-STOCK ALERTS */}
      {activeSubTab === 'low_stock' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-amber-50/80 border border-amber-200 p-4 rounded text-xs text-amber-950">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <span className="font-bold block">
                  {lowStockItems.length} Garment Variant{lowStockItems.length === 1 ? '' : 's'} Require Restocking
                </span>
                <span className="text-amber-800">
                  Inventory is at or below defined minimum threshold level. Reorder from supplier to avoid lost retail sales.
                </span>
              </div>
            </div>
            {lowStockItems.length > 0 && (
              <button
                onClick={handleExportReorderCSV}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Reorder PO</span>
              </button>
            )}
          </div>

          <div className="bg-white border border-stone-200 rounded overflow-hidden">
            {lowStockItems.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">
                All garment variants are adequately stocked above threshold levels.
              </div>
            ) : (
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[11px]">
                    <th className="py-2.5 px-4 font-medium font-sans">Garment Style</th>
                    <th className="py-2.5 px-4 font-medium">SKU / Barcode</th>
                    <th className="py-2.5 px-4 font-medium font-sans">Color & Size</th>
                    <th className="py-2.5 px-4 font-medium text-right">Current Stock</th>
                    <th className="py-2.5 px-4 font-medium text-right">Min Threshold</th>
                    <th className="py-2.5 px-4 font-medium text-right font-sans">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {lowStockItems.map(({ product, variant }) => (
                    <tr key={variant.id} className="hover:bg-stone-50/80">
                      <td className="py-3 px-4 font-sans font-semibold text-stone-900">
                        {product.name}
                        <span className="text-[10px] text-stone-400 block font-mono">
                          {product.brand} · {product.styleCode}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-800">{variant.sku}</div>
                        <div className="text-[10px] text-stone-500">{variant.barcode}</div>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-stone-300"
                            style={{ backgroundColor: garmentColorHex(variant.color, variant.colorHex, '#ccc') }}
                          />
                          <span>{variant.color}</span>
                          <span className="font-mono font-bold text-stone-900 ml-1">
                            Size {variant.size}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-rose-600">
                        {variant.stock} left
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-stone-500">
                        {variant.minStockThreshold || settings.lowStockThresholdDefault} units
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          onClick={() => {
                            setSelectedVariantId(variant.id);
                            setActiveSubTab('adjust');
                            setAdjType('restock');
                            setAdjQty(12);
                            setAdjReason(`Restock PO for low-stock ${variant.sku}`);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded cursor-pointer"
                        >
                          Quick Restock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: STOCK ADJUSTMENTS FORM */}
      {activeSubTab === 'adjust' && (
        <div className="space-y-5">
        <section className="max-w-2xl bg-white border border-amber-300 rounded-lg p-5 shadow-2xs">
          <h3 className="font-bold text-sm text-stone-900 flex items-center gap-2"><Barcode className="w-4 h-4 text-amber-700"/>Add Stock by Barcode</h3>
          <p className="text-xs text-stone-500 mt-1 mb-4">Scan a garment’s barcode to select its exact size and color variant, then confirm the incoming quantity.</p>
          <form onSubmit={handleStockBarcodeScan} className="flex gap-2">
            <input autoComplete="off" value={stockScanInput} onChange={(e) => { setStockScanInput(e.target.value); setStockScanError(''); }} placeholder="Scan barcode or type barcode / SKU" aria-label="Scan garment barcode to receive stock" className="min-w-0 flex-1 rounded border border-stone-300 px-3 py-2 text-sm font-mono" />
            <button type="submit" className="rounded bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800">Find Garment</button>
          </form>
          {stockScanError && <p role="alert" className="mt-2 rounded bg-rose-50 p-2 text-xs text-rose-700">{stockScanError}</p>}
          {scannedStockVariantId && (() => {
            const match = allVariants.find((item) => item.variantId === scannedStockVariantId);
            if (!match) return null;
            return <form onSubmit={handleReceiveScannedStock} className="mt-4 space-y-3 rounded border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><div className="text-sm font-bold text-stone-900">{match.productName}</div><div className="mt-1 text-xs text-stone-600">{match.color} · Size {match.size}</div><div className="mt-1 font-mono text-[11px] text-stone-500">Barcode {match.barcode || '—'} · SKU {match.sku}</div></div>
                <div className="shrink-0 rounded bg-white px-3 py-2 text-right"><div className="text-[10px] uppercase tracking-wide text-stone-500">Current stock</div><div className="font-mono text-lg font-bold text-stone-900">{match.stock}</div></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
                <label className="block text-xs font-medium text-stone-700">Quantity to add<input type="number" min="1" max="100000" step="1" required value={receiveQty} onChange={(e) => setReceiveQty(Number(e.target.value))} className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 font-mono text-sm" /></label>
                <label className="block text-xs font-medium text-stone-700">Supplier / intake note<input type="text" maxLength={160} value={receiveReason} onChange={(e) => setReceiveReason(e.target.value)} placeholder="e.g. Supplier invoice 428" className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm" /></label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-stone-600">Stock after intake: <strong className="font-mono text-emerald-800">{match.stock + (Number.isSafeInteger(receiveQty) && receiveQty > 0 ? receiveQty : 0)}</strong></span><button type="submit" className="inline-flex items-center gap-1.5 rounded bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800"><Plus className="h-3.5 w-3.5"/>Confirm & Add Stock</button></div>
            </form>;
          })()}
        </section>

        <div className="max-w-2xl bg-white border border-stone-200 rounded p-6 shadow-2xs">
          <h3 className="font-bold text-sm text-stone-900 mb-1">Record Stock Adjustment</h3>
          <p className="text-xs text-stone-500 mb-4">
            Audit inventory corrections, record incoming supplier orders, or write off damaged / stained garments.
          </p>

          <form onSubmit={handleApplyAdjustment} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-stone-700 mb-1">
                Select Garment Variant *
              </label>
              <select
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded font-mono bg-white"
              >
                {allVariants.map((v) => (
                  <option key={v.variantId} value={v.variantId}>
                    {v.productName} — {v.color} ({v.size}) [SKU: {v.sku} | In-Stock: {v.stock}]
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Adjustment Type</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as StockAdjustment['type'])}
                  className="w-full px-3 py-2 border border-stone-300 rounded bg-white font-medium"
                >
                  <option value="restock">Restock / Supplier PO (+)</option>
                  <option value="damage">Damage / Fabric Defect / Stain (-)</option>
                  <option value="shrinkage">Shrinkage / Lost / Theft (-)</option>
                  <option value="audit_correction">Audit Discrepancy Correction (+/-)</option>
                  <option value="manual">Manual Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Quantity Units (e.g. 5)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={adjQty}
                  onChange={(e) => setAdjQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 border border-stone-300 rounded font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-stone-700 mb-1">
                Reason / Supplier PO Reference *
              </label>
              <input
                type="text"
                required
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                placeholder="e.g. Received PO #2026-10 or hanger tear during fitting"
                className="w-full px-3 py-2 border border-stone-300 rounded"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors cursor-pointer"
            >
              Commit Stock Adjustment
            </button>
          </form>
        </div>
        </div>
      )}

      {/* SUB-VIEW 3: PHYSICAL CYCLE COUNT AUDIT WITH USB SCANNER */}
      {activeSubTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-stone-900 text-stone-100 p-5 rounded space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-amber-400" />
                  <span>Physical Cycle Count Mode</span>
                </h3>
                <p className="text-xs text-stone-400 mt-1 max-w-xl leading-relaxed">
                  Walk your shop floor with a handheld USB or Bluetooth barcode scanner.
                  Scan each garment tag one by one to tally actual floor quantities against system records.
                </p>
              </div>

              {!isAuditActive ? (
                <button
                  onClick={handleStartAudit}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs rounded transition-colors cursor-pointer"
                >
                  Start New Audit
                </button>
              ) : (
                <button
                  onClick={handleCommitAudit}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs rounded transition-colors cursor-pointer"
                >
                  Commit & Sync Counts
                </button>
              )}
            </div>

            {isAuditActive && (
              <form onSubmit={handleAuditScan} className="flex gap-2 pt-2">
                <input
                  type="text"
                  autoFocus
                  value={auditScanInput}
                  onChange={(e) => setAuditScanInput(e.target.value)}
                  placeholder="Scan barcode tag with USB scanner or enter SKU..."
                  className="flex-1 px-3 py-2 bg-stone-800 border border-stone-700 rounded text-xs font-mono text-white placeholder-stone-400 focus:outline-hidden focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white font-semibold text-xs rounded border border-stone-700 cursor-pointer"
                >
                  Count (+1)
                </button>
              </form>
            )}
          </div>

          {/* Audit Comparison Table */}
          {isAuditActive && (
            <div className="bg-white border border-stone-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[11px]">
                    <th className="py-2.5 px-4 font-sans font-medium">Garment Variant</th>
                    <th className="py-2.5 px-4 font-medium">Barcode</th>
                    <th className="py-2.5 px-4 font-medium text-right">System Recorded</th>
                    <th className="py-2.5 px-4 font-medium text-right font-sans">Physical Counted</th>
                    <th className="py-2.5 px-4 font-medium text-right">Discrepancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {allVariants.map((v) => {
                    const counted = auditCounts[v.variantId] ?? v.stock;
                    const diff = counted - v.stock;

                    return (
                      <tr key={v.variantId} className="hover:bg-stone-50/70">
                        <td className="py-2.5 px-4 font-sans font-medium text-stone-900">
                          {v.productName} ({v.color} - Size {v.size})
                          <span className="block text-[10px] text-stone-400 font-mono">{v.sku}</span>
                        </td>
                        <td className="py-2.5 px-4 text-stone-600">{v.barcode}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-stone-600 font-bold">
                          {v.stock}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <input
                            type="number"
                            min="0"
                            value={counted}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setAuditCounts((prev) => ({ ...prev, [v.variantId]: val }));
                            }}
                            className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold border border-stone-300 rounded text-right"
                          />
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                          <span
                            className={
                              diff === 0
                                ? 'text-stone-400'
                                : diff > 0
                                ? 'text-emerald-700'
                                : 'text-rose-600'
                            }
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 4: AUDIT ADJUSTMENT LOGS */}
      {activeSubTab === 'history' && (
        <div className="bg-white border border-stone-200 rounded overflow-hidden">
          {adjustments.length === 0 ? (
            <div className="p-8 text-center text-stone-400 text-xs">
              No stock adjustments recorded yet.
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[11px]">
                  <th className="py-2.5 px-4 font-medium">Timestamp</th>
                  <th className="py-2.5 px-4 font-sans font-medium">Garment & Size</th>
                  <th className="py-2.5 px-4 font-medium">Type</th>
                  <th className="py-2.5 px-4 font-medium text-right">Adjustment</th>
                  <th className="py-2.5 px-4 font-medium text-right">Stock (Prev → New)</th>
                  <th className="py-2.5 px-4 font-sans font-medium">Reason / Author</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {adjustments.map((adj) => (
                  <tr key={adj.id} className="hover:bg-stone-50/60">
                    <td className="py-2 px-4 text-stone-500">
                      {formatDateTimeDisplay(adj.timestamp)}
                    </td>
                    <td className="py-2 px-4 font-sans font-semibold text-stone-900">
                      {adj.productName} ({adj.color} · Size {adj.size})
                    </td>
                    <td className="py-2 px-4 capitalize text-stone-700">{adj.type.replace('_', ' ')}</td>
                    <td className="py-2 px-4 text-right font-bold tabular-nums">
                      <span className={adj.changeQty >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                        {adj.changeQty >= 0 ? `+${adj.changeQty}` : adj.changeQty}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-stone-600">
                      {adj.previousStock} → {adj.newStock}
                    </td>
                    <td className="py-2 px-4 font-sans text-stone-600">
                      <div>{adj.reason}</div>
                      <span className="text-[10px] text-stone-400">By {adj.userName}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Barcode Price Tag Modal */}
      <BarcodeHangtagPrinter
        isOpen={isTagPrinterOpen}
        onClose={() => setIsTagPrinterOpen(false)}
      />
    </div>
  );
};
