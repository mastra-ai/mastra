import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { DEFAULT_OM_MODEL_ID } from '@mastra/code-sdk/constants';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __clearSessionSandboxesForTests, getSessionSandbox } from '../sandbox/session-sandbox.js';
import { factoryMemorySettingsUserId } from '../storage/domains/memory-settings/base.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { buildProviderAccess, ConfigRoutes, listProviders } from './config.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

function makeAuthStorage(opts: { loggedIn?: string[]; storedKeys?: string[] }): AuthStorage {
  const loggedIn = new Set(opts.loggedIn ?? []);
  const storedKeys = new Set(opts.storedKeys ?? []);
  return {
    get: (provider: string) => (loggedIn.has(provider) ? { type: 'oauth', refresh: 'r', access: 'a' } : undefined),
    isLoggedIn: (provider: string) => loggedIn.has(provider),
    hasStoredApiKey: (provider: string) => storedKeys.has(provider),
  } as unknown as AuthStorage;
}

function makeAgentController(models: { provider: string; hasApiKey: boolean; apiKeyEnvVar?: string }[]) {
  return { listAvailableModels: async () => models };
}

describe('GET /web/config/features', () => {
  it.each([
    { features: undefined, expected: false },
    { features: { knowledge: true }, expected: true },
  ])('reports the server-side knowledge gate as $expected', async ({ features, expected }) => {
    const app = new Hono();
    mountApiRoutes(
      app as never,
      new ConfigRoutes({
        auth: fakeRouteAuth({ enabled: false }),
        controller: makeAgentController([]),
        features,
      }).routes(),
    );

    const response = await app.request('/web/config/features');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ knowledge: expected });
  });
});

describe('listProviders', () => {
  const prevAnthropicKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (prevAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevAnthropicKey;
  });

  it('labels an OAuth-logged-in provider as oauth (not stored)', async () => {
    const auth = makeAuthStorage({ loggedIn: ['anthropic'], storedKeys: ['anthropic'] });

    const list = await listProviders({
      controller: makeAgentController([{ provider: 'anthropic', hasApiKey: true, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]),
      authStorage: auth,
    });

    expect(list).toHaveLength(1);
    expect(list[0]?.source).toBe('oauth');
  });

  it('maps the openai catalog provider to the openai-codex OAuth slot', async () => {
    const auth = makeAuthStorage({ loggedIn: ['openai-codex'] });

    const list = await listProviders({
      controller: makeAgentController([{ provider: 'openai', hasApiKey: false, apiKeyEnvVar: 'OPENAI_API_KEY' }]),
      authStorage: auth,
    });

    expect(list[0]?.source).toBe('oauth');
  });

  it('falls back to stored when not OAuth but a stored key exists', async () => {
    const auth = makeAuthStorage({ storedKeys: ['anthropic'] });

    const list = await listProviders({
      controller: makeAgentController([{ provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]),
      authStorage: auth,
    });

    expect(list[0]?.source).toBe('stored');
  });

  it('reports env when only the env var is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-env';
    const auth = makeAuthStorage({});

    const list = await listProviders({
      controller: makeAgentController([{ provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]),
      authStorage: auth,
    });

    expect(list[0]?.source).toBe('env');
  });

  it('reports none when no credentials are present', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const auth = makeAuthStorage({});

    const list = await listProviders({
      controller: makeAgentController([{ provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]),
      authStorage: auth,
    });

    expect(list[0]?.source).toBe('none');
  });

  it('advertises web OAuth capability for supported providers only', async () => {
    const list = await listProviders({
      controller: makeAgentController([
        { provider: 'anthropic', hasApiKey: false },
        { provider: 'openai', hasApiKey: false },
        { provider: 'xai', hasApiKey: false },
        { provider: 'google', hasApiKey: false },
      ]),
    });
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

      const userWins = await listProviders({
        controller,
        tenantCredentials: [record('anthropic', 'user', 'api_key'), record('anthropic', 'org', 'api_key')],
      });
      expect(userWins[0]?.source).toBe('stored-user');

      const orgWins = await listProviders({ controller, tenantCredentials: [record('anthropic', 'org', 'api_key')] });
      expect(orgWins[0]?.source).toBe('stored-org');

      const noTenantCredential = await listProviders({ controller, tenantCredentials: [] });
      expect(noTenantCredential[0]?.source).toBe('none');
    });

    it('reports oauth-user for a user OAuth token stored under the auth provider id', async () => {
      const list = await listProviders({
        controller: makeAgentController([{ provider: 'openai', hasApiKey: false, apiKeyEnvVar: 'OPENAI_API_KEY' }]),
        tenantCredentials: [record('openai-codex', 'user', 'oauth')],
      });
      expect(list[0]?.source).toBe('oauth-user');
    });

    it('reports orgKey when an org-wide API key exists, even when shadowed by a personal credential', async () => {
      const controller = makeAgentController([{ provider: 'anthropic', hasApiKey: false }]);

      const shadowed = await listProviders({
        controller,
        tenantCredentials: [record('anthropic', 'user', 'api_key'), record('anthropic', 'org', 'api_key')],
      });
      expect(shadowed[0]).toMatchObject({ source: 'stored-user', orgKey: true });

      const personalOnly = await listProviders({
        controller,
        tenantCredentials: [record('anthropic', 'user', 'api_key')],
      });
      expect(personalOnly[0]).toMatchObject({ source: 'stored-user', orgKey: false });

      // Local (non-tenant) mode has no scope concept — the field is omitted.
      const local = await listProviders({ controller, authStorage: makeAuthStorage({ loggedIn: [] }) });
      expect(local[0]?.orgKey).toBeUndefined();
    });

    it('never falls back to the server-global auth storage in tenant mode', async () => {
      const auth = makeAuthStorage({ loggedIn: ['anthropic'] });
      const list = await listProviders({
        controller: makeAgentController([{ provider: 'anthropic', hasApiKey: false }]),
        authStorage: auth,
        tenantCredentials: [],
      });
      // Tenant records take over entirely; auth.json state must not leak.
      expect(list[0]?.source).toBe('none');
    });
  });
});

