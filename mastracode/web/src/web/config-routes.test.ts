import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import type { IMastraAuthProvider } from '@mastra/core/server';
import { buildConfigRoutes, listProviders } from './config-routes.js';
import { __resetRuntimeConfigForTests, seedRuntimeConfig } from './runtime-config.js';
import { seedFactoryStorageForTests } from './storage/test-utils.js';
import type { FactoryStorageTestSeed } from './storage/test-utils.js';
import { mountApiRoutes } from './test-utils.js';

function makeAuthStorage(opts: { loggedIn?: string[]; storedKeys?: string[] }): AuthStorage {
  const loggedIn = new Set(opts.loggedIn ?? []);
  const storedKeys = new Set(opts.storedKeys ?? []);
  return {
    isLoggedIn: (provider: string) => loggedIn.has(provider),
    hasStoredApiKey: (provider: string) => storedKeys.has(provider),
  } as unknown as AuthStorage;
}

function makeAgentController(models: { provider: string; hasApiKey: boolean; apiKeyEnvVar?: string }[]) {
  return { listAvailableModels: async () => models };
}

describe('listProviders', () => {
  const prevAnthropicKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (prevAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevAnthropicKey;
  });

  it('labels an OAuth-logged-in provider as oauth (not stored)', async () => {
    const auth = makeAuthStorage({ loggedIn: ['anthropic'], storedKeys: ['anthropic'] });

    const list = await listProviders(
      makeAgentController([{ provider: 'anthropic', hasApiKey: true, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]),
      auth,
    );

    expect(list).toHaveLength(1);
    expect(list[0]?.source).toBe('oauth');
  });

  it('maps the openai catalog provider to the openai-codex OAuth slot', async () => {
    const auth = makeAuthStorage({ loggedIn: ['openai-codex'] });

    const list = await listProviders(
      makeAgentController([{ provider: 'openai', hasApiKey: false, apiKeyEnvVar: 'OPENAI_API_KEY' }]),
      auth,
    );

    expect(list[0]?.source).toBe('oauth');
  });

  it('falls back to stored when not OAuth but a stored key exists', async () => {
    const auth = makeAuthStorage({ storedKeys: ['anthropic'] });

    const list = await listProviders(
      makeAgentController([{ provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]),
      auth,
    );

    expect(list[0]?.source).toBe('stored');
  });

  it('reports env when only the env var is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-env';
    const auth = makeAuthStorage({});

    const list = await listProviders(
      makeAgentController([{ provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]),
      auth,
    );

    expect(list[0]?.source).toBe('env');
  });

  it('reports none when no credentials are present', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const auth = makeAuthStorage({});

    const list = await listProviders(
      makeAgentController([{ provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]),
      auth,
    );

    expect(list[0]?.source).toBe('none');
  });

  it('advertises web OAuth capability for supported providers only', async () => {
    const list = await listProviders(
      makeAgentController([
        { provider: 'anthropic', hasApiKey: false },
        { provider: 'openai', hasApiKey: false },
        { provider: 'xai', hasApiKey: false },
        { provider: 'google', hasApiKey: false },
      ]),
    );
    const byProvider = Object.fromEntries(list.map(p => [p.provider, p]));
    expect(byProvider.anthropic?.oauth).toEqual({ supported: true, modes: ['paste-code'] });
    expect(byProvider.openai?.oauth).toEqual({ supported: true, modes: ['device-code'] });
    expect(byProvider.xai?.oauth).toEqual({ supported: true, modes: ['device-code'] });
    expect(byProvider.google?.oauth).toBeUndefined();
  });

  describe('tenant credential records', () => {
    const record = (provider: string, scope: 'user' | 'org', type: 'oauth' | 'api_key') => ({
      provider,
      scope,
      credential:
        type === 'oauth'
          ? ({ type: 'oauth', refresh: 'r', access: 'a', expires: Date.now() + 1000 } as const)
          : ({ type: 'api_key', key: 'k' } as const),
      updatedAt: new Date(),
    });

    it('resolves user > org and ignores the server environment in tenant mode', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-env';
      const controller = makeAgentController([
        { provider: 'anthropic', hasApiKey: true, apiKeyEnvVar: 'ANTHROPIC_API_KEY' },
      ]);

      const userWins = await listProviders(controller, undefined, [
        record('anthropic', 'user', 'api_key'),
        record('anthropic', 'org', 'api_key'),
      ]);
      expect(userWins[0]?.source).toBe('stored-user');

      const orgWins = await listProviders(controller, undefined, [record('anthropic', 'org', 'api_key')]);
      expect(orgWins[0]?.source).toBe('stored-org');

      const noTenantCredential = await listProviders(controller, undefined, []);
      expect(noTenantCredential[0]?.source).toBe('none');
    });

    it('reports oauth-user for a user OAuth token stored under the auth provider id', async () => {
      const list = await listProviders(
        makeAgentController([{ provider: 'openai', hasApiKey: false, apiKeyEnvVar: 'OPENAI_API_KEY' }]),
        undefined,
        [record('openai-codex', 'user', 'oauth')],
      );
      expect(list[0]?.source).toBe('oauth-user');
    });

    it('never falls back to the server-global auth storage in tenant mode', async () => {
      const auth = makeAuthStorage({ loggedIn: ['anthropic'] });
      const list = await listProviders(makeAgentController([{ provider: 'anthropic', hasApiKey: false }]), auth, []);
      // Tenant records take over entirely; auth.json state must not leak.
      expect(list[0]?.source).toBe('none');
    });
  });
});

