/**
 * Local-First Storage & Seed Engine for Garment POS
 * Manages reliable persistence in localStorage and JSON backup / restore.
 */

import {
  GarmentProduct,
  SaleTransaction,
  SaleReturn,
  CashRegisterShift,
  StockAdjustment,
  StoreExpense,
  GiftVoucher,
  BuyGetFreeOffer,
  UserAccount,
  StoreSettings,
  AppStateBackup,
} from '../types/pos';

const STORAGE_KEYS = {
  PRODUCTS: 'thread_pos_products_v1',
  TRANSACTIONS: 'thread_pos_transactions_v1',
  RETURNS: 'thread_pos_returns_v1',
  SHIFTS: 'thread_pos_shifts_v1',
  ADJUSTMENTS: 'thread_pos_adjustments_v1',
  EXPENSES: 'thread_pos_expenses_v1',
  VOUCHERS: 'thread_pos_vouchers_v1',
  OFFERS: 'thread_pos_offers_v1',
  HELD_BILLS: 'thread_pos_held_bills_v1',
  USERS: 'thread_pos_users_v1',
  SETTINGS: 'thread_pos_settings_v1',
  ACTIVE_USER: 'thread_pos_active_user_v1',
};

/** Clear this POS app's obsolete browser cache when a freshly reset database requests setup. */
export function clearLegacyBrowserPosData() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Your POS',
  legalBusinessName: '',
  registrationType: 'unregistered',
  businessSetupComplete: false,
  tagline: '',
  address: '',
  phone: '',
  taxId: '',
  stateCode: '',
  stateName: '',
  taxRateDefault: 5.0,
  priceMode: 'exclusive',
  invoicePrintFormat: 'thermal',
  currencySymbol: '₹',
  receiptFooterNote: 'Thank you for shopping with us!',
  lowStockThresholdDefault: 4,
  soundEnabled: true,
  scannerInterCharDelayMs: 45,
};

export function normalizeStoreSettings(value?: Partial<StoreSettings> | null): StoreSettings {
  const normalized = { ...DEFAULT_SETTINGS, ...(value || {}) };
  if (!['exclusive', 'inclusive'].includes(String(normalized.priceMode))) normalized.priceMode = 'exclusive';
  if (!['thermal', 'a4'].includes(String(normalized.invoicePrintFormat))) normalized.invoicePrintFormat = 'thermal';
  if (!value || value.registrationType !== undefined) return normalized;
  const isOldDemoRegistration = value.taxId === '09AAWPF4588L1ZQ';
  normalized.registrationType = value.taxId && !isOldDemoRegistration ? 'regular' : 'unregistered';
  if (isOldDemoRegistration) {
    normalized.storeName = 'Your POS';
    normalized.legalBusinessName = '';
    normalized.tagline = '';
    normalized.address = '';
    normalized.phone = '';
    normalized.taxId = '';
    normalized.stateCode = '';
    normalized.stateName = '';
    normalized.receiptFooterNote = 'Thank you for shopping with us!';
  }
  const hasShopDetails = normalized.storeName.trim().length >= 2 && normalized.address.trim().length >= 5 && /^\d{2}$/.test(normalized.stateCode || '');
  const hasRegistrationDetails = normalized.registrationType === 'unregistered'
    || (!!normalized.taxId && (normalized.legalBusinessName || '').trim().length >= 2);
  normalized.businessSetupComplete = !isOldDemoRegistration && hasShopDetails && hasRegistrationDetails;
  return normalized;
}

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'usr-1',
    name: 'Sarah Jenkins',
    username: 'sarah.owner',
    pin: '1111',
    role: 'admin',
    active: true,
  },
  {
    id: 'usr-2',
    name: 'Marcus Chen',
    username: 'marcus.inv',
    pin: '2222',
    role: 'inventory_manager',
    active: true,
  },
  {
    id: 'usr-3',
    name: 'Maya Patel',
    username: 'maya.pos',
    pin: '3333',
    role: 'cashier',
    active: true,
  },
];