describe('buildProviderAccess', () => {
  it('does not expose catalog or environment credentials in tenant mode', async () => {
    const access = await buildProviderAccess({
      controller: makeAgentController([
        { provider: 'anthropic', hasApiKey: true },
        { provider: 'cerebras', hasApiKey: true },
        { provider: 'google', hasApiKey: true },
        { provider: 'deepseek', hasApiKey: true },
        { provider: 'xai', hasApiKey: true },
      ]),
      tenantCredentials: [],
    });

    expect(access).toMatchObject({
      anthropic: false,
      cerebras: false,
      google: false,
      deepseek: false,
      xai: false,
    });
  });

  it('uses scoped tenant credentials for built-in and dynamic providers', async () => {
    const access = await buildProviderAccess({
      controller: makeAgentController([
        { provider: 'cerebras', hasApiKey: false },
        { provider: 'xai', hasApiKey: false },
      ]),
      tenantCredentials: [
        {
          provider: 'cerebras',
          scope: 'org',
          credential: { type: 'api_key', key: 'cerebras-key' },
          updatedAt: new Date(),
        },
        {
          provider: 'xai',
          scope: 'user',
          credential: { type: 'api_key', key: 'xai-key' },
          updatedAt: new Date(),
        },
      ],
    });

    expect(access.cerebras).toBe('apikey');
    expect(access.xai).toBe('apikey');
  });
});

// ── Scoped API key routes (tenant mode) ─────────────────────────────────

describe('provider key routes with a tenant', () => {
  let seed: FactoryStorageTestSeed;
  const isOrganizationAdmin = vi.fn(async () => true);

  const controller = makeAgentController([
    { provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' },
  ]);

  function buildApp(user: { workosId: string; organizationId?: string } | null, authStorage?: AuthStorage) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      if (user) c.set('factoryAuthUser' as never, user as never);
      await next();
    });
    mountApiRoutes(
      app as any,
      new ConfigRoutes({
        auth: fakeRouteAuth({ isOrganizationAdmin }),
        controller,
        authStorage,
        modelCredentials: seed.credentials,
        memorySettings: seed.memorySettings,
      }).routes(),
    );
    return app;
  }

  const userA = { workosId: 'user-a', organizationId: 'org1' };
  const userB = { workosId: 'user-b', organizationId: 'org1' };

  beforeEach(async () => {
    seed = await createFactoryStorageForTests();
    isOrganizationAdmin.mockResolvedValue(true);
  });

  afterEach(() => {
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

  it("seeds the caller's unset OM models from the provider of a user-scoped key", async () => {
    await putKey(buildApp(userA), { key: 'sk-mine' });
    expect(await seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' })).toMatchObject({
      observerModelId: 'anthropic/claude-haiku-4-5',
      reflectorModelId: 'anthropic/claude-haiku-4-5',
    });
  });

  it('does not seed OM models for an org-scoped key', async () => {
    await putKey(buildApp(userA), { key: 'sk-shared', scope: 'org' });
    expect(await seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' })).toBeNull();
  });

  it('still saves the key and returns 200 when OM seeding fails', async () => {
    vi.spyOn(seed.memorySettings, 'patch').mockRejectedValueOnce(new Error('memory settings unavailable'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const res = await putKey(buildApp(userA), { key: 'sk-mine' });

    expect(res.status).toBe(200);
    expect(await seed.credentials.getCredential({ orgId: 'org1', userId: 'user-a' }, 'anthropic')).toMatchObject({
      type: 'api_key',
      key: 'sk-mine',
    });
    expect(await seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' })).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('seed personal OM defaults'), expect.anything());
    warn.mockRestore();
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

// ── Available models + DB-backed model packs (tenant mode) ──────────────

describe('GET /web/config/models', () => {
  it('returns only credentialed models with their ids', async () => {
    const controller = {
      listAvailableModels: async () => [
        { id: 'anthropic/claude-fable-5', modelName: 'claude-fable-5', provider: 'anthropic', hasApiKey: true },
        { id: 'openai/gpt-5.6', modelName: 'gpt-5.6', provider: 'openai', hasApiKey: false },
        { provider: 'google', hasApiKey: true }, // no id — dropped
      ],
    };
    const app = new Hono();
    mountApiRoutes(app as any, new ConfigRoutes({ auth: fakeRouteAuth({ enabled: false }), controller }).routes());

    const res = await app.request('/web/config/models');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      models: [{ id: 'anthropic/claude-fable-5', provider: 'anthropic', modelName: 'claude-fable-5', hasApiKey: true }],
    });
  });

  it('includes only models reachable through tenant credentials', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'anthropic', {
      type: 'oauth',
      refresh: 'refresh',
      access: 'access',
      expires: Date.now() + 60_000,
    });
    const controller = {
      listAvailableModels: async () => [
        { id: 'anthropic/claude-fable-5', modelName: 'claude-fable-5', provider: 'anthropic', hasApiKey: false },
        { id: 'openai/gpt-5.6', modelName: 'gpt-5.6', provider: 'openai', hasApiKey: true },
        { id: 'google/gemini', modelName: 'gemini', provider: 'google', hasApiKey: false },
      ],
    };
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser' as never, { workosId: 'user-a', organizationId: 'org1' } as never);
      await next();
    });
    mountApiRoutes(
      app as any,
      new ConfigRoutes({ auth: fakeRouteAuth(), controller, modelCredentials: seed.credentials }).routes(),
    );

    const res = await app.request('/web/config/models');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      models: [{ id: 'anthropic/claude-fable-5', provider: 'anthropic', modelName: 'claude-fable-5', hasApiKey: true }],
    });
  });

  it('appends the caller org custom provider models from the DB', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.customProviders.upsert({
      orgId: 'org1',
      userId: 'user-a',
      input: { providerId: 'acme', name: 'Acme', url: 'https://llm.acme.dev/v1', apiKey: 'sk', models: ['fast-1'] },
    });
    // Another org's providers must never leak into the caller's catalog.
    await seed.customProviders.upsert({
      orgId: 'org2',
      userId: 'user-b',
      input: { providerId: 'other', name: 'Other', url: 'https://other.dev/v1', models: ['m-1'] },
    });
    const controller = { listAvailableModels: async () => [] };
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser' as never, { workosId: 'user-a', organizationId: 'org1' } as never);
      await next();
    });
    mountApiRoutes(
      app as any,
      new ConfigRoutes({
        auth: fakeRouteAuth(),
        controller,
        modelCredentials: seed.credentials,
        customProviders: seed.customProviders,
      }).routes(),
    );

    const res = await app.request('/web/config/models');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      models: [{ id: 'acme/fast-1', provider: 'acme', modelName: 'fast-1', hasApiKey: true }],
    });
  });
});

