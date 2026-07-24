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
}

/**
 * Derive the calling tenant from a request context, if an authenticated web
 * user was stashed on it. Mirrors the web layer's stable-id resolution
 * (`workosId` falling back to the provider `id`).
 */
export function resolveTenantFromRequestContext(requestContext?: RequestContext): CredentialTenant | undefined {
  const user = requestContext?.get('user') as RequestContextUser | undefined;
  if (!user || typeof user !== 'object') return undefined;
  const userId = user.workosId ?? user.id;
  if (!userId) return undefined;
  return { orgId: user.organizationId, userId };
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
  if (!tenant) return unavailableTenantCredentialStore;
  return credentialStoreProvider(tenant) ?? unavailableTenantCredentialStore;
}
