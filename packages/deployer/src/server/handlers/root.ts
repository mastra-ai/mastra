import type { Context } from 'hono';

// Root handler
export async function rootHandler(c: Context) {
  return c.text('Hello to the Mastra API!');
}
