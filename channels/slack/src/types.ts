import type {
  ChannelAdapterConfig,
  ChannelConfig,
  ChannelHandlers,
  StaticToolDisplay,
  StreamingConfig,
  ToolDisplay,
  WaitUntilFn,
  WaitUntilResolver,
} from '@mastra/core/channels';
import type { ChannelsStorage } from '@mastra/core/storage';
import type { SlackAdapterConfig } from '@chat-adapter/slack';
import type { SlackInstallation } from './schemas';

/**
 * Per-adapter overrides shared across both streaming and static branches
 * of {@link SlackAdapterChannelConfig}.
 */
interface SlackAdapterChannelConfigBase {
  /** CORS configuration for the Slack webhook route. */
  cors?: ChannelAdapterConfig['cors'];

  /** Slack gateway listener toggle. Currently a no-op for Slack (HTTP-only). */
  gateway?: ChannelAdapterConfig['gateway'];

  /** Override how errors are rendered in Slack messages. */
  formatError?: ChannelAdapterConfig['formatError'];

  /**
   * Control Slack typing indicators and Assistant-mode status text.
   *
   * - `true` — use built-in defaults: `"is typing…"` while generating text,
   *   `"is calling {toolName}…"` while a tool runs, `"is waiting for
   *   approval…"` while a tool is suspended. Slack auto-prepends the app
   *   name so the user sees `"<App Name> is typing…"`.
   * - `false` — never call `startTyping`. Useful when a live streaming
   *   widget (e.g. `toolDisplay: 'grouped'`) already conveys progress.
   * - `(chunk, ctx) => string | false | null | undefined | void` — set
   *   custom copy per chunk. Return a string to override the status,
   *   or `false`/`null`/`undefined` to leave it unchanged. Compose with
   *   `defaultTypingStatus` (exported from `@mastra/core/channels`) to
   *   fall back to defaults for chunks you don't handle.
   *
   * @default true
   */
  typingStatus?: ChannelAdapterConfig['typingStatus'];
}

/**
 * Slack adapter overrides with `streaming` enabled (the default). Allows any
 * `toolDisplay` mode, including the streaming-only `'timeline'` / `'grouped'`.
 */
export interface SlackAdapterStreamingConfig extends SlackAdapterChannelConfigBase {
  /**
   * Stream agent text deltas to Slack as the agent generates them.
   *
   * - `true` (default) — stream with default options.
   * - `{ updateIntervalMs }` — stream with a custom post-and-edit interval.
   *
   * @default true
   */
  streaming?: Exclude<StreamingConfig, false>;

  /**
   * How tool calls are rendered in Slack.
   *
   * - `'cards'` — per-tool "Running…" → "Result" Block Kit cards (the streaming
   *   session is closed/posted/reopened around each card).
   * - `'text'` — per-tool plain-text messages (no Block Kit).
   * - `'timeline'` — render tools as inline task entries beside the streaming text.
   * - `'grouped'` (default in Slack) — collapse all tools into a single
   *   "Thinking Steps" plan widget. Renders well in Slack's AI Assistant UI.
   * - `'hidden'` — execute tools silently; only the typing status indicates work.
   * - Function form ({@link ToolDisplay}): a `ToolDisplayFn` for full control.
   *
   * Approve/deny prompts (`requireApproval`) always render as a separate card.
   *
   * @default 'grouped'
   */
  toolDisplay?: ToolDisplay;
}

/**
 * Slack adapter overrides with `streaming: false`. Restricts `toolDisplay`
 * to modes that post discrete messages (no `StreamingPlan` available).
 */
export interface SlackAdapterStaticConfig extends SlackAdapterChannelConfigBase {
  /**
   * Disable Slack's native message streaming and buffer text until `step-finish`.
   * `'timeline'` and `'grouped'` modes require streaming, so they're not
   * available on this branch.
   */
  streaming: false;

  /**
   * How tool calls are rendered in Slack (static modes only).
   *
   * - `'cards'` (default) — per-tool "Running…" → "Result" Block Kit cards.
   * - `'text'` — per-tool plain-text messages (no Block Kit).
   * - `'hidden'` — execute tools silently; only the typing status indicates work.
   * - Function form ({@link ToolDisplay}): a `ToolDisplayFn` for full control.
   *
   * @default 'cards'
   */
  toolDisplay?: StaticToolDisplay;
}

/**
 * Per-adapter overrides applied to the Slack entry inside
 * `AgentChannels.adapters`. `streaming` discriminates which `toolDisplay`
 * modes are available — `'timeline'` / `'grouped'` need streaming on.
 */
