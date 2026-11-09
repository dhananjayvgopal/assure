import React, { useState } from 'react';
import { Gift, Plus, Ban, Printer } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { formatDateTimeDisplay } from '../../utils/dateFormat';
import { GiftVoucherPrintModal } from './GiftVoucherPrintModal';

export const GiftVouchersView: React.FC = () => {
  const { vouchers, issueGiftVoucher, voidGiftVoucher, settings, hasPermission } = usePOS();
  const canManage = hasPermission('vouchers.manage');
  const [amount, setAmount] = useState('');
  const [customer, setCustomer] = useState('');
  const [note, setNote] = useState('');
  const [voucherToPrint, setVoucherToPrint] = useState<(typeof vouchers)[number] | null>(null);

  const handleIssue = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    const voucher = issueGiftVoucher(value, customer, note);
    if (!voucher) {
      window.alert('Voucher could not be issued. Check your permission and amount.');
      return;
    }
    window.alert(`Gift voucher issued. Code: ${voucher.code}\nValue: ${settings.currencySymbol}${voucher.initialValue.toFixed(2)}\nSave or print this code for the customer.`);
    setAmount(''); setCustomer(''); setNote('');
  };

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); window.alert(`Copied ${code}`); }
    catch { window.alert(`Voucher code: ${code}`); }
  };

  return <div id="vouchers-view" className="p-6 max-w-7xl mx-auto space-y-6">
    <header className="pb-4 border-b border-stone-200">
      <h2 className="text-xl font-bold text-stone-900">Gift Vouchers</h2>
      <p className="text-xs text-stone-500 mt-1">Issue and print voucher codes, check remaining balances, and redeem them at checkout.</p>
    </header>
    {canManage && <form onSubmit={handleIssue} className="bg-white border border-stone-200 rounded p-5 space-y-4">
      <h3 className="font-bold text-sm flex items-center gap-2"><Gift className="w-4 h-4 text-amber-600" /> Issue a Gift Voucher</h3>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-xs font-medium text-stone-700">Value ({settings.currencySymbol})
          <input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded" placeholder="e.g. 1000" />
        </label>
        <label className="text-xs font-medium text-stone-700">Customer name (optional)
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded" />
        </label>
        <label className="text-xs font-medium text-stone-700">Note
          <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full px-3 py-2 border border-stone-300 rounded" placeholder="Reason or reference" />
        </label>
      </div>
      <button className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 rounded flex items-center gap-2"><Plus className="w-4 h-4" /> Create Voucher</button>
      <p className="text-[11px] text-stone-500">Voucher value is stored as customer credit. It is not a cash payment or a GST invoice by itself.</p>
    </form>}
    <section className="bg-white border border-stone-200 rounded overflow-hidden">
      <div className="p-4 border-b border-stone-200 font-bold text-sm">Voucher Register ({vouchers.length})</div>
      <div className="overflow-auto">
        <table className="w-full min-w-[850px] text-xs text-left">
          <thead className="bg-stone-100 text-stone-600"><tr>{['Issued', 'Voucher Code', 'Customer', 'Original Value', 'Balance', 'Status', 'Note', 'Actions'].map((title) => <th key={title} className="px-3 py-2">{title}</th>)}</tr></thead>
          <tbody className="divide-y divide-stone-100">{vouchers.map((voucher) => <tr key={voucher.id} className="hover:bg-stone-50">
            <td className="px-3 py-2 whitespace-nowrap">{formatDateTimeDisplay(voucher.createdAt)}</td>
            <td className="px-3 py-2 font-mono font-bold">{voucher.code}</td>
            <td className="px-3 py-2">{voucher.customerName || '—'}</td>
            <td className="px-3 py-2 text-right">{settings.currencySymbol}{voucher.initialValue.toFixed(2)}</td>
            <td className="px-3 py-2 text-right font-semibold">{settings.currencySymbol}{voucher.balance.toFixed(2)}</td>
            <td className="px-3 py-2 capitalize">{voucher.status}</td>
            <td className="px-3 py-2">{voucher.note}</td>
            <td className="px-3 py-2 whitespace-nowrap space-x-2"><button onClick={() => setVoucherToPrint(voucher)} className="inline-flex items-center gap-1 underline"><Printer className="w-3 h-3" /> Print</button><button onClick={() => void copyCode(voucher.code)} className="underline">Copy code</button>{canManage && voucher.status === 'active' && <button onClick={() => voidGiftVoucher(voucher.id)} className="inline-flex items-center gap-1 text-rose-700 underline"><Ban className="w-3 h-3" /> Void</button>}</td>
          </tr>)}
          {vouchers.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-stone-500">No gift vouchers have been issued.</td></tr>}</tbody>
        </table>
      </div>
    </section>
    <GiftVoucherPrintModal voucher={voucherToPrint} onClose={() => setVoucherToPrint(null)} />
  </div>;
};
