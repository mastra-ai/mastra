/**
 * Per-tenant credential store for model resolution (deployed mode).
 *
 * The SDK's `resolveModel` asks the registered `CredentialStoreProvider` for a
 * store synchronously, so this module keeps a small per-tenant **snapshot** of
 * resolved credentials (user rows over org rows) hydrated from the
 * `model-credentials` domain. The snapshot serves the gateway's synchronous
 * path-selection reads (`get` / `getStoredApiKey`); the fetch-time
 * `getApiKey` is authoritative — it re-resolves against the domain and
 * refreshes expired OAuth tokens under the domain's row lock, so a slightly
 * stale snapshot can never send an expired token upstream.
 *
 * Snapshots are primed per request by `createTenantCredentialPrimer` (mounted
 * after the web auth gate) so the first model call of a request already sees
 * the caller's credentials. This store explicitly disables the SDK's
 * environment fallback so server-shell credentials never leak into tenants.
 */

import type { CredentialTenant as SdkCredentialTenant } from '@mastra/code-sdk/agents/credential-resolver';
import { setCredentialStoreProvider } from '@mastra/code-sdk/agents/credential-resolver';
import { getOAuthProvider } from '@mastra/code-sdk/auth/storage';
import type { AuthCredential, CredentialStore } from '@mastra/code-sdk/auth/types';
import type { MiddlewareHandler } from 'hono';

