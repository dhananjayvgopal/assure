/**
 * Thread & Stitch POS - Garment Retail Application
 * Local-first, dependable retail point-of-sale and inventory system
 */

import React, { useEffect, useState } from 'react';
import { POSProvider, usePOS } from './context/POSContext';
import { HeaderNav } from './components/HeaderNav';
import { CheckoutView } from './components/pos/CheckoutView';
import { PaymentModal } from './components/pos/PaymentModal';
import { ReceiptModal } from './components/pos/ReceiptModal';
import { EstimateModal } from './components/pos/EstimateModal';
import { ShiftModal } from './components/pos/ShiftModal';
import { ProductManagementView } from './components/products/ProductManagementView';
import { InventoryManagementView } from './components/inventory/InventoryManagementView';
import { TransactionHistoryView } from './components/transactions/TransactionHistoryView';
import { AccountingView } from './components/accounting/AccountingView';
import { BarcodeDiagnosticView } from './components/scanner/BarcodeDiagnosticView';
import { SettingsBackupView } from './components/settings/SettingsBackupView';
import { BusinessRegistrationSetup } from './components/settings/BusinessRegistrationSetup';
import { UsersView } from './components/users/UsersView';
import { GiftVouchersView } from './components/vouchers/GiftVouchersView';
import { OffersView } from './components/offers/OffersView';
import { CustomersView } from './components/customers/CustomersView';
import { SystemDocumentationModal } from './components/docs/SystemDocumentationModal';
import type { Permission } from './utils/permissions';
import { clearLegacyBrowserPosData } from './utils/storage';

const TAB_PERMISSIONS: Record<string, Permission> = {
  pos: 'pos.use', products: 'products.view', inventory: 'inventory.adjust',
  transactions: 'transactions.view', accounting: 'reports.view', users: 'users.manage',
  expenses: 'expenses.add',
  vouchers: 'vouchers.view',
  offers: 'offers.view',
  customers: 'customers.manage',
  scanner: 'pos.use', settings: 'settings.manage',
};

