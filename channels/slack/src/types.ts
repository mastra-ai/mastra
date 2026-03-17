import type { ChannelRouteConfig } from '@mastra/core/channels';

/**
 * Configuration for the Slack channel provider.
 */
export type SlackChannelConfig = {
  /** Slack signing secret for webhook verification. */
  signingSecret: string;
  /** Slack bot token (xoxb-...) for sending messages. */
  botToken: string;
  /** Maps agent names to the Slack event types they should handle. */
  routes: ChannelRouteConfig;
};

/**
 * Slack Events API event_callback payload shape.
 */
export type SlackEventPayload = {
  type: 'event_callback' | 'url_verification';
  token?: string;
  challenge?: string;
  team_id?: string;
  event?: SlackEvent;
};

/**
 * A Slack event from the Events API.
 */
export type SlackEvent = {
  type: string;
  user?: string;
  text?: string;
  channel?: string;
  ts?: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
};

/**
 * Response from Slack's chat.postMessage API.
 */
export type SlackPostMessageResponse = {
  ok: boolean;
  ts?: string;
  channel?: string;
  error?: string;
};
