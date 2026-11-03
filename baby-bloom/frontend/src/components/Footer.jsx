import { Link } from 'react-router-dom';
import Logo from './Logo';
import { AISLES, AISLE_NAMES } from '../theme';

export default function Footer() {
  return (
    <footer className="mt-32">
      {/* the shelf: one block of colour per aisle */}
      <div className="flex h-3" aria-hidden>
        {AISLE_NAMES.map((n) => <span key={n} className={`${AISLES[n].bg} flex-1`} />)}
      </div>
      <div className="bg-ink text-white/70">
        <div className="container-x grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-sm leading-relaxed">Toxin-free baby care and mother care, developed with paediatric dermatologists and shipped from Tirupati to all of India.</p>
          </div>
          <div className="text-sm">
            <h3 className="mb-4 font-display text-sm font-medium text-white">Aisles</h3>
            {AISLE_NAMES.map((c) => (
              <Link key={c} to={`/shop?category=${encodeURIComponent(c)}`} className="flex items-center gap-2 py-1.5 hover:text-white">
                <span className={`h-2.5 w-2.5 rounded-[3px] ${AISLES[c].bg}`} aria-hidden />{c}
              </Link>
            ))}
          </div>
          <div className="text-sm">
            <h3 className="mb-4 font-display text-sm font-medium text-white">Your orders</h3>
            <Link to="/orders" className="block py-1.5 hover:text-white">Track an order</Link>
            <Link to="/account" className="block py-1.5 hover:text-white">Saved addresses</Link>
            <Link to="/cart" className="block py-1.5 hover:text-white">Basket</Link>
          </div>
          <div className="text-sm">
            <h3 className="mb-4 font-display text-sm font-medium text-white">Talk to us</h3>
            <a href="mailto:hello@babybloom.dev" className="block py-1.5 hover:text-white">hello@babybloom.dev</a>
            <p className="py-1.5">Mon to Sat, 9 am to 7 pm</p>
            <p className="py-1.5">Payments by Razorpay and Stripe</p>
          </div>
        </div>
        <div className="container-x flex flex-wrap justify-between gap-2 border-t border-white/10 py-6 text-xs text-white/45">
          <p>© {new Date().getFullYear()} Baby Bloom Pvt. Ltd., Tirupati, Andhra Pradesh</p>
          <p>GSTIN 37ABCDE1234F1Z5</p>
        </div>
      </div>
    </footer>
  );
}
