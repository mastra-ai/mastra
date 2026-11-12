import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MastraCodeGateway } from '@mastra/code-sdk/agents/mastracode-gateway';
import { AuthStorage, PROVIDER_DEFAULT_MODELS } from '@mastra/code-sdk/auth/storage';
import { DEFAULT_OM_MODEL_ID } from '@mastra/code-sdk/constants';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { getModelReasoningOptions } from '@mastra/core/llm';
import type * as CoreLlm from '@mastra/core/llm';
import type { ModelReasoningOption } from '@mastra/core/llm';
import { InMemoryStore } from '@mastra/core/storage';
import { Hono } from 'hono';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { factoryProjectSettingsUserId } from '../storage/domains/projects/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { buildProviderAccess, ConfigRoutes, listProviders, resolveDeploymentModelProviders } from './config.js';
import type { ModelCatalogEntry } from './config.js';
import type { RouteAuth } from './route.js';
import {
  registerTenantCredentialResolver,
  resetTenantCredentialResolverForTests,
  TenantCredentialStore,
} from './tenant-credentials.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

vi.mock('@mastra/core/llm', async importOriginal => ({
  ...(await importOriginal<typeof CoreLlm>()),
  getModelReasoningOptions: vi.fn(),
}));

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
  return { listAvailableModels: async () => models.map(model => ({ modelName: `${model.provider}-model`, ...model })) };
}

describe('GET /web/config/features', () => {
  it.each([
    { features: undefined, expected: { knowledge: false, mcp: false } },
    { features: { knowledge: true }, expected: { knowledge: true, mcp: false } },
    { features: { knowledge: false, mcp: true }, expected: { knowledge: false, mcp: true } },
  ])('reports the server-side feature gates as $expected', async ({ features, expected }) => {
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
    expect(await response.json()).toEqual(expected);
  });
});

describe('GET /web/config/versions', () => {
  const packages = [
    { name: '@mastra/core', version: '1.83.0' },
    { name: '@mastra/factory', version: '0.28.0' },
  ];

  function appWith(user?: { workosId: string; organizationId: string }, authEnabled = true) {
    const app = new Hono();
    app.use(async (c, next) => {
      if (user) c.set('factoryAuthUser' as never, user as never);
      await next();
    });
    mountApiRoutes(
      app as never,
      new ConfigRoutes({
        auth: fakeRouteAuth({ enabled: authEnabled }),
        controller: makeAgentController([]),
        readPackages: async () => packages,
      }).routes(),
    );
    return app;
  }

  it('reports the packages and Node version the server runs to a signed-in user', async () => {
    const response = await appWith({ workosId: 'user-a', organizationId: 'org1' }).request('/web/config/versions');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ packages, nodeVersion: process.version });
  });

  it('refuses anonymous requests when auth is on', async () => {
    const response = await appWith().request('/web/config/versions');

    expect(response.status).toBe(401);
  });

  it('answers anonymous requests when auth is off', async () => {
    const response = await appWith(undefined, false).request('/web/config/versions');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ packages, nodeVersion: process.version });
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
      expect(list.find(p => p.provider === 'openai')?.source).toBe('oauth-user');
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
      expect(list[0]?.source).toBe('none');
    });
  });
});

describe('listProviders with deployment-provided providers', () => {
  const controller = makeAgentController([
    { provider: 'amazon-bedrock', hasApiKey: true },
    { provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' },
  ]);

  it('omits Bedrock in tenant mode unless the deployment opted in', async () => {
    const list = await listProviders({ controller, tenantCredentials: [] });
    expect(list.map(p => p.provider)).toEqual(['anthropic', 'mastra']);
  });

  it("reports Bedrock as 'deployment' in tenant mode when opted in", async () => {
    const list = await listProviders({
      controller,
      tenantCredentials: [],
      deploymentProviders: new Set(['amazon-bedrock']),
    });
    expect(list.find(p => p.provider === 'amazon-bedrock')).toEqual({
      provider: 'amazon-bedrock',
      source: 'deployment',
    });
  });

  it('omits Bedrock when opted in but the server has no AWS credentials', async () => {
    const list = await listProviders({
      controller: makeAgentController([{ provider: 'amazon-bedrock', hasApiKey: false }]),
      tenantCredentials: [],
      deploymentProviders: new Set(['amazon-bedrock']),
    });
    expect(list.map(p => p.provider)).toEqual(['mastra']);
  });

  it('leaves local mode unchanged', async () => {
    const list = await listProviders({ controller, authStorage: makeAuthStorage({}) });
    expect(list.find(p => p.provider === 'amazon-bedrock')?.source).toBe('env');
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

  describe('deployment-provided providers', () => {
    const bedrockCatalog = (hasApiKey: boolean) => makeAgentController([{ provider: 'amazon-bedrock', hasApiKey }]);
    const bedrockKeyRow = [
      {
        provider: 'amazon-bedrock',
        scope: 'org' as const,
        credential: { type: 'api_key' as const, key: 'pasted-key' },
        updatedAt: new Date(),
      },
    ];

    it('grants Bedrock in tenant mode when the deployment opted in and has AWS credentials', async () => {
      const access = await buildProviderAccess({
        controller: bedrockCatalog(true),
        tenantCredentials: [],
        deploymentProviders: new Set(['amazon-bedrock']),
      });
      expect(access['amazon-bedrock']).toBe('apikey');
    });

    it('denies Bedrock in tenant mode without the opt-in, even with a stored tenant key', async () => {
      const access = await buildProviderAccess({ controller: bedrockCatalog(true), tenantCredentials: bedrockKeyRow });
      expect(access['amazon-bedrock']).toBe(false);
    });

    it('denies Bedrock when opted in but the server has no AWS credentials', async () => {
      const access = await buildProviderAccess({
        controller: bedrockCatalog(false),
        tenantCredentials: bedrockKeyRow,
        deploymentProviders: new Set(['amazon-bedrock']),
      });
      expect(access['amazon-bedrock']).toBe(false);
    });

    it('keeps local mode unchanged: server AWS credentials are enough', async () => {
      const access = await buildProviderAccess({ controller: bedrockCatalog(true) });
      expect(access['amazon-bedrock']).toBe('apikey');
    });
  });
});

describe('resolveDeploymentModelProviders', () => {
  it('keeps supported providers and warns about the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect([...resolveDeploymentModelProviders([' amazon-bedrock', ' google-vertex ', 'openai', ''])]).toEqual([
      'amazon-bedrock',
      'google-vertex',
    ]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"openai"'));
    expect(resolveDeploymentModelProviders(undefined).size).toBe(0);
    warn.mockRestore();
  });
});

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

  it('rejects a per-account key for a deployment-provided provider', async () => {
    const res = await buildApp(userA).request('/web/config/providers/amazon-bedrock/key', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'bedrock-key', scope: 'org' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('provider_configured_by_deployment');
    expect(await seed.credentials.resolveCredential('org1', 'user-a', 'amazon-bedrock', 'org')).toBeUndefined();
  });

  it('stores a user-scoped key by default, invisible to other members', async () => {
    const res = await putKey(buildApp(userA), { key: 'sk-mine' });
    expect(res.status).toBe(200);
    expect((await res.json()).provider?.source).toBe('stored-user');

    expect(await seed.credentials.getCredential({ orgId: 'org1', userId: 'user-a' }, 'anthropic')).toEqual({
      type: 'api_key',
      key: 'sk-mine',
    });
    expect(await seed.credentials.resolveCredential('org1', 'user-b', 'anthropic', 'user')).toBeUndefined();
  });

  it('stores a Kimi key under the credential id model resolution reads', async () => {
    const res = await buildApp(userA).request('/web/config/providers/kimi-code-plan-cn/key', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'sk-kimi' }),
    });
    expect(res.status).toBe(200);

    expect(await seed.credentials.getCredential({ orgId: 'org1', userId: 'user-a' }, 'kimi-for-coding')).toEqual({
      type: 'api_key',
      key: 'sk-kimi',
    });
    expect(
      await seed.credentials.getCredential({ orgId: 'org1', userId: 'user-a' }, 'kimi-code-plan-cn'),
    ).toBeUndefined();
  });

  it('does not materialize OM models when a provider key is connected', async () => {
    await putKey(buildApp(userA), { key: 'sk-mine' });
    expect(await seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' })).toBeNull();

    await seed.memorySettings.patch({
      orgId: 'org1',
      userId: 'user-a',
      patch: { observerModelId: 'openai/gpt-5.4-mini' },
    });
    await putKey(buildApp(userA), { key: 'sk-replaced' });
    expect(await seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' })).toMatchObject({
      observerModelId: 'openai/gpt-5.4-mini',
      reflectorModelId: null,
    });
  });

  it('does not materialize OM models for an org-scoped key', async () => {
    await putKey(buildApp(userA), { key: 'sk-shared', scope: 'org' });
    expect(await seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' })).toBeNull();
  });

  it('stores an org-scoped key that all members inherit when the caller is an admin', async () => {
    const res = await putKey(buildApp(userA), { key: 'sk-shared', scope: 'org' });
    expect(res.status).toBe(200);
    expect((await res.json()).provider?.source).toBe('stored-org');
    expect(isOrganizationAdmin).toHaveBeenCalledWith('org1', 'user-a');

    const resolvedForB = await seed.credentials.resolveCredential('org1', 'user-b', 'anthropic', 'org');
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

  it("lists the caller's user key when both scopes exist", async () => {
    await putKey(buildApp(userA), { key: 'sk-shared', scope: 'org' });
    await putKey(buildApp(userA), { key: 'sk-mine' });

    const resolved = await seed.credentials.resolveCredential('org1', 'user-a', 'anthropic', 'user');
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

  describe('a personal sign-in whose token can no longer be renewed', () => {
    const tenant = { orgId: 'org1', userId: 'user-a' };
    const anthropic = setupServer();

    const tokenUrl = 'https://console.anthropic.com/v1/oauth/token';

    const listedAnthropic = async () => {
      const listed = await buildApp(userA).request('/web/config/providers');
      return (await listed.json()).providers.find((p: { provider: string }) => p.provider === 'anthropic');
    };

    beforeAll(() => anthropic.listen({ onUnhandledRequest: 'error' }));
    afterEach(() => anthropic.resetHandlers());
    afterAll(() => anthropic.close());

    beforeEach(async () => {
      await seed.credentials.setCredential(tenant, 'anthropic', {
        type: 'oauth',
        access: 'a-old',
        refresh: 'r-old',
        expires: Date.now() - 1000,
      });
      anthropic.use(http.post(tokenUrl, () => HttpResponse.json({ error: 'invalid_grant' }, { status: 400 })));
      await new TenantCredentialStore('org1', 'user-a', seed.credentials, 'user').getApiKey('anthropic');
    });

    it('shows as expired instead of signed in', async () => {
      expect(await listedAnthropic()).toMatchObject({ userCredential: 'oauth', userCredentialExpired: true });
    });

    it('stops showing as expired once the user signs in again', async () => {
      await seed.credentials.setCredential(tenant, 'anthropic', {
        type: 'oauth',
        access: 'a-new',
        refresh: 'r-new',
        expires: Date.now() + 3_600_000,
      });

      expect(await listedAnthropic()).not.toHaveProperty('userCredentialExpired');
    });

    it('stops showing as expired once a later renewal succeeds', async () => {
      anthropic.use(
        http.post(tokenUrl, () =>
          HttpResponse.json({ access_token: 'a-renewed', refresh_token: 'r-renewed', expires_in: 3600 }),
        ),
      );
      const renewed = await new TenantCredentialStore('org1', 'user-a', seed.credentials, 'user').getApiKey(
        'anthropic',
      );

      expect(renewed).toBe('a-renewed');
      expect(await listedAnthropic()).not.toHaveProperty('userCredentialExpired');
    });
  });

  it('never touches the file-backed AuthStorage in tenant mode', async () => {
    const setStoredApiKey = vi.fn();
    const authStorage = { setStoredApiKey } as unknown as AuthStorage;
    await putKey(buildApp(userA, authStorage), { key: 'sk-mine' });
    expect(setStoredApiKey).not.toHaveBeenCalled();
  });
});

describe('provider key routes in local mode', () => {
  // The real router gateways run against a models.dev catalog served at the wire.
  const catalogs = setupServer(
    http.get('https://models.dev/api.json', () =>
      HttpResponse.json({
        'acme-cloud': {
          id: 'acme-cloud',
          name: 'Acme Cloud',
          env: ['ACME_CLOUD_API_KEY'],
          api: 'https://api.acme.test/v1',
          npm: '@ai-sdk/openai-compatible',
          models: { 'rocket-1': { id: 'rocket-1' } },
        },
      }),
    ),
    http.get('https://api.netlify.com/api/v1/ai-gateway/providers', () => HttpResponse.json({ providers: {} })),
  );
  let dir: string;
  let app: Hono;

  beforeAll(() => catalogs.listen({ onUnhandledRequest: 'error' }));
  afterAll(() => catalogs.close());

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'factory-local-keys-'));
    const controller = new AgentController({
      id: 'code',
      storage: new InMemoryStore(),
      modes: [
        {
          id: 'build',
          name: 'Build',
          default: true,
          agent: new Agent({ id: 'agent', name: 'agent', instructions: 'test', model: {} as any }),
        },
      ],
    });
    app = new Hono();
    mountApiRoutes(
      app as any,
      new ConfigRoutes({
        auth: fakeRouteAuth({ enabled: false }),
        controller,
        authStorage: new AuthStorage(join(dir, 'auth.json')),
      }).routes(),
    );
  });

  afterEach(async () => {
    delete process.env.ACME_CLOUD_API_KEY;
    await fs.rm(dir, { recursive: true, force: true });
  });

  const acme = async () =>
    (
      (await (await app.request('/web/config/providers')).json()) as { providers: { provider: string }[] }
    ).providers.find(provider => provider.provider === 'acme-cloud');
  const modelIds = async () =>
    ((await (await app.request('/web/config/models')).json()) as { models: { id: string }[] }).models.map(m => m.id);

  it('removing a saved key disconnects the provider right away', async () => {
    expect(await acme()).toMatchObject({ source: 'none', envVar: 'ACME_CLOUD_API_KEY' });

    const saved = await app.request('/web/config/providers/acme-cloud/key', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'sk-acme', envVar: 'ACME_CLOUD_API_KEY' }),
    });
    expect(saved.status).toBe(200);
    expect(await acme()).toMatchObject({ source: 'stored' });
    expect(await modelIds()).toContain('acme-cloud/rocket-1');

    const removed = await app.request('/web/config/providers/acme-cloud/key', { method: 'DELETE' });
    expect(removed.status).toBe(200);
    expect(await acme()).toMatchObject({ source: 'none' });
    expect(await modelIds()).not.toContain('acme-cloud/rocket-1');
  });

  it('removing a saved key gives back the key the server was started with', async () => {
    process.env.ACME_CLOUD_API_KEY = 'sk-server';
    // The settings dialog sends the provider's envVar, so saving overrides the server key.
    const saved = await app.request('/web/config/providers/acme-cloud/key', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'sk-saved', envVar: 'ACME_CLOUD_API_KEY' }),
    });
    expect(saved.status).toBe(200);
    expect(await acme()).toMatchObject({ source: 'stored' });

    const removed = await app.request('/web/config/providers/acme-cloud/key', { method: 'DELETE' });
    expect(removed.status).toBe(200);
    expect(await acme()).toMatchObject({ source: 'env' });
    expect(process.env.ACME_CLOUD_API_KEY).toBe('sk-server');
    expect(await modelIds()).toContain('acme-cloud/rocket-1');
  });
});

