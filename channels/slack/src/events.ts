import type { ChannelEvent, ChannelEventType } from '@mastra/core/channels';

import type { SlackEvent, SlackEventPayload } from './types';

/**
 * Maps a Slack event type string to a normalized ChannelEventType.
 */
function mapSlackEventType(event: SlackEvent): ChannelEventType {
  switch (event.type) {
    case 'app_mention':
      return 'mention';
    case 'message':
      return 'message';
    case 'reaction_added':
    case 'reaction_removed':
      return 'reaction';
    default:
      return 'message';
  }
}

/**
 * Parses a Slack Events API payload into a normalized ChannelEvent.
 */
export function parseSlackEvent(payload: SlackEventPayload): ChannelEvent | null {
  if (payload.type === 'url_verification') {
    return {
      type: 'verification',
      platform: 'slack',
      externalThreadId: '',
      externalChannelId: '',
      userId: '',
      rawEvent: payload,
    };
  }

  const event = payload.event;
  if (!event) {
    return null;
  }

  // Use thread_ts if the message is in a thread, otherwise use ts as the thread ID
  const externalThreadId = event.thread_ts || event.ts || '';

  return {
    type: mapSlackEventType(event),
    platform: 'slack',
    externalThreadId,
    externalChannelId: event.channel || '',
    userId: event.user || '',
    text: event.text,
    rawEvent: payload,
  };
}
