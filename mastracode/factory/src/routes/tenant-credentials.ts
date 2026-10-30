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
 * Provider pools (FACT-574): the snapshot also carries each provider's pool
 * as token-free `PoolAccountSummary` metadata so the SDK's synchronous
 * `listAccounts` / `getActiveAccount` reads can drive account rotation.
 * Rotation stays inside the one pool this store's scope routes to (org pool
 * for `factory`, the caller's user pool otherwise). Tokens are read per account
 * from the domain (`getAccountCredential` / `refreshAccountOAuth`) and only
 * cached for accounts this store has activated or served, because the
 * gateway reads the selected account's API key synchronously.
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
import { orderAccountsFromActive } from '@mastra/code-sdk/auth/account-registry';
import { getOAuthProvider, PROVIDER_DEFAULT_MODELS } from '@mastra/code-sdk/auth/storage';
import type { AuthCredential, CredentialAccount, CredentialStore } from '@mastra/code-sdk/auth/types';
import type { RequestContext } from '@mastra/core/request-context';
import type { MiddlewareHandler } from 'hono';

import { isOAuthCredentialExpired } from '../storage/domains/credentials/base.js';
import type {
  CredentialTenant,
  ModelCredentialsStorage,
  PoolAccountSummary,
  RefreshAccountOAuthOptions,
} from '../storage/domains/credentials/base.js';
import { getAuthProviderId, getTenantCredentialsStorage, tenantOrgId } from './provider-credentials.js';
import type { RouteAuth } from './route.js';

/** How long a hydrated snapshot is considered fresh. */
const SNAPSHOT_TTL_MS = 15_000;

/** Cap on cached tenant stores; oldest-inserted evicted beyond this. */
const MAX_CACHED_TENANTS = 1000;

/**
 * How long a rotated-away account is skipped. Providers rarely say when a
 * subscription limit resets, so these are conservative estimates; a lapsed
 * cooldown reads back as usable and the account is tried again.
 */
const RATE_LIMIT_COOLDOWN_MS = 60_000;
const QUOTA_COOLDOWN_MS = 15 * 60_000;

function toCredentialAccount(account: PoolAccountSummary): CredentialAccount {
  return {
    id: account.id,
    label: account.label,
    active: account.active,
    priority: account.priority,
    status: account.status,
    ...(account.cooldownUntil !== undefined ? { cooldownUntil: account.cooldownUntil } : {}),
  };
}

export class TenantCredentialStore implements CredentialStore {
  readonly allowEnvironmentFallback = false;
  readonly #orgId: string;
  readonly #userId: string;
  readonly #scope: SdkCredentialTenant['credentialScope'];
  readonly #credentials: ModelCredentialsStorage | undefined;
  readonly #deploymentProviders: ReadonlySet<string>;
  #snapshot = new Map<string, AuthCredential>();
  /** Token-free pool metadata per provider, in switch order. */
  #pools = new Map<string, PoolAccountSummary[]>();
  /** Credentials of accounts this store activated or served, keyed by account id. */
  #accountCredentials = new Map<string, AuthCredential>();
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
    const [records, accounts] = await Promise.all([
      storage.listCredentials(this.#orgId, this.#userId),
      storage.listAccounts(this.#poolTenant()),
    ]);
    const next = new Map<string, AuthCredential>();
    const storageScope = this.#storageScope();
    for (const record of records.filter(r => r.scope === storageScope)) {
      next.set(record.provider, record.credential);
    }
    const pools = new Map<string, PoolAccountSummary[]>();
    for (const account of accounts) {
      const pool = pools.get(account.providerId) ?? [];
      pool.push(account);
      pools.set(account.providerId, pool);
    }
    const ids = new Set(accounts.map(account => account.id));
    for (const id of this.#accountCredentials.keys()) {
      if (!ids.has(id)) this.#accountCredentials.delete(id);
    }
    this.#snapshot = next;
    this.#pools = pools;
    this.#fetchedAt = Date.now();
  }

  #storageScope(): 'user' | 'org' {
    return this.#scope === 'factory' ? 'org' : 'user';
  }

