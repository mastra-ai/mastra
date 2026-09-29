// Hand-maintained registry of channel-capable providers. The launch ships
// with three (Slack, Telegram, Discord); when a fourth lands the provider
// generator can grow support.
import type { ChannelProvider } from '@mastra/core/channels';

import type { ConnectionCredential } from '../client.js';
import { MastraConnectError } from '../errors.js';

import type { ChannelProviderRegistration } from './channel-provider.js';

function credentialToken(credential: ConnectionCredential): string {
  switch (credential.type) {
    case 'oauth2':
      return credential.accessToken;
    case 'two_step':
      // TWO_STEP credentials (e.g. Slack app-configuration tokens) carry the
      // rotating access token under `token`; the vendor owns the refresh
      // cycle and never exposes the refresh token.
      return credential.token;
    default:
      return credential.apiKey;
  }
}

/**
 * Fields on `providerOptions` that `channels()` refuses to forward to a
 * `ChannelProvider` constructor. Two categories:
 *
 * - **Credentials.** The whole point of `channels()` is that the credential
 *   comes from the platform connection. Passing another `refreshToken` /
 *   `botToken` via `providerOptions` would silently override the connection
 *   (and thereby bypass rotation, revocation, and auditing).
 * - **Framework-managed.** `baseUrl` is derived from the Mastra server config
 *   so webhook URLs match the actually-bound host. Overriding it from user code
 *   is a foot-gun (mismatched OAuth redirect URIs, dropped webhook deliveries).
 *   `encryptionKey` is a process-wide at-rest secret sourced from
 *   `MASTRA_ENCRYPTION_KEY`; letting `providerOptions` override it per
 *   integration would fragment the encryption boundary. Teams enforces the
 *   env var at wrapper time so its persistent install store can never
 *   silently fall back to plaintext.
 *
 * Anything on this list is stripped with a warning; the rest of
 * `providerOptions` (handlers, streaming, commands, handlers, threadContext,
 * inlineMedia, etc.) is forwarded to the provider constructor unchanged.
 */
const SLACK_RESERVED_KEYS = ['baseUrl', 'refreshToken', 'token', 'tokenResolver', 'encryptionKey'] as const;
const TELEGRAM_RESERVED_KEYS = ['baseUrl', 'apiBaseUrl', 'botToken', 'tokenResolver', 'encryptionKey'] as const;
const DISCORD_RESERVED_KEYS = ['baseUrl', 'encryptionKey'] as const;
const TEAMS_RESERVED_KEYS = ['baseUrl', 'appId', 'appPassword', 'tokenResolver', 'encryptionKey'] as const;

/** Reserved (credential + framework-managed) `providerOptions` keys per integration. */
export type SlackReservedProviderOption = (typeof SLACK_RESERVED_KEYS)[number];
export type TelegramReservedProviderOption = (typeof TELEGRAM_RESERVED_KEYS)[number];
export type DiscordReservedProviderOption = (typeof DISCORD_RESERVED_KEYS)[number];
export type TeamsReservedProviderOption = (typeof TEAMS_RESERVED_KEYS)[number];

const RESERVED_OPTION_KEYS: Record<string, readonly string[]> = {
  'slack-channels': SLACK_RESERVED_KEYS,
  telegram: TELEGRAM_RESERVED_KEYS,
  discord: DISCORD_RESERVED_KEYS,
  'microsoft-teams': TEAMS_RESERVED_KEYS,
};

function stripReservedOptions<T extends Record<string, unknown> | undefined>(integrationId: string, options: T): T {
  if (!options) return options;
  const reserved = RESERVED_OPTION_KEYS[integrationId];
  if (!reserved) return options;
  const stripped: string[] = [];
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (reserved.includes(key)) {
      stripped.push(key);
      continue;
    }
    filtered[key] = value;
  }
  if (stripped.length > 0) {
    console.warn(
      `[@mastra/connect] ${integrationId} channel: ignoring reserved providerOptions field(s): ${stripped
        .map(k => `'${k}'`)
        .join(', ')}. These are managed by the connection credential or the Mastra server config.`,
    );
  }
  return filtered as T;
}

