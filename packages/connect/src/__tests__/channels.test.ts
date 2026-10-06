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
  | {
      type: 'oauth2';
      accessToken: string;
      refreshToken?: string;
      expiresAt?: string | null;
      secondaryAccessTokens?: Record<string, { accessToken: string; expiresAt: string | null }>;
    }
  | { type: 'api_key'; apiKey: string }
  | { type: 'two_step'; token: string; expiresAt?: string | null }
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
  // Teams' wrapper fail-fast requires MASTRA_ENCRYPTION_KEY at construction
  // time to prevent unencrypted install-store persistence. Set a fake key so
  // the shared setup here doesn't trip that guard; the coming-soon-key test
  // unsets it explicitly to exercise the guard.
  vi.stubEnv('MASTRA_ENCRYPTION_KEY', 'test-encryption-key');
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('@mastra/slack');
  vi.doUnmock('@mastra/telegram');
  vi.doUnmock('@mastra/discord');
  vi.doUnmock('@mastra/teams');
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
  // The real `@mastra/slack` SlackProvider identifies itself as `'slack'` and
  // serves its routes under `/slack/*`, independent of the platform catalog
  // rename. `slack-channels` is the integration id used to match the project
  // connection, but the provider's own id — and therefore its route prefix —
  // is unchanged. Use the real provider id here so route assertions reflect
  // what SlackProvider actually mounts.
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
function telegramConfig(): Record<string, unknown> & { tokenResolver?: () => Promise<string> } {
  const call = FakeChannelProvider.configSpy.mock.calls.findLast(c => c[0] === 'telegram');
  if (!call) throw new Error('TelegramProvider was never constructed');
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
function fakeTeams() {
  return class TeamsProvider extends FakeChannelProvider {
    constructor(config: Record<string, unknown>) {
      super(config, 'teams');
    }
  };
}
/** The constructor config the most recent fake TeamsProvider was built with. */
function teamsConfig(): Record<string, unknown> & {
  tokenResolver?: (scope: string | string[]) => Promise<string>;
} {
  const call = FakeChannelProvider.configSpy.mock.calls.findLast(c => c[0] === 'teams');
  if (!call) throw new Error('TeamsProvider was never constructed');
  return call[1] as Record<string, unknown> & { tokenResolver?: (scope: string | string[]) => Promise<string> };
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
  vi.doMock('@mastra/teams', () => ({
    TeamsProvider: fakeTeams(),
    TEAMS_DEV_PORTAL_SCOPE: 'https://dev.teams.microsoft.com/AppDefinitions.ReadWrite',
  }));
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
        providers: { 'bad key!': {} },
      }),
    ).rejects.toThrow(/providers option/i);
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
    expect(constructed).toEqual(['discord', 'slack', 'teams', 'telegram']);
  });

  it('exposes getRoutes() for every non-disabled channel before any connection exists', async () => {
    const fetchMock = platformFetch({ connections: [] });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const paths = resolver.getRoutes().map(route => route.path);
    expect(paths.sort()).toEqual(['/discord/webhook', '/slack/webhook', '/teams/webhook', '/telegram/webhook']);
  });

  it('builds a SlackProvider with a platform-backed tokenResolver from a single active connection', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack-channels' })],
      credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers['slack-channels']).toBeInstanceOf(FakeChannelProvider);
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
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack-channels' })],
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

  it('serves the config token from a two_step credential (Nango slack-app-configuration)', async () => {
    // The platform integration `slack-channels` (the catalog rename over
    // Nango's upstream `slack-app-configuration` TWO_STEP provider) serves
    // the credential as `{ type: 'two_step', token }`.
    const credentials: CredentialMap = {
      c_slack: { type: 'two_step', token: 'xoxe.xoxp-config-1', expiresAt: null },
    };
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack-channels' })],
      credentials,
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    await resolver();
    const { tokenResolver } = slackConfig();
    await expect(tokenResolver!()).resolves.toBe('xoxe.xoxp-config-1');
    // The vendor rotates the config token (12h expiry, single-use refresh
    // seed) — the resolver picks up the rotated token on the next call.
    credentials.c_slack = { type: 'two_step', token: 'xoxe.xoxp-config-2', expiresAt: null };
    await expect(tokenResolver!()).resolves.toBe('xoxe.xoxp-config-2');
  });

  it('rejects tokenResolver calls while the integration has no active connection', async () => {
    const state: PlatformState = { connections: [] };
    const fetchMock = platformFetch(state);
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    await resolver();
    const { tokenResolver } = slackConfig();
    await expect(tokenResolver!()).rejects.toThrow(/no active slack-channels connection/i);
  });

  it('builds a TelegramProvider with a platform-backed tokenResolver from an api_key credential', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
      credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers.telegram).toBeInstanceOf(FakeChannelProvider);
    const config = telegramConfig();
    // The platform owns the bot token — the provider never receives a static
    // one to persist, only a resolver it invokes per Bot API call.
    expect(config.botToken).toBeUndefined();
    expect(typeof config.tokenResolver).toBe('function');
    await expect(config.tokenResolver!()).resolves.toBe(TELEGRAM_BOT_TOKEN);
    // No credential push happens at resolution time.
    expect(FakeChannelProvider.configureSpy).not.toHaveBeenCalledWith(
      'telegram',
      expect.objectContaining({ botToken: expect.anything() }),
    );
  });

  it('syncs a DiscordProvider with the api_key credential as botToken plus metadata applicationId/publicKey', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_dc', integrationId: 'discord' })],
      // The discord integration is API-key auth: the credential IS the
      // bot token, delivered on the platform's encrypted secrets path.
      credentials: { c_dc: { type: 'api_key', apiKey: DISCORD_BOT_TOKEN } },
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
    expect(providers['discord']).toBeInstanceOf(FakeChannelProvider);
    expect(FakeChannelProvider.configureSpy).toHaveBeenCalledWith('discord', {
      botToken: DISCORD_BOT_TOKEN,
      applicationId: 'app_123',
      publicKey: 'pubkey_abc',
    });
  });

  it('accepts snake_case metadata keys for Discord (application_id / public_key)', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_dc', integrationId: 'discord' })],
      credentials: { c_dc: { type: 'api_key', apiKey: DISCORD_BOT_TOKEN } },
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
    expect(providers['discord']).toBeDefined();
    expect(FakeChannelProvider.configureSpy).toHaveBeenCalledWith(
      'discord',
      expect.objectContaining({ botToken: DISCORD_BOT_TOKEN, applicationId: 'app_snake', publicKey: 'pubkey_snake' }),
    );
  });

  it('skips Discord with a warning when the connection yields an oauth2 credential', async () => {
    // An oauth2 credential is a user Bearer token that Discord always
    // rejects for bot auth — configuring the provider with it would fail
    // every bot call with a misleading 401, so the channel is skipped with
    // an actionable warning instead.
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_dc', integrationId: 'discord' })],
      credentials: { c_dc: { type: 'oauth2', accessToken: 'oauth-bearer-not-a-bot-token', expiresAt: null } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers['discord']).toBeUndefined();
    expect(FakeChannelProvider.configureSpy).not.toHaveBeenCalledWith(
      'discord',
      expect.objectContaining({ botToken: expect.anything() }),
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("'oauth2' credential"));
  });

  it('skips Discord with a warning when the api_key credential has an empty bot token', async () => {
    // `DiscordProvider.configure()` marks itself configured on any non-null
    // `botToken`, including `""`. That would surface later as a mystery 401
    // on every tool call — reject the empty token here and skip the channel
    // with an actionable warning.
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_dc', integrationId: 'discord' })],
      credentials: { c_dc: { type: 'api_key', apiKey: '' } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers['discord']).toBeUndefined();
    expect(FakeChannelProvider.configureSpy).not.toHaveBeenCalledWith(
      'discord',
      expect.objectContaining({ botToken: expect.anything() }),
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('has no bot token'));
  });

  it('syncs Discord from the credential alone — the provider backfills applicationId/publicKey', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_dc', integrationId: 'discord' })],
      credentials: { c_dc: { type: 'api_key', apiKey: DISCORD_BOT_TOKEN } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers['discord']).toBeDefined();
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
      // The token is the only credential material available.
      credentials: { c_dc: { type: 'api_key', apiKey: DISCORD_BOT_TOKEN } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    const discord = providers['discord'] as unknown as { getInfo(): { isConfigured: boolean } };
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
      credentials: { c_a: { type: 'api_key', apiKey: 'discord-A' } },
      contexts: {
        c_a: {
          connection_config: null,
          metadata: { applicationId: 'A_app_id', publicKey: 'A_public_key' },
        },
      },
    };
    const fetchMock = platformFetch(state);
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock, { ttlMs: 0 }));
    const providers = await resolver();
    const discord = providers['discord'] as unknown as {
      connect(agentId: string): Promise<{ type: string; authorizationUrl: string }>;
    };

    // The platform swaps connection A for connection B — token only.
    state.connections = [makeConnection({ id: 'c_b', integrationId: 'discord' })];
    state.credentials = { c_b: { type: 'api_key', apiKey: 'discord-B' } };
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

  it('skips the Teams channel with an actionable warning when MASTRA_ENCRYPTION_KEY is unset', async () => {
    // Defense-in-depth for the Teams install store's at-rest persistence:
    // without an encryption key, delegated provisioning would silently
    // downgrade to plaintext. The wrapper refuses to construct in that
    // shape so the miss is loud instead of subtle.
    vi.stubEnv('MASTRA_ENCRYPTION_KEY', '');
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_teams', integrationId: 'microsoft-teams' })],
      credentials: { c_teams: { type: 'oauth2', accessToken: 'graph-token', expiresAt: null } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers['microsoft-teams']).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('MASTRA_ENCRYPTION_KEY is not set'));
  });

  it('builds a TeamsProvider whose tokenResolver serves Graph tokens from the platform credential', async () => {
    const state: PlatformState = {
      connections: [makeConnection({ id: 'c_teams', integrationId: 'microsoft-teams' })],
      credentials: { c_teams: { type: 'oauth2', accessToken: 'graph-token-1', expiresAt: null } },
    };
    const fetchMock = platformFetch(state);
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers['microsoft-teams']).toBeInstanceOf(FakeChannelProvider);

    const { tokenResolver } = teamsConfig();
    expect(tokenResolver).toBeTypeOf('function');
    await expect(tokenResolver!('https://graph.microsoft.com/.default')).resolves.toBe('graph-token-1');

    // The vendor rotates the Graph token: the next call sees it with no
    // resolver refresh — the resolver re-fetches the credential per call.
    state.credentials = { c_teams: { type: 'oauth2', accessToken: 'graph-token-2', expiresAt: null } };
    await expect(tokenResolver!('https://graph.microsoft.com/.default')).resolves.toBe('graph-token-2');
  });

  it('serves Dev Portal tokens from the credential secondaryAccessTokens, without a context read', async () => {
    const state: PlatformState = {
      connections: [makeConnection({ id: 'c_teams', integrationId: 'microsoft-teams' })],
      credentials: {
        c_teams: {
          type: 'oauth2',
          accessToken: 'graph-token-1',
          expiresAt: null,
          secondaryAccessTokens: {
            devPortalAccessToken: { accessToken: 'tdp-token-1', expiresAt: '2027-01-01T00:00:00Z' },
          },
        },
      },
    };
    const fetchMock = platformFetch(state);
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    await resolver();

    const { tokenResolver } = teamsConfig();
    await expect(tokenResolver!(['https://dev.teams.microsoft.com/AppDefinitions.ReadWrite'])).resolves.toBe(
      'tdp-token-1',
    );
    // A single credentials fetch serves both tokens: the vendor's refresh
    // cycle re-mints the secondary Dev Portal token alongside the Graph
    // token on the same response — no context endpoint round-trip.
    const paths = fetchMock.mock.calls.map(call => new URL(String(call[0])).pathname);
    expect(paths.some(path => path.endsWith('/c_teams/credentials'))).toBe(true);
    expect(paths.some(path => path.endsWith('/c_teams/context'))).toBe(false);

    // The vendor rotates the secondary token: the resolver re-fetches the
    // credential per call and picks up the new value.
    state.credentials = {
      c_teams: {
        type: 'oauth2',
        accessToken: 'graph-token-2',
        expiresAt: null,
        secondaryAccessTokens: {
          devPortalAccessToken: { accessToken: 'tdp-token-2', expiresAt: null },
        },
      },
    };
    await expect(tokenResolver!('https://dev.teams.microsoft.com/AppDefinitions.ReadWrite')).resolves.toBe(
      'tdp-token-2',
    );
  });

  it('fails actionably when the Teams credential carries no Dev Portal token', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_teams', integrationId: 'microsoft-teams' })],
      credentials: { c_teams: { type: 'oauth2', accessToken: 'graph-token-1', expiresAt: null } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    await resolver();

    const { tokenResolver } = teamsConfig();
    await expect(tokenResolver!('https://dev.teams.microsoft.com/AppDefinitions.ReadWrite')).rejects.toThrow(
      /Dev Portal token/,
    );
  });

  it('strips reserved teams providerOptions fields while forwarding the rest', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_teams', integrationId: 'microsoft-teams' })],
      credentials: { c_teams: { type: 'oauth2', accessToken: 'graph-token-1', expiresAt: null } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(
      options(fetchMock, {
        providers: {
          'microsoft-teams': {
            providerOptions: { appId: 'sneaky', appPassword: 'sneaky', typingStatus: false } as Record<string, unknown>,
          },
        },
      }),
    );
    await resolver();

    const config = teamsConfig();
    expect(config.appId).toBeUndefined();
    expect(config.appPassword).toBeUndefined();
    expect(config.typingStatus).toBe(false);
    expect(config.tokenResolver).toBeTypeOf('function');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/ignoring reserved providerOptions/));
  });

  it('resolves slack + telegram + discord + teams together into a single ChannelProvider map', async () => {
    const fetchMock = platformFetch({
      connections: [
        makeConnection({ id: 'c_slack', integrationId: 'slack-channels' }),
        makeConnection({ id: 'c_tg', integrationId: 'telegram' }),
        makeConnection({ id: 'c_dc', integrationId: 'discord' }),
        makeConnection({ id: 'c_teams', integrationId: 'microsoft-teams' }),
      ],
      credentials: {
        c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null },
        c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN },
        c_dc: { type: 'api_key', apiKey: DISCORD_BOT_TOKEN },
        c_teams: { type: 'oauth2', accessToken: 'graph-token-1', expiresAt: null },
      },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(Object.keys(providers).sort()).toEqual(['discord', 'microsoft-teams', 'slack-channels', 'telegram']);
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
        makeConnection({ id: 'c_slack', integrationId: 'slack-channels' }),
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
    expect(providers['slack-channels']).toBeUndefined();
    expect(providers.telegram).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/Skipping slack-channels channel/));
    // The broken channel contributes no routes either.
    expect(resolver.getRoutes().map(route => route.path)).not.toContain('/slack/webhook');
  });

  it('skips channels marked disabled via per-integration overrides (no instance, no routes)', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack-channels' })],
      credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock, { providers: { 'slack-channels': { disabled: true } } }));
    const providers = await resolver();
    expect(providers['slack-channels']).toBeUndefined();
    expect(FakeChannelProvider.configSpy).not.toHaveBeenCalledWith('slack-channels', expect.anything());
    expect(resolver.getRoutes().map(route => route.path)).not.toContain('/slack/webhook');
  });

  it('honors a pinned connectionId when multiple are present', async () => {
    const fetchMock = platformFetch({
      connections: [
        makeConnection({ id: 'c_slack_a', integrationId: 'slack-channels', accountLabel: 'A' }),
        makeConnection({ id: 'c_slack_b', integrationId: 'slack-channels', accountLabel: 'B' }),
      ],
      credentials: {
        c_slack_b: { type: 'oauth2', accessToken: 'refresh-b', expiresAt: null },
      },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(
      options(fetchMock, { providers: { 'slack-channels': { connectionId: 'c_slack_b' } } }),
    );
    const providers = await resolver();
    expect(providers['slack-channels']).toBeDefined();
    // The resolver is bound to the pinned connection's credential.
    await expect(slackConfig().tokenResolver!()).resolves.toBe('refresh-b');
  });

  it('warns and uses the first active connection when multiple exist without a pin', async () => {
    const fetchMock = platformFetch({
      connections: [
        makeConnection({ id: 'c_slack_a', integrationId: 'slack-channels', accountLabel: 'A' }),
        makeConnection({ id: 'c_slack_b', integrationId: 'slack-channels', accountLabel: 'B' }),
      ],
      credentials: {
        c_slack_a: { type: 'oauth2', accessToken: 'refresh-a', expiresAt: null },
        c_slack_b: { type: 'oauth2', accessToken: 'refresh-b', expiresAt: null },
      },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers['slack-channels']).toBeDefined();
    // The resolver is bound to the first active connection's credential.
    await expect(slackConfig().tokenResolver!()).resolves.toBe('refresh-a');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/slack-channels channel: found 2 active connections; using c_slack_a\. Ignoring c_slack_b/),
    );
  });

  it('skips a connection that needs_reauth', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack-channels', status: 'needs_reauth' })],
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers['slack-channels']).toBeUndefined();
  });

  it('keeps a telegram provider whose credential is missing — the failure surfaces lazily from the tokenResolver', async () => {
    const fetchMock = platformFetch({
      connections: [
        makeConnection({ id: 'c_tg', integrationId: 'telegram' }),
        makeConnection({ id: 'c_slack', integrationId: 'slack-channels' }),
      ],
      // No credential for c_tg → the credential fetch 404s. Telegram no longer
      // syncs credentials at resolution time (delegated mode), so the provider
      // stays in the map and the failure surfaces on the next Bot API call.
      credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();
    expect(providers.telegram).toBeDefined();
    expect(providers['slack-channels']).toBeDefined();
    const { tokenResolver } = telegramConfig();
    await expect(tokenResolver!()).rejects.toThrow();
  });

  it('merges non-reserved providerOptions into the ChannelProvider constructor call', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
      credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(
      options(fetchMock, {
        providers: {
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
        providers: {
          telegram: {
            // Cast escape-hatch — the public type disallows these; here we
            // simulate a caller who bypassed the compile-time check to verify
            // the runtime defense still holds.
            providerOptions: {
              baseUrl: 'https://attacker.example.com',
              apiBaseUrl: 'https://attacker.example.com/api',
              botToken: 'attacker-token',
              tokenResolver: async () => 'attacker-token',
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
    // The provider still gets the platform-backed resolver — the attacker's
    // injected tokenResolver was stripped, not spread over ours.
    const { tokenResolver } = telegramConfig();
    await expect(tokenResolver!()).resolves.toBe(TELEGRAM_BOT_TOKEN);
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
      connections: [makeConnection({ id: 'c_slack', integrationId: 'slack-channels' })],
      credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null } },
    });
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver({ requestContext: {}, mastra: {} });
    expect(providers['slack-channels']).toBeDefined();
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
      state.connections = [makeConnection({ id: 'c_slack', integrationId: 'slack-channels' })];
      state.credentials = { c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null } };
      resolver.invalidate();

      const providers = await resolver();
      expect(providers['slack-channels']).toBeInstanceOf(FakeChannelProvider);
      await expect(slackConfig().tokenResolver!()).resolves.toBe(SLACK_ACCESS_TOKEN);
      // The route surface never changed — the pre-mounted routes now have a
      // live connection behind them.
      expect(resolver.getRoutes().map(route => route.path)).toEqual(routesBefore);
      // Exactly one SlackProvider was ever constructed.
      expect(FakeChannelProvider.configSpy.mock.calls.filter(([id]) => id === 'slack')).toHaveLength(1);
    });

    it('returns the same provider instance across resolutions while the connection is unchanged', async () => {
      const fetchMock = platformFetch({
        connections: [makeConnection({ id: 'c_slack', integrationId: 'slack-channels' })],
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
        connections: [makeConnection({ id: 'c_slack', integrationId: 'slack-channels' })],
        credentials: { c_slack: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null } },
      };
      const fetchMock = platformFetch(state);
      const channelsFn = await importChannels();
      const resolver = await channelsFn(options(fetchMock));
      const providers = await resolver();
      expect(providers['slack-channels']).toBeDefined();
      const { tokenResolver } = slackConfig();

      state.connections = [];
      resolver.invalidate();
      await expect(resolver()).resolves.toEqual({});
      // Routes stay mounted (the instance is long-lived)…
      expect(resolver.getRoutes().map(route => route.path)).toContain('/slack/webhook');
      // …but lazy credential fetches now fail loudly instead of using the
      // removed connection.
      await expect(tokenResolver!()).rejects.toThrow(/no active slack-channels connection/i);
    });

    it('picks up a rotated telegram credential on the next tokenResolver call — no re-resolution needed', async () => {
      const state: PlatformState = {
        connections: [makeConnection({ id: 'c_tg', integrationId: 'telegram' })],
        credentials: { c_tg: { type: 'api_key', apiKey: TELEGRAM_BOT_TOKEN } },
      };
      const fetchMock = platformFetch(state);
      const channelsFn = await importChannels();
      const resolver = await channelsFn(options(fetchMock));
      await resolver();
      const { tokenResolver } = telegramConfig();
      await expect(tokenResolver!()).resolves.toBe(TELEGRAM_BOT_TOKEN);

      // The token is re-pasted on the platform — the very next Bot API call
      // resolves the new value, without waiting for a snapshot refresh.
      state.credentials = { c_tg: { type: 'api_key', apiKey: '999999:rotated' } };
      await expect(tokenResolver!()).resolves.toBe('999999:rotated');
    });

    it('switches the slack tokenResolver to a different connection when the pin target changes on the platform', async () => {
      const state: PlatformState = {
        connections: [makeConnection({ id: 'c_slack_a', integrationId: 'slack-channels' })],
        credentials: { c_slack_a: { type: 'oauth2', accessToken: 'token-a', expiresAt: null } },
      };
      const fetchMock = platformFetch(state);
      const channelsFn = await importChannels();
      const resolver = await channelsFn(options(fetchMock));
      await resolver();
      const { tokenResolver } = slackConfig();
      await expect(tokenResolver!()).resolves.toBe('token-a');

      // Connection A is replaced by connection B on the platform.
      state.connections = [makeConnection({ id: 'c_slack_b', integrationId: 'slack-channels' })];
      state.credentials = { c_slack_b: { type: 'oauth2', accessToken: 'token-b', expiresAt: null } };
      resolver.invalidate();
      await resolver();
      await expect(tokenResolver!()).resolves.toBe('token-b');
    });
  });

  it("warns once when a project has a stale 'slack' connection but no 'slack-channels' connection (rekey migration aid)", async () => {
    // Pre-0.6 the Slack channel was keyed off the platform 'slack' integration.
    // After the rekey, an upgrader who hasn't reconnected under 'slack-channels'
    // gets no Slack channel — call that out loudly with a one-shot warning so
    // it isn't a silent regression.
    const state: PlatformState = {
      connections: [makeConnection({ id: 'c_slack_old', integrationId: 'slack' })],
      credentials: { c_slack_old: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null } },
    };
    const fetchMock = platformFetch(state);
    const channelsFn = await importChannels();
    const resolver = await channelsFn(options(fetchMock));
    const providers = await resolver();

    expect(providers['slack-channels']).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /active 'slack' connection but no 'slack-channels' connection.*Slack channel is now keyed off 'slack-channels'/i,
      ),
    );

    // The warning fires once per resolver instance, not on every refresh.
    resolver.invalidate();
    await resolver();
    const staleWarnings = warnSpy.mock.calls.filter(
      ([msg]) =>
        typeof msg === 'string' && msg.includes("active 'slack' connection but no 'slack-channels' connection"),
    );
    expect(staleWarnings).toHaveLength(1);

    // Once the user reconnects under the new key, the warning stays silent and
    // the channel resolves as expected.
    state.connections = [makeConnection({ id: 'c_slack_new', integrationId: 'slack-channels' })];
    state.credentials = {
      c_slack_new: { type: 'oauth2', accessToken: SLACK_ACCESS_TOKEN, expiresAt: null },
    };
    resolver.invalidate();
    const providersAfter = await resolver();
    expect(providersAfter['slack-channels']).toBeInstanceOf(FakeChannelProvider);
  });
});
