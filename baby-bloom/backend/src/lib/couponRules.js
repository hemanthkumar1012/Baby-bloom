/**
 * Pure coupon evaluation (no DB access) so the rules are unit-testable.
 *
 * coupon: { active, expiresAt, startsAt, type, value, minOrder, maxDiscount,
 *           firstOrderOnly, perUserLimit, usageLimit, categories[] }
 * ctx:    { items: [{ price, qty, category }], now, userOrders, userUses, totalUses, loggedIn }
 */
function evaluateCoupon(coupon, ctx) {
  const now = ctx.now || new Date();
  const no = (message) => ({ ok: false, message });

  if (!coupon || !coupon.active) return no('Coupon is not active');
  if (coupon.startsAt && new Date(coupon.startsAt) > now) return no('Coupon is not live yet');
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) return no('Coupon has expired');
  if (coupon.usageLimit && (ctx.totalUses || 0) >= coupon.usageLimit) return no('Coupon usage limit reached');
  if (coupon.firstOrderOnly && (ctx.userOrders || 0) > 0) return no('This coupon is for your first order only');
  if (coupon.perUserLimit && (ctx.userUses || 0) >= coupon.perUserLimit)
    return no(`You have already used this coupon${coupon.perUserLimit > 1 ? ` ${coupon.perUserLimit} times` : ''}`);

  // Category-restricted coupons only discount eligible lines
  const cats = (coupon.categories || []).filter(Boolean);
  const eligible = cats.length ? ctx.items.filter((i) => cats.includes(i.category)) : ctx.items;
  const base = eligible.reduce((s, i) => s + i.price * i.qty, 0);
  if (cats.length && base === 0) return no(`Valid only on ${cats.join(', ')}`);

  const orderSubtotal = ctx.items.reduce((s, i) => s + i.price * i.qty, 0);
  if (orderSubtotal < (coupon.minOrder || 0)) return no(`Add ₹${coupon.minOrder - orderSubtotal} more to use this coupon`);

  let d = coupon.type === 'percent' ? Math.round((base * coupon.value) / 100) : coupon.value;
  if (coupon.maxDiscount) d = Math.min(d, coupon.maxDiscount);
  return { ok: true, discount: Math.max(0, Math.min(d, base)) };
}

module.exports = { evaluateCoupon };
