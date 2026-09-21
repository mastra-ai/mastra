// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createDiscordTools } from './tools.js';

export const discordProvider: ProviderRegistration = {
  integrationId: 'discord',
  envVar: 'MASTRA_DISCORD_CONNECTION_ID',
  createTools: createDiscordTools,
};

export { createDiscordTools };
