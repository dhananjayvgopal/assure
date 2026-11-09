/**
 * Garment Return & Refund Modal
 * Allows itemized returns against original receipt or direct selection.
 * Restocks resalable items to inventory, handles condition checks,
 * and records cash drawer refunds or store credit.
 */

import React, { useEffect, useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { SaleTransaction, ReturnItemRecord } from '../../types/pos';
import { formatDateDisplay } from '../../utils/dateFormat';
import { RotateCcw, AlertTriangle, Check, X, ShieldAlert } from 'lucide-react';

interface ReturnModalProps {
  sale: SaleTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReturnModal: React.FC<ReturnModalProps> = ({
  sale,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { processReturn, settings, activeShift, returns } = usePOS();

  const alreadyReturned = new Map<string, number>();
  if (sale) for (const ret of returns) {
    if (ret.originalSaleId !== sale.id) continue;
    for (const item of ret.returnedItems) alreadyReturned.set(item.variantId, (alreadyReturned.get(item.variantId) || 0) + item.quantity);
  }

  // Selected items to return: variantId -> { quantity, condition }
  const [returnSelection, setReturnSelection] = useState<
    Record<string, { selected: boolean; quantity: number; condition: 'resalable' | 'damaged' | 'defective' }>
  >(() => {
    if (!sale) return {};
    const init: Record<string, { selected: boolean; quantity: number; condition: 'resalable' | 'damaged' | 'defective' }> = {};
    sale.items.forEach((item) => {
      init[item.variantId] = {
        selected: false,
        quantity: item.quantity,
        condition: 'resalable',
      };
    });
    return init;
  });

  const [refundMethod, setRefundMethod] = useState<'cash' | 'card' | 'upi' | 'store_credit'>('cash');
  const [returnReason, setReturnReason] = useState<string>('Size fit issue / Exchange request');

  useEffect(() => {
    if (!sale) {
      setReturnSelection({});
      return;
    }
    const selection: typeof returnSelection = {};
    for (const item of sale.items) {
      const remaining = Math.max(0, item.quantity - (alreadyReturned.get(item.variantId) || 0));
      selection[item.variantId] = { selected: false, quantity: Math.max(1, remaining), condition: 'resalable' };
    }
    setReturnSelection(selection);
    const originalTender = [...(sale.payments || [])]
      .filter((payment) => ['cash', 'card', 'upi'].includes(payment.method))
      .sort((a, b) => b.amount - a.amount)[0]?.method;
    setRefundMethod((originalTender as 'cash' | 'card' | 'upi' | undefined) || 'cash');
  }, [sale?.id, returns]);

  if (!isOpen || !sale) return null;

  // Compute total refund amount based on selected items
  let totalRefund = 0;
  const itemsToReturn: ReturnItemRecord[] = [];

  sale.items.forEach((item) => {
    const sel = returnSelection[item.variantId];
    if (sel && sel.selected && sel.quantity > 0) {
      // lineTotal is the discounted taxable amount; return the associated GST too.
      const unitRefund = (item.lineTotal + item.taxAmount) / item.quantity;
      const refundAmt = Number((unitRefund * sel.quantity).toFixed(2));
      const taxRefund = Number(((item.taxAmount / item.quantity) * sel.quantity).toFixed(2));
      const cgstRefund = Number((((item.cgstAmount || 0) / item.quantity) * sel.quantity).toFixed(2));
      const sgstRefund = Number((((item.sgstAmount || 0) / item.quantity) * sel.quantity).toFixed(2));
      const igstRefund = Number((((item.igstAmount || 0) / item.quantity) * sel.quantity).toFixed(2));
      totalRefund += refundAmt;

      itemsToReturn.push({
        variantId: item.variantId,
        productName: item.productName,
        sku: item.sku,
        size: item.size,
        color: item.color,
        quantity: sel.quantity,
        unitPrice: item.unitPrice,
        refundAmount: refundAmt,
        taxableRefundAmount: Number((refundAmt - taxRefund).toFixed(2)),
        taxRefundAmount: taxRefund,
        cgstRefundAmount: cgstRefund,
        sgstRefundAmount: sgstRefund,
        igstRefundAmount: igstRefund,
        condition: sel.condition,
        restocked: sel.condition === 'resalable',
      });
    }
  });

  const handleConfirmReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (itemsToReturn.length === 0) {
      alert('Please select at least one item to return.');
      return;
    }
    if (!returnReason.trim()) {
      alert('Enter a reason for this return.');
      return;
    }

    if (refundMethod === 'cash' && !activeShift) {
      alert('Register shift must be open to process cash refunds.');
      return;
    }

    const ret = processReturn(sale.id, itemsToReturn, refundMethod, returnReason);
    if (ret) {
      alert(refundMethod === 'store_credit'
        ? `Return #${ret.returnReceiptNumber} recorded. Gift voucher code: ${ret.giftVoucherCode || 'not generated'} · Value ${settings.currencySymbol}${totalRefund.toFixed(2)}. Give this code to the customer.`
        : `Return #${ret.returnReceiptNumber} successfully recorded for ${settings.currencySymbol}${totalRefund.toFixed(2)}.`);
      onSuccess();
      onClose();
    } else {
      alert('This return could not be recorded. Check the remaining quantity, refund amount, and register shift, then try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full text-stone-900 border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">Process Garment Return / Refund</h3>
              <span className="text-[11px] text-stone-400">
                Original Receipt: {sale.receiptNumber} ({formatDateDisplay(sale.timestamp)})
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirmReturn} className="p-6 overflow-y-auto space-y-4 text-xs">
          <div>
            <span className="font-semibold text-stone-800 block mb-2">
              Select Garment Items to Return:
            </span>

            <div className="space-y-2 border border-stone-200 rounded p-3 bg-stone-50/50">
              {sale.items.map((item) => {
                const remainingQty = Math.max(0, item.quantity - (alreadyReturned.get(item.variantId) || 0));
                const sel = returnSelection[item.variantId] || {
                  selected: false,
                  quantity: remainingQty,
                  condition: 'resalable',
                };

                return (
                  <div
                    key={item.variantId}
                    className={`p-3 bg-white border rounded transition-colors ${
                      sel.selected ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sel.selected && remainingQty > 0}
                          disabled={remainingQty === 0}
                          onChange={(e) => {
                            setReturnSelection((prev) => ({
                              ...prev,
                              [item.variantId]: { ...sel, selected: remainingQty > 0 && e.target.checked },
                            }));
                          }}
                          className="mt-0.5 rounded text-stone-900"
                        />
                        <div>
                          <span className="font-bold text-stone-900 block">{item.productName}</span>
                          <span className="text-[11px] text-stone-500">
                            {item.color} · Size {item.size} · SKU: {item.sku} · {remainingQty} returnable
                          </span>
                        </div>
                      </label>

                      <span className="font-mono font-bold text-stone-900 tabular-nums">
                        {settings.currencySymbol}{(item.lineTotal + item.taxAmount).toFixed(2)}
                      </span>
                    </div>

                    {/* Quantity & Condition (Shown if selected) */}
                    {sel.selected && (
                      <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-stone-600 text-[11px]">Return Qty:</span>
                          <input
                            type="number"
                            min="1"
                            max={remainingQty}
                            value={sel.quantity}
                            onChange={(e) => {
                              const q = parseInt(e.target.value, 10) || 1;
                              setReturnSelection((prev) => ({
                                ...prev,
                                [item.variantId]: { ...sel, quantity: Math.min(remainingQty, Math.max(1, q)) },
                              }));
                            }}
                            className="w-14 px-2 py-0.5 font-mono font-bold border border-stone-300 rounded text-center"
                          />
                          <span className="text-stone-400 text-[11px]">of {remainingQty} remaining</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-stone-600 text-[11px]">Condition:</span>
                          <select
                            value={sel.condition}
                            onChange={(e) => {
                              setReturnSelection((prev) => ({
                                ...prev,
                                [item.variantId]: {
                                  ...sel,
                                  condition: e.target.value as 'resalable' | 'damaged' | 'defective',
                                },
                              }));
                            }}
                            className="px-2 py-0.5 border border-stone-300 rounded font-medium bg-white"
                          >
                            <option value="resalable">Resalable (Restock to Inventory)</option>
                            <option value="damaged">Damaged / Worn (Do Not Restock)</option>
                            <option value="defective">Factory Defective (Defect Log)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Refund Method & Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-medium text-stone-700 mb-1">Refund Method</label>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as 'cash' | 'card' | 'upi' | 'store_credit')}
                className="w-full px-3 py-1.5 border border-stone-300 rounded font-medium bg-white"
              >
                <option value="cash">Cash (From Register Drawer)</option>
                <option value="card">Card / POS refund</option>
                <option value="upi">UPI / QR refund</option>
                <option value="store_credit">Store Credit / Gift Voucher</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-stone-700 mb-1">Return Reason</label>
              <input
                type="text"
                required
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="e.g. Sizing didn't fit, gift exchange"
                className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white"
              />
            </div>
          </div>

          {/* Summary Box */}
          <div className="p-3.5 bg-stone-100 rounded border border-stone-200 flex justify-between items-baseline font-mono">
            <span className="text-xs font-semibold text-stone-800">Total Refund Amount:</span>
            <span className="text-lg font-bold text-stone-950 tabular-nums">
              {settings.currencySymbol}{totalRefund.toFixed(2)}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={itemsToReturn.length === 0}
              className="flex-1 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded cursor-pointer"
            >
              Confirm Return & Restock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
