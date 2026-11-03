/**
 * Courier partners and their public tracking pages. The customer's order page and
 * the shipping email link straight to the courier's tracking for the AWB.
 */
const COURIERS = {
  Delhivery: (awb) => `https://www.delhivery.com/track-v2/package/${awb}`,
  'Blue Dart': (awb) => `https://www.bluedart.com/tracking?trackFor=0&trackNo=${awb}`,
  'Ekart': (awb) => `https://ekartlogistics.com/shipmenttrack/${awb}`,
  'DTDC': (awb) => `https://www.dtdc.in/trace.asp?strCnno=${awb}`,
  'Xpressbees': (awb) => `https://www.xpressbees.com/shipment/tracking?awbNo=${awb}`,
  'India Post': (awb) => `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignment=${awb}`,
};

const AWB_RE = /^[A-Za-z0-9-]{6,30}$/;

function trackingUrl(courier, awb) {
  const fn = COURIERS[courier];
  if (!fn || !AWB_RE.test(String(awb || ''))) return null;
  return fn(encodeURIComponent(String(awb).trim()));
}

module.exports = { COURIERS: Object.keys(COURIERS), trackingUrl, AWB_RE };
