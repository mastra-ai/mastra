// Hand-maintained registry of channel-capable providers. The launch ships
// with three; when a fourth lands the provider generator can grow support.
import { MastraConnectError } from '../errors.js';

import { AdapterChannelProvider } from './adapter-channel-provider.js';
import type { ChannelProviderLike, ChannelProviderRegistration } from './channel-provider.js';

function credentialToken(
  credential: { type: 'oauth2'; accessToken: string } | { type: 'api_key'; apiKey: string },
): string {
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
 * Slack: platform stores the Slack app configuration refresh token as an
 * ordinary `slack` OAuth connection. The refresh token IS the credential.
 * `SlackProvider` handles its own manifest-create + install + rotation flow.
 */
const slackChannel: ChannelProviderRegistration = {
  integrationId: 'slack',
  envVar: 'MASTRA_SLACK_CONNECTION_ID',
  async build(credential, options) {
    const refreshToken = credentialToken(credential as any);
    let mod: any;
    try {
      mod = await import('@mastra/slack');
    } catch (error) {
      throw missingPeerError('slack', '@mastra/slack', error);
    }
    return new mod.SlackProvider({ refreshToken, ...(options ?? {}) }) as ChannelProviderLike;
  },
};

/**
 * Telegram: platform stores the bot token as an ordinary `telegram` connection.
 * `TelegramProvider` implements `ChannelProvider` and handles webhook/polling
 * routing plus streaming replies. The bot token is passed through via the
 * options bag; per-agent activation continues to flow through the provider's
 * own `connect(agentId, credentials)` lifecycle.
 */
const telegramChannel: ChannelProviderRegistration = {
  integrationId: 'telegram',
  envVar: 'MASTRA_TELEGRAM_CONNECTION_ID',
  async build(credential, options) {
    const botToken = credentialToken(credential as any);
    let mod: any;
    try {
      mod = await import('@mastra/telegram');
    } catch (error) {
      throw missingPeerError('telegram', '@mastra/telegram', error);
    }
    return new mod.TelegramProvider({ botToken, ...(options ?? {}) }) as ChannelProviderLike;
  },
};

interface DiscordProviderOptions {
  applicationId?: string;
  publicKey?: string;
  [key: string]: unknown;
}

/**
 * Discord: platform stores the bot token as the connection credential;
 * `applicationId` + `publicKey` come from durable connection metadata (or
 * per-integration `providerOptions`). `createDiscordAdapter()` returns a raw
 * `Adapter`; `AdapterChannelProvider` shims it into `ChannelProviderLike` so
 * the value handed to `Mastra({ channels })` is uniform across providers.
 */
const discordChannel: ChannelProviderRegistration<DiscordProviderOptions> = {
  integrationId: 'discord',
  envVar: 'MASTRA_DISCORD_CONNECTION_ID',
  async build(credential, options, context) {
    const botToken = credentialToken(credential as any);
    const metadata = context?.context?.metadata ?? {};
    const applicationId =
      options?.applicationId ??
      (typeof metadata.applicationId === 'string' ? metadata.applicationId : undefined) ??
      (typeof metadata.application_id === 'string' ? metadata.application_id : undefined);
    const publicKey =
      options?.publicKey ??
      (typeof metadata.publicKey === 'string' ? metadata.publicKey : undefined) ??
      (typeof metadata.public_key === 'string' ? metadata.public_key : undefined);
    let mod: any;
    try {
      mod = await import('@chat-adapter/discord');
    } catch (error) {
      throw missingPeerError('discord', '@chat-adapter/discord', error);
    }
    const adapter = mod.createDiscordAdapter({
      botToken,
      applicationId,
      publicKey,
      ...(options ?? {}),
    });
    return new AdapterChannelProvider(adapter, 'discord');
  },
};

export const CHANNELS: readonly ChannelProviderRegistration[] = [slackChannel, telegramChannel, discordChannel];
