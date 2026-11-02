import {
  prepareCredentialTenant,
  resolveAuthenticatedCredentialTenant,
  resolveCredentialStore,
  setCredentialStoreProvider,
} from '@mastra/code-sdk/agents/credential-resolver';
import { RequestContext } from '@mastra/core/request-context';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────
// Mock the SDK OAuth provider registry so refresh/getApiKey behavior is
// deterministic; the store's snapshot hydration, precedence, and refresh
// delegation are what's under test.

const { refreshToken, getApiKeyFromCreds } = vi.hoisted(() => ({
  refreshToken: vi.fn(),
  getApiKeyFromCreds: vi.fn(),
}));
vi.mock('@mastra/code-sdk/auth/storage', () => ({
  PROVIDER_DEFAULT_MODELS: {
    anthropic: 'anthropic/claude-fable-5',
    'openai-codex': 'openai/gpt-5.6-sol',
    xai: 'xai/grok-4.5',
  },
  getOAuthProvider: (id: string) =>
    id === 'anthropic' || id === 'xai'
      ? {
          id,
          refreshToken: (...args: unknown[]) => refreshToken(...args),
          getApiKey: (...args: unknown[]) => getApiKeyFromCreds(...args),
        }
      : undefined,
}));

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import {
  TenantCredentialStore,
  createTenantCredentialPrimer,
  invalidateTenantCredentialSnapshots,
  primeTenantCredentialsForRequestContext,
  primeTenantCredentialsForTenant,
  registerTenantCredentialResolver,
  resetTenantCredentialResolverForTests,
  resolveTenantProviderDefaultModel,
} from './tenant-credentials.js';
import { fakeRouteAuth } from './test-utils.js';

let seed: FactoryStorageTestSeed;

const ORG = 'org1';
const USER = 'user-a';
const USER_TENANT = { orgId: ORG, userId: USER };
const ORG_TENANT = { orgId: ORG };

const FRESH_OAUTH = { type: 'oauth', refresh: 'r-1', access: 'a-1', expires: Date.now() + 3_600_000 } as const;
const EXPIRED_OAUTH = { type: 'oauth', refresh: 'r-old', access: 'a-old', expires: Date.now() - 1000 } as const;

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  getApiKeyFromCreds.mockImplementation(creds => (creds as { access: string }).access);
});

afterEach(() => {
  resetTenantCredentialResolverForTests();
  vi.clearAllMocks();
});

