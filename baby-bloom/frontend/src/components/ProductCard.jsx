import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { FALLBACK_IMG, cld, inr } from '../api';
import { aisle } from '../theme';

/**
 * Product on its aisle colour, like a studio shot on coloured paper.
 * Hover shows the second photo; the round + turns into a quantity stepper once added.
 */
export default function ProductCard({ p }) {
  const { items, add, setQty } = useCart();
  const a = aisle(p.category);
  const off = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
  const out = p.stock <= 0;
  const inCart = items.find((i) => i._id === p._id);
  const low = p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 5);
  const second = p.images?.[1];

  return (
    <article className="group relative">
      <Link to={`/product/${p.slug}`} className={`${a.bg} weave relative block aspect-[4/5] overflow-hidden rounded-[28px]`} aria-label={p.name}>
        <img
          {...cld(p.images?.[0], 640)}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
          alt=""
          loading="lazy"
          className={`absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] rounded-[20px] object-cover transition-opacity duration-500 ${second ? 'group-hover:opacity-0' : ''}`}
        />
        {second && <img {...cld(second, 640)} alt="" loading="lazy" className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] rounded-[20px] object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />}
        <div className="absolute left-6 top-6 flex flex-col items-start gap-1.5">
          {off > 0 && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink">−{off}%</span>}
          {p.isBestseller && <span className={`rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold ${a.ink}`}>Bestseller</span>}
        </div>
        {(out || low) && (
          <span className="absolute bottom-6 left-6 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink">{out ? 'Sold out' : `Only ${p.stock} left`}</span>
        )}
      </Link>

      {/* Quick add: the + becomes a stepper once the item is in the basket */}
      <div className="mt-4 flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <Link to={`/product/${p.slug}`} className="block">
            <h3 className="line-clamp-2 font-semibold leading-snug text-ink">{p.name}</h3>
          </Link>
          <p className="mt-1 text-sm text-ink/55">{p.size || p.category}{p.rating ? <span className="ml-2">★ {p.rating}</span> : null}</p>
          <p className="mt-2 flex items-baseline gap-2">
            <b className="font-display text-lg font-medium tracking-tight">{inr(p.price)}</b>
            {off > 0 && <s className="text-sm text-ink/40">{inr(p.mrp)}</s>}
          </p>
        </div>
        {out ? null : inCart ? (
          <div className="flex shrink-0 items-center rounded-full bg-ink text-white" role="group" aria-label={`${p.name} quantity`}>
            <button onClick={() => setQty(p._id, inCart.qty - 1)} className="h-10 w-10 rounded-full text-lg hover:bg-white/10" aria-label="Remove one">−</button>
            <span className="w-5 text-center text-sm font-semibold tabular-nums" aria-live="polite">{inCart.qty}</span>
            <button onClick={() => setQty(p._id, inCart.qty + 1)} disabled={inCart.qty >= p.stock} className="h-10 w-10 rounded-full text-lg hover:bg-white/10 disabled:opacity-40" aria-label="Add one">+</button>
          </div>
        ) : (
          <button onClick={() => add(p)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink/15 bg-white text-xl leading-none text-ink transition hover:border-ink hover:bg-ink hover:text-white" aria-label={`Add ${p.name} to cart`}>+</button>
        )}
      </div>
    </article>
  );
}
