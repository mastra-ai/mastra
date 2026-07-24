import type {
  ChannelAdapterConfig,
  ChannelConfig,
  ChannelHandlers,
  StreamingConfig,
  WaitUntilFn,
} from '@mastra/core/channels';
import type { ChannelsStorage } from '@mastra/core/storage';
import type { TelegramAdapterConfig } from '@chat-adapter/telegram';

/** Default Telegram Bot API origin. */
export const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';

/**
 * Transport for receiving updates.
 * - `webhook` — register a `setWebhook` and receive POSTs (default for hosted/serverless).
 * - `polling` — long-poll `getUpdates` (the provider clears any webhook first).
 * - `auto` — webhook when a `baseUrl` is available, otherwise polling.
 */
export type TelegramMode = 'auto' | 'webhook' | 'polling';

/**
 * Default update types requested from Telegram. `message_reaction` must be
 * listed explicitly (Telegram omits it otherwise).
 */
export const DEFAULT_ALLOWED_UPDATES = [
  'message',
  'edited_message',
  'channel_post',
  'edited_channel_post',
  'callback_query',
  'message_reaction',
] as const;

/**
 * A Telegram bot command as it goes over the wire (`setMyCommands`).
 * @see https://core.telegram.org/bots/api#botcommand
 */
export interface BotCommand {
  /** 1-32 chars, lowercase `[a-z0-9_]`, no leading slash. */
  command: string;
  /** 1-256 chars. */
  description: string;
}

/** Command input accepted by {@link TelegramProvider} — a bare name or a `{ command, description }`. */
export type TelegramCommand = string | { command: string; description?: string };

/**
 * Deep link that opens BotFather so an operator can create a new bot with
 * `/newbot`. Telegram has no OAuth: the resulting BotFather token is pasted
 * back into {@link TelegramProvider.connect} to finish the installation.
 */
export const BOTFATHER_DEEP_LINK = 'https://t.me/botfather';

/**
 * Configuration for {@link TelegramProvider}.
 *
 * Telegram has no OAuth and no org-level parent credential: a BotFather bot
 * token *is* the credential (one token per bot). Multi-tenancy is therefore a
 * store of bot tokens — see {@link TelegramInstallation}.
 */
export interface TelegramProviderConfig {
  /**
   * Public HTTPS base URL used to register per-bot webhooks (`setWebhook`).
   * May be omitted and auto-detected from the Mastra server config, or set later.
   */
  baseUrl?: string;
  /**
   * Persistence for bot installations. Defaults to Mastra's channels storage
   * when the provider is attached to a Mastra instance with storage, and falls
   * back to an in-memory store otherwise (dev/test — not persisted across restarts).
   */
  storage?: ChannelsStorage;
  /**
   * Override the Telegram Bot API origin (e.g. a self-hosted Bot API server or
   * a test mock).
   *
   * @default 'https://api.telegram.org'
   */
  apiBaseUrl?: string;
  /**
   * Passphrase for encrypting `botToken`/`secretToken` at rest (AES-256-GCM).
   * Defaults to the `MASTRA_ENCRYPTION_KEY` env var. When unset, secrets are
   * stored in plaintext (fine for the in-memory dev store; set a key for any
   * persistent backend).
   */
  encryptionKey?: string;
  /**
   * Receive transport. Setting a webhook and long-polling are mutually
   * exclusive; the provider manages the switch per bot.
   *
   * @default 'auto'
   */
  mode?: TelegramMode;
  /**
   * Update types to request in `setWebhook`. Defaults to
   * {@link DEFAULT_ALLOWED_UPDATES}.
   */
  allowedUpdates?: string[];
  /**
   * Long-polling tuning forwarded to the adapter's `getUpdates` loop when running
   * in polling mode (`timeout`, `limit`, `allowedUpdates`, `retryDelayMs`, …).
   * Ignored in webhook mode.
   */
  longPolling?: TelegramAdapterConfig['longPolling'];
  /**
   * Keep the serverless invocation alive while the agent stream runs after the
   * webhook returns 200 (Vercel/AWS Lambda). Cloudflare/Netlify resolve this
   * automatically. See `ChannelConfig.waitUntil`.
   */
  waitUntil?: WaitUntilFn;
  /**
   * Default commands registered via `setMyCommands` for every connected agent
   * (a per-agent list can override via {@link TelegramConnectOptions.commands}).
   * Defaults to the conventional `/start` `/help` `/settings` seed.
   */
  commands?: TelegramCommand[];
  /**
   * Command scope passed to `setMyCommands` (e.g. `{ type: 'all_private_chats' }`).
   * Omitted → Telegram's default scope.
   * @see https://core.telegram.org/bots/api#botcommandscope
   */
  commandScope?: Record<string, unknown>;
  /**
   * Stream agent text to Telegram as it generates, via the adapter's
   * post-and-edit (`editMessageText`) loop. Telegram has no native token
   * streaming, so this chunk-edits the reply (4096-char cap handled by the
   * adapter).
   *
   * @default true
   */
  streaming?: StreamingConfig;
  /**
   * Keep a typing indicator alive during generation (`sendChatAction`, re-sent
   * as it auto-clears). Set `false` to disable.
   *
   * @default true
   */
  typingStatus?: boolean;

