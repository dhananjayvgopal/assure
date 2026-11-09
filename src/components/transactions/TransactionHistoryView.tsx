/**
 * Searchable Transaction History & Returns Management View
 * Instant receipt barcode lookup, date/cashier filters,
 * receipt reprinting, void safeguards, and refund records.
 */

import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import { formatDateTimeDisplay } from '../../utils/dateFormat';
import { SaleTransaction } from '../../types/pos';
import { ReturnModal } from '../returns/ReturnModal';
import {
  Receipt,
  Search,
  Filter,
  RotateCcw,
  Printer,
  Ban,
  CheckCircle2,
  Calendar,
  User,
  CreditCard,
  ChevronRight,
  Barcode,
  X,
  Clock,
  Download,
} from 'lucide-react';

export const TransactionHistoryView: React.FC = () => {
  const {
    transactions,
    returns,
    setActiveReceipt,
    voidTransaction,
    settings,
    hasPermission,
  } = usePOS();

  const [activeTab, setActiveTab] = useState<'sales' | 'returns'>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  // Selected transaction for side panel / inspection
  const [selectedTxId, setSelectedTxId] = useState<string | null>(transactions[0]?.id || null);
  const selectedTx = transactions.find((tx) => tx.id === selectedTxId) || null;

  // Return modal target
  const [returnTargetTx, setReturnTargetTx] = useState<SaleTransaction | null>(null);

  const handleExportFullReport = () => {
    const headers = [
      'Record Type', 'Receipt Number', 'Original Receipt Number', 'Date / Time', 'Status',
      'Cashier', 'Customer', 'Customer Phone', 'Item Count', 'Item Details',
      'Payment / Refund Methods', 'Payment References', 'Subtotal', 'Discounts',
      'Taxable Value', 'CGST', 'SGST', 'IGST', 'GST Total', 'Transaction Total',
      'Refund Total', 'Net Effect', 'Cash Change', 'Reason / Notes',
    ];
    const csvCell = (value: unknown) => {
      let rendered = String(value ?? '');
      if (typeof value === 'string' && /^[=+@\-]/.test(rendered)) rendered = `'${rendered}`;
      return `"${rendered.replace(/"/g, '""')}"`;
    };
    const rows: unknown[][] = [];

    for (const sale of transactions) {
      const itemDetails = sale.items.map((item) =>
        `${item.quantity}x ${item.productName} (${item.color}, ${item.size}; SKU ${item.sku}; barcode ${item.barcode}; HSN ${item.hsnCode || ''}; unit ${settings.currencySymbol}${item.unitPrice.toFixed(2)}; line ${settings.currencySymbol}${item.lineTotal.toFixed(2)}${item.offerFreeQuantity ? `; ${item.offerFreeQuantity} free under ${item.offerNames?.join('/') || 'offer'}` : ''})`
      ).join(' | ');
      const payments = sale.payments.map((payment) => `${payment.method}: ${settings.currencySymbol}${payment.amount.toFixed(2)}`).join(' | ');
      const references = sale.payments.filter((payment) => payment.reference).map((payment) => `${payment.method}: ${payment.reference}`).join(' | ');
      rows.push([
        'Sale', sale.receiptNumber, '', new Date(sale.timestamp).toISOString(), sale.status,
        sale.cashierName, sale.customerName || 'Walk-in', sale.customerPhone || '',
        sale.items.reduce((sum, item) => sum + item.quantity, 0), itemDetails, payments, references,
        sale.subtotal, sale.discountTotal, sale.items.reduce((sum, item) => sum + (item.taxableValue ?? item.lineTotal), 0),
        sale.items.reduce((sum, item) => sum + (item.cgstAmount || 0), 0),
        sale.items.reduce((sum, item) => sum + (item.sgstAmount || 0), 0),
        sale.items.reduce((sum, item) => sum + (item.igstAmount || 0), 0), sale.taxTotal,
        sale.grandTotal, 0, sale.status === 'voided' ? 0 : sale.grandTotal,
        sale.changeGiven, sale.notes || '',
      ]);
    }

    for (const returned of returns) {
      const taxableRefund = returned.returnedItems.reduce((sum, item) => sum + (item.taxableRefundAmount ?? item.refundAmount), 0);
      const taxRefund = returned.returnedItems.reduce((sum, item) => sum + (item.taxRefundAmount ?? 0), 0);
      const itemDetails = returned.returnedItems.map((item) =>
        `${item.quantity}x ${item.productName} (${item.color}, ${item.size}; SKU ${item.sku}; ${item.condition}; ${item.restocked ? 'restocked' : 'not restocked'}; refund ${settings.currencySymbol}${item.refundAmount.toFixed(2)})`
      ).join(' | ');
      rows.push([
        'Return', returned.returnReceiptNumber, returned.originalReceiptNumber, new Date(returned.timestamp).toISOString(), 'refunded',
        returned.cashierName, returned.customerName || 'Walk-in', '',
        returned.returnedItems.reduce((sum, item) => sum + item.quantity, 0), itemDetails,
        returned.refundMethod, '', 0, 0, -taxableRefund,
        -returned.returnedItems.reduce((sum, item) => sum + (item.cgstRefundAmount || 0), 0),
        -returned.returnedItems.reduce((sum, item) => sum + (item.sgstRefundAmount || 0), 0),
        -returned.returnedItems.reduce((sum, item) => sum + (item.igstRefundAmount || 0), 0), -taxRefund,
        returned.totalRefundAmount, returned.totalRefundAmount, -returned.totalRefundAmount, 0, returned.reason,
      ]);
    }

    rows.sort((a, b) => new Date(String(a[3])).getTime() - new Date(String(b[3])).getTime());
    const content = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `full_transactions_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return transactions.filter((tx) => {
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
      if (
        paymentFilter !== 'all' &&
        !tx.payments.some((p) => p.method === paymentFilter)
      ) {
        return false;
      }
      if (!q) return true;

      const matchReceipt = tx.receiptNumber.toLowerCase().includes(q);
      const matchCustomer =
        (tx.customerName && tx.customerName.toLowerCase().includes(q)) ||
        (tx.customerPhone && tx.customerPhone.includes(q));
      const matchCashier = tx.cashierName.toLowerCase().includes(q);
      const matchItem = tx.items.some(
        (i) =>
          i.productName.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.barcode.includes(q)
      );

      return matchReceipt || matchCustomer || matchCashier || matchItem;
    });
  }, [transactions, searchQuery, statusFilter, paymentFilter]);

  const handleVoidSale = (tx: SaleTransaction) => {
    if (tx.status !== 'completed') return;
    const reason = window.prompt(
      `Void Transaction ${tx.receiptNumber}?\nEnter reason for cancellation (items will be returned to inventory):`,
      'Incorrect items entered by cashier'
    );
    if (reason && reason.trim()) {
      if (voidTransaction(tx.id, reason)) {
        alert(`Transaction ${tx.receiptNumber} voided and items returned to stock.`);
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-stone-200">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Sales & Return Records</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Audit transactions, reprint customer receipts, and process garment returns.
          </p>
        </div>

        <div className="flex bg-stone-100 p-1 rounded text-xs font-semibold">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${
              activeTab === 'sales'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Sales Receipts ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('returns')}
            className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${
              activeTab === 'returns'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Returns & Exchanges ({returns.length})
          </button>
        </div>
        <button
          onClick={handleExportFullReport}
          className="px-3 py-2 text-xs font-semibold text-stone-800 bg-white border border-stone-300 hover:bg-stone-50 rounded cursor-pointer flex items-center gap-1.5"
          title="Download all sales, returns, voids, payments, and item details as CSV"
        >
          <Download className="w-3.5 h-3.5" />
          Full Transactions Report
        </button>
      </div>

      {activeTab === 'sales' ? (
        <div className="space-y-4">
          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search receipt #, customer, or scan barcode..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-300 rounded focus:outline-hidden font-mono"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto text-xs">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-stone-300 rounded text-stone-700"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="partially_refunded">Partially Refunded</option>
                <option value="refunded">Refunded</option>
                <option value="voided">Voided</option>
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-stone-300 rounded text-stone-700"
              >
                <option value="all">All Payments</option>
                <option value="cash">Cash Only</option>
                <option value="card">Card Terminal</option>
                <option value="upi">UPI / Digital</option>
                <option value="gift_voucher">Gift Voucher</option>
              </select>
            </div>
          </div>

          {/* Master-Detail Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Transactions Table (2 Cols) */}
            <div className="lg:col-span-2 bg-white border border-stone-200 rounded overflow-hidden">
              {filteredTransactions.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs">
                  No transactions match the selected filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[11px]">
                        <th className="py-2.5 px-4 font-medium">Receipt #</th>
                        <th className="py-2.5 px-4 font-medium font-sans">Time / Cashier</th>
                        <th className="py-2.5 px-4 font-medium font-sans">Customer</th>
                        <th className="py-2.5 px-4 font-medium font-sans">Payment</th>
                        <th className="py-2.5 px-4 font-medium text-right">Total</th>
                        <th className="py-2.5 px-4 font-medium text-right font-sans">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {filteredTransactions.map((tx) => {
                        const isSelected = selectedTx?.id === tx.id;
                        return (
                          <tr
                            key={tx.id}
                            onClick={() => setSelectedTxId(tx.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-amber-50/70'
                                : 'hover:bg-stone-50/70'
                            }`}
                          >
                            <td className="py-3 px-4 font-bold text-stone-900">
                              {tx.receiptNumber}
                            </td>
                            <td className="py-3 px-4 font-sans">
                              <span className="text-stone-800 block font-medium">
                                {formatDateTimeDisplay(tx.timestamp)}
                              </span>
                              <span className="text-[10px] text-stone-400">
                                {tx.cashierName}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-sans text-stone-600">
                              {tx.customerName || 'Walk-in'}
                            </td>
                            <td className="py-3 px-4 font-sans capitalize text-stone-600">
                              {tx.payments.map((p) => p.method).join(', ')}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums font-bold text-stone-900">
                              {settings.currencySymbol}{tx.grandTotal.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right font-sans">
                              <span
                                className={`text-[11px] font-medium capitalize ${
                                  tx.status === 'completed'
                                    ? 'text-emerald-700'
                                    : tx.status === 'voided'
                                    ? 'text-rose-600 font-semibold'
                                    : 'text-amber-700'
                                }`}
                              >
                                {tx.status.replace('_', ' ')}
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

            {/* Transaction Detail Inspector Panel (1 Col) */}
            <div className="bg-white border border-stone-200 rounded p-5 space-y-4">
              {selectedTx ? (
                <>
                  <div className="flex justify-between items-start pb-3 border-b border-stone-200">
                    <div>
                      <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider block">
                        Receipt Inspection
                      </span>
                      <h4 className="font-bold text-sm text-stone-900 mt-0.5">
                        {selectedTx.receiptNumber}
                      </h4>
                      <span className="text-[11px] text-stone-500 font-mono">
                        {formatDateTimeDisplay(selectedTx.timestamp)}
                      </span>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setActiveReceipt(selectedTx)}
                        className="p-1.5 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded cursor-pointer"
                        title="Print / View Thermal Receipt"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {!['voided', 'refunded'].includes(selectedTx.status) && (
                        <button
                          onClick={() => setReturnTargetTx(selectedTx)}
                          className="p-1.5 text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded cursor-pointer"
                          title="Process Return / Exchange"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Customer & Cashier Info */}
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Cashier:</span>
                      <span className="font-medium text-stone-900">{selectedTx.cashierName}</span>
                    </div>
                    {selectedTx.customerName && (
                      <div className="flex justify-between">
                        <span className="text-stone-500">Customer:</span>
                        <span className="font-medium text-stone-900">
                          {selectedTx.customerName} {selectedTx.customerPhone && `(${selectedTx.customerPhone})`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Itemized Line Items */}
                  <div>
                    <span className="font-semibold text-xs text-stone-800 block mb-2">
                      Purchased Garments ({selectedTx.items.length})
                    </span>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {selectedTx.items.map((item, idx) => (
                        <div key={idx} className="p-2 border border-stone-200 rounded text-xs">
                          <div className="flex justify-between font-semibold text-stone-900">
                            <span className="truncate max-w-[180px]">{item.productName}</span>
                            <span className="font-mono tabular-nums">
                              {settings.currencySymbol}{item.lineTotal.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                            {item.color} · Size {item.size}{item.hsnCode ? ` · HSN ${item.hsnCode}` : ''} ({item.quantity} @ {settings.currencySymbol}{item.unitPrice.toFixed(2)})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Breakdown Totals */}
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-stone-600">
                      <span>Subtotal:</span>
                      <span>{settings.currencySymbol}{selectedTx.subtotal.toFixed(2)}</span>
                    </div>
                    {selectedTx.discountTotal > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Discounts:</span>
                        <span>-{settings.currencySymbol}{selectedTx.discountTotal.toFixed(2)}</span>
                      </div>
                    )}
                    {settings.registrationType === 'regular' && <div className="flex justify-between text-stone-600">
                      <span>GST (CGST + SGST):</span>
                      <span>{settings.currencySymbol}{selectedTx.taxTotal.toFixed(2)}</span>
                    </div>}
                    <div className="pt-1 border-t border-stone-200 flex justify-between font-bold text-stone-900 text-sm">
                      <span>Total Paid:</span>
                      <span>{settings.currencySymbol}{selectedTx.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Action Safeguard Buttons */}
                  <div className="space-y-2 pt-2">
                    {hasPermission('returns.process') && !['voided', 'refunded'].includes(selectedTx.status) && (
                      <button
                        onClick={() => setReturnTargetTx(selectedTx)}
                        className="w-full py-2 px-3 text-xs font-semibold text-stone-900 bg-amber-400 hover:bg-amber-300 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Process Return / Exchange</span>
                      </button>
                    )}

                    {hasPermission('transactions.void') && selectedTx.status === 'completed' && (
                      <button
                        onClick={() => handleVoidSale(selectedTx)}
                        className="w-full py-1.5 px-3 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-rose-300 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Void Entire Transaction</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-stone-400 text-xs">
                  Select a transaction to inspect receipt details.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* RETURNS TAB */
        <div className="bg-white border border-stone-200 rounded overflow-hidden">
          {returns.length === 0 ? (
            <div className="p-8 text-center text-stone-400 text-xs">
              No product returns or exchanges recorded.
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[11px]">
                  <th className="py-2.5 px-4 font-medium">Return Receipt</th>
                  <th className="py-2.5 px-4 font-medium">Original Sale #</th>
                  <th className="py-2.5 px-4 font-medium font-sans">Returned Items</th>
                  <th className="py-2.5 px-4 font-medium font-sans">Refund Method</th>
                  <th className="py-2.5 px-4 font-medium font-sans">Reason / Staff</th>
                  <th className="py-2.5 px-4 font-medium text-right">Refund Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {returns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-stone-50/70">
                    <td className="py-3 px-4 font-bold text-stone-900">{ret.returnReceiptNumber}</td>
                    <td className="py-3 px-4 text-stone-600">{ret.originalReceiptNumber}</td>
                    <td className="py-3 px-4 font-sans">
                      {ret.returnedItems.map((item, idx) => (
                        <div key={idx} className="text-stone-800">
                          {item.quantity}x {item.productName} ({item.color} - Size {item.size})
                          <span className="text-[10px] text-stone-400 ml-1">
                            [{item.condition} · {item.restocked ? 'restocked' : 'discarded'}]
                          </span>
                        </div>
                      ))}
                    </td>
                    <td className="py-3 px-4 font-sans capitalize text-stone-700">
                      {ret.refundMethod.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 font-sans text-stone-600">
                      <div>{ret.reason}</div>
                      <span className="text-[10px] text-stone-400">By {ret.cashierName}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold tabular-nums text-rose-600">
                      -{settings.currencySymbol}{ret.totalRefundAmount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Return Modal */}
      <ReturnModal
        sale={returnTargetTx}
        isOpen={!!returnTargetTx}
        onClose={() => setReturnTargetTx(null)}
        onSuccess={() => {
          setReturnTargetTx(null);
        }}
      />
    </div>
  );
};
