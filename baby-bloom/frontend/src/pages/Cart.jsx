import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { FALLBACK_IMG, api, cld, inr } from '../api';
import QtyStepper from '../components/QtyStepper';
import { aisle } from '../theme';

export default function Cart() {
  const { items, setQty, remove, replace, subtotal, count } = useCart();
  const [changes, setChanges] = useState([]);
  const delivery = subtotal >= 999 || subtotal === 0 ? 0 : 79;

  // Re-check live price & stock whenever the cart page opens
  useEffect(() => {
    if (!items.length) return;
    api('/products/validate-cart', { method: 'POST', auth: false, body: { items: items.map(({ _id, qty, price, name }) => ({ _id, qty, price, name })) } })
      .then((r) => {
        if (r.changes.length) {
          setChanges(r.changes);
          replace(r.items);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!items.length)
    return (
      <div className="container-x py-32 text-center">
        <div className="flex justify-center gap-1.5" aria-hidden><span className="h-12 w-12 rounded-[12px] bg-sky" /><span className="h-12 w-12 -rotate-6 rounded-[12px] bg-butter" /><span className="h-12 w-12 rotate-3 rounded-[12px] bg-rose" /></div>
        <h1 className="display-lg mt-8">Your basket is empty</h1>
        <p className="mt-2 text-ink/60">Pick an aisle and start filling it.</p>
        <Link to="/shop" className="btn-dark mt-8 px-8 py-3">Start shopping</Link>
      </div>
    );

  return (
    <div className="container-x py-12">
      <h1 className="display-lg">Your basket <span className="text-ink/35">{count}</span></h1>
      {changes.length > 0 && (
        <div className="mt-6 rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-900">
          <p className="font-medium">We updated your basket to match live prices and stock:</p>
          <ul className="mt-1 list-inside list-disc">{changes.map((c, k) => <li key={k}>{c.message}</li>)}</ul>
        </div>
      )}
      {subtotal > 0 && subtotal < 999 && <p className="mt-4 text-sm text-ink/60">Add <b>{inr(999 - subtotal)}</b> more for free standard shipping.</p>}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <ul className="card divide-y divide-ink/5">
          {items.map((i) => (
            <li key={i._id} className="flex gap-4 p-5 sm:gap-6">
              <div className={`${aisle(i.category).bg} shrink-0 rounded-[22px] p-2`}><img {...cld(i.image, 240)} onError={(e) => (e.currentTarget.src = FALLBACK_IMG)} alt="" className="h-20 w-20 rounded-[16px] object-cover sm:h-24 sm:w-24" /></div>
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-4">
                  <div><p className="font-display text-lg">{i.name}</p><p className="text-xs text-ink/50">{i.size} · {inr(i.price)} each</p></div>
                  <b>{inr(i.price * i.qty)}</b>
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <QtyStepper value={i.qty} max={i.stock} onChange={(q) => setQty(i._id, q)} small />
                  <button onClick={() => remove(i._id)} className="text-xs text-ink/50 underline hover:text-red-600">Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <aside className="card h-fit p-6 lg:sticky lg:top-28">
          <h2 className="font-display text-2xl">Summary</h2>
          <div className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{delivery ? inr(delivery) : 'FREE'}</span></div>
            <div className="flex justify-between text-ink/50"><span>GST & coupons</span><span>at checkout</span></div>
          </div>
          <div className="mt-6 flex justify-between border-t border-ink/10 pt-4 text-lg"><span>Estimated</span><b>{inr(subtotal + delivery)}</b></div>
          <Link to="/checkout" className="btn-dark mt-6 w-full py-3.5">Proceed to checkout</Link>
        </aside>
      </div>
    </div>
  );
}
