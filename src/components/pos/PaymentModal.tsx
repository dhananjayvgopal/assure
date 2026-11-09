/**
 * POS Payment & Tender Modal
 * Supports Cash with rapid bill denominations & change calculator,
 * Card terminal reference, UPI/QR, Store credit, and Split tender.
 */

import React, { useState, useEffect, useRef } from 'react';
import { usePOS } from '../../context/POSContext';
import { GiftVoucher, PaymentBreakdown } from '../../types/pos';
import {
  Banknote,
  CreditCard,
  QrCode,
  Layers,
  CheckCircle2,
  X,
  AlertCircle,
  Receipt,
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { cartTotals, completeSale, settings, vouchers } = usePOS();

  const totalDue = cartTotals.grandTotal;

  // Selected payment mode
  const [mode, setMode] = useState<'cash' | 'card' | 'upi' | 'split' | 'voucher'>('cash');

  // Cash Mode States
  const [cashTendered, setCashTendered] = useState<number>(totalDue);

  // Card Mode States
  const [cardRef, setCardRef] = useState<string>('');

  // UPI Mode States
  const [upiRef, setUpiRef] = useState<string>('');

  // Split Mode States
  const [splitCash, setSplitCash] = useState<number>(Math.floor(totalDue / 2));
  const [splitCard, setSplitCard] = useState<number>(Number((totalDue - Math.floor(totalDue / 2)).toFixed(2)));
  const [splitCardRef, setSplitCardRef] = useState<string>('');
  const [splitElectronicMethod, setSplitElectronicMethod] = useState<'card' | 'upi'>('card');
  const [referenceError, setReferenceError] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<GiftVoucher | null>(null);
  const voucherInputRef = useRef<HTMLInputElement>(null);
  const voucherAppliedAmount = appliedVoucher ? Math.min(totalDue, appliedVoucher.balance) : 0;
  const remainingDue = Number(Math.max(0, totalDue - voucherAppliedAmount).toFixed(2));

  // Reset inputs when opened
  useEffect(() => {
    if (isOpen) {
      setCashTendered(remainingDue);
      setCardRef('');
      setUpiRef('');
      setSplitCardRef('');
      setSplitCash(Math.floor(remainingDue / 2));
      setSplitCard(Number((remainingDue - Math.floor(remainingDue / 2)).toFixed(2)));
      setSplitElectronicMethod('card');
      setReferenceError('');
      setVoucherCode('');
      setAppliedVoucher(null);
    }
  }, [isOpen, totalDue]);

  useEffect(() => {
    if (!isOpen) return;
    setCashTendered(remainingDue);
    setSplitCash(Math.floor(remainingDue / 2));
    setSplitCard(Number((remainingDue - Math.floor(remainingDue / 2)).toFixed(2)));
  }, [appliedVoucher?.balance, isOpen, totalDue]);

  useEffect(() => {
    if (isOpen && mode === 'voucher') voucherInputRef.current?.focus();
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen) return;
    const handleVoucherBarcode = (event: Event) => {
      const code = String((event as CustomEvent<string>).detail || '').trim().toUpperCase();
      if (!code) return;
      setVoucherCode(code);
      const match = vouchers.find((entry) => entry.code.toUpperCase() === code && entry.status === 'active' && entry.balance > 0);
      if (!match) {
        setAppliedVoucher(null);
        setReferenceError('Scanned voucher is invalid, inactive, or has no balance.');
        return;
      }
      setAppliedVoucher(match);
      setVoucherCode(match.code);
      setReferenceError('');
    };
    window.addEventListener('pos-gift-voucher-scan', handleVoucherBarcode);
    return () => window.removeEventListener('pos-gift-voucher-scan', handleVoucherBarcode);
  }, [isOpen, vouchers]);

  if (!isOpen) return null;

  // Calculate change for cash
  const cashChange = Number(Math.max(0, cashTendered - remainingDue).toFixed(2));
  const isCashSufficient = cashTendered >= remainingDue;

  // Split sum check
  const splitTotal = Number((splitCash + splitCard).toFixed(2));
  const isSplitSufficient = Math.abs(splitTotal - remainingDue) < 0.01;
  const electronicReference = mode === 'card'
    ? cardRef.trim()
    : mode === 'upi'
      ? upiRef.trim()
      : mode === 'split' && splitCard > 0
        ? splitCardRef.trim()
        : 'not-required';
  const isElectronicReferenceValid = mode === 'voucher'
    ? !!appliedVoucher && voucherAppliedAmount >= totalDue
    : mode === 'cash' || (mode === 'split' && splitCard <= 0) ? true : electronicReference.length > 0;

  const handleApplyVoucher = () => {
    const match = vouchers.find((entry) => entry.code.toUpperCase() === voucherCode.trim().toUpperCase() && entry.status === 'active' && entry.balance > 0);
    if (!match) {
      setAppliedVoucher(null);
      setReferenceError('Voucher code not found, inactive, or has no balance.');
      return;
    }
    setAppliedVoucher(match);
    setVoucherCode(match.code);
    setReferenceError('');
  };

  // Handle Complete Sale
  const handleFinalizeSale = () => {
    if (!isElectronicReferenceValid) {
      setReferenceError(mode === 'voucher' ? 'Voucher balance must cover the full sale when Voucher Only is selected.' : 'Enter the payment reference number before completing this sale.');
      return;
    }
    let payments: PaymentBreakdown[] = [];
    let changeGiven = 0;
    if (appliedVoucher && voucherAppliedAmount > 0) payments.push({ method: 'gift_voucher', amount: voucherAppliedAmount, reference: appliedVoucher.code });

    if (mode === 'voucher') {
      if (!appliedVoucher || voucherAppliedAmount < totalDue) return;
    } else if (mode === 'cash') {
      if (!isCashSufficient) return;
      payments.push(
        {
          method: 'cash',
          amount: cashTendered,
        }
      );
      changeGiven = cashChange;
    } else if (mode === 'card') {
      payments.push(
        {
          method: 'card',
          amount: remainingDue,
          reference: cardRef.trim(),
        }
      );
      changeGiven = 0;
    } else if (mode === 'upi') {
      payments.push(
        {
          method: 'upi',
          amount: remainingDue,
          reference: upiRef.trim(),
        }
      );
      changeGiven = 0;
    } else if (mode === 'split') {
      if (!isSplitSufficient) return;
      payments = [];
      if (splitCash > 0) payments.push({ method: 'cash', amount: splitCash });
      if (splitCard > 0) payments.push({
        method: splitElectronicMethod,
        amount: splitCard,
        reference: splitCardRef.trim(),
      });
      changeGiven = 0;
    }

    const tx = completeSale(payments, changeGiven);
    if (tx) {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full text-stone-900 border border-stone-200 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-stone-900 text-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base leading-tight">Payment & Checkout</h3>
              <span className="text-[11px] text-stone-400">Total Due: {settings.currencySymbol}{totalDue.toFixed(2)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Payment Methods Segmented Control */}
        <div className="p-4 bg-stone-50 border-b border-stone-200">
          <div className="grid grid-cols-5 gap-2">
            <button
              type="button"
              onClick={() => setMode('cash')}
              className={`py-2 px-3 text-xs font-semibold rounded flex flex-col items-center gap-1.5 transition-colors cursor-pointer border ${
                mode === 'cash'
                  ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              <Banknote className="w-4 h-4" />
              <span>Cash</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('card')}
              className={`py-2 px-3 text-xs font-semibold rounded flex flex-col items-center gap-1.5 transition-colors cursor-pointer border ${
                mode === 'card'
                  ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Card / POS</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('upi')}
              className={`py-2 px-3 text-xs font-semibold rounded flex flex-col items-center gap-1.5 transition-colors cursor-pointer border ${
                mode === 'upi'
                  ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>UPI / QR</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('split')}
              className={`py-2 px-3 text-xs font-semibold rounded flex flex-col items-center gap-1.5 transition-colors cursor-pointer border ${
                mode === 'split'
                  ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Split Tender</span>
            </button>
            <button type="button" onClick={() => setMode('voucher')} className={`py-2 px-2 text-xs font-semibold rounded flex flex-col items-center gap-1.5 transition-colors cursor-pointer border ${mode === 'voucher' ? 'bg-stone-900 text-white border-stone-900 shadow-xs' : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'}`}>
              <Receipt className="w-4 h-4" /><span>Voucher Only</span>
            </button>
          </div>
        </div>

        {/* Payment Detail Content */}
        <div className="p-6 space-y-4 flex-1">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded space-y-2">
            <label className="block text-xs font-semibold text-stone-800">Gift voucher (optional; can combine with another payment)</label>
            <div className="flex gap-2">
              <input ref={voucherInputRef} data-barcode-catcher="gift-voucher" value={voucherCode} onChange={(event) => { setVoucherCode(event.target.value.toUpperCase()); setAppliedVoucher(null); setReferenceError(''); }} placeholder="Scan voucher barcode or enter code" className="min-w-0 flex-1 px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded" />
              <button type="button" onClick={handleApplyVoucher} className="px-3 py-2 text-xs font-semibold bg-stone-900 text-white rounded">Check Code</button>
              {appliedVoucher && <button type="button" onClick={() => { setAppliedVoucher(null); setVoucherCode(''); }} className="px-3 py-2 text-xs border border-stone-300 rounded">Remove</button>}
            </div>
            {appliedVoucher && <p className="text-xs text-emerald-800" role="status">Valid voucher · Balance {settings.currencySymbol}{appliedVoucher.balance.toFixed(2)} · Applied {settings.currencySymbol}{voucherAppliedAmount.toFixed(2)} · Remaining due {settings.currencySymbol}{remainingDue.toFixed(2)}</p>}
            {mode === 'voucher' && appliedVoucher && voucherAppliedAmount < totalDue && <p className="text-xs text-rose-700">This voucher does not cover the full total. Choose cash, card, UPI, or split tender to pay the remaining amount.</p>}
            {referenceError && <p className="text-xs text-rose-700" role="alert">{referenceError}</p>}
          </div>
          {/* CASH MODE */}
          {mode === 'cash' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-600 font-medium">Grand Total Due:</span>
                <span className="font-mono font-bold text-lg text-stone-900 tabular-nums">
                  {settings.currencySymbol}{remainingDue.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Cash Tendered by Customer
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-stone-500 font-mono text-base">
                    {settings.currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                    value={cashTendered || ''}
                    onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-2.5 text-lg font-mono font-bold bg-white border border-stone-300 rounded focus:border-stone-900 focus:outline-hidden text-stone-900"
                  />
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-stone-500 font-medium block">
                  Quick Denominations:
                </span>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCashTendered(remainingDue)}
                    className="px-3 py-1.5 text-xs font-mono font-semibold bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded cursor-pointer"
                  >
                    Exact ({settings.currencySymbol}{remainingDue.toFixed(2)})
                  </button>
                  {[100, 200, 500, 1000, 2000].map((amt) => {
                    if (amt < remainingDue && amt < 200) return null;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashTendered(amt)}
                        className="px-3 py-1.5 text-xs font-mono font-semibold bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded cursor-pointer"
                      >
                        {settings.currencySymbol}{amt}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setCashTendered(Math.ceil(remainingDue / 100) * 100)}
                    className="px-3 py-1.5 text-xs font-mono font-semibold bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded cursor-pointer"
                  >
                    Next {settings.currencySymbol}100 ({settings.currencySymbol}{(Math.ceil(remainingDue / 100) * 100).toFixed(2)})
                  </button>
                </div>
              </div>

              {/* Real-time Change Indicator Box */}
              <div
                className={`p-4 rounded border ${
                  isCashSufficient
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-semibold">
                    {isCashSufficient ? 'Change to Return:' : 'Shortage Remaining:'}
                  </span>
                  <span className="font-mono font-bold text-2xl tabular-nums">
                    {settings.currencySymbol}
                    {isCashSufficient ? cashChange.toFixed(2) : (remainingDue - cashTendered).toFixed(2)}
                  </span>
                </div>
                {!isCashSufficient && (
                  <p className="text-[11px] text-rose-700 mt-1">
                    Customer has tendered less than total due. Enter full amount.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* CARD MODE */}
          {mode === 'card' && (
            <div className="space-y-4">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded text-xs space-y-1">
                <span className="text-stone-500 block">Insert, tap, or swipe card on external bank card terminal:</span>
                <span className="font-mono font-bold text-lg text-stone-900 block tabular-nums">
                  {settings.currencySymbol}{remainingDue.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Card / POS approval reference # (Required)
                </label>
                <input
                  type="text"
                  required
                  value={cardRef}
                  onChange={(e) => { setCardRef(e.target.value); setReferenceError(''); }}
                  aria-invalid={!isElectronicReferenceValid}
                  placeholder="e.g. AUTH-882910"
                  className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded focus:border-stone-900 focus:outline-hidden font-mono"
                />
                <span className="text-[11px] text-stone-400 mt-1 block">
                  Enter the approval or transaction number printed on the card / POS slip.
                </span>
                {!isElectronicReferenceValid && <p className="mt-1 text-[11px] font-medium text-rose-700">Reference number is required.</p>}
              </div>
            </div>
          )}

          {/* UPI / QR MODE */}
          {mode === 'upi' && (
            <div className="space-y-4">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded text-xs space-y-1">
                <span className="text-stone-500 block">Customer scans shop static or dynamic UPI / Digital QR code:</span>
                <span className="font-mono font-bold text-lg text-stone-900 block tabular-nums">
                  {settings.currencySymbol}{remainingDue.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  UPI / QR transaction ID or reference # (Required)
                </label>
                <input
                  type="text"
                  required
                  value={upiRef}
                  onChange={(e) => { setUpiRef(e.target.value); setReferenceError(''); }}
                  aria-invalid={!isElectronicReferenceValid}
                  placeholder="e.g. 429188200192"
                  className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded focus:border-stone-900 focus:outline-hidden font-mono"
                />
              </div>
            </div>
          )}

          {/* SPLIT TENDER MODE */}
          {mode === 'split' && (
            <div className="space-y-3">
              <div className="text-xs text-stone-600">
                Split the total between cash and an electronic payment:
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSplitElectronicMethod('card')} className={`rounded border px-3 py-2 text-xs font-semibold ${splitElectronicMethod === 'card' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-700'}`}>Card / POS</button>
                <button type="button" onClick={() => setSplitElectronicMethod('upi')} className={`rounded border px-3 py-2 text-xs font-semibold ${splitElectronicMethod === 'upi' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-700'}`}>UPI / QR</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    1. Cash Amount ({settings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={remainingDue}
                    value={splitCash || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setSplitCash(val);
                      setSplitCard(Number(Math.max(0, remainingDue - val).toFixed(2)));
                    }}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-stone-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    2. {splitElectronicMethod === 'card' ? 'Card / POS' : 'UPI / QR'} Amount ({settings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={remainingDue}
                    value={splitCard || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setSplitCard(val);
                      setSplitCash(Number(Math.max(0, remainingDue - val).toFixed(2)));
                    }}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-stone-300 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  {splitElectronicMethod === 'card' ? 'Card / POS approval reference' : 'UPI / QR transaction reference'} # (Required when amount is above zero)
                </label>
                <input
                  type="text"
                  required={splitCard > 0}
                  value={splitCardRef}
                  onChange={(e) => { setSplitCardRef(e.target.value); setReferenceError(''); }}
                  aria-invalid={splitCard > 0 && !splitCardRef.trim()}
                  placeholder={splitElectronicMethod === 'card' ? 'e.g. AUTH-SPLIT-992' : 'e.g. UPI123456789'}
                  className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-stone-300 rounded"
                />
                {splitCard > 0 && !splitCardRef.trim() && <p className="mt-1 text-[11px] font-medium text-rose-700">Reference number is required for the electronic portion.</p>}
              </div>

              {referenceError && <p className="text-xs text-rose-700" role="alert">{referenceError}</p>}

              <div className="flex justify-between items-center text-xs p-2.5 rounded bg-stone-100 font-mono">
                <span>Combined Split Total:</span>
                <span className={isSplitSufficient ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                  {settings.currencySymbol}{splitTotal.toFixed(2)} / {settings.currencySymbol}{remainingDue.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-200 border border-stone-300 rounded transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleFinalizeSale}
            disabled={
              (mode === 'cash' && !isCashSufficient) ||
              (mode === 'split' && !isSplitSufficient) ||
              !isElectronicReferenceValid
            }
            className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Complete & Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
};