describe('Mastra Gateway routes with a tenant', () => {
  let seed: FactoryStorageTestSeed;
  const controller = makeAgentController([{ provider: 'anthropic', hasApiKey: false }]);
  const user = { workosId: 'user-a', organizationId: 'org1', email: 'user-a@example.com' };
  const KEYS = '/gateway/projects/provision';

  interface FakePlatform {
    requests: Array<{ method: string; path: string; body?: unknown }>;
    fetchPlatformAsUser: NonNullable<RouteAuth['fetchPlatformAsUser']>;
  }

  function fakePlatform(
    routes: Record<string, () => Response> = {},
    { organizationId = 'org1', role = 'admin' }: { organizationId?: string; role?: string } = {},
  ): FakePlatform {
    const requests: FakePlatform['requests'] = [];
    const fetchPlatformAsUser: FakePlatform['fetchPlatformAsUser'] = async (_c, path, init) => {
      const method = init?.method ?? 'GET';
      requests.push({ method, path, ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}) });
      if (path === '/auth/me') return Response.json({ user: { email: user.email }, organizationId, role });
      return routes[`${method} ${path}`]?.() ?? new Response(null, { status: 404 });
    };
    return { requests, fetchPlatformAsUser };
  }

  function buildApp(platform?: FakePlatform) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser' as never, user as never);
      await next();
    });
    mountApiRoutes(
      app as any,
      new ConfigRoutes({
        auth: platform ? { ...fakeRouteAuth(), fetchPlatformAsUser: platform.fetchPlatformAsUser } : fakeRouteAuth(),
        controller,
        modelCredentials: seed.credentials,
        memorySettings: seed.memorySettings,
      }).routes(),
    );
    return app;
  }

  const connect = (app: Hono, scope: 'user' | 'org') =>
    app.request('/web/config/providers/mastra/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope }),
    });

  beforeEach(async () => {
    seed = await createFactoryStorageForTests();
  });

  it("creates a gateway key on the user's Mastra organization and lists the gateway models", async () => {
    const platform = fakePlatform({
      [`POST ${KEYS}`]: () => Response.json({ apiKey: 'msk_factory' }, { status: 201 }),
    });
    const app = buildApp(platform);

    const res = await connect(app, 'user');

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      provider: { provider: 'mastra', source: 'stored-user', connectWithMastraAccount: true },
    });
    expect(platform.requests).toContainEqual({
      method: 'POST',
      path: KEYS,
      body: { name: 'Factory · user-a@example.com', keyLabel: 'Factory · user-a@example.com' },
    });
    expect(await seed.credentials.getCredential({ orgId: 'org1', userId: 'user-a' }, 'mastra-gateway')).toEqual({
      type: 'api_key',
      key: 'msk_factory',
    });
    const { models } = (await (await app.request('/web/config/models')).json()) as { models: Array<{ id: string }> };
    expect(models.map(m => m.id)).toContain('mastra/anthropic/claude-opus-5.5');
  });

  it('reuses the key the scope already has', async () => {
    await seed.credentials.setCredential({ orgId: 'org1' }, 'mastra-gateway', { type: 'api_key', key: 'msk_existing' });
    const platform = fakePlatform();

    const res = await connect(buildApp(platform), 'org');

    expect(res.status).toBe(200);
    expect(platform.requests).toEqual([]);
    expect(await seed.credentials.getCredential({ orgId: 'org1' }, 'mastra-gateway')).toMatchObject({
      key: 'msk_existing',
    });
  });

  it("creates no key while the user's Mastra session is on another organization than the Factory", async () => {
    const platform = fakePlatform(
      { [`POST ${KEYS}`]: () => Response.json({ apiKey: 'msk_other_org' }, { status: 201 }) },
      { organizationId: 'org-other' },
    );

    const res = await connect(buildApp(platform), 'org');

    expect(res.status).toBe(409);
    expect(platform.requests.map(r => r.path)).toEqual(['/auth/me']);
    expect(await seed.credentials.getCredential({ orgId: 'org1' }, 'mastra-gateway')).toBeUndefined();
  });

  it('stores nothing when the user cannot create keys for their Mastra organization', async () => {
    const platform = fakePlatform({ [`POST ${KEYS}`]: () => new Response(null, { status: 403 }) });

    const res = await connect(buildApp(platform), 'org');

    expect(res.status).toBe(403);
    expect(await seed.credentials.getCredential({ orgId: 'org1' }, 'mastra-gateway')).toBeUndefined();
  });

  it('removes the gateway credential without calling Mastra, which has no way to revoke the key', async () => {
    await seed.credentials.setCredential({ orgId: 'org1' }, 'mastra-gateway', { type: 'api_key', key: 'msk_factory' });
    const platform = fakePlatform();

    const res = await buildApp(platform).request('/web/config/providers/mastra/key?scope=org', { method: 'DELETE' });

    expect(res.status).toBe(200);
    expect(platform.requests).toEqual([]);
    expect(await seed.credentials.getCredential({ orgId: 'org1' }, 'mastra-gateway')).toBeUndefined();
  });

  it('reports the remaining gateway credits and where to add more', async () => {
    const platform = fakePlatform({
      'GET /billing/customer': () =>
        Response.json({
          customer: {
            creditPool: { featureId: 'gateway_credits' },
            balances: { gateway_credits: { featureId: 'gateway_credits', granted: 5, usage: 5 } },
          },
        }),
    });

    const res = await buildApp(platform).request('/web/config/providers/mastra/credits');

    expect(await res.json()).toEqual({
      remaining: 0,
      unlimited: false,
      canAddCredits: true,
      addCreditsUrl: 'https://projects.mastra.ai/add-credits/org1',
    });
  });

  it('tells a member who is not a Mastra admin that they cannot add credits', async () => {
    const platform = fakePlatform(
      { 'GET /billing/customer': () => Response.json({ customer: null }) },
      { role: 'member' },
    );

    const res = await buildApp(platform).request('/web/config/providers/mastra/credits');

    expect(await res.json()).toMatchObject({ canAddCredits: false });
  });

  it('lets the organization owner add credits', async () => {
    const platform = fakePlatform(
      { 'GET /billing/customer': () => Response.json({ customer: null }) },
      { role: 'owner' },
    );

    const res = await buildApp(platform).request('/web/config/providers/mastra/credits');

    expect(await res.json()).toMatchObject({ canAddCredits: true });
  });

  it('reports unknown credits, not zero, when the platform has no balance for the pool', async () => {
    const platform = fakePlatform({ 'GET /billing/customer': () => Response.json({ customer: null }) });

    const res = await buildApp(platform).request('/web/config/providers/mastra/credits');

    expect(await res.json()).not.toHaveProperty('remaining');
  });

  it('offers the one-click gateway only when auth can act on the Mastra platform', async () => {
    const gatewayRow = async (app: Hono) => {
      const { providers } = (await (await app.request('/web/config/providers')).json()) as {
        providers: Array<{ provider: string; connectWithMastraAccount?: true }>;
      };
      return providers.find(p => p.provider === 'mastra');
    };

    expect(await gatewayRow(buildApp(fakePlatform()))).toMatchObject({ connectWithMastraAccount: true });
    expect(await gatewayRow(buildApp())).not.toHaveProperty('connectWithMastraAccount');
  });
});