export const INITIAL_PRODUCTS: GarmentProduct[] = [
  {
    id: 'prod-1',
    name: 'Oxford Cotton Button-Down',
    category: 'Shirts',
    brand: 'Atelier Threads',
    styleCode: 'OXF-101',
    gender: 'Men',
    material: '100% Combed Egyptian Cotton',
    taxRate: 5.0,
    hsnCode: '6205',
    createdAt: '2026-10-01T09:00:00Z',
    updatedAt: '2026-10-25T14:30:00Z',
    notes: 'Classic fit with button-down collar and mother-of-pearl buttons.',
    variants: [
      {
        id: 'p1-v1',
        productId: 'prod-1',
        sku: 'OXF-WHT-S',
        barcode: '8901001001',
        size: 'S',
        color: 'Crisp White',
        colorHex: '#FFFFFF',
        costPrice: 450.0,
        sellingPrice: 1299.0,
        stock: 8,
        minStockThreshold: 3,
        location: 'Rack A-1',
      },
      {
        id: 'p1-v2',
        productId: 'prod-1',
        sku: 'OXF-WHT-M',
        barcode: '8901001002',
        size: 'M',
        color: 'Crisp White',
        colorHex: '#FFFFFF',
        costPrice: 450.0,
        sellingPrice: 1299.0,
        stock: 14,
        minStockThreshold: 4,
        location: 'Rack A-1',
      },
      {
        id: 'p1-v3',
        productId: 'prod-1',
        sku: 'OXF-WHT-L',
        barcode: '8901001003',
        size: 'L',
        color: 'Crisp White',
        colorHex: '#FFFFFF',
        costPrice: 450.0,
        sellingPrice: 1299.0,
        stock: 3, // Low stock demo!
        minStockThreshold: 4,
        location: 'Rack A-1',
      },
      {
        id: 'p1-v4',
        productId: 'prod-1',
        sku: 'OXF-BLU-M',
        barcode: '8901001004',
        size: 'M',
        color: 'Sky Blue',
        colorHex: '#7BA4D5',
        costPrice: 450.0,
        sellingPrice: 1299.0,
        stock: 10,
        minStockThreshold: 4,
        location: 'Rack A-2',
      },
      {
        id: 'p1-v5',
        productId: 'prod-1',
        sku: 'OXF-BLU-L',
        barcode: '8901001005',
        size: 'L',
        color: 'Sky Blue',
        colorHex: '#7BA4D5',
        costPrice: 450.0,
        sellingPrice: 1299.0,
        stock: 7,
        minStockThreshold: 3,
        location: 'Rack A-2',
      },
    ],
  },
  {
    id: 'prod-2',
    name: 'Japanese Selvedge Denim Jeans',
    category: 'Denim',
    brand: 'Kuroki Mill',
    styleCode: 'SLV-204',
    gender: 'Men',
    material: '13.5oz Raw Selvedge Denim, 100% Cotton',
    taxRate: 5.0,
    hsnCode: '6203',
    createdAt: '2026-10-02T10:00:00Z',
    updatedAt: '2026-10-24T16:00:00Z',
    notes: 'Slim straight fit with red selvedge ID and chain-stitched hems.',
    variants: [
      {
        id: 'p2-v1',
        productId: 'prod-2',
        sku: 'SLV-IND-30',
        barcode: '8902002030',
        size: '30W 32L',
        color: 'Raw Indigo',
        colorHex: '#1B2A4A',
        costPrice: 950.0,
        sellingPrice: 2499.0,
        stock: 6,
        minStockThreshold: 2,
        location: 'Denim Bar D-1',
      },
      {
        id: 'p2-v2',
        productId: 'prod-2',
        sku: 'SLV-IND-32',
        barcode: '8902002032',
        size: '32W 32L',
        color: 'Raw Indigo',
        colorHex: '#1B2A4A',
        costPrice: 950.0,
        sellingPrice: 2499.0,
        stock: 12,
        minStockThreshold: 3,
        location: 'Denim Bar D-1',
      },
      {
        id: 'p2-v3',
        productId: 'prod-2',
        sku: 'SLV-IND-34',
        barcode: '8902002034',
        size: '34W 32L',
        color: 'Raw Indigo',
        colorHex: '#1B2A4A',
        costPrice: 950.0,
        sellingPrice: 2499.0,
        stock: 2, // Low stock demo!
        minStockThreshold: 3,
        location: 'Denim Bar D-1',
      },
      {
        id: 'p2-v4',
        productId: 'prod-2',
        sku: 'SLV-BLK-32',
        barcode: '8902002132',
        size: '32W 32L',
        color: 'Washed Black',
        colorHex: '#262626',
        costPrice: 990.0,
        sellingPrice: 2599.0,
        stock: 9,
        minStockThreshold: 3,
        location: 'Denim Bar D-2',
      },
    ],
  },
  {
    id: 'prod-3',
    name: 'Silk Blend Floral Wrap Midi Dress',
    category: 'Dresses',
    brand: 'Maison Flora',
    styleCode: 'DRS-408',
    gender: 'Women',
    material: '70% Silk, 30% Rayon',
    taxRate: 5.0,
    hsnCode: '6204',
    createdAt: '2026-10-04T11:00:00Z',
    updatedAt: '2026-10-22T12:00:00Z',
    notes: 'Flattering V-neckline with adjustable waist tie and flowy midi skirt.',
    variants: [
      {
        id: 'p3-v1',
        productId: 'prod-3',
        sku: 'DRS-TER-S',
        barcode: '8903003001',
        size: 'S',
        color: 'Terracotta Floral',
        colorHex: '#C86D51',
        costPrice: 1200.0,
        sellingPrice: 3299.0,
        stock: 5,
        minStockThreshold: 2,
        location: 'Womens Rack B-3',
      },
      {
        id: 'p3-v2',
        productId: 'prod-3',
        sku: 'DRS-TER-M',
        barcode: '8903003002',
        size: 'M',
        color: 'Terracotta Floral',
        colorHex: '#C86D51',
        costPrice: 1200.0,
        sellingPrice: 3299.0,
        stock: 8,
        minStockThreshold: 2,
        location: 'Womens Rack B-3',
      },
      {
        id: 'p3-v3',
        productId: 'prod-3',
        sku: 'DRS-TER-L',
        barcode: '8903003003',
        size: 'L',
        color: 'Terracotta Floral',
        colorHex: '#C86D51',
        costPrice: 1200.0,
        sellingPrice: 3299.0,
        stock: 1, // Alert critical!
        minStockThreshold: 3,
        location: 'Womens Rack B-3',
      },
      {
        id: 'p3-v4',
        productId: 'prod-3',
        sku: 'DRS-EMR-M',
        barcode: '8903003102',
        size: 'M',
        color: 'Emerald Print',
        colorHex: '#1B4D3E',
        costPrice: 1200.0,
        sellingPrice: 3299.0,
        stock: 7,
        minStockThreshold: 2,
        location: 'Womens Rack B-4',
      },
    ],
  },
  {
    id: 'prod-4',
    name: 'Tailored Stretch Chino Pants',
    category: 'Trousers',
    brand: 'Atelier Threads',
    styleCode: 'CHN-502',
    gender: 'Men',
    material: '97% Supima Cotton, 3% Elastane',
    taxRate: 5.0,
    hsnCode: '6203',
    createdAt: '2026-10-05T09:00:00Z',
    updatedAt: '2026-10-23T11:00:00Z',
    notes: 'Mid-rise with refined tapered leg and interior curtain waistband.',
    variants: [
      {
        id: 'p4-v1',
        productId: 'prod-4',
        sku: 'CHN-KHK-30',
        barcode: '8904004030',
        size: '30W',
        color: 'British Khaki',
        colorHex: '#B8976C',
        costPrice: 550.0,
        sellingPrice: 1599.0,
        stock: 11,
        minStockThreshold: 3,
        location: 'Trousers C-1',
      },
      {
        id: 'p4-v2',
        productId: 'prod-4',
        sku: 'CHN-KHK-32',
        barcode: '8904004032',
        size: '32W',
        color: 'British Khaki',
        colorHex: '#B8976C',
        costPrice: 550.0,
        sellingPrice: 1599.0,
        stock: 16,
        minStockThreshold: 4,
        location: 'Trousers C-1',
      },
      {
        id: 'p4-v3',
        productId: 'prod-4',
        sku: 'CHN-NAV-32',
        barcode: '8904004132',
        size: '32W',
        color: 'Midnight Navy',
        colorHex: '#152238',
        costPrice: 550.0,
        sellingPrice: 1599.0,
        stock: 9,
        minStockThreshold: 3,
        location: 'Trousers C-2',
      },
      {
        id: 'p4-v4',
        productId: 'prod-4',
        sku: 'CHN-OLV-34',
        barcode: '8904004234',
        size: '34W',
        color: 'Washed Olive',
        colorHex: '#556B2F',
        costPrice: 550.0,
        sellingPrice: 1599.0,
        stock: 4,
        minStockThreshold: 3,
        location: 'Trousers C-2',
      },
    ],
  },
  {
    id: 'prod-5',
    name: 'Heavyweight Organic Cotton Tee',
    category: 'Basics',
    brand: 'Standard Goods',
    styleCode: 'TEE-010',
    gender: 'Unisex',
    material: '240 GSM 100% Organic Ring-spun Cotton',
    taxRate: 5.0,
    hsnCode: '6109',
    createdAt: '2026-10-06T08:00:00Z',
    updatedAt: '2026-10-25T15:00:00Z',
    notes: 'Preshrunk boxy relaxed silhouette, ribbed collar with twin-needle stitching.',
    variants: [
      {
        id: 'p5-v1',
        productId: 'prod-5',
        sku: 'TEE-WHT-S',
        barcode: '8905005001',
        size: 'S',
        color: 'Pure White',
        colorHex: '#FFFFFF',
        costPrice: 250.0,
        sellingPrice: 699.0,
        stock: 22,
        minStockThreshold: 5,
        location: 'Basics Table 1',
      },
      {
        id: 'p5-v2',
        productId: 'prod-5',
        sku: 'TEE-WHT-M',
        barcode: '8905005002',
        size: 'M',
        color: 'Pure White',
        colorHex: '#FFFFFF',
        costPrice: 250.0,
        sellingPrice: 699.0,
        stock: 35,
        minStockThreshold: 8,
        location: 'Basics Table 1',
      },
      {
        id: 'p5-v3',
        productId: 'prod-5',
        sku: 'TEE-WHT-L',
        barcode: '8905005003',
        size: 'L',
        color: 'Pure White',
        colorHex: '#FFFFFF',
        costPrice: 250.0,
        sellingPrice: 699.0,
        stock: 28,
        minStockThreshold: 6,
        location: 'Basics Table 1',
      },
      {
        id: 'p5-v4',
        productId: 'prod-5',
        sku: 'TEE-BLK-M',
        barcode: '8905005102',
        size: 'M',
        color: 'Pitch Black',
        colorHex: '#121212',
        costPrice: 250.0,
        sellingPrice: 699.0,
        stock: 26,
        minStockThreshold: 6,
        location: 'Basics Table 1',
      },
      {
        id: 'p5-v5',
        productId: 'prod-5',
        sku: 'TEE-SGE-M',
        barcode: '8905005202',
        size: 'M',
        color: 'Sage Mist',
        colorHex: '#8F9779',
        costPrice: 250.0,
        sellingPrice: 699.0,
        stock: 14,
        minStockThreshold: 4,
        location: 'Basics Table 1',
      },
    ],
  },
  {
    id: 'prod-6',
    name: 'Fine Merino Wool Cardigan',
    category: 'Knitwear',
    brand: 'Highland Yarn',
    styleCode: 'CRD-330',
    gender: 'Women',
    material: '100% Extra-Fine Australian Merino Wool',
    taxRate: 5.0,
    hsnCode: '6110',
    createdAt: '2026-10-08T10:00:00Z',
    updatedAt: '2026-10-24T10:00:00Z',
    notes: 'Soft gauge knit with tortoiseshell horn buttons and ribbed cuffs.',
    variants: [
      {
        id: 'p6-v1',
        productId: 'prod-6',
        sku: 'CRD-OAT-S',
        barcode: '8906006001',
        size: 'S',
        color: 'Heather Oatmeal',
        colorHex: '#D8CFBC',
        costPrice: 1100.0,
        sellingPrice: 2899.0,
        stock: 8,
        minStockThreshold: 3,
        location: 'Knitwear Shelf 2',
      },
      {
        id: 'p6-v2',
        productId: 'prod-6',
        sku: 'CRD-OAT-M',
        barcode: '8906006002',
        size: 'M',
        color: 'Heather Oatmeal',
        colorHex: '#D8CFBC',
        costPrice: 1100.0,
        sellingPrice: 2899.0,
        stock: 6,
        minStockThreshold: 3,
        location: 'Knitwear Shelf 2',
      },
      {
        id: 'p6-v3',
        productId: 'prod-6',
        sku: 'CRD-CHR-M',
        barcode: '8906006102',
        size: 'M',
        color: 'Charcoal Fleck',
        colorHex: '#3A3A3A',
        costPrice: 1100.0,
        sellingPrice: 2899.0,
        stock: 5,
        minStockThreshold: 2,
        location: 'Knitwear Shelf 2',
      },
    ],
  },
  {
    id: 'prod-7',
    name: 'Unstructured Linen Travel Blazer',
    category: 'Outerwear',
    brand: 'Atelier Threads',
    styleCode: 'BLZ-601',
    gender: 'Men',
    material: '100% Normandy Linen with cupro sleeve lining',
    taxRate: 5.0,
    hsnCode: '6203',
    createdAt: '2026-10-09T14:00:00Z',
    updatedAt: '2026-10-21T18:00:00Z',
    notes: 'Quarter-lined breathable construction with patch pockets and double vent.',
    variants: [
      {
        id: 'p7-v1',
        productId: 'prod-7',
        sku: 'BLZ-NAT-38',
        barcode: '8907007038',
        size: '38R',
        color: 'Natural Sand',
        colorHex: '#D6C7A9',
        costPrice: 1800.0,
        sellingPrice: 4499.0,
        stock: 4,
        minStockThreshold: 2,
        location: 'Suit Rack S-1',
      },
      {
        id: 'p7-v2',
        productId: 'prod-7',
        sku: 'BLZ-NAT-40',
        barcode: '8907007040',
        size: '40R',
        color: 'Natural Sand',
        colorHex: '#D6C7A9',
        costPrice: 1800.0,
        sellingPrice: 4499.0,
        stock: 5,
        minStockThreshold: 2,
        location: 'Suit Rack S-1',
      },
      {
        id: 'p7-v3',
        productId: 'prod-7',
        sku: 'BLZ-NVY-40',
        barcode: '8907007140',
        size: '40R',
        color: 'French Navy',
        colorHex: '#1D2A44',
        costPrice: 1800.0,
        sellingPrice: 4499.0,
        stock: 2, // Low stock demo!
        minStockThreshold: 3,
        location: 'Suit Rack S-1',
      },
    ],
  },
  {
    id: 'prod-8',
    name: 'Italian Leather Dress Belt',
    category: 'Accessories',
    brand: 'Pelletteria Craft',
    styleCode: 'BLT-08',
    gender: 'Unisex',
    material: 'Full-Grain Vegetable Tanned Italian Cowhide, Solid Brass Buckle',
    taxRate: 5.0,
    hsnCode: '4203',
    createdAt: '2026-10-10T12:00:00Z',
    updatedAt: '2026-10-20T09:00:00Z',
    notes: 'Beveled and burnished edges, 32mm width.',
    variants: [
      {
        id: 'p8-v1',
        productId: 'prod-8',
        sku: 'BLT-BRN-32',
        barcode: '8908008032',
        size: '32-34',
        color: 'Cognac Brown',
        colorHex: '#7E3817',
        costPrice: 350.0,
        sellingPrice: 899.0,
        stock: 12,
        minStockThreshold: 3,
        location: 'Accessory Showcase',
      },
      {
        id: 'p8-v2',
        productId: 'prod-8',
        sku: 'BLT-BLK-34',
        barcode: '8908008134',
        size: '34-36',
        color: 'Matte Black',
        colorHex: '#1C1C1C',
        costPrice: 350.0,
        sellingPrice: 899.0,
        stock: 10,
        minStockThreshold: 3,
        location: 'Accessory Showcase',
      },
    ],
  },
];

