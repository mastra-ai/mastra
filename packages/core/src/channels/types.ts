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
  /** Display name of the user (e.g. 'Caleb Barnes'). */
  userName?: string;
  /** Text content of the event, if applicable. */
  text?: string;
  /** For slash_command events, the command name (e.g. '/summarize'). */
  commandName?: string;
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
 * A slash command definition for a channel.
 * The command's prompt is prepended to the agent's generate call.
 */
export type ChannelCommand = {
  /** Description shown to users in the platform's command UI. */
  description: string;
  /** Prompt prepended to the agent's generate call when this command is invoked. */
  prompt: string;
};

/**
 * Channel context placed on `requestContext` under the 'channel' key.
 * Available to input processors via `requestContext.get('channel')`.
 */
export type ChannelContext = {
  /** Platform identifier (e.g. 'slack', 'discord'). */
  platform: string;
  /** Event type that triggered this generation. */
  eventType: ChannelEventType;
  /** Platform user ID of the sender. */
  userId: string;
  /** Display name of the sender, if available. */
  userName?: string;
};

/**
 * Parameters for the shared processWebhookEvent pipeline.
 */
export type ProcessWebhookEventParams = {
  /** The normalized event from the platform. */
  event: ChannelEvent;
  /** The Mastra instance for storage access. */
  mastra: Mastra;
};

/**
 * Result of processing a webhook event.
 */
export type ProcessWebhookResult = {
  /** Whether the event was handled. */
  handled: boolean;
  /** The Mastra thread ID used for the conversation. */
  threadId?: string;
  /** The text response from the agent. */
  responseText?: string;
  /** The result of sending the response back to the platform. */
  sendResult?: ChannelSendResult;
};
