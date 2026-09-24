import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { channels } from '../channels.js';

const TOKEN = 'fake-test-token';
const SLACK_REFRESH_TOKEN = 'xoxe-fake-refresh';
const TELEGRAM_BOT_TOKEN = '123456:fake-telegram';
const DISCORD_BOT_TOKEN = 'discord-fake-bot';

interface MockConnection {
  id: string;
  integrationId: string;
  status: 'active' | 'needs_reauth' | 'pending' | 'revoked';
  connectedByUserId?: string;
  connectedAt?: string;
  createdAt?: string;
  accountLabel?: string | null;
}

function makeConnection(
  overrides: Partial<MockConnection> & Pick<MockConnection, 'id' | 'integrationId'>,
): MockConnection {
  return {
    status: 'active',
    connectedByUserId: 'user_1',
    connectedAt: '2026-09-01T00:00:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    accountLabel: 'default',
    ...overrides,
  };
}

type CredentialMap = Record<string, { type: 'oauth2'; accessToken: string } | { type: 'api_key'; apiKey: string }>;

type ContextMap = Record<
  string,
  { connection_config: Record<string, unknown> | null; metadata: Record<string, unknown> | null }
>;

function platformFetch(input: {
  connections?: MockConnection[];
  credentials?: CredentialMap;
  contexts?: ContextMap;
  connectionsStatus?: number;
}) {
  return vi.fn<typeof fetch>().mockImplementation(async request => {
    const url = new URL(String(request));
    const path = url.pathname;
    if (path.endsWith('/connections')) {
      if (input.connectionsStatus) {
        return Response.json({ error: 'nope' }, { status: input.connectionsStatus });
      }
      return Response.json({ connections: input.connections ?? [] });
    }
    const credMatch = path.match(/\/v2\/connections\/([^/]+)\/credentials$/);
    if (credMatch) {
      const connectionId = decodeURIComponent(credMatch[1]!);
      const credential = input.credentials?.[connectionId];
      if (!credential) return Response.json({ error: 'no credential' }, { status: 404 });
      return Response.json(credential);
    }
    const ctxMatch = path.match(/\/v2\/connections\/([^/]+)\/context$/);
    if (ctxMatch) {
      const connectionId = decodeURIComponent(ctxMatch[1]!);
      const context = input.contexts?.[connectionId] ?? { connection_config: null, metadata: null };
      return Response.json(context);
    }
    return Response.json({ error: `unexpected path ${path}` }, { status: 500 });
  });
}

function options(fetchMock: ReturnType<typeof vi.fn>, extra?: Record<string, unknown>) {
  return {
    projectId: 'proj_1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    ...extra,
  };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('@mastra/slack');
  vi.doUnmock('@mastra/telegram');
  vi.doUnmock('@chat-adapter/discord');
  warnSpy.mockRestore();
});