describe('TenantCredentialStore', () => {
  it('hydrates only user rows for user scope', async () => {
    await seed.credentials.setCredential(ORG_TENANT, 'openai', { type: 'api_key', key: 'org-key' });
    await seed.credentials.setCredential(USER_TENANT, 'openai', { type: 'api_key', key: 'user-key' });
    await seed.credentials.setCredential(ORG_TENANT, 'google', { type: 'api_key', key: 'org-google' });

    const store = new TenantCredentialStore(ORG, USER, seed.credentials, 'user');
    await store.ensureFresh();

    expect(store.getStoredApiKey('openai')).toBe('user-key');
    expect(store.getStoredApiKey('google')).toBeUndefined();
    expect(store.get('openai')).toEqual({ type: 'api_key', key: 'user-key' });
    expect(store.get('missing')).toBeUndefined();
  });

  it('getApiKey never falls from user scope to an org row', async () => {
    await seed.credentials.setCredential(ORG_TENANT, 'openai', { type: 'api_key', key: 'org-key' });
    const store = new TenantCredentialStore(ORG, USER, seed.credentials, 'user');
    await expect(store.getApiKey('openai')).resolves.toBeUndefined();

    await seed.credentials.setCredential(USER_TENANT, 'openai', { type: 'api_key', key: 'user-key' });
    await expect(store.getApiKey('openai')).resolves.toBe('user-key');
  });

  it('factory stores resolve only org rows with no user fallback', async () => {
    await seed.credentials.setCredential(ORG_TENANT, 'openai', { type: 'api_key', key: 'org-key' });
    await seed.credentials.setCredential(USER_TENANT, 'openai', { type: 'api_key', key: 'user-key' });
    await seed.credentials.setCredential(USER_TENANT, 'google', { type: 'api_key', key: 'user-google' });

    const store = new TenantCredentialStore(ORG, USER, seed.credentials, 'factory');
    await store.ensureFresh();

    expect(store.getStoredApiKey('openai')).toBe('org-key');
    expect(store.getStoredApiKey('google')).toBeUndefined();
    await expect(store.getApiKey('openai')).resolves.toBe('org-key');
    await expect(store.getApiKey('google')).resolves.toBeUndefined();
  });

  it('getApiKey returns undefined when no credential is stored (env fallback stays with the gateway)', async () => {
    const store = new TenantCredentialStore(ORG, USER, seed.credentials, 'user');
    await expect(store.getApiKey('openai')).resolves.toBeUndefined();
  });

  it('getApiKey serves non-expired OAuth tokens without refreshing', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'anthropic', FRESH_OAUTH);
    const store = new TenantCredentialStore(ORG, USER, seed.credentials, 'user');

    await expect(store.getApiKey('anthropic')).resolves.toBe('a-1');
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it('getApiKey refreshes expired OAuth tokens through the domain and updates the snapshot', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'anthropic', EXPIRED_OAUTH);
    const refreshed = { refresh: 'r-new', access: 'a-new', expires: Date.now() + 3_600_000 };
    refreshToken.mockResolvedValue(refreshed);

    const store = new TenantCredentialStore(ORG, USER, seed.credentials, 'user');
    await expect(store.getApiKey('anthropic')).resolves.toBe('a-new');
    expect(refreshToken).toHaveBeenCalledWith(expect.objectContaining({ refresh: 'r-old' }));

    // Persisted through the domain, not just in memory.
    const persisted = await seed.credentials.getCredential(USER_TENANT, 'anthropic');
    expect(persisted).toEqual(expect.objectContaining({ type: 'oauth', access: 'a-new' }));
    // Snapshot updated for subsequent sync reads.
    expect(store.get('anthropic')).toEqual(expect.objectContaining({ access: 'a-new' }));
  });

  it('getApiKey returns undefined when refresh fails (re-login required)', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'anthropic', EXPIRED_OAUTH);
    refreshToken.mockRejectedValue(new Error('invalid_grant'));

    const store = new TenantCredentialStore(ORG, USER, seed.credentials, 'user');
    await expect(store.getApiKey('anthropic')).resolves.toBeUndefined();
  });

  it('forceRefreshActiveAccount replaces a rejected, unexpired token and persists it', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'anthropic', FRESH_OAUTH);
    refreshToken.mockResolvedValue({ refresh: 'r-2', access: 'a-2', expires: Date.now() + 3_600_000 });
    const store = new TenantCredentialStore(ORG, USER, seed.credentials, 'user');
    await expect(store.getApiKey('anthropic')).resolves.toBe('a-1');

    await expect(store.forceRefreshActiveAccount('anthropic')).resolves.toBe('a-2');
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(refreshToken).toHaveBeenCalledWith(expect.objectContaining({ refresh: 'r-1' }));
    expect(await seed.credentials.getCredential(USER_TENANT, 'anthropic')).toMatchObject({ access: 'a-2' });
    // A resumed or later session reads the persisted token.
    const resumed = new TenantCredentialStore(ORG, USER, seed.credentials, 'user');
    await expect(resumed.getApiKey('anthropic')).resolves.toBe('a-2');
  });

  it('forceRefreshActiveAccount reuses a token another store already refreshed', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'anthropic', FRESH_OAUTH);
    refreshToken.mockResolvedValueOnce({ refresh: 'r-2', access: 'a-2', expires: Date.now() + 3_600_000 });
    const replicaA = new TenantCredentialStore(ORG, USER, seed.credentials, 'user');
    const replicaB = new TenantCredentialStore(ORG, USER, seed.credentials, 'user');
    await replicaA.getApiKey('anthropic');
    await replicaB.getApiKey('anthropic');

    // Both were served a-1 and both see it rejected; only one refresh may spend r-1.
    const tokens = await Promise.all([
      replicaA.forceRefreshActiveAccount('anthropic'),
      replicaB.forceRefreshActiveAccount('anthropic'),
    ]);
    expect(tokens).toEqual(['a-2', 'a-2']);
    expect(refreshToken).toHaveBeenCalledTimes(1);
  });

  it('forceRefreshActiveAccount returns undefined when the refresh fails or there is no OAuth credential', async () => {
    const store = new TenantCredentialStore(ORG, USER, seed.credentials, 'user');
    await expect(store.forceRefreshActiveAccount('anthropic')).resolves.toBeUndefined();

    await seed.credentials.setCredential(USER_TENANT, 'openai', { type: 'api_key', key: 'user-key' });
    await expect(store.forceRefreshActiveAccount('openai')).resolves.toBeUndefined();

    await seed.credentials.setCredential(USER_TENANT, 'anthropic', FRESH_OAUTH);
    refreshToken.mockRejectedValue(new Error('invalid_grant'));
    await expect(store.forceRefreshActiveAccount('anthropic')).resolves.toBeUndefined();
    expect(await seed.credentials.getCredential(USER_TENANT, 'anthropic')).toMatchObject({ access: 'a-1' });
  });

  it('getApiKey returns undefined for OAuth credentials of providers without a registered flow', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'unknown-provider', FRESH_OAUTH);
    const store = new TenantCredentialStore(ORG, USER, seed.credentials, 'user');
    await expect(store.getApiKey('unknown-provider')).resolves.toBeUndefined();
  });

  it('isolates tenants: user B never sees user A credentials', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'openai', { type: 'api_key', key: 'user-a-key' });

    const storeB = new TenantCredentialStore(ORG, 'user-b', seed.credentials, 'user');
    await storeB.ensureFresh();
    expect(storeB.getStoredApiKey('openai')).toBeUndefined();
    await expect(storeB.getApiKey('openai')).resolves.toBeUndefined();
  });

  it('drops removed credentials from the snapshot on authoritative reads', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'openai', { type: 'api_key', key: 'user-key' });
    const store = new TenantCredentialStore(ORG, USER, seed.credentials, 'user');
    await store.ensureFresh();
    expect(store.getStoredApiKey('openai')).toBe('user-key');

    await seed.credentials.removeCredential(USER_TENANT, 'openai');
    await expect(store.getApiKey('openai')).resolves.toBeUndefined();
    expect(store.get('openai')).toBeUndefined();
  });
});