describe('model pack routes with a tenant', () => {
  let seed: FactoryStorageTestSeed;

  function sourceSession(sessionId: string): SourceControlSession {
    const now = new Date();
    return {
      id: `row-${sessionId}`,
      sessionId,
      projectRepositoryId: 'repo-1',
      orgId: 'org1',
      userId: 'user-a',
      branch: `user/${sessionId}`,
      title: null,
      baseBranch: 'main',
      sandboxId: 'sandbox-1',
      sandboxWorkdir: `/tmp/${sessionId}`,
      materializedAt: null,
      firstMessageAt: null,
      firstMeaningfulExecAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }
  const controller = makeAgentController([
    { provider: 'anthropic', hasApiKey: true, apiKeyEnvVar: 'ANTHROPIC_API_KEY' },
  ]);

  function buildApp(user: { workosId: string; organizationId?: string } | null, routeController = controller) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      if (user) c.set('factoryAuthUser' as never, user as never);
      await next();
    });
    mountApiRoutes(
      app as any,
      new ConfigRoutes({
        auth: fakeRouteAuth(),
        controller: routeController,
        modelPacks: seed.modelPacks,
        sourceControlSessions: {
          getBySessionId: vi.fn(async sessionId => (sessionId === 'session-1' ? sourceSession(sessionId) : null)),
        },
      }).routes(),
    );
    return app;
  }

  const userA = { workosId: 'user-a', organizationId: 'org1' };
  const userB = { workosId: 'user-b', organizationId: 'org1' };
  const userOtherOrg = { workosId: 'user-c', organizationId: 'org2' };
  const packBody = {
    name: 'Team pack',
    models: { build: 'anthropic/claude-fable-5', plan: 'anthropic/claude-fable-5', fast: 'anthropic/claude-haiku-4-5' },
  };

  const postPack = (app: Hono, body: unknown) =>
    app.request('/web/config/model-packs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeEach(async () => {
    seed = await createFactoryStorageForTests();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated pack access when web auth is enabled', async () => {
    const res = await buildApp(null).request('/web/config/model-packs');
    expect(res.status).toBe(401);
  });

  it('includes only builtin packs reachable through tenant credentials', async () => {
    const controllerWithoutEnv = makeAgentController([
      { provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' },
      { provider: 'openai', hasApiKey: true, apiKeyEnvVar: 'OPENAI_API_KEY' },
    ]);
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'anthropic', {
      type: 'oauth',
      refresh: 'refresh',
      access: 'access',
      expires: Date.now() + 60_000,
    });
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser' as never, userA as never);
      await next();
    });
    mountApiRoutes(
      app as any,
      new ConfigRoutes({
        auth: fakeRouteAuth(),
        controller: controllerWithoutEnv,
        modelCredentials: seed.credentials,
        modelPacks: seed.modelPacks,
      }).routes(),
    );

    const listed = await app.request('/web/config/model-packs');
    expect(listed.status).toBe(200);
    const { packs } = await listed.json();
    expect(packs.find((p: { id: string }) => p.id === 'anthropic')).toMatchObject({
      name: 'Anthropic',
      custom: false,
    });
    expect(packs.find((p: { id: string }) => p.id === 'openai')).toBeUndefined();
  });

  it('persists custom packs in the org-scoped storage domain', async () => {
    const created = await postPack(buildApp(userA), packBody);
    expect(created.status).toBe(200);
    const { pack } = await created.json();
    expect(pack).toMatchObject({ name: 'Team pack', models: packBody.models });
    expect(pack.id).toMatch(/^custom:/);

    const stored = await seed.modelPacks.list({ orgId: 'org1' });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ createdBy: 'user-a', name: 'Team pack' });

    const listed = await buildApp(userA).request('/web/config/model-packs');
    const { packs } = await listed.json();
    expect(packs.find((p: { id: string }) => p.id === pack.id)).toMatchObject({ custom: true, active: false });
  });

  it('persists one personal active pack without requiring an open session', async () => {
    const created = await postPack(buildApp(userA), packBody);
    const { pack } = await created.json();
    const activated = await buildApp(userA).request(`/web/config/model-packs/${encodeURIComponent(pack.id)}/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(activated.status).toBe(200);
    expect(await activated.json()).toEqual({ ok: true, target: 'default', activePackId: pack.id });
    expect(await seed.modelPacks.getActive({ orgId: 'org1', userId: 'user-a' })).toMatchObject({
      packId: pack.id,
      models: packBody.models,
    });

    const userAList = await buildApp(userA).request('/web/config/model-packs');
    const userBList = await buildApp(userB).request('/web/config/model-packs');
    expect((await userAList.json()).activePackId).toBe(pack.id);
    expect((await userBList.json()).activePackId).toBeNull();
  });

  it('clears a personal default pack', async () => {
    const created = await postPack(buildApp(userA), packBody);
    const { pack } = await created.json();
    await buildApp(userA).request(`/web/config/model-packs/${encodeURIComponent(pack.id)}/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target: 'default' }),
    });

    const cleared = await buildApp(userA).request('/web/config/model-packs/active', { method: 'DELETE' });

    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toEqual({ ok: true, activePackId: null });
    expect(await seed.modelPacks.getActive({ orgId: 'org1', userId: 'user-a' })).toBeNull();
  });

  it('rejects unknown activation targets', async () => {
    const response = await buildApp(userA).request('/web/config/model-packs/anthropic/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target: 'factory' }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'target must be "default" or "session"' });
  });

  it('applies a pack to a no-scope user session without changing the personal default', async () => {
    const created = await postPack(buildApp(userA), packBody);
    const { pack } = await created.json();
    const modelSwitch = vi.fn().mockResolvedValue(undefined);
    let sessionPackId: string | null = null;
    const setSetting = vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
      if (key === 'activeModelPackId' && typeof value === 'string') sessionPackId = value;
    });
    const sessionController = {
      ...controller,
      getSessionByResource: vi.fn().mockResolvedValue({
        mode: { get: () => 'build' },
        model: { switch: modelSwitch },
        subagents: { model: { set: vi.fn().mockResolvedValue(undefined) } },
        thread: { getId: () => 'session-1', getSetting: vi.fn().mockImplementation(() => sessionPackId), setSetting },
      }),
    };

    const activated = await buildApp(userA, sessionController).request(
      `/web/config/model-packs/${encodeURIComponent(pack.id)}/activate`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target: 'session', resourceId: 'session-1' }),
      },
    );

    expect(activated.status).toBe(200);
    expect(await activated.json()).toEqual({ ok: true, target: 'session', sessionPackId: pack.id });
    expect(modelSwitch).toHaveBeenCalledExactlyOnceWith({ modelId: packBody.models.build });
    expect(setSetting).toHaveBeenCalledWith({ key: 'activeModelPackId', value: pack.id });
    expect(await seed.modelPacks.getActive({ orgId: 'org1', userId: 'user-a' })).toBeNull();

    const listed = await buildApp(userA, sessionController).request('/web/config/model-packs?resourceId=session-1');
    expect(await listed.json()).toMatchObject({ activePackId: null, sessionPackId: pack.id });
  });

  it('rejects a scoped request when only the persisted workdir column matches (fail closed)', async () => {
    // The persisted sandboxWorkdir is observability, never an authorization
    // input — a row written under a previous provider could authorize a
    // stale scope. With no live memo entry, a scope matching the persisted
    // column must NOT authorize.
    __clearSessionSandboxesForTests();
    const sessionController = { ...controller, getSessionByResource: vi.fn().mockResolvedValue({}) };
    const app = buildApp(userA, sessionController);

    const listed = await app.request('/web/config/model-packs?resourceId=session-1&scope=%2Ftmp%2Fsession-1');

    expect(listed.status).toBe(404);
    expect(sessionController.getSessionByResource).not.toHaveBeenCalled();
  });

  it('authorizes a scoped request against the live memoized workdir', async () => {
    __clearSessionSandboxesForTests();
    // Local-provider memo seed: the derived workdir is <workingDirectory>/<repo name>.
    getSessionSandbox(
      'row-session-1',
      'seed/session-1',
      () => ({ id: 'sb-live', provider: 'local', workingDirectory: '/live' }) as never,
    );
    const sessionController = {
      ...controller,
      getSessionByResource: vi.fn().mockResolvedValue({
        thread: { getId: () => 'session-1', getSetting: vi.fn(() => null) },
      }),
    };
    const app = buildApp(userA, sessionController);

    const listed = await app.request('/web/config/model-packs?resourceId=session-1&scope=%2Flive%2Fsession-1');

    expect(listed.status).toBe(200);
    expect(sessionController.getSessionByResource).toHaveBeenCalledWith('session-1', '/live/session-1');
  });

  it("does not expose or mutate another user's session pack", async () => {
    const sessionController = {
      ...controller,
      getSessionByResource: vi.fn().mockResolvedValue({}),
    };
    const app = buildApp(userB, sessionController);

    const listed = await app.request('/web/config/model-packs?resourceId=session-1&scope=%2Ftmp%2Fsession-1');
    const activated = await app.request('/web/config/model-packs/anthropic/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target: 'session', resourceId: 'session-1', scope: '/tmp/session-1' }),
    });

    expect(listed.status).toBe(404);
    expect(activated.status).toBe(404);
    expect(sessionController.getSessionByResource).not.toHaveBeenCalled();
  });

  it("does not expose or mutate another user's session pack when scope is omitted", async () => {
    const sessionController = {
      ...controller,
      getSessionByResource: vi.fn().mockResolvedValue({}),
    };
    const app = buildApp(userB, sessionController);

    const listed = await app.request('/web/config/model-packs?resourceId=session-1');
    const activated = await app.request('/web/config/model-packs/anthropic/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target: 'session', resourceId: 'session-1' }),
    });

    expect(listed.status).toBe(404);
    expect(activated.status).toBe(404);
    expect(sessionController.getSessionByResource).not.toHaveBeenCalled();
  });

  it('rejects a valid resource with a different session scope', async () => {
    const sessionController = {
      ...controller,
      getSessionByResource: vi.fn().mockResolvedValue({}),
    };

    const response = await buildApp(userA, sessionController).request('/web/config/model-packs/anthropic/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target: 'session', resourceId: 'session-1', scope: '/tmp/other-session' }),
    });

    expect(response.status).toBe(404);
    expect(sessionController.getSessionByResource).not.toHaveBeenCalled();
  });

  it('fails closed when session authorization storage is unavailable', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser' as never, userA as never);
      await next();
    });
    mountApiRoutes(
      app as any,
      new ConfigRoutes({ auth: fakeRouteAuth(), controller, modelPacks: seed.modelPacks }).routes(),
    );

    const response = await app.request('/web/config/model-packs?resourceId=session-1&scope=%2Ftmp%2Fsession-1');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'session_authorization_unavailable' });
  });

  it('keeps packs invisible across organizations', async () => {
    await postPack(buildApp(userA), packBody);

    const otherOrgList = await buildApp(userOtherOrg).request('/web/config/model-packs');
    const { packs } = await otherOrgList.json();
    expect(packs.filter((p: { custom: boolean }) => p.custom)).toEqual([]);
  });

  it('deletes a pack by its custom-prefixed id within the org only', async () => {
    const created = await postPack(buildApp(userA), packBody);
    const { pack } = await created.json();

    const crossOrg = await buildApp(userOtherOrg).request(`/web/config/model-packs/${encodeURIComponent(pack.id)}`, {
      method: 'DELETE',
    });
    expect(crossOrg.status).toBe(404);
    expect(await seed.modelPacks.list({ orgId: 'org1' })).toHaveLength(1);

    const res = await buildApp(userA).request(`/web/config/model-packs/${encodeURIComponent(pack.id)}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    expect(await seed.modelPacks.list({ orgId: 'org1' })).toEqual([]);
  });

  it('validates the pack payload', async () => {
    expect((await postPack(buildApp(userA), { models: packBody.models })).status).toBe(400);
    expect((await postPack(buildApp(userA), { name: 'x', models: { build: 'a/b' } })).status).toBe(400);
  });

  it('uses a sentinel local row when auth is disabled — never settings.json', async () => {
    const app = new Hono();
    mountApiRoutes(
      app as any,
      new ConfigRoutes({ auth: fakeRouteAuth({ enabled: false }), controller, modelPacks: seed.modelPacks }).routes(),
    );

    const created = await postPack(app, packBody);
    expect(created.status).toBe(200);
    const { pack } = await created.json();

    const stored = await seed.modelPacks.list({ orgId: 'local' });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ createdBy: 'local', name: 'Team pack' });

    const listed = await app.request('/web/config/model-packs');
    const { packs } = await listed.json();
    expect(packs.find((p: { id: string }) => p.id === pack.id)).toMatchObject({ custom: true });

    const deleted = await app.request(`/web/config/model-packs/${encodeURIComponent(pack.id)}`, { method: 'DELETE' });
    expect(deleted.status).toBe(200);
    expect(await seed.modelPacks.list({ orgId: 'local' })).toEqual([]);
  });

  it('returns 503 when pack storage is unavailable', async () => {
    const app = new Hono();
    mountApiRoutes(app as any, new ConfigRoutes({ auth: fakeRouteAuth({ enabled: false }), controller }).routes());
    const res = await app.request('/web/config/model-packs');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'model_packs_unavailable' });
  });
});

describe('OM routes with a tenant', () => {
  let seed: FactoryStorageTestSeed;

  /** A minimal OM session whose role models live in a mutable map. */
  function makeOmSession() {
    const roleModels: Record<'observer' | 'reflector', string> = {
      observer: 'google/gemini-3-flash',
      reflector: 'anthropic/claude-haiku-4-5',
    };
    const state: Record<string, unknown> = {};
    const role = (name: 'observer' | 'reflector') => ({
      modelId: () => roleModels[name],
      threshold: () => undefined,
      switchModel: async ({ modelId }: { modelId: string }) => {
        roleModels[name] = modelId;
      },
    });
    return {
      mode: { get: () => 'build' },
      model: { switch: async () => {} },
      subagents: { model: { set: async () => {} } },
      thread: { getId: () => null, setSetting: async () => {}, list: async () => [] },
      state: {
        get: () => state,
        set: (updates: Record<string, unknown>) => {
          Object.assign(state, updates);
        },
      },
      om: { observer: role('observer'), reflector: role('reflector') },
    };
  }

  function buildApp(
    session: ReturnType<typeof makeOmSession> | null,
    opts: { withStorage?: boolean; authEnabled?: boolean; provider?: string } = {},
  ) {
    const controller = {
      ...makeAgentController([{ provider: opts.provider ?? 'anthropic', hasApiKey: true }]),
      getSessionByResource: async () => session ?? undefined,
    };
    const app = new Hono();
    if (opts.authEnabled !== false) {
      app.use('*', async (c, next) => {
        c.set('factoryAuthUser' as never, { workosId: 'user-a', organizationId: 'org1' } as never);
        await next();
      });
    }
    mountApiRoutes(
      app as any,
      new ConfigRoutes({
        auth: fakeRouteAuth({ enabled: opts.authEnabled !== false }),
        controller,
        modelCredentials: seed.credentials,
        ...(opts.withStorage === false ? {} : { memorySettings: seed.memorySettings, factoryProjects: seed.projects }),
      }).routes(),
    );
    return app;
  }

  const putJson = (app: Hono, path: string, body: unknown) =>
    app.request(path, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  const postJson = (app: Hono, path: string, body: unknown) =>
    app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeEach(async () => {
    seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'anthropic', {
      type: 'api_key',
      key: 'sk-anthropic',
    });
  });

  it('seeds provider-specific OM defaults without an active session', async () => {
    const res = await postJson(buildApp(makeOmSession()), '/web/config/om/provider-defaults', {
      providerId: 'anthropic',
      factoryModelId: 'anthropic/claude-fable-5',
    });

    expect(res.status).toBe(200);
    expect((await res.json()).config).toMatchObject({
      observerModelId: 'anthropic/claude-haiku-4-5',
      reflectorModelId: 'anthropic/claude-haiku-4-5',
    });
    await expect(seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' })).resolves.toMatchObject({
      observerModelId: 'anthropic/claude-haiku-4-5',
      reflectorModelId: 'anthropic/claude-haiku-4-5',
    });
  });

  it('seeds provider-specific OM defaults into the factory-scoped row when factoryId is given', async () => {
    const project = await seed.projects.create({ orgId: 'org1', userId: 'user-a', input: { name: 'Factory One' } });
    const res = await postJson(buildApp(makeOmSession()), '/web/config/om/provider-defaults', {
      providerId: 'anthropic',
      factoryModelId: 'anthropic/claude-fable-5',
      factoryId: project.id,
    });

    expect(res.status).toBe(200);
    expect((await res.json()).config).toMatchObject({
      observerModelId: 'anthropic/claude-haiku-4-5',
      reflectorModelId: 'anthropic/claude-haiku-4-5',
    });
    await expect(
      seed.memorySettings.get({ orgId: 'org1', userId: factoryMemorySettingsUserId(project.id) }),
    ).resolves.toMatchObject({
      observerModelId: 'anthropic/claude-haiku-4-5',
      reflectorModelId: 'anthropic/claude-haiku-4-5',
    });
    // The personal row must remain untouched.
    await expect(seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' })).resolves.toBeNull();
  });

  it('rejects factory-scoped OM access for a factory outside the caller org', async () => {
    const foreign = await seed.projects.create({ orgId: 'org2', userId: 'user-b', input: { name: 'Other Org' } });
    const app = buildApp(makeOmSession());

    const read = await app.request(`/web/config/om?factoryId=${foreign.id}`);
    expect(read.status).toBe(404);

    const write = await postJson(app, '/web/config/om/provider-defaults', {
      providerId: 'anthropic',
      factoryModelId: 'anthropic/claude-fable-5',
      factoryId: foreign.id,
    });
    expect(write.status).toBe(404);
    await expect(
      seed.memorySettings.get({ orgId: 'org1', userId: factoryMemorySettingsUserId(foreign.id) }),
    ).resolves.toBeNull();
  });

  it('reads the OpenAI OM default through a Codex credential', async () => {
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'openai-codex', {
      type: 'api_key',
      key: 'sk-openai',
    });

    const res = await postJson(buildApp(makeOmSession(), { provider: 'openai' }), '/web/config/om/provider-defaults', {
      providerId: 'openai',
      factoryModelId: 'openai/gpt-5.6',
    });

    expect(res.status).toBe(200);
    expect((await res.json()).config).toMatchObject({
      observerModelId: 'openai/gpt-5.4-mini',
      reflectorModelId: 'openai/gpt-5.4-mini',
    });
  });

  it('prefers the low-cost OM pack over the selected factory model', async () => {
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'google', {
      type: 'api_key',
      key: 'sk-google',
    });

    const res = await postJson(buildApp(makeOmSession(), { provider: 'google' }), '/web/config/om/provider-defaults', {
      providerId: 'google',
      factoryModelId: 'google/gemini-3.5-pro',
    });

    expect(res.status).toBe(200);
    expect((await res.json()).config).toMatchObject({
      observerModelId: 'google/gemini-3.5-flash',
      reflectorModelId: 'google/gemini-3.5-flash',
    });
  });

  it('keeps the selected factory model for providers without an OM pack', async () => {
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'xai', {
      type: 'api_key',
      key: 'sk-xai',
    });

    const res = await postJson(buildApp(makeOmSession(), { provider: 'xai' }), '/web/config/om/provider-defaults', {
      providerId: 'xai',
      factoryModelId: 'xai/grok-4.5',
    });

    expect(res.status).toBe(200);
    expect((await res.json()).config).toMatchObject({
      observerModelId: 'xai/grok-4.5',
      reflectorModelId: 'xai/grok-4.5',
    });
  });

  it('does not overwrite OM models that the user already selected', async () => {
    await seed.memorySettings.patch({
      orgId: 'org1',
      userId: 'user-a',
      patch: { observerModelId: 'anthropic/claude-fable-5' },
    });

    const res = await postJson(buildApp(makeOmSession()), '/web/config/om/provider-defaults', {
      providerId: 'anthropic',
      factoryModelId: 'anthropic/claude-fable-5',
    });

    expect(res.status).toBe(200);
    await expect(seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' })).resolves.toMatchObject({
      observerModelId: 'anthropic/claude-fable-5',
      reflectorModelId: 'anthropic/claude-haiku-4-5',
    });
  });

  it('persists a role model switch to the memory-settings domain, snapshotting the other role', async () => {
    const session = makeOmSession();
    const res = await putJson(buildApp(session), '/web/config/om/observer/model', {
      resourceId: 'r1',
      modelId: 'anthropic/claude-fable-5',
    });
    expect(res.status).toBe(200);
    expect((await res.json()).config.observerModelId).toBe('anthropic/claude-fable-5');

    const stored = await seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' });
    expect(stored).toMatchObject({
      observerModelId: 'anthropic/claude-fable-5',
      // The reflector's current model is pinned so a restart doesn't drift it.
      reflectorModelId: 'anthropic/claude-haiku-4-5',
    });
  });

  it('does not overwrite an explicitly stored other-role model on later switches', async () => {
    const session = makeOmSession();
    const app = buildApp(session);
    await putJson(app, '/web/config/om/reflector/model', { resourceId: 'r1', modelId: 'openai/gpt-5.6' });
    await putJson(app, '/web/config/om/observer/model', { resourceId: 'r1', modelId: 'anthropic/claude-fable-5' });

    const stored = await seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' });
    expect(stored).toMatchObject({
      observerModelId: 'anthropic/claude-fable-5',
      reflectorModelId: 'openai/gpt-5.6',
    });
  });

  it('persists thresholds to the memory-settings domain', async () => {
    const res = await putJson(buildApp(makeOmSession()), '/web/config/om/thresholds', {
      resourceId: 'r1',
      observationThreshold: 25000,
      reflectionThreshold: 45000,
    });
    expect(res.status).toBe(200);

    const stored = await seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' });
    expect(stored).toMatchObject({ observationThreshold: 25000, reflectionThreshold: 45000 });
  });

  it('persists observe-attachments to the memory-settings domain', async () => {
    const res = await putJson(buildApp(makeOmSession()), '/web/config/om/observe-attachments', {
      resourceId: 'r1',
      value: false,
    });
    expect(res.status).toBe(200);

    const stored = await seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' });
    expect(stored?.observeAttachments).toBe(false);
  });

  it('reads and updates persisted settings without an active session', async () => {
    const app = buildApp(makeOmSession());

    const initial = await app.request('/web/config/om');
    expect(initial.status).toBe(200);
    expect((await initial.json()).config).toMatchObject({
      observerModelId: DEFAULT_OM_MODEL_ID,
      reflectorModelId: DEFAULT_OM_MODEL_ID,
      observationThreshold: 30000,
      reflectionThreshold: 40000,
      observeAttachments: 'auto',
    });

    expect(
      (
        await putJson(app, '/web/config/om/observer/model', {
          modelId: 'anthropic/claude-fable-5',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await putJson(app, '/web/config/om/thresholds', {
          observationThreshold: 25000,
          reflectionThreshold: 45000,
        })
      ).status,
    ).toBe(200);
    expect((await putJson(app, '/web/config/om/observe-attachments', { value: false })).status).toBe(200);

    const persisted = await app.request('/web/config/om');
    expect((await persisted.json()).config).toMatchObject({
      observerModelId: 'anthropic/claude-fable-5',
      observationThreshold: 25000,
      reflectionThreshold: 45000,
      observeAttachments: false,
    });
  });

  it('falls back to the stored row when the resourceId has no live session', async () => {
    // The settings page addresses the factory-level resource, which has no
    // live agent-controller session after a restart or before any chat. The
    // stored row is authoritative and new sessions hydrate from it, so reads
    // and writes must succeed session-less instead of 404ing.
    const app = buildApp(null);

    const initial = await app.request('/web/config/om?resourceId=r1');
    expect(initial.status).toBe(200);
    expect((await initial.json()).config.observerModelId).toBe(DEFAULT_OM_MODEL_ID);

    expect(
      (await putJson(app, '/web/config/om/observer/model', { resourceId: 'r1', modelId: 'anthropic/claude-fable-5' }))
        .status,
    ).toBe(200);
    expect(
      (await putJson(app, '/web/config/om/thresholds', { resourceId: 'r1', observationThreshold: 25000 })).status,
    ).toBe(200);
    expect((await putJson(app, '/web/config/om/observe-attachments', { resourceId: 'r1', value: false })).status).toBe(
      200,
    );

    await expect(seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' })).resolves.toMatchObject({
      observerModelId: 'anthropic/claude-fable-5',
      observationThreshold: 25000,
      observeAttachments: false,
    });
  });

  it('returns 503 when tenant mode has no memory-settings storage', async () => {
    const res = await putJson(buildApp(makeOmSession(), { withStorage: false }), '/web/config/om/thresholds', {
      resourceId: 'r1',
      observationThreshold: 25000,
    });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('memory_settings_unavailable');
  });

  it('GET hydrates the session from the stored memory-settings row', async () => {
    await seed.memorySettings.patch({
      orgId: 'org1',
      userId: 'user-a',
      patch: { observerModelId: 'openai/gpt-5.6', observationThreshold: 12000, observeAttachments: false },
    });

    const session = makeOmSession();
    const res = await buildApp(session).request('/web/config/om?resourceId=r1');
    expect(res.status).toBe(200);
    const { config } = await res.json();
    // The stored row wins over the session's boot-time values.
    expect(config.observerModelId).toBe('openai/gpt-5.6');
    expect(config.observeAttachments).toBe(false);
    expect(session.state.get().observationThreshold).toBe(12000);
    // Knobs never explicitly stored reset to the built-in default — whatever
    // the session booted with is not authoritative.
    expect(config.reflectorModelId).toBe(DEFAULT_OM_MODEL_ID);
  });

  it('GET resets stale session values to defaults when no row is stored', async () => {
    // Simulates a session whose state still carries a pre-DB settings.json
    // seed (e.g. a custom-provider model from the host machine's TUI config).
    const session = makeOmSession();
    await session.om.observer.switchModel({ modelId: 'alibaba-token-plan/deepseek-v4-flash' });
    session.state.set({ observationThreshold: 99000 });

    const res = await buildApp(session).request('/web/config/om?resourceId=r1');
    expect(res.status).toBe(200);
    const { config } = await res.json();
    expect(config.observerModelId).toBe(DEFAULT_OM_MODEL_ID);
    expect(config.reflectorModelId).toBe(DEFAULT_OM_MODEL_ID);
    expect(config.observationThreshold).toBe(30000);
  });

  it('uses a sentinel local row when auth is disabled — never settings.json', async () => {
    const session = makeOmSession();
    const app = buildApp(session, { authEnabled: false });
    const res = await putJson(app, '/web/config/om/thresholds', { resourceId: 'r1', observationThreshold: 7000 });
    expect(res.status).toBe(200);

    const stored = await seed.memorySettings.get({ orgId: 'local', userId: 'local' });
    expect(stored?.observationThreshold).toBe(7000);
  });
});

describe('custom provider routes', () => {
  let seed: FactoryStorageTestSeed;
  const controller = makeAgentController([{ provider: 'anthropic', hasApiKey: true }]);
  const onCustomProvidersChanged = vi.fn();

  function buildApp(
    user: { workosId: string; organizationId?: string } | null,
    opts: { withStorage?: boolean; authEnabled?: boolean } = {},
  ) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      if (user) c.set('factoryAuthUser' as never, user as never);
      await next();
    });
    mountApiRoutes(
      app as any,
      new ConfigRoutes({
        auth: fakeRouteAuth({ enabled: opts.authEnabled !== false }),
        controller,
        ...(opts.withStorage === false ? {} : { customProviders: seed.customProviders }),
        onCustomProvidersChanged,
      }).routes(),
    );
    return app;
  }

  const userA = { workosId: 'user-a', organizationId: 'org1' };
  const userOtherOrg = { workosId: 'user-c', organizationId: 'org2' };
  const providerBody = { name: 'My LLM', url: 'https://llm.example.com/v1', apiKey: 'sk-x', models: ['m1', 'm2'] };

  const postProvider = (app: Hono, body: unknown) =>
    app.request('/web/config/custom-providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeEach(async () => {
    seed = await createFactoryStorageForTests();
    onCustomProvidersChanged.mockClear();
  });

  it('rejects unauthenticated access when web auth is enabled', async () => {
    expect((await buildApp(null).request('/web/config/custom-providers')).status).toBe(401);
  });

  it('persists providers in the org-scoped domain with keys redacted', async () => {
    const created = await postProvider(buildApp(userA), providerBody);
    expect(created.status).toBe(200);
    const { provider } = await created.json();
    expect(provider).toMatchObject({ name: 'My LLM', hasApiKey: true, models: ['m1', 'm2'] });
    expect(JSON.stringify(provider)).not.toContain('sk-x');

    const stored = await seed.customProviders.list({ orgId: 'org1' });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ createdBy: 'user-a', apiKey: 'sk-x' });
    expect(onCustomProvidersChanged).toHaveBeenCalledWith({ orgId: 'org1' });

    const listed = await buildApp(userA).request('/web/config/custom-providers');
    const { providers } = await listed.json();
    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({ id: provider.id, hasApiKey: true });
  });

  it('renames via previousId without leaving the old row behind', async () => {
    const created = await postProvider(buildApp(userA), providerBody);
    const { provider } = await created.json();

    const renamed = await postProvider(buildApp(userA), { ...providerBody, name: 'New Name', previousId: provider.id });
    expect(renamed.status).toBe(200);

    const stored = await seed.customProviders.list({ orgId: 'org1' });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.name).toBe('New Name');
  });

  it('keeps providers invisible across organizations', async () => {
    await postProvider(buildApp(userA), providerBody);

    const { providers } = await (await buildApp(userOtherOrg).request('/web/config/custom-providers')).json();
    expect(providers).toEqual([]);
  });

  it('deletes within the caller org only', async () => {
    const created = await postProvider(buildApp(userA), providerBody);
    const { provider } = await created.json();

    await buildApp(userOtherOrg).request(`/web/config/custom-providers/${provider.id}`, { method: 'DELETE' });
    expect(await seed.customProviders.list({ orgId: 'org1' })).toHaveLength(1);

    const res = await buildApp(userA).request(`/web/config/custom-providers/${provider.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await seed.customProviders.list({ orgId: 'org1' })).toEqual([]);
  });

  it('uses a sentinel local org when auth is disabled — never settings.json', async () => {
    const app = buildApp(null, { authEnabled: false });
    const created = await postProvider(app, providerBody);
    expect(created.status).toBe(200);

    const stored = await seed.customProviders.list({ orgId: 'local' });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ createdBy: 'local', name: 'My LLM' });
  });

  it('returns 503 when storage is unavailable', async () => {
    const res = await buildApp(userA, { withStorage: false }).request('/web/config/custom-providers');
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('custom_providers_unavailable');
  });

  it('validates the payload', async () => {
    expect((await postProvider(buildApp(userA), { url: 'https://x.example' })).status).toBe(400);
    expect((await postProvider(buildApp(userA), { name: 'x', url: 'ftp://bad' })).status).toBe(400);
  });
});

