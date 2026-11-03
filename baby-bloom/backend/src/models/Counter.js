const mongoose = require('mongoose');

// Atomic sequences — used for gap-free GST invoice numbers per financial year
const Counter = mongoose.model('Counter', new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }));

Counter.next = async function next(key) {
  const c = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return c.seq;
};

module.exports = Counter;
