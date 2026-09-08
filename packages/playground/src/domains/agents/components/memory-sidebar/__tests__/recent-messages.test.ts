import { describe, expect, it } from 'vitest';
import { getRecentMessagesSettings } from '../lib/recent-messages';

describe('Recent message settings', () => {
  describe.each([false, undefined, 0, { maxMessages: 0, maxTokens: 4000 }] as const)(
    'when history is disabled by %j',
    value => {
      it('does not show an enabled message window', () => {
        expect(getRecentMessagesSettings(value)).toEqual({
          enabled: false,
          maxMessages: undefined,
          description: 'Recent message history is not included in context.',
        });
      });
    },
  );

  describe.each([10, {}, { maxMessages: 10 }])('when history has a message window configured by %j', value => {
    it('describes the effective message count', () => {
      expect(getRecentMessagesSettings(value)).toEqual({
        enabled: true,
        maxMessages: 10,
        description: 'Includes the last 10 messages in context.',
      });
    });
  });

  describe('when history contains one message', () => {
    it('uses the singular message label', () => {
      expect(getRecentMessagesSettings(1).description).toBe('Includes the last 1 message in context.');
    });
  });
});
