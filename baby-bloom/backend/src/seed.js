require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');
const User = require('./models/User');
const Coupon = require('./models/Coupon');
const Banner = require('./models/Banner');

const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

const SAFE = ['Dermatologically tested', 'Paraben & sulphate free', 'pH balanced'];

const products = [
  // Bath & Skin
  { name: 'Gentle Baby Wash & Shampoo', price: 349, mrp: 399, category: 'Bath & Skin', ageGroup: '0-6 M', stock: 60, isBestseller: true, size: '200 ml', features: [...SAFE, 'Tear-free'], images: [img('photo-1515488042361-ee00e0ddd4e4')], description: 'Tear-free, 2-in-1 wash with oat extract and calendula that cleans delicate skin and hair without stripping natural oils.' },
  { name: 'Calendula Nourishing Baby Lotion', price: 399, mrp: 449, category: 'Bath & Skin', ageGroup: '0-6 M', stock: 45, size: '200 ml', features: [...SAFE, '24-hour moisture'], images: [img('photo-1556228578-8c89e6adf883')], description: 'Lightweight, fast-absorbing lotion with shea butter and calendula for soft, hydrated skin all day.' },
  { name: 'Diaper Rash Cream with Zinc', price: 299, mrp: 349, category: 'Bath & Skin', ageGroup: '0-6 M', stock: 4, isBestseller: true, size: '50 g', features: ['Paediatrician recommended', 'Zinc oxide 10%'], images: [img('photo-1608571423902-eed4a5ad8108')], description: 'Forms a breathable barrier that soothes and prevents rashes. Gentle enough for every diaper change.' },
  { name: 'Baby Massage Oil — Almond & Ashwagandha', price: 329, mrp: 379, category: 'Bath & Skin', ageGroup: '0-6 M', stock: 38, size: '200 ml', features: ['Cold-pressed oils', 'Mineral-oil free'], images: [img('photo-1600857544200-b2f666a9a2ec')], description: 'Traditional maalish oil blend that strengthens bones and helps babies sleep better.' },
  // Diapering
  { name: 'Ultra-Soft Diaper Pants (M, 72 pcs)', price: 1099, mrp: 1399, category: 'Diapering', ageGroup: '6-12 M', stock: 80, isBestseller: true, size: 'M · 7–12 kg', features: ['12-hour leak lock', 'Wetness indicator', 'Aloe vera lining'], images: [img('photo-1584839404042-8bc21d240e91')], description: 'Pant-style diapers with a 360° soft waistband and up to 12 hours of dryness for uninterrupted sleep.' },
  { name: '99% Water Baby Wipes (Pack of 3)', price: 399, mrp: 499, category: 'Diapering', ageGroup: '0-6 M', stock: 120, size: '3 × 72 wipes', features: ['Plant-based fibre', 'Fragrance free'], images: [img('photo-1586105251261-72a756497a11')], description: 'Thick, extra-large wipes made with 99% purified water — safe for newborns and sensitive skin.' },
  // Feeding
  { name: 'Anti-Colic Feeding Bottle Set', price: 899, mrp: 1099, category: 'Feeding', ageGroup: '0-6 M', stock: 30, isBestseller: true, size: '2 × 260 ml', features: ['BPA free', 'Anti-colic vent', 'Breast-like nipple'], images: [img('photo-1590004953392-5aba2e72269a')], description: 'Vented bottles that reduce air intake and tummy discomfort. Easy to clean and dishwasher safe.' },
  { name: 'Silicone Suction Plate & Spoon', price: 649, mrp: 749, category: 'Feeding', ageGroup: '6-12 M', stock: 25, size: '1 set', features: ['Food-grade silicone', 'Microwave safe'], images: [img('photo-1598128558393-70ff21433be0')], description: 'Stay-put suction base for mess-free weaning. Divided sections for balanced first meals.' },
  { name: 'Organic Ragi & Banana Cereal', price: 279, mrp: 299, category: 'Feeding', ageGroup: '6-12 M', stock: 50, size: '300 g', features: ['No added sugar', 'Sprouted grains'], images: [img('photo-1505576399279-565b52d4ac71')], description: 'Iron-rich sprouted ragi with real banana — a wholesome first food for growing babies.' },
  // Clothing
  { name: 'Organic Cotton Onesies (Pack of 3)', price: 799, mrp: 999, category: 'Clothing', ageGroup: '0-6 M', stock: 40, size: '0–3 M', features: ['GOTS certified cotton', 'Envelope neckline', 'Snap buttons'], images: [img('photo-1522771930-78848d9293e8')], description: 'Buttery-soft organic cotton bodysuits in pastel prints — breathable and kind to newborn skin.' },
  { name: 'Muslin Swaddle Blankets (Set of 2)', price: 699, mrp: 899, category: 'Clothing', ageGroup: '0-6 M', stock: 35, isBestseller: true, size: '120 × 120 cm', features: ['Bamboo-cotton muslin', 'Gets softer every wash'], images: [img('photo-1519689680058-324335c77eba')], description: 'Light, airy swaddles that double as burp cloths, stroller covers and nursing covers.' },
  // Toys
  { name: 'Wooden Rattle & Teether Set', price: 549, mrp: 649, category: 'Toys', ageGroup: '6-12 M', stock: 28, size: '3 pcs', features: ['Non-toxic paint', 'Smooth beech wood'], images: [img('photo-1596461404969-9ae70f2830c1')], description: 'Hand-finished wooden toys that soothe sore gums and build grip and sensory skills.' },
  { name: 'Soft Stacking Blocks', price: 749, mrp: 899, category: 'Toys', ageGroup: '1-2 Y', stock: 20, size: '12 blocks', features: ['BPA free', 'Squeeze & stack'], images: [img('photo-1566004100631-35d015d6a491')], description: 'Squishy numbered blocks with textures and animals — perfect for stacking, bath time and early learning.' },
  // Mom care
  { name: 'Stretch Mark Butter', price: 599, mrp: 699, category: 'Mom Care', ageGroup: 'Mom', stock: 33, isBestseller: true, size: '100 g', features: ['Cocoa & shea butter', 'Safe in pregnancy'], images: [img('photo-1570194065650-d99fb4bedf0a')], description: 'Rich butter that improves skin elasticity and helps prevent and fade stretch marks.' },
  { name: 'Nipple Care Cream', price: 349, mrp: 399, category: 'Mom Care', ageGroup: 'Mom', stock: 26, size: '30 g', features: ['No need to wipe before feeding', 'Lanolin free'], images: [img('photo-1611080626919-7cf5a9dbab5b')], description: 'Soothes sore, cracked nipples during breastfeeding — 100% baby-safe ingredients.' },
  { name: 'Lactation Support Cookies', price: 449, mrp: 499, category: 'Mom Care', ageGroup: 'Mom', stock: 3, size: '250 g', features: ['Fenugreek, oats & flax', 'No preservatives'], images: [img('photo-1499636136210-6f4ee915583e')], description: 'Nutritious oat cookies with galactagogues that support healthy milk supply.' },
];

