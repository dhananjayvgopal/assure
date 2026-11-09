/**
 * High-Speed Garment POS Register View
 * Optimized for physical USB barcode scanning, quick touch variant selection,
 * stock limit validation, and streamlined checkout.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import { garmentColorHex } from '../../utils/garmentColor';
import { formatDateTimeDisplay } from '../../utils/dateFormat';
import { GarmentProduct, GarmentVariant } from '../../types/pos';
import {
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  Tag,
  CreditCard,
  User,
  ShoppingBag,
  AlertCircle,
  Check,
  Percent,
  X,
  Pause,
  Printer,
  RotateCcw,
  Trash,
  Camera,
} from 'lucide-react';

interface CheckoutViewProps {
  onOpenPaymentModal: () => void;
  onOpenShiftModal: () => void;
  onOpenEstimateModal: () => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  onOpenPaymentModal,
  onOpenShiftModal,
  onOpenEstimateModal,
}) => {
  const {
    products,
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
    customers,
    saveCustomer,
    cartTotals,
    activeShift,
    findVariantByBarcode,
    settings,
  } = usePOS();

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [showHeldBills, setShowHeldBills] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');

  // Multi-variant selection modal
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<GarmentProduct | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // Quick line discount editing state
  const [editingDiscountVariantId, setEditingDiscountVariantId] = useState<string | null>(null);
  const [discountValInput, setDiscountValInput] = useState<number>(0);
  const [discountTypeInput, setDiscountTypeInput] = useState<'percentage' | 'fixed'>('percentage');

  // Input ref for barcode focus
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const cameraCaptureInputRef = useRef<HTMLInputElement>(null);
  const [cameraScanBusy, setCameraScanBusy] = useState(false);
  const [cameraScanMessage, setCameraScanMessage] = useState('');

  // Auto-focus barcode input on mount and after cart changes
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, [cart.length]);

  // Handle direct barcode search / scan submit
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    // Direct barcode or SKU lookup
    const match = findVariantByBarcode(query);
    if (match) {
      const added = addItemToCart(match.variant, match.product, 1);
      if (added) {
        setSearchQuery('');
      }
    }
  };

  // On mobile, let the device camera capture a barcode image, then decode it locally.
  const handleCameraCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setCameraScanBusy(true);
    setCameraScanMessage('Reading barcode…');
    try {
      const image = new Image();
      image.src = imageUrl;
      await image.decode();
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const result = await new BrowserMultiFormatReader().decodeFromImageElement(image);
      const code = result.getText().trim();
      const match = findVariantByBarcode(code);
      if (!match) {
        setSearchQuery(code);
        setCameraScanMessage(`Scanned ${code}, but it is not in the product catalog.`);
        return;
      }

      const added = addItemToCart(match.variant, match.product, 1);
      setCameraScanMessage(added ? `Added ${match.product.name} to the sale.` : `${match.product.name} could not be added. Check its stock.`);
      if (added) setSearchQuery('');
    } catch {
      setCameraScanMessage('Could not read that image. Hold the barcode flat, fill the frame, and try again.');
    } finally {
      URL.revokeObjectURL(imageUrl);
      input.value = '';
      setCameraScanBusy(false);
    }
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((prod) => {
      // Category filter
      if (selectedCategory !== 'all' && prod.category !== selectedCategory) return false;
      // Gender filter
      if (selectedGender !== 'all' && prod.gender !== selectedGender) return false;

      // Text search
      if (!q) return true;
      const matchName = prod.name.toLowerCase().includes(q);
      const matchBrand = prod.brand.toLowerCase().includes(q);
      const matchStyle = prod.styleCode.toLowerCase().includes(q);
      const matchVariant = prod.variants.some(
        (v) =>
          v.sku.toLowerCase().includes(q) ||
          v.barcode.includes(q) ||
          v.color.toLowerCase().includes(q) ||
          v.size.toLowerCase().includes(q)
      );
      return matchName || matchBrand || matchStyle || matchVariant;
    });
  }, [products, searchQuery, selectedCategory, selectedGender]);

  const categories = ['all', 'Shirts', 'Trousers', 'Denim', 'Dresses', 'Knitwear', 'Outerwear', 'Basics', 'Accessories'];
  const genders = ['all', 'Men', 'Women', 'Unisex'];

  // Handle clicking a garment card
  const handleProductCardClick = (prod: GarmentProduct) => {
    if (prod.variants.length === 1) {
      // Single variant product -> add directly
      addItemToCart(prod.variants[0], prod, 1);
    } else {
      // Multi-variant -> open variant selector
      setSelectedProductForVariant(prod);
      // Select first in-stock variant by default
      const inStock = prod.variants.find((v) => v.stock > 0) || prod.variants[0];
      setSelectedVariantId(inStock ? inStock.id : null);
    }
  };

  // Add selected variant from modal
  const handleConfirmVariantAdd = () => {
    if (!selectedProductForVariant || !selectedVariantId) return;
    const variant = selectedProductForVariant.variants.find((v) => v.id === selectedVariantId);
    if (variant) {
      addItemToCart(variant, selectedProductForVariant, 1);
    }
    setSelectedProductForVariant(null);
    setSelectedVariantId(null);
    barcodeInputRef.current?.focus();
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-61px)] bg-stone-100 overflow-hidden">
      {/* LEFT COLUMN: Garment Catalog & Fast Barcode Scanning (65% width on desktop) */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-stone-200 bg-white">
        {/* Register Shift Alert Banner if shift is closed */}
        {!activeShift && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-amber-900 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Register shift is currently <strong>closed</strong>. You must open a shift with an initial cash float before ringing up sales.
              </span>
            </div>
            <button
              onClick={onOpenShiftModal}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded text-xs transition-colors cursor-pointer shrink-0"
            >
              Open Register Shift
            </button>
          </div>
        )}

        {/* Top Control Bar: Barcode Scanner Input & Quick Filters */}
        <div className="p-4 border-b border-stone-200 bg-white space-y-3">
          <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                <Barcode className="w-4 h-4" />
              </div>
              <input
                ref={barcodeInputRef}
                type="text"
                data-barcode-catcher="true"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan barcode tag with USB scanner or search by garment name / SKU / color..."
                className="w-full pl-9 pr-8 py-2 text-sm bg-stone-50 border border-stone-300 rounded focus:bg-white focus:outline-hidden focus:border-stone-800 transition-colors font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-stone-400 hover:text-stone-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 rounded transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Scan / Find</span>
            </button>
            <button
              type="button"
              onClick={() => cameraCaptureInputRef.current?.click()}
              disabled={cameraScanBusy}
              className="px-3 py-2 text-xs font-semibold bg-amber-400 text-stone-950 hover:bg-amber-300 disabled:opacity-60 rounded transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              aria-label="Scan barcode with camera"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">{cameraScanBusy ? 'Reading…' : 'Camera'}</span>
            </button>
            <input
              ref={cameraCaptureInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraCapture}
              className="hidden"
              aria-label="Take a barcode photo"
            />
          </form>
          {cameraScanMessage && <p className="text-xs text-stone-600" role="status">{cameraScanMessage} The image is read on this device.</p>}

          {/* Category Filter Pills (Functional button controls) */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-stone-400 text-[11px] font-medium mr-1 uppercase tracking-wider">Dept:</span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer shrink-0 capitalize ${
                    selectedCategory === cat
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                  }`}
                >
                  {cat === 'all' ? 'All Garments' : cat}
                </button>
              ))}
            </div>

            {/* Gender filter */}
            <div className="hidden sm:flex items-center gap-1 shrink-0 pl-2 border-l border-stone-200">
              {genders.map((gen) => (
                <button
                  key={gen}
                  onClick={() => setSelectedGender(gen)}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                    selectedGender === gen
                      ? 'bg-stone-800 text-amber-400'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {gen}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-stone-50/50">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-stone-400">
              <Barcode className="w-12 h-12 stroke-[1.2] mb-3 text-stone-300" />
              <p className="text-sm font-medium text-stone-600">No matching garments found</p>
              <p className="text-xs text-stone-400 mt-1">
                Try scanning another tag or checking the search query.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((prod) => {
                const totalStock = prod.variants.reduce((sum, v) => sum + v.stock, 0);
                const isOutOfStock = totalStock <= 0;
                const minPrice = Math.min(...prod.variants.map((v) => v.sellingPrice));
                const maxPrice = Math.max(...prod.variants.map((v) => v.sellingPrice));
                const priceLabel =
                  minPrice === maxPrice
                    ? `${settings.currencySymbol}${minPrice.toFixed(2)}`
                    : `${settings.currencySymbol}${minPrice.toFixed(2)} - ${settings.currencySymbol}${maxPrice.toFixed(2)}`;
                const priceLabelWithTaxMode = priceLabel + (settings.registrationType === 'regular' && settings.priceMode === 'inclusive' ? ' incl. GST' : '');

                // Extract unique colors & sizes
                const colorVariants = Array.from(new Map(prod.variants.map((v) => [v.color.trim().toLowerCase(), v])).values());

                return (
                  <button
                    key={prod.id}
                    onClick={() => handleProductCardClick(prod)}
                    disabled={isOutOfStock}
                    className={`text-left p-3.5 bg-white border rounded transition-all flex flex-col justify-between group cursor-pointer relative ${
                      isOutOfStock
                        ? 'opacity-50 cursor-not-allowed border-stone-200'
                        : 'border-stone-200 hover:border-stone-400 hover:shadow-xs active:scale-[0.99]'
                    }`}
                  >
                    <div>
                      {/* Brand & Style Code */}
                      <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                        <span className="truncate">{prod.brand}</span>
                        <span className="font-mono text-[10px] text-stone-400">{prod.styleCode}</span>
                      </div>

                      {/* Product Name */}
                      <h4 className="font-semibold text-sm text-stone-900 leading-snug line-clamp-2 mb-2">
                        {prod.name}
                      </h4>

                      {/* Clean Unboxed Metadata: Category · Gender · Material */}
                      <div className="text-[11px] text-stone-500 mb-2 truncate">
                        <span>{prod.category}</span>
                        <span aria-hidden="true" className="mx-1">·</span>
                        <span>{prod.gender}</span>
                      </div>

                      {/* Variant Swatches Preview */}
                      <div className="flex items-center gap-1 mb-3 flex-wrap">
                        {colorVariants.slice(0, 5).map((v) => (
                          <div
                            key={v.id}
                            className="w-3.5 h-3.5 rounded-full border border-stone-300 shrink-0"
                            style={{ backgroundColor: garmentColorHex(v.color, v.colorHex, '#ccc') }}
                            title={`${v.color} · ${prod.variants.filter((item) => item.color.trim().toLowerCase() === v.color.trim().toLowerCase()).length} size variant(s)`}
                          />
                        ))}
                        {colorVariants.length > 5 && (
                          <span className="text-[10px] text-stone-400 font-mono">
                            +{colorVariants.length - 5} colors
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price & Stock Footer */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-stone-900 tabular-nums">
                      {priceLabelWithTaxMode}
                      </span>
                      <span
                        className={`text-[11px] font-mono tabular-nums ${
                          isOutOfStock
                            ? 'text-rose-600 font-semibold'
                            : totalStock <= 5
                            ? 'text-amber-600 font-medium'
                            : 'text-stone-500'
                        }`}
                      >
                        {isOutOfStock ? 'Sold out' : `${totalStock} in stock`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Active Cart Register & Totals (35% width on desktop) */}
      <div className="w-full lg:w-[420px] xl:w-[460px] flex flex-col bg-stone-50 border-t lg:border-t-0 lg:border-l border-stone-200">
        {/* Cart Header */}
        <div className="px-5 py-3.5 bg-white border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-stone-700" />
            <h3 className="font-bold text-sm text-stone-900">Current Sale</h3>
            <span className="text-xs font-mono text-stone-500">
              ({cartTotals.itemCount} {cartTotals.itemCount === 1 ? 'item' : 'items'})
            </span>
          </div>
          {cart.length > 0 && (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setShowHeldBills((value) => !value)} className="text-[11px] text-amber-800 font-semibold hover:underline">Held bills ({heldBills.length})</button>
              <button
                onClick={() => {
                  if (window.confirm('Clear all items from current cart?')) clearCart();
                }}
                className="text-[11px] text-stone-500 hover:text-rose-600 transition-colors cursor-pointer"
              >Clear Cart</button>
            </div>
          )}
          {cart.length === 0 && <button type="button" onClick={() => setShowHeldBills((value) => !value)} className="text-[11px] text-amber-800 font-semibold hover:underline">Held bills ({heldBills.length})</button>}
        </div>

        {showHeldBills && <section className="bg-amber-50 border-b border-amber-200 p-3 max-h-60 overflow-auto" aria-label="Held bills">
          <div className="flex items-center justify-between mb-2"><strong className="text-xs">Held bills</strong><button type="button" onClick={() => setShowHeldBills(false)} className="text-xs underline">Close</button></div>
          {!heldBills.length && <p className="text-xs text-stone-600">No held bills. Hold an unpaid cart to serve another customer.</p>}
          <div className="space-y-2">{heldBills.map((bill) => <div key={bill.id} className="bg-white border border-amber-200 rounded p-2 text-xs">
            <div className="flex justify-between gap-2"><strong>{bill.customerDetails.name || 'Walk-in customer'}</strong><span>{bill.cart.reduce((sum, item) => sum + item.quantity, 0)} item(s)</span></div>
            <div className="text-[10px] text-stone-500">Held by {bill.heldBy} · {formatDateTimeDisplay(bill.heldAt)}</div>
            <div className="text-[10px] text-stone-600 truncate">{bill.cart.map((item) => `${item.productName} ×${item.quantity}`).join(', ')}</div>
            <div className="flex gap-3 mt-1.5"><button type="button" onClick={() => { if (resumeHeldBill(bill.id)) setShowHeldBills(false); }} className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline"><RotateCcw className="w-3 h-3" />Resume</button><button type="button" onClick={() => deleteHeldBill(bill.id)} className="inline-flex items-center gap-1 text-rose-700 underline"><Trash className="w-3 h-3" />Delete</button></div>
          </div>)}</div>
        </section>}

        {/* Customer Information (Optional loyalty / tag) */}
        <div className="px-5 py-2.5 bg-stone-100/70 border-b border-stone-200 text-xs flex gap-2 items-center">
          <User className="w-3.5 h-3.5 text-stone-500 shrink-0" />
          <select aria-label="Find saved customer" value={customerDetails.customerId || ''} onChange={(e) => {
            const customer = customers.find((item) => item.id === e.target.value);
            if (!customer) { setCustomerDetails({ ...customerDetails, customerId: '' }); return; }
            setCustomerDetails({ name: customer.name || '', phone: customer.phone || '', gstin: customer.gstin || '', address: customer.address || '', stateCode: customer.stateCode || '', notes: customer.notes || '', customerId: customer.id });
          }} className="max-w-32 bg-white border border-stone-200 rounded px-1 py-1 text-[10px] text-stone-700">
            <option value="">Find customer…</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name || customer.phone || customer.gstin || 'Saved customer'}</option>)}
          </select>
          <input
            type="text"
            value={customerDetails.name}
            onChange={(e) => setCustomerDetails({ ...customerDetails, name: e.target.value })}
            placeholder="Customer name (optional)"
            className="flex-1 bg-transparent border-none text-xs focus:outline-hidden text-stone-800 placeholder-stone-400"
          />
          <input
            type="text"
            value={customerDetails.phone}
            onChange={(e) => setCustomerDetails({ ...customerDetails, phone: e.target.value })}
            placeholder="Phone #"
            className="w-24 bg-transparent border-none text-xs focus:outline-hidden text-stone-800 placeholder-stone-400 font-mono"
          />
          <button type="button" onClick={() => {
            const saved = saveCustomer({ id: customerDetails.customerId || undefined, name: customerDetails.name, phone: customerDetails.phone, gstin: customerDetails.gstin, address: customerDetails.address, stateCode: customerDetails.stateCode, notes: customerDetails.notes });
            if (saved) setCustomerDetails({ ...customerDetails, customerId: saved.id });
          }} className="shrink-0 rounded border border-stone-300 bg-white px-2 py-1 text-[10px] font-medium text-stone-700 hover:bg-amber-50" title="Save or update customer">Save</button>
        </div>
        {(settings.registrationType || (settings.taxId ? 'regular' : 'unregistered')) !== 'unregistered' && <div className="px-5 py-2 bg-stone-50 border-b border-stone-200 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            value={customerDetails.gstin}
            onChange={(e) => setCustomerDetails({ ...customerDetails, gstin: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15) })}
            placeholder="Customer GSTIN (optional)"
            maxLength={15}
            className="px-2 py-1 border border-stone-200 rounded text-[11px] font-mono uppercase"
            aria-label="Customer GSTIN"
          />
          <input
            type="text"
            value={customerDetails.address}
            onChange={(e) => setCustomerDetails({ ...customerDetails, address: e.target.value })}
            placeholder="Customer address (optional)"
            className="px-2 py-1 border border-stone-200 rounded text-[11px]"
            aria-label="Customer address"
          />
          <input
            type="text"
            value={customerDetails.stateCode}
            onChange={(e) => setCustomerDetails({ ...customerDetails, stateCode: e.target.value.replace(/\D/g, '').slice(0, 2) })}
            placeholder="Customer state code (optional)"
            maxLength={2}
            className="px-2 py-1 border border-stone-200 rounded text-[11px] font-mono"
            aria-label="Place of supply state code"
          />
        </div>}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-stone-400 text-center">
              <ShoppingBag className="w-8 h-8 stroke-[1.2] mb-2 text-stone-300" />
              <p className="text-xs font-medium text-stone-600">Cart is empty</p>
              <p className="text-[11px] text-stone-400 mt-1 max-w-[200px]">
                Scan a barcode tag with your USB scanner or click any garment card to begin.
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const taxLine = cartTotals.lineTaxBreakdown.find((line) => line.variantId === item.variantId);
              const itemTotal = taxLine?.customerTotal ?? (
                item.discountType === 'percentage'
                  ? item.unitPrice * item.quantity * (1 - item.discountValue / 100)
                  : item.unitPrice * item.quantity - item.discountValue
              );
              const freeQuantity = taxLine?.promotionFreeQuantity || 0;

              const isDiscounting = editingDiscountVariantId === item.variantId;

              return (
                <div
                  key={item.variantId}
                  className="p-3 bg-white border border-stone-200 rounded shadow-2xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h5 className="font-semibold text-xs text-stone-900 truncate">
                        {item.productName}
                      </h5>
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-0.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-stone-300 shrink-0 inline-block"
                          style={{ backgroundColor: garmentColorHex(item.color, item.colorHex, '#bbb') }}
                        />
                        <span>{item.color}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono font-medium text-stone-700">Size {item.size}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[10px] bg-stone-100 text-stone-700 px-1 py-0.2 rounded font-semibold">
                          HSN {item.hsnCode || '6205'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[10px] text-stone-400">{item.sku}</span>
                      </div>
                    </div>

                    {/* Price total for item */}
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-xs text-stone-900 tabular-nums">
                        {settings.currencySymbol}
                        {Math.max(0, itemTotal).toFixed(2)}
                      </div>
                      {(item.discountValue > 0 || freeQuantity > 0) && (
                        <div className="text-[10px] text-emerald-600 font-mono line-through">
                          {settings.currencySymbol}
                          {(item.unitPrice * item.quantity).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  {freeQuantity > 0 && <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1">
                    {freeQuantity} lowest-priced item{freeQuantity === 1 ? '' : 's'} free · {taxLine?.offerNames.join(', ')}
                  </div>}

                  {/* Quantity Stepper & Discount Controls */}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateCartItemQuantity(item.variantId, item.quantity - 1)}
                        className="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 cursor-pointer"
                        title="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-mono font-semibold text-xs tabular-nums text-stone-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartItemQuantity(item.variantId, item.quantity + 1)}
                        disabled={item.quantity >= item.stockAvailable}
                        className="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-stone-700 cursor-pointer"
                        title="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <span className="text-[10px] text-stone-400 font-mono ml-1">
                        @{settings.currencySymbol}{item.unitPrice.toFixed(2)}{settings.registrationType === 'regular' && settings.priceMode === 'inclusive' ? ' incl. GST' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Discount trigger button */}
                      <button
                        onClick={() => {
                          if (isDiscounting) {
                            setEditingDiscountVariantId(null);
                          } else {
                            setEditingDiscountVariantId(item.variantId);
                            setDiscountValInput(item.discountValue);
                            setDiscountTypeInput(item.discountType);
                          }
                        }}
                        className={`px-1.5 py-0.5 text-[11px] rounded flex items-center gap-1 transition-colors cursor-pointer ${
                          item.discountValue > 0
                            ? 'bg-emerald-50 text-emerald-700 font-medium'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                        title="Apply line item discount"
                      >
                        <Tag className="w-3 h-3" />
                        <span>
                          {item.discountValue > 0
                            ? item.discountType === 'percentage'
                              ? `-${item.discountValue}%`
                              : `-${settings.currencySymbol}${item.discountValue}`
                            : 'Disc'}
                        </span>
                      </button>

                      {/* Remove item button */}
                      <button
                        onClick={() => removeCartItem(item.variantId)}
                        className="p-1 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Remove item from cart"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Item Discount Popover */}
                  {isDiscounting && (
                    <div className="bg-stone-50 p-2.5 rounded border border-stone-200 text-xs space-y-2 mt-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-stone-700 text-[11px]">Item Discount</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setDiscountTypeInput('percentage')}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded cursor-pointer ${
                              discountTypeInput === 'percentage'
                                ? 'bg-stone-900 text-white'
                                : 'bg-stone-200 text-stone-700'
                            }`}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() => setDiscountTypeInput('fixed')}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded cursor-pointer ${
                              discountTypeInput === 'fixed'
                                ? 'bg-stone-900 text-white'
                                : 'bg-stone-200 text-stone-700'
                            }`}
                          >
                            {settings.currencySymbol}
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max={discountTypeInput === 'percentage' ? 100 : item.unitPrice * item.quantity}
                          step="0.5"
                          value={discountValInput || ''}
                          onChange={(e) => setDiscountValInput(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs bg-white border border-stone-300 rounded font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            updateCartItemDiscount(item.variantId, discountTypeInput, discountValInput);
                            setEditingDiscountVariantId(null);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-stone-900 text-white rounded cursor-pointer"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Cart Calculation & Totals Box */}
        <div className="p-4 bg-white border-t border-stone-200 space-y-2 text-xs">
          {cartTotals.partnerReward && <div className="rounded border border-amber-300 bg-amber-50 p-2.5 text-amber-950">
            <div className="font-bold">🎁 Free {cartTotals.partnerReward.itemName} earned</div>
            <div>From {cartTotals.partnerReward.partnerName} · qualifying bill: {settings.currencySymbol}{cartTotals.partnerReward.minimumPurchase.toFixed(2)}</div>
            <div className="mt-1 text-[10px]">{cartTotals.partnerReward.instructions || 'Tell the customer to show this receipt at the partner business to claim the item.'}</div>
          </div>}
          {/* Subtotal */}
          <div className="flex justify-between text-stone-600">
            <span>{settings.registrationType === 'regular' ? (settings.priceMode === 'inclusive' ? 'Subtotal (GST inclusive)' : 'Subtotal (before GST)') : 'Subtotal'}</span>
            <span className="font-mono tabular-nums text-stone-800">
              {settings.currencySymbol}{cartTotals.subtotal.toFixed(2)}
            </span>
          </div>

          {/* Item Discounts if any */}
          {cartTotals.itemDiscounts > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Item Discounts</span>
              <span className="font-mono tabular-nums">
                -{settings.currencySymbol}{cartTotals.itemDiscounts.toFixed(2)}
              </span>
            </div>
          )}

          {cartTotals.appliedOffers.map((offer) => <div key={offer.id} className="flex justify-between text-emerald-700">
            <span>{offer.name}{offer.freeQuantity > 0 ? ` · ${offer.freeQuantity} free` : ' · discount'}</span>
            <span className="font-mono tabular-nums">-{settings.currencySymbol}{offer.discount.toFixed(2)}</span>
          </div>)}
          {cartTotals.appliedOffers.some((offer) => offer.freeQuantity > 0) && <p className="text-[10px] text-stone-500">Buy X, Get Y Free applied; garment-discount offers are not combined with it.</p>}

          {/* Order-level discount row */}
          <div className="flex items-center justify-between text-stone-600">
            <div className="flex items-center gap-1.5">
              <span>Cart Discount</span>
              <div className="flex gap-1 text-[10px]">
                {[5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => {
                      if (cartOrderDiscount.value === pct && cartOrderDiscount.type === 'percentage') {
                        setCartOrderDiscount({ type: 'percentage', value: 0 });
                      } else {
                        setCartOrderDiscount({ type: 'percentage', value: pct });
                      }
                    }}
                    className={`px-1.5 py-0.2 rounded border cursor-pointer ${
                      cartOrderDiscount.value === pct && cartOrderDiscount.type === 'percentage'
                        ? 'bg-amber-400 border-amber-500 text-stone-950 font-bold'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            {cartTotals.orderDiscount > 0 ? (
              <span className="font-mono tabular-nums text-emerald-600">
                -{settings.currencySymbol}{cartTotals.orderDiscount.toFixed(2)}
              </span>
            ) : (
              <span className="font-mono text-stone-400">{settings.currencySymbol}0.00</span>
            )}
          </div>

          {/* Tax line: only regular GST businesses collect tax from customers. */}
          {(settings.registrationType || (settings.taxId ? 'regular' : 'unregistered')) === 'regular' ? <div className="space-y-0.5 text-stone-600">
            <div className="flex justify-between">
              <span>GST (apparel rate by item price; configured rate for other goods)</span>
              <span className="font-mono tabular-nums text-stone-800">
                {settings.currencySymbol}{cartTotals.taxTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-[10.5px] text-stone-400 pl-1 font-mono">
              <span>{cartTotals.lineTaxBreakdown.some((line) => line.isInterState) ? 'IGST' : 'CGST + SGST'}</span>
              <span>{settings.currencySymbol}{cartTotals.taxTotal.toFixed(2)}</span>
            </div>
            {settings.priceMode === 'inclusive' && <p className="text-[10px] text-emerald-700">GST is included in listed prices.</p>}
          </div> : <p className="text-[11px] text-stone-500">{settings.registrationType === 'composition' ? 'Composition bill of supply · no GST collected' : 'Retail receipt · no GST collected'}</p>}

          {/* Grand Total */}
          <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline">
            <span className="font-bold text-sm text-stone-900">Total Due</span>
            <span className="font-mono font-bold text-2xl text-stone-900 tabular-nums">
              {settings.currencySymbol}{cartTotals.grandTotal.toFixed(2)}
            </span>
          </div>

          {/* Checkout Action Button */}
          <div className="pt-2">
            <button
              onClick={() => {
                if (!activeShift) {
                  onOpenShiftModal();
                } else {
                  onOpenPaymentModal();
                }
              }}
              disabled={cart.length === 0}
              className={`w-full py-3.5 px-4 rounded font-bold text-sm tracking-wide transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                cart.length === 0
                  ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  : 'bg-stone-900 text-white hover:bg-stone-800 active:scale-[0.99] shadow-sm'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Charge {settings.currencySymbol}{cartTotals.grandTotal.toFixed(2)}</span>
            </button>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button type="button" disabled={!cart.length} onClick={() => { if (holdCurrentBill()) setShowHeldBills(true); }} className="py-2 px-2 border border-stone-300 bg-white text-stone-800 rounded text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"><Pause className="w-3.5 h-3.5" />Hold bill</button>
              <button type="button" disabled={!cart.length} onClick={onOpenEstimateModal} className="py-2 px-2 border border-stone-300 bg-white text-stone-800 rounded text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"><Printer className="w-3.5 h-3.5" />Print estimate</button>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Variant Selection Modal */}
      {selectedProductForVariant && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 text-stone-900">
            <div className="flex justify-between items-start pb-3 border-b border-stone-200">
              <div>
                <span className="text-xs font-mono text-stone-500 uppercase tracking-wider block">
                  {selectedProductForVariant.brand} · {selectedProductForVariant.styleCode}
                </span>
                <h3 className="font-bold text-base text-stone-900 mt-0.5">
                  {selectedProductForVariant.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedProductForVariant(null)}
                className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <p className="text-xs text-stone-600">
                Select color and size variant to ring up or add to cart:
              </p>

              {/* Variant Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
                {selectedProductForVariant.variants.map((v) => {
                  const isSelected = selectedVariantId === v.id;
                  const isOut = v.stock <= 0;

                  return (
                    <button
                      key={v.id}
                      onClick={() => !isOut && setSelectedVariantId(v.id)}
                      disabled={isOut}
                      className={`p-3 text-left border rounded transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900'
                          : isOut
                          ? 'opacity-40 border-stone-200 bg-stone-100 cursor-not-allowed'
                          : 'border-stone-200 hover:border-stone-400 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full border border-stone-300 shrink-0"
                            style={{ backgroundColor: garmentColorHex(v.color, v.colorHex, '#bbb') }}
                          />
                          <span className="font-semibold text-xs text-stone-900">{v.color}</span>
                        </div>
                        <span className="font-mono font-bold text-xs text-stone-800">Size {v.size}</span>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-stone-100 flex justify-between items-center text-[11px]">
                        <span className="font-mono font-bold text-stone-900 tabular-nums">
                          {settings.currencySymbol}{v.sellingPrice.toFixed(2)}{settings.registrationType === 'regular' && settings.priceMode === 'inclusive' ? ' incl. GST' : ''}
                        </span>
                        <span
                          className={`font-mono tabular-nums ${
                            isOut
                              ? 'text-rose-600 font-semibold'
                              : v.stock <= 4
                              ? 'text-amber-600 font-medium'
                              : 'text-stone-500'
                          }`}
                        >
                          {isOut ? 'Out of stock' : `${v.stock} in stock`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setSelectedProductForVariant(null)}
                className="flex-1 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVariantAdd}
                disabled={!selectedVariantId}
                className="flex-1 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded transition-colors cursor-pointer"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
