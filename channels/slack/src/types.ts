import type { ChannelsStorage } from '@mastra/core/storage';
import type { Mastra } from '@mastra/core/mastra';
import type { Handler } from 'hono';
import type { SlackInstallation } from './schemas';

// =============================================================================
// Routes
// =============================================================================

/**
 * Route definition compatible with Mastra's ApiRoute.
 * Uses createHandler so mastra is injected automatically.
 */
export interface SlackRoute {
  path: string;
  method: 'GET' | 'POST';
  requiresAuth: boolean;
  createHandler: (deps: { mastra: Mastra }) => Promise<Handler>;
}

// =============================================================================
// Global Configuration (Mastra-level)
// =============================================================================

/**
 * Configuration for SlackChannel at the Mastra level.
 */
export interface SlackChannelConfig {
  /**
   * Slack App Configuration Token for programmatic app creation.
   * Generate at: https://api.slack.com/apps > "Your App Configuration Tokens"
   * 
   * Optional if you have a valid refreshToken - will rotate to get a fresh token on startup.
   */
  configToken?: string;

  /**
   * Slack App Configuration Refresh Token.
   * Used for automatic token rotation.
   */
  refreshToken: string;

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
   * Called when config tokens are rotated.
   * Persist these to your database/env to avoid re-authentication.
   */
  onTokenRotation?: (tokens: { configToken: string; refreshToken: string }) => Promise<void>;

  /**
   * Custom storage for installations.
   * Defaults to using Mastra's ChannelsStorage from the global storage.
   * Falls back to InMemoryChannelsStorage if no global storage is configured.
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
}

// =============================================================================
// Agent Configuration (serializable)
// =============================================================================

/**
 * Slack configuration for an individual agent.
 * This is serializable and can be stored in the database for stored agents.
 */
export interface SlackAgentConfig {
  /**
   * Display name for the Slack bot.
   * Defaults to agent name.
   */
  name?: string;

  /**
   * Bot description shown in Slack.
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
   * Whether to respond to @mentions in channels.
   * Defaults to true.
   */
  respondToMentions?: boolean;

  /**
   * Whether to respond to direct messages.
   * Defaults to true.
   */
  respondToDirectMessages?: boolean;

  /**
   * Additional OAuth scopes to request beyond the defaults.
   * 
   * Default scopes include: chat:write, chat:write.public, im:write,
   * channels:history, channels:read, groups:history, groups:read,
   * im:history, im:read, mpim:history, mpim:read, app_mentions:read,
   * users:read, reactions:write, files:read
   * 
   * @example
   * additionalScopes: ['files:write', 'reactions:read']
   */
  additionalScopes?: string[];

  /**
   * Additional bot events to subscribe to beyond the defaults.
   * 
   * Default events: app_mention, message.channels, message.groups,
   * message.im, message.mpim
   * 
   * @example
   * additionalEvents: ['reaction_added', 'file_shared']
   */
  additionalEvents?: string[];
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

/**
 * Marker interface for pending Slack adapter.
 * Used internally to detect Slack config on agents.
 * @internal
 */
export interface SlackPendingAdapter {
  __type: 'slack-pending';
  __slackChannel: unknown; // SlackChannel (avoid circular import)
  __agentConfig: SlackAgentConfig;
}

/**
 * Check if a value is a SlackPendingAdapter.
 */
export function isSlackPendingAdapter(value: unknown): value is SlackPendingAdapter {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__type' in value &&
    (value as SlackPendingAdapter).__type === 'slack-pending'
  );
}
