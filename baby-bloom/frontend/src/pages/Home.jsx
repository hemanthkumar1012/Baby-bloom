import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Hero from '../components/Hero';
import ProductCard from '../components/ProductCard';
import { api } from '../api';
import { AISLES, AISLE_NAMES } from '../theme';

const Skeleton = () => (
  <div>
    <div className="aspect-[4/5] animate-pulse rounded-[28px] bg-mist" />
    <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-mist" />
    <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-mist" />
  </div>
);

function Row({ title, note, link, linkLabel, items }) {
  return (
    <section className="container-x mt-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="display-lg">{title}</h2>
          {note && <p className="mt-2 text-ink/60">{note}</p>}
        </div>
        {link && <Link to={link} className="text-sm font-semibold text-ink underline decoration-ink/25 underline-offset-[6px] hover:decoration-ink">{linkLabel}</Link>}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
        {items ? items.map((p) => <ProductCard key={p._id} p={p} />) : Array.from({ length: 4 }).map((_, k) => <Skeleton key={k} />)}
      </div>
    </section>
  );
}

export default function Home() {
  const [best, setBest] = useState(null);
  const [fresh, setFresh] = useState(null);
  const [banners, setBanners] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/products?bestseller=true&limit=4', { auth: false }).then((d) => setBest(d.items)).catch((e) => { setErr(e.message); setBest([]); });
    api('/products?sort=new&limit=4', { auth: false }).then((d) => setFresh(d.items)).catch(() => setFresh([]));
    api('/products/banners', { auth: false }).then(setBanners).catch(() => {});
  }, []);

  return (
    <>
      <Hero banners={banners} />

      {/* quiet promise line under the hero */}
      <div className="container-x mt-20 md:mt-24">
        <ul className="flex flex-wrap gap-x-10 gap-y-3 border-y border-ink/10 py-5 text-sm text-ink/70">
          {[['bg-sky', 'Dermatologically tested, toxin free'], ['bg-butter', 'Free shipping above ₹999'], ['bg-mint', 'Next-day delivery in metros'], ['bg-rose', 'GST invoice with every order']].map(([c, t]) => (
            <li key={t} className="flex items-center gap-2.5"><span className={`h-3 w-3 rounded-[3px] ${c}`} aria-hidden />{t}</li>
          ))}
        </ul>
      </div>

      {err && <p className="container-x mt-10 rounded-2xl bg-rose p-4 text-sm text-rose-ink">Can't reach the store right now ({err}). Start the backend on port 5000 and run <code>npm run seed</code>.</p>}

      <Row title="Parents keep coming back for these" link="/shop?bestseller=true" linkLabel="All bestsellers" items={best} />

      {/* The aisles — one colour field per category */}
      <section className="mt-28">
        <div className="container-x mb-8">
          <h2 className="display-lg">Walk the aisles</h2>
          <p className="mt-2 max-w-lg text-ink/60">Every aisle has its own colour, so you always know where you are — from bath time to bedtime.</p>
        </div>
        <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:px-6 lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))]">
          {AISLE_NAMES.map((name) => {
            const a = AISLES[name];
            return (
              <Link
                key={name}
                to={`/shop?category=${encodeURIComponent(name)}`}
                className={`${a.bg} ${a.ink} weave group flex h-[340px] w-[260px] shrink-0 snap-start flex-col justify-between rounded-[28px] p-6 transition-transform hover:-rotate-1 sm:w-[300px]`}
              >
                <span className="font-display text-2xl font-medium leading-tight tracking-tight">{name}</span>
                <span>
                  <span className="block max-w-[16rem] text-sm opacity-80">{a.blurb}</span>
                  <span className="mt-4 inline-flex h-11 items-center rounded-full bg-white/70 px-5 text-sm font-semibold transition group-hover:bg-white">Shop {name.toLowerCase()}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <Row title="Just in" note="The newest additions to the shelves." link="/shop?sort=new" linkLabel="See everything new" items={fresh} />

      {/* Promise — one dark panel, three plain statements */}
      <section className="container-x mt-28">
        <div className="grid gap-10 rounded-[36px] bg-ink px-6 py-12 text-white sm:px-12 md:grid-cols-[1.1fr_1fr] md:py-16">
          <div>
            <h2 className="display-lg text-white">What goes on baby goes into baby.</h2>
            <p className="mt-5 max-w-md text-white/70">Every formula is developed with paediatric dermatologists and tested on sensitive skin. If it isn't gentle enough for a newborn, we don't make it.</p>
          </div>
          <dl className="grid gap-6 self-end sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
            {[['Free from', 'Parabens, sulphates, mineral oil and synthetic fragrance'], ['Tested on', 'Sensitive skin, under dermatologist supervision'], ['Delivered with', 'A GST invoice and live courier tracking']].map(([t, d]) => (
              <div key={t} className="border-t border-white/15 pt-4">
                <dt className="font-display text-sm font-medium">{t}</dt>
                <dd className="mt-1 text-sm text-white/65">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