describe('registerTenantCredentialResolver', () => {
  it('wires the SDK resolver to tenant stores derived from the request context', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'openai', { type: 'api_key', key: 'user-key' });
    registerTenantCredentialResolver(seed.credentials);

    const requestContext = new RequestContext();
    requestContext.set('user', { workosId: USER, organizationId: ORG });

    const store = resolveCredentialStore(requestContext);
    expect(store).toBeDefined();
    await expect(store!.getApiKey('openai')).resolves.toBe('user-key');
  });

  it('primes the trusted session owner instead of the sender or writable state', async () => {
    await seed.credentials.setCredential({ orgId: ORG, userId: 'owner' }, 'openai', {
      type: 'api_key',
      key: 'owner-key',
    });
    await seed.credentials.setCredential({ orgId: ORG, userId: 'sender' }, 'openai', {
      type: 'api_key',
      key: 'sender-key',
    });
    registerTenantCredentialResolver(seed.credentials, new Set(), async () => ({
      orgId: ORG,
      userId: 'owner',
      credentialScope: 'user',
    }));

    const ctx = new RequestContext();
    ctx.set('user', { workosId: 'sender', organizationId: ORG });
    ctx.set('controller', {
      state: { factoryModelScope: 'user', factoryOwnerUserId: 'owner', factoryOrgId: ORG },
    });
    await primeTenantCredentialsForRequestContext(ctx);

    expect(resolveCredentialStore(ctx)?.getStoredApiKey('openai')).toBe('owner-key');
  });

  it('does not sink a run when scoped snapshot priming fails', async () => {
    const error = new Error('storage unavailable');
    vi.spyOn(seed.credentials, 'listCredentials').mockRejectedValueOnce(error);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerTenantCredentialResolver(seed.credentials);

    await expect(
      primeTenantCredentialsForTenant({ orgId: ORG, userId: USER, credentialScope: 'user' }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[factory] Failed to prime scoped tenant model credentials', {
      orgId: ORG,
      userId: USER,
      credentialScope: 'user',
      error,
    });
  });

  it('returns the same store instance per tenant (snapshot reuse)', () => {
    registerTenantCredentialResolver(seed.credentials);
    const ctx = new RequestContext();
    ctx.set('user', { workosId: USER, organizationId: ORG });
    expect(resolveCredentialStore(ctx)).toBe(resolveCredentialStore(ctx));
  });

  it('invalidates both exclusive scope snapshots for a user', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'openai', { type: 'api_key', key: 'user-key' });
    await seed.credentials.setCredential(ORG_TENANT, 'openai', { type: 'api_key', key: 'org-key' });
    registerTenantCredentialResolver(seed.credentials, new Set(), async context => ({
      ...resolveAuthenticatedCredentialTenant(context)!,
      credentialScope: context.get('controller') ? 'factory' : 'user',
    }));

    const userContext = new RequestContext();
    userContext.set('user', { workosId: USER, organizationId: ORG });
    const factoryContext = new RequestContext();
    factoryContext.set('user', { workosId: USER, organizationId: ORG });
    factoryContext.set('controller', { resourceId: 'factory-session' });
    await primeTenantCredentialsForRequestContext(userContext);
    await primeTenantCredentialsForRequestContext(factoryContext);
    const userStore = resolveCredentialStore(userContext);
    const factoryStore = resolveCredentialStore(factoryContext);

    invalidateTenantCredentialSnapshots({ orgId: ORG, userId: USER });

    expect(resolveCredentialStore(userContext)).not.toBe(userStore);
    expect(resolveCredentialStore(factoryContext)).not.toBe(factoryStore);
  });

  it('allows deployment credentials only for providers the operator opted in', () => {
    const ctx = new RequestContext();
    ctx.set('user', { workosId: USER, organizationId: ORG });

    registerTenantCredentialResolver(seed.credentials);
    expect(resolveCredentialStore(ctx)?.allowsDeploymentCredentials?.('amazon-bedrock')).toBe(false);

    registerTenantCredentialResolver(seed.credentials, new Set(['amazon-bedrock']));
    const store = resolveCredentialStore(ctx);
    expect(store?.allowsDeploymentCredentials?.('amazon-bedrock')).toBe(true);
    expect(store?.allowsDeploymentCredentials?.('openai')).toBe(false);
  });

  it('scopes personal accounts (no org) under a synthetic per-user org', async () => {
    registerTenantCredentialResolver(seed.credentials);
    const ctx = new RequestContext();
    ctx.set('user', { workosId: USER });

    await seed.credentials.setCredential({ orgId: `user:${USER}`, userId: USER }, 'openai', {
      type: 'api_key',
      key: 'personal-key',
    });
    await expect(resolveCredentialStore(ctx)!.getApiKey('openai')).resolves.toBe('personal-key');
  });

  it('fails closed without an authenticated tenant', async () => {
    registerTenantCredentialResolver(seed.credentials);
    const withoutContext = resolveCredentialStore(undefined);
    const emptyContext = resolveCredentialStore(new RequestContext());

    expect(withoutContext).toMatchObject({ allowEnvironmentFallback: false });
    expect(emptyContext).toBe(withoutContext);
    await expect(withoutContext?.getApiKey('openai')).resolves.toBeUndefined();
  });

  it('clears registration on reset (local fallback restored)', () => {
    registerTenantCredentialResolver(seed.credentials);
    resetTenantCredentialResolverForTests();
    setCredentialStoreProvider(undefined);
    const ctx = new RequestContext();
    ctx.set('user', { workosId: USER, organizationId: ORG });
    expect(resolveCredentialStore(ctx)).toBeUndefined();
  });
});

