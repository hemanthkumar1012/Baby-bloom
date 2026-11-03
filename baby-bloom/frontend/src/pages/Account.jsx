import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import AddressForm from '../components/AddressForm';

export default function Account() {
  const { user, setUser } = useAuth();
  const [addresses, setAddresses] = useState(user?.addresses || []);
  const [editing, setEditing] = useState(null); // address object, 'new' or null
  const [optIn, setOptIn] = useState(user?.whatsappOptIn !== false);

  const sync = (list) => {
    setAddresses(list);
    setUser({ ...user, addresses: list });
    setEditing(null);
  };
  const save = async (a) => {
    sync(editing === 'new' ? await api('/me/addresses', { method: 'POST', body: a }) : await api(`/me/addresses/${editing._id}`, { method: 'PUT', body: a }));
  };
  const remove = async (a) => {
    if (confirm(`Delete the ${a.label} address?`)) sync(await api(`/me/addresses/${a._id}`, { method: 'DELETE' }));
  };
  const makeDefault = async (a) => sync(await api(`/me/addresses/${a._id}`, { method: 'PUT', body: { isDefault: true } }));
  const toggleWa = async () => {
    const u = await api('/auth/me', { method: 'PUT', body: { whatsappOptIn: !optIn } });
    setOptIn(u.whatsappOptIn);
    setUser({ ...user, whatsappOptIn: u.whatsappOptIn });
  };

  return (
    <div className="container-x py-12">
      <h1 className="display-lg">Hi, {user?.name?.split(' ')[0]}</h1>
      <p className="mt-1 text-sm text-ink/60">{user?.email}</p>
      <Link to="/orders" className="btn-light mt-4">My orders</Link>

      <section className="card mt-10 p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Saved addresses</h2>
          {!editing && addresses.length < 10 && <button onClick={() => setEditing('new')} className="btn-dark">+ Add address</button>}
        </div>
        {editing && (
          <div className="mt-6 rounded-2xl bg-mist p-5">
            <AddressForm initial={editing === 'new' ? { name: user?.name } : editing} onSave={save} onCancel={() => setEditing(null)} />
          </div>
        )}
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a._id} className="rounded-2xl border border-ink/10 p-4 text-sm">
              <p className="font-medium">{a.label} {a.isDefault && <span className="ml-1 rounded-full bg-mist px-2 py-0.5 text-[10px]">Default</span>}</p>
              <p className="mt-1 text-ink/70">{a.name} · {a.phone}</p>
              <p className="text-ink/60">{a.line1}, {a.city}, {a.state} {a.pincode}</p>
              <div className="mt-3 flex gap-3 text-xs">
                <button onClick={() => setEditing(a)} className="underline">Edit</button>
                {!a.isDefault && <button onClick={() => makeDefault(a)} className="underline">Make default</button>}
                <button onClick={() => remove(a)} className="text-red-600 underline">Delete</button>
              </div>
            </li>
          ))}
          {addresses.length === 0 && !editing && <li className="text-sm text-ink/50">No saved addresses yet.</li>}
        </ul>
      </section>

      <section className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-6 sm:p-8">
        <div>
          <h2 className="font-display text-2xl">Order updates</h2>
          <p className="mt-1 text-sm text-ink/60">Email updates and your GST invoice are always sent. WhatsApp updates go to the phone on each order.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={optIn} onChange={toggleWa} className="h-4 w-4" /> WhatsApp updates
        </label>
      </section>
    </div>
  );
}
