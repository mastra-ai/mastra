// Hand-maintained registry of channel-capable providers. The launch ships
// with three (Slack, Telegram, Discord); when a fourth lands the provider
// generator can grow support.
import type { ChannelProvider } from '@mastra/core/channels';

import type { ConnectionCredential } from '../client.js';
import { MastraConnectError } from '../errors.js';

import type { ChannelProviderRegistration } from './channel-provider.js';

function credentialToken(credential: ConnectionCredential): string {
  return credential.type === 'oauth2' ? credential.accessToken : credential.apiKey;
}

function missingPeerError(integrationId: string, packageName: string, error: unknown): MastraConnectError {
  const reason = error instanceof Error ? error.message : String(error);
  return new MastraConnectError(
    'invalid_options',
    `channels() cannot build '${integrationId}' provider: install '${packageName}' as a dependency of your app (${reason}).`,
  );
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
const SLACK_RESERVED_KEYS = ['baseUrl', 'refreshToken', 'token', 'encryptionKey'] as const;
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
 * Slack: wraps `@mastra/slack`'s `SlackProvider`. The platform stores a Slack
 * App Configuration refresh token (`xoxe-1-...`) on the connection credential;
 * `SlackProvider` handles token rotation, per-agent app minting via the
 * manifest API, OAuth install flow, and webhook signature verification (the
 * per-app signing secret is minted at install time via the manifest API and
 * stored on `ChannelsStorage`, not sourced from `providerOptions`).
 *
 * `providerOptions` is spread into the `SlackProvider` constructor after
 * `refreshToken`; reserved fields (`baseUrl`, `refreshToken`, `token`,
 * `encryptionKey`) are rejected at the type level and stripped at runtime.
 * Non-reserved provider config (default scopes, streaming settings, handlers,
 * inlineMedia, etc.) is forwarded unchanged. See `@mastra/slack`'s
 * `SlackProviderConfig` for the full option surface.
 */
const slackChannel: ChannelProviderRegistration = {
  integrationId: 'slack',
  async build(credential, options) {
    const refreshToken = credentialToken(credential);
    let mod: { SlackProvider: new (config: Record<string, unknown>) => ChannelProvider };
    try {
      mod = (await import('@mastra/slack')) as {
        SlackProvider: new (config: Record<string, unknown>) => ChannelProvider;
      };
    } catch (error) {
      throw missingPeerError('slack', '@mastra/slack', error);
    }
    const safeOptions = stripReservedOptions('slack', options);
    return new mod.SlackProvider({ refreshToken, ...(safeOptions ?? {}) });
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
    let mod: { TelegramProvider: new (config: Record<string, unknown>) => ChannelProvider };
    try {
      mod = (await import('@mastra/telegram')) as {
        TelegramProvider: new (config: Record<string, unknown>) => ChannelProvider;
      };
    } catch (error) {
      throw missingPeerError('telegram', '@mastra/telegram', error);
    }
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
 * bot token as the connection credential; `applicationId` + `publicKey` come
 * from the connection's metadata (or a `providerOptions` override on
 * `channels()`). `DiscordProvider` handles per-guild command registration,
 * Ed25519 signature verification, and the invite-URL install flow. Note that
 * Discord's `publicKey` is not a signing secret — it's the public counterpart
 * of the Ed25519 verification pair, so allowing it via `providerOptions` is
 * safe.
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
    let mod: { DiscordProvider: new (config: Record<string, unknown>) => ChannelProvider };
    try {
      mod = (await import('@mastra/discord')) as {
        DiscordProvider: new (config: Record<string, unknown>) => ChannelProvider;
      };
    } catch (error) {
      throw missingPeerError('discord', '@mastra/discord', error);
    }
    // `applicationId` and `publicKey` live on the connection's non-secret
    // metadata (or in `providerOptions`). If both are missing DiscordProvider
    // will still construct — its `#suppliedAppConfig()` falls back to
    // `DISCORD_APPLICATION_ID` / `DISCORD_PUBLIC_KEY` env vars — but the
    // Ed25519 verification path needs `publicKey` and command registration
    // needs `applicationId`, so log a warning when they're absent so the
    // shape mismatch surfaces at startup, not at first inbound interaction.
    if (!applicationId || !publicKey) {
      console.warn(
        `[@mastra/connect] discord channel: missing ${[!applicationId && 'applicationId', !publicKey && 'publicKey']
          .filter(Boolean)
          .join(
            ' + ',
          )} on the connection. Store them on the connection's metadata or pass them via integrations.discord.providerOptions.`,
      );
    }
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
