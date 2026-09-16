/**
 * Per-tenant credential resolution seam for deployed (multi-user) servers.
 *
 * Locally, model resolution reads the server-global file-backed `AuthStorage`.
 * A deployed web host registers a {@link CredentialStoreProvider} at boot; from
 * then on `resolveModel` derives the calling tenant from the request context
 * (the web auth gate stashes the authenticated user under the `user` key) and
 * resolves credentials through the tenant's own store — user credentials over
 * org credentials over server env vars, with OAuth refresh owned by the store.
 *
 * When no provider is registered (TUI, local web), everything falls through to
 * the existing global behavior unchanged.
 */

import type { RequestContext } from '@mastra/core/request-context';
import type { CredentialStore } from '../auth/types.js';

/** The identity a credential lookup is scoped to. */
export interface CredentialTenant {
  /** Org tenant; absent for personal accounts (store impls may synthesize one). */
  orgId?: string;
  /** Stable user id from the web auth adapter. */
  userId: string;
  /**
   * Resolve org-shared credentials over the user's personal ones. Set by
   * trusted server code for automated (factory) runs so they ride the org's
   * shared keys first and only fall back to the acting user's credentials.
   */
  orgFirst?: boolean;
}

/**
 * Returns a tenant-scoped {@link CredentialStore}, or `undefined` to fall back
 * to the global store (e.g. tenant storage temporarily unavailable). Must be
 * synchronous — implementations serve from a primed snapshot and do
 * authoritative async work inside `getApiKey`.
 */
export type CredentialStoreProvider = (tenant: CredentialTenant) => CredentialStore | undefined;

let credentialStoreProvider: CredentialStoreProvider | undefined;

const unavailableTenantCredentialStore: CredentialStore = {
  allowEnvironmentFallback: false,
  reload() {},
  get() {
    return undefined;
  },
  getStoredApiKey() {
    return undefined;
  },
  async getApiKey() {
    return undefined;
  },
};

/** Register (or clear) the tenant credential store provider. Deployed-web only. */
export function setCredentialStoreProvider(provider: CredentialStoreProvider | undefined): void {
  credentialStoreProvider = provider;
}

/**
 * Whether a tenant provider is registered. Used to disable the
 * `loadStoredApiKeysIntoEnv` side-channel in deployed mode — per-tenant
 * credentials must never leak into process-global env vars.
 */
export function hasCredentialStoreProvider(): boolean {
  return credentialStoreProvider !== undefined;
}

/** Shape the web auth gate stashes on the request context under `user`. */
interface RequestContextUser {
  workosId?: string;
  id?: string;
  organizationId?: string;
  /** Trusted server code marks automated runs to resolve org > user credentials. */
  orgFirstCredentials?: boolean;
}

/**
 * Session-shaped `authenticateToken` results (better-auth) arrive as a wrapper
 * whose active org lives on the session half rather than on the user.
 */
interface RequestContextSession {
  user?: RequestContextUser;
  session?: { activeOrganizationId?: string };
}

/**
 * Whether the request context belongs to a run on a factory-owned session.
 *
 * The agent controller stamps the session's state onto the request context
 * under `controller`, and only trusted factory server code ever writes
 * `factoryProjectId` into session state (board-run creation) — interactive
 * chat sessions never carry it. Runs on such sessions resolve credentials
 * org > user regardless of who sent the message: a board run continued
 * interactively, or a model switch inside it, is still org work.
 */
function isFactorySessionContext(requestContext?: RequestContext): boolean {
  const controller = requestContext?.get('controller') as { state?: { factoryProjectId?: unknown } } | undefined;
  if (!controller || typeof controller !== 'object') return false;
  const factoryProjectId = controller.state?.factoryProjectId;
  return typeof factoryProjectId === 'string' && factoryProjectId.length > 0;
}

/**
 * Derive the calling tenant from a request context, if an authenticated web
 * user was stashed on it. Mirrors the web layer's stable-id resolution
 * (`workosId` falling back to the provider `id`).
 *
 * The value under `user` is whatever the active auth provider's
 * `authenticateToken` returned, so its shape follows the provider: a flat user
 * (WorkOS) or a `{ session, user }` wrapper (better-auth). Reading only the
 * flat shape resolves no tenant at all for the wrapper, which in deployed mode
 * fails closed to an empty credential store.
 */
export function resolveTenantFromRequestContext(requestContext?: RequestContext): CredentialTenant | undefined {
  const raw = requestContext?.get('user') as (RequestContextUser & RequestContextSession) | undefined;
  if (!raw || typeof raw !== 'object') return undefined;

  // Precedence matches `toFactoryAuthUser` in `@mastra/factory`: a wrapper's org
  // comes from the session half only, never from the inner user. The two parsers
  // cannot share code across the package boundary, so they must agree by rule.
  const wrapped = Boolean(raw.user && typeof raw.user === 'object' && raw.session && typeof raw.session === 'object');
  const user = wrapped ? (raw.user as RequestContextUser) : raw;
  const orgId = wrapped ? raw.session?.activeOrganizationId : user.organizationId;
  const userId = user.workosId ?? user.id;
  // The slot holds whatever the provider returned, so the declared string
  // types are hopes, not guarantees. A non-string id must refuse the tenant
  // (fail closed), not flow onward as a mistyped key.
  if (typeof userId !== 'string' || !userId) return undefined;
  if (orgId !== undefined && typeof orgId !== 'string') return undefined;
  // Only an exact `true` flips precedence — anything else keeps user > org.
  // Server code stamps the flag on the stashed value itself, so read it from
  // the top level as well as the unwrapped user (better-auth wrapper shape).
  const orgFirst =
    raw.orgFirstCredentials === true || user.orgFirstCredentials === true || isFactorySessionContext(requestContext);
  return { orgId, userId, ...(orgFirst ? { orgFirst } : {}) };
}

/**
 * Resolve the credential store for a request. Local mode returns `undefined`
 * and keeps the global `AuthStorage` behavior. Once deployed web registers a
 * provider, missing tenant identity or unavailable tenant storage fails closed
 * through an empty store that also disables process-environment fallback.
 */
export function resolveCredentialStore(requestContext?: RequestContext): CredentialStore | undefined {
  if (!credentialStoreProvider) return undefined;
  const tenant = resolveTenantFromRequestContext(requestContext);
  if (!tenant) {
    const rawUser = requestContext?.get('user');
    console.warn('[MastraCode] Tenant credential resolution failed closed', {
      reason: rawUser === undefined ? 'missing-user-context' : 'invalid-principal-shape',
      hasRequestContext: requestContext !== undefined,
      factorySession: isFactorySessionContext(requestContext),
    });
    return unavailableTenantCredentialStore;
  }
  const store = credentialStoreProvider(tenant);
  if (!store) {
    console.warn('[MastraCode] Tenant credential resolution failed closed', {
      reason: 'credential-store-unavailable',
      hasOrganization: tenant.orgId !== undefined,
      orgFirst: tenant.orgFirst === true,
    });
    return unavailableTenantCredentialStore;
  }
  return store;
}
