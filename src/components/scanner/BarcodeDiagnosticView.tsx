/**
 * USB Barcode Scanner Diagnostic Lab & Hardware Guide
 * Live keystroke interval detection (< 40ms USB scanner burst verification),
 * instant garment lookup, testing checklist for Honeywell, Zebra, Netum,
 * and bench calibration barcodes.
 */

import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { generateBarcodeSvg } from '../../utils/barcode128';
import {
  Barcode,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Clock,
  Keyboard,
  Printer,
  HelpCircle,
  Camera,
} from 'lucide-react';

export const BarcodeDiagnosticView: React.FC = () => {
  const {
    scannerDiagnostics,
    findVariantByBarcode,
    settings,
    updateSettings,
    simulateScan,
  } = usePOS();

  const [testInput, setTestInput] = useState('');
  const [matchedVariant, setMatchedVariant] = useState<ReturnType<typeof findVariantByBarcode>>(null);

  const handleTestScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim()) return;
    const match = findVariantByBarcode(testInput.trim());
    setMatchedVariant(match);
  };

  // Calibration test barcodes
  const testCodes = [
    { label: 'Crisp White Oxford (Size M)', code: '8901001002' },
    { label: 'Japanese Selvedge Denim (32W)', code: '8902002032' },
    { label: 'Silk Wrap Midi Dress (Size M)', code: '8903003002' },
    { label: 'Heavyweight Cotton Tee (Size L)', code: '8905005003' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="pb-4 border-b border-stone-200">
        <h2 className="text-xl font-bold text-stone-900 tracking-tight">
          Barcode Scanner Hardware Lab & Diagnostics
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Verify USB handheld barcode scanners, test keystroke wedge latency, and calibrate retail scanners.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT 2 COLS: Live Diagnostic Test Console */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Scanner Input & Feed */}
          <div className="bg-stone-900 text-stone-100 rounded p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Live USB Scanner Hardware Receiver</h3>
              </div>
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Listening for USB HID Wedge
              </span>
            </div>

            <form onSubmit={handleTestScan} className="space-y-2">
              <label className="block text-xs font-medium text-stone-300">
                Aim your handheld USB scanner at any barcode or type below to test:
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  data-barcode-catcher="true"
                  value={testInput}
                  onChange={(e) => {
                    setTestInput(e.target.value);
                    const match = findVariantByBarcode(e.target.value.trim());
                    setMatchedVariant(match);
                  }}
                  placeholder="Click here and scan a garment barcode tag..."
                  className="w-full px-4 py-3 bg-stone-800 border border-stone-700 rounded text-base font-mono text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-400 transition-colors"
                />
              </div>
            </form>

            {/* Diagnostic Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono">
              <div className="p-3 bg-stone-950/60 rounded border border-stone-800">
                <span className="text-stone-400 block text-[10px] font-sans">Last Scanned Code:</span>
                <span className="font-bold text-amber-400 truncate block mt-0.5">
                  {scannerDiagnostics.lastScannedCode || testInput || '—'}
                </span>
              </div>

              <div className="p-3 bg-stone-950/60 rounded border border-stone-800">
                <span className="text-stone-400 block text-[10px] font-sans">Burst Duration:</span>
                <span className="font-bold text-white block mt-0.5">
                  {scannerDiagnostics.lastScanDurationMs} ms
                </span>
              </div>

              <div className="p-3 bg-stone-950/60 rounded border border-stone-800">
                <span className="text-stone-400 block text-[10px] font-sans">Avg Inter-Char Gap:</span>
                <span
                  className={`font-bold block mt-0.5 ${
                    scannerDiagnostics.averageInterCharMs > 0 && scannerDiagnostics.averageInterCharMs <= 45
                      ? 'text-emerald-400'
                      : 'text-stone-300'
                  }`}
                >
                  {scannerDiagnostics.averageInterCharMs} ms
                </span>
              </div>

              <div className="p-3 bg-stone-950/60 rounded border border-stone-800">
                <span className="text-stone-400 block text-[10px] font-sans">Hardware Scans:</span>
                <span className="font-bold text-white block mt-0.5">
                  {scannerDiagnostics.totalHardwareScans}
                </span>
              </div>
            </div>

            {/* Matched Product Indicator */}
            {matchedVariant ? (
              <div className="p-4 bg-emerald-950/80 border border-emerald-700/60 rounded text-xs text-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-sm text-white block">
                      {matchedVariant.product.name}
                    </span>
                    <span className="text-emerald-300 font-mono">
                      {matchedVariant.variant.color} · Size {matchedVariant.variant.size} · SKU: {matchedVariant.variant.sku}
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-emerald-400 font-bold text-base block tabular-nums">
                    {settings.currencySymbol}{matchedVariant.variant.sellingPrice.toFixed(2)}{settings.registrationType === 'regular' && settings.priceMode === 'inclusive' ? ' incl. GST' : ''}
                  </span>
                  <span className="text-emerald-300 text-[11px]">
                    {matchedVariant.variant.stock} in stock
                  </span>
                </div>
              </div>
            ) : testInput ? (
              <div className="p-3 bg-stone-800/80 border border-stone-700 rounded text-xs text-stone-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Code "{testInput}" not linked to any garment variant yet.</span>
              </div>
            ) : null}
          </div>

          {/* Printable Bench Calibration Barcodes */}
          <div className="bg-white border border-stone-200 rounded p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200">
              <div>
                <h3 className="font-bold text-sm text-stone-900">
                  Bench Calibration Test Barcodes
                </h3>
                <p className="text-xs text-stone-500">
                  Scan these high-contrast Code 128 barcodes directly from your screen or print them to test scanner focus and distance.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {testCodes.map((tc) => {
                const svg = generateBarcodeSvg(tc.code, {
                  height: 42,
                  moduleWidth: 1.2,
                  showText: true,
                  fontSize: 10,
                });

                return (
                  <div
                    key={tc.code}
                    className="p-3 border border-stone-200 rounded hover:border-stone-400 transition-colors bg-stone-50/50 flex flex-col justify-between text-center"
                  >
                    <span className="font-semibold text-xs text-stone-800 block mb-2">
                      {tc.label}
                    </span>
                    <div
                      className="my-1 flex justify-center"
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                    <div className="pt-2 border-t border-stone-200 flex justify-between items-center text-[11px]">
                      <span className="font-mono text-stone-500">{tc.code}</span>
                      <button
                        type="button"
                        onClick={() => {
                          simulateScan(tc.code);
                          setTestInput(tc.code);
                        }}
                        className="text-stone-700 hover:text-stone-950 font-semibold cursor-pointer"
                      >
                        Simulate Scan →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT 1 COL: Scanner Setup & Troubleshooting Guide */}
        <div className="space-y-6">
          {/* Quick Hardware Guide Card */}
          <div className="bg-white border border-stone-200 rounded p-5 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-stone-900 pb-2 border-b border-stone-200 flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-amber-500" />
              <span>USB Scanner Setup Guide</span>
            </h3>

            <div className="space-y-3 text-stone-600 leading-relaxed">
              <div>
                <span className="font-bold text-stone-900 block mb-1">
                  1. Keyboard Wedge Protocol
                </span>
                <p>
                  Most retail handheld barcode scanners (Honeywell, Zebra/Motorola, Netum, Inateck) connect via USB and act as a standard USB Keyboard (HID device). No proprietary drivers or cloud software are required.
                </p>
              </div>

              <div>
                <span className="font-bold text-stone-900 block mb-1">
                  2. Carriage Return (CR / Enter) Suffix
                </span>
                <p>
                  The scanner must send an "Enter" key press after transmitting the barcode digits. If your scanner scans numbers but does not submit them automatically, scan the "Add CR/Enter Suffix" configuration barcode in your scanner’s user manual.
                </p>
              </div>

              <div>
                <span className="font-bold text-stone-900 block mb-1">
                  3. Testing Supported Hardware
                </span>
                <ul className="list-disc pl-4 space-y-1 text-stone-700">
                  <li><strong>Zebra / Symbol:</strong> LS2208, DS2208, DS4308</li>
                  <li><strong>Honeywell:</strong> Voyager 1200g, 1400g, Xenon 1900</li>
                  <li><strong>Netum / Eyoyo:</strong> Standard 1D/2D USB & wireless dongles</li>
                  <li><strong>Inateck / Tera:</strong> USB Laser & CMOS scanners</li>
                </ul>
              </div>

              <div>
                <span className="font-bold text-stone-900 block mb-1">
                  4. Troubleshooting Tips
                </span>
                <p>
                  If the scanner fails to read printed garment tags, ensure the hangtag is flat (not creased), held 4 to 8 inches away, and oriented perpendicular to the red laser/aiming line.
                </p>
              </div>
            </div>
          </div>

          {/* Scanner Sensitivity Settings */}
          <div className="bg-white border border-stone-200 rounded p-5 space-y-3 text-xs">
            <h4 className="font-bold text-stone-900 pb-2 border-b border-stone-200">
              Scanner Timing Sensitivity
            </h4>

            <div>
              <label className="block text-stone-700 font-medium mb-1">
                Max Inter-Char Delay: {settings.scannerInterCharDelayMs}ms
              </label>
              <input
                type="range"
                min="20"
                max="80"
                step="5"
                value={settings.scannerInterCharDelayMs}
                onChange={(e) => updateSettings({ scannerInterCharDelayMs: parseInt(e.target.value, 10) })}
                className="w-full accent-stone-900 cursor-pointer"
              />
              <span className="text-[11px] text-stone-400 mt-1 block">
                Default: 45ms. Lower values prevent fast human typing from triggering scans.
              </span>
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
              <span className="text-stone-700 font-medium">Beep Sound on Scan:</span>
              <button
                type="button"
                onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer ${
                  settings.soundEnabled
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-200 text-stone-700'
                }`}
              >
                {settings.soundEnabled ? 'Enabled' : 'Muted'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
