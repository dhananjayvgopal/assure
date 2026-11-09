/**
 * System Documentation & Local Network Architecture Guide
 * Covers local LAN setup, database schema, USB scanner calibration,
 * tech stack rationale, and retail hardware assumptions.
 */

import React from 'react';
import {
  HelpCircle,
  X,
  Server,
  Database,
  Barcode,
  ShieldCheck,
  Cpu,
  Wifi,
  Printer,
  HardDrive,
} from 'lucide-react';

interface SystemDocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemDocumentationModal: React.FC<SystemDocumentationModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full text-stone-900 border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base">System Architecture & Local Retail Setup Guide</h3>
              <span className="text-[11px] text-stone-400">
                Operating Guide for Assure POS (Offline-First)
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-stone-700 leading-relaxed">
          {/* Section 1: Tech Stack Rationale */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2 pb-1 border-b border-stone-200">
              <Server className="w-4 h-4 text-amber-600" />
              <span>1. Technology Stack Selection & Local POS Rationale</span>
            </h4>
            <p>
              In independent garment retail, reliability during store peak hours is critical. Cloud-dependent POS software often stalls or crashes when store Wi-Fi or local broadband experiences packet loss or ISP downtime.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded">
                <span className="font-bold text-stone-900 block mb-1">Zero Internet Dependency</span>
                <p className="text-[11px] text-stone-600">
                  Runs 100% locally on the shop computer. Ringing sales, barcode lookups, and receipt printing continue with zero downtime.
                </p>
              </div>
              <div className="p-3 bg-stone-50 border border-stone-200 rounded">
                <span className="font-bold text-stone-900 block mb-1">&lt; 5ms Barcode Latency</span>
                <p className="text-[11px] text-stone-600">
                  USB keyboard wedge scans resolve locally in real time without round-trip HTTP overhead, keeping checkout queues fast.
                </p>
              </div>
              <div className="p-3 bg-stone-50 border border-stone-200 rounded">
                <span className="font-bold text-stone-900 block mb-1">Local Data Sovereignty</span>
                <p className="text-[11px] text-stone-600">
                  Customer details, inventory wholesale costs, and sales revenues never leave your physical shop hardware.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Installation & Local Network (LAN) Instructions */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2 pb-1 border-b border-stone-200">
              <Wifi className="w-4 h-4 text-amber-600" />
              <span>2. Installation & Local Network (LAN) Setup</span>
            </h4>
            <p>
              The system can run on any shop computer (Windows mini PC, Mac mini, or Linux terminal). Other devices on the shop's Wi-Fi (such as an iPad on the sales floor) can connect directly:
            </p>
            <div className="p-3.5 bg-stone-900 text-stone-200 rounded font-mono text-[11px] space-y-1.5">
              <p className="text-stone-400"># 1. Install dependencies (Node.js 18+ required):</p>
              <p className="text-amber-300">npm install</p>
              <p className="text-stone-400 mt-2"># 2. Start the local POS service on port 3000 (binds to 0.0.0.0):</p>
              <p className="text-amber-300">npm run dev</p>
              <p className="text-stone-400 mt-2"># 3. Access on local machine:</p>
              <p className="text-emerald-400">http://localhost:3000</p>
              <p className="text-stone-400 mt-2"># 4. Access from iPad or secondary counter on shop Wi-Fi:</p>
              <p className="text-emerald-400">http://192.168.1.150:3000 (replace with your host computer's local IP)</p>
            </div>
          </div>

          {/* Section 3: Database Structure */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2 pb-1 border-b border-stone-200">
              <Database className="w-4 h-4 text-amber-600" />
              <span>3. Local Database Structure & Persistence Engine</span>
            </h4>
            <p>
              Data is modeled using strongly typed schemas and stored in high-performance local browser storage with automatic synchronization:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-stone-700">
              <li>
                <strong>Garment Products &amp; Variants:</strong> Master style codes with nested color/size variant matrices, distinct SKUs, Code 128 barcodes, wholesale cost price, retail price, and location tags.
              </li>
              <li>
                <strong>Sales Transactions:</strong> Complete receipt records with line items, applied discounts, customer references, payments, and shift IDs.
              </li>
              <li>
                <strong>Cash Register Shifts:</strong> Opening cash float, cash sales, pay-in/pay-out drops, cash refunds, and end-of-shift reconciliation discrepancy.
              </li>
              <li>
                <strong>Stock Adjustments:</strong> Audit trail of restock shipments, damage write-offs, shrinkage, and physical cycle count differences.
              </li>
              <li>
                <strong>Operating Expenses:</strong> Petty cash and invoice tracking for store rent, packaging, staff wages, and alteration services.
              </li>
              <li>
                <strong>Business tax modes:</strong> First-run setup asks for the shop’s own details and selects unregistered, regular GST, or composition mode. Unregistered and composition sales do not add GST; composition bills of supply show the required notice and interstate garment sales are blocked. Regular GST supports HSN and tax invoice summaries. GSTIN status is not checked online; the app does not determine scheme eligibility, calculate composition levy, file returns, or generate e-invoices.
              </li>
            </ul>
          </div>

          {/* Section 4: USB Barcode Scanner Testing Guide */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2 pb-1 border-b border-stone-200">
              <Barcode className="w-4 h-4 text-amber-600" />
              <span>4. USB Barcode Scanner Testing Protocol</span>
            </h4>
            <div className="space-y-2">
              <p>
                Follow these 3 steps to test any USB handheld scanner (Honeywell, Zebra/Motorola LS2208, Netum, Eyoyo, Inateck):
              </p>
              <ol className="list-decimal pl-5 space-y-1 text-stone-700">
                <li>
                  <strong>Plug into USB port:</strong> The scanner should emit a power-on beep and be detected by your OS as a standard HID keyboard.
                </li>
                <li>
                  <strong>Verify Enter Suffix:</strong> Open the "Scanner Lab" tab in this POS. Scan any test barcode. The system should automatically capture the code, confirm inter-character timing (&lt; 40ms), and display the matching garment.
                </li>
                <li>
                  <strong>If the scan does not auto-submit:</strong> The scanner is missing its Carriage Return suffix. Scan the "Add CR/Enter Suffix" programming barcode in the scanner manufacturer's quick-start sheet.
                </li>
              </ol>
            </div>
          </div>

          {/* Section 5: Backup & Disaster Recovery (3-2-1 Rule) */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2 pb-1 border-b border-stone-200">
              <HardDrive className="w-4 h-4 text-amber-600" />
              <span>5. Recommended Backup Routine (3-2-1 Rule)</span>
            </h4>
            <p>
              At the end of each business day when closing the register shift:
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-stone-700">
              <li>Navigate to the <strong>Settings</strong> tab.</li>
              <li>Click <strong>Download Full POS Backup (JSON)</strong>.</li>
              <li>Save a copy to a dedicated shop USB flash drive or network folder.</li>
              <li>In case of computer hardware failure, plug the USB drive into any replacement PC, open this app, and click <strong>Restore Database from File</strong> to resume business immediately.</li>
            </ol>
          </div>

          {/* Section 6: Assumptions and Limitations */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2 pb-1 border-b border-stone-200">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>6. Assumptions &amp; Hardware Limitations</span>
            </h4>
            <ul className="list-disc pl-5 space-y-1 text-stone-600">
              <li>
                <strong>Printers:</strong> The POS-80 80mm printer profile uses its 72mm printable width and sizes each receipt, estimate, or voucher to its content height to avoid shrinking a very long continuous page. The browser version still uses the browser print dialog. The desktop EXE sends documents to the Windows default printer silently; set POS-80 as the default printer before printing.
              </li>
              <li>
                <strong>Cash Drawer:</strong> Can be triggered via standard RJ12 cable connected to the thermal receipt printer (fires drawer kick on print) or manually operated.
              </li>
              <li>
                <strong>Card Payments:</strong> Standalone bank card terminals are supported by recording terminal authorization reference numbers directly in the checkout tender screen.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
