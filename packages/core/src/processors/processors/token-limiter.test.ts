import type { TextPart } from '@internal/ai-sdk-v4';
import { estimateTokenCount } from 'tokenx';
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

  describe('memory-only mode', () => {
    describe.each(['processInput', 'processInputStep'] as const)('%s', phase => {
      it('removes remembered history but preserves every current-turn source even above budget', async () => {
        const messageList = new MessageList();
        messageList.addSystem('Protected system instructions');
        const history = createTestMessage('Old history', 'user', 'history');
        const input = createTestMessage('Current input', 'user', 'input');
        const response = createTestMessage('Current response', 'assistant', 'response');
        const context = createTestMessage('Current context', 'user', 'context');
        messageList.add([history, input, response, context], 'memory');
        messageList.add(input, 'input');
        messageList.add(response, 'response');
        messageList.add(context, 'context');
        const onMemoryTrim = vi.fn();
        const limiter = new TokenLimiterProcessor({
          limit: 1,
          trimMode: 'memory-only',
          tokenCounter: { countMessage: () => 10 },
          onMemoryTrim,
        });
        const args = {
          messageList,
          messages: messageList.get.all.db(),
          systemMessages: messageList.getAllSystemMessages(),
          state: {},
          retryCount: 0,
          abort: mockAbort,
        };
        if (phase === 'processInput') {
          await limiter.processInput(args);
        } else {
          await limiter.processInputStep({ ...args, stepNumber: 1, steps: [], model: 'openai/gpt-4o' });
        }
        expect(messageList.get.all.db().map(message => message.id)).toEqual(['input', 'response', 'context']);
        expect(messageList.getAllSystemMessages()).toEqual(args.systemMessages);
        expect(onMemoryTrim).toHaveBeenCalledWith([history], undefined);
        expect(mockAbort).not.toHaveBeenCalled();
      });

      it('drops oldest messages to the headroom target and leaves an under-budget tail unchanged', async () => {
        const messageList = new MessageList();
        const history = [0, 1, 2, 3].map(index => ({
          ...createTestMessage('History', 'user', `history-${index}`),
          createdAt: new Date(index * 1000),
        }));
        messageList.add([...history].reverse(), 'memory');
        const onMemoryTrim = vi.fn();
        const limiter = new TokenLimiterProcessor({
          limit: 60,
          atMaxRemoveTokens: 15,
          trimMode: 'memory-only',
          tokenCounter: { countMessage: () => 10 },
          onMemoryTrim,
        });
        const run = async () => {
          const args = {
            messageList,
            messages: messageList.get.all.db(),
            systemMessages: [],
            state: {},
            retryCount: 0,
            abort: mockAbort,
          };
          if (phase === 'processInput') await limiter.processInput(args);
          else await limiter.processInputStep({ ...args, stepNumber: 1, steps: [], model: 'openai/gpt-4o' });
        };
        await run();
        expect(
          messageList.get.all
            .db()
            .map(message => message.id)
            .sort(),
        ).toEqual(['history-2', 'history-3']);
        expect(onMemoryTrim).toHaveBeenCalledWith(history.slice(0, 2), undefined);
        await run();
        expect(onMemoryTrim).toHaveBeenCalledTimes(1);
        expect(messageList.get.all.db()).toHaveLength(2);
      });
    });

    it('returns non-streaming output unchanged even above the memory budget', async () => {
      const limiter = new TokenLimiterProcessor({ limit: 1, trimMode: 'memory-only' });
      const messages = [createTestMessage('A complete answer that must never be truncated by the memory budget')];
      const original = structuredClone(messages);
      expect(await limiter.processOutputResult({ messages, abort: mockAbort })).toBe(messages);
      expect(messages).toEqual(original);
      expect(mockAbort).not.toHaveBeenCalled();
    });

    it('passes every streaming text chunk through without accumulating output tokens', async () => {
      const limiter = new TokenLimiterProcessor({ limit: 1, trimMode: 'memory-only' });
      const state = {};
      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'A complete answer above the memory budget', id: 'answer' },
        runId: 'run',
        from: ChunkFrom.AGENT,
      };
      for (let index = 0; index < 2; index++) {
        expect(await limiter.processOutputStream({ part, streamParts: [part], state, abort: mockAbort })).toBe(part);
      }
      expect(state).toEqual({});
      expect(mockAbort).not.toHaveBeenCalled();
    });
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

    it('should not count lifecycle or reasoning chunks against the limit', async () => {
      processor = new TokenLimiterProcessor({ limit: 180 });
      const state: Record<string, any> = {};

      const stepStart: ChunkType = {
        type: 'step-start',
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
        payload: {
          request: {
            body: JSON.stringify({ messages: Array(30).fill({ role: 'user', content: 'x'.repeat(200) }) }),
          },
        },
      } as any;
      expect(
        await processor.processOutputStream({ part: stepStart, streamParts: [], state, abort: mockAbort }),
      ).toEqual(stepStart);

      const reasoning: ChunkType = {
        type: 'reasoning-delta',
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
        payload: { id: 'r1', text: 'thinking about the layout and metrics '.repeat(12) },
      } as any;
      expect(
        await processor.processOutputStream({ part: reasoning, streamParts: [], state, abort: mockAbort }),
      ).toEqual(reasoning);

      expect(state.currentTokens ?? 0).toBe(0);

      // The full answer still fits within the limit
      let emitted = 0;
      for (let i = 0; i < 12; i++) {
        const part: ChunkType = {
          type: 'text-delta',
          payload: { text: 'Yesterday: 3 posts, 1.2K views. ', id: 'test-id' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        };
        if (await processor.processOutputStream({ part, streamParts: [], state, abort: mockAbort })) emitted++;
      }
      expect(emitted).toBe(12);
    });

    it('should never withhold tool-call or tool-result chunks once the limit is reached', async () => {
      processor = new TokenLimiterProcessor({ limit: 5 });
      const state: Record<string, any> = {};

      const text: ChunkType = {
        type: 'text-delta',
        payload: { text: 'a very long answer that blows right past the configured token limit', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };
      expect(await processor.processOutputStream({ part: text, streamParts: [], state, abort: mockAbort })).toBeNull();

      const toolCall: ChunkType = {
        type: 'tool-call',
        payload: { toolCallId: 'call_1', toolName: 'getStats', args: { range: 'yesterday' } },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      } as any;
      expect(await processor.processOutputStream({ part: toolCall, streamParts: [], state, abort: mockAbort })).toEqual(
        toolCall,
      );

      const toolResult: ChunkType = {
        type: 'tool-result',
        payload: { toolCallId: 'call_1', toolName: 'getStats', result: { posts: 3, views: 1200 } },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      } as any;
      expect(
        await processor.processOutputStream({ part: toolResult, streamParts: [], state, abort: mockAbort }),
      ).toEqual(toolResult);
    });

    it('should emit a single data-token-limit-reached chunk when output is withheld', async () => {
      processor = new TokenLimiterProcessor({ limit: 5 });
      const state: Record<string, any> = {};
      const custom = vi.fn(async () => {});

      for (let i = 0; i < 3; i++) {
        const part: ChunkType = {
          type: 'text-delta',
          payload: { text: 'a very long answer that blows past the configured token limit', id: 'test-id' },
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
        };
        await processor.processOutputStream({
          part,
          streamParts: [],
          state,
          abort: mockAbort,
          writer: { custom },
        });
      }

      expect(custom).toHaveBeenCalledTimes(1);
      expect(custom.mock.calls[0]![0]).toMatchObject({
        type: 'data-token-limit-reached',
        data: { processorId: 'token-limiter', limit: 5 },
        // transient keeps the notification off the persisted message history
        transient: true,
      });
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

    it('should handle text-delta chunks containing special token strings', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello <|endoftext|>', id: 'test-id' },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      await expect(
        processor.processOutputStream({ part, streamParts: [], state: {}, abort: mockAbort }),
      ).resolves.toEqual(part);
    });

    it('should handle tool-result chunks containing special token strings', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });

      const part: ChunkType = {
        type: 'tool-result' as const,
        payload: {
          toolCallId: 'call_1',
          toolName: 'leakyTool',
          result: 'raw model output <|endoftext|>',
        },
        runId: 'test-run-id',
        from: ChunkFrom.AGENT,
      };

      await expect(
        processor.processOutputStream({ part, streamParts: [], state: {}, abort: mockAbort }),
      ).resolves.toEqual(part);
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
    it('should handle text content containing special token strings', async () => {
      processor = new TokenLimiterProcessor({ limit: 50 });

      const originalText = 'Final answer <|endoftext|>';
      const messages = [createTestMessage(originalText)];

      const result = await processor.processOutputResult({ messages, abort: mockAbort });

      expect(result).toHaveLength(1);
      expect((result[0].content.parts[0] as TextPart).text).toBe(originalText);
    });

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

    it('should not emit unpaired surrogates when truncating multi-byte text', async () => {
      // A truncation boundary landing inside an emoji's surrogate pair must not
      // leave a lone surrogate in the output (invalid UTF-16).
      for (const limit of [1, 2, 3, 4, 8, 16]) {
        processor = new TokenLimiterProcessor({ limit });
        const messages = [createTestMessage('😀'.repeat(20))];

        const result = await processor.processOutputResult({ messages, abort: mockAbort });
        const text = (result[0].content.parts[0] as TextPart).text;

        // No lone surrogate code unit remains.
        expect(/[\uD800-\uDFFF]/u.test(text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/gu, ''))).toBe(false);
        // Output round-trips losslessly through UTF-8.
        expect(Buffer.from(text, 'utf8').toString('utf8')).toBe(text);
      }
    });

    it('should not introduce replacement characters when truncating ASCII', async () => {
      processor = new TokenLimiterProcessor({ limit: 10 });
      const messages = [
        createTestMessage('This is a very long message that will definitely exceed the token limit of 10 tokens'),
      ];

      const result = await processor.processOutputResult({ messages, abort: mockAbort });
      const truncatedText = (result[0].content.parts[0] as TextPart).text;

      expect(truncatedText.length).toBeGreaterThan(0);
      expect(truncatedText).not.toContain('\uFFFD');
    });

    it('should preserve complete surrogate pairs within the token limit', async () => {
      processor = new TokenLimiterProcessor({ limit: 200 });
      const originalText = '😀😀😀';
      const messages = [createTestMessage(originalText)];

      const result = await processor.processOutputResult({ messages, abort: mockAbort });

      expect((result[0].content.parts[0] as TextPart).text).toBe(originalText);
      expect((result[0].content.parts[0] as TextPart).text).not.toContain('\uFFFD');
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

    it('should count system messages containing special token strings', async () => {
      const processor = new TokenLimiterProcessor({ limit: 1000 });
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

      await expect(
        processor.processInputStep({
          messageList,
          stepNumber: 1,
          model: createMockModel(),
          steps: [],
          systemMessages: [{ role: 'system', content: 'System text <|endoftext|>' }],
          state: {},
          retryCount: 0,
          abort: mockAbort,
        }),
      ).resolves.toBeUndefined();
    });

    it('should count tool results containing special token strings', async () => {
      const processor = new TokenLimiterProcessor({ limit: 1000 });
      const messageList = new MessageList();

      messageList.add(
        {
          id: 'tool-result',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call_1',
                  toolName: 'leakyTool',
                  args: {},
                  result: 'raw model output <|endoftext|>',
                },
              },
            ],
          },
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        'response',
      );

      await expect(
        processor.processInputStep({
          messageList,
          stepNumber: 1,
          model: createMockModel(),
          steps: [],
          systemMessages: [],
          state: {},
          retryCount: 0,
          abort: mockAbort,
        }),
      ).resolves.toBeUndefined();
    });

    describe('media token estimation', () => {
      const BASE64_IMAGE = 'iVBORw0KGgoAAAANSUhEUg'.repeat(2000).slice(0, 40000);

      const runStep = (processor: TokenLimiterProcessor, messageList: MessageList) =>
        processor.processInputStep({
          messageList,
          stepNumber: 1,
          model: createMockModel(),
          steps: [],
          systemMessages: [],
          state: {},
          retryCount: 0,
          abort: mockAbort,
        });

      const countTokens = async (processor: TokenLimiterProcessor, messageList: MessageList) =>
        (processor as any).countInputMessageTokens(messageList.get.all.db()[0]);

      const addFileMessage = (messageList: MessageList, data: string, mimeType: string) =>
        messageList.add(
          {
            id: 'user-image',
            role: 'user',
            content: {
              format: 2,
              parts: [
                { type: 'text', text: 'what is in this image?' },
                { type: 'file', data, mimeType },
              ],
            },
            createdAt: new Date('2023-01-01T00:00:00Z'),
          } as any,
          'input',
        );

      it('should keep a message with a base64 image file part within a modest limit', async () => {
        const processor = new TokenLimiterProcessor({ limit: 2000 });
        const messageList = new MessageList();
        addFileMessage(messageList, BASE64_IMAGE, 'image/png');

        await expect(runStep(processor, messageList)).resolves.toBeUndefined();
        expect(messageList.get.all.db().map(m => m.id)).toContain('user-image');
      });

      it('should estimate an image file part instead of tokenizing its base64 payload', async () => {
        const processor = new TokenLimiterProcessor({ limit: 100_000 });
        const messageList = new MessageList();
        addFileMessage(messageList, BASE64_IMAGE, 'image/png');

        const total = await countTokens(processor, messageList);
        const stringifiedCost = estimateTokenCount(
          JSON.stringify({ type: 'file', data: BASE64_IMAGE, mimeType: 'image/png' }),
        );

        expect(total).toBeLessThan(1000);
        expect(total).toBeLessThan(stringifiedCost / 5);
      });

      it('should count a v5 image file part the same as the equivalent v4 part', async () => {
        const processor = new TokenLimiterProcessor({ limit: 100_000 });

        const v4List = new MessageList();
        addFileMessage(v4List, BASE64_IMAGE, 'image/png');

        const v5List = new MessageList();
        v5List.add(
          {
            id: 'user-image',
            role: 'user',
            content: {
              format: 2,
              parts: [
                { type: 'text', text: 'what is in this image?' },
                { type: 'file', url: BASE64_IMAGE, mediaType: 'image/png' },
              ],
            },
            createdAt: new Date('2023-01-01T00:00:00Z'),
          } as any,
          'input',
        );

        expect(await countTokens(processor, v5List)).toBe(await countTokens(processor, v4List));
      });

      it('should count a data URI image the same as the equivalent raw base64', async () => {
        const processor = new TokenLimiterProcessor({ limit: 100_000 });

        const rawList = new MessageList();
        addFileMessage(rawList, BASE64_IMAGE, 'image/png');

        const dataUriList = new MessageList();
        addFileMessage(dataUriList, `data:image/png;base64,${BASE64_IMAGE}`, 'image/png');

        expect(await countTokens(processor, dataUriList)).toBe(await countTokens(processor, rawList));
      });

      it('should use a flat estimate for a file part whose data is a remote URL', async () => {
        const processor = new TokenLimiterProcessor({ limit: 100_000 });
        const messageList = new MessageList();
        addFileMessage(messageList, 'https://example.com/report.pdf', 'application/pdf');

        const total = await countTokens(processor, messageList);

        // ~258 flat fallback plus the text part and message overhead, not the URL length.
        expect(total).toBeGreaterThan(250);
        expect(total).toBeLessThan(300);
      });

      const addToolResultMessage = (messageList: MessageList, result: unknown) =>
        messageList.add(
          {
            id: 'tool-image',
            role: 'assistant',
            content: {
              format: 2,
              content: '',
              parts: [
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    state: 'result',
                    toolCallId: 'call_1',
                    toolName: 'screenshotTool',
                    args: {},
                    result,
                  },
                },
              ],
            },
            createdAt: new Date('2023-01-01T00:00:00Z'),
          } as any,
          'response',
        );

      it('should estimate a media-shaped tool result instead of tokenizing it', async () => {
        const processor = new TokenLimiterProcessor({ limit: 2000 });
        const messageList = new MessageList();
        addToolResultMessage(messageList, { data: BASE64_IMAGE, mediaType: 'image/png' });

        await expect(runStep(processor, messageList)).resolves.toBeUndefined();
        expect(await countTokens(processor, messageList)).toBeLessThan(1000);
      });

      it('should estimate every entry of an array of media-shaped tool results', async () => {
        const processor = new TokenLimiterProcessor({ limit: 100_000 });

        const singleList = new MessageList();
        addToolResultMessage(singleList, [{ data: BASE64_IMAGE, mediaType: 'image/png' }]);

        const doubleList = new MessageList();
        addToolResultMessage(doubleList, [
          { data: BASE64_IMAGE, mediaType: 'image/png' },
          { data: BASE64_IMAGE, mediaType: 'image/png' },
        ]);

        const single = await countTokens(processor, singleList);
        const double = await countTokens(processor, doubleList);

        expect(double - single).toBeGreaterThan(700);
        expect(double).toBeLessThan(2000);
      });

      it('should leave non-media object tool results on the existing counting path', async () => {
        const processor = new TokenLimiterProcessor({ limit: 100_000 });
        const messageList = new MessageList();
        const result = { temperature: 72, conditions: 'sunny', city: 'San Francisco' };
        addToolResultMessage(messageList, result);

        const total = await countTokens(processor, messageList);

        // Unchanged stringify path: role + serialized result, minus the structural
        // discount, plus overhead for the message and the extra tool message.
        const expected = estimateTokenCount('assistant' + JSON.stringify(result)) - 12 + 3.8 + 3.8;
        expect(total).toBeCloseTo(expected, 5);
      });
    });

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

    it('should include tagged system messages when budgeting final prompt tokens', async () => {
      const processor = new TokenLimiterProcessor({ limit: 10 });
      const messageList = new MessageList();

      messageList.addSystem(
        {
          role: 'system',
          content:
            'Tagged processor context that is included in the final model prompt and must count against the token budget',
        },
        'observational-memory',
      );

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
        processor.processInputStep({
          messageList,
          stepNumber: 1,
          model: createMockModel(),
          steps: [],
          systemMessages: [],
          state: {},
          retryCount: 0,
          abort: mockAbort,
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

    describe('current run tool traffic', () => {
      const bigToolResult = {
        rules: Array.from({ length: 200 }, (_, index) => `Rule number ${index} for the living room`),
      };

      function toolMessage(id: string, result: unknown): MastraDBMessage {
        return {
          id,
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: `call-${id}`,
                  toolName: 'listRules',
                  args: {},
                  result,
                },
              },
            ],
          },
          createdAt: new Date('2023-01-01T00:00:10Z'),
        } as MastraDBMessage;
      }

      // `createTestMessage` stamps `new Date()`, and `MessageList.add` re-sorts by `createdAt`, so any
      // fixture that does not pin timestamps is walked in an order it never declared. Pin them.
      function at<T extends MastraDBMessage>(message: T, iso: string): T {
        return { ...message, createdAt: new Date(iso) };
      }

      function ids(messageList: MessageList) {
        return messageList.get.all.db().map(message => message.id);
      }

      // Measure with the processor's own counter so estimator drift fails the *premise* loudly
      // instead of quietly making these fixtures stop discriminating.
      async function tokensOf(processor: TokenLimiterProcessor, message: MastraDBMessage) {
        return (processor as any).countInputMessageTokens(message) as Promise<number>;
      }

      function runStep(processor: TokenLimiterProcessor, messageList: MessageList) {
        return processor.processInputStep({
          messageList,
          stepNumber: 1,
          model: 'openai/gpt-4o',
          steps: [],
          systemMessages: [],
          state: {},
          retryCount: 0,
          abort: mockAbort,
        } as any);
      }

      // A newer, larger current-run message outranks the tool message under newest-first trimming,
      // so the tool call and its result are what get dropped, mid-run, and out of the response set.
      async function addCompetingRun(processor: TokenLimiterProcessor, messageList: MessageList) {
        messageList.add(
          at(createTestMessage('How many rules do I have?', 'user', 'input-1'), '2023-01-01T00:00:05Z'),
          'input',
        );
        messageList.add(toolMessage('response-tool', { rules: bigToolResult.rules.slice(0, 60) }), 'response');
        // Deliberately a separate remembered turn rather than a second assistant message: two
        // adjacent 'response' messages merge into one in MessageList, which would erase the
        // competition this fixture is built to create.
        messageList.add(
          at(createTestMessage('y '.repeat(900), 'user', 'competing-1'), '2023-01-01T00:00:20Z'),
          'memory',
        );

        // Premise, asserted rather than narrated: user question, then the tool message, then the
        // newer and larger message that competes with it for the budget.
        expect(ids(messageList)).toEqual(['input-1', 'response-tool', 'competing-1']);

        const [input, tool, text] = await Promise.all(
          messageList.get.all.db().map(message => tokensOf(processor, message)),
        );
        const budget = 1400 - 24; // limit minus TOKENS_PER_CONVERSATION; no system messages here
        expect(input! + text!).toBeLessThanOrEqual(budget);
        expect(input! + tool!).toBeLessThanOrEqual(budget);
        expect(input! + tool! + text!).toBeGreaterThan(budget);
      }

      // Exact sets, not `toContain`: a regression that protects everything (or stops trimming
      // altogether) keeps the tool message too, and would sail past a containment check.
      it.each([
        // best-fit backfills past the oversized text and still affords the user question.
        ['best-fit', ['input-1', 'response-tool']],
        // contiguous stops at the first message that does not fit, the newest one, so only the
        // protected tool traffic survives. Protection changes which messages are in the suffix, not
        // the rule that the scan stops.
        ['contiguous', ['response-tool']],
      ] as const)(
        'keeps the current run tool call in %s mode when a newer, larger message competes for the budget',
        async (trimMode, expected) => {
          const processor = new TokenLimiterProcessor({ limit: 1400, trimMode });
          const messageList = new MessageList();
          await addCompetingRun(processor, messageList);

          await runStep(processor, messageList);

          expect(ids(messageList)).toEqual([...expected]);
        },
      );

      it('keeps the current run tool call after the save queue has drained the live response set', async () => {
        const processor = new TokenLimiterProcessor({ limit: 1400 });
        const messageList = new MessageList();
        await addCompetingRun(processor, messageList);
        messageList.drainUnsavedMessages();

        // The drain is the whole point of this test: the live output set is empty, so protection has
        // to come from the persisted response set instead.
        expect(messageList.makeMessageSourceChecker().output.size).toBe(0);
        expect(messageList.getPersisted.response.db().map(message => message.id)).toContain('response-tool');

        await runStep(processor, messageList);

        expect(ids(messageList)).toEqual(['input-1', 'response-tool']);
      });

      // The run's own tool traffic is over budget by itself, so trimming every last remembered
      // message still would not bring the prompt under the limit. Fail loudly with the real cause
      // rather than drop the tool call the loop depends on, same shape as the system-message guard.
      it('throws a non-retryable TripWire when the current run tool traffic alone exceeds the budget', async () => {
        const processor = new TokenLimiterProcessor({ limit: 500 });
        const messageList = new MessageList();

        messageList.add(at(createTestMessage('x'.repeat(4000), 'user', 'memory-1'), '2023-01-01T00:00:01Z'), 'memory');
        messageList.add(
          at(createTestMessage('How many rules do I have?', 'user', 'input-1'), '2023-01-01T00:00:05Z'),
          'input',
        );
        messageList.add(toolMessage('response-1', bigToolResult), 'response');

        const error = await runStep(processor, messageList).then(
          () => undefined,
          (thrown: unknown) => thrown,
        );

        expect(error).toBeInstanceOf(TripWire);
        const tripWire = error as TripWire;
        expect(tripWire.message).toContain('current run tool calls and results alone exceed');
        expect(tripWire.options?.retry).toBe(false);
        expect(tripWire.options?.metadata).toMatchObject({
          limit: 500,
          currentRunMessageCount: 1,
        });
        // The budget the guard compares against is the limit minus system tokens and conversation
        // overhead, not the raw limit.
        expect((tripWire.options?.metadata as { remainingBudget: number }).remainingBudget).toBe(500 - 24);
        const metadata = tripWire.options?.metadata as { currentRunTokens: number; remainingBudget: number };
        expect(metadata.currentRunTokens).toBeGreaterThan(metadata.remainingBudget);
        // Exact set: the guard throws *before* removing anything, so nothing was mutated on the way out.
        expect(ids(messageList)).toEqual(['memory-1', 'input-1', 'response-1']);
      });

      it('counts system tokens against the budget before deciding the tool traffic does not fit', async () => {
        const processor = new TokenLimiterProcessor({ limit: 1400 });
        const withoutSystem = new MessageList();
        withoutSystem.add(
          at(createTestMessage('How many rules do I have?', 'user', 'input-1'), '2023-01-01T00:00:05Z'),
          'input',
        );
        withoutSystem.add(toolMessage('response-1', { rules: bigToolResult.rules.slice(0, 60) }), 'response');

        // Same traffic, same limit: it fits with no system prompt...
        await expect(runStep(processor, withoutSystem)).resolves.toBeUndefined();

        const withSystem = new MessageList();
        withSystem.addSystem('s '.repeat(900));
        withSystem.add(
          at(createTestMessage('How many rules do I have?', 'user', 'input-1'), '2023-01-01T00:00:05Z'),
          'input',
        );
        withSystem.add(toolMessage('response-1', { rules: bigToolResult.rules.slice(0, 60) }), 'response');

        // ...and does not once a large system prompt has eaten the budget first.
        const error = await runStep(processor, withSystem).then(
          () => undefined,
          (thrown: unknown) => thrown,
        );
        expect(error).toBeInstanceOf(TripWire);
        expect((error as TripWire).message).toContain('current run tool calls and results alone exceed');
        expect((error as TripWire).options?.metadata).toMatchObject({ limit: 1400 });
        const metadata = (error as TripWire).options?.metadata as { systemTokens: number; remainingBudget: number };
        expect(metadata.systemTokens).toBeGreaterThan(0);
        expect(metadata.remainingBudget).toBe(1400 - metadata.systemTokens - 24);
      });

      it('keeps a tool call and its result together when they are separate messages', async () => {
        const processor = new TokenLimiterProcessor({ limit: 1400 });
        const messageList = new MessageList();

        messageList.add(
          at(createTestMessage('How many rules do I have?', 'user', 'input-1'), '2023-01-01T00:00:05Z'),
          'input',
        );
        // Only the result-bearing half is in the response set; the call must be protected with it.
        // The call half is deliberately large, and a newer competing message sits between the halves:
        // without grouping, the competing message wins the remaining budget and the call is evicted.
        messageList.add(
          {
            id: 'call-message',
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    state: 'call',
                    toolCallId: 'shared-call',
                    toolName: 'listRules',
                    args: { filter: 'f'.repeat(2400) },
                  },
                },
              ],
            },
            createdAt: new Date('2023-01-01T00:00:10Z'),
          } as MastraDBMessage,
          'memory',
        );
        messageList.add(
          at(createTestMessage('c '.repeat(1200), 'user', 'competing-1'), '2023-01-01T00:00:15Z'),
          'memory',
        );
        messageList.add(
          {
            id: 'result-message',
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    state: 'result',
                    toolCallId: 'shared-call',
                    toolName: 'listRules',
                    args: {},
                    result: bigToolResult.rules.slice(0, 10),
                  },
                },
              ],
            },
            createdAt: new Date('2023-01-01T00:00:20Z'),
          } as MastraDBMessage,
          'response',
        );

        // Premise: the competitor really does sit between the two halves of the pair.
        expect(ids(messageList)).toEqual(['input-1', 'call-message', 'competing-1', 'result-message']);

        await runStep(processor, messageList);

        // Exact set: the competitor is newer than the call and would win the budget outright, so the
        // call only survives because it is pulled in as part of the result's tool-call group.
        expect(ids(messageList)).toEqual(['input-1', 'call-message', 'result-message']);
      });

      it('still trims an assistant tool message that did not come from the current run', async () => {
        const processor = new TokenLimiterProcessor({ limit: 500 });
        const messageList = new MessageList();

        messageList.add(toolMessage('memory-tool', bigToolResult), 'memory');
        messageList.add(createTestMessage('How many rules do I have?', 'user', 'input-1'), 'input');

        await runStep(processor, messageList);

        expect(messageList.get.all.db().map(message => message.id)).toEqual(['input-1']);
      });
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
