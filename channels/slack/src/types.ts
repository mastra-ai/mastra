import type {
  ChannelAdapterCardsConfig,
  ChannelAdapterConfig,
  ChannelConfig,
  ChannelHandlers,
} from '@mastra/core/channels';
import type { ChannelsStorage } from '@mastra/core/storage';
import type { SlackAdapterConfig } from '@chat-adapter/slack';
import type { SlackInstallation } from './schemas';

/**
 * Per-adapter overrides applied to the Slack entry inside
 * `AgentChannels.adapters`. Field types are borrowed from
 * `ChannelAdapterConfig` so the runtime contract stays in sync, but the shape
 * and defaults are owned by Slack.
 */
export interface SlackAdapterChannelConfig {
  /** CORS configuration for the Slack webhook route. */
  cors?: ChannelAdapterConfig['cors'];

  /** Slack gateway listener toggle. Currently a no-op for Slack (HTTP-only). */
  gateway?: ChannelAdapterConfig['gateway'];

  /**
   * Use rich card formatting for tool calls, approvals, and results.
   * Set to `false` to fall back to plain text.
   *
   * Only applies when `toolDisplay` is `'cards'` (the default).
   *
   * @default true
   */
  cards?: ChannelAdapterCardsConfig['cards'];

  /**
   * Override how tool calls are rendered in Slack messages.
   *
   * Only applies when `toolDisplay` is `'cards'` (the default).
   */
  formatToolCall?: ChannelAdapterCardsConfig['formatToolCall'];

  /** Override how errors are rendered in Slack messages. */
  formatError?: ChannelAdapterConfig['formatError'];

  /**
   * Stream agent text deltas to Slack as the agent generates them, instead of
   * buffering and posting once per step. Slack supports native message streaming,
   * so this defaults to `true`.
   *
   * - `true` (default) — stream with default options.
   * - `false` — buffer text and post once per `step-finish`.
   * - `{ updateIntervalMs }` — stream with a custom post-and-edit interval.
   *
   * @default true
   */
  streaming?: boolean | { updateIntervalMs?: number };

  /**
   * How tool calls are rendered in Slack.
   *
   * - `'cards'` (default) — per-tool "Running…" → "Result" cards.
   * - `'timeline'` — render tools as inline task entries beside the streaming
   *   text (requires `streaming: true`, which is the Slack default).
   * - `'grouped'` — render tools together inside a single plan block.
   * - `'hidden'` — execute tools silently; only the typing status indicates work.
   *
   * Approve/deny prompts (`requireApproval`) always render as a separate card,
   * regardless of mode, because inline task entries can't carry interactive
   * buttons.
   *
   * @default 'cards'
   */
  toolDisplay?: ChannelAdapterConfig['toolDisplay'];

  /**
   * Render an LLM-driven plan block in Slack via auto-injected
   * `task_write` / `task_update` / `task_complete` / `task_check` /
   * `complete_plan` tools. Non-plan tool calls fold inline under the active
   * task (`'inline'`, the default) or execute silently (`'hidden'`).
   *
   * Mutually exclusive with `toolDisplay` / `cards` / `formatToolCall`.
   * Requires `streaming: true` (Slack default).
   */
  plan?: ChannelAdapterConfig['plan'];
}

// =============================================================================
// Global Configuration (Mastra-level)
// =============================================================================

/**
 * Configuration for SlackProvider at the Mastra level.
 *
 * Combines Slack-specific fields (tokens, baseUrl, OAuth callbacks),
 * Slack-adapter overrides (`cards`, `formatToolCall`, `streaming`, …), and a
 * curated subset of `AgentChannels` options forwarded to every connected agent
 * (`handlers`, `inlineMedia`, `inlineLinks`, …).
 */
export interface SlackProviderConfig {
  // ---------------------------------------------------------------------------
  // Slack-adapter overrides
  // (applied to the Slack entry inside `AgentChannels.adapters`)
  // ---------------------------------------------------------------------------

