import { describe, it, expect } from 'vitest';

import { parseSlackEvent } from '../events';
import type { SlackEventPayload } from '../types';

describe('parseSlackEvent', () => {
  it('parses a message event', () => {
    const payload: SlackEventPayload = {
      type: 'event_callback',
      event: {
        type: 'message',
        channel: 'C01234567',
        user: 'U01234567',
        text: 'Hello world',
        ts: '1234567890.123456',
      },
    };

    const event = parseSlackEvent(payload);

    expect(event).toEqual({
      type: 'message',
      platform: 'slack',
      externalThreadId: '1234567890.123456',
      externalChannelId: 'C01234567',
      userId: 'U01234567',
      text: 'Hello world',
      rawEvent: payload,
    });
  });

  it('parses a threaded message with thread_ts', () => {
    const payload: SlackEventPayload = {
      type: 'event_callback',
      event: {
        type: 'message',
        channel: 'C01234567',
        user: 'U01234567',
        text: 'Reply in thread',
        ts: '1234567890.999999',
        thread_ts: '1234567890.123456',
      },
    };

    const event = parseSlackEvent(payload);

    expect(event!.externalThreadId).toBe('1234567890.123456');
  });

  it('parses an app_mention event as a mention type', () => {
    const payload: SlackEventPayload = {
      type: 'event_callback',
      event: {
        type: 'app_mention',
        channel: 'C01234567',
        user: 'U01234567',
        text: '<@U_BOT> help me',
        ts: '1234567890.123456',
      },
    };

    const event = parseSlackEvent(payload);

    expect(event!.type).toBe('mention');
    expect(event!.text).toBe('<@U_BOT> help me');
  });

  it('parses a reaction_added event as a reaction type', () => {
    const payload: SlackEventPayload = {
      type: 'event_callback',
      event: {
        type: 'reaction_added',
        channel: 'C01234567',
        user: 'U01234567',
        ts: '1234567890.123456',
      },
    };

    const event = parseSlackEvent(payload);

    expect(event!.type).toBe('reaction');
  });

  it('returns a verification event for url_verification payloads', () => {
    const payload: SlackEventPayload = {
      type: 'url_verification',
      challenge: 'abc123xyz',
    };

    const event = parseSlackEvent(payload);

    expect(event).toEqual({
      type: 'verification',
      platform: 'slack',
      externalThreadId: '',
      externalChannelId: '',
      userId: '',
      rawEvent: payload,
    });
  });

  it('returns null for payloads with no event', () => {
    const payload: SlackEventPayload = {
      type: 'event_callback',
    };

    const event = parseSlackEvent(payload);

    expect(event).toBeNull();
  });

  it('uses ts when thread_ts is not present', () => {
    const payload: SlackEventPayload = {
      type: 'event_callback',
      event: {
        type: 'message',
        channel: 'C01234567',
        user: 'U01234567',
        text: 'Top-level message',
        ts: '1234567890.123456',
      },
    };

    const event = parseSlackEvent(payload);

    expect(event!.externalThreadId).toBe('1234567890.123456');
  });
});
