const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { subscribe } = require('../services/events');

// GET /api/events?token=JWT — Server-Sent Events stream (EventSource can't send headers, so the token rides in the query)
router.get('/', async (req, res) => {
  try {
    const raw = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
    const { id } = jwt.verify(raw, process.env.JWT_SECRET);
    const user = await User.findById(id);
    if (!user) return res.status(401).end();
    subscribe(req, res, user);
  } catch {
    res.status(401).end();
  }
});

module.exports = router;
