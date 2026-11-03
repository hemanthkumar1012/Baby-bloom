const mongoose = require('mongoose');
const { evaluateCoupon } = require('../lib/couponRules');

const c = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: String,
    type: { type: String, enum: ['percent', 'flat'], default: 'percent' },
    value: { type: Number, required: true, min: 0 },
    minOrder: { type: Number, default: 0 },
    maxDiscount: Number,
    startsAt: Date,
    expiresAt: Date,
    firstOrderOnly: { type: Boolean, default: false },
    perUserLimit: { type: Number, min: 0 }, // 0/empty = unlimited
    usageLimit: { type: Number, min: 0 }, // total redemptions across all customers
    categories: [String], // empty = whole cart
    public: { type: Boolean, default: true }, // shown in the checkout "available offers" list
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

c.methods.evaluate = function evaluate(ctx) {
  return evaluateCoupon(this, ctx);
};

module.exports = mongoose.model('Coupon', c);
