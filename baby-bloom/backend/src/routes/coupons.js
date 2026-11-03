const router = require('express').Router();
const Coupon = require('../models/Coupon');
const { protect } = require('../middleware/auth');
const { priceCart } = require('../services/pricing');
const ah = require('../utils/asyncHandler');

// POST /api/coupons/quote  { items, coupon?, shipping?, pincode?, state? } → server-side price breakdown with GST split
router.post(
  '/quote',
  protect,
  ah(async (req, res) => {
    const { items, coupon, shipping, pincode, state } = req.body;
    res.json(await priceCart(items, coupon, { shipping, pincode, state, userId: req.user._id }));
  })
);

// GET /api/coupons/available → public, currently-live offers for the checkout "offers" list
router.get(
  '/available',
  ah(async (req, res) => {
    const now = new Date();
    const list = await Coupon.find({
      active: true,
      public: true,
      $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] }],
    })
      .select('code description type value minOrder maxDiscount firstOrderOnly categories expiresAt')
      .sort('minOrder')
      .limit(10);
    res.json(list);
  })
);

module.exports = router;
