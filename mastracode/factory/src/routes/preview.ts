/**
 * Preview subdomain plumbing for exposing sandbox-local dev servers back to
 * the user's browser through the same Factory origin.
 *
 * The hostname scheme is `p-{port}-{sessionSlug}.preview.{parentHost}`:
 *   - `port` — the TCP port on the sandbox we're proxying to (1–65535)
 *   - `sessionSlug` — a short deterministic hash of the session ID so we can
 *     tell two co-tenants' previews apart on a shared local machine without
 *     leaking full session identifiers in URLs shared over Slack, etc.
 *   - `parentHost` — the Factory's own hostname, so the wildcard cert covers
 *     `*.preview.factory.example.com` in prod and `*.preview.localhost`
 *     works out of the box in dev (browsers resolve `.localhost` to 127.0.0.1
 *     per RFC 6761 — no /etc/hosts editing required).
 *
 * The subdomain is intentionally structural, not encoded, so we can dispatch
 * without a database lookup on the hot path. A session registry (see
 * follow-up work) will still be needed to authorize each request, but
 * routing is a pure hostname parse.
 */

import { createHash } from 'node:crypto';

import type { MiddlewareHandler } from 'hono';

export interface PreviewSubdomain {
  /** The sandbox port the request should be proxied to. */
  port: number;
  /** Deterministic short hash of the originating session id. */
  sessionSlug: string;
  /** Bare parent host (no `preview.` prefix), matched from config. */
  parentHost: string;
}

/**
 * Length of the base32-encoded slug we embed in preview hostnames. Long
 * enough to keep accidental collisions between concurrent sessions on the
 * same machine astronomically unlikely (5 bits × 10 = 50 bits of entropy)
 * while still fitting well inside DNS label limits.
 */
const SLUG_LENGTH = 10;

/**
 * Base32 without `0`, `1`, `8`, `o`, `l` — mirrors Crockford's alphabet so
 * slugs stay unambiguous when someone reads a URL out loud.
 */
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Compute the sessionSlug for a session id. The hash is truncated to
 * SLUG_LENGTH characters — never reversible into the original id, but
 * stable so a session always maps to the same preview subdomain and any
 * bookmarks or shared links stay valid for the session's lifetime.
 */
export function sessionSlug(sessionId: string): string {
  if (!sessionId) throw new Error('sessionSlug: sessionId required');
  const digest = createHash('sha256').update(`preview:${sessionId}`).digest();
  let output = '';
  for (let byteIndex = 0; output.length < SLUG_LENGTH; byteIndex++) {
    // Crockford base32 emits 8 characters per 5 bytes; take one byte at a
    // time and pull the low 5 bits, which is enough for our short slug.
    const byte = digest[byteIndex % digest.length]!;
    output += CROCKFORD_ALPHABET[byte & 0x1f]!;
  }
  return output.toLowerCase();
}

/**
 * Build the canonical preview hostname for a given session + port. Callers
 * combine this with the Factory's origin scheme and port when they want a
 * full URL to hand to the browser (`buildPreviewUrl` below).
 */
export function previewHostFor(port: number, sessionId: string, parentHost: string): string {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`previewHostFor: invalid port ${port}`);
  }
  const normalizedParent = normalizeParentHost(parentHost);
  return `p-${port}-${sessionSlug(sessionId)}.preview.${normalizedParent}`;
}

/**
 * Assemble the full browser-facing preview URL for a session + port. Mirrors
 * the origin's protocol and port so the hop works transparently locally
 * (`http://p-3000-abc.preview.localhost:4111/`) and in production
 * (`https://p-3000-abc.preview.studio-x.mastra.cloud/`).
 */