/**
 * Slack: wraps `@mastra/slack`'s `SlackProvider`, matched to the platform's
 * `slack-channels` integration — the platform-catalog rename over Nango's
 * upstream `slack-app-configuration` provider. `slack-channels` serves a
 * TWO_STEP credential carrying a Slack App Configuration token (the
 * platform exposes it as `{ type: 'two_step' }` with the rotating config
 * token under `token`), so the provider is constructed with a
 * `tokenResolver` that fetches a fresh token from the platform before each
 * manifest API call. `SlackProvider` never calls `tooling.tokens.rotate` in
 * this mode — rotating the platform's single-use refresh token locally
 * would burn the vendor's stored copy and permanently break the
 * connection. The provider still handles per-agent app minting via the
 * manifest API, OAuth install flow, and webhook signature verification
 * (the per-app signing secret is minted at install time via the manifest
 * API and stored on `ChannelsStorage`, not sourced from `providerOptions`).
 *
 * The OAuth-based `slack` integration is deliberately not channel-capable:
 * its bot token is scoped to a single installed workspace and cannot mint
 * per-agent apps, which is the whole point of the channel. The `slack`
 * integration continues to back the generated Slack **tools**
 * (`providers/slack/`) from its OAuth bot credential.
 *
 * `providerOptions` is spread into the `SlackProvider` constructor after
 * `tokenResolver`; reserved fields (`baseUrl`, `refreshToken`, `token`,
 * `tokenResolver`, `encryptionKey`) are rejected at the type level and
 * stripped at runtime. Non-reserved provider config (default scopes,
 * streaming settings, handlers, inlineMedia, etc.) is forwarded unchanged.
 * See `@mastra/slack`'s `SlackProviderConfig` for the full option surface.
 */
const slackChannel: ChannelProviderRegistration = {
  integrationId: 'slack-channels',
  async create(options, runtime) {
    const mod = (await import('@mastra/slack')) as {
      SlackProvider: new (config: Record<string, unknown>) => ChannelProvider;
    };
    const safeOptions = stripReservedOptions('slack-channels', options);
    // The resolver reads the *current* connection through the runtime on
    // every call, so a connection swapped on the platform takes effect on the
    // next manifest operation — no `sync()` needed.
    const tokenResolver = async (): Promise<string> => {
      const fresh = await runtime.getCredential();
      return credentialToken(fresh);
    };
    return { provider: new mod.SlackProvider({ tokenResolver, ...(safeOptions ?? {}) }) };
  },
};

/**
 * Telegram: wraps `@mastra/telegram`'s `TelegramProvider` in delegated
 * credential mode. The provider is constructed with a `tokenResolver` that
 * fetches the platform-stored BotFather bot token (the connection's `api_key`
 * credential) on demand — the token is never persisted in the provider's
 * install store and is re-resolved per Bot API call, so a token re-pasted on
 * the platform takes effect without a restart or `sync()`.
 *
 * The resolver returns whatever token the current connection holds — it does
 * not know which installation is asking. If the platform connection is
 * repointed at a *different* bot, `TelegramProvider` catches that on the next
 * lifecycle step (init/connect/disconnect) by comparing the resolved token's
 * bot user id against the stored installation and refuses to retarget the
 * existing agent's webhook. Adopting a new bot is an intentional operator
 * action: disconnect the agent, then reconnect.
 *
 * Reserved `providerOptions` fields (`baseUrl`, `apiBaseUrl`, `botToken`,
 * `tokenResolver`, `encryptionKey`) are rejected at the type level and
 * stripped at runtime. Non-reserved provider config (`mode`, `commands`,
 * `streaming`, `typingStatus`, handlers, etc.) is forwarded unchanged. See
 * `@mastra/telegram`'s `TelegramProviderConfig` for the full option surface.
 */
const telegramChannel: ChannelProviderRegistration = {
  integrationId: 'telegram',
  async create(options, runtime) {
    const mod = (await import('@mastra/telegram')) as {
      TelegramProvider: new (config: Record<string, unknown>) => ChannelProvider;
    };
    const safeOptions = stripReservedOptions('telegram', options);
    // Fetch the current credential on every call — the platform owns the
    // token, so a swap there is picked up on the next Bot API request.
    const tokenResolver = async (): Promise<string> => {
      const fresh = await runtime.getCredential();
      return credentialToken(fresh);
    };
    return { provider: new mod.TelegramProvider({ tokenResolver, ...(safeOptions ?? {}) }) };
  },
};

interface DiscordProviderOptions extends Record<string, unknown> {
  applicationId?: string;
  publicKey?: string;
}

