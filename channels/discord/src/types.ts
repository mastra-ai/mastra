import type {
  ChannelAdapterConfig,
  ChannelConfig,
  ChannelHandlers,
  StreamingConfig,
  WaitUntilFn,
} from '@mastra/core/channels';
import type { ChannelsStorage } from '@mastra/core/storage';
import type { DiscordAdapterConfig } from '@chat-adapter/discord';

/** Default Discord REST API origin (versioned base is appended by the client). */
export const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';

/** Base for the OAuth2 authorize (bot-invite) URL. */
export const DISCORD_OAUTH_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';

/**
 * Named Discord permission bits (a subset). Discord permissions are a 53+ bit
 * field, so they are represented as `bigint` and serialized to a decimal string
 * in the invite URL.
 *
 * @see https://discord.com/developers/docs/topics/permissions#permissions-bitwise-permission-flags
 */
export const DISCORD_PERMISSIONS = {
  ADD_REACTIONS: 1n << 6n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
} as const;

/**
 * Default permissions requested in the bot-invite URL: enough for a chat agent
 * to read and reply (in channels and threads), post embeds/files, add reactions,
 * and see recent history. Kept intentionally minimal — no moderation or manage
 * permissions. Callers can override via {@link DiscordConnectOptions.permissions}
 * or {@link DiscordProviderConfig.permissions}.
 */
export const DEFAULT_INVITE_PERMISSIONS: bigint =
  DISCORD_PERMISSIONS.VIEW_CHANNEL |
  DISCORD_PERMISSIONS.SEND_MESSAGES |
  DISCORD_PERMISSIONS.SEND_MESSAGES_IN_THREADS |
  DISCORD_PERMISSIONS.EMBED_LINKS |
  DISCORD_PERMISSIONS.ATTACH_FILES |
  DISCORD_PERMISSIONS.READ_MESSAGE_HISTORY |
  DISCORD_PERMISSIONS.ADD_REACTIONS |
  DISCORD_PERMISSIONS.USE_APPLICATION_COMMANDS;

/** OAuth2 scopes requested by the bot-invite URL. */
export const DEFAULT_INVITE_SCOPES = ['bot', 'applications.commands'] as const;

/**
 * A Discord application command as it goes over the wire (bulk-overwrite
 * registration). Only the `CHAT_INPUT` (slash) shape is modeled here.
 * @see https://discord.com/developers/docs/interactions/application-commands
 */
export interface DiscordCommand {
  /** 1-32 chars, lowercase `[a-z0-9_-]` (Discord also allows a leading `-`/`_`). */
  name: string;
  /** 1-100 chars. */
  description: string;
}

/** Command input accepted by the provider — a bare name or `{ name, description }`. */
export type DiscordCommandInput = string | { name: string; description?: string };

/**
 * App-level credentials for a single Discord application. Discord has **no
 * programmatic app creation** — these come from the Developer Portal and are
 * stored **once** (one app, many guilds). `botToken` is the only secret;
 * `publicKey` and `applicationId` are public.
 */
export interface DiscordAppConfig {
  /** Bot token (`Authorization: Bot <token>`) — the control-plane credential. Secret. */
  botToken: string;
  /** Ed25519 public key used by the adapter to verify interaction signatures. */
  publicKey: string;
  /** The application (client) id — used as `client_id` in the invite URL. */
  applicationId: string;
}

/**
 * Configuration for {@link DiscordProvider}.
 *
 * Discord is **one app, many guilds**: a single application's credentials are
 * reused across every guild the bot is invited to. There is no per-install
 * token — "installing" is a bot invite (an OAuth2 authorize URL), and tenancy
 * is keyed by `guildId` per interaction.
 */
export interface DiscordProviderConfig {
  /**
   * App credentials (bot token / public key / application id). May be omitted
   * here and provided via the `DISCORD_BOT_TOKEN` / `DISCORD_PUBLIC_KEY` /
   * `DISCORD_APPLICATION_ID` env vars, or later via {@link DiscordProvider.configure}.
   * Whichever source resolves first is persisted **once** to channels storage.
   */
  app?: Partial<DiscordAppConfig>;
  /**
   * Public HTTPS base URL for the interactions endpoint (the URL set once in the
   * Developer Portal). May be omitted and auto-detected from the Mastra server.
   */
  baseUrl?: string;
  /**
   * Persistence for the app config + per-agent installs. Defaults to Mastra's
   * channels storage when attached to a Mastra instance with storage, and falls
   * back to an in-memory store otherwise (dev/test — not persisted across restarts).
   */
  storage?: ChannelsStorage;
  /**
   * Override the Discord REST origin (e.g. a test mock). Defaults to
   * {@link DISCORD_API_BASE_URL}.
   */
  apiBaseUrl?: string;
  /**
   * Passphrase for encrypting the stored `botToken` at rest (AES-256-GCM).
   * Defaults to the `MASTRA_ENCRYPTION_KEY` env var. When unset, the token is
   * stored in plaintext (fine for the in-memory dev store; set a key for any
   * persistent backend).
   */
  encryptionKey?: string;
  /**
   * Permissions bitfield requested in the invite URL. Overrides
   * {@link DEFAULT_INVITE_PERMISSIONS}. Accepts a `bigint` or a decimal string.
   */
  permissions?: bigint | string;
  /**
   * Default slash commands registered for every connected agent (a per-agent
   * list can override via {@link DiscordConnectOptions.commands}). Defaults to
   * the conventional `/help` seed.
   */
  commands?: DiscordCommandInput[];
  /**
   * Where slash commands are registered:
   * - `'guild'` (default) — per-guild (`PUT …/guilds/{id}/commands`), updates
   *   instantly; registered on first-seen guild, keyed by a per-guild hash.
   * - `'global'` — app-wide (`PUT …/commands`), eventually consistent; registered
   *   once regardless of guild.
   *
   * @default 'guild'
   */
  commandScope?: 'guild' | 'global';
  /**
   * Keep the serverless invocation alive while the agent stream runs after the
   * interaction is acked (Vercel/AWS Lambda). See `ChannelConfig.waitUntil`.
   */
  waitUntil?: WaitUntilFn;
  /**
   * Start the Gateway WebSocket (core-owned) so the bot receives DMs, @mentions,
   * and reactions in addition to slash commands. Set `false` for interactions-
   * only serverless deployments. Forwarded to the adapter entry as `gateway`.
   *
   * @default true
   */
  gateway?: boolean;
  /**
   * Role IDs (in addition to direct user mentions) that trigger mention
   * handlers. Forwarded to the adapter (`DISCORD_MENTION_ROLE_IDS` env fallback).
   */
  mentionRoleIds?: string[];
  /**
   * Return interaction response flags (e.g. ephemeral, flag 64) for the initial
   * deferred slash-command response. Flags are locked at defer time, so this
   * fires on the deferred ACK, not the followup. Forwarded to the adapter.
   */
  interactionFlags?: DiscordAdapterConfig['interactionFlags'];
  /** Logger forwarded to the underlying `DiscordAdapter` for internal error reporting. */
  logger?: DiscordAdapterConfig['logger'];
  /**
   * Stream agent text to Discord as it generates, via the adapter's post-and-edit
   * (`editMessage`) loop. Discord has no native token streaming, so this
   * chunk-edits the interaction followup (throttle via `updateIntervalMs`).
   *
   * @default true
   */
  streaming?: StreamingConfig;
  /**
   * Keep a typing indicator alive during generation. Set `false` to disable.
   *
   * @default true
   */
  typingStatus?: boolean;

