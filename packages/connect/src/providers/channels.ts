// Hand-maintained registry of channel-capable providers. The launch ships
// with three (Slack, Telegram, Discord); when a fourth lands the provider
// generator can grow support.
import type { ChannelProvider } from '@mastra/core/channels';

import type { ConnectionCredential } from '../client.js';
import { getCredential } from '../client.js';

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
  async build(credential, options, context) {
    const mod = (await import('@mastra/slack')) as {
      SlackProvider: new (config: Record<string, unknown>) => ChannelProvider;
    };
    const safeOptions = stripReservedOptions('slack', options);
    if (context) {
      const { client, connectionId } = context;
      const tokenResolver = async (): Promise<string> => {
        const fresh = await getCredential(client, connectionId);
        return credentialToken(fresh);
      };
      return new mod.SlackProvider({ tokenResolver, ...(safeOptions ?? {}) });
    }
    // No build context (direct registration use) — fall back to treating the
    // credential as a self-managed App Configuration refresh token.
    return new mod.SlackProvider({ refreshToken: credentialToken(credential), ...(safeOptions ?? {}) });
  },
};

/**
 * Telegram: wraps `@mastra/telegram`'s `TelegramProvider`. The platform stores
 * the BotFather bot token as the API-key credential on the connection; that
 * token is threaded into the `TelegramProvider` constructor as the default the
 * provider's `connect(agentId)` call falls back to (per-agent `connect()` may
 * override with a different token, but with `channels()` most apps won't need
 * to).
 *
 * `providerOptions` is spread after `botToken`; reserved fields (`baseUrl`,
 * `apiBaseUrl`, `botToken`, `encryptionKey`) are rejected at the type level
 * and stripped at runtime. Non-reserved provider config (`mode`, `commands`,
 * `streaming`, `typingStatus`, handlers, etc.) is forwarded unchanged. See
 * `@mastra/telegram`'s `TelegramProviderConfig` for the full option surface.
 */
const telegramChannel: ChannelProviderRegistration = {
  integrationId: 'telegram',
  async build(credential, options) {
    const botToken = credentialToken(credential);
    const mod = (await import('@mastra/telegram')) as {
      TelegramProvider: new (config: Record<string, unknown>) => ChannelProvider;
    };
    const safeOptions = stripReservedOptions('telegram', options);
    return new mod.TelegramProvider({ botToken, ...(safeOptions ?? {}) });
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
 * `providerOptions` is spread into the `DiscordProvider` constructor after the
 * `app` object; reserved fields (`baseUrl`, `encryptionKey`) are rejected at
 * the type level and stripped at runtime. Non-reserved provider config
 * (`applicationId`, `publicKey`, permissions, commandScope, gateway,
 * streaming, etc.) is forwarded unchanged. See `@mastra/discord`'s
 * `DiscordProviderConfig` for the full option surface.
 */
const discordChannel: ChannelProviderRegistration<DiscordProviderOptions> = {
  integrationId: 'discord',
  async build(credential, options, context) {
    const botToken = credentialToken(credential);
    const metadata = (context?.context?.metadata ?? {}) as Record<string, unknown>;
    const applicationId =
      options?.applicationId ??
      (typeof metadata.applicationId === 'string' ? metadata.applicationId : undefined) ??
      (typeof metadata.application_id === 'string' ? metadata.application_id : undefined);
    const publicKey =
      options?.publicKey ??
      (typeof metadata.publicKey === 'string' ? metadata.publicKey : undefined) ??
      (typeof metadata.public_key === 'string' ? metadata.public_key : undefined);
    const mod = (await import('@mastra/discord')) as {
      DiscordProvider: new (config: Record<string, unknown>) => ChannelProvider;
    };
    // `applicationId` and `publicKey` are optional overrides from the
    // connection's non-secret metadata (or `providerOptions`). When absent,
    // DiscordProvider resolves them itself from `GET /applications/@me` using
    // the bot token, so no warning is needed.
    // `options` is spread AFTER `app` so an operator can override the app
    // object entirely from `providerOptions.app`, and BEFORE `app` (as
    // top-level fields) so the metadata-derived defaults land in the same
    // spread order that `SlackProvider` / `TelegramProvider` follow.
    const { applicationId: _optAppId, publicKey: _optPubKey, ...rest } = options ?? {};
    void _optAppId;
    void _optPubKey;
    return new mod.DiscordProvider({
      app: { botToken, applicationId, publicKey },
      ...rest,
    });
  },
};

export const CHANNELS: readonly ChannelProviderRegistration[] = [slackChannel, telegramChannel, discordChannel];
