import React, { useMemo, useState } from 'react';
import { BadgePercent, Plus, ToggleLeft, Trash2 } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { BuyGetFreeOffer } from '../../types/pos';
import { formatDateDisplay, parseDateDisplay } from '../../utils/dateFormat';

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const OffersView: React.FC = () => {
  const { offers, products, addOffer, updateOffer, deleteOffer, settings, hasPermission } = usePOS();
  const canManage = hasPermission('offers.manage');
  const [name, setName] = useState('');
  const [offerType, setOfferType] = useState<'buy_get_free' | 'discount' | 'spend_reward'>('buy_get_free');
  const [buyQuantity, setBuyQuantity] = useState(2);
  const [freeQuantity, setFreeQuantity] = useState(1);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState(10);
  const [minimumPurchase, setMinimumPurchase] = useState(2000);
  const [rewardItemName, setRewardItemName] = useState('');
  const [rewardPartnerName, setRewardPartnerName] = useState('');
  const [rewardInstructions, setRewardInstructions] = useState('');
  const [scope, setScope] = useState<'store' | 'products' | 'categories'>('products');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<BuyGetFreeOffer['categories']>([]);
  const [startsOn, setStartsOn] = useState(formatDateDisplay(localToday()));
  const [endsOn, setEndsOn] = useState(formatDateDisplay(localToday()));
  const [error, setError] = useState('');

  const statusOf = (offer: BuyGetFreeOffer) => !offer.active ? 'Inactive' : localToday() < offer.startsOn ? 'Upcoming' : localToday() > offer.endsOn ? 'Expired' : 'Active';
  const productNames = useMemo(() => new Map(products.map((product) => [product.id, product.name])), [products]);
  const categoryOptions = useMemo(() => [...new Set(products.map((product) => product.category))].sort(), [products]);

  const submitOffer = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!name.trim()) return setError('Enter an offer name.');
    if (offerType !== 'spend_reward' && scope === 'products' && !productIds.length) return setError('Select at least one eligible garment.');
    if (offerType !== 'spend_reward' && scope === 'categories' && !categories?.length) return setError('Select at least one eligible category.');
    if (offerType === 'buy_get_free' && (!Number.isInteger(buyQuantity) || buyQuantity < 1 || !Number.isInteger(freeQuantity) || freeQuantity < 1)) return setError('Buy and free quantities must be whole numbers of at least 1.');
    if (offerType === 'discount' && (!Number.isFinite(discountValue) || discountValue <= 0 || (discountType === 'percentage' && discountValue > 100))) return setError(discountType === 'percentage' ? 'Enter a discount from 0.01% to 100%.' : 'Enter a positive discount amount.');
    if (offerType === 'spend_reward' && (!Number.isFinite(minimumPurchase) || minimumPurchase <= 0 || !rewardItemName.trim() || !rewardPartnerName.trim())) return setError('Enter a positive minimum purchase, free item, and partner business name.');
    const startIso = parseDateDisplay(startsOn);
    const endIso = parseDateDisplay(endsOn);
    if (!startIso || !endIso || endIso < startIso) return setError('Enter valid dates in DD-MM-YYYY format, and make sure the end date is not before the start date.');
    const effectiveScope = offerType === 'spend_reward' ? 'store' : scope;
    const offer = addOffer({ name: name.trim(), type: offerType, scope: effectiveScope, productIds: effectiveScope === 'products' ? productIds : [], categories: effectiveScope === 'categories' ? categories : [], buyQuantity: offerType === 'buy_get_free' ? buyQuantity : 1, freeQuantity: offerType === 'buy_get_free' ? freeQuantity : 0, discountType: offerType === 'discount' ? discountType : undefined, discountValue: offerType === 'discount' ? discountValue : undefined, minimumPurchase: offerType === 'spend_reward' ? minimumPurchase : undefined, rewardItemName: offerType === 'spend_reward' ? rewardItemName.trim() : undefined, rewardPartnerName: offerType === 'spend_reward' ? rewardPartnerName.trim() : undefined, rewardInstructions: offerType === 'spend_reward' ? rewardInstructions.trim() : undefined, startsOn: startIso, endsOn: endIso, active: true });
    if (!offer) return setError('Could not save this offer. Check your permissions and selected garments.');
    setName(''); setBuyQuantity(2); setFreeQuantity(1); setProductIds([]); setCategories([]); setRewardItemName(''); setRewardPartnerName(''); setRewardInstructions(''); setStartsOn(formatDateDisplay(localToday())); setEndsOn(formatDateDisplay(localToday())); setScope('products');
  };

  const toggleProduct = (id: string) => setProductIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  const toggleCategory = (category: NonNullable<BuyGetFreeOffer['categories']>[number]) => setCategories((current = []) => current.includes(category) ? current.filter((entry) => entry !== category) : [...current, category]);

  return <div className="p-6 max-w-7xl mx-auto space-y-6">
    <header className="pb-4 border-b border-stone-200">
      <h2 className="text-xl font-bold text-stone-900">Offers</h2>
      <p className="text-xs text-stone-500 mt-1">Create and review garment promotions. Active offers apply automatically at checkout.</p>
    </header>
    <p className="text-xs text-blue-900 bg-blue-50 border border-blue-200 rounded p-3">Buy X, Get Y Free and garment-discount offers are mutually exclusive per sale. A partner-item reward is separate: it applies to one sale when the final bill reaches its minimum purchase amount.</p>

    {canManage && <form onSubmit={submitOffer} className="bg-white border border-stone-200 rounded p-5 space-y-4">
      <h3 className="font-bold text-sm flex items-center gap-2"><BadgePercent className="w-4 h-4 text-amber-600" /> Create an offer</h3>
      <div className="grid sm:grid-cols-4 gap-3">
        <label className="text-xs font-medium text-stone-700">Offer type
          <select value={offerType} onChange={(event) => setOfferType(event.target.value as 'buy_get_free' | 'discount' | 'spend_reward')} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded"><option value="buy_get_free">Buy X, Get Y Free</option><option value="discount">Garment discount</option><option value="spend_reward">Spend amount, get partner item</option></select>
        </label>
        <label className="text-xs font-medium text-stone-700 sm:col-span-2">Offer name
          <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded" placeholder="e.g. Monsoon Kurti Offer" />
        </label>
        {offerType === 'buy_get_free' && <><label className="text-xs font-medium text-stone-700">Buy quantity
          <input required type="number" min="1" step="1" value={buyQuantity} onChange={(event) => setBuyQuantity(Number(event.target.value))} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded" />
        </label>
        <label className="text-xs font-medium text-stone-700">Get free quantity
          <input required type="number" min="1" step="1" value={freeQuantity} onChange={(event) => setFreeQuantity(Number(event.target.value))} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded" />
        </label></>}
        {offerType === 'discount' && <><label className="text-xs font-medium text-stone-700">Discount type
          <select value={discountType} onChange={(event) => setDiscountType(event.target.value as 'percentage' | 'fixed')} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded"><option value="percentage">Percentage</option><option value="fixed">Amount per garment</option></select>
        </label><label className="text-xs font-medium text-stone-700">Discount {discountType === 'percentage' ? '(%)' : `(${settings.currencySymbol} per item)`}
          <input required type="number" min="0.01" max={discountType === 'percentage' ? 100 : undefined} step="0.01" value={discountValue} onChange={(event) => setDiscountValue(Number(event.target.value))} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded" />
        </label></>}
        {offerType === 'spend_reward' && <>
          <label className="text-xs font-medium text-stone-700">Minimum final bill ({settings.currencySymbol})
            <input required type="number" min="0.01" step="0.01" value={minimumPurchase} onChange={(event) => setMinimumPurchase(Number(event.target.value))} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded" />
          </label>
          <label className="text-xs font-medium text-stone-700">Free item
            <input required maxLength={80} value={rewardItemName} onChange={(event) => setRewardItemName(event.target.value)} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded" placeholder="Coffee, pizza, etc." />
          </label>
          <label className="text-xs font-medium text-stone-700">Partner business
            <input required maxLength={100} value={rewardPartnerName} onChange={(event) => setRewardPartnerName(event.target.value)} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded" placeholder="Cafe or pizza shop" />
          </label>
          <label className="text-xs font-medium text-stone-700 sm:col-span-2">Redemption instructions (optional)
            <input maxLength={160} value={rewardInstructions} onChange={(event) => setRewardInstructions(event.target.value)} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded" placeholder="Show this receipt at the partner shop to claim" />
          </label>
        </>}
        <label className="text-xs font-medium text-stone-700">Starts on
          <input required type="text" inputMode="numeric" maxLength={10} placeholder="DD-MM-YYYY" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded" />
        </label>
        <label className="text-xs font-medium text-stone-700">Ends on
          <input required type="text" inputMode="numeric" maxLength={10} placeholder="DD-MM-YYYY" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded" />
        </label>
      </div>
      {offerType !== 'spend_reward' && <label className="inline-flex items-center gap-2 text-xs font-medium text-stone-700">Offer applies to
        <select value={scope} onChange={(event) => setScope(event.target.value as 'store' | 'products' | 'categories')} className="px-3 py-2 border border-stone-300 rounded"><option value="products">Selected garments</option><option value="categories">Selected categories</option><option value="store">Entire store</option></select>
      </label>}
      {offerType !== 'spend_reward' && scope === 'products' && <fieldset>
        <legend className="text-xs font-semibold text-stone-800 mb-2">Eligible garments <span className="font-normal text-stone-500">({offerType === 'buy_get_free' ? 'the lowest-priced eligible units become free' : 'discount applies to eligible garments in the basket'})</span></legend>
        {products.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-auto p-3 bg-stone-50 border border-stone-200 rounded">
          {products.map((product) => <label key={product.id} className="flex items-start gap-2 text-xs bg-white border border-stone-200 rounded p-2 cursor-pointer">
            <input type="checkbox" checked={productIds.includes(product.id)} onChange={() => toggleProduct(product.id)} />
            <span><strong>{product.name}</strong><span className="block text-stone-500">{product.brand} · {product.category} · {product.variants.length} variants</span></span>
          </label>)}
        </div> : <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">Add garments first, then return here to select which products qualify for an offer.</p>}
      </fieldset>}
      {offerType !== 'spend_reward' && scope === 'categories' && <fieldset>
        <legend className="text-xs font-semibold text-stone-800 mb-2">Eligible categories <span className="font-normal text-stone-500">(every garment in the selected categories qualifies)</span></legend>
        {categoryOptions.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3 bg-stone-50 border border-stone-200 rounded">
          {categoryOptions.map((category) => <label key={category} className="flex items-center gap-2 text-xs bg-white border border-stone-200 rounded p-2 cursor-pointer">
            <input type="checkbox" checked={categories?.includes(category) || false} onChange={() => toggleCategory(category)} />
            <span><strong>{category}</strong><span className="block text-stone-500">{products.filter((product) => product.category === category).length} garments</span></span>
          </label>)}
        </div> : <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">Add garments with categories first, then return here to select the categories.</p>}
      </fieldset>}
      {offerType !== 'spend_reward' && scope === 'store' && <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded p-3">This offer applies to every garment in the store and in the checkout basket.</p>}
      <p className="text-[11px] text-stone-500">{offerType === 'buy_get_free' ? 'Example: Buy 2, Get 1 Free needs 3 eligible items in the basket. Each complete group applies once; overlapping offers do not use the same free units twice.' : offerType === 'discount' ? 'Discounts apply automatically to selected garments during the date range. Multiple offers cannot reduce an item below zero.' : 'One partner reward is earned per sale when the final bill total, including GST and after discounts, meets the minimum. The partner business must honor the free item; this POS does not track redemption there.'}</p>
      {error && <p className="text-xs text-rose-700" role="alert">{error}</p>}
      <button disabled={offerType !== 'spend_reward' && !products.length && scope !== 'store'} className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 rounded flex items-center gap-2 disabled:opacity-40"><Plus className="w-4 h-4" /> Save Offer</button>
    </form>}

    <section className="bg-white border border-stone-200 rounded overflow-hidden">
      <div className="p-4 border-b border-stone-200 flex items-center justify-between"><h3 className="font-bold text-sm">Offer List ({offers.length})</h3><span className="text-xs text-stone-500">Active now: {offers.filter((offer) => statusOf(offer) === 'Active').length}</span></div>
      <div className="overflow-auto">
        <table className="w-full min-w-[950px] text-xs text-left">
          <thead className="bg-stone-100 text-stone-600"><tr>{['Offer', 'Eligible garments / categories', 'Rule', 'Dates', 'Status', ...(canManage ? ['Manage'] : [])].map((heading) => <th key={heading} className="px-3 py-2 font-semibold">{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-stone-100">
            {[...offers].sort((a, b) => a.startsOn.localeCompare(b.startsOn)).map((offer) => {
              const status = statusOf(offer);
              return <tr key={offer.id} className="hover:bg-stone-50">
                <td className="px-3 py-3 font-semibold">{offer.name}<span className="block text-[10px] text-stone-400">Created by {offer.createdBy} · {formatDateDisplay(offer.createdAt)}</span></td>
                <td className="px-3 py-3 max-w-sm">{offer.type === 'spend_reward' ? 'Final bill total' : offer.scope === 'store' ? 'Entire store' : offer.scope === 'categories' ? (offer.categories || []).join(', ') || '(category removed)' : offer.productIds.map((id) => productNames.get(id) || '(garment removed)').join(', ')}</td>
                <td className="px-3 py-3 font-semibold whitespace-nowrap">{offer.type === 'discount' ? `${offer.discountValue}${offer.discountType === 'percentage' ? '%' : ` ${settings.currencySymbol}`} off` : offer.type === 'spend_reward' ? `Spend ${settings.currencySymbol}${Number(offer.minimumPurchase).toFixed(2)} · Get ${offer.rewardItemName}` : `Buy ${offer.buyQuantity}, Get ${offer.freeQuantity} Free`}<span className="block font-normal text-stone-500">{offer.type === 'discount' ? (offer.discountType === 'fixed' ? 'per eligible garment' : 'eligible garments') : offer.type === 'spend_reward' ? `Free from ${offer.rewardPartnerName}` : 'Cheapest item(s) free'}</span></td>
                <td className="px-3 py-3 whitespace-nowrap">{formatDateDisplay(offer.startsOn)} → {formatDateDisplay(offer.endsOn)}</td>
                <td className="px-3 py-3"><span className={`rounded px-2 py-1 font-semibold ${status === 'Active' ? 'bg-emerald-100 text-emerald-800' : status === 'Upcoming' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>{status}</span></td>
                {canManage && <td className="px-3 py-3 whitespace-nowrap space-x-2"><button onClick={() => updateOffer(offer.id, { active: !offer.active })} className="inline-flex items-center gap-1 underline"><ToggleLeft className="w-3.5 h-3.5" />{offer.active ? 'Deactivate' : 'Activate'}</button><button onClick={() => deleteOffer(offer.id)} className="inline-flex items-center gap-1 text-rose-700 underline"><Trash2 className="w-3 h-3" /> Delete</button></td>}
              </tr>;
            })}
            {!offers.length && <tr><td colSpan={canManage ? 6 : 5} className="p-8 text-center text-stone-500">No offers created yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="p-3 border-t border-stone-100 text-[11px] text-stone-500">Garment discounts affect sale totals and GST. Partner items are printed as a free claim on the receipt; they do not change this POS total or garment stock, and partner redemption is handled at the partner store.</p>
    </section>
    <span className="sr-only">Currency: {settings.currencySymbol}</span>
  </div>;
};
