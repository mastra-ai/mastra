import type { Context, TypedResponse } from 'hono';

// Health check handler
// Explicit return type: with hono 4.13.11, tsc cannot name the inferred c.json() type in emitted declarations (TS2883).
export async function healthHandler(c: Context): Promise<Response & TypedResponse<{ success: boolean }, 200, 'json'>> {
  return c.json({ success: true }, 200);
}
