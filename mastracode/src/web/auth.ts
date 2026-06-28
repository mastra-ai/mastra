import { MastraAuthWorkos } from '@mastra/auth-workos';
import type { Context, Hono } from 'hono';

/**
 * WorkOS AuthKit gating for the MastraCode web server.
 *
 * When `WORKOS_API_KEY` and `WORKOS_CLIENT_ID` are both set, every route on the
 * web server is placed behind WorkOS AuthKit authentication: unauthenticated
 * browser navigations are redirected to the WorkOS hosted login, API/XHR calls
 * receive a 401, and a small set of public `/auth/*` routes drive the
 * login/callback/logout flow. When the env vars are absent, `mountWebAuth` is a
 * no-op and the server behaves exactly as it does without auth.
 *
 * The actual AuthKit session encryption, code exchange and token validation are
 * delegated to the existing `@mastra/auth-workos` provider (`MastraAuthWorkos`).
 */

/** Minimal shape of the signed-in user surfaced to the SPA (no tokens). */
export interface WebAuthUser {
  /** Stable WorkOS user id used to scope per-user data (GitHub installs etc.). */
  workosId?: string;
  /** WorkOS user id alias on some shapes; falls back to `workosId`. */
  id?: string;
  email?: string;
  name?: string;
}

/** Hono context variables set by the auth gate. */
export interface WebAuthVariables {
  webAuthUser: WebAuthUser;
}

/** Context key under which the gate stashes the authenticated user. */
const WEB_AUTH_USER_KEY = 'webAuthUser';

/**
 * Read the authenticated WorkOS user the gate stashed on the context, or
 * `undefined` when unauthenticated / auth disabled. Used by downstream routes
 * (e.g. GitHub) to scope rows per user.
 */
export function getWebAuthUser(c: Context): WebAuthUser | undefined {
  return c.get(WEB_AUTH_USER_KEY) as WebAuthUser | undefined;
}

/** Resolve the stable user id from a WorkOS user shape. */
export function getWebAuthUserId(user: WebAuthUser | undefined): string | undefined {
  return user?.workosId ?? user?.id;
}

/**
 * Web auth is enabled only when both WorkOS credentials are present. These are
 * the same env vars `@mastra/auth-workos` reads, so configuration stays
 * consistent with the rest of the repo.
 */
export function isWebAuthEnabled(): boolean {
  return Boolean(process.env.WORKOS_API_KEY && process.env.WORKOS_CLIENT_ID);
}

export interface MountWebAuthOptions {
  /**
   * Absolute URL WorkOS redirects back to after login. Must match an allowed
   * redirect URI configured in the WorkOS dashboard. Defaults to the
   * `WORKOS_REDIRECT_URI` env var.
   */
  redirectUri?: string;
}

/**
 * Validate that a `returnTo` value is a safe same-site path, to prevent
 * open-redirect attacks. Only absolute local paths (`/foo`) are allowed;
 * protocol-relative (`//evil.com`) and absolute URLs are rejected.
 */
function sanitizeReturnTo(raw: string | undefined): string {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  // Reject protocol-relative URLs like "//evil.com" and "/\evil.com".
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

/** Encode a validated returnTo path into the OAuth `state` parameter. */
function encodeState(returnTo: string): string {
  return Buffer.from(JSON.stringify({ returnTo }), 'utf8').toString('base64url');
}

/** Decode the OAuth `state` parameter back into a sanitized returnTo path. */
function decodeState(state: string | undefined): string {
  if (!state) return '/';
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { returnTo?: string };
    return sanitizeReturnTo(parsed.returnTo);
  } catch {
    return '/';
  }
}

/** Extract a bearer token from the Authorization header, if present. */
function getBearerToken(authorization: string | undefined): string {
  if (!authorization) return '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1] ?? '';
}

/**
 * Decide whether a request is a top-level browser navigation (which should be
 * redirected to login) versus an API/XHR call (which should get a 401 JSON
 * response the SPA can react to).
 */
function isNavigationRequest(path: string, accept: string | undefined): boolean {
  if (path.startsWith('/api/')) return false;
  return (accept ?? '').includes('text/html');
}

/**
 * Mount WorkOS AuthKit gating onto the web app. No-op when auth is disabled.
 *
 * Must be called before the Mastra adapter routes, the `/api/web/*` routes, and
 * the static UI handlers so the gate covers every request.
 */
export function mountWebAuth(app: Hono<any>, options: MountWebAuthOptions = {}): boolean {
  if (!isWebAuthEnabled()) return false;

  const redirectUri = options.redirectUri ?? process.env.WORKOS_REDIRECT_URI;
  const provider = new MastraAuthWorkos({ redirectUri });

  // ── Public auth routes ────────────────────────────────────────────────
  // Registered before the gate so they remain reachable while unauthenticated.

  app.get('/auth/login', c => {
    const returnTo = sanitizeReturnTo(c.req.query('returnTo'));
    const loginUrl = provider.getLoginUrl(redirectUri ?? '', encodeState(returnTo));
    return c.redirect(loginUrl);
  });

  app.get('/auth/callback', async c => {
    const code = c.req.query('code');
    const returnTo = decodeState(c.req.query('state'));
    if (!code) {
      return c.redirect('/auth/login');
    }

    try {
      const result = await provider.handleCallback(code, c.req.query('state') ?? '');
      for (const cookie of result.cookies ?? []) {
        c.header('Set-Cookie', cookie, { append: true });
      }
      return c.redirect(returnTo);
    } catch {
      // Code exchange failed (expired/replayed code, misconfig). Send the user
      // back to login rather than surfacing a raw error.
      return c.redirect('/auth/login');
    }
  });

  app.get('/auth/logout', async c => {
    let logoutUrl: string | null = null;
    try {
      logoutUrl = await provider.getLogoutUrl('/', c.req.raw);
    } catch {
      logoutUrl = null;
    }
    // Clear the session cookie regardless of whether WorkOS returned a logout URL.
    c.header('Set-Cookie', 'wos_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0', { append: true });
    return c.redirect(logoutUrl ?? '/');
  });

  app.get('/auth/me', async c => {
    // `/auth/me` is public (the gate skips `/auth/*`), so it validates the
    // session itself rather than reading a value the gate would have stashed.
    const token = getBearerToken(c.req.header('Authorization'));
    let user: WebAuthUser | null = null;
    try {
      user = (await provider.authenticateToken(token, c.req.raw)) as WebAuthUser | null;
    } catch {
      user = null;
    }
    if (!user) {
      return c.json({ authenticated: false, user: null });
    }
    return c.json({ authenticated: true, user: { email: user.email, name: user.name } });
  });

  // ── Gate middleware ───────────────────────────────────────────────────
  // Protects everything that is not a public `/auth/*` route.

  app.use('*', async (c, next) => {
    const path = c.req.path;
    if (path.startsWith('/auth/')) {
      return next();
    }

    const token = getBearerToken(c.req.header('Authorization'));
    let user: WebAuthUser | null = null;
    try {
      user = (await provider.authenticateToken(token, c.req.raw)) as WebAuthUser | null;
    } catch {
      user = null;
    }

    if (user) {
      c.set(WEB_AUTH_USER_KEY, user);
      return next();
    }

    if (isNavigationRequest(path, c.req.header('Accept'))) {
      const url = new URL(c.req.url);
      const returnTo = sanitizeReturnTo(url.pathname + url.search);
      return c.redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
    }

    return c.json({ error: 'unauthorized' }, 401);
  });

  return true;
}
