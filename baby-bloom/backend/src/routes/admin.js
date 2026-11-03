const router = require('express').Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const Banner = require('../models/Banner');
const InventoryLog = require('../models/InventoryLog');
const { protect, admin } = require('../middleware/auth');
const { restock, refundOrder } = require('../services/orderOps');
const { notify, notifyStatus } = require('../services/notify');
const { publishOrder } = require('../services/events');
const { streamLabel } = require('../services/label');
const { COURIERS, trackingUrl, AWB_RE } = require('../lib/couriers');
const ah = require('../utils/asyncHandler');

// Allow ?token= for links opened in a new tab (shipping labels)
router.use((req, res, next) => {
  if (req.query.token && !req.headers.authorization) req.headers.authorization = `Bearer ${req.query.token}`;
  next();
});
router.use(protect, admin);

/* ======================= Cloudinary media ======================= */
const cloudinary = () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return null;
  const c = require('cloudinary').v2;
  c.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
  return c;
};

/** Extracts the Cloudinary public_id from a delivery URL (…/upload/[transforms/]v123/folder/name.jpg → folder/name). */
const publicIdFromUrl = (url) => {
  const m = String(url || '').match(/\/upload\/(?:.*?\/)?v\d+\/(.+?)\.[a-z0-9]+$/i);
  return m ? m[1] : null;
};

// POST /api/admin/upload  { file: "data:image/...;base64,...", folder: "products"|"banners" } → { url, publicId }
router.post(
  '/upload',
  ah(async (req, res) => {
    const { file, folder = 'products' } = req.body;
    if (!file || !/^data:image\/(png|jpe?g|webp|avif);base64,/.test(file)) return res.status(400).json({ message: 'Send a PNG, JPG, WebP or AVIF image' });
    const c = cloudinary();
    if (!c) return res.status(400).json({ message: 'Cloudinary is not configured — add CLOUDINARY_* keys to .env, or paste an image URL' });
    const banner = folder === 'banners';
    const r = await c.uploader.upload(file, {
      folder: `baby-bloom/${banner ? 'banners' : 'products'}`,
      transformation: [{ width: banner ? 2400 : 1600, height: banner ? 1200 : 1600, crop: 'limit' }],
      resource_type: 'image',
    });
    res.status(201).json({ url: r.secure_url, publicId: r.public_id, width: r.width, height: r.height });
  })
);

// DELETE /api/admin/upload { url } → removes the asset from Cloudinary when an image is removed
router.delete(
  '/upload',
  ah(async (req, res) => {
    const c = cloudinary();
    const id = publicIdFromUrl(req.body.url);
    if (!c || !id || !String(req.body.url).includes('res.cloudinary.com')) return res.json({ ok: true, skipped: true });
    await c.uploader.destroy(id);
    res.json({ ok: true });
  })
);

/* ======================= Dashboard ======================= */
const PAID = { 'payment.status': { $in: ['paid', 'partially_refunded'] } };
const NET = { $subtract: ['$total', { $ifNull: ['$amountRefunded', 0] }] };

