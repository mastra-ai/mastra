import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildConfigRoutes, buildProviderAccess, listProviders } from './config-routes.js';
import { mountApiRoutes } from './test-utils.js';

type ConfigAuthStorage = NonNullable<Parameters<typeof buildConfigRoutes>[0]['authStorage']>;

function makeAuthStorage(opts: {
  login?: ConfigAuthStorage['login'];
  loggedIn?: string[];
  storedKeys?: string[];
  oauthTokens?: Record<string, string | undefined>;
}): ConfigAuthStorage {
  const loggedIn = new Set(opts.loggedIn ?? []);
  const storedKeys = new Set(opts.storedKeys ?? []);
  const oauthTokens = opts.oauthTokens ?? {};
  return {
    get: (provider: string) =>
      loggedIn.has(provider) ? { type: 'oauth', access: 'a', refresh: 'r', expires: 1 } : undefined,
    getApiKey: async (provider: string) => (provider in oauthTokens ? oauthTokens[provider] : `oauth-${provider}`),
    hasStoredApiKey: (provider: string) => storedKeys.has(provider),
    login: opts.login ?? vi.fn(),
    remove: vi.fn(),
    setStoredApiKey: vi.fn(),
  };
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

  it('reports OpenAI Codex OAuth as OpenAI catalog access', async () => {
    const auth = makeAuthStorage({ loggedIn: ['openai-codex'] });

    const list = await listProviders(
      makeAgentController([{ provider: 'openai', hasApiKey: false, apiKeyEnvVar: 'OPENAI_API_KEY' }]),
      auth,
    );

    expect(list[0]?.source).toBe('oauth');
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

  it('unlocks OpenAI packs from OpenAI Codex OAuth', async () => {
    const auth = makeAuthStorage({ loggedIn: ['openai-codex'] });

    const access = await buildProviderAccess(
      makeAgentController([{ provider: 'openai', hasApiKey: false, apiKeyEnvVar: 'OPENAI_API_KEY' }]),
      auth,
    );

    expect(access.openai).toBe('oauth');
  });
});

describe('buildConfigRoutes OAuth orchestration', () => {
  it('uses AuthStorage.login for the manual Claude flow', async () => {
    const login = vi.fn<ConfigAuthStorage['login']>(async (provider, callbacks) => {
      expect(provider).toBe('anthropic');
      callbacks.onAuth({ url: 'https://claude.ai/oauth/authorize' });
      expect(await callbacks.onPrompt({ message: 'Paste the authorization code:' })).toBe('code#state');
    });
    const authStorage = makeAuthStorage({ login });
    const app = new Hono();
    mountApiRoutes(
      app,
      buildConfigRoutes({
        controller: makeAgentController([{ provider: 'anthropic', hasApiKey: false }]),
        authStorage,
      }),
    );

    const startResponse = await app.request('/web/config/providers/anthropic/oauth/start', { method: 'POST' });
    const startBody: unknown = await startResponse.json();
    expect(startBody).toMatchObject({
      authUrl: 'https://claude.ai/oauth/authorize',
      completionMode: 'manual-code',
      ok: true,
    });
    if (!startBody || typeof startBody !== 'object' || !('loginId' in startBody)) {
      throw new Error('OAuth start response did not include a login id');
    }

    const completeResponse = await app.request('/web/config/providers/anthropic/oauth/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ loginId: startBody.loginId, code: 'code#state' }),
    });

    expect(completeResponse.status).toBe(200);
    expect(login).toHaveBeenCalledOnce();
  });

  it('uses the existing browser callback flow for a Codex subscription', async () => {
    let finishBrowserLogin: (() => void) | undefined;
    const browserLogin = new Promise<void>(resolve => {
      finishBrowserLogin = resolve;
    });
    const login = vi.fn<ConfigAuthStorage['login']>(async (provider, callbacks) => {
      expect(provider).toBe('openai-codex');
      expect(callbacks.authMode).toBe('browser');
      callbacks.onAuth({ url: 'https://auth.openai.com/oauth/authorize', instructions: 'Complete in browser.' });
      await browserLogin;
    });
    const authStorage = makeAuthStorage({ login });
    const app = new Hono();
    mountApiRoutes(
      app,
      buildConfigRoutes({
        controller: makeAgentController([{ provider: 'openai', hasApiKey: false }]),
        authStorage,
      }),
    );

    const startResponse = await app.request('/web/config/providers/openai/oauth/start', { method: 'POST' });
    const startBody: unknown = await startResponse.json();
    expect(startBody).toMatchObject({
      authUrl: 'https://auth.openai.com/oauth/authorize',
      completionMode: 'browser-callback',
      instructions: 'Complete in browser.',
      ok: true,
    });
    if (!startBody || typeof startBody !== 'object' || !('loginId' in startBody)) {
      throw new Error('OAuth start response did not include a login id');
    }
    if (!finishBrowserLogin) throw new Error('Browser login was not initialized');
    finishBrowserLogin();

    const completeResponse = await app.request('/web/config/providers/openai/oauth/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ loginId: startBody.loginId, code: '' }),
    });

    expect(completeResponse.status).toBe(200);
    expect(login).toHaveBeenCalledOnce();
  });
});

describe('buildConfigRoutes credential isolation', () => {
  it('keeps process-global provider credentials read-only for multi-user hosts', async () => {
    const login = vi.fn();
    const setStoredApiKey = vi.fn();
    const remove = vi.fn();
    const authStorage: ConfigAuthStorage = {
      get: vi.fn(),
      getApiKey: vi.fn(),
      hasStoredApiKey: vi.fn(() => false),
      login,
      setStoredApiKey,
      remove,
    };
    const routes = buildConfigRoutes({
      controller: makeAgentController([{ provider: 'anthropic', hasApiKey: false }]),
      authStorage,
      credentialManagementEnabled: false,
    });
    const app = new Hono();
    mountApiRoutes(app, routes);

    const listResponse = await app.request('/web/config/providers');
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

    const credentialRoutes: Array<{ method: 'POST' | 'PUT' | 'DELETE'; path: string }> = [
      { method: 'POST', path: '/web/config/providers/anthropic/oauth/start' },
      { method: 'POST', path: '/web/config/providers/anthropic/oauth/complete' },
      { method: 'DELETE', path: '/web/config/providers/anthropic/oauth' },
      { method: 'PUT', path: '/web/config/providers/anthropic/key' },
      { method: 'DELETE', path: '/web/config/providers/anthropic/key' },
    ];
    for (const { method, path } of credentialRoutes) {
      const response = await app.request(path, { method });
      expect(response.status).toBe(403);
    }

    expect(login).not.toHaveBeenCalled();
    expect(setStoredApiKey).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
