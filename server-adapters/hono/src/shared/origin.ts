import type { Context } from 'hono';

/**
 * Allowed `Origin` values for browser WebSocket upgrades. Accepts the same shape
 * as Hono's `cors.origin` option.
 */
export type BrowserStreamOrigin =
  | string
  | string[]
  | ((origin: string, c: Context) => Promise<string | undefined | null> | string | undefined | null);

/**
 * Resolve an `allowedOrigins` value against the request's `Origin` header.
 *
 * Mirrors Hono's `cors.origin` semantics so the same config value means the same
 * thing on the upgrade as it does on the HTTP routes: `'*'` allows everything,
 * array entries match literally, and a callback is only an approval when it
 * returns the request's own origin (the value Hono would echo back) or `'*'`.
 */
export async function isOriginAllowed(
  allowedOrigins: BrowserStreamOrigin,
  origin: string,
  c: Context,
): Promise<boolean> {
  if (Array.isArray(allowedOrigins)) {
    return allowedOrigins.includes(origin);
  }
  if (typeof allowedOrigins === 'function') {
    const allowed = await allowedOrigins(origin, c);
    return allowed === origin || allowed === '*';
  }
  return allowedOrigins === '*' || allowedOrigins === origin;
}

/**
 * Is the `Origin` header the server's own origin?
 *
 * A Studio served by this server connects back to the same host, and operators
 * don't add their own origin to a CORS allowlist because same-origin requests
 * never needed CORS. Comparing hosts (rather than scheme + host) keeps that
 * working behind TLS-terminating proxies, where the server sees `http` while the
 * browser sends `https`.
 */
export function isSameOrigin(origin: string, requestHost: string | undefined): boolean {
  if (!requestHost) {
    return false;
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  // `x-forwarded-host` may list several hosts; the first is the client-facing one.
  const host = (requestHost.split(',')[0] ?? '').trim();
  return originHost !== '' && originHost.toLowerCase() === host.toLowerCase();
}

/** The host the client addressed, preferring the first `x-forwarded-host` entry. */
export function requestHost(c: Context): string | undefined {
  return c.req.header('x-forwarded-host') ?? c.req.header('host');
}
