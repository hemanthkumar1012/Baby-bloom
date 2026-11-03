/**
 * Order notifications — "Invoice + Email/WhatsApp" from the PDF flow.
 *  - Email: branded HTML template for every order event; the GST invoice PDF is attached on confirmation.
 *  - WhatsApp: WhatsApp Business Cloud API when WHATSAPP_TOKEN + WHATSAPP_PHONE_ID are set,
 *    otherwise a click-to-chat link is shown on the order page.
 * Each send is recorded on the order (channel, event, success) for support.
 */
let transporter;
const mailer = () => {
  if (transporter === undefined) {
    transporter = process.env.SMTP_HOST
      ? require('nodemailer').createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        })
      : null;
  }
  return transporter;
};

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const client = () => process.env.CLIENT_URL || 'http://localhost:5173';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const EVENTS = {
  placed: { subject: 'Order confirmed', head: 'Thank you! Your order is confirmed', body: 'We are packing it with love. Your GST invoice is attached.' },
  packed: { subject: 'Order packed', head: 'Your order is packed', body: 'It will be handed to our courier partner shortly.' },
  shipped: { subject: 'Order shipped', head: 'Your order is on its way', body: 'Track it any time with the link below.' },
  out_for_delivery: { subject: 'Out for delivery', head: 'Arriving today', body: 'Our delivery partner is on the way. Please keep your phone handy.' },
  delivered: { subject: 'Delivered', head: 'Delivered — enjoy!', body: 'We hope your little one loves it.' },
  cancelled: { subject: 'Order cancelled', head: 'Your order was cancelled', body: 'If you were charged, the amount will be refunded to your original payment method.' },
  refunded: { subject: 'Refund processed', head: 'Your refund is on its way', body: 'Refunds reach your original payment method in 5–7 working days.' },
};
const STATUS_EVENT = { Placed: 'placed', Packed: 'packed', Shipped: 'shipped', 'Out for Delivery': 'out_for_delivery', Delivered: 'delivered', Cancelled: 'cancelled', Refunded: 'refunded' };

function emailHtml(order, user, ev, extra) {
  const rows = order.items
    .map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${esc(i.name)} × ${i.qty}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${inr(i.price * i.qty)}</td></tr>`)
    .join('');
  const track = order.shipping?.trackingUrl
    ? `<p style="margin:16px 0"><a href="${esc(order.shipping.trackingUrl)}" style="background:#2F2A3D;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Track with ${esc(order.shipping.courier)}</a> <span style="color:#888;font-size:12px">AWB ${esc(order.shipping.trackingNo)}</span></p>`
    : '';
  const refund = extra?.amount ? `<p style="font-size:16px"><b>Refunded: ${inr(extra.amount)}</b></p>` : '';
  return `<!doctype html><html><body style="margin:0;background:#FFFAF6;font-family:Arial,Helvetica,sans-serif;color:#2F2A3D">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;padding:32px">
    <tr><td><p style="font-family:Georgia,serif;font-size:24px;letter-spacing:3px;margin:0">BABY BLOOM</p>
    <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:24px 0 8px">${esc(ev.head)}</h1>
    <p style="color:#666;margin:0 0 8px">Hi ${esc(user.name.split(' ')[0])}, ${esc(ev.body)}</p>
    <p style="color:#888;font-size:13px">Order <b>${esc(order.orderNo)}</b> · Status: ${esc(order.status)}</p>
    ${refund}${track}
    <table width="100%" style="font-size:14px;margin-top:12px">${rows}
      <tr><td style="padding-top:12px"><b>Total</b></td><td style="padding-top:12px;text-align:right"><b>${inr(order.total)}</b></td></tr></table>
    <p style="margin-top:24px"><a href="${client()}/orders/${order._id}" style="color:#E58A9E">View your order →</a></p>
    </td></tr></table>
  <p style="color:#aaa;font-size:11px">BABY BLOOM · Gentle care for little ones</p></td></tr></table></body></html>`;
}

async function sendEmail(order, user, event, extra) {
  const ev = EVENTS[event];
  if (!ev || !user?.email) return false;
  const mail = { from: process.env.MAIL_FROM, to: user.email, subject: `${ev.subject} · ${order.orderNo}`, html: emailHtml(order, user, ev, extra) };
  if (event === 'placed' || event === 'refunded') {
    const { invoiceBuffer } = require('./invoice');
    mail.attachments = [{ filename: `invoice-${order.orderNo}.pdf`, content: await invoiceBuffer(order, user), contentType: 'application/pdf' }];
  }
  if (!mailer()) {
    console.log(`[mail:demo] to=${user.email} | ${mail.subject}${mail.attachments ? ' | +invoice.pdf' : ''}`);
    return true;
  }
  await mailer().sendMail(mail);
  return true;
}

function waText(order, event, extra) {
  const ev = EVENTS[event];
  const lines = [`*BABY BLOOM* — ${ev.head}`, `Order ${order.orderNo} · ${inr(order.total)}`];
  if (extra?.amount) lines.push(`Refunded: ${inr(extra.amount)}`);
  if (order.shipping?.trackingUrl && ['shipped', 'out_for_delivery'].includes(event)) lines.push(`Track: ${order.shipping.trackingUrl}`);
  lines.push(`${client()}/orders/${order._id}`);
  return lines.join('\n');
}

const waNumber = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length === 10 ? '91' + d : d;
};

/** WhatsApp Business Cloud API (Meta). Uses an approved template when WHATSAPP_TEMPLATE is set. */
async function sendWhatsApp(order, user, event, extra) {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_ID || user?.whatsappOptIn === false) return false;
  const to = waNumber(order.address?.phone);
  if (to.length < 11) return false;
  const body = process.env.WHATSAPP_TEMPLATE
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: process.env.WHATSAPP_TEMPLATE,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: user.name.split(' ')[0] }, { type: 'text', text: order.orderNo }, { type: 'text', text: order.status }] }],
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: waText(order, event, extra) } };
  const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}`);
  return true;
}

/** Sends email + WhatsApp for an order event and records the outcome on the order. */
async function notify(order, user, event, extra) {
  const Order = require('../models/Order');
  const results = [];
  for (const [channel, fn] of [['email', sendEmail], ['whatsapp', sendWhatsApp]]) {
    try {
      const sent = await fn(order, user, event, extra);
      if (sent) results.push({ channel, event, ok: true });
    } catch (e) {
      console.error(`[notify:${channel}]`, e.message);
      results.push({ channel, event, ok: false });
    }
  }
  if (results.length) await Order.updateOne({ _id: order._id }, { $push: { notifications: { $each: results } } }).catch(() => {});
  return results;
}

const notifyStatus = (order, user) => (STATUS_EVENT[order.status] ? notify(order, user, STATUS_EVENT[order.status]) : Promise.resolve([]));

/** Click-to-chat link for the customer to share the order on WhatsApp (no API needed). */
function whatsappLink(order) {
  return `https://wa.me/?text=${encodeURIComponent(`My BABY BLOOM order ${order.orderNo} — ${order.status}. ${client()}/orders/${order._id}`)}`;
}

module.exports = { notify, notifyStatus, whatsappLink, emailHtml, waText, EVENTS };
