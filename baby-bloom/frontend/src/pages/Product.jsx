import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, FALLBACK_IMG, cld, inr } from '../api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import QtyStepper from '../components/QtyStepper';
import ProductCard from '../components/ProductCard';
import { aisle } from '../theme';

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/* ---------- Premium gallery: hover-zoom, thumbnails, fullscreen lightbox, swipe & keys ---------- */
function Gallery({ images, name, stage = 'bg-mist' }) {
  const list = images?.length ? images : [FALLBACK_IMG];
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(null); // { x, y } in % while hovering
  const [full, setFull] = useState(false);
  const touch = useRef(null);
  const n = list.length;
  const go = (k) => setI(((k % n) + n) % n);

  useEffect(() => setI(0), [images]);
  useEffect(() => {
    if (!full) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setFull(false);
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % n);
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + n) % n);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [full, n]);

  const swipe = {
    onTouchStart: (e) => (touch.current = e.touches[0].clientX),
    onTouchEnd: (e) => {
      const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
      if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
    },
  };
  const main = cld(list[i], 1000);

  return (
    <div className="md:sticky md:top-28">
      <div className="flex gap-4">
        {n > 1 && (
          <div className="no-scrollbar hidden max-h-[560px] flex-col gap-3 overflow-y-auto md:flex">
            {list.map((s, k) => (
              <button key={s + k} onClick={() => setI(k)} onMouseEnter={() => setI(k)} aria-label={`Image ${k + 1}`} className={`shrink-0 overflow-hidden rounded-2xl border-2 transition ${k === i ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                <img {...cld(s, 160)} alt="" className="h-20 w-20 object-cover" onError={(e) => (e.currentTarget.src = FALLBACK_IMG)} />
              </button>
            ))}
          </div>
        )}
        <div
          className={`relative flex-1 cursor-zoom-in overflow-hidden rounded-[32px] ${stage} weave p-5 sm:p-8`}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onMouseLeave={() => setZoom(null)}
          onClick={() => setFull(true)}
          {...swipe}
        >
          <img
            src={main.src}
            srcSet={main.srcSet}
            sizes="(min-width: 768px) 45vw, 100vw"
            alt={`${name} — image ${i + 1} of ${n}`}
            onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
            className="aspect-square w-full rounded-[22px] object-cover transition-transform duration-200"
            style={zoom ? { transform: 'scale(1.9)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
          {n > 1 && <span className="absolute bottom-8 right-8 rounded-full bg-white/90 px-3 py-1 text-xs tabular-nums">{i + 1} of {n}</span>}
          <span className="absolute bottom-8 left-8 hidden rounded-full bg-white/90 px-3 py-1 text-xs md:block">Hover to zoom, click to enlarge</span>
        </div>
      </div>
      {n > 1 && (
        <div className="mt-4 flex justify-center gap-2 md:hidden">
          {list.map((s, k) => <button key={s + k} onClick={() => setI(k)} aria-label={`Image ${k + 1}`} className={`h-2 rounded-full transition-all ${k === i ? 'w-6 bg-ink' : 'w-2 bg-ink/25'}`} />)}
        </div>
      )}

      {full && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-ink/95" role="dialog" aria-modal="true" aria-label={`${name} images`} {...swipe}>
          <div className="flex items-center justify-between p-4 text-milk">
            <span className="text-sm">{i + 1} / {n}</span>
            <button onClick={() => setFull(false)} className="text-3xl leading-none" aria-label="Close">×</button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-4">
            {n > 1 && <button onClick={() => go(i - 1)} aria-label="Previous" className="absolute left-4 h-12 w-12 rounded-full bg-white/10 text-2xl text-milk hover:bg-white/20">‹</button>}
            <img {...cld(list[i], 1800)} sizes="100vw" alt={name} className="max-h-[80vh] max-w-full rounded-2xl object-contain" />
            {n > 1 && <button onClick={() => go(i + 1)} aria-label="Next" className="absolute right-4 h-12 w-12 rounded-full bg-white/10 text-2xl text-milk hover:bg-white/20">›</button>}
          </div>
          {n > 1 && (
            <div className="flex justify-center gap-3 p-4">
              {list.map((s, k) => (
                <button key={s + k} onClick={() => setI(k)} className={`overflow-hidden rounded-xl border-2 ${k === i ? 'border-milk' : 'border-transparent opacity-60'}`}>
                  <img {...cld(s, 120)} alt="" className="h-14 w-14 object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Product() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { add, setOpen } = useCart();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [qty, setQty] = useState(1);
  const defaultPin = user?.addresses?.find((a) => a.isDefault)?.pincode || user?.addresses?.[0]?.pincode || '';
  const [pin, setPin] = useState(defaultPin);
  const [zone, setZone] = useState(null);

  useEffect(() => {
    setData(null);
    setQty(1);
    api(`/products/${slug}`, { auth: false }).then(setData).catch((e) => setErr(e.message));
  }, [slug]);

  const checkPin = async (e) => {
    e?.preventDefault();
    if (!/^\d{6}$/.test(pin)) return setZone({ serviceable: false, message: 'Enter a valid 6-digit pincode' });
    setZone(await api(`/products/serviceability/${pin}`, { auth: false }).catch(() => null));
  };
  useEffect(() => {
    if (/^\d{6}$/.test(pin)) checkPin();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="container-x py-32 text-center"><p className="font-display text-3xl">{err}</p><Link to="/shop" className="btn-dark mt-6">Back to shop</Link></div>;
  if (!data) return <div className="container-x grid gap-10 py-12 md:grid-cols-2"><div className="aspect-square animate-pulse rounded-[32px] bg-mist" /><div className="h-80 animate-pulse rounded-[32px] bg-mist" /></div>;

  const { product: p, related } = data;
  const off = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
  const low = p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 5);
  const a = aisle(p.category);

  return (
    <div className="container-x py-10">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-ink/55" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-ink">Home</Link><span aria-hidden>/</span>
        <Link to={`/shop?category=${encodeURIComponent(p.category)}`} className={`rounded-full px-2.5 py-0.5 ${a.bg} ${a.ink}`}>{p.category}</Link>
      </nav>
      <div className="grid gap-10 md:grid-cols-2 lg:gap-16">
        <Gallery images={p.images} name={p.name} stage={a.bg} />

        <div className="md:py-4">
          <p className="text-sm font-medium text-ink/55">{p.brand || 'Baby Bloom'}</p>
          <h1 className="display-lg mt-2">{p.name}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink/60">
            <span>★ {p.rating}</span>
            {p.size && <span>{p.size}</span>}
            {p.ageGroup && <span className="rounded-full bg-mist px-2 py-0.5 text-xs">{p.ageGroup === 'Mom' ? 'For moms' : `Age ${p.ageGroup}`}</span>}
            {p.sku && <span className="text-xs text-ink/40">SKU {p.sku}</span>}
          </p>

          <div className="mt-6 flex items-baseline gap-3">
            <span className="font-display text-4xl font-medium tracking-tight">{inr(p.price)}</span>
            {off > 0 && <><s className="text-lg text-ink/40">{inr(p.mrp)}</s><span className="rounded-full bg-blush/10 px-3 py-1 text-xs font-semibold text-blush">Save {inr(p.mrp - p.price)} ({off}%)</span></>}
          </div>
          <p className="mt-1 text-xs text-ink/50">Price includes all taxes</p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {p.stock > 0 ? (
              <>
                <QtyStepper value={qty} max={p.stock} onChange={(q) => setQty(Math.max(1, q))} />
                <button onClick={() => add(p, qty)} className="btn-dark flex-1 py-3.5">Add {qty > 1 ? `${qty} ` : ''}to basket, {inr(p.price * qty)}</button>
                <button onClick={() => { add(p, qty); setOpen(false); nav('/checkout'); }} className="btn-light py-3.5">Buy now</button>
              </>
            ) : (
              <span className="btn bg-mist text-ink/60">Out of stock</span>
            )}
          </div>
          {low && <p className="mt-3 text-sm text-red-600">Hurry — only {p.stock} left in stock.</p>}

          {/* Delivery: pincode serviceability + ETA */}
          <form onSubmit={checkPin} className="mt-8 rounded-[22px] border-[1.5px] border-ink/10 bg-white p-5">
            <p className="text-sm font-medium">Check delivery</p>
            <div className="mt-2 flex gap-2">
              <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="Enter pincode" className="input py-2.5" aria-label="Pincode" />
              <button className="btn-light">Check</button>
            </div>
            {zone && (
              <div className={`mt-3 text-sm ${zone.serviceable ? 'text-ink/80' : 'text-red-600'}`}>
                <p>{zone.serviceable ? '✓ ' : '✕ '}{zone.message}{zone.state ? `, ${zone.state}` : ''}</p>
                {zone.serviceable && (
                  <ul className="mt-1 space-y-0.5 text-xs text-ink/60">
                    <li>Standard delivery by <b>{fmtDate(zone.standardEta)}</b>, free above ₹999</li>
                    {zone.express && <li>Express delivery by <b>{fmtDate(zone.expressEta)}</b> for ₹149</li>}
                  </ul>
                )}
              </div>
            )}
          </form>

          <p className="mt-8 leading-relaxed text-ink/75">{p.description}</p>
          {p.features?.length > 0 && (
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {p.features.map((f) => <li key={f} className="flex items-center gap-2.5 text-sm"><span className={`flex h-5 w-5 items-center justify-center rounded-[6px] text-[11px] font-bold ${a.bg} ${a.ink}`}>✓</span>{f}</li>)}
            </ul>
          )}
          <dl className="mt-8 grid grid-cols-3 divide-x divide-ink/10 border-y border-ink/10 py-4 text-center text-xs">
            {[['Shipping', 'Free above ₹999'], ['Payment', 'Razorpay or Stripe'], ['Invoice', 'GST, by email']].map(([t, d]) => (
              <div key={t} className="px-2"><dt className="font-display text-[13px] font-medium">{t}</dt><dd className="mt-1 text-ink/60">{d}</dd></div>
            ))}
          </dl>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24">
          <h2 className="display-lg mb-8">More from the {p.category.toLowerCase()} aisle</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">{related.map((r) => <ProductCard key={r._id} p={r} />)}</div>
        </section>
      )}

      {/* Sticky add-to-cart on phones */}
      {p.stock > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-ink/10 bg-white/95 p-3 backdrop-blur md:hidden">
          <div className="flex-1"><p className="line-clamp-1 text-xs text-ink/60">{p.name}</p><b>{inr(p.price)}</b></div>
          <button onClick={() => add(p, qty)} className="btn-dark px-6 py-3">Add to basket</button>
        </div>
      )}
    </div>
  );
}
