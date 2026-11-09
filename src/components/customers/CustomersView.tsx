import React, { useMemo, useState } from 'react';
import { Search, UserRoundPlus, Users } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import type { CustomerRecord } from '../../types/pos';

const emptyForm = { name: '', phone: '', gstin: '', address: '', stateCode: '', notes: '' };

export const CustomersView: React.FC = () => {
  const { customers, saveCustomer } = usePOS();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<CustomerRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => !q || [c.name, c.phone, c.gstin, c.address].some((v) => v?.toLowerCase().includes(q)));
  }, [customers, query]);
  const startEdit = (customer: CustomerRecord) => {
    setEditing(customer);
    setForm({ name: customer.name || '', phone: customer.phone || '', gstin: customer.gstin || '', address: customer.address || '', stateCode: customer.stateCode || '', notes: customer.notes || '' });
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const saved = saveCustomer({ ...form, id: editing?.id });
    if (saved) { setEditing(null); setForm(emptyForm); }
  };
  return <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
    <div><h1 className="text-xl font-bold">Customers</h1><p className="text-sm text-stone-500 mt-1">Keep optional customer details for faster checkout. Customers without a name on the sale are recorded as Walk-in Customer.</p></div>
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
      <section className="rounded-lg border border-stone-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex items-center gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, GSTIN, or address" className="w-full rounded border border-stone-300 py-2 pl-9 pr-3 text-sm" /></div>
          <span className="text-xs text-stone-500">{customers.length} saved</span>
        </div>
        {filtered.length ? <div className="divide-y divide-stone-100">{filtered.map((customer) => <button key={customer.id} onClick={() => startEdit(customer)} className="w-full text-left p-4 hover:bg-amber-50/50 flex items-start justify-between gap-3">
          <div><div className="font-semibold text-sm">{customer.name || 'Unnamed customer'}</div><div className="mt-1 text-xs text-stone-500">{[customer.phone, customer.gstin, customer.address].filter(Boolean).join(' · ') || 'No contact details'}</div></div><span className="text-xs text-amber-700">Edit</span>
        </button>)}</div> : <div className="p-10 text-center text-sm text-stone-500"><Users className="mx-auto mb-2 h-7 w-7 text-stone-300"/>{query ? 'No matching customers.' : 'No saved customers yet.'}</div>}
      </section>
      <form onSubmit={submit} className="rounded-lg border border-stone-200 bg-white p-4 space-y-3">
        <h2 className="font-bold text-sm flex items-center gap-2"><UserRoundPlus className="h-4 w-4 text-amber-600"/>{editing ? 'Edit customer' : 'Add customer'}</h2>
        <p className="text-xs text-stone-500">Name and mobile number are optional. Add any useful detail; use the POS without saving a profile for walk-in customers.</p>
        <label className="block text-xs font-medium">Name<input maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-medium">Mobile number<input maxLength={20} inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-medium">GSTIN<input maxLength={15} value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '') })} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm font-mono" /></label>
        <label className="block text-xs font-medium">Address<input maxLength={240} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-medium">State code<input maxLength={2} inputMode="numeric" value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value.replace(/\D/g, '').slice(0, 2) })} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-medium">Notes<textarea maxLength={300} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm" rows={2}/></label>
        <div className="flex gap-2"><button className="rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white">{editing ? 'Save changes' : 'Save customer'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyForm); }} className="rounded border px-4 py-2 text-sm">Cancel</button>}</div>
      </form>
    </div>
  </div>;
};
