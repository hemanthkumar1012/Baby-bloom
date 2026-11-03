const mongoose = require('mongoose');

// PDF schema (name, price, mrp, images, category, stock, rating, description, isBestseller)
// plus the fields the catalogue, stock and GST invoice need.
const s = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0 },
    images: [String], // Cloudinary URLs; order = gallery order, [0] = cover
    category: { type: String, required: true, index: true },
    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    rating: { type: Number, default: 4.8 },
    description: String,
    isBestseller: { type: Boolean, default: false },
    // Catalogue details
    brand: { type: String, default: 'Baby Bloom' },
    sku: { type: String, index: true, sparse: true },
    size: String, // e.g. "200 ml", "M · 7–12 kg"
    ageGroup: { type: String, enum: ['', '0-6 M', '6-12 M', '1-2 Y', '2-4 Y', 'Mom'], default: '' },
    features: [String],
    tags: [String],
    hsn: { type: String, default: '3401' }, // HSN code printed on the GST invoice
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

s.pre('save', function slug(next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + this._id.toString().slice(-5);
  }
  if (!this.sku) this.sku = 'BB-' + this._id.toString().slice(-6).toUpperCase();
  next();
});

s.index({ name: 'text', description: 'text', category: 'text' });
s.statics.AGE_GROUPS = ['0-6 M', '6-12 M', '1-2 Y', '2-4 Y', 'Mom'];

module.exports = mongoose.model('Product', s);
