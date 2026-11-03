import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { api } from '../api';
import { AISLES, AISLE_NAMES, aisle } from '../theme';

const PRICES = [['', 'Any price'], ['0-499', 'Under ₹500'], ['500-999', '₹500 to ₹999'], ['1000-', '₹1,000 and up']];
const SORTS = [['', 'Recommended'], ['new', 'Newest'], ['price_asc', 'Price, low to high'], ['price_desc', 'Price, high to low'], ['rating', 'Top rated']];

const Chip = ({ on, onClick, children, colour }) => (
  <button onClick={onClick} aria-pressed={on} className={`shrink-0 rounded-full border-[1.5px] px-4 py-2 text-sm font-medium transition ${on ? (colour || 'border-ink bg-ink text-white') : 'border-ink/10 bg-white text-ink/80 hover:border-ink/40'}`}>
    {children}
  </button>
);

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || 'All';
  const sort = params.get('sort') || '';
  const age = params.get('age') || 'All';
  const query = params.get('q') || '';
  const price = `${params.get('min') || ''}-${params.get('max') || ''}`;
  const [ages, setAges] = useState([]);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(false);

  useEffect(() => {
    api('/products/age-groups', { auth: false }).then(setAges).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ category, age, sort, q: query, limit: 48 });
    ['bestseller', 'inStock', 'min', 'max'].forEach((k) => params.get(k) && qs.set(k, params.get(k)));
    api(`/products?${qs}`, { auth: false })
      .then(setData)
      .catch(() => setData({ items: [], total: 0 }))
      .finally(() => setLoading(false));
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => {
    const n = new URLSearchParams(params);
    if (v && v !== 'All') n.set(k, v);
    else n.delete(k);
    setParams(n);
  };
  const setPrice = (v) => {
    const n = new URLSearchParams(params);
    const [mn, mx] = v.split('-');
    mn ? n.set('min', mn) : n.delete('min');
    mx ? n.set('max', mx) : n.delete('max');
    setParams(n);
  };
  const reset = () => setParams(category !== 'All' ? { category } : {});
  const active = [age !== 'All', price !== '-', params.get('inStock'), params.get('bestseller')].filter(Boolean).length;

  const a = category !== 'All' ? aisle(category) : null;
  const title = query ? `Results for “${query}”` : category !== 'All' ? category : params.get('bestseller') ? 'Bestsellers' : age !== 'All' ? `For ${age === 'Mom' ? 'moms' : age}` : 'Every aisle';

  return (
    <div>
      {/* Aisle header takes the aisle's colour */}
      <header className={`${a ? `${a.bg} weave` : 'bg-mist'} transition-colors duration-500`}>
        <div className="container-x py-12 sm:py-16">
          <h1 className={`display-xl ${a ? a.ink : 'text-ink'}`}>{title}</h1>
          <p className={`mt-3 max-w-lg ${a ? a.ink : 'text-ink/60'} opacity-80`}>{a ? a.blurb : 'Baby care and mother care, all in one place.'}</p>
          <div className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Aisle">
            <Chip on={category === 'All'} onClick={() => set('category', 'All')}>All aisles</Chip>
            {AISLE_NAMES.map((c) => (
              <Chip key={c} on={category === c} onClick={() => set('category', c)} colour={`border-white bg-white ${AISLES[c].ink}`}>
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-[3px] align-middle" style={{ background: AISLES[c].hex, boxShadow: `0 0 0 1px ${AISLES[c].inkHex}22` }} aria-hidden />
                {c}
              </Chip>
            ))}
          </div>
        </div>
      </header>

      <div className="container-x py-8">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setFilters((f) => !f)} aria-expanded={filters} className="btn-light">
            Filters{active ? <span className="ml-1 rounded-full bg-ink px-2 py-0.5 text-xs text-white">{active}</span> : null}
          </button>
          <label className="flex items-center gap-2 text-sm text-ink/60">
            Sort by
            <select value={sort} onChange={(e) => set('sort', e.target.value)} className="input w-auto rounded-full py-2 pr-8 text-ink">
              {SORTS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </select>
          </label>
          <p className="ml-auto text-sm text-ink/55" aria-live="polite">{loading ? 'Finding products…' : `${data.total} product${data.total === 1 ? '' : 's'}`}</p>
        </div>

        {filters && (
          <div className="mt-5 grid gap-6 rounded-[28px] bg-white p-6 shadow-soft md:grid-cols-3">
            {ages.length > 0 && (
              <fieldset>
                <legend className="mb-3 font-display text-sm font-medium">Age</legend>
                <div className="flex flex-wrap gap-2">
                  {['All', ...ages].map((x) => <Chip key={x} on={x === age} onClick={() => set('age', x)}>{x === 'All' ? 'Any age' : x === 'Mom' ? 'For moms' : x}</Chip>)}
                </div>
              </fieldset>
            )}
            <fieldset>
              <legend className="mb-3 font-display text-sm font-medium">Price</legend>
              <div className="flex flex-wrap gap-2">{PRICES.map(([v, l]) => <Chip key={l} on={price === (v || '-')} onClick={() => setPrice(v)}>{l}</Chip>)}</div>
            </fieldset>
            <fieldset>
              <legend className="mb-3 font-display text-sm font-medium">Show</legend>
              <div className="flex flex-wrap gap-2">
                <Chip on={params.get('inStock') === 'true'} onClick={() => set('inStock', params.get('inStock') ? '' : 'true')}>In stock</Chip>
                <Chip on={params.get('bestseller') === 'true'} onClick={() => set('bestseller', params.get('bestseller') ? '' : 'true')}>Bestsellers</Chip>
              </div>
              {active > 0 && <button onClick={reset} className="mt-4 text-sm underline underline-offset-4">Clear filters</button>}
            </fieldset>
          </div>
        )}

        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <div key={i}><div className="aspect-[4/5] animate-pulse rounded-[28px] bg-mist" /><div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-mist" /></div>)
            : data.items.map((p) => <ProductCard key={p._id} p={p} />)}
        </div>
        {!loading && data.items.length === 0 && (
          <div className="py-24 text-center">
            <p className="display-md">Nothing on this shelf</p>
            <p className="mt-2 text-ink/60">Try another aisle or clear the filters.</p>
            <button onClick={() => setParams({})} className="btn-dark mt-6">Show every product</button>
          </div>
        )}
      </div>
    </div>
  );
}
