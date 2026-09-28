import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { InMemoryChannelsStorage } from '@mastra/core/storage';
import { isEncrypted } from './crypto';
import {
  DEV_PORTAL_BOTS_URL,
  TEAMS_DEV_PORTAL_SCOPE,
  TEAMS_GRAPH_SCOPE,
  TeamsProvider,
  resolveTeamsAdapterConfig,
} from './index';
import type { TeamsProviderConfig, TeamsTokenResolver } from './index';
import { PLATFORM } from './install-store';

const GRAPH_ORIGIN = 'https://graph.microsoft.com';
const DEV_PORTAL_ORIGIN = 'https://dev.teams.microsoft.com';
const LOGIN_ORIGIN = 'https://login.microsoftonline.com';
const BASE_URL = 'https://bot.example.com';

const APP_ID = '11111111-2222-3333-4444-555555555555';
const APP_PASSWORD = 'client~secret~value';
const OBJECT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const MINTED_APP_ID = '99999999-8888-7777-6666-555555555555';
const MINTED_SECRET = 'minted~client~secret';
// Delegated provisioning refuses to run without an encryption key, so
// delegated tests supply one explicitly.
const ENC_KEY = 'a-32+char-passphrase-for-testing-only';

let mockAgent: MockAgent;

beforeEach(() => {
  // The store falls back to MASTRA_ENCRYPTION_KEY — pin it so plaintext-storage
  // assertions don't depend on the ambient shell/CI environment.
  vi.stubEnv('MASTRA_ENCRYPTION_KEY', '');
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await mockAgent.close();
});

/** Fresh provider + its own in-memory storage (returned so tests can inspect it). */
function makeProvider(config: Partial<TeamsProviderConfig> = {}) {
  const storage = new InMemoryChannelsStorage();
  const provider = new TeamsProvider({ storage, baseUrl: BASE_URL, ...config } as TeamsProviderConfig);
  return { provider, storage };
}

/** A scope-aware manager resolver returning a distinct token per audience. */
function makeTokenResolver(): TeamsTokenResolver & ReturnType<typeof vi.fn> {
  return vi.fn(async (scope: string | string[]) => (scope === TEAMS_GRAPH_SCOPE ? 'graph-token' : 'dev-portal-token'));
}

/** Stub the client-credentials token mint used to validate self-managed bot credentials. */
function stubCredentialMint(opts: { ok?: boolean; tenant?: string } = {}): () => string | undefined {
  const { ok = true, tenant = 'botframework.com' } = opts;
  let captured: string | undefined;
  mockAgent
    .get(LOGIN_ORIGIN)
    .intercept({ path: `/${tenant}/oauth2/v2.0/token`, method: 'POST' })
    .reply(
      ok ? 200 : 401,
      reqOpts => {
        captured = String(reqOpts.body);
        return ok
          ? { token_type: 'Bearer', access_token: 'bf-token', expires_in: 3599 }
          : { error: 'invalid_client', error_description: 'AADSTS7000215: Invalid client secret provided.' };
      },
      { headers: { 'content-type': 'application/json' } },
    )
    .persist();
  return () => captured;
}

/** Stub the full Graph + Dev Portal happy path for one delegated provisioning. */
function stubProvisioning() {
  let createAppBody: Record<string, unknown> | undefined;
  let createAppAuth: string | undefined;
  let addPasswordBody: Record<string, unknown> | undefined;
  let botRegistrationBody: Record<string, unknown> | undefined;
  let botRegistrationAuth: string | undefined;

  mockAgent
    .get(GRAPH_ORIGIN)
    .intercept({ path: '/v1.0/applications', method: 'POST' })
    .reply(201, reqOpts => {
      createAppBody = JSON.parse(String(reqOpts.body));
      createAppAuth = (reqOpts.headers as Record<string, string>).authorization;
      return { id: OBJECT_ID, appId: MINTED_APP_ID };
    });
  mockAgent
    .get(GRAPH_ORIGIN)
    .intercept({ path: `/v1.0/applications/${OBJECT_ID}/addPassword`, method: 'POST' })
    .reply(200, reqOpts => {
      addPasswordBody = JSON.parse(String(reqOpts.body));
      return { secretText: MINTED_SECRET, keyId: 'key-1' };
    });
  mockAgent
    .get(DEV_PORTAL_ORIGIN)
    .intercept({ path: '/api/botframework', method: 'POST' })
    .reply(200, reqOpts => {
      botRegistrationBody = JSON.parse(String(reqOpts.body));
      botRegistrationAuth = (reqOpts.headers as Record<string, string>).authorization;
      return {};
    });

  return {
    createAppBody: () => createAppBody,
    createAppAuth: () => createAppAuth,
    addPasswordBody: () => addPasswordBody,
    botRegistrationBody: () => botRegistrationBody,
    botRegistrationAuth: () => botRegistrationAuth,
  };
}

