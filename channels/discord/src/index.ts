export { DiscordProvider, resolveDiscordAdapterConfig } from './discord-provider';
export { DiscordInstallStore, toInstallationInfo, PLATFORM } from './install-store';
export {
  validateApp,
  guildHealthCheck,
  buildInviteUrl,
  registerGuildCommands,
  registerGlobalCommands,
  discordRequest,
} from './discord-client';
export type { DiscordApplication, BuildInviteUrlOptions } from './discord-client';
export { DEFAULT_COMMANDS, normalizeCommands, hashCommands } from './commands';
export { encrypt, decrypt, isEncrypted } from './crypto';
export {
  DISCORD_API_BASE_URL,
  DISCORD_OAUTH_AUTHORIZE_URL,
  DISCORD_PERMISSIONS,
  DEFAULT_INVITE_PERMISSIONS,
  DEFAULT_INVITE_SCOPES,
} from './types';
export type {
  DiscordProviderConfig,
  DiscordConnectOptions,
  DiscordInstallation,
  DiscordAppConfig,
  DiscordCommand,
  DiscordCommandInput,
} from './types';

// Re-export the underlying adapter for convenience (parity with @mastra/slack).
export { createDiscordAdapter, DiscordAdapter } from '@chat-adapter/discord';
export type { DiscordAdapterConfig } from '@chat-adapter/discord';
