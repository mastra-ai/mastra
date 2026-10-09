import { MastraAuthWorkos } from '@mastra/auth-workos';
import type { MessageAuthor } from '@mastra/core/agent-controller';
import { MASTRA_MESSAGE_AUTHOR_KEY } from '@mastra/core/request-context';
import {
  registerApiRoute,
  isAuthHttpHandler,
  isCredentialsProvider,
  isOrganizationsProvider,
  isSessionProvider,
  isSSOProvider,
} from '@mastra/core/server';
import type { ApiRoute, IMastraAuthProvider, ISessionProvider } from '@mastra/core/server';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

import {
  CUSTOM_DOMAIN_UNSUPPORTED_ERROR,
  PLATFORM_AUTH_PROVIDER,
  isPlatformAuthSupportedHost,
} from './platform-auth-host.js';
import type { RouteAuth } from './routes/route.js';
import { actorFromAuthUser } from './storage/domains/comments/actor.js';
import { isFactoryTelemetryEnabled } from './telemetry.js';

const ORGANIZATION_ID_HEADER = 'X-Mastra-Organization-Id';

/**
 * Provider-neutral factory auth gating for the MastraCode web server.
 *
 * When an auth provider is active (a `MastraAuthProvider` instance passed to
 * `MastraFactory`'s `auth` slot, or — back-compat for suites/paths that never
 * boot the factory — implied by the WorkOS env vars), every route on the web
 * server is placed behind it: unauthenticated browser navigations are
 * redirected to the SPA's `/signin` page, API/XHR calls receive a 401, and a
 * small set of public routes stay reachable while signed out — the provider's
 * `/auth/*` routes plus `/auth/me`, the `/signin` page, its `/assets/*` bundle,
 * and the SPA manifest metadata. When no provider is active, `mountFactoryAuth` is a no-op and the server
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
  /** Provider-supplied profile picture URL, when the auth provider exposes one. */
  avatarUrl?: string;
  /**
   * Organization id. The org is the top-level tenant: it owns the GitHub
   * App installation and connected projects, while each user inside the org gets
   * isolated building instances. Absent for personal (no-org) accounts.
   */
  organizationId?: string;
  /** Organization ids proven by the provider's authenticated membership response. */
  organizationMembershipIds?: string[];
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

/** Hono context variables set by {@link createFactoryAfterAuth}. */
export interface FactoryAuthVariables {
  factoryAuthUser: FactoryAuthUser;
}

/** Context key under which {@link createFactoryAfterAuth} stashes the authenticated user. */
const FACTORY_AUTH_USER_KEY = 'factoryAuthUser';

/**
 * Read the authenticated user for this request, or `undefined` when
 * unauthenticated / auth disabled. Used by downstream routes (e.g. GitHub) to
 * scope rows per user. Custom routes run on a sub-app with their own Hono
 * context but share the request context, so fall back to the user
 * {@link createFactoryAfterAuth} published there.
 */
export function getFactoryAuthUser(c: Context): FactoryAuthUser | undefined {
  return (
    (c.get(FACTORY_AUTH_USER_KEY) as FactoryAuthUser | undefined) ??
    getFactoryAuthUserFromContext(c.get('requestContext') as { get: (key: string) => unknown } | undefined)
  );
}

/**
 * Read the authenticated user off a request context, normalizing whatever the
 * active auth provider put there.
 *
 * The server's auth layer writes the provider's `authenticateToken` result into
 * the request context's `user` slot verbatim, so the value's shape follows the
 * provider: WorkOS writes a flat user, better-auth writes a `{ session, user }`
 * wrapper whose org lives on the session. Reading that slot as a
 * {@link FactoryAuthUser} therefore yields `undefined` for both the id and the
 * org under better-auth, which reads as "this session belongs to somebody else"
 * at every ownership check. Normalize on the way in instead.
 */
