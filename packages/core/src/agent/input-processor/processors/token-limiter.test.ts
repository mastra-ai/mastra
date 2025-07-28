import { describe, it, expect, vi } from 'vitest';
import type { MastraMessageV2 } from '../../message-list';
import { TripWire } from '../../trip-wire';
import { TokenLimiterInputProcessor } from './token-limiter';

function createTestMessage(text: string, role: 'user' | 'assistant' = 'user', id = 'test-id'): MastraMessageV2 {
  return {
    id,
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
    createdAt: new Date(),
  };
}

function createTestMessageWithContent(
  text: string,
  content: string,
  role: 'user' | 'assistant' = 'user',
  id = 'test-id',
): MastraMessageV2 {
  return {
    id,
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
      content,
    },
    createdAt: new Date(),
  };
}

describe('TokenLimiterInputProcessor', () => {
  describe('constructor and configuration', () => {
    it('should initialize with simple number limit', () => {
      const limiter = new TokenLimiterInputProcessor(100);
      expect(limiter.name).toBe('token-limiter');
    });

    it('should initialize with configuration object', () => {
      const limiter = new TokenLimiterInputProcessor({
        limit: 200,
        strategy: 'reject',
      });
      expect(limiter.name).toBe('token-limiter');
    });

    it('should use default configuration when not specified', () => {
      const limiter = new TokenLimiterInputProcessor({ limit: 100 });
      expect(limiter.name).toBe('token-limiter');
    });
  });

  describe('token counting', () => {
    it('should count tokens for simple text message', () => {
      const limiter = new TokenLimiterInputProcessor(1000);
      const message = createTestMessage('Hello world');

      const tokenCount = limiter.countTokens(message);
      expect(tokenCount).toBeGreaterThan(0);
      expect(tokenCount).toBeLessThan(50); // Should be reasonable for short text
    });

    it('should count tokens for messages with content field', () => {
      const limiter = new TokenLimiterInputProcessor(1000);
      const message = createTestMessageWithContent('part text', 'content text');

      const tokenCount = limiter.countTokens(message);
      expect(tokenCount).toBeGreaterThan(0);
    });

    it('should count more tokens for longer text', () => {
      const limiter = new TokenLimiterInputProcessor(1000);
      const shortMessage = createTestMessage('Hi');
      const longMessage = createTestMessage(
        'This is a much longer message with many more words that should result in significantly more tokens when counted by the tokenizer.',
      );

      const shortTokens = limiter.countTokens(shortMessage);
      const longTokens = limiter.countTokens(longMessage);

      expect(longTokens).toBeGreaterThan(shortTokens);
    });

    it('should include message overhead in token count', () => {
      const limiter = new TokenLimiterInputProcessor(1000);
      const message = createTestMessage('');

      const tokenCount = limiter.countTokens(message);
      // Should include overhead even for empty message
      expect(tokenCount).toBeGreaterThan(0);
    });

    it('should handle different message roles', () => {
      const limiter = new TokenLimiterInputProcessor(1000);
      const userMessage = createTestMessage('Hello', 'user');
      const assistantMessage = createTestMessage('Hello', 'assistant');

      const userTokens = limiter.countTokens(userMessage);
      const assistantTokens = limiter.countTokens(assistantMessage);

      // Both should count tokens, assistant role is longer so may use more tokens
      expect(userTokens).toBeGreaterThan(0);
      expect(assistantTokens).toBeGreaterThan(0);
    });
  });

  describe('message processing with truncate strategy', () => {
    it('should return all messages when under token limit', () => {
      const limiter = new TokenLimiterInputProcessor(10000); // Very high limit
      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('aborted');
      });

      const messages = [
        createTestMessage('First message', 'user', 'msg1'),
        createTestMessage('Second message', 'user', 'msg2'),
        createTestMessage('Third message', 'user', 'msg3'),
      ];

      const result = limiter.process({ messages, abort: mockAbort as any });

      expect(result).toHaveLength(3);
      expect(result).toEqual(messages);
      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should truncate oldest messages when over token limit', () => {
      const limiter = new TokenLimiterInputProcessor(50); // Very low limit
      const mockAbort = vi.fn();

      const messages = [
        createTestMessage('This is a longer message that will definitely use many tokens', 'user', 'msg1'),
        createTestMessage('This is another long message with lots of text', 'user', 'msg2'),
        createTestMessage('Short', 'user', 'msg3'),
      ];

      const result = limiter.process({ messages, abort: mockAbort as any });

      // Should keep newest messages that fit
      expect(result.length).toBeLessThan(messages.length);
      expect(result[result.length - 1].id).toBe('msg3'); // Newest should be kept
      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should maintain chronological order after truncation', () => {
      const limiter = new TokenLimiterInputProcessor(100);
      const mockAbort = vi.fn();

      const messages = [
        createTestMessage('First', 'user', 'msg1'),
        createTestMessage('Second', 'user', 'msg2'),
        createTestMessage('Third', 'user', 'msg3'),
        createTestMessage('Fourth', 'user', 'msg4'),
      ];

      const result = limiter.process({ messages, abort: mockAbort as any });

      // Results should be in chronological order
      for (let i = 1; i < result.length; i++) {
        const prevIndex = messages.findIndex(m => m.id === result[i - 1].id);
        const currIndex = messages.findIndex(m => m.id === result[i].id);
        expect(currIndex).toBeGreaterThan(prevIndex);
      }
    });

    it('should handle empty message array', () => {
      const limiter = new TokenLimiterInputProcessor(100);
      const mockAbort = vi.fn();

      const result = limiter.process({ messages: [], abort: mockAbort as any });

      expect(result).toEqual([]);
      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('should log warning when filtering messages', () => {
      const limiter = new TokenLimiterInputProcessor(30);
      const mockAbort = vi.fn();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages = [
        createTestMessage('Very long message that uses many tokens and exceeds our limit', 'user', 'msg1'),
        createTestMessage('Another long message', 'user', 'msg2'),
        createTestMessage('Short', 'user', 'msg3'),
      ];

      limiter.process({ messages, abort: mockAbort as any });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[TokenLimiterInputProcessor] Filtered'));

      consoleSpy.mockRestore();
    });
  });

  describe('message processing with reject strategy', () => {
    it('should reject when over token limit with reject strategy', () => {
      const limiter = new TokenLimiterInputProcessor({
        limit: 50,
        strategy: 'reject',
      });
      const mockAbort = vi.fn().mockImplementation(() => {
        throw new TripWire('aborted');
      });

      const messages = [
        createTestMessage('This is a very long message that will definitely exceed our token limit', 'user'),
        createTestMessage('Another message that adds more tokens', 'user'),
      ];

      expect(() => {
        limiter.process({ messages, abort: mockAbort as any });
      }).toThrow();

      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('Input exceeds token limit'));
    });

    it('should return all messages when under limit with reject strategy', () => {
      const limiter = new TokenLimiterInputProcessor({
        limit: 10000,
        strategy: 'reject',
      });
      const mockAbort = vi.fn();

      const messages = [createTestMessage('Short message', 'user')];

      const result = limiter.process({ messages, abort: mockAbort as any });

      expect(result).toEqual(messages);
      expect(mockAbort).not.toHaveBeenCalled();
    });
  });

  describe('complex message handling', () => {
    it('should handle messages with multiple parts', () => {
      const limiter = new TokenLimiterInputProcessor(1000);

      const message: MastraMessageV2 = {
        id: 'test',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'First part' }, { type: 'step-start' }, { type: 'text', text: 'Second part' }],
        },
        createdAt: new Date(),
      };

      const tokenCount = limiter.countTokens(message);
      expect(tokenCount).toBeGreaterThan(0);
    });

    it('should handle tool invocation parts', () => {
      const limiter = new TokenLimiterInputProcessor(1000);

      const message: MastraMessageV2 = {
        id: 'test',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolCallId: 'call1',
              toolName: 'searchTool',
              args: { query: 'test search' },
            } as any,
          ],
        },
        createdAt: new Date(),
      };

      const tokenCount = limiter.countTokens(message);
      expect(tokenCount).toBeGreaterThan(0);
    });

    it('should handle mixed content and parts', () => {
      const limiter = new TokenLimiterInputProcessor(1000);
      const message = createTestMessageWithContent('part text', 'content text');

      const tokenCount = limiter.countTokens(message);
      expect(tokenCount).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle malformed input gracefully', () => {
      const limiter = new TokenLimiterInputProcessor(100);
      const mockAbort = vi.fn();

      // Create a message with null text - should handle gracefully
      const message: any = {
        id: 'test',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: null }],
        },
        createdAt: new Date(),
      };

      // Should not throw, should handle gracefully
      expect(() => {
        limiter.process({ messages: [message], abort: mockAbort as any });
      }).not.toThrow();

      expect(mockAbort).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle very small token limits', () => {
      const limiter = new TokenLimiterInputProcessor(1);
      const mockAbort = vi.fn();

      const messages = [createTestMessage('Hi')];

      // With such a small limit, might return empty array
      const result = limiter.process({ messages, abort: mockAbort as any });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle very large token limits', () => {
      const limiter = new TokenLimiterInputProcessor(1000000);
      const mockAbort = vi.fn();

      const messages = [
        createTestMessage('A'.repeat(1000)), // Very long message
      ];

      const result = limiter.process({ messages, abort: mockAbort as any });
      expect(result).toEqual(messages);
    });

    it('should handle messages with no text content', () => {
      const limiter = new TokenLimiterInputProcessor(100);

      const message: MastraMessageV2 = {
        id: 'test',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'step-start' }],
        },
        createdAt: new Date(),
      };

      const tokenCount = limiter.countTokens(message);
      expect(tokenCount).toBeGreaterThan(0); // Should still include overhead
    });
  });
});
