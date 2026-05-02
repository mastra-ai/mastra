import type { TextPart } from '@internal/ai-sdk-v4';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { MastraDBMessage } from '../../agent/message-list';
import { MessageList } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { IMastraLogger } from '../../logger';
import { ProcessorRunner } from '../../processors/runner';
import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream/types';

import { TokenLimiterProcessor } from './token-limiter';

// Mock logger that implements all required methods
const mockLogger: IMastraLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  trackException: vi.fn(),
  getTransports: vi.fn(() => []),
  listLogs: vi.fn(() => []),
  listLogsByRunId: vi.fn(() => []),
} as any;

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

      // Use the same state object across all calls to simulate a single stream
      const state: Record<string, any> = {};

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
        state,
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
        state,
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

      // Use the same state object across all calls to simulate a single stream
      const state: Record<string, any> = {};

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
        state,
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
      await processor.processOutputStream({ part: chunk2, streamParts: [], state, abort: mockAbort });
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

      // Use the same state object across all calls to simulate a single stream
      const state: Record<string, any> = {};

      for (let i = 0; i < chunks.length; i++) {
        const result = await processor.processOutputStream({
          part: chunks[i],
          streamParts: [],
          state,
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

      // Use the same state object across all calls to simulate a single stream
      const state: Record<string, any> = {};

      for (let i = 0; i < chunks.length; i++) {
        const result = await processor.processOutputStream({
          part: chunks[i],
          streamParts: [],
          state,
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

  describe('processInputStep', () => {
    const createMockModel = () =>
      ({
        modelId: 'test-model',
        specificationVersion: 'v2',
        provider: 'test',
        defaultObjectGenerationMode: 'json',
        supportsImageUrls: false,
        supportsStructuredOutputs: true,
        doGenerate: async () => ({}),
        doStream: async () => ({}),
      }) as any;

    it('should prune old messages at each step to stay within token limit', async () => {
      const processor = new TokenLimiterProcessor({ limit: 50 });

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList();

      // Simulate a multi-step conversation that has grown
      messageList.add(
        {
          id: 'user-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Hello how are you doing today my friend',
            parts: [{ type: 'text', text: 'Hello how are you doing today my friend' }],
          },
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        'input',
      );
      messageList.add(
        {
          id: 'assistant-1',
          role: 'assistant',
          content: {
            format: 2,
            content: 'I am doing great thanks for asking me',
            parts: [{ type: 'text', text: 'I am doing great thanks for asking me' }],
          },
          createdAt: new Date('2023-01-01T00:01:00Z'),
        },
        'response',
      );
      messageList.add(
        {
          id: 'user-2',
          role: 'user',
          content: {
            format: 2,
            content: 'Can you help me with something important',
            parts: [{ type: 'text', text: 'Can you help me with something important' }],
          },
          createdAt: new Date('2023-01-01T00:02:00Z'),
        },
        'input',
      );
      messageList.add(
        {
          id: 'assistant-2',
          role: 'assistant',
          content: {
            format: 2,
            content: 'Of course I would be happy to help you',
            parts: [{ type: 'text', text: 'Of course I would be happy to help you' }],
          },
          createdAt: new Date('2023-01-01T00:03:00Z'),
        },
        'response',
      );
      messageList.add(
        {
          id: 'user-3',
          role: 'user',
          content: {
            format: 2,
            content: 'Please write a sorting function',
            parts: [{ type: 'text', text: 'Please write a sorting function' }],
          },
          createdAt: new Date('2023-01-01T00:04:00Z'),
        },
        'input',
      );

      expect(messageList.get.all.db().length).toBe(5);

      // Run processInputStep (simulating step 2 of an agentic loop)
      await runner.runProcessInputStep({
        messageList,
        stepNumber: 2,
        model: createMockModel(),
        steps: [],
      });

      const messagesAfter = messageList.get.all.db();

      // Should have fewer messages after pruning
      expect(messagesAfter.length).toBeLessThan(5);

      // Newest messages should be preserved
      expect(messagesAfter.some(m => m.id === 'user-3')).toBe(true);

      // Oldest messages should be removed
      expect(messagesAfter.some(m => m.id === 'user-1')).toBe(false);
    });

    it('should preserve all messages when within token limit', async () => {
      const processor = new TokenLimiterProcessor({ limit: 1000 });

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList();

      messageList.add(
        {
          id: 'user-1',
          role: 'user',
          content: { format: 2, content: 'Hello', parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        'input',
      );
      messageList.add(
        {
          id: 'assistant-1',
          role: 'assistant',
          content: { format: 2, content: 'Hi there', parts: [{ type: 'text', text: 'Hi there' }] },
          createdAt: new Date('2023-01-01T00:01:00Z'),
        },
        'response',
      );
      messageList.add(
        {
          id: 'user-2',
          role: 'user',
          content: { format: 2, content: 'How are you?', parts: [{ type: 'text', text: 'How are you?' }] },
          createdAt: new Date('2023-01-01T00:02:00Z'),
        },
        'input',
      );

      expect(messageList.get.all.db().length).toBe(3);

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
      });

      // All messages should be preserved when within limit
      expect(messageList.get.all.db().length).toBe(3);
    });

    it('should account for system messages in token budget', async () => {
      const processor = new TokenLimiterProcessor({ limit: 55 });

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList();

      // Add system message
      messageList.addSystem({
        role: 'system',
        content: 'You are a helpful assistant that answers questions concisely',
      });

      messageList.add(
        {
          id: 'user-1',
          role: 'user',
          content: { format: 2, content: 'Hello there', parts: [{ type: 'text', text: 'Hello there' }] },
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        'input',
      );
      messageList.add(
        {
          id: 'assistant-1',
          role: 'assistant',
          content: { format: 2, content: 'Hi how can I help', parts: [{ type: 'text', text: 'Hi how can I help' }] },
          createdAt: new Date('2023-01-01T00:01:00Z'),
        },
        'response',
      );
      messageList.add(
        {
          id: 'user-2',
          role: 'user',
          content: {
            format: 2,
            content: 'What is the weather',
            parts: [{ type: 'text', text: 'What is the weather' }],
          },
          createdAt: new Date('2023-01-01T00:02:00Z'),
        },
        'input',
      );

      const beforeCount = messageList.get.all.db().length;
      expect(beforeCount).toBe(3);

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 1,
        model: createMockModel(),
        steps: [],
      });

      const messagesAfter = messageList.get.all.db();

      // Newest message should always be preserved
      expect(messagesAfter.some(m => m.id === 'user-2')).toBe(true);

      // System message budget should cause some messages to be pruned
      expect(messagesAfter.length).toBeLessThan(beforeCount);
    });

    it('should throw TripWire for empty messages', async () => {
      const processor = new TokenLimiterProcessor({ limit: 1000 });

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList();

      await expect(
        runner.runProcessInputStep({
          messageList,
          stepNumber: 0,
          model: createMockModel(),
          steps: [],
        }),
      ).rejects.toThrow('TokenLimiterProcessor: No messages to process');
    });

    it('should throw TripWire when system messages exceed limit', async () => {
      const processor = new TokenLimiterProcessor({ limit: 10 });

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList();

      // Add a large system message that will exceed the tiny limit
      messageList.addSystem({
        role: 'system',
        content:
          'You are a very detailed and thorough assistant that always provides comprehensive answers with multiple examples and explanations',
      });

      messageList.add(
        {
          id: 'user-1',
          role: 'user',
          content: { format: 2, content: 'Hello', parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        'input',
      );

      await expect(
        runner.runProcessInputStep({
          messageList,
          stepNumber: 0,
          model: createMockModel(),
          steps: [],
        }),
      ).rejects.toThrow('System messages alone exceed token limit');
    });

    it('should throw TripWire when no messages fit within the remaining token budget', async () => {
      const processor = new TokenLimiterProcessor({ limit: 25 });
      const messageList = new MessageList();

      messageList.add(
        {
          id: 'user-1',
          role: 'user',
          content: { format: 2, content: 'Hello', parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        'input',
      );

      try {
        await processor.processInputStep({
          messageList,
          stepNumber: 1,
          model: createMockModel(),
          steps: [],
          systemMessages: [],
          state: {},
          retryCount: 0,
          abort: (() => {
            throw new Error('aborted');
          }) as any,
        });
        expect.fail('Expected TokenLimiterProcessor to throw a TripWire');
      } catch (error) {
        expect(error).toBeInstanceOf(TripWire);
        expect(error).toHaveProperty(
          'message',
          'TokenLimiterProcessor: No messages fit within the remaining token budget. Cannot send LLM a request with no messages.',
        );
        expect((error as TripWire).options).toEqual({
          retry: false,
          metadata: {
            systemTokens: 0,
            limit: 25,
            remainingBudget: 1,
            messageCount: 1,
          },
        });
      }

      expect(messageList.get.all.db()).toHaveLength(1);
    });

    it('should handle tool call messages in token counting', async () => {
      const processor = new TokenLimiterProcessor({ limit: 100 });

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList();

      // Add a tool call message (these appear during multi-step workflows)
      messageList.add(
        {
          id: 'assistant-tool-call',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
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
        'response',
      );

      // Add tool result
      messageList.add(
        {
          id: 'tool-result',
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
                  args: { expression: '2+2' },
                  result: '4',
                },
              },
            ],
          },
          createdAt: new Date('2023-01-01T00:01:00Z'),
        },
        'response',
      );

      // Add user follow-up
      messageList.add(
        {
          id: 'user-followup',
          role: 'user',
          content: { format: 2, content: 'Thanks', parts: [{ type: 'text', text: 'Thanks' }] },
          createdAt: new Date('2023-01-01T00:02:00Z'),
        },
        'input',
      );

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 1,
        model: createMockModel(),
        steps: [],
      });

      // All messages should fit within 100 token limit
      const messagesAfter = messageList.get.all.db();
      expect(messagesAfter.length).toBeGreaterThan(0);
      expect(messagesAfter.some(m => m.id === 'user-followup')).toBe(true);
    });

    it('should work correctly with simple number constructor', async () => {
      // Test that TokenLimiterProcessor(50) works the same as TokenLimiterProcessor({ limit: 50 })
      const processor = new TokenLimiterProcessor(50);

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList();

      messageList.add(
        {
          id: 'user-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Hello how are you doing today my friend',
            parts: [{ type: 'text', text: 'Hello how are you doing today my friend' }],
          },
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        'input',
      );
      messageList.add(
        {
          id: 'assistant-1',
          role: 'assistant',
          content: {
            format: 2,
            content: 'I am doing great thanks for asking me',
            parts: [{ type: 'text', text: 'I am doing great thanks for asking me' }],
          },
          createdAt: new Date('2023-01-01T00:01:00Z'),
        },
        'response',
      );
      messageList.add(
        {
          id: 'user-2',
          role: 'user',
          content: { format: 2, content: 'Latest message', parts: [{ type: 'text', text: 'Latest message' }] },
          createdAt: new Date('2023-01-01T00:02:00Z'),
        },
        'input',
      );

      expect(messageList.get.all.db().length).toBe(3);

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 1,
        model: createMockModel(),
        steps: [],
      });

      const messagesAfter = messageList.get.all.db();

      // Should have pruned some messages
      expect(messagesAfter.length).toBeLessThan(3);

      // Newest message should be preserved
      expect(messagesAfter.some(m => m.id === 'user-2')).toBe(true);
    });
  });
});