import { isOAuthCredentialExpired } from '../storage/domains/credentials/base.js';
import type { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import { getTenantCredentialsStorage, tenantOrgId } from './provider-credentials.js';
import type { RouteAuth } from './route.js';

/** How long a hydrated snapshot is considered fresh. */
const SNAPSHOT_TTL_MS = 15_000;

/** Cap on cached tenant stores; oldest-inserted evicted beyond this. */
const MAX_CACHED_TENANTS = 1000;

export class TenantCredentialStore implements CredentialStore {
  readonly allowEnvironmentFallback = false;
  readonly #orgId: string;
  readonly #userId: string;
  readonly #credentials: ModelCredentialsStorage | undefined;
  #snapshot = new Map<string, AuthCredential>();
  #fetchedAt = 0;
  #hydrating: Promise<void> | undefined;

  constructor(orgId: string, userId: string, credentials: ModelCredentialsStorage | undefined) {
    this.#orgId = orgId;
    this.#userId = userId;
    this.#credentials = credentials;
  }

  /** Hydrate the snapshot when stale; coalesces concurrent callers. */
  async ensureFresh(now = Date.now()): Promise<void> {
    if (now - this.#fetchedAt < SNAPSHOT_TTL_MS) return;
    this.#hydrating ??= this.#hydrate().finally(() => {
      this.#hydrating = undefined;
    });
    await this.#hydrating;
  }

  async #hydrate(): Promise<void> {
    const storage = await getTenantCredentialsStorage(this.#credentials);
    if (!storage) return; // Keep the last tenant-scoped snapshot.
    const records = await storage.listCredentials(this.#orgId, this.#userId);
    const next = new Map<string, AuthCredential>();
    // Org rows first so user rows overwrite them (user > org precedence).
    for (const record of records.filter(r => r.scope === 'org')) {
      next.set(record.provider, record.credential);
    }
    for (const record of records.filter(r => r.scope === 'user')) {
      next.set(record.provider, record.credential);
    }
    this.#snapshot = next;
    this.#fetchedAt = Date.now();
  }

  /** Sync by contract; kicks a background re-hydrate when the snapshot is stale. */
  reload(): void {
    if (Date.now() - this.#fetchedAt >= SNAPSHOT_TTL_MS) {
      void this.ensureFresh().catch(() => {});
    }
  }

  get(provider: string): AuthCredential | undefined {
    return this.#snapshot.get(provider);
  }

  getStoredApiKey(provider: string): string | undefined {
    const cred = this.#snapshot.get(provider);
    return cred?.type === 'api_key' ? cred.key : undefined;
  }

  /**
   * Authoritative fetch-time resolution: re-reads the domain (user > org) and
   * refreshes expired OAuth tokens under the domain's row lock. Mirrors
   * `AuthStorage.getApiKey` semantics: `undefined` on missing credential or
   * failed refresh (caller surfaces a re-login error).
   */
  async getApiKey(provider: string): Promise<string | undefined> {
    const storage = await getTenantCredentialsStorage(this.#credentials);
    if (!storage) {
      // Domain unavailable: best effort from the snapshot; expired OAuth
      // tokens cannot be refreshed without the domain's lock.
      const cred = this.#snapshot.get(provider);
      if (cred?.type === 'api_key') return cred.key;
      if (cred?.type === 'oauth' && !isOAuthCredentialExpired(cred)) {
        return getOAuthProvider(provider)?.getApiKey(cred);
      }
      return undefined;
    }

    const resolved = await storage.resolveCredential(this.#orgId, this.#userId, provider);
    if (!resolved) {
      this.#snapshot.delete(provider);
      return undefined;
    }
    this.#snapshot.set(provider, resolved.credential);

    if (resolved.credential.type === 'api_key') {
      return resolved.credential.key;
    }

    const oauthProvider = getOAuthProvider(provider);
    if (!oauthProvider) return undefined;

    if (!isOAuthCredentialExpired(resolved.credential)) {
      return oauthProvider.getApiKey(resolved.credential);
    }

    // Refresh at the scope the credential actually lives at (OAuth rows are
    // user-scoped by policy, but resolve defensively from the record).
    const rowTenant = resolved.scope === 'user' ? { orgId: this.#orgId, userId: this.#userId } : { orgId: this.#orgId };
    try {
      const refreshed = await storage.refreshOAuth(rowTenant, provider, async current => ({
        type: 'oauth' as const,
        ...(await oauthProvider.refreshToken(current)),
      }));
      if (!refreshed) return undefined;
      this.#snapshot.set(provider, refreshed);
      return oauthProvider.getApiKey(refreshed);
    } catch {
      // Refresh failed — user needs to re-login (same posture as AuthStorage).
      return undefined;
    }
  }
}

const tenantStores = new Map<string, TenantCredentialStore>();

function storeFor(tenant: SdkCredentialTenant, credentials: ModelCredentialsStorage): TenantCredentialStore {
  const orgId = tenantOrgId(tenant);
  const key = `${orgId}\u0000${tenant.userId}`;
  let store = tenantStores.get(key);
  if (!store) {
    if (tenantStores.size >= MAX_CACHED_TENANTS) {
      const oldest = tenantStores.keys().next().value;
      if (oldest !== undefined) tenantStores.delete(oldest);
    }
    store = new TenantCredentialStore(orgId, tenant.userId, credentials);
    tenantStores.set(key, store);
  }
  return store;
}

/**
 * Register the web tenant credential store provider with the SDK. Called by
 * the factory after storage init with the `model-credentials` domain handle;
 * from then on `resolveModel` uses per-tenant credentials and the SDK skips
 * the `loadStoredApiKeysIntoEnv` env side-channel.
 */
export function registerTenantCredentialResolver(credentials: ModelCredentialsStorage): void {
  setCredentialStoreProvider(tenant => storeFor(tenant, credentials));
}

/** Test hook: clear registration and cached tenant snapshots. */
export function resetTenantCredentialResolverForTests(): void {
  setCredentialStoreProvider(undefined);
  tenantStores.clear();
}

/**
 * Drop cached snapshots after a credential write so the change is visible to
 * the next model call immediately instead of after the snapshot TTL. An org
 * write affects every member's resolved view, so all stores under the org are
 * invalidated; a user write only drops that user's store.
 */
export function invalidateTenantCredentialSnapshots(tenant: { orgId: string; userId?: string }): void {
  if (tenant.userId) {
    tenantStores.delete(`${tenant.orgId}\u0000${tenant.userId}`);
    return;
  }
  for (const key of tenantStores.keys()) {
    if (key.startsWith(`${tenant.orgId}\u0000`)) tenantStores.delete(key);
  }
}

/**
 * Middleware mounted after the web auth gate: primes the caller's credential
 * snapshot so the request's first model call sees their credentials without an
 * async seam in model resolution. Cheap when fresh (TTL check), best-effort
 * when not — a failed hydrate falls back to env vars, never blocks a request.
 */
export async function primeTenantCredentials({
  tenant,
  credentials,
}: {
  tenant: SdkCredentialTenant;
  credentials: ModelCredentialsStorage;
}): Promise<void> {
  await storeFor(tenant, credentials).ensureFresh();
}

export function createTenantCredentialPrimer({
  auth,
  credentials,
}: {
  auth: RouteAuth;
  credentials: ModelCredentialsStorage;
}): MiddlewareHandler {
  return async (c, next) => {
    const tenant = auth.tenant(c);
    if (tenant) {
      try {
        await storeFor(tenant, credentials).ensureFresh();
      } catch {
        // Fail open: model calls fall back to env credentials.
      }
    }
    await next();
  };
}
