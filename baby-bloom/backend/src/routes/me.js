const router = require('express').Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const { stateFromPincode } = require('../lib/gst');
const ah = require('../utils/asyncHandler');

router.use(protect);
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

/* ---------- Address book (checkout "Address" step) ---------- */
const cleanAddress = (a = {}) => {
  const out = {
    label: String(a.label || 'Home').slice(0, 20),
    name: String(a.name || '').trim().slice(0, 60),
    phone: String(a.phone || '').replace(/\D/g, '').slice(-10),
    line1: String(a.line1 || '').trim().slice(0, 200),
    city: String(a.city || '').trim().slice(0, 60),
    pincode: String(a.pincode || '').trim(),
    isDefault: Boolean(a.isDefault),
  };
  out.state = String(a.state || stateFromPincode(out.pincode) || '').slice(0, 40);
  if (!out.name || !out.line1 || !out.city) throw Object.assign(new Error('Name, address and city are required'), { status: 400 });
  if (!/^\d{10}$/.test(out.phone)) throw Object.assign(new Error('Enter a valid 10-digit mobile number'), { status: 400 });
  if (!/^[1-9]\d{5}$/.test(out.pincode)) throw Object.assign(new Error('Enter a valid 6-digit pincode'), { status: 400 });
  return out;
};

const setDefault = (user, id) => user.addresses.forEach((x) => (x.isDefault = x._id.toString() === id));

router.get('/addresses', (req, res) => res.json(req.user.addresses));

router.post(
  '/addresses',
  ah(async (req, res) => {
    if (req.user.addresses.length >= 10) return res.status(400).json({ message: 'You can save up to 10 addresses' });
    const a = cleanAddress(req.body);
    req.user.addresses.push(a);
    const added = req.user.addresses[req.user.addresses.length - 1];
    if (a.isDefault || req.user.addresses.length === 1) setDefault(req.user, added._id.toString());
    await req.user.save();
    res.status(201).json(req.user.addresses);
  })
);

router.put(
  '/addresses/:id',
  ah(async (req, res) => {
    const a = req.user.addresses.id(req.params.id);
    if (!a) return res.status(404).json({ message: 'Address not found' });
    Object.assign(a, cleanAddress({ ...a.toObject(), ...req.body }));
    if (req.body.isDefault) setDefault(req.user, a._id.toString());
    await req.user.save();
    res.json(req.user.addresses);
  })
);

router.delete(
  '/addresses/:id',
  ah(async (req, res) => {
    const wasDefault = req.user.addresses.id(req.params.id)?.isDefault;
    req.user.addresses = req.user.addresses.filter((x) => x._id.toString() !== req.params.id);
    if (wasDefault && req.user.addresses[0]) req.user.addresses[0].isDefault = true;
    await req.user.save();
    res.json(req.user.addresses);
  })
);

/* ---------- Cart (server copy — follows the customer across devices) ---------- */
router.get(
  '/cart',
  ah(async (req, res) => {
    await req.user.populate({ path: 'cart.items.product', select: 'name price mrp images stock size active category' });
    const items = (req.user.cart?.items || [])
      .filter((i) => i.product && i.product.active)
      .map((i) => ({ _id: i.product._id, name: i.product.name, price: i.product.price, mrp: i.product.mrp, image: i.product.images?.[0], stock: i.product.stock, size: i.product.size, category: i.product.category, qty: Math.min(i.qty, i.product.stock) }))
      .filter((i) => i.qty > 0);
    res.json(items);
  })
);

router.put(
  '/cart',
  ah(async (req, res) => {
    const items = (Array.isArray(req.body.items) ? req.body.items : [])
      .filter((i) => validId(i._id || i.product))
      .slice(0, 50)
      .map((i) => ({ product: i._id || i.product, qty: Math.min(20, Math.max(1, Number(i.qty) || 1)) }));
    req.user.cart = { items, updatedAt: new Date() };
    await req.user.save();
    res.json({ ok: true, count: items.length });
  })
);

module.exports = router;
