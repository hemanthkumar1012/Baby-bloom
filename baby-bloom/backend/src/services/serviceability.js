/**
 * Rule-based pincode serviceability + delivery ETA (stand-in for a courier API
 * such as Shiprocket/Delhivery — swap `check()` for the real call in production).
 */
const { stateFromPincode } = require('../lib/gst');

const METRO_PREFIXES = {
  11: 'Delhi NCR', 12: 'Delhi NCR', 20: 'Delhi NCR', 40: 'Mumbai', 41: 'Pune', 56: 'Bengaluru',
  60: 'Chennai', 50: 'Hyderabad', 70: 'Kolkata', 38: 'Ahmedabad',
};
const REMOTE_PREFIXES = ['18', '19', '74', '79', '73']; // J&K, NE states, Sikkim, islands

const addDays = (n, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  // no Sunday deliveries
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
};

function check(pincode, now = new Date()) {
  const pin = String(pincode || '').trim();
  if (!/^[1-9]\d{5}$/.test(pin)) return { serviceable: false, message: 'Enter a valid 6-digit pincode' };
  const two = pin.slice(0, 2);
  const metro = METRO_PREFIXES[Number(two)];
  const remote = REMOTE_PREFIXES.includes(two);
  // Orders after 2 pm dispatch next day
  const dispatchDelay = now.getHours() >= 14 ? 1 : 0;
  const standardDays = (metro ? 2 : remote ? 7 : 4) + dispatchDelay;
  return {
    serviceable: true,
    pincode: pin,
    state: stateFromPincode(pin),
    zone: metro ? 'metro' : remote ? 'remote' : 'national',
    city: metro || null,
    express: Boolean(metro),
    standardEta: addDays(standardDays, now),
    expressEta: metro ? addDays(1 + dispatchDelay, now) : null,
    message: metro
      ? `Express next-day delivery available in ${metro}`
      : remote
        ? `Delivery in about ${standardDays} days`
        : `Delivery in ${standardDays}–${standardDays + 1} days`,
  };
}

module.exports = { check };
