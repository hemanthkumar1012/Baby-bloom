const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const { splitGst, stateFromPincode } = require('../lib/gst');

const FREE_SHIPPING_ABOVE = 999;
const STANDARD_FEE = 79;
const EXPRESS_FEE = 149;
const GST_RATE = 0.12; // 12% GST on baby-care goods
const COUNTED = { $nin: ['Pending Payment', 'Cancelled'] }; // orders that "use" a coupon

const fail = (msg) => {
  const e = new Error(msg);
  e.status = 400;
  return e;
};

/**
 * Re-prices a cart on the server from DB prices (never trusts client prices).
 * Coupon rules (first order, per-customer limit, total uses, category, dates) are
 * checked against the customer's real order history. GST is split into
 * CGST + SGST or IGST from the delivery state.
 */
async function priceCart(rawItems, couponCode, { shipping = 'standard', userId, pincode, state } = {}) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw fail('Cart is empty');
  if (rawItems.length > 50) throw fail('Too many items in one order');

  const ids = rawItems.map((i) => i.product);
  const products = await Product.find({ _id: { $in: ids }, active: true });
  const map = new Map(products.map((p) => [p._id.toString(), p]));

  const items = rawItems.map((i) => {
    const p = map.get(String(i.product));
    const qty = Math.min(20, Math.max(1, Math.floor(Number(i.qty) || 1)));
    if (!p) throw fail('A product in your cart is no longer available');
    if (p.stock < qty) throw fail(p.stock ? `Only ${p.stock} left of ${p.name}` : `${p.name} is out of stock`);
    return { product: p._id, name: p.name, image: p.images?.[0], sku: p.sku, hsn: p.hsn, qty, price: p.price, category: p.category };
  });

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  let discount = 0;
  let coupon;
  if (couponCode) {
    const c = await Coupon.findOne({ code: String(couponCode).toUpperCase().trim() });
    if (!c) throw fail('Invalid coupon');
    const [userOrders, userUses, totalUses] = await Promise.all([
      userId ? Order.countDocuments({ user: userId, status: COUNTED }) : 0,
      userId && c.perUserLimit ? Order.countDocuments({ user: userId, coupon: c.code, status: COUNTED }) : 0,
      c.usageLimit ? Order.countDocuments({ coupon: c.code, status: COUNTED }) : 0,
    ]);
    const r = c.evaluate({ items, userOrders, userUses, totalUses });
    if (!r.ok) throw fail(r.message);
    discount = r.discount;
    coupon = c.code;
  }

  const taxable = subtotal - discount;
  const method = shipping === 'express' ? 'express' : 'standard';
  const deliveryFee = method === 'express' ? EXPRESS_FEE : taxable >= FREE_SHIPPING_ABOVE ? 0 : STANDARD_FEE;
  const tax = Math.round(taxable * GST_RATE);
  const gst = splitGst(tax, state || stateFromPincode(pincode), undefined, GST_RATE);
  const total = taxable + tax + deliveryFee;
  return {
    items: items.map(({ category, ...rest }) => rest),
    subtotal,
    discount,
    coupon,
    deliveryFee,
    tax,
    gst,
    total,
    shippingMethod: method,
    freeShippingGap: method === 'standard' && deliveryFee ? FREE_SHIPPING_ABOVE - taxable : 0,
  };
}

module.exports = { priceCart, FREE_SHIPPING_ABOVE, STANDARD_FEE, EXPRESS_FEE, GST_RATE };