const MainAppContent: React.FC<{ onSignOut: () => Promise<void> }> = ({ onSignOut }) => {
  const { currentTab, activeUser, activeReceipt, setActiveReceipt, hasPermission, setCurrentTab, settings, databaseReady } = usePOS();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  useEffect(() => {
    if (!databaseReady || !settings.businessSetupComplete) return;
    if (hasPermission(TAB_PERMISSIONS[currentTab])) return;
    const nextTab = Object.entries(TAB_PERMISSIONS).find(([, permission]) => hasPermission(permission))?.[0];
    if (nextTab) setCurrentTab(nextTab);
  }, [currentTab, activeUser, hasPermission, setCurrentTab, databaseReady, settings.businessSetupComplete]);

  if (!databaseReady) return <div className="min-h-screen grid place-items-center bg-stone-100 text-stone-500">Preparing the local shop database…</div>;
  if (!settings.businessSetupComplete) return <BusinessRegistrationSetup />;

  return (
    <div id="app-shell" className="min-h-screen bg-stone-100 flex flex-col font-sans text-stone-900 selection:bg-amber-400 selection:text-stone-950">
      {/* 3-Zone Header Nav Bar */}
      <HeaderNav
        onOpenShiftModal={() => setIsShiftModalOpen(true)}
        onOpenDocModal={() => setIsDocModalOpen(true)}
        onSignOut={onSignOut}
      />

      {/* Main View Router */}
      <main id="app-main" className="flex-1 overflow-y-auto">
        {!hasPermission(TAB_PERMISSIONS[currentTab]) && (
          <div className="m-6 rounded border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800" role="alert">
            Your staff account does not have permission to open this section. Ask an admin to update your rights.
          </div>
        )}
        {hasPermission(TAB_PERMISSIONS[currentTab]) && currentTab === 'pos' && (
          <CheckoutView
            onOpenPaymentModal={() => setIsPaymentModalOpen(true)}
            onOpenShiftModal={() => setIsShiftModalOpen(true)}
            onOpenEstimateModal={() => setIsEstimateModalOpen(true)}
          />
        )}
        {hasPermission(TAB_PERMISSIONS[currentTab]) && currentTab === 'products' && <ProductManagementView />}
        {hasPermission(TAB_PERMISSIONS[currentTab]) && currentTab === 'inventory' && <InventoryManagementView />}
        {hasPermission(TAB_PERMISSIONS[currentTab]) && currentTab === 'transactions' && <TransactionHistoryView />}
        {hasPermission(TAB_PERMISSIONS[currentTab]) && currentTab === 'accounting' && <AccountingView />}
        {hasPermission(TAB_PERMISSIONS[currentTab]) && currentTab === 'expenses' && <AccountingView initialTab="expenses" expensesOnly />}
        {hasPermission(TAB_PERMISSIONS[currentTab]) && currentTab === 'vouchers' && <GiftVouchersView />}
        {hasPermission(TAB_PERMISSIONS[currentTab]) && currentTab === 'offers' && <OffersView />}
        {hasPermission(TAB_PERMISSIONS[currentTab]) && currentTab === 'customers' && <CustomersView />}
        {hasPermission(TAB_PERMISSIONS[currentTab]) && currentTab === 'users' && <UsersView />}
        {hasPermission(TAB_PERMISSIONS[currentTab]) && currentTab === 'scanner' && <BarcodeDiagnosticView />}
        {hasPermission(TAB_PERMISSIONS[currentTab]) && currentTab === 'settings' && <SettingsBackupView />}
      </main>

      {/* Global Modals */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onComplete={() => setIsPaymentModalOpen(false)}
      />

      <ReceiptModal
        isOpen={!!activeReceipt}
        transaction={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />

      <EstimateModal isOpen={isEstimateModalOpen} onClose={() => setIsEstimateModalOpen(false)} />

      <ShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
      />

      <SystemDocumentationModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [adminPinConfirm, setAdminPinConfirm] = useState('');
  const [loginError, setLoginError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const checkStartup = async () => {
      try {
        const setupResponse = await fetch('/api/auth/setup-status', { cache: 'no-store' });
        if (!setupResponse.ok) throw new Error('Could not check POS setup status.');
        const setup = await setupResponse.json();
        if (setup.setupRequired) {
          clearLegacyBrowserPosData();
          setSetupRequired(true);
          return;
        }
        const sessionResponse = await fetch('/api/auth/session', { cache: 'no-store' });
        setSignedIn(sessionResponse.ok);
      } catch {
        setLoginError('The local POS server is unavailable. Start the app server and try again.');
      } finally {
        setCheckingSession(false);
      }
    };
    void checkStartup();
  }, []);

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setLoginError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Sign in failed.');
      setSignedIn(true);
      setPin('');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Sign in failed.');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInitialSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setLoginError('');
    if (adminPin !== adminPinConfirm) {
      setLoginError('The PIN entries do not match.');
      setSubmitting(false);
      return;
    }
    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: adminName, username: adminUsername, pin: adminPin }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create the admin account.');
      setAdminPin('');
      setAdminPinConfirm('');
      setSetupRequired(false);
      setSignedIn(true);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Could not create the admin account.');
      setAdminPin('');
      setAdminPinConfirm('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Could not end your POS session. Please try again.');
    }
    setPin('');
    setUsername('');
    setLoginError('');
    setSignedIn(false);
  };

  if (checkingSession) return <div className="min-h-screen grid place-items-center bg-stone-100 text-stone-500">Checking local POS session…</div>;
  if (setupRequired && !signedIn) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-7 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex w-fit items-center gap-2">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-amber-100 text-sm font-bold text-amber-800">AP</div>
            <span className="text-lg font-bold tracking-tight text-stone-900">Assure POS</span>
          </div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-800">Step 1 of 2 · Administrator</p>
          <h1 className="text-xl font-bold text-stone-900">Set up your POS</h1>
          <p className="mt-1 text-sm text-stone-500">Create the first admin account. Next, enter the shop’s business and GST details.</p>
        </div>
        <form onSubmit={handleInitialSetup} className="space-y-3">
          <label className="block text-xs font-semibold text-stone-700">Admin name
            <input required minLength={2} maxLength={80} autoComplete="name" value={adminName} onChange={(event) => setAdminName(event.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm font-normal" />
          </label>
          <label className="block text-xs font-semibold text-stone-700">Admin username
            <input required minLength={3} maxLength={32} autoComplete="username" pattern="[A-Za-z0-9._-]+" value={adminUsername} onChange={(event) => setAdminUsername(event.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm font-normal" />
            <span className="mt-1 block font-normal text-stone-500">Use 3–32 letters, numbers, dots, dashes, or underscores.</span>
          </label>
          <label className="block text-xs font-semibold text-stone-700">Create a 4-digit PIN
            <input required inputMode="numeric" type="password" autoComplete="new-password" maxLength={4} value={adminPin} onChange={(event) => setAdminPin(event.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-center font-mono text-lg tracking-[0.5em] font-normal" />
          </label>
          <label className="block text-xs font-semibold text-stone-700">Confirm PIN
            <input required inputMode="numeric" type="password" autoComplete="new-password" maxLength={4} value={adminPinConfirm} onChange={(event) => setAdminPinConfirm(event.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-center font-mono text-lg tracking-[0.5em] font-normal" />
          </label>
          {loginError && <p role="alert" className="rounded bg-rose-50 p-2 text-xs text-rose-700">{loginError}</p>}
          <p className="rounded bg-stone-50 p-3 text-xs leading-relaxed text-stone-600">This creates an empty local database and a private admin account. Your PIN is stored as a salted hash. Business registration and receipt details are entered in the next step.</p>
          <button disabled={submitting || adminPin.length !== 4 || adminPinConfirm.length !== 4} className="w-full rounded bg-stone-900 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50">
            {submitting ? 'Setting up…' : 'Create admin and continue'}
          </button>
        </form>
      </div>
    </div>
  );
  if (!signedIn) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-7 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex w-fit items-center gap-2">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-amber-100 text-sm font-bold text-amber-800">AP</div>
            <span className="text-lg font-bold tracking-tight text-stone-900">Assure POS</span>
          </div>
          <h1 className="text-xl font-bold text-stone-900">Staff sign in</h1>
          <p className="mt-1 text-sm text-stone-500">Sign in with your shop username and 4-digit PIN.</p>
        </div>
        <form onSubmit={handleSignIn} className="space-y-3">
          <label className="block text-xs font-semibold text-stone-700">Username
            <input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm font-normal" />
          </label>
          <label className="block text-xs font-semibold text-stone-700">4-digit PIN
            <input required autoComplete="current-password" inputMode="numeric" type="password" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-center font-mono text-lg tracking-[0.5em] font-normal" />
          </label>
          {loginError && <p role="alert" className="rounded bg-rose-50 p-2 text-xs text-rose-700">{loginError}</p>}
          <button disabled={submitting || pin.length !== 4 || !username.trim()} className="w-full rounded bg-stone-900 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-[10px] text-stone-400">Staff PINs are checked by the local POS server.</p>
      </div>
    </div>
  );

  return (
    <POSProvider key="authenticated-session">
      <MainAppContent onSignOut={handleSignOut} />
    </POSProvider>
  );
}
