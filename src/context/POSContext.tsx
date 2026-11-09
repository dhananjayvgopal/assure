/**
 * Central State Management Context for Thread & Stitch POS
 * Handles local-first reactivity, USB barcode wedge interceptor, cart operations,
 * transactions, stock audit adjustments, and permission control.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  GarmentProduct,
  GarmentVariant,
  CartItem,
  SaleTransaction,
  SaleReturn,
  CashRegisterShift,
  StockAdjustment,
  StoreExpense,
  GiftVoucher,
  BuyGetFreeOffer,
  UserAccount,
  UserRole,
  StoreSettings,
  AppStateBackup,
  PaymentBreakdown,
  ReturnItemRecord,
  SaleItemRecord,
  HeldBill,
  CustomerRecord,
  PartnerRewardSnapshot,
} from '../types/pos';
import {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  normalizeStoreSettings,
  INITIAL_USERS,
  INITIAL_PRODUCTS,
  INITIAL_SHIFTS,
  INITIAL_TRANSACTIONS,
  INITIAL_EXPENSES,
  INITIAL_ADJUSTMENTS,
  loadFromStorage,
  saveToStorage,
  initLocalStorage,
  scrubLegacyBrowserPins,
} from '../utils/storage';
import { playSound } from '../utils/audio';
import { getGstRate, GST_STATE_NAMES, isValidIndianGstin } from '../utils/gst';
import { DEFAULT_ROLE_PERMISSIONS, userHasPermission, type Permission } from '../utils/permissions';

export interface ScannerDiagnostics {
  lastScannedCode: string;
  lastScanDurationMs: number;
  averageInterCharMs: number;
  lastScanTimestamp: string;
  totalHardwareScans: number;
  keystrokeLog: { key: string; deltaMs: number }[];
}

interface POSContextType {
  // Store Settings & Audio
  settings: StoreSettings;
  databaseReady: boolean;
  updateSettings: (newSettings: Partial<StoreSettings>) => void;
  saveSettingsNow: (newSettings: Partial<StoreSettings>) => Promise<void>;

  // Active User & RBAC
  activeUser: UserAccount;
  users: UserAccount[];
  switchUserWithPin: (pin: string) => Promise<boolean>;
  switchUserById: (userId: string) => void;
  addUser: (user: Omit<UserAccount, 'id'>) => Promise<boolean>;
  updateUser: (id: string, updates: Partial<UserAccount>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
  hasPermission: (requiredRole: UserRole | Permission) => boolean;

  // Products & Variants
  products: GarmentProduct[];
  customers: CustomerRecord[];
  saveCustomer: (customer: Omit<CustomerRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => CustomerRecord | null;
  addProduct: (product: Omit<GarmentProduct, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (id: string, product: Partial<GarmentProduct>) => void;
  deleteProduct: (id: string) => void;
  findVariantByBarcode: (barcodeOrSku: string) => { product: GarmentProduct; variant: GarmentVariant } | null;

  // POS Register Cart
  cart: CartItem[];
  addItemToCart: (variant: GarmentVariant, product: GarmentProduct, quantity?: number) => boolean;
  updateCartItemQuantity: (variantId: string, quantity: number) => void;
  updateCartItemDiscount: (variantId: string, discountType: 'percentage' | 'fixed', discountValue: number) => void;
  removeCartItem: (variantId: string) => void;
  clearCart: () => void;
  heldBills: HeldBill[];
  holdCurrentBill: () => boolean;
  resumeHeldBill: (id: string) => boolean;
  deleteHeldBill: (id: string) => boolean;
  cartOrderDiscount: { type: 'percentage' | 'fixed'; value: number };
  setCartOrderDiscount: (discount: { type: 'percentage' | 'fixed'; value: number }) => void;
  customerDetails: { name: string; phone: string; notes: string; gstin: string; address: string; stateCode: string; customerId: string };
  setCustomerDetails: (details: { name: string; phone: string; notes: string; gstin: string; address: string; stateCode: string; customerId: string }) => void;
  cartTotals: {
    subtotal: number;
    itemDiscounts: number;
    offerDiscountTotal: number;
    orderDiscount: number;
    totalDiscount: number;
    taxableAmount: number;
    taxTotal: number;
    grandTotal: number;
    itemCount: number;
    lineTaxBreakdown: {
      variantId: string;
      taxableValue: number;
      customerTotal: number;
      promotionFreeQuantity: number;
      promotionDiscount: number;
      offerNames: string[];
      taxRate: number;
      taxAmount: number;
      cgstAmount: number;
      sgstAmount: number;
      igstAmount: number;
      isInterState: boolean;
    }[];
    appliedOffers: { id: string; name: string; freeQuantity: number; discount: number }[];
    partnerReward: PartnerRewardSnapshot | null;
    priceMode: 'exclusive' | 'inclusive';
  };

  // Transactions & Checkout
  transactions: SaleTransaction[];
  completeSale: (payments: PaymentBreakdown[], changeGiven: number) => SaleTransaction | null;
  voidTransaction: (txId: string, reason: string) => boolean;
  activeReceipt: SaleTransaction | null;
  setActiveReceipt: (receipt: SaleTransaction | null) => void;

  // Returns & Refunds
  returns: SaleReturn[];
  processReturn: (
    originalSaleId: string,
    itemsToReturn: ReturnItemRecord[],
    refundMethod: 'cash' | 'card' | 'upi' | 'store_credit',
    reason: string
  ) => SaleReturn | null;

  // Shifts & Cash Drawer
  shifts: CashRegisterShift[];
  activeShift: CashRegisterShift | null;
  openShift: (openingFloat: number) => void;
  closeShift: (actualClosingCash: number, closeNote?: string) => void;
  addCashDrop: (amount: number, type: 'in' | 'out', note: string) => void;

  // Inventory Tools & Audit
  adjustments: StockAdjustment[];
  adjustStock: (
    variantId: string,
    changeQty: number,
    type: StockAdjustment['type'],
    reason: string
  ) => void;
  batchAuditCount: (auditResults: { variantId: string; actualCount: number; reason: string }[]) => void;
  lowStockItems: { product: GarmentProduct; variant: GarmentVariant }[];

  // Basic Accounting & Expenses
  expenses: StoreExpense[];
  addExpense: (expense: Omit<StoreExpense, 'id'>) => void;
  deleteExpense: (id: string) => void;
  vouchers: GiftVoucher[];
  issueGiftVoucher: (amount: number, customerName: string, note: string) => GiftVoucher | null;
  voidGiftVoucher: (id: string) => boolean;
  offers: BuyGetFreeOffer[];
  addOffer: (offer: Omit<BuyGetFreeOffer, 'id' | 'createdAt' | 'createdBy'>) => BuyGetFreeOffer | null;
  updateOffer: (id: string, updates: Partial<BuyGetFreeOffer>) => boolean;
  deleteOffer: (id: string) => boolean;

  // Hardware Scanner diagnostics & hook
  scannerDiagnostics: ScannerDiagnostics;
  simulateScan: (barcode: string) => boolean;

  // Backup & Restore
  exportDataBackup: () => AppStateBackup;
  importDataBackup: (backup: AppStateBackup) => { success: boolean; message: string };
  clearAllData: (adminPin: string) => Promise<void>;

  // Active view navigation
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

const createVoucherCode = (vouchers: GiftVoucher[]) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    code = `FND-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')}`;
  } while (vouchers.some((voucher) => voucher.code.toUpperCase() === code));
  return code;
};

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize storage once
  useEffect(() => {
    initLocalStorage();
  }, []);

  // Main state pieces loaded from LocalStorage
  const [settings, setSettings] = useState<StoreSettings>(() => {
    const loaded = loadFromStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    return normalizeStoreSettings(loaded);
  });
  const [users, setUsers] = useState<UserAccount[]>(() =>
    loadFromStorage(STORAGE_KEYS.USERS, INITIAL_USERS)
  );
  const [activeUser, setActiveUser] = useState<UserAccount>(() =>
    loadFromStorage(STORAGE_KEYS.ACTIVE_USER, INITIAL_USERS[0])
  );
  const [products, setProducts] = useState<GarmentProduct[]>(() => {
    const loaded = loadFromStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    if (!loaded || loaded.length === 0 || (loaded[0].variants[0]?.sellingPrice && loaded[0].variants[0].sellingPrice < 200)) {
      return INITIAL_PRODUCTS;
    }
    return loaded;
  });
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [transactions, setTransactions] = useState<SaleTransaction[]>(() => {
    const loaded = loadFromStorage(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
    if (!loaded || loaded.length === 0 || (loaded[0]?.grandTotal && loaded[0].grandTotal < 200)) {
      return INITIAL_TRANSACTIONS;
    }
    return loaded;
  });
  const [returns, setReturns] = useState<SaleReturn[]>(() =>
    loadFromStorage(STORAGE_KEYS.RETURNS, [])
  );
  const [shifts, setShifts] = useState<CashRegisterShift[]>(() => {
    const loaded = loadFromStorage(STORAGE_KEYS.SHIFTS, INITIAL_SHIFTS);
    if (!loaded || loaded.length === 0 || (loaded[0]?.openingFloat && loaded[0].openingFloat < 500)) {
      return INITIAL_SHIFTS;
    }
    return loaded;
  });
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>(() =>
    loadFromStorage(STORAGE_KEYS.ADJUSTMENTS, INITIAL_ADJUSTMENTS)
  );
  const [expenses, setExpenses] = useState<StoreExpense[]>(() =>
    loadFromStorage(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES)
  );
  const [vouchers, setVouchers] = useState<GiftVoucher[]>(() => loadFromStorage(STORAGE_KEYS.VOUCHERS, []));
  const [offers, setOffers] = useState<BuyGetFreeOffer[]>(() => loadFromStorage(STORAGE_KEYS.OFFERS, []));
  const [heldBills, setHeldBills] = useState<HeldBill[]>(() => loadFromStorage(STORAGE_KEYS.HELD_BILLS, []));
  const [databaseReady, setDatabaseReady] = useState(false);
  const databaseRevision = useRef(0);
  const databaseWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const databaseWriteTimer = useRef<number | undefined>(undefined);
  const databaseWarningShown = useRef(false);

  // Cart state (in-memory per session)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOrderDiscount, setCartOrderDiscount] = useState<{ type: 'percentage' | 'fixed'; value: number }>({
    type: 'fixed',
    value: 0,
  });
  const [customerDetails, setCustomerDetails] = useState<{ name: string; phone: string; notes: string; gstin: string; address: string; stateCode: string; customerId: string }>({
    name: '',
    phone: '',
    notes: '',
    gstin: '',
    address: '',
    stateCode: '',
    customerId: '',
  });

  // Receipt Modal target
  const [activeReceipt, setActiveReceipt] = useState<SaleTransaction | null>(null);

  // Active View Tab
  const [currentTab, setCurrentTab] = useState<string>('pos');

  // Scanner Diagnostics
  const [scannerDiagnostics, setScannerDiagnostics] = useState<ScannerDiagnostics>({
    lastScannedCode: '',
    lastScanDurationMs: 0,
    averageInterCharMs: 0,
    lastScanTimestamp: '',
    totalHardwareScans: 0,
    keystrokeLog: [],
  });

  // Sync state changes to localStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SETTINGS, settings);
  }, [settings]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.USERS, users);
  }, [users]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ACTIVE_USER, activeUser);
  }, [activeUser]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PRODUCTS, products);
  }, [products]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.TRANSACTIONS, transactions);
  }, [transactions]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.RETURNS, returns);
  }, [returns]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SHIFTS, shifts);
  }, [shifts]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ADJUSTMENTS, adjustments);
  }, [adjustments]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.EXPENSES, expenses);
  }, [expenses]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.VOUCHERS, vouchers); }, [vouchers]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.OFFERS, offers); }, [offers]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.HELD_BILLS, heldBills); }, [heldBills]);

  // Migrate this browser's existing POS data into SQLite on first run, then load SQLite as the source of truth.
  useEffect(() => {
    let cancelled = false;
    const readLegacyState = () => ({
      settings: loadFromStorage(STORAGE_KEYS.SETTINGS, settings),
      users: loadFromStorage(STORAGE_KEYS.USERS, users),
      activeUser: loadFromStorage(STORAGE_KEYS.ACTIVE_USER, activeUser),
      products: loadFromStorage(STORAGE_KEYS.PRODUCTS, products),
      transactions: loadFromStorage(STORAGE_KEYS.TRANSACTIONS, transactions),
      returns: loadFromStorage(STORAGE_KEYS.RETURNS, returns),
      shifts: loadFromStorage(STORAGE_KEYS.SHIFTS, shifts),
      adjustments: loadFromStorage(STORAGE_KEYS.ADJUSTMENTS, adjustments),
      expenses: loadFromStorage(STORAGE_KEYS.EXPENSES, expenses),
      customers: [],
      vouchers: loadFromStorage(STORAGE_KEYS.VOUCHERS, vouchers),
      offers: loadFromStorage(STORAGE_KEYS.OFFERS, offers),
      heldBills: loadFromStorage(STORAGE_KEYS.HELD_BILLS, heldBills),
    });
    const applyDatabaseState = (state: Record<string, any>) => {
      if (state.settings) {
        setSettings(normalizeStoreSettings(state.settings));
      }
      const grantStaffExpenseEntry = (user: UserAccount): UserAccount => user.role === 'admin' ? user : {
        ...user,
        permissions: [...new Set([...(user.permissions ?? DEFAULT_ROLE_PERMISSIONS[user.role]), 'expenses.add' as Permission, 'offers.view' as Permission, 'vouchers.view' as Permission, ...(user.role === 'inventory_manager' ? ['offers.manage' as Permission, 'vouchers.manage' as Permission] : [])])],
      };
      const hydratedUsers = Array.isArray(state.users) ? state.users.map(grantStaffExpenseEntry) : null;
      if (hydratedUsers) setUsers(hydratedUsers);
      if (state.activeUser) {
        const matchingUser = hydratedUsers?.find((user: UserAccount) => user.id === state.activeUser.id);
        setActiveUser(grantStaffExpenseEntry(matchingUser || state.activeUser));
      }
      if (Array.isArray(state.products)) setProducts(state.products);
      if (Array.isArray(state.customers)) setCustomers(state.customers);
      if (Array.isArray(state.transactions)) setTransactions(state.transactions);
      if (Array.isArray(state.returns)) setReturns(state.returns);
      if (Array.isArray(state.shifts)) setShifts(state.shifts);
      if (Array.isArray(state.adjustments)) setAdjustments(state.adjustments);
      if (Array.isArray(state.expenses)) setExpenses(state.expenses);
      if (Array.isArray(state.vouchers)) setVouchers(state.vouchers);
      if (Array.isArray(state.offers)) setOffers(state.offers);
      if (Array.isArray(state.heldBills)) setHeldBills(state.heldBills);
    };

    const hydrate = async () => {
      try {
        initLocalStorage();
        let response = await fetch('/api/state', { cache: 'no-store' });
        if (!response.ok) throw new Error('Could not read the local SQLite database.');
        let saved = await response.json();

        if (saved.state) {
          scrubLegacyBrowserPins();
          applyDatabaseState(saved.state);
          databaseRevision.current = saved.revision;
        } else {
          const migrated = readLegacyState();
          response = await fetch('/api/state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: migrated, expectedRevision: 0 }),
          });
          saved = await response.json();
          if (response.status === 409) {
            const latest = await fetch('/api/state', { cache: 'no-store' }).then((r) => r.json());
            if (latest.state) {
              applyDatabaseState(latest.state);
              databaseRevision.current = latest.revision;
            }
          } else if (!response.ok) {
            throw new Error(saved.error || 'Could not migrate browser data into SQLite.');
          } else {
            databaseRevision.current = saved.revision;
          }
        }
        if (!cancelled) setDatabaseReady(true);
      } catch (error) {
        console.error('SQLite initialization failed:', error);
        if (!cancelled && !databaseWarningShown.current) {
          databaseWarningShown.current = true;
          window.alert('The local database could not be reached. Keep this POS open only for demonstration until the local server is running.');
        }
      }
    };
    void hydrate();
    return () => { cancelled = true; };
  // State is deliberately read once when migrating legacy browser storage.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const databaseSnapshot = useMemo(() => ({
    settings, users, activeUser, products, customers, transactions, returns, shifts, adjustments, expenses, vouchers, offers, heldBills,
  }), [settings, users, activeUser, products, customers, transactions, returns, shifts, adjustments, expenses, vouchers, offers, heldBills]);

  useEffect(() => {
    if (!databaseReady) return;
    const timer = window.setTimeout(() => {
      databaseWriteTimer.current = undefined;
      const snapshot = databaseSnapshot;
      databaseWriteQueue.current = databaseWriteQueue.current.then(async () => {
        const response = await fetch('/api/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: snapshot, expectedRevision: databaseRevision.current }),
        });
        const result = await response.json();
        if (response.status === 409) {
          setDatabaseReady(false);
          if (!databaseWarningShown.current) {
            databaseWarningShown.current = true;
            window.alert('The SQLite data changed in another POS window. Refresh this window before continuing to avoid overwriting newer data.');
          }
          return;
        }
        if (!response.ok) throw new Error(result.error || 'Could not save POS data to SQLite.');
        databaseRevision.current = result.revision;
      }).catch((error) => {
        console.error('SQLite save failed:', error);
        setDatabaseReady(false);
        if (!databaseWarningShown.current) {
          databaseWarningShown.current = true;
          window.alert('A POS change could not be saved to SQLite. Check that the local POS server is still running, then refresh this window.');
        }
      });
    }, 300);
    databaseWriteTimer.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (databaseWriteTimer.current === timer) databaseWriteTimer.current = undefined;
    };
  }, [databaseReady, databaseSnapshot]);

  // Derived: Current Active Register Shift
  const activeShift = useMemo(() => {
    return shifts.find((s) => s.status === 'open') || null;
  }, [shifts]);

  // Client checks control navigation; the same permissions are independently enforced by the local API.
  const hasPermission = useCallback((requiredRole: UserRole | Permission): boolean => {
    if (!activeUser) return false;
    if (requiredRole === 'admin') return activeUser.role === 'admin';
    if (requiredRole === 'inventory_manager') return userHasPermission(activeUser, 'products.manage') || userHasPermission(activeUser, 'inventory.adjust');
    if (requiredRole === 'cashier') return userHasPermission(activeUser, 'pos.use');
    return userHasPermission(activeUser, requiredRole);
  }, [activeUser]);

  const switchUserWithPin = useCallback(async (pin: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (!response.ok) throw new Error('PIN is incorrect or account is inactive.');
      const result = await response.json();
      setActiveUser(result.user);
      playSound('success', settings.soundEnabled);
      return true;
    } catch {
      playSound('error', settings.soundEnabled);
      return false;
    }
  }, [settings.soundEnabled]);

  const switchUserById = useCallback(
    (userId: string) => {
      const match = users.find((u) => u.id === userId && u.active);
      if (match) {
        setActiveUser(match);
      }
    },
    [users]
  );

  const addUser = useCallback(async (newUser: Omit<UserAccount, 'id'>): Promise<boolean> => {
    const id = `usr-${Date.now()}`;
    try {
      const response = await fetch('/api/auth/credential', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, pin: newUser.pin, action: 'set' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not set staff PIN.');
      setUsers((prev) => [...prev, { ...newUser, pin: '', id }]);
      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not add staff member.');
      return false;
    }
  }, []);

  const updateUser = useCallback(async (id: string, updates: Partial<UserAccount>): Promise<boolean> => {
    const safeUpdates = { ...updates };
    if (safeUpdates.pin) {
      try {
        const response = await fetch('/api/auth/credential', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: id, pin: safeUpdates.pin, action: 'set' }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not reset staff PIN.');
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Could not reset staff PIN.');
        return false;
      }
      safeUpdates.pin = '';
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...safeUpdates } : u)));
    setActiveUser((curr) => (curr.id === id ? { ...curr, ...safeUpdates } : curr));
    return true;
  }, []);

  const deleteUser = useCallback(async (id: string): Promise<boolean> => {
    const target = users.find((user) => user.id === id);
    if (users.length <= 1 || id === activeUser.id || !target) return false;
    if (target.role === 'admin' && target.active && !users.some((user) => user.id !== id && user.active && user.role === 'admin')) return false;
    try {
      const response = await fetch('/api/auth/credential', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, action: 'delete' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not remove staff access.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not remove staff access.');
      return false;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    return true;
  }, [users, activeUser.id]);

  const updateSettings = useCallback((newSettings: Partial<StoreSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const saveSettingsNow = useCallback(async (newSettings: Partial<StoreSettings>) => {
    if (databaseWriteTimer.current !== undefined) {
      window.clearTimeout(databaseWriteTimer.current);
      databaseWriteTimer.current = undefined;
    }
    await databaseWriteQueue.current;
    const nextSettings = { ...settings, ...newSettings };
    const snapshot = { settings: nextSettings, users, activeUser, products, customers, transactions, returns, shifts, adjustments, expenses, vouchers, offers, heldBills };
    const response = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: snapshot, expectedRevision: databaseRevision.current }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save the business details to the local database.');
    databaseRevision.current = result.revision;
    setSettings(nextSettings);
  }, [settings, users, activeUser, products, customers, transactions, returns, shifts, adjustments, expenses, vouchers, offers, heldBills]);

  // Products helpers
  const saveCustomer = useCallback((input: Omit<CustomerRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): CustomerRecord | null => {
    const values = { name: input.name?.trim() || '', phone: input.phone?.trim() || '', gstin: input.gstin?.trim().toUpperCase() || '', address: input.address?.trim() || '', stateCode: input.stateCode?.trim() || '', notes: input.notes?.trim() || '' };
    if (!Object.values(values).some(Boolean)) { window.alert('Enter at least one customer detail to save a customer record. Name and mobile number are optional.'); return null; }
    if (values.gstin && !isValidIndianGstin(values.gstin)) { window.alert('Enter a valid 15-character GSTIN or clear the field.'); return null; }
    const now = new Date().toISOString();
    const existing = input.id ? customers.find((item) => item.id === input.id) : undefined;
    const customer: CustomerRecord = { ...values, id: existing?.id || `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: existing?.createdAt || now, updatedAt: now };
    setCustomers((prev) => existing ? prev.map((item) => item.id === customer.id ? customer : item) : [customer, ...prev]);
    return customer;
  }, [customers]);

  const addProduct = useCallback(
    (newProd: Omit<GarmentProduct, 'id' | 'createdAt' | 'updatedAt'>) => {
      const id = `prod-${Date.now()}`;
      const now = new Date().toISOString();
      const product: GarmentProduct = {
        ...newProd,
        id,
        createdAt: now,
        updatedAt: now,
      };
      setProducts((prev) => [product, ...prev]);
    },
    []
  );

  const updateProduct = useCallback((id: string, updates: Partial<GarmentProduct>) => {
    const now = new Date().toISOString();
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: now } : p))
    );
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const findVariantByBarcode = useCallback(
    (barcodeOrSku: string): { product: GarmentProduct; variant: GarmentVariant } | null => {
      const query = barcodeOrSku.trim().toUpperCase();
      if (!query) return null;

      for (const product of products) {
        for (const variant of product.variants) {
          if (
            variant.barcode.toUpperCase() === query ||
            variant.sku.toUpperCase() === query
          ) {
            return { product, variant };
          }
        }
      }
      return null;
    },
    [products]
  );

  // Cart operations
  const addItemToCart = useCallback(
    (variant: GarmentVariant, product: GarmentProduct, quantity: number = 1): boolean => {
      let added = false;
      setCart((prev) => {
        const existing = prev.find((item) => item.variantId === variant.id);
        const currentQty = existing ? existing.quantity : 0;
        const requestedTotal = currentQty + quantity;

        // Stock guard check
        if (requestedTotal > variant.stock) {
          playSound('error', settings.soundEnabled);
          return prev; // cannot exceed stock
        }

        added = true;
        playSound('scan', settings.soundEnabled);

        if (existing) {
          return prev.map((item) =>
            item.variantId === variant.id
              ? { ...item, quantity: requestedTotal }
              : item
          );
        }

        const newItem: CartItem = {
          variantId: variant.id,
          productId: product.id,
          productName: product.name,
          sku: variant.sku,
          barcode: variant.barcode,
          hsnCode: product.hsnCode || '6205',
          size: variant.size,
          color: variant.color,
          colorHex: variant.colorHex,
          unitPrice: variant.sellingPrice,
          unitCost: variant.costPrice,
          quantity,
          discountType: 'fixed',
          discountValue: 0,
          taxRate: product.taxRate ?? settings.taxRateDefault,
          stockAvailable: variant.stock,
        };
        return [...prev, newItem];
      });
      return added;
    },
    [settings.soundEnabled, settings.taxRateDefault]
  );

  const updateCartItemQuantity = useCallback((variantId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.variantId !== variantId));
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.variantId === variantId) {
          const validQty = Math.min(quantity, item.stockAvailable);
          return { ...item, quantity: validQty };
        }
        return item;
      })
    );
  }, []);

  const updateCartItemDiscount = useCallback(
    (variantId: string, discountType: 'percentage' | 'fixed', discountValue: number) => {
      setCart((prev) =>
        prev.map((item) =>
          item.variantId === variantId
            ? { ...item, discountType, discountValue: Math.max(0, discountValue) }
            : item
        )
      );
    },
    []
  );

  const removeCartItem = useCallback((variantId: string) => {
    setCart((prev) => prev.filter((item) => item.variantId !== variantId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCartOrderDiscount({ type: 'fixed', value: 0 });
    setCustomerDetails({ name: '', phone: '', notes: '', gstin: '', address: '', stateCode: '', customerId: '' });
  }, []);

  const holdCurrentBill = useCallback((): boolean => {
    if (!cart.length) return false;
    const held: HeldBill = {
      id: `hold-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      heldAt: new Date().toISOString(), heldBy: activeUser.name, cart: structuredClone(cart),
      cartOrderDiscount: { ...cartOrderDiscount }, customerDetails: { ...customerDetails },
    };
    setHeldBills((previous) => [held, ...previous]);
    clearCart();
    return true;
  }, [activeUser.name, cart, cartOrderDiscount, customerDetails, clearCart]);

  const resumeHeldBill = useCallback((id: string): boolean => {
    const held = heldBills.find((bill) => bill.id === id);
    if (!held) return false;
    const refreshedCart = held.cart.map((item) => {
      const variant = products.flatMap((product) => product.variants).find((entry) => entry.id === item.variantId);
      return { ...item, stockAvailable: variant?.stock ?? 0 };
    });
    const unavailable = refreshedCart.filter((item) => item.quantity > item.stockAvailable);
    if (unavailable.length) {
      alert(`This held bill cannot be resumed yet: ${unavailable.map((item) => `${item.productName} (${item.size}/${item.color}) has ${item.stockAvailable} in stock but ${item.quantity} is needed`).join('; ')}. Adjust stock or remove the unavailable items from the bill.`);
      return false;
    }
    if (cart.length && !window.confirm('The current cart will be safely held before this bill is resumed. Continue?')) return false;
    if (cart.length) {
      setHeldBills((previous) => [{
        id: `hold-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        heldAt: new Date().toISOString(), heldBy: activeUser.name, cart: structuredClone(cart),
        cartOrderDiscount: { ...cartOrderDiscount }, customerDetails: { ...customerDetails },
      }, ...previous.filter((bill) => bill.id !== id)]);
    } else {
      setHeldBills((previous) => previous.filter((bill) => bill.id !== id));
    }
    setCart(refreshedCart);
    setCartOrderDiscount(held.cartOrderDiscount);
    setCustomerDetails({ ...held.customerDetails, customerId: held.customerDetails.customerId || '' });
    return true;
  }, [activeUser.name, cart, cartOrderDiscount, customerDetails, heldBills, products]);

  const deleteHeldBill = useCallback((id: string): boolean => {
    if (!heldBills.some((bill) => bill.id === id)) return false;
    if (!window.confirm('Delete this held bill? This does not create a sale or change stock.')) return false;
    setHeldBills((previous) => previous.filter((bill) => bill.id !== id));
    return true;
  }, [heldBills]);

  // Compute Cart Totals
  const cartTotals = useMemo(() => {
    let subtotal = 0;
    let itemDiscounts = 0;
    let offerDiscountTotal = 0;
    let itemCount = 0;
    const remainingUnits = new Map(cart.map((item) => [item.variantId, item.quantity]));
    const freeAllocations = new Map<string, { quantity: number; discount: number; offerNames: string[] }>();
    const discountAllocations = new Map<string, { discount: number; offerNames: string[] }>();
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const activeOffers = offers.filter((offer) => {
      if (!offer.active) return false;
      return localDate >= offer.startsOn && localDate <= offer.endsOn;
    });
    const categoryByProductId = new Map(products.map((product) => [product.id, product.category]));
    const offerIncludesProduct = (offer: BuyGetFreeOffer, productId: string) => {
      if (offer.scope === 'store') return true;
      if (offer.scope === 'categories') return (offer.categories || []).includes(categoryByProductId.get(productId) as NonNullable<BuyGetFreeOffer['categories']>[number]);
      return offer.productIds.includes(productId);
    };
    const appliedOfferTotals = new Map<string, { id: string; name: string; freeQuantity: number; discount: number }>();
    for (const offer of activeOffers) {
      if ((offer.type || 'buy_get_free') !== 'buy_get_free') continue;
      const pool = cart.filter((item) => offerIncludesProduct(offer, item.productId) && (remainingUnits.get(item.variantId) || 0) > 0);
      const eligibleUnits = pool.reduce((sum, item) => sum + (remainingUnits.get(item.variantId) || 0), 0);
      const bundleSize = offer.buyQuantity + offer.freeQuantity;
      const freeCount = Math.floor(eligibleUnits / bundleSize) * offer.freeQuantity;
      if (freeCount <= 0) continue;
      let unallocated = freeCount;
      const lowestFirst = [...pool].sort((a, b) => a.unitPrice - b.unitPrice || a.sku.localeCompare(b.sku));
      for (const item of lowestFirst) {
        const units = Math.min(unallocated, remainingUnits.get(item.variantId) || 0);
        if (units <= 0) continue;
        const discount = Number((units * item.unitPrice).toFixed(2));
        const allocation = freeAllocations.get(item.variantId) || { quantity: 0, discount: 0, offerNames: [] };
        allocation.quantity += units;
        allocation.discount = Number((allocation.discount + discount).toFixed(2));
        allocation.offerNames.push(offer.name);
        freeAllocations.set(item.variantId, allocation);
        remainingUnits.set(item.variantId, (remainingUnits.get(item.variantId) || 0) - units);
        const total = appliedOfferTotals.get(offer.id) || { id: offer.id, name: offer.name, freeQuantity: 0, discount: 0 };
        total.freeQuantity += units;
        total.discount = Number((total.discount + discount).toFixed(2));
        appliedOfferTotals.set(offer.id, total);
        unallocated -= units;
        if (!unallocated) break;
      }
    }

    // A qualifying Buy X, Get Y offer takes precedence over single-garment
    // discounts for this basket. Discounts are the fallback when no free-item
    // promotion can be applied; the two offer types never stack together.
    if (freeAllocations.size === 0) {
      for (const offer of activeOffers) {
        if (offer.type !== 'discount') continue;
        const value = Math.max(0, Number(offer.discountValue) || 0);
        if (value <= 0) continue;
        const eligible = cart.filter((item) => offerIncludesProduct(offer, item.productId));
        let discountForOffer = 0;
        for (const item of eligible) {
          const base = item.unitPrice * item.quantity;
          const alreadyDiscounted = discountAllocations.get(item.variantId)?.discount || 0;
          const remainingBase = Math.max(0, base - alreadyDiscounted);
          const requested = offer.discountType === 'percentage'
            ? remainingBase * Math.min(100, value) / 100
            : Math.min(remainingBase, value * item.quantity);
          const discount = Number(Math.min(remainingBase, requested).toFixed(2));
          if (discount <= 0) continue;
          const allocation = discountAllocations.get(item.variantId) || { discount: 0, offerNames: [] };
          allocation.discount = Number((allocation.discount + discount).toFixed(2));
          allocation.offerNames.push(offer.name);
          discountAllocations.set(item.variantId, allocation);
          discountForOffer += discount;
        }
        if (discountForOffer > 0) {
          appliedOfferTotals.set(offer.id, { id: offer.id, name: offer.name, freeQuantity: 0, discount: Number(discountForOffer.toFixed(2)) });
        }
      }
    }

    const bases = cart.map((item) => {
      const itemSub = item.unitPrice * item.quantity;
      const free = freeAllocations.get(item.variantId) || { quantity: 0, discount: 0, offerNames: [] };
      const remainingSubtotal = item.unitPrice * (item.quantity - free.quantity);
      const priceOffer = discountAllocations.get(item.variantId) || { discount: 0, offerNames: [] };
      const promotionDiscount = Number((free.discount + priceOffer.discount).toFixed(2));
      const promotionNames = [...new Set([...free.offerNames, ...priceOffer.offerNames])];
      const discountedSubtotal = Math.max(0, remainingSubtotal - priceOffer.discount);
      let manualDiscount = 0;
      if (item.discountType === 'percentage') {
        manualDiscount = (discountedSubtotal * Math.min(100, item.discountValue)) / 100;
      } else {
        manualDiscount = Math.min(discountedSubtotal, item.discountValue);
      }

      subtotal += itemSub;
      itemDiscounts += manualDiscount;
      offerDiscountTotal += promotionDiscount;
      itemCount += item.quantity;
      return { item, base: Math.max(0, discountedSubtotal - manualDiscount), promotionFreeQuantity: free.quantity, promotionDiscount, offerNames: promotionNames };
    });
    const amountBeforeOrderDiscount = bases.reduce((sum, line) => sum + line.base, 0);

    // Order-level discount
    let orderDiscount = 0;
    if (cartOrderDiscount.type === 'percentage') {
      orderDiscount = (amountBeforeOrderDiscount * Math.min(100, cartOrderDiscount.value)) / 100;
    } else {
      orderDiscount = Math.min(amountBeforeOrderDiscount, cartOrderDiscount.value);
    }

    // Discounts are applied in the selected selling-price basis, then GST is
    // added (exclusive) or extracted (inclusive) per line for accurate reporting.
    const lineTaxBreakdown = bases.map(({ item, base, promotionFreeQuantity, promotionDiscount, offerNames }) => {
      const allocatedDiscount = amountBeforeOrderDiscount > 0 ? orderDiscount * base / amountBeforeOrderDiscount : 0;
      const customerAmount = Number(Math.max(0, base - allocatedDiscount).toFixed(2));
      const taxableUnits = Math.max(1, item.quantity - promotionFreeQuantity);
      const rate = settings.registrationType === 'regular'
        ? getGstRate(item.hsnCode, customerAmount / taxableUnits, item.taxRate)
        : 0;
      const includesTax = settings.registrationType === 'regular' && settings.priceMode === 'inclusive';
      const taxableValue = Number((includesTax ? customerAmount / (1 + rate / 100) : customerAmount).toFixed(2));
      const taxAmount = Number((includesTax ? customerAmount - taxableValue : taxableValue * rate / 100).toFixed(2));
      const cgstAmount = Number((taxAmount / 2).toFixed(2));
      const sgstAmount = Number((taxAmount - cgstAmount).toFixed(2));
      const placeCode = (customerDetails.stateCode.trim() || customerDetails.gstin.trim().slice(0, 2) || settings.stateCode || '09');
      const isInterState = placeCode !== (settings.stateCode || '09');
      return {
        variantId: item.variantId,
        taxableValue,
        customerTotal: includesTax ? customerAmount : Number((taxableValue + taxAmount).toFixed(2)),
        promotionFreeQuantity,
        promotionDiscount,
        offerNames,
        taxRate: rate,
        taxAmount,
        cgstAmount: isInterState ? 0 : cgstAmount,
        sgstAmount: isInterState ? 0 : sgstAmount,
        igstAmount: isInterState ? taxAmount : 0,
        isInterState,
      };
    });
    const taxableAmount = lineTaxBreakdown.reduce((sum, line) => sum + line.taxableValue, 0);
    const taxTotal = Number(lineTaxBreakdown.reduce((sum, line) => sum + line.taxAmount, 0).toFixed(2));

    const totalDiscount = itemDiscounts + offerDiscountTotal + orderDiscount;
    const grandTotal = Math.max(0, Number(lineTaxBreakdown.reduce((sum, line) => sum + line.customerTotal, 0).toFixed(2)));
    const partnerRewardOffer = activeOffers
      .filter((offer) => offer.type === 'spend_reward'
        && Number(offer.minimumPurchase) > 0
        && grandTotal >= Number(offer.minimumPurchase)
        && Boolean(offer.rewardItemName?.trim())
        && Boolean(offer.rewardPartnerName?.trim()))
      .sort((a, b) => Number(b.minimumPurchase) - Number(a.minimumPurchase))[0];
    const partnerReward: PartnerRewardSnapshot | null = partnerRewardOffer ? {
      offerId: partnerRewardOffer.id,
      offerName: partnerRewardOffer.name,
      minimumPurchase: Number(partnerRewardOffer.minimumPurchase),
      itemName: partnerRewardOffer.rewardItemName!.trim(),
      partnerName: partnerRewardOffer.rewardPartnerName!.trim(),
      instructions: partnerRewardOffer.rewardInstructions?.trim() || undefined,
    } : null;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      itemDiscounts: Number(itemDiscounts.toFixed(2)),
      offerDiscountTotal: Number(offerDiscountTotal.toFixed(2)),
      orderDiscount: Number(orderDiscount.toFixed(2)),
      totalDiscount: Number(totalDiscount.toFixed(2)),
      taxableAmount: Number(taxableAmount.toFixed(2)),
      taxTotal: Number(taxTotal.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2)),
      itemCount,
      lineTaxBreakdown,
      appliedOffers: Array.from(appliedOfferTotals.values()),
      partnerReward,
      priceMode: settings.priceMode || 'exclusive',
    };
  }, [cart, offers, products, cartOrderDiscount, customerDetails.gstin, customerDetails.stateCode, settings.registrationType, settings.priceMode, settings.stateCode]);

  // Complete Sale Checkout
  const completeSale = useCallback(
    (payments: PaymentBreakdown[], changeGiven: number): SaleTransaction | null => {
      if (cart.length === 0) return null;
      if (!settings.businessSetupComplete) {
        alert('Complete the business details and GST setup before processing sales.');
        return null;
      }
      const registrationType = settings.registrationType || (settings.taxId ? 'regular' : 'unregistered');
      const gstin = customerDetails.gstin.trim().toUpperCase();
      if (gstin && !isValidIndianGstin(gstin)) {
        alert('Customer GSTIN format is invalid. Check the 15-character GSTIN or clear the field for a retail customer.');
        return null;
      }
      const placeCode = customerDetails.stateCode.trim() || gstin.slice(0, 2);
      if (placeCode && !GST_STATE_NAMES[placeCode]) {
        alert('Enter a valid two-digit GST state code for the customer/place of supply.');
        return null;
      }
      if (gstin && (!customerDetails.name.trim() || !customerDetails.address.trim())) {
        alert('For a GST-registered customer, enter the customer name and address with the GSTIN.');
        return null;
      }
      if (registrationType !== 'unregistered' && !gstin && cartTotals.taxableAmount >= 50000 && (!customerDetails.name.trim() || !customerDetails.address.trim() || !placeCode)) {
        alert('For an unregistered customer at or above ₹50,000 taxable value, enter the customer name, address, and state code.');
        return null;
      }
      if (registrationType !== 'unregistered' && !isValidIndianGstin(settings.taxId)) {
        alert('The shop GSTIN format in Settings is invalid. Correct it before issuing a tax invoice.');
        return null;
      }
      if (registrationType !== 'unregistered' && cart.some((item) => !/^\d{4}(\d{2}(\d{2})?)?$/.test(item.hsnCode || ''))) {
        alert('Add a verified 4, 6, or 8 digit HSN code to every item before issuing a GST invoice or bill of supply.');
        return null;
      }
      if (registrationType === 'composition' && placeCode && placeCode !== settings.stateCode) {
        alert('Composition mode cannot process interstate garment sales. Change the place of supply to the business state or confirm your GST status with your tax adviser.');
        return null;
      }
      if (!activeShift) {
        alert('Please open a register shift before processing sales.');
        return null;
      }

      const voucherPayments = payments.filter((payment) => payment.method === 'gift_voucher');
      if (voucherPayments.length > 1) {
        alert('Use one gift voucher per sale.');
        return null;
      }
      const voucherPayment = voucherPayments[0];
      const voucherCode = voucherPayment?.reference?.trim().toUpperCase();
      const voucher = voucherCode ? vouchers.find((entry) => entry.code.toUpperCase() === voucherCode) : undefined;
      const voucherAmount = Number(voucherPayment?.amount || 0);
      if (voucherPayment && (!voucher || voucher.status !== 'active' || voucherAmount <= 0 || voucherAmount > voucher.balance + 0.001 || voucherAmount > cartTotals.grandTotal + 0.001)) {
        alert('Gift voucher is invalid, inactive, or does not have enough balance. Check the code and remaining value.');
        return null;
      }
      const otherTenderPaid = payments.filter((payment) => payment.method !== 'gift_voucher').reduce((sum, payment) => sum + (payment.method === 'cash' ? Math.max(0, payment.amount - changeGiven) : payment.amount), 0);
      if (otherTenderPaid + voucherAmount < cartTotals.grandTotal - 0.01) {
        alert('Payment amount is less than the sale total. Add another payment method or increase the amount.');
        return null;
      }
      const salePayments = payments.map((payment) => payment.method === 'gift_voucher' ? { ...payment, reference: voucherCode } : payment);

      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: '2-digit', month: '2-digit', day: '2-digit' }).formatToParts(now);
      const dateStr = `${parts.find((part) => part.type === 'year')?.value}${parts.find((part) => part.type === 'month')?.value}${parts.find((part) => part.type === 'day')?.value}`;
      const txNum = (transactions.length + 1).toString().padStart(4, '0');
      const receiptNumber = `POS-${dateStr}-${txNum}`;
      const txId = `tx-${Date.now()}`;

      const saleItems = cart.map((item) => {
        const itemGross = item.unitPrice * item.quantity;
        let itemDisc = 0;
        if (item.discountType === 'percentage') {
          itemDisc = (itemGross * Math.min(100, item.discountValue)) / 100;
        } else {
          itemDisc = Math.min(itemGross, item.discountValue);
        }
        const taxLine = cartTotals.lineTaxBreakdown.find((line) => line.variantId === item.variantId)!;
        const lineTotal = taxLine.taxableValue;

        return {
          variantId: item.variantId,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          barcode: item.barcode,
          hsnCode: item.hsnCode || '',
          size: item.size,
          color: item.color,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost,
          quantity: item.quantity,
          discountType: item.discountType,
          discountValue: item.discountValue,
          offerFreeQuantity: taxLine.promotionFreeQuantity,
          offerDiscount: taxLine.promotionDiscount,
          offerNames: taxLine.offerNames,
          lineTotal,
          taxableValue: lineTotal,
          taxRate: taxLine.taxRate,
          taxAmount: taxLine.taxAmount,
          cgstAmount: taxLine.cgstAmount,
          sgstAmount: taxLine.sgstAmount,
          igstAmount: taxLine.igstAmount,
        };
      });

      const newTx: SaleTransaction = {
        id: txId,
        receiptNumber,
        timestamp: now.toISOString(),
        cashierId: activeUser.id,
        cashierName: activeUser.name,
        customerName: customerDetails.name.trim() || 'Walk-in Customer',
        customerId: customerDetails.customerId || undefined,
        customerPhone: customerDetails.phone || undefined,
        customerGstin: gstin || undefined,
        customerAddress: customerDetails.address.trim() || undefined,
        placeOfSupplyStateCode: customerDetails.stateCode.trim() || gstin.slice(0, 2) || settings.stateCode || '09',
        placeOfSupplyStateName: GST_STATE_NAMES[customerDetails.stateCode.trim() || gstin.slice(0, 2) || settings.stateCode || '09'] || settings.stateName || 'Uttar Pradesh',
        isInterState: cartTotals.lineTaxBreakdown[0]?.isInterState || false,
        items: saleItems,
        subtotal: cartTotals.subtotal,
        orderDiscountType: cartOrderDiscount.type,
        orderDiscountValue: cartOrderDiscount.value,
        discountTotal: cartTotals.totalDiscount,
        taxTotal: cartTotals.taxTotal,
        grandTotal: cartTotals.grandTotal,
        priceMode: settings.priceMode || 'exclusive',
        payments: salePayments,
        changeGiven,
        status: 'completed',
        shiftId: activeShift.id,
        notes: customerDetails.notes || undefined,
        partnerReward: cartTotals.partnerReward || undefined,
      };

      // 1. Decrement inventory
      setProducts((prev) =>
        prev.map((prod) => ({
          ...prod,
          variants: prod.variants.map((v) => {
            const sold = cart.find((c) => c.variantId === v.id);
            if (sold) {
              return { ...v, stock: Math.max(0, v.stock - sold.quantity) };
            }
            return v;
          }),
        }))
      );

      // 2. Update cash register shift cash amounts
      const cashPaid = payments.find((p) => p.method === 'cash')?.amount || 0;
      const netCashToDrawer = Math.max(0, cashPaid - changeGiven);

      setShifts((prev) =>
        prev.map((s) =>
          s.id === activeShift.id
            ? { ...s, cashSales: Number((s.cashSales + netCashToDrawer).toFixed(2)) }
            : s
        )
      );

      // 3. Save transaction
      setTransactions((prev) => [newTx, ...prev]);
      if (voucherPayment && voucher) {
        const remaining = Number(Math.max(0, voucher.balance - voucherAmount).toFixed(2));
        setVouchers((prev) => prev.map((entry) => entry.id === voucher.id
          ? { ...entry, balance: remaining, status: remaining <= 0.001 ? 'redeemed' : 'active' }
          : entry));
      }

      // 4. Play cash chime & reset cart
      playSound('success', settings.soundEnabled);
      setActiveReceipt(newTx);
      clearCart();

      return newTx;
    },
    [
      cart,
      activeShift,
      transactions.length,
      vouchers,
      activeUser,
      customerDetails,
      cartTotals,
      cartOrderDiscount,
      settings.registrationType,
      settings.taxId,
      settings.businessSetupComplete,
      settings.stateCode,
      settings.soundEnabled,
      clearCart,
    ]
  );

  // Void transaction safeguard
  const voidTransaction = useCallback(
    (txId: string, reason: string): boolean => {
      const tx = transactions.find((t) => t.id === txId);
      if (!tx || tx.status !== 'completed' || returns.some((returned) => returned.originalSaleId === txId)) return false;

      // Restock items
      setProducts((prev) =>
        prev.map((prod) => ({
          ...prod,
          variants: prod.variants.map((v) => {
            const match = tx.items.find((i) => i.variantId === v.id);
            if (match) {
              return { ...v, stock: v.stock + match.quantity };
            }
            return v;
          }),
        }))
      );

      // Update tx status
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === txId
            ? { ...t, status: 'voided', notes: `${t.notes || ''} [Voided: ${reason}]` }
            : t
        )
      );

      const cashReceived = tx.payments.filter((payment) => payment.method === 'cash')
        .reduce((sum, payment) => sum + payment.amount, 0);
      const cashSaleToReverse = Math.max(0, cashReceived - tx.changeGiven);
      if (cashSaleToReverse > 0) {
        setShifts((prev) => prev.map((shift) => shift.id === tx.shiftId
          ? { ...shift, cashSales: Number(Math.max(0, shift.cashSales - cashSaleToReverse).toFixed(2)) }
          : shift));
      }
      for (const payment of tx.payments.filter((entry) => entry.method === 'gift_voucher' && entry.reference)) {
        setVouchers((prev) => prev.map((voucher) => voucher.code.toUpperCase() === payment.reference!.toUpperCase()
          ? { ...voucher, balance: Number((voucher.balance + payment.amount).toFixed(2)), status: 'active' }
          : voucher));
      }

      // Create stock adjustment record for audit
      tx.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const variant = prod?.variants.find((v) => v.id === item.variantId);
        const prevStock = variant ? variant.stock : 0;

        const adj: StockAdjustment = {
          id: `adj-${Date.now()}-${item.variantId}`,
          timestamp: new Date().toISOString(),
          variantId: item.variantId,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          barcode: item.barcode,
          size: item.size,
          color: item.color,
          changeQty: item.quantity,
          previousStock: prevStock,
          newStock: prevStock + item.quantity,
          type: 'audit_correction',
          reason: `Sale Voided (${tx.receiptNumber}): ${reason}`,
          userId: activeUser.id,
          userName: activeUser.name,
        };
        setAdjustments((a) => [adj, ...a]);
      });

      return true;
    },
    [transactions, returns, products, shifts, activeUser]
  );

  // Returns & Refunds
  const processReturn = useCallback(
    (
      originalSaleId: string,
      itemsToReturn: ReturnItemRecord[],
      refundMethod: 'cash' | 'card' | 'upi' | 'store_credit',
      reason: string
    ): SaleReturn | null => {
      const origSale = transactions.find((t) => t.id === originalSaleId);
      if (!origSale || origSale.status === 'voided' || !reason.trim() || itemsToReturn.length === 0) return null;

      const soldByVariant = new Map<string, SaleItemRecord>();
      for (const sold of origSale.items) soldByVariant.set(sold.variantId, sold);
      const alreadyReturned = new Map<string, number>();
      for (const prior of returns) if (prior.originalSaleId === originalSaleId) {
        for (const item of prior.returnedItems) alreadyReturned.set(item.variantId, (alreadyReturned.get(item.variantId) || 0) + item.quantity);
      }
      for (const item of itemsToReturn) {
        const sold = soldByVariant.get(item.variantId);
        const remaining = sold ? sold.quantity - (alreadyReturned.get(item.variantId) || 0) : 0;
        if (!sold || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > remaining) return null;
        const expectedRefund = Number((((sold.lineTotal + sold.taxAmount) / sold.quantity) * item.quantity).toFixed(2));
        if (Math.abs(expectedRefund - item.refundAmount) > 0.01) return null;
      }

      const totalRefund = itemsToReturn.reduce((sum, item) => sum + item.refundAmount, 0);
      const returnReceiptNumber = `RET-${Date.now().toString().slice(-6)}`;
      const giftVoucherCode = refundMethod === 'store_credit' ? createVoucherCode(vouchers) : undefined;

      const newReturn: SaleReturn = {
        id: `ret-${Date.now()}`,
        originalSaleId,
        originalReceiptNumber: origSale.receiptNumber,
        returnReceiptNumber,
        timestamp: new Date().toISOString(),
        cashierId: activeUser.id,
        cashierName: activeUser.name,
        customerName: origSale.customerName,
        returnedItems: itemsToReturn,
        totalRefundAmount: Number(totalRefund.toFixed(2)),
        refundMethod,
        giftVoucherCode,
        reason,
      };

      if (giftVoucherCode) setVouchers((prev) => [{
        id: `voucher-${Date.now()}`,
        code: giftVoucherCode,
        createdAt: new Date().toISOString(),
        initialValue: Number(totalRefund.toFixed(2)),
        balance: Number(totalRefund.toFixed(2)),
        customerName: origSale.customerName,
        sourceReturnId: newReturn.id,
        note: `Return ${returnReceiptNumber}: ${reason}`,
        issuedBy: activeUser.name,
        status: 'active',
      }, ...prev]);

      // 1. Restock resalable items
      itemsToReturn.forEach((retItem) => {
        if (retItem.condition === 'resalable') {
          setProducts((prev) =>
            prev.map((prod) => ({
              ...prod,
              variants: prod.variants.map((v) =>
                v.id === retItem.variantId ? { ...v, stock: v.stock + retItem.quantity } : v
              ),
            }))
          );

          // Log stock adjustment
          const adj: StockAdjustment = {
            id: `adj-${Date.now()}-${retItem.variantId}`,
            timestamp: new Date().toISOString(),
            variantId: retItem.variantId,
            productId: '',
            productName: retItem.productName,
            sku: retItem.sku,
            barcode: '',
            size: retItem.size,
            color: retItem.color,
            changeQty: retItem.quantity,
            previousStock: 0,
            newStock: 0,
            type: 'return_restock',
            reason: `Return #${returnReceiptNumber} (${retItem.condition}): ${reason}`,
            userId: activeUser.id,
            userName: activeUser.name,
          };
          setAdjustments((a) => [adj, ...a]);
        }
      });

      // 2. Adjust cash drawer if refund method was cash
      if (refundMethod === 'cash' && activeShift) {
        setShifts((prev) =>
          prev.map((s) =>
            s.id === activeShift.id
              ? { ...s, cashRefunds: Number((s.cashRefunds + totalRefund).toFixed(2)) }
              : s
          )
        );
      }

      // 3. Update original sale status
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === originalSaleId
            ? {
                ...t,
                status: t.items.every((item) => {
                  const totalReturned = (returns.filter((ret) => ret.originalSaleId === originalSaleId)
                    .flatMap((ret) => ret.returnedItems)
                    .filter((returned) => returned.variantId === item.variantId)
                    .reduce((sum, returned) => sum + returned.quantity, 0))
                    + itemsToReturn.filter((returned) => returned.variantId === item.variantId)
                      .reduce((sum, returned) => sum + returned.quantity, 0);
                  return totalReturned >= item.quantity;
                }) ? 'refunded' : 'partially_refunded',
              }
            : t
        )
      );

      setReturns((prev) => [newReturn, ...prev]);
      playSound('success', settings.soundEnabled);
      return newReturn;
    },
    [transactions, returns, activeUser, activeShift, settings.soundEnabled, vouchers]
  );

  // Shift & Cash Drawer operations
  const openShift = useCallback(
    (openingFloat: number) => {
      const newShift: CashRegisterShift = {
        id: `shift-${Date.now()}`,
        cashierId: activeUser.id,
        cashierName: activeUser.name,
        openedAt: new Date().toISOString(),
        status: 'open',
        openingFloat: Number(openingFloat.toFixed(2)),
        cashSales: 0,
        cashRefunds: 0,
        cashIn: 0,
        cashOut: 0,
        drops: [],
      };
      setShifts((prev) => [newShift, ...prev]);
      playSound('drawer', settings.soundEnabled);
    },
    [activeUser, settings.soundEnabled]
  );

  const closeShift = useCallback(
    (actualClosingCash: number, closeNote?: string) => {
      if (!activeShift) return;
      const expected =
        activeShift.openingFloat +
        activeShift.cashSales -
        activeShift.cashRefunds +
        activeShift.cashIn -
        activeShift.cashOut;

      const discrepancy = Number((actualClosingCash - expected).toFixed(2));

      setShifts((prev) =>
        prev.map((s) =>
          s.id === activeShift.id
            ? {
                ...s,
                status: 'closed',
                closedAt: new Date().toISOString(),
                expectedClosingCash: Number(expected.toFixed(2)),
                actualClosingCash: Number(actualClosingCash.toFixed(2)),
                discrepancy,
                closeNote,
              }
            : s
        )
      );
      playSound('drawer', settings.soundEnabled);
    },
    [activeShift, settings.soundEnabled]
  );

  const addCashDrop = useCallback(
    (amount: number, type: 'in' | 'out', note: string) => {
      if (!activeShift) return;
      const dropRecord = {
        id: `drop-${Date.now()}`,
        timestamp: new Date().toISOString(),
        amount: Number(amount.toFixed(2)),
        type,
        note,
        authorizedBy: activeUser.name,
      };

      setShifts((prev) =>
        prev.map((s) => {
          if (s.id !== activeShift.id) return s;
          return {
            ...s,
            cashIn: type === 'in' ? Number((s.cashIn + amount).toFixed(2)) : s.cashIn,
            cashOut: type === 'out' ? Number((s.cashOut + amount).toFixed(2)) : s.cashOut,
            drops: [dropRecord, ...s.drops],
          };
        })
      );
      playSound('drawer', settings.soundEnabled);
    },
    [activeShift, activeUser.name, settings.soundEnabled]
  );

  // Stock adjustment
  const adjustStock = useCallback(
    (
      variantId: string,
      changeQty: number,
      type: StockAdjustment['type'],
      reason: string
    ) => {
      let variantFound: GarmentVariant | null = null;
      let productFound: GarmentProduct | null = null;

      for (const p of products) {
        const v = p.variants.find((varItem) => varItem.id === variantId);
        if (v) {
          variantFound = v;
          productFound = p;
          break;
        }
      }

      if (!variantFound || !productFound) return;

      const prevStock = variantFound.stock;
      const newStock = Math.max(0, prevStock + changeQty);

      // Update variant stock in products
      setProducts((prev) =>
        prev.map((prod) =>
          prod.id === productFound!.id
            ? {
                ...prod,
                variants: prod.variants.map((v) =>
                  v.id === variantId ? { ...v, stock: newStock } : v
                ),
              }
            : prod
        )
      );

      // Record adjustment log
      const newAdj: StockAdjustment = {
        id: `adj-${Date.now()}`,
        timestamp: new Date().toISOString(),
        variantId,
        productId: productFound.id,
        productName: productFound.name,
        sku: variantFound.sku,
        barcode: variantFound.barcode,
        size: variantFound.size,
        color: variantFound.color,
        changeQty,
        previousStock: prevStock,
        newStock,
        type,
        reason,
        userId: activeUser.id,
        userName: activeUser.name,
      };

      setAdjustments((prev) => [newAdj, ...prev]);
    },
    [products, activeUser]
  );

  // Batch Physical Audit Count
  const batchAuditCount = useCallback(
    (auditResults: { variantId: string; actualCount: number; reason: string }[]) => {
      const now = new Date().toISOString();
      const newAdjustments: StockAdjustment[] = [];

      setProducts((prev) =>
        prev.map((prod) => {
          let hasChange = false;
          const updatedVariants = prod.variants.map((v) => {
            const audit = auditResults.find((a) => a.variantId === v.id);
            if (audit && audit.actualCount !== v.stock) {
              hasChange = true;
              const delta = audit.actualCount - v.stock;
              newAdjustments.push({
                id: `adj-${Date.now()}-${v.id}`,
                timestamp: now,
                variantId: v.id,
                productId: prod.id,
                productName: prod.name,
                sku: v.sku,
                barcode: v.barcode,
                size: v.size,
                color: v.color,
                changeQty: delta,
                previousStock: v.stock,
                newStock: audit.actualCount,
                type: 'audit_correction',
                reason: audit.reason || 'Physical cycle count discrepancy adjustment',
                userId: activeUser.id,
                userName: activeUser.name,
              });
              return { ...v, stock: audit.actualCount };
            }
            return v;
          });
          return hasChange ? { ...prod, variants: updatedVariants } : prod;
        })
      );

      if (newAdjustments.length > 0) {
        setAdjustments((prev) => [...newAdjustments, ...prev]);
      }
    },
    [activeUser]
  );

  // Low stock detector
  const lowStockItems = useMemo(() => {
    const list: { product: GarmentProduct; variant: GarmentVariant }[] = [];
    products.forEach((p) => {
      p.variants.forEach((v) => {
        const threshold = v.minStockThreshold || settings.lowStockThresholdDefault;
        if (v.stock <= threshold) {
          list.push({ product: p, variant: v });
        }
      });
    });
    return list;
  }, [products, settings.lowStockThresholdDefault]);

  // Expenses operations
  const addExpense = useCallback(
    (expense: Omit<StoreExpense, 'id'>) => {
      const id = `exp-${Date.now()}`;
      setExpenses((prev) => [{ ...expense, id }, ...prev]);
    },
    []
  );

  const deleteExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const issueGiftVoucher = useCallback((amount: number, customerName: string, note: string): GiftVoucher | null => {
    if (!hasPermission('vouchers.manage') || !Number.isFinite(amount) || amount <= 0) return null;
    const voucher: GiftVoucher = {
      id: `voucher-${Date.now()}`,
      code: createVoucherCode(vouchers),
      createdAt: new Date().toISOString(),
      initialValue: Number(amount.toFixed(2)),
      balance: Number(amount.toFixed(2)),
      customerName: customerName.trim() || undefined,
      note: note.trim() || 'Manual gift voucher',
      issuedBy: activeUser.name,
      status: 'active',
    };
    setVouchers((prev) => [voucher, ...prev]);
    return voucher;
  }, [activeUser.name, hasPermission, vouchers]);

  const voidGiftVoucher = useCallback((id: string): boolean => {
    if (!hasPermission('vouchers.manage')) return false;
    const voucher = vouchers.find((entry) => entry.id === id);
    if (!voucher || voucher.status !== 'active') return false;
    if (!window.confirm(`Void voucher ${voucher.code} and remove its remaining ${settings.currencySymbol}${voucher.balance.toFixed(2)} balance?`)) return false;
    setVouchers((prev) => prev.map((entry) => entry.id === id ? { ...entry, balance: 0, status: 'void' } : entry));
    return true;
  }, [hasPermission, settings.currencySymbol, vouchers]);

  const addOffer = useCallback((offer: Omit<BuyGetFreeOffer, 'id' | 'createdAt' | 'createdBy'>): BuyGetFreeOffer | null => {
    const isDiscount = offer.type === 'discount';
    const isPartnerReward = offer.type === 'spend_reward';
    const hasEligibleScope = offer.scope === 'store' || (offer.scope === 'categories'
      ? Boolean(offer.categories?.length && offer.categories.every((category) => products.some((product) => product.category === category)))
      : Boolean(offer.productIds.length));
    if (!hasPermission('offers.manage') || !offer.name.trim() || (!isPartnerReward && !hasEligibleScope)
      || (!isDiscount && !isPartnerReward && (!Number.isInteger(offer.buyQuantity) || offer.buyQuantity < 1 || !Number.isInteger(offer.freeQuantity) || offer.freeQuantity < 1))
      || (isDiscount && (!(Number(offer.discountValue) > 0) || (offer.discountType === 'percentage' && Number(offer.discountValue) > 100)))
      || (isPartnerReward && (!(Number(offer.minimumPurchase) > 0) || !offer.rewardItemName?.trim() || !offer.rewardPartnerName?.trim()))
      || !offer.startsOn || !offer.endsOn || offer.endsOn < offer.startsOn
      || offer.productIds.some((id) => !products.some((product) => product.id === id))) return null;
    const created: BuyGetFreeOffer = { ...offer, id: `offer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: offer.name.trim(), productIds: [...new Set(offer.productIds)], categories: [...new Set(offer.categories || [])], createdAt: new Date().toISOString(), createdBy: activeUser.name };
    setOffers((prev) => [created, ...prev]);
    return created;
  }, [activeUser.name, hasPermission, products]);

  const updateOffer = useCallback((id: string, updates: Partial<BuyGetFreeOffer>): boolean => {
    if (!hasPermission('offers.manage')) return false;
    const offer = offers.find((entry) => entry.id === id);
    if (!offer) return false;
    const next = { ...offer, ...updates };
    const isPartnerReward = next.type === 'spend_reward';
    const isDiscount = next.type === 'discount';
    const hasEligibleScope = next.scope === 'store' || (next.scope === 'categories'
      ? Boolean(next.categories?.length && next.categories.every((category) => products.some((product) => product.category === category)))
      : Boolean(next.productIds.length));
    if (!next.name.trim() || (!isPartnerReward && !hasEligibleScope)
      || (!isPartnerReward && !isDiscount && (!Number.isInteger(next.buyQuantity) || next.buyQuantity < 1
        || !Number.isInteger(next.freeQuantity) || next.freeQuantity < 1))
      || (isPartnerReward && (!(Number(next.minimumPurchase) > 0) || !next.rewardItemName?.trim() || !next.rewardPartnerName?.trim()))
      || (isDiscount && (!(Number(next.discountValue) > 0) || (next.discountType === 'percentage' && Number(next.discountValue) > 100)))
      || !next.startsOn || !next.endsOn || next.endsOn < next.startsOn
      || next.productIds.some((productId) => !products.some((product) => product.id === productId))) return false;
    setOffers((prev) => prev.map((entry) => entry.id === id ? next : entry));
    return true;
  }, [hasPermission, offers, products]);

  const deleteOffer = useCallback((id: string): boolean => {
    if (!hasPermission('offers.manage') || !offers.some((entry) => entry.id === id)) return false;
    if (!window.confirm('Delete this offer? It will no longer apply to new sales. Past receipts will remain unchanged.')) return false;
    setOffers((prev) => prev.filter((entry) => entry.id !== id));
    return true;
  }, [hasPermission, offers]);

  // Hardware Scanner Simulation / Lookup
  const simulateScan = useCallback(
    (barcode: string): boolean => {
      const match = findVariantByBarcode(barcode);
      if (match) {
        addItemToCart(match.variant, match.product, 1);
        setScannerDiagnostics((prev) => ({
          ...prev,
          lastScannedCode: barcode,
          lastScanDurationMs: 18,
          averageInterCharMs: 14,
          lastScanTimestamp: new Date().toLocaleTimeString(),
          totalHardwareScans: prev.totalHardwareScans + 1,
        }));
        return true;
      } else {
        playSound('error', settings.soundEnabled);
        return false;
      }
    },
    [findVariantByBarcode, addItemToCart, settings.soundEnabled]
  );

  // Global USB Barcode Wedge Listener
  // Hardware barcode scanners (Honeywell, Zebra, Netum, Eyoyo, Datalogic) act as USB HID Keyboards.
  // They emit characters with ultra-low inter-character latency (< 40ms) followed by Enter (\r or \n).
  const bufferRef = useRef<{ char: string; timestamp: number }[]>([]);
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in a standard textarea or text input UNLESS it's the barcode test input
      const target = e.target as HTMLElement | null;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      const barcodeInputMode = target?.getAttribute('data-barcode-catcher');
      const isBarcodeSpecificInput = barcodeInputMode === 'true' || barcodeInputMode === 'gift-voucher';

      const now = performance.now();
      const delta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Reset buffer if delay was longer than threshold (e.g. 150ms)
      if (delta > 150 && bufferRef.current.length > 0) {
        bufferRef.current = [];
      }

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 3) {
          // Check inter-char timing to confirm it was a hardware scanner burst or fast entry
          const rawCode = bufferRef.current.map((item) => item.char).join('').trim();
          const scanDuration = bufferRef.current[bufferRef.current.length - 1].timestamp - bufferRef.current[0].timestamp;
          const avgDelta = scanDuration / Math.max(1, bufferRef.current.length - 1);

          // Update diagnostics
          setScannerDiagnostics((prev) => ({
            lastScannedCode: rawCode,
            lastScanDurationMs: Math.round(scanDuration),
            averageInterCharMs: Math.round(avgDelta),
            lastScanTimestamp: new Date().toLocaleTimeString(),
            totalHardwareScans: prev.totalHardwareScans + 1,
            keystrokeLog: bufferRef.current.map((k) => ({
              key: k.char,
              deltaMs: Math.round(k.timestamp - bufferRef.current[0].timestamp),
            })),
          }));

          // If on a regular non-barcode input, prevent default only if it looks like a barcode scanner burst
          if (avgDelta < settings.scannerInterCharDelayMs || isBarcodeSpecificInput || !isInput) {
            e.preventDefault();
            if (barcodeInputMode === 'gift-voucher') {
              window.dispatchEvent(new CustomEvent('pos-gift-voucher-scan', { detail: rawCode }));
            } else {
              const match = findVariantByBarcode(rawCode);
              if (match) {
                addItemToCart(match.variant, match.product, 1);
              } else {
                playSound('error', settings.soundEnabled);
              }
            }
          }

          bufferRef.current = [];
        }
      } else if (e.key.length === 1) {
        // Printable ASCII character
        bufferRef.current.push({ char: e.key, timestamp: now });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [findVariantByBarcode, addItemToCart, settings.scannerInterCharDelayMs, settings.soundEnabled]);

  // Backup & Restore
  const exportDataBackup = useCallback((): AppStateBackup => {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      products,
      transactions,
      returns,
      shifts,
      adjustments,
      expenses,
      customers,
      vouchers,
      offers,
      heldBills,
      users,
      settings,
    };
  }, [products, customers, transactions, returns, shifts, adjustments, expenses, vouchers, offers, heldBills, users, settings]);

  const importDataBackup = useCallback(
    (backup: AppStateBackup): { success: boolean; message: string } => {
      try {
        if (!backup.products || !backup.users || !backup.settings) {
          return { success: false, message: 'Invalid backup file schema: missing core entities.' };
        }
        setProducts(backup.products);
        setCustomers(backup.customers || []);
        setTransactions(backup.transactions || []);
        setReturns(backup.returns || []);
        setShifts(backup.shifts || []);
        setAdjustments(backup.adjustments || []);
        setExpenses(backup.expenses || []);
        setVouchers(backup.vouchers || []);
        setOffers(backup.offers || []);
        setHeldBills(backup.heldBills || []);
        setUsers(backup.users);
        setSettings(normalizeStoreSettings(backup.settings));
        clearCart();
        return { success: true, message: 'Database successfully restored from backup snapshot.' };
      } catch (err) {
        return { success: false, message: `Import error: ${err instanceof Error ? err.message : 'Unknown error'}` };
      }
    },
    [clearCart]
  );

  const clearAllData = useCallback(async (adminPin: string) => {
    if (!databaseReady) throw new Error('The local database is not ready. Refresh the POS and try again.');
    if (databaseWriteTimer.current !== undefined) {
      window.clearTimeout(databaseWriteTimer.current);
      databaseWriteTimer.current = undefined;
    }
    await databaseWriteQueue.current;
    const response = await fetch('/api/admin/clear-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: adminPin }),
    });
    const result = await response.json();
    if (response.status === 409) {
      setDatabaseReady(false);
      throw new Error('The database changed in another POS window. Refresh this window before clearing data.');
    }
    if (!response.ok) throw new Error(result.error || 'Could not clear the local database.');

    databaseRevision.current = result.revision;
    setProducts([]);
    setCustomers([]);
    setTransactions([]);
    setReturns([]);
    setShifts([]);
    setAdjustments([]);
    setExpenses([]);
    setVouchers([]);
    setOffers([]);
    setHeldBills([]);
    clearCart();
    setActiveReceipt(null);
  }, [databaseReady, clearCart]);

  return (
    <POSContext.Provider
      value={{
        settings,
        databaseReady,
        updateSettings,
        saveSettingsNow,
        activeUser,
        users,
        switchUserWithPin,
        switchUserById,
        addUser,
        updateUser,
        deleteUser,
        hasPermission,
        products,
        customers,
        saveCustomer,
        addProduct,
        updateProduct,
        deleteProduct,
        findVariantByBarcode,
        cart,
        addItemToCart,
        updateCartItemQuantity,
        updateCartItemDiscount,
        removeCartItem,
        clearCart,
        heldBills,
        holdCurrentBill,
        resumeHeldBill,
        deleteHeldBill,
        cartOrderDiscount,
        setCartOrderDiscount,
        customerDetails,
        setCustomerDetails,
        cartTotals,
        transactions,
        completeSale,
        voidTransaction,
        activeReceipt,
        setActiveReceipt,
        returns,
        processReturn,
        shifts,
        activeShift,
        openShift,
        closeShift,
        addCashDrop,
        adjustments,
        adjustStock,
        batchAuditCount,
        lowStockItems,
        expenses,
        addExpense,
        deleteExpense,
        vouchers,
        issueGiftVoucher,
        voidGiftVoucher,
        offers,
        addOffer,
        updateOffer,
        deleteOffer,
        scannerDiagnostics,
        simulateScan,
        exportDataBackup,
        importDataBackup,
        clearAllData,
        currentTab,
        setCurrentTab,
      }}
    >
      {children}
    </POSContext.Provider>
  );
};

export const usePOS = () => {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
};
