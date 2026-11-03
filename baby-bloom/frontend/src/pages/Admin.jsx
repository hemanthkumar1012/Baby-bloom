import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api, FALLBACK_IMG, cld, getToken, inr, invoiceUrl, openEvents } from '../api';
import StatusBadge from '../components/StatusBadge';

const BASE = import.meta.env.VITE_API_URL || '/api';
const NEXT = { Placed: 'Packed', Packed: 'Shipped', Shipped: 'Out for Delivery', 'Out for Delivery': 'Delivered' };
const tabs = [['', 'Dashboard'], ['orders', 'Orders'], ['products', 'Products'], ['stock', 'Stock'], ['coupons', 'Coupons'], ['banners', 'Banners'], ['refunds', 'Refunds'], ['customers', 'Customers']];
const dt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');

export default function Admin() {
  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl">Admin</h1>
        <nav className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-sm">
          {tabs.map(([p, l]) => (
            <NavLink key={l} end to={`/admin/${p}`} className={({ isActive }) => `whitespace-nowrap rounded-full px-4 py-2 text-sm ${isActive ? 'bg-ink text-milk' : 'hover:bg-mist'}`}>{l}</NavLink>
          ))}
        </nav>
      </div>
      <div className="mt-8">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<OrdersAdmin />} />
          <Route path="products" element={<ProductsAdmin />} />
          <Route path="stock" element={<StockAdmin />} />
          <Route path="coupons" element={<CouponsAdmin />} />
          <Route path="banners" element={<BannersAdmin />} />
          <Route path="refunds" element={<RefundsAdmin />} />
          <Route path="customers" element={<Customers />} />
        </Routes>
      </div>
    </div>
  );
}

/* ---------------- shared: modal + Cloudinary uploads ---------------- */
function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`card my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} p-6`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl">{title}</h2><button onClick={onClose} className="text-2xl leading-none" aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}

const toDataUri = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

async function uploadFiles(files, folder) {
  const urls = [];
  for (const f of files) {
    if (!/^image\/(png|jpe?g|webp|avif)$/.test(f.type)) throw new Error(`${f.name}: use PNG, JPG, WebP or AVIF`);
    if (f.size > 8 * 1024 * 1024) throw new Error(`${f.name} is larger than 8 MB`);
    const { url } = await api('/admin/upload', { method: 'POST', body: { file: await toDataUri(f), folder } });
    urls.push(url);
  }
  return urls;
}

