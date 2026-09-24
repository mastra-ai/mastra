import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { channels } from '../channels.js';

const TOKEN = 'fake-test-token';
const SLACK_REFRESH_TOKEN = 'xoxe-1-fake-slack-refresh';
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

type CredentialMap = Record<
  string,
  { type: 'oauth2'; accessToken: string; expiresAt?: string | null } | { type: 'api_key'; apiKey: string }
>;

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
  vi.doUnmock('@mastra/discord');
  warnSpy.mockRestore();
});

/**
 * Minimal `ChannelProvider` fake — the shape `channels()` returns is a
 * constructor-produced instance we don't otherwise interrogate, so tests
 * capture the constructor arg through a `configSpy` and assert on it.
 */
class FakeChannelProvider {
  static readonly configSpy = vi.fn();
  readonly id: string;
  readonly config: Record<string, unknown>;
  constructor(config: Record<string, unknown>, id: string) {
    this.id = id;
    this.config = config;
    FakeChannelProvider.configSpy(id, config);
  }
  __attach() {}
  getRoutes() {
    return [];
  }
  getInfo() {
    return { id: this.id, name: this.id, isConfigured: true };
  }
  async initialize() {}
  async connect() {
    return { type: 'immediate' as const, installationId: 'i_1' };
  }
  async disconnect() {}
  async listInstallations() {
    return [];
  }
  async getInstallation() {
    return null;
  }
}

function fakeSlack() {
  return class SlackProvider extends FakeChannelProvider {
    constructor(config: Record<string, unknown>) {
      super(config, 'slack');
    }
  };
}
function fakeTelegram() {
  return class TelegramProvider extends FakeChannelProvider {
    constructor(config: Record<string, unknown>) {
      super(config, 'telegram');
    }
  };
}
function fakeDiscord() {
  return class DiscordProvider extends FakeChannelProvider {
    constructor(config: Record<string, unknown>) {
      super(config, 'discord');
    }
  };
}

