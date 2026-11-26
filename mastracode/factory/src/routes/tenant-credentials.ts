/**
 * Per-tenant credential store for model resolution (deployed mode).
 *
 * The SDK's `resolveModel` asks the registered `CredentialStoreProvider` for a
 * store synchronously, so this module keeps a small per-tenant **snapshot** of
 * credentials from one exclusive scope hydrated from the `model-credentials`
 * domain. The snapshot serves the gateway's synchronous
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

import type {
  CredentialTenant as SdkCredentialTenant,
  CredentialTenantResolver,
} from '@mastra/code-sdk/agents/credential-resolver';
import {
  prepareCredentialTenant,
  resolveTenantFromRequestContext,
  setCredentialStoreProvider,
} from '@mastra/code-sdk/agents/credential-resolver';
import { getOAuthProvider, PROVIDER_DEFAULT_MODELS } from '@mastra/code-sdk/auth/storage';
import type { AuthCredential, CredentialStore, OAuthAccountRecord, OAuthCredential } from '@mastra/code-sdk/auth/types';
import { MASTRA_GATEWAY_PROVIDER } from '@mastra/code-sdk/onboarding/settings';
import { MASTRA_GATEWAY_PREFIX } from '@mastra/code-sdk/providers/model-ids';
import type { RequestContext } from '@mastra/core/request-context';
import type { MiddlewareHandler } from 'hono';

import { isOAuthCredentialExpired } from '../storage/domains/credentials/base.js';
import type {
  CredentialAccount,
  ModelCredentialsStorage,
  ResolvedCredential,
} from '../storage/domains/credentials/base.js';
import { getAuthProviderId, getTenantCredentialsStorage, storedScopeFor, tenantOrgId } from './provider-credentials.js';
import type { RouteAuth } from './route.js';

/** How long a hydrated snapshot is considered fresh. */
const SNAPSHOT_TTL_MS = 15_000;

/** Cap on cached tenant stores; oldest-inserted evicted beyond this. */
const MAX_CACHED_TENANTS = 1000;

export class TenantCredentialStore implements CredentialStore {
  readonly allowEnvironmentFallback = false;
  readonly #orgId: string;
  readonly #userId: string;
  readonly #scope: SdkCredentialTenant['credentialScope'];
  readonly #credentials: ModelCredentialsStorage | undefined;
  readonly #deploymentProviders: ReadonlySet<string>;
  #snapshot = new Map<string, AuthCredential>();
  /** Each provider's OAuth subscriptions, first account first. */
  #accounts = new Map<string, CredentialAccount[]>();
  /**
   * The subscription each provider's model calls start on. Rotation moves it
   * when one runs out. It lives in memory on this store, so a restart, another
   * replica, a credential change or cache eviction starts over on the first
   * account and spends at most one rate-limited request.
   */
  #activeAccountIds = new Map<string, string>();
  #fetchedAt = 0;
  #hydrating: Promise<void> | undefined;

  constructor(
    orgId: string,
    userId: string,
    credentials: ModelCredentialsStorage | undefined,
    scope: SdkCredentialTenant['credentialScope'],
    deploymentProviders: ReadonlySet<string> = new Set(),
  ) {
    this.#orgId = orgId;
    this.#userId = userId;
    this.#credentials = credentials;
    this.#scope = scope;
    this.#deploymentProviders = deploymentProviders;
  }

