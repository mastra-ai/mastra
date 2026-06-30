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
  /**
   * WorkOS organization id. The org is the top-level tenant: it owns the GitHub
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
export interface WebAuthTenant {
  /** WorkOS organization id, or `undefined` for personal (no-org) accounts. */
  orgId?: string;
  /** Stable WorkOS user id. */
  userId: string;
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

/** Resolve the WorkOS organization id from a user shape, if present. */
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

/**
 * Lazily-created provider used to authenticate session cookies on public
 * `/auth/*` routes that the gate skips (e.g. the GitHub connect/callback
 * navigations). Kept module-level so callers outside `mountWebAuth` — such as
 * the GitHub routes, which are mounted on a separate sub-app — can reuse it.
 */
let sessionProvider: MastraAuthWorkos | undefined;

function getSessionProvider(): MastraAuthWorkos {
  if (!sessionProvider) {
    sessionProvider = new MastraAuthWorkos({
      redirectUri: process.env.WORKOS_REDIRECT_URI,
      // Resolve `organizationId` from a single membership when the JWT lacks the
      // claim. This is what lets a freshly bootstrapped personal org take effect
      // on the next request without forcing a re-login.
      fetchMemberships: true,
    });
  }
  return sessionProvider;
}

/** Build a predictable personal-org name from the user's profile. */
function personalOrgName(user: WebAuthUser, userId: string): string {
  const label = user.email ?? user.name ?? userId;
  return `${label}'s org`;
}

/** Pull a stable error code out of a WorkOS SDK error, if present. */
function workosErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const e = error as { code?: unknown; rawData?: { code?: unknown } };
  if (typeof e.code === 'string') return e.code;
  if (e.rawData && typeof e.rawData.code === 'string') return e.rawData.code;
  return undefined;
}

/**
 * True when `createOrganization` rejected because an org is already bound to
 * this `externalId` — i.e. a prior bootstrap created the org but never attached
 * the membership. The org can be recovered via `getOrganizationByExternalId`.
 */
function isExternalIdAlreadyUsed(error: unknown): boolean {
  return workosErrorCode(error) === 'external_id_already_used';
}

/**
 * True when `createOrganizationMembership` rejected because the user is already
 * a member of the org. Safe to ignore: the desired end state already holds.
 */
function isMembershipAlreadyExists(error: unknown): boolean {
  const code = workosErrorCode(error);
  return code === 'organization_membership_already_exists' || code === 'entity_already_exists';
}

/**
 * Ensure the authenticated user belongs to a WorkOS organization, creating a
 * personal org on first use when they have none.
 *
 * The `organizationId` we need for org-scoped GitHub features lives in the
 * WorkOS session, not our app DB, so personal (no-org) accounts otherwise dead
 * end at `organization_required`. This puts the user into a real WorkOS org:
 *
 * - If the user already has an `organizationId` → no-op, return it.
 * - Else list their memberships:
 *   - ≥1 membership → return the first org id (they already belong somewhere;
 *     we never auto-create when a membership exists).
 *   - 0 memberships → create a personal org + membership and return its id.
 *
 * Idempotency: the create call carries `externalId = workosId` and a stable
 * `idempotencyKey`, so concurrent/retried first logins never create duplicate
 * personal orgs. If a prior run created the org but never attached the
 * membership, the create rejects with `external_id_already_used`; we recover the
 * existing org by `externalId` and (re)attach the membership instead of failing.
 *
 * Best-effort: any WorkOS error (e.g. API key lacking org-create permission) is
 * swallowed and returns `undefined`, leaving the user in their no-org state
 * rather than failing the request. Callers keep the existing
 * `organization_required` behavior in that case.
 */
