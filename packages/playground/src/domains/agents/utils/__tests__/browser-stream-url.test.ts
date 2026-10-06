// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://studio.example.com"}
import { describe, expect, it } from 'vitest';

import { buildBrowserStreamUrl, readBrowserStreamToken } from '../browser-stream-url';

describe('readBrowserStreamToken', () => {
  describe('when headers carry an Authorization bearer token', () => {
    it('returns the token without the Bearer prefix', () => {
      expect(readBrowserStreamToken({ Authorization: 'Bearer abc123' })).toBe('abc123');
    });

    it('returns the token without the prefix regardless of case', () => {
      expect(readBrowserStreamToken({ authorization: 'bearer abc123' })).toBe('abc123');
    });

    it('returns a bare token unchanged', () => {
      expect(readBrowserStreamToken({ Authorization: 'abc123' })).toBe('abc123');
    });
  });

  describe('when no credential is configured for the stream', () => {
    it('returns undefined when headers are absent', () => {
      expect(readBrowserStreamToken(undefined)).toBeUndefined();
    });

    it('returns undefined when there is no Authorization header', () => {
      expect(readBrowserStreamToken({ 'X-Playground-Access': 'abc123' })).toBeUndefined();
    });

    it('returns undefined when the Authorization header is empty', () => {
      expect(readBrowserStreamToken({ Authorization: 'Bearer   ' })).toBeUndefined();
    });
  });
});

describe('buildBrowserStreamUrl', () => {
  describe('when a token is available', () => {
    it('appends it as the apiKey query parameter', () => {
      expect(buildBrowserStreamUrl({ agentId: 'support-bot', threadId: 'thread-1', token: 'abc123' })).toBe(
        'wss://studio.example.com/browser/support-bot/stream?threadId=thread-1&apiKey=abc123',
      );
    });

    it('encodes a token that is not URL safe', () => {
      expect(buildBrowserStreamUrl({ agentId: 'support-bot', threadId: 'thread-1', token: 'a+b/c=' })).toBe(
        'wss://studio.example.com/browser/support-bot/stream?threadId=thread-1&apiKey=a%2Bb%2Fc%3D',
      );
    });
  });

  describe('when the deployment authenticates by cookie', () => {
    it('omits the apiKey parameter when no token is given', () => {
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
