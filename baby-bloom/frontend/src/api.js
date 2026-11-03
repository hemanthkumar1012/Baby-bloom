const BASE = import.meta.env.VITE_API_URL || '/api';

export const getToken = () => localStorage.getItem('bb_token');

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (auth && t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

export const invoiceUrl = (id) => `${BASE}/orders/${id}/invoice?token=${encodeURIComponent(getToken() || '')}`;

export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export const FALLBACK_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><rect width='400' height='400' fill='#F3EDF7'/><text x='50%' y='54%' font-size='120' text-anchor='middle'>🌸</text></svg>"
  );

/**
 * Live updates over Server-Sent Events. Auto-reconnects (EventSource does this natively).
 * Returns an unsubscribe function. `handlers` maps event name → callback(data).
 */
export function openEvents(handlers) {
  const t = getToken();
  if (!t || typeof EventSource === 'undefined') return () => {};
  const es = new EventSource(`${BASE}/events?token=${encodeURIComponent(t)}`);
  Object.entries(handlers).forEach(([evt, fn]) =>
    es.addEventListener(evt, (e) => {
      try {
        fn(JSON.parse(e.data));
      } catch {
        /* ignore malformed event */
      }
    })
  );
  return () => es.close();
}

/**
 * Cloudinary delivery helper — injects f_auto,q_auto and a width so every image is
 * served as WebP/AVIF at the right size. Non-Cloudinary URLs (e.g. Unsplash) get
 * their own width param. Returns { src, srcSet } for responsive <img>.
 */
export function cld(url, w = 800) {
  if (!url) return { src: FALLBACK_IMG };
  const isCld = url.includes('res.cloudinary.com') && url.includes('/upload/');
  const at = (width) =>
    isCld
      ? url.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`)
      : url.includes('images.unsplash.com')
        ? url.replace(/([?&])w=\d+/, `$1w=${width}`)
        : url;
  if (!isCld && !url.includes('images.unsplash.com')) return { src: url };
  return { src: at(w), srcSet: [Math.round(w / 2), w, w * 2].map((x) => `${at(x)} ${x}w`).join(', ') };
}
