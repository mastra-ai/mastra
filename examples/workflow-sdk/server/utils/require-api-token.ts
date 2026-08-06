import { timingSafeEqual } from 'node:crypto';

import type { H3Event } from 'nitro/h3';
import { createError, getRequestHeader } from 'nitro/h3';

/**
 * Minimal auth boundary for the example endpoints.
 *
 * Every request must carry `Authorization: Bearer <ORDERS_API_TOKEN>`. This is a
 * single shared token, not a real user system — a production app should replace
 * this with proper authentication plus per-run ownership/approver checks before
 * exposing run state or resuming runs by id.
 */
export function requireApiToken(event: H3Event): void {
  const expected = process.env.ORDERS_API_TOKEN;
  if (!expected) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Set the ORDERS_API_TOKEN environment variable to enable the orders API',
    });
  }

  const header = getRequestHeader(event, 'authorization');
  const provided = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = provided === undefined ? undefined : Buffer.from(provided);

  if (
    !providedBuffer ||
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw createError({ statusCode: 401, statusMessage: 'Missing or invalid bearer token' });
  }
}
