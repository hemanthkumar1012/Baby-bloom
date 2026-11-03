import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, FALLBACK_IMG, cld, inr, invoiceUrl, openEvents } from '../api';
import StatusBadge from '../components/StatusBadge';

const STEPS = ['Placed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];
const ICONS = { Placed: '🧾', Packed: '📦', Shipped: '🚚', 'Out for Delivery': '🛵', Delivered: '🏡' };
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const loadScript = (src) =>
  new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = rej;
    document.body.appendChild(s);
  });

export default function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [o, setO] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);

  const load = useCallback(() => api(`/orders/${id}`).then(setO).catch((e) => setErr(e.message)), [id]);

  // Live tracking: Server-Sent Events push each status change; a slow poll is the safety net
  useEffect(() => {
    load();
    const close = openEvents({ ready: () => setLive(true), order: (e) => String(e._id) === id && load(), 'order-new': (e) => String(e._id) === id && load() });
    const t = setInterval(load, 60000);
    return () => { close(); clearInterval(t); };
  }, [load, id]);

  // Back from Stripe hosted checkout → confirm the session on the server
  const stripeSession = params.get('stripe_session');
  useEffect(() => {
    if (!stripeSession) return;
    setBusy(true);
    api('/payments/stripe/verify', { method: 'POST', body: { orderId: id, sessionId: stripeSession } })
      .then(load)
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false));
  }, [stripeSession, id, load]);
  useEffect(() => {
    if (params.get('stripe_cancelled') || params.get('payment') === 'pending') setErr('Payment was not completed. Your order is saved — you can pay below.');
    if (params.get('payment') === 'failed') setErr('Payment failed. No money was taken — please try again.');
  }, [params]);

  const pay = async () => {
    setBusy(true);
    setErr('');
    try {
      if (o.payment.method === 'stripe') {
        const s = await api('/payments/stripe/session', { method: 'POST', body: { orderId: id } });
        if (!s.alreadyPaid) window.location.href = s.url;
        return;
      }
      const p = await api('/payments/create', { method: 'POST', body: { orderId: id } });
      if (p.alreadyPaid) return load();
      if (p.mode === 'demo') {
        await api('/payments/verify', { method: 'POST', body: { orderId: id } });
      } else {
        await loadScript('https://checkout.razorpay.com/v1/checkout.js');
        await new Promise((res, rej) => {
          const rz = new window.Razorpay({
            key: p.keyId, amount: p.amount, currency: 'INR', order_id: p.razorpayOrderId, name: 'BABY BLOOM', prefill: p.prefill, theme: { color: '#2F2A3D' },
            handler: (r) => api('/payments/verify', { method: 'POST', body: { orderId: id, ...r } }).then(res, rej),
            modal: { ondismiss: () => { api('/payments/failed', { method: 'POST', body: { orderId: id, reason: 'dismissed' } }).catch(() => {}); rej(new Error('Payment cancelled')); } },
          });
          rz.on('payment.failed', (r) => api('/payments/failed', { method: 'POST', body: { orderId: id, error: r.error?.description, ref: r.error?.metadata?.payment_id } }).catch(() => {}));
          rz.open();
        });
      }
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirm(o.payment.status === 'paid' ? 'Cancel this order? You will get a full refund to your original payment method.' : 'Cancel this order?')) return;
    try {
      setO(await api(`/orders/${id}/cancel`, { method: 'POST' }));
    } catch (e) {
      setErr(e.message);
    }
  };

  if (!o) return <div className="container-x py-32 text-center text-ink/50">{err || 'Loading…'}</div>;
  const idx = STEPS.indexOf(o.status);
  const at = (s) => o.timeline?.filter((t) => t.status === s).pop()?.at;
  const g = o.gst;

  return (
    <div className="container-x py-12">
      {(params.get('placed') || stripeSession) && o.status === 'Placed' && (
        <div className="mb-8 rounded-[24px] bg-ink p-8 text-center text-milk">
          <p className="text-4xl">🎉</p>
          <h1 className="mt-3 font-display text-3xl">Order confirmed!</h1>
          <p className="mt-2 text-milk/70">Your GST invoice is on its way to your email. Expected by {o.shipping?.eta ? new Date(o.shipping.eta).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }) : 'soon'}.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/orders" className="text-sm text-ink/50">← My orders</Link>
          <h2 className="mt-2 font-display text-3xl">Order <span className="font-mono text-2xl">{o.orderNo}</span></h2>
          <p className="text-sm text-ink/50">{new Date(o.createdAt).toLocaleString('en-IN')}{o.invoice?.number ? ` · Invoice ${o.invoice.number}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge s={o.status} />
          {o.invoice?.number && <a href={invoiceUrl(o._id)} target="_blank" rel="noreferrer" className="btn-light">Download GST invoice</a>}
          {o.whatsapp && <a href={o.whatsapp} target="_blank" rel="noreferrer" className="btn-light">Share on WhatsApp</a>}
        </div>
      </div>

      {err && <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      {o.status === 'Pending Payment' && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-amber-50 p-5">
          <p className="text-sm text-amber-800">Payment {o.payment.status === 'failed' ? 'failed' : 'pending'} — items are not reserved until payment is confirmed.</p>
          <div className="flex gap-2"><button disabled={busy} onClick={pay} className="btn-dark">{busy ? 'Processing…' : `Pay ${inr(o.total)}`}</button><button onClick={cancel} className="btn-light">Cancel</button></div>
        </div>
      )}

      {/* Delivery tracking */}
      {idx >= 0 && (
        <div className="card mt-8 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-xl">Delivery tracking</h3>
            {live && <span className="flex items-center gap-2 text-xs text-green-700"><span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />Live</span>}
          </div>
          <ol className="mt-6 grid gap-4 sm:grid-cols-5 sm:gap-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3 sm:flex-col sm:text-center">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg transition ${i <= idx ? 'bg-blush text-white' : 'bg-mist opacity-50'}`}>{i < idx ? '✓' : ICONS[s]}</div>
                <div>
                  <p className={`text-sm ${i <= idx ? 'font-medium' : 'text-ink/40'}`}>{s}</p>
                  <p className="text-[11px] text-ink/50">{at(s) ? when(at(s)) : i === STEPS.length - 1 && o.shipping?.eta ? `ETA ${new Date(o.shipping.eta).toLocaleDateString('en-IN')}` : ''}</p>
                </div>
              </li>
            ))}
          </ol>
          {o.shipping?.trackingNo && (
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-mist p-4 text-sm">
              <span>🚚 <b>{o.shipping.courier}</b> · <span className="font-mono">AWB {o.shipping.trackingNo}</span></span>
              {o.shipping.trackingUrl && <a href={o.shipping.trackingUrl} target="_blank" rel="noreferrer" className="btn-dark px-4 py-1.5 text-xs">Track with {o.shipping.courier} ↗</a>}
            </div>
          )}
          {o.status === 'Placed' && <button onClick={cancel} className="mt-6 text-xs text-ink/50 underline">Cancel order</button>}
        </div>
      )}

      {o.refunds?.length > 0 && (
        <div className="card mt-8 p-6">
          <h3 className="font-display text-xl">Refunds</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {o.refunds.map((r, k) => (
              <li key={k} className="flex flex-wrap justify-between gap-3 rounded-xl bg-green-50 p-3 text-green-900">
                <span>{new Date(r.at).toLocaleDateString('en-IN')} · {r.reason || 'Refund'}{r.items?.length ? ` · ${r.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}` : ''}</span>
                <b>{inr(r.amount)}</b>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink/50">Refunds reach your original payment method in 5–7 working days.</p>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <ul className="card divide-y divide-ink/5">
          {o.items.map((i) => (
            <li key={i.product} className="flex items-center gap-4 p-5">
              <img {...cld(i.image, 160)} onError={(e) => (e.currentTarget.src = FALLBACK_IMG)} className="h-16 w-16 rounded-xl object-cover" alt="" />
              <div className="flex-1">
                <p className="font-medium">{i.name}</p>
                <p className="text-xs text-ink/50">{inr(i.price)} × {i.qty}{i.refundedQty ? ` · ${i.refundedQty} refunded` : ''}</p>
              </div>
              <b>{inr(i.price * i.qty)}</b>
            </li>
          ))}
        </ul>
        <aside className="space-y-6">
          <div className="card space-y-2 p-6 text-sm">
            <div className="flex justify-between"><span>Items total</span><span>{inr(o.subtotal)}</span></div>
            {o.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount{o.coupon ? ` (${o.coupon})` : ''}</span><span>− {inr(o.discount)}</span></div>}
            {g?.interState ? (
              <div className="flex justify-between"><span>IGST</span><span>{inr(g.igst)}</span></div>
            ) : g ? (
              <><div className="flex justify-between"><span>CGST</span><span>{inr(g.cgst)}</span></div><div className="flex justify-between"><span>SGST</span><span>{inr(g.sgst)}</span></div></>
            ) : <div className="flex justify-between"><span>GST</span><span>{inr(o.tax)}</span></div>}
            <div className="flex justify-between"><span>Shipping ({o.shipping?.method})</span><span>{o.deliveryFee ? inr(o.deliveryFee) : 'FREE'}</span></div>
            <div className="flex justify-between border-t border-ink/10 pt-3 text-lg"><span>Total</span><b>{inr(o.total)}</b></div>
            {o.amountRefunded > 0 && <div className="flex justify-between text-green-700"><span>Refunded</span><span>− {inr(o.amountRefunded)}</span></div>}
            <p className="pt-2 text-xs text-ink/50">Payment: {o.payment.method.toUpperCase()} · {o.payment.status.replace('_', ' ')}</p>
          </div>
          <div className="card p-6 text-sm">
            <p className="eyebrow mb-3">Deliver to</p>
            <p className="font-medium">{o.address.name} · {o.address.phone}</p>
            <p className="text-ink/70">{o.address.line1}, {o.address.city}, {o.address.state} {o.address.pincode}</p>
            <p className="mt-3 text-ink/50">Shipping: {o.shipping?.method}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
