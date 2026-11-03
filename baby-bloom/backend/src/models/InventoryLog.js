const mongoose = require('mongoose');

// Append-only audit trail of every stock movement
module.exports = mongoose.model(
  'InventoryLog',
  new mongoose.Schema(
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },
      name: String,
      change: Number, // negative = stock out
      after: Number, // stock level after the change
      reason: { type: String, enum: ['sale', 'cancel', 'refund', 'restock', 'damage', 'correction'] },
      ref: String, // order number or admin note
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
  )
);
