import type { TextPart } from '@internal/ai-sdk-v4';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { MastraDBMessage } from '../../agent/message-list';
import { RequestContext } from '../../request-context';
import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream/types';

import { TokenLimiterProcessor } from './token-limiter';

function createTestMessage(text: string, role: 'user' | 'assistant' = 'assistant', id = 'test-id'): MastraDBMessage {
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
      const state: Record<string, any> = {};
      const result = await processor.processOutputStream({ part, streamParts: [part], state, abort: mockAbort });

      expect(result).toEqual(part);
      expect(state.currentTokens).toBeGreaterThan(0);
      expect(state.currentTokens).toBeLessThanOrEqual(10);
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

      // Use the same state object across all calls to simulate a single stream
      const state: Record<string, any> = {};

      await processor.processOutputStream({ part: chunk1, streamParts: [], state, abort: mockAbort });
      const tokensAfter1 = state.currentTokens;

      await processor.processOutputStream({ part: chunk2, streamParts: [chunk1], state, abort: mockAbort });
      const tokensAfter2 = state.currentTokens;

      expect(tokensAfter2).toBeGreaterThan(tokensAfter1);

      // Third part should be truncated due to cumulative limit
      const result3 = await processor.processOutputStream({
        part: chunk3,
        streamParts: [chunk1, chunk2],
        state,
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
      const state1: Record<string, any> = {};
      const result1 = await processor.processOutputStream({
        part: chunk1,
        streamParts: [],
        state: state1,
        abort: mockAbort,
      });
      expect(result1).toEqual(chunk1);

      // Second part should be truncated (exceeds limit)
      const state2: Record<string, any> = {};
      const result2 = await processor.processOutputStream({
        part: chunk2,
        streamParts: [],
        state: state2,
        abort: mockAbort,
      });
      expect(result2).toBeNull();

      // Token count should be reset for next part (part mode resets after each part)
      expect(state2.currentTokens).toBe(0);
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

      const part = {
        type: 'object' as const,
        object: { message: 'Hello world', count: 42 },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      } as any;
      const result = await processor.processOutputStream({ part, streamParts: [], state: {}, abort: mockAbort });

      expect(result).toEqual(part);
    });

    it('should count tokens in object chunks correctly', async () => {
      processor = new TokenLimiterProcessor({ limit: 5 });

      const part = {
        type: 'object' as const,
        object: { message: 'This is a very long message that will exceed the token limit' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      } as any;
      const result = await processor.processOutputStream({ part, streamParts: [], state: {}, abort: mockAbort });

      expect(result).toBeNull();
    });
  });

  describe('utility methods', () => {
    it('should initialize state correctly', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      const state: Record<string, any> = {};
      await processor.processOutputStream({ part, streamParts: [], state, abort: mockAbort });

      expect(state.currentTokens).toBeGreaterThan(0);

      // New state object should start fresh
      const freshState: Record<string, any> = {};
      await processor.processOutputStream({ part, streamParts: [], state: freshState, abort: mockAbort });
      expect(freshState.currentTokens).toBeGreaterThan(0);
    });

    it('should return max tokens', () => {
      processor = new TokenLimiterProcessor({ limit: 42 });
      expect(processor.getMaxTokens()).toBe(42);
    });

    it('should track tokens in state', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      const state: Record<string, any> = {};
      expect(state.currentTokens).toBeUndefined();

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      await processor.processOutputStream({ part, streamParts: [], state, abort: mockAbort });

      expect(state.currentTokens).toBeGreaterThan(0);
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
      const state: Record<string, any> = {};
      const result = await processor.processOutputStream({ part, streamParts: [], state, abort: mockAbort });

      expect(result).toEqual(part);
      expect(state.currentTokens || 0).toBe(0);
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

      const chunks = [
        {
          type: 'text-delta' as const,
          payload: { text: 'Hello', id: 'test-id' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
        { type: 'object' as const, object: { status: 'ok' }, runId: 'test-run-id', from: ChunkFrom.AGENT } as any,
        {
          type: 'text-delta' as const,
          payload: { text: ' world', id: 'test-id' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        },
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

      // Verify the truncated text is not empty and is shorter than original
      const truncatedText = (result[0].content.parts[0] as TextPart).text;
      expect(truncatedText.length).toBeGreaterThan(0);
      expect(truncatedText.length).toBeLessThan((messages[0].content.parts[0] as TextPart).text.length);
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

      // Verify all parts are present and the message structure is intact
      expect(result[0].content.parts.every(part => part.type === 'text')).toBe(true);
    });
  });

  describe('processInput', () => {
    it('should limit input messages to the specified token count', async () => {
      const processor = new TokenLimiterProcessor({
        limit: 50, // Lower limit to actually trigger filtering (will allow ~26 tokens after overhead)
      });

      // Create messages with content that will exceed the limit
      const messages: MastraDBMessage[] = [
        {
          id: 'message-1',
          role: 'user',
          content: {
            format: 2,
            content: 'This is the first message with some content',
            parts: [{ type: 'text', text: 'This is the first message with some content' }],
          },
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        {
          id: 'message-2',
          role: 'assistant',
          content: {
            format: 2,
            content: 'This is a response with more content',
            parts: [{ type: 'text', text: 'This is a response with more content' }],
          },
          createdAt: new Date('2023-01-01T00:01:00Z'),
        },
        {
          id: 'message-3',
          role: 'user',
          content: {
            format: 2,
            content: 'Another message here',
            parts: [{ type: 'text', text: 'Another message here' }],
          },
          createdAt: new Date('2023-01-01T00:02:00Z'),
        },
        {
          id: 'message-4',
          role: 'assistant',
          content: {
            format: 2,
            content: 'Final response',
            parts: [{ type: 'text', text: 'Final response' }],
          },
          createdAt: new Date('2023-01-01T00:03:00Z'),
        },
        {
          id: 'message-5',
          role: 'user',
          content: {
            format: 2,
            content: 'Latest message',
            parts: [{ type: 'text', text: 'Latest message' }],
          },
          createdAt: new Date('2023-01-01T00:04:00Z'),
        },
      ];

      const result = await processor.processInput({
        messages,
        abort: mockAbort,
        requestContext: new RequestContext(),
      });

      // Should prioritize newest messages (higher ids) and exclude oldest
      expect(result.length).toBeLessThan(messages.length);
      // The newest messages should be included
      expect(result.some(m => m.id === 'message-5')).toBe(true);
      expect(result.some(m => m.id === 'message-4')).toBe(true);
      // The oldest message should be excluded
      expect(result.some(m => m.id === 'message-1')).toBe(false);
    });

    it('should handle empty messages array', async () => {
      const processor = new TokenLimiterProcessor({
        limit: 1000,
      });

      const result = await processor.processInput({
        messages: [],
        abort: mockAbort,
        requestContext: new RequestContext(),
      });
      expect(result).toEqual([]);
    });

    it('should handle system messages correctly', async () => {
      const processor = new TokenLimiterProcessor({
        limit: 200,
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'system-1',
          role: 'system',
          content: {
            format: 2,
            content: 'You are a helpful assistant', // ~6 tokens
            parts: [{ type: 'text', text: 'You are a helpful assistant' }],
          },
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        {
          id: 'user-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Hello', // ~1 token
            parts: [{ type: 'text', text: 'Hello' }],
          },
          createdAt: new Date('2023-01-01T00:01:00Z'),
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: {
            format: 2,
            content: 'Hi there!', // ~3 tokens
            parts: [{ type: 'text', text: 'Hi there!' }],
          },
          createdAt: new Date('2023-01-01T00:02:00Z'),
        },
      ];

      const result = await processor.processInput({
        messages,
        abort: mockAbort,
        requestContext: new RequestContext(),
      });

      // System message should always be included
      expect(result.length).toBe(3);
      expect(result[0].role).toBe('system');
      expect(result[0].id).toBe('system-1');
    });

    it('should handle tool call messages', async () => {
      const processor = new TokenLimiterProcessor({
        limit: 300,
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'tool-call-1',
          role: 'assistant',
          content: {
            format: 2,
            content: '', // Tool calls don't have content text
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'call',
                  toolCallId: 'call_1',
                  toolName: 'calculator',
                  args: { expression: '2+2' },
                },
              },
            ],
          },
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        {
          id: 'tool-result-1',
          role: 'assistant',
          content: {
            format: 2,
            content: 'The result is 4',
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call_1',
                  toolName: 'calculator',
                  args: { a: 2, b: 2 },
                  result: 'The result is 4',
                },
              },
            ],
          },
          createdAt: new Date('2023-01-01T00:01:00Z'),
        },
        {
          id: 'user-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Calculate 2+2',
            parts: [{ type: 'text', text: 'Calculate 2+2' }],
          },
          createdAt: new Date('2023-01-01T00:02:00Z'),
        },
      ];

      const result = await processor.processInput({
        messages,
        abort: mockAbort,
        requestContext: new RequestContext(),
      });

      // All messages should fit within the limit
      expect(result.length).toBe(3);
    });

    it('should apply the same limit to both input and output processing', async () => {
      const processor = new TokenLimiterProcessor({
        limit: 50,
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'message-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Hello world',
            parts: [{ type: 'text', text: 'Hello world' }],
          },
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        {
          id: 'message-2',
          role: 'assistant',
          content: {
            format: 2,
            content: 'This is a response',
            parts: [{ type: 'text', text: 'This is a response' }],
          },
          createdAt: new Date('2023-01-01T00:01:00Z'),
        },
      ];

      const result = await processor.processInput({
        messages,
        abort: mockAbort,
        requestContext: new RequestContext(),
      });

      // Should apply input limit (150 tokens)
      expect(result.length).toBe(2);
    });
  });
});
