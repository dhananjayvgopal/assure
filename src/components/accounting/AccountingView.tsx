/**
 * Retail Accounting & Financial Reports View
 * Sales income, COGS, gross margins, operating expenses,
 * GST sales summaries and payment distribution breakdown.
 */

import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import { formatDateDisplay, formatDateTimeDisplay } from '../../utils/dateFormat';
import { StoreExpense } from '../../types/pos';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Download,
  Plus,
  Trash2,
  Calendar,
  CreditCard,
  Banknote,
  Percent,
  Layers,
} from 'lucide-react';

interface AccountingViewProps {
  initialTab?: 'reports' | 'expenses' | 'tax';
  expensesOnly?: boolean;
}

export const AccountingView: React.FC<AccountingViewProps> = ({ initialTab = 'reports', expensesOnly = false }) => {
  const { transactions, returns, expenses, adjustments, vouchers, addExpense, deleteExpense, settings, hasPermission, activeUser } = usePOS();
  const canAddExpense = hasPermission('expenses.add') || hasPermission('expenses.manage');

  // Date range filter: 'all' | 'today' | '7days' | 'month'
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | 'month'>('all');

  // Sub-tab: 'reports' | 'expenses' | 'tax'
  const [activeTab, setActiveTab] = useState<'reports' | 'expenses' | 'tax' | 'ledger'>(initialTab);

  // Expense form state
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<StoreExpense['category']>('Packaging & Bags');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(500);
  const [expensePayment, setExpensePayment] = useState<StoreExpense['paymentMethod']>('Cash');
  const [expenseRef, setExpenseRef] = useState('');

  const isInDateRange = (timestamp: string) => {
    const now = new Date();
    const txDate = new Date(timestamp);
    if (dateRange === 'today') return txDate.toDateString() === now.toDateString();
    if (dateRange === '7days') return (now.getTime() - txDate.getTime()) / (1000 * 3600 * 24) <= 7;
    if (dateRange === 'month') return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    return true;
  };

  // Sales use the sale date; refunds use the date the refund was actually recorded.
  const filteredSales = useMemo(() => {
    return transactions.filter((sale) => sale.status !== 'voided' && isInDateRange(sale.timestamp));
  }, [transactions, dateRange]);
  const filteredReturns = useMemo(() => returns.filter((returned) => isInDateRange(returned.timestamp)), [returns, dateRange]);
  const fullLedger = useMemo(() => {
    type LedgerRow = { timestamp: string; type: string; reference: string; description: string; sku: string; quantityChange: number | ''; subtotal: number | ''; discount: number | ''; taxable: number | ''; gst: number | ''; amount: number | ''; payment: string; status: string; details: string };
    const rows: LedgerRow[] = [];
    for (const sale of transactions.filter((entry) => isInDateRange(entry.timestamp))) {
      const payments = sale.payments.map((payment) => `${payment.method}: ${payment.amount.toFixed(2)}${payment.reference ? ` (Ref ${payment.reference})` : ''}`).join(' | ');
      if (!sale.items.length) rows.push({ timestamp: sale.timestamp, type: 'Sale', reference: sale.receiptNumber, description: 'Sale', sku: '', quantityChange: '', subtotal: sale.subtotal, discount: sale.discountTotal, taxable: sale.subtotal - sale.discountTotal, gst: sale.taxTotal, amount: sale.grandTotal, payment: payments, status: sale.status, details: sale.notes || '' });
      for (const item of sale.items) rows.push({ timestamp: sale.timestamp, type: sale.status === 'voided' ? 'Voided sale' : 'Sale', reference: sale.receiptNumber, description: `${item.productName} — ${item.color} / ${item.size}`, sku: item.sku, quantityChange: sale.status === 'voided' ? 0 : -item.quantity, subtotal: item.unitPrice * item.quantity, discount: Math.max(0, item.unitPrice * item.quantity - ((item.taxableValue ?? item.lineTotal) + (sale.priceMode === 'inclusive' ? item.taxAmount : 0))), taxable: item.taxableValue ?? item.lineTotal, gst: item.taxAmount, amount: item.lineTotal + item.taxAmount, payment: payments, status: sale.status, details: `${item.offerFreeQuantity ? `${item.offerFreeQuantity} free under ${item.offerNames?.join(', ') || 'offer'} · ` : ''}${sale.notes || ''}` });
    }
    for (const returned of returns.filter((entry) => isInDateRange(entry.timestamp))) {
      const pay = `${returned.refundMethod}${returned.refundMethod === 'store_credit' ? ` (gift/store credit${returned.giftVoucherCode ? ` · ${returned.giftVoucherCode}` : ''})` : ''}`;
      for (const item of returned.returnedItems) {
        const originalSale = transactions.find((sale) => sale.id === returned.originalSaleId);
        const returnedBase = originalSale?.priceMode === 'inclusive' ? item.refundAmount : (item.taxableRefundAmount ?? item.refundAmount);
        rows.push({ timestamp: returned.timestamp, type: 'Return', reference: returned.returnReceiptNumber, description: `${item.productName} — ${item.color} / ${item.size}`, sku: item.sku, quantityChange: '', subtotal: item.unitPrice * item.quantity, discount: Math.max(0, item.unitPrice * item.quantity - returnedBase), taxable: -(item.taxableRefundAmount ?? item.refundAmount), gst: -(item.taxRefundAmount ?? 0), amount: -item.refundAmount, payment: pay, status: `Against ${returned.originalReceiptNumber}`, details: returned.reason });
      }
      if (!returned.returnedItems.length) rows.push({ timestamp: returned.timestamp, type: 'Return', reference: returned.returnReceiptNumber, description: `Return for ${returned.originalReceiptNumber}`, sku: '', quantityChange: '', subtotal: '', discount: '', taxable: '', gst: '', amount: -returned.totalRefundAmount, payment: pay, status: 'Return', details: returned.reason });
    }
    for (const expense of expenses.filter((entry) => isInDateRange(entry.date))) rows.push({ timestamp: expense.date, type: 'Expense', reference: expense.receiptRef || '', description: `${expense.category}: ${expense.description}`, sku: '', quantityChange: '', subtotal: '', discount: '', taxable: '', gst: '', amount: -expense.amount, payment: expense.paymentMethod, status: 'Recorded', details: expense.recordedBy });
    for (const adjustment of adjustments.filter((entry) => isInDateRange(entry.timestamp))) rows.push({ timestamp: adjustment.timestamp, type: 'Stock movement', reference: adjustment.id, description: `${adjustment.productName} — ${adjustment.color} / ${adjustment.size}`, sku: adjustment.sku, quantityChange: adjustment.changeQty, subtotal: '', discount: '', taxable: '', gst: '', amount: '', payment: '', status: adjustment.type, details: `${adjustment.reason} · ${adjustment.userName}` });
    for (const voucher of vouchers.filter((entry) => isInDateRange(entry.createdAt))) rows.push({ timestamp: voucher.createdAt, type: 'Gift voucher issued', reference: voucher.code, description: voucher.customerName ? `Customer: ${voucher.customerName}` : 'Gift voucher liability', sku: '', quantityChange: '', subtotal: '', discount: '', taxable: '', gst: '', amount: '', payment: '', status: `${voucher.status} · balance ${settings.currencySymbol}${voucher.balance.toFixed(2)} of ${settings.currencySymbol}${voucher.initialValue.toFixed(2)}`, details: `${voucher.note} · issued by ${voucher.issuedBy}` });
    return rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [transactions, returns, expenses, adjustments, vouchers, dateRange, settings.currencySymbol]);

  const exportFullLedger = () => {
    const headers = ['Date / Time', 'Record Type', 'Reference', 'Description', 'SKU', 'Stock Change (+/-)', 'Subtotal', 'Discount', 'Taxable Value', 'GST', 'Amount (+income / -refund or expense)', 'Payment / Refund Method & Reference', 'Status', 'Details'];
    const quote = (value: unknown) => `"${String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`;
    const csv = [headers, ...fullLedger.map((row) => [row.timestamp, row.type, row.reference, row.description, row.sku, row.quantityChange, row.subtotal, row.discount, row.taxable, row.gst, row.amount, row.payment, row.status, row.details])].map((row) => row.map(quote).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `accounting_full_activity_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Compute Core Financial Metrics
  const financials = useMemo(() => {
    let grossSales = 0;
    let discounts = 0;
    let netSales = 0;
    let cogs = 0;
    let taxCollected = 0;
    const saleById = new Map(transactions.map((sale) => [sale.id, sale]));

    filteredSales.forEach((s) => {
      grossSales += s.subtotal;
      discounts += s.discountTotal;
      netSales += s.priceMode === 'inclusive'
        ? s.items.reduce((sum, item) => sum + (item.taxableValue ?? item.lineTotal), 0)
        : (s.subtotal - s.discountTotal);
      taxCollected += s.taxTotal;

      s.items.forEach((item) => {
        cogs += item.unitCost * item.quantity;
      });
    });

    let returnedGross = 0;
    let returnedTaxable = 0;
    let returnedTax = 0;
    let returnedCogs = 0;
    let returnedDiscount = 0;
    for (const returned of filteredReturns) {
      const original = saleById.get(returned.originalSaleId);
      for (const item of returned.returnedItems) {
        const sold = original?.items.find((saleItem) => saleItem.variantId === item.variantId);
        const taxableRefund = item.taxableRefundAmount ?? item.refundAmount;
        const taxRefund = item.taxRefundAmount ?? 0;
        const lineGross = Number(sold?.unitPrice || item.unitPrice) * item.quantity;
        returnedGross += lineGross;
        const returnedDiscountBasis = original?.priceMode === 'inclusive' ? item.refundAmount : taxableRefund;
        returnedDiscount += Math.max(0, lineGross - returnedDiscountBasis);
        returnedTaxable += taxableRefund;
        returnedTax += taxRefund;
        if (item.restocked || item.condition === 'resalable') returnedCogs += Number(sold?.unitCost || 0) * item.quantity;
      }
    }
    grossSales -= returnedGross;
    discounts -= returnedDiscount;
    netSales -= returnedTaxable;
    taxCollected -= returnedTax;
    cogs -= returnedCogs;

    const grossProfit = netSales - cogs;
    const grossMarginPct = netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) : '0.0';

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netStoreIncome = grossProfit - totalExpenses;

    // Payment breakdowns
    let cashTotal = 0;
    let cardTotal = 0;
    let upiTotal = 0;
    let giftVoucherTotal = 0;

    filteredSales.forEach((s) => {
      s.payments.forEach((p) => {
        if (p.method === 'cash') cashTotal += (p.amount - s.changeGiven);
        else if (p.method === 'card') cardTotal += p.amount;
        else if (p.method === 'upi') upiTotal += p.amount;
        else if (p.method === 'gift_voucher') giftVoucherTotal += p.amount;
      });
    });

    let storeCreditRefunds = 0;
    for (const returned of filteredReturns) {
      if (returned.refundMethod === 'cash') cashTotal -= returned.totalRefundAmount;
      else if (returned.refundMethod === 'card') cardTotal -= returned.totalRefundAmount;
      else if (returned.refundMethod === 'upi') upiTotal -= returned.totalRefundAmount;
      else storeCreditRefunds += returned.totalRefundAmount;
    }

    return {
      grossSales: Number(grossSales.toFixed(2)),
      discounts: Number(discounts.toFixed(2)),
      netSales: Number(netSales.toFixed(2)),
      cogs: Number(cogs.toFixed(2)),
      grossProfit: Number(grossProfit.toFixed(2)),
      grossMarginPct,
      taxCollected: Number(taxCollected.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      netStoreIncome: Number(netStoreIncome.toFixed(2)),
      cashTotal: Number(cashTotal.toFixed(2)),
      cardTotal: Number(cardTotal.toFixed(2)),
      upiTotal: Number(upiTotal.toFixed(2)),
      giftVoucherTotal: Number(giftVoucherTotal.toFixed(2)),
      storeCreditRefunds: Number(storeCreditRefunds.toFixed(2)),
      transactionCount: filteredSales.filter((sale) => sale.status !== 'refunded').length,
      avgBasketValue: filteredSales.filter((sale) => sale.status !== 'refunded').length > 0
        ? (netSales / filteredSales.filter((sale) => sale.status !== 'refunded').length).toFixed(2) : '0.00',
    };
  }, [filteredSales, filteredReturns, expenses, transactions]);

  // HSN and rate summary to help prepare a return; review and file through the GST portal/CA.
  const hsnReport = useMemo(() => {
    const hsnDescriptions: Record<string, string> = {
      '6205': "Men's or Boys' Shirts (Woven)",
      '6203': "Men's Suits, Blazers, Jackets & Trousers (Woven)",
      '6204': "Women's Dresses, Suits, Jackets & Skirts (Woven)",
      '6109': "T-Shirts, Singlets & Vests (Knitted / Crocheted)",
      '6110': "Jerseys, Pullovers, Cardigans & Sweaters (Knitted)",
      '6105': "Men's or Boys' Polo Shirts (Knitted)",
      '6206': "Women's or Girls' Blouses & Shirts",
      '6211': "Track Suits, Ethnic Wear, Kurta & Sherwani",
      '4203': "Articles of Apparel & Accessories of Leather (Belts)",
      '6217': "Clothing Accessories (Ties, Bows, Pocket Squares)",
    };

    const map = new Map<
      string,
      {
        hsnCode: string;
        description: string;
        quantity: number;
        taxableValue: number;
        cgstAmount: number;
        sgstAmount: number;
        igstAmount: number;
        totalGst: number;
        rate: number;
      }
    >();

    filteredSales.forEach((s) => {
      s.items.forEach((item) => {
        const code = item.hsnCode || '6205';
        const rate = item.taxRate ?? settings.taxRateDefault;
        const key = `${code}:${rate}`;
        const existing = map.get(key) || {
          hsnCode: code,
          description: hsnDescriptions[code] || 'Garments & Apparel Accessories',
          quantity: 0,
          taxableValue: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          totalGst: 0,
          rate,
        };

        const tax = item.taxAmount;
        const cgst = item.cgstAmount ?? (s.isInterState ? 0 : Number((tax / 2).toFixed(2)));
        const sgst = item.sgstAmount ?? (s.isInterState ? 0 : Number((tax - cgst).toFixed(2)));

        existing.quantity += item.quantity;
        existing.taxableValue += item.taxableValue ?? item.lineTotal;
        existing.cgstAmount += cgst;
        existing.sgstAmount += sgst;
        existing.igstAmount += item.igstAmount ?? (s.isInterState ? tax : 0);
        existing.totalGst += tax;

        map.set(key, existing);
      });
    });

    for (const returned of filteredReturns) {
      const original = transactions.find((sale) => sale.id === returned.originalSaleId);
      for (const item of returned.returnedItems) {
        const sold = original?.items.find((saleItem) => saleItem.variantId === item.variantId);
        const code = sold?.hsnCode || '6205';
        const rate = sold?.taxRate ?? settings.taxRateDefault;
        const key = `${code}:${rate}`;
        const row = map.get(key) || {
          hsnCode: code,
          description: hsnDescriptions[code] || 'Garments & Apparel Accessories',
          quantity: 0, taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalGst: 0, rate,
        };
        const taxableRefund = item.taxableRefundAmount ?? item.refundAmount;
        const taxRefund = item.taxRefundAmount ?? 0;
        const cgstRefund = item.cgstRefundAmount ?? (original?.isInterState ? 0 : Number((taxRefund / 2).toFixed(2)));
        const igstRefund = item.igstRefundAmount ?? (original?.isInterState ? taxRefund : 0);
        row.quantity -= item.quantity;
        row.taxableValue -= taxableRefund;
        row.cgstAmount -= cgstRefund;
        row.sgstAmount -= item.sgstRefundAmount ?? (original?.isInterState ? 0 : taxRefund - cgstRefund);
        row.igstAmount -= igstRefund;
        row.totalGst -= taxRefund;
        map.set(key, row);
      }
    }

    return Array.from(map.values()).map((row) => ({
      ...row,
      taxableValue: Number(row.taxableValue.toFixed(2)),
      cgstAmount: Number(row.cgstAmount.toFixed(2)),
      sgstAmount: Number(row.sgstAmount.toFixed(2)),
      igstAmount: Number(row.igstAmount.toFixed(2)),
      totalGst: Number(row.totalGst.toFixed(2)),
    }));
  }, [filteredSales, filteredReturns, transactions, settings.taxRateDefault]);

  const gstComponents = useMemo(() => {
    const totals = filteredSales.reduce((sum, sale) => {
      sale.items.forEach((item) => {
        const tax = item.taxAmount || 0;
        const cgst = item.cgstAmount ?? (sale.isInterState ? 0 : Number((tax / 2).toFixed(2)));
        sum.cgst += cgst;
        sum.sgst += item.sgstAmount ?? (sale.isInterState ? 0 : Number((tax - cgst).toFixed(2)));
        sum.igst += item.igstAmount ?? (sale.isInterState ? tax : 0);
      });
      return sum;
    }, { cgst: 0, sgst: 0, igst: 0 });
    for (const returned of filteredReturns) for (const item of returned.returnedItems) {
      const original = transactions.find((sale) => sale.id === returned.originalSaleId);
      const tax = item.taxRefundAmount ?? 0;
      const cgst = item.cgstRefundAmount ?? (original?.isInterState ? 0 : Number((tax / 2).toFixed(2)));
      totals.cgst -= cgst;
      totals.sgst -= item.sgstRefundAmount ?? (original?.isInterState ? 0 : tax - cgst);
      totals.igst -= item.igstRefundAmount ?? (original?.isInterState ? tax : 0);
    }
    return totals;
  }, [filteredSales, filteredReturns, transactions]);

  const handleExportHsnCSV = () => {
    const headers = [
      'HSN Code',
      'Description',
      'UQC',
      'Total Quantity',
      'Total Taxable Value (INR)',
      'CGST Rate %',
      'CGST Amount (INR)',
      'SGST Rate %',
      'SGST Amount (INR)',
      'IGST Amount (INR)',
      'Total GST (INR)',
    ];

    const rows = hsnReport.map((r) => [
      `"${r.hsnCode}"`,
      `"${r.description}"`,
      'PCS',
      r.quantity,
      r.taxableValue.toFixed(2),
      `${(r.rate / 2).toFixed(1)}%`,
      r.cgstAmount.toFixed(2),
      `${(r.rate / 2).toFixed(1)}%`,
      r.sgstAmount.toFixed(2),
      r.igstAmount.toFixed(2),
      r.totalGst.toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        `"${settings.storeName} - HSN SALES SUMMARY (REVIEW BEFORE FILING)"`,
        `"GSTIN: ${settings.taxId || 'Not configured'}","State: ${settings.stateName || ''} (Code ${settings.stateCode || ''})","Date: ${formatDateDisplay(new Date())}"`,
        '',
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HSN_Sales_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0 || !expenseDesc.trim()) return;

    addExpense({
      date: new Date().toISOString().slice(0, 10),
      category: expenseCategory,
      description: expenseDesc,
      amount: expenseAmount,
      paymentMethod: expensePayment,
      receiptRef: expenseRef || undefined,
      recordedBy: activeUser.name,
    });

    setIsAddingExpense(false);
    setExpenseDesc('');
    setExpenseAmount(50);
    setExpenseRef('');
  };

  const handleExportFinancialCSV = () => {
    const rows = [
      ['Metric', 'Amount'],
      ['Gross Retail Sales', `${financials.grossSales}`],
      ['Total Discounts', `${financials.discounts}`],
      ['Net Sales', `${financials.netSales}`],
      ['Cost of Goods Sold (COGS)', `${financials.cogs}`],
      ['Gross Retail Profit', `${financials.grossProfit}`],
      ['Gross Margin %', `${financials.grossMarginPct}%`],
      ['Total Store Expenses', `${financials.totalExpenses}`],
      ['Net Store Income', `${financials.netStoreIncome}`],
      ['Sales Tax / VAT Collected', `${financials.taxCollected}`],
      ['Cash Payments', `${financials.cashTotal}`],
      ['Card Payments', `${financials.cardTotal}`],
      ['UPI / Digital Payments', `${financials.upiTotal}`],
      ['Gift Voucher Redemption (tender)', `${financials.giftVoucherTotal}`],
      ['Transaction Count', `${financials.transactionCount}`],
      ['Average Basket Value', `${financials.avgBasketValue}`],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financial_summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-stone-200">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">{expensesOnly ? 'Store Expenses' : 'Retail Accounting & Financials'}</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {expensesOnly ? 'Record and review shop expenses.' : 'P&L performance, cost of goods, store operating expenses, and GST sales summaries.'}
          </p>
        </div>

        {!expensesOnly && <div className="flex items-center gap-2">
          {/* Date range filter */}
          <div className="flex bg-stone-100 p-0.5 rounded text-xs">
            {(['all', 'today', '7days', 'month'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-2.5 py-1 rounded cursor-pointer capitalize ${
                  dateRange === r ? 'bg-white text-stone-900 font-semibold shadow-xs' : 'text-stone-600'
                }`}
              >
                {r === 'all' ? 'All Time' : r === '7days' ? 'Last 7 Days' : r}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportFinancialCSV}
            className="px-3 py-1.5 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 border border-stone-300 rounded cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>}
      </div>

      {/* Primary KPI Summary Strip (4 cards) */}
      {!expensesOnly && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Sales */}
        <div className="p-4 bg-white border border-stone-200 rounded shadow-2xs">
          <span className="text-[11px] font-medium text-stone-500 block">Net Retail Revenue</span>
          <span className="font-mono text-2xl font-bold text-stone-900 tabular-nums block mt-1">
            {settings.currencySymbol}{financials.netSales.toFixed(2)}
          </span>
          <span className="text-[11px] text-stone-400 mt-0.5 block">
            {financials.transactionCount} transactions · Avg {settings.currencySymbol}{financials.avgBasketValue}
          </span>
        </div>

        {/* Gross Profit */}
        <div className="p-4 bg-white border border-stone-200 rounded shadow-2xs">
          <span className="text-[11px] font-medium text-stone-500 block">Gross Profit</span>
          <span className="font-mono text-2xl font-bold text-emerald-700 tabular-nums block mt-1">
            {settings.currencySymbol}{financials.grossProfit.toFixed(2)}
          </span>
          <span className="text-[11px] text-stone-500 mt-0.5 block font-mono">
            {financials.grossMarginPct}% gross margin on garments
          </span>
        </div>

        {/* Operating Expenses */}
        <div className="p-4 bg-white border border-stone-200 rounded shadow-2xs">
          <span className="text-[11px] font-medium text-stone-500 block">Operating Expenses</span>
          <span className="font-mono text-2xl font-bold text-stone-900 tabular-nums block mt-1">
            {settings.currencySymbol}{financials.totalExpenses.toFixed(2)}
          </span>
          <span className="text-[11px] text-stone-400 mt-0.5 block">
            Bags, rent, maintenance, wages
          </span>
        </div>

        {/* Net Store Income */}
        <div className="p-4 bg-white border border-stone-200 rounded shadow-2xs">
          <span className="text-[11px] font-medium text-stone-500 block">Net Store Income</span>
          <span
            className={`font-mono text-2xl font-bold tabular-nums block mt-1 ${
              financials.netStoreIncome >= 0 ? 'text-stone-900' : 'text-rose-600'
            }`}
          >
            {settings.currencySymbol}{financials.netStoreIncome.toFixed(2)}
          </span>
          <span className="text-[11px] text-stone-500 mt-0.5 block">
            Profit after all operating expenses
          </span>
        </div>
      </div>}

      {/* Tabs */}
      {!expensesOnly && <div className="flex items-center gap-2 border-b border-stone-200 pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-3 py-1.5 rounded cursor-pointer ${
            activeTab === 'reports' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Income & P&L Statement
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-3 py-1.5 rounded cursor-pointer ${
            activeTab === 'expenses' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Operating Expenses ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab('tax')}
          className={`px-3 py-1.5 rounded cursor-pointer ${
            activeTab === 'tax' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          India GST & HSN Sales Summary
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-3 py-1.5 rounded cursor-pointer ${activeTab === 'ledger' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}
        >
          Full Activity & Stock Ledger
        </button>
      </div>}

      {/* TAB 1: P&L Statement & Payment Breakdown */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Detailed Income Statement */}
          <div className="bg-white border border-stone-200 rounded p-5 space-y-3">
            <h3 className="font-bold text-sm text-stone-900 pb-2 border-b border-stone-200">
              Profit & Loss Statement (P&L)
            </h3>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-stone-100">
                <span className="text-stone-700 font-sans">Gross Apparel Sales:</span>
                <span className="tabular-nums font-bold text-stone-900">
                  {settings.currencySymbol}{financials.grossSales.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-100 text-emerald-700">
                <span className="font-sans">Less: Retail Discounts & Coupons:</span>
                <span className="tabular-nums font-bold">
                  -{settings.currencySymbol}{financials.discounts.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-200 font-bold text-stone-900">
                <span className="font-sans">Net Sales Revenue:</span>
                <span className="tabular-nums">
                  {settings.currencySymbol}{financials.netSales.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-100 text-stone-600">
                <span className="font-sans">Less: Cost of Goods Sold (COGS):</span>
                <span className="tabular-nums font-bold text-rose-700">
                  -{settings.currencySymbol}{financials.cogs.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-200 font-bold text-emerald-800 text-sm">
                <span className="font-sans">Gross Retail Profit:</span>
                <span className="tabular-nums">
                  {settings.currencySymbol}{financials.grossProfit.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-stone-100 text-stone-600">
                <span className="font-sans">Less: Store Operating Expenses:</span>
                <span className="tabular-nums font-bold text-rose-700">
                  -{settings.currencySymbol}{financials.totalExpenses.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between py-2 border-t-2 border-stone-900 font-bold text-stone-950 text-base">
                <span className="font-sans">Net Shop Profit:</span>
                <span className="tabular-nums">
                  {settings.currencySymbol}{financials.netStoreIncome.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Tender / Payment Distribution */}
          <div className="bg-white border border-stone-200 rounded p-5 space-y-4">
            <h3 className="font-bold text-sm text-stone-900 pb-2 border-b border-stone-200">
              Payment Method Breakdown
            </h3>

            <div className="space-y-3 text-xs">
              {/* Cash */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-stone-900">Physical Cash</span>
                </div>
                <span className="font-mono font-bold text-stone-900 tabular-nums">
                  {settings.currencySymbol}{financials.cashTotal.toFixed(2)}
                </span>
              </div>

              {/* Card */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-stone-900">Credit / Debit Card Terminal</span>
                </div>
                <span className="font-mono font-bold text-stone-900 tabular-nums">
                  {settings.currencySymbol}{financials.cardTotal.toFixed(2)}
                </span>
              </div>

              {/* UPI */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <span className="font-semibold text-stone-900">UPI / QR Digital</span>
                </div>
                <span className="font-mono font-bold text-stone-900 tabular-nums">
                  {settings.currencySymbol}{financials.upiTotal.toFixed(2)}
                </span>
              </div>
              {financials.storeCreditRefunds > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded flex justify-between items-center">
                  <span className="font-semibold text-stone-900">Gift Voucher / Store Credit Refunds</span>
                  <span className="font-mono font-bold text-stone-900 tabular-nums">
                    {settings.currencySymbol}{financials.storeCreditRefunds.toFixed(2)}
                  </span>
                </div>
              )}
              {financials.giftVoucherTotal > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded flex justify-between items-center text-xs">
                  <span className="font-semibold text-stone-900">Gift Vouchers Redeemed</span>
                  <span className="font-mono font-bold text-stone-900">{settings.currencySymbol}{financials.giftVoucherTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ledger' && (
        <section className="bg-white border border-stone-200 rounded overflow-hidden">
          <div className="p-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-stone-900">Full Activity & Stock Ledger</h3>
              <p className="text-xs text-stone-500 mt-1">Sales, returns, voids, expenses, and recorded stock movements for the selected period. Stock change is negative for sold units and positive for restored or adjusted stock.</p>
            </div>
            <button onClick={exportFullLedger} className="shrink-0 px-3 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-700 rounded cursor-pointer flex items-center gap-2">
              <Download className="w-3.5 h-3.5" /> Export Full Report (CSV)
            </button>
          </div>
          <div className="px-4 py-2 text-xs text-stone-500 border-b border-stone-100">{fullLedger.length} records · Includes voided sales · Return amounts and expenses are shown as negative values</div>
          <div className="overflow-auto max-h-[65vh]">
            <table className="min-w-[1500px] w-full text-xs text-left">
              <thead className="sticky top-0 bg-stone-100 text-stone-600 z-10">
                <tr>{['Date / Time', 'Type', 'Reference', 'Item / Description', 'SKU', 'Stock ±', 'Taxable', 'GST', 'Amount', 'Payment / Refund', 'Status', 'Details'].map((heading) => <th key={heading} className="px-3 py-2 font-semibold whitespace-nowrap">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {fullLedger.map((row, index) => <tr key={`${row.type}-${row.reference}-${index}`} className="hover:bg-stone-50">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTimeDisplay(row.timestamp)}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-semibold">{row.type}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono">{row.reference || '—'}</td>
                  <td className="px-3 py-2">{row.description || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono">{row.sku || '—'}</td>
                  <td className={`px-3 py-2 text-right font-mono ${Number(row.quantityChange) > 0 ? 'text-emerald-700' : Number(row.quantityChange) < 0 ? 'text-rose-700' : ''}`}>{row.quantityChange === '' ? '—' : row.quantityChange > 0 ? `+${row.quantityChange}` : row.quantityChange}</td>
                  <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{row.taxable === '' ? '—' : `${settings.currencySymbol}${Number(row.taxable).toFixed(2)}`}</td>
                  <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{row.gst === '' ? '—' : `${settings.currencySymbol}${Number(row.gst).toFixed(2)}`}</td>
                  <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${Number(row.amount) < 0 ? 'text-rose-700' : ''}`}>{row.amount === '' ? '—' : `${settings.currencySymbol}${Number(row.amount).toFixed(2)}`}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.payment || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.status || '—'}</td>
                  <td className="px-3 py-2 max-w-xs">{row.details || '—'}</td>
                </tr>)}
                {fullLedger.length === 0 && <tr><td colSpan={12} className="p-8 text-center text-stone-500">No activity found for this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: Operating Expenses */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-stone-900">Operating Expenses Log</h3>
            {canAddExpense && (
              <button
                onClick={() => setIsAddingExpense(true)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log New Expense</span>
              </button>
            )}
          </div>

          <div className="bg-white border border-stone-200 rounded overflow-hidden">
            {expenses.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">
                No operating expenses recorded.
              </div>
            ) : (
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[11px]">
                    <th className="py-2.5 px-4 font-medium">Date</th>
                    <th className="py-2.5 px-4 font-sans font-medium">Category</th>
                    <th className="py-2.5 px-4 font-sans font-medium">Description</th>
                    <th className="py-2.5 px-4 font-sans font-medium">Payment Mode</th>
                    <th className="py-2.5 px-4 font-medium">Receipt Ref</th>
                    <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                    <th className="py-2.5 px-4 font-medium text-right font-sans">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-stone-50/70">
                      <td className="py-3 px-4 text-stone-500">{exp.date}</td>
                      <td className="py-3 px-4 font-sans font-semibold text-stone-800">{exp.category}</td>
                      <td className="py-3 px-4 font-sans text-stone-600">{exp.description}</td>
                      <td className="py-3 px-4 font-sans text-stone-600">{exp.paymentMethod}</td>
                      <td className="py-3 px-4 text-stone-400">{exp.receiptRef || '—'}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-stone-900">
                        {settings.currencySymbol}{exp.amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        {hasPermission('expenses.manage') && (
                          <button
                            onClick={() => deleteExpense(exp.id)}
                            className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                            title="Delete expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: India GST & HSN Sales Summary */}
      {activeTab === 'tax' && settings.registrationType !== 'regular' && (
        <div className="rounded-lg border border-stone-200 bg-white p-6 text-sm text-stone-700">
          <h3 className="font-semibold text-stone-900">GST collection is disabled for this business mode</h3>
          <p className="mt-2 leading-relaxed">{settings.registrationType === 'composition'
            ? 'Composition businesses cannot collect GST from customers. The POS issues bills of supply and leaves composition tax liability calculations and filings to your accountant.'
            : 'This business is configured as not registered for GST. The POS issues retail receipts and does not add GST to sales.'}</p>
          <p className="mt-2 text-xs text-stone-500">If the business changes its GST status, update the registration type in Store Settings before processing sales.</p>
        </div>
      )}
      {activeTab === 'tax' && settings.registrationType === 'regular' && (
        <div className="space-y-6 text-xs">
          {/* GSTIN Business Header Card */}
          <div className="bg-white border border-stone-200 rounded p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-base text-stone-950">
                  GSTIN: {settings.taxId || 'Not configured'}
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] tracking-wide uppercase">
                  Verify GST registration
                </span>
              </div>
              <div className="text-stone-600 space-x-2 text-[11px]">
                <span className="font-semibold">{settings.storeName}</span>
                <span>·</span>
                <span>State: {settings.stateName} (Code: {settings.stateCode})</span>
                <span>·</span>
                <span>{settings.address}</span>
              </div>
            </div>

            <button
              onClick={handleExportHsnCSV}
              className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-xs shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Download HSN Sales Summary (CSV)</span>
            </button>
          </div>

          {/* Tax Liability Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="p-4 bg-white border border-stone-200 rounded">
              <span className="text-[11px] text-stone-500 block">Total Taxable Value</span>
              <span className="font-mono text-xl font-bold text-stone-900 tabular-nums block mt-1">
                {settings.currencySymbol}{financials.netSales.toFixed(2)}
              </span>
              <span className="text-[10px] text-stone-400 mt-0.5 block">Net apparel sales after discounts</span>
            </div>

            <div className="p-4 bg-white border border-stone-200 rounded">
              <span className="text-[11px] text-stone-500 block">Central GST (CGST)</span>
              <span className="font-mono text-xl font-bold text-stone-900 tabular-nums block mt-1">
                {settings.currencySymbol}{gstComponents.cgst.toFixed(2)}
              </span>
              <span className="text-[10px] text-stone-400 mt-0.5 block">Intra-state supply</span>
            </div>

            <div className="p-4 bg-white border border-stone-200 rounded">
              <span className="text-[11px] text-stone-500 block">State GST (SGST / UTGST)</span>
              <span className="font-mono text-xl font-bold text-stone-900 tabular-nums block mt-1">
                {settings.currencySymbol}{gstComponents.sgst.toFixed(2)}
              </span>
              <span className="text-[10px] text-stone-400 mt-0.5 block">Uttar Pradesh intra-state supply</span>
            </div>

            <div className="p-4 bg-white border border-stone-200 rounded">
              <span className="text-[11px] text-stone-500 block">Integrated GST (IGST)</span>
              <span className="font-mono text-xl font-bold text-stone-900 tabular-nums block mt-1">
                {settings.currencySymbol}{gstComponents.igst.toFixed(2)}
              </span>
              <span className="text-[10px] text-stone-400 mt-0.5 block">Inter-state supplies</span>
            </div>

            <div className="p-4 bg-white border border-amber-300 bg-amber-50/40 rounded">
              <span className="text-[11px] text-amber-900 font-semibold block">Total GST Collected</span>
              <span className="font-mono text-xl font-bold text-stone-950 tabular-nums block mt-1">
                {settings.currencySymbol}{financials.taxCollected.toFixed(2)}
              </span>
              <span className="text-[10px] text-amber-800/80 mt-0.5 block">CGST + SGST + IGST recorded</span>
            </div>
          </div>

          {/* Table 12: HSN-Wise Summary of Outward Supplies */}
          <div className="bg-white border border-stone-200 rounded overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-stone-900 text-xs">
                  HSN-Wise Summary of Outward Supplies (review before filing)
                </h4>
                <p className="text-[11px] text-stone-500">
                  HSN and rate summary for review before filing. This app does not file GST returns.
                </p>
              </div>
              <span className="text-[11px] font-mono text-stone-500 font-semibold">
                {hsnReport.length} HSN Category{hsnReport.length === 1 ? '' : 'ies'}
              </span>
            </div>

            {hsnReport.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">
                No garment sales recorded for the selected period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 text-[11px]">
                      <th className="py-2.5 px-4 font-bold">HSN Code</th>
                      <th className="py-2.5 px-4 font-sans font-medium">Description</th>
                      <th className="py-2.5 px-3 font-medium text-center">UQC</th>
                      <th className="py-2.5 px-3 font-medium text-right">Total Qty</th>
                      <th className="py-2.5 px-4 font-medium text-right">Taxable Value</th>
                      <th className="py-2.5 px-3 font-medium text-right">CGST</th>
                      <th className="py-2.5 px-3 font-medium text-right">SGST</th>
                      <th className="py-2.5 px-3 font-medium text-right">IGST</th>
                      <th className="py-2.5 px-4 font-medium text-right font-bold">Total GST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {hsnReport.map((row) => (
                      <tr key={`${row.hsnCode}-${row.rate}`} className="hover:bg-stone-50/70">
                        <td className="py-3 px-4 font-bold text-stone-950 font-mono">
                          <span className="px-2 py-0.5 bg-stone-100 rounded border border-stone-200">
                            {row.hsnCode}
                          </span>
                          <span className="text-[10px] text-stone-400 block mt-1">GST {row.rate}%</span>
                        </td>
                        <td className="py-3 px-4 font-sans font-medium text-stone-800">
                          {row.description}
                        </td>
                        <td className="py-3 px-3 text-center text-stone-500">
                          PCS
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums font-bold text-stone-900">
                          {row.quantity}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-stone-900">
                          {settings.currencySymbol}{row.taxableValue.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-stone-600">
                          {settings.currencySymbol}{row.cgstAmount.toFixed(2)}
                          <span className="text-[10px] text-stone-400 block font-sans">@ {(row.rate / 2).toFixed(1)}%</span>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-stone-600">
                          {settings.currencySymbol}{row.sgstAmount.toFixed(2)}
                          <span className="text-[10px] text-stone-400 block font-sans">@ {(row.rate / 2).toFixed(1)}%</span>
                        </td>
                      <td className="py-3 px-3 text-right tabular-nums text-stone-600">{settings.currencySymbol}{row.igstAmount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right tabular-nums font-bold text-emerald-800">
                          {settings.currencySymbol}{row.totalGst.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-stone-100/80 font-bold border-t-2 border-stone-300 text-stone-950">
                      <td colSpan={3} className="py-3 px-4 font-sans text-xs">
                        TOTAL CONSOLIDATED
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {hsnReport.reduce((sum, r) => sum + r.quantity, 0)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {settings.currencySymbol}
                        {hsnReport.reduce((sum, r) => sum + r.taxableValue, 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {settings.currencySymbol}
                        {hsnReport.reduce((sum, r) => sum + r.cgstAmount, 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {settings.currencySymbol}
                        {hsnReport.reduce((sum, r) => sum + r.sgstAmount, 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {settings.currencySymbol}
                        {hsnReport.reduce((sum, r) => sum + r.igstAmount, 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-emerald-800">
                        {settings.currencySymbol}
                        {hsnReport.reduce((sum, r) => sum + r.totalGst, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Statutory Reference & Advice Box */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded text-stone-600 space-y-1.5 font-sans leading-relaxed text-[11px]">
            <h5 className="font-bold text-stone-800">Indian Apparel GST & HSN Guidelines:</h5>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <strong>Verify the shop GSTIN, HSN classification, and each product's applicable rate.</strong> For apparel under HSN Chapters 61 and 62, the current standard rate is 5% up to ₹2,500 per piece and 18% above that value. Intra-state sales split into CGST and SGST; inter-state sales use IGST.
              </li>
              <li>
                <strong>HSN Classification</strong>: Chapter 61 covers knitted or crocheted apparel (e.g. 6109 T-shirts, 6110 Knitwear); Chapter 62 covers woven garments (e.g. 6205 Woven Shirts, 6203 Suits/Trousers, 6204 Dresses); Chapter 42 covers leather belts and accessories (4203).
              </li>
              <li>
                <strong>GST filing</strong>: The CSV is an HSN sales summary for review. It is not a validated return file and the app does not file returns, generate IRNs/e-invoices, or verify GSTIN status. Review it with your accountant before filing.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {isAddingExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full text-stone-900 border border-stone-200 p-6 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-stone-900">Record Store Expense</h3>

            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Expense Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as StoreExpense['category'])}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded font-medium bg-white"
                >
                  <option value="Packaging & Bags">Packaging & Bags</option>
                  <option value="Staff Wages">Staff Wages</option>
                  <option value="Alteration Services">Alteration Services</option>
                  <option value="Rent">Store Rent</option>
                  <option value="Utilities">Utilities & Electric</option>
                  <option value="Store Maintenance">Store Maintenance</option>
                  <option value="Supplies">Office / Register Supplies</option>
                  <option value="Marketing">Local Marketing</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="e.g. 500 kraft shopping bags from local distributor"
                  className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">
                    Amount ({settings.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded font-mono font-bold bg-white"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Paid Via</label>
                  <select
                    value={expensePayment}
                    onChange={(e) => setExpensePayment(e.target.value as StoreExpense['paymentMethod'])}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white"
                  >
                    <option value="Cash">Cash (Petty Cash)</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Supplier Invoice / Receipt #</label>
                <input
                  type="text"
                  value={expenseRef}
                  onChange={(e) => setExpenseRef(e.target.value)}
                  placeholder="e.g. INV-9042"
                  className="w-full px-3 py-1.5 border border-stone-300 rounded font-mono bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingExpense(false)}
                  className="flex-1 py-2 font-semibold text-stone-600 bg-stone-100 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded cursor-pointer"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
