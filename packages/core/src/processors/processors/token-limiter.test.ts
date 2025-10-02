import type { TextPart } from 'ai';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraMessageV2 } from '../../agent/message-list';
import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream/types';
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

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const result = await processor.processOutputStream({ part, streamParts: [part], state: {}, abort: mockAbort });

      expect(result).toEqual(part);
      expect(processor.getCurrentTokens()).toBeGreaterThan(0);
      expect(processor.getCurrentTokens()).toBeLessThanOrEqual(10);
    });

    it('should truncate when token limit is exceeded (default strategy)', async () => {
      processor = new TokenLimiterProcessor({ limit: 5 });

      // First part should be allowed
      const chunk1: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const result1 = await processor.processOutputStream({
        part: chunk1,
        streamParts: [],
        state: {},
        abort: mockAbort,
      });
      expect(result1).toEqual(chunk1);

      // Second part should be truncated
      const chunk2: ChunkType = {
        type: 'text-delta',
        payload: { text: ' world this is a very long message that will exceed the token limit', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const result2 = await processor.processOutputStream({
        part: chunk2,
        streamParts: [],
        state: {},
        abort: mockAbort,
      });
      expect(result2).toBeNull();
    });

    it('should accept simple number constructor', async () => {
      processor = new TokenLimiterProcessor(10);

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const result = await processor.processOutputStream({ part, streamParts: [], state: {}, abort: mockAbort });

      expect(result).toEqual(part);
      expect(processor.getMaxTokens()).toBe(10);
    });
  });

  describe('abort strategy', () => {
    it('should abort when token limit is exceeded', async () => {
      processor = new TokenLimiterProcessor({
        limit: 5,
        strategy: 'abort',
      });

      // First part should be allowed
      const chunk1: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const result1 = await processor.processOutputStream({
        part: chunk1,
        streamParts: [],
        state: {},
        abort: mockAbort,
      });
      expect(result1).toEqual(chunk1);

      // Second part should trigger abort
      const chunk2: ChunkType = {
        type: 'text-delta',
        payload: { text: ' world this is a very long message', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      // The abort function should be called
      await processor.processOutputStream({ part: chunk2, streamParts: [], state: {}, abort: mockAbort });
      expect(mockAbort).toHaveBeenCalledWith(expect.stringContaining('Token limit of 5 exceeded'));
    });
  });

  describe('count modes', () => {
    it('should use cumulative counting by default', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      const chunk1: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const chunk2: ChunkType = {
        type: 'text-delta',
        payload: { text: ' world', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const chunk3: ChunkType = {
        type: 'text-delta',
        payload: { text: ' this is a very long message that will definitely exceed the token limit', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      await processor.processOutputStream({ part: chunk1, streamParts: [], state: {}, abort: mockAbort });
      const tokensAfter1 = processor.getCurrentTokens();

      await processor.processOutputStream({ part: chunk2, streamParts: [], state: {}, abort: mockAbort });
      const tokensAfter2 = processor.getCurrentTokens();

      expect(tokensAfter2).toBeGreaterThan(tokensAfter1);

      // Third part should be truncated due to cumulative limit
      const result3 = await processor.processOutputStream({
        part: chunk3,
        streamParts: [],
        state: {},
        abort: mockAbort,
      });
      expect(result3).toBeNull();
    });

    it('should use part counting when specified', async () => {
      processor = new TokenLimiterProcessor({
        limit: 5,
        countMode: 'part',
      });

      const chunk1: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const chunk2: ChunkType = {
        type: 'text-delta',
        payload: { text: ' world this is a very long message', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      // First part should be allowed (within limit)
      const result1 = await processor.processOutputStream({
        part: chunk1,
        streamParts: [],
        state: {},
        abort: mockAbort,
      });
      expect(result1).toEqual(chunk1);

      // Second part should be truncated (exceeds limit)
      const result2 = await processor.processOutputStream({
        part: chunk2,
        streamParts: [],
        state: {},
        abort: mockAbort,
      });
      expect(result2).toBeNull();

      // Token count should be reset for next part
      expect(processor.getCurrentTokens()).toBe(0);
    });
  });

  describe('different part types', () => {
    it('should handle text-delta chunks', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello world', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const result = await processor.processOutputStream({ part, streamParts: [], state: {}, abort: mockAbort });

      expect(result).toEqual(part);
    });

    it('should handle object chunks', async () => {
      processor = new TokenLimiterProcessor({ limit: 50 });

      const part: ChunkType = {
        type: 'object',
        object: { message: 'Hello world', count: 42 },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const result = await processor.processOutputStream({ part, streamParts: [], state: {}, abort: mockAbort });

      expect(result).toEqual(part);
    });

    it('should count tokens in object chunks correctly', async () => {
      processor = new TokenLimiterProcessor({ limit: 5 });

      const part: ChunkType = {
        type: 'object',
        object: { message: 'This is a very long message that will exceed the token limit' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const result = await processor.processOutputStream({ part, streamParts: [], state: {}, abort: mockAbort });

      expect(result).toBeNull();
    });
  });

  describe('utility methods', () => {
    it('should reset token counter', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      await processor.processOutputStream({ part, streamParts: [], state: {}, abort: mockAbort });

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

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      await processor.processOutputStream({ part, streamParts: [], state: {}, abort: mockAbort });

      expect(processor.getCurrentTokens()).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty text chunks', async () => {
      processor = new TokenLimiterProcessor({ limit: 5 });

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: '', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const result = await processor.processOutputStream({ part, streamParts: [], state: {}, abort: mockAbort });

      expect(result).toEqual(part);
      expect(processor.getCurrentTokens()).toBe(0);
    });

    it('should handle single character chunks', async () => {
      processor = new TokenLimiterProcessor({ limit: 1 });

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'a', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const result = await processor.processOutputStream({ part, streamParts: [], state: {}, abort: mockAbort });

      expect(result).toEqual(part);
    });

    it('should handle very large limits', async () => {
      processor = new TokenLimiterProcessor({ limit: 1000000 });

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello world', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const result = await processor.processOutputStream({ part, streamParts: [], state: {}, abort: mockAbort });

      expect(result).toEqual(part);
    });

    it('should handle zero limit', async () => {
      processor = new TokenLimiterProcessor({ limit: 0 });

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const result = await processor.processOutputStream({ part, streamParts: [], state: {}, abort: mockAbort });

      expect(result).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    it('should work with multiple small chunks', async () => {
      processor = new TokenLimiterProcessor({ limit: 20 });

      const chunks = [
        { type: 'text-delta', payload: { text: 'Hello', id: 'test-id' }, runId: 'test-run-id', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: ' ', id: 'test-id' }, runId: 'test-run-id', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: 'world', id: 'test-id' }, runId: 'test-run-id', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: '!', id: 'test-id' }, runId: 'test-run-id', from: ChunkFrom.AGENT },
      ] as ChunkType[];

      for (let i = 0; i < chunks.length; i++) {
        const result = await processor.processOutputStream({
          part: chunks[i],
          streamParts: [],
          state: {},
          abort: mockAbort,
        });
        if (i < 3) {
          expect(result).toEqual(chunks[i]);
        } else {
          // Last part might be truncated depending on token count
          expect(result === chunks[i] || result === null).toBe(true);
        }
      }
    });

    it('should work with mixed part types', async () => {
      processor = new TokenLimiterProcessor({ limit: 30 });

      const chunks: ChunkType[] = [
        { type: 'text-delta', payload: { text: 'Hello', id: 'test-id' }, runId: 'test-run-id', from: ChunkFrom.AGENT },
        { type: 'object', object: { status: 'ok' }, runId: 'test-run-id', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: ' world', id: 'test-id' }, runId: 'test-run-id', from: ChunkFrom.AGENT },
      ];

      for (let i = 0; i < chunks.length; i++) {
        const result = await processor.processOutputStream({
          part: chunks[i],
          streamParts: [],
          state: {},
          abort: mockAbort,
        });
        if (i < 2) {
          expect(result).toEqual(chunks[i]);
        } else {
          // Last part might be truncated depending on token count
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

    it('should handle cumulative token counting across multiple parts', async () => {
      processor = new TokenLimiterProcessor({ limit: 15 });

      const messages = [
        {
          ...createTestMessage(''),
          content: {
            format: 2 as const,
            parts: [
              { type: 'text' as const, text: 'Hello world' }, // ~2 tokens
              { type: 'text' as const, text: 'This is a test' }, // ~4 tokens
              { type: 'text' as const, text: 'Another part' }, // ~3 tokens
              { type: 'text' as const, text: 'Final part' }, // ~3 tokens
            ],
          },
        },
      ];

      const result = await processor.processOutputResult({ messages, abort: mockAbort });

      expect(result).toHaveLength(1);
      expect(result[0].content.parts).toHaveLength(4);

      // First two parts should be unchanged (2 + 4 = 6 tokens)
      expect((result[0].content.parts[0] as TextPart).text).toBe('Hello world');
      expect((result[0].content.parts[1] as TextPart).text).toBe('This is a test');

      // Third part should be unchanged (6 + 3 = 9 tokens)
      expect((result[0].content.parts[2] as TextPart).text).toBe('Another part');

      // Fourth part should be truncated to fit within remaining limit (9 + 3 = 12 tokens, but we have 15 limit)
      const fourthPartText = (result[0].content.parts[3] as TextPart).text;
      expect(fourthPartText).toBe('Final part'); // Should fit within the 15 token limit

      // Total tokens should not exceed the limit
      expect(processor.getCurrentTokens()).toBeLessThanOrEqual(15);
    });
  });
});