export const INITIAL_SHIFTS: CashRegisterShift[] = [
  {
    id: 'shift-101',
    cashierId: 'usr-3',
    cashierName: 'Maya Patel',
    openedAt: '2026-10-26T08:00:00Z',
    status: 'open',
    openingFloat: 2000.0,
    cashSales: 4061.51,
    cashRefunds: 0,
    cashIn: 0,
    cashOut: 0,
    drops: [],
  },
];

export const INITIAL_TRANSACTIONS: SaleTransaction[] = [
  {
    id: 'tx-20261026-0001',
    receiptNumber: 'REC-20261026-0001',
    timestamp: '2026-10-26T08:35:12Z',
    cashierId: 'usr-3',
    cashierName: 'Maya Patel',
    customerName: 'Rohit Sharma',
    customerPhone: '+91 98371 44552',
    shiftId: 'shift-101',
    items: [
      {
        variantId: 'p1-v2',
        productId: 'prod-1',
        productName: 'Oxford Cotton Button-Down',
        sku: 'OXF-WHT-M',
        barcode: '8901001002',
        hsnCode: '6205',
        size: 'M',
        color: 'Crisp White',
        unitPrice: 1299.0,
        unitCost: 450.0,
        quantity: 1,
        discountType: 'fixed',
        discountValue: 0,
        lineTotal: 1299.0,
        taxAmount: 64.95,
        cgstAmount: 32.48,
        sgstAmount: 32.47,
      },
      {
        variantId: 'p5-v2',
        productId: 'prod-5',
        productName: 'Heavyweight Organic Cotton Tee',
        sku: 'TEE-WHT-M',
        barcode: '8905005002',
        hsnCode: '6109',
        size: 'M',
        color: 'Pure White',
        unitPrice: 699.0,
        unitCost: 250.0,
        quantity: 2,
        discountType: 'fixed',
        discountValue: 0,
        lineTotal: 1398.0,
        taxAmount: 69.9,
        cgstAmount: 34.95,
        sgstAmount: 34.95,
      },
    ],
    subtotal: 2697.0,
    discountTotal: 0,
    taxTotal: 134.85,
    grandTotal: 2831.85,
    payments: [
      {
        method: 'card',
        amount: 2831.85,
        reference: 'AUTH-94821',
      },
    ],
    changeGiven: 0,
    status: 'completed',
    notes: 'Customer inquired about upcoming festive wedding collection.',
  },
  {
    id: 'tx-20261026-0002',
    receiptNumber: 'REC-20261026-0002',
    timestamp: '2026-10-26T09:15:40Z',
    cashierId: 'usr-3',
    cashierName: 'Maya Patel',
    customerName: 'Ananya Verma',
    shiftId: 'shift-101',
    items: [
      {
        variantId: 'p3-v2',
        productId: 'prod-3',
        productName: 'Silk Blend Floral Wrap Midi Dress',
        sku: 'DRS-TER-M',
        barcode: '8903003002',
        hsnCode: '6204',
        size: 'M',
        color: 'Terracotta Floral',
        unitPrice: 3299.0,
        unitCost: 1200.0,
        quantity: 1,
        discountType: 'percentage',
        discountValue: 10, // 10% promo
        lineTotal: 2969.1,
        taxAmount: 148.46,
        cgstAmount: 74.23,
        sgstAmount: 74.23,
      },
      {
        variantId: 'p8-v1',
        productId: 'prod-8',
        productName: 'Italian Leather Dress Belt',
        sku: 'BLT-BRN-32',
        barcode: '8908008032',
        hsnCode: '4203',
        size: '32-34',
        color: 'Cognac Brown',
        unitPrice: 899.0,
        unitCost: 350.0,
        quantity: 1,
        discountType: 'fixed',
        discountValue: 0,
        lineTotal: 899.0,
        taxAmount: 44.95,
        cgstAmount: 22.48,
        sgstAmount: 22.47,
      },
    ],
    subtotal: 4198.0,
    orderDiscountType: 'fixed',
    orderDiscountValue: 0,
    discountTotal: 329.9,
    taxTotal: 193.41,
    grandTotal: 4061.51,
    payments: [
      {
        method: 'cash',
        amount: 4500.0,
      },
    ],
    changeGiven: 438.49,
    status: 'completed',
  },
];