  /** The one pool this store routes to; rotation never crosses into the other scope. */
  #poolTenant(): CredentialTenant {
    return this.#scope === 'factory' ? { orgId: this.#orgId } : { orgId: this.#orgId, userId: this.#userId };
  }

  #poolAccount(provider: string, accountId: string): PoolAccountSummary | undefined {
    return this.#pools.get(provider)?.find(account => account.id === accountId);
  }

  listAccounts(provider: string): CredentialAccount[] {
    return (this.#pools.get(provider) ?? []).map(toCredentialAccount);
  }

  getActiveAccount(provider: string): CredentialAccount | undefined {
    const active = this.#pools.get(provider)?.find(account => account.active);
    return active ? toCredentialAccount(active) : undefined;
  }

  /**
   * Sync read of one pool account's credential for a request routed to it.
   * Only accounts this store activated or served are cached; the active
   * account falls back to the provider snapshot. Anything else is undefined
   * — never another account's credential.
   */
  getAccountCredential(provider: string, accountId: string): AuthCredential | undefined {
    const account = this.#poolAccount(provider, accountId);
    if (!account) return undefined;
    return this.#accountCredentials.get(accountId) ?? (account.active ? this.#snapshot.get(provider) : undefined);
  }

  /**
   * Point the pool's active account at `instanceId` (or the next account in
   * switch order after the current one, wrapping once) and load its
   * credential so the retried request can read it synchronously. Async: the
   * rotation processor awaits it, so the pointer is persisted before retry.
   */
  async activateAccount(provider: string, instanceId?: string): Promise<CredentialAccount | undefined> {
    const pool = this.#pools.get(provider) ?? [];
    const active = pool.find(account => account.active);
    const target =
      instanceId !== undefined
        ? pool.find(account => account.id === instanceId)
        : orderAccountsFromActive(pool, active?.id).find(account => account.id !== active?.id);
    if (!target) return undefined;
    const storage = await getTenantCredentialsStorage(this.#credentials);
    if (!storage) return undefined;
    const tenant = this.#poolTenant();
    const credential = await storage.getAccountCredential(tenant, target.id);
    if (!credential || !(await storage.activateAccount(tenant, target.id))) return undefined;
    const next = pool.map(account => ({ ...account, active: account.id === target.id }));
    this.#pools.set(provider, next);
    this.#accountCredentials.set(target.id, credential);
    this.#snapshot.set(provider, credential);
    return toCredentialAccount({ ...target, active: true });
  }

  /**
   * Record why rotation left an account so other requests and replicas skip
   * it. Best effort: a failed write must not block the switch itself.
   */
  async markAccountUnavailable(
    provider: string,
    accountId: string,
    reason: 'rate-limit' | 'quota-exhausted' | 'auth-failed',
  ): Promise<void> {
    const status = reason === 'auth-failed' ? 'auth-failed' : 'cooldown';
    const cooldownUntil =
      reason === 'auth-failed'
        ? undefined
        : Date.now() + (reason === 'rate-limit' ? RATE_LIMIT_COOLDOWN_MS : QUOTA_COOLDOWN_MS);
    const pool = this.#pools.get(provider);
    if (pool) {
      this.#pools.set(
        provider,
        pool.map(account => (account.id === accountId ? { ...account, status, cooldownUntil } : account)),
      );
    }
    try {
      const storage = await getTenantCredentialsStorage(this.#credentials);
      await storage?.markAccountStatus(this.#poolTenant(), accountId, status, cooldownUntil);
    } catch (error) {
      console.warn('[factory] failed to record model provider account status', error);
    }
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
   * Authoritative fetch-time resolution: re-reads only the selected scope and
   * refreshes expired OAuth tokens under the domain's row lock. Mirrors
   * `AuthStorage.getApiKey` semantics: `undefined` on missing credential or
   * failed refresh (caller surfaces a re-login error).
   */
  async getApiKey(provider: string, accountInstanceId?: string): Promise<string | undefined> {
    const storage = await getTenantCredentialsStorage(this.#credentials);
    if (accountInstanceId !== undefined) {
      return storage ? this.#getAccountApiKey(storage, provider, accountInstanceId) : undefined;
    }
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

    const resolved = await storage.resolveCredential(
      this.#orgId,
      this.#userId,
      provider,
      this.#scope === 'factory' ? 'org' : 'user',
    );
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

    return this.#refreshOAuth(storage, resolved.scope, provider);
  }

  /**
   * Refresh the OAuth credential even though it hasn't expired. The
   * account-rotation processor calls this once when the provider rejects the
   * token (401/403): providers can revoke an access token before the expiry
   * recorded at sign-in. Only the token this store last served is replaced, so
   * when another session or replica already refreshed it the newer token is
   * reused instead of rotating the refresh token again.
   */
  async forceRefreshActiveAccount(provider: string, accountInstanceId?: string): Promise<string | undefined> {
    const storage = await getTenantCredentialsStorage(this.#credentials);
    if (!storage) return undefined;
    if (accountInstanceId !== undefined) {
      return this.#getAccountApiKey(storage, provider, accountInstanceId, true);
    }
    const served = this.#snapshot.get(provider);
    const resolved = await storage.resolveCredential(
      this.#orgId,
      this.#userId,
      provider,
      this.#scope === 'factory' ? 'org' : 'user',
    );
    if (resolved?.credential.type !== 'oauth') return undefined;
    const rejectedAccess = served?.type === 'oauth' ? served.access : resolved.credential.access;
    return this.#refreshOAuth(storage, resolved.scope, provider, { force: true, staleAccess: rejectedAccess });
  }

  /**
   * Authoritative read of one pool account (a request routed to it). Never
   * falls back to the active account: an unknown or foreign id is undefined.
   */
  async #getAccountApiKey(
    storage: ModelCredentialsStorage,
    provider: string,
    accountId: string,
    force = false,
  ): Promise<string | undefined> {
    if (!this.#poolAccount(provider, accountId)) return undefined;
    const tenant = this.#poolTenant();
    // What this store last served for the account — the token the provider rejected.
    const served = this.getAccountCredential(provider, accountId);
    const stored = await storage.getAccountCredential(tenant, accountId);
    if (!stored) {
      this.#accountCredentials.delete(accountId);
      return undefined;
    }
    this.#accountCredentials.set(accountId, stored);
    if (stored.type === 'api_key') return stored.key;

    const oauthProvider = getOAuthProvider(provider);
    if (!oauthProvider) return undefined;
    if (!force && !isOAuthCredentialExpired(stored)) return oauthProvider.getApiKey(stored);
    try {
      const refreshed = await storage.refreshAccountOAuth(
        tenant,
        accountId,
        async current => ({ type: 'oauth' as const, ...(await oauthProvider.refreshToken(current)) }),
        force ? { force: true, staleAccess: served?.type === 'oauth' ? served.access : stored.access } : {},
      );
      if (!refreshed) return undefined;
      this.#accountCredentials.set(accountId, refreshed);
      return oauthProvider.getApiKey(refreshed);
    } catch {
      // Refresh failed — this account needs a re-login.
      return undefined;
    }
  }

  async #refreshOAuth(
    storage: ModelCredentialsStorage,
    scope: 'user' | 'org',
    provider: string,
    options?: RefreshAccountOAuthOptions,
  ): Promise<string | undefined> {
    const oauthProvider = getOAuthProvider(provider);
    if (!oauthProvider) return undefined;
    // Refresh at the scope the credential actually lives at (OAuth rows are
    // user-scoped by policy, but resolve defensively from the record).
    const rowTenant = scope === 'user' ? { orgId: this.#orgId, userId: this.#userId } : { orgId: this.#orgId };
    try {
      const refreshed = await storage.refreshOAuth(
        rowTenant,
        provider,
        async current => ({
          type: 'oauth' as const,
          ...(await oauthProvider.refreshToken(current)),
        }),
        options,
      );
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
  return Object.entries(PROVIDER_DEFAULT_MODELS).find(([provider]) => store.get(provider) !== undefined)?.[1];
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
