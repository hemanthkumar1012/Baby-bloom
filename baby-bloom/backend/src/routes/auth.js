const router = require('express').Router();
const User = require('../models/User');
const { sign, protect } = require('../middleware/auth');
const ah = require('../utils/asyncHandler');

const pub = (u) => ({ _id: u._id, name: u.name, email: u.email, phone: u.phone, role: u.role, addresses: u.addresses, whatsappOptIn: u.whatsappOptIn });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

router.post(
  '/register',
  ah(async (req, res) => {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
    if (!EMAIL_RE.test(String(email))) return res.status(400).json({ message: 'Enter a valid email address' });
    if (String(password).length < 8 || !/\d/.test(password) || !/[A-Za-z]/.test(password))
      return res.status(400).json({ message: 'Password must be at least 8 characters with letters and numbers' });
    if (await User.findOne({ email: String(email).toLowerCase() })) return res.status(409).json({ message: 'Email already registered' });
    const user = await User.create({ name: String(name).slice(0, 60), email, password, phone });
    res.status(201).json({ token: sign(user), user: pub(user) });
  })
);

router.post(
  '/login',
  ah(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(String(password || '')))) return res.status(401).json({ message: 'Invalid email or password' });
    res.json({ token: sign(user), user: pub(user) });
  })
);

router.get('/me', protect, (req, res) => res.json(pub(req.user)));

router.put(
  '/me',
  protect,
  ah(async (req, res) => {
    const { name, phone, whatsappOptIn } = req.body;
    if (name) req.user.name = String(name).slice(0, 60);
    if (phone !== undefined) req.user.phone = phone;
    if (typeof whatsappOptIn === 'boolean') req.user.whatsappOptIn = whatsappOptIn;
    await req.user.save();
    res.json(pub(req.user));
  })
);

module.exports = router;
