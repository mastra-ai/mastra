import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getCookie, setCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { ControlPlaneError, parse, sessionSchema } from '../core/contracts.js';
import type { Hono } from 'hono';

export const OPERATOR_ID = 'local-operator';
const COOKIE = 'scanner_session';
const MAX_SESSIONS = 16;
/** Compare equal-length authentication values with a timing-safe byte comparison. */
export function constantEquals(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function protectControlPlane(
  app: Hono,
  authority: () => string,
  bootstrapSecret?: string,
  sessionTtlSeconds = 1800,
) {
  const sessions = new Map<string, { csrf: string; expiresAt: number }>();
  app.use('*', async (context, next) => {
    const expected = authority();
    const origin = context.req.header('origin');
    const mutation = !['GET', 'HEAD'].includes(context.req.method);
    if (
      context.req.header('host') !== expected ||
      (origin !== undefined && origin !== `http://${expected}`) ||
      (bootstrapSecret && mutation && origin !== `http://${expected}`)
    ) {
      return context.json({ code: 'LOCAL_ORIGIN_REQUIRED' }, 403);
    }
    context.header('Cache-Control', 'no-store');
    context.header('X-Content-Type-Options', 'nosniff');
    context.header('Referrer-Policy', 'no-referrer');
    context.header('X-Frame-Options', 'DENY');
    context.header('Cross-Origin-Resource-Policy', 'same-origin');
    context.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    context.header(
      'Content-Security-Policy',
      "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
    const publicShell =
      context.req.method === 'GET' &&
      (context.req.path === '/' || /^\/assets\/(?:console|style)-[a-f0-9]{64}\.(?:js|css)$/.test(context.req.path));
    if (!bootstrapSecret) {
      if (!publicShell && (context.req.method !== 'GET' || context.req.path !== '/api/runtime'))
        return context.json({ code: 'EXECUTION_DISABLED' }, 403);
    } else if (
      !publicShell &&
      !(context.req.path === '/api/session' && context.req.method === 'POST') &&
      !(context.req.path === '/api/runtime' && context.req.method === 'GET')
    ) {
      const token = getCookie(context, COOKIE);
      const session = token ? sessions.get(token) : undefined;
      if (!session || session.expiresAt <= Date.now()) {
        if (token) sessions.delete(token);
        return context.json({ code: 'LOCAL_SESSION_REQUIRED' }, 403);
      }
      if (mutation && !constantEquals(context.req.header('x-csrf-token') ?? '', session.csrf)) {
        return context.json({ code: 'CSRF_REQUIRED' }, 403);
      }
    }
    await next();
  });
  // This reads the actual stream, including chunked bodies, before adapter.json() or domain handlers.
  app.use('*', bodyLimit({ maxSize: 16384, onError: context => context.json({ code: 'BODY_TOO_LARGE' }, 413) }));
  app.post('/api/session', async context => {
    if (!bootstrapSecret) throw new ControlPlaneError('EXECUTION_DISABLED', 403);
    const input = parse(sessionSchema, await readJson(context.req));
    if (!constantEquals(input.secret, bootstrapSecret)) throw new ControlPlaneError('LOCAL_SESSION_REQUIRED', 403);
    for (const [token, session] of sessions) if (session.expiresAt <= Date.now()) sessions.delete(token);
    if (sessions.size >= MAX_SESSIONS) throw new ControlPlaneError('SESSION_LIMIT_REACHED', 503);
    const token = randomBytes(32).toString('hex');
    const csrf = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + sessionTtlSeconds * 1000;
    sessions.set(token, { csrf, expiresAt });
    setCookie(context, COOKIE, token, { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: sessionTtlSeconds });
    return context.json({ csrfToken: csrf, expiresAt: new Date(expiresAt).toISOString(), operator: OPERATOR_ID }, 201);
  });
  app.get('/api/session', context => {
    const token = getCookie(context, COOKIE);
    const session = token ? sessions.get(token) : undefined;
    if (!session || session.expiresAt <= Date.now()) throw new ControlPlaneError('LOCAL_SESSION_REQUIRED', 403);
    return context.json({
      csrfToken: session.csrf,
      expiresAt: new Date(session.expiresAt).toISOString(),
      operator: OPERATOR_ID,
    });
  });
  app.delete('/api/session', context => {
    const token = getCookie(context, COOKIE);
    if (token) sessions.delete(token);
    setCookie(context, COOKIE, '', { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 0 });
    return context.body(null, 204);
  });
  /** Allow only explicit native metadata GET routes and reject execution or query-controlled context. */
  const nativeBoundary: MiddlewareHandler = async (context, next) => {
    if (
      context.req.method !== 'GET' ||
      !['/native/agents', '/native/workflows', '/native/openapi.json', '/native/auth/capabilities'].includes(
        context.req.path,
      )
    ) {
      return context.json({ code: 'EXECUTION_DISABLED' }, 403);
    }
    // Only allowlisted metadata is exposed. Never accept client RequestContext as operator identity.
    if ([...new URL(context.req.url).searchParams.keys()].length) return context.json({ code: 'INVALID_INPUT' }, 400);
    await next();
  };
  app.use('/native/*', nativeBoundary);
  return { close: () => sessions.clear() };
}
/** Read JSON after checking its media type; the surrounding middleware enforces the body limit. */
export async function readJson(request: { header(name: string): string | undefined; json(): Promise<unknown> }) {
  if (!/^application\/json(?:;|$)/i.test(request.header('content-type') ?? ''))
    throw new ControlPlaneError('JSON_REQUIRED', 400);
  try {
    return await request.json();
  } catch {
    throw new ControlPlaneError('INVALID_JSON', 400);
  }
}