  /** CORS configuration for the Slack webhook route. */
  cors?: ChannelAdapterConfig['cors'];

  /** Slack gateway listener toggle. Currently a no-op for Slack (HTTP-only). */
  gateway?: ChannelAdapterConfig['gateway'];

  /**
   * Use rich card formatting for tool calls, approvals, and results.
   * Set to `false` to fall back to plain text.
   *
   * Only applies when `toolDisplay` is `'cards'` (the default).
   *
   * @default true
   */
  cards?: ChannelAdapterCardsConfig['cards'];

  /**
   * Override how tool calls are rendered in Slack messages.
   *
   * Only applies when `toolDisplay` is `'cards'` (the default).
   */
  formatToolCall?: ChannelAdapterCardsConfig['formatToolCall'];

  /** Override how errors are rendered in Slack messages. */
  formatError?: ChannelAdapterConfig['formatError'];

  /**
   * Stream agent text deltas to Slack as the agent generates them, instead of
   * buffering and posting once per step. Slack supports native message streaming,
   * so this defaults to `true`.
   *
   * - `true` (default) — stream with default options.
   * - `false` — buffer text and post once per `step-finish`.
   * - `{ updateIntervalMs }` — stream with a custom post-and-edit interval.
   *
   * @default true
   */
  streaming?: boolean | { updateIntervalMs?: number };

  /**
   * How tool calls are rendered in Slack.
   *
   * - `'cards'` (default) — per-tool "Running…" → "Result" cards.
   * - `'timeline'` — render tools as inline task entries beside the streaming
   *   text (requires `streaming: true`, which is the Slack default).
   * - `'grouped'` — render tools together inside a single plan block.
   * - `'hidden'` — execute tools silently; only the typing status indicates work.
   *
   * Approve/deny prompts (`requireApproval`) always render as a separate card,
   * regardless of mode, because inline task entries can't carry interactive
   * buttons.
   *
   * @default 'cards'
   */
  toolDisplay?: ChannelAdapterConfig['toolDisplay'];

  /**
   * Render an LLM-driven plan block in Slack via auto-injected
   * `task_write` / `task_update` / `task_complete` / `task_check` /
   * `complete_plan` tools. Non-plan tool calls fold inline under the active
   * task (`'inline'`, the default) or execute silently (`'hidden'`).
   *
   * Mutually exclusive with `toolDisplay` / `cards` / `formatToolCall`.
   * Requires `streaming: true` (Slack default).
   */
  plan?: ChannelAdapterConfig['plan'];

  // ---------------------------------------------------------------------------
  // Forwarded AgentChannels-level options
  // ---------------------------------------------------------------------------

  /**
   * Override built-in event handlers (e.g. `onDirectMessage`, `onMention`).
   * Forwarded to `AgentChannels` for every agent connected via this provider.
   *
   * @example
   * ```ts
   * handlers: {
   *   onDirectMessage: async (thread, message, defaultHandler) => {
   *     console.log('DM:', message.text);
   *     await defaultHandler(thread, message);
   *   },
   * }
   * ```
   */
  handlers?: ChannelHandlers;

  /** Which media types to send inline to the model. See `ChannelConfig.inlineMedia`. */
  inlineMedia?: ChannelConfig['inlineMedia'];

  /** Promote URLs in message text to file parts. See `ChannelConfig.inlineLinks`. */
  inlineLinks?: ChannelConfig['inlineLinks'];

  /** State adapter for deduplication, locking, and subscriptions. */
  state?: ChannelConfig['state'];

  /** Fetch recent thread messages from Slack when the agent joins mid-conversation. */
  threadContext?: ChannelConfig['threadContext'];

  /** Whether to include channel tools (add_reaction, remove_reaction). */
  tools?: ChannelConfig['tools'];

  /** Additional options passed directly to the Chat SDK. */
  chatOptions?: ChannelConfig['chatOptions'];

