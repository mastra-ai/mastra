import { createClient } from '@libsql/client';
import { serve } from '@hono/node-server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';

const mode = process.argv[2];
if (mode !== 'vulnerable' && mode !== 'protected') throw new Error('EXAMPLE_MODE_INVALID');
const db = createClient({ url: 'file:/app/data/example.db' });
const app = new Hono();
/** Resolve a bundled example account from its bounded API-key digest, or return null. */
const authenticate = async (key: string | undefined) => {
  if (!key || key.length > 128) return null;
  const digest = createHash('sha256').update(key, 'utf8').digest();
  const users = await db.execute('SELECT user_id AS id, key_verifier FROM example_api_keys');
  for (const user of users.rows) {
    const expected = Buffer.from(String(user.key_verifier), 'hex');
    if (expected.length === digest.length && timingSafeEqual(digest, expected)) return String(user.id);
  }
  return null;
};
const unauthorized = () =>
  new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });

app.get('/api/orders', async context => {
  const userId = await authenticate(context.req.header('x-api-key'));
  if (!userId) return unauthorized();
  const result = await db.execute({
    sql: 'SELECT id FROM example_orders WHERE owner_id = ? ORDER BY id',
    args: [userId],
  });
  return context.json({
    principal: userId,
    orders: result.rows.map(row => ({ id: String(row.id), href: `/api/orders/${row.id}` })),
  });
});
app.get('/api/orders/:id', async context => {
  const userId = await authenticate(context.req.header('x-api-key'));
  if (!userId) return unauthorized();
  const id = context.req.param('id');
  if (!/^ord-[ab]-\d{4}$/.test(id)) return context.json({ code: 'NOT_FOUND' }, 404);
  const result = await db.execute({
    sql: 'SELECT id, owner_id, description, amount_cents FROM example_orders WHERE id = ?',
    args: [id],
  });
  const order = result.rows[0];
  if (!order) return context.json({ code: 'NOT_FOUND' }, 404);
  if (mode === 'protected' && order.owner_id !== userId) return context.json({ code: 'FORBIDDEN' }, 403);
  return context.json({
    id: order.id,
    ownerId: order.owner_id,
    description: order.description,
    amountCents: order.amount_cents,
    receiptHref: `/api/orders/${order.id}/receipt`,
  });
});
app.get('/api/orders/:id/receipt', async context => {
  const userId = await authenticate(context.req.header('x-api-key'));
  if (!userId) return unauthorized();
  const id = context.req.param('id');
  if (!/^ord-[ab]-\d{4}$/.test(id)) return context.json({ code: 'NOT_FOUND' }, 404);
  const result = await db.execute({
    sql: 'SELECT id, owner_id, amount_cents FROM example_orders WHERE id = ?',
    args: [id],
  });
  const order = result.rows[0];
  if (!order) return context.json({ code: 'NOT_FOUND' }, 404);
  if (order.owner_id !== userId) return context.json({ code: 'FORBIDDEN' }, 403);
  return context.json({ orderId: order.id, totalCents: order.amount_cents });
});
app.get('/api/products', async context => {
  const result = await db.execute('SELECT id, name, price_cents FROM example_products ORDER BY id');
  return context.json({
    products: result.rows.map(row => ({ id: row.id, name: row.name, priceCents: row.price_cents })),
  });
});
app.get('/openapi.json', context =>
  context.json({
    openapi: '3.1.0',
    info: { title: 'Security Scanner Example Orders API', version: '1.0.0' },
    servers: [{ url: '/' }],
    components: { securitySchemes: { ApiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' } } },
    paths: {
      '/api/orders': {
        get: {
          operationId: 'listOrders',
          security: [{ ApiKey: [] }],
          responses: {
            '200': { description: 'Own order references' },
            '401': { description: 'Missing or invalid key' },
          },
        },
      },
      '/api/orders/{id}': {
        get: {
          operationId: 'getOrder',
          security: [{ ApiKey: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Order details' },
            '401': { description: 'Missing or invalid key' },
            '403': { description: 'Protected mode denies a different owner' },
          },
        },
      },
      '/api/orders/{id}/receipt': {
        get: {
          operationId: 'getOrderReceipt',
          security: [{ ApiKey: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Own order receipt, linked from own order detail' },
            '401': { description: 'Missing or invalid key' },
            '403': { description: 'A different owner cannot read the receipt' },
          },
        },
      },
      '/api/products': {
        get: { operationId: 'listProducts', responses: { '200': { description: 'Public shared products' } } },
      },
    },
  }),
);
const listener = serve({ fetch: app.fetch, hostname: '0.0.0.0', port: 18080 });
const close = () => {
  listener.close(() => {
    db.close();
  });
};
process.once('SIGINT', close);
process.once('SIGTERM', close);
