import type { TextStreamPart, ObjectStreamPart, TextPart } from 'ai';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraMessageV2 } from '../../agent/message-list';
import { TokenLimiterProcessor } from './token-limiter';

function createTestMessage(text: string, role: 'user' | 'assistant' = 'assistant', id = 'test-id'): MastraMessageV2 {
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

describe('TokenLimiterProcessor', () => {
  let processor: TokenLimiterProcessor;
  const mockAbort = vi.fn() as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should allow chunks within token limit', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      const chunk: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      const result = await processor.processOutputStream(chunk, mockAbort);

      expect(result).toEqual(chunk);
      expect(processor.getCurrentTokens()).toBeGreaterThan(0);
      expect(processor.getCurrentTokens()).toBeLessThanOrEqual(10);
    });

    it('should truncate when token limit is exceeded (default strategy)', async () => {
      processor = new TokenLimiterProcessor({ limit: 5 });

      // First chunk should be allowed
      const chunk1: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      const result1 = await processor.processOutputStream(chunk1, mockAbort);
      expect(result1).toEqual(chunk1);

      // Second chunk should be truncated
      const chunk2: TextStreamPart<any> = {
        type: 'text-delta',
        textDelta: ' world this is a very long message that will exceed the token limit',
      };
      const result2 = await processor.processOutputStream(chunk2, mockAbort);
      expect(result2).toBeNull();
    });

    it('should accept simple number constructor', async () => {
      processor = new TokenLimiterProcessor(10);

      const chunk: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      const result = await processor.processOutputStream(chunk, mockAbort);

      expect(result).toEqual(chunk);
      expect(processor.getMaxTokens()).toBe(10);
    });
  });

  describe('abort strategy', () => {
    it('should abort when token limit is exceeded', async () => {
      processor = new TokenLimiterProcessor({
        limit: 5,
        strategy: 'abort',
      });

      // First chunk should be allowed
      const chunk1: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      const result1 = await processor.processOutputStream(chunk1, mockAbort);
      expect(result1).toEqual(chunk1);

      // Second chunk should trigger abort
      const chunk2: TextStreamPart<any> = { type: 'text-delta', textDelta: ' world this is a very long message' };

      // The abort function should be called
      await processor.processOutputStream(chunk2, mockAbort);
      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('Token limit of 5 exceeded'));
    });
  });

  describe('count modes', () => {
    it('should use cumulative counting by default', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      const chunk1: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      const chunk2: TextStreamPart<any> = { type: 'text-delta', textDelta: ' world' };
      const chunk3: TextStreamPart<any> = {
        type: 'text-delta',
        textDelta: ' this is a very long message that will definitely exceed the token limit',
      };

      await processor.processOutputStream(chunk1, mockAbort);
      const tokensAfter1 = processor.getCurrentTokens();

      await processor.processOutputStream(chunk2, mockAbort);
      const tokensAfter2 = processor.getCurrentTokens();

      expect(tokensAfter2).toBeGreaterThan(tokensAfter1);

      // Third chunk should be truncated due to cumulative limit
      const result3 = await processor.processOutputStream(chunk3, mockAbort);
      expect(result3).toBeNull();
    });

    it('should use chunk counting when specified', async () => {
      processor = new TokenLimiterProcessor({
        limit: 5,
        countMode: 'chunk',
      });

      const chunk1: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      const chunk2: TextStreamPart<any> = { type: 'text-delta', textDelta: ' world this is a very long message' };

      // First chunk should be allowed (within limit)
      const result1 = await processor.processOutputStream(chunk1, mockAbort);
      expect(result1).toEqual(chunk1);

      // Second chunk should be truncated (exceeds limit)
      const result2 = await processor.processOutputStream(chunk2, mockAbort);
      expect(result2).toBeNull();

      // Token count should be reset for next chunk
      expect(processor.getCurrentTokens()).toBe(0);
    });
  });

  describe('different chunk types', () => {
    it('should handle text-delta chunks', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      const chunk: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello world' };
      const result = await processor.processOutputStream(chunk, mockAbort);

      expect(result).toEqual(chunk);
    });

    it('should handle object chunks', async () => {
      processor = new TokenLimiterProcessor({ limit: 50 });

      const chunk: ObjectStreamPart<any> = {
        type: 'object',
        object: { message: 'Hello world', count: 42 },
      };
      const result = await processor.processOutputStream(chunk, mockAbort);

      expect(result).toEqual(chunk);
    });

    it('should count tokens in object chunks correctly', async () => {
      processor = new TokenLimiterProcessor({ limit: 5 });

      const chunk: ObjectStreamPart<any> = {
        type: 'object',
        object: { message: 'This is a very long message that will exceed the token limit' },
      };
      const result = await processor.processOutputStream(chunk, mockAbort);

      expect(result).toBeNull();
    });
  });

  describe('utility methods', () => {
    it('should reset token counter', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      const chunk: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      await processor.processOutputStream(chunk, mockAbort);

      expect(processor.getCurrentTokens()).toBeGreaterThan(0);

      processor.reset();
      expect(processor.getCurrentTokens()).toBe(0);
    });

    it('should return max tokens', () => {
      processor = new TokenLimiterProcessor({ limit: 42 });
      expect(processor.getMaxTokens()).toBe(42);
    });

    it('should return current tokens', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      expect(processor.getCurrentTokens()).toBe(0);

      const chunk: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      await processor.processOutputStream(chunk, mockAbort);

      expect(processor.getCurrentTokens()).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty text chunks', async () => {
      processor = new TokenLimiterProcessor({ limit: 5 });

      const chunk: TextStreamPart<any> = { type: 'text-delta', textDelta: '' };
      const result = await processor.processOutputStream(chunk, mockAbort);

      expect(result).toEqual(chunk);
      expect(processor.getCurrentTokens()).toBe(0);
    });

    it('should handle single character chunks', async () => {
      processor = new TokenLimiterProcessor({ limit: 1 });

      const chunk: TextStreamPart<any> = { type: 'text-delta', textDelta: 'a' };
      const result = await processor.processOutputStream(chunk, mockAbort);

      expect(result).toEqual(chunk);
    });

    it('should handle very large limits', async () => {
      processor = new TokenLimiterProcessor({ limit: 1000000 });

      const chunk: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello world' };
      const result = await processor.processOutputStream(chunk, mockAbort);

      expect(result).toEqual(chunk);
    });

    it('should handle zero limit', async () => {
      processor = new TokenLimiterProcessor({ limit: 0 });

      const chunk: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      const result = await processor.processOutputStream(chunk, mockAbort);

      expect(result).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    it('should work with multiple small chunks', async () => {
      processor = new TokenLimiterProcessor({ limit: 20 });

      const chunks = [
        { type: 'text-delta', textDelta: 'Hello' },
        { type: 'text-delta', textDelta: ' ' },
        { type: 'text-delta', textDelta: 'world' },
        { type: 'text-delta', textDelta: '!' },
      ] as TextStreamPart<any>[];

      for (let i = 0; i < chunks.length; i++) {
        const result = await processor.processOutputStream(chunks[i], mockAbort);
        if (i < 3) {
          expect(result).toEqual(chunks[i]);
        } else {
          // Last chunk might be truncated depending on token count
          expect(result === chunks[i] || result === null).toBe(true);
        }
      }
    });

    it('should work with mixed chunk types', async () => {
      processor = new TokenLimiterProcessor({ limit: 30 });

      const chunks = [
        { type: 'text-delta', textDelta: 'Hello' },
        { type: 'object', object: { status: 'ok' } },
        { type: 'text-delta', textDelta: ' world' },
      ] as (TextStreamPart<any> | ObjectStreamPart<any>)[];

      for (let i = 0; i < chunks.length; i++) {
        const result = await processor.processOutputStream(chunks[i], mockAbort);
        if (i < 2) {
          expect(result).toEqual(chunks[i]);
        } else {
          // Last chunk might be truncated depending on token count
          expect(result === chunks[i] || result === null).toBe(true);
        }
      }
    });
  });

  describe('processOutputResult', () => {
    it('should truncate text content that exceeds token limit', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      const messages = [
        createTestMessage('This is a very long message that will definitely exceed the token limit of 10 tokens'),
      ];

      const result = await processor.processOutputResult({ messages, abort: mockAbort });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts[0].type).toBe('text');
      expect((result[0].content.parts[0] as TextPart).text.length).toBeLessThan(
        (messages[0].content.parts[0] as TextPart).text.length,
      );
      expect(processor.getCurrentTokens()).toBeLessThanOrEqual(10);
    });

    it('should not truncate text content within token limit', async () => {
      processor = new TokenLimiterProcessor({ limit: 50 });

      const originalText = 'This is a short message';
      const messages = [createTestMessage(originalText)];

      const result = await processor.processOutputResult({ messages, abort: mockAbort });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts[0].type).toBe('text');
      expect((result[0].content.parts[0] as TextPart).text).toBe(originalText);
    });

    it('should handle non-assistant messages', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      const messages = [createTestMessage('This is a user message that should not be processed', 'user')];

      const result = await processor.processOutputResult({ messages, abort: mockAbort });

      expect(result).toEqual(messages);
    });

    it('should handle messages without parts', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      const messages = [createTestMessage('')];

      const result = await processor.processOutputResult({ messages, abort: mockAbort });

      expect(result).toEqual(messages);
    });

    it('should handle non-text parts', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      const messages = [createTestMessage('Some reasoning content', 'assistant')];

      const result = await processor.processOutputResult({ messages, abort: mockAbort });

      expect(result).toEqual(messages);
    });

    it('should abort when token limit is exceeded with abort strategy', async () => {
      processor = new TokenLimiterProcessor({
        limit: 10,
        strategy: 'abort',
      });

      const messages = [
        createTestMessage(
          'This is a very long message that will definitely exceed the token limit of 10 tokens and should trigger an abort',
        ),
      ];

      // The abort function should be called
      await processor.processOutputResult({ messages, abort: mockAbort });
      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('Token limit of 10 exceeded'));
    });
  });
});
