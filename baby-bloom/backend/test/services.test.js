// Service-level tests with in-memory fakes for the Mongoose models (no database needed)
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const src = (p) => path.resolve(__dirname, '../src', p);

/* ---------- in-memory fakes ---------- */
const db = {
  products: [
    { _id: 'p1', name: 'Gentle Wash', price: 349, stock: 5, images: ['w.jpg'], category: 'Bath & Skin', sku: 'BB-1', hsn: '3401', active: true },
    { _id: 'p2', name: 'Diaper Pants', price: 1099, stock: 2, images: [], category: 'Diapering', sku: 'BB-2', hsn: '9619', active: true },
    { _id: 'p3', name: 'Rattle', price: 549, stock: 0, images: [], category: 'Toys', active: true },
  ],
  coupons: {
    BLOOM15: { code: 'BLOOM15', active: true, type: 'percent', value: 15, minOrder: 499, maxDiscount: 300 },
    DIAPER20: { code: 'DIAPER20', active: true, type: 'percent', value: 20, categories: ['Diapering'], perUserLimit: 1 },
    FIRSTBLOOM: { code: 'FIRSTBLOOM', active: true, type: 'flat', value: 250, minOrder: 999, firstOrderOnly: true },
  },
  orderCounts: { u1: 0 },
  couponUses: {},
};
const { evaluateCoupon } = require(src('lib/couponRules'));
const fakes = {
  [src('models/Product.js')]: {
    find: async (q) => db.products.filter((p) => q._id.$in.map(String).includes(p._id)).map((p) => ({ ...p, _id: { toString: () => p._id } })),
  },
  [src('models/Coupon.js')]: {
    findOne: async ({ code }) => {
      const c = db.coupons[code];
      return c ? { ...c, evaluate: (ctx) => evaluateCoupon(c, ctx) } : null;
    },
  },
  [src('models/Order.js')]: {
    countDocuments: async (q) => (q.coupon ? db.couponUses[`${q.user}:${q.coupon}`] || 0 : db.orderCounts[q.user] || 0),
  },
};
const origLoad = Module._load;
Module._load = function load(request, parent, ...rest) {
  const f = Module._resolveFilename(request, parent);
  return fakes[f] || origLoad.call(this, request, parent, ...rest);
};

const { priceCart } = require(src('services/pricing'));
const events = require(src('services/events'));
const { emailHtml, waText, EVENTS } = require(src('services/notify'));
const { code39Bars } = require(src('services/label'));

/* ---------- pricing ---------- */
test('pricing: 12% GST on net value, standard shipping below ₹999', async () => {
  const q = await priceCart([{ product: 'p1', qty: 2 }], null, { pincode: '517501' });
  assert.equal(q.subtotal, 698);
  assert.equal(q.tax, 84);
  assert.equal(q.deliveryFee, 79);
  assert.equal(q.total, 698 + 84 + 79);
  assert.equal(q.freeShippingGap, 999 - 698);
  assert.equal(q.items[0].hsn, '3401'); // HSN travels to the order for the invoice
});

test('pricing: GST split — Andhra Pradesh buyer gets CGST+SGST, Karnataka buyer gets IGST', async () => {
  const ap = await priceCart([{ product: 'p2', qty: 1 }], null, { pincode: '517501' });
  assert.equal(ap.gst.interState, false);
  assert.equal(ap.gst.cgst + ap.gst.sgst, ap.tax);
  const ka = await priceCart([{ product: 'p2', qty: 1 }], null, { pincode: '560001' });
  assert.equal(ka.gst.interState, true);
  assert.equal(ka.gst.igst, ka.tax);
  assert.equal(ka.gst.placeOfSupply, 'Karnataka');
});

test('pricing: free standard shipping at ₹999+, express always ₹149', async () => {
  assert.equal((await priceCart([{ product: 'p2', qty: 1 }])).deliveryFee, 0);
  assert.equal((await priceCart([{ product: 'p2', qty: 1 }], null, { shipping: 'express' })).deliveryFee, 149);
});