  /** Providers the operator opted in to run on the server process's own credentials. */
  allowsDeploymentCredentials(provider: string): boolean {
    return this.#deploymentProviders.has(provider);
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
    const storageScope = storedScopeFor(this.#scope);
    const [records, accounts] = await Promise.all([
      storage.listCredentials(this.#orgId, this.#userId),
      storage.listAccounts(this.#orgId, this.#userId),
    ]);
    const next = new Map<string, AuthCredential>();
    for (const record of records.filter(r => r.scope === storageScope)) {
      next.set(record.provider, record.credential);
    }
    const nextAccounts = new Map<string, CredentialAccount[]>();
    for (const account of accounts.filter(a => a.scope === storageScope)) {
      nextAccounts.set(account.provider, [...(nextAccounts.get(account.provider) ?? []), account]);
    }
    this.#snapshot = next;
    this.#accounts = nextAccounts;
    this.#fetchedAt = Date.now();
  }

  /** Sync by contract; kicks a background re-hydrate when the snapshot is stale. */
  reload(): void {
    if (Date.now() - this.#fetchedAt >= SNAPSHOT_TTL_MS) {
      void this.ensureFresh().catch(() => {});
    }
  }

  /** The credential of the subscription the provider's model calls are on, else its API key. */
  get(provider: string): AuthCredential | undefined {
    return this.#account(provider, this.#activeAccountId(provider))?.credential ?? this.#snapshot.get(provider);
  }

  getStoredApiKey(provider: string): string | undefined {
    const cred = this.#snapshot.get(provider);
    return cred?.type === 'api_key' ? cred.key : undefined;
  }

  /** The provider's OAuth subscriptions as the account-rotation processor reads them. */
  listAccounts(provider: string): OAuthAccountRecord[] {
    const accounts = this.#accounts.get(provider) ?? [];
    const activeId = this.#activeAccountId(provider);
    return accounts.map((account, index) => ({
      ...account.credential,
      type: 'oauth-account',
      id: account.id,
      label: account.label ?? `Account ${index + 1}`,
      addedAt: account.addedAt.toISOString(),
      active: account.id === activeId,
    }));
  }

  getActiveAccount(provider: string): OAuthAccountRecord | undefined {
    return this.listAccounts(provider).find(account => account.active);
  }

  activateAccount(provider: string, accountId: string): OAuthAccountRecord | undefined {
    const next = this.listAccounts(provider).find(account => account.id === accountId);
    if (!next) return undefined;
    this.#activeAccountIds.set(provider, next.id);
    return { ...next, active: true };
  }

  #activeAccountId(provider: string): string | undefined {
    const accounts = this.#accounts.get(provider) ?? [];
    const cursor = this.#activeAccountIds.get(provider);
    return accounts.find(account => account.id === cursor)?.id ?? accounts[0]?.id;
  }

  /** Keep the snapshot and the account list in step with what storage just returned. */
  #remember(provider: string, accountId: string, credential: AuthCredential): void {
    const accounts = this.#accounts.get(provider) ?? [];
    const index = accounts.findIndex(account => account.id === accountId);
    if (index <= 0) this.#snapshot.set(provider, credential);
    if (index >= 0 && credential.type === 'oauth') {
      this.#accounts.set(provider, accounts.with(index, { ...accounts[index]!, credential }));
    }
  }

  #account(provider: string, accountId: string | undefined): CredentialAccount | undefined {
    return this.#accounts.get(provider)?.find(account => account.id === accountId);
  }

