import crypto from 'node:crypto';

import type { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { SlackManifestClient } from './client';
import { SlackProvider, stripTrailingSlash, resolveSlackAdapterConfig, hashConfig } from './provider';
import type { SlackConnectOptions } from './types';

describe('connect object form', () => {
  it('requires a name when connecting without an agent id', async () => {
    const provider = new SlackProvider();
    await expect(
      // @ts-expect-error deliberately omitting the required name to exercise the runtime guard
      provider.connect({ id: 'controller-1' }),
    ).rejects.toThrow(/"name" is required/);
  });
});

describe('stripTrailingSlash', () => {
  it('removes a single trailing slash', () => {
    expect(stripTrailingSlash('https://mastra-demo.calebbarnes.ca/')).toBe('https://mastra-demo.calebbarnes.ca');
  });

  it('removes multiple trailing slashes', () => {
    expect(stripTrailingSlash('https://example.com///')).toBe('https://example.com');
  });

  it('leaves a URL without a trailing slash unchanged', () => {
    expect(stripTrailingSlash('https://example.com')).toBe('https://example.com');
  });

  it('preserves path segments and only strips the trailing slash', () => {
    expect(stripTrailingSlash('https://example.com/base/')).toBe('https://example.com/base');
  });

  it('produces a clean OAuth callback URL when joined', () => {
    const baseUrl = stripTrailingSlash('https://mastra-demo.calebbarnes.ca/');
    expect(`${baseUrl}/slack/oauth/callback`).toBe('https://mastra-demo.calebbarnes.ca/slack/oauth/callback');
  });
});

describe('resolveSlackAdapterConfig', () => {
  it('carries textDisplay through to the resolved adapter config', () => {
    expect(resolveSlackAdapterConfig({ textDisplay: 'hidden' }).textDisplay).toBe('hidden');
    expect(resolveSlackAdapterConfig({ adapterConfig: { textDisplay: 'hidden' } }).textDisplay).toBe('hidden');
  });

  it('omits textDisplay when unset so the core default governs', () => {
    expect('textDisplay' in resolveSlackAdapterConfig({})).toBe(false);
  });

  it('carries textFormat through to the resolved adapter config', () => {
    const resolved = resolveSlackAdapterConfig({ textFormat: 'plain' });
    expect(resolved.textFormat).toBe('plain');
  });

  it('omits textFormat when unset so the core default governs', () => {
    const resolved = resolveSlackAdapterConfig({});
    expect('textFormat' in resolved).toBe(false);
  });
});

describe('agent_view migration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Hash stored by apps created while the manifest declared `assistant_view`. */
  const legacyHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        name: 'Helper',
        description: 'Helps',
        slashCommands: undefined,
        baseUrl: 'https://example.com',
      }),
    )
    .digest('hex')
    .slice(0, 16);

  async function restart(configHash: string, config: { agentSessions?: boolean } = {}) {
    const updateApp = vi.spyOn(SlackManifestClient.prototype, 'updateApp').mockResolvedValue(undefined as never);
    const store = new InMemoryStore();
    const channels = (await store.getStore('channels'))!;
    const provider = new SlackProvider({
      ...config,
      baseUrl: 'https://example.com',
      token: 'xoxe-config',
      refreshToken: 'xoxe-refresh',
    });
    await channels.saveInstallation({
      id: 'install-1',
      platform: 'slack',
      agentId: 'agent-1',
      status: 'active',
      webhookId: 'hook-1',
      configHash,
      data: {
        appId: 'A1',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        signingSecret: 'signing-secret',
        teamId: 'T1',
        botToken: 'xoxb-test',
        botUserId: 'U-bot',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    provider.__attach({
      getStorage: () => store,
      getAgentById: () => ({
        name: 'Helper',
        getDescription: () => 'Helps',
        getChannels: () => undefined,
        setChannels: () => {},
      }),
      getServer: () => undefined,
    } as unknown as Mastra);
    await provider.initialize();
    return { updateApp, channels, provider };
  }

  it('moves apps created with assistant_view to agent_view on the next startup', async () => {
    const { updateApp, channels } = await restart(legacyHash);

    expect(updateApp).toHaveBeenCalledTimes(1);
    const [appId, manifest] = updateApp.mock.calls[0]!;
    expect(appId).toBe('A1');
    expect(manifest.features?.agent_view).toEqual({ agent_description: 'Helps' });
    expect(manifest.features).not.toHaveProperty('assistant_view');
    const [record] = (await channels.listInstallations('slack')) as Array<{ configHash?: string }>;
    expect(record?.configHash).toBe(hashConfig({}, 'https://example.com', 'Helper', 'Helps'));
  });

  it('leaves apps already on agent_view alone', async () => {
    const { updateApp } = await restart(hashConfig({}, 'https://example.com', 'Helper', 'Helps'));
    expect(updateApp).not.toHaveBeenCalled();
  });

  it('subscribes existing apps to the stop event once agentSessions is turned on', async () => {
    const { updateApp, channels } = await restart(hashConfig({}, 'https://example.com', 'Helper', 'Helps'), {
      agentSessions: true,
    });

    expect(updateApp).toHaveBeenCalledTimes(1);
    const [, manifest] = updateApp.mock.calls[0]!;
    expect(manifest.settings?.event_subscriptions?.bot_events).toContain('agent_session_stopped');
    const [record] = (await channels.listInstallations('slack')) as Array<{ configHash?: string }>;
    expect(record?.configHash).toBe(hashConfig({ agentSessions: true }, 'https://example.com', 'Helper', 'Helps'));
  });

  it('builds Agent Session adapters only when agentSessions is on', async () => {
    const hash = hashConfig({}, 'https://example.com', 'Helper', 'Helps');
    const off = await restart(hash);
    expect(off.provider.getAdapter('install-1')!.supportsTurnCancellation).toBe(false);
    vi.restoreAllMocks();

    const on = await restart(hash, { agentSessions: true });
    const adapter = on.provider.getAdapter('install-1')!;
    expect(adapter.supportsTurnCancellation).toBe(true);

    // The bridge is on: a text status first marks the session processing.
    const apiCall = vi.fn(async () => ({ ok: true }));
    (adapter as any)._client = { apiCall, assistant: { threads: { setStatus: vi.fn(async () => ({ ok: true })) } } };
    await adapter.startTyping('slack:C1:1.0', 'is thinking…');
    expect(apiCall).toHaveBeenCalledWith(
      'agents.sessions.setStatus',
      expect.objectContaining({ status: 'processing' }),
    );
  });
});

describe('connect config hash', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores a hash that config drift detection reproduces from the stored installation', async () => {
    vi.spyOn(SlackManifestClient.prototype, 'createApp').mockResolvedValue({
      appId: 'A1',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      signingSecret: 'signing-secret',
      oauthAuthorizeUrl: 'https://slack.com/oauth/v2/authorize?client_id=client-id',
    } as Awaited<ReturnType<SlackManifestClient['createApp']>>);

    const store = new InMemoryStore();
    const provider = new SlackProvider({
      baseUrl: 'https://example.com',
      tokenResolver: async () => 'token',
      encryptionKey: 'k'.repeat(32),
    });
    provider.__attach({
      getStorage: () => store,
      getAgentById: () => ({ name: 'Helper', getDescription: () => 'Helps' }),
    } as unknown as Mastra);

    await provider.connect({
      id: 'agent-1',
      name: 'Helper',
      description: 'Helps',
      slashCommands: ['/ask', { command: '/summarize', description: 'Summarize a thread' }],
    });

    const channels = (await store.getStore('channels'))!;
    const [record] = (await channels.listInstallations('slack')) as Array<{
      configHash?: string;
      data: { slashCommands?: SlackConnectOptions['slashCommands'] };
    }>;

    expect(record?.configHash).toBe(
      hashConfig({ slashCommands: record!.data.slashCommands }, 'https://example.com', 'Helper', 'Helps'),
    );
  });
});