  // ---------------------------------------------------------------------------
  // Slack-specific
  // ---------------------------------------------------------------------------

  /**
   * Logger forwarded to the underlying `SlackAdapter` for internal error
   * reporting. Defaults to the adapter's `ConsoleLogger`.
   */
  logger?: SlackAdapterConfig['logger'];

  /**
   * Slack App Configuration access token for programmatic app creation.
   * Generate at: https://api.slack.com/apps > "Your App Configuration Tokens"
   *
   * Optional — will rotate to get a fresh token on startup using `refreshToken`.
   */
  token?: string;

  /**
   * Slack App Configuration refresh token.
   * Used for automatic token rotation. Single-use; each rotation returns a new pair.
   *
   * Can be provided here or later via `configure({ refreshToken })`.
   * If omitted, the provider starts unconfigured and cannot create apps until
   * `configure()` is called or tokens are loaded from storage.
   */
  refreshToken?: string;

  /**
   * Base URL for webhook callbacks.
   * Required when calling connect() to create apps.
   * Can also be set later via setBaseUrl() or auto-detected from server config.
   *
   * For local development, use a tunnel like cloudflared:
   * ```
   * baseUrl: 'https://abc123.trycloudflare.com'
   * ```
   */
  baseUrl?: string;

  /**
   * Custom storage for installations.
   * Defaults to using Mastra's ChannelsStorage from the global storage.
   * Throws if no persistent storage is available.
   */
  storage?: ChannelsStorage;

  /**
   * Path to redirect to after OAuth completion.
   * Defaults to "/" (homepage)
   */
  redirectPath?: string;

  /**
   * Called when a workspace successfully installs the app.
   */
  onInstall?: (installation: SlackInstallation) => Promise<void>;

  /**
   * Encryption key for sensitive data (clientSecret, signingSecret, botToken).
   * If not provided, secrets are stored in plaintext (not recommended for production).
   *
   * Use a 32+ character random string. Can be set via MASTRA_ENCRYPTION_KEY env var.
   */
  encryptionKey?: string;

  /**
   * Per-adapter overrides applied to the Slack adapter entry inside
   * `AgentChannels.adapters` — for example `cards`, `formatToolCall`,
   * `formatError`.
   *
   * @deprecated Pass these fields at the top level of `SlackProviderConfig`
   * instead. Top-level fields win; values from `adapterConfig` are merged in
   * as a fallback for backwards compatibility.
   */
  adapterConfig?: SlackAdapterChannelConfig;
}

// =============================================================================
// Agent Configuration (serializable)
// =============================================================================

/**
 * Options for connecting an agent to Slack via `slack.connect(agentId, options)`.
 * This is serializable and can be stored in the database for stored agents.
 */
export interface SlackConnectOptions {
  /**
   * Display name for the Slack bot.
   * Defaults to agent name, then agent ID.
   */
  name?: string;

  /**
   * Bot description shown in Slack.
   * Defaults to "{name} - Powered by Mastra".
   */
  description?: string;

  /**
   * URL to an image for the app icon.
   * Should be a square PNG/JPG, minimum 512x512px.
   * The image will be automatically downloaded and uploaded to Slack.
   *
   * @example
   * iconUrl: 'https://example.com/my-bot-avatar.png'
   */
  iconUrl?: string;

  /**
   * Slash commands this agent supports.
   *
   * Simple form - command triggers agent.generate() with the input text:
   * ```ts
   * slashCommands: ['/ask']
   * ```
   *
   * With custom prompt template:
   * ```ts
   * slashCommands: [
   *   {
   *     command: '/summarize',
   *     description: 'Summarize a URL',
   *     prompt: 'Fetch and summarize: {{text}}'
   *   }
   * ]
   * ```
   *
   * Use {{text}} as placeholder for user input.
   */
  slashCommands?: (string | SlashCommandConfig)[];