test('pricing: never trusts client quantity beyond stock', async () => {
  await assert.rejects(priceCart([{ product: 'p2', qty: 3 }]), /Only 2 left/);
  await assert.rejects(priceCart([{ product: 'p3', qty: 1 }]), /out of stock/);
  await assert.rejects(priceCart([]), /Cart is empty/);
  await assert.rejects(priceCart([{ product: 'nope', qty: 1 }]), /no longer available/);
});

test('pricing: category coupon only discounts eligible lines', async () => {
  const c = await priceCart([{ product: 'p1', qty: 1 }, { product: 'p2', qty: 1 }], 'DIAPER20', { userId: 'u1' });
  assert.equal(c.discount, 220); // 20% of the ₹1099 diaper line
  assert.equal(c.coupon, 'DIAPER20');
});

test('pricing: per-customer and first-order coupon limits come from order history', async () => {
  db.couponUses['u1:DIAPER20'] = 1;
  await assert.rejects(priceCart([{ product: 'p2', qty: 1 }], 'DIAPER20', { userId: 'u1' }), /already used/);
  db.orderCounts.u1 = 3;
  await assert.rejects(priceCart([{ product: 'p2', qty: 1 }], 'FIRSTBLOOM', { userId: 'u1' }), /first order only/);
  await assert.rejects(priceCart([{ product: 'p2', qty: 1 }], 'NOPE'), /Invalid coupon/);
});

/* ---------- live orders ---------- */
test('events: order updates reach only the owner and admins', () => {
  const got = [];
  const client = (id, isAdmin) => ({ userId: id, isAdmin, res: { write: (x) => got.push([id, x.split('\n')[0]]) } });
  events._clients.clear();
  events._clients.add(client('u1', false));
  events._clients.add(client('u2', false));
  events._clients.add(client('admin', true));
  events.publishOrder({ _id: 'o1', orderNo: 'BB1', status: 'Placed', user: 'u1', payment: {}, total: 1 });
  events.publishAdmin('low-stock', { name: 'x' });
  assert.deepEqual(got, [['u1', 'event: order'], ['admin', 'event: order'], ['admin', 'event: low-stock']]);
});

/* ---------- Email / WhatsApp ---------- */
const sample = {
  _id: 'o1', orderNo: 'BB261103-ABCDE', status: 'Shipped', total: 1577,
  items: [{ name: 'Diaper <Pants>', qty: 1, price: 1099 }],
  shipping: { courier: 'Delhivery', trackingNo: 'DLV123456', trackingUrl: 'https://www.delhivery.com/track-v2/package/DLV123456' },
};

test('email: HTML escapes user content and includes the tracking button', () => {
  const html = emailHtml(sample, { name: 'Hemanth Kumar' }, EVENTS.shipped);
  assert.match(html, /Diaper &lt;Pants&gt;/); // no HTML injection from product names
  assert.match(html, /Track with Delhivery/);
  assert.match(html, /Hi Hemanth/);
});

test('whatsapp: message has order, total and tracking link for shipped', () => {
  const t = waText(sample, 'shipped');
  assert.match(t, /BB261103-ABCDE/);
  assert.match(t, /₹1,577/);
  assert.match(t, /Track: https:\/\/www\.delhivery\.com/);
  assert.doesNotMatch(waText(sample, 'placed'), /Track:/);
});

/* ---------- shipping label ---------- */
test('label: Code 39 barcode — start/stop + 9 elements per character', () => {
  const bars = code39Bars('AB12', 1);
  assert.equal(bars.length, (4 + 2) * 10); // 6 characters incl. * start/stop, 9 elements + 1 gap each
  assert.equal(bars.filter((b) => b.bar).length, 6 * 5); // 5 bars per character
  assert.ok(bars.every((b) => b.w === 1 || b.w === 2.5));
});
