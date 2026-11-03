import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FALLBACK_IMG, cld } from '../api';
import { AISLES } from '../theme';

const DEFAULT = [
  {
    _id: 'default',
    eyebrow: 'Made with paediatric dermatologists',
    title: 'Gentle care for every tiny milestone',
    subtitle: 'Toxin-free baby essentials and mother care, from the first bath to the first steps.',
    image: 'https://images.unsplash.com/photo-1544126592-807ade215a0b?auto=format&fit=crop&w=1400&q=80',
    cta: 'Shop essentials',
    link: '/shop',
  },
];

// A pyramid of toy blocks: 3 on the bottom, 2, then 1 — one per aisle.
const ROWS = [['Bath & Skin', 'Diapering', 'Feeding'], ['Clothing', 'Toys'], ['Mom Care']];
const TILT = { 'Bath & Skin': -2, Diapering: 1.5, Feeding: -1, Clothing: 2.5, Toys: -2, 'Mom Care': 3 };

function Blocks() {
  let n = 0;
  return (
    <nav aria-label="Shop by aisle" className="flex flex-col-reverse items-center gap-1.5">
      {ROWS.map((row, r) => (
        <div key={r} className="flex gap-1.5">
          {row.map((name) => {
            const a = AISLES[name];
            const delay = 120 + n++ * 110; // stack bottom-up, one block at a time
            return (
              <Link
                key={name}
                to={`/shop?category=${encodeURIComponent(name)}`}
                style={{ '--r': `${TILT[name]}deg`, animationDelay: `${delay}ms` }}
                className={`${a.bg} ${a.ink} weave flex h-[72px] w-[104px] animate-drop items-end rounded-block p-3 font-display text-[13px] font-medium leading-tight tracking-tight shadow-[inset_0_-4px_0_rgba(31,35,64,.08)] outline-offset-4 transition hover:brightness-[1.03] hover:shadow-[inset_0_-4px_0_rgba(31,35,64,.16)] sm:h-[84px] sm:w-[124px] sm:text-sm`}
              >
                {name}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/**
 * Home hero — the admin's scheduled banners framed in an arched nursery window,
 * with the six aisle blocks stacked at its foot. The block stack is the page's one
 * orchestrated animation (skipped under reduced motion).
 */
export default function Hero({ banners }) {
  const slides = banners?.length ? banners : DEFAULT;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef(null);
  const n = slides.length;
  const go = (k) => setI(((k % n) + n) % n);
  const b = slides[i] || slides[0];

  useEffect(() => setI(0), [n]);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (n < 2 || paused || reduce) return;
    const t = setInterval(() => !document.hidden && setI((x) => (x + 1) % n), 7000);
    return () => clearInterval(t);
  }, [n, paused]);

  return (
    <section
      className="container-x pt-8 sm:pt-12"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
        if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
      }}
      aria-roledescription="carousel"
      aria-label="Featured"
    >
      <div className="grid items-center gap-10 md:grid-cols-[1.05fr_1fr] lg:gap-24">
        {/* Copy */}
        <div className="order-2 md:order-1" aria-live="polite">
          <div key={b._id || i} className="max-w-xl">
            {b.eyebrow && <p className="text-sm font-medium text-ink/60">{b.eyebrow}</p>}
            <h1 className="display-xl mt-4 text-ink">{b.title}</h1>
            {b.subtitle && <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/70">{b.subtitle}</p>}
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to={b.link || '/shop'} className="btn-dark px-7 py-3.5 text-base">{b.cta || 'Shop now'}</Link>
              <Link to="/shop?bestseller=true" className="btn px-4 py-3.5 text-base text-ink underline decoration-ink/25 underline-offset-[6px] hover:decoration-ink">See bestsellers</Link>
            </div>
          </div>
          {n > 1 && (
            <div className="mt-12 flex items-center gap-2" role="tablist" aria-label="Choose banner">
              {slides.map((s, k) => (
                <button
                  key={s._id || k}
                  role="tab"
                  aria-selected={k === i}
                  aria-label={`Banner ${k + 1}: ${s.title}`}
                  onClick={() => go(k)}
                  className={`h-3 rounded-[4px] transition-all duration-300 ${k === i ? 'w-10 bg-ink' : 'w-3 bg-ink/20 hover:bg-ink/40'}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Arched window + block stack */}
        <div className="relative order-1 mx-auto w-full max-w-[520px] md:order-2">
          <div className="relative aspect-[4/5] overflow-hidden rounded-arch bg-sky">
            {slides.map((s, k) => {
              const img = cld(s.image, 1100);
              return (
                <picture key={s._id || k}>
                  {s.mobileImage && <source media="(max-width: 767px)" srcSet={cld(s.mobileImage, 800).src} />}
                  <img
                    src={img.src}
                    srcSet={img.srcSet}
                    sizes="(min-width: 768px) 520px, 90vw"
                    alt=""
                    loading={k === 0 ? 'eager' : 'lazy'}
                    fetchpriority={k === 0 ? 'high' : 'auto'}
                    onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${k === i ? 'opacity-100' : 'opacity-0'}`}
                  />
                </picture>
              );
            })}
            {/* window mullions */}
            <div className="pointer-events-none absolute inset-0 rounded-arch ring-[10px] ring-inset ring-white/70" />
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[6px] -translate-x-1/2 bg-white/60" />
          </div>
          <div className="relative -mt-24 flex justify-center sm:-mt-28 lg:absolute lg:-bottom-10 lg:-left-24 lg:mt-0">
            <Blocks />
          </div>
        </div>
      </div>
    </section>
  );
}
