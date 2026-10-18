// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://studio.example.com"}
import { describe, expect, it } from 'vitest';

import { buildBrowserStreamUrl } from '../browser-stream-url';

describe('buildBrowserStreamUrl', () => {
  describe('when an upgrade ticket is available', () => {
    it('appends it as the ticket query parameter', () => {
      expect(buildBrowserStreamUrl({ agentId: 'support-bot', threadId: 'thread-1', ticket: 'abc123' })).toBe(
        'wss://studio.example.com/browser/support-bot/stream?threadId=thread-1&ticket=abc123',
      );
    });

    it('encodes a ticket that is not URL safe', () => {
      expect(buildBrowserStreamUrl({ agentId: 'support-bot', threadId: 'thread-1', ticket: 'a+b/c=' })).toBe(
        'wss://studio.example.com/browser/support-bot/stream?threadId=thread-1&ticket=a%2Bb%2Fc%3D',
      );
    });
  });

  describe('when no upgrade ticket was issued', () => {
    it('omits the ticket parameter so the socket authenticates from its session cookie', () => {
      expect(buildBrowserStreamUrl({ agentId: 'support-bot', threadId: 'thread-1' })).toBe(
        'wss://studio.example.com/browser/support-bot/stream?threadId=thread-1',
      );
    });
  });

  describe('when the thread id needs encoding', () => {
    it('encodes the thread id', () => {
      expect(buildBrowserStreamUrl({ agentId: 'support-bot', threadId: 'thread/1 2' })).toBe(
        'wss://studio.example.com/browser/support-bot/stream?threadId=thread%2F1%202',
      );
    });
  });
});