/** Gallery manager: Cloudinary multi-upload, drag-free reordering, set cover, remove (also deletes from Cloudinary), paste URL. */
function ImageManager({ images, onChange }) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const move = (i, d) => { const a = [...images]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  const remove = (i) => {
    const gone = images[i];
    onChange(images.filter((_, k) => k !== i));
    api('/admin/upload', { method: 'DELETE', body: { url: gone } }).catch(() => {});
  };
  const pick = async (files) => {
    setErr('');
    setBusy(true);
    try {
      onChange([...images, ...(await uploadFiles(files, 'products'))]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((s, i) => (
          <div key={s + i} className="group relative overflow-hidden rounded-xl border border-ink/10">
            <img {...cld(s, 200)} alt="" className="aspect-square w-full object-cover" onError={(e) => (e.currentTarget.src = FALLBACK_IMG)} />
            {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-ink px-2 py-0.5 text-[10px] text-milk">Cover</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-white/90 px-1 py-1 text-xs opacity-0 transition group-hover:opacity-100">
              <button type="button" onClick={() => move(i, -1)} aria-label="Move left">←</button>
              {i !== 0 && <button type="button" onClick={() => { const a = [...images]; a.unshift(a.splice(i, 1)[0]); onChange(a); }}>Cover</button>}
              <button type="button" onClick={() => remove(i)} className="text-red-600">✕</button>
              <button type="button" onClick={() => move(i, 1)} aria-label="Move right">→</button>
            </div>
          </div>
        ))}
        <label
          className={`flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink/20 text-center text-xs text-ink/50 hover:border-blush ${busy ? 'opacity-50' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick([...e.dataTransfer.files]); }}
        >
          <span className="text-2xl">⬆</span>{busy ? 'Uploading…' : 'Upload / drop'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" multiple className="hidden" disabled={busy} onChange={(e) => { pick([...e.target.files]); e.target.value = ''; }} />
        </label>
      </div>
      <div className="mt-2 flex gap-2">
        <input className="input py-2 text-xs" placeholder="…or paste an image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="button" className="btn-light py-2 text-xs" onClick={() => { if (/^https?:\/\//.test(url)) { onChange([...images, url.trim()]); setUrl(''); } }}>Add</button>
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function Kpi({ label, value, sub, tone }) {
  return (
    <div className="card p-6">
      <p className="text-xs uppercase tracking-wider text-ink/50">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      {sub && <p className={`mt-1 text-xs ${tone === 'up' ? 'text-green-700' : tone === 'down' ? 'text-red-600' : 'text-ink/50'}`}>{sub}</p>}
    </div>
  );
}

function Dashboard() {
  const [s, setS] = useState(null);
  const [days, setDays] = useState(7);
  const load = useCallback(() => api(`/admin/stats?days=${days}`).then(setS).catch(() => {}), [days]);
  useEffect(() => {
    load();
    return openEvents({ 'order-new': load, order: load });
  }, [load]);
  if (!s) return <p className="text-ink/50">Loading…</p>;
  const max = Math.max(1, ...s.daily.map((d) => d.revenue));
  const catMax = Math.max(1, ...s.byCategory.map((c) => c.revenue));
  const g = s.period.growth;
  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-1">
        {[7, 30, 90].map((d) => <button key={d} onClick={() => setDays(d)} className={`rounded-full px-4 py-1.5 text-sm ${days === d ? 'bg-ink text-milk' : 'bg-white'}`}>{d} days</button>)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={`Net revenue · ${days}d`} value={inr(s.period.revenue)} sub={g === null ? 'No prior period' : `${g >= 0 ? '▲' : '▼'} ${Math.abs(g)}% vs previous ${days}d`} tone={g === null ? '' : g >= 0 ? 'up' : 'down'} />
        <Kpi label={`Orders · ${days}d`} value={s.period.orders} sub={`Avg. order ${inr(s.period.aov)}`} />
        <Kpi label="Customers" value={s.customers} sub={`${s.repeatRate}% ordered again`} />
        <Kpi label="Refunded" value={inr(s.refunds.sum)} sub={`${s.refunds.n} orders`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <NavLink to="/admin/orders" className="card flex items-center justify-between p-5 hover:shadow-2xl"><span>📦 Waiting to pack / ship</span><b className="font-display text-2xl">{s.toFulfil}</b></NavLink>
        <NavLink to="/admin/stock" className="card flex items-center justify-between p-5 hover:shadow-2xl"><span>⚠️ Low-stock products</span><b className="font-display text-2xl text-red-600">{s.lowStock.length}</b></NavLink>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <p className="font-display text-xl">Revenue · last {days} days</p>
          <div className="mt-6 flex h-48 items-end gap-1.5">
            {s.daily.length === 0 && <p className="text-sm text-ink/40">No paid orders in this period.</p>}
            {s.daily.map((d) => (
              <div key={d._id} className="group flex flex-1 flex-col items-center gap-2" title={`${d._id}: ${inr(d.revenue)} · ${d.orders} orders`}>
                <div className="w-full rounded-t-md bg-blush/80 transition group-hover:bg-blush" style={{ height: `${Math.max(4, (d.revenue / max) * 160)}px` }} />
                {s.daily.length <= 14 && <span className="text-[10px] text-ink/50">{d._id.slice(5)}</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="card p-6">
          <p className="font-display text-xl">Orders by status</p>
          <ul className="mt-4 space-y-2">{s.byStatus.map((b) => <li key={b._id} className="flex items-center justify-between"><StatusBadge s={b._id} /><b>{b.count}</b></li>)}</ul>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6">
          <p className="font-display text-xl">Sales by category</p>
          <ul className="mt-4 space-y-3 text-sm">
            {s.byCategory.map((c) => (
              <li key={c._id}><div className="flex justify-between"><span>{c._id}</span><span>{inr(c.revenue)}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-mist"><div className="h-full bg-sage" style={{ width: `${(c.revenue / catMax) * 100}%` }} /></div></li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <p className="font-display text-xl">Top sellers</p>
          <ul className="mt-4 space-y-2 text-sm">{s.top.map((t) => <li key={t._id} className="flex justify-between gap-3"><span className="truncate">{t._id}</span><span className="whitespace-nowrap">{t.qty} sold</span></li>)}</ul>
        </div>
        <div className="card p-6">
          <p className="font-display text-xl">Low stock</p>
          <ul className="mt-4 space-y-2 text-sm">{s.lowStock.length ? s.lowStock.map((p) => <li key={p._id} className="flex justify-between"><span>{p.name}</span><b className="text-red-600">{p.stock}</b></li>) : <li className="text-ink/40">All stocked up.</li>}</ul>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Orders: live → Pack → Ship → Delivery ---------------- */
function OrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('All');
  const [q, setQ] = useState('');
  const [flash, setFlash] = useState('');
  const [live, setLive] = useState(false);
  const [sel, setSel] = useState(new Set());
  const [ship, setShip] = useState(null); // order being shipped
  const [view, setView] = useState(null); // order id in the detail drawer
  const [couriers, setCouriers] = useState([]);
  const [notifyOk, setNotifyOk] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'granted');
  const qRef = useRef(q);
  qRef.current = q;

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ status: filter });
    if (qRef.current.trim()) qs.set('q', qRef.current.trim());
    setOrders(await api(`/admin/orders?${qs}`));
  }, [filter]);

  useEffect(() => {
    api('/admin/couriers').then(setCouriers).catch(() => {});
  }, []);

  useEffect(() => {
    load().catch(() => {});
    const close = openEvents({
      ready: () => setLive(true),
      'order-new': (e) => {
        setFlash(`🔔 New order ${e.orderNo} · ${inr(e.total)}`);
        try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=').play(); } catch { /* ignore */ }
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) new Notification('New BABY BLOOM order', { body: `${e.orderNo} · ${inr(e.total)}` });
        load().catch(() => {});
      },
      order: () => load().catch(() => {}),
      'low-stock': (e) => setFlash(`⚠️ Low stock: ${e.name} (${e.stock} left)`),
    });
    const t = setInterval(() => load().catch(() => {}), 60000); // safety net if the stream drops
    return () => { close(); clearInterval(t); };
  }, [load]);

  const move = async (o, status) => {
    if (status === 'Shipped') return setShip(o);
    try { await api(`/admin/orders/${o._id}/status`, { method: 'PATCH', body: { status } }); load(); } catch (e) { alert(e.message); }
  };
  const cancel = async (o) => {
    const note = prompt(`Cancel ${o.orderNo}? ${o.payment.status === 'paid' ? `A full refund of ${inr(o.total)} will be issued.` : ''}\nReason (shown to the customer):`, 'Out of stock');
    if (note === null) return;
    try { await api(`/admin/orders/${o._id}/status`, { method: 'PATCH', body: { status: 'Cancelled', note } }); load(); } catch (e) { alert(e.message); }
  };
  const bulk = async (status) => {
    const r = await api('/admin/orders/bulk-status', { method: 'POST', body: { ids: [...sel], status } }).catch((e) => ({ error: e.message }));
    setFlash(r.error || `Bulk → ${status}: ${r.updated} updated${r.skipped.length ? `, skipped ${r.skipped.join(', ')}` : ''}`);
    setSel(new Set());
    load();
  };
  const toggle = (id) => setSel((cur) => { const n = new Set(cur); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const label = (o) => `${BASE}/admin/orders/${o._id}/label?token=${encodeURIComponent(getToken() || '')}`;

  return (
    <div>
      {flash && <div className="mb-4 flex items-center justify-between rounded-2xl bg-blush/10 p-4 text-sm"><span>{flash}</span><button onClick={() => setFlash('')}>×</button></div>}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order no, name, phone or AWB" className="input w-64 rounded-full py-2" />
          <button className="btn-light py-2">Search</button>
        </form>
        {!notifyOk && typeof Notification !== 'undefined' && <button onClick={() => Notification.requestPermission().then((p) => setNotifyOk(p === 'granted'))} className="btn-light py-2">🔔 Desktop alerts</button>}
        <span className={`ml-auto flex items-center gap-2 text-xs ${live ? 'text-green-700' : 'text-ink/40'}`}><span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-green-500' : 'bg-gray-300'}`} />{live ? 'Live orders' : 'Connecting…'}</span>
      </div>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {['All', 'Placed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Pending Payment', 'Cancelled', 'Refunded'].map((s) => (
          <button key={s} onClick={() => { setFilter(s); setSel(new Set()); }} className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${filter === s ? 'bg-ink text-milk' : 'bg-white'}`}>{s}</button>
        ))}
      </div>
      {sel.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-ink p-3 text-sm text-milk">
          <span className="px-2">{sel.size} selected</span>
          {['Packed', 'Out for Delivery', 'Delivered'].map((s) => <button key={s} onClick={() => bulk(s)} className="rounded-full bg-milk/10 px-3 py-1.5 hover:bg-milk/20">→ {s}</button>)}
          <button onClick={() => setSel(new Set())} className="ml-auto px-2 underline">Clear</button>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-mist text-left text-xs uppercase tracking-wider text-ink/60">
            <tr>
              <th className="p-4"><input type="checkbox" aria-label="Select all" checked={orders.length > 0 && sel.size === orders.length} onChange={(e) => setSel(e.target.checked ? new Set(orders.map((o) => o._id)) : new Set())} /></th>
              <th className="py-4">Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {orders.map((o) => (
              <tr key={o._id} className={`align-top ${sel.has(o._id) ? 'bg-blush/5' : ''}`}>
                <td className="p-4"><input type="checkbox" aria-label={`Select ${o.orderNo}`} checked={sel.has(o._id)} onChange={() => toggle(o._id)} /></td>
                <td className="py-4">
                  <button onClick={() => setView(o._id)} className="font-mono underline-offset-2 hover:underline">{o.orderNo}</button>
                  <p className="text-xs text-ink/50">{dt(o.createdAt)} · {o.shipping?.method}</p>
                  {o.shipping?.trackingNo && <p className="text-xs text-ink/50">{o.shipping.courier} · {o.shipping.trackingNo}</p>}
                </td>
                <td className="py-4"><p>{o.address?.name}</p><p className="text-xs text-ink/50">{o.address?.phone} · {o.address?.city} {o.address?.pincode}</p></td>
                <td className="max-w-[220px] py-4 text-xs">{o.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}</td>
                <td className="py-4 font-medium">{inr(o.total)}{o.amountRefunded > 0 && <p className="text-xs text-green-700">−{inr(o.amountRefunded)}</p>}</td>
                <td className="py-4 text-xs">{o.payment.method}<br /><span className={o.payment.status === 'paid' ? 'text-green-700' : 'text-ink/50'}>{o.payment.status.replace('_', ' ')}</span></td>
                <td className="py-4"><StatusBadge s={o.status} /></td>
                <td className="space-x-1 whitespace-nowrap p-4 text-right">
                  {NEXT[o.status] && <button onClick={() => move(o, NEXT[o.status])} className="btn-dark px-3 py-1.5 text-xs">→ {NEXT[o.status]}</button>}
                  {['Placed', 'Packed'].includes(o.status) && <button onClick={() => cancel(o)} className="btn-light px-3 py-1.5 text-xs">Cancel</button>}
                  {!['Pending Payment', 'Cancelled'].includes(o.status) && <a href={label(o)} target="_blank" rel="noreferrer" className="btn-light px-3 py-1.5 text-xs">Label</a>}
                  <button onClick={() => setView(o._id)} className="btn-light px-3 py-1.5 text-xs">Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="p-8 text-center text-ink/40">No orders.</p>}
      </div>

      {ship && <ShipModal order={ship} couriers={couriers} onClose={() => setShip(null)} onDone={() => { setShip(null); load(); }} />}
      {view && <OrderDrawer id={view} onClose={() => setView(null)} onChange={load} />}
    </div>
  );
}

function ShipModal({ order, couriers, onClose, onDone }) {
  const [courier, setCourier] = useState(couriers[0] || 'Delhivery');
  const [awb, setAwb] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api(`/admin/orders/${order._id}/status`, { method: 'PATCH', body: { status: 'Shipped', courier, trackingNo: awb.trim() } });
      onDone();
    } catch (er) { setErr(er.message); }
  };
  return (
    <Modal title={`Ship ${order.orderNo}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-ink/60">{order.address?.name} · {order.address?.city} {order.address?.pincode} · {order.shipping?.method}</p>
        <select className="input" value={courier} onChange={(e) => setCourier(e.target.value)}>{couriers.map((c) => <option key={c}>{c}</option>)}</select>
        <input className="input font-mono" placeholder="AWB / tracking number" value={awb} onChange={(e) => setAwb(e.target.value)} required pattern="[A-Za-z0-9-]{6,30}" title="6–30 letters, digits or -" autoFocus />
        <p className="text-xs text-ink/50">The customer gets an email + WhatsApp with a {courier} tracking link.</p>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-dark w-full">Mark as shipped</button>
      </form>
    </Modal>
  );
}

/** Order detail + item-level / partial refunds + resend notifications. */
function OrderDrawer({ id, onClose, onChange }) {
  const [o, setO] = useState(null);
  const [lines, setLines] = useState({});
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [restockIt, setRestockIt] = useState(null);
  const [msg, setMsg] = useState('');
  const load = useCallback(() => api(`/admin/orders/${id}`).then((x) => { setO(x); setRestockIt(!['Shipped', 'Out for Delivery', 'Delivered'].includes(x.status)); }), [id]);
  useEffect(() => { load(); }, [load]);
  if (!o) return <Modal title="Order" onClose={onClose}><p className="text-ink/50">Loading…</p></Modal>;

  const refundable = ['paid', 'partially_refunded'].includes(o.payment.status);
  const chosen = Object.entries(lines).filter(([, q]) => q > 0).map(([product, qty]) => ({ product, qty }));
  const refund = async (mode) => {
    const body = { reason, restock: restockIt };
    if (mode === 'items') body.items = chosen;
    if (mode === 'amount') body.amount = Number(amount);
    const label = mode === 'full' ? `full refund of ${inr(o.total - o.amountRefunded)}` : mode === 'amount' ? `refund of ${inr(amount)}` : 'refund for the selected items';
    if (!confirm(`Issue a ${label} to the customer's ${o.payment.method}?`)) return;
    try {
      await api(`/admin/orders/${o._id}/refund`, { method: 'POST', body });
      setMsg('✓ Refund processed');
      setLines({});
      setAmount('');
      await load();
      onChange();
    } catch (e) { setMsg(e.message); }
  };
  const resend = async () => {
    const r = await api(`/admin/orders/${o._id}/notify`, { method: 'POST' }).catch((e) => ({ error: e.message }));
    setMsg(r.error || `✓ Sent: ${r.results.map((x) => `${x.channel} ${x.ok ? '✓' : '✕'}`).join(', ') || 'nothing to send'}`);
    load();
  };

  return (
    <Modal title={`Order ${o.orderNo}`} onClose={onClose} wide>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge s={o.status} /><span className="text-xs text-ink/50">{o.payment.method} · {o.payment.status.replace('_', ' ')}{o.invoice?.number ? ` · ${o.invoice.number}` : ''}</span></div>
          <div><p className="font-medium">{o.address.name} · {o.address.phone}</p><p className="text-ink/60">{o.address.line1}, {o.address.city}, {o.address.state} {o.address.pincode}</p><p className="text-xs text-ink/50">{o.user?.email}</p></div>
          <div>
            <p className="eyebrow mb-2">Timeline</p>
            <ol className="space-y-1.5 border-l border-ink/10 pl-4">{o.timeline.map((t, k) => <li key={k} className="text-xs"><b>{t.status}</b> · {dt(t.at)}{t.note ? ` — ${t.note}` : ''}</li>)}</ol>
          </div>
          {o.payment.attempts?.length > 0 && (
            <div><p className="eyebrow mb-2">Payment attempts</p><ul className="space-y-1 text-xs">{o.payment.attempts.map((a, k) => <li key={k}>{dt(a.at)} · {a.gateway} · <b className={a.status === 'paid' ? 'text-green-700' : a.status === 'failed' ? 'text-red-600' : ''}>{a.status}</b>{a.error ? ` — ${a.error}` : ''}</li>)}</ul></div>
          )}
          {o.notifications?.length > 0 && (
            <div><p className="eyebrow mb-2">Email / WhatsApp</p><ul className="space-y-1 text-xs">{o.notifications.slice(-8).map((n, k) => <li key={k}>{dt(n.at)} · {n.channel} · {n.event} {n.ok ? '✓' : '✕'}</li>)}</ul></div>
          )}
          <div className="flex flex-wrap gap-2">
            {o.invoice?.number && <a href={invoiceUrl(o._id)} target="_blank" rel="noreferrer" className="btn-light px-3 py-1.5 text-xs">GST invoice</a>}
            <button onClick={resend} className="btn-light px-3 py-1.5 text-xs">Resend email / WhatsApp</button>
          </div>
        </div>

        <div className="rounded-2xl bg-mist p-4 text-sm">
          <p className="font-display text-xl">Refund</p>
          <p className="text-xs text-ink/60">Paid {inr(o.total)} · refunded {inr(o.amountRefunded)} · left {inr(o.total - o.amountRefunded)}</p>
          {!refundable ? (
            <p className="mt-4 text-xs text-ink/50">{o.payment.status === 'refunded' ? 'Fully refunded.' : 'Refunds are available once the order is paid.'}</p>
          ) : (
            <div className="mt-4 space-y-3">
              <ul className="space-y-2">
                {o.items.map((i) => {
                  const left = i.qty - (i.refundedQty || 0);
                  return (
                    <li key={i.product} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex-1">{i.name} <span className="text-ink/40">({left}/{i.qty} refundable)</span></span>
                      <input type="number" min="0" max={left} disabled={!left} value={lines[i.product] || 0} onChange={(e) => setLines({ ...lines, [i.product]: Math.min(left, Math.max(0, Number(e.target.value))) })} className="input w-16 py-1 text-xs" aria-label={`Refund qty for ${i.name}`} />
                    </li>
                  );
                })}
              </ul>
              <input className="input py-2 text-xs" placeholder="Reason (shown to the customer)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!restockIt} onChange={(e) => setRestockIt(e.target.checked)} /> Put refunded items back in stock</label>
              <div className="flex flex-wrap gap-2">
                <button disabled={!chosen.length} onClick={() => refund('items')} className="btn-dark px-3 py-1.5 text-xs">Refund selected items</button>
                <button onClick={() => refund('full')} className="btn-light px-3 py-1.5 text-xs">Full refund</button>
              </div>
              <div className="flex gap-2">
                <input type="number" min="1" className="input py-1.5 text-xs" placeholder="Custom amount ₹ (e.g. shipping)" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <button disabled={!(Number(amount) > 0)} onClick={() => refund('amount')} className="btn-light px-3 py-1.5 text-xs">Refund ₹</button>
              </div>
            </div>
          )}
          {o.refunds?.length > 0 && <ul className="mt-4 space-y-1 border-t border-ink/10 pt-3 text-xs">{o.refunds.map((r, k) => <li key={k}>{dt(r.at)} · <b>{inr(r.amount)}</b> · {r.reason || '—'} · {r.gatewayRefundId}</li>)}</ul>}
          {msg && <p className="mt-3 text-xs text-blush">{msg}</p>}
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Products ---------------- */
const CATS = ['Bath & Skin', 'Diapering', 'Feeding', 'Clothing', 'Toys', 'Mom Care'];
const AGE_OPTIONS = ['', '0-6 M', '6-12 M', '1-2 Y', '2-4 Y', 'Mom'];
const EMPTY = { name: '', brand: 'Baby Bloom', sku: '', price: '', mrp: '', category: 'Bath & Skin', ageGroup: '', stock: 10, lowStockThreshold: 5, size: '', hsn: '3401', images: [], features: '', description: '', isBestseller: false, active: true };

function ProductsAdmin() {
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const load = () => api('/admin/products').then(setList);
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    const body = { ...edit, price: +edit.price, mrp: +edit.mrp || undefined, stock: +edit.stock, lowStockThreshold: +edit.lowStockThreshold, features: String(edit.features || '').split(/\n|,/).map((s) => s.trim()).filter(Boolean) };
    try {
      if (edit._id) await api(`/admin/products/${edit._id}`, { method: 'PUT', body });
      else await api('/admin/products', { method: 'POST', body });
      setEdit(null);
      load();
    } catch (er) { setErr(er.message); }
  };
  const del = async (p) => { if (confirm(`Hide ${p.name} from the store? Order history is kept.`)) { await api(`/admin/products/${p._id}`, { method: 'DELETE' }); load(); } };
  const shown = list.filter((p) => !q || `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(q.toLowerCase()));
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setEdit({ ...EMPTY })} className="btn-dark">+ New product</button>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SKU, category" className="input w-64 rounded-full py-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <div key={p._id} className={`card flex gap-4 p-4 ${p.active ? '' : 'opacity-50'}`}>
            <img {...cld(p.images?.[0], 200)} onError={(e) => (e.currentTarget.src = FALLBACK_IMG)} className="h-20 w-20 rounded-xl object-cover" alt="" />
            <div className="flex flex-1 flex-col">
              <p className="font-medium leading-tight">{p.name}</p>
              <p className="text-xs text-ink/50">{p.sku} · {p.category} · {inr(p.price)}{p.mrp > p.price ? <s className="ml-1">{inr(p.mrp)}</s> : null}</p>
              <p className="text-xs text-ink/50">{p.images?.length || 0} images · stock <b className={p.stock <= p.lowStockThreshold ? 'text-red-600' : ''}>{p.stock}</b>{!p.active && ' · hidden'}{p.isBestseller && ' · ★ bestseller'}</p>
              <div className="mt-auto flex gap-3 pt-2 text-xs">
                <button onClick={() => setEdit({ ...p, features: (p.features || []).join(', ') })} className="underline">Edit</button>
                {p.active ? <button onClick={() => del(p)} className="text-red-600 underline">Hide</button> : <button onClick={() => api(`/admin/products/${p._id}`, { method: 'PUT', body: { active: true } }).then(load)} className="underline">Restore</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <Modal title={edit._id ? 'Edit product' : 'New product'} onClose={() => setEdit(null)} wide>
          <form onSubmit={save} className="space-y-4">
            <div>
              <p className="mb-2 text-sm text-ink/60">Premium images (first = cover, shown on the product card)</p>
              <ImageManager images={edit.images || []} onChange={(images) => setEdit((cur) => ({ ...cur, images }))} />
            </div>
            <input className="input" placeholder="Product name" value={edit.name} onChange={set('name')} required />
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-ink/60">Price ₹<input className="input mt-1" type="number" min="0" value={edit.price} onChange={set('price')} required /></label>
              <label className="text-xs text-ink/60">MRP ₹<input className="input mt-1" type="number" min="0" value={edit.mrp || ''} onChange={set('mrp')} /></label>
              {!edit._id ? (
                <label className="text-xs text-ink/60">Opening stock<input className="input mt-1" type="number" min="0" value={edit.stock} onChange={set('stock')} /></label>
              ) : (
                <p className="text-xs text-ink/60">Stock <b className="block text-base text-ink">{edit.stock}</b>adjust in the Stock tab</p>
              )}
              <label className="text-xs text-ink/60">Category
                <input className="input mt-1" list="bb-cats" value={edit.category} onChange={set('category')} required />
                <datalist id="bb-cats">{CATS.map((c) => <option key={c} value={c} />)}</datalist>
              </label>
              <label className="text-xs text-ink/60">Age group<select className="input mt-1" value={edit.ageGroup || ''} onChange={set('ageGroup')}>{AGE_OPTIONS.map((a) => <option key={a} value={a}>{a || '—'}</option>)}</select></label>
              <label className="text-xs text-ink/60">Low-stock alert at<input className="input mt-1" type="number" min="0" value={edit.lowStockThreshold} onChange={set('lowStockThreshold')} /></label>
              <label className="text-xs text-ink/60">Brand<input className="input mt-1" value={edit.brand || ''} onChange={set('brand')} /></label>
              <label className="text-xs text-ink/60">SKU<input className="input mt-1" placeholder="auto" value={edit.sku || ''} onChange={set('sku')} /></label>
              <label className="text-xs text-ink/60">HSN (GST invoice)<input className="input mt-1" value={edit.hsn || ''} onChange={set('hsn')} /></label>
            </div>
            <input className="input" placeholder="Size (e.g. 200 ml, M · 7–12 kg)" value={edit.size || ''} onChange={set('size')} />
            <input className="input" placeholder="Highlights, comma separated (e.g. Paraben free, Tear-free)" value={edit.features || ''} onChange={set('features')} />
            <textarea className="input h-28" placeholder="Description" value={edit.description || ''} onChange={set('description')} />
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!edit.isBestseller} onChange={set('isBestseller')} />Bestseller</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!edit.active} onChange={set('active')} />Visible in store</label>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setEdit(null)} className="btn-light">Cancel</button><button className="btn-dark">Save product</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Stock ---------------- */
function StockAdmin() {
  const [data, setData] = useState({ items: [], totals: {} });
  const [log, setLog] = useState([]);
  const [adj, setAdj] = useState(null); // { product, change, reason, note }
  const [only, setOnly] = useState('all');
  const load = () => {
    api('/admin/stock').then(setData).catch(() => {});
    api('/admin/inventory-log').then(setLog).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  const apply = async (e) => {
    e.preventDefault();
    try {
      await api(`/admin/stock/${adj.product._id}/adjust`, { method: 'POST', body: { change: adj.sign * Math.abs(Number(adj.qty)), reason: adj.reason, note: adj.note } });
      setAdj(null);
      load();
    } catch (er) { alert(er.message); }
  };
  const t = data.totals;
  const items = data.items.filter((p) => only === 'all' || (only === 'low' ? p.stock > 0 && p.stock <= p.lowStockThreshold : p.stock === 0));
  const C = { sale: 'text-red-600', damage: 'text-red-600', cancel: 'text-green-700', refund: 'text-green-700', restock: 'text-green-700', correction: '' };
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Kpi label="SKUs" value={t.skus ?? '—'} />
        <Kpi label="Units on hand" value={t.units ?? '—'} />
        <Kpi label="Stock value" value={inr(t.value)} />
        <Kpi label="Low / out" value={`${t.low ?? 0} / ${t.out ?? 0}`} tone={t.out ? 'down' : ''} sub="needs restock" />
      </div>
      <div className="flex gap-2">{[['all', 'All'], ['low', 'Low stock'], ['out', 'Out of stock']].map(([v, l]) => <button key={v} onClick={() => setOnly(v)} className={`rounded-full px-4 py-1.5 text-sm ${only === v ? 'bg-ink text-milk' : 'bg-white'}`}>{l}</button>)}</div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-mist text-left text-xs uppercase tracking-wider text-ink/60"><tr><th className="p-4">Product</th><th>SKU</th><th>Stock</th><th>Alert at</th><th>Value</th><th className="p-4 text-right">Adjust</th></tr></thead>
          <tbody className="divide-y divide-ink/5">
            {items.map((p) => (
              <tr key={p._id}>
                <td className="flex items-center gap-3 p-4"><img {...cld(p.images?.[0], 80)} alt="" className="h-10 w-10 rounded-lg object-cover" />{p.name}</td>
                <td className="font-mono text-xs">{p.sku}</td>
                <td><b className={p.stock === 0 ? 'text-red-600' : p.stock <= p.lowStockThreshold ? 'text-amber-600' : ''}>{p.stock}</b></td>
                <td>{p.lowStockThreshold}</td>
                <td>{inr(p.stock * p.price)}</td>
                <td className="space-x-1 p-4 text-right">
                  <button onClick={() => setAdj({ product: p, sign: 1, qty: '', reason: 'restock', note: '' })} className="btn-dark px-3 py-1.5 text-xs">+ Restock</button>
                  <button onClick={() => setAdj({ product: p, sign: -1, qty: '', reason: 'damage', note: '' })} className="btn-light px-3 py-1.5 text-xs">− Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card overflow-x-auto">
        <p className="p-4 font-display text-xl">Stock movements</p>
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-mist text-left text-xs uppercase tracking-wider text-ink/60"><tr><th className="p-4">When</th><th>Product</th><th>Change</th><th>After</th><th>Reason</th><th>Ref</th><th>By</th></tr></thead>
          <tbody className="divide-y divide-ink/5">
            {log.map((r) => (
              <tr key={r._id}><td className="p-4 text-xs text-ink/60">{dt(r.createdAt)}</td><td>{r.name}</td><td className={`font-mono font-medium ${C[r.reason] || ''}`}>{r.change > 0 ? `+${r.change}` : r.change}</td><td>{r.after ?? '—'}</td><td className="capitalize">{r.reason}</td><td className="font-mono text-xs">{r.ref}</td><td className="text-xs">{r.by?.name || 'system'}</td></tr>
            ))}
          </tbody>
        </table>
        {log.length === 0 && <p className="p-8 text-center text-ink/40">No stock movements yet.</p>}
      </div>
      {adj && (
        <Modal title={`${adj.sign > 0 ? 'Add' : 'Remove'} stock · ${adj.product.name}`} onClose={() => setAdj(null)}>
          <form onSubmit={apply} className="space-y-3">
            <p className="text-sm text-ink/60">Current stock: <b>{adj.product.stock}</b></p>
            <input className="input" type="number" min="1" placeholder="Quantity" value={adj.qty} onChange={(e) => setAdj({ ...adj, qty: e.target.value })} required autoFocus />
            <select className="input" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })}>
              {(adj.sign > 0 ? [['restock', 'New stock received'], ['correction', 'Count correction']] : [['damage', 'Damaged / expired'], ['correction', 'Count correction']]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input className="input" placeholder="Note (e.g. PO-1042, batch, supplier)" value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
            <button className="btn-dark w-full">Save</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Coupons (advanced rules + usage) ---------------- */
const COUPON_EMPTY = { code: '', description: '', type: 'percent', value: '', minOrder: 0, maxDiscount: '', perUserLimit: '', usageLimit: '', firstOrderOnly: false, categories: '', startsAt: '', expiresAt: '', public: true };

function CouponsAdmin() {
  const [list, setList] = useState([]);
  const [f, setF] = useState(COUPON_EMPTY);
  const [err, setErr] = useState('');
  const load = () => api('/admin/coupons').then(setList);
  useEffect(() => { load(); }, []);
  const num = (v) => (v === '' || v === null ? undefined : Number(v));
  const add = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await api('/admin/coupons', {
        method: 'POST',
        body: { ...f, value: Number(f.value), minOrder: Number(f.minOrder) || 0, maxDiscount: num(f.maxDiscount), perUserLimit: num(f.perUserLimit), usageLimit: num(f.usageLimit), categories: String(f.categories).split(',').map((c) => c.trim()).filter(Boolean), startsAt: f.startsAt || undefined, expiresAt: f.expiresAt || undefined },
      });
      setF(COUPON_EMPTY);
      load();
    } catch (er) { setErr(er.message); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={add} className="card h-fit space-y-3 p-6">
        <h2 className="font-display text-xl">New coupon</h2>
        <input className="input font-mono" placeholder="CODE" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '') })} required />
        <input className="input" placeholder="Description shown at checkout" value={f.description} onChange={set('description')} />
        <div className="grid grid-cols-2 gap-3">
          <select className="input" value={f.type} onChange={set('type')}><option value="percent">% off</option><option value="flat">₹ flat</option></select>
          <input className="input" type="number" min="1" placeholder="Value" value={f.value} onChange={set('value')} required />
          <input className="input" type="number" min="0" placeholder="Min order ₹" value={f.minOrder} onChange={set('minOrder')} />
          <input className="input" type="number" min="0" placeholder="Max discount ₹" value={f.maxDiscount} onChange={set('maxDiscount')} />
          <input className="input" type="number" min="0" placeholder="Uses per customer" value={f.perUserLimit} onChange={set('perUserLimit')} />
          <input className="input" type="number" min="0" placeholder="Total uses" value={f.usageLimit} onChange={set('usageLimit')} />
          <label className="text-xs text-ink/60">Starts<input className="input mt-1" type="date" value={f.startsAt} onChange={set('startsAt')} /></label>
          <label className="text-xs text-ink/60">Expires<input className="input mt-1" type="date" value={f.expiresAt} onChange={set('expiresAt')} /></label>
        </div>
        <input className="input" placeholder="Only categories (comma separated, blank = all)" value={f.categories} onChange={set('categories')} />
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.firstOrderOnly} onChange={set('firstOrderOnly')} />First order only</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.public} onChange={set('public')} />Show at checkout</label>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-dark w-full">Create coupon</button>
      </form>
      <ul className="card divide-y divide-ink/5">
        {list.map((c) => (
          <li key={c._id} className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
            <div>
              <p className="font-mono font-semibold">{c.code} {!c.public && <span className="ml-1 rounded bg-mist px-1.5 font-sans text-[10px]">hidden</span>}</p>
              <p className="text-xs text-ink/50">
                {c.type === 'percent' ? `${c.value}% off` : `${inr(c.value)} off`} · min {inr(c.minOrder)}{c.maxDiscount ? ` · up to ${inr(c.maxDiscount)}` : ''}
                {c.firstOrderOnly ? ' · first order' : ''}{c.perUserLimit ? ` · ${c.perUserLimit}/customer` : ''}{c.usageLimit ? ` · ${c.usageLimit} total` : ''}
                {c.categories?.length ? ` · ${c.categories.join(', ')}` : ''}{c.expiresAt ? ` · till ${new Date(c.expiresAt).toLocaleDateString('en-IN')}` : ''}
              </p>
              <p className="mt-1 text-xs"><b>{c.stats.uses}</b> uses · {inr(c.stats.discount)} given · {inr(c.stats.revenue)} revenue{c.usageLimit ? ` · ${Math.max(0, c.usageLimit - c.stats.uses)} left` : ''}</p>
            </div>
            <div className="flex shrink-0 gap-3">
              <button onClick={() => api(`/admin/coupons/${c._id}`, { method: 'PUT', body: { active: !c.active } }).then(load)} className={c.active ? 'text-green-700' : 'text-ink/40'}>{c.active ? '● Active' : '○ Paused'}</button>
              <button onClick={() => confirm(`Delete ${c.code}?`) && api(`/admin/coupons/${c._id}`, { method: 'DELETE' }).then(load)} className="text-red-600 underline">Delete</button>
            </div>
          </li>
        ))}
        {list.length === 0 && <li className="p-6 text-center text-ink/40">No coupons.</li>}
      </ul>
    </div>
  );
}

/* ---------------- Banners (Cloudinary, scheduled, ordered) ---------------- */
const BANNER_EMPTY = { eyebrow: '', title: '', subtitle: '', image: '', mobileImage: '', cta: 'Shop now', link: '/shop', startsAt: '', endsAt: '', active: true };
const isLive = (b) => b.active && (!b.startsAt || new Date(b.startsAt) <= new Date()) && (!b.endsAt || new Date(b.endsAt) >= new Date());
const toDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

function BannersAdmin() {
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const load = () => api('/admin/banners').then(setList);
  useEffect(() => { load(); }, []);
  const upload = async (key, files) => {
    setBusy(key);
    setErr('');
    try {
      const [url] = await uploadFiles(files, 'banners');
      setEdit((cur) => ({ ...cur, [key]: url }));
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const save = async (e) => {
    e.preventDefault();
    const body = { ...edit, startsAt: edit.startsAt || null, endsAt: edit.endsAt || null };
    try {
      if (edit._id) await api(`/admin/banners/${edit._id}`, { method: 'PUT', body });
      else await api('/admin/banners', { method: 'POST', body });
      setEdit(null);
      load();
    } catch (er) { setErr(er.message); }
  };
  const move = async (i, d) => {
    const ids = list.map((b) => b._id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setList(await api('/admin/banners-order', { method: 'PUT', body: { ids } }));
  };
  return (
    <div>
      <button onClick={() => setEdit({ ...BANNER_EMPTY })} className="btn-dark mb-4">+ New banner</button>
      <div className="space-y-3">
        {list.map((b, i) => (
          <div key={b._id} className="card flex flex-wrap items-center gap-4 p-3">
            <div className="flex flex-col"><button onClick={() => move(i, -1)} aria-label="Move up" className="px-2">▲</button><button onClick={() => move(i, 1)} aria-label="Move down" className="px-2">▼</button></div>
            <img {...cld(b.image, 320)} onError={(e) => (e.currentTarget.src = FALLBACK_IMG)} className="h-20 w-36 rounded-xl object-cover" alt="" />
            <div className="min-w-[200px] flex-1">
              <p className="font-display">{b.title}</p>
              <p className="text-xs text-ink/50">{b.subtitle}</p>
              <p className="mt-1 text-xs">{isLive(b) ? <span className="text-green-700">● Live</span> : <span className="text-ink/40">○ {b.active ? 'Scheduled' : 'Off'}</span>}{b.startsAt ? ` · from ${new Date(b.startsAt).toLocaleDateString('en-IN')}` : ''}{b.endsAt ? ` · until ${new Date(b.endsAt).toLocaleDateString('en-IN')}` : ''} · {b.link}</p>
            </div>
            <button onClick={() => setEdit({ ...b, startsAt: toDate(b.startsAt), endsAt: toDate(b.endsAt) })} className="text-sm underline">Edit</button>
            <button onClick={() => api(`/admin/banners/${b._id}`, { method: 'PUT', body: { active: !b.active } }).then(load)} className="text-sm underline">{b.active ? 'Turn off' : 'Turn on'}</button>
            <button onClick={() => confirm('Delete this banner?') && api(`/admin/banners/${b._id}`, { method: 'DELETE' }).then(load)} className="px-2 text-sm text-red-600 underline">Delete</button>
          </div>
        ))}
        {list.length === 0 && <p className="card p-8 text-center text-ink/40">No banners — the home page shows a default hero.</p>}
      </div>

      {edit && (
        <Modal title={edit._id ? 'Edit banner' : 'New banner'} onClose={() => setEdit(null)} wide>
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {[['image', 'Desktop image (wide)'], ['mobileImage', 'Mobile image (optional, portrait)']].map(([k, l]) => (
                <div key={k}>
                  <p className="mb-1 text-xs text-ink/60">{l}</p>
                  {edit[k] && <img {...cld(edit[k], 600)} alt="" className="mb-2 aspect-[2/1] w-full rounded-xl object-cover" />}
                  <div className="flex gap-2">
                    <label className="btn-light cursor-pointer py-2 text-xs">{busy === k ? 'Uploading…' : '⬆ Upload'}<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="hidden" onChange={(e) => e.target.files[0] && upload(k, [e.target.files[0]])} /></label>
                    <input className="input py-2 text-xs" placeholder="or image URL" value={edit[k] || ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
                  </div>
                </div>
              ))}
            </div>
            <input className="input" placeholder="Small line above the title (optional)" value={edit.eyebrow || ''} onChange={(e) => setEdit({ ...edit, eyebrow: e.target.value })} />
            <input className="input" placeholder="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required />
            <input className="input" placeholder="Subtitle" value={edit.subtitle || ''} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Button text" value={edit.cta || ''} onChange={(e) => setEdit({ ...edit, cta: e.target.value })} />
              <input className="input" placeholder="Link (e.g. /shop?category=Diapering)" value={edit.link || ''} onChange={(e) => setEdit({ ...edit, link: e.target.value })} />
              <label className="text-xs text-ink/60">Show from<input className="input mt-1" type="date" value={edit.startsAt || ''} onChange={(e) => setEdit({ ...edit, startsAt: e.target.value })} /></label>
              <label className="text-xs text-ink/60">Show until<input className="input mt-1" type="date" value={edit.endsAt || ''} onChange={(e) => setEdit({ ...edit, endsAt: e.target.value })} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />Active</label>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setEdit(null)} className="btn-light">Cancel</button><button className="btn-dark">Save banner</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Refunds ---------------- */
function RefundsAdmin() {
  const [data, setData] = useState({ rows: [], total: 0 });
  useEffect(() => { api('/admin/refunds').then(setData).catch(() => {}); }, []);
  return (
    <div>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Kpi label="Refunds issued" value={data.rows.length} />
        <Kpi label="Total refunded" value={inr(data.total)} />
        <Kpi label="Partial refunds" value={data.rows.filter((r) => r.amount < r.orderTotal).length} sub="item-level or custom amount" />
      </div>
      <p className="mb-3 text-sm text-ink/60">Issue refunds from <b>Orders → Details</b> — full, per item, or a custom amount. Money goes back through Razorpay / Stripe.</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-mist text-left text-xs uppercase tracking-wider text-ink/60"><tr><th className="p-4">When</th><th>Order</th><th>Customer</th><th>Amount</th><th>Items</th><th>Reason</th><th>Gateway ref</th><th>Status</th></tr></thead>
          <tbody className="divide-y divide-ink/5">
            {data.rows.map((r, k) => (
              <tr key={k}>
                <td className="p-4 text-xs text-ink/60">{dt(r.at)}</td><td className="font-mono">{r.orderNo}</td><td>{r.customer}</td>
                <td className="font-medium">{inr(r.amount)}<span className="block text-xs text-ink/40">of {inr(r.orderTotal)}</span></td>
                <td className="text-xs">{r.items?.map((i) => `${i.name} ×${i.qty}`).join(', ') || '—'}{r.restocked && <span className="block text-green-700">restocked</span>}</td>
                <td className="text-xs">{r.reason || '—'}</td><td className="font-mono text-xs">{r.gateway} · {r.gatewayRefundId}</td><td className="text-xs capitalize">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.rows.length === 0 && <p className="p-8 text-center text-ink/40">No refunds yet.</p>}
      </div>
    </div>
  );
}

/* ---------------- Customers ---------------- */
function Customers() {
  const [list, setList] = useState([]);
  useEffect(() => { api('/admin/customers').then(setList).catch(() => {}); }, []);
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="bg-mist text-left text-xs uppercase tracking-wider text-ink/60"><tr><th className="p-4">Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Spent</th><th>Last order</th><th>Joined</th></tr></thead>
        <tbody className="divide-y divide-ink/5">
          {list.map((u) => (
            <tr key={u._id}><td className="p-4">{u.name}</td><td>{u.email}</td><td>{u.phone || '—'}</td><td>{u.orders}</td><td>{inr(u.spent)}</td><td>{u.lastOrder ? new Date(u.lastOrder).toLocaleDateString('en-IN') : '—'}</td><td>{new Date(u.createdAt).toLocaleDateString('en-IN')}</td></tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <p className="p-8 text-center text-ink/40">No customers yet.</p>}
    </div>
  );
}
