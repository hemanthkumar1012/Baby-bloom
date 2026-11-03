const mongoose = require('mongoose');

// Home-page hero banners — scheduled, ordered, with separate desktop / mobile art
module.exports = mongoose.model(
  'Banner',
  new mongoose.Schema(
    {
      title: { type: String, required: true },
      subtitle: String,
      eyebrow: String,
      image: String, // desktop (Cloudinary URL)
      mobileImage: String, // optional portrait crop for phones
      cta: { type: String, default: 'Shop now' },
      link: { type: String, default: '/shop' },
      startsAt: Date,
      endsAt: Date,
      active: { type: Boolean, default: true },
      order: { type: Number, default: 0 },
    },
    { timestamps: true }
  )
);
