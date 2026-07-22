/**
 * Server-wide error handler for the MastraCode web surface.
 *
 * Installed as `server.onError`, which the deployer applies to the top-level
 * Hono app AND the custom-route sub-app (`/web/*`, `/auth/*`) — without it,
 * unexpected route errors surface as an opaque `Internal Server Error` with no
 * server-side trace.
 */

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

/** Handle a route error: log full detail server-side, return structured JSON. */
export function handleServerError(err: Error, c: Context): Response {
  // Deliberate HTTP errors (auth middleware, body limits, handlers) keep their
  // status + message; they are expected flows, not server faults.
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
  console.error(`[MastraCode Web] ${c.req.method} ${c.req.path} failed: ${detail}`);

  return c.json(
    {
      error: 'internal_error',
      message: err instanceof Error ? err.message : String(err),
    },
    500,
  );
}
