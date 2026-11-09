import React, { useState } from 'react';
import { Printer, X } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { formatDateTimeDisplay } from '../../utils/dateFormat';
import { printDocument } from '../../utils/printing';

interface EstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EstimateModal: React.FC<EstimateModalProps> = ({ isOpen, onClose }) => {
  const { settings, activeUser, cart, cartTotals, cartOrderDiscount, customerDetails } = usePOS();
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [estimateNumber] = useState(() => `EST-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
  const registrationType = settings.registrationType || (settings.taxId ? 'regular' : 'unregistered');
  if (!isOpen) return null;

  return <div id="estimate-print-modal" className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[92vh]">
      <div className="px-4 py-3 bg-stone-900 text-white flex items-center justify-between print:hidden">
        <strong className="text-sm">Estimate preview</strong>
        <div className="flex items-center gap-2">
          <select aria-label="Estimate paper width" value={paperWidth} onChange={(event) => setPaperWidth(event.target.value as '80mm' | '58mm')} className="bg-stone-800 text-white text-xs rounded p-1"><option>80mm</option><option>58mm</option></select>
          <button type="button" onClick={onClose} aria-label="Close estimate"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <div id="estimate-print-area" className="overflow-y-auto p-5 bg-stone-100 flex justify-center">
        <div id="thermal-estimate" data-paper-width={paperWidth} className={`bg-white p-5 border border-stone-200 font-mono text-[11px] leading-tight ${paperWidth === '80mm' ? 'w-[340px]' : 'w-[260px]'}`}>
          <div className="text-center border-b border-dashed border-stone-400 pb-3 mb-3 space-y-1">
            <div className="font-bold text-sm tracking-wide">ESTIMATE</div>
            <div className="font-bold text-rose-700 text-[10px]">NOT A TAX INVOICE · PAYMENT NOT RECEIVED</div>
            {registrationType === 'composition' && <div className="text-[9px]">Composition taxable person; tax not collected separately.</div>}
            <div className="font-bold uppercase">{settings.storeName}</div>
            {settings.legalBusinessName && registrationType !== 'unregistered' && <div>{settings.legalBusinessName}</div>}
            {settings.address && <div>{settings.address}</div>}
            {settings.phone && <div>Tel: {settings.phone}</div>}
            {registrationType === 'regular' && <div>GSTIN: {settings.taxId}</div>}
          </div>
          <div className="space-y-1 border-b border-dashed border-stone-300 pb-2 mb-3">
            <div className="flex justify-between"><span>Estimate #</span><strong>{estimateNumber}</strong></div>
            <div className="flex justify-between"><span>Date</span><span>{formatDateTimeDisplay(new Date())}</span></div>
            <div className="flex justify-between"><span>Prepared by</span><span>{activeUser.name}</span></div>
            {customerDetails.name && <div>Customer: {customerDetails.name}{customerDetails.phone ? ` · ${customerDetails.phone}` : ''}</div>}
            {customerDetails.address && <div>Address: {customerDetails.address}</div>}
          </div>
          <div className="space-y-2 mb-3">
            {cart.map((item) => {
              const taxLine = cartTotals.lineTaxBreakdown.find((line) => line.variantId === item.variantId);
              return <div key={item.variantId} className="border-b border-dotted border-stone-200 pb-1">
                <div className="flex justify-between gap-2"><span className="font-semibold">{item.productName}</span><span>{settings.currencySymbol}{(taxLine?.customerTotal || 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-stone-600"><span>Option 2: {item.color} · Option 1: {item.size} · Qty {item.quantity}{(taxLine?.promotionFreeQuantity || 0) > 0 ? ` (${taxLine?.promotionFreeQuantity} free)` : ''}</span><span>@ {settings.currencySymbol}{item.unitPrice.toFixed(2)}</span></div>
                {(taxLine?.promotionDiscount || 0) > 0 && <div className="text-emerald-700">Offer discount: -{settings.currencySymbol}{taxLine!.promotionDiscount.toFixed(2)}</div>}
              </div>;
            })}
          </div>
          <div className="space-y-1 border-t border-dashed border-stone-400 pt-2">
            <div className="flex justify-between"><span>{settings.registrationType === 'regular' ? (settings.priceMode === 'inclusive' ? 'Subtotal (GST inclusive)' : 'Subtotal (before GST)') : 'Subtotal'}</span><span>{settings.currencySymbol}{cartTotals.subtotal.toFixed(2)}</span></div>
            {cartTotals.totalDiscount > 0 && <div className="flex justify-between text-emerald-700"><span>Discounts{cartOrderDiscount.value ? ` (including cart ${cartOrderDiscount.value}${cartOrderDiscount.type === 'percentage' ? '%' : ` ${settings.currencySymbol}`})` : ''}</span><span>-{settings.currencySymbol}{cartTotals.totalDiscount.toFixed(2)}</span></div>}
            <div className="flex justify-between"><span>{registrationType === 'regular' ? 'Taxable value' : 'Items total'}</span><span>{settings.currencySymbol}{cartTotals.taxableAmount.toFixed(2)}</span></div>
            {registrationType === 'regular' && <div className="flex justify-between"><span>{settings.priceMode === 'inclusive' ? 'GST included in price' : 'Estimated GST'}</span><span>{settings.currencySymbol}{cartTotals.taxTotal.toFixed(2)}</span></div>}
            {registrationType === 'composition' && <div className="text-[9px]">Bill of supply estimate · no GST collected</div>}
            <div className="flex justify-between font-bold text-sm border-t border-stone-300 pt-2"><span>ESTIMATED TOTAL</span><span>{settings.currencySymbol}{cartTotals.grandTotal.toFixed(2)}</span></div>
          </div>
          <div className="border-t border-dashed border-stone-300 mt-3 pt-2 text-center text-[9px] text-stone-600 space-y-1">
            <div>Prices and stock are subject to confirmation at checkout.</div>
            <div>This estimate is not a sale receipt and does not reserve stock.</div>
          </div>
        </div>
      </div>
      <div className="p-3 border-t flex gap-2 print:hidden">
          <button type="button" onClick={() => void printDocument('thermal-estimate')} className="flex-1 py-2 rounded bg-stone-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"><Printer className="w-4 h-4" />Print estimate</button>
        <button type="button" onClick={onClose} className="px-4 py-2 rounded border text-sm">Close</button>
      </div>
    </div>
  </div>;
};