export async function ensureUserHasOrganization(
  provider: MastraAuthWorkos,
  user: WebAuthUser,
): Promise<string | undefined> {
  const existingOrg = getWebAuthOrgId(user);
  if (existingOrg) return existingOrg;

  const userId = getWebAuthUserId(user);
  if (!userId) return undefined;

  try {
    const workos = provider.getWorkOS();

    const memberships = await workos.userManagement
      .listOrganizationMemberships({ userId })
      .then(page => page.autoPagination());

    const firstExisting = memberships.find(m => m.organizationId)?.organizationId;
    if (firstExisting) return firstExisting;

    // Create the personal org. A prior partial bootstrap (org created, but the
    // membership step never landed) leaves an org already bound to this
    // externalId, so the create 400s with `external_id_already_used`. Recover by
    // looking the existing org up by externalId instead of dead-ending forever.
    let organizationId: string;
    try {
      const organization = await workos.organizations.createOrganization(
        {
          name: personalOrgName(user, userId),
          externalId: userId,
          metadata: { mastracodePersonalOrg: 'true', workosUserId: userId },
        },
        { idempotencyKey: `mastracode-personal-org:${userId}` },
      );
      organizationId = organization.id;
    } catch (error) {
      if (!isExternalIdAlreadyUsed(error)) throw error;
      const existing = await workos.organizations.getOrganizationByExternalId(userId);
      organizationId = existing.id;
    }

    // Idempotently attach the user. If they are already a member (e.g. the org
    // existed from a prior run), tolerate the conflict and keep the org id.
    try {
      await workos.userManagement.createOrganizationMembership({ organizationId, userId });
    } catch (error) {
      if (!isMembershipAlreadyExists(error)) throw error;
    }

    return organizationId;
  } catch (error) {
    console.warn(
      `[WorkOS] Failed to bootstrap personal organization for user ${userId}. ` +
        'The user will see organization_required until this succeeds. ' +
        'Ensure the WorkOS API key can create organizations/memberships.',
      error,
    );
    return undefined;
  }
}

/**
 * Resolve the authenticated user for a request, stashing it on the context.
 *
 * The gate only authenticates non-`/auth/*` requests via the `Authorization`
 * header, so cookie-based browser navigations to public `/auth/*` routes (the
 * GitHub connect/callback flow) arrive without a gate-stashed user. This reads
 * the WorkOS session cookie from the raw request the same way `/auth/me` does,
 * caches the result on the context, and returns it so downstream helpers like
 * {@link webAuthTenant} work uniformly on both gated and public routes.
 *
 * Returns `undefined` when there is no valid session (or auth is disabled).
 */
export async function ensureWebAuthUser(c: Context): Promise<WebAuthUser | undefined> {
  const existing = getWebAuthUser(c);
  if (existing) return existing;
  if (!isWebAuthEnabled()) return undefined;

  const token = getBearerToken(c.req.header('Authorization'));
  let user: WebAuthUser | null = null;
  try {
    user = (await getSessionProvider().authenticateToken(token, c.req.raw)) as WebAuthUser | null;
  } catch {
    user = null;
  }
  if (!user) return undefined;

  // Bootstrap a personal org for no-org accounts so org-scoped features (GitHub
  // connect) work without leaving the app. Mutating the resolved user lets the
  // current request see the org immediately; subsequent requests resolve it via
  // the provider's single-membership fallback (`fetchMemberships: true`).
  if (!getWebAuthOrgId(user)) {
    const orgId = await ensureUserHasOrganization(getSessionProvider(), user);
    if (orgId) user.organizationId = orgId;
  }

  c.set(WEB_AUTH_USER_KEY, user);
  return user;
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
  // `fetchMemberships: true` lets `authenticateToken` resolve `organizationId`
  // from a single membership when the JWT has no org claim — required so a
  // bootstrapped personal org resolves without re-auth.
  const provider = new MastraAuthWorkos({ redirectUri, fetchMemberships: true });

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
    return c.json({
      authenticated: true,
      user: { email: user.email, name: user.name, organizationId: user.organizationId },
    });
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
      // Bootstrap a personal org for no-org accounts so the org id resolves on
      // this request (see ensureWebAuthUser for the rationale).
      if (!getWebAuthOrgId(user)) {
        const orgId = await ensureUserHasOrganization(provider, user);
        if (orgId) user.organizationId = orgId;
      }
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