export function getFactoryAuthUserFromContext(
  requestContext: { get: (key: string) => unknown } | undefined,
): FactoryAuthUser | undefined {
  if (!requestContext || typeof requestContext.get !== 'function') return undefined;
  return toFactoryAuthUser(requestContext.get('user')) ?? undefined;
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
 * The org rung a user's rows are keyed by: the organization they belong to, or a
 * per-user rung for personal (no-org) accounts so their rows never land in the
 * shared `local` scope. Every writer and reader of a `(org, user)` row must
 * agree on this, so it lives here rather than being re-derived per call site.
 */
export function factoryUserOrgId(user: FactoryAuthUser | undefined): string | undefined {
  const userId = getFactoryAuthUserId(user);
  if (!userId) return undefined;
  return getFactoryAuthOrgId(user) ?? `user:${userId}`;
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

function messageAuthor(user: FactoryAuthUser): MessageAuthor | undefined {
  const userId = getFactoryAuthUserId(user);
  if (!userId) return undefined;
  const actor = actorFromAuthUser(userId, user);
  return {
    id: actor.id,
    ...(actor.displayName ? { name: actor.displayName } : {}),
    ...(actor.avatarUrl ? { avatarUrl: actor.avatarUrl } : {}),
  };
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

  // Session-shaped results: { session, user }. A result carrying both halves and
  // top-level identity fields is read as session-shaped: the session half is the
  // authenticated one, and preferring it keeps the org and the id from coming
  // from two different places.
  if (record.user && typeof record.user === 'object' && record.session && typeof record.session === 'object') {
    const user = record.user as { id?: unknown; email?: unknown; name?: unknown; avatarUrl?: unknown };
    const session = record.session as { activeOrganizationId?: unknown };
    if (typeof user.id !== 'string') return null;
    return {
      id: user.id,
      email: typeof user.email === 'string' ? user.email : undefined,
      name: typeof user.name === 'string' ? user.name : undefined,
      avatarUrl: typeof user.avatarUrl === 'string' ? user.avatarUrl : undefined,
      organizationId: typeof session.activeOrganizationId === 'string' ? session.activeOrganizationId : undefined,
    };
  }

  // Flat provider users.
  const flat = record as {
    id?: unknown;
    workosId?: unknown;
    email?: unknown;
    name?: unknown;
    avatarUrl?: unknown;
    organizationId?: unknown;
    memberships?: unknown;
    memberOrgIds?: unknown;
  };
  const id = typeof flat.id === 'string' ? flat.id : undefined;
  const workosId = typeof flat.workosId === 'string' ? flat.workosId : undefined;
  if (!id && !workosId) return null;
  const membershipOrganizationIds = Array.isArray(flat.memberships)
    ? flat.memberships.flatMap(membership => {
        if (!membership || typeof membership !== 'object') return [];
        const organizationId = (membership as { organizationId?: unknown }).organizationId;
        return typeof organizationId === 'string' ? [organizationId] : [];
      })
    : [];
  const memberOrgIds = Array.isArray(flat.memberOrgIds)
    ? flat.memberOrgIds.filter((organizationId): organizationId is string => typeof organizationId === 'string')
    : [];
  const organizationMembershipIds = [...new Set([...membershipOrganizationIds, ...memberOrgIds])];
  return {
    id,
    workosId,
    email: typeof flat.email === 'string' ? flat.email : undefined,
    name: typeof flat.name === 'string' ? flat.name : undefined,
    avatarUrl: typeof flat.avatarUrl === 'string' ? flat.avatarUrl : undefined,
    organizationId: typeof flat.organizationId === 'string' ? flat.organizationId : undefined,
    organizationMembershipIds,
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

function selectRequestedOrganization(user: FactoryAuthUser, requestedOrganizationId: string): boolean {
  if (user.organizationId === requestedOrganizationId) return true;
  if (!user.organizationMembershipIds?.includes(requestedOrganizationId)) return false;
  user.organizationId = requestedOrganizationId;
  return true;
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

function forwardPendingResponseHeaders(provider: IMastraAuthProvider, c: Context): void {
  // Forward a renewed session cookie (e.g. rotated by the shared API during
  // verification) so the browser's cookie stays current. Best-effort.
  try {
    const pending = provider.consumePendingResponseHeaders?.(c.req.raw);
    for (const [name, value] of Object.entries(pending ?? {})) {
      c.header(name, value, { append: true });
    }
  } catch {
    // never fail a request over header forwarding
  }
}

/**
 * Resolve the authenticated user for a request.
 *
 * Protected routes already carry the user core route auth resolved and
 * {@link createFactoryAfterAuth} normalized, so this returns it without a
 * second provider call. Routes declared `requiresAuth: false` (the `/auth/*`
 * connect/callback flows, `/connect/slack`) skip core auth, so this reads the
 * session cookie / bearer token itself, applying the same org selection.
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
  // Public routes skip core auth, so this is their only authentication —
  // forward a renewed session cookie from here too.
  forwardPendingResponseHeaders(provider, c);
  if (!user) return undefined;

  const requestedOrganizationId = token ? c.req.header(ORGANIZATION_ID_HEADER)?.trim() : undefined;
  if (requestedOrganizationId) {
    if (!selectRequestedOrganization(user, requestedOrganizationId)) {
      throw new HTTPException(403, { message: 'organization_forbidden' });
    }
  } else {
    await ensureUserOrg(provider, user);
  }

  c.set(FACTORY_AUTH_USER_KEY, user);
  return user;
}

function isPlatformAuthCustomDomain(provider: IMastraAuthProvider, publicUrl?: string): boolean {
  return (
    provider.name === PLATFORM_AUTH_PROVIDER &&
    Boolean(publicUrl && !isPlatformAuthSupportedHost(new URL(publicUrl).hostname))
  );
}

/**
 * Handle the provider-neutral `/auth/me` route: validate the session with the
 * active provider and report the signed-in user (no tokens) to the SPA.
 * `/auth/me` is public (`requiresAuth: false`), so it validates the session
 * itself rather than reading the user core route auth would have resolved.
 */
async function handleAuthMe(provider: IMastraAuthProvider, c: Context, publicUrl?: string): Promise<Response> {
  const token = getBearerToken(c.req.header('Authorization'));
  const user = await authenticateRequest(provider, token, c.req.raw);
  forwardPendingResponseHeaders(provider, c);
  // Provider identity for the SPA: `/signin` renders the hosted-login button
  // for WorkOS and an email/password form for better-auth (with sign-up hidden
  // when the provider disables it).
  const signUpDisabled = isCredentialsProvider(provider) && provider.isSignUpEnabled?.() === false;
  const customDomainUnsupported = isPlatformAuthCustomDomain(provider, publicUrl);
  const meta = {
    provider: provider.name,
    ...(signUpDisabled ? { signUpDisabled: true } : {}),
    ...(customDomainUnsupported ? { customDomainUnsupported: true } : {}),
  };
  if (!user) {
    return c.json({ authenticated: false, user: null, ...meta });
  }
  // Resolve the org the same way protected requests do (providers cache, so this
  // is a lookup — not a create — after first bootstrap).
  await ensureUserOrg(provider, user);
  return c.json({
    authenticated: true,
    telemetryEnabled: isFactoryTelemetryEnabled(provider.name),
    user: {
      userId: getFactoryAuthUserId(user),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
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
          if (isPlatformAuthCustomDomain(provider, publicUrl)) {
            const query = new URLSearchParams({ error: CUSTOM_DOMAIN_UNSUPPORTED_ERROR });
            if (returnTo !== '/') query.set('returnTo', returnTo);
            return c.redirect(`/signin?${query.toString()}`);
          }
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
          const idpError = c.req.query('error');
          if (idpError) {
            // IdP denial (e.g. access_denied for a non-org-member): bouncing to
            // /auth/login would re-enter the IdP in a redirect loop.
            const query = new URLSearchParams({ error: idpError.slice(0, 64) });
            const description = c.req.query('error_description');
            if (description) query.set('error_description', description.slice(0, 256));
            if (returnTo !== '/') query.set('returnTo', returnTo);
            return c.redirect(`/signin?${query.toString()}`);
          }
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
 * Build the public `/auth/*` routes (provider routes + `/auth/me`) as Mastra
 * `server.apiRoutes`. All are `requiresAuth: false` (they must be reachable while
 * unauthenticated). `/auth/*` is not under `/api`, so it is a
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
      handler: c => handleAuthMe(provider, c as unknown as Context, options.publicUrl),
    }),
  ];
}

/**
 * The platform's deploy-auth flow lands IdP denials on `/login`
 * (`error=access_denied&error_description=...`); the SPA serves sign-in at
 * `/signin`, so forward the query there instead of burying it in returnTo.
 */
export function createFactoryLoginRedirect() {
  return async (c: Context, next: () => Promise<void>): Promise<Response | void> => {
    if (c.req.method === 'GET' && c.req.path === '/login') {
      return c.redirect(`/signin${new URL(c.req.url).search}`);
    }
    return next();
  };
}

/**
 * Factory's post-authentication step, mounted as `phase: 'afterAuth'` server
 * middleware so it runs after core route auth has put the provider's user on
 * the request context:
 * - a bearer caller may pick one of its organizations via
 *   `X-Mastra-Organization-Id`; a non-member selection is a 403
 *   `organization_forbidden`
 * - otherwise a no-org account gets a personal org bootstrapped
 * - the normalized user replaces the provider's on the request context, and the
 *   message author is stamped for the agent controller
 */
export function createFactoryAfterAuth(provider: IMastraAuthProvider) {
  return async (c: Context, next: () => Promise<void>): Promise<Response | void> => {
    const requestContext = c.get('requestContext');
    const user = getFactoryAuthUserFromContext(requestContext);
    if (!user) return next();

    const token = getBearerToken(c.req.header('Authorization'));
    const requestedOrganizationId = token ? c.req.header(ORGANIZATION_ID_HEADER)?.trim() : undefined;
    if (requestedOrganizationId) {
      if (!selectRequestedOrganization(user, requestedOrganizationId)) {
        return c.json({ error: 'organization_forbidden' }, 403);
      }
    } else {
      await ensureUserOrg(provider, user);
    }
    c.set(FACTORY_AUTH_USER_KEY, user);
    requestContext.set('user', user);
    requestContext.set(MASTRA_MESSAGE_AUTHOR_KEY, messageAuthor(user));
    return next();
  };
}
