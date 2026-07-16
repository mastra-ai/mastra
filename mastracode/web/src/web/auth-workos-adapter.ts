import { MastraAuthWorkos } from '@mastra/auth-workos';

import type { AuthRouteSpec, WebAuthAdapter, WebAuthAdapterInitContext, WebAuthUser } from './auth-adapter.js';
import { isCrossSiteAuth, sanitizeReturnTo } from './auth-adapter.js';

/**
 * WorkOS AuthKit implementation of {@link WebAuthAdapter}.
 *
 * The actual AuthKit session encryption, code exchange and token validation
 * are delegated to the existing `@mastra/auth-workos` provider
 * (`MastraAuthWorkos`), which reads its own `WORKOS_API_KEY` /
 * `WORKOS_CLIENT_ID` credentials. The deploy entry constructs this adapter
 * only when those env vars are set.
 */

export interface WorkOSWebAuthOptions {
  /**
   * Absolute URL WorkOS redirects back to after login. Must match an allowed
   * redirect URI configured in the WorkOS dashboard. When omitted, `init()`
   * derives `<publicUrl>/auth/callback` from the factory context.
   */
  redirectUri?: string;
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
  const existingOrg = user.organizationId;
  if (existingOrg) return existingOrg;

  const userId = user.workosId ?? user.id;
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

export class WorkOSWebAuth implements WebAuthAdapter {
  readonly kind = 'workos';

  #redirectUri: string | undefined;
  #provider: MastraAuthWorkos | undefined;

  constructor(options: WorkOSWebAuthOptions = {}) {
    this.#redirectUri = options.redirectUri;
  }

  /**
   * Shared WorkOS auth provider, exposed for features that need the raw WorkOS
   * client (audit-log export, Admin Portal links). Constructed lazily so the
   * adapter can be created before `init()` finalizes the redirect URI.
   * `fetchMemberships: true` lets `authenticateToken` resolve `organizationId`
   * from a single membership when the JWT has no org claim — required so a
   * bootstrapped personal org resolves without re-auth.
   */
  get provider(): MastraAuthWorkos {
    if (!this.#provider) {
      this.#provider = new MastraAuthWorkos({ redirectUri: this.#redirectUri, fetchMemberships: true });
    }
    return this.#provider;
  }

  async init(ctx: WebAuthAdapterInitContext): Promise<void> {
    if (!this.#redirectUri && ctx.publicUrl) {
      this.#redirectUri = `${ctx.publicUrl}/auth/callback`;
    }
    // Fail the deploy at prepare() rather than handing WorkOS an empty
    // redirect URI on the first /auth/login (which breaks hosted login for
    // every user with an opaque provider error).
    if (!this.#redirectUri) {
      throw new Error(
        'WorkOSWebAuth could not resolve a callback URL: pass `redirectUri` (WORKOS_REDIRECT_URI) or configure the MastraFactory `publicUrl` slot.',
      );
    }
  }

  async authenticate(token: string, raw: Request): Promise<WebAuthUser | null> {
    return (await this.provider.authenticateToken(token, raw)) as WebAuthUser | null;
  }

  async ensureOrg(user: WebAuthUser): Promise<string | undefined> {
    return ensureUserHasOrganization(this.provider, user);
  }

  /**
   * Cookie string that clears the WorkOS session. Matches the `SameSite`/`Secure`
   * attributes of the session cookie so the browser actually overwrites it: a
   * `SameSite=None; Secure` session cookie can only be cleared by a clear cookie
   * with the same attributes. See {@link isCrossSiteAuth}.
   */
  sessionClearCookie(): string {
    const sameSite = isCrossSiteAuth() ? 'None; Secure' : 'Lax';
    return `wos_session=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0`;
  }

  /** The public hosted-login routes: `/auth/login`, `/auth/callback`, `/auth/logout`. */
  publicRoutes(): AuthRouteSpec[] {
    return [
      {
        path: '/auth/login',
        method: 'GET',
        handler: c => {
          const returnTo = sanitizeReturnTo(c.req.query('returnTo'));
          const loginUrl = this.provider.getLoginUrl(this.#redirectUri ?? '', encodeState(returnTo));
          return c.redirect(loginUrl);
        },
      },
      {
        path: '/auth/callback',
        method: 'GET',
        handler: async c => {
          const code = c.req.query('code');
          const returnTo = decodeState(c.req.query('state'));
          if (!code) {
            return c.redirect('/auth/login');
          }
          try {
            const result = await this.provider.handleCallback(code, c.req.query('state') ?? '');
            for (const cookie of result.cookies ?? []) {
              c.header('Set-Cookie', cookie, { append: true });
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
            logoutUrl = await this.provider.getLogoutUrl('/', c.req.raw);
          } catch {
            logoutUrl = null;
          }
          // Clear the session cookie regardless of whether WorkOS returned a logout URL.
          c.header('Set-Cookie', this.sessionClearCookie(), { append: true });
          return c.redirect(logoutUrl ?? '/');
        },
      },
    ];
  }
}
