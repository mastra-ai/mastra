/**
 * Slack Events API payload types, written by hand from Slack's Events API
 * reference (https://docs.slack.dev/apis/events-api) and the reference page
 * of each event (https://docs.slack.dev/reference/events). Slack's AsyncAPI
 * description is years out of date and types every event the same way.
 *
 * These are the events a Slack app most often subscribes to. Connect names
 * each delivery by its inner event's `type`; for an event not listed here,
 * read the payload as untyped.
 */

/** Slack Events API payloads by Connect event type: the inner event's `type`. */
export interface SlackWebhookPayloads {
  app_home_opened: SlackEventCallback<SlackAppHomeOpenedEvent>;
  app_mention: SlackEventCallback<SlackAppMentionEvent>;
  app_uninstalled: SlackEventCallback<{ type: 'app_uninstalled' }>;
  channel_created: SlackEventCallback<SlackChannelCreatedEvent>;
  member_joined_channel: SlackEventCallback<SlackMemberJoinedChannelEvent>;
  member_left_channel: SlackEventCallback<SlackMemberLeftChannelEvent>;
  message: SlackEventCallback<SlackMessageEvent>;
  reaction_added: SlackEventCallback<SlackReactionEvent<'reaction_added'>>;
  reaction_removed: SlackEventCallback<SlackReactionEvent<'reaction_removed'>>;
  tokens_revoked: SlackEventCallback<SlackTokensRevokedEvent>;
}

/** The outer event Slack posts, wrapping the event that happened. */
export interface SlackEventCallback<Event> {
  type: 'event_callback';
  /** The workspace the event happened in. */
  team_id: string;
  /** The app the event was sent to. */
  api_app_id: string;
  event: Event;
  /** Slack's id for the event, unique across workspaces. */
  event_id: string;
  /** When the event was sent, in Unix seconds. */
  event_time: number;
  /** An identifier for this event, for `apps.event.authorizations.list`. */
  event_context?: string;
  /** One installation of the app that can see the event. */
  authorizations?: SlackAuthorization[];
  /** Whether the event happened in a channel shared with another workspace. */
  is_ext_shared_channel?: boolean;
  context_team_id?: string;
  context_enterprise_id?: string | null;
  /** @deprecated Verify requests with the signing secret instead. */
  token?: string;
}

/** An installation of the app: some of an Enterprise org, a workspace and a user. */
export interface SlackAuthorization {
  enterprise_id?: string | null;
  team_id?: string | null;
  user_id?: string;
  is_bot: boolean;
  is_enterprise_install?: boolean;
}

/** Someone mentioned the app. */
export interface SlackAppMentionEvent {
  type: 'app_mention';
  user: string;
  text: string;
  ts: string;
  channel: string;
  event_ts: string;
  /** Set when the mention is a reply in a thread. */
  thread_ts?: string;
  blocks?: unknown[];
}

/**
 * A message was posted, or changed when `subtype` says so (for example
 * `message_changed` or `message_deleted`). A message with a subtype may
 * lack `user` or `text`.
 */
export interface SlackMessageEvent {
  type: 'message';
  subtype?: string;
  channel: string;
  /** `channel`, `group`, `im` or `mpim`. */
  channel_type?: string;
  user?: string;
  text?: string;
  ts: string;
  event_ts?: string;
  /** Set when the message is a reply in a thread. */
  thread_ts?: string;
  /** Who last edited the message, and when. */
  edited?: { user: string; ts: string };
  /** Set when a bot posted the message. */
  bot_id?: string;
  blocks?: unknown[];
  [field: string]: unknown;
}

/** A reaction was added to or removed from an item. */
export interface SlackReactionEvent<Type extends 'reaction_added' | 'reaction_removed'> {
  type: Type;
  /** Who reacted. */
  user: string;
  /** The emoji's name, without colons. */
  reaction: string;
  /** Who created the item reacted to, if a person did. */
  item_user?: string;
  item:
    | { type: 'message'; channel: string; ts: string; channel_type?: string }
    | { type: 'file'; file: string }
    | { type: 'file_comment'; file_comment: string; file: string };
  event_ts: string;
}

export interface SlackMemberJoinedChannelEvent {
  type: 'member_joined_channel';
  user: string;
  channel: string;
  /** `C` for a public channel, `G` for a private one. */
  channel_type: string;
  team: string;
  /** Who invited the member, when someone did. */
  inviter?: string;
  enterprise?: string;
}

export interface SlackMemberLeftChannelEvent {
  type: 'member_left_channel';
  user: string;
  channel: string;
  channel_type: string;
  team: string;
}

/** Someone opened the app's Home, Messages or About tab. */
export interface SlackAppHomeOpenedEvent {
  type: 'app_home_opened';
  user: string;
  channel: string;
  event_ts: string;
  /** The tab opened, such as `home` or `messages`. */
  tab: string;
  /** The Home tab's view, once the app has published one. */
  view?: Record<string, unknown>;
}

export interface SlackChannelCreatedEvent {
  type: 'channel_created';
  channel: { id: string; name: string; created: number; creator: string };
}

/** The app's tokens were revoked, by the user ids they were issued for. */
export interface SlackTokensRevokedEvent {
  type: 'tokens_revoked';
  tokens: { oauth?: string[]; bot?: string[] };
}
