// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
// The 'discord-dual' integration id is the platform-catalog rename over Nango's
// upstream 'discord-bot' provider; the single API-key connection powers both the
// channel (@mastra/discord) and these generated tools.
import type { ProviderRegistration } from '../../registry.js';
import { createDiscordDualTools } from './tools.js';

export const discordDualProvider: ProviderRegistration = {
  integrationId: 'discord-dual',
  envVar: 'MASTRA_DISCORD_DUAL_CONNECTION_ID',
  createTools: createDiscordDualTools,
};

export { createDiscordDualTools };
