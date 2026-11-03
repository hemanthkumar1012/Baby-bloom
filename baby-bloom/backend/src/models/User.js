const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Address book entry (checkout "Address" step)
const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Home', maxlength: 20 }, // Home / Work / Parents
  name: { type: String, required: true },
  phone: { type: String, required: true },
  line1: { type: String, required: true },
  city: { type: String, required: true },
  state: String,
  pincode: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    phone: String,
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    addresses: { type: [addressSchema], validate: (v) => v.length <= 10 },
    // Server copy of the cart so it follows the customer across devices
    cart: {
      items: [{ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, qty: Number, _id: false }],
      updatedAt: Date,
    },
    whatsappOptIn: { type: Boolean, default: true }, // order updates on WhatsApp
  },
  { timestamps: true }
);

userSchema.pre('save', async function hash(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function match(pw) {
  return bcrypt.compare(pw, this.password);
};

module.exports = mongoose.model('User', userSchema);
