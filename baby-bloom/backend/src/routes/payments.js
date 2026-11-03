const router = require('express').Router();
const crypto = require('crypto');
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');
const { markPaid } = require('../services/orderOps');
const ah = require('../utils/asyncHandler');

/* ---------- gateway configuration ---------- */
// PDF .env uses RAZORPAY_KEY — accepted as an alias of RAZORPAY_KEY_ID
const RZP_ID = () => process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY;
const razorpayLive = () => Boolean(RZP_ID() && process.env.RAZORPAY_KEY_SECRET);
const stripeLive = () => Boolean(process.env.STRIPE_SECRET_KEY);

let rzp = null;
const razorpay = () => {
  if (!rzp && razorpayLive()) {
    const Razorpay = require('razorpay');
    rzp = new Razorpay({ key_id: RZP_ID(), key_secret: process.env.RAZORPAY_KEY_SECRET });
  }
  return rzp;
};
let stripeClient = null;
const stripe = () => {
  if (!stripeClient && stripeLive()) stripeClient = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
};

const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

const loadOwn = async (req, res) => {
  const order = await Order.findById(req.body.orderId);
  if (!order || order.user.toString() !== req.user._id.toString()) {
    res.status(404).json({ message: 'Order not found' });
    return null;
  }
  if (order.status === 'Cancelled') {
    res.status(400).json({ message: 'Order was cancelled' });
    return null;
  }
  return order;
};

const attempt = async (order, gateway, status, ref, error) => {
  order.payment.attempts.push({ gateway, status, ref, error: error ? String(error).slice(0, 200) : undefined });
  if (status === 'failed' && order.payment.status === 'pending') order.payment.status = 'failed';
  await order.save();
};

// Which gateways are live — the checkout UI reads this. Without keys a demo gateway keeps the flow testable.
router.get('/config', (req, res) =>
  res.json({ razorpay: razorpayLive(), stripe: stripeLive(), demo: !razorpayLive() && !stripeLive(), keyId: RZP_ID() || null })
);

/* ======================= RAZORPAY ======================= */

// Step 1: create a Razorpay order for our DB order (amount always from the DB, in paise)
router.post(
  '/create',
  protect,
  ah(async (req, res) => {
    const order = await loadOwn(req, res);
    if (!order) return;
    if (order.payment.status === 'paid') return res.json({ alreadyPaid: true, order });
    if (!razorpayLive()) return res.json({ mode: 'demo', amount: order.total * 100, currency: 'INR', orderId: order._id });

    if (!order.payment.razorpayOrderId) {
      const r = await razorpay().orders.create({ amount: order.total * 100, currency: 'INR', receipt: order.orderNo, notes: { orderId: order._id.toString() } });
      order.payment.razorpayOrderId = r.id;
      order.payment.method = 'razorpay';
      await order.save();
    }
    res.json({
      mode: 'razorpay',
      keyId: RZP_ID(),
      razorpayOrderId: order.payment.razorpayOrderId,
      amount: order.total * 100,
      currency: 'INR',
      orderId: order._id,
      prefill: { name: order.address.name, contact: order.address.phone, email: req.user.email },
    });
  })
);

// Step 2: verify the HMAC signature returned by Razorpay Checkout, then mark paid
router.post(
  '/verify',
  protect,
  ah(async (req, res) => {
    const order = await loadOwn(req, res);
    if (!order) return;

    if (!razorpayLive()) {
      // DEMO gateway — simulates capture so the full flow works without keys
      if (req.body.simulateFailure) {
        await attempt(order, 'demo', 'failed', null, 'Simulated failure');
        return res.status(402).json({ message: 'Payment failed (simulated)' });
      }
      return res.json({ ok: true, order: await markPaid(order, { method: 'demo', razorpayPaymentId: 'demo_' + Date.now() }) });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (razorpay_order_id !== order.payment.razorpayOrderId) return res.status(400).json({ message: 'Payment/order mismatch' });
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    if (!safeEqual(expected, razorpay_signature)) {
      await attempt(order, 'razorpay', 'failed', razorpay_payment_id, 'Signature verification failed');
      return res.status(400).json({ message: 'Signature verification failed' });
    }
    res.json({ ok: true, order: await markPaid(order, { method: 'razorpay', razorpayPaymentId: razorpay_payment_id }) });
  })
);

// Checkout reports dismissals / failures so every attempt is visible to support
router.post(
  '/failed',
  protect,
  ah(async (req, res) => {
    const order = await loadOwn(req, res);
    if (!order) return;
    if (order.payment.status === 'paid') return res.json({ ok: true });
    const status = req.body.reason === 'dismissed' ? 'dismissed' : 'failed';
    await attempt(order, req.body.gateway || order.payment.method, status, req.body.ref, req.body.error);
    res.json({ ok: true });
  })
);

/**
 * Razorpay webhook (payment.captured / payment.failed / refund.processed) — the safety net
 * for when the customer closes the browser before /verify runs. Raw body, mounted in server.js.
 */
async function razorpayWebhook(req, res) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(400).end();
  const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
  if (!safeEqual(expected, req.headers['x-razorpay-signature'])) return res.status(400).send('Bad signature');
  const event = JSON.parse(req.body.toString('utf8'));
  const pay = event.payload?.payment?.entity;
  if (pay?.order_id) {
    const order = await Order.findOne({ 'payment.razorpayOrderId': pay.order_id });
    if (order && event.event === 'payment.captured' && pay.amount === order.total * 100) {
      await markPaid(order, { method: 'razorpay', razorpayPaymentId: pay.id }).catch((e) => console.error('[rzp webhook]', e.message));
    } else if (order && event.event === 'payment.failed') {
      await attempt(order, 'razorpay', 'failed', pay.id, pay.error_description);
    }
  }
  const refund = event.payload?.refund?.entity;
  if (refund && event.event === 'refund.processed') {
    await Order.updateOne({ 'refunds.gatewayRefundId': refund.id }, { $set: { 'refunds.$.status': 'processed' } });
  }
  res.json({ received: true });
}

