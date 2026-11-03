const router = require('express').Router();
const Product = require('../models/Product');
const Banner = require('../models/Banner');
const ah = require('../utils/asyncHandler');
const { check: checkPincode } = require('../services/serviceability');

// GET /api/products?q=&category=&sort=price_asc|price_desc|rating|new&bestseller=true&page=1&limit=12
router.get(
  '/',
  ah(async (req, res) => {
    const { q, category, age, sort, bestseller, inStock, min, max, page = 1, limit = 24 } = req.query;
    const filter = { active: true };
    if (category && category !== 'All') filter.category = category;
    if (age && age !== 'All') filter.ageGroup = age;
    if (bestseller === 'true') filter.isBestseller = true;
    if (inStock === 'true') filter.stock = { $gt: 0 };
    if (min || max) filter.price = { ...(min ? { $gte: Number(min) } : {}), ...(max ? { $lte: Number(max) } : {}) };
    if (q) {
      const esc = String(q).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ name: { $regex: esc, $options: 'i' } }, { category: { $regex: esc, $options: 'i' } }, { tags: { $regex: esc, $options: 'i' } }];
    }
    const sorts = {
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      rating: { rating: -1 },
      new: { createdAt: -1 },
    };
    const lim = Math.min(Number(limit) || 24, 60);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * lim;
    const [items, total] = await Promise.all([
      Product.find(filter).sort(sorts[sort] || { isBestseller: -1, createdAt: -1 }).skip(skip).limit(lim).select('-tags -hsn'),
      Product.countDocuments(filter),
    ]);
    res.json({ items, total, page: Number(page), pages: Math.ceil(total / lim) });
  })
);

router.get(
  '/categories',
  ah(async (req, res) => res.json(await Product.distinct('category', { active: true })))
);

router.get('/age-groups', (req, res) => res.json(Product.AGE_GROUPS));

// GET /api/products/suggest?q=lot → typeahead (max 6) — prefix matches ranked first
router.get(
  '/suggest',
  ah(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 40);
    if (q.length < 2) return res.json([]);
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rows = await Product.find({ active: true, $or: [{ name: { $regex: esc, $options: 'i' } }, { category: { $regex: esc, $options: 'i' } }, { tags: { $regex: esc, $options: 'i' } }] })
      .select('name slug images price category')
      .limit(12);
    const starts = new RegExp('^' + esc, 'i');
    rows.sort((a, b) => Number(starts.test(b.name)) - Number(starts.test(a.name)));
    res.json(rows.slice(0, 6));
  })
);

// GET /api/products/serviceability/:pincode → delivery ETA and express availability
router.get('/serviceability/:pincode', (req, res) => res.json(checkPincode(req.params.pincode)));

// POST /api/products/validate-cart — re-validate a cart against live prices & stock (used when the cart page opens)
router.post(
  '/validate-cart',
  ah(async (req, res) => {
    const lines = (Array.isArray(req.body.items) ? req.body.items : []).filter((i) => /^[a-f\d]{24}$/i.test(String(i._id))).slice(0, 50);
    const products = await Product.find({ _id: { $in: lines.map((l) => l._id) } }).select('name price mrp images stock active size category');
    const map = new Map(products.map((p) => [p._id.toString(), p]));
    const changes = [];
    const items = [];
    for (const l of lines) {
      const p = map.get(String(l._id));
      if (!p || !p.active || p.stock === 0) {
        changes.push({ _id: l._id, name: l.name, type: 'removed', message: `${l.name || 'An item'} is no longer available` });
        continue;
      }
      const qty = Math.min(l.qty, p.stock);
      if (qty < l.qty) changes.push({ _id: l._id, name: p.name, type: 'qty', message: `Only ${p.stock} of ${p.name} left — quantity updated` });
      if (l.price !== undefined && l.price !== p.price) changes.push({ _id: l._id, name: p.name, type: 'price', message: `${p.name} is now ₹${p.price} (was ₹${l.price})` });
      items.push({ _id: p._id, name: p.name, price: p.price, mrp: p.mrp, image: p.images?.[0], stock: p.stock, size: p.size, category: p.category, qty });
    }
    res.json({ items, changes });
  })
);

router.get(
  '/banners',
  ah(async (req, res) => {
    // Only banners inside their schedule window are shown on the home page
    const now = new Date();
    res.json(
      await Banner.find({
        active: true,
        $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] }],
      }).sort('order')
    );
  })
);

router.get(
  '/:idOrSlug',
  ah(async (req, res) => {
    const { idOrSlug } = req.params;
    const p = /^[a-f\d]{24}$/i.test(idOrSlug)
      ? await Product.findById(idOrSlug)
      : await Product.findOne({ slug: idOrSlug });
    if (!p || !p.active) return res.status(404).json({ message: 'Product not found' });
    // Related: same category first, then same age group, in-stock and best-rated first
    const related = await Product.find({ _id: { $ne: p._id }, active: true, $or: [{ category: p.category }, ...(p.ageGroup ? [{ ageGroup: p.ageGroup }] : [])] })
      .sort({ stock: -1, rating: -1 })
      .limit(8);
    related.sort((a, b) => Number(b.category === p.category) - Number(a.category === p.category));
    related.splice(4);
    res.json({ product: p, related });
  })
);

module.exports = router;
