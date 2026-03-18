import type { Mastra } from '../mastra';

/**
 * Supported channel event types.
 */
export type ChannelEventType = 'message' | 'reaction' | 'slash_command' | 'mention' | 'verification';

/**
 * A normalized event parsed from a platform webhook payload.
 */
export type ChannelEvent = {
  /** The type of event received. */
  type: ChannelEventType;
  /** Platform identifier (e.g. 'slack', 'discord'). */
  platform: string;
  /** The platform's thread/conversation ID. */
  externalThreadId: string;
  /** The platform's channel/room ID. */
  externalChannelId: string;
  /** The platform user ID who triggered the event. */
  userId: string;
  /** Text content of the event, if applicable. */
  text?: string;
  /** The original, unmodified platform payload. */
  rawEvent: unknown;
};

/**
 * Metadata keys stored on Mastra threads created by channels.
 * Uses dot-prefixed keys to namespace channel data.
 */
export type ChannelThreadMetadata = {
  'channel.platform': string;
  'channel.externalThreadId': string;
  'channel.externalChannelId': string;
};

/**
 * Content that can be sent to a channel.
 */
export type ChannelMessageContent = {
  /** Plain text message. */
  text: string;
  /** Platform-specific rich content blocks (e.g. Slack Block Kit). */
  blocks?: unknown[];
};

/**
 * Result of sending a message to a channel.
 */
export type ChannelSendResult = {
  ok: boolean;
  /** The platform's message ID for the sent message. */
  externalMessageId?: string;
  error?: string;
};

/**
 * Parameters for resolving or creating a Mastra thread from a channel event.
 */
export type GetOrCreateThreadParams = {
  /** The platform's thread/conversation ID. */
  externalThreadId: string;
  /** The platform's channel/room ID. */
  channelId: string;
  /** The resource ID to associate with the thread (typically a user or workspace ID). */
  resourceId: string;
  /** The Mastra instance, used to access storage. */
  mastra: Mastra;
};

/**
 * Parameters for sending a message to a channel.
 */
export type ChannelSendParams = {
  /** The platform's channel/room ID to send to. */
  channelId: string;
  /** The platform's thread ID to reply in. If omitted, sends as a new message. */
  threadId?: string;
  /** The message content to send. */
  content: ChannelMessageContent;
};

/**
 * Configuration for routing channel events to agents.
 * Maps agent names to the event types they should handle.
 */
export type ChannelRouteConfig = Record<
  string,
  {
    /** Which event types this agent should handle. */
    events: ChannelEventType[];
  }
>;

/**
 * Parameters for the shared processWebhookEvent pipeline.
 */
export type ProcessWebhookEventParams = {
  /** The normalized event from the platform. */
  event: ChannelEvent;
  /** The Mastra instance for agent/storage access. */
  mastra: Mastra;
};

/**
 * Result of processing a webhook event.
 */
export type ProcessWebhookResult = {
  /** Whether the event was handled (an agent was found and invoked). */
  handled: boolean;
  /** The name of the agent that handled the event. */
  agentName?: string;
  /** The Mastra thread ID used for the conversation. */
  threadId?: string;
  /** The text response from the agent. */
  responseText?: string;
  /** The result of sending the response back to the platform. */
  sendResult?: ChannelSendResult;
};
