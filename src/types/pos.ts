/**
 * Core type definitions for Garment POS & Inventory System
 */

export interface GarmentVariant {
  id: string;
  productId: string;
  sku: string;
  barcode: string;
  size: string; // e.g. XS, S, M, L, XL, XXL, 30, 32, 34, 36
  color: string; // e.g. Navy Blue, Heather Grey, White, Crimson
  colorHex?: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStockThreshold: number;
  location?: string; // e.g. Rack A-1, Shelf 3
}

export interface GarmentProduct {
  id: string;
  name: string;
  category: 'Shirts' | 'Trousers' | 'Denim' | 'Dresses' | 'Knitwear' | 'Outerwear' | 'Basics' | 'Accessories';
  brand: string;
  styleCode: string;
  gender: 'Men' | 'Women' | 'Unisex' | 'Kids';
  material: string;
  taxRate: number; // default tax rate e.g. 5.0 for 5% GST
  hsnCode: string; // Indian GST HSN Code e.g. 6205, 6203, 6109, 6204
  variants: GarmentVariant[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** A repeating offer pool: when buyQuantity + freeQuantity eligible units are in the cart,
 * freeQuantity units are discounted in full, beginning with the lowest-priced units. */
export interface BuyGetFreeOffer {
  id: string;
  name: string;
  productIds: string[];
  /** Missing type on older saved offers is treated as buy_get_free. */
  type?: 'buy_get_free' | 'discount' | 'spend_reward';
  /** Missing scope on older saved offers is treated as selected products. */
  scope?: 'store' | 'products' | 'categories';
  /** Whole product categories covered by a category-scoped offer. */
  categories?: GarmentProduct['category'][];
  buyQuantity: number;
  freeQuantity: number;
  discountType?: 'percentage' | 'fixed';
  /** Percentage, or currency amount per eligible garment for fixed discounts. */
  discountValue?: number;
  /** Final sale total required to earn an item supplied by a partner business. */
  minimumPurchase?: number;
  rewardItemName?: string;
  rewardPartnerName?: string;
  rewardInstructions?: string;
  startsOn: string;
  endsOn: string;
  active: boolean;
  createdAt: string;
  createdBy: string;
}

export interface PartnerRewardSnapshot {
  offerId: string;
  offerName: string;
  minimumPurchase: number;
  itemName: string;
  partnerName: string;
  instructions?: string;
}

export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  hsnCode?: string;
  size: string;
  color: string;
  colorHex?: string;
  unitPrice: number;
  unitCost: number;
  quantity: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  taxRate: number;
  stockAvailable: number;
}

export interface HeldBill {
  id: string;
  heldAt: string;
  heldBy: string;
  cart: CartItem[];
  cartOrderDiscount: { type: 'percentage' | 'fixed'; value: number };
  customerDetails: { name: string; phone: string; notes: string; gstin: string; address: string; stateCode: string; customerId?: string };
}

export interface CustomerRecord {
  id: string;
  name?: string;
  phone?: string;
  gstin?: string;
  address?: string;
  stateCode?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentBreakdown {
  method: 'cash' | 'card' | 'upi' | 'store_credit' | 'gift_voucher';
  amount: number;
  reference?: string; // Terminal auth ref or UPI transaction ID
}

export interface SaleItemRecord {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  hsnCode?: string;
  size: string;
  color: string;
  unitPrice: number;
  unitCost: number;
  quantity: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  lineTotal: number;
  /** Taxable value after item and allocated order discounts. */
  taxableValue?: number;
  /** Effective tax rate snapshotted at sale time. */
  taxRate?: number;
  taxAmount: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  offerFreeQuantity?: number;
  offerDiscount?: number;
  offerNames?: string[];
}

export interface SaleTransaction {
  id: string;
  receiptNumber: string;
  timestamp: string;
  cashierId: string;
  cashierName: string;
  customerName?: string;
  customerId?: string;
  customerPhone?: string;
  customerGstin?: string;
  customerAddress?: string;
  placeOfSupplyStateCode?: string;
  placeOfSupplyStateName?: string;
  isInterState?: boolean;
  items: SaleItemRecord[];
  subtotal: number;
  orderDiscountType?: 'percentage' | 'fixed';
  orderDiscountValue?: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  priceMode?: 'exclusive' | 'inclusive';
  invoicePrintFormat?: 'thermal' | 'a4';
  payments: PaymentBreakdown[];
  changeGiven: number;
  status: 'completed' | 'refunded' | 'partially_refunded' | 'voided';
  shiftId: string;
  notes?: string;
  /** External partner reward earned on this sale; not included in POS money or stock totals. */
  partnerReward?: PartnerRewardSnapshot;
}

export interface ReturnItemRecord {
  variantId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  refundAmount: number;
  taxableRefundAmount?: number;
  taxRefundAmount?: number;
  cgstRefundAmount?: number;
  sgstRefundAmount?: number;
  igstRefundAmount?: number;
  condition: 'resalable' | 'damaged' | 'defective';
  restocked: boolean;
}

export interface SaleReturn {
  id: string;
  originalSaleId: string;
  originalReceiptNumber: string;
  returnReceiptNumber: string;
  timestamp: string;
  cashierId: string;
  cashierName: string;
  customerName?: string;
  returnedItems: ReturnItemRecord[];
  totalRefundAmount: number;
  refundMethod: 'cash' | 'card' | 'upi' | 'store_credit';
  giftVoucherCode?: string;
  reason: string;
}

export interface GiftVoucher {
  id: string;
  code: string;
  createdAt: string;
  initialValue: number;
  balance: number;
  customerName?: string;
  sourceReturnId?: string;
  note: string;
  issuedBy: string;
  status: 'active' | 'redeemed' | 'void';
}

export interface CashDropRecord {
  id: string;
  timestamp: string;
  amount: number;
  type: 'in' | 'out'; // 'in' = cash float added, 'out' = cash drop to safe or petty cash expense
  note: string;
  authorizedBy: string;
}

export interface CashRegisterShift {
  id: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  status: 'open' | 'closed';
  openingFloat: number;
  cashSales: number;
  cashRefunds: number;
  cashIn: number;
  cashOut: number;
  drops: CashDropRecord[];
  expectedClosingCash?: number;
  actualClosingCash?: number;
  discrepancy?: number;
  closeNote?: string;
}

export interface StockAdjustment {
  id: string;
  timestamp: string;
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  size: string;
  color: string;
  changeQty: number; // positive = increase, negative = decrease
  previousStock: number;
  newStock: number;
  type: 'restock' | 'damage' | 'shrinkage' | 'audit_correction' | 'return_restock' | 'manual';
  reason: string;
  userId: string;
  userName: string;
}

export interface StoreExpense {
  id: string;
  date: string;
  category: 'Rent' | 'Utilities' | 'Packaging & Bags' | 'Staff Wages' | 'Alteration Services' | 'Store Maintenance' | 'Marketing' | 'Supplies' | 'Other';
  description: string;
  amount: number;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'Card' | 'Cheque';
  receiptRef?: string;
  recordedBy: string;
}

export type UserRole = 'admin' | 'inventory_manager' | 'cashier';

import type { Permission } from '../utils/permissions';

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  pin: string; // 4-digit PIN for quick terminal access
  role: UserRole;
  active: boolean;
  /** Optional per-user grants; omitted permissions inherit defaults from the assigned role. */
  permissions?: Permission[];
}

export interface StoreSettings {
  storeName: string;
  legalBusinessName?: string;
  registrationType?: 'unregistered' | 'regular' | 'composition';
  businessSetupComplete?: boolean;
  tagline: string;
  address: string;
  phone: string;
  taxId: string; // GSTIN from the shop's registration certificate
  stateCode?: string; // e.g. '09' for Uttar Pradesh
  stateName?: string; // e.g. 'Uttar Pradesh'
  taxRateDefault: number;
  /** Whether sellingPrice is tax-exclusive (legacy/default) or GST-inclusive. */
  priceMode?: 'exclusive' | 'inclusive';
  /** Preferred layout for the saved sale invoice. */
  invoicePrintFormat?: 'thermal' | 'a4';
  currencySymbol: string;
  receiptFooterNote: string;
  lowStockThresholdDefault: number;
  soundEnabled: boolean;
  scannerInterCharDelayMs: number; // max ms between keystrokes to consider USB scanner (default 45ms)
}

export interface AppStateBackup {
  version: string;
  exportedAt: string;
  products: GarmentProduct[];
  transactions: SaleTransaction[];
  returns: SaleReturn[];
  shifts: CashRegisterShift[];
  adjustments: StockAdjustment[];
  expenses: StoreExpense[];
  vouchers: GiftVoucher[];
  offers: BuyGetFreeOffer[];
  heldBills?: HeldBill[];
  customers?: CustomerRecord[];
  users: UserAccount[];
  settings: StoreSettings;
}
