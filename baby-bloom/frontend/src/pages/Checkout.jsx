import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, inr } from '../api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import AddressForm from '../components/AddressForm';

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

export default function Checkout() {
  const { items, clear } = useCart();
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [addresses, setAddresses] = useState(user?.addresses || []);
  const [addrId, setAddrId] = useState(() => (user?.addresses?.find((a) => a.isDefault) || user?.addresses?.[0])?._id || '');
  const [adding, setAdding] = useState(!user?.addresses?.length);
  const [shipping, setShipping] = useState('standard');
  const [method, setMethod] = useState('');
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState('');
  const [quote, setQuote] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [zone, setZone] = useState(null);
  const [offers, setOffers] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(null);
  const [placed, setPlaced] = useState(false); // order exists → keep this screen even though the cart is now empty

  const addr = useMemo(() => addresses.find((a) => a._id === addrId), [addresses, addrId]);
  const lines = items.map((i) => ({ product: i._id, qty: i.qty }));

  useEffect(() => {
    api('/payments/config', { auth: false })
      .then((c) => {
        setCfg(c);
        setMethod(c.razorpay ? 'razorpay' : c.stripe ? 'stripe' : 'demo');
      })
      .catch(() => {});
    api('/coupons/available', { auth: false }).then(setOffers).catch(() => {});
  }, []);

  // Delivery zone for the chosen address → ETA + whether express is possible
  useEffect(() => {
    if (!addr?.pincode) return setZone(null);
    api(`/products/serviceability/${addr.pincode}`, { auth: false }).then(setZone).catch(() => setZone(null));
  }, [addr?.pincode]);
  useEffect(() => {
    if (zone && !zone.express && shipping === 'express') setShipping('standard');
  }, [zone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Server-side price quote (prices, coupon rules, GST split are all computed on the server)
  useEffect(() => {
    if (!items.length) return;
    api('/coupons/quote', { method: 'POST', body: { items: lines, coupon: applied || undefined, shipping, pincode: addr?.pincode, state: addr?.state } })
      .then((q) => { setQuote(q); setErr(''); })
      .catch((e) => { setErr(e.message); if (applied) setApplied(''); });
  }, [items, applied, shipping, addr?.pincode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!items.length && !placed) return <div className="container-x py-32 text-center"><h1 className="font-display text-3xl">Nothing to check out</h1><Link to="/shop" className="btn-dark mt-6">Shop</Link></div>;

  const saveAddress = async (a) => {
    const list = await api('/me/addresses', { method: 'POST', body: { ...a, isDefault: !addresses.length || a.isDefault } });
    setAddresses(list);
    setUser({ ...user, addresses: list });
    setAddrId(list[list.length - 1]._id);
    setAdding(false);
  };

  const done = (order) => {
    clear();
    nav(`/orders/${order._id}?placed=1`, { replace: true });
  };

  const reportFailure = (orderId, reason, error, ref) =>
    api('/payments/failed', { method: 'POST', body: { orderId, gateway: method, reason, error, ref } }).catch(() => {});

  const place = async () => {
    setErr('');
    if (!addr) return setErr('Choose a delivery address');
    setBusy(true);
    try {
      const order = await api('/orders', { method: 'POST', body: { items: lines, addressId: addr._id, coupon: applied || undefined, shipping, method: method === 'stripe' ? 'stripe' : 'razorpay' } });
      setPlaced(true);
      clear(); // the order now holds the items; payment can be retried from the order page

      if (method === 'stripe') {
        const s = await api('/payments/stripe/session', { method: 'POST', body: { orderId: order._id } });
        if (s.alreadyPaid) return done(s.order);
        window.location.href = s.url; // Stripe hosted checkout → returns to /orders/:id?stripe_session=...
        return;
      }

      const pay = await api('/payments/create', { method: 'POST', body: { orderId: order._id } });
      if (pay.alreadyPaid) return done(pay.order);
      if (pay.mode === 'demo') {
        setDemo({ order });
        setBusy(false);
        return;
      }
      if (!(await loadRazorpay())) throw new Error('Could not load Razorpay. Check your connection and retry from My Orders.');
      const rz = new window.Razorpay({
        key: pay.keyId,
        amount: pay.amount,
        currency: pay.currency,
        order_id: pay.razorpayOrderId,
        name: 'BABY BLOOM',
        description: `Order ${order.orderNo}`,
        prefill: pay.prefill,
        theme: { color: '#2F2A3D' },
        retry: { enabled: true, max_count: 3 },
        handler: async (resp) => {
          try {
            const v = await api('/payments/verify', { method: 'POST', body: { orderId: order._id, ...resp } });
            done(v.order);
          } catch (er) {
            setErr(er.message);
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            reportFailure(order._id, 'dismissed');
            nav(`/orders/${order._id}?payment=pending`, { replace: true });
          },
        },
      });
      rz.on('payment.failed', (r) => reportFailure(order._id, 'failed', r.error?.description, r.error?.metadata?.payment_id));
      rz.open();
    } catch (er) {
      setErr(er.message);
      setBusy(false);
    }
  };

  const demoPay = async (fail) => {
    setBusy(true);
    try {
      const v = await api('/payments/verify', { method: 'POST', body: { orderId: demo.order._id, simulateFailure: fail } });
      done(v.order);
    } catch {
      nav(`/orders/${demo.order._id}?payment=failed`, { replace: true });
    }
  };

  const payOptions = [
    ...(cfg?.razorpay ? [['razorpay', 'UPI · Cards · Netbanking', 'Secured by Razorpay']] : []),
    ...(cfg?.stripe ? [['stripe', 'Card via Stripe', 'Visa · Mastercard · Amex · international']] : []),
    ...(cfg?.demo ? [['demo', 'Demo gateway', 'No keys configured — simulate success or failure']] : []),
  ];
  const g = quote?.gst;

  return (
    <div className="container-x py-12">
      <h1 className="font-display text-4xl">Checkout</h1>
      <ol className="mt-4 flex flex-wrap gap-2 text-xs text-ink/50">{['Cart', 'Address', 'Payment', 'Confirmation'].map((s, k) => <li key={s} className={k <= 2 ? 'text-ink' : ''}>{k > 0 && '→ '}{s}</li>)}</ol>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <section className="card p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">1. Delivery address</h2>
              {!adding && addresses.length > 0 && <button onClick={() => setAdding(true)} className="text-sm underline">+ New address</button>}
            </div>
            {addresses.length > 0 && !adding && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {addresses.map((a) => (
                  <label key={a._id} className={`cursor-pointer rounded-2xl border-2 p-4 text-sm transition ${addrId === a._id ? 'border-blush bg-blush/5' : 'border-ink/10'}`}>
                    <input type="radio" name="addr" className="sr-only" checked={addrId === a._id} onChange={() => setAddrId(a._id)} />
                    <p className="font-medium">{a.label} {a.isDefault && <span className="ml-1 rounded-full bg-mist px-2 py-0.5 text-[10px]">Default</span>}</p>
                    <p className="mt-1 text-ink/70">{a.name} · {a.phone}</p>
                    <p className="text-ink/60">{a.line1}, {a.city}, {a.state} {a.pincode}</p>
                  </label>
                ))}
              </div>
            )}
            {adding && <div className="mt-5"><AddressForm initial={{ name: user?.name, phone: user?.phone }} onSave={saveAddress} onCancel={addresses.length ? () => setAdding(false) : undefined} /></div>}
            {zone && <p className={`mt-4 text-sm ${zone.serviceable ? 'text-green-700' : 'text-red-600'}`}>{zone.serviceable ? '✓ ' : '✕ '}{zone.message}</p>}
          </section>

          <section className="card p-6 sm:p-8">
            <h2 className="font-display text-2xl">2. Delivery speed</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[['standard', 'Standard', 'FREE above ₹999, else ₹79'], ['express', 'Express', 'Next day in metros · ₹149']].map(([v, t, d]) => {
                const disabled = v === 'express' && zone && !zone.express;
                const eta = zone?.serviceable && (v === 'express' ? zone.expressEta : zone.standardEta);
                return (
                  <label key={v} className={`rounded-2xl border-2 p-4 transition ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'} ${shipping === v ? 'border-blush bg-blush/5' : 'border-ink/10'}`}>
                    <input type="radio" name="ship" className="sr-only" disabled={disabled} checked={shipping === v} onChange={() => setShipping(v)} />
                    <p className="font-medium">{t}</p><p className="text-xs text-ink/50">{disabled ? 'Metro cities only' : d}</p>
                    {eta && !disabled && <p className="mt-1 text-xs text-green-700">Arrives by {fmtDate(eta)}</p>}
                  </label>
                );
              })}
            </div>
          </section>

          <section className="card p-6 sm:p-8">
            <h2 className="font-display text-2xl">3. Payment</h2>
            <div className={`mt-5 grid gap-3 ${payOptions.length > 1 ? 'sm:grid-cols-2' : ''}`}>
              {payOptions.map(([v, t, d]) => (
                <label key={v} className={`cursor-pointer rounded-2xl border-2 p-4 transition ${method === v ? 'border-blush bg-blush/5' : 'border-ink/10'}`}>
                  <input type="radio" name="m" className="sr-only" checked={method === v} onChange={() => setMethod(v)} />
                  <p className="font-medium">{t}</p><p className="text-xs text-ink/50">{d}</p>
                </label>
              ))}
            </div>
            <p className="mt-4 text-xs text-ink/50">🔒 Payments are verified on our server with the gateway's signature before your order is confirmed. Your card details never touch our servers.</p>
          </section>
        </div>

        <aside className="card h-fit p-6 lg:sticky lg:top-28">
          <h2 className="font-display text-2xl">Order summary</h2>
          <ul className="mt-5 max-h-60 space-y-3 overflow-y-auto text-sm">
            {items.map((i) => <li key={i._id} className="flex justify-between gap-3"><span>{i.name} <span className="text-ink/40">× {i.qty}</span></span><span>{inr(i.price * i.qty)}</span></li>)}
          </ul>
          <div className="mt-5 flex gap-2">
            <input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code" className="input py-2.5" aria-label="Coupon code" />
            <button type="button" onClick={() => setApplied(coupon.trim())} className="btn-light">Apply</button>
          </div>
          {applied && quote?.coupon && <p className="mt-2 text-xs text-green-700">✓ {quote.coupon} applied — you save {inr(quote.discount)} <button type="button" className="underline" onClick={() => { setApplied(''); setCoupon(''); }}>remove</button></p>}
          {offers.length > 0 && !quote?.coupon && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs text-ink/50">Available offers</p>
              {offers.map((o) => (
                <button type="button" key={o.code} onClick={() => { setCoupon(o.code); setApplied(o.code); }} className="flex w-full items-start gap-2 rounded-xl border border-dashed border-blush/50 px-3 py-2 text-left text-xs hover:bg-blush/5">
                  <b className="font-mono text-blush">{o.code}</b>
                  <span className="text-ink/60">{o.description || (o.type === 'percent' ? `${o.value}% off` : `${inr(o.value)} off`)}{o.minOrder ? ` · min ${inr(o.minOrder)}` : ''}</span>
                </button>
              ))}
            </div>
          )}
          {quote && (
            <div className="mt-5 space-y-2 border-t border-ink/10 pt-5 text-sm">
              <div className="flex justify-between"><span>Items total</span><span>{inr(quote.subtotal)}</span></div>
              {quote.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>− {inr(quote.discount)}</span></div>}
              {g?.interState ? (
                <div className="flex justify-between"><span>IGST ({Math.round(g.rate * 100)}%)</span><span>{inr(g.igst)}</span></div>
              ) : g ? (
                <>
                  <div className="flex justify-between"><span>CGST ({Math.round(g.rate * 50)}%)</span><span>{inr(g.cgst)}</span></div>
                  <div className="flex justify-between"><span>SGST ({Math.round(g.rate * 50)}%)</span><span>{inr(g.sgst)}</span></div>
                </>
              ) : null}
              <div className="flex justify-between"><span>Shipping ({quote.shippingMethod})</span><span>{quote.deliveryFee ? inr(quote.deliveryFee) : 'FREE'}</span></div>
              {quote.freeShippingGap > 0 && <p className="text-xs text-blush">Add {inr(quote.freeShippingGap)} more for free shipping</p>}
              <div className="flex justify-between border-t border-ink/10 pt-3 text-lg"><span>Total</span><b>{inr(quote.total)}</b></div>
              {g && <p className="text-xs text-ink/40">Place of supply: {g.placeOfSupply}</p>}
            </div>
          )}
          {err && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
          <button onClick={place} disabled={busy || !quote || !addr || zone?.serviceable === false || !method} className="btn-dark mt-6 w-full py-4">
            {busy ? 'Processing…' : `Pay ${quote ? inr(quote.total) : ''}`}
          </button>
        </aside>
      </div>

      {demo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="card w-full max-w-sm p-8 text-center">
            <p className="eyebrow">Demo payment gateway</p>
            <p className="mt-3 font-display text-3xl">{inr(demo.order.total)}</p>
            <p className="mt-2 text-sm text-ink/60">Order {demo.order.orderNo}. Add Razorpay or Stripe keys in backend .env for real checkout.</p>
            <button disabled={busy} onClick={() => demoPay(false)} className="btn-dark mt-6 w-full py-3">Simulate success</button>
            <button disabled={busy} onClick={() => demoPay(true)} className="btn-light mt-2 w-full py-3">Simulate failure</button>
          </div>
        </div>
      )}
    </div>
  );
}
