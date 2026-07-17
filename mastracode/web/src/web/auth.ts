import type { MastraAuthWorkos } from '@mastra/auth-workos';
import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { Context, Hono } from 'hono';

import type { WebAuthAdapter, WebAuthTenant, WebAuthUser } from './auth-adapter.js';
import { getBearerToken, sanitizeReturnTo } from './auth-adapter.js';
import { WorkOSWebAuth } from './auth-workos-adapter.js';
import { getSeededAuthAdapter, isRuntimeConfigSeeded } from './runtime-config.js';

/**
 * Provider-neutral web auth gating for the MastraCode web server.
 *
 * When a `WebAuthAdapter` is active (passed to `MastraFactory`'s `auth` slot,
 * or — back-compat for suites/paths that never boot the factory — implied by
 * the WorkOS env vars), every route on the web server is placed behind it:
 * unauthenticated browser navigations are redirected to the SPA's `/signin`
 * page, API/XHR calls receive a 401, and a small set of public routes stay
 * reachable while signed out — the adapter's `/auth/*` routes plus `/auth/me`,
 * the `/signin` page and its `/assets/*` bundle. When no adapter is active,
 * `mountWebAuth` is a no-op and the server behaves exactly as it does without
 * auth.
 *
 * Provider specifics (session validation, hosted-login routes, org bootstrap,
 * session cookie) live behind the {@link WebAuthAdapter} interface — see
 * `./auth-adapter.ts` and the shipped `WorkOSWebAuth` adapter.
 */

export type { WebAuthAdapter, WebAuthTenant, WebAuthUser } from './auth-adapter.js';
export { ensureUserHasOrganization, WorkOSWebAuth } from './auth-workos-adapter.js';

/** Hono context variables set by the auth gate. */
export interface WebAuthVariables {
  webAuthUser: WebAuthUser;
}

/** Context key under which the gate stashes the authenticated user. */
const WEB_AUTH_USER_KEY = 'webAuthUser';

/**
 * Read the authenticated user the gate stashed on the context, or
 * `undefined` when unauthenticated / auth disabled. Used by downstream routes
 * (e.g. GitHub) to scope rows per user.
 */
export function getWebAuthUser(c: Context): WebAuthUser | undefined {
  return c.get(WEB_AUTH_USER_KEY) as WebAuthUser | undefined;
}

/** Resolve the stable user id from an authenticated user shape. */
export function getWebAuthUserId(user: WebAuthUser | undefined): string | undefined {
  return user?.workosId ?? user?.id;
}

/** Resolve the organization id from a user shape, if present. */
export function getWebAuthOrgId(user: WebAuthUser | undefined): string | undefined {
  return user?.organizationId;
}

/**
 * Resolve the tenant identity `(orgId, userId)` from the authenticated user on
 * the context. Returns `undefined` when there is no signed-in user (auth
 * disabled or unauthenticated). `orgId` is `undefined` for personal accounts;
 * callers gate org-scoped GitHub features on its presence while agent state
 * falls back to a user-only tenant.
 */
export function webAuthTenant(c: Context): WebAuthTenant | undefined {
  const user = getWebAuthUser(c);
  const userId = getWebAuthUserId(user);
  if (!userId) return undefined;
  return { orgId: getWebAuthOrgId(user), userId };
}

/** True when both WorkOS credential env vars are present (legacy env gate). */
function envWorkosConfigured(): boolean {
  return Boolean(process.env.WORKOS_API_KEY && process.env.WORKOS_CLIENT_ID);
}

/**
 * Module-level adapter used when the factory never seeded the registry but the
 * WorkOS env vars are set — back-compat for modules and test suites exercised
 * without booting the factory (route suites set `WORKOS_*` directly). Kept
 * module-level so callers outside `mountWebAuth` — such as the GitHub routes,
 * which are mounted on a separate sub-app — reuse one provider.
 */
let envFallbackAdapter: WorkOSWebAuth | undefined;

/**
 * Resolve the active web auth adapter: the factory-seeded adapter when the
 * registry is seeded (including `undefined` = auth explicitly disabled),
 * otherwise a WorkOS adapter implied by the `WORKOS_*` env vars (back-compat;
 * slated for removal once all consumers seed the registry).
 */
export function getActiveWebAuthAdapter(): WebAuthAdapter | undefined {
  if (isRuntimeConfigSeeded()) return getSeededAuthAdapter();
  if (!envWorkosConfigured()) return undefined;
  envFallbackAdapter ??= new WorkOSWebAuth({ redirectUri: process.env.WORKOS_REDIRECT_URI });
  return envFallbackAdapter;
}

/** Web auth is enabled when an adapter is active. */
export function isWebAuthEnabled(): boolean {
  return getActiveWebAuthAdapter() !== undefined;
}

/**
 * Fail-closed authorization for organization-level administrative mutations.
 * The caller must belong to the same active organization and the adapter must
 * explicitly confirm an admin/owner role.
 */