export const INITIAL_EXPENSES: StoreExpense[] = [
  {
    id: 'exp-1',
    date: '2026-10-24',
    category: 'Packaging & Bags',
    description: 'Luxury Kraft Paper Bags & Branded Garment Covers (500 units)',
    amount: 1800.0,
    paymentMethod: 'Bank Transfer',
    receiptRef: 'INV-PKG-992',
    recordedBy: 'Sarah Jenkins',
  },
  {
    id: 'exp-2',
    date: '2026-10-25',
    category: 'Store Maintenance',
    description: 'Industrial garment steamer service and fitting room LED spotlights',
    amount: 650.0,
    paymentMethod: 'Cash',
    receiptRef: 'PETTY-041',
    recordedBy: 'Marcus Chen',
  },
];

export const INITIAL_ADJUSTMENTS: StockAdjustment[] = [
  {
    id: 'adj-1',
    timestamp: '2026-10-25T14:30:00Z',
    variantId: 'p1-v2',
    productId: 'prod-1',
    productName: 'Oxford Cotton Button-Down',
    sku: 'OXF-WHT-M',
    barcode: '8901001002',
    size: 'M',
    color: 'Crisp White',
    changeQty: 10,
    previousStock: 4,
    newStock: 14,
    type: 'restock',
    reason: 'Received supplier shipment PO #2026-10B',
    userId: 'usr-2',
    userName: 'Marcus Chen',
  },
];