export type SlackAdapterChannelConfig = SlackAdapterStreamingConfig | SlackAdapterStaticConfig;

// =============================================================================
// Global Configuration (Mastra-level)
// =============================================================================

/**
 * Slack provider fields that are independent of the `streaming` /
 * `toolDisplay` discrimination — shared by both branches of
 * {@link SlackProviderConfig}.
 */
interface SlackProviderConfigBase extends SlackAdapterChannelConfigBase {
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
   * Resolver that returns a `waitUntil` for the current Slack webhook request.
   *
   * Required on serverless runtimes where Hono can't bridge the platform's
   * `ExecutionContext` automatically (Vercel, AWS Lambda). Without `waitUntil`, the
   * runtime freezes the invocation as soon as the 200 ack returns, killing the
   * agent run mid-flight and leaving the user with no Slack reply.
   *
   * Pass the bare `waitUntil(promise)` function from your platform's SDK. If your
   * runtime requires the Hono `Context` to derive `waitUntil`, use
   * {@link resolveWaitUntil} instead.
   *
   * Cloudflare Workers and Netlify users typically don't need this — Mastra's
   * default helper already reads `c.executionCtx.waitUntil` and
   * `c.env.context.waitUntil`.
   *
   * @example
   * ```ts
   * import { waitUntil } from '@vercel/functions';
   * new SlackProvider({ waitUntil });
   * ```
   */
  waitUntil?: WaitUntilFn;

  /**
   * Resolve `waitUntil` from the request's Hono `Context`. Use this when the runtime
   * exposes `waitUntil` through the request and core's default doesn't cover it.
   *
   * For platforms whose `waitUntil` is a bare import (e.g. `@vercel/functions`),
   * pass it via {@link waitUntil} instead.
   *
   * Resolution order: {@link waitUntil} → {@link resolveWaitUntil} → core default.
   */
  resolveWaitUntil?: WaitUntilResolver;

  /**
   * Per-adapter overrides applied to the Slack adapter entry inside
   * `AgentChannels.adapters` — for example `toolDisplay`, `streaming`,
   * `formatError`.
   *
   * @deprecated Pass these fields at the top level of `SlackProviderConfig`
   * instead. Top-level fields win; values from `adapterConfig` are merged in
   * as a fallback for backwards compatibility.
   */
  adapterConfig?: SlackAdapterChannelConfig;
}

/**
 * Slack provider configuration with `streaming` enabled (the default).
 * Allows any `toolDisplay` mode.
 */
export interface SlackProviderStreamingConfig extends SlackProviderConfigBase {
  /**
   * Stream agent text deltas to Slack as the agent generates them.
   *
   * - `true` (default) — stream with default options.
   * - `{ updateIntervalMs }` — stream with a custom post-and-edit interval.
   *
   * @default true
   */
  streaming?: Exclude<StreamingConfig, false>;

  /**
   * How tool calls are rendered in Slack. See {@link SlackAdapterStreamingConfig#toolDisplay}.
   *
   * @default 'grouped'
   */
  toolDisplay?: ToolDisplay;
}

/**
 * Slack provider configuration with `streaming: false`. Restricts
 * `toolDisplay` to modes that post discrete messages.
 */
export interface SlackProviderStaticConfig extends SlackProviderConfigBase {
  /**
   * Disable Slack's native message streaming and buffer text until `step-finish`.
   * `'timeline'` and `'grouped'` modes require streaming, so they're not
   * available on this branch.
   */
  streaming: false;

  /**
   * How tool calls are rendered in Slack (static modes only). See
   * {@link SlackAdapterStaticConfig#toolDisplay}.
   *
   * @default 'cards'
   */
  toolDisplay?: StaticToolDisplay;
}

/**
 * Configuration for SlackProvider at the Mastra level.
 *
 * Combines Slack-specific fields (tokens, baseUrl, OAuth callbacks),
 * Slack-adapter overrides (`toolDisplay`, `streaming`, `typingStatus`, …), and a
 * curated subset of `AgentChannels` options forwarded to every connected agent
 * (`handlers`, `inlineMedia`, `inlineLinks`, …).
 *
 * `streaming` discriminates which `toolDisplay` modes are available —
 * `'timeline'` / `'grouped'` need streaming on.
 */
export type SlackProviderConfig = SlackProviderStreamingConfig | SlackProviderStaticConfig;

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