describe('GET /web/config/models', () => {
  const fableReasoning: ModelReasoningOption[] = [{ type: 'effort', values: ['low', 'high'] }];

  beforeEach(() => {
    vi.mocked(getModelReasoningOptions).mockImplementation(modelId =>
      modelId === 'anthropic/claude-fable-5' ? fableReasoning : undefined,
    );
  });

  it('returns only credentialed models with their ids', async () => {
    const controller = {
      listAvailableModels: async () => [
        {
          id: 'anthropic/claude-fable-5',
          modelName: 'claude-fable-5',
          provider: 'anthropic',
          hasApiKey: true,
          releaseDate: '2026-09-29',
        },
        { id: 'openai/gpt-5.6', modelName: 'gpt-5.6', provider: 'openai', hasApiKey: false },
        { modelName: 'gemini', provider: 'google', hasApiKey: true }, // no id — dropped
      ],
    };
    const app = new Hono();
    mountApiRoutes(app as any, new ConfigRoutes({ auth: fakeRouteAuth({ enabled: false }), controller }).routes());

    const res = await app.request('/web/config/models');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      models: [
        {
          id: 'anthropic/claude-fable-5',
          provider: 'anthropic',
          modelName: 'claude-fable-5',
          releaseDate: '2026-09-29',
          hasApiKey: true,
          reasoningOptions: fableReasoning,
        },
      ],
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
      models: [
        {
          id: 'anthropic/claude-fable-5',
          provider: 'anthropic',
          modelName: 'claude-fable-5',
          hasApiKey: true,
          reasoningOptions: fableReasoning,
          credentialLabel: 'Claude Pro/Max',
          credentialHolder: 'personal',
        },
      ],
    });
  });

  it("offers only the models a Factory's model scope can serve", async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'anthropic', {
      type: 'api_key',
      key: 'sk-personal',
    });
    await seed.credentials.setCredential({ orgId: 'org1' }, 'openai-codex', { type: 'api_key', key: 'sk-org' });
    const orgProject = await seed.projects.create({ orgId: 'org1', userId: 'user-a', input: { name: 'Org' } });
    const userProject = await seed.projects.create({ orgId: 'org1', userId: 'user-a', input: { name: 'Mine' } });
    await seed.projects.update({ orgId: 'org1', id: userProject.id, input: { modelScope: 'user' } });
    const controller = {
      listAvailableModels: async () => [
        { id: 'anthropic/claude-fable-5', modelName: 'claude-fable-5', provider: 'anthropic', hasApiKey: false },
        { id: 'openai/gpt-5.6', modelName: 'gpt-5.6', provider: 'openai', hasApiKey: false },
      ],
    };
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
        factoryProjects: seed.projects,
      }).routes(),
    );
    const ids = async (query: string) => {
      const res = await app.request(`/web/config/models${query}`);
      expect(res.status).toBe(200);
      return ((await res.json()) as { models: { id: string }[] }).models.map(model => model.id);
    };

    expect(await ids('')).toEqual(['anthropic/claude-fable-5', 'openai/gpt-5.6']);
    expect(await ids(`?factoryId=${orgProject.id}`)).toEqual(['openai/gpt-5.6']);
    expect(await ids(`?factoryId=${userProject.id}`)).toEqual(['anthropic/claude-fable-5']);
    expect((await app.request('/web/config/models?factoryId=missing')).status).toBe(404);
  });

  it('names the credential and its holder from the scope a reply will use, not a personal login that shadows it', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'anthropic', {
      type: 'oauth',
      refresh: 'refresh',
      access: 'access',
      expires: Date.now() + 60_000,
    });
    await seed.credentials.setCredential({ orgId: 'org1' }, 'anthropic', { type: 'api_key', key: 'sk-org' });
    const orgProject = await seed.projects.create({ orgId: 'org1', userId: 'user-a', input: { name: 'Org' } });
    const controller = {
      listAvailableModels: async () => [
        { id: 'anthropic/claude-fable-5', modelName: 'claude-fable-5', provider: 'anthropic', hasApiKey: false },
      ],
    };
    const app = new Hono<{ Variables: { factoryAuthUser: { workosId: string; organizationId: string } } }>();
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser', { workosId: 'user-a', organizationId: 'org1' });
      await next();
    });
    mountApiRoutes(
      app,
      new ConfigRoutes({
        auth: fakeRouteAuth(),
        controller,
        modelCredentials: seed.credentials,
        factoryProjects: seed.projects,
      }).routes(),
    );
    const catalog = z.object({
      models: z.array(z.object({ credentialLabel: z.string().optional(), credentialHolder: z.string().optional() })),
    });
    const credential = async (query: string) => {
      const res = await app.request(`/web/config/models${query}`);
      return catalog.parse(await res.json()).models[0];
    };

    expect(await credential(`?factoryId=${orgProject.id}`)).toEqual({
      credentialLabel: 'Anthropic API key',
      credentialHolder: 'organization',
    });
    expect(await credential('?scope=user')).toEqual({
      credentialLabel: 'Claude Pro/Max',
      credentialHolder: 'personal',
    });
  });

  it('includes Bedrock models for a tenant only when the deployment opted in', async () => {
    const seed = await createFactoryStorageForTests();
    const controller = {
      listAvailableModels: async () => [
        {
          id: 'amazon-bedrock/anthropic.claude-x',
          modelName: 'anthropic.claude-x',
          provider: 'amazon-bedrock',
          hasApiKey: true,
        },
      ],
    };
    const request = async (deploymentProviders?: ReadonlySet<string>) => {
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
          deploymentProviders,
        }).routes(),
      );
      return (await app.request('/web/config/models')).json();
    };

    expect(await request()).toEqual({ models: [] });
    expect(await request(new Set(['amazon-bedrock']))).toEqual({
      models: [
        {
          id: 'amazon-bedrock/anthropic.claude-x',
          provider: 'amazon-bedrock',
          modelName: 'anthropic.claude-x',
          hasApiKey: true,
          credentialHolder: 'deployment',
        },
      ],
    });
  });

  it('appends the caller org custom provider models from the DB', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.customProviders.create({
      owner: { orgId: 'org1' },
      createdBy: 'user-a',
      input: { providerId: 'acme', name: 'Acme', url: 'https://llm.acme.dev/v1', apiKey: 'sk', models: ['fast-1'] },
    });
    await seed.customProviders.create({
      owner: { orgId: 'org2' },
      createdBy: 'user-b',
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
      models: [
        { id: 'acme/fast-1', provider: 'acme', modelName: 'fast-1', hasApiKey: true, credentialHolder: 'organization' },
      ],
    });
  });

  it('lists custom provider models only at the scope their endpoint is saved at', async () => {
    const seed = await createFactoryStorageForTests();
    const endpoint = (name: string) => ({
      providerId: name.toLowerCase(),
      name,
      url: `https://${name.toLowerCase()}.dev/v1`,
      models: ['m'],
    });
    await seed.customProviders.create({ owner: { orgId: 'org1' }, createdBy: 'admin', input: endpoint('Shared') });
    await seed.customProviders.create({
      owner: { orgId: 'org1', userId: 'user-a' },
      createdBy: 'user-a',
      input: endpoint('Mine'),
    });
    await seed.customProviders.create({
      owner: { orgId: 'org1', userId: 'user-b' },
      createdBy: 'user-b',
      input: endpoint('Theirs'),
    });
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser' as never, { workosId: 'user-a', organizationId: 'org1' } as never);
      await next();
    });
    mountApiRoutes(
      app as any,
      new ConfigRoutes({
        auth: fakeRouteAuth(),
        controller: { listAvailableModels: async () => [] },
        modelCredentials: seed.credentials,
        customProviders: seed.customProviders,
      }).routes(),
    );
    const modelsAt = async (scope: string) =>
      ((await (await app.request(`/web/config/models?scope=${scope}`)).json()).models as ModelCatalogEntry[]).map(
        model => [model.id, model.credentialHolder],
      );

    expect(await modelsAt('user')).toEqual([['mine/m', 'personal']]);
    expect(await modelsAt('org')).toEqual([['shared/m', 'organization']]);
  });

  it('separates personal and company catalogs by credential scope', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'anthropic', {
      type: 'api_key',
      key: 'sk-user',
    });
    await seed.credentials.setCredential({ orgId: 'org1' }, 'deepseek', { type: 'api_key', key: 'sk-org' });
    const orgFactory = await seed.projects.create({ orgId: 'org1', userId: 'user-a', input: { name: 'Shared' } });
    const controller = {
      listAvailableModels: async () => [
        { id: 'anthropic/claude-fable-5', modelName: 'claude-fable-5', provider: 'anthropic', hasApiKey: false },
        { id: 'deepseek/deepseek-flash', modelName: 'deepseek-flash', provider: 'deepseek', hasApiKey: false },
      ],
    };
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
        factoryProjects: seed.projects,
      }).routes(),
    );
    const ids = async (query: string) => {
      const res = await app.request(`/web/config/models${query}`);
      expect(res.status).toBe(200);
      return ((await res.json()) as { models: { id: string }[] }).models.map(m => m.id);
    };

    expect(await ids('')).toEqual(['anthropic/claude-fable-5', 'deepseek/deepseek-flash']);
    expect(await ids('?scope=user')).toEqual(['anthropic/claude-fable-5']);
    expect(await ids('?scope=org')).toEqual(['deepseek/deepseek-flash']);
    expect((await app.request('/web/config/models?scope=other')).status).toBe(400);
    // Personal defaults never run on org credentials, whichever Factory the page is in.
    expect(await ids(`?scope=user&factoryId=${orgFactory.id}`)).toEqual(['anthropic/claude-fable-5']);
  });

  describe('fallback model for a scope with no chosen default', () => {
    const modeDefault = PROVIDER_DEFAULT_MODELS.anthropic;
    const openaiDefault = PROVIDER_DEFAULT_MODELS['openai-codex'];
    let seed: FactoryStorageTestSeed;

    const mount = (user: { workosId: string; organizationId: string }) => {
      const app = new Hono<{ Variables: { factoryAuthUser: { workosId: string; organizationId: string } } }>();
      app.use('*', async (c, next) => {
        c.set('factoryAuthUser', user);
        await next();
      });
      mountApiRoutes(
        app,
        new ConfigRoutes({
          auth: fakeRouteAuth(),
          controller: {
            listAvailableModels: async () => [
              { id: modeDefault, modelName: 'claude-fable-5', provider: 'anthropic', hasApiKey: false },
              { id: openaiDefault, modelName: 'gpt-5.6-sol', provider: 'openai', hasApiKey: false },
            ],
            getDefaultMode: () => ({ defaultModelId: modeDefault }),
          },
          modelCredentials: seed.credentials,
          factoryProjects: seed.projects,
        }).routes(),
      );
      return async (query: string) => {
        const res = await app.request(`/web/config/models${query}`);
        expect(res.status).toBe(200);
        return z.object({ fallbackModelId: z.string().nullable() }).parse(await res.json()).fallbackModelId;
      };
    };

    beforeEach(async () => {
      seed = await createFactoryStorageForTests();
      registerTenantCredentialResolver(seed.credentials);
      await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'anthropic', {
        type: 'api_key',
        key: 'sk-personal',
      });
      await seed.credentials.setCredential({ orgId: 'org1' }, 'openai-codex', { type: 'api_key', key: 'sk-org' });
    });

    afterEach(() => resetTenantCredentialResolverForTests());

    it("starts a personal chat on the default mode's model when personal credentials can run it", async () => {
      const fallback = mount({ workosId: 'user-a', organizationId: 'org1' });
      expect(await fallback('?scope=user')).toBe(modeDefault);
    });

    it("starts an org chat on a connected provider's default when org credentials cannot run the mode's model", async () => {
      const fallback = mount({ workosId: 'user-a', organizationId: 'org1' });
      expect(await fallback('?scope=org')).toBe(openaiDefault);
    });

    it("follows a Factory's model routing, not the caller's personal login", async () => {
      const orgFactory = await seed.projects.create({ orgId: 'org1', userId: 'user-a', input: { name: 'Shared' } });
      const personalFactory = await seed.projects.create({ orgId: 'org1', userId: 'user-a', input: { name: 'Mine' } });
      await seed.projects.update({ orgId: 'org1', id: personalFactory.id, input: { modelScope: 'user' } });
      const fallback = mount({ workosId: 'user-a', organizationId: 'org1' });

      expect(await fallback(`?factoryId=${orgFactory.id}`)).toBe(openaiDefault);
      expect(await fallback(`?factoryId=${personalFactory.id}`)).toBe(modeDefault);
    });

    it('offers no fallback when the scope has no credential that can run any model', async () => {
      const fallback = mount({ workosId: 'user-b', organizationId: 'org2' });
      expect(await fallback('?scope=user')).toBeNull();
      expect(await fallback('?scope=org')).toBeNull();
    });
  });
});

