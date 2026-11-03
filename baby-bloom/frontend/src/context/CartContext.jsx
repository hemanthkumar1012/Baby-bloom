import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext';

const Ctx = createContext(null);
const KEY = 'bb_cart';

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
};

/** Merge two carts by product id, keeping the larger quantity (capped at stock). */
const merge = (a, b) => {
  const m = new Map(a.map((i) => [i._id, i]));
  for (const i of b) {
    const ex = m.get(i._id);
    m.set(i._id, ex ? { ...i, qty: Math.min(Math.max(ex.qty, i.qty), i.stock ?? 99) } : i);
  }
  return [...m.values()];
};

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState(load);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const synced = useRef(null); // user id whose server cart has been merged

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable */
    }
  }, [items]);

  // On sign-in: pull the server cart (other device) and merge it with this browser's cart
  useEffect(() => {
    if (!user) {
      synced.current = null;
      return;
    }
    if (synced.current === user._id) return;
    api('/me/cart')
      .then((server) => setItems((local) => merge(server, local)))
      .catch(() => {})
      .finally(() => (synced.current = user._id));
  }, [user]);

  // Push changes to the server (debounced) — enables cross-device carts and abandoned-cart reminders
  useEffect(() => {
    if (!user || synced.current !== user._id) return;
    const t = setTimeout(() => {
      api('/me/cart', { method: 'PUT', body: { items: items.map((i) => ({ _id: i._id, qty: i.qty })) } }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [items, user]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const add = (p, qty = 1) => {
    setItems((cur) => {
      const ex = cur.find((i) => i._id === p._id);
      const max = p.stock ?? 99;
      if (ex) return cur.map((i) => (i._id === p._id ? { ...i, qty: Math.min(i.qty + qty, max) } : i));
      return [...cur, { _id: p._id, name: p.name, price: p.price, mrp: p.mrp, image: p.images?.[0], stock: max, size: p.size, category: p.category, qty }];
    });
    setToast(`Added ${p.name}`);
  };
  const setQty = (id, qty) =>
    setItems((cur) => (qty <= 0 ? cur.filter((i) => i._id !== id) : cur.map((i) => (i._id === id ? { ...i, qty: Math.min(qty, i.stock) } : i))));
  const remove = (id) => setItems((cur) => cur.filter((i) => i._id !== id));
  const clear = () => setItems([]);
  const replace = (next) => setItems(next);

  const totals = useMemo(() => {
    const count = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    return { count, subtotal };
  }, [items]);

  return <Ctx.Provider value={{ items, add, setQty, remove, clear, replace, open, setOpen, toast, setToast, ...totals }}>{children}</Ctx.Provider>;
}

export const useCart = () => useContext(Ctx);
