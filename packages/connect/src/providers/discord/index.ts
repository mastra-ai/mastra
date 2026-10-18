// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
// The `discord` integration on the platform is an API-key connection whose
// credential is the bot token; the same connection powers both the channel
// (@mastra/discord) and these generated tools.
import type { ProviderRegistration } from '../../registry.js';
import { createDiscordTools } from './tools.js';

export const discordProvider: ProviderRegistration = {
  integrationId: 'discord',
  envVar: 'MASTRA_DISCORD_CONNECTION_ID',
  createTools: createDiscordTools,
};

export { createDiscordTools };
