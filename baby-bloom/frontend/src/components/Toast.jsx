import { useCart } from '../context/CartContext';

export default function Toast() {
  const { toast, setOpen } = useCart();
  return (
    <div role="status" aria-live="polite" className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 transition duration-300 md:bottom-8 ${toast ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}>
      <div className="flex items-center gap-4 rounded-full bg-ink py-2.5 pl-3 pr-2 text-sm text-white shadow-soft">
        <span className="h-5 w-5 rounded-[5px] bg-mint" aria-hidden />
        <span>{toast}</span>
        <button onClick={() => setOpen(true)} className="rounded-full bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20">Open basket</button>
      </div>
    </div>
  );
}