// ── Scoped API key routes (tenant mode) ─────────────────────────────────

describe('provider key routes with a tenant', () => {
  let seed: FactoryStorageTestSeed;
  const isOrganizationAdmin = vi.fn(async () => true);
  const authProvider = {
    name: 'test',
    authenticateToken: vi.fn(async () => null),
    authorizeUser: vi.fn(async () => true),
    ensureOrganization: vi.fn(async () => undefined),
    isOrganizationAdmin,
  } as unknown as IMastraAuthProvider;

  const controller = makeAgentController([
    { provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' },
  ]);

  function buildApp(user: { workosId: string; organizationId?: string } | null, authStorage?: AuthStorage) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      if (user) c.set('webAuthUser' as never, user as never);
      await next();
    });
    mountApiRoutes(app as any, buildConfigRoutes({ controller, authStorage }));
    return app;
  }

  const userA = { workosId: 'user-a', organizationId: 'org1' };
  const userB = { workosId: 'user-b', organizationId: 'org1' };

  beforeEach(async () => {
    seed = await seedFactoryStorageForTests();
    isOrganizationAdmin.mockResolvedValue(true);
    seedRuntimeConfig({ storage: seed.storage, authProvider });
  });

  afterEach(() => {
    __resetRuntimeConfigForTests();
    vi.clearAllMocks();
  });

  const putKey = (app: Hono, body: unknown) =>
    app.request('/web/config/providers/anthropic/key', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('stores a user-scoped key by default, invisible to other members', async () => {
    const res = await putKey(buildApp(userA), { key: 'sk-mine' });
    expect(res.status).toBe(200);
    expect((await res.json()).provider?.source).toBe('stored-user');

    expect(await seed.credentials.getCredential({ orgId: 'org1', userId: 'user-a' }, 'anthropic')).toEqual({
      type: 'api_key',
      key: 'sk-mine',
    });
    expect(await seed.credentials.resolveCredential('org1', 'user-b', 'anthropic')).toBeUndefined();
  });

  it('stores an org-scoped key that all members inherit when the caller is an admin', async () => {
    const res = await putKey(buildApp(userA), { key: 'sk-shared', scope: 'org' });
    expect(res.status).toBe(200);
    expect((await res.json()).provider?.source).toBe('stored-org');
    expect(isOrganizationAdmin).toHaveBeenCalledWith('org1', 'user-a');

    const resolvedForB = await seed.credentials.resolveCredential('org1', 'user-b', 'anthropic');
    expect(resolvedForB).toMatchObject({ scope: 'org', credential: { key: 'sk-shared' } });
  });

  it('rejects org-scoped writes from non-admin members', async () => {
    isOrganizationAdmin.mockResolvedValue(false);
    const res = await putKey(buildApp(userA), { key: 'sk-shared', scope: 'org' });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'organization_admin_required' });
    expect(await seed.credentials.getCredential({ orgId: 'org1' }, 'anthropic')).toBeUndefined();
  });

  it('fails closed when org-admin authorization errors', async () => {
    isOrganizationAdmin.mockRejectedValue(new Error('identity provider unavailable'));
    const res = await putKey(buildApp(userA), { key: 'sk-shared', scope: 'org' });

    expect(res.status).toBe(403);
    expect(await seed.credentials.getCredential({ orgId: 'org1' }, 'anthropic')).toBeUndefined();
  });

  it('keeps user-scoped writes available to non-admin members', async () => {
    isOrganizationAdmin.mockResolvedValue(false);
    const res = await putKey(buildApp(userA), { key: 'sk-mine' });

    expect(res.status).toBe(200);
    expect(isOrganizationAdmin).not.toHaveBeenCalled();
  });

  it('user key wins over org key for the caller', async () => {
    await putKey(buildApp(userA), { key: 'sk-shared', scope: 'org' });
    await putKey(buildApp(userA), { key: 'sk-mine' });

    const resolved = await seed.credentials.resolveCredential('org1', 'user-a', 'anthropic');
    expect(resolved).toMatchObject({ scope: 'user', credential: { key: 'sk-mine' } });

    const listed = await buildApp(userA).request('/web/config/providers');
    const providers = (await listed.json()).providers;
    expect(providers.find((p: { provider: string }) => p.provider === 'anthropic')?.source).toBe('stored-user');
  });

  it('deletes only the requested scope when the caller is an admin', async () => {
    await putKey(buildApp(userA), { key: 'sk-shared', scope: 'org' });
    await putKey(buildApp(userA), { key: 'sk-mine' });

    const res = await buildApp(userA).request('/web/config/providers/anthropic/key?scope=org', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await seed.credentials.getCredential({ orgId: 'org1' }, 'anthropic')).toBeUndefined();
    expect(await seed.credentials.getCredential({ orgId: 'org1', userId: 'user-a' }, 'anthropic')).toBeDefined();
  });

  it('rejects org-scoped deletes from non-admin members', async () => {
    await putKey(buildApp(userA), { key: 'sk-shared', scope: 'org' });
    isOrganizationAdmin.mockResolvedValue(false);

    const res = await buildApp(userA).request('/web/config/providers/anthropic/key?scope=org', { method: 'DELETE' });

    expect(res.status).toBe(403);
    expect(await seed.credentials.getCredential({ orgId: 'org1' }, 'anthropic')).toBeDefined();
  });

  it("GET /web/config/providers reflects the caller's own view", async () => {
    await putKey(buildApp(userA), { key: 'sk-mine' });

    const forB = await buildApp(userB).request('/web/config/providers');
    const providersB = (await forB.json()).providers;
    expect(providersB.find((p: { provider: string }) => p.provider === 'anthropic')?.source).toBe('none');
  });

  it('never touches the file-backed AuthStorage in tenant mode', async () => {
    const setStoredApiKey = vi.fn();
    const authStorage = { setStoredApiKey } as unknown as AuthStorage;
    await putKey(buildApp(userA, authStorage), { key: 'sk-mine' });
    expect(setStoredApiKey).not.toHaveBeenCalled();
  });
});
