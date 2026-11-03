const Product = require('../models/Product');
const User = require('../models/User');
const InventoryLog = require('../models/InventoryLog');
const Counter = require('../models/Counter');
const { financialYear } = require('../lib/gst');
const { itemRefundAmount, validateAmount } = require('../lib/refunds');
const { notify } = require('./notify');
const { publishOrder, publishAdmin } = require('./events');

async function log(item, change, after, reason, ref, by) {
  await InventoryLog.create({ product: item.product, name: item.name, change, after, reason, ref, by });
}

/**
 * Atomically reserves stock for each line (stock >= qty guard). If any line fails,
 * previously reserved lines are rolled back so we never oversell.
 */
async function reserveStock(order) {
  const done = [];
  for (const i of order.items) {
    const p = await Product.findOneAndUpdate({ _id: i.product, stock: { $gte: i.qty } }, { $inc: { stock: -i.qty } }, { new: true, projection: { stock: 1, name: 1, lowStockThreshold: 1 } });
    if (!p) {
      for (const d of done) await Product.updateOne({ _id: d.item.product }, { $inc: { stock: d.item.qty } });
      const e = new Error(`${i.name} just went out of stock`);
      e.status = 409;
      throw e;
    }
    done.push({ item: i, after: p.stock });
    if (p.stock <= (p.lowStockThreshold ?? 5)) publishAdmin('low-stock', { _id: p._id, name: p.name, stock: p.stock });
  }
  await Promise.all(done.map((d) => log(d.item, -d.item.qty, d.after, 'sale', order.orderNo)));
}

/** Puts items back on the shelf. `lines` defaults to every remaining item on the order. */
async function restock(order, reason = 'cancel', by, lines) {
  const list = lines || order.items.map((i) => ({ product: i.product, name: i.name, qty: i.qty - (i.refundedQty || 0) })).filter((l) => l.qty > 0);
  for (const l of list) {
    const p = await Product.findOneAndUpdate({ _id: l.product }, { $inc: { stock: l.qty } }, { new: true, projection: { stock: 1 } });
    await log(l, l.qty, p?.stock, reason, order.orderNo, by);
  }
}

/** Gap-free GST invoice number per financial year, e.g. BB/2026-27/000042 */
async function assignInvoiceNumber(order) {
  if (order.invoice?.number) return order.invoice.number;
  const fy = financialYear(order.payment.paidAt || new Date());
  const seq = await Counter.next(`invoice-${fy}`);
  order.invoice = { number: `BB/${fy}/${String(seq).padStart(6, '0')}`, issuedAt: new Date() };
  return order.invoice.number;
}

/** Marks an order paid exactly once (idempotent — safe for duplicate verify/webhook calls). */
async function markPaid(order, { method, razorpayPaymentId, stripePaymentIntent }) {
  if (order.payment.status === 'paid') return order;
  await reserveStock(order);
  order.payment.status = 'paid';
  order.payment.method = method || order.payment.method;
  if (razorpayPaymentId) order.payment.razorpayPaymentId = razorpayPaymentId;
  if (stripePaymentIntent) order.payment.stripePaymentIntent = stripePaymentIntent;
  order.payment.paidAt = new Date();
  order.payment.attempts.push({ gateway: order.payment.method, status: 'paid', ref: razorpayPaymentId || stripePaymentIntent });
  order.status = 'Placed';
  order.timeline.push({ status: 'Placed', note: 'Payment confirmed' });
  await assignInvoiceNumber(order);
  await order.save();
  publishOrder(order, 'order-new');
  const user = await User.findById(order.user);
  if (user) notify(order, user, 'placed').catch(() => {});
  return order;
}

/** Calls the gateway that took the money. Returns the gateway refund id (or a demo id). */
async function gatewayRefund(order, amount) {
  const paise = Math.round(amount * 100);
  if (order.payment.method === 'razorpay' && order.payment.razorpayPaymentId && process.env.RAZORPAY_KEY_SECRET) {
    const Razorpay = require('razorpay');
    const r = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const res = await r.payments.refund(order.payment.razorpayPaymentId, { amount: paise, notes: { order: order.orderNo } });
    return res.id;
  }
  if (order.payment.method === 'stripe' && order.payment.stripePaymentIntent && process.env.STRIPE_SECRET_KEY) {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const res = await stripe.refunds.create({ payment_intent: order.payment.stripePaymentIntent, amount: paise, metadata: { order: order.orderNo } });
    return res.id;
  }
  return `demo_rfnd_${Date.now()}`;
}

/**
 * Full or partial refund.
 *  - items: [{ product, qty }] → amount computed per item (price − discount share + GST), items can be restocked
 *  - amount: a custom amount (goodwill / shipping refund), validated against what is left
 *  - neither → full refund of whatever is left
 */
async function refundOrder(order, { items, amount, reason, restockItems = true, by } = {}) {
  if (!['paid', 'partially_refunded'].includes(order.payment.status)) {
    const e = new Error('Only paid orders can be refunded');
    e.status = 400;
    throw e;
  }
  let value;
  let lines = [];
  try {
    if (items?.length) {
      lines = items.map((l) => ({ product: l.product, qty: Math.floor(Number(l.qty) || 0) }));
      value = itemRefundAmount(order, lines);
    } else {
      value = amount ? validateAmount(order, amount) : order.total - order.amountRefunded;
    }
  } catch (e) {
    e.status = 400;
    throw e;
  }
  if (!(value > 0)) {
    const e = new Error('Nothing left to refund on this order');
    e.status = 400;
    throw e;
  }

  const gatewayRefundId = await gatewayRefund(order, value);

  // Item bookkeeping + restock
  const isFull = !items?.length && !amount;
  const restockLines = [];
  if (items?.length) {
    for (const l of lines) {
      const it = order.items.find((i) => String(i.product) === String(l.product));
      it.refundedQty = (it.refundedQty || 0) + l.qty;
      restockLines.push({ product: it.product, name: it.name, qty: l.qty });
    }
  } else if (isFull) {
    for (const it of order.items) {
      const left = it.qty - (it.refundedQty || 0);
      if (left > 0) restockLines.push({ product: it.product, name: it.name, qty: left });
      it.refundedQty = it.qty;
    }
  }
  // Goods already delivered only return to stock when the admin confirms they came back
  if (restockItems && restockLines.length) await restock(order, 'refund', by, restockLines);

  order.refunds.push({
    amount: value,
    items: restockLines.map((l) => ({ product: l.product, name: l.name, qty: l.qty })),
    reason,
    restocked: Boolean(restockItems && restockLines.length),
    gatewayRefundId,
    status: 'processed',
  });
  order.amountRefunded += value;
  const fully = order.amountRefunded >= order.total;
  order.payment.status = fully ? 'refunded' : 'partially_refunded';
  if (fully) order.status = 'Refunded';
  order.timeline.push({ status: fully ? 'Refunded' : 'Partial refund', note: `₹${value} refunded${reason ? ` — ${reason}` : ''}` });
  await order.save();
  publishOrder(order);
  const user = await User.findById(order.user._id || order.user);
  if (user) notify(order, user, 'refunded', { amount: value }).catch(() => {});
  return order;
}

module.exports = { reserveStock, restock, markPaid, refundOrder, assignInvoiceNumber };