export async function isOrganizationAdmin(c: Context, organizationId: string): Promise<boolean> {
  const user = await ensureWebAuthUser(c);
  const adapter = getActiveWebAuthAdapter();
  if (!user || user.organizationId !== organizationId || !adapter?.isOrganizationAdmin) return false;
  try {
    return await adapter.isOrganizationAdmin(user, organizationId);
  } catch {
    return false;
  }
}

/** True when the active adapter is WorkOS. Gates WorkOS-only capabilities. */
export function isWorkOSAuth(): boolean {
  return getActiveWebAuthAdapter()?.kind === 'workos';
}

/**
 * Shared WorkOS auth provider, exposed for features that need the raw WorkOS
 * client (audit-log export, Admin Portal links). Callers must gate on
 * {@link isWorkOSAuth} (or {@link isWebAuthEnabled} on WorkOS-only deploys)
 * first — throws when the active adapter is not WorkOS.
 */
export function getWorkOSProvider(): MastraAuthWorkos {
  const adapter = getActiveWebAuthAdapter();
  if (adapter instanceof WorkOSWebAuth) return adapter.provider;
  throw new Error('WorkOS provider requested but the active web auth adapter is not WorkOS');
}

/**
 * Resolve the authenticated user for a request, stashing it on the context.
 *
 * The gate only authenticates non-`/auth/*` requests via the `Authorization`
 * header, so cookie-based browser navigations to public `/auth/*` routes (the
 * GitHub connect/callback flow) arrive without a gate-stashed user. This reads
 * the session cookie from the raw request the same way `/auth/me` does,
 * caches the result on the context, and returns it so downstream helpers like
 * {@link webAuthTenant} work uniformly on both gated and public routes.
 *
 * Returns `undefined` when there is no valid session (or auth is disabled).
 */
export async function ensureWebAuthUser(c: Context): Promise<WebAuthUser | undefined> {
  const existing = getWebAuthUser(c);
  if (existing) return existing;
  const adapter = getActiveWebAuthAdapter();
  if (!adapter) return undefined;

  const token = getBearerToken(c.req.header('Authorization'));
  let user: WebAuthUser | null = null;
  try {
    user = await adapter.authenticate(token, c.req.raw);
  } catch {
    user = null;
  }
  if (!user) return undefined;

  // Bootstrap a personal org for no-org accounts so org-scoped features (GitHub
  // connect) work without leaving the app. Mutating the resolved user lets the
  // current request see the org immediately; subsequent requests resolve it via
  // the provider's own session/membership lookup.
  if (!getWebAuthOrgId(user)) {
    const orgId = await adapter.ensureOrg(user);
    if (orgId) user.organizationId = orgId;
  }

  c.set(WEB_AUTH_USER_KEY, user);
  return user;
}

export interface MountWebAuthOptions {
  /**
   * Absolute URL the identity provider redirects back to after login (WorkOS
   * env-fallback path only). Defaults to the `WORKOS_REDIRECT_URI` env var.
   */
  redirectUri?: string;
}

/**
 * Decide whether a request is a top-level browser navigation (which should be
 * redirected to `/signin`) versus an API/XHR call (which should get a 401 JSON
 * response the SPA can react to).
 */
function isNavigationRequest(path: string, accept: string | undefined): boolean {
  if (path.startsWith('/api/')) return false;
  return (accept ?? '').includes('text/html');
}

/**
 * Handle the provider-neutral `/auth/me` route: validate the session with the
 * active adapter and report the signed-in user (no tokens) to the SPA.
 * `/auth/me` is public (the gate skips `/auth/*`), so it validates the session
 * itself rather than reading a value the gate would have stashed.
 */
async function handleAuthMe(adapter: WebAuthAdapter, c: Context): Promise<Response> {
  const token = getBearerToken(c.req.header('Authorization'));
  let user: WebAuthUser | null = null;
  try {
    user = await adapter.authenticate(token, c.req.raw);
  } catch {
    user = null;
  }
  // Provider identity for the SPA: `/signin` renders the hosted-login button
  // for WorkOS and an email/password form for better-auth (with sign-up hidden
  // when the adapter disables it).
  const provider = { provider: adapter.kind, ...(adapter.signUpDisabled ? { signUpDisabled: true } : {}) };
  if (!user) {
    return c.json({ authenticated: false, user: null, ...provider });
  }
  return c.json({
    authenticated: true,
    user: { userId: getWebAuthUserId(user), email: user.email, name: user.name, organizationId: user.organizationId },
    ...provider,
  });
}

/**
 * Register the public `/auth/*` routes on a Hono app: the adapter's own
 * routes (login/callback/logout/provider APIs) plus the provider-neutral
 * `/auth/me`. Split out from `mountWebAuth` so both the local Hono server and
 * the platform Mastra entry can reuse the exact same handlers.
 */