  // ---------------------------------------------------------------------------
  // AgentChannels passthrough — a curated subset of `ChannelConfig` /
  // `ChannelAdapterConfig` forwarded to every agent connected via this provider,
  // mirroring `@mastra/slack` / `@mastra/telegram`. All optional.
  // ---------------------------------------------------------------------------

  /** Override built-in event handlers. Forwarded to `AgentChannels`. */
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
  /** Resolve `waitUntil` from the request's Hono `Context`. See `ChannelConfig.resolveWaitUntil`. */
  resolveWaitUntil?: ChannelConfig['resolveWaitUntil'];
  /** CORS configuration for the generated interactions route. */
  cors?: ChannelAdapterConfig['cors'];
  /** Override how errors are rendered in Discord messages. See `ChannelAdapterConfig.formatError`. */
  formatError?: ChannelAdapterConfig['formatError'];
  /**
   * How tool calls are rendered in the reply. Discord has native embeds +
   * action-row buttons, so this defaults to `'cards'` (unlike Telegram's
   * `'text'`). See `ChannelAdapterConfig.toolDisplay`.
   *
   * @default 'cards'
   */
  toolDisplay?: ChannelAdapterConfig['toolDisplay'];
  /**
   * Whether to expose channel reaction tools (`add_reaction`/`remove_reaction`)
   * to the agent. Set `false` for models without function calling. See `ChannelConfig.tools`.
   *
   * @default true
   */
  tools?: ChannelConfig['tools'];
  /** Called after an agent successfully connects and the installation is persisted. */
  onInstall?: (installation: DiscordInstallation) => void | Promise<void>;
}

/** Options accepted by {@link DiscordProvider.connect}. */
export interface DiscordConnectOptions {
  /**
   * The guild to install into. When the bot is **already** a member of this
   * guild, connect binds immediately (`{ type: 'immediate' }`) and registers its
   * commands; otherwise the operator is sent the invite URL and the guild is
   * confirmed lazily off the first inbound interaction's authoritative `guild_id`.
   */
  guildId?: string;
  /** Display name for this installation. Defaults to the application's name. */
  name?: string;
  /**
   * Slash commands to register for this agent. Overrides
   * {@link DiscordProviderConfig.commands}. Defaults to the `/help` seed.
   */
  commands?: DiscordCommandInput[];
  /** Permissions bitfield override for this invite (bigint or decimal string). */
  permissions?: bigint | string;
}

/**
 * A per-agent Discord installation. Unlike Telegram (one token = one row),
 * Discord installs are keyed by agent and track the set of `guildIds` the bot is
 * live in. **No secrets live here** — the bot token lives once in the app config
 * ({@link DiscordAppConfig}); this row only holds routing + per-guild command
 * versions. Persisted through {@link DiscordInstallStore}.
 */
export interface DiscordInstallation {
  /** Stable installation id. */
  id: string;
  /** The agent this installation is bound to. */
  agentId: string;
  /**
   * Opaque id embedded in the interactions route path
   * (`/discord/events/:webhookId`). Used to resolve the install on inbound POSTs.
   */
  webhookId: string;
  /**
   * `pending` — invite issued, no guild confirmed yet.
   * `active` — the bot is live in at least one guild (or bound to a known guild).
   */
  status: 'active' | 'pending';
  /** Guilds this agent's bot is confirmed live in (tenancy keys). */
  guildIds: string[];
  /** Display name (application name or an operator-supplied override). */
  displayName?: string;
  /** Normalized slash commands to register for this agent (resolved at connect). */
  commands?: DiscordCommand[];
  /**
   * Registered-command version hash, keyed by `guildId` (guild scope) or the
   * literal `'global'` (global scope). Used to skip re-`PUT`ting commands when
   * unchanged (200/day/guild rate limit).
   */
  commandVersions?: Record<string, string>;
  /** When the installation was created. */
  installedAt: Date;
}
