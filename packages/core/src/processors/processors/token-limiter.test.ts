import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
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

    it('should count provider tool-result messages with one message overhead', () => {
      processor = new TokenLimiterProcessor({ limit: 100 });
      const message: LanguageModelV2Prompt[number] = {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'calculator',
            output: { type: 'text', value: '42' },
          },
        ],
      };

      const tokens = (processor as any).countPromptMessageTokens(message);

      expect(tokens).toBe(estimateTokenCount('tool42') + 3.8);
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

  describe('input token limiting', () => {
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

    /**
     * Builds the prompt the model would receive: system messages first, then the
     * conversion of the message list, and hands it to `processLLMRequest`.
     */
    const runLLMRequest = async (
      limiter: TokenLimiterProcessor,
      messageList: MessageList,
      systemMessages: Array<{ role: 'system'; content: string }> = [],
    ) => {
      const prompt = [...systemMessages, ...(await messageList.get.all.aiV5.llmPrompt())] as LanguageModelV2Prompt;

      return limiter.processLLMRequest({
        prompt,
        model: createMockModel(),
        stepNumber: 1,
        steps: [],
        state: {},
      });
    };

    it('should count system messages containing special token strings', async () => {
      const limiter = new TokenLimiterProcessor({ limit: 1000 });
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
        runLLMRequest(limiter, messageList, [{ role: 'system', content: 'System text <|endoftext|>' }]),
      ).resolves.toBeUndefined();
    });

    it('should count tool results containing special token strings', async () => {
      const limiter = new TokenLimiterProcessor({ limit: 1000 });
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

      await expect(runLLMRequest(limiter, messageList)).resolves.toBeUndefined();
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

      it('should estimate media parts inside a mapped modelOutput content array', async () => {
        const processor = new TokenLimiterProcessor({ limit: 100_000 });

        const textOnlyList = new MessageList();
        textOnlyList.add(
          {
            id: 'text-only',
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
                    result: 'placeholder',
                  },
                  providerMetadata: {
                    mastra: {
                      modelOutput: { type: 'content', value: [{ type: 'text', text: 'a screenshot was taken' }] },
                    },
                  },
                },
              ],
            },
            createdAt: new Date('2023-01-01T00:00:00Z'),
          } as any,
          'response',
        );

        const withMediaList = new MessageList();
        withMediaList.add(
          {
            id: 'with-media',
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
                    result: 'placeholder',
                  },
                  providerMetadata: {
                    mastra: {
                      modelOutput: {
                        type: 'content',
                        value: [
                          { type: 'text', text: 'a screenshot was taken' },
                          { type: 'media', data: BASE64_IMAGE, mediaType: 'image/png' },
                        ],
                      },
                    },
                  },
                },
              ],
            },
            createdAt: new Date('2023-01-01T00:00:00Z'),
          } as any,
          'response',
        );

        const textOnlyTokens = await countTokens(processor, textOnlyList);
        const withMediaTokens = await countTokens(processor, withMediaList);

        // The media entry must be estimated via the flat per-image cost, not
        // tokenized as a giant base64 string.
        expect(withMediaTokens - textOnlyTokens).toBeGreaterThan(100);
        expect(withMediaTokens - textOnlyTokens).toBeLessThan(2000);
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

    it('should trim the provider prompt without deleting stored messages', async () => {
      const limiter = new TokenLimiterProcessor({ limit: 50 });

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
        'memory',
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
        'memory',
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
        'memory',
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
        'memory',
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

      const result = await runLLMRequest(limiter, messageList);
      const prompt = result?.prompt;

      expect(prompt).toBeDefined();

      // Older prompt messages are dropped oldest-first
      expect(prompt!.length).toBeLessThan(5);

      // Newest message is always kept
      expect(prompt!.at(-1)).toMatchObject({ role: 'user' });

      // Stored messages are untouched - trimming is request-scoped
      expect(messageList.get.all.db().map(m => m.id)).toEqual([
        'user-1',
        'assistant-1',
        'user-2',
        'assistant-2',
        'user-3',
      ]);
    });

    it('should preserve the prompt when it is within the token limit', async () => {
      const limiter = new TokenLimiterProcessor({ limit: 1000 });

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
        'memory',
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

      // No change means no replacement prompt to hand back
      await expect(runLLMRequest(limiter, messageList)).resolves.toBeUndefined();
    });

    it('should account for system messages in the prompt token budget', async () => {
      const limiter = new TokenLimiterProcessor({ limit: 55 });

      const messageList = new MessageList();

      messageList.add(
        {
          id: 'user-1',
          role: 'user',
          content: { format: 2, content: 'Hello there', parts: [{ type: 'text', text: 'Hello there' }] },
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        'memory',
      );
      messageList.add(
        {
          id: 'assistant-1',
          role: 'assistant',
          content: { format: 2, content: 'Hi how can I help', parts: [{ type: 'text', text: 'Hi how can I help' }] },
          createdAt: new Date('2023-01-01T00:01:00Z'),
        },
        'memory',
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

      const result = await runLLMRequest(limiter, messageList, [
        { role: 'system', content: 'You are a helpful assistant that answers questions concisely' },
      ]);

      const prompt = result?.prompt;
      expect(prompt).toBeDefined();

      // System message is kept while the budget it consumes forces trims
      expect(prompt!.filter(message => message.role === 'system')).toHaveLength(1);
      expect(prompt!.length).toBeLessThan(4);

      // Newest message is always preserved
      expect(prompt!.at(-1)).toMatchObject({ role: 'user' });
      expect(messageList.get.all.db()).toHaveLength(3);
    });

    it('should throw TripWire for empty messages', async () => {
      const limiter = new TokenLimiterProcessor({ limit: 1000 });

      await expect(runLLMRequest(limiter, new MessageList())).rejects.toThrow(
        'TokenLimiterProcessor: No messages to process',
      );
    });

    it('should throw TripWire when system messages exceed limit', async () => {
      const limiter = new TokenLimiterProcessor({ limit: 10 });
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
        runLLMRequest(limiter, messageList, [
          {
            role: 'system',
            content:
              'You are a very detailed and thorough assistant that always provides comprehensive answers with multiple examples and explanations',
          },
        ]),
      ).rejects.toThrow('System messages alone exceed token limit');
    });

    it('should include tagged system messages when budgeting final prompt tokens', async () => {
      const limiter = new TokenLimiterProcessor({ limit: 10 });
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

      const prompt = [
        ...messageList.getAllSystemMessages().map(message => ({
          role: 'system' as const,
          content: typeof message.content === 'string' ? message.content : '',
        })),
        ...(await messageList.get.all.aiV5.llmPrompt()),
      ] as LanguageModelV2Prompt;

      await expect(
        limiter.processLLMRequest({ prompt, model: createMockModel(), stepNumber: 1, steps: [], state: {} }),
      ).rejects.toThrow('System messages alone exceed token limit');
    });

    it('should throw TripWire when no messages fit within the remaining token budget', async () => {
      const limiter = new TokenLimiterProcessor({ limit: 25 });
      const messageList = new MessageList();

      messageList.add(
        {
          id: 'user-1',
          role: 'user',
          content: { format: 2, content: 'Hello', parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        'memory',
      );

      try {
        await runLLMRequest(limiter, messageList);
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

      // The rejected request must not have deleted the stored message
      expect(messageList.get.all.db()).toHaveLength(1);
    });

    it('should handle tool call messages in token counting', async () => {
      const limiter = new TokenLimiterProcessor({ limit: 40 });

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

      const result = await runLLMRequest(limiter, messageList);

      // The tool group is over budget, so it is dropped as a unit: the follow-up
      // survives without a tool result whose call was removed.
      const prompt = result?.prompt ?? [];
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt.at(-1)).toMatchObject({ role: 'user' });

      const toolCallIds = prompt.flatMap(message =>
        typeof message.content === 'string'
          ? []
          : message.content.flatMap(part => (part.type === 'tool-call' ? [part.toolCallId] : [])),
      );
      const toolResultIds = prompt.flatMap(message =>
        typeof message.content === 'string'
          ? []
          : message.content.flatMap(part => (part.type === 'tool-result' ? [part.toolCallId] : [])),
      );
      expect(toolCallIds).toEqual(toolResultIds);

      // Trimming never touches the stored messages
      expect(messageList.get.all.db().map(m => m.id)).toEqual(['assistant-tool-call', 'user-followup']);
    });

    it('should keep a tool call and its results in the same trimming group', async () => {
      // The call, its (large) results, and the follow-up together exceed the
      // limit, so best-fit keeps only the newest group. The dropped call must
      // take its results with it instead of leaving a dangling tool result.
      const limiter = new TokenLimiterProcessor({ limit: 40 });
      const messageList = new MessageList();

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

      messageList.add(
        {
          id: 'tool-result-1',
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
                  toolName: 'calculator',
                  args: { expression: '2+2' },
                  result: '4',
                },
              },
            ],
          },
          createdAt: new Date('2023-01-01T00:00:01Z'),
        },
        'response',
      );

      messageList.add(
        {
          id: 'user-followup',
          role: 'user',
          content: { format: 2, content: 'Thanks', parts: [{ type: 'text', text: 'Thanks' }] },
          createdAt: new Date('2023-01-01T00:01:00Z'),
        },
        'input',
      );

      const result = await runLLMRequest(limiter, messageList);
      const prompt = result?.prompt ?? [];

      // Either the whole tool group survived or none of it did - never a result
      // without its call.
      const toolCallIds = prompt.flatMap(message =>
        typeof message.content === 'string'
          ? []
          : message.content.flatMap(part => (part.type === 'tool-call' ? [part.toolCallId] : [])),
      );
      const toolResultIds = prompt.flatMap(message =>
        typeof message.content === 'string'
          ? []
          : message.content.flatMap(part => (part.type === 'tool-result' ? [part.toolCallId] : [])),
      );
      expect(toolResultIds.filter(id => !toolCallIds.includes(id))).toEqual([]);
      expect(toolCallIds.filter(id => !toolResultIds.includes(id))).toEqual([]);
      expect(messageList.get.all.db().map(m => m.id)).toEqual(['assistant-tool-call', 'user-followup']);
    });

    it('should stop at the first oversized group in contiguous mode', async () => {
      const buildList = () => {
        const messageList = new MessageList();
        messageList.add(
          {
            id: 'user-1',
            role: 'user',
            content: { format: 2, content: 'earliest', parts: [{ type: 'text', text: 'earliest' }] },
            createdAt: new Date('2023-01-01T00:00:00Z'),
          },
          'input',
        );
        messageList.add(
          {
            id: 'user-2',
            role: 'user',
            content: {
              format: 2,
              content: 'A very long middle message that eats most of the available token budget for this request',
              parts: [
                {
                  type: 'text',
                  text: 'A very long middle message that eats most of the available token budget for this request',
                },
              ],
            },
            createdAt: new Date('2023-01-01T00:01:00Z'),
          },
          'input',
        );
        messageList.add(
          {
            id: 'user-3',
            role: 'user',
            content: { format: 2, content: 'latest', parts: [{ type: 'text', text: 'latest' }] },
            createdAt: new Date('2023-01-01T00:02:00Z'),
          },
          'input',
        );
        return messageList;
      };

      const contiguousList = buildList();
      const contiguous = await runLLMRequest(
        new TokenLimiterProcessor({ limit: 50, trimMode: 'contiguous' }),
        contiguousList,
      );
      expect(contiguous?.prompt).toHaveLength(1);

      // best-fit keeps walking past the oversized group, so the older small
      // message survives too
      const bestFitList = buildList();
      const bestFit = await runLLMRequest(new TokenLimiterProcessor({ limit: 50 }), bestFitList);
      expect(bestFit?.prompt).toHaveLength(2);

      expect(contiguousList.get.all.db()).toHaveLength(3);
      expect(bestFitList.get.all.db()).toHaveLength(3);
    });

    it('should not trim stored messages for standard trim modes', async () => {
      const limiter = new TokenLimiterProcessor({ limit: 1 });
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

      await limiter.processInputStep({
        messageList,
        stepNumber: 1,
        model: createMockModel(),
        steps: [],
        systemMessages: [],
        state: {},
        retryCount: 0,
        abort: mockAbort,
        llmRequestStage: true,
      });

      expect(messageList.get.all.db().map(m => m.id)).toEqual(['user-1']);
    });

    it('should work correctly with simple number constructor', async () => {
      // Test that TokenLimiterProcessor(50) works the same as TokenLimiterProcessor({ limit: 50 })
      const limiter = new TokenLimiterProcessor(50);

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
        'memory',
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
        'memory',
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

      const result = await runLLMRequest(limiter, messageList);
      const prompt = result?.prompt;

      // Should have trimmed older prompt messages
      expect(prompt).toBeDefined();
      expect(prompt!.length).toBeLessThan(3);

      // Newest message should be preserved
      expect(prompt!.at(-1)).toMatchObject({ role: 'user' });
      expect(messageList.get.all.db().length).toBe(3);
    });

    it('should trim stored messages in processInputStep when called from legacy/workflow paths (unmarked)', async () => {
      // Legacy (generateLegacy/streamLegacy) and workflow-nested paths call
      // processInputStep without llmRequestStage. Verify the limiter still
      // applies best-fit trimming to keep stored history bounded in that case.
      const limiter = new TokenLimiterProcessor({ limit: 50 });
      const messageList = new MessageList();

      messageList.add(
        {
          id: 'user-1',
          role: 'user',
          content: { format: 2, content: 'First message', parts: [{ type: 'text', text: 'First message' }] },
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        'memory',
      );
      messageList.add(
        {
          id: 'user-2',
          role: 'user',
          content: {
            format: 2,
            content: 'A longer second message that should push us over the token budget with the first',
            parts: [
              {
                type: 'text',
                text: 'A longer second message that should push us over the token budget with the first',
              },
            ],
          },
          createdAt: new Date('2023-01-01T00:01:00Z'),
        },
        'memory',
      );
      messageList.add(
        {
          id: 'user-3',
          role: 'user',
          content: { format: 2, content: 'Third message', parts: [{ type: 'text', text: 'Third message' }] },
          createdAt: new Date('2023-01-01T00:02:00Z'),
        },
        'input',
      );

      expect(messageList.get.all.db()).toHaveLength(3);

      // No llmRequestStage — simulates legacy/workflow-nested dispatch
      await limiter.processInputStep({
        messageList,
        stepNumber: 1,
        model: createMockModel(),
        steps: [],
        systemMessages: [],
        state: {},
        retryCount: 0,
        abort: mockAbort,
      });

      // Stored messages should have been trimmed (oldest removed)
      const remaining = messageList.get.all.db().map(m => m.id);
      expect(remaining.length).toBeLessThan(3);

      // Newest message should survive
      expect(remaining).toContain('user-3');
    });
  });

  describe('capping oversized tool results via processToolResult (#24110)', () => {
    const at = (n: number) => new Date(Date.UTC(2024, 0, 1, 0, 0, n));
    const toolResult = (id: string, result: unknown, n: number): MastraDBMessage => ({
      id,
      role: 'assistant',
      content: {
        format: 2,
        content: '',
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: `call-${id}`, toolName: 'lookup', args: {}, result },
          },
        ],
      },
      createdAt: at(n),
    });

    const pendingToolCall = (id: string, n: number): MastraDBMessage => ({
      id,
      role: 'assistant',
      content: {
        format: 2,
        content: '',
        parts: [{ type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId: `call-${id}`, toolName: 'lookup', args: {} } }],
      },
      createdAt: at(n),
    });

    const runProcessToolResult = (processor: TokenLimiterProcessor, messageList: MessageList, id: string, result: unknown) =>
      processor.processToolResult({
        result,
        toolCallId: `call-${id}`,
        toolName: 'lookup',
        args: {},
        messageList,
        steps: [],
        systemMessages: [],
        state: {},
      } as any);

    it('caps an oversized tool result for the model and keeps the stored result intact', async () => {
      const big = 'word '.repeat(2000);
      const processor = new TokenLimiterProcessor({ limit: 400, maxToolResultTokens: 50 });
      const messageList = new MessageList();
      messageList.add(toolResult('tool-now', big, 1), 'response');

      await runProcessToolResult(processor, messageList, 'tool-now', big);

      const stored = messageList.get.all.db().find(m => m.id === 'tool-now')!;
      const part = stored.content.parts[0] as any;
      expect(part.toolInvocation.result).toBe(big);
      const modelOutput = part.providerMetadata?.mastra?.modelOutput;
      expect(modelOutput.type).toBe('text');
      expect(modelOutput.value).toMatch(/\[truncated: showing \d+ of [\d,]+ tokens\]$/);
      expect(modelOutput.value.length).toBeLessThan(big.length);
    });

    it('does not promote toolInvocation state or write the result field (only providerMetadata)', async () => {
      // Regression: promoting state to 'result' here (before the rest of the output-processor
      // chain, including its TripWire checkpoint, has run) would leave an unvetted part behind
      // with no rollback if a later processor throws TripWire. The cap must only ever touch
      // `providerMetadata`, leaving state/result for whichever step is actually responsible for
      // committing the tool result.
      const big = 'word '.repeat(2000);
      const processor = new TokenLimiterProcessor({ limit: 400, maxToolResultTokens: 50 });
      const messageList = new MessageList();
      messageList.add(pendingToolCall('tool-now', 1), 'response');

      await runProcessToolResult(processor, messageList, 'tool-now', big);

      const part = messageList.get.all.db().find(m => m.id === 'tool-now')!.content.parts[0] as any;
      expect(part.toolInvocation.state).toBe('call');
      expect(part.toolInvocation.result).toBeUndefined();
      expect(part.providerMetadata?.mastra?.modelOutput?.type).toBe('text');
    });

    it('leaves results under maxToolResultTokens untouched', async () => {
      const processor = new TokenLimiterProcessor({ limit: 400, maxToolResultTokens: 50 });
      const messageList = new MessageList();
      messageList.add(toolResult('tool-now', { ok: true }, 1), 'response');

      await runProcessToolResult(processor, messageList, 'tool-now', { ok: true });

      const part = messageList.get.all.db().find(m => m.id === 'tool-now')!.content.parts[0] as any;
      expect(part.providerMetadata?.mastra?.modelOutput).toBeUndefined();
    });

    it('does not attach a processToolResult hook when maxToolResultTokens is unset', () => {
      // The agentic loop checks `'processToolResult' in processor` to decide whether
      // to hold eager tool dispatch back for the output-processor pipeline. An
      // always-present hook here would force that slower path even when this
      // processor has nothing to cap, so the hook must not exist at all in this case.
      const processor = new TokenLimiterProcessor({ limit: 400 });
      expect(processor.processToolResult).toBeUndefined();
      expect('processToolResult' in processor).toBe(false);
    });

    it('a real toModelOutput mapping always wins over this cap (via computeModelOutputProviderMetadata)', async () => {
      // This processor's own hook has no visibility into a tool's `toModelOutput`
      // mapping -- that mapping is computed and committed by the engine *after*
      // this hook runs (see computeModelOutputProviderMetadata in
      // tool-result-commit-core.ts), and its write always wins on the
      // `modelOutput` key. Reproduce that ordering directly here.
      const { computeModelOutputProviderMetadata } = await import('../../loop/shared/steps/tool-result-commit-core');
      const processor = new TokenLimiterProcessor({ limit: 400, maxToolResultTokens: 5 });
      const messageList = new MessageList();
      const big = 'word '.repeat(2000);
      messageList.add(toolResult('tool-now', big, 1), 'response');

      // This processor's hook runs first and caps the result.
      await runProcessToolResult(processor, messageList, 'tool-now', big);
      const cappedPart = messageList.get.all.db().find(m => m.id === 'tool-now')!.content.parts[0] as any;
      expect(cappedPart.providerMetadata?.mastra?.modelOutputCapped).toBe(true);

      // The engine's own commit then runs with a real toModelOutput mapping,
      // using the cap's own output as `existingProviderMetadata` (the same
      // shape it would read off the in-flight commit).
      const providerMetadata = await computeModelOutputProviderMetadata({
        tool: { toModelOutput: () => 'already mapped' },
        toolName: 'lookup',
        toolCallId: 'call-tool-now',
        result: big,
        existingProviderMetadata: cappedPart.providerMetadata,
      });

      expect((providerMetadata?.mastra as any)?.modelOutput).toBe('already mapped');
      // The stale cap flag must be cleared, not left behind -- otherwise persistence
      // filtering would mistake this permanent mapping for a transient cap and strip it.
      expect((providerMetadata?.mastra as any)?.modelOutputCapped).toBeUndefined();
    });

    it('rejects a non-positive maxToolResultTokens', () => {
      expect(() => new TokenLimiterProcessor({ limit: 100, maxToolResultTokens: 0 })).toThrow(/maxToolResultTokens/);
    });

    it('falls back to an empty string when the cap is too small for even the bare marker (cap=5)', async () => {
      // Policy: a cap smaller than the marker text itself cannot produce a truncation
      // notice that fits its own budget, so capText returns '' rather than emitting a
      // marker that overflows the configured cap. This is asserted explicitly (not a
      // silent early-return in the parametrized test below) so the policy stays covered.
      const big = 'word '.repeat(20000);
      const processor = new TokenLimiterProcessor({ limit: 400, maxToolResultTokens: 5 });
      const messageList = new MessageList();
      messageList.add(toolResult('tool-now', big, 1), 'response');

      await runProcessToolResult(processor, messageList, 'tool-now', big);

      const part = messageList.get.all.db().find(m => m.id === 'tool-now')!.content.parts[0] as any;
      expect(part.providerMetadata.mastra.modelOutput.value).toBe('');
    });

    it.each([20, 50, 1234])(
      'always emits a truncation marker whose reported count matches the actual tokens shown (cap=%i)',
      async cap => {
        // 20,000 tokens of content so even the cap=1234 case leaves a "shown" count
        // >= 1000 -- large enough to hit the toLocaleString comma-formatting path
        // (e.g. "1,220") in both the shown-count and total-count parts of the marker.
        const big = 'word '.repeat(20000);
        const processor = new TokenLimiterProcessor({ limit: 400, maxToolResultTokens: cap });
        const messageList = new MessageList();
        messageList.add(toolResult('tool-now', big, 1), 'response');

        await runProcessToolResult(processor, messageList, 'tool-now', big);

        const part = messageList.get.all.db().find(m => m.id === 'tool-now')!.content.parts[0] as any;
        const value: string = part.providerMetadata.mastra.modelOutput.value;

        // Both the shown-count and the total-count are formatted with toLocaleString,
        // so either can carry thousands separators (e.g. "1,220") once >= 1000.
        const match = value.match(/\[truncated: showing ([\d,]+) of ([\d,]+) tokens\]$/);
        expect(match).not.toBeNull();
        const reportedShown = Number(match![1].replace(/,/g, ''));
        const slice = value.slice(0, value.length - match![0].length);
        // The marker's reported count must match the actual token count of the slice it
        // describes (not the requested cap) -- Tyler's review found cases where the two diverged.
        expect(estimateTokenCount(slice)).toBe(reportedShown);
        // The whole capped payload (slice + marker) must always fit inside the requested cap,
        // for every cap size tested, including caps >= 1000.
        expect(estimateTokenCount(value)).toBeLessThanOrEqual(cap);
        // cap=1234 must actually exercise the comma-formatting path -- the marker's
        // total-count part reports M >= 1000 with a thousands separator.
        if (cap === 1234) {
          expect(match![2]).toContain(',');
        }
      },
    );

    it('does not crash on a circular result, and leaves it uncapped', async () => {
      const circular: Record<string, unknown> = { data: 'x'.repeat(10_000) };
      circular.self = circular;
      const processor = new TokenLimiterProcessor({ limit: 400, maxToolResultTokens: 50 });
      const messageList = new MessageList();
      messageList.add(toolResult('tool-now', circular, 1), 'response');

      // JSON.stringify throws on circular references; the hook must catch that
      // and leave the result uncapped rather than crashing the run.
      await expect(runProcessToolResult(processor, messageList, 'tool-now', circular)).resolves.not.toThrow();

      const part = messageList.get.all.db().find(m => m.id === 'tool-now')!.content.parts[0] as any;
      expect(part.providerMetadata?.mastra?.modelOutput).toBeUndefined();
    });

    it('does not crash on a result containing a bigint, and caps it', async () => {
      const withBigint = { count: 123n, data: 'word '.repeat(2000) };
      const processor = new TokenLimiterProcessor({ limit: 400, maxToolResultTokens: 50 });
      const messageList = new MessageList();
      messageList.add(toolResult('tool-now', withBigint, 1), 'response');

      // JSON.stringify throws on bigint without a replacer; the hook must serialize
      // bigints safely (e.g. via a replacer) instead of crashing the run.
      await expect(runProcessToolResult(processor, messageList, 'tool-now', withBigint)).resolves.not.toThrow();

      const part = messageList.get.all.db().find(m => m.id === 'tool-now')!.content.parts[0] as any;
      const modelOutput = part.providerMetadata?.mastra?.modelOutput;
      expect(modelOutput?.value).toMatch(/\[truncated: showing \d+ of [\d,]+ tokens\]$/);
    });

    it('caps regardless of trimMode, including memory-only', async () => {
      const big = 'word '.repeat(2000);
      const processor = new TokenLimiterProcessor({ limit: 400, maxToolResultTokens: 50, trimMode: 'memory-only' });
      const messageList = new MessageList();
      messageList.add(toolResult('tool-now', big, 1), 'response');

      await runProcessToolResult(processor, messageList, 'tool-now', big);

      const part = messageList.get.all.db().find(m => m.id === 'tool-now')!.content.parts[0] as any;
      const modelOutput = part.providerMetadata?.mastra?.modelOutput;
      expect(modelOutput?.value).toMatch(/\[truncated: showing \d+ of [\d,]+ tokens\]$/);
    });
  });
});
