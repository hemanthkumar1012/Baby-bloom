const PDFDocument = require('pdfkit');
const { amountInWords, SELLER_STATE } = require('../lib/gst');

const rs = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SELLER = {
  name: process.env.SELLER_NAME || 'BABY BLOOM Pvt. Ltd.',
  address: process.env.SELLER_ADDRESS || 'Fulfilment Centre, Renigunta Road, Tirupati, Andhra Pradesh 517501',
  gstin: process.env.SELLER_GSTIN || '37ABCDE1234F1Z5',
  state: SELLER_STATE,
};

/**
 * Builds a GST-compliant tax invoice: invoice number, place of supply, HSN per line,
 * taxable value, CGST + SGST (intra-state) or IGST (inter-state), amount in words.
 */
function buildInvoice(order, user) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const g = order.gst || { rate: 0.12, interState: false, cgst: Math.floor(order.tax / 2), sgst: order.tax - Math.floor(order.tax / 2), igst: 0 };
  const ratePct = Math.round((g.rate || 0.12) * 100);

  // Header
  doc.font('Times-Bold').fontSize(24).fillColor('#2F2A3D').text('BABY BLOOM', 40, 40);
  doc.font('Helvetica').fontSize(8).fillColor('#666').text('Baby Care & Mother Care', 40, 68);
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(13).text('TAX INVOICE', 350, 40, { width: 205, align: 'right' });
  doc.font('Helvetica').fontSize(8)
    .text(`Invoice No: ${order.invoice?.number || 'PROFORMA'}`, 350, 60, { width: 205, align: 'right' })
    .text(`Invoice Date: ${new Date(order.invoice?.issuedAt || order.createdAt).toLocaleDateString('en-IN')}`, { width: 205, align: 'right' })
    .text(`Order No: ${order.orderNo}`, { width: 205, align: 'right' })
    .text(`Payment: ${order.payment.method.toUpperCase()} · ${order.payment.status.replace('_', ' ')}`, { width: 205, align: 'right' });

  doc.moveTo(40, 112).lineTo(555, 112).strokeColor('#ddd').stroke();

  // Seller / buyer blocks
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000').text('SOLD BY', 40, 122);
  doc.font('Helvetica').text(SELLER.name, 40, 134, { width: 240 }).text(SELLER.address, { width: 240 }).text(`GSTIN: ${SELLER.gstin}`).text(`State: ${SELLER.state}`);
  const a = order.address || {};
  doc.font('Helvetica-Bold').text('BILL / SHIP TO', 315, 122);
  doc.font('Helvetica').text(a.name || user?.name || '', 315, 134, { width: 240 }).text(a.line1 || '', { width: 240 })
    .text(`${a.city || ''}, ${a.state || g.placeOfSupply || ''} ${a.pincode || ''}`, { width: 240 }).text(`Phone: ${a.phone || '-'}`).text(user?.email || '');
  doc.font('Helvetica-Bold').text(`Place of supply: ${g.placeOfSupply || a.state || SELLER.state}`, 315, 200);

  // Items table
  const cols = g.interState
    ? [['#', 40, 18], ['Item', 58, 180], ['HSN', 238, 40], ['Qty', 278, 28], ['Rate', 306, 55], ['Taxable', 361, 65], [`IGST ${ratePct}%`, 426, 60], ['Amount', 486, 69]]
    : [['#', 40, 18], ['Item', 58, 160], ['HSN', 218, 38], ['Qty', 256, 26], ['Rate', 282, 50], ['Taxable', 332, 58], [`CGST ${ratePct / 2}%`, 390, 52], [`SGST ${ratePct / 2}%`, 442, 52], ['Amount', 494, 61]];
  let y = 226;
  doc.rect(40, y - 4, 515, 18).fill('#F3EDF7');
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(7.5);
  cols.forEach(([h, x, w], i) => doc.text(h, x + 2, y, { width: w - 4, align: i > 2 ? 'right' : 'left' }));
  y += 20;

  const discRatio = order.subtotal ? (order.discount || 0) / order.subtotal : 0;
  doc.font('Helvetica').fontSize(7.5);
  order.items.forEach((i, idx) => {
    const gross = i.price * i.qty;
    const taxable = gross * (1 - discRatio);
    const tax = taxable * (g.rate || 0.12);
    const cells = g.interState
      ? [idx + 1, i.name, i.hsn || '-', i.qty, rs(i.price), rs(taxable), rs(tax), rs(taxable + tax)]
      : [idx + 1, i.name, i.hsn || '-', i.qty, rs(i.price), rs(taxable), rs(tax / 2), rs(tax / 2), rs(taxable + tax)];
    const h = Math.max(14, doc.heightOfString(i.name, { width: cols[1][2] - 4 }) + 4);
    cells.forEach((c, k) => doc.text(String(c), cols[k][1] + 2, y, { width: cols[k][2] - 4, align: k > 2 ? 'right' : 'left' }));
    y += h;
    doc.moveTo(40, y - 2).lineTo(555, y - 2).strokeColor('#eee').stroke();
  });

  // Totals
  y += 8;
  const row = (label, val, bold) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 8).fillColor('#000')
      .text(label, 330, y, { width: 140, align: 'right' }).text(val, 475, y, { width: 80, align: 'right' });
    y += bold ? 18 : 13;
  };
  row('Items total', rs(order.subtotal));
  if (order.discount) row(`Discount${order.coupon ? ` (${order.coupon})` : ''}`, '- ' + rs(order.discount));
  row('Taxable value', rs(order.subtotal - order.discount));
  if (g.interState) row(`IGST @ ${ratePct}%`, rs(g.igst));
  else {
    row(`CGST @ ${ratePct / 2}%`, rs(g.cgst));
    row(`SGST @ ${ratePct / 2}%`, rs(g.sgst));
  }
  row(`Shipping (${order.shipping?.method || 'standard'})`, order.deliveryFee ? rs(order.deliveryFee) : 'FREE');
  row('Grand Total (₹)'.replace('₹', 'Rs.'), rs(order.total), true);
  if (order.amountRefunded) row('Refunded', '- ' + rs(order.amountRefunded));

  doc.font('Helvetica-Oblique').fontSize(8).text(amountInWords(order.total), 40, y + 4, { width: 515 });

  if (order.refunds?.length) {
    doc.font('Helvetica-Bold').fontSize(8).text('Refunds', 40, y + 24);
    order.refunds.forEach((r, k) =>
      doc.font('Helvetica').text(`${new Date(r.at).toLocaleDateString('en-IN')} · Rs. ${rs(r.amount)} · ${r.reason || 'Refund'} · Ref ${r.gatewayRefundId}`, 40, y + 36 + k * 11, { width: 515 })
    );
  }

  doc.font('Helvetica').fontSize(7).fillColor('#888')
    .text('This is a computer-generated invoice and does not require a signature. Goods once sold can be refunded as per our refund policy.', 40, 770, { width: 515, align: 'center' })
    .text(`Thank you for shopping with BABY BLOOM. Gentle care for little ones, delivered with love.`, { width: 515, align: 'center' });
  doc.end();
  return doc;
}

/** Streams the invoice PDF to an HTTP response. */
function streamInvoice(order, user, res) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="invoice-${order.orderNo}.pdf"`);
  buildInvoice(order, user).pipe(res);
}

/** Renders the invoice to a Buffer (for email attachments). */
function invoiceBuffer(order, user) {
  return new Promise((resolve, reject) => {
    const doc = buildInvoice(order, user);
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

module.exports = { streamInvoice, invoiceBuffer, SELLER };