describe('base URL resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MASTRA_SERVER_URL;
  });

  it('mints the app manifest against MASTRA_SERVER_URL when no baseUrl or server override is set', async () => {
    process.env.MASTRA_SERVER_URL = 'https://my-app.server.example.com/';
    const createApp = vi.spyOn(SlackManifestClient.prototype, 'createApp').mockResolvedValue({
      appId: 'A1',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      signingSecret: 'signing-secret',
      oauthAuthorizeUrl: 'https://slack.com/oauth/v2/authorize?client_id=client-id',
    } as Awaited<ReturnType<SlackManifestClient['createApp']>>);

    const store = new InMemoryStore();
    const provider = new SlackProvider({
      tokenResolver: async () => 'token',
      encryptionKey: 'k'.repeat(32),
    });
    provider.__attach({
      getStorage: () => store,
      getAgentById: () => ({ name: 'Helper', getDescription: () => 'Helps' }),
      getServer: () => undefined,
    } as unknown as Mastra);

    await provider.connect({ id: 'agent-1', name: 'Helper' });

    const manifest = createApp.mock.calls[0]![0] as {
      oauth_config: { redirect_urls: string[] };
      settings: { event_subscriptions?: { request_url?: string } };
    };
    expect(manifest.oauth_config.redirect_urls).toEqual(['https://my-app.server.example.com/slack/oauth/callback']);
    expect(manifest.settings.event_subscriptions?.request_url).toMatch(
      /^https:\/\/my-app\.server\.example\.com\/slack\/events\//,
    );
  });

  it('explicit server.studio* config beats MASTRA_SERVER_URL', async () => {
    process.env.MASTRA_SERVER_URL = 'https://env-var.example.com';
    const createApp = vi.spyOn(SlackManifestClient.prototype, 'createApp').mockResolvedValue({
      appId: 'A1',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      signingSecret: 'signing-secret',
      oauthAuthorizeUrl: 'https://slack.com/oauth/v2/authorize?client_id=client-id',
    } as Awaited<ReturnType<SlackManifestClient['createApp']>>);

    const store = new InMemoryStore();
    const provider = new SlackProvider({
      tokenResolver: async () => 'token',
      encryptionKey: 'k'.repeat(32),
    });
    provider.__attach({
      getStorage: () => store,
      getAgentById: () => ({ name: 'Helper', getDescription: () => 'Helps' }),
      getServer: () => ({ studioProtocol: 'https', studioHost: 'config-override.example.com', studioPort: 443 }),
    } as unknown as Mastra);

    await provider.connect({ id: 'agent-1', name: 'Helper' });

    const manifest = createApp.mock.calls[0]![0] as { oauth_config: { redirect_urls: string[] } };
    expect(manifest.oauth_config.redirect_urls).toEqual(['https://config-override.example.com/slack/oauth/callback']);
  });
});