describe('resolveTenantProviderDefaultModel', () => {
  const USER_SCOPE = { ...USER_TENANT, credentialScope: 'user' } as const;
  const FACTORY_SCOPE = { ...USER_TENANT, credentialScope: 'factory' } as const;

  it("picks the default model of the tenant's connected provider when the current model has no credential", async () => {
    registerTenantCredentialResolver(seed.credentials);
    await seed.credentials.setCredential(USER_TENANT, 'openai-codex', FRESH_OAUTH);

    await expect(resolveTenantProviderDefaultModel(USER_SCOPE, 'anthropic/claude-opus-5')).resolves.toBe(
      'openai/gpt-5.6-sol',
    );
    await expect(resolveTenantProviderDefaultModel(USER_SCOPE, undefined)).resolves.toBe('openai/gpt-5.6-sol');
  });

  it('keeps a current model the tenant can already call', async () => {
    registerTenantCredentialResolver(seed.credentials, new Set(['amazon-bedrock']));
    await seed.credentials.setCredential(USER_TENANT, 'openai-codex', FRESH_OAUTH);

    await expect(resolveTenantProviderDefaultModel(USER_SCOPE, 'openai/gpt-5.4')).resolves.toBeUndefined();
    await expect(resolveTenantProviderDefaultModel(USER_SCOPE, 'amazon-bedrock/claude')).resolves.toBeUndefined();
  });

  it("reads only the session's credential scope", async () => {
    registerTenantCredentialResolver(seed.credentials);
    await seed.credentials.setCredential(ORG_TENANT, 'xai', { type: 'api_key', key: 'org-xai' });

    await expect(resolveTenantProviderDefaultModel(USER_SCOPE, 'anthropic/claude-opus-5')).resolves.toBeUndefined();
    await expect(resolveTenantProviderDefaultModel(FACTORY_SCOPE, 'anthropic/claude-opus-5')).resolves.toBe(
      'xai/grok-4.5',
    );
  });

  it('prefers providers in subscription-default order', async () => {
    registerTenantCredentialResolver(seed.credentials);
    await seed.credentials.setCredential(USER_TENANT, 'xai', { type: 'api_key', key: 'user-xai' });
    await seed.credentials.setCredential(USER_TENANT, 'anthropic', FRESH_OAUTH);

    await expect(resolveTenantProviderDefaultModel(USER_SCOPE, 'google/gemini')).resolves.toBe(
      'anthropic/claude-fable-5',
    );
  });

  it('changes nothing before the tenant resolver is registered', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'anthropic', FRESH_OAUTH);
    await expect(resolveTenantProviderDefaultModel(USER_SCOPE, 'google/gemini')).resolves.toBeUndefined();
  });
});