// HSN codes printed on the GST invoice
const HSN = { 'Bath & Skin': '3401', Diapering: '9619', Feeding: '3924', Clothing: '6111', Toys: '9503', 'Mom Care': '3304' };

const TAGS = {
  'Bath & Skin': ['bath', 'skin', 'lotion', 'wash', 'shampoo', 'cream'],
  Diapering: ['diaper', 'nappy', 'wipes', 'rash'],
  Feeding: ['bottle', 'weaning', 'food', 'cereal'],
  Clothing: ['onesie', 'romper', 'swaddle', 'cotton'],
  Toys: ['teether', 'rattle', 'blocks', 'play'],
  'Mom Care': ['pregnancy', 'maternity', 'breastfeeding', 'postpartum'],
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([Product.deleteMany({}), Coupon.deleteMany({}), Banner.deleteMany({})]);
  for (const p of products) await Product.create({ ...p, hsn: HSN[p.category] || '3401', lowStockThreshold: 5, tags: TAGS[p.category] || [], rating: +(4.5 + Math.random() * 0.5).toFixed(1), });

  await Coupon.create([
    { code: 'BLOOM15', description: '15% off everything', type: 'percent', value: 15, minOrder: 499, maxDiscount: 300 },
    { code: 'FIRSTBLOOM', description: '₹250 off your first order', type: 'flat', value: 250, minOrder: 999, firstOrderOnly: true },
    { code: 'DIAPER20', description: '20% off diapering, once per customer', type: 'percent', value: 20, maxDiscount: 400, categories: ['Diapering'], perUserLimit: 1 },
    { code: 'NEWMOM200', description: '₹200 off mom care above ₹1,499', type: 'flat', value: 200, minOrder: 1499, categories: ['Mom Care'] },
  ]);
  const day = 86400000;
  await Banner.create([
    { eyebrow: 'Made safe · Made soft · Made for you', title: 'Gentle care for every tiny milestone.', subtitle: 'Toxin-free baby essentials and mother care, made with dermatologists and loved by 2 lakh+ parents.', image: img('photo-1544126592-807ade215a0b'), cta: 'Shop essentials', link: '/shop', order: 0 },
    { eyebrow: 'Diapering week', title: 'Up to 20% off diapers & wipes.', subtitle: 'Leak-lock diaper pants and 99% water wipes — use code DIAPER20.', image: img('photo-1584839404042-8bc21d240e91'), cta: 'Shop diapering', link: '/shop?category=Diapering', order: 1, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 14 * day) },
    { eyebrow: 'For new moms', title: 'Care for you, too.', subtitle: 'Stretch-mark butter, nursing care and lactation support — safe in pregnancy.', image: img('photo-1570194065650-d99fb4bedf0a'), cta: 'Shop mom care', link: '/shop?category=Mom%20Care', order: 2 },
  ]);

  const email = process.env.ADMIN_EMAIL || 'admin@babybloom.dev';
  if (!(await User.findOne({ email }))) {
    await User.create({ name: 'Baby Bloom Admin', email, password: process.env.ADMIN_PASSWORD || 'Admin@123', role: 'admin' });
  }
  console.log(`Seeded ${products.length} products, 4 coupons, 3 banners. Admin: ${email}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