describe('TeamsProvider — discovery + skeleton', () => {
  it('exposes the teams channel id', () => {
    expect(makeProvider().provider.id).toBe('teams');
  });

  it('reports discovery metadata (not configured without credentials or installs)', () => {
    expect(makeProvider().provider.getInfo()).toMatchObject({
      id: 'teams',
      name: 'Microsoft Teams',
      isConfigured: false,
    });
  });

  it('reports configured when credentials are available', () => {
    expect(makeProvider({ appId: APP_ID, appPassword: APP_PASSWORD }).provider.getInfo().isConfigured).toBe(true);
    expect(makeProvider({ tokenResolver: makeTokenResolver() }).provider.getInfo().isConfigured).toBe(true);
  });

  it('mounts a single unauthenticated POST webhook route', () => {
    const routes = makeProvider().provider.getRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      path: `/${PLATFORM}/events/:webhookId`,
      method: 'POST',
      requiresAuth: false,
    });
  });
});

describe('TeamsProvider.connect — self-managed', () => {
  it('returns a Developer Portal deep link and a pending install when no credentials are set', async () => {
    const { provider, storage } = makeProvider();
    const result = await provider.connect('agent-1');
    expect(result).toMatchObject({ type: 'deep_link', url: DEV_PORTAL_BOTS_URL });
    const record = await storage.getInstallationByAgent(PLATFORM, 'agent-1');
    expect(record?.status).toBe('pending');
  });

  it('validates credentials via a Bot Framework token mint and activates immediately', async () => {
    const capturedMint = stubCredentialMint();
    const { provider, storage } = makeProvider({ appId: APP_ID, appPassword: APP_PASSWORD });

    const result = await provider.connect('agent-1', { name: 'Support Bot' });
    expect(result.type).toBe('immediate');

    // The mint exchanged this bot's own credentials for the Bot Framework audience.
    const mintBody = new URLSearchParams(capturedMint());
    expect(mintBody.get('grant_type')).toBe('client_credentials');
    expect(mintBody.get('client_id')).toBe(APP_ID);
    expect(mintBody.get('client_secret')).toBe(APP_PASSWORD);
    expect(mintBody.get('scope')).toBe('https://api.botframework.com/.default');

    const record = await storage.getInstallationByAgent(PLATFORM, 'agent-1');
    expect(record?.status).toBe('active');
    expect(record?.data.appId).toBe(APP_ID);
    expect(record?.data.botName).toBe('Support Bot');
    expect(String(record?.data.messagingEndpoint)).toBe(`${BASE_URL}/${PLATFORM}/events/${record?.webhookId}`);
    expect(provider.isConfigured()).toBe(true);
  });

  it('accepts per-connect credentials, falling back to provider defaults', async () => {
    stubCredentialMint();
    const { provider, storage } = makeProvider();
    const result = await provider.connect('agent-1', { appId: APP_ID, appPassword: APP_PASSWORD });
    expect(result.type).toBe('immediate');
    const record = await storage.getInstallationByAgent(PLATFORM, 'agent-1');
    expect(record?.data.appId).toBe(APP_ID);
  });

  it('surfaces a credential rejection from Microsoft', async () => {
    stubCredentialMint({ ok: false });
    const { provider } = makeProvider({ appId: APP_ID, appPassword: 'wrong' });
    await expect(provider.connect('agent-1')).rejects.toThrow(/Microsoft rejected the bot credentials/);
  });

  it('validates single-tenant bots against their own tenant', async () => {
    const tenant = 'my-tenant-id';
    const capturedMint = stubCredentialMint({ tenant });
    const { provider } = makeProvider({ appId: APP_ID, appPassword: APP_PASSWORD, appTenantId: tenant });
    await provider.connect('agent-1');
    expect(capturedMint()).toBeDefined();
  });

  it('blocks a second agent from connecting the same bot', async () => {
    stubCredentialMint();
    const { provider } = makeProvider({ appId: APP_ID, appPassword: APP_PASSWORD });
    await provider.connect('agent-1');
    await expect(provider.connect('agent-2')).rejects.toThrow(/already connected to agent "agent-1"/);
  });

  it('rejects reconnecting an already-active agent', async () => {
    stubCredentialMint();
    const { provider } = makeProvider({ appId: APP_ID, appPassword: APP_PASSWORD });
    await provider.connect('agent-1');
    await expect(provider.connect('agent-1')).rejects.toThrow(/already connected to Microsoft Teams/);
  });

  it('warns when a user-supplied client secret is persisted without an encryption key', async () => {
    stubCredentialMint();
    const { provider } = makeProvider({ appId: APP_ID, appPassword: APP_PASSWORD });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await provider.connect('agent-1');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('WITHOUT encryption'));
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('TeamsProvider.connect — delegated provisioning', () => {
  it('provisions an Entra app + secret + Dev Portal bot registration per agent', async () => {
    const stubs = stubProvisioning();
    const tokenResolver = makeTokenResolver();
    const { provider, storage } = makeProvider({ tokenResolver, encryptionKey: ENC_KEY });

    const result = await provider.connect('agent-1', { name: 'Sales Bot' });
    expect(result).toMatchObject({ type: 'deep_link', url: DEV_PORTAL_BOTS_URL });

    // Two audiences resolved — Graph for the Entra app, Dev Portal for the bot.
    expect(tokenResolver).toHaveBeenCalledWith(TEAMS_GRAPH_SCOPE, undefined);
    expect(tokenResolver).toHaveBeenCalledWith(TEAMS_DEV_PORTAL_SCOPE, undefined);
    expect(stubs.createAppAuth()).toBe('Bearer graph-token');
    expect(stubs.botRegistrationAuth()).toBe('Bearer dev-portal-token');

    expect(stubs.createAppBody()).toMatchObject({
      displayName: 'Sales Bot',
      signInAudience: 'AzureADMultipleOrgs',
    });
    expect(stubs.addPasswordBody()).toMatchObject({ passwordCredential: { displayName: 'mastra-teams' } });

    const record = await storage.getInstallationByAgent(PLATFORM, 'agent-1');
    expect(record?.status).toBe('active');
    expect(record?.data.appId).toBe(MINTED_APP_ID);
    expect(record?.data.entraObjectId).toBe(OBJECT_ID);
    expect(isEncrypted(String(record?.data.appPassword))).toBe(true);

    expect(stubs.botRegistrationBody()).toMatchObject({
      botId: MINTED_APP_ID,
      name: 'Sales Bot',
      messagingEndpoint: `${BASE_URL}/${PLATFORM}/events/${record?.webhookId}`,
      callingEndpoint: '',
    });
  });

  it('encrypts the minted client secret at rest when an encryption key is set', async () => {
    stubProvisioning();
    const { provider, storage } = makeProvider({
      tokenResolver: makeTokenResolver(),
      encryptionKey: ENC_KEY,
    });
    await provider.connect('agent-1');
    const record = await storage.getInstallationByAgent(PLATFORM, 'agent-1');
    expect(isEncrypted(String(record?.data.appPassword))).toBe(true);
    expect(String(record?.data.appPassword)).not.toContain(MINTED_SECRET);
  });

  it('rejects per-connect credentials in delegated mode', async () => {
    const { provider } = makeProvider({ tokenResolver: makeTokenResolver() });
    await expect(provider.connect('agent-1', { appId: APP_ID, appPassword: APP_PASSWORD })).rejects.toThrow(
      /provisioned per agent/,
    );
  });

  it('requires a baseUrl to register the messaging endpoint', async () => {
    const storage = new InMemoryChannelsStorage();
    const provider = new TeamsProvider({ storage, tokenResolver: makeTokenResolver(), encryptionKey: ENC_KEY });
    await expect(provider.connect('agent-1')).rejects.toThrow(/needs a baseUrl/);
  });

  it('rolls back the Entra application when the Dev Portal registration fails', async () => {
    mockAgent
      .get(GRAPH_ORIGIN)
      .intercept({ path: '/v1.0/applications', method: 'POST' })
      .reply(201, { id: OBJECT_ID, appId: MINTED_APP_ID });
    mockAgent
      .get(GRAPH_ORIGIN)
      .intercept({ path: `/v1.0/applications/${OBJECT_ID}/addPassword`, method: 'POST' })
      .reply(200, { secretText: MINTED_SECRET });
    mockAgent
      .get(DEV_PORTAL_ORIGIN)
      .intercept({ path: '/api/botframework', method: 'POST' })
      .reply(403, { error: { message: 'forbidden' } });
    let rolledBack = false;
    mockAgent
      .get(GRAPH_ORIGIN)
      .intercept({ path: `/v1.0/applications/${OBJECT_ID}`, method: 'DELETE' })
      .reply(204, () => {
        rolledBack = true;
        return '';
      });

    const { provider, storage } = makeProvider({ tokenResolver: makeTokenResolver(), encryptionKey: ENC_KEY });
    await expect(provider.connect('agent-1')).rejects.toThrow(/Dev Portal bot registration failed/);
    expect(rolledBack).toBe(true);
    expect(await storage.getInstallationByAgent(PLATFORM, 'agent-1')).toBeNull();
  });

  it('surfaces resolver failures from connect()', async () => {
    const { provider } = makeProvider({
      tokenResolver: async () => {
        throw new Error('platform credential fetch failed');
      },
      encryptionKey: ENC_KEY,
    });
    await expect(provider.connect('agent-1')).rejects.toThrow('platform credential fetch failed');
  });

  it('rejects SingleTenant provisioning without a tenant id', async () => {
    const { provider } = makeProvider({
      tokenResolver: makeTokenResolver(),
      encryptionKey: ENC_KEY,
      appType: 'SingleTenant',
    });
    await expect(provider.connect('agent-1')).rejects.toThrow(/no appTenantId is available/);
  });

  it('provisions SingleTenant bots with the tenant stored and passed to the resolver', async () => {
    const tenant = 'customer-tenant-id';
    const stubs = stubProvisioning();
    const tokenResolver = makeTokenResolver();
    const { provider, storage } = makeProvider({
      tokenResolver,
      encryptionKey: ENC_KEY,
      appType: 'SingleTenant',
      appTenantId: tenant,
    });

    await provider.connect('agent-1');

    // The resolver receives the tenant for both audiences, and the Entra app
    // is created single-tenant.
    expect(tokenResolver).toHaveBeenCalledWith(TEAMS_GRAPH_SCOPE, tenant);
    expect(tokenResolver).toHaveBeenCalledWith(TEAMS_DEV_PORTAL_SCOPE, tenant);
    expect(stubs.createAppBody()).toMatchObject({ signInAudience: 'AzureADMyOrg' });

    // The tenant persists on the installation so the rebuilt adapter can
    // authenticate against the bot's own tenant after a restart.
    const record = await storage.getInstallationByAgent(PLATFORM, 'agent-1');
    expect(record?.data.appTenantId).toBe(tenant);
  });

  it('rolls back the bot registration and Entra app when persisting the installation fails', async () => {
    stubProvisioning();
    let botDeleted = false;
    mockAgent
      .get(DEV_PORTAL_ORIGIN)
      .intercept({ path: `/api/botframework/${MINTED_APP_ID}`, method: 'DELETE' })
      .reply(200, () => {
        botDeleted = true;
        return {};
      });
    let appDeleted = false;
    mockAgent
      .get(GRAPH_ORIGIN)
      .intercept({ path: `/v1.0/applications/${OBJECT_ID}`, method: 'DELETE' })
      .reply(204, () => {
        appDeleted = true;
        return '';
      });

    const storage = new InMemoryChannelsStorage();
    storage.saveInstallation = async () => {
      throw new Error('database unavailable');
    };
    const provider = new TeamsProvider({
      storage,
      baseUrl: BASE_URL,
      tokenResolver: makeTokenResolver(),
      encryptionKey: ENC_KEY,
    } as TeamsProviderConfig);

    await expect(provider.connect('agent-1')).rejects.toThrow('database unavailable');
    expect(botDeleted).toBe(true);
    expect(appDeleted).toBe(true);
  });

  it('treats onInstall hook failures as non-fatal once the installation is saved', async () => {
    stubProvisioning();
    const { provider, storage } = makeProvider({
      tokenResolver: makeTokenResolver(),
      encryptionKey: ENC_KEY,
      onInstall: async () => {
        throw new Error('user hook exploded');
      },
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await provider.connect('agent-1');
      expect(result.type).toBe('deep_link');
    } finally {
      warnSpy.mockRestore();
    }
    expect((await storage.getInstallationByAgent(PLATFORM, 'agent-1'))?.status).toBe('active');
  });

  it('refuses to provision without an encryption key, before touching Azure', async () => {
    // No Graph/Dev Portal stubs registered — any control-plane call would
    // throw a network error instead of this message (net connect disabled).
    const tokenResolver = makeTokenResolver();
    const { provider } = makeProvider({ tokenResolver });
    await expect(provider.connect('agent-1')).rejects.toThrow(/requires an encryption key/);
    expect(tokenResolver).not.toHaveBeenCalled();
  });

  it('surfaces Mastra storage initialization failures instead of degrading to in-memory', async () => {
    const provider = new TeamsProvider({ baseUrl: BASE_URL, tokenResolver: makeTokenResolver() });
    provider.__attach({
      getStorage: () => ({
        init: async () => {
          throw new Error('storage init failed');
        },
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await expect(provider.connect('agent-1')).rejects.toThrow('storage init failed');
  });
});

describe('TeamsProvider.configure', () => {
  it('rejects direct credentials in delegated mode but allows non-credential settings', async () => {
    const { provider } = makeProvider({ tokenResolver: makeTokenResolver() });
    await expect(provider.configure({ appId: APP_ID })).rejects.toThrow(/constructed with a tokenResolver/);
    await expect(provider.configure({ appPassword: APP_PASSWORD })).rejects.toThrow(/constructed with a tokenResolver/);
    await expect(provider.configure({ baseUrl: 'https://other.example.com' })).resolves.toBeUndefined();
  });

  it('updates the default credentials new connects fall back to', async () => {
    stubCredentialMint();
    const { provider, storage } = makeProvider();
    await provider.configure({ appId: APP_ID, appPassword: APP_PASSWORD });
    const result = await provider.connect('agent-1');
    expect(result.type).toBe('immediate');
    expect((await storage.getInstallationByAgent(PLATFORM, 'agent-1'))?.data.appId).toBe(APP_ID);
  });

  it('clears default credentials with null', async () => {
    const { provider } = makeProvider({ appId: APP_ID, appPassword: APP_PASSWORD });
    await provider.configure(null);
    // Without credentials, connect degrades to the pending deep-link flow.
    expect((await provider.connect('agent-1')).type).toBe('deep_link');
  });
});

describe('TeamsProvider.disconnect', () => {
  it('deletes the Dev Portal registration and Entra app for provisioned bots', async () => {
    stubProvisioning();
    const tokenResolver = makeTokenResolver();
    const { provider, storage } = makeProvider({ tokenResolver, encryptionKey: ENC_KEY });
    await provider.connect('agent-1');

    let botDeleted = false;
    let appDeleted = false;
    mockAgent
      .get(DEV_PORTAL_ORIGIN)
      .intercept({ path: `/api/botframework/${MINTED_APP_ID}`, method: 'DELETE' })
      .reply(200, () => {
        botDeleted = true;
        return {};
      });
    mockAgent
      .get(GRAPH_ORIGIN)
      .intercept({ path: `/v1.0/applications/${OBJECT_ID}`, method: 'DELETE' })
      .reply(204, () => {
        appDeleted = true;
        return '';
      });

    await provider.disconnect('agent-1');
    expect(botDeleted).toBe(true);
    expect(appDeleted).toBe(true);
    expect(await storage.getInstallationByAgent(PLATFORM, 'agent-1')).toBeNull();
    expect(provider.isConfigured()).toBe(false);
  });

  it('still removes the installation when control-plane cleanup fails', async () => {
    stubProvisioning();
    const { provider, storage } = makeProvider({ tokenResolver: makeTokenResolver(), encryptionKey: ENC_KEY });
    await provider.connect('agent-1');

    mockAgent
      .get(DEV_PORTAL_ORIGIN)
      .intercept({ path: `/api/botframework/${MINTED_APP_ID}`, method: 'DELETE' })
      .reply(500, {});
    mockAgent
      .get(GRAPH_ORIGIN)
      .intercept({ path: `/v1.0/applications/${OBJECT_ID}`, method: 'DELETE' })
      .reply(500, {});

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await provider.disconnect('agent-1');
    } finally {
      warnSpy.mockRestore();
    }
    expect(await storage.getInstallationByAgent(PLATFORM, 'agent-1')).toBeNull();
  });

  it('makes no control-plane calls for self-managed bots', async () => {
    stubCredentialMint();
    const { provider, storage } = makeProvider({ appId: APP_ID, appPassword: APP_PASSWORD });
    await provider.connect('agent-1');
    // No Graph/Dev Portal stubs registered — any call would throw (net connect disabled).
    await provider.disconnect('agent-1');
    expect(await storage.getInstallationByAgent(PLATFORM, 'agent-1')).toBeNull();
  });

  it('throws for an unknown agent', async () => {
    const { provider } = makeProvider();
    await expect(provider.disconnect('missing')).rejects.toThrow(/No Teams installation found/);
  });
});

describe('TeamsProvider webhook route', () => {
  const stubMastra = {
    getAgentById: () => undefined,
    getStorage: () => undefined,
    getServer: () => undefined,
  };

  function makeCtx(webhookId: string | undefined) {
    return {
      req: {
        param: (k: string) => (k === 'webhookId' ? webhookId : undefined),
        header: () => undefined,
        raw: new Request(`${BASE_URL}/teams/events/${webhookId}`, { method: 'POST', body: '{}' }),
      },
      json: (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
    };
  }

  async function connectedHandler() {
    stubCredentialMint();
    const { provider, storage } = makeProvider({ appId: APP_ID, appPassword: APP_PASSWORD });
    await provider.connect('agent-1');
    const record = await storage.getInstallationByAgent(PLATFORM, 'agent-1');

    const route = provider.getRoutes()[0];
    if (!('createHandler' in route)) throw new Error('expected a createHandler route');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = await route.createHandler({ mastra: stubMastra as any });
    return { handler, webhookId: record!.webhookId! };
  }

  it('404s an unknown webhookId', async () => {
    const { handler } = await connectedHandler();
    expect((await handler(makeCtx('does-not-exist'))).status).toBe(404);
  });

  it('acks a known webhook when no agent is wired (Bot Framework stops retrying)', async () => {
    const { handler, webhookId } = await connectedHandler();
    expect((await handler(makeCtx(webhookId))).status).toBe(200);
  });
});

describe('TeamsProvider — public method parity', () => {
  it('getInstallation returns the full installation, listInstallations only public info', async () => {
    stubCredentialMint();
    const { provider } = makeProvider({ appId: APP_ID, appPassword: APP_PASSWORD });
    await provider.connect('agent-1', { name: 'Support Bot' });

    const full = await provider.getInstallation('agent-1');
    expect(full?.appPassword).toBe(APP_PASSWORD);

    const listed = await provider.listInstallations();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ platform: PLATFORM, agentId: 'agent-1', displayName: 'Support Bot' });
    expect(listed[0]).not.toHaveProperty('appPassword');
  });
});

describe('resolveTeamsAdapterConfig (stream binding)', () => {
  it('defaults streaming and typing on', () => {
    expect(resolveTeamsAdapterConfig({})).toEqual({ streaming: true, typingStatus: true });
  });

  it('honors explicit overrides', () => {
    expect(resolveTeamsAdapterConfig({ streaming: false, typingStatus: false })).toEqual({
      streaming: false,
      typingStatus: false,
    });
  });
});

describe('TeamsProviderConfig — credential mode exclusivity (compile-time)', () => {
  it('rejects combining direct credentials with a tokenResolver', () => {
    // @ts-expect-error — appId cannot be combined with tokenResolver.
    const bad1: TeamsProviderConfig = { appId: APP_ID, tokenResolver: makeTokenResolver() };
    // @ts-expect-error — appPassword cannot be combined with tokenResolver.
    const bad2: TeamsProviderConfig = { appPassword: APP_PASSWORD, tokenResolver: makeTokenResolver() };
    const ok1: TeamsProviderConfig = { appId: APP_ID, appPassword: APP_PASSWORD };
    const ok2: TeamsProviderConfig = { tokenResolver: makeTokenResolver() };
    expect([bad1, bad2, ok1, ok2]).toBeDefined();
  });
});
