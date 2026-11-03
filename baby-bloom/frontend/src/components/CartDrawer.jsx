import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { FALLBACK_IMG, cld, inr } from '../api';
import { aisle } from '../theme';
import QtyStepper from './QtyStepper';

const FREE_AT = 999;
const BLOCKS = 10;

/** Free-shipping progress drawn as ten toy blocks that fill as the basket grows. */
function ShippingBlocks({ subtotal }) {
  const filled = Math.min(BLOCKS, Math.floor((subtotal / FREE_AT) * BLOCKS));
  const left = Math.max(0, FREE_AT - subtotal);
  const colours = ['bg-sky', 'bg-butter', 'bg-mint', 'bg-peach', 'bg-lilac', 'bg-rose'];
  return (
    <div className="rounded-block bg-white p-4">
      <p className="text-sm">{left > 0 ? <>Add <b>{inr(left)}</b> more for free shipping</> : <>Free shipping unlocked</>}</p>
      <div className="mt-3 flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={FREE_AT} aria-valuenow={Math.min(subtotal, FREE_AT)} aria-label="Progress to free shipping">
        {Array.from({ length: BLOCKS }).map((_, k) => (
          <span key={k} className={`h-3 flex-1 rounded-[3px] transition-colors duration-300 ${k < filled ? colours[k % colours.length] : 'bg-mist'}`} />
        ))}
      </div>
    </div>
  );
}

export default function CartDrawer() {
  const { items, open, setOpen, setQty, subtotal, count } = useCart();
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const k = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [open, setOpen]);

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <aside role="dialog" aria-modal="true" aria-label="Basket" className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-milk transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="display-md">Basket <span className="text-ink/40">{count || ''}</span></h2>
          <button ref={closeRef} onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none hover:bg-mist" aria-label="Close basket">×</button>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
            <div className="flex gap-1.5" aria-hidden><span className="h-10 w-10 rounded-[10px] bg-sky" /><span className="h-10 w-10 -rotate-6 rounded-[10px] bg-butter" /><span className="h-10 w-10 rotate-3 rounded-[10px] bg-rose" /></div>
            <p className="text-ink/70">Your basket is empty. Start with an aisle.</p>
            <Link to="/shop" onClick={() => setOpen(false)} className="btn-dark">Browse the aisles</Link>
          </div>
        ) : (
          <>
            <div className="px-6"><ShippingBlocks subtotal={subtotal} /></div>
            <ul className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              {items.map((i) => (
                <li key={i._id} className="flex gap-4">
                  <div className={`${aisle(i.category).bg} shrink-0 rounded-[18px] p-1.5`}>
                    <img {...cld(i.image, 200)} onError={(e) => (e.currentTarget.src = FALLBACK_IMG)} className="h-20 w-20 rounded-[14px] object-cover" alt="" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="line-clamp-2 font-semibold leading-tight">{i.name}</p>
                    <p className="text-sm text-ink/50">{i.size}</p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <QtyStepper value={i.qty} max={i.stock} onChange={(q) => setQty(i._id, q)} small />
                      <b className="font-display font-medium tabular-nums">{inr(i.price * i.qty)}</b>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-ink/10 bg-white p-6">
              <div className="mb-1 flex items-baseline justify-between"><span>Subtotal</span><b className="font-display text-xl font-medium">{inr(subtotal)}</b></div>
              <p className="mb-4 text-xs text-ink/50">GST and shipping are worked out at checkout.</p>
              <Link to="/checkout" onClick={() => setOpen(false)} className="btn-dark w-full py-4 text-base">Go to checkout</Link>
              <Link to="/cart" onClick={() => setOpen(false)} className="mt-3 block text-center text-sm text-ink/60 underline underline-offset-4">Open full basket</Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
