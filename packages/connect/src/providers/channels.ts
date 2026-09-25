// Hand-maintained registry of channel-capable providers. The launch ships
// with three (Slack, Telegram, Discord); when a fourth lands the provider
// generator can grow support.
import type { ChannelProvider } from '@mastra/core/channels';

import type { ConnectionCredential } from '../client.js';

import type { ChannelProviderRegistration } from './channel-provider.js';

function credentialToken(credential: ConnectionCredential): string {
  return credential.type === 'oauth2' ? credential.accessToken : credential.apiKey;
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
 *   integration would fragment the encryption boundary.
 *
 * Anything on this list is stripped with a warning; the rest of
 * `providerOptions` (handlers, streaming, commands, handlers, threadContext,
 * inlineMedia, etc.) is forwarded to the provider constructor unchanged.
 */
const SLACK_RESERVED_KEYS = ['baseUrl', 'refreshToken', 'token', 'tokenResolver', 'encryptionKey'] as const;
const TELEGRAM_RESERVED_KEYS = ['baseUrl', 'apiBaseUrl', 'botToken', 'encryptionKey'] as const;
const DISCORD_RESERVED_KEYS = ['baseUrl', 'encryptionKey'] as const;

/** Reserved (credential + framework-managed) `providerOptions` keys per integration. */
export type SlackReservedProviderOption = (typeof SLACK_RESERVED_KEYS)[number];
export type TelegramReservedProviderOption = (typeof TELEGRAM_RESERVED_KEYS)[number];
export type DiscordReservedProviderOption = (typeof DISCORD_RESERVED_KEYS)[number];

const RESERVED_OPTION_KEYS: Record<string, readonly string[]> = {
  slack: SLACK_RESERVED_KEYS,
  telegram: TELEGRAM_RESERVED_KEYS,
  discord: DISCORD_RESERVED_KEYS,
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
 * Slack: wraps `@mastra/slack`'s `SlackProvider`. The platform's credential
 * vendor (Nango) owns the Slack App Configuration token refresh cycle, so the
 * provider is constructed with a `tokenResolver` that fetches a fresh access
 * token from the platform before each manifest API call. `SlackProvider`
 * never calls `tooling.tokens.rotate` in this mode — rotating the platform's
 * single-use refresh token locally would burn the vendor's stored copy and
 * permanently break the connection. The provider still handles per-agent app
 * minting via the manifest API, OAuth install flow, and webhook signature
 * verification (the per-app signing secret is minted at install time via the
 * manifest API and stored on `ChannelsStorage`, not sourced from
 * `providerOptions`).
 *
 * `providerOptions` is spread into the `SlackProvider` constructor after
 * `tokenResolver`; reserved fields (`baseUrl`, `refreshToken`, `token`,
 * `tokenResolver`, `encryptionKey`) are rejected at the type level and
 * stripped at runtime. Non-reserved provider config (default scopes,
 * streaming settings, handlers, inlineMedia, etc.) is forwarded unchanged.
 * See `@mastra/slack`'s `SlackProviderConfig` for the full option surface.
 */
const slackChannel: ChannelProviderRegistration = {
  integrationId: 'slack',
  async create(options, runtime) {
    const mod = (await import('@mastra/slack')) as {
      SlackProvider: new (config: Record<string, unknown>) => ChannelProvider;
    };
    const safeOptions = stripReservedOptions('slack', options);
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
 * Telegram: wraps `@mastra/telegram`'s `TelegramProvider`. The provider is
 * constructed credential-less (so its routes can mount before a connection
 * exists); the platform-stored BotFather bot token is pushed in via
 * `configure({ botToken })` on every resolution while a connection is active.
 * It becomes the default the provider's `connect(agentId)` call falls back to
 * (per-agent `connect()` may override with a different token, but with
 * `channels()` most apps won't need to).
 *
 * Reserved `providerOptions` fields (`baseUrl`, `apiBaseUrl`, `botToken`,
 * `encryptionKey`) are rejected at the type level and stripped at runtime.
 * Non-reserved provider config (`mode`, `commands`, `streaming`,
 * `typingStatus`, handlers, etc.) is forwarded unchanged. See
 * `@mastra/telegram`'s `TelegramProviderConfig` for the full option surface.
 */
const telegramChannel: ChannelProviderRegistration = {
  integrationId: 'telegram',
  async create(options, runtime) {
    const mod = (await import('@mastra/telegram')) as {
      TelegramProvider: new (config: Record<string, unknown>) => ChannelProvider;
    };
    const safeOptions = stripReservedOptions('telegram', options);
    const provider = new mod.TelegramProvider({ ...(safeOptions ?? {}) });
    return {
      provider,
      // `configure()` merges the token into provider config and is cheap when
      // nothing changed, so re-applying on every resolution is safe.
      async sync() {
        const botToken = credentialToken(await runtime.getCredential());
        await provider.configure?.({ botToken });
      },
    };
  },
};

interface DiscordProviderOptions extends Record<string, unknown> {
  applicationId?: string;
  publicKey?: string;
}

/**
 * Discord: wraps `@mastra/discord`'s `DiscordProvider`. The platform stores the
 * bot token as the connection credential — that alone is enough:
 * `DiscordProvider` backfills `applicationId` and `publicKey` from
 * `GET /applications/@me` (the application object carries the id and the
 * Ed25519 `verify_key`). Connection metadata (`applicationId`/`publicKey`,
 * camelCase or snake_case) or a `providerOptions` override take precedence
 * over the backfilled values when present. `DiscordProvider` handles per-guild
 * command registration, Ed25519 signature verification, and the invite-URL
 * install flow. Note that Discord's `publicKey` is not a signing secret — it's
 * the public counterpart of the Ed25519 verification pair, so allowing it via
 * `providerOptions` is safe.
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
        const botToken = credentialToken(await runtime.getCredential());
        const metadata = ((await runtime.getConnectionContext())?.metadata ?? {}) as Record<string, unknown>;
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

export const CHANNELS: readonly ChannelProviderRegistration[] = [slackChannel, telegramChannel, discordChannel];
