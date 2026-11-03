require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); // behind Render / Railway proxies

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: (process.env.CLIENT_URL || '*').split(','), credentials: true }));

// Payment webhooks need the raw body for signature verification — mounted before express.json
const payments = require('./src/routes/payments');
const raw = express.raw({ type: 'application/json' });
app.post('/api/payments/razorpay/webhook', raw, (req, res, next) => payments.razorpayWebhook(req, res).catch(next));
app.post('/api/payments/stripe/webhook', raw, (req, res, next) => payments.stripeWebhook(req, res).catch(next));

// Admin image uploads (base64 → Cloudinary) need a larger body limit
app.use('/api/admin/upload', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(require('./src/middleware/sanitize').sanitize); // NoSQL-injection guard
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
app.use('/api/payments', rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/products', require('./src/routes/products'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/payments', payments);
app.use('/api/coupons', require('./src/routes/coupons'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/me', require('./src/routes/me'));
app.use('/api/events', require('./src/routes/events')); // live order stream for the admin dashboard & tracking page

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError' || err.name === 'CastError') err.status = 400;
  if (err.code === 11000) {
    err.status = 409;
    err.message = 'That value already exists';
  }
  if ((err.status || 500) >= 500) console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log('MongoDB Connected');
      app.listen(PORT, () => console.log(`Server on ${PORT}`));
    })
    .catch((e) => {
      console.error('MongoDB connection failed:', e.message);
      process.exit(1);
    });
}

module.exports = app;
