const router = require('express').Router();
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');
const { priceCart } = require('../services/pricing');
const { streamInvoice } = require('../services/invoice');
const { whatsappLink } = require('../services/notify');
const { check: checkPincode } = require('../services/serviceability');
const { publishOrder } = require('../services/events');
const { stateFromPincode } = require('../lib/gst');
const User = require('../models/User');
const ah = require('../utils/asyncHandler');

// POST /api/orders  { items, addressId | address, coupon, shipping, method: razorpay|stripe }
// Order is created as "Pending Payment"; stock is reserved only once the gateway confirms payment.
router.post(
  '/',
  protect,
  ah(async (req, res) => {
    const { items, addressId, coupon, shipping, method } = req.body;
    const saved = addressId ? req.user.addresses.id(addressId) : null;
    const address = saved ? saved.toObject() : req.body.address;
    if (!address?.name || !address?.phone || !address?.line1 || !address?.city || !/^\d{6}$/.test(address?.pincode || ''))
      return res.status(400).json({ message: 'Choose or add a complete delivery address' });
    if (!/^\d{10}$/.test(String(address.phone).replace(/\D/g, '').slice(-10))) return res.status(400).json({ message: 'Valid 10-digit phone required' });

    const zone = checkPincode(address.pincode);
    if (!zone.serviceable) return res.status(400).json({ message: zone.message });
    if (shipping === 'express' && !zone.express) return res.status(400).json({ message: 'Express delivery is only available in metro cities' });

    const state = address.state || stateFromPincode(address.pincode);
    const { shippingMethod, freeShippingGap, ...priced } = await priceCart(items, coupon, { shipping, userId: req.user._id, pincode: address.pincode, state });
    const gateway = ['razorpay', 'stripe'].includes(method) ? method : 'razorpay';
    const order = await Order.create({
      user: req.user._id,
      ...priced,
      status: 'Pending Payment',
      address: { name: address.name, phone: address.phone, line1: address.line1, city: address.city, state, pincode: address.pincode },
      shipping: { method: shippingMethod, eta: shippingMethod === 'express' ? zone.expressEta : zone.standardEta },
      payment: { method: gateway },
      timeline: [{ status: 'Pending Payment' }],
    });
    await User.updateOne({ _id: req.user._id }, { $set: { 'cart.items': [], 'cart.updatedAt': new Date() } });
    res.status(201).json(order);
  })
);

router.get(
  '/mine',
  protect,
  ah(async (req, res) => res.json(await Order.find({ user: req.user._id }).select('-payment.attempts -notifications').sort('-createdAt').limit(100)))
);

const ownOrAdmin = async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email whatsappOptIn');
  if (!order) {
    res.status(404).json({ message: 'Order not found' });
    return null;
  }
  if (req.user.role !== 'admin' && order.user._id.toString() !== req.user._id.toString()) {
    res.status(403).json({ message: 'Not your order' });
    return null;
  }
  return order;
};

router.get(
  '/:id',
  protect,
  ah(async (req, res) => {
    const order = await ownOrAdmin(req, res);
    if (!order) return;
    const o = order.toObject();
    if (req.user.role !== 'admin') delete o.notifications;
    res.json({ ...o, whatsapp: whatsappLink(order) });
  })
);

// GST invoice PDF — token can come via ?token= so it opens in a new tab
router.get(
  '/:id/invoice',
  (req, res, next) => {
    if (req.query.token && !req.headers.authorization) req.headers.authorization = `Bearer ${req.query.token}`;
    next();
  },
  protect,
  ah(async (req, res) => {
    const order = await ownOrAdmin(req, res);
    if (!order) return;
    if (!order.invoice?.number) return res.status(400).json({ message: 'Invoice is available once payment is confirmed' });
    streamInvoice(order, order.user, res);
  })
);

// Customer can cancel before packing; a paid order is refunded in full automatically
router.post(
  '/:id/cancel',
  protect,
  ah(async (req, res) => {
    const order = await ownOrAdmin(req, res);
    if (!order) return;
    if (!['Pending Payment', 'Placed'].includes(order.status)) return res.status(400).json({ message: 'Order can no longer be cancelled — it is already packed' });
    if (order.payment.status === 'paid') {
      const { refundOrder } = require('../services/orderOps');
      await refundOrder(order, { reason: 'Cancelled by customer', restockItems: true });
      order.status = 'Cancelled';
      order.timeline.push({ status: 'Cancelled', note: 'Cancelled by customer · full refund issued' });
    } else {
      order.status = 'Cancelled';
      order.timeline.push({ status: 'Cancelled', note: 'Cancelled by customer before payment' });
    }
    await order.save();
    publishOrder(order); // refund email/WhatsApp was already sent by refundOrder
    res.json(order);
  })
);

module.exports = router;