describe('disconnect', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes the minted Slack app when disconnecting a pending installation', async () => {
    vi.spyOn(SlackManifestClient.prototype, 'createApp').mockResolvedValue({
      appId: 'A-PENDING',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      signingSecret: 'signing-secret',
      oauthAuthorizeUrl: 'https://slack.com/oauth/v2/authorize?client_id=client-id',
    } as Awaited<ReturnType<SlackManifestClient['createApp']>>);
    const deleteApp = vi.spyOn(SlackManifestClient.prototype, 'deleteApp').mockResolvedValue(undefined as never);

    const store = new InMemoryStore();
    const provider = new SlackProvider({
      baseUrl: 'https://example.com',
      tokenResolver: async () => 'token',
      encryptionKey: 'k'.repeat(32),
    });
    provider.__attach({
      getStorage: () => store,
      getAgentById: () => ({ name: 'Helper', getDescription: () => 'Helps' }),
    } as unknown as Mastra);

    await provider.connect({ id: 'agent-1', name: 'Helper' });
    expect(await provider.listInstallations()).toHaveLength(1);

    await provider.disconnect('agent-1');

    // The pending installation already minted a real Slack app; disconnect
    // must delete it rather than orphaning it in the workspace.
    expect(deleteApp).toHaveBeenCalledWith('A-PENDING');
    expect(await provider.listInstallations()).toHaveLength(0);
  });
});
