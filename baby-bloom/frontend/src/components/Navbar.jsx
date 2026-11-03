import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import SearchBox from './SearchBox';
import Logo from './Logo';
import { AISLES, AISLE_NAMES } from '../theme';

export default function Navbar() {
  const { count, setOpen } = useCart();
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [bump, setBump] = useState(false);
  const prev = useRef(count);
  const nav = useNavigate();
  const { search, pathname } = useLocation();
  const activeCat = pathname === '/shop' ? new URLSearchParams(search).get('category') : null;

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  // The basket count bumps when something is added (feedback for the quick-add +)
  useEffect(() => {
    if (count > prev.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 400);
      prev.current = count;
      return () => clearTimeout(t);
    }
    prev.current = count;
  }, [count]);
  useEffect(() => setMenu(false), [pathname, search]);

  return (
    <header className={`sticky top-0 z-40 bg-milk/90 backdrop-blur-xl transition-shadow ${scrolled ? 'shadow-[0_1px_0_rgba(31,35,64,.08)]' : ''}`}>
      <p className="bg-ink px-4 py-2 text-center text-[13px] text-white/85">
        Free shipping on orders above ₹999 — and 15% off your first basket with <b className="font-semibold text-white">BLOOM15</b>
      </p>
      <div className="container-x flex h-[72px] items-center gap-4">
        <button className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-mist lg:hidden" onClick={() => setMenu((m) => !m)} aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu}>
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">{menu ? <path d="M5 5l12 12M17 5L5 17" /> : <path d="M3 7h16M3 15h10" />}</svg>
        </button>
        <Link to="/" aria-label="baby bloom home"><Logo /></Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Aisles">
          {AISLE_NAMES.map((name) => {
            const on = activeCat === name;
            return (
              <NavLink
                key={name}
                to={`/shop?category=${encodeURIComponent(name)}`}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${on ? `${AISLES[name].bg} ${AISLES[name].ink}` : 'text-ink/75 hover:text-ink'}`}
              >
                {name}
              </NavLink>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchBox className="hidden w-60 md:block xl:w-72" />
          {user ? (
            <div className="group relative">
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-lilac font-display text-sm font-medium text-lilac-ink" aria-label="Account menu" aria-haspopup="menu">{user.name[0]?.toUpperCase()}</button>
              <div className="invisible absolute right-0 top-full w-56 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <div className="card overflow-hidden py-2 text-sm" role="menu">
                  <p className="px-4 pb-2 pt-1 text-xs text-ink/50">{user.email}</p>
                  <Link to="/orders" className="block px-4 py-2.5 hover:bg-mist" role="menuitem">My orders</Link>
                  <Link to="/account" className="block px-4 py-2.5 hover:bg-mist" role="menuitem">Addresses and profile</Link>
                  {user.role === 'admin' && <Link to="/admin" className="block px-4 py-2.5 hover:bg-mist" role="menuitem">Admin</Link>}
                  <button onClick={() => { logout(); nav('/'); }} className="block w-full px-4 py-2.5 text-left hover:bg-mist" role="menuitem">Sign out</button>
                </div>
              </div>
            </div>
          ) : (
            <Link to="/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold hover:bg-mist sm:block">Sign in</Link>
          )}
          <button onClick={() => setOpen(true)} className="relative flex h-11 items-center gap-2 rounded-full bg-ink pl-4 pr-3 text-sm font-semibold text-white transition hover:bg-blush" aria-label={`Basket, ${count} item${count === 1 ? '' : 's'}`}>
            <span className="hidden sm:inline">Basket</span>
            <span className={`flex h-6 min-w-6 items-center justify-center rounded-full bg-butter px-1.5 text-xs font-bold text-butter-ink tabular-nums ${bump ? 'animate-bump' : ''}`}>{count}</span>
          </button>
        </div>
      </div>

      {menu && (
        <nav className="container-x pb-6 lg:hidden" aria-label="Mobile">
          <SearchBox className="mb-4 md:hidden" onDone={() => setMenu(false)} />
          <div className="grid grid-cols-2 gap-2">
            {AISLE_NAMES.map((name) => (
              <Link key={name} to={`/shop?category=${encodeURIComponent(name)}`} className={`${AISLES[name].bg} ${AISLES[name].ink} rounded-block px-4 py-4 font-display text-sm font-medium`}>{name}</Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link to="/shop" className="btn-light">Shop everything</Link>
            {!user && <Link to="/login" className="btn-light">Sign in</Link>}
            {user && <Link to="/orders" className="btn-light">My orders</Link>}
          </div>
        </nav>
      )}
    </header>
  );
}
