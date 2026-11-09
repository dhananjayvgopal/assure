/**
 * 3-Zone Top Bar Navigation Contract
 * Zone 1: Wordmark / Brand Title
 * Zone 2: Navigation Links
 * Zone 3: Register Status & Active Staff Quick-Switch
 */

import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import type { Permission } from '../utils/permissions';
import { storeBrandMark } from '../utils/branding';
import {
  ShoppingBag,
  Boxes,
  Barcode,
  RotateCcw,
  Receipt,
  TrendingUp,
  Banknote,
  Users,
  Settings,
  HelpCircle,
  Lock,
  LogOut,
  ChevronDown,
  Gift,
  BadgePercent,
} from 'lucide-react';

interface HeaderNavProps {
  onOpenShiftModal: () => void;
  onOpenDocModal: () => void;
  onSignOut: () => Promise<void>;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({ onOpenShiftModal, onOpenDocModal, onSignOut }) => {
  const {
    settings,
    activeUser,
    switchUserWithPin,
    activeShift,
    currentTab,
    setCurrentTab,
    lowStockItems,
    hasPermission,
  } = usePOS();

  const [isSwitchingUser, setIsSwitchingUser] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setSignOutError('');
    try {
      await onSignOut();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Could not sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await switchUserWithPin(pinInput)) {
      setCurrentTab('pos');
      setPinInput('');
      setPinError(false);
      setIsSwitchingUser(false);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const navItems = [
    { id: 'pos', label: 'Register', icon: ShoppingBag, permission: 'pos.use' },
    { id: 'products', label: 'Garments', icon: Boxes, permission: 'products.view' },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: Boxes,
      permission: 'inventory.adjust',
      badge: lowStockItems.length > 0 ? lowStockItems.length : undefined,
    },
    { id: 'transactions', label: 'Sales & Returns', icon: Receipt, permission: 'transactions.view' },
    { id: 'accounting', label: 'Accounting', icon: TrendingUp, permission: 'reports.view' },
    { id: 'expenses', label: 'Expenses', icon: Banknote, permission: 'expenses.add' },
    { id: 'vouchers', label: 'Gift Vouchers', icon: Gift, permission: 'vouchers.view' },
    { id: 'offers', label: 'Offers', icon: BadgePercent, permission: 'offers.view' },
    { id: 'customers', label: 'Customers', icon: Users, permission: 'customers.manage' },
    { id: 'users', label: 'Staff', icon: Users, permission: 'users.manage' },
    { id: 'scanner', label: 'Scanner Lab', icon: Barcode, permission: 'pos.use' },
    { id: 'settings', label: 'Settings', icon: Settings, permission: 'settings.manage' },
  ];
  const visibleNavItems = navItems.filter((item) => hasPermission(item.permission as Permission));

  return (
    <>
      <header className="sticky top-0 z-40 bg-stone-900 text-stone-100 border-b border-stone-800">
        <div className="flex items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setCurrentTab('pos')}
              className="text-left group flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-9 h-8 px-1.5 rounded bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs tracking-wider font-mono">
                {storeBrandMark(settings.storeName)}
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-white block leading-tight">
                  {settings.storeName}
                </span>
                <span className="text-[11px] text-stone-400 block tracking-normal">
                  Luxury Apparel POS & Inventory
                </span>
              </div>
            </button>
          </div>

          {/* Register status, active staff, sign-out, and help actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Shift status button */}
            <button
              onClick={onOpenShiftModal}
              className={`px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeShift
                  ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-rose-950/60 border-rose-700/50 text-rose-300 hover:bg-rose-900/60 animate-pulse'
              }`}
              title="Click to view or manage register shift"
            >
              <span className={`w-2 h-2 rounded-full ${activeShift ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span>{activeShift ? 'Register Open' : 'Register Closed'}</span>
            </button>

            {/* User switcher button */}
            <button
              onClick={() => setIsSwitchingUser(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-stone-200 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Click to switch staff user with PIN"
            >
              <div className="w-5 h-5 rounded-full bg-stone-700 flex items-center justify-center text-[10px] font-bold text-amber-400">
                {activeUser.name.charAt(0)}
              </div>
              <span className="font-medium max-w-[100px] truncate">{activeUser.name}</span>
              <span className="text-[10px] text-stone-400 uppercase tracking-wider font-mono">
                ({activeUser.role === 'admin' ? 'Owner' : activeUser.role === 'inventory_manager' ? 'Inv Mgr' : 'Cashier'})
              </span>
              <ChevronDown className="w-3 h-3 text-stone-400" />
            </button>

            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              title="Sign out of this POS terminal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
            </button>

            {/* Help / Docs modal trigger */}
            <button
              onClick={onOpenDocModal}
              className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded transition-colors cursor-pointer"
              title="System Documentation & Local Network Guide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Wrap navigation onto additional rows when the screen is narrow. */}
        <nav aria-label="Main navigation" className="flex flex-wrap items-center px-4 py-2 border-t border-stone-800 gap-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 flex items-center gap-1 ${
                  isActive ? 'bg-stone-800 text-amber-400' : 'text-stone-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="text-[10px] font-mono text-amber-400">({item.badge})</span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {signOutError && (
        <div className="fixed right-4 top-20 z-50 max-w-sm rounded border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-lg" role="alert">
          <div className="flex items-start justify-between gap-3">
            <span>{signOutError}</span>
            <button onClick={() => setSignOutError('')} className="font-semibold" aria-label="Dismiss sign-out error">×</button>
          </div>
        </div>
      )}

      {/* Quick Staff Switch PIN Modal */}
      {isSwitchingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-lg max-w-sm w-full p-6 text-stone-100 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-sm text-white">Switch Terminal Staff</h3>
              </div>
              <button
                onClick={() => {
                  setIsSwitchingUser(false);
                  setPinInput('');
                  setPinError(false);
                }}
                className="text-stone-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-stone-400 mb-4 leading-relaxed">
              Enter your 4-digit staff PIN code to unlock this POS terminal.
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, ''));
                    setPinError(false);
                  }}
                  placeholder="• • • •"
                  className={`w-full text-center text-2xl font-mono tracking-widest px-4 py-2.5 bg-stone-800 border rounded focus:outline-hidden ${
                    pinError
                      ? 'border-rose-500 text-rose-300'
                      : 'border-stone-700 focus:border-amber-500 text-white'
                  }`}
                />
                {pinError && (
                  <p className="text-rose-400 text-xs mt-1.5 text-center">
                    Invalid PIN code. Please try again.
                  </p>
                )}
              </div>

              {/* Account reset guidance */}
              <div className="bg-stone-950/60 p-3 rounded border border-stone-800/80 text-[11px] text-stone-400 space-y-1">
                Use the PIN assigned to your staff account. An admin can change or reset a PIN from the Staff page.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSwitchingUser(false);
                    setPinInput('');
                    setPinError(false);
                  }}
                  className="flex-1 px-3 py-2 text-xs font-medium text-stone-300 bg-stone-800 hover:bg-stone-700 rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pinInput.length < 4}
                  className="flex-1 px-3 py-2 text-xs font-medium text-stone-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors cursor-pointer font-semibold"
                >
                  Authorize PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
