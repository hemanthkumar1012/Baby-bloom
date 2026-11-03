// Pure business rules — run with:  npm test   (Node's built-in test runner, no extra deps)
const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateCoupon } = require('../src/lib/couponRules');
const { stateFromPincode, splitGst, amountInWords, financialYear } = require('../src/lib/gst');
const { trackingUrl, COURIERS } = require('../src/lib/couriers');
const { itemRefundAmount, validateAmount } = require('../src/lib/refunds');
const { check } = require('../src/services/serviceability');
const { clean } = require('../src/middleware/sanitize');

const cart = [
  { price: 1000, qty: 1, category: 'Diapering' },
  { price: 500, qty: 2, category: 'Bath & Skin' },
];
const base = { active: true, type: 'percent', value: 10, minOrder: 0 };

/* ---------- coupons ---------- */
test('coupon: percent off whole cart, capped by maxDiscount', () => {
  assert.deepEqual(evaluateCoupon({ ...base }, { items: cart }), { ok: true, discount: 200 });
  assert.deepEqual(evaluateCoupon({ ...base, maxDiscount: 150 }, { items: cart }), { ok: true, discount: 150 });
});

test('coupon: flat discount never exceeds the eligible amount', () => {
  assert.equal(evaluateCoupon({ ...base, type: 'flat', value: 5000 }, { items: cart }).discount, 2000);
});

test('coupon: category-restricted only discounts matching lines', () => {
  assert.equal(evaluateCoupon({ ...base, value: 20, categories: ['Diapering'] }, { items: cart }).discount, 200);
  const miss = evaluateCoupon({ ...base, categories: ['Toys'] }, { items: cart });
  assert.equal(miss.ok, false);
  assert.match(miss.message, /Toys/);
});

test('coupon: min order, expiry, start date and inactive', () => {
  assert.match(evaluateCoupon({ ...base, minOrder: 3000 }, { items: cart }).message, /Add ₹1000 more/);
  assert.equal(evaluateCoupon({ ...base, expiresAt: '2000-01-01' }, { items: cart }).ok, false);
  assert.equal(evaluateCoupon({ ...base, startsAt: '2999-01-01' }, { items: cart }).ok, false);
  assert.equal(evaluateCoupon({ ...base, active: false }, { items: cart }).ok, false);
});

test('coupon: first-order-only, per-customer and total limits', () => {
  assert.equal(evaluateCoupon({ ...base, firstOrderOnly: true }, { items: cart, userOrders: 0 }).ok, true);
  assert.equal(evaluateCoupon({ ...base, firstOrderOnly: true }, { items: cart, userOrders: 2 }).ok, false);
  assert.equal(evaluateCoupon({ ...base, perUserLimit: 1 }, { items: cart, userUses: 1 }).ok, false);
  assert.equal(evaluateCoupon({ ...base, perUserLimit: 2 }, { items: cart, userUses: 1 }).ok, true);
  assert.equal(evaluateCoupon({ ...base, usageLimit: 100 }, { items: cart, totalUses: 100 }).ok, false);
});

/* ---------- GST invoice ---------- */
test('gst: place of supply from pincode, including 3-digit exceptions', () => {
  assert.equal(stateFromPincode('517501'), 'Andhra Pradesh'); // Tirupati
  assert.equal(stateFromPincode('500001'), 'Telangana'); // Hyderabad (50x)
  assert.equal(stateFromPincode('560001'), 'Karnataka');
  assert.equal(stateFromPincode('403001'), 'Goa'); // inside Maharashtra's 40 range
  assert.equal(stateFromPincode('605001'), 'Puducherry');
  assert.equal(stateFromPincode('834001'), 'Jharkhand');
  assert.equal(stateFromPincode('012345'), null);
});

test('gst: intra-state → CGST + SGST (sum preserved), inter-state → IGST', () => {
  const intra = splitGst(85, 'Andhra Pradesh', 'Andhra Pradesh');
  assert.equal(intra.interState, false);
  assert.equal(intra.cgst + intra.sgst, 85);
  assert.equal(intra.igst, 0);
  const inter = splitGst(85, 'Karnataka', 'Andhra Pradesh');
  assert.deepEqual([inter.interState, inter.igst, inter.cgst, inter.sgst], [true, 85, 0, 0]);
});