// Helper functions for reading/writing localStorage
export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving to localStorage key "${key}":`, err);
  }
}

/** Remove legacy plaintext PINs from the browser cache after server-side PIN hashing is enabled. */
export function scrubLegacyBrowserPins() {
  const users = loadFromStorage<UserAccount[]>(STORAGE_KEYS.USERS, []);
  if (users.length) saveToStorage(STORAGE_KEYS.USERS, users.map(({ pin: _pin, ...user }) => ({ ...user, pin: '' })));
  const active = loadFromStorage<UserAccount | null>(STORAGE_KEYS.ACTIVE_USER, null);
  if (active) {
    const { pin: _pin, ...user } = active;
    saveToStorage(STORAGE_KEYS.ACTIVE_USER, { ...user, pin: '' });
  }
}

export function initLocalStorage(): void {
  const existingProducts = loadFromStorage<GarmentProduct[] | null>(STORAGE_KEYS.PRODUCTS, null);
  if (
    !existingProducts ||
    existingProducts.length === 0 ||
    (existingProducts[0].variants[0]?.sellingPrice && existingProducts[0].variants[0].sellingPrice < 200)
  ) {
    saveToStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    saveToStorage(STORAGE_KEYS.SHIFTS, INITIAL_SHIFTS);
    saveToStorage(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
    saveToStorage(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    saveToStorage(STORAGE_KEYS.USERS, INITIAL_USERS);
  }
  const existingSettings = loadFromStorage<StoreSettings | null>(STORAGE_KEYS.SETTINGS, null);
  if (!existingSettings) {
    saveToStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  } else if (!existingSettings.storeName || existingSettings.currencySymbol !== '₹') {
    saveToStorage(STORAGE_KEYS.SETTINGS, {
      ...existingSettings,
      storeName: existingSettings.storeName || 'Your POS',
      tagline: existingSettings.tagline || '',
      address: existingSettings.address || '',
      phone: existingSettings.phone || '',
      taxId: existingSettings.taxId || '',
      stateCode: existingSettings.stateCode || '',
      stateName: existingSettings.stateName || '',
      registrationType: existingSettings.registrationType || 'unregistered',
      businessSetupComplete: existingSettings.businessSetupComplete ?? false,
      currencySymbol: '₹',
      receiptFooterNote: existingSettings.receiptFooterNote || 'Thank you for shopping with us!',
    });
  }

  // Ensure existing products have valid Indian Garment HSN codes
  if (existingProducts && existingProducts.length > 0) {
    const defaultHsnMap: Record<string, string> = {
      Shirts: '6205',
      Denim: '6203',
      Trousers: '6203',
      Dresses: '6204',
      Basics: '6109',
      Knitwear: '6110',
      Outerwear: '6203',
      Accessories: '4203',
    };

    let needsProductMigration = false;
    const migratedProducts = existingProducts.map((p) => {
      if (!p.hsnCode) {
        needsProductMigration = true;
        return {
          ...p,
          hsnCode: defaultHsnMap[p.category] || '6205',
        };
      }
      return p;
    });

    if (needsProductMigration) {
      saveToStorage(STORAGE_KEYS.PRODUCTS, migratedProducts);
    }
  }

  // Ensure existing transactions have HSN codes and CGST/SGST breakdowns
  const existingTransactions = loadFromStorage<SaleTransaction[] | null>(STORAGE_KEYS.TRANSACTIONS, null);
  if (existingTransactions && existingTransactions.length > 0) {
    let needsTxMigration = false;
    const migratedTransactions = existingTransactions.map((tx) => {
      const updatedItems = tx.items.map((item) => {
        if (!item.hsnCode || item.cgstAmount === undefined || item.sgstAmount === undefined) {
          needsTxMigration = true;
          const halfTax = Number((item.taxAmount / 2).toFixed(2));
          return {
            ...item,
            hsnCode: item.hsnCode || '6205',
            cgstAmount: halfTax,
            sgstAmount: Number((item.taxAmount - halfTax).toFixed(2)),
          };
        }
        return item;
      });
      return { ...tx, items: updatedItems };
    });

    if (needsTxMigration) {
      saveToStorage(STORAGE_KEYS.TRANSACTIONS, migratedTransactions);
    }
  }
  if (!localStorage.getItem(STORAGE_KEYS.SHIFTS)) {
    saveToStorage(STORAGE_KEYS.SHIFTS, INITIAL_SHIFTS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
    saveToStorage(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.EXPENSES)) {
    saveToStorage(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.ADJUSTMENTS)) {
    saveToStorage(STORAGE_KEYS.ADJUSTMENTS, INITIAL_ADJUSTMENTS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.RETURNS)) {
    saveToStorage(STORAGE_KEYS.RETURNS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.VOUCHERS)) saveToStorage<GiftVoucher[]>(STORAGE_KEYS.VOUCHERS, []);
  if (!localStorage.getItem(STORAGE_KEYS.OFFERS)) saveToStorage<BuyGetFreeOffer[]>(STORAGE_KEYS.OFFERS, []);
  if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_USER)) {
    saveToStorage(STORAGE_KEYS.ACTIVE_USER, INITIAL_USERS[0]);
  }
}

export { STORAGE_KEYS };
