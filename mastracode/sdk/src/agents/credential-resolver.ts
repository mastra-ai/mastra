/**
 * Per-tenant credential resolution seam for deployed (multi-user) servers.
 *
 * Locally, model resolution reads the server-global file-backed `AuthStorage`.
 * A deployed web host registers a {@link CredentialStoreProvider} at boot; from
 * then on `resolveModel` derives one exclusive credential scope from session
 * state. Factory scope reads organization credentials only. User scope reads
 * the Factory session owner's credentials only, or the authenticated principal
 * for project-less personal sessions.
 *
 * When no provider is registered (TUI, local web), everything falls through to
 * the existing global behavior unchanged.
 */

import type { RequestContext } from '@mastra/core/request-context';
import type { CredentialStore } from '../auth/types.js';

export type CredentialScope = 'factory' | 'user';

/** The identity and exclusive scope a credential lookup is resolved against. */
export interface CredentialTenant {
  /** Org tenant; absent for personal accounts (store impls may synthesize one). */
  orgId?: string;
  /** Stable user id used for user-scoped credentials and tenant cache keys. */
  userId: string;
  /** Exclusive credential scope for this request. */
  credentialScope: CredentialScope;
}

/**
 * Returns a tenant-scoped {@link CredentialStore}, or `undefined` when tenant
 * storage is unavailable. Must be synchronous — implementations serve from a
 * primed snapshot and do authoritative async work inside `getApiKey`.
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
}

/**
 * Session-shaped `authenticateToken` results (better-auth) arrive as a wrapper
 * whose active org lives on the session half rather than on the user.
 */
interface RequestContextSession {
  user?: RequestContextUser;
  session?: { activeOrganizationId?: string };
}

interface FactoryCredentialState {
  factoryProjectId?: unknown;
  factoryModelScope?: unknown;
  factoryOwnerUserId?: unknown;
  factoryOrgId?: unknown;
}

function resolveFactoryCredentialState(requestContext?: RequestContext): FactoryCredentialState | undefined {
  const controller = requestContext?.get('controller') as { state?: FactoryCredentialState } | undefined;
  if (!controller || typeof controller !== 'object' || !controller.state || typeof controller.state !== 'object') {
    return undefined;
  }
  return controller.state;
}

export function resolveCredentialScope(requestContext?: RequestContext): CredentialScope {
  const state = resolveFactoryCredentialState(requestContext);
  if (state?.factoryModelScope === 'user') return 'user';
  if (state?.factoryModelScope === 'factory') return 'factory';
  if (typeof state?.factoryProjectId === 'string' && state.factoryProjectId.length > 0) return 'factory';
  return 'user';
}

/**
 * Derive the calling tenant from a request context, if an authenticated web
 * user was stashed on it. Mirrors the web layer's stable-id resolution
 * (`workosId` falling back to the provider `id`).
 *
 * Factory user scope resolves the stamped session owner rather than the person
 * sending the current message. A stamped Factory session without an owner
 * fails closed instead of borrowing the principal's credentials.
 */
export function resolveTenantFromRequestContext(requestContext?: RequestContext): CredentialTenant | undefined {
  const raw = requestContext?.get('user') as (RequestContextUser & RequestContextSession) | undefined;
  if (!raw || typeof raw !== 'object') return undefined;

  // Precedence matches `toFactoryAuthUser` in `@mastra/factory`: a wrapper's org
  // comes from the session half only, never from the inner user.
  const wrapped = Boolean(raw.user && typeof raw.user === 'object' && raw.session && typeof raw.session === 'object');
  const user = wrapped ? (raw.user as RequestContextUser) : raw;
  const principalOrgId = wrapped ? raw.session?.activeOrganizationId : user.organizationId;
  const principalUserId = user.workosId ?? user.id;
  if (typeof principalUserId !== 'string' || !principalUserId) return undefined;
  if (principalOrgId !== undefined && typeof principalOrgId !== 'string') return undefined;

  const state = resolveFactoryCredentialState(requestContext);
  const credentialScope = resolveCredentialScope(requestContext);
  const hasFactoryContext =
    state?.factoryModelScope === 'factory' ||
    state?.factoryModelScope === 'user' ||
    (typeof state?.factoryProjectId === 'string' && state.factoryProjectId.length > 0);

  let userId = principalUserId;
  if (credentialScope === 'user' && hasFactoryContext) {
    if (typeof state?.factoryOwnerUserId !== 'string' || !state.factoryOwnerUserId) return undefined;
    userId = state.factoryOwnerUserId;
  }

  const orgId = state?.factoryOrgId ?? principalOrgId;
  if (orgId !== undefined && typeof orgId !== 'string') return undefined;
  return { orgId, userId, credentialScope };
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
    const state = resolveFactoryCredentialState(requestContext);
    console.warn('[MastraCode] Tenant credential resolution failed closed', {
      reason: rawUser === undefined ? 'missing-user-context' : 'invalid-principal-or-owner',
      hasRequestContext: requestContext !== undefined,
      credentialScope: resolveCredentialScope(requestContext),
      ownerResolved: typeof state?.factoryOwnerUserId === 'string' && state.factoryOwnerUserId.length > 0,
    });
    return unavailableTenantCredentialStore;
  }
  const store = credentialStoreProvider(tenant);
  if (!store) {
    console.warn('[MastraCode] Tenant credential resolution failed closed', {
      reason: 'credential-store-unavailable',
      hasOrganization: tenant.orgId !== undefined,
      credentialScope: tenant.credentialScope,
      ownerResolved: tenant.credentialScope === 'factory' || tenant.userId !== undefined,
    });
    return unavailableTenantCredentialStore;
  }
  return store;
}
