import { resolveCredentialStore, setCredentialStoreProvider } from '@mastra/code-sdk/agents/credential-resolver';
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
  registerTenantCredentialResolver,
  resetTenantCredentialResolverForTests,
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
  it('hydrates a snapshot with user rows winning over org rows', async () => {
    await seed.credentials.setCredential(ORG_TENANT, 'openai', { type: 'api_key', key: 'org-key' });
    await seed.credentials.setCredential(USER_TENANT, 'openai', { type: 'api_key', key: 'user-key' });
    await seed.credentials.setCredential(ORG_TENANT, 'google', { type: 'api_key', key: 'org-google' });

    const store = new TenantCredentialStore(ORG, USER, seed.credentials);
    await store.ensureFresh();

    expect(store.getStoredApiKey('openai')).toBe('user-key');
    expect(store.getStoredApiKey('google')).toBe('org-google');
    expect(store.get('openai')).toEqual({ type: 'api_key', key: 'user-key' });
    expect(store.get('missing')).toBeUndefined();
  });

  it('getApiKey resolves api keys with user > org precedence', async () => {
    await seed.credentials.setCredential(ORG_TENANT, 'openai', { type: 'api_key', key: 'org-key' });
    const store = new TenantCredentialStore(ORG, USER, seed.credentials);
    await expect(store.getApiKey('openai')).resolves.toBe('org-key');

    await seed.credentials.setCredential(USER_TENANT, 'openai', { type: 'api_key', key: 'user-key' });
    await expect(store.getApiKey('openai')).resolves.toBe('user-key');
  });

  it('getApiKey returns undefined when no credential is stored (env fallback stays with the gateway)', async () => {
    const store = new TenantCredentialStore(ORG, USER, seed.credentials);
    await expect(store.getApiKey('openai')).resolves.toBeUndefined();
  });

  it('getApiKey serves non-expired OAuth tokens without refreshing', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'anthropic', FRESH_OAUTH);
    const store = new TenantCredentialStore(ORG, USER, seed.credentials);

    await expect(store.getApiKey('anthropic')).resolves.toBe('a-1');
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it('getApiKey refreshes expired OAuth tokens through the domain and updates the snapshot', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'anthropic', EXPIRED_OAUTH);
    const refreshed = { refresh: 'r-new', access: 'a-new', expires: Date.now() + 3_600_000 };
    refreshToken.mockResolvedValue(refreshed);

    const store = new TenantCredentialStore(ORG, USER, seed.credentials);
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

    const store = new TenantCredentialStore(ORG, USER, seed.credentials);
    await expect(store.getApiKey('anthropic')).resolves.toBeUndefined();
  });

  it('getApiKey returns undefined for OAuth credentials of providers without a registered flow', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'unknown-provider', FRESH_OAUTH);
    const store = new TenantCredentialStore(ORG, USER, seed.credentials);
    await expect(store.getApiKey('unknown-provider')).resolves.toBeUndefined();
  });

  it('isolates tenants: user B never sees user A credentials', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'openai', { type: 'api_key', key: 'user-a-key' });

    const storeB = new TenantCredentialStore(ORG, 'user-b', seed.credentials);
    await storeB.ensureFresh();
    expect(storeB.getStoredApiKey('openai')).toBeUndefined();
    await expect(storeB.getApiKey('openai')).resolves.toBeUndefined();
  });

  it('drops removed credentials from the snapshot on authoritative reads', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'openai', { type: 'api_key', key: 'user-key' });
    const store = new TenantCredentialStore(ORG, USER, seed.credentials);
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

  it('returns the same store instance per tenant (snapshot reuse)', () => {
    registerTenantCredentialResolver(seed.credentials);
    const ctx = new RequestContext();
    ctx.set('user', { workosId: USER, organizationId: ORG });
    expect(resolveCredentialStore(ctx)).toBe(resolveCredentialStore(ctx));
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

  it('primes the caller snapshot so the first model call sees tenant credentials', async () => {
    await seed.credentials.setCredential(USER_TENANT, 'openai', { type: 'api_key', key: 'user-key' });
    registerTenantCredentialResolver(seed.credentials);

    const res = await buildApp({ workosId: USER, organizationId: ORG }).request('/ok');
    expect(res.status).toBe(200);

    const ctx = new RequestContext();
    ctx.set('user', { workosId: USER, organizationId: ORG });
    // Snapshot already hydrated by the primer — sync read works immediately.
    expect(resolveCredentialStore(ctx)!.getStoredApiKey('openai')).toBe('user-key');
  });

  it('passes unauthenticated requests through untouched', async () => {
    const res = await buildApp(null).request('/ok');
    expect(res.status).toBe(200);
  });
});