export function buildPreviewUrl(port: number, sessionId: string, publicUrl: string): string {
  const parsed = new URL(publicUrl);
  const host = previewHostFor(port, sessionId, parsed.hostname);
  parsed.hostname = host;
  parsed.pathname = '/';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

/**
 * Parse an incoming request's Host header. Returns null when the host does
 * not look like one of our preview subdomains — the caller must fall
 * through to normal routing in that case. The parser is deliberately
 * strict: unknown parent hosts, out-of-range ports, and malformed slugs
 * all return null rather than being silently coerced.
 */
export function parsePreviewHost(host: string | null | undefined, parentHost: string): PreviewSubdomain | null {
  if (!host) return null;
  const normalizedParent = normalizeParentHost(parentHost);
  // Strip any port suffix — the Host header includes it whenever the request
  // arrived on a non-default port (e.g. localhost:4111 in dev).
  const bareHost = host.replace(/:\d+$/, '').toLowerCase();
  const suffix = `.preview.${normalizedParent}`;
  if (!bareHost.endsWith(suffix)) return null;
  const label = bareHost.slice(0, -suffix.length);
  const match = /^p-(\d{1,5})-([0-9a-z]{6,20})$/.exec(label);
  if (!match) return null;
  const port = Number(match[1]);
  const slug = match[2]!;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { port, sessionSlug: slug, parentHost: normalizedParent };
}

/**
 * Normalize a parent host so string comparisons behave predictably. We only
 * care about the DNS label form — port and scheme are the caller's
 * responsibility.
 */
export function normalizeParentHost(parentHost: string): string {
  return parentHost.trim().toLowerCase().replace(/:\d+$/, '');
}

/**
 * Extract the parent hostname to compare against from a Factory publicUrl.
 * Returns null when the URL is unparseable or the hostname would produce
 * degenerate preview URLs (empty, IP literal — a wildcard subdomain doesn't
 * work on an IP anyway).
 */
export function parentHostFromPublicUrl(publicUrl: string): string | null {
  try {
    const hostname = new URL(publicUrl).hostname.toLowerCase();
    if (!hostname) return null;
    // IPs can't host wildcard subdomains — bail so callers know previews
    // won't work without a real hostname.
    if (/^\d+(?:\.\d+){3}$/.test(hostname)) return null;
    if (hostname.includes(':')) return null;
    return hostname;
  } catch {
    return null;
  }
}

/**
 * Dispatcher middleware. When the incoming Host matches the preview scheme
 * for our configured parent, hand the request to the `handle` callback
 * (which is where the actual proxy — HTTP or WebSocket — will live). When
 * it doesn't match, we call next() so normal Factory routing runs.
 *
 * Split from the proxy implementation on purpose: keeping the routing
 * decision this thin lets us verify hostname parsing without any sandbox
 * plumbing standing up, and lets us swap the proxy backend (local fetch,
 * SSH tunnel, wildcard TLS terminator) without touching this layer.
 */
export interface PreviewDispatchConfig {
  parentHost: string;
  handle: (context: import('hono').Context, subdomain: PreviewSubdomain) => Response | Promise<Response>;
}

export function createPreviewDispatchMiddleware(config: PreviewDispatchConfig): MiddlewareHandler {
  const normalizedParent = normalizeParentHost(config.parentHost);
  return async (c, next) => {
    // Precedence: X-Forwarded-Host (proxy sits between client and Factory),
    // then the raw Host header, then the request URL host. The URL host is
    // authoritative in Hono when nothing else is set (Node's Fetch Request
    // does not synthesize a Host header) — parsing the URL as the last
    // fallback keeps unit tests, direct integration tests, and reverse-proxy
    // deployments all working with the same middleware.
    const forwarded = c.req.header('x-forwarded-host');
    const raw = c.req.header('host');
    let urlHost: string | undefined;
    try {
      urlHost = new URL(c.req.url).host;
    } catch {
      urlHost = undefined;
    }
    const host = forwarded ?? raw ?? urlHost;
    const subdomain = parsePreviewHost(host, normalizedParent);
    if (!subdomain) return next();
    return config.handle(c, subdomain);
  };
}

/**
 * Placeholder preview handler wired in ahead of the real proxy work. Returns
 * a 501 that names the resolved port + session slug so we can eyeball that
 * host-based routing is doing the right thing end-to-end (curl against a
 * preview subdomain locally and read the JSON back).
 */
export function createPreviewNotImplementedHandler(): PreviewDispatchConfig['handle'] {
  return (c, subdomain) =>
    c.json(
      {
        error: 'preview_not_implemented',
        message: 'Preview proxy is not wired up yet; hostname routing arrived first.',
        port: subdomain.port,
        sessionSlug: subdomain.sessionSlug,
        parentHost: subdomain.parentHost,
      },
      501,
    );
}