export function registerAuthRoutes(app: Hono<any>, adapter: WebAuthAdapter): void {
  for (const route of adapter.publicRoutes()) {
    const methods = route.method === 'ALL' ? ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] : [route.method];
    app.on(methods, route.path, c => route.handler(c));
  }
  app.get('/auth/me', c => handleAuthMe(adapter, c));
}

/**
 * Build the public `/auth/*` routes (adapter routes + `/auth/me`) as Mastra
 * `server.apiRoutes`. Used by the platform Mastra entry (`src/mastra/index.ts`),
 * which can't register plain Hono routes on the deployer-generated app the way
 * the local server does via {@link registerAuthRoutes}.
 *
 * Handlers are identical to {@link registerAuthRoutes}. All are `requiresAuth: false`
 * (they must be reachable while unauthenticated), and the gate middleware skips
 * `/auth/*` so it never blocks them. `/auth/*` is not under `/api`, so it is a
 * valid custom-route path.
 */
export function buildAuthRoutes(adapter: WebAuthAdapter): ApiRoute[] {
  return [
    // `registerApiRoute` handlers see @mastra/core's bundled hono Context type,
    // which is structurally identical to (but nominally distinct from) the
    // local hono version the adapter handlers are typed against — cast across
    // the seam.
    ...adapter.publicRoutes().map(route =>
      registerApiRoute(route.path, {
        method: route.method,
        requiresAuth: false,
        handler: c => route.handler(c as unknown as Context),
      }),
    ),
    registerApiRoute('/auth/me', {
      method: 'GET',
      requiresAuth: false,
      handler: c => handleAuthMe(adapter, c as unknown as Context),
    }),
  ];
}

/**
 * Build the auth gate as a plain Hono middleware handler `(c, next)`. Protects
 * everything that is not a public `/auth/*` route: authenticated requests stash
 * the user on the context and continue; unauthenticated navigations redirect to
 * login and XHR/API calls get a 401 JSON. Shared by the local Hono server
 * (`mountWebAuth`) and the platform Mastra entry (`server.middleware`).
 */
export function createWebAuthGate(adapter: WebAuthAdapter) {
  return async (c: Context, next: () => Promise<void>): Promise<Response | void> => {
    const path = c.req.path;
    if (path.startsWith('/auth/')) {
      return next();
    }
    if (c.req.method === 'POST' && path === '/web/github/webhook') {
      return next();
    }
    // The SPA sign-in page and the static bundle it needs must be reachable
    // while signed out; no user is stashed, so `/api/*` stays protected.
    if (path === '/signin' || path.startsWith('/assets/')) {
      return next();
    }

    const token = getBearerToken(c.req.header('Authorization'));
    let user: WebAuthUser | null = null;
    try {
      user = await adapter.authenticate(token, c.req.raw);
    } catch {
      user = null;
    }

    if (user) {
      // Bootstrap a personal org for no-org accounts so the org id resolves on
      // this request (see ensureWebAuthUser for the rationale).
      if (!getWebAuthOrgId(user)) {
        const orgId = await adapter.ensureOrg(user);
        if (orgId) user.organizationId = orgId;
      }
      c.set(WEB_AUTH_USER_KEY, user);
      c.get('requestContext')?.set('user', user);
      return next();
    }

    if (isNavigationRequest(path, c.req.header('Accept'))) {
      const url = new URL(c.req.url);
      const returnTo = sanitizeReturnTo(url.pathname + url.search);
      return c.redirect(`/signin?returnTo=${encodeURIComponent(returnTo)}`);
    }

    return c.json({ error: 'unauthorized' }, 401);
  };
}

/**
 * Mount web auth gating onto the web app. No-op when auth is disabled (no
 * adapter active).
 *
 * Must be called before the Mastra adapter routes, the `/web/*` routes, and
 * the static UI handlers so the gate covers every request. Composes the shared
 * `registerAuthRoutes` + `createWebAuthGate` factories so the local Hono server
 * and the platform Mastra entry stay behavior-identical.
 */
export function mountWebAuth(app: Hono<any>, options: MountWebAuthOptions = {}): boolean {
  let adapter: WebAuthAdapter | undefined;
  if (isRuntimeConfigSeeded()) {
    adapter = getSeededAuthAdapter();
  } else if (envWorkosConfigured()) {
    // Env-fallback path: construct a fresh adapter honoring the caller's
    // redirect URI, mirroring the pre-seam behavior.
    adapter = new WorkOSWebAuth({ redirectUri: options.redirectUri ?? process.env.WORKOS_REDIRECT_URI });
  }
  if (!adapter) return false;

  // Public auth routes, registered before the gate so they remain reachable
  // while unauthenticated.
  registerAuthRoutes(app, adapter);

  // Gate middleware: protects everything that is not a public `/auth/*` route.
  app.use('*', createWebAuthGate(adapter));

  return true;
}