describe('default model routes with a tenant', () => {
  let seed: FactoryStorageTestSeed;
  const controller = makeAgentController([]);
  const userA = { workosId: 'user-a', organizationId: 'org1' };
  const userB = { workosId: 'user-b', organizationId: 'org1' };

  function buildApp(user: { workosId: string; organizationId?: string } | null, includeStorage = true) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      if (user) c.set('factoryAuthUser' as never, user as never);
      await next();
    });
    mountApiRoutes(
      app as any,
      new ConfigRoutes({
        auth: fakeRouteAuth(),
        controller,
        modelDefaults: includeStorage ? seed.modelDefaults : undefined,
      }).routes(),
    );
    return app;
  }

  const putDefault = (app: Hono, body: unknown) =>
    app.request('/web/config/default-model', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeEach(async () => {
    seed = await createFactoryStorageForTests();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated access when web auth is enabled', async () => {
    const res = await buildApp(null).request('/web/config/default-model');
    expect(res.status).toBe(401);
  });

  it('returns 503 when default-model storage is unavailable', async () => {
    const res = await buildApp(userA, false).request('/web/config/default-model');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'model_defaults_unavailable' });
  });

  it('returns null when the user has no default model', async () => {
    const res = await buildApp(userA).request('/web/config/default-model');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ modelId: null, thinkingLevel: null });
  });

  it('validates and persists a default model per user', async () => {
    const invalid = await putDefault(buildApp(userA), { modelId: '   ' });
    expect(invalid.status).toBe(400);

    const nullBody = await putDefault(buildApp(userA), null);
    expect(nullBody.status).toBe(400);
    expect(await nullBody.json()).toEqual({ error: 'Missing required field: modelId' });

    const oversized = await putDefault(buildApp(userA), { modelId: 'm'.repeat(257) });
    expect(oversized.status).toBe(400);
    expect(await oversized.json()).toEqual({ error: 'Missing required field: modelId' });

    const saved = await putDefault(buildApp(userA), { modelId: ' openai/gpt-5.6 ' });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ ok: true, modelId: 'openai/gpt-5.6' });
    expect(await seed.modelDefaults.get({ orgId: 'org1', userId: 'user-a' })).toMatchObject({
      modelId: 'openai/gpt-5.6',
    });

    const userAResponse = await buildApp(userA).request('/web/config/default-model');
    const userBResponse = await buildApp(userB).request('/web/config/default-model');
    expect(await userAResponse.json()).toEqual({ modelId: 'openai/gpt-5.6', thinkingLevel: null });
    expect(await userBResponse.json()).toEqual({ modelId: null, thinkingLevel: null });
  });

  it('saves a personal thinking level only next to a personal default model', async () => {
    const putThinking = (body: unknown) =>
      buildApp(userA).request('/web/config/default-model/thinking', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    const getDefaults = async (user: typeof userA) =>
      (await buildApp(user).request('/web/config/default-model')).json();

    const withoutModel = await putThinking({ thinkingLevel: 'high' });
    expect(withoutModel.status).toBe(400);
    expect(await withoutModel.json()).toEqual({ error: 'default_model_not_set' });

    await putDefault(buildApp(userA), { modelId: 'openai/gpt-5.6' });
    const saved = await putThinking({ thinkingLevel: 'high' });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ ok: true, thinkingLevel: 'high' });
    expect(await getDefaults(userA)).toEqual({ modelId: 'openai/gpt-5.6', thinkingLevel: 'high' });
    expect(await getDefaults(userB)).toEqual({ modelId: null, thinkingLevel: null });

    const invalid = await putThinking({ thinkingLevel: 'enormous' });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'Invalid thinkingLevel' });
    expect(await getDefaults(userA)).toEqual({ modelId: 'openai/gpt-5.6', thinkingLevel: 'high' });

    const reset = await putThinking({ thinkingLevel: null });
    expect(reset.status).toBe(200);
    expect(await reset.json()).toEqual({ ok: true, thinkingLevel: null });
    expect(await getDefaults(userA)).toEqual({ modelId: 'openai/gpt-5.6', thinkingLevel: null });
  });

  it('clears a personal default model', async () => {
    await putDefault(buildApp(userA), { modelId: 'openai/gpt-5.6' });
    const cleared = await buildApp(userA).request('/web/config/default-model', { method: 'DELETE' });
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toEqual({ ok: true, modelId: null });
    expect(await seed.modelDefaults.get({ orgId: 'org1', userId: 'user-a' })).toBeNull();
  });

  it('switches only the caller’s live user sessions without starting dormant sessions', async () => {
    await seed.projects.create({ orgId: 'org1', userId: 'user-a', input: { name: 'Team' } });
    await putDefault(buildApp(userA), { modelId: 'openai/gpt-5.6' });
    const settings = new Map<string, string>();
    const rows = [
      { sessionId: 'live', userId: 'user-a', originSessionId: null },
      { sessionId: 'dormant', userId: 'user-a', originSessionId: null },
      { sessionId: 'other-user', userId: 'user-b', originSessionId: null },
      { sessionId: 'side-session', userId: 'user-a', originSessionId: 'live' },
    ];
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser' as never, userA as never);
      await next();
    });
    mountApiRoutes(
      app as never,
      new ConfigRoutes({
        auth: fakeRouteAuth(),
        modelDefaults: seed.modelDefaults,
        factoryProjects: seed.projects,
        workItems: seed.workItems,
        sourceControls: [{ sessions: { listByProject: async () => rows } }] as never,
        controller: {
          ...controller,
          getSession: async (id: string) =>
            id === 'live'
              ? {
                  model: {
                    get: () => settings.get('currentModelId') ?? '',
                    switch: async (modelId: string) => void settings.set('currentModelId', modelId),
                  },
                  thread: { getId: () => 'thread-live' },
                }
              : undefined,
        },
      }).routes(),
    );

    const response = await app.request('/web/config/default-model/apply', { method: 'POST' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      modelId: 'openai/gpt-5.6',
      applied: ['live'],
      skipped: [{ sessionId: 'dormant', reason: 'not-running' }],
    });
    expect(settings.get('currentModelId')).toBe('openai/gpt-5.6');
  });

  it('uses the local sentinel org and user when auth is disabled', async () => {
    const app = new Hono();
    mountApiRoutes(
      app as any,
      new ConfigRoutes({
        auth: fakeRouteAuth({ enabled: false }),
        controller,
        modelDefaults: seed.modelDefaults,
      }).routes(),
    );

    const saved = await putDefault(app, { modelId: 'anthropic/claude-sonnet-4-5' });
    expect(saved.status).toBe(200);
    expect(await seed.modelDefaults.get({ orgId: 'local', userId: 'local' })).toMatchObject({
      modelId: 'anthropic/claude-sonnet-4-5',
    });
  });
});