router.get(
  '/stats',
  ah(async (req, res) => {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 7));
    const since = new Date(Date.now() - (days - 1) * 86400000);
    since.setHours(0, 0, 0, 0);
    const prevSince = new Date(since.getTime() - days * 86400000);
    const [period, prev, lifetime, customers, repeat, byStatus, daily, top, byCategory, lowStock, refunds, toFulfil] = await Promise.all([
      Order.aggregate([{ $match: { ...PAID, createdAt: { $gte: since } } }, { $group: { _id: null, sum: { $sum: NET }, n: { $sum: 1 } } }]),
      Order.aggregate([{ $match: { ...PAID, createdAt: { $gte: prevSince, $lt: since } } }, { $group: { _id: null, sum: { $sum: NET }, n: { $sum: 1 } } }]),
      Order.aggregate([{ $match: PAID }, { $group: { _id: null, sum: { $sum: NET }, n: { $sum: 1 } } }]),
      User.countDocuments({ role: 'customer' }),
      Order.aggregate([{ $match: PAID }, { $group: { _id: '$user', n: { $sum: 1 } } }, { $group: { _id: null, buyers: { $sum: 1 }, repeat: { $sum: { $cond: [{ $gt: ['$n', 1] }, 1, 0] } } } }]),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { ...PAID, createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, revenue: { $sum: NET }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([{ $match: PAID }, { $unwind: '$items' }, { $group: { _id: '$items.name', qty: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.qty', '$items.price'] } } } }, { $sort: { qty: -1 } }, { $limit: 5 }]),
      Order.aggregate([
        { $match: PAID },
        { $unwind: '$items' },
        { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'p' } },
        { $group: { _id: { $ifNull: [{ $first: '$p.category' }, 'Other'] }, revenue: { $sum: { $multiply: ['$items.qty', '$items.price'] } } } },
        { $sort: { revenue: -1 } },
      ]),
      Product.find({ active: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } }).select('name stock lowStockThreshold').sort('stock').limit(10),
      Order.aggregate([{ $match: { amountRefunded: { $gt: 0 } } }, { $group: { _id: null, sum: { $sum: '$amountRefunded' }, n: { $sum: 1 } } }]),
      Order.countDocuments({ status: { $in: ['Placed', 'Packed'] } }),
    ]);
    const p = period[0] || { sum: 0, n: 0 };
    const q = prev[0] || { sum: 0, n: 0 };
    const r = repeat[0] || { buyers: 0, repeat: 0 };
    res.json({
      period: { days, revenue: p.sum, orders: p.n, aov: p.n ? Math.round(p.sum / p.n) : 0, growth: q.sum ? Math.round(((p.sum - q.sum) / q.sum) * 100) : null },
      lifetime: lifetime[0] || { sum: 0, n: 0 },
      customers,
      repeatRate: r.buyers ? Math.round((r.repeat / r.buyers) * 100) : 0,
      refunds: refunds[0] || { sum: 0, n: 0 },
      toFulfil,
      byStatus,
      daily,
      top,
      byCategory,
      lowStock,
    });
  })
);

/* ======================= Products ======================= */
const PRODUCT_FIELDS = ['name', 'price', 'mrp', 'images', 'category', 'description', 'isBestseller', 'brand', 'sku', 'size', 'ageGroup', 'features', 'tags', 'hsn', 'active', 'lowStockThreshold'];
const pick = (body) => Object.fromEntries(Object.entries(body).filter(([k]) => PRODUCT_FIELDS.includes(k)));
const priceCheck = (b) => (b.mrp && b.price && Number(b.price) > Number(b.mrp) ? 'Price cannot be higher than MRP' : null);

router.get('/products', ah(async (req, res) => res.json(await Product.find().sort('-createdAt'))));

router.post(
  '/products',
  ah(async (req, res) => {
    const bad = priceCheck(req.body);
    if (bad) return res.status(400).json({ message: bad });
    const p = await Product.create({ ...pick(req.body), stock: Math.max(0, Number(req.body.stock) || 0) });
    if (p.stock) await InventoryLog.create({ product: p._id, name: p.name, change: p.stock, after: p.stock, reason: 'restock', ref: 'Opening stock', by: req.user._id });
    res.status(201).json(p);
  })
);

router.put(
  '/products/:id',
  ah(async (req, res) => {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Not found' });
    const bad = priceCheck({ price: req.body.price ?? p.price, mrp: req.body.mrp ?? p.mrp });
    if (bad) return res.status(400).json({ message: bad });
    Object.assign(p, pick(req.body)); // stock changes go through /stock/:id/adjust so every movement is logged
    await p.save();
    res.json(p);
  })
);

router.delete(
  '/products/:id',
  ah(async (req, res) => {
    await Product.findByIdAndUpdate(req.params.id, { active: false }); // soft delete keeps order history intact
    res.json({ ok: true });
  })
);

/* ======================= Stock ======================= */
router.get(
  '/stock',
  ah(async (req, res) => {
    const list = await Product.find({ active: true }).select('name sku images stock lowStockThreshold category price').sort('stock');
    res.json({
      items: list,
      totals: {
        skus: list.length,
        units: list.reduce((s, p) => s + p.stock, 0),
        value: list.reduce((s, p) => s + p.stock * p.price, 0),
        low: list.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold).length,
        out: list.filter((p) => p.stock === 0).length,
      },
    });
  })
);

// POST /api/admin/stock/:id/adjust { change: +20 | -2, reason: restock|damage|correction, note }
router.post(
  '/stock/:id/adjust',
  ah(async (req, res) => {
    const change = Math.trunc(Number(req.body.change));
    const reason = ['restock', 'damage', 'correction'].includes(req.body.reason) ? req.body.reason : 'correction';
    if (!change) return res.status(400).json({ message: 'Enter a non-zero quantity' });
    const guard = change < 0 ? { stock: { $gte: -change } } : {};
    const p = await Product.findOneAndUpdate({ _id: req.params.id, ...guard }, { $inc: { stock: change } }, { new: true });
    if (!p) return res.status(400).json({ message: 'Not enough stock to remove that many' });
    await InventoryLog.create({ product: p._id, name: p.name, change, after: p.stock, reason, ref: String(req.body.note || '').slice(0, 80) || undefined, by: req.user._id });
    res.json(p);
  })
);

