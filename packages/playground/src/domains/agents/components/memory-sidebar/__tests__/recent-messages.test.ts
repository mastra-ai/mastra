import { describe, expect, it } from 'vitest';
import { getRecentMessagesSettings } from '../lib/recent-messages';

describe('Recent message settings', () => {
  describe.each([
    [false, undefined],
    [undefined, undefined],
    [0, undefined],
    [0, { maxTokens: 4000 }],
    [false, { maxTokens: 4000 }],
  ] as const)('when history is disabled by lastMessages=%j messageHistory=%j', (lastMessages, messageHistory) => {
    it('does not show an enabled message window', () => {
      expect(getRecentMessagesSettings(lastMessages, messageHistory)).toEqual({
        enabled: false,
        maxMessages: undefined,
        description: 'Recent message history is not included in context.',
      });
    });
  });

  describe('when history has a message window configured', () => {
    it('describes the effective message count', () => {
      expect(getRecentMessagesSettings(10)).toEqual({
        enabled: true,
        maxMessages: 10,
        description: 'Includes the last 10 messages in context.',
      });
    });
  });

  describe('when history has only a token budget', () => {
    it('describes enabled history without a message-count limit', () => {
      expect(getRecentMessagesSettings(undefined, { maxTokens: 4000 })).toEqual({
        enabled: true,
        maxMessages: undefined,
        description: 'Includes recent message history with a 4000-token context budget, trimming oldest history first.',
      });
    });
  });

  describe('when history contains one message', () => {
    it('uses the singular message label', () => {
      expect(getRecentMessagesSettings(1).description).toBe('Includes the last 1 message in context.');
    });
  });
});
