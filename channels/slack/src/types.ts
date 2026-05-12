import type { ChannelAdapterConfig, ChannelConfig, ChannelHandlers } from '@mastra/core/channels';
import type { ChannelsStorage } from '@mastra/core/storage';
import type { SlackAdapterConfig } from '@chat-adapter/slack';
import type { SlackInstallation } from './schemas';

/**
 * Adapter-level options forwarded to every `createSlackAdapter()` call this
 * provider makes. Credentials and identity that come from the installation
 * (`botToken`, `botUserId`, `signingSecret`, `userName`, `clientId`,
 * `clientSecret`) are managed by the provider and intentionally not overridable
 * here.
 */
export type SlackProviderAdapterOptions = Pick<
  SlackAdapterConfig,
  | 'apiUrl'
  | 'appToken'
  | 'encryptionKey'
  | 'installationKeyPrefix'
  | 'logger'
  | 'mode'
  | 'socketForwardingSecret'
  | 'webhookVerifier'
>;

/**
 * Per-adapter overrides forwarded to the SlackAdapter entry inside
 * `AgentChannels.adapters`. The actual `adapter` instance is created by the
 * provider, so it isn't included here.
 */
export type SlackProviderAdapterConfig = Omit<ChannelAdapterConfig, 'adapter'>;

/**
 * `AgentChannels` options forwarded to every agent connected via this provider.
 * `adapters` and `userName` are managed by the provider and intentionally not
 * overridable here.
 *
 * Set `adapterConfig` to tweak per-adapter behavior like `cards`,
 * `formatToolCall`, and `formatError`.
 */
export interface SlackProviderChannelsOptions
  extends Pick<ChannelConfig, 'inlineMedia' | 'inlineLinks' | 'state' | 'threadContext' | 'tools' | 'chatOptions'> {
  /**
   * Override built-in event handlers (e.g. `onDirectMessage`, `onMention`).
   * @see ChannelHandlers
   */
  handlers?: ChannelHandlers;

  /**
   * Per-adapter overrides applied to the Slack adapter entry — equivalent to
   * passing `{ adapter, ...adapterConfig }` to `AgentChannels.adapters.slack`
   * when wiring it up manually.
   */
  adapterConfig?: SlackProviderAdapterConfig;
}

// =============================================================================
// Global Configuration (Mastra-level)
// =============================================================================

/**
 * Configuration for SlackProvider at the Mastra level.
 */
export interface SlackProviderConfig {
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
   * Options forwarded to `createSlackAdapter()` for every installation managed
   * by this provider. Use this for advanced SlackAdapter configuration such as
   * switching to `mode: 'socket'`, supplying a custom logger, or overriding the
   * webhook verifier.
   *
   * Provider-managed fields (`botToken`, `botUserId`, `signingSecret`,
   * `userName`, `clientId`, `clientSecret`) come from each installation and are
   * not overridable here.
   *
   * @example
   * ```ts
   * new SlackProvider({
   *   refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN,
   *   adapter: { mode: 'socket', appToken: process.env.SLACK_APP_TOKEN },
   * });
   * ```
   */
  adapter?: SlackProviderAdapterOptions;

  /**
   * Options forwarded to `AgentChannels` for every agent connected via this
   * provider. Use this to override the built-in `handlers`, customize
   * `inlineMedia` / `inlineLinks`, or tweak per-adapter rendering through
   * `adapterConfig`.
   *
   * @example
   * ```ts
   * new SlackProvider({
   *   refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN,
   *   channels: {
   *     handlers: {
   *       onDirectMessage: async (thread, message, defaultHandler) => {
   *         console.log('DM:', message.text);
   *         await defaultHandler(thread, message);
   *       },
   *     },
   *     inlineMedia: ['image/*', 'video/*'],
   *     adapterConfig: { cards: false },
   *   },
   * });
   * ```
   */
  channels?: SlackProviderChannelsOptions;
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
