import { useEffect, useState } from 'react';
import { api } from '../api';

const EMPTY = { label: 'Home', name: '', phone: '', line1: '', city: '', state: '', pincode: '', isDefault: false };

/** Address form with pincode → state/city auto-fill and inline validation. */
export default function AddressForm({ initial, onSave, onCancel, submitLabel = 'Save address' }) {
  const [a, setA] = useState({ ...EMPTY, ...initial });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setA({ ...a, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(a.pincode)) return;
    api(`/products/serviceability/${a.pincode}`, { auth: false })
      .then((z) => setA((cur) => ({ ...cur, state: cur.state || z.state || '', city: cur.city || (z.city && !z.city.includes('NCR') ? z.city : cur.city) })))
      .catch(() => {});
  }, [a.pincode]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await onSave(a);
    } catch (er) {
      setErr(er.message);
    } finally {
      setBusy(false);
    }
  };

  const field = (k, label, props = {}) => (
    <label className="block text-sm">
      <span className="mb-1.5 block text-ink/60">{label}</span>
      <input className="input" value={a[k] || ''} onChange={set(k)} {...props} />
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-2">
        {['Home', 'Work', 'Other'].map((l) => (
          <button type="button" key={l} onClick={() => setA({ ...a, label: l })} className={`rounded-full px-4 py-1.5 text-sm ${a.label === l ? 'bg-ink text-milk' : 'bg-mist'}`}>{l}</button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('name', 'Full name', { required: true, autoComplete: 'name' })}
        {field('phone', 'Mobile', { required: true, inputMode: 'numeric', pattern: '[0-9]{10}', title: '10-digit mobile number', maxLength: 10, autoComplete: 'tel-national' })}
        <div className="sm:col-span-2">{field('line1', 'House / street / landmark', { required: true, autoComplete: 'street-address' })}</div>
        {field('pincode', 'Pincode', { required: true, inputMode: 'numeric', pattern: '[1-9][0-9]{5}', title: '6-digit pincode', maxLength: 6, autoComplete: 'postal-code' })}
        {field('city', 'City', { required: true, autoComplete: 'address-level2' })}
        {field('state', 'State', { required: true, autoComplete: 'address-level1' })}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={a.isDefault} onChange={set('isDefault')} /> Make this my default address</label>
      {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="btn-dark">{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn-light">Cancel</button>}
      </div>
    </form>
  );
}