  /**
   * Customize the Slack app manifest before it's sent to the Manifest API.
   *
   * Receives the default manifest (built from name, description, slashCommands,
   * and internal URLs) and returns the final manifest to use.
   *
   * Use this for any advanced Slack configuration: custom scopes, events,
   * interactivity settings, etc.
   *
   * @example
   * // Add extra scopes
   * manifest: (m) => ({
   *   ...m,
   *   oauth_config: {
   *     ...m.oauth_config,
   *     scopes: { bot: [...(m.oauth_config?.scopes?.bot ?? []), 'files:write'] }
   *   }
   * })
   *
   * @example
   * // Subscribe to additional events
   * manifest: (m) => ({
   *   ...m,
   *   settings: {
   *     ...m.settings,
   *     event_subscriptions: {
   *       ...m.settings?.event_subscriptions,
   *       bot_events: [...(m.settings?.event_subscriptions?.bot_events ?? []), 'reaction_added']
   *     }
   *   }
   * })
   */
  manifest?: (defaults: SlackAppManifest) => SlackAppManifest;

  /**
   * URL to redirect to after successful OAuth completion.
   * Typically set by the Studio UI to return to the agent page.
   * Defaults to `SlackProviderConfig.redirectPath` or `/`.
   */
  redirectUrl?: string;
}

/**
 * Slash command configuration (fully serializable).
 *
 * A slash command is essentially a prompt template that gets filled with user input
 * and sent to the agent. Like Claude Code's slash commands.
 */
export interface SlashCommandConfig {
  /** Command name including slash (e.g., "/ask") */
  command: string;

  /** Short description shown in Slack's command picker */
  description?: string;

  /** Usage hint shown in Slack (e.g., "[question]") */
  usageHint?: string;

  /**
   * Prompt template sent to the agent.
   * Use {{text}} as placeholder for user input.
   *
   * Defaults to "{{text}}" (just passes input directly).
   *
   * @example
   * prompt: 'Summarize the following URL: {{text}}'
   * prompt: 'Write {{text}} in TypeScript'
   */
  prompt?: string;
}

// =============================================================================
// Messages
// =============================================================================

export interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  response_type?: 'in_channel' | 'ephemeral';
  replace_original?: boolean;
  delete_original?: boolean;
}

export interface SlackBlock {
  type: string;
  [key: string]: unknown;
}

// =============================================================================
// Manifest API Types
// =============================================================================

/**
 * Slack App Manifest for programmatic app creation.
 * @see https://api.slack.com/reference/manifests
 */
export interface SlackAppManifest {
  display_information: {
    name: string;
    description?: string;
    background_color?: string;
    long_description?: string;
  };
  features?: {
    app_home?: {
      home_tab_enabled?: boolean;
      messages_tab_enabled?: boolean;
      messages_tab_read_only_enabled?: boolean;
    };
    bot_user?: {
      display_name: string;
      always_online?: boolean;
    };
    slash_commands?: Array<{
      command: string;
      description: string;
      url: string;
      usage_hint?: string;
    }>;
    assistant_view?: {
      assistant_description: string;
      suggested_prompts?: Array<{
        title: string;
        message: string;
      }>;
    };
  };
  oauth_config?: {
    redirect_urls?: string[];
    scopes?: {
      bot?: string[];
      user?: string[];
    };
  };
  settings?: {
    event_subscriptions?: {
      request_url?: string;
      bot_events?: string[];
      user_events?: string[];
    };
    interactivity?: {
      is_enabled?: boolean;
      request_url?: string;
      message_menu_options_url?: string;
    };
    org_deploy_enabled?: boolean;
    socket_mode_enabled?: boolean;
    token_rotation_enabled?: boolean;
  };
}

/**
 * Credentials returned when creating a Slack app via manifest API.
 */
export interface SlackAppCredentials {
  appId: string;
  clientId: string;
  clientSecret: string;
  signingSecret: string;
  oauthAuthorizeUrl?: string;
}

// =============================================================================
// Internal Types
// =============================================================================
