/**
 * Blocks NoSQL operator injection: removes any object key that starts with "$"
 * or contains "." from req.body, req.query and req.params (e.g. {"email":{"$gt":""}}).
 */
function clean(value, depth = 0) {
  if (depth > 10 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) delete value[key];
    else value[key] = clean(value[key], depth + 1);
  }
  return value;
}

function sanitize(req, res, next) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) clean(req.body);
  if (req.params) clean(req.params);
  if (req.query) {
    // Express 5 makes req.query a getter; clean a copy and redefine when needed
    const q = clean({ ...req.query });
    try {
      for (const k of Object.keys(req.query)) if (!(k in q)) delete req.query[k];
    } catch {
      Object.defineProperty(req, 'query', { value: q, writable: true });
    }
  }
  next();
}

module.exports = { sanitize, clean };
