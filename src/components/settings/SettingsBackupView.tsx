/**
 * Store Configuration & Local Database Backup / Restore View
 * Full JSON snapshot export/import, store contact metadata,
 * and database health metrics.
 */

import React, { useState, useRef } from 'react';
import { usePOS } from '../../context/POSContext';
import { AppStateBackup } from '../../types/pos';
import { GST_STATE_NAMES, isValidIndianGstin } from '../../utils/gst';
import {
  Settings,
  Download,
  Upload,
  Database,
  AlertTriangle,
  CheckCircle2,
  Save,
  Building,
  Trash2,
} from 'lucide-react';

export const SettingsBackupView: React.FC = () => {
  const {
    settings,
    updateSettings,
    exportDataBackup,
    importDataBackup,
    clearAllData,
    products,
    transactions,
    returns,
    shifts,
    hasPermission,
  } = usePOS();

  const [formSettings, setFormSettings] = useState(settings);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [clearError, setClearError] = useState('');
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const registrationType = formSettings.registrationType || 'unregistered';
    if (formSettings.storeName.trim().length < 2 || formSettings.address.trim().length < 5) {
      alert('Enter a shop name and full business address before saving.');
      return;
    }
    if (!formSettings.stateCode || !GST_STATE_NAMES[formSettings.stateCode]) {
      alert('Choose the business state before saving.');
      return;
    }
    if (registrationType !== 'unregistered' && !isValidIndianGstin(formSettings.taxId)) {
      alert('Enter a valid 15-character GSTIN format from the shop GST registration certificate.');
      return;
    }
    if (registrationType !== 'unregistered' && (formSettings.legalBusinessName || '').trim().length < 2) {
      alert('Enter the legal business name shown on the GST registration certificate.');
      return;
    }
    if (registrationType !== 'unregistered' && formSettings.stateCode && formSettings.taxId.slice(0, 2) !== formSettings.stateCode) {
      alert('The first two digits of the shop GSTIN must match the shop GST registration state code.');
      return;
    }
    updateSettings({ ...formSettings, registrationType, taxId: registrationType === 'unregistered' ? '' : formSettings.taxId });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // 1-Click JSON Backup Download
  const handleDownloadBackup = () => {
    const backup = exportDataBackup();
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backup, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    const filename = `thread_stitch_pos_backup_${new Date().toISOString().slice(0, 10)}.json`;
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Restore from JSON File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawContent = event.target?.result as string;
        const parsed = JSON.parse(rawContent) as AppStateBackup;
        const result = importDataBackup(parsed);
        setImportStatus(result);
      } catch (err) {
        setImportStatus({
          success: false,
          message: 'Malformed JSON file. Please ensure this is a valid POS backup snapshot.',
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="pb-4 border-b border-stone-200">
        <h2 className="text-xl font-bold text-stone-900 tracking-tight">Store Settings & Data Backup</h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Configure shop receipt information, tax rates, and manage local-first offline backups.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT 2 COLS: Store Settings Form */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded p-6 shadow-2xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-stone-200">
            <h3 className="font-bold text-sm text-stone-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-amber-500" />
              <span>Shop Identity & Invoice Printing</span>
            </h3>
            {saveSuccess && (
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Settings saved</span>
              </span>
            )}
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Garment Shop Name *</label>
                <input
                  type="text"
                  required
                  value={formSettings.storeName}
                  onChange={(e) => setFormSettings({ ...formSettings, storeName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded font-semibold bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Tagline</label>
                <input
                  type="text"
                  value={formSettings.tagline}
                  onChange={(e) => setFormSettings({ ...formSettings, tagline: e.target.value })}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Store Address</label>
                <input
                  type="text"
                  value={formSettings.address}
                  onChange={(e) => setFormSettings({ ...formSettings, address: e.target.value })}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formSettings.phone}
                  onChange={(e) => setFormSettings({ ...formSettings, phone: e.target.value })}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">GST Registration Type *</label>
                <select
                  required
                  value={formSettings.registrationType || 'unregistered'}
                  onChange={(e) => setFormSettings({ ...formSettings, registrationType: e.target.value as NonNullable<typeof formSettings.registrationType>, taxId: e.target.value === 'unregistered' ? '' : formSettings.taxId })}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white"
                >
                  <option value="unregistered">Not registered</option>
                  <option value="regular">Regular GST</option>
                  <option value="composition">Composition scheme</option>
                </select>
              </div>

              {formSettings.registrationType !== 'unregistered' && <div>
                <label className="block font-medium text-stone-700 mb-1">Legal Business Name *</label>
                <input
                  type="text"
                  maxLength={120}
                  value={formSettings.legalBusinessName || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, legalBusinessName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white"
                />
              </div>}

              <div>
                <label className="block font-medium text-stone-700 mb-1">GST Registration Number (GSTIN) {formSettings.registrationType !== 'unregistered' ? '*' : '(not used)'}</label>
                <input
                  type="text"
                  required={formSettings.registrationType !== 'unregistered'}
                  disabled={formSettings.registrationType === 'unregistered'}
                  value={formSettings.taxId || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, taxId: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15) })}
                  placeholder={formSettings.registrationType === 'unregistered' ? 'Not applicable' : '15-character GSTIN'}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded font-mono font-bold uppercase bg-white text-stone-900"
                />
                {formSettings.registrationType === 'composition' && <span className="text-[10px] text-amber-800 mt-0.5 block">Composition businesses issue bills of supply and must not collect GST from customers.</span>}
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Business State</label>
                <select value={formSettings.stateCode || ''} onChange={(e) => setFormSettings({ ...formSettings, stateCode: e.target.value, stateName: GST_STATE_NAMES[e.target.value] || '' })} className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white">
                  <option value="">Choose state</option>
                  {Object.entries(GST_STATE_NAMES).filter(([code]) => code !== '97' && code !== '99').map(([code, name]) => <option key={code} value={code}>{name} (Code {code})</option>)}
                </select>
                <span className="text-[10px] text-stone-400 mt-0.5 block">
                  State is used to determine place of supply and, for regular GST sales, intra-state or inter-state tax.
                </span>
              </div>

              {formSettings.registrationType === 'regular' && <div>
                <label className="block font-medium text-stone-700 mb-1">Garment Selling Price</label>
                <select value={formSettings.priceMode || 'exclusive'} onChange={(e) => setFormSettings({ ...formSettings, priceMode: e.target.value as 'exclusive' | 'inclusive' })} className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white">
                  <option value="exclusive">Price before GST — add GST at checkout</option>
                  <option value="inclusive">Price includes GST — extract GST from price</option>
                </select>
                <span className="text-[10px] text-stone-500 mt-0.5 block">This changes how current selling-price numbers are interpreted on future sales; prices are not converted. Review product prices before switching. Completed sales keep their original price mode.</span>
              </div>}

              {formSettings.registrationType === 'regular' && <div>
                <label className="block font-medium text-stone-700 mb-1">Default GST Rate for New Non-Apparel Products (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formSettings.taxRateDefault}
                  onChange={(e) => setFormSettings({ ...formSettings, taxRateDefault: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded font-mono font-bold bg-white"
                />
                <span className="text-[10px] text-stone-400 mt-0.5 block">
                  Apparel HSN Chapters 61 and 62 use the automatic ₹2,500 per-piece slab: 5% up to ₹2,500; 18% above. Verify each HSN and rate with your tax adviser.
                </span>
              </div>}
            </div>

            <div>
              <div className="max-w-md">
                <label className="block font-medium text-stone-700 mb-1">Invoice Print Format</label>
                <select
                  value={formSettings.invoicePrintFormat || 'thermal'}
                  onChange={(e) => setFormSettings({ ...formSettings, invoicePrintFormat: e.target.value as 'thermal' | 'a4' })}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white"
                >
                  <option value="thermal">Thermal receipt (80 mm)</option>
                  <option value="a4">A4 invoice</option>
                </select>
                <span className="text-[10px] text-stone-500 mt-0.5 block">This selects the default printed invoice layout. Save as PDF is available from the receipt preview.</span>
              </div>

              <div>
              <label className="block font-medium text-stone-700 mb-1">Thermal Receipt Footer Policy Note</label>
              <textarea
                rows={2}
                value={formSettings.receiptFooterNote}
                onChange={(e) => setFormSettings({ ...formSettings, receiptFooterNote: e.target.value })}
                className="w-full px-3 py-1.5 border border-stone-300 rounded bg-white"
              />
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Store Configuration</span>
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT 1 COL: Database Backup, Restore & Health */}
        <div className="space-y-6">
          {/* Backup & Restore Card */}
          <div className="bg-white border border-stone-200 rounded p-5 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-stone-900 pb-2 border-b border-stone-200 flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-500" />
              <span>Offline Database Backup & Restore</span>
            </h3>

            <p className="text-stone-600 leading-relaxed">
              Your POS data is stored locally and securely in this browser environment. Export a periodic backup to a USB flash drive or local network share for peace of mind.
            </p>

            {/* Export Button */}
            <button
              onClick={handleDownloadBackup}
              className="w-full py-2.5 px-4 text-xs font-semibold text-stone-900 bg-amber-400 hover:bg-amber-300 rounded transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Full POS Backup (JSON)</span>
            </button>

            {/* Import Button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 px-3 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>Restore Database from File</span>
              </button>
            </div>

            {/* Status Message */}
            {importStatus && (
              <div
                className={`p-3 rounded border text-xs ${
                  importStatus.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {importStatus.message}
              </div>
            )}
          </div>

          {/* Database Health Summary */}
          <div className="bg-white border border-stone-200 rounded p-5 space-y-3 text-xs">
            <h4 className="font-bold text-stone-900 pb-2 border-b border-stone-200">
              Local Storage Snapshot
            </h4>

            <div className="space-y-1.5 font-mono text-stone-600">
              <div className="flex justify-between">
                <span>Garment Styles:</span>
                <span className="font-bold text-stone-900">{products.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Variants:</span>
                <span className="font-bold text-stone-900">
                  {products.reduce((sum, p) => sum + p.variants.length, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Sales Records:</span>
                <span className="font-bold text-stone-900">{transactions.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Returns Recorded:</span>
                <span className="font-bold text-stone-900">{returns.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Register Shifts:</span>
                <span className="font-bold text-stone-900">{shifts.length}</span>
              </div>
            </div>

            {hasPermission('admin') && (
              <div className="pt-3 border-t border-stone-200">
                <button
                  disabled={clearing}
                  onClick={() => { setAdminPin(''); setClearError(''); setShowClearDialog(true); }}
                  className="w-full py-1.5 px-3 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All POS Data</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showClearDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-data-title"
            onSubmit={async (event) => {
              event.preventDefault();
              setClearError('');
              setClearing(true);
              try {
                await clearAllData(adminPin);
                setShowClearDialog(false);
                setAdminPin('');
                setImportStatus({ success: true, message: 'POS data cleared successfully. Store settings and staff accounts were kept.' });
              } catch (error) {
                setClearError(error instanceof Error ? error.message : 'Could not clear POS data.');
              } finally {
                setClearing(false);
              }
            }}
            className="w-full max-w-md space-y-4 rounded-lg border border-stone-200 bg-white p-5 shadow-xl"
          >
            <div>
              <h3 id="clear-data-title" className="font-bold text-stone-900">Clear all POS data?</h3>
              <p className="mt-2 text-sm text-stone-600">
                This permanently removes garments and stock, sales, returns, register shifts, stock adjustments, expenses, vouchers, offers, and held bills. Store settings and staff accounts will remain.
              </p>
            </div>
            <div>
              <label htmlFor="clear-data-admin-pin" className="mb-1 block text-sm font-medium text-stone-700">Confirm with your administrator PIN</label>
              <input
                id="clear-data-admin-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]{4}"
                maxLength={4}
                required
                autoFocus
                value={adminPin}
                onChange={(event) => setAdminPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm tracking-[0.35em]"
              />
            </div>
            {clearError && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">{clearError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={clearing} onClick={() => setShowClearDialog(false)} className="rounded border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={clearing || adminPin.length !== 4} className="rounded bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50">
                {clearing ? 'Clearing…' : 'Confirm & Clear Data'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
