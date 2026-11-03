const C = {
  'Pending Payment': 'bg-amber-50 text-amber-700',
  Placed: 'bg-blue-50 text-blue-700',
  Packed: 'bg-indigo-50 text-indigo-700',
  Shipped: 'bg-purple-50 text-purple-700',
  'Out for Delivery': 'bg-orange-50 text-orange-700',
  Delivered: 'bg-green-50 text-green-700',
  Cancelled: 'bg-gray-100 text-gray-600',
  Refunded: 'bg-rose-50 text-rose-700',
};

export default function StatusBadge({ s }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${C[s] || 'bg-gray-100'}`}>{s}</span>;
}
