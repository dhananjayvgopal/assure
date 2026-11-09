/**
 * POS Thermal Receipt Modal & Print Engine
 * Optimized for standard 80mm and 58mm thermal printers (Epson, Star Micronics, Munbyn, Xprinter)
 * Includes scannable Code 128 barcode of receipt ID for 1-second scan returns!
 */

import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { SaleTransaction } from '../../types/pos';
import { generateBarcodeSvg } from '../../utils/barcode128';
import { formatDateTimeDisplay } from '../../utils/dateFormat';
import { printDocument } from '../../utils/printing';
import { Printer, X, Download } from 'lucide-react';

interface ReceiptModalProps {
  transaction: SaleTransaction | null;
  isOpen: boolean;
  onClose: () => void;
}

interface A4InvoiceProps {
  transaction: SaleTransaction;
  settings: ReturnType<typeof usePOS>['settings'];
  registrationType: 'regular' | 'composition' | 'unregistered';
  invoiceHeading: string;
  invoiceNumberLabel: string;
  taxGroups: Map<number, { taxable: number; cgst: number; sgst: number; igst: number; total: number }>;
}

const A4InvoiceLayout: React.FC<A4InvoiceProps> = ({ transaction, settings, registrationType, invoiceHeading, invoiceNumberLabel, taxGroups }) => {
  const currency = settings.currencySymbol;
  const taxableValue = transaction.items.reduce((sum, item) => sum + (item.taxableValue ?? item.lineTotal), 0);
  const paid = Math.max(0, transaction.payments.reduce((sum, payment) => sum + payment.amount, 0) - transaction.changeGiven);
  const balance = Math.max(0, transaction.grandTotal - paid);
  const labelStyle: React.CSSProperties = { color: '#586b7e', fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' };
  const boxStyle: React.CSSProperties = { border: '1px solid #dbe3ec', borderRadius: 7, padding: 12, backgroundColor: '#f5f8fb' };
  const thStyle: React.CSSProperties = { padding: '8px 7px', textAlign: 'left', color: '#294761', backgroundColor: '#e6eff6', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' };
  const tdStyle: React.CSSProperties = { padding: '7px', borderBottom: '1px solid #e5ebf1', verticalAlign: 'top' };

  return <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#20364b', fontSize: 11, lineHeight: 1.3, width: '100%' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', padding: '15px 17px', borderRadius: 9, backgroundColor: '#eaf2f8', color: '#20364b', border: '1px solid #d7e4ee' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '.02em', color: '#20364b' }}>{settings.storeName}</div>
        {settings.legalBusinessName && settings.legalBusinessName !== settings.storeName && <div style={{ color: '#586b7e', marginTop: 2 }}>{settings.legalBusinessName}</div>}
        {settings.tagline && <div style={{ color: '#586b7e', marginTop: 3 }}>{settings.tagline}</div>}
        {settings.address && <div style={{ color: '#354d63', marginTop: 4 }}>{settings.address}</div>}
        {settings.phone && <div style={{ color: '#354d63', marginTop: 2 }}>Phone: {settings.phone}</div>}
        {registrationType !== 'unregistered' && <div style={{ color: '#20364b', fontWeight: 700, marginTop: 4 }}>GSTIN: {settings.taxId}</div>}
      </div>
      <div style={{ textAlign: 'right', minWidth: 135 }}>
        <div style={{ display: 'inline-block', backgroundColor: '#fff1c9', color: '#59450e', border: '1px solid #f0d991', borderRadius: 5, padding: '5px 9px', fontSize: 12, fontWeight: 800 }}>{invoiceHeading}</div>
        <div style={{ color: '#586b7e', marginTop: 10 }}>{invoiceNumberLabel}</div>
        <div style={{ color: '#20364b', fontSize: 13, fontWeight: 700 }}>{transaction.receiptNumber}</div>
        <div style={{ color: '#586b7e', marginTop: 5 }}>Invoice Date</div>
        <div style={{ color: '#20364b' }}>{formatDateTimeDisplay(transaction.timestamp)}</div>
      </div>
    </div>

    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
      <div style={{ ...boxStyle, flex: 1 }}>
        <div style={labelStyle}>Bill To</div>
        <div style={{ fontWeight: 700, color: '#20364b', marginTop: 4 }}>{transaction.customerName || 'Walk-in Customer'}</div>
        {transaction.customerPhone && <div>Phone: {transaction.customerPhone}</div>}
        {transaction.customerAddress && <div>{transaction.customerAddress}</div>}
        {transaction.customerGstin && <div style={{ fontWeight: 700, marginTop: 3 }}>GSTIN: {transaction.customerGstin}</div>}
        {!transaction.customerName && !transaction.customerPhone && !transaction.customerAddress && !transaction.customerGstin && <div style={{ color: '#586b7e', marginTop: 3 }}>Retail customer</div>}
      </div>
      <div style={{ ...boxStyle, flex: 1 }}>
        <div style={labelStyle}>Ship To</div>
        <div style={{ fontWeight: 700, marginTop: 4 }}>{transaction.customerName || 'Walk-in Customer'}</div>
        <div>{transaction.customerAddress || 'Same as billing address'}</div>
        {transaction.placeOfSupplyStateName && <div style={{ marginTop: 3 }}>Place of supply: {transaction.placeOfSupplyStateName} ({transaction.placeOfSupplyStateCode})</div>}
        <div style={{ marginTop: 3 }}>Cashier: {transaction.cashierName}</div>
      </div>
    </div>

    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 13, tableLayout: 'fixed' }}>
      <thead><tr>
        <th style={{ ...thStyle, width: 27 }}>#</th><th style={thStyle}>Description</th>{registrationType !== 'unregistered' && <th style={{ ...thStyle, width: 48 }}>HSN</th>}
        <th style={{ ...thStyle, width: 38, textAlign: 'right' }}>Qty</th><th style={{ ...thStyle, width: 73, textAlign: 'right' }}>Unit Price</th><th style={{ ...thStyle, width: 83, textAlign: 'right' }}>Total</th>
      </tr></thead>
      <tbody>{transaction.items.map((item, index) => {
        const lineAmount = transaction.priceMode === 'inclusive' && registrationType === 'regular'
          ? (item.taxableValue ?? item.lineTotal) + item.taxAmount
          : (item.taxableValue ?? item.lineTotal);
        return <tr key={`${item.variantId}-${index}`} style={{ backgroundColor: index % 2 ? '#f7f9fc' : '#fff' }}>
          <td style={tdStyle}>{index + 1}</td>
          <td style={tdStyle}><div style={{ fontWeight: 700 }}>{item.productName}</div><div style={{ color: '#586b7e', fontSize: 10 }}>Color: {item.color} · Size: {item.size}{(item.offerFreeQuantity || 0) > 0 ? ` · ${item.offerFreeQuantity} free` : ''}</div></td>
          {registrationType !== 'unregistered' && <td style={tdStyle}>{item.hsnCode || '—'}</td>}
          <td style={{ ...tdStyle, textAlign: 'right' }}>{item.quantity}</td>
          <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>{currency}{item.unitPrice.toFixed(2)}</td>
          <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{currency}{lineAmount.toFixed(2)}</td>
        </tr>;
      })}</tbody>
    </table>

    {transaction.partnerReward && <div style={{ backgroundColor: '#fff5d9', color: '#4c401d', border: '1px solid #ead797', borderRadius: 7, padding: '9px 11px', marginTop: 10 }}>
      <div style={{ fontWeight: 800, color: '#55430e' }}>PARTNER REWARD · FREE {transaction.partnerReward.itemName}</div>
      <div>Claim from {transaction.partnerReward.partnerName}. Minimum sale: {currency}{transaction.partnerReward.minimumPurchase.toFixed(2)}.</div>
      {transaction.partnerReward.instructions && <div style={{ marginTop: 3 }}>{transaction.partnerReward.instructions}</div>}
      <div style={{ fontSize: 9, marginTop: 3 }}>This partner item is supplied and redeemed by the partner business.</div>
    </div>}

    <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, ...boxStyle, backgroundColor: '#fff' }}>
        <div style={labelStyle}>Payment Details</div>
        {transaction.payments.map((payment, index) => <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 5 }}>
          <span>{payment.method === 'gift_voucher' ? `Gift Voucher${payment.reference ? ` (${payment.reference})` : ''}` : payment.method.toUpperCase()}{payment.reference && payment.method !== 'gift_voucher' ? ` · Ref ${payment.reference}` : ''}</span>
          <strong style={{ whiteSpace: 'nowrap' }}>{currency}{payment.amount.toFixed(2)}</strong>
        </div>)}
        {transaction.changeGiven > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}><span>Change given</span><span>{currency}{transaction.changeGiven.toFixed(2)}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #dbe3ec', paddingTop: 6, marginTop: 6 }}><strong>Received</strong><strong>{currency}{paid.toFixed(2)}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><strong>Balance Due</strong><strong>{currency}{balance.toFixed(2)}</strong></div>
      </div>
      <div style={{ width: 225, padding: '2px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Subtotal</span><span>{currency}{transaction.subtotal.toFixed(2)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#13805c' }}><span>Discount</span><span>-{currency}{transaction.discountTotal.toFixed(2)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid #dbe3ec', fontWeight: 700 }}><span>Subtotal Less Discount</span><span>{currency}{Math.max(0, transaction.subtotal - transaction.discountTotal).toFixed(2)}</span></div>
        {registrationType === 'regular' && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid #dbe3ec' }}><span>Taxable Value</span><span>{currency}{taxableValue.toFixed(2)}</span></div>}
        {registrationType === 'regular' && Array.from(taxGroups.entries()).sort(([a], [b]) => a - b).map(([rate, amounts]) => transaction.isInterState
          ? <div key={rate} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#586b7e' }}><span>IGST {rate}%</span><span>{currency}{amounts.igst.toFixed(2)}</span></div>
          : <React.Fragment key={rate}><div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#586b7e' }}><span>CGST {rate / 2}%</span><span>{currency}{amounts.cgst.toFixed(2)}</span></div><div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#586b7e' }}><span>SGST {rate / 2}%</span><span>{currency}{amounts.sgst.toFixed(2)}</span></div></React.Fragment>)}
        {registrationType === 'regular' && transaction.priceMode === 'inclusive' && <div style={{ color: '#586b7e', textAlign: 'right', fontSize: 9 }}>GST included in prices</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#fff4d6', color: '#293f54', border: '1px solid #f0dfb2', borderRadius: 6, padding: '9px 10px', marginTop: 7, fontSize: 14, fontWeight: 800 }}><span>Grand Total</span><span>{currency}{transaction.grandTotal.toFixed(2)}</span></div>
      </div>
    </div>

    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, marginTop: 14, paddingTop: 9, borderTop: '1px solid #dbe3ec', color: '#586b7e', fontSize: 9 }}>
      <div><strong style={{ color: '#20364b' }}>Terms & Instructions</strong><div>{settings.receiptFooterNote || 'Goods once sold are subject to the store return policy.'}</div></div>
      <div style={{ minWidth: 150, textAlign: 'center', paddingTop: 12, borderTop: '1px solid #8796a4', color: '#20364b' }}>Authorised Signature</div>
    </div>
  </div>;
};

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  isOpen,
  onClose,
}) => {
  const { settings } = usePOS();
  const registrationType = settings.registrationType || (settings.taxId ? 'regular' : 'unregistered');
  const invoicePrintFormat = settings.invoicePrintFormat || 'thermal';
  const invoiceHeading = registrationType === 'regular'
    ? 'TAX INVOICE'
    : registrationType === 'composition'
      ? 'BILL OF SUPPLY'
      : 'INVOICE';
  const invoiceNumberLabel = registrationType === 'regular'
    ? 'Tax invoice #:'
    : registrationType === 'composition'
      ? 'Bill of supply #:'
      : 'Invoice #:';
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !transaction) return null;

  const handlePrint = () => {
    void printDocument('thermal-receipt');
  };

  const handleSavePdf = () => {
    void printDocument('thermal-receipt', { saveAsPdf: true, fileName: `${transaction?.receiptNumber || 'invoice'}.pdf` });
  };

  const barcodeSvg = generateBarcodeSvg(transaction.receiptNumber, {
    height: 38,
    moduleWidth: 1.2,
    showText: true,
    fontSize: 10,
  });
  const taxGroups = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number; total: number }>();
  transaction.items.forEach((item) => {
    const rate = item.taxRate ?? settings.taxRateDefault;
    const row = taxGroups.get(rate) || { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
    const tax = item.taxAmount || 0;
    const cgst = item.cgstAmount ?? (transaction.isInterState ? 0 : Number((tax / 2).toFixed(2)));
    const sgst = item.sgstAmount ?? (transaction.isInterState ? 0 : Number((tax - cgst).toFixed(2)));
    row.taxable += item.taxableValue ?? item.lineTotal;
    row.cgst += cgst;
    row.sgst += sgst;
    row.igst += item.igstAmount ?? (transaction.isInterState ? tax : 0);
    row.total += tax;
    taxGroups.set(rate, row);
  });

  return (
    <div id="receipt-print-modal" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full text-stone-900 border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Controls Header (Hidden during actual print via print:hidden) */}
        <div className="px-5 py-3.5 bg-stone-900 text-stone-100 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-sm">Receipt Preview</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Paper format selector */}
            {invoicePrintFormat === 'a4' ? <span className="rounded bg-amber-400 px-2 py-1 text-[11px] font-bold text-stone-950">A4 Invoice</span> : <div className="flex bg-stone-800 rounded p-0.5 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  paperWidth === '80mm' ? 'bg-amber-400 text-stone-950 font-bold' : 'text-stone-300'
                }`}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  paperWidth === '58mm' ? 'bg-amber-400 text-stone-950 font-bold' : 'text-stone-300'
                }`}
              >
                58mm
              </button>
            </div>}
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* RECEIPT CONTENT AREA (This element is printed) */}
          <div id="receipt-print-area" className="flex-1 overflow-y-auto p-6 bg-stone-100/70 flex justify-center">
          <div
            id="thermal-receipt"
            data-paper-width={paperWidth}
            data-invoice-format={invoicePrintFormat}
            className={`bg-white p-6 shadow-xs border border-stone-200 text-stone-900 font-mono text-xs leading-tight ${
              paperWidth === '80mm' ? 'w-[340px]' : 'w-[260px]'
            }`}
          >
            {invoicePrintFormat === 'a4' ? (
              <A4InvoiceLayout
                transaction={transaction}
                settings={settings}
                registrationType={registrationType}
                invoiceHeading={invoiceHeading}
                invoiceNumberLabel={invoiceNumberLabel}
                taxGroups={taxGroups}
              />
            ) : <>
            {/* Store Header */}
            <div className="text-center space-y-1 mb-4 border-b border-dashed border-stone-400 pb-3">
              <span className="block w-full text-center text-[10px] font-bold tracking-wider uppercase">
                {invoiceHeading}
              </span>
              {registrationType === 'composition' && <p className="pt-1 text-[9px] font-bold leading-tight">Composition taxable person, not eligible to collect tax on supplies</p>}
              <h2 className="font-bold text-sm text-stone-950 tracking-tight uppercase mt-1">
                {settings.storeName}
              </h2>
              {registrationType !== 'unregistered' && settings.legalBusinessName && settings.legalBusinessName !== settings.storeName && <p className="text-[10px] text-stone-600">{settings.legalBusinessName}</p>}
              {settings.tagline && <p className="text-[10px] text-stone-600">{settings.tagline}</p>}
              {settings.address && <p className="text-[10px] text-stone-600">{settings.address}</p>}
              {settings.phone && <p className="text-[10px] text-stone-600">Tel: {settings.phone}</p>}
              {registrationType !== 'unregistered' && <div className="pt-1 text-[10.5px] font-bold text-stone-900 space-y-0.5">
                <div>GSTIN: {settings.taxId}</div>
                <div className="text-[9.5px] font-medium text-stone-600">State: {settings.stateName} (Code: {settings.stateCode})</div>
              </div>}
            </div>

            {/* Transaction Metadata */}
            <div className="space-y-1 mb-3 text-[11px] border-b border-dashed border-stone-300 pb-2.5">
              <div className="flex justify-between">
                <span className="whitespace-nowrap">Invoice #:</span>
                <span className="font-bold whitespace-nowrap">{transaction.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{formatDateTimeDisplay(transaction.timestamp)}</span>
              </div>
              <div className="flex justify-between">
                <span>POS Cashier:</span>
                <span>{transaction.cashierName}</span>
              </div>
              {transaction.customerName && (
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{transaction.customerName} {transaction.customerPhone ? `(${transaction.customerPhone})` : ''}</span>
                </div>
              )}
              {transaction.customerGstin && <div className="flex justify-between"><span>Customer GSTIN:</span><span>{transaction.customerGstin}</span></div>}
              {transaction.customerAddress && <div>Customer address: {transaction.customerAddress}</div>}
              {registrationType !== 'unregistered' && <div className="flex justify-between"><span>Place of supply:</span><span>{transaction.placeOfSupplyStateName || settings.stateName} ({transaction.placeOfSupplyStateCode || settings.stateCode})</span></div>}
              {registrationType === 'regular' && <div className="flex justify-between"><span>Reverse charge:</span><span>No</span></div>}
            </div>

            {/* Line Items Table with HSN */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between font-bold text-[11px] border-b border-stone-300 pb-1">
                {registrationType !== 'unregistered' && <span className="w-14">HSN</span>}
                <span className="flex-1 px-1 whitespace-nowrap">Item</span>
                <span className="text-right w-16">Amount</span>
              </div>

              {transaction.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5 text-[11px]">
                  <div className="flex items-start justify-between">
                    {registrationType !== 'unregistered' && <span className="w-14 text-[10px] font-bold text-stone-700 font-mono">
                      {item.hsnCode || ''}
                    </span>}
                    <span className="flex-1 min-w-0 px-1 py-1 font-semibold leading-normal break-words">
                      {item.productName}
                    </span>
                    <span className="text-right w-16 tabular-nums font-bold">
                      {settings.currencySymbol}{(transaction.priceMode === 'inclusive' && registrationType === 'regular' ? (item.taxableValue ?? item.lineTotal) + item.taxAmount : (item.taxableValue ?? item.lineTotal)).toFixed(2)}
                    </span>
                  </div>
                  <div className={`text-[10px] text-stone-600 ${registrationType !== 'unregistered' ? 'pl-14' : 'pl-1'}`}>
                    <div>Color: {item.color} · Size: {item.size} · Qty {item.quantity}</div>
                    {(item.offerFreeQuantity || 0) > 0 && <div className="font-semibold text-emerald-700">FREE: {item.offerFreeQuantity} · {item.offerNames?.join(', ') || 'Buy X, Get Y Free'}</div>}
                    {item.discountValue > 0 && <div className="text-emerald-700">Item discount: {item.discountType === 'percentage' ? `${item.discountValue}%` : `${settings.currencySymbol}${item.discountValue.toFixed(2)}`}</div>}
                    {(item.offerDiscount || 0) > 0 && (item.offerFreeQuantity || 0) === 0 && <div className="text-emerald-700">Offer discount: -{settings.currencySymbol}{item.offerDiscount!.toFixed(2)}</div>}
                  </div>
                </div>
              ))}
            </div>

            {transaction.partnerReward && <div className="rounded border border-amber-400 bg-amber-50 p-2.5 mb-3 text-center text-[10px]">
              <div className="font-bold text-amber-900">PARTNER REWARD · FREE {transaction.partnerReward.itemName}</div>
              <div>From {transaction.partnerReward.partnerName} · qualifying sale {settings.currencySymbol}{transaction.partnerReward.minimumPurchase.toFixed(2)}</div>
              <div className="mt-1">{transaction.partnerReward.instructions || 'Show this receipt at the partner business to claim.'}</div>
            </div>}

            {/* Financial Summary & Indian GST Breakdown */}
            <div className="border-t border-dashed border-stone-400 pt-2 space-y-1 text-[11px] mb-3">
              <div className="flex justify-between">
                <span>{registrationType === 'regular' ? (transaction.priceMode === 'inclusive' ? 'Subtotal (GST inclusive):' : 'Subtotal (before GST):') : 'Subtotal:'}</span>
                <span className="tabular-nums">{settings.currencySymbol}{transaction.subtotal.toFixed(2)}</span>
              </div>

              {transaction.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discounts:</span>
                  <span className="tabular-nums">-{settings.currencySymbol}{transaction.discountTotal.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-stone-600">
                <span>{registrationType === 'regular' ? 'Taxable Value:' : 'Items total:'}</span>
                <span className="tabular-nums">
                  {settings.currencySymbol}{(transaction.items.reduce((sum, item) => sum + (item.taxableValue ?? item.lineTotal), 0)).toFixed(2)}
                </span>
              </div>

              {registrationType === 'regular' && <div className="border-t border-dotted border-stone-300 py-1 my-1 space-y-0.5 text-[10px] text-stone-700">
                {Array.from(taxGroups.entries()).sort(([a], [b]) => a - b).map(([rate, amounts]) => (
                  <React.Fragment key={rate}>
                    <div className="font-semibold">GST rate {rate}% on {settings.currencySymbol}{amounts.taxable.toFixed(2)}</div>
                    {transaction.isInterState ? (
                      <div className="flex justify-between"><span>IGST ({rate}%):</span><span>{settings.currencySymbol}{amounts.igst.toFixed(2)}</span></div>
                    ) : (
                      <>
                        <div className="flex justify-between"><span>CGST ({(rate / 2).toFixed(2)}%):</span><span>{settings.currencySymbol}{amounts.cgst.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>SGST ({(rate / 2).toFixed(2)}%):</span><span>{settings.currencySymbol}{amounts.sgst.toFixed(2)}</span></div>
                      </>
                    )}
                  </React.Fragment>
                ))}
                <div className="flex justify-between font-semibold text-stone-900">
                  <span>Total GST:</span>
                  <span className="tabular-nums">{settings.currencySymbol}{transaction.taxTotal.toFixed(2)}</span>
                </div>
              </div>}

              <div className="flex justify-between font-bold text-sm pt-1 border-t border-stone-300 text-stone-950">
                <span>TOTAL DUE:</span>
                <span className="tabular-nums">{settings.currencySymbol}{transaction.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="border-t border-dashed border-stone-300 pt-2 space-y-1 text-[11px] mb-4">
              {transaction.payments.map((p, idx) => (
                <div key={idx}>
                  <div className="flex justify-between">
                    <span className="whitespace-nowrap">{p.method === 'gift_voucher' ? `Voucher (${p.reference || 'code'})` : `${p.method.charAt(0).toUpperCase()}${p.method.slice(1)}:`}</span>
                    <span className="tabular-nums">{settings.currencySymbol}{p.amount.toFixed(2)}</span>
                  </div>
                  {p.reference && <div className="pl-2 text-[10px] text-stone-500 break-all">Reference #: {p.reference}</div>}
                </div>
              ))}
              {transaction.changeGiven > 0 && (
                <div className="flex justify-between font-bold text-stone-900">
                  <span>Change Given:</span>
                  <span className="tabular-nums">{settings.currencySymbol}{transaction.changeGiven.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Barcode of Receipt Number for Fast 1-Second Returns */}
            <div className="text-center pt-2 pb-2">
              <div
                className="flex justify-center"
                dangerouslySetInnerHTML={{ __html: barcodeSvg }}
              />
              <span className="text-[9px] text-stone-400 block mt-1">
                Scan barcode for easy return or exchange
              </span>
            </div>

            {/* Footer Return Policy */}
            <div className="text-center text-[10px] text-stone-500 pt-2 border-t border-dashed border-stone-300 space-y-1">
              <p>For {settings.storeName} · Authorised signatory __________________</p>
              <p className="leading-tight">{settings.receiptFooterNote}</p>
              <p className="font-semibold text-stone-700 mt-1">*** HAVE A GREAT DAY ***</p>
            </div>
            </>}
          </div>
        </div>

        {/* Action Buttons (Print / Close) */}
        <div className="p-4 bg-white border-t border-stone-200 flex gap-2 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-3 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSavePdf}
            className="flex-1 py-2 px-3 text-xs font-semibold text-stone-800 bg-amber-100 hover:bg-amber-200 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            title="Save this invoice as a PDF file"
          >
            <Download className="w-4 h-4" />
            <span>Save PDF</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>{invoicePrintFormat === 'a4' ? 'Print A4 Invoice' : 'Print Thermal Receipt'}</span>
          </button>
        </div>
          <p className="px-4 pb-3 text-[10px] leading-snug text-stone-500 print:hidden">
            Save PDF downloads this receipt directly using its receipt number as the filename.
          </p>
      </div>
    </div>
  );
};