/**
 * Discord: wraps `@mastra/discord`'s `DiscordProvider`. The bot token lives in
 * the connection's Nango **metadata** (`botToken`), not in the OAuth
 * credential — Discord's token exchange only yields a user Bearer token, so
 * Nango's Discord convention (shared by NangoHQ's integration-templates, and
 * by our generated Discord tools) stores the bot token on the connection via
 * `setMetadata`. The oauth2 `accessToken` is used only as a fallback for
 * setups where the credential itself is a bot token (e.g. an API-key style
 * integration). The bot token alone is enough: `DiscordProvider` backfills
 * `applicationId` and `publicKey` from `GET /applications/@me` (the
 * application object carries the id and the Ed25519 `verify_key`). Connection
 * metadata (`applicationId`/`publicKey`, camelCase or snake_case) or a
 * `providerOptions` override take precedence over the backfilled values when
 * present. `DiscordProvider` handles per-guild command registration, Ed25519
 * signature verification, and the invite-URL install flow. Note that
 * Discord's `publicKey` is not a signing secret — it's the public counterpart
 * of the Ed25519 verification pair, so allowing it via `providerOptions` is
 * safe.
 *
 * The provider is constructed credential-less (so its routes can mount before
 * a connection exists); the bot token plus any metadata-derived
 * `applicationId`/`publicKey` overrides are pushed in via `configure()` on
 * every resolution while a connection is active. The connection credential
 * wins over a `providerOptions.app.botToken` — credentials come from the
 * platform connection by design.
 *
 * Reserved `providerOptions` fields (`baseUrl`, `encryptionKey`) are rejected
 * at the type level and stripped at runtime. Non-reserved provider config
 * (`applicationId`, `publicKey`, permissions, commandScope, gateway,
 * streaming, etc.) is forwarded unchanged. See `@mastra/discord`'s
 * `DiscordProviderConfig` for the full option surface.
 */
const discordChannel: ChannelProviderRegistration<DiscordProviderOptions> = {
  integrationId: 'discord',
  async create(options, runtime) {
    const mod = (await import('@mastra/discord')) as {
      DiscordProvider: new (config: Record<string, unknown>) => ChannelProvider;
    };
    const { applicationId: optionsAppId, publicKey: optionsPublicKey, ...rest } = options ?? {};
    const safeOptions = stripReservedOptions('discord', rest);
    const provider = new mod.DiscordProvider({ ...(safeOptions ?? {}) });
    return {
      provider,
      async sync() {
        const metadata = ((await runtime.getConnectionContext())?.metadata ?? {}) as Record<string, unknown>;
        // The bot token comes from connection metadata (Nango's Discord
        // convention — the same `botToken` metadata contract the generated
        // Discord tools consume). The OAuth credential is a user Bearer
        // token that Discord always rejects for bot auth, so there is no
        // credential fallback: without metadata the provider stays
        // unconfigured rather than failing later with a misleading 401.
        const botToken =
          (typeof metadata.botToken === 'string' && metadata.botToken) ||
          (typeof metadata.bot_token === 'string' && metadata.bot_token) ||
          undefined;
        if (!botToken) {
          throw new MastraConnectError(
            'no_active_connection',
            `Discord connection ${runtime.getConnectionId()} has no botToken in its metadata. ` +
              `Store the bot token on the connection (Nango setMetadata) to activate the Discord channel.`,
          );
        }
        const applicationId =
          optionsAppId ??
          (typeof metadata.applicationId === 'string' ? metadata.applicationId : undefined) ??
          (typeof metadata.application_id === 'string' ? metadata.application_id : undefined);
        const publicKey =
          optionsPublicKey ??
          (typeof metadata.publicKey === 'string' ? metadata.publicKey : undefined) ??
          (typeof metadata.public_key === 'string' ? metadata.public_key : undefined);
        // `applicationId` and `publicKey` are optional overrides from the
        // connection's non-secret metadata (or `providerOptions`). When
        // absent, DiscordProvider resolves them itself from
        // `GET /applications/@me` using the bot token, so no warning is
        // needed.
        // Omit undefined fields: `configure()` merges over the previous app
        // config, and an explicit `undefined` would clobber a value supplied
        // via env vars or an earlier sync.
        const credentials: Record<string, unknown> = { botToken };
        if (applicationId) credentials.applicationId = applicationId;
        if (publicKey) credentials.publicKey = publicKey;
        await provider.configure?.(credentials);
      },
    };
  },
};

