import type { Mastra } from '../mastra';
import type { ApiRoute } from '../server/types';

// =============================================================================
// Channel Info (discovery types for Editor/UI)
// =============================================================================

/**
 * Discovery metadata for a channel platform.
 * Used by the editor UI to show available integrations and render config forms.
 */
export interface ChannelPlatformInfo {
  /** Platform identifier (e.g., 'slack', 'discord'). */
  id: string;
  /** Human-readable display name (e.g., 'Slack'). */
  name: string;
  /** Whether the platform is fully configured and ready to connect agents. */
  isConfigured: boolean;
  /** JSON Schema describing the options accepted by `connect()`. Used by UI to render config forms. */
  connectOptionsSchema?: Record<string, unknown>;
}

/**
 * Public installation info returned by the editor/UI.
 * Sensitive fields (tokens, secrets) are excluded.
 */
export interface ChannelInstallationInfo {
  /** Unique installation ID. */
  id: string;
  /** Platform identifier (e.g., 'slack'). */
  platform: string;
  /** The agent this installation is connected to. */
  agentId: string;
  /** Installation status. */
  status: 'active' | 'pending';
  /** Platform-specific display info (e.g., Slack workspace name). */
  displayName?: string;
  /** When the installation was created. */
  installedAt?: Date;
}

// =============================================================================
// Connect Result (discriminated union for different platform flows)
// =============================================================================

/**
 * OAuth-based connection — user must be redirected to an authorization URL.
 * Used by platforms like Slack where the connection requires browser-based consent.
 */
export interface ChannelConnectOAuth {
  type: 'oauth';
  /** URL to redirect the user to for OAuth authorization. */
  authorizationUrl: string;
  /** Unique installation ID. */
  installationId: string;
}

/**
 * Deep-link-based connection — user opens a link in a native app to confirm.
 * Used by platforms like Telegram where a deep link triggers in-app bot creation.
 * Completion arrives asynchronously via webhook, not a browser redirect.
 */
export interface ChannelConnectDeepLink {
  type: 'deep_link';
  /** Deep link URL for the user to open (e.g., in Telegram). */
  url: string;
  /** Unique installation ID. */
  installationId: string;
}

/**
 * Immediate connection — no user interaction needed.
 * Used by platforms where API keys or tokens are sufficient and the bot is ready instantly.
 */
export interface ChannelConnectImmediate {
  type: 'immediate';
  /** Unique installation ID. */
  installationId: string;
}

/**
 * Result of connecting an agent to a channel platform.
 * Discriminated on the `type` field to support different platform authorization flows.
 */
export type ChannelConnectResult = ChannelConnectOAuth | ChannelConnectDeepLink | ChannelConnectImmediate;

// =============================================================================
// ChannelProvider interface
// =============================================================================

/**
 * Interface for channel provider implementations (e.g., SlackProvider, DiscordProvider).
 *
 * A channel provider manages the full lifecycle of a platform integration:
 * - App provisioning and OAuth flows
 * - Webhook routing and event handling
 * - Adapter creation and agent wiring
 * - Manifest synchronization and credential management
 *
 * @example
 * ```ts
 * const mastra = new Mastra({
 *   channels: {
 *     slack: new SlackProvider({ ... }),
 *   },
 * });
 * ```
 */
export interface ChannelProvider {
  /** Unique identifier for this channel type (e.g., 'slack', 'discord'). */
  readonly id: string;

  /**
   * Returns API routes for this channel (OAuth, webhooks, events).
   * These are automatically merged into the server's apiRoutes.
   */
  getRoutes(): ApiRoute[];

  /**
   * Called when the channel is registered with Mastra.
   * Use this to store a reference to Mastra and perform setup.
   * @internal
   */
  __attach?(mastra: Mastra): void;

  /**
   * Called during Mastra initialization after all agents are registered.
   * Use this to perform async setup like restoring active installations.
   */
  initialize?(): Promise<void>;

  /**
   * Provide or clear platform credentials at runtime.
   * Pass `null` to clear credentials and delete stored tokens.
   */
  configure?(credentials: Record<string, unknown> | null): void | Promise<void>;

  // ---------------------------------------------------------------------------
  // Discovery & Management (used by Editor/UI)
  // ---------------------------------------------------------------------------

  /**
   * Returns discovery metadata for the editor UI.
   * Includes platform name, configuration status, and connect options schema.
   */
  getInfo?(): ChannelPlatformInfo;

  /**
   * Connect an agent to this channel platform.
   * Returns a discriminated result indicating the authorization flow required.
   */
  connect?(agentId: string, options?: Record<string, unknown>): Promise<ChannelConnectResult>;

  /**
   * Disconnect an agent from this channel platform.
   * Deletes the platform app and cleans up storage.
   */
  disconnect?(agentId: string): Promise<void>;

  /**
   * List active installations for this platform.
   * Returns public info only (no secrets).
   */
  listInstallations?(): Promise<ChannelInstallationInfo[]>;
}

/**
 * A message from the platform's thread history.
 * Used to provide context when the agent is mentioned mid-conversation.
 */
export type ThreadHistoryMessage = {
  /** Platform message ID. */
  id: string;
  /** Display name of the author. */
  author: string;
  /** Platform user ID of the author. */
  userId?: string;
  /** The message text. */
  text: string;
  /** Whether the author is a bot. */
  isBot?: boolean;
};

/**
 * Channel context placed on `requestContext` under the 'channel' key.
 * Available to input processors via `requestContext.get('channel')`.
 *
 * Stable fields (platform, isDM, threadId, channelId, userId, userName)
 * are suitable for system messages. Per-request fields (messageId, eventType)
 * should be injected closer to the user message.
 */
export type ChannelContext = {
  /** Platform identifier — matches the adapter's name (e.g. 'slack', 'discord'). */
  platform: string;
  /** Event type that triggered this generation. */
  eventType: string;
  /** Whether this is a direct message conversation. */
  isDM?: boolean;
  /** The platform thread ID (e.g. 'discord:guildId:channelId:threadId'). */
  threadId?: string;
  /** The platform channel ID. */
  channelId?: string;
  /** Platform message ID of the message that triggered this turn. */
  messageId?: string;
  /** Platform user ID of the sender. */
  userId: string;
  /** Display name of the sender, if available. */
  userName?: string;
  /** The bot's own user ID on this platform. */
  botUserId?: string;
  /** The bot's display name on this platform. */
  botUserName?: string;
  /** The bot's mention string (e.g. '<@U123>' on Slack/Discord). */
  botMention?: string;
};
