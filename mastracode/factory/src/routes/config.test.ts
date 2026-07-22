import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { DEFAULT_OM_MODEL_ID } from '@mastra/code-sdk/constants';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
});

describe('model pack routes with a tenant', () => {
  let seed: FactoryStorageTestSeed;
  const controller = makeAgentController([
    { provider: 'anthropic', hasApiKey: true, apiKeyEnvVar: 'ANTHROPIC_API_KEY' },
  ]);

  function buildApp(user: { workosId: string; organizationId?: string } | null) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      if (user) c.set('factoryAuthUser' as never, user as never);
      await next();
    });
    mountApiRoutes(
      app as any,
      new ConfigRoutes({ auth: fakeRouteAuth(), controller, modelPacks: seed.modelPacks }).routes(),
    );
    return app;
  }

  const userA = { workosId: 'user-a', organizationId: 'org1' };
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
    session: ReturnType<typeof makeOmSession>,
    opts: { withStorage?: boolean; authEnabled?: boolean } = {},
  ) {
    const controller = {
      ...makeAgentController([{ provider: 'anthropic', hasApiKey: true }]),
      getSessionByResource: async () => session,
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
        ...(opts.withStorage === false ? {} : { memorySettings: seed.memorySettings }),
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

  beforeEach(async () => {
    seed = await createFactoryStorageForTests();
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