router.get(
  '/inventory-log',
  ah(async (req, res) => {
    const f = req.query.product ? { product: req.query.product } : {};
    res.json(await InventoryLog.find(f).populate('by', 'name').sort('-createdAt').limit(300));
  })
);

/* ======================= Orders (live) → Pack → Ship → Delivery ======================= */
router.get('/couriers', (req, res) => res.json(COURIERS));

router.get(
  '/orders',
  ah(async (req, res) => {
    const { status, q } = req.query;
    const f = {};
    if (status && status !== 'All') f.status = status;
    if (q) {
      const esc = String(q).slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      f.$or = [{ orderNo: { $regex: esc, $options: 'i' } }, { 'address.name': { $regex: esc, $options: 'i' } }, { 'address.phone': { $regex: esc } }, { 'shipping.trackingNo': { $regex: esc, $options: 'i' } }];
    }
    res.json(await Order.find(f).populate('user', 'name email').sort('-createdAt').limit(300));
  })
);

router.get(
  '/orders/:id',
  ah(async (req, res) => {
    const o = await Order.findById(req.params.id).populate('user', 'name email phone');
    if (!o) return res.status(404).json({ message: 'Not found' });
    res.json(o);
  })
);

const FLOW = { Placed: 'Packed', Packed: 'Shipped', Shipped: 'Out for Delivery', 'Out for Delivery': 'Delivered' };

/** Applies one status transition; shared by the single and bulk endpoints. */
async function transition(order, status, { courier, trackingNo, note } = {}) {
  if (FLOW[order.status] !== status) throw Object.assign(new Error(`Cannot move ${order.orderNo} from ${order.status} to ${status}`), { status: 400 });
  if (status === 'Shipped') {
    if (!COURIERS.includes(courier)) throw Object.assign(new Error('Choose a courier partner'), { status: 400 });
    if (!AWB_RE.test(String(trackingNo || '').trim())) throw Object.assign(new Error('Enter a valid AWB / tracking number (6–30 letters, digits or -)'), { status: 400 });
    order.shipping.courier = courier;
    order.shipping.trackingNo = String(trackingNo).trim();
    order.shipping.trackingUrl = trackingUrl(courier, order.shipping.trackingNo);
    order.shipping.shippedAt = new Date();
  }
  if (status === 'Delivered') order.shipping.deliveredAt = new Date();
  order.status = status;
  order.timeline.push({ status, note: note || (status === 'Shipped' ? `${courier} · AWB ${order.shipping.trackingNo}` : undefined) });
  await order.save();
  publishOrder(order);
  notifyStatus(order, order.user).catch(() => {});
  return order;
}

router.patch(
  '/orders/:id/status',
  ah(async (req, res) => {
    const order = await Order.findById(req.params.id).populate('user', 'name email whatsappOptIn');
    if (!order) return res.status(404).json({ message: 'Not found' });
    const { status, note } = req.body;
    if (status === 'Cancelled') {
      if (!['Placed', 'Packed'].includes(order.status)) return res.status(400).json({ message: 'Only orders that have not shipped can be cancelled' });
      if (['paid', 'partially_refunded'].includes(order.payment.status)) await refundOrder(order, { reason: note || 'Cancelled by BABY BLOOM', restockItems: true, by: req.user._id });
      else await restock(order, 'cancel', req.user._id);
      order.status = 'Cancelled';
      order.timeline.push({ status: 'Cancelled', note: note || 'Cancelled by BABY BLOOM' });
      await order.save();
      publishOrder(order);
      return res.json(order);
    }
    res.json(await transition(order, status, req.body));
  })
);

// Bulk Pack / Out for delivery / Delivered (shipping needs a per-order AWB)
router.post(
  '/orders/bulk-status',
  ah(async (req, res) => {
    const { ids = [], status } = req.body;
    if (!['Packed', 'Out for Delivery', 'Delivered'].includes(status)) return res.status(400).json({ message: 'Bulk update supports Packed, Out for Delivery and Delivered' });
    const result = { updated: 0, skipped: [] };
    for (const id of ids.slice(0, 100)) {
      const order = await Order.findById(id).populate('user', 'name email whatsappOptIn');
      try {
        if (!order) throw new Error('not found');
        await transition(order, status, { note: 'Bulk update' });
        result.updated++;
      } catch {
        result.skipped.push(order?.orderNo || id);
      }
    }
    res.json(result);
  })
);

router.get(
  '/orders/:id/label',
  ah(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Not found' });
    if (['Pending Payment', 'Cancelled'].includes(order.status)) return res.status(400).json({ message: 'No label for unpaid or cancelled orders' });
    streamLabel(order, res);
  })
);

