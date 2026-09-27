import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { channels } from '../channels.js';

const TOKEN = 'fake-test-token';
const SLACK_ACCESS_TOKEN = 'xoxe.xoxp-fake-slack-access';
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
  | { type: 'oauth2'; accessToken: string; refreshToken?: string; expiresAt?: string | null }
  | { type: 'api_key'; apiKey: string }
>;

type ContextMap = Record<
  string,
  { connection_config: Record<string, unknown> | null; metadata: Record<string, unknown> | null }
>;

/**
 * A mutable platform fixture: tests mutate `connections` / `credentials`
 * between resolutions to simulate connections added, removed, or rotated on
 * the platform after boot.
 */
interface PlatformState {
  connections?: MockConnection[];
  credentials?: CredentialMap;
  contexts?: ContextMap;
  connectionsStatus?: number;
}

function platformFetch(state: PlatformState) {
  return vi.fn<typeof fetch>().mockImplementation(async request => {
    const url = new URL(String(request));
    const path = url.pathname;
    if (path.endsWith('/connections')) {
      if (state.connectionsStatus) {
        return Response.json({ error: 'nope' }, { status: state.connectionsStatus });
      }
      return Response.json({ connections: state.connections ?? [] });
    }
    const credMatch = path.match(/\/v2\/connections\/([^/]+)\/credentials$/);
    if (credMatch) {
      const connectionId = decodeURIComponent(credMatch[1]!);
      const credential = state.credentials?.[connectionId];
      if (!credential) return Response.json({ error: 'no credential' }, { status: 404 });
      return Response.json(credential);
    }
    const ctxMatch = path.match(/\/v2\/connections\/([^/]+)\/context$/);
    if (ctxMatch) {
      const connectionId = decodeURIComponent(ctxMatch[1]!);
      const context = state.contexts?.[connectionId] ?? { connection_config: null, metadata: null };
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
 * Minimal `ChannelProvider` fake. `channels()` constructs one instance per
 * registration up front (credential-less) and pushes credentials in later, so
 * tests capture the constructor arg through `configSpy` and runtime credential
 * pushes through `configureSpy`.
 */
class FakeChannelProvider {
  static readonly configSpy = vi.fn();
  static readonly configureSpy = vi.fn();
  readonly id: string;
  readonly config: Record<string, unknown>;
  constructor(config: Record<string, unknown>, id: string) {
    this.id = id;
    this.config = config;
    FakeChannelProvider.configSpy(id, config);
  }
  __attach() {}
  getRoutes() {
    return [{ path: `/${this.id}/webhook`, method: 'POST' as const, handler: async () => new Response('ok') }];
  }
  getInfo() {
    return { id: this.id, name: this.id, isConfigured: true };
  }
  async initialize() {}
  async configure(credentials: Record<string, unknown> | null) {
    FakeChannelProvider.configureSpy(this.id, credentials);
  }
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
/** The constructor config the most recent fake SlackProvider was built with. */
function slackConfig(): Record<string, unknown> & { tokenResolver?: () => Promise<string> } {
  const call = FakeChannelProvider.configSpy.mock.calls.findLast(c => c[0] === 'slack');
  if (!call) throw new Error('SlackProvider was never constructed');
  return call[1] as Record<string, unknown> & { tokenResolver?: () => Promise<string> };
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

/**
 * `channels()` constructs every non-disabled registration eagerly (so routes
 * exist before connections do), so tests mock all three channel packages by
 * default; individual tests re-mock to simulate failures.
 */
function mockAllProviders() {
  vi.doMock('@mastra/slack', () => ({ SlackProvider: fakeSlack() }));
  vi.doMock('@mastra/telegram', () => ({ TelegramProvider: fakeTelegram() }));
  vi.doMock('@mastra/discord', () => ({ DiscordProvider: fakeDiscord() }));
}

async function importChannels() {
  const { channels: channelsFn } = await import('../channels.js');
  return channelsFn;
}

describe('channels()', () => {
  beforeEach(() => {
    FakeChannelProvider.configSpy.mockReset();
    FakeChannelProvider.configureSpy.mockReset();
    mockAllProviders();
  });

  it('rejects when the project id is missing', async () => {
    await expect(channels({ client: { accessToken: TOKEN } })).rejects.toThrow(/project id/i);
  });

  it('rejects when ttlMs is negative', async () => {
    await expect(channels({ projectId: 'proj_1', client: { accessToken: TOKEN }, ttlMs: -1 })).rejects.toThrow(
      /ttlMs/i,
    );
  });

  it('rejects malformed integration override keys', async () => {
    await expect(
      channels({
        projectId: 'proj_1',
        client: { accessToken: TOKEN },
        integrations: { 'bad key!': {} },
      }),
    ).rejects.toThrow(/integrations option/i);
  });

  it('resolves an empty map when the project has no channel connections', async () => {
    const fetchMock = platformFetch({ connections: [makeConnection({ id: 'c_gh', integrationId: 'github' })] });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    await expect(resolver()).resolves.toEqual({});
  });

  it('constructs providers credential-less: no platform calls happen before the first resolution', async () => {
    const fetchMock = platformFetch({ connections: [] });
    const channelsFn = await importChannels();
    await channelsFn(options(fetchMock));
    expect(fetchMock).not.toHaveBeenCalled();
    // All three providers exist already — that's what makes getRoutes() work.
    const constructed = FakeChannelProvider.configSpy.mock.calls.map(([id]) => id).sort();
    expect(constructed).toEqual(['discord', 'slack', 'telegram']);
  });

  it('exposes getRoutes() for every non-disabled channel before any connection exists', async () => {
    const fetchMock = platformFetch({ connections: [] });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const paths = resolver.getRoutes().map(route => route.path);
    expect(paths.sort()).toEqual(['/discord/webhook', '/slack/webhook', '/telegram/webhook']);
  });

  it('builds a SlackProvider with a platform-backed tokenResolver from a single active connection', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack' })],
      credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers.slack).toBeInstanceOf(FakeChannelProvider);
    const config = slackConfig();
    // The platform's credential vendor owns the refresh cycle — the provider
    // must not receive a refresh token to rotate itself.
    expect(config.refreshToken).toBeUndefined();
    expect(typeof config.tokenResolver).toBe('function');
    await expect(config.tokenResolver!()).resolves.toBe(SLACK_ACCESS_TOKEN);
  });

  it('re-fetches the platform credential on every tokenResolver call', async () => {
    const credentials: CredentialMap = {
      c_slack: { type: 'oauth2', accessToken: 'xoxe.xoxp-access-1', expiresAt: null },
    };
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack' })],
      credentials,
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    await resolver();
    const { tokenResolver } = slackConfig();
    await expect(tokenResolver!()).resolves.toBe('xoxe.xoxp-access-1');
    // Simulate the vendor refreshing the token upstream — the resolver must
    // pick up the new value instead of caching the old one.
    credentials.c_slack = { type: 'oauth2', accessToken: 'xoxe.xoxp-access-2', expiresAt: null };
    await expect(tokenResolver!()).resolves.toBe('xoxe.xoxp-access-2');
  });

  it('rejects tokenResolver calls while the integration has no active connection', async () => {
    const state: PlatformState = { connections: [] };
    const fetchMock = platformFetch(state);
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    await resolver();
    const { tokenResolver } = slackConfig();
    await expect(tokenResolver!()).rejects.toThrow(/no active slack connection/i);
  });

  it('syncs a TelegramProvider with { botToken } from an api_key credential', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
      credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers.telegram).toBeInstanceOf(FakeChannelProvider);
    // Credentials arrive via configure(), not the constructor.
    expect(FakeChannelProvider.configSpy).toHaveBeenCalledWith(
      'telegram',
      expect.not.objectContaining({ botToken: expect.anything() }),
    );
    expect(FakeChannelProvider.configureSpy).toHaveBeenCalledWith('telegram', { botToken: TELEGRAM_BOT_TOKEN });
  });

  it('syncs a DiscordProvider with { botToken, applicationId, publicKey } from credential + metadata', async () => {
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
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers.discord).toBeInstanceOf(FakeChannelProvider);
    expect(FakeChannelProvider.configureSpy).toHaveBeenCalledWith('discord', {
      botToken: DISCORD_BOT_TOKEN,
      applicationId: 'app_123',
      publicKey: 'pubkey_abc',
    });
  });

  it('accepts snake_case metadata keys for Discord (application_id / public_key)', async () => {
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
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers.discord).toBeDefined();
    expect(FakeChannelProvider.configureSpy).toHaveBeenCalledWith(
      'discord',
      expect.objectContaining({ applicationId: 'app_snake', publicKey: 'pubkey_snake' }),
    );
  });

  it('syncs Discord from the bot token alone without warning — the provider backfills the rest', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_dc', integrationId: 'discord' })],
      credentials: { c_dc: { type: 'oauth2', accessToken: DISCORD_BOT_TOKEN, expiresAt: null } },
      // No metadata → DiscordProvider self-resolves applicationId/publicKey
      // from `GET /applications/@me`, so no warning fires.
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers.discord).toBeDefined();
    expect(warnSpy).not.toHaveBeenCalled();
    // configure() merges over previous values, so absent fields must be
    // omitted — an explicit `undefined` would clobber env-var fallbacks or
    // the provider's own backfilled values.
    expect(FakeChannelProvider.configureSpy).toHaveBeenCalledWith('discord', { botToken: DISCORD_BOT_TOKEN });
  });

  it('yields a real DiscordProvider that reports isConfigured from the bot token alone (end to end)', async () => {
    // Deliberately using the REAL @mastra/discord: this pins the UI-visible
    // symptom — Studio showed Discord as "Not Configured" because the
    // provider required applicationId + publicKey alongside the bot token,
    // and the platform connection only delivers the token.
    vi.doUnmock('@mastra/discord');
    vi.stubEnv('DISCORD_BOT_TOKEN', undefined as unknown as string);
    vi.stubEnv('DISCORD_PUBLIC_KEY', undefined as unknown as string);
    vi.stubEnv('DISCORD_APPLICATION_ID', undefined as unknown as string);
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_dc', integrationId: 'discord' })],
      credentials: { c_dc: { type: 'oauth2', accessToken: DISCORD_BOT_TOKEN, expiresAt: null } },
      // No metadata — the token is the only credential material available.
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    const discord = providers.discord as unknown as { getInfo(): { isConfigured: boolean } };
    expect(discord.getInfo().isConfigured).toBe(true);
  });

  it('discards the previous connection identity when the platform switches Discord connections (end to end)', async () => {
    // REAL @mastra/discord: pins the security property that switching the
    // active platform connection replaces the app config. If configure()
    // merged instead, connection A's Ed25519 publicKey would keep verifying
    // inbound webhooks while connection B's bot token is live — letting A's
    // owner forge interactions against B.
    vi.doUnmock('@mastra/discord');
    vi.stubEnv('DISCORD_BOT_TOKEN', undefined as unknown as string);
    vi.stubEnv('DISCORD_PUBLIC_KEY', undefined as unknown as string);
    vi.stubEnv('DISCORD_APPLICATION_ID', undefined as unknown as string);
    const state: PlatformState = {
      connections: [makeConnection({ id: 'c_a', integrationId: 'discord' })],
      credentials: { c_a: { type: 'oauth2', accessToken: 'discord-bot-A', expiresAt: null } },
      contexts: {
        c_a: { connection_config: null, metadata: { applicationId: 'A_app_id', publicKey: 'A_public_key' } },
      },
    };
    const fetchMock = platformFetch(state);
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock, { ttlMs: 0 }));
    const providers = await resolver();
    const discord = providers.discord as unknown as {
      connect(agentId: string): Promise<{ type: string; authorizationUrl: string }>;
    };

    // The platform swaps connection A for connection B — token only.
    state.connections = [makeConnection({ id: 'c_b', integrationId: 'discord' })];
    state.credentials = { c_b: { type: 'oauth2', accessToken: 'discord-bot-B', expiresAt: null } };
    state.contexts = {};
    resolver.invalidate();
    await resolver();

    // B's identity must come from B's token via /applications/@me — never
    // from A's leftover metadata.
    const B = { id: 'B_app_id', verify_key: 'B_public_key' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/applications/@me'))
          return Response.json({ id: B.id, name: 'App B', verify_key: B.verify_key });
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    try {
      const result = await discord.connect('agent-1');
      const url = new URL(result.authorizationUrl);
      expect(url.searchParams.get('client_id')).toBe(B.id);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('resolves slack + telegram + discord together into a single ChannelProvider map', async () => {
    const fetchMock = platformFetch({
      connections: [
        makeConnection({ id: 'c_slack', integrationId: 'slack' }),
        makeConnection({ id: 'c_tg', integrationId: 'telegram' }),
        makeConnection({ id: 'c_dc', integrationId: 'discord' }),
      ],
      credentials: {
        c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null },
        c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN },
        c_dc: { type: 'oauth2', accessToken: DISCORD_BOT_TOKEN, expiresAt: null },
      },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(Object.keys(providers).sort()).toEqual(['discord', 'slack', 'telegram']);
    for (const provider of Object.values(providers)) {
      expect(provider).toBeInstanceOf(FakeChannelProvider);
    }
  });

  it('warns and skips a channel when its provider module fails to load, keeping the others', async () => {
    vi.doMock('@mastra/slack', () => {
      throw new Error("Cannot find module '@mastra/slack'");
    });
    const fetchMock = platformFetch({
      connections: [
        makeConnection({ id: 'c_slack', integrationId: 'slack' }),
        makeConnection({ id: 'c_tg', integrationId: 'telegram' }),
      ],
      credentials: {
        c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null },
        c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN },
      },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers.slack).toBeUndefined();
    expect(providers.telegram).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/Skipping slack channel/));
    // The broken channel contributes no routes either.
    expect(resolver.getRoutes().map(route => route.path)).not.toContain('/slack/webhook');
  });

  it('skips channels marked disabled via per-integration overrides (no instance, no routes)', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack' })],
      credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock, { integrations: { slack: { disabled: true } } }));
    const providers = await resolver();
    expect(providers.slack).toBeUndefined();
    expect(FakeChannelProvider.configSpy).not.toHaveBeenCalledWith('slack', expect.anything());
    expect(resolver.getRoutes().map(route => route.path)).not.toContain('/slack/webhook');
  });

  it('honors a pinned connectionId when multiple are present', async () => {
    const fetchMock = platformFetch({
      connections: [
        makeConnection({ id: 'c_slack_a', integrationId: 'slack', accountLabel: 'A' }),
        makeConnection({ id: 'c_slack_b', integrationId: 'slack', accountLabel: 'B' }),
      ],
      credentials: {
        c_slack_b: { type: 'oauth2', accessToken: 'refresh-b', expiresAt: null },
      },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock, { integrations: { slack: { connectionId: 'c_slack_b' } } }));
    const providers = await resolver();
    expect(providers.slack).toBeDefined();
    // The resolver is bound to the pinned connection's credential.
    await expect(slackConfig().tokenResolver!()).resolves.toBe('refresh-b');
  });

  it('warns and uses the first active connection when multiple exist without a pin', async () => {
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
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers.slack).toBeDefined();
    // The resolver is bound to the first active connection's credential.
    await expect(slackConfig().tokenResolver!()).resolves.toBe('refresh-a');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/slack channel: found 2 active connections; using c_slack_a\. Ignoring c_slack_b/),
    );
  });

  it('skips a connection that needs_reauth', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack', status: 'needs_reauth' })],
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers.slack).toBeUndefined();
  });

  it('warns and skips a channel whose credential sync fails, keeping the others', async () => {
    const fetchMock = platformFetch({
      connections: [
        makeConnection({ id: 'c_tg', integrationId: 'telegram' }),
        makeConnection({ id: 'c_slack', integrationId: 'slack' }),
      ],
      // No credential for c_tg → sync() fails with a 404.
      credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers.telegram).toBeUndefined();
    expect(providers.slack).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/Skipping telegram channel/));
  });

  it('merges non-reserved providerOptions into the ChannelProvider constructor call', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
      credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(
      options(fetchMock, {
        integrations: {
          telegram: { providerOptions: { mode: 'webhook', typingStatus: false } },
        },
      }),
    );
    await resolver();
    expect(FakeChannelProvider.configSpy).toHaveBeenCalledWith(
      'telegram',
      expect.objectContaining({ mode: 'webhook', typingStatus: false }),
    );
  });

  it('strips reserved providerOptions fields (credential + framework-managed) with a warning', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
      credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(
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
    await resolver();
    const call = FakeChannelProvider.configSpy.mock.calls.find(([kind]) => kind === 'telegram');
    expect(call).toBeDefined();
    const [, config] = call!;
    expect(config.mode).toBe('polling');
    expect((config as Record<string, unknown>).baseUrl).toBeUndefined();
    expect((config as Record<string, unknown>).apiBaseUrl).toBeUndefined();
    expect((config as Record<string, unknown>).botToken).toBeUndefined();
    expect((config as Record<string, unknown>).encryptionKey).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/ignoring reserved providerOptions/));
    // The platform credential still arrives via configure().
    expect(FakeChannelProvider.configureSpy).toHaveBeenCalledWith('telegram', { botToken: TELEGRAM_BOT_TOKEN });
  });

  it('caches providers within ttlMs and invalidate() forces refresh', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
      credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    await resolver();
    await resolver();
    const firstCallCount = fetchMock.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);
    resolver.invalidate();
    await resolver();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(firstCallCount);
  });

  it('refresh() returns a fresh map and updates the cache', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
      credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    await resolver();
    const before = fetchMock.mock.calls.length;
    await resolver.refresh();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
  });

  it('is callable with a { requestContext } object (matches the core resolver shape)', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack' })],
      credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver({ requestContext: {}, mastra: {} });
    expect(providers.slack).toBeDefined();
  });

  describe('live connection lifecycle (no redeploy)', () => {
    it('picks up a connection added after boot, reusing the pre-built provider instance', async () => {
      const state: PlatformState = { connections: [], credentials: {} };
      const fetchMock = platformFetch(state);
      const channelsFn = await importChannels();
      const resolver = await channelsFn(options(fetchMock));

      await expect(resolver()).resolves.toEqual({});
      const routesBefore = resolver.getRoutes().map(route => route.path);

      // A Slack connection appears on the platform — no restart, no new code.
      state.connections = [makeConnection({ id: 'c_slack', integrationId: 'slack' })];
      state.credentials = { c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null } };
      resolver.invalidate();

      const providers = await resolver();
      expect(providers.slack).toBeInstanceOf(FakeChannelProvider);
      await expect(slackConfig().tokenResolver!()).resolves.toBe(SLACK_ACCESS_TOKEN);
      // The route surface never changed — the pre-mounted routes now have a
      // live connection behind them.
      expect(resolver.getRoutes().map(route => route.path)).toEqual(routesBefore);
      // Exactly one SlackProvider was ever constructed.
      expect(FakeChannelProvider.configSpy.mock.calls.filter(([id]) => id === 'slack')).toHaveLength(1);
    });

    it('returns the same provider instance across resolutions while the connection is unchanged', async () => {
      const fetchMock = platformFetch({
        connections: [makeConnection({ id: 'c_slack', integrationId: 'slack' })],
        credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null } },
      });
      const channelsFn = await importChannels();
      const resolver = await channelsFn(options(fetchMock));
      const first = await resolver();
      resolver.invalidate();
      const second = await resolver();
      expect(second.slack).toBe(first.slack);
    });

    it('drops a provider from the map when its connection is removed, keeping its routes mounted', async () => {
      const state: PlatformState = {
        connections: [makeConnection({ id: 'c_slack', integrationId: 'slack' })],
        credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null } },
      };
      const fetchMock = platformFetch(state);
      const channelsFn = await importChannels();
      const resolver = await channelsFn(options(fetchMock));
      const providers = await resolver();
      expect(providers.slack).toBeDefined();
      const { tokenResolver } = slackConfig();

      state.connections = [];
      resolver.invalidate();
      await expect(resolver()).resolves.toEqual({});
      // Routes stay mounted (the instance is long-lived)…
      expect(resolver.getRoutes().map(route => route.path)).toContain('/slack/webhook');
      // …but lazy credential fetches now fail loudly instead of using the
      // removed connection.
      await expect(tokenResolver!()).rejects.toThrow(/no active slack connection/i);
    });

    it('re-syncs a rotated credential into the live provider on the next resolution', async () => {
      const state: PlatformState = {
        connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
        credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
      };
      const fetchMock = platformFetch(state);
      const channelsFn = await importChannels();
      const resolver = await channelsFn(options(fetchMock));
      await resolver();
      expect(FakeChannelProvider.configureSpy).toHaveBeenLastCalledWith('telegram', { botToken: TELEGRAM_BOT_TOKEN });

      state.credentials = { c_tg: { type: 'api_key', apiKey: '999999:rotated' } };
      resolver.invalidate();
      await resolver();
      expect(FakeChannelProvider.configureSpy).toHaveBeenLastCalledWith('telegram', { botToken: '999999:rotated' });
    });

    it('switches the slack tokenResolver to a different connection when the pin target changes on the platform', async () => {
      const state: PlatformState = {
        connections: [makeConnection({ id: 'c_slack_a', integrationId: 'slack' })],
        credentials: { c_slack_a: { type: 'oauth2', accessToken: 'token-a', expiresAt: null } },
      };
      const fetchMock = platformFetch(state);
      const channelsFn = await importChannels();
      const resolver = await channelsFn(options(fetchMock));
      await resolver();
      const { tokenResolver } = slackConfig();
      await expect(tokenResolver!()).resolves.toBe('token-a');

      // Connection A is replaced by connection B on the platform.
      state.connections = [makeConnection({ id: 'c_slack_b', integrationId: 'slack' })];
      state.credentials = { c_slack_b: { type: 'oauth2', accessToken: 'token-b', expiresAt: null } };
      resolver.invalidate();
      await resolver();
      await expect(tokenResolver!()).resolves.toBe('token-b');
    });
  });
});
