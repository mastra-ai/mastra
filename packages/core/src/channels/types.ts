import type { Mastra } from '../mastra';
import type { ApiRoute } from '../server/types';

/**
 * Interface for Mastra channel implementations (e.g., SlackChannel, DiscordChannel).
 *
 * Channels manage platform-specific integrations including:
 * - OAuth flows and credential management
 * - Webhook routing and event handling
 * - Message formatting and delivery
 *
 * @example
 * ```ts
 * const mastra = new Mastra({
 *   channels: {
 *     slack: new SlackChannel({ ... }),
 *   },
 * });
 * ```
 */
export interface MastraChannel<TAgentConfig = unknown> {
  /** Unique identifier for this channel type (e.g., 'slack', 'discord'). */
  readonly id: string;

  /**
   * Type brand for the agent config this channel accepts.
   * Used for type inference only - not set at runtime.
   * @internal
   */
  readonly __agentConfigType?: TAgentConfig;

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
   * Use this to perform async setup like auto-provisioning apps.
   */
  initialize?(): Promise<void>;

  /**
   * Register an agent's channel config.
   * Called by Mastra when an agent with this channel config is added.
   * @internal
   */
  __registerAgent?(agentId: string, config: TAgentConfig): void;
}

/**
 * Extract the agent config type from a MastraChannel.
 */
export type InferChannelAgentConfig<T> = T extends MastraChannel<infer C> ? C : never;

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