  // ---------------------------------------------------------------------------
  // AgentChannels passthrough — a curated subset of `ChannelConfig` /
  // `ChannelAdapterConfig` forwarded to every agent connected via this
  // provider, mirroring `@mastra/slack`. All optional; defaults apply when unset.
  // ---------------------------------------------------------------------------

  /**
   * Override built-in event handlers (`onDirectMessage`, `onMention`,
   * `onSubscribedMessage`). Forwarded to `AgentChannels`.
   */
  handlers?: ChannelHandlers;
  /** Which media types to send inline to the model. See `ChannelConfig.inlineMedia`. */
  inlineMedia?: ChannelConfig['inlineMedia'];
  /** Promote URLs in message text to file parts. See `ChannelConfig.inlineLinks`. */
  inlineLinks?: ChannelConfig['inlineLinks'];
  /** State adapter for deduplication, locking, and subscriptions. See `ChannelConfig.state`. */
  state?: ChannelConfig['state'];
  /** Fetch recent thread messages when the agent joins mid-conversation. See `ChannelConfig.threadContext`. */
  threadContext?: ChannelConfig['threadContext'];
  /** Additional options passed directly to the Chat SDK. See `ChannelConfig.chatOptions`. */
  chatOptions?: ChannelConfig['chatOptions'];
  /** Resolve the memory `resourceId` before a channel thread is created. See `ChannelConfig.resolveResourceId`. */
  resolveResourceId?: ChannelConfig['resolveResourceId'];
  /**
   * Resolve `waitUntil` from the request's Hono `Context` (serverless runtimes
   * whose `waitUntil` derives from the request). See `ChannelConfig.resolveWaitUntil`.
   */
  resolveWaitUntil?: ChannelConfig['resolveWaitUntil'];
  /** CORS configuration for the generated Telegram webhook route. */
  cors?: ChannelAdapterConfig['cors'];
  /** Override how errors are rendered in Telegram messages. See `ChannelAdapterConfig.formatError`. */
  formatError?: ChannelAdapterConfig['formatError'];
  /**
   * How tool calls are rendered in the reply. Telegram has no Block Kit, so
   * `'cards'`/`'grouped'`/`'timeline'` degrade to plain fallback text — this
   * defaults to `'text'` (unlike Slack's `'grouped'`). See `ChannelAdapterConfig.toolDisplay`.
   *
   * @default 'text'
   */
  toolDisplay?: ChannelAdapterConfig['toolDisplay'];
  /**
   * Whether to expose channel reaction tools (`add_reaction`/`remove_reaction`)
   * to the agent. Set `false` for models without function calling. See `ChannelConfig.tools`.
   *
   * @default true
   */
  tools?: ChannelConfig['tools'];
  /** Logger forwarded to the underlying `TelegramAdapter` for internal error reporting. */
  logger?: TelegramAdapterConfig['logger'];
  /** Called after an agent successfully connects a bot and the installation is persisted. */
  onInstall?: (installation: TelegramInstallation) => void | Promise<void>;
}

/** Options accepted by {@link TelegramProvider.connect}. */
export interface TelegramConnectOptions {
  /**
   * A BotFather bot token. When supplied it is validated via `getMe` and the
   * installation becomes active immediately (`{ type: 'immediate' }`). Omit it
   * to receive a BotFather deep link instead (`{ type: 'deep_link' }`).
   */
  botToken?: string;
  /** Display name for the bot. Defaults to the bot's `@username` from `getMe`. */
  name?: string;
  /**
   * Commands to register via `setMyCommands` for this agent. Overrides
   * {@link TelegramProviderConfig.commands}. Defaults to the `/start` `/help`
   * `/settings` seed when neither is set.
   */
  commands?: TelegramCommand[];
}

/**
 * A registered Telegram bot bound to a single agent (one bot = one agent).
 * Persisted through {@link TelegramInstallStore}.
 */
export interface TelegramInstallation {
  /** Stable installation id. */
  id: string;
  /** The agent this bot is bound to. */
  agentId: string;
  /**
   * Opaque id embedded in the webhook route path (`/telegram/events/:webhookId`).
   * Never the secret — the secret travels only in the request header.
   */
  webhookId: string;
  /** Whether a bot token has been ingested and validated. */
  status: 'active' | 'pending';
  /** BotFather bot token — the full credential. Present once ingested. */
  botToken?: string;
  /**
   * Per-bot webhook shared secret, echoed by Telegram as the
   * `X-Telegram-Bot-Api-Secret-Token` header on every inbound POST.
   */
  secretToken?: string;
  /** The bot's `@username`, resolved from `getMe`. */
  username?: string;
  /** The webhook URL registered with `setWebhook` (M1 — issue `mastra-telegram-i2g.3`). */
  webhookUrl?: string;
  /** Normalized commands registered via `setMyCommands`. */
  commands?: BotCommand[];
  /** When the installation was created. */
  installedAt: Date;
}
