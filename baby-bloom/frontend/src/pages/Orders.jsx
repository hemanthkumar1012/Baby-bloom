import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, inr } from '../api';
import StatusBadge from '../components/StatusBadge';

export default function Orders() {
  const [orders, setOrders] = useState(null);
  useEffect(() => {
    api('/orders/mine').then(setOrders).catch(() => setOrders([]));
  }, []);

  return (
    <div className="container-x py-12">
      <h1 className="font-display text-4xl">My orders</h1>
      {!orders ? (
        <p className="mt-8 text-ink/50">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="py-24 text-center"><p className="text-ink/50">No orders yet.</p><Link to="/shop" className="btn-dark mt-6">Order something fresh</Link></div>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((o) => (
            <li key={o._id}>
              <Link to={`/orders/${o._id}`} className="card flex flex-col gap-4 p-5 transition hover:shadow-2xl sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-sm">{o.orderNo}</p>
                  <p className="mt-1 text-xs text-ink/50">{new Date(o.createdAt).toLocaleString('en-IN')} · {o.items.length} item{o.items.length > 1 ? 's' : ''}</p>
                  <p className="mt-2 line-clamp-1 text-sm text-ink/70">{o.items.map((i) => i.name).join(', ')}</p>
                </div>
                <div className="flex items-center gap-4"><StatusBadge s={o.status} /><b>{inr(o.total)}</b></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
