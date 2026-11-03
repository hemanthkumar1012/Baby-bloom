import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, FALLBACK_IMG, inr } from '../api';

/** Debounced typeahead with keyboard navigation (↑ ↓ Enter Esc). */
export default function SearchBox({ className = '', onDone }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (q.trim().length < 2) return setItems([]);
    const id = ++reqId.current;
    const t = setTimeout(() => {
      api(`/products/suggest?q=${encodeURIComponent(q.trim())}`, { auth: false })
        .then((r) => id === reqId.current && setItems(r)) // ignore out-of-order responses
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const off = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, []);

  const go = (path) => {
    setOpen(false);
    setQ('');
    setItems([]);
    onDone?.();
    nav(path);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && items[active]) go(`/product/${items[active].slug}`);
      else if (q.trim()) go(`/shop?q=${encodeURIComponent(q.trim())}`);
    }
  };

  return (
    <div ref={box} className={`relative ${className}`}>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder="Search lotion, diapers, bottles…"
        className="input rounded-full py-2 pl-10"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls="bb-suggest"
      />
      <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="7" r="5" /><path d="M11 11l4 4" /></svg>
      {open && items.length > 0 && (
        <ul id="bb-suggest" role="listbox" className="card absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden py-2">
          {items.map((p, i) => (
            <li key={p._id} role="option" aria-selected={i === active}>
              <button onMouseEnter={() => setActive(i)} onClick={() => go(`/product/${p.slug}`)} className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${i === active ? 'bg-mist' : ''}`}>
                <img src={p.images?.[0] || FALLBACK_IMG} onError={(e) => (e.currentTarget.src = FALLBACK_IMG)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                <span className="flex-1"><span className="block leading-tight">{p.name}</span><span className="text-xs text-ink/50">{p.category}</span></span>
                <b className="text-xs">{inr(p.price)}</b>
              </button>
            </li>
          ))}
          <li><button onClick={() => go(`/shop?q=${encodeURIComponent(q.trim())}`)} className="w-full px-3 pt-2 text-left text-xs text-blush underline">See all results for “{q}”</button></li>
        </ul>
      )}
    </div>
  );
}