describe('createTenantCredentialPrimer', () => {
  function buildApp(user: { workosId: string; organizationId?: string } | null) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      if (user) c.set('factoryAuthUser' as never, user as never);
      await next();
    });
    app.use('*', createTenantCredentialPrimer({ auth: fakeRouteAuth(), credentials: seed.credentials }));
    app.get('/ok', c => c.text('ok'));
    return app;
  }

  it('primes snapshots for both exclusive credential scopes', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'openai', { type: 'api_key', key: 'user-key' });
    await seed.credentials.setCredential(ORG_TENANT, 'openai', { type: 'api_key', key: 'org-key' });
    registerTenantCredentialResolver(seed.credentials, new Set(), async context => ({
      ...resolveAuthenticatedCredentialTenant(context)!,
      credentialScope: context.get('controller') ? 'factory' : 'user',
    }));

    const res = await buildApp({ workosId: USER, organizationId: ORG }).request('/ok');
    expect(res.status).toBe(200);

    const userContext = new RequestContext();
    userContext.set('user', { workosId: USER, organizationId: ORG });
    await prepareCredentialTenant(userContext);
    expect(resolveCredentialStore(userContext)!.getStoredApiKey('openai')).toBe('user-key');

    const factoryContext = new RequestContext();
    factoryContext.set('user', { workosId: USER, organizationId: ORG });
    factoryContext.set('controller', { resourceId: 'factory-session' });
    await prepareCredentialTenant(factoryContext);
    expect(resolveCredentialStore(factoryContext)!.getStoredApiKey('openai')).toBe('org-key');
  });

  it('passes unauthenticated requests through untouched', async () => {
    const res = await buildApp(null).request('/ok');
    expect(res.status).toBe(200);
  });
});
