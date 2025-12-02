import type { Context } from 'hono';

// Health check handler
export async function healthHandler(c: Context) {
  return c.json({ success: true }, 200);
}
