import { MastraAuthWorkos } from '@mastra/auth-workos';
import {
  registerApiRoute,
  isAuthHttpHandler,
  isCredentialsProvider,
  isOrganizationsProvider,
  isSessionProvider,
  isSSOProvider,
} from '@mastra/core/server';
import type { ApiRoute, IMastraAuthProvider, ISessionProvider } from '@mastra/core/server';
import type { Context, Hono } from 'hono';

import type { RouteAuth } from './routes/route.js';

/**
 * Provider-neutral factory auth gating for the MastraCode web server.
 *
 * When an auth provider is active (a `MastraAuthProvider` instance passed to
 * `MastraFactory`'s `auth` slot, or — back-compat for suites/paths that never
 * boot the factory — implied by the WorkOS env vars), every route on the web
 * server is placed behind it: unauthenticated browser navigations are
 * redirected to the SPA's `/signin` page, API/XHR calls receive a 401, and a
 * small set of public routes stay reachable while signed out — the provider's
 * `/auth/*` routes plus `/auth/me`, the `/signin` page and its `/assets/*`
 * bundle. When no provider is active, `mountFactoryAuth` is a no-op and the server
 * behaves exactly as it does without auth.
 *
 * Provider specifics stay in the providers (`@mastra/auth-workos`,
 * `@mastra/auth-better-auth`, or any custom `IMastraAuthProvider`); this
 * module composes them capability-first via the core type guards:
 * - `authenticateToken` — session/bearer validation (all providers)
 * - `ISSOProvider` — hosted-login `/auth/login`, `/auth/callback`, `/auth/logout`
 * - `IAuthHttpHandler` — provider-owned `/auth/api/*` endpoints (better-auth)
 * - `IOrganizationsProvider` — personal-org bootstrap + admin checks
 * - `ICredentialsProvider.isSignUpEnabled` — SPA sign-up affordance
 * - `getClearSessionHeaders` — session cookie clearing on logout
 */

/** Minimal shape of the signed-in user surfaced to the SPA (no tokens). */
export interface FactoryAuthUser {
  /** Stable WorkOS user id used to scope per-user data (GitHub installs etc.). */
  workosId?: string;
  /** Provider user id; WorkOS shapes may use `workosId` instead (see {@link workosId}). */
  id?: string;
  email?: string;
  name?: string;
  /**
   * Organization id. The org is the top-level tenant: it owns the GitHub
   * App installation and connected projects, while each user inside the org gets
   * isolated building instances. Absent for personal (no-org) accounts.
   */
  organizationId?: string;
}

/**
 * Tenant identity: the org is the top-level tenant, and each user inside it is
 * an isolated builder. Agent state, worktrees and sandboxes are scoped per
 * `(orgId, userId)`. Personal (no-org) users have `orgId === undefined`.
 */
export interface FactoryAuthTenant {
  /** Organization id, or `undefined` for personal (no-org) accounts. */
  orgId?: string;
  /** Stable provider user id. */
  userId: string;
}

/**
 * Validate that a `returnTo` value is a safe same-site path, to prevent
 * open-redirect attacks. Only absolute local paths (`/foo`) are allowed;
 * protocol-relative (`//evil.com`) and absolute URLs are rejected.
 */
