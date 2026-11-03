/**
 * Server-Sent Events hub — pushes live order updates to the admin dashboard
 * and to the customer who owns the order (no polling, no extra dependency).
 */
const clients = new Set(); // { res, userId, isAdmin }

function subscribe(req, res, user) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: ready\ndata: {"ok":true}\n\n`);
  const client = { res, userId: user._id.toString(), isAdmin: user.role === 'admin' };
  clients.add(client);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(ping);
    clients.delete(client);
  });
}

function send(client, event, payload) {
  try {
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  } catch {
    clients.delete(client);
  }
}

/** Broadcast an order change to admins + the owning customer. */
function publishOrder(order, event = 'order') {
  const ownerId = (order.user?._id || order.user)?.toString();
  const payload = {
    _id: order._id,
    orderNo: order.orderNo,
    status: order.status,
    paymentStatus: order.payment?.status,
    total: order.total,
    updatedAt: order.updatedAt || new Date(),
  };
  for (const c of clients) if (c.isAdmin || c.userId === ownerId) send(c, event, payload);
}

function publishAdmin(event, payload) {
  for (const c of clients) if (c.isAdmin) send(c, event, payload);
}

module.exports = { subscribe, publishOrder, publishAdmin, _clients: clients };
