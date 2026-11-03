/**
 * GST helpers for the tax invoice (pure functions, unit-tested).
 *  - Place of supply from the shipping state (or derived from the pincode)
 *  - Intra-state supply → CGST + SGST (half each); inter-state → IGST
 *  - Amount in words, Indian numbering (lakh / crore)
 */
const SELLER_STATE = process.env.SELLER_STATE || 'Andhra Pradesh';

// 3-digit prefixes that differ from their 2-digit region
const PIN3 = {
  160: 'Chandigarh', 403: 'Goa', 605: 'Puducherry', 737: 'Sikkim', 744: 'Andaman and Nicobar Islands',
  682: 'Kerala', 194: 'Ladakh', 790: 'Arunachal Pradesh', 791: 'Arunachal Pradesh', 792: 'Arunachal Pradesh',
  793: 'Meghalaya', 794: 'Meghalaya', 795: 'Manipur', 796: 'Mizoram', 797: 'Nagaland', 798: 'Nagaland', 799: 'Tripura',
  246: 'Uttarakhand', 247: 'Uttarakhand', 248: 'Uttarakhand', 249: 'Uttarakhand', 262: 'Uttarakhand', 263: 'Uttarakhand',
  500: 'Telangana', 501: 'Telangana', 502: 'Telangana', 503: 'Telangana', 504: 'Telangana', 505: 'Telangana', 506: 'Telangana', 507: 'Telangana', 508: 'Telangana', 509: 'Telangana',
  814: 'Jharkhand', 815: 'Jharkhand', 816: 'Jharkhand', 822: 'Jharkhand', 825: 'Jharkhand', 826: 'Jharkhand', 827: 'Jharkhand', 828: 'Jharkhand', 829: 'Jharkhand',
  831: 'Jharkhand', 832: 'Jharkhand', 833: 'Jharkhand', 834: 'Jharkhand', 835: 'Jharkhand',
};
const PIN2 = {
  11: 'Delhi', 12: 'Haryana', 13: 'Haryana', 14: 'Punjab', 15: 'Punjab', 16: 'Punjab', 17: 'Himachal Pradesh',
  18: 'Jammu and Kashmir', 19: 'Jammu and Kashmir', 20: 'Uttar Pradesh', 21: 'Uttar Pradesh', 22: 'Uttar Pradesh',
  23: 'Uttar Pradesh', 24: 'Uttar Pradesh', 25: 'Uttar Pradesh', 26: 'Uttar Pradesh', 27: 'Uttar Pradesh', 28: 'Uttar Pradesh',
  30: 'Rajasthan', 31: 'Rajasthan', 32: 'Rajasthan', 33: 'Rajasthan', 34: 'Rajasthan', 36: 'Gujarat', 37: 'Gujarat',
  38: 'Gujarat', 39: 'Gujarat', 40: 'Maharashtra', 41: 'Maharashtra', 42: 'Maharashtra', 43: 'Maharashtra', 44: 'Maharashtra',
  45: 'Madhya Pradesh', 46: 'Madhya Pradesh', 47: 'Madhya Pradesh', 48: 'Madhya Pradesh', 49: 'Chhattisgarh',
  51: 'Andhra Pradesh', 52: 'Andhra Pradesh', 53: 'Andhra Pradesh', 56: 'Karnataka', 57: 'Karnataka', 58: 'Karnataka',
  59: 'Karnataka', 60: 'Tamil Nadu', 61: 'Tamil Nadu', 62: 'Tamil Nadu', 63: 'Tamil Nadu', 64: 'Tamil Nadu', 67: 'Kerala',
  68: 'Kerala', 69: 'Kerala', 70: 'West Bengal', 71: 'West Bengal', 72: 'West Bengal', 73: 'West Bengal', 74: 'West Bengal',
  75: 'Odisha', 76: 'Odisha', 77: 'Odisha', 78: 'Assam', 80: 'Bihar', 81: 'Bihar', 82: 'Bihar', 83: 'Bihar', 84: 'Bihar', 85: 'Bihar',
};

function stateFromPincode(pincode) {
  const p = String(pincode || '');
  if (!/^[1-9]\d{5}$/.test(p)) return null;
  return PIN3[p.slice(0, 3)] || PIN2[p.slice(0, 2)] || null;
}

/** Split the tax amount for the invoice. Rounding keeps CGST + SGST equal to the total. */
function splitGst(tax, buyerState, sellerState = SELLER_STATE, rate = 0.12) {
  const pos = buyerState || sellerState;
  const interState = pos.toLowerCase() !== sellerState.toLowerCase();
  if (interState) return { placeOfSupply: pos, interState, igst: tax, cgst: 0, sgst: 0, rate };
  const cgst = Math.floor(tax / 2);
  return { placeOfSupply: pos, interState, igst: 0, cgst, sgst: tax - cgst, rate };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`);
const three = (n) => `${n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : ''}${n % 100 ? two(n % 100) : ''}`;

/** 1234567 → "Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Only" */
function amountInWords(amount) {
  let n = Math.round(Number(amount) || 0);
  if (n === 0) return 'Rupees Zero Only';
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (n) parts.push(three(n));
  return `Rupees ${parts.join(' ')} Only`;
}

/** Indian financial year label for invoice numbering, e.g. 2026-27 (April–March). */
function financialYear(d = new Date()) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

module.exports = { SELLER_STATE, stateFromPincode, splitGst, amountInWords, financialYear };
