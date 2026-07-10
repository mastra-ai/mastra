import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { buildConfigRoutes, buildProviderAccess, listProviders } from './config-routes.js';

function makeAuthStorage(opts: {
  loggedIn?: string[];
  storedKeys?: string[];
  oauthTokens?: Record<string, string | undefined>;
}): AuthStorage {
  const loggedIn = new Set(opts.loggedIn ?? []);
  const storedKeys = new Set(opts.storedKeys ?? []);
  const oauthTokens = opts.oauthTokens ?? {};
  return {
    get: (provider: string) => (loggedIn.has(provider) ? { type: 'oauth', access: 'a', refresh: 'r', expires: 1 } : undefined),
    getApiKey: async (provider: string) => (provider in oauthTokens ? oauthTokens[provider] : `oauth-${provider}`),
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

  it('does not report OpenAI Codex OAuth as generic OpenAI catalog access', async () => {
    const auth = makeAuthStorage({ loggedIn: ['openai-codex'] });

    const list = await listProviders(
      makeAgentController([{ provider: 'openai', hasApiKey: false, apiKeyEnvVar: 'OPENAI_API_KEY' }]),
      auth,
    );

    expect(list[0]?.source).toBe('none');
  });

  it('does not report stale OAuth as active when refresh fails', async () => {
    const auth = makeAuthStorage({ loggedIn: ['anthropic'], oauthTokens: { anthropic: undefined } });

    const list = await listProviders(
      makeAgentController([{ provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]),
      auth,
    );

    expect(list[0]?.source).toBe('none');
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
});

describe('buildProviderAccess', () => {
  it('does not unlock OAuth-gated packs when an OAuth refresh fails', async () => {
    const auth = makeAuthStorage({ loggedIn: ['anthropic'], oauthTokens: { anthropic: undefined } });

    const access = await buildProviderAccess(
      makeAgentController([{ provider: 'anthropic', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]),
      auth,
    );

    expect(access.anthropic).toBe(false);
  });

  it('maps stored OpenAI catalog access to the openai-codex auth slot', async () => {
    const auth = makeAuthStorage({ storedKeys: ['openai-codex'] });

    const access = await buildProviderAccess(
      makeAgentController([{ provider: 'openai', hasApiKey: false, apiKeyEnvVar: 'OPENAI_API_KEY' }]),
      auth,
    );

    expect(access.openai).toBe('apikey');
  });

  it('does not unlock OpenAI packs from OpenAI Codex OAuth alone', async () => {
    const auth = makeAuthStorage({ loggedIn: ['openai-codex'] });

    const access = await buildProviderAccess(
      makeAgentController([{ provider: 'openai', hasApiKey: false, apiKeyEnvVar: 'OPENAI_API_KEY' }]),
      auth,
    );

    expect(access.openai).toBe(false);
  });
});

describe('buildConfigRoutes credential isolation', () => {
  it('keeps process-global provider credentials read-only for multi-user hosts', async () => {
    const set = vi.fn();
    const setStoredApiKey = vi.fn();
    const remove = vi.fn();
    const authStorage = {
      get: vi.fn(),
      getApiKey: vi.fn(),
      hasStoredApiKey: vi.fn(() => false),
      set,
      setStoredApiKey,
      remove,
    } as unknown as AuthStorage;
    const routes = buildConfigRoutes({
      controller: makeAgentController([{ provider: 'anthropic', hasApiKey: false }]),
      authStorage,
      credentialManagementEnabled: false,
    });
    const json = (body: unknown, status = 200) => Response.json(body, { status });

    const listRoute = routes.find(route => route.path === '/web/config/providers' && route.method === 'GET');
    if (!listRoute || !('handler' in listRoute)) throw new Error('Provider list route is missing');
    const listResponse = await listRoute.handler({ json } as never);
    expect(await listResponse.json()).toEqual({
      credentialManagementEnabled: false,
      providers: [
        {
          provider: 'anthropic',
          displayName: 'Claude Pro/Max',
          oauthSupported: false,
          source: 'none',
        },
      ],
    });

    for (const [method, path] of [
      ['POST', '/web/config/providers/:provider/oauth/start'],
      ['POST', '/web/config/providers/:provider/oauth/complete'],
      ['DELETE', '/web/config/providers/:provider/oauth'],
      ['PUT', '/web/config/providers/:provider/key'],
      ['DELETE', '/web/config/providers/:provider/key'],
    ] as const) {
      const route = routes.find(candidate => candidate.path === path && candidate.method === method);
      if (!route || !('handler' in route)) throw new Error(`Provider route is missing: ${method} ${path}`);
      const response = await route.handler({ json } as never);
      expect(response.status).toBe(403);
    }

    expect(set).not.toHaveBeenCalled();
    expect(setStoredApiKey).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