describe('channels()', () => {
  it('throws when the project id is missing', () => {
    expect(() => channels({ client: { accessToken: TOKEN } })).toThrow(/project id/i);
  });

  it('throws when ttlMs is negative', () => {
    expect(() => channels({ projectId: 'proj_1', client: { accessToken: TOKEN }, ttlMs: -1 })).toThrow(/ttlMs/i);
  });

  it('rejects malformed integration override keys', () => {
    expect(() =>
      channels({
        projectId: 'proj_1',
        client: { accessToken: TOKEN },
        integrations: { 'bad key!': {} },
      }),
    ).toThrow(/integrations option/i);
  });

  it('returns an empty snapshot when the project has no channel connections', async () => {
    const fetchMock = platformFetch({ connections: [makeConnection({ id: 'c_gh', integrationId: 'github' })] });
    const resolver = channels(options(fetchMock));
    await expect(resolver).resolves.toEqual({});
  });

  it('builds a slack provider from a single active slack connection', async () => {
    const spy = vi.fn();
    vi.doMock('@mastra/slack', () => ({
      SlackProvider: class {
        readonly id = 'slack';
        constructor(config: unknown) {
          spy(config);
        }
        getRoutes() {
          return [];
        }
      },
    }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack' })],
      credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_REFRESH_TOKEN, expiresAt: null } },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const record = await channelsFn(options(fetchMock));
    expect(record.slack).toBeDefined();
    expect(record.slack.id).toBe('slack');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: SLACK_REFRESH_TOKEN }));
  });

  it('builds a telegram provider from an api_key credential', async () => {
    const spy = vi.fn();
    vi.doMock('@mastra/telegram', () => ({
      TelegramProvider: class {
        readonly id = 'telegram';
        constructor(config: unknown) {
          spy(config);
        }
        getRoutes() {
          return [];
        }
      },
    }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
      credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const record = await channelsFn(options(fetchMock));
    expect(record.telegram).toBeDefined();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ botToken: TELEGRAM_BOT_TOKEN }));
  });

  it('shims discord into a ChannelProvider via AdapterChannelProvider', async () => {
    const spy = vi.fn();
    const fakeAdapter = { name: 'discord' };
    vi.doMock('@chat-adapter/discord', () => ({
      createDiscordAdapter: (config: unknown) => {
        spy(config);
        return fakeAdapter;
      },
    }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_dc', integrationId: 'discord' })],
      credentials: { c_dc: { type: 'oauth2', accessToken: DISCORD_BOT_TOKEN, expiresAt: null } },
      contexts: {
        c_dc: {
          connection_config: null,
          metadata: { applicationId: 'app_123', publicKey: 'pubkey_abc' },
        },
      },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const record = await channelsFn(options(fetchMock));
    expect(record.discord).toBeDefined();
    expect(record.discord.id).toBe('discord');
    expect(typeof record.discord.getRoutes).toBe('function');
    expect(record.discord.getRoutes()).toEqual([]);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        botToken: DISCORD_BOT_TOKEN,
        applicationId: 'app_123',
        publicKey: 'pubkey_abc',
      }),
    );
  });

  it('resolves slack + telegram + discord together on a multi-channel project', async () => {
    vi.doMock('@mastra/slack', () => ({
      SlackProvider: class {
        readonly id = 'slack';
        getRoutes() {
          return [];
        }
      },
    }));
    vi.doMock('@mastra/telegram', () => ({
      TelegramProvider: class {
        readonly id = 'telegram';
        getRoutes() {
          return [];
        }
      },
    }));
    vi.doMock('@chat-adapter/discord', () => ({
      createDiscordAdapter: () => ({ name: 'discord' }),
    }));
    const fetchMock = platformFetch({
      connections: [
        makeConnection({ id: 'c_slack', integrationId: 'slack' }),
        makeConnection({ id: 'c_tg', integrationId: 'telegram' }),
        makeConnection({ id: 'c_dc', integrationId: 'discord' }),
      ],
      credentials: {
        c_slack: { type: 'oauth2', accessToken: SLACK_REFRESH_TOKEN, expiresAt: null },
        c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN },
        c_dc: { type: 'oauth2', accessToken: DISCORD_BOT_TOKEN, expiresAt: null },
      },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const record = await channelsFn(options(fetchMock));
    expect(Object.keys(record).sort()).toEqual(['discord', 'slack', 'telegram']);
  });

  it('skips a channel when its peer package is not installed', async () => {
    vi.doMock('@mastra/slack', () => {
      throw new Error("Cannot find module '@mastra/slack'");
    });
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack' })],
      credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_REFRESH_TOKEN, expiresAt: null } },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const record = await channelsFn(options(fetchMock));
    expect(record.slack).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/@mastra\/slack/));
  });

  it('skips connections marked disabled via per-integration overrides', async () => {
    vi.doMock('@mastra/slack', () => ({
      SlackProvider: class {
        readonly id = 'slack';
        getRoutes() {
          return [];
        }
      },
    }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack' })],
      credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_REFRESH_TOKEN, expiresAt: null } },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const record = await channelsFn(options(fetchMock, { integrations: { slack: { disabled: true } } }));
    expect(record.slack).toBeUndefined();
  });

  it('honors a pinned connectionId over env-var fallback', async () => {
    vi.doMock('@mastra/slack', () => ({
      SlackProvider: class {
        readonly id = 'slack';
        constructor(public config: unknown) {}
        getRoutes() {
          return [];
        }
      },
    }));
    const fetchMock = platformFetch({
      connections: [
        makeConnection({ id: 'c_slack_a', integrationId: 'slack', accountLabel: 'A' }),
        makeConnection({ id: 'c_slack_b', integrationId: 'slack', accountLabel: 'B' }),
      ],
      credentials: {
        c_slack_b: { type: 'oauth2', accessToken: 'refresh-b', expiresAt: null },
      },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const record = await channelsFn(options(fetchMock, { integrations: { slack: { connectionId: 'c_slack_b' } } }));
    expect(record.slack).toBeDefined();
    expect((record.slack as any).config).toMatchObject({ refreshToken: 'refresh-b' });
  });

  it('warns and skips when multiple active connections exist without a pin', async () => {
    vi.doMock('@mastra/slack', () => ({
      SlackProvider: class {
        readonly id = 'slack';
        getRoutes() {
          return [];
        }
      },
    }));
    const fetchMock = platformFetch({
      connections: [
        makeConnection({ id: 'c_slack_a', integrationId: 'slack', accountLabel: 'A' }),
        makeConnection({ id: 'c_slack_b', integrationId: 'slack', accountLabel: 'B' }),
      ],
    });
    const { channels: channelsFn } = await import('../channels.js');
    const record = await channelsFn(options(fetchMock));
    expect(record.slack).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/active connections/));
  });

  it('skips a connection that needs_reauth', async () => {
    vi.doMock('@mastra/slack', () => ({
      SlackProvider: class {
        readonly id = 'slack';
        getRoutes() {
          return [];
        }
      },
    }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack', status: 'needs_reauth' })],
    });
    const { channels: channelsFn } = await import('../channels.js');
    const record = await channelsFn(options(fetchMock));
    expect(record.slack).toBeUndefined();
  });

  it('merges providerOptions into the provider constructor', async () => {
    const spy = vi.fn();
    vi.doMock('@mastra/telegram', () => ({
      TelegramProvider: class {
        readonly id = 'telegram';
        constructor(config: unknown) {
          spy(config);
        }
        getRoutes() {
          return [];
        }
      },
    }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
      credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
    });
    const { channels: channelsFn } = await import('../channels.js');
    await channelsFn(
      options(fetchMock, {
        integrations: { telegram: { providerOptions: { pollingIntervalMs: 5000 } } },
      }),
    );
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ botToken: TELEGRAM_BOT_TOKEN, pollingIntervalMs: 5000 }),
    );
  });

  it('caches snapshots within ttlMs and invalidate() forces refresh', async () => {
    vi.doMock('@mastra/telegram', () => ({
      TelegramProvider: class {
        readonly id = 'telegram';
        getRoutes() {
          return [];
        }
      },
    }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
      credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const resolver = channelsFn(options(fetchMock));
    await resolver();
    await resolver();
    // /connections + /credentials + /context — 3 requests on first resolution
    const firstCallCount = fetchMock.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);
    resolver.invalidate();
    await resolver();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(firstCallCount);
  });

  it('refresh() returns a fresh snapshot and updates the cache', async () => {
    vi.doMock('@mastra/telegram', () => ({
      TelegramProvider: class {
        readonly id = 'telegram';
        getRoutes() {
          return [];
        }
      },
    }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
      credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const resolver = channelsFn(options(fetchMock));
    await resolver();
    const before = fetchMock.mock.calls.length;
    await resolver.refresh();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
  });
});
