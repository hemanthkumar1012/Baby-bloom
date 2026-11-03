/**
 * Refund calculator (pure). Item-level refunds give back the item's share of the
 * net amount — i.e. its price minus its proportional share of the order discount,
 * plus GST on that net value. Shipping is only refunded on a full refund.
 */
function itemRefundAmount(order, lines) {
  const subtotal = order.subtotal || 0;
  if (!subtotal) return 0;
  const discountRatio = (order.discount || 0) / subtotal;
  const taxRate = order.gst?.rate ?? 0.12;
  let amount = 0;
  for (const { product, qty } of lines) {
    const item = order.items.find((i) => String(i.product) === String(product));
    if (!item) throw new Error('Item is not part of this order');
    const left = item.qty - (item.refundedQty || 0);
    if (qty < 1 || qty > left) throw new Error(`Only ${left} of ${item.name} can be refunded`);
    const net = item.price * qty * (1 - discountRatio);
    amount += net * (1 + taxRate);
  }
  const remaining = Math.max(0, (order.total || 0) - (order.amountRefunded || 0));
  return Math.min(remaining, Math.round(amount));
}

/** Validates a requested refund amount against what is still refundable. */
function validateAmount(order, amount) {
  const remaining = Math.max(0, (order.total || 0) - (order.amountRefunded || 0));
  const a = Math.round(Number(amount));
  if (!(a > 0)) throw new Error('Refund amount must be more than ₹0');
  if (a > remaining) throw new Error(`Only ₹${remaining} is left to refund on this order`);
  return a;
}

module.exports = { itemRefundAmount, validateAmount };