test('gst: amount in words uses Indian numbering', () => {
  assert.equal(amountInWords(0), 'Rupees Zero Only');
  assert.equal(amountInWords(861), 'Rupees Eight Hundred Sixty One Only');
  assert.equal(amountInWords(1577), 'Rupees One Thousand Five Hundred Seventy Seven Only');
  assert.equal(amountInWords(1234567), 'Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Only');
  assert.equal(amountInWords(20000000), 'Rupees Two Crore Only');
});

test('gst: financial year runs April to March', () => {
  assert.equal(financialYear(new Date('2026-11-03')), '2026-27');
  assert.equal(financialYear(new Date('2027-03-31')), '2026-27');
  assert.equal(financialYear(new Date('2027-04-01')), '2027-28');
});

/* ---------- refunds ---------- */
const order = {
  subtotal: 2000, discount: 200, total: 2095, amountRefunded: 0, gst: { rate: 0.12 },
  items: [{ product: 'a', name: 'Wash', price: 500, qty: 2, refundedQty: 0 }, { product: 'b', name: 'Diapers', price: 1000, qty: 1, refundedQty: 0 }],
};

test('refunds: item refund = price − discount share + GST', () => {
  // 500 × (1 − 10%) × 1.12 = 504
  assert.equal(itemRefundAmount(order, [{ product: 'a', qty: 1 }]), 504);
  assert.equal(itemRefundAmount(order, [{ product: 'a', qty: 2 }, { product: 'b', qty: 1 }]), 2016);
});

test('refunds: cannot exceed quantity or what is left on the order', () => {
  assert.throws(() => itemRefundAmount(order, [{ product: 'a', qty: 3 }]), /Only 2 of Wash/);
  assert.throws(() => itemRefundAmount({ ...order, items: [{ ...order.items[0], refundedQty: 2 }] }, [{ product: 'a', qty: 1 }]), /Only 0/);
  assert.throws(() => itemRefundAmount(order, [{ product: 'zzz', qty: 1 }]), /not part of this order/);
  assert.equal(itemRefundAmount({ ...order, amountRefunded: 2000 }, [{ product: 'b', qty: 1 }]), 95); // capped at remaining
  assert.throws(() => validateAmount({ ...order, amountRefunded: 2000 }, 100), /Only ₹95 is left/);
  assert.throws(() => validateAmount(order, 0), /more than ₹0/);
  assert.equal(validateAmount(order, 99.6), 100);
});

/* ---------- delivery ---------- */
test('couriers: tracking links per partner, invalid AWBs rejected', () => {
  assert.ok(COURIERS.includes('Delhivery'));
  assert.equal(trackingUrl('Delhivery', 'DLV12345678'), 'https://www.delhivery.com/track-v2/package/DLV12345678');
  assert.match(trackingUrl('Blue Dart', '12345678901'), /bluedart\.com.*12345678901/);
  assert.equal(trackingUrl('Unknown', 'ABC123456'), null);
  assert.equal(trackingUrl('Delhivery', 'bad awb!'), null);
});

test('serviceability: zones, express in metros, state and Sunday-free ETAs', () => {
  const morning = new Date('2026-11-03T09:00:00'); // Tuesday
  const metro = check('560001', morning);
  assert.equal(metro.zone, 'metro');
  assert.equal(metro.express, true);
  assert.equal(metro.state, 'Karnataka');
  assert.ok(metro.expressEta < metro.standardEta);
  const national = check('517501', morning);
  assert.equal(national.express, false);
  assert.equal(check('795001', morning).zone, 'remote');
  assert.equal(check('012345').serviceable, false);
  // after 2 pm dispatch moves to the next day
  const late = check('560001', new Date('2026-11-03T16:00:00'));
  assert.ok(late.standardEta > metro.standardEta);
  // ETAs never land on a Sunday
  for (let d = 0; d < 7; d++) {
    const r = check('517501', new Date(2026, 10, 1 + d, 10));
    assert.notEqual(new Date(r.standardEta).getDay(), 0);
  }
});

/* ---------- security ---------- */
test('sanitize: strips Mongo operators and dotted keys at any depth', () => {
  const body = { email: { $gt: '' }, password: 'x', nested: { 'a.b': 1, ok: [{ $where: 'evil' }, 2] } };
  clean(body);
  assert.deepEqual(body, { email: {}, password: 'x', nested: { ok: [{}, 2] } });
});