describe('OM routes with a tenant', () => {
  let seed: FactoryStorageTestSeed;

  function isolateFromHostProviderKeys() {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
    vi.spyOn(MastraCodeGateway, 'getMastraGatewayApiKey').mockReturnValue(undefined);
  }

  beforeEach(isolateFromHostProviderKeys);
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  /**
   * A minimal OM session whose role models live in a mutable map. `currentModelId`
   * is the session's effective (`model.get()`) model; `''` mirrors an unselected
   * session so `readStoredOMConfig` falls back to the Factory default.
   */
  function makeOmSession(opts: { currentModelId?: string } = {}) {
    const roleModels: Record<'observer' | 'reflector', string> = {
      observer: 'google/gemini-3-flash',
      reflector: 'anthropic/claude-haiku-4-5',
    };
    const selectedModels: Record<'observer' | 'reflector', string> = {
      observer: 'auto',
      reflector: 'auto',
    };
    const state: Record<string, unknown> = {};
    const role = (name: 'observer' | 'reflector') => ({
      model: () => selectedModels[name],
      modelId: () => (selectedModels[name] === 'auto' ? DEFAULT_OM_MODEL_ID : roleModels[name]),
      threshold: () => undefined,
      switchModel: async ({ modelId }: { modelId: string }) => {
        selectedModels[name] = modelId;
        roleModels[name] = modelId === 'auto' ? DEFAULT_OM_MODEL_ID : modelId;
      },
    });
    return {
      mode: { get: () => 'build' },
      model: { get: () => opts.currentModelId ?? '', switch: async () => {} },
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
    opts: {
      withStorage?: boolean;
      authEnabled?: boolean;
      provider?: string;
      defaultModelId?: string;
      withCustomProviders?: boolean;
      user?: { workosId: string; organizationId: string };
      /** Source-control sessions the runtime would find for a chat resource. */
      sourceSessions?: Record<string, Record<string, unknown>>;
      /** A run binding for any thread, mirroring a work-item thread's durable scope. */
      runBinding?: Record<string, unknown> | null;
    } = {},
  ) {
    const controller = {
      ...makeAgentController([{ provider: opts.provider ?? 'anthropic', hasApiKey: true }]),
      listModes: () => [{ id: 'build', defaultModelId: opts.defaultModelId }],
      getSession: async (sessionId: string) => (sessionId === 'r1' ? (session ?? undefined) : undefined),
    };
    const app = new Hono();
    if (opts.authEnabled !== false) {
      app.use('*', async (c, next) => {
        c.set('factoryAuthUser' as never, (opts.user ?? { workosId: 'user-a', organizationId: 'org1' }) as never);
        await next();
      });
    }
    const sourceSessions = opts.sourceSessions ?? {};
    mountApiRoutes(
      app as any,
      new ConfigRoutes({
        auth: fakeRouteAuth({ enabled: opts.authEnabled !== false }),
        controller,
        modelCredentials: seed.credentials,
        ...(opts.withStorage === false ? {} : { memorySettings: seed.memorySettings, factoryProjects: seed.projects }),
        sourceControlSessions: {
          getBySessionId: async (id: string) => sourceSessions[id] as never,
        },
        workItems: {
          findRunBindingByThread: async () => (opts.runBinding ?? null) as never,
        } as never,
        ...(opts.withCustomProviders ? { customProviders: seed.customProviders } : {}),
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
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'anthropic', {
      type: 'api_key',
      key: 'sk-anthropic',
    });
  });

  it('resolves sessionless auto roles from the Factory default model', async () => {
    const res = await buildApp(null, { defaultModelId: 'openai/gpt-5.6' }).request('/web/config/om');

    expect(res.status).toBe(200);
    expect((await res.json()).config).toMatchObject({
      observer: {
        model: 'auto',
        effectiveModelId: 'openai/gpt-6-luna',
        effectiveModelSource: 'configured-default',
      },
      reflector: {
        model: 'auto',
        effectiveModelId: 'openai/gpt-6-luna',
        effectiveModelSource: 'configured-default',
      },
    });
  });

  it('does not preview Gemini for auto when only the server has a Google key', async () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'server-google-key');
    try {
      const res = await buildApp(null, { defaultModelId: 'anthropic/claude-opus-5' }).request('/web/config/om');

      expect(res.status).toBe(200);
      const { config } = await res.json();
      expect(config.observer).toMatchObject({ model: 'auto', providerStatus: 'available' });
      expect(config.observer.effectiveModelId).toMatch(/^anthropic\/claude-haiku/);
      expect(config.reflector.effectiveModelId).toBe(config.observer.effectiveModelId);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('previews Auto from the scope a run resolves, not the union of both scopes', async () => {
    // An organization-wide Google key, while the personal row (beforeEach) holds
    // Anthropic only. A run without a Factory uses the personal scope, so Auto must
    // not preview a provider only the organization can reach.
    await seed.credentials.setCredential({ orgId: 'org1' }, 'google', { type: 'api_key', key: 'sk-org-google' });

    const res = await buildApp(null, { defaultModelId: 'anthropic/claude-opus-5' }).request('/web/config/om');

    expect(res.status).toBe(200);
    const { config } = await res.json();
    expect(config.observer).toMatchObject({ model: 'auto', providerStatus: 'available' });
    expect(config.observer.effectiveModelId).toMatch(/^anthropic\/claude-haiku/);

    // The store a run resolves from agrees with the preview.
    const runStore = new TenantCredentialStore('org1', 'user-a', seed.credentials, 'user');
    expect(await runStore.getApiKey('google')).toBeUndefined();
    expect(await runStore.getApiKey('anthropic')).toBe('sk-anthropic');
  });

  it("previews Auto from the addressed Factory's scope, not the caller's", async () => {
    // Google only on the personal row, Anthropic only organization-wide: a run under
    // this factory-scoped Factory authenticates with the organization's key.
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'google', {
      type: 'api_key',
      key: 'sk-personal-google',
    });
    await seed.credentials.setCredential({ orgId: 'org1' }, 'anthropic', { type: 'api_key', key: 'sk-org-anthropic' });
    const factory = await seed.projects.create({
      orgId: 'org1',
      userId: 'user-a',
      input: { name: 'Company', modelScope: 'factory', defaultModelId: 'anthropic/claude-opus-5' },
    });

    const res = await buildApp(null, { defaultModelId: 'anthropic/claude-opus-5' }).request(
      `/web/config/om?factoryId=${factory.id}`,
    );

    expect(res.status).toBe(200);
    const { config } = await res.json();
    expect(config.observer).toMatchObject({ model: 'auto', providerStatus: 'available' });
    expect(config.observer.effectiveModelId).toMatch(/^anthropic\/claude-haiku/);
    expect(config.reflector.effectiveModelId).toBe(config.observer.effectiveModelId);

    const runStore = new TenantCredentialStore('org1', 'user-a', seed.credentials, 'factory');
    expect(await runStore.getApiKey('google')).toBeUndefined();
    expect(await runStore.getApiKey('anthropic')).toBe('sk-org-anthropic');
  });

  it('previews the scope of the context it is addressing for a hybrid Factory', async () => {
    // A `hybrid` Factory shares one settings row but resolves Auto from different
    // credentials: its work items use the Factory's, a chat session its owner's. The
    // two directions must disagree here, or the test proves nothing.
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'google', {
      type: 'api_key',
      key: 'sk-personal-google',
    });
    await seed.credentials.setCredential({ orgId: 'org1' }, 'anthropic', { type: 'api_key', key: 'sk-org-anthropic' });
    const factory = await seed.projects.create({
      orgId: 'org1',
      userId: 'user-a',
      input: { name: 'Hybrid', modelScope: 'hybrid', defaultModelId: 'anthropic/claude-opus-5' },
    });
    const app = buildApp(null, {
      defaultModelId: 'anthropic/claude-opus-5',
      sourceSessions: {
        r1: { orgId: 'org1', userId: 'user-a', visibility: 'shared', factoryProjectId: factory.id },
      },
    });

    // The Factory settings page: no session, so this is what work items get.
    const workItems = await app.request(`/web/config/om?factoryId=${factory.id}`);
    expect(workItems.status).toBe(200);
    expect((await workItems.json()).config.observer.effectiveModelId).toMatch(/^anthropic\/claude-haiku/);

    // A chat in the same Factory: its owner's credentials, so Auto picks differently.
    const session = await app.request(`/web/config/om?factoryId=${factory.id}&sessionId=r1&threadId=t1`);
    expect(session.status).toBe(200);
    const { config } = await session.json();
    expect(config.observer).toMatchObject({ model: 'auto', providerStatus: 'available' });
    expect(config.observer.effectiveModelId).toMatch(/^google\/gemini/);
    expect(config.reflector.effectiveModelId).toBe(config.observer.effectiveModelId);
  });

  it('previews a run-bound thread from the Factory, not from its chat scope', async () => {
    // A work-item thread keeps the Factory's billing scope once a run is bound to
    // it: the runtime resolves the run binding, not the page the reader is on.
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'google', {
      type: 'api_key',
      key: 'sk-personal-google',
    });
    await seed.credentials.setCredential({ orgId: 'org1' }, 'anthropic', { type: 'api_key', key: 'sk-org-anthropic' });
    const factory = await seed.projects.create({
      orgId: 'org1',
      userId: 'user-a',
      input: { name: 'Hybrid', modelScope: 'hybrid', defaultModelId: 'anthropic/claude-opus-5' },
    });
    const app = buildApp(null, {
      defaultModelId: 'anthropic/claude-opus-5',
      sourceSessions: {
        r1: { orgId: 'org1', userId: 'user-a', visibility: 'shared', factoryProjectId: factory.id },
      },
      runBinding: { factoryProjectId: factory.id },
    });

    const bound = await app.request(`/web/config/om?factoryId=${factory.id}&sessionId=r1&threadId=t1`);
    expect(bound.status).toBe(200);
    expect((await bound.json()).config.observer.effectiveModelId).toMatch(/^anthropic\/claude-haiku/);

    // The same session on an unbound thread is an ordinary chat, so the owner's
    // own credentials are what a run would use.
    const unboundApp = buildApp(null, {
      defaultModelId: 'anthropic/claude-opus-5',
      sourceSessions: {
        r1: { orgId: 'org1', userId: 'user-a', visibility: 'shared', factoryProjectId: factory.id },
      },
    });
    const unbound = await unboundApp.request(`/web/config/om?factoryId=${factory.id}&sessionId=r1&threadId=t2`);
    expect(unbound.status).toBe(200);
    expect((await unbound.json()).config.observer.effectiveModelId).toMatch(/^google\/gemini/);
  });

  it("previews a shared session from its owner's credentials, not the viewer's", async () => {
    // A teammate opening someone else's shared chat sees what that chat's runs use:
    // the owner's personal providers, even though the viewer has different ones.
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'google', {
      type: 'api_key',
      key: 'sk-owner-google',
    });
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-b' }, 'openai', {
      type: 'api_key',
      key: 'sk-viewer-openai',
    });
    const factory = await seed.projects.create({
      orgId: 'org1',
      userId: 'user-a',
      input: { name: 'Hybrid', modelScope: 'hybrid', defaultModelId: 'anthropic/claude-opus-5' },
    });
    const app = buildApp(null, {
      defaultModelId: 'anthropic/claude-opus-5',
      user: { workosId: 'user-b', organizationId: 'org1' },
      sourceSessions: {
        r1: { orgId: 'org1', userId: 'user-a', visibility: 'shared', factoryProjectId: factory.id },
      },
    });

    const res = await app.request(`/web/config/om?factoryId=${factory.id}&sessionId=r1&threadId=t1`);
    expect(res.status).toBe(200);
    const { config } = await res.json();
    expect(config.observer).toMatchObject({ model: 'auto', providerStatus: 'available' });
    expect(config.observer.effectiveModelId).toMatch(/^google\/gemini/);

    // The store a run of that session resolves from agrees with the preview.
    const runStore = new TenantCredentialStore('org1', 'user-a', seed.credentials, 'user');
    expect(await runStore.getApiKey('google')).toBe('sk-owner-google');
    expect(await runStore.getApiKey('openai')).toBeUndefined();
  });

  it('rejects an observation threshold the observation activation buffer would break', async () => {
    const app = buildApp(makeOmSession());

    const rejected = await putJson(app, '/web/config/om/thresholds', {
      sessionId: 'r1',
      observationThreshold: 500,
    });
    expect(rejected.status).toBe(400);
    expect((await rejected.json()).error).toMatch(/greater than 2000 tokens/);
    // The buffer is an absolute 2000 tokens, so the boundary value fails a run too.
    expect(
      (await putJson(app, '/web/config/om/thresholds', { sessionId: 'r1', observationThreshold: 2000 })).status,
    ).toBe(400);
    await expect(seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' })).resolves.toBeNull();

    expect(
      (await putJson(app, '/web/config/om/thresholds', { sessionId: 'r1', observationThreshold: 2001 })).status,
    ).toBe(200);
    await expect(seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' })).resolves.toMatchObject({
      observationThreshold: 2001,
    });
  });

  it('reports a stored threshold below the floor as the one the observer runs with', async () => {
    // Rows written before the route enforced the floor still exist. Showing the
    // stored number would name a value that takes the process down on the next
    // message; the read path answers with what the observer will actually use.
    await seed.memorySettings.patch({
      orgId: 'org1',
      userId: 'user-a',
      patch: { observationThreshold: 1 },
    });

    const app = buildApp(makeOmSession());
    const res = await app.request('/web/config/om?sessionId=r1');

    expect(res.status).toBe(200);
    expect((await res.json()).config.observationThreshold).toBe(2001);
    // Reading does not rewrite the row; the next save does.
    await expect(seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' })).resolves.toMatchObject({
      observationThreshold: 1,
    });
  });

  it('resolves auto roles from the live session model ahead of the Factory default', async () => {
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'deepseek', {
      type: 'api_key',
      key: 'sk-deepseek',
    });
    const session = makeOmSession({ currentModelId: 'deepseek/deepseek-v4-pro' });
    const res = await buildApp(session, { defaultModelId: 'anthropic/claude-opus-5' }).request(
      '/web/config/om?sessionId=r1',
    );

    expect(res.status).toBe(200);
    expect((await res.json()).config).toMatchObject({
      observer: {
        model: 'auto',
        effectiveModelId: 'deepseek/deepseek-v4-flash',
        effectiveModelSource: 'live-session',
        providerStatus: 'available',
      },
      reflector: {
        model: 'auto',
        effectiveModelId: 'deepseek/deepseek-v4-flash',
        effectiveModelSource: 'live-session',
      },
    });
  });

  it('keeps the gateway route and reports the routed provider status', async () => {
    await seed.credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'deepseek', {
      type: 'api_key',
      key: 'sk-deepseek',
    });
    const session = makeOmSession({ currentModelId: 'mastra/deepseek/deepseek-v4-pro' });
    const res = await buildApp(session).request('/web/config/om?sessionId=r1');

    expect(res.status).toBe(200);
    expect((await res.json()).config.observer).toMatchObject({
      effectiveModelId: 'mastra/deepseek/deepseek-v4-flash',
      providerStatus: 'available',
    });
  });

  it('reports a gateway route available when only the Mastra gateway key is configured', async () => {
    vi.spyOn(MastraCodeGateway, 'getMastraGatewayApiKey').mockReturnValue('mg-test');
    const session = makeOmSession({ currentModelId: 'mastra/deepseek/deepseek-v4-pro' });
    const res = await buildApp(session).request('/web/config/om?sessionId=r1');

    expect(res.status).toBe(200);
    expect((await res.json()).config.observer).toMatchObject({
      effectiveModelId: 'mastra/deepseek/deepseek-v4-flash',
      providerStatus: 'available',
    });
  });

  it('reports a gateway route unavailable without a gateway key or provider credential', async () => {
    const session = makeOmSession({ currentModelId: 'mastra/deepseek/deepseek-v4-pro' });
    const res = await buildApp(session).request('/web/config/om?sessionId=r1');

    expect(res.status).toBe(200);
    expect((await res.json()).config.observer).toMatchObject({
      effectiveModelId: 'mastra/deepseek/deepseek-v4-flash',
      providerStatus: 'unavailable',
    });
  });

  it("reports the caller's own custom providers as available for personal memory settings", async () => {
    const acme = {
      providerId: 'acme',
      name: 'Acme',
      url: 'https://llm.acme.dev/v1',
      apiKey: 'sk-acme',
      models: ['fast-1'],
    };
    await seed.memorySettings.patch({
      orgId: 'org1',
      userId: 'user-a',
      patch: { observerModelId: 'acme/fast-1' },
    });
    const observer = async () =>
      (await (await buildApp(null, { withCustomProviders: true }).request('/web/config/om')).json()).config.observer;

    // Personal work never runs on the organization's endpoints.
    await seed.customProviders.create({ owner: { orgId: 'org1' }, createdBy: 'admin', input: acme });
    expect(await observer()).toMatchObject({ model: 'acme/fast-1', providerStatus: 'unavailable' });

    await seed.customProviders.create({ owner: { orgId: 'org1', userId: 'user-a' }, createdBy: 'user-a', input: acme });
    expect(await observer()).toMatchObject({
      model: 'acme/fast-1',
      effectiveModelId: 'acme/fast-1',
      providerStatus: 'available',
    });
  });

  it('rejects factory-scoped OM access for a factory outside the caller org', async () => {
    const foreign = await seed.projects.create({ orgId: 'org2', userId: 'user-b', input: { name: 'Other Org' } });
    const app = buildApp(makeOmSession());

    const read = await app.request(`/web/config/om?factoryId=${foreign.id}`);
    expect(read.status).toBe(404);

    const write = await putJson(app, '/web/config/om/observer/model', {
      sessionId: 'r1',
      modelId: 'anthropic/claude-fable-5',
      factoryId: foreign.id,
    });
    expect(write.status).toBe(404);
    await expect(
      seed.memorySettings.get({ orgId: 'org1', userId: factoryProjectSettingsUserId(foreign.id) }),
    ).resolves.toBeNull();
  });

  it('persists a role model switch without materializing the other auto role', async () => {
    const session = makeOmSession();
    const res = await putJson(buildApp(session), '/web/config/om/observer/model', {
      sessionId: 'r1',
      modelId: 'anthropic/claude-fable-5',
    });
    expect(res.status).toBe(200);
    expect((await res.json()).config.observerModelId).toBe('anthropic/claude-fable-5');

    const stored = await seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' });
    expect(stored).toMatchObject({
      observerModelId: 'anthropic/claude-fable-5',
      reflectorModelId: null,
    });
  });

  it('rejects an unknown OM role and a missing modelId', async () => {
    const app = buildApp(makeOmSession());

    const unknownRole = await putJson(app, '/web/config/om/scribe/model', {
      sessionId: 'r1',
      modelId: 'anthropic/claude-fable-5',
    });
    expect(unknownRole.status).toBe(400);
    expect((await unknownRole.json()).error).toBe('Unknown OM role "scribe"');

    const missing = await putJson(app, '/web/config/om/observer/model', { sessionId: 'r1' });
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe('Missing required field: modelId');
    await expect(seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' })).resolves.toBeNull();
  });

  it('resets one role to auto in storage without mutating the live session', async () => {
    await seed.memorySettings.patch({
      orgId: 'org1',
      userId: 'user-a',
      patch: { observerModelId: 'anthropic/claude-fable-5' },
    });
    const session = makeOmSession();
    await session.om.observer.switchModel({ modelId: 'session-only/observer' });

    const res = await putJson(buildApp(session), '/web/config/om/observer/model', {
      sessionId: 'r1',
      modelId: 'auto',
    });

    expect(res.status).toBe(200);
    expect((await res.json()).config.observer.model).toBe('auto');
    expect(session.om.observer.model()).toBe('session-only/observer');
    await expect(seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' })).resolves.toMatchObject({
      observerModelId: null,
    });
  });

  it('keeps independently selected role models on later switches', async () => {
    const session = makeOmSession();
    const app = buildApp(session);
    await putJson(app, '/web/config/om/reflector/model', { sessionId: 'r1', modelId: 'openai/gpt-5.6' });
    await putJson(app, '/web/config/om/observer/model', { sessionId: 'r1', modelId: 'anthropic/claude-fable-5' });

    const stored = await seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' });
    expect(stored).toMatchObject({
      observerModelId: 'anthropic/claude-fable-5',
      reflectorModelId: 'openai/gpt-5.6',
    });
  });

  it('persists thresholds to the memory-settings domain', async () => {
    const res = await putJson(buildApp(makeOmSession()), '/web/config/om/thresholds', {
      sessionId: 'r1',
      observationThreshold: 25000,
      reflectionThreshold: 45000,
    });
    expect(res.status).toBe(200);

    const stored = await seed.memorySettings.get({ orgId: 'org1', userId: 'user-a' });
    expect(stored).toMatchObject({ observationThreshold: 25000, reflectionThreshold: 45000 });
  });

  it('persists observe-attachments to the memory-settings domain', async () => {
    const res = await putJson(buildApp(makeOmSession()), '/web/config/om/observe-attachments', {
      sessionId: 'r1',
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

  it('falls back to the stored row when the session is not live', async () => {
    const app = buildApp(null);

    const initial = await app.request('/web/config/om?sessionId=r1');
    expect(initial.status).toBe(200);
    expect((await initial.json()).config.observerModelId).toBe(DEFAULT_OM_MODEL_ID);

    expect(
      (await putJson(app, '/web/config/om/observer/model', { sessionId: 'r1', modelId: 'anthropic/claude-fable-5' }))
        .status,
    ).toBe(200);
    expect(
      (await putJson(app, '/web/config/om/thresholds', { sessionId: 'r1', observationThreshold: 25000 })).status,
    ).toBe(200);
    expect((await putJson(app, '/web/config/om/observe-attachments', { sessionId: 'r1', value: false })).status).toBe(
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
      sessionId: 'r1',
      observationThreshold: 25000,
    });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('memory_settings_unavailable');
  });

  it('GET reads the stored memory-settings row without mutating the session', async () => {
    await seed.memorySettings.patch({
      orgId: 'org1',
      userId: 'user-a',
      patch: { observerModelId: 'openai/gpt-5.6', observationThreshold: 12000, observeAttachments: false },
    });

    const session = makeOmSession();
    const res = await buildApp(session).request('/web/config/om?sessionId=r1');
    expect(res.status).toBe(200);
    const { config } = await res.json();
    expect(config.observerModelId).toBe('openai/gpt-5.6');
    expect(config.observationThreshold).toBe(12000);
    expect(config.observeAttachments).toBe(false);
    expect(session.state.get().observationThreshold).toBeUndefined();
    expect(config.reflectorModelId).toBe(DEFAULT_OM_MODEL_ID);
  });

  it('GET ignores stale session OM values when no row is stored', async () => {
    const session = makeOmSession();
    await session.om.observer.switchModel({ modelId: 'alibaba-token-plan/deepseek-v4-flash' });
    session.state.set({ observationThreshold: 99000 });

    const res = await buildApp(session).request('/web/config/om?sessionId=r1');
    expect(res.status).toBe(200);
    const { config } = await res.json();
    expect(config.observerModelId).toBe(DEFAULT_OM_MODEL_ID);
    expect(config.reflectorModelId).toBe(DEFAULT_OM_MODEL_ID);
    expect(config.observationThreshold).toBe(30000);
    expect(session.state.get().observationThreshold).toBe(99000);
    expect(session.om.observer.model()).toBe('alibaba-token-plan/deepseek-v4-flash');
  });

  it('uses a sentinel local row when auth is disabled — never settings.json', async () => {
    const session = makeOmSession();
    const app = buildApp(session, { authEnabled: false });
    const res = await putJson(app, '/web/config/om/thresholds', { sessionId: 'r1', observationThreshold: 7000 });
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
        auth: fakeRouteAuth({
          enabled: opts.authEnabled !== false,
          isOrganizationAdmin: async (_organizationId, userId) => userId === admin.workosId,
        }),
        controller,
        ...(opts.withStorage === false ? {} : { customProviders: seed.customProviders }),
        onCustomProvidersChanged,
      }).routes(),
    );
    return app;
  }

  const admin = { workosId: 'admin', organizationId: 'org1' };
  const userA = { workosId: 'user-a', organizationId: 'org1' };
  const userB = { workosId: 'user-b', organizationId: 'org1' };
  const userOtherOrg = { workosId: 'user-c', organizationId: 'org2' };
  const soloUser = { workosId: 'solo' };
  const providerBody = { name: 'My LLM', url: 'https://llm.example.com/v1', apiKey: 'sk-x', models: ['m1', 'm2'] };
  const sharedBody = { ...providerBody, name: 'Team LLM', apiKey: 'sk-team', scope: 'org' };

  const postProvider = (app: Hono, body: unknown) =>
    app.request('/web/config/custom-providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  const listCustomProviders = async (user: Parameters<typeof buildApp>[0]) =>
    (await (await buildApp(user).request('/web/config/custom-providers')).json()).providers as Array<{
      id: string;
      name: string;
      scope: string;
    }>;

  const ownList = (user: { workosId: string; organizationId?: string }) =>
    seed.customProviders.list({ orgId: user.organizationId ?? `user:${user.workosId}`, userId: user.workosId });

  beforeEach(async () => {
    seed = await createFactoryStorageForTests();
    onCustomProvidersChanged.mockClear();
  });

  it('rejects unauthenticated access when web auth is enabled', async () => {
    expect((await buildApp(null).request('/web/config/custom-providers')).status).toBe(401);
  });

  it("saves an endpoint to the caller's own list by default, with the key redacted", async () => {
    const created = await postProvider(buildApp(userA), providerBody);
    expect(created.status).toBe(200);
    const { provider } = await created.json();
    expect(provider).toMatchObject({ name: 'My LLM', hasApiKey: true, models: ['m1', 'm2'], scope: 'user' });
    expect(JSON.stringify(provider)).not.toContain('sk-x');

    const stored = await ownList(userA);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ createdBy: 'user-a', apiKey: 'sk-x' });
    expect(await seed.customProviders.list({ orgId: 'org1' })).toEqual([]);
    expect(onCustomProvidersChanged).toHaveBeenCalledWith({ orgId: 'org1' });

    expect(await listCustomProviders(userA)).toMatchObject([{ id: provider.id, scope: 'user' }]);
  });

  it("keeps a member's own endpoints invisible to the rest of the organization", async () => {
    await postProvider(buildApp(userA), providerBody);

    expect(await listCustomProviders(userB)).toEqual([]);
    expect(await listCustomProviders(admin)).toEqual([]);
  });

  it('lets an admin share an endpoint with the organization', async () => {
    const created = await postProvider(buildApp(admin), sharedBody);
    expect(created.status).toBe(200);
    expect((await created.json()).provider).toMatchObject({ name: 'Team LLM', scope: 'org' });

    expect(await seed.customProviders.list({ orgId: 'org1' })).toMatchObject([{ createdBy: 'admin' }]);
    // Every member sees it, next to their own.
    await postProvider(buildApp(userA), providerBody);
    expect(await listCustomProviders(userA)).toMatchObject([
      { name: 'My LLM', scope: 'user' },
      { name: 'Team LLM', scope: 'org' },
    ]);
    expect(await listCustomProviders(userB)).toMatchObject([{ name: 'Team LLM', scope: 'org' }]);
  });

  // Any member could previously repoint an endpoint the whole organization
  // sends its prompts to.
  it("refuses a member's changes to the organization's endpoints", async () => {
    await postProvider(buildApp(admin), sharedBody);

    const added = await postProvider(buildApp(userA), { ...sharedBody, name: 'Sneaky' });
    expect(added.status).toBe(403);
    expect((await added.json()).error).toBe('organization_admin_required');

    const repointed = await postProvider(buildApp(userA), { ...sharedBody, url: 'https://evil.example.com/v1' });
    expect(repointed.status).toBe(403);

    const removed = await buildApp(userA).request('/web/config/custom-providers/team-llm?scope=org', {
      method: 'DELETE',
    });
    expect(removed.status).toBe(403);

    expect(await seed.customProviders.list({ orgId: 'org1' })).toMatchObject([
      { name: 'Team LLM', url: 'https://llm.example.com/v1' },
    ]);
  });

  // Scoped exactly like keys: an account without an organization has its own
  // list, and an organization list only an admin can change.
  it('scopes an account without an organization like its keys', async () => {
    expect((await postProvider(buildApp(soloUser), providerBody)).status).toBe(200);
    expect((await postProvider(buildApp(soloUser), sharedBody)).status).toBe(403);

    expect(await listCustomProviders(soloUser)).toMatchObject([{ name: 'My LLM', scope: 'user' }]);
    expect(await ownList(soloUser)).toHaveLength(1);
  });

  it('refuses a name that belongs to a built-in provider', async () => {
    const res = await postProvider(buildApp(userA), { ...providerBody, name: 'Anthropic' });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('provider_name_taken');
    expect(await ownList(userA)).toEqual([]);
  });

  // Each of these ids already means something to model resolution or the
  // pickers. This server's catalog lists only Anthropic, as when models.dev
  // has not loaded, so "OpenAI" is caught by the static registry.
  it.each([
    ['OpenAI', 'a built-in provider missing from a catalog that failed to load'],
    ['Mastra', 'the Mastra Gateway catalog, listed per tenant'],
    ['Mastra Gateway', 'the id the gateway key is saved under'],
    ['MastraCode', "the MastraCode gateway's namespace"],
    ['OpenAI Codex', 'the id OpenAI sign-ins are saved under'],
    ['Kimi for Coding', 'an older id rewritten to another provider before lookup'],
  ])('refuses the name "%s": %s', async name => {
    const res = await postProvider(buildApp(userA), { ...providerBody, name });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('provider_name_taken');
    expect(await ownList(userA)).toEqual([]);
  });

  // Adding under a name already in use used to replace that endpoint and
  // inherit its saved key.
  it('refuses to add an endpoint under a name already in use', async () => {
    await postProvider(buildApp(admin), sharedBody);

    const { apiKey: _apiKey, ...withoutKey } = sharedBody;
    const res = await postProvider(buildApp(admin), { ...withoutKey, url: 'https://evil.example.com/v1' });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('provider_name_taken');
    expect(await seed.customProviders.list({ orgId: 'org1' })).toMatchObject([
      { url: 'https://llm.example.com/v1', apiKey: 'sk-team' },
    ]);
  });

  it('keeps the saved key when an edit sends none and the host stays the same', async () => {
    const { provider } = await (await postProvider(buildApp(userA), providerBody)).json();
    const { apiKey: _apiKey, ...withoutKey } = providerBody;

    const edited = await postProvider(buildApp(userA), {
      ...withoutKey,
      url: 'https://llm.example.com/v2',
      previousId: provider.id,
    });

    expect((await edited.json()).provider).toMatchObject({ url: 'https://llm.example.com/v2', hasApiKey: true });
    expect(await ownList(userA)).toMatchObject([{ url: 'https://llm.example.com/v2', apiKey: 'sk-x' }]);
  });

  // The saved key is never shown, so keeping it across a host change would
  // let whoever edits the endpoint send it to their own server.
  it('asks for the key again when an edit moves an endpoint to another host', async () => {
    const { provider } = await (await postProvider(buildApp(admin), sharedBody)).json();
    const { apiKey: _apiKey, ...withoutKey } = sharedBody;

    const res = await postProvider(buildApp(admin), {
      ...withoutKey,
      url: 'https://evil.example.com/v1',
      previousId: provider.id,
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('api_key_required');
    expect(await seed.customProviders.list({ orgId: 'org1' })).toMatchObject([
      { url: 'https://llm.example.com/v1', apiKey: 'sk-team' },
    ]);
  });

  it('reports an edit or a removal of an endpoint that is not there', async () => {
    const edited = await postProvider(buildApp(userA), { ...providerBody, previousId: 'missing' });
    expect(edited.status).toBe(404);

    // The organization's endpoint is not in the caller's own list, the default.
    await postProvider(buildApp(admin), sharedBody);
    const removed = await buildApp(admin).request('/web/config/custom-providers/team-llm', { method: 'DELETE' });
    expect(removed.status).toBe(404);
    expect(await seed.customProviders.list({ orgId: 'org1' })).toHaveLength(1);
  });

  it('renames via previousId without leaving the old row behind', async () => {
    const created = await postProvider(buildApp(userA), providerBody);
    const { provider } = await created.json();

    const renamed = await postProvider(buildApp(userA), { ...providerBody, name: 'New Name', previousId: provider.id });
    expect(renamed.status).toBe(200);

    const stored = await ownList(userA);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.name).toBe('New Name');
  });

  it('keeps providers invisible across organizations', async () => {
    await postProvider(buildApp(userA), providerBody);
    await postProvider(buildApp(admin), sharedBody);

    expect(await listCustomProviders(userOtherOrg)).toEqual([]);
  });

  it('reports each custom provider in the provider catalog at the scope it is saved at, without exposing keys', async () => {
    await postProvider(buildApp(userA), providerBody);
    await postProvider(buildApp(admin), sharedBody);
    await postProvider(buildApp(userOtherOrg), {
      name: 'Other LLM',
      url: 'https://other.example.com/v1',
      apiKey: 'sk-other',
      models: ['other-model'],
    });

    const response = await buildApp(userA).request('/web/config/providers');
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.providers).toContainEqual({
      provider: 'my-llm',
      source: 'stored-user',
      userCredential: 'api_key',
      custom: true,
    });
    expect(body.providers).toContainEqual({
      provider: 'team-llm',
      source: 'stored-org',
      orgCredential: 'api_key',
      orgKey: true,
      custom: true,
    });
    expect(body.providers).not.toContainEqual(expect.objectContaining({ provider: 'other-llm' }));
    expect(JSON.stringify(body)).not.toContain('sk-');

    // Another member is not shown the first member's own endpoint.
    const forOtherMember = await (await buildApp(userB).request('/web/config/providers')).json();
    expect(forOtherMember.providers).not.toContainEqual(expect.objectContaining({ provider: 'my-llm' }));
  });

  it("deletes from the caller's own list only", async () => {
    const created = await postProvider(buildApp(userA), providerBody);
    const { provider } = await created.json();

    await buildApp(userOtherOrg).request(`/web/config/custom-providers/${provider.id}`, { method: 'DELETE' });
    await buildApp(userB).request(`/web/config/custom-providers/${provider.id}`, { method: 'DELETE' });
    expect(await ownList(userA)).toHaveLength(1);

    const res = await buildApp(userA).request(`/web/config/custom-providers/${provider.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await ownList(userA)).toEqual([]);
  });

  it('uses a sentinel local org when auth is disabled — never settings.json', async () => {
    const app = buildApp(null, { authEnabled: false });
    const created = await postProvider(app, providerBody);
    expect(created.status).toBe(200);

    const stored = await seed.customProviders.list({ orgId: 'local' });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ createdBy: 'local', name: 'My LLM' });

    // Single-user: no admin to ask, and a name is the user's own business.
    expect((await postProvider(app, sharedBody)).status).toBe(200);
    expect((await postProvider(app, { ...providerBody, name: 'Anthropic' })).status).toBe(200);
    expect(await seed.customProviders.list({ orgId: 'local' })).toHaveLength(3);
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
