import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SLACK_SIGNALS_INCLUDE,
  DEFAULT_SLACK_SIGNALS_POLL_INTERVAL_MS,
  SlackSignalsProvider,
  getSlackConversationTypes,
} from './index.js';

describe('SlackSignalsProvider', () => {
  it('creates typed subscribe and unsubscribe signals', () => {
    expect(SlackSignalsProvider.signals.subscribe()).toEqual(
      expect.objectContaining({
        type: 'reactive',
        tagName: 'slack-subscribe',
        contents: 'Subscribe to Slack',
        metadata: { slack: { action: 'subscribe' } },
      }),
    );

    expect(SlackSignalsProvider.signals.unsubscribe()).toEqual(
      expect.objectContaining({
        type: 'reactive',
        tagName: 'slack-unsubscribe',
        contents: 'Unsubscribe from Slack',
        metadata: { slack: { action: 'unsubscribe' } },
      }),
    );
  });

  it('defaults to watching all reachable Slack conversation types', () => {
    const provider = new SlackSignalsProvider({ token: 'xoxb-test' });

    expect(provider.include).toEqual(DEFAULT_SLACK_SIGNALS_INCLUDE);
    expect(provider.conversationTypes).toEqual(['public_channel', 'private_channel', 'im', 'mpim']);
    expect(provider.pollInterval).toBe(DEFAULT_SLACK_SIGNALS_POLL_INTERVAL_MS);
  });

  it('supports disabling selected conversation types', () => {
    const provider = new SlackSignalsProvider({
      token: 'xoxb-test',
      pollIntervalMs: 30_000,
      include: {
        privateChannels: false,
        groupDms: false,
      },
    });

    expect(provider.include).toEqual({
      publicChannels: true,
      privateChannels: false,
      dms: true,
      groupDms: false,
    });
    expect(provider.conversationTypes).toEqual(['public_channel', 'im']);
    expect(provider.pollInterval).toBe(30_000);
  });
});

describe('getSlackConversationTypes', () => {
  it('maps include config to Slack Web API conversation type names', () => {
    expect(getSlackConversationTypes({ publicChannels: false, dms: false })).toEqual(['private_channel', 'mpim']);
  });
});
