const mongoose = require('mongoose');

// Flow: Pending Payment → Placed → Packed → Shipped → Out for Delivery → Delivered  (or Cancelled / Refunded)
const STATUSES = ['Pending Payment', 'Placed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Refunded'];

const o = new mongoose.Schema(
  {
    orderNo: { type: String, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        image: String,
        sku: String,
        hsn: String,
        qty: { type: Number, min: 1 },
        price: Number,
        refundedQty: { type: Number, default: 0 },
      },
    ],
    subtotal: Number,
    discount: { type: Number, default: 0 },
    coupon: String,
    deliveryFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    // GST split: intra-state → CGST + SGST, inter-state → IGST
    gst: { placeOfSupply: String, interState: Boolean, cgst: Number, sgst: Number, igst: Number, rate: Number },
    total: Number,
    status: { type: String, enum: STATUSES, default: 'Placed' },
    timeline: [{ status: String, at: { type: Date, default: Date.now }, note: String }],
    payment: {
      method: { type: String, enum: ['razorpay', 'stripe', 'demo'], default: 'razorpay' },
      status: { type: String, enum: ['pending', 'paid', 'failed', 'partially_refunded', 'refunded'], default: 'pending' },
      razorpayOrderId: String,
      razorpayPaymentId: String,
      stripeSessionId: String,
      stripePaymentIntent: String,
      paidAt: Date,
      // Every gateway attempt (success, failure, cancel) for support & reconciliation
      attempts: [{ gateway: String, status: String, ref: String, error: String, at: { type: Date, default: Date.now } }],
    },
    refunds: [
      {
        amount: Number,
        items: [{ product: mongoose.Schema.Types.ObjectId, name: String, qty: Number }],
        reason: String,
        restocked: Boolean,
        gatewayRefundId: String,
        status: { type: String, enum: ['processed', 'pending', 'failed'], default: 'processed' },
        at: { type: Date, default: Date.now },
      },
    ],
    amountRefunded: { type: Number, default: 0 },
    address: { name: String, phone: String, line1: String, city: String, state: String, pincode: String },
    shipping: {
      method: { type: String, enum: ['standard', 'express'], default: 'standard' },
      courier: String,
      trackingNo: String,
      trackingUrl: String,
      eta: Date,
      shippedAt: Date,
      deliveredAt: Date,
    },
    invoice: { number: String, issuedAt: Date },
    notifications: [{ channel: String, event: String, ok: Boolean, at: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

o.pre('validate', function no(next) {
  if (!this.orderNo) {
    const d = new Date();
    this.orderNo = 'BB' + d.getFullYear().toString().slice(-2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  }
  next();
});

o.virtual('refundable').get(function refundable() {
  return Math.max(0, (this.total || 0) - (this.amountRefunded || 0));
});
o.set('toJSON', { virtuals: true });
o.set('toObject', { virtuals: true });

o.statics.STATUSES = STATUSES;
o.index({ status: 1, createdAt: -1 });
o.index({ user: 1, createdAt: -1 });
o.index({ coupon: 1, user: 1 });

module.exports = mongoose.model('Order', o);
