import React, { useState } from 'react';
import { GiftVoucher } from '../../types/pos';
import { usePOS } from '../../context/POSContext';
import { formatDateTimeDisplay } from '../../utils/dateFormat';
import { generateBarcodeSvg } from '../../utils/barcode128';
import { printDocument } from '../../utils/printing';
import { Download, Printer, X } from 'lucide-react';

export const GiftVoucherPrintModal: React.FC<{ voucher: GiftVoucher | null; onClose: () => void }> = ({ voucher, onClose }) => {
  const { settings } = usePOS();
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  if (!voucher) return null;

  const saveVoucherPdf = () => {
    void printDocument('thermal-voucher', { saveAsPdf: true, fileName: `${voucher.code}.pdf` });
  };
  const voucherBarcodeSvg = generateBarcodeSvg(voucher.code, { height: 42, moduleWidth: 1.4, showText: false });

  return <div id="voucher-print-modal" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div className="bg-white rounded-lg shadow-2xl max-w-md w-full text-stone-900 border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
      <div className="px-5 py-3.5 bg-stone-900 text-stone-100 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2"><Printer className="w-4 h-4 text-amber-400" /><h3 className="font-semibold text-sm">Voucher Preview</h3></div>
        <div className="flex items-center gap-2">
          <div className="flex bg-stone-800 rounded p-0.5 text-[11px] font-mono">
            {(['80mm', '58mm'] as const).map((width) => <button key={width} type="button" onClick={() => setPaperWidth(width)} className={`px-2 py-0.5 rounded cursor-pointer ${paperWidth === width ? 'bg-amber-400 text-stone-950 font-bold' : 'text-stone-300'}`}>{width}</button>)}
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white p-1 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <div id="voucher-print-area" className="flex-1 overflow-y-auto p-6 bg-stone-100/70 flex justify-center">
        <article id="thermal-voucher" data-paper-width={paperWidth} style={{ fontFamily: 'Arial, Helvetica, sans-serif' }} className={`bg-white p-[3mm] shadow-xs border border-stone-200 text-stone-900 text-xs leading-normal ${paperWidth === '80mm' ? 'w-[340px]' : 'w-[260px]'}`}>
          <div className="text-center space-y-1 mb-4 border-b border-dashed border-stone-400 pb-3">
            <h2 className="font-bold text-sm uppercase">{settings.storeName}</h2>
            {settings.tagline && <p className="text-[10px]">{settings.tagline}</p>}
            {settings.address && <p className="text-[10px]">{settings.address}</p>}
            {settings.phone && <p className="text-[10px]">Tel: {settings.phone}</p>}
          </div>
          <div className="text-center py-3">
            <span className="text-[10px] font-bold tracking-wider">GIFT VOUCHER</span>
            <p className="font-bold text-base mt-2 break-all">{voucher.code}</p>
            <div className="mx-auto mt-2 w-full max-w-[58mm]" aria-label={`Barcode for gift voucher ${voucher.code}`} dangerouslySetInnerHTML={{ __html: voucherBarcodeSvg }} />
            <p className="text-[9px] text-stone-600 mt-1">Scan this barcode at checkout to redeem</p>
            <p className="font-bold text-2xl mt-3">{settings.currencySymbol}{voucher.initialValue.toFixed(2)}</p>
          </div>
          <div className="space-y-1 border-t border-dashed border-stone-300 pt-3 text-[11px] leading-[1.35]">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-2"><span className="min-w-0">Current balance:</span><strong className="min-w-0 text-right break-all">{settings.currencySymbol}{voucher.balance.toFixed(2)}</strong></div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-2"><span className="min-w-0">Status:</span><strong className="min-w-0 text-right uppercase break-all">{voucher.status}</strong></div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-2"><span className="min-w-0">Issued:</span><span className="min-w-0 text-right break-all">{formatDateTimeDisplay(voucher.createdAt)}</span></div>
            {voucher.customerName && <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-2"><span className="min-w-0">Customer:</span><span className="min-w-0 text-right break-all">{voucher.customerName}</span></div>}
          </div>
          <div className="text-center text-[9px] text-stone-600 border-t border-dashed border-stone-300 mt-3 pt-3">
            <p>Present this code at checkout. The POS will check the current balance before use.</p>
            <p className="mt-2">{settings.storeName} · {voucher.note}</p>
          </div>
        </article>
      </div>
      <div className="p-4 bg-white border-t border-stone-200 flex gap-2 print:hidden">
        <button type="button" onClick={onClose} className="flex-1 py-2 px-3 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded cursor-pointer">Close</button>
        <button type="button" onClick={saveVoucherPdf} className="flex-1 py-2 px-3 text-xs font-semibold text-stone-900 bg-amber-400 hover:bg-amber-300 rounded cursor-pointer flex items-center justify-center gap-1.5"><Download className="w-4 h-4" /><span>Save PDF</span></button>
        <button type="button" onClick={() => void printDocument('thermal-voucher')} className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-700 rounded cursor-pointer flex items-center justify-center gap-1.5"><Printer className="w-4 h-4" /><span>Print Voucher</span></button>
      </div>
      <p className="px-4 pb-3 text-center text-[10px] text-stone-500 print:hidden">PDF downloads as {voucher.code}.pdf, centered for the selected {paperWidth} roll.</p>
    </div>
  </div>;
};