export function sanitizeReturnTo(raw: string | undefined): string {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  // Reject protocol-relative URLs like "//evil.com" and "/\evil.com".
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

/** Extract a bearer token from the Authorization header, if present. */
export function getBearerToken(authorization: string | undefined): string {
  if (!authorization) return '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1] ?? '';
}

/**
 * Whether the SPA is served cross-origin from this API (platform deploy). When
 * `MASTRACODE_ALLOWED_ORIGINS` is set the browser talks to us cross-site, so
 * session cookies must be `SameSite=None; Secure` for the browser to send them.
 * Same-origin local dev leaves this unset and keeps the stricter `SameSite=Lax`.
 */
export function isCrossSiteAuth(): boolean {
  return Boolean(process.env.MASTRACODE_ALLOWED_ORIGINS?.trim());
}

/** Hono context variables set by the auth gate. */
export interface FactoryAuthVariables {
  factoryAuthUser: FactoryAuthUser;
}

/** Context key under which the gate stashes the authenticated user. */
const FACTORY_AUTH_USER_KEY = 'factoryAuthUser';

/**
 * Read the authenticated user the gate stashed on the context, or
 * `undefined` when unauthenticated / auth disabled. Used by downstream routes
 * (e.g. GitHub) to scope rows per user.
 */
export function getFactoryAuthUser(c: Context): FactoryAuthUser | undefined {
  return c.get(FACTORY_AUTH_USER_KEY) as FactoryAuthUser | undefined;
}

/** Resolve the stable user id from an authenticated user shape. */
export function getFactoryAuthUserId(user: FactoryAuthUser | undefined): string | undefined {
  return user?.workosId ?? user?.id;
}

/** Resolve the organization id from a user shape, if present. */
export function getFactoryAuthOrgId(user: FactoryAuthUser | undefined): string | undefined {
  return user?.organizationId;
}

/**
 * Resolve the tenant identity `(orgId, userId)` from the authenticated user on
 * the context. Returns `undefined` when there is no signed-in user (auth
 * disabled or unauthenticated). `orgId` is `undefined` for personal accounts;
 * callers gate org-scoped GitHub features on its presence while agent state
 * falls back to a user-only tenant.
 */
export function factoryAuthTenant(c: Context): FactoryAuthTenant | undefined {
  const user = getFactoryAuthUser(c);
  const userId = getFactoryAuthUserId(user);
  if (!userId) return undefined;
  return { orgId: getFactoryAuthOrgId(user), userId };
}

/** True when both WorkOS credential env vars are present (legacy env gate). */
function envWorkosConfigured(): boolean {
  return Boolean(process.env.WORKOS_API_KEY && process.env.WORKOS_CLIENT_ID);
}

/**
 * WorkOS provider implied by the `WORKOS_*` env vars — back-compat for test
 * suites exercised without booting the factory (route suites set `WORKOS_*`
 * directly and call {@link mountFactoryAuth} without an explicit provider).
 * `fetchMemberships: true` lets `authenticateToken` resolve `organizationId`
 * from a single membership when the JWT has no org claim — required so a
 * bootstrapped personal org resolves without re-auth.
 */
function envFallbackAuthProvider(redirectUri: string | undefined): MastraAuthWorkos | undefined {
  if (!envWorkosConfigured()) return undefined;
  return new MastraAuthWorkos({
    redirectUri: redirectUri ?? process.env.WORKOS_REDIRECT_URI,
    fetchMemberships: true,
  });
}

/**
 * Map a provider `authenticateToken` result onto the neutral SPA user shape.
 *
 * Two result families exist today:
 * - flat provider users (WorkOS `WorkOSUser` et al.): `id`/`workosId`/`email`/
 *   `name`/`organizationId` directly on the object;
 * - session-shaped results (better-auth `BetterAuthUser`): `{ session, user }`
 *   with the active org on the session.
 */
function toFactoryAuthUser(result: unknown): FactoryAuthUser | null {
  if (!result || typeof result !== 'object') return null;
  const record = result as Record<string, unknown>;

  // Session-shaped results: { session, user }.
  if (record.user && typeof record.user === 'object' && record.session && typeof record.session === 'object') {
    const user = record.user as { id?: unknown; email?: unknown; name?: unknown };
    const session = record.session as { activeOrganizationId?: unknown };
    if (typeof user.id !== 'string') return null;
    return {
      id: user.id,
      email: typeof user.email === 'string' ? user.email : undefined,
      name: typeof user.name === 'string' ? user.name : undefined,
      organizationId: typeof session.activeOrganizationId === 'string' ? session.activeOrganizationId : undefined,
    };
  }

  // Flat provider users.
  const flat = record as {
    id?: unknown;
    workosId?: unknown;
    email?: unknown;
    name?: unknown;
    organizationId?: unknown;
  };
  const id = typeof flat.id === 'string' ? flat.id : undefined;
  const workosId = typeof flat.workosId === 'string' ? flat.workosId : undefined;
  if (!id && !workosId) return null;
  return {
    id,
    workosId,
    email: typeof flat.email === 'string' ? flat.email : undefined,
    name: typeof flat.name === 'string' ? flat.name : undefined,
    organizationId: typeof flat.organizationId === 'string' ? flat.organizationId : undefined,
  };
}

/**
 * Resolve the authenticated user for a request via the provider. Never throws:
 * ordinary invalid/expired sessions resolve to `null`.
 */
async function authenticateRequest(
  provider: IMastraAuthProvider,
  token: string,
  raw: Request,
): Promise<FactoryAuthUser | null> {
  try {
    const result = await provider.authenticateToken(token, raw);
    return toFactoryAuthUser(result);
  } catch {
    return null;
  }
}

/**
 * Bootstrap a personal org for no-org accounts so org-scoped features (GitHub
 * connect) work without leaving the app. Mutates the resolved user so the
 * current request sees the org immediately; subsequent requests resolve it via
 * the provider's own session/membership lookup (providers cache internally).
 * Best-effort: providers swallow their own bootstrap failures, and any
 * unexpected throw leaves the user no-org.
 */
async function ensureUserOrg(provider: IMastraAuthProvider, user: FactoryAuthUser): Promise<void> {
  if (getFactoryAuthOrgId(user)) return;
  if (!isOrganizationsProvider(provider)) return;
  const userId = getFactoryAuthUserId(user);
  if (!userId) return;
  try {
    const orgId = await provider.ensureOrganization(userId);
    if (orgId) user.organizationId = orgId;
  } catch {
    // Best-effort: the user stays no-org until a later request succeeds.
  }
}

/**
 * `Set-Cookie` values that clear the provider's session cookie(s), from the
 * provider's (possibly partial) `ISessionProvider.getClearSessionHeaders`.
 */
function providerClearCookies(provider: IMastraAuthProvider): string[] {
  const getClearSessionHeaders = (provider as Partial<ISessionProvider>).getClearSessionHeaders;
  if (typeof getClearSessionHeaders !== 'function') return [];
  const headers = getClearSessionHeaders.call(provider) ?? {};
  const setCookie = headers['Set-Cookie'];
  if (!setCookie) return [];
  // A provider may join several clearing cookies into one header value.
  return setCookie.split(/,(?=\s*[^;=,\s]+=)/).map(cookie => cookie.trim());
}

/**
 * Fail-closed authorization for organization-level administrative mutations.
 * The caller must belong to the same active organization and the provider must
 * explicitly confirm an admin/owner role.
 */
export async function isOrganizationAdmin(
  provider: IMastraAuthProvider | undefined,
  c: Context,
  organizationId: string,
): Promise<boolean> {
  const user = await ensureFactoryAuthUser(provider, c);
  if (!user || user.organizationId !== organizationId || !provider || !isOrganizationsProvider(provider)) {
    return false;
  }
  const userId = getFactoryAuthUserId(user);
  if (!userId) return false;
  try {
    return await provider.isOrganizationAdmin(organizationId, userId);
  } catch {
    return false;
  }
}

/**
 * Build the factory's implementation of the `RouteAuth` seam over the
 * resolved provider (`undefined` = auth disabled). Constructed once per boot
 * by `MastraFactory.prepare()` and handed to factory route modules at
 * construction — they never import the factory auth module directly.
 */
export function createFactoryRouteAuth(provider: IMastraAuthProvider | undefined): RouteAuth {
  return {
    enabled: () => provider !== undefined,
    ensureUser: (c: Context) => ensureFactoryAuthUser(provider, c),
    tenant: (c: Context) => factoryAuthTenant(c),
    isOrganizationAdmin: (c: Context, organizationId: string) => isOrganizationAdmin(provider, c, organizationId),
  };
}

/** True when the given provider is WorkOS. Gates WorkOS-only capabilities. */
export function isWorkOSAuth(provider: IMastraAuthProvider | undefined): boolean {
  return provider instanceof MastraAuthWorkos;
}

/**
 * The raw WorkOS provider, for features that need the WorkOS client directly
 * (audit-log export, Admin Portal links). Callers must gate on
 * {@link isWorkOSAuth} first — throws when the provider is not WorkOS.
 */
export function getWorkOSProvider(provider: IMastraAuthProvider | undefined): MastraAuthWorkos {
  if (provider instanceof MastraAuthWorkos) return provider;
  throw new Error('WorkOS provider requested but the active factory auth provider is not WorkOS');
}

/**
 * Resolve the authenticated user for a request, stashing it on the context.
 *
 * The gate only authenticates non-`/auth/*` requests via the `Authorization`
 * header, so cookie-based browser navigations to public `/auth/*` routes (the
 * GitHub connect/callback flow) arrive without a gate-stashed user. This reads
 * the session cookie from the raw request the same way `/auth/me` does,
 * caches the result on the context, and returns it so downstream helpers like
 * {@link factoryAuthTenant} work uniformly on both gated and public routes.
 *
 * Returns `undefined` when there is no valid session (or auth is disabled).
 */
export async function ensureFactoryAuthUser(
  provider: IMastraAuthProvider | undefined,
  c: Context,
): Promise<FactoryAuthUser | undefined> {
  const existing = getFactoryAuthUser(c);
  if (existing) return existing;
  if (!provider) return undefined;

  const token = getBearerToken(c.req.header('Authorization'));
  const user = await authenticateRequest(provider, token, c.req.raw);
  if (!user) return undefined;

  await ensureUserOrg(provider, user);

  c.set(FACTORY_AUTH_USER_KEY, user);
  return user;
}

export interface MountFactoryAuthOptions {
  /**
   * Explicit auth provider to mount. When omitted, falls back to a WorkOS
   * provider implied by the `WORKOS_*` env vars (back-compat for suites that
   * never boot the factory).
   */
  provider?: IMastraAuthProvider;
  /**
   * Absolute URL the identity provider redirects back to after login (WorkOS
   * env-fallback path only). Defaults to the `WORKOS_REDIRECT_URI` env var.
   */
  redirectUri?: string;
  /** Browser-facing origin used to derive the SSO callback URL. */
  publicUrl?: string;
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
 * active provider and report the signed-in user (no tokens) to the SPA.
 * `/auth/me` is public (the gate skips `/auth/*`), so it validates the session
 * itself rather than reading a value the gate would have stashed.
 */
async function handleAuthMe(provider: IMastraAuthProvider, c: Context): Promise<Response> {
  const token = getBearerToken(c.req.header('Authorization'));
  const user = await authenticateRequest(provider, token, c.req.raw);
  // Provider identity for the SPA: `/signin` renders the hosted-login button
  // for WorkOS and an email/password form for better-auth (with sign-up hidden
  // when the provider disables it).
  const signUpDisabled = isCredentialsProvider(provider) && provider.isSignUpEnabled?.() === false;
  const meta = { provider: provider.name, ...(signUpDisabled ? { signUpDisabled: true } : {}) };
  if (!user) {
    return c.json({ authenticated: false, user: null, ...meta });
  }
  // Resolve the org the same way gated requests do (providers cache, so this
  // is a lookup — not a create — after first bootstrap).
  await ensureUserOrg(provider, user);
  return c.json({
    authenticated: true,
    user: {
      userId: getFactoryAuthUserId(user),
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
    },
    ...meta,
  });
}

/**
 * Encode a validated returnTo path into the OAuth `state` parameter.
 *
 * Pipe format (`uuid|encodedPath`) is the contract `MastraAuthStudio` parses
 * to forward the path as the platform's `post_login_redirect`; a JSON blob
 * here silently degrades every post-login redirect to `/`.
 */
function encodeState(returnTo: string): string {
  return `${crypto.randomUUID()}|${encodeURIComponent(returnTo)}`;
}

/** Decode the OAuth `state` parameter back into a sanitized returnTo path. */
function decodeState(state: string | undefined): string {
  if (!state) return '/';
  const pipeIndex = state.indexOf('|');
  if (pipeIndex !== -1) {
    try {
      return sanitizeReturnTo(decodeURIComponent(state.slice(pipeIndex + 1)));
    } catch {
      return '/';
    }
  }
  return '/';
}

/**
 * Short-lived cookie stashing the post-login destination across the hosted
 * OAuth round-trip. Providers/platforms differ in whether they echo `state`
 * back to the callback, so the cookie is the reliable channel; `state` (when
 * echoed) takes precedence only if the cookie is missing.
 */
const RETURN_TO_COOKIE = 'mastra_factory_return_to';

function returnToCookieHeader(returnTo: string): string {
  const crossSite = isCrossSiteAuth() ? '; SameSite=None; Secure' : '; SameSite=Lax';
  return `${RETURN_TO_COOKIE}=${encodeURIComponent(returnTo)}; Path=/; Max-Age=600; HttpOnly${crossSite}`;
}

function clearReturnToCookieHeader(): string {
  const crossSite = isCrossSiteAuth() ? '; SameSite=None; Secure' : '; SameSite=Lax';
  return `${RETURN_TO_COOKIE}=; Path=/; Max-Age=0; HttpOnly${crossSite}`;
}

function readReturnToCookie(c: Context): string | undefined {
  const header = c.req.header('Cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === RETURN_TO_COOKIE) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/** HTTP methods supported for public auth routes. */
type AuthRouteMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';

/** A public `/auth/*` route derived from the provider's capabilities. */
interface AuthRouteSpec {
  path: string;
  method: AuthRouteMethod;
  handler: (c: Context) => Response | Promise<Response>;
}

/**
 * Derive the public `/auth/*` routes from the provider's capabilities:
 *
 * - `IAuthHttpHandler` → `ALL /auth/api/*` proxy to the provider's own HTTP
 *   surface (better-auth sign-in/up/out/session — what the SPA's
 *   email/password form posts to).
 * - `ISSOProvider` → hosted-login `GET /auth/login` / `GET /auth/callback` /
 *   `GET /auth/logout` (returnTo preserved through the OAuth `state` param).
 * - handler-shaped, non-SSO providers → `GET /auth/login` redirects to the
 *   SPA's `/signin` form, `GET /auth/logout` revokes via the provider's
 *   sign-out endpoint and clears the session cookie.
 */
function providerAuthRoutes(provider: IMastraAuthProvider, publicUrl?: string): AuthRouteSpec[] {
  const routes: AuthRouteSpec[] = [];

  if (isAuthHttpHandler(provider)) {
    routes.push({
      path: '/auth/api/*',
      method: 'ALL',
      handler: c => provider.handleAuthRequest(c.req.raw),
    });
  }

  if (isSSOProvider(provider)) {
    routes.push(
      {
        path: '/auth/login',
        method: 'GET',
        handler: async c => {
          const returnTo = sanitizeReturnTo(c.req.query('returnTo'));
          const state = encodeState(returnTo);
          // Build the callback URL from the browser-facing public origin so
          // the OAuth round-trip lands back on the SPA's origin (in dev the
          // SPA is on :5173 and Vite proxies /auth/* to the API on :4111 —
          // deriving from c.req.url would use :4111 and the post-callback
          // redirect to `/` would miss the SPA). Providers that ignore the
          // caller's URI in favor of their own config (e.g. MastraAuthWorkos
          // with an explicit `redirectUri` option) still take precedence.
          const redirectUri = publicUrl ? new URL('/auth/callback', publicUrl).toString() : '';
          const loginUrl = await provider.getLoginUrl(redirectUri, state);
          for (const cookie of (await provider.getLoginCookies?.(redirectUri, state)) ?? []) {
            c.header('Set-Cookie', cookie, { append: true });
          }
          // Stash the destination in a cookie too: not every provider/platform
          // echoes `state` back to the callback.
          if (returnTo !== '/') {
            c.header('Set-Cookie', returnToCookieHeader(returnTo), { append: true });
          }
          return c.redirect(loginUrl);
        },
      },
      {
        path: '/auth/callback',
        method: 'GET',
        handler: async c => {
          const code = c.req.query('code');
          const stateReturnTo = decodeState(c.req.query('state'));
          const cookieReturnTo = sanitizeReturnTo(readReturnToCookie(c));
          const returnTo = cookieReturnTo !== '/' ? cookieReturnTo : stateReturnTo;
          c.header('Set-Cookie', clearReturnToCookieHeader(), { append: true });
          if (!code) {
            return c.redirect('/auth/login');
          }
          try {
            const result = await provider.handleCallback(code, c.req.query('state') ?? '');
            if (result.cookies?.length) {
              // Provider populated cookies directly (e.g. WorkOS AuthKit builds
              // its own sealed session cookie inside handleCallback).
              for (const cookie of result.cookies) {
                c.header('Set-Cookie', cookie, { append: true });
              }
            } else if (isSessionProvider(provider) && result.tokens) {
              // Fallback for providers that expose ISessionProvider but leave
              // cookie construction to the server (e.g. MastraAuthStudio, which
              // returns just the sealed session as accessToken so
              // getSessionHeaders can scope the cookie to this deployment's
              // domain via MASTRA_COOKIE_DOMAIN / sharedApiUrl auto-detection).
              // Mirrors packages/server/src/server/handlers/auth.ts:492-503.
              const resultUser = result.user as { id: string; organizationId?: string };
              const session = await provider.createSession(resultUser.id, {
                accessToken: result.tokens.accessToken,
                refreshToken: result.tokens.refreshToken,
                expiresAt: result.tokens.expiresAt,
                organizationId: resultUser.organizationId,
              });
              for (const [key, value] of Object.entries(provider.getSessionHeaders(session))) {
                c.header(key, value, { append: true });
              }
            }
            return c.redirect(returnTo);
          } catch {
            // Code exchange failed (expired/replayed code, misconfig). Send the
            // user back to login rather than surfacing a raw error.
            return c.redirect('/auth/login');
          }
        },
      },
      {
        path: '/auth/logout',
        method: 'GET',
        handler: async c => {
          let logoutUrl: string | null = null;
          try {
            logoutUrl = (await provider.getLogoutUrl?.('/', c.req.raw)) ?? null;
          } catch {
            logoutUrl = null;
          }
          // Clear the session cookie regardless of whether the provider
          // returned a logout URL.
          for (const cookie of providerClearCookies(provider)) {
            c.header('Set-Cookie', cookie, { append: true });
          }
          return c.redirect(logoutUrl ?? '/');
        },
      },
    );
  } else if (isAuthHttpHandler(provider)) {
    routes.push(
      {
        // Hosted-login equivalent: no hosted page, so send the browser to the
        // SPA's /signin form, preserving returnTo.
        path: '/auth/login',
        method: 'GET',
        handler: c => {
          const returnTo = sanitizeReturnTo(c.req.query('returnTo'));
          return c.redirect(`/signin?returnTo=${encodeURIComponent(returnTo)}`);
        },
      },
      {
        path: '/auth/logout',
        method: 'GET',
        handler: async c => {
          // Revoke the session server-side through the provider's own sign-out
          // endpoint and forward its clearing cookies; fall back to our clear
          // cookies regardless.
          try {
            const origin = new URL(c.req.url).origin;
            const response = await provider.handleAuthRequest(
              new Request(`${origin}/auth/api/sign-out`, { method: 'POST', headers: c.req.raw.headers }),
            );
            for (const cookie of response.headers.getSetCookie()) {
              c.header('Set-Cookie', cookie, { append: true });
            }
          } catch {
            // No/invalid session: nothing to revoke.
          }
          for (const cookie of providerClearCookies(provider)) {
            c.header('Set-Cookie', cookie, { append: true });
          }
          return c.redirect('/');
        },
      },
    );
  }

  return routes;
}

/**
 * Register the public `/auth/*` routes on a Hono app: the capability-derived
 * provider routes (login/callback/logout/provider APIs) plus the
 * provider-neutral `/auth/me`. Split out from `mountFactoryAuth` so both the local
 * Hono server and the platform Mastra entry can reuse the exact same handlers.
 */
export function registerAuthRoutes(
  app: Hono<any>,
  provider: IMastraAuthProvider,
  options: { publicUrl?: string } = {},
): void {
  for (const route of providerAuthRoutes(provider, options.publicUrl)) {
    const methods = route.method === 'ALL' ? ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] : [route.method];
    app.on(methods, route.path, c => route.handler(c));
  }
  app.get('/auth/me', c => handleAuthMe(provider, c));
}

/**
 * Build the public `/auth/*` routes (provider routes + `/auth/me`) as Mastra
 * `server.apiRoutes`. Used by the platform Mastra entry (`src/mastra/index.ts`),
 * which can't register plain Hono routes on the deployer-generated app the way
 * the local server does via {@link registerAuthRoutes}.
 *
 * Handlers are identical to {@link registerAuthRoutes}. All are `requiresAuth: false`
 * (they must be reachable while unauthenticated), and the gate middleware skips
 * `/auth/*` so it never blocks them. `/auth/*` is not under `/api`, so it is a
 * valid custom-route path.
 */
export function buildAuthRoutes(provider: IMastraAuthProvider, options: { publicUrl?: string } = {}): ApiRoute[] {
  return [
    // `registerApiRoute` handlers see @mastra/core's bundled hono Context type,
    // which is structurally identical to (but nominally distinct from) the
    // local hono version the route handlers are typed against — cast across
    // the seam.
    ...providerAuthRoutes(provider, options.publicUrl).map(route =>
      registerApiRoute(route.path, {
        method: route.method,
        requiresAuth: false,
        handler: c => route.handler(c as unknown as Context),
      }),
    ),
    registerApiRoute('/auth/me', {
      method: 'GET',
      requiresAuth: false,
      handler: c => handleAuthMe(provider, c as unknown as Context),
    }),
  ];
}

/**
 * Build the auth gate as a plain Hono middleware handler `(c, next)`. Protects
 * everything that is not a public `/auth/*` route: authenticated requests stash
 * the user on the context and continue; unauthenticated navigations redirect to
 * login and XHR/API calls get a 401 JSON. Shared by the local Hono server
 * (`mountFactoryAuth`) and the platform Mastra entry (`server.middleware`).
 */
export function createFactoryAuthGate(provider: IMastraAuthProvider) {
  return async (c: Context, next: () => Promise<void>): Promise<Response | void> => {
    const path = c.req.path;
    if (path.startsWith('/auth/')) {
      return next();
    }
    if (c.req.method === 'POST' && path === '/web/github/webhook') {
      return next();
    }
    // The Slack account-linking deep link and the Sign-in-with-Slack OIDC
    // start/callback do their own auth (friendly login-redirect for signed-out
    // visitors; the OIDC callback authenticates via its signed `state`) — see
    // connect-route.ts.
    if (c.req.method === 'GET' && (path === '/connect/slack' || path.startsWith('/connect/slack/'))) {
      return next();
    }
    // The SPA sign-in page and the static bundle it needs must be reachable
    // while signed out; no user is stashed, so `/api/*` stays protected.
    if (path === '/signin' || path.startsWith('/assets/')) {
      return next();
    }

    const token = getBearerToken(c.req.header('Authorization'));
    const user = await authenticateRequest(provider, token, c.req.raw);

    if (user) {
      // Bootstrap a personal org for no-org accounts so the org id resolves on
      // this request (see ensureFactoryAuthUser for the rationale).
      await ensureUserOrg(provider, user);
      c.set(FACTORY_AUTH_USER_KEY, user);
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
 * Mount factory auth gating onto the host app. No-op when auth is disabled
 * (no provider active).
 *
 * Must be called before the Mastra adapter routes, the `/web/*` routes, and
 * the static UI handlers so the gate covers every request. Composes the shared
 * `registerAuthRoutes` + `createFactoryAuthGate` factories so the local Hono server
 * and the platform Mastra entry stay behavior-identical.
 */
export function mountFactoryAuth(app: Hono<any>, options: MountFactoryAuthOptions = {}): boolean {
  const provider = options.provider ?? envFallbackAuthProvider(options.redirectUri);
  if (!provider) return false;

  registerAuthRoutes(app, provider, { publicUrl: options.publicUrl });
  app.use('*', createFactoryAuthGate(provider));
  return true;
}
