import React, { useMemo, useState } from 'react';
import { Building2, Store } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { GST_STATE_NAMES, isValidIndianGstin } from '../../utils/gst';
import type { StoreSettings } from '../../types/pos';

type RegistrationType = NonNullable<StoreSettings['registrationType']>;

export const BusinessRegistrationSetup: React.FC = () => {
  const { settings, saveSettingsNow, activeUser } = usePOS();
  const [form, setForm] = useState<{ storeName: string; legalBusinessName: string; tagline: string; address: string; phone: string; registrationType: RegistrationType | ''; taxId: string; stateCode: string }>({
    storeName: settings.storeName === 'Your POS' ? '' : settings.storeName,
    legalBusinessName: settings.legalBusinessName || '',
    tagline: settings.tagline || '',
    address: settings.address || '',
    phone: settings.phone || '',
    registrationType: settings.businessSetupComplete ? (settings.registrationType || 'unregistered') as RegistrationType : '',
    taxId: settings.taxId || '',
    stateCode: settings.stateCode || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const stateNames = useMemo(() => Object.entries(GST_STATE_NAMES).filter(([code]) => code !== '97' && code !== '99'), []);

  const changeType = (registrationType: RegistrationType) => setForm((previous) => ({
    ...previous,
    registrationType,
    taxId: registrationType === 'unregistered' ? '' : previous.taxId,
  }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const storeName = form.storeName.trim();
    const address = form.address.trim();
    const taxId = form.taxId.trim().toUpperCase();
    if (!form.registrationType) return setError('Choose the business GST registration status.');
    if (storeName.length < 2) return setError('Enter the shop or trade name (at least 2 characters).');
    if (address.length < 5) return setError('Enter the full business address for receipts.');
    if (!form.stateCode || !GST_STATE_NAMES[form.stateCode]) return setError('Choose the state where this GST registration or business is located.');
    if (form.registrationType !== 'unregistered') {
      if (!isValidIndianGstin(taxId)) return setError('Enter the 15-character GSTIN exactly as shown on the registration certificate.');
      if (taxId.slice(0, 2) !== form.stateCode) return setError('The GSTIN state code does not match the selected business state.');
      if (form.legalBusinessName.trim().length < 2) return setError('Enter the legal name shown on the GST registration certificate.');
    }
    setSaving(true);
    try {
      await saveSettingsNow({
        storeName,
        legalBusinessName: form.legalBusinessName.trim(),
        tagline: form.tagline.trim(),
        address,
        phone: form.phone.trim(),
        taxId: form.registrationType === 'unregistered' ? '' : taxId,
        stateCode: form.stateCode,
        stateName: GST_STATE_NAMES[form.stateCode],
        registrationType: form.registrationType,
        businessSetupComplete: true,
        receiptFooterNote: settings.receiptFooterNote || 'Thank you for shopping with us!',
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save business details. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
        <div className="border-b border-stone-200 px-6 py-6 sm:px-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-amber-100 text-amber-800"><Store className="h-5 w-5" /></span>
            <div><p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Step 2 of 2 · Business setup</p><p className="text-xs text-stone-500">Signed in as {activeUser.name}</p></div>
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Business details & GST status</h1>
          <p className="mt-1 text-sm text-stone-600">Enter this shop’s own details. Nothing is pre-filled from another business.</p>
        </div>

        <form onSubmit={submit} className="space-y-5 px-6 py-6 sm:px-8">
          <section className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-stone-700">Shop / trade name *
              <input required minLength={2} maxLength={100} autoFocus value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} placeholder="Name customers know" className="mt-1.5 w-full rounded border border-stone-300 px-3 py-2 text-sm font-normal" />
            </label>
            <label className="text-sm font-medium text-stone-700">Phone number
              <input type="tel" maxLength={20} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Shop contact number" className="mt-1.5 w-full rounded border border-stone-300 px-3 py-2 text-sm font-normal" />
            </label>
            <label className="text-sm font-medium text-stone-700 sm:col-span-2">Business address *
              <textarea required minLength={5} maxLength={240} rows={2} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Address printed on customer receipts" className="mt-1.5 w-full rounded border border-stone-300 px-3 py-2 text-sm font-normal" />
            </label>
            <label className="text-sm font-medium text-stone-700">Business state *
              <select required value={form.stateCode} onChange={(event) => setForm({ ...form, stateCode: event.target.value })} className="mt-1.5 w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm font-normal">
                <option value="">Choose state</option>
                {stateNames.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-stone-700">Short tagline (optional)
              <input maxLength={100} value={form.tagline} onChange={(event) => setForm({ ...form, tagline: event.target.value })} placeholder="Optional line on receipts" className="mt-1.5 w-full rounded border border-stone-300 px-3 py-2 text-sm font-normal" />
            </label>
          </section>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold text-stone-800">GST registration type *</legend>
            {([
              ['unregistered', 'Not registered for GST', 'The POS will issue a standard retail receipt and will not add or show GST.'],
              ['regular', 'Regular GST registration', 'The POS can calculate product GST and print a tax invoice with GST details.'],
              ['composition', 'Composition scheme', 'The POS will print a bill of supply and will not add or collect GST from customers.'],
            ] as const).map(([value, title, description]) => (
              <label key={value} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${form.registrationType === value ? 'border-amber-500 bg-amber-50/50' : 'border-stone-200'}`}>
                <input type="radio" name="registrationType" value={value} checked={form.registrationType === value} onChange={() => changeType(value)} className="mt-1 accent-amber-600" />
                <span><span className="block text-sm font-semibold text-stone-800">{title}</span><span className="mt-0.5 block text-xs leading-relaxed text-stone-600">{description}</span></span>
              </label>
            ))}
          </fieldset>

          {form.registrationType && form.registrationType !== 'unregistered' && <section className="grid gap-4 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-stone-700 sm:col-span-2">Legal name on GST certificate *
              <input required minLength={2} maxLength={120} value={form.legalBusinessName} onChange={(event) => setForm({ ...form, legalBusinessName: event.target.value })} placeholder="Legal business name" className="mt-1.5 w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm font-normal" />
            </label>
            <label className="text-sm font-medium text-stone-700 sm:col-span-2">GSTIN *
              <input required maxLength={15} autoCapitalize="characters" value={form.taxId} onChange={(event) => setForm({ ...form, taxId: event.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15) })} placeholder="15-character GSTIN" className="mt-1.5 w-full rounded border border-stone-300 bg-white px-3 py-2 font-mono text-sm uppercase" />
              <span className="mt-1 block text-xs font-normal text-stone-500">The GSTIN must belong to the state selected above. Assure POS checks its format, not its active status.</span>
            </label>
          </section>}

          {form.registrationType === 'composition' && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"><Building2 className="mr-1 inline h-4 w-4 align-text-bottom" />Composition taxpayers cannot collect tax on supplies. This POS blocks interstate garment sales in composition mode and prints the required composition notice on bills of supply. Confirm current scheme eligibility and obligations with your tax adviser.</p>}
          {form.registrationType === 'unregistered' && <p className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs leading-relaxed text-stone-600">Unregistered businesses must not show a GSTIN or collect GST in this POS. Confirm your registration obligations with your tax adviser.</p>}
          {error && <p role="alert" className="rounded bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <button disabled={saving} className="w-full rounded bg-stone-900 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50">{saving ? 'Saving…' : 'Save business details and open Assure POS'}</button>
        </form>
      </div>
    </main>
  );
};