describe('channels()', () => {
  beforeEach(() => {
    FakeChannelProvider.configSpy.mockReset();
  });

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

  it('returns an empty map when the project has no channel connections', async () => {
    const fetchMock = platformFetch({ connections: [makeConnection({ id: 'c_gh', integrationId: 'github' })] });
    const resolver = channels(options(fetchMock));
    await expect(resolver).resolves.toEqual({});
  });

  it('builds a SlackProvider with { refreshToken } from a single active connection', async () => {
    vi.doMock('@mastra/slack', () => ({ SlackProvider: fakeSlack() }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack' })],
      credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_REFRESH_TOKEN, expiresAt: null } },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const providers = await channelsFn(options(fetchMock));
    expect(providers.slack).toBeInstanceOf(FakeChannelProvider);
    expect(FakeChannelProvider.configSpy).toHaveBeenCalledWith(
      'slack',
      expect.objectContaining({ refreshToken: SLACK_REFRESH_TOKEN }),
    );
  });

  it('builds a TelegramProvider with { botToken } from an api_key credential', async () => {
    vi.doMock('@mastra/telegram', () => ({ TelegramProvider: fakeTelegram() }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
      credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const providers = await channelsFn(options(fetchMock));
    expect(providers.telegram).toBeInstanceOf(FakeChannelProvider);
    expect(FakeChannelProvider.configSpy).toHaveBeenCalledWith(
      'telegram',
      expect.objectContaining({ botToken: TELEGRAM_BOT_TOKEN }),
    );
  });

  it('builds a DiscordProvider with { app: { botToken, applicationId, publicKey } } from credential + metadata', async () => {
    vi.doMock('@mastra/discord', () => ({ DiscordProvider: fakeDiscord() }));
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
    const providers = await channelsFn(options(fetchMock));
    expect(providers.discord).toBeInstanceOf(FakeChannelProvider);
    expect(FakeChannelProvider.configSpy).toHaveBeenCalledWith(
      'discord',
      expect.objectContaining({
        app: expect.objectContaining({
          botToken: DISCORD_BOT_TOKEN,
          applicationId: 'app_123',
          publicKey: 'pubkey_abc',
        }),
      }),
    );
  });

  it('accepts snake_case metadata keys for Discord (application_id / public_key)', async () => {
    vi.doMock('@mastra/discord', () => ({ DiscordProvider: fakeDiscord() }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_dc', integrationId: 'discord' })],
      credentials: { c_dc: { type: 'oauth2', accessToken: DISCORD_BOT_TOKEN, expiresAt: null } },
      contexts: {
        c_dc: {
          connection_config: null,
          metadata: { application_id: 'app_snake', public_key: 'pubkey_snake' },
        },
      },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const providers = await channelsFn(options(fetchMock));
    expect(providers.discord).toBeDefined();
    expect(FakeChannelProvider.configSpy).toHaveBeenCalledWith(
      'discord',
      expect.objectContaining({
        app: expect.objectContaining({
          applicationId: 'app_snake',
          publicKey: 'pubkey_snake',
        }),
      }),
    );
  });

  it('warns when Discord metadata lacks applicationId or publicKey', async () => {
    vi.doMock('@mastra/discord', () => ({ DiscordProvider: fakeDiscord() }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_dc', integrationId: 'discord' })],
      credentials: { c_dc: { type: 'oauth2', accessToken: DISCORD_BOT_TOKEN, expiresAt: null } },
      // No metadata → both applicationId and publicKey are missing.
    });
    const { channels: channelsFn } = await import('../channels.js');
    const providers = await channelsFn(options(fetchMock));
    expect(providers.discord).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/applicationId \+ publicKey/));
  });

  it('resolves slack + telegram + discord together into a single ChannelProvider map', async () => {
    vi.doMock('@mastra/slack', () => ({ SlackProvider: fakeSlack() }));
    vi.doMock('@mastra/telegram', () => ({ TelegramProvider: fakeTelegram() }));
    vi.doMock('@mastra/discord', () => ({ DiscordProvider: fakeDiscord() }));
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
    const providers = await channelsFn(options(fetchMock));
    expect(Object.keys(providers).sort()).toEqual(['discord', 'slack', 'telegram']);
    for (const provider of Object.values(providers)) {
      expect(provider).toBeInstanceOf(FakeChannelProvider);
    }
  });

  it('skips a channel when its @mastra/* peer package is not installed', async () => {
    vi.doMock('@mastra/slack', () => {
      throw new Error("Cannot find module '@mastra/slack'");
    });
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack' })],
      credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_REFRESH_TOKEN, expiresAt: null } },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const providers = await channelsFn(options(fetchMock));
    expect(providers.slack).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/@mastra\/slack/));
  });

  it('skips channels marked disabled via per-integration overrides', async () => {
    vi.doMock('@mastra/slack', () => ({ SlackProvider: fakeSlack() }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack' })],
      credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_REFRESH_TOKEN, expiresAt: null } },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const providers = await channelsFn(options(fetchMock, { integrations: { slack: { disabled: true } } }));
    expect(providers.slack).toBeUndefined();
  });

  it('honors a pinned connectionId when multiple are present', async () => {
    vi.doMock('@mastra/slack', () => ({ SlackProvider: fakeSlack() }));
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
    const providers = await channelsFn(options(fetchMock, { integrations: { slack: { connectionId: 'c_slack_b' } } }));
    expect(providers.slack).toBeDefined();
    expect(FakeChannelProvider.configSpy).toHaveBeenCalledWith(
      'slack',
      expect.objectContaining({ refreshToken: 'refresh-b' }),
    );
  });

  it('warns and uses the first active connection when multiple exist without a pin', async () => {
    vi.doMock('@mastra/slack', () => ({ SlackProvider: fakeSlack() }));
    const fetchMock = platformFetch({
      connections: [
        makeConnection({ id: 'c_slack_a', integrationId: 'slack', accountLabel: 'A' }),
        makeConnection({ id: 'c_slack_b', integrationId: 'slack', accountLabel: 'B' }),
      ],
      credentials: {
        c_slack_a: { type: 'oauth2', accessToken: 'refresh-a', expiresAt: null },
        c_slack_b: { type: 'oauth2', accessToken: 'refresh-b', expiresAt: null },
      },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const providers = await channelsFn(options(fetchMock));
    expect(providers.slack).toBeDefined();
    expect(FakeChannelProvider.configSpy).toHaveBeenCalledWith(
      'slack',
      expect.objectContaining({ refreshToken: 'refresh-a' }),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/slack channel: found 2 active connections; using c_slack_a\. Ignoring c_slack_b/),
    );
  });

  it('skips a connection that needs_reauth', async () => {
    vi.doMock('@mastra/slack', () => ({ SlackProvider: fakeSlack() }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack', status: 'needs_reauth' })],
    });
    const { channels: channelsFn } = await import('../channels.js');
    const providers = await channelsFn(options(fetchMock));
    expect(providers.slack).toBeUndefined();
  });

  it('merges non-reserved providerOptions into the ChannelProvider constructor call', async () => {
    vi.doMock('@mastra/telegram', () => ({ TelegramProvider: fakeTelegram() }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
      credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
    });
    const { channels: channelsFn } = await import('../channels.js');
    await channelsFn(
      options(fetchMock, {
        integrations: {
          telegram: { providerOptions: { mode: 'webhook', typingStatus: false } },
        },
      }),
    );
    expect(FakeChannelProvider.configSpy).toHaveBeenCalledWith(
      'telegram',
      expect.objectContaining({
        botToken: TELEGRAM_BOT_TOKEN,
        mode: 'webhook',
        typingStatus: false,
      }),
    );
  });

  it('strips reserved providerOptions fields (credential + framework-managed) with a warning', async () => {
    vi.doMock('@mastra/telegram', () => ({ TelegramProvider: fakeTelegram() }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
      credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { channels: channelsFn } = await import('../channels.js');
    await channelsFn(
      options(fetchMock, {
        integrations: {
          telegram: {
            // Cast escape-hatch — the public type disallows these; here we
            // simulate a caller who bypassed the compile-time check to verify
            // the runtime defense still holds.
            providerOptions: {
              baseUrl: 'https://attacker.example.com',
              apiBaseUrl: 'https://attacker.example.com/api',
              botToken: 'attacker-token',
              encryptionKey: 'attacker-key',
              // Non-reserved field must still make it through.
              mode: 'polling',
            } as never,
          },
        },
      }),
    );
    const call = FakeChannelProvider.configSpy.mock.calls.find(([kind]) => kind === 'telegram');
    expect(call).toBeDefined();
    const [, config] = call!;
    expect(config.botToken).toBe(TELEGRAM_BOT_TOKEN);
    expect(config.mode).toBe('polling');
    expect((config as Record<string, unknown>).baseUrl).toBeUndefined();
    expect((config as Record<string, unknown>).apiBaseUrl).toBeUndefined();
    expect((config as Record<string, unknown>).encryptionKey).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/ignoring reserved providerOptions/));
    warn.mockRestore();
  });

  it('caches providers within ttlMs and invalidate() forces refresh', async () => {
    vi.doMock('@mastra/telegram', () => ({ TelegramProvider: fakeTelegram() }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
      credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const resolver = channelsFn(options(fetchMock));
    await resolver();
    await resolver();
    const firstCallCount = fetchMock.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);
    resolver.invalidate();
    await resolver();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(firstCallCount);
  });

  it('refresh() returns a fresh map and updates the cache', async () => {
    vi.doMock('@mastra/telegram', () => ({ TelegramProvider: fakeTelegram() }));
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

  it('is callable with a { requestContext } object (matches the tools() shape)', async () => {
    // `channels()` is kept callable for symmetry with `tools()` even though
    // `Mastra({ channels })` reads the map synchronously and can't take a
    // callback. The callable form must not throw and must resolve to the
    // same shape as `await`.
    vi.doMock('@mastra/slack', () => ({ SlackProvider: fakeSlack() }));
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack' })],
      credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_REFRESH_TOKEN, expiresAt: null } },
    });
    const { channels: channelsFn } = await import('../channels.js');
    const resolver = channelsFn(options(fetchMock));
    const viaCallback = await resolver({ requestContext: {}, mastra: {} });
    const viaAwait = await resolver;
    expect(Object.keys(viaCallback).sort()).toEqual(Object.keys(viaAwait).sort());
    expect(viaCallback.slack).toBe(viaAwait.slack);
  });
});