describe('thinking defaults routes', () => {
  let settingsPath: string;
  const controller = {
    ...makeAgentController([{ provider: 'anthropic', hasApiKey: true }]),
    listModes: () => [{ id: 'build' }, { id: 'plan' }, { id: 'fast' }],
  };

  function buildApp(
    user: { workosId: string; organizationId?: string } | null,
    opts: { authEnabled?: boolean; isOrganizationAdmin?: (orgId: string, userId: string) => Promise<boolean> } = {},
  ) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      if (user) c.set('factoryAuthUser' as never, user as never);
      await next();
    });
    mountApiRoutes(
      app as any,
      new ConfigRoutes({
        auth: fakeRouteAuth({
          enabled: opts.authEnabled !== false,
          ...(opts.isOrganizationAdmin ? { isOrganizationAdmin: opts.isOrganizationAdmin } : {}),
        }),
        controller,
        settingsPath,
      }).routes(),
    );
    return app;
  }

  const userA = { workosId: 'user-a', organizationId: 'org1' };

  const putThinking = (app: Hono, body: unknown) =>
    app.request('/web/config/thinking', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeEach(async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'factory-thinking-'));
    settingsPath = join(dir, 'settings.json');
  });

  it('reads the built-in defaults when no settings file exists', async () => {
    const res = await buildApp(null, { authEnabled: false }).request('/web/config/thinking');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      levels: ['off', 'low', 'medium', 'high', 'xhigh', 'max'],
      globalDefault: 'off',
      modeDefaults: {},
      modes: ['build', 'plan', 'fast'],
    });
  });

  it('round-trips global and per-mode defaults through the settings file', async () => {
    const app = buildApp(null, { authEnabled: false });
    const put = await putThinking(app, { globalDefault: 'high', modeDefaults: { plan: 'max' } });
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({ ok: true, globalDefault: 'high', modeDefaults: { plan: 'max' } });

    const read = await app.request('/web/config/thinking');
    expect(await read.json()).toMatchObject({ globalDefault: 'high', modeDefaults: { plan: 'max' } });
  });

  it('clears a per-mode default with null without touching others', async () => {
    const app = buildApp(null, { authEnabled: false });
    await putThinking(app, { modeDefaults: { plan: 'max', build: 'high' } });

    const cleared = await putThinking(app, { modeDefaults: { plan: null } });
    expect(await cleared.json()).toEqual({ ok: true, globalDefault: 'off', modeDefaults: { build: 'high' } });
  });

  it('rejects invalid levels, unknown modes, and non-object bodies', async () => {
    const app = buildApp(null, { authEnabled: false });
    expect((await putThinking(app, {})).status).toBe(400);
    expect((await putThinking(app, null)).status).toBe(400);
    expect((await putThinking(app, [])).status).toBe(400);
    expect((await putThinking(app, { globalDefault: 'ultra' })).status).toBe(400);
    expect((await putThinking(app, { modeDefaults: { build: 'ultra' } })).status).toBe(400);
    expect((await putThinking(app, { modeDefaults: { plna: 'high' } })).status).toBe(400);
    expect((await putThinking(app, { modeDefaults: ['high'] })).status).toBe(400);
  });

  it('rejects deployment-scoped writes in tenant mode', async () => {
    const nonAdmin = buildApp(userA, { isOrganizationAdmin: async () => false });
    expect((await putThinking(nonAdmin, { globalDefault: 'high' })).status).toBe(403);

    const signedOut = buildApp(null);
    expect((await putThinking(signedOut, { globalDefault: 'high' })).status).toBe(403);

    const admin = buildApp(userA, { isOrganizationAdmin: async () => true });
    expect((await putThinking(admin, { globalDefault: 'high' })).status).toBe(403);
  });
});