/**
 * Microsoft Teams: wraps `@mastra/teams`'s `TeamsProvider` in delegated mode.
 * Teams provisioning spans two token audiences, so unlike the Slack/Telegram
 * resolvers this one is scope-aware:
 *
 * - **Microsoft Graph** (`TEAMS_GRAPH_SCOPE`): resolved from the connection's
 *   oauth2 credential. The platform's credential vendor (Nango) owns the
 *   refresh cycle; each `getCredential()` call may return a newer token.
 * - **Teams Developer Portal** (`TEAMS_DEV_PORTAL_SCOPE`): resolved from the
 *   credential's `secondaryAccessTokens.devPortalAccessToken` — the secondary
 *   token Nango's `microsoft-teams` provider mints when the integration
 *   requests the `dev.teams.microsoft.com/AppDefinitions.ReadWrite` scope,
 *   served by the platform alongside the primary Graph token on the same
 *   credentials response (a single `getCredential()` call triggers the
 *   vendor refresh cycle that re-mints both). Connections whose integration
 *   doesn't request that scope get an actionable error instead of a Dev
 *   Portal 401.
 *
 * The manager credential is only used at provisioning time — each provisioned
 * bot authenticates with its own client secret from the provider's install
 * store, so the message path never round-trips to the platform.
 *
 * Reserved `providerOptions` fields (`baseUrl`, `appId`, `appPassword`,
 * `tokenResolver`, `encryptionKey`) are rejected at the type level and
 * stripped at runtime. Non-reserved provider config (`appType`, `streaming`,
 * `typingStatus`, handlers, etc.) is forwarded unchanged. See
 * `@mastra/teams`'s `TeamsProviderConfig` for the full option surface.
 */
const teamsChannel: ChannelProviderRegistration = {
  integrationId: 'microsoft-teams',
  async create(options, runtime) {
    const mod = (await import('@mastra/teams')) as {
      TeamsProvider: new (config: Record<string, unknown>) => ChannelProvider;
      TEAMS_DEV_PORTAL_SCOPE: string;
    };
    // Defense-in-depth around Teams' persistent install store: it holds the
    // per-agent bot `appPassword` at rest, so a missing encryption key would
    // silently downgrade delegated provisioning to plaintext persistence.
    // `encryptionKey` is stripped from `providerOptions` (reserved) so the
    // key can only come from `MASTRA_ENCRYPTION_KEY`. Fail fast at wrapper
    // time if it is not set — clearer than watching a provisioning call
    // throw deep inside `@mastra/teams`.
    if (!process.env.MASTRA_ENCRYPTION_KEY) {
      throw new MastraConnectError(
        'invalid_options',
        'Microsoft Teams channel: MASTRA_ENCRYPTION_KEY is not set. ' +
          'The Teams install store persists per-agent bot secrets and requires an at-rest ' +
          'encryption key (a 32-byte value, base64-encoded).',
      );
    }
    const safeOptions = stripReservedOptions('microsoft-teams', options);
    // Mirrors the Slack/Telegram pattern: fetch the current credential on
    // every call, let the platform's vendor own rotation, extract the token
    // the provider asked for. Unlike Slack/Telegram, Teams provisioning
    // spans two token audiences (Graph + Dev Portal), so the resolver is
    // scope-aware — a single `getCredential()` call triggers the vendor's
    // refresh cycle that re-mints the secondary Dev Portal token alongside
    // the primary Graph token and serves both on the same response.
    const tokenResolver = async (scope: string | string[]): Promise<string> => {
      const fresh = await runtime.getCredential();
      const scopes = Array.isArray(scope) ? scope : [scope];
      if (!scopes.includes(mod.TEAMS_DEV_PORTAL_SCOPE)) {
        return credentialToken(fresh);
      }
      const token =
        fresh.type === 'oauth2' ? fresh.secondaryAccessTokens?.devPortalAccessToken?.accessToken : undefined;
      if (!token) {
        throw new MastraConnectError(
          'no_active_connection',
          `Teams connection ${runtime.getConnectionId()} has no Dev Portal token on its credential. ` +
            `Reconnect with an integration that requests the ${mod.TEAMS_DEV_PORTAL_SCOPE} scope.`,
        );
      }
      return token;
    };
    return { provider: new mod.TeamsProvider({ tokenResolver, ...(safeOptions ?? {}) }) };
  },
};

export const CHANNELS: readonly ChannelProviderRegistration[] = [
  slackChannel,
  telegramChannel,
  discordChannel,
  teamsChannel,
];
