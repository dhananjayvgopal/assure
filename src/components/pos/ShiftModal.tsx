/**
 * Register Shift & Cash Drawer Tracking Modal
 * Safeguards cash float, tracks expected vs actual cash counts,
 * manages cash drops to safe, and reports over/short discrepancies.
 */

import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  DollarSign,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  X,
  History,
  Lock,
} from 'lucide-react';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({ isOpen, onClose }) => {
  const {
    activeShift,
    openShift,
    closeShift,
    addCashDrop,
    activeUser,
    settings,
  } = usePOS();

  // Mode states: 'view' | 'drop' | 'close'
  const [subAction, setSubAction] = useState<'view' | 'drop' | 'close'>('view');

  // Open Shift Form
  const [openingFloatInput, setOpeningFloatInput] = useState<number>(2000);

  // Cash Drop Form
  const [dropAmount, setDropAmount] = useState<number>(0);
  const [dropType, setDropType] = useState<'in' | 'out'>('out');
  const [dropNote, setDropNote] = useState<string>('');

  // Close Shift Form
  const [actualCashInput, setActualCashInput] = useState<number>(0);
  const [closeNoteInput, setCloseNoteInput] = useState<string>('');

  if (!isOpen) return null;

  // Expected Cash calculation
  const expectedCash = activeShift
    ? Number(
        (
          activeShift.openingFloat +
          activeShift.cashSales -
          activeShift.cashRefunds +
          activeShift.cashIn -
          activeShift.cashOut
        ).toFixed(2)
      )
    : 0;

  const discrepancy = Number((actualCashInput - expectedCash).toFixed(2));

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (openingFloatInput < 0) return;
    openShift(openingFloatInput);
    onClose();
  };

  const handleCashDrop = (e: React.FormEvent) => {
    e.preventDefault();
    if (dropAmount <= 0) return;
    addCashDrop(dropAmount, dropType, dropNote || (dropType === 'out' ? 'Safe cash drop' : 'Float replenishment'));
    setDropAmount(0);
    setDropNote('');
    setSubAction('view');
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (Math.abs(discrepancy) > 20) {
      if (!window.confirm(`Notice: There is a discrepancy of ${settings.currencySymbol}${discrepancy.toFixed(2)}. Are you sure you want to close the shift?`)) {
        return;
      }
    }
    closeShift(actualCashInput, closeNoteInput);
    setSubAction('view');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full text-stone-900 border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base leading-tight">Cash Drawer & Register Shift</h3>
              <span className="text-[11px] text-stone-400">
                Staff: {activeUser.name} ({activeUser.role})
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {!activeShift ? (
            /* REGISTER CLOSED: PROMPT TO OPEN */
            <form onSubmit={handleOpenShift} className="space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
                <span className="font-semibold block">Register Shift is Closed</span>
                <p className="leading-relaxed">
                  Enter the starting physical cash float placed in the register drawer before ringing up sales.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Starting Cash Float ({settings.currencySymbol})
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  autoFocus
                  value={openingFloatInput}
                  onChange={(e) => setOpeningFloatInput(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-lg font-mono font-bold bg-white border border-stone-300 rounded focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div className="flex gap-2">
                {[1000, 2000, 3000, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setOpeningFloatInput(amt)}
                    className="flex-1 py-1 text-xs font-mono font-medium bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded cursor-pointer"
                  >
                    {settings.currencySymbol}{amt}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 text-xs font-semibold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors cursor-pointer mt-2"
              >
                Open Register Shift Now
              </button>
            </form>
          ) : subAction === 'view' ? (
            /* REGISTER OPEN: SUMMARY OVERVIEW */
            <div className="space-y-4">
              {/* Shift status badge */}
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold">Shift Active</span>
                </div>
                <span className="font-mono text-emerald-800 text-[11px]">
                  Since {new Date(activeShift.openedAt).toLocaleTimeString()}
                </span>
              </div>

              {/* Drawer Balance Summary Cards */}
              <div className="p-4 bg-stone-50 border border-stone-200 rounded space-y-2 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Opening Float:</span>
                  <span className="font-mono tabular-nums text-stone-900">
                    {settings.currencySymbol}{activeShift.openingFloat.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-stone-600">
                  <span>Cash Sales (+):</span>
                  <span className="font-mono tabular-nums text-emerald-700">
                    +{settings.currencySymbol}{activeShift.cashSales.toFixed(2)}
                  </span>
                </div>

                {activeShift.cashRefunds > 0 && (
                  <div className="flex justify-between text-stone-600">
                    <span>Cash Refunds (-):</span>
                    <span className="font-mono tabular-nums text-rose-700">
                      -{settings.currencySymbol}{activeShift.cashRefunds.toFixed(2)}
                    </span>
                  </div>
                )}

                {activeShift.cashIn > 0 && (
                  <div className="flex justify-between text-stone-600">
                    <span>Cash Paid-In (+):</span>
                    <span className="font-mono tabular-nums text-emerald-700">
                      +{settings.currencySymbol}{activeShift.cashIn.toFixed(2)}
                    </span>
                  </div>
                )}

                {activeShift.cashOut > 0 && (
                  <div className="flex justify-between text-stone-600">
                    <span>Cash Dropped / Out (-):</span>
                    <span className="font-mono tabular-nums text-rose-700">
                      -{settings.currencySymbol}{activeShift.cashOut.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline font-bold">
                  <span className="text-stone-900">Expected in Drawer:</span>
                  <span className="font-mono text-lg text-stone-950 tabular-nums">
                    {settings.currencySymbol}{expectedCash.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Actions row */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSubAction('drop')}
                  className="py-2 px-3 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Cash Drop / In-Out</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActualCashInput(expectedCash);
                    setSubAction('close');
                  }}
                  className="py-2 px-3 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Close Register Shift</span>
                </button>
              </div>
            </div>
          ) : subAction === 'drop' ? (
            /* CASH IN / CASH OUT FORM */
            <form onSubmit={handleCashDrop} className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                <h4 className="font-semibold text-xs text-stone-900">Record Cash Drop / Movement</h4>
                <button
                  type="button"
                  onClick={() => setSubAction('view')}
                  className="text-stone-400 hover:text-stone-700 text-xs cursor-pointer"
                >
                  Back
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDropType('out')}
                  className={`py-2 px-3 text-xs font-semibold rounded border cursor-pointer flex items-center justify-center gap-1.5 ${
                    dropType === 'out'
                      ? 'bg-rose-50 border-rose-400 text-rose-800'
                      : 'bg-white border-stone-300 text-stone-600'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Cash Out (Drop to Safe)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDropType('in')}
                  className={`py-2 px-3 text-xs font-semibold rounded border cursor-pointer flex items-center justify-center gap-1.5 ${
                    dropType === 'in'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                      : 'bg-white border-stone-300 text-stone-600'
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Cash In (Float Add)</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Amount ({settings.currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  autoFocus
                  value={dropAmount || ''}
                  onChange={(e) => setDropAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-base font-mono font-bold bg-white border border-stone-300 rounded"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Reason / Reference Note
                </label>
                <input
                  type="text"
                  value={dropNote}
                  onChange={(e) => setDropNote(e.target.value)}
                  placeholder="e.g. Mid-day safe drop or petty cash for paper bags"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSubAction('view')}
                  className="flex-1 py-2 text-xs font-semibold text-stone-600 bg-stone-100 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dropAmount <= 0}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded cursor-pointer"
                >
                  Save Cash Movement
                </button>
              </div>
            </form>
          ) : (
            /* CLOSE REGISTER FORM (RECONCILIATION) */
            <form onSubmit={handleCloseShift} className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                <h4 className="font-semibold text-xs text-stone-900">Shift Reconciliation & Close</h4>
                <button
                  type="button"
                  onClick={() => setSubAction('view')}
                  className="text-stone-400 hover:text-stone-700 text-xs cursor-pointer"
                >
                  Back
                </button>
              </div>

              <div className="flex justify-between text-xs text-stone-600 p-2.5 bg-stone-50 rounded border border-stone-200">
                <span>Expected Cash Count:</span>
                <span className="font-mono font-bold text-stone-900">
                  {settings.currencySymbol}{expectedCash.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Actual Physical Cash Counted in Drawer ({settings.currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  autoFocus
                  value={actualCashInput || ''}
                  onChange={(e) => setActualCashInput(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xl font-mono font-bold bg-white border border-stone-300 rounded focus:border-stone-900"
                />
              </div>

              {/* Over / Short Discrepancy Indicator */}
              <div
                className={`p-3 rounded border text-xs flex justify-between items-center ${
                  discrepancy === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : discrepancy > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <span className="font-semibold">
                  {discrepancy === 0
                    ? 'Balanced (Perfect match)'
                    : discrepancy > 0
                    ? 'Cash Over (+):'
                    : 'Cash Short (-):'}
                </span>
                <span className="font-mono font-bold text-base tabular-nums">
                  {discrepancy >= 0 ? `+${settings.currencySymbol}` : `-${settings.currencySymbol}`}
                  {Math.abs(discrepancy).toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Closing Notes / Explanation
                </label>
                <textarea
                  rows={2}
                  value={closeNoteInput}
                  onChange={(e) => setCloseNoteInput(e.target.value)}
                  placeholder="e.g. Drawer verified by Maya. $150 safe envelope dropped into deposit drop."
                  className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded focus:outline-hidden"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSubAction('view')}
                  className="flex-1 py-2 text-xs font-semibold text-stone-600 bg-stone-100 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded cursor-pointer"
                >
                  Confirm & Close Shift
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
