import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, register } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '', phone: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const u = mode === 'login' ? await login(f.email, f.password) : await register(f);
      nav(params.get('next') || (u.role === 'admin' ? '/admin' : '/'), { replace: true });
    } catch (er) {
      setErr(er.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="container-x grid min-h-[78vh] items-center gap-12 py-12 md:grid-cols-2">
      {/* left: the brand moment — a stack of aisle blocks */}
      <div className="hidden md:block">
        <div className="relative mx-auto aspect-square max-w-md rounded-[40px] bg-sky weave p-10">
          <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col-reverse items-center gap-2" aria-hidden>
            <div className="flex gap-2"><span className="h-24 w-24 -rotate-3 rounded-block bg-butter" /><span className="h-24 w-24 rotate-2 rounded-block bg-rose" /><span className="h-24 w-24 -rotate-1 rounded-block bg-mint" /></div>
            <div className="flex gap-2"><span className="h-24 w-24 rotate-3 rounded-block bg-peach" /><span className="h-24 w-24 -rotate-2 rounded-block bg-lilac" /></div>
            <span className="h-24 w-24 rotate-6 rounded-block bg-white" />
          </div>
          <p className="display-md relative max-w-[14rem] text-sky-ink">Your orders, addresses and invoices in one place.</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md">
        <h1 className="display-lg">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-2 text-ink/60">{mode === 'login' ? 'Sign in to check out, track orders and download invoices.' : 'It takes a minute. We only email you about your orders.'}</p>
        <div className="mt-8 inline-flex rounded-full bg-mist p-1 text-sm font-semibold" role="tablist">
          {[['login', 'Sign in'], ['register', 'Create account']].map(([m, l]) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setErr(''); }} className={`rounded-full px-5 py-2 transition ${mode === m ? 'bg-white shadow-soft' : 'text-ink/60'}`}>{l}</button>
          ))}
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'register' && <input className="input" placeholder="Full name" autoComplete="name" value={f.name} onChange={set('name')} required />}
          <input className="input" type="email" placeholder="Email" autoComplete="email" value={f.email} onChange={set('email')} required />
          {mode === 'register' && <input className="input" placeholder="Mobile (for delivery updates)" inputMode="numeric" autoComplete="tel-national" value={f.phone} onChange={set('phone')} />}
          <input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'register' ? 'Password, 8+ characters with letters and numbers' : 'Password'} minLength={mode === 'register' ? 8 : 1} value={f.password} onChange={set('password')} required />
          {err && <p className="rounded-2xl bg-rose p-3 text-sm text-rose-ink">{err}</p>}
          <button disabled={busy} className="btn-dark w-full py-4 text-base">{busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <p className="mt-6 text-xs text-ink/45">Demo admin: admin@babybloom.dev / Admin@123</p>
      </div>
    </div>
  );
}