/* ======================= STRIPE ======================= */

router.post(
  '/stripe/session',
  protect,
  ah(async (req, res) => {
    if (!stripeLive()) return res.status(400).json({ message: 'Stripe is not configured (set STRIPE_SECRET_KEY)' });
    const order = await loadOwn(req, res);
    if (!order) return;
    if (order.payment.status === 'paid') return res.json({ alreadyPaid: true, order });
    const client = process.env.CLIENT_URL || 'http://localhost:5173';
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      customer_email: req.user.email,
      client_reference_id: order._id.toString(),
      metadata: { orderId: order._id.toString(), orderNo: order.orderNo },
      payment_intent_data: { metadata: { orderId: order._id.toString(), orderNo: order.orderNo } },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'inr',
            unit_amount: order.total * 100, // single line = our server total, identical to the invoice
            product_data: { name: `BABY BLOOM order ${order.orderNo}`, description: order.items.map((i) => `${i.name} ×${i.qty}`).join(', ').slice(0, 500) },
          },
        },
      ],
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${client}/orders/${order._id}?stripe_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${client}/orders/${order._id}?stripe_cancelled=1`,
    });
    order.payment.method = 'stripe';
    order.payment.stripeSessionId = session.id;
    order.payment.attempts.push({ gateway: 'stripe', status: 'started', ref: session.id });
    await order.save();
    res.json({ url: session.url, sessionId: session.id });
  })
);

router.post(
  '/stripe/verify',
  protect,
  ah(async (req, res) => {
    if (!stripeLive()) return res.status(400).json({ message: 'Stripe is not configured' });
    const order = await loadOwn(req, res);
    if (!order) return;
    if (order.payment.status === 'paid') return res.json({ ok: true, order });
    const { sessionId } = req.body;
    if (!sessionId || sessionId !== order.payment.stripeSessionId) return res.status(400).json({ message: 'Payment/order mismatch' });
    const s = await stripe().checkout.sessions.retrieve(sessionId);
    if (s.payment_status !== 'paid' || s.amount_total !== order.total * 100) {
      await attempt(order, 'stripe', 'failed', sessionId, `Session ${s.payment_status}`);
      return res.status(402).json({ message: 'Payment not completed' });
    }
    const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
    res.json({ ok: true, order: await markPaid(order, { method: 'stripe', stripePaymentIntent: pi }) });
  })
);

async function stripeWebhook(req, res) {
  if (!stripeLive() || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).end();
  let event;
  try {
    event = stripe().webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook error: ${e.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const order = await Order.findById(s.metadata?.orderId);
    if (order && s.payment_status === 'paid' && s.amount_total === order.total * 100)
      await markPaid(order, { method: 'stripe', stripePaymentIntent: s.payment_intent }).catch((e) => console.error('[stripe webhook]', e.message));
  } else if (event.type === 'checkout.session.expired') {
    const order = await Order.findById(event.data.object.metadata?.orderId);
    if (order && order.payment.status !== 'paid') await attempt(order, 'stripe', 'expired', event.data.object.id);
  }
  res.json({ received: true });
}

module.exports = router;
module.exports.razorpayWebhook = razorpayWebhook;
module.exports.stripeWebhook = stripeWebhook;