// Re-send the latest status (email with invoice + WhatsApp) — e.g. the customer lost the email
router.post(
  '/orders/:id/notify',
  ah(async (req, res) => {
    const order = await Order.findById(req.params.id).populate('user', 'name email whatsappOptIn');
    if (!order) return res.status(404).json({ message: 'Not found' });
    const results = order.status === 'Placed' ? await notify(order, order.user, 'placed') : await notifyStatus(order, order.user);
    res.json({ ok: true, results });
  })
);

/* ======================= Refunds (full / partial / item-level) ======================= */
// POST /api/admin/orders/:id/refund { items?: [{product, qty}], amount?, reason, restock? }
router.post(
  '/orders/:id/refund',
  ah(async (req, res) => {
    const order = await Order.findById(req.params.id).populate('user', 'name email whatsappOptIn');
    if (!order) return res.status(404).json({ message: 'Not found' });
    const { items, amount, reason } = req.body;
    // Unshipped goods go straight back to stock; shipped goods only when the admin confirms they came back
    const restockItems = req.body.restock ?? !['Shipped', 'Out for Delivery', 'Delivered'].includes(order.status);
    res.json(await refundOrder(order, { items, amount, reason: String(reason || '').slice(0, 120), restockItems, by: req.user._id }));
  })
);

router.get(
  '/refunds',
  ah(async (req, res) => {
    const orders = await Order.find({ 'refunds.0': { $exists: true } }).select('orderNo address total amountRefunded refunds payment.method').sort('-updatedAt').limit(300);
    const rows = orders.flatMap((o) => o.refunds.map((r) => ({ ...r.toObject(), orderId: o._id, orderNo: o.orderNo, customer: o.address?.name, gateway: o.payment.method, orderTotal: o.total })));
    rows.sort((a, b) => new Date(b.at) - new Date(a.at));
    res.json({ rows, total: rows.reduce((s, r) => s + r.amount, 0) });
  })
);

/* ======================= Coupons (with usage stats) ======================= */
router.get(
  '/coupons',
  ah(async (req, res) => {
    const [list, usage] = await Promise.all([
      Coupon.find().sort('-createdAt'),
      Order.aggregate([{ $match: { coupon: { $ne: null }, status: { $nin: ['Pending Payment', 'Cancelled'] } } }, { $group: { _id: '$coupon', uses: { $sum: 1 }, discount: { $sum: '$discount' }, revenue: { $sum: '$total' } } }]),
    ]);
    const m = new Map(usage.map((u) => [u._id, u]));
    res.json(list.map((c) => ({ ...c.toObject(), stats: m.get(c.code) || { uses: 0, discount: 0, revenue: 0 } })));
  })
);
router.post('/coupons', ah(async (req, res) => res.status(201).json(await Coupon.create(req.body))));
router.put('/coupons/:id', ah(async (req, res) => res.json(await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }))));
router.delete('/coupons/:id', ah(async (req, res) => { await Coupon.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

/* ======================= Banners (scheduled, ordered) ======================= */
router.get('/banners', ah(async (req, res) => res.json(await Banner.find().sort('order'))));
router.post('/banners', ah(async (req, res) => res.status(201).json(await Banner.create({ ...req.body, order: await Banner.countDocuments() }))));
router.put('/banners/:id', ah(async (req, res) => res.json(await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }))));
router.delete('/banners/:id', ah(async (req, res) => { await Banner.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));
// PUT /api/admin/banners-order { ids: [...] } → saves the display order
router.put(
  '/banners-order',
  ah(async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 50) : [];
    await Promise.all(ids.map((id, i) => Banner.updateOne({ _id: id }, { order: i })));
    res.json(await Banner.find().sort('order'));
  })
);

/* ======================= Customers ======================= */
router.get(
  '/customers',
  ah(async (req, res) => {
    const users = await User.find({ role: 'customer' }).select('name email phone createdAt').sort('-createdAt').limit(300);
    const ltv = await Order.aggregate([
      { $match: { user: { $in: users.map((u) => u._id) }, ...PAID } },
      { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: NET }, last: { $max: '$createdAt' } } },
    ]);
    const m = new Map(ltv.map((x) => [x._id.toString(), x]));
    res.json(users.map((u) => ({ ...u.toObject(), orders: m.get(u._id.toString())?.orders || 0, spent: m.get(u._id.toString())?.spent || 0, lastOrder: m.get(u._id.toString())?.last })));
  })
);

module.exports = router;
module.exports.publicIdFromUrl = publicIdFromUrl;