  /**
   * Read one subscription (`accountId`, else the active one) from storage. When
   * the active one was removed elsewhere, calls start over on the first.
   */
  async #resolve(
    storage: ModelCredentialsStorage,
    provider: string,
    accountId: string | undefined,
  ): Promise<ResolvedCredential | undefined> {
    const target = accountId ?? this.#activeAccountId(provider);
    const scope = storedScopeFor(this.#scope);
    const resolved = await storage.resolveCredential(this.#orgId, this.#userId, provider, scope, target);
    if (resolved || accountId !== undefined || target === undefined) return resolved;
    this.#forget(provider, target);
    return storage.resolveCredential(this.#orgId, this.#userId, provider, scope);
  }

  #forget(provider: string, accountId: string | undefined): void {
    if (accountId === undefined) {
      this.#snapshot.delete(provider);
      this.#accounts.delete(provider);
      return;
    }
    const accounts = this.#accounts.get(provider) ?? [];
    this.#accounts.set(
      provider,
      accounts.filter(account => account.id !== accountId),
    );
  }

  /**
   * Authoritative fetch-time resolution of the active subscription, or of
   * `accountId` when rotation picked one for this request: re-reads only the
   * selected scope and refreshes expired OAuth tokens under the domain's row
   * lock. Mirrors `AuthStorage.getApiKey` semantics: `undefined` on missing
   * credential or failed refresh (caller surfaces a re-login error).
   */
  async getApiKey(provider: string, accountId?: string): Promise<string | undefined> {
    const storage = await getTenantCredentialsStorage(this.#credentials);
    if (!storage) {
      // Domain unavailable: best effort from the snapshot; expired OAuth
      // tokens cannot be refreshed without the domain's lock.
      const cred = accountId === undefined ? this.get(provider) : this.#account(provider, accountId)?.credential;
      if (cred?.type === 'api_key') return cred.key;
      if (cred?.type === 'oauth' && !isOAuthCredentialExpired(cred)) {
        return getOAuthProvider(provider)?.getApiKey(cred);
      }
      return undefined;
    }

    const resolved = await this.#resolve(storage, provider, accountId);
    if (!resolved) {
      this.#forget(provider, accountId);
      return undefined;
    }
    this.#remember(provider, resolved.accountId, resolved.credential);

    if (resolved.credential.type === 'api_key') {
      return resolved.credential.key;
    }

    const oauthProvider = getOAuthProvider(provider);
    if (!oauthProvider) return undefined;

    if (!isOAuthCredentialExpired(resolved.credential)) {
      return oauthProvider.getApiKey(resolved.credential);
    }

    return this.#refreshOAuth(storage, resolved, isOAuthCredentialExpired);
  }

  /**
   * Refresh an OAuth credential even though it hasn't expired. The
   * account-rotation processor calls this once when the provider rejects the
   * token (401/403): providers can revoke an access token before the expiry
   * recorded at sign-in. Only the token this store last served is replaced, so
   * when another session or replica already refreshed it the newer token is
   * reused instead of rotating the refresh token again.
   */
  async forceRefreshActiveAccount(provider: string, accountId?: string): Promise<string | undefined> {
    const storage = await getTenantCredentialsStorage(this.#credentials);
    if (!storage) return undefined;
    const served = accountId === undefined ? this.get(provider) : this.#account(provider, accountId)?.credential;
    const resolved = await this.#resolve(storage, provider, accountId);
    if (resolved?.credential.type !== 'oauth') return undefined;
    const rejectedAccess = served?.type === 'oauth' ? served.access : resolved.credential.access;
    return this.#refreshOAuth(
      storage,
      resolved,
      current => isOAuthCredentialExpired(current) || current.access === rejectedAccess,
    );
  }

  async #refreshOAuth(
    storage: ModelCredentialsStorage,
    resolved: ResolvedCredential,
    needsRefresh: (current: OAuthCredential) => boolean,
  ): Promise<string | undefined> {
    const { provider, accountId } = resolved;
    const oauthProvider = getOAuthProvider(provider);
    if (!oauthProvider) return undefined;
    // Refresh at the scope the credential actually lives at (OAuth rows are
    // user-scoped by policy, but resolve defensively from the record).
    const rowTenant = resolved.scope === 'user' ? { orgId: this.#orgId, userId: this.#userId } : { orgId: this.#orgId };
    try {
      const refreshed = await storage.refreshOAuth(
        rowTenant,
        provider,
        async current => ({
          type: 'oauth' as const,
          ...(await oauthProvider.refreshToken(current)),
        }),
        needsRefresh,
        accountId,
      );
      if (!refreshed) return undefined;
      this.#remember(provider, accountId, refreshed);
      return oauthProvider.getApiKey(refreshed);
    } catch {
      // Refresh failed — user needs to re-login (same posture as AuthStorage).
      return undefined;
    }
  }
}

const tenantStores = new Map<string, TenantCredentialStore>();
let registeredCredentials: ModelCredentialsStorage | undefined;
let registeredDeploymentProviders: ReadonlySet<string> = new Set();

function storeFor(tenant: SdkCredentialTenant, credentials: ModelCredentialsStorage): TenantCredentialStore {
  const orgId = tenantOrgId(tenant);
  const key = `${orgId}\u0000${tenant.userId}\u0000${tenant.credentialScope}`;
  let store = tenantStores.get(key);
  if (!store) {
    if (tenantStores.size >= MAX_CACHED_TENANTS) {
      const oldest = tenantStores.keys().next().value;
      if (oldest !== undefined) tenantStores.delete(oldest);
    }
    store = new TenantCredentialStore(
      orgId,
      tenant.userId,
      credentials,
      tenant.credentialScope,
      registeredDeploymentProviders,
    );
    tenantStores.set(key, store);
  }
  return store;
}

/**
 * Register the web tenant credential store provider with the SDK. Called by
 * the factory after storage init with the `model-credentials` domain handle;
 * from then on `resolveModel` uses per-tenant credentials and the SDK skips
 * the `loadStoredApiKeysIntoEnv` env side-channel. `deploymentProviders` are
 * the providers the operator opted in to authenticate with the server
 * process's own credentials (see `MastraFactoryConfig.deploymentModelProviders`).
 */
export function registerTenantCredentialResolver(
  credentials: ModelCredentialsStorage,
  deploymentProviders: ReadonlySet<string> = new Set(),
  resolveTenant?: CredentialTenantResolver,
): void {
  registeredCredentials = credentials;
  registeredDeploymentProviders = deploymentProviders;
  tenantStores.clear();
  setCredentialStoreProvider(
    tenant => storeFor(tenant, credentials),
    resolveTenant
      ? async requestContext => {
          const tenant = await resolveTenant(requestContext);
          if (tenant) await storeFor(tenant, credentials).ensureFresh();
          return tenant;
        }
      : undefined,
  );
}

/**
 * Prime the tenant stores for a request context built outside the web layer,
 * such as a webhook-triggered session run. The auth middleware does this for
 * HTTP requests; a run that starts without one would otherwise resolve its
 * model against an empty snapshot and fail closed. No-op before registration.
 */
export async function primeTenantCredentialsForRequestContext(requestContext: RequestContext): Promise<void> {
  if (!registeredCredentials) return;
  await prepareCredentialTenant(requestContext);
  const tenant = resolveTenantFromRequestContext(requestContext);
  if (!tenant) return;
  await storeFor(tenant, registeredCredentials).ensureFresh();
}

/** Prime one already-resolved Factory session tenant before entering the agent run. */
export async function primeTenantCredentialsForTenant(tenant: SdkCredentialTenant): Promise<void> {
  if (!registeredCredentials) return;
  try {
    await storeFor(tenant, registeredCredentials).ensureFresh();
  } catch (error) {
    console.warn('[factory] Failed to prime scoped tenant model credentials', {
      orgId: tenant.orgId,
      userId: tenant.userId,
      credentialScope: tenant.credentialScope,
      error,
    });
  }
}

/**
 * The model a session should fall back to when its scope has no chosen default:
 * the provider default (`PROVIDER_DEFAULT_MODELS`) of the first provider the
 * tenant is connected to. Returns `undefined` when `currentModelId` is already
 * usable, when no connected provider has a default, or before registration.
 */
export async function resolveTenantProviderDefaultModel(
  tenant: SdkCredentialTenant,
  currentModelId: string | undefined,
): Promise<string | undefined> {
  if (!registeredCredentials) return undefined;
  const store = storeFor(tenant, registeredCredentials);
  await store.ensureFresh();
  const usable = (modelId: string) => {
    const provider = modelId.split('/')[0] ?? '';
    return store.get(getAuthProviderId(provider)) !== undefined || store.allowsDeploymentCredentials(provider);
  };
  if (currentModelId && usable(currentModelId)) return undefined;
  const providerDefault = Object.entries(PROVIDER_DEFAULT_MODELS).find(
    ([provider]) => store.get(provider) !== undefined,
  )?.[1];
  if (providerDefault) return providerDefault;
  return store.get(MASTRA_GATEWAY_PROVIDER) ? `${MASTRA_GATEWAY_PREFIX}anthropic/claude-opus-5.5` : undefined;
}

/** Test hook: clear registration and cached tenant snapshots. */
export function resetTenantCredentialResolverForTests(): void {
  setCredentialStoreProvider(undefined);
  registeredCredentials = undefined;
  registeredDeploymentProviders = new Set();
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
    tenantStores.delete(`${tenant.orgId}\u0000${tenant.userId}\u0000user`);
    tenantStores.delete(`${tenant.orgId}\u0000${tenant.userId}\u0000factory`);
    return;
  }
  for (const key of tenantStores.keys()) {
    if (key.startsWith(`${tenant.orgId}\u0000`)) tenantStores.delete(key);
  }
}

/**
 * Middleware mounted after the web auth gate: primes both exclusive credential
 * scopes because the HTTP principal is known before the controller session is.
 * Cheap when fresh because each store has a TTL.
 */
export async function primeTenantCredentials({
  tenant,
  credentials,
}: {
  tenant: Pick<SdkCredentialTenant, 'orgId' | 'userId'> & Partial<Pick<SdkCredentialTenant, 'credentialScope'>>;
  credentials: ModelCredentialsStorage;
}): Promise<void> {
  await Promise.all([
    storeFor({ ...tenant, credentialScope: 'user' }, credentials).ensureFresh(),
    storeFor({ ...tenant, credentialScope: 'factory' }, credentials).ensureFresh(),
  ]);
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
        await primeTenantCredentials({ tenant, credentials });
      } catch (error) {
        console.warn('[factory] Failed to prime tenant model credentials', {
          orgId: tenant.orgId,
          userId: tenant.userId,
          error,
        });
      }
    }
    await next();
  };
}
