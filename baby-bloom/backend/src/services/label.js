/**
 * 4×6 inch shipping label (standard thermal-printer size) with a scannable
 * Code 39 barcode of the AWB — drawn directly, no barcode library needed.
 */
const CODE39 = {
  0: 'nnnwwnwnn', 1: 'wnnwnnnnw', 2: 'nnwwnnnnw', 3: 'wnwwnnnnn', 4: 'nnnwwnnnw', 5: 'wnnwwnnnn', 6: 'nnwwwnnnn', 7: 'nnnwnnwnw',
  8: 'wnnwnnwnn', 9: 'nnwwnnwnn', A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn',
  G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww',
  O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw',
  W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
};

/** Returns the bar widths for a Code 39 value (used by the drawer and the unit test). */
function code39Bars(text, narrow = 1) {
  const wide = narrow * 2.5;
  const value = `*${String(text).toUpperCase().replace(/[^0-9A-Z.\- ]/g, '')}*`;
  const bars = [];
  for (const ch of value) {
    [...CODE39[ch]].forEach((p, i) => bars.push({ bar: i % 2 === 0, w: p === 'w' ? wide : narrow }));
    bars.push({ bar: false, w: narrow }); // inter-character gap
  }
  return bars;
}

function drawCode39(doc, text, x, y, height, narrow = 1.1) {
  let cx = x;
  for (const b of code39Bars(text, narrow)) {
    if (b.bar) doc.rect(cx, y, b.w, height).fill('#000');
    cx += b.w;
  }
  return cx - x;
}

function streamLabel(order, res) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: [288, 432], margin: 14 }); // 4 × 6 in @ 72dpi
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="label-${order.orderNo}.pdf"`);
  doc.pipe(res);
  const a = order.address || {};

  doc.rect(10, 10, 268, 412).lineWidth(1.5).stroke('#000');
  doc.font('Helvetica-Bold').fontSize(16).text('BABY BLOOM', 20, 20);
  doc.font('Helvetica').fontSize(8).text(`${(order.shipping?.courier || 'Courier').toUpperCase()} · ${order.shipping?.method === 'express' ? 'EXPRESS' : 'STANDARD'}`, 20, 40);
  doc.font('Helvetica-Bold').fontSize(11).text('PREPAID', 150, 22, { width: 118, align: 'right' });

  doc.moveTo(10, 56).lineTo(278, 56).stroke();
  doc.font('Helvetica-Bold').fontSize(9).text('DELIVER TO', 20, 64);
  doc.font('Helvetica-Bold').fontSize(13).text(a.name || '', 20, 78, { width: 248 });
  doc.font('Helvetica').fontSize(10).text(a.line1 || '', { width: 248 }).text(`${a.city || ''}${a.state ? ', ' + a.state : ''} - ${a.pincode || ''}`).text(`Ph: ${a.phone || ''}`);

  doc.moveTo(10, 170).lineTo(278, 170).stroke();
  const awb = order.shipping?.trackingNo || order.orderNo;
  drawCode39(doc, awb, 24, 182, 60);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(`AWB ${awb}`, 20, 250, { width: 248, align: 'center' });

  doc.moveTo(10, 272).lineTo(278, 272).stroke();
  doc.font('Helvetica').fontSize(8).text(`Order ${order.orderNo} · Invoice ${order.invoice?.number || '-'}`, 20, 280);
  doc.text(`Items: ${order.items.reduce((s, i) => s + i.qty, 0)} · Handle with care`, 20, 292);
  doc.fontSize(7).fillColor('#444').text(order.items.map((i) => `${i.sku || ''} ${i.name} ×${i.qty}`).join(', ').slice(0, 300), 20, 306, { width: 248, height: 70 });
  doc.fillColor('#000').fontSize(7).text('Return to: BABY BLOOM Fulfilment Centre, Tirupati, AP 517501', 20, 396, { width: 248 });
  doc.end();
}

module.exports = { streamLabel, drawCode39, code39Bars, CODE39 };
