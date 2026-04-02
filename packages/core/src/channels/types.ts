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
