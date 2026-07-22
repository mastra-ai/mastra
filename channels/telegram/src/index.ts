export { TelegramProvider, resolveTelegramAdapterConfig } from './telegram-provider';
export { TelegramInstallStore, toInstallationInfo, PLATFORM } from './install-store';
export { getMe, generateSecretToken, setWebhook, deleteWebhook, setMyCommands } from './telegram-client';
export type { SetWebhookOptions, SetMyCommandsOptions } from './telegram-client';
export { DEFAULT_COMMANDS, normalizeCommands } from './commands';
export { BOTFATHER_DEEP_LINK, TELEGRAM_API_BASE_URL, DEFAULT_ALLOWED_UPDATES } from './types';
export type {
  TelegramProviderConfig,
  TelegramConnectOptions,
  TelegramInstallation,
  TelegramMode,
  TelegramCommand,
  BotCommand,
} from './types';

// Re-export the underlying adapter for convenience (parity with @mastra/slack).
export { createTelegramAdapter, TelegramAdapter } from '@chat-adapter/telegram';
