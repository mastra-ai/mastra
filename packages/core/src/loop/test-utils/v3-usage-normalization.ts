import { convertAsyncIterableToArray } from '@ai-sdk/provider-utils-v5/test';
import { convertArrayToReadableStream, mockId } from '@internal/ai-v6/test';
import { describe, expect, it } from 'vitest';
import type { loop } from '../loop';
import { MastraLanguageModelV3Mock } from './MastraLanguageModelV3Mock';
import { createMessageListWithUserMessage, testUsageV3, testUsageV3_2 } from './utils-v3';

/**
 * Tests specifically for V3 (AI SDK v6) usage normalization.
 * V3 models return nested usage objects:
 *   { inputTokens: { total, noCache, cacheRead, cacheWrite }, outputTokens: { total, text, reasoning } }
 *
 * Mastra normalizes this to flat format:
 *   { inputTokens, outputTokens, totalTokens, reasoningTokens, cachedInputTokens }
 */
export function v3UsageNormalizationTests({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  describe('V3 usage normalization', () => {
    it('should normalize v3 nested usage to flat format in finish chunk', async () => {
      const model = new MastraLanguageModelV3Mock({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsageV3 },
          ]),
        }),
        doGenerate: async () => ({
          content: [{ type: 'text' as const, text: 'Hello' }],
          finishReason: 'stop',
          usage: testUsageV3,
          warnings: [],
        }),
      });

      const result = loopFn({
        methodType: 'stream',
        agentId: 'agent-id',
        runId,
        models: [{ model, maxRetries: 0, id: 'test-model' }],
        messageList: createMessageListWithUserMessage(),
        _internal: { generateId: mockId({ prefix: 'id' }) },
      });

      const chunks = await convertAsyncIterableToArray(result.fullStream);
      const finishChunk = chunks.find(c => c.type === 'finish');

      expect(finishChunk).toBeDefined();
      // V3 input: { inputTokens: { total: 3 }, outputTokens: { total: 10 } }
      // Expected flat output:
      expect(finishChunk?.payload.output.usage).toEqual({
        inputTokens: 3,
        outputTokens: 10,
        totalTokens: 13,
        reasoningTokens: undefined,
        cachedInputTokens: undefined,
      });
    });

    it('should preserve reasoning tokens from v3 format', async () => {
      // testUsageV3_2 has: outputTokens.reasoning = 10, inputTokens.cacheRead = 3
      const model = new MastraLanguageModelV3Mock({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsageV3_2 },
          ]),
        }),
        doGenerate: async () => ({
          content: [{ type: 'text' as const, text: 'Hello' }],
          finishReason: 'stop',
          usage: testUsageV3_2,
          warnings: [],
        }),
      });

      const result = loopFn({
        methodType: 'stream',
        agentId: 'agent-id',
        runId,
        models: [{ model, maxRetries: 0, id: 'test-model' }],
        messageList: createMessageListWithUserMessage(),
        _internal: { generateId: mockId({ prefix: 'id' }) },
      });

      const chunks = await convertAsyncIterableToArray(result.fullStream);
      const finishChunk = chunks.find(c => c.type === 'finish');

      expect(finishChunk).toBeDefined();
      expect(finishChunk?.payload.output.usage).toEqual({
        inputTokens: 3,
        outputTokens: 10,
        totalTokens: 13,
        reasoningTokens: 10, // from outputTokens.reasoning
        cachedInputTokens: 3, // from inputTokens.cacheRead
      });
    });

    it('should correctly stream text from v3 model', async () => {
      const model = new MastraLanguageModelV3Mock({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello' },
            { type: 'text-delta', id: 'text-1', delta: ', ' },
            { type: 'text-delta', id: 'text-1', delta: 'world!' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsageV3 },
          ]),
        }),
        doGenerate: async () => ({
          content: [{ type: 'text' as const, text: 'Hello, world!' }],
          finishReason: 'stop',
          usage: testUsageV3,
          warnings: [],
        }),
      });

      const result = loopFn({
        methodType: 'stream',
        agentId: 'agent-id',
        runId,
        models: [{ model, maxRetries: 0, id: 'test-model' }],
        messageList: createMessageListWithUserMessage(),
        _internal: { generateId: mockId({ prefix: 'id' }) },
      });

      const chunks = await convertAsyncIterableToArray(result.fullStream);
      const textDeltas = chunks.filter(c => c.type === 'text-delta');

      expect(textDeltas).toHaveLength(3);
      expect(textDeltas.map(c => c.payload.text)).toEqual(['Hello', ', ', 'world!']);
    });
  });
}
