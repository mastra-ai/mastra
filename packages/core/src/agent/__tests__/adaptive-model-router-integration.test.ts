import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import type * as LoopModule from '../../loop';
import { AdaptiveModelRouter } from '../../processors';

const loopModelCounts: number[] = [];

vi.mock('../../loop', async importOriginal => {
  const actual = await importOriginal<typeof LoopModule>();
  return {
    ...actual,
    loop: (options: Parameters<typeof actual.loop>[0]) => {
      loopModelCounts.push(options.models.length);
      return actual.loop(options);
    },
  };
});

const { Agent } = await import('../agent');

function createStreamModel(modelId: string, responseText: string, statusCode?: number) {
  return new MockLanguageModelV2({
    modelId,
    doStream: async () => {
      if (statusCode) {
        throw new APICallError({
          message: `Status ${statusCode}`,
          url: 'https://api.example.com',
          requestBodyValues: {},
          statusCode,
          isRetryable: false,
        });
      }

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId, timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: responseText },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
        ]),
      };
    },
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      text: responseText,
      content: [{ type: 'text', text: responseText }],
      warnings: [],
    }),
  });
}

describe('AdaptiveModelRouter fallback integration', () => {
  it('passes one model to the LLM loop for legacy model fallback arrays', async () => {
    loopModelCounts.length = 0;
    const primary = createStreamModel('primary-router-loop', '', 429);
    const secondary = createStreamModel('secondary-router-loop', 'secondary response');

    const agent = new Agent({
      id: 'adaptive-router-loop-model-count',
      name: 'Adaptive Router Loop Model Count Test',
      instructions: 'You are a test agent',
      model: [
        { id: 'primary', model: primary, maxRetries: 0 },
        { id: 'secondary', model: secondary, maxRetries: 0 },
      ],
    });

    await (
      await agent.stream('Hello')
    ).text;

    expect(loopModelCounts).toEqual([1]);
    expect(primary.doStreamCalls).toHaveLength(1);
    expect(secondary.doStreamCalls).toHaveLength(1);
  });

  it('passes one model to the LLM loop when explicitly configured as a processor', async () => {
    loopModelCounts.length = 0;
    const primary = createStreamModel('explicit-primary-router-loop', '', 429);
    const secondary = createStreamModel('explicit-secondary-router-loop', 'secondary response');
    const router = new AdaptiveModelRouter({
      models: [
        { id: 'primary', model: primary, maxRetries: 0 },
        { id: 'secondary', model: secondary, maxRetries: 0 },
      ],
    });

    const agent = new Agent({
      id: 'explicit-adaptive-router-loop-model-count',
      name: 'Explicit Adaptive Router Loop Model Count Test',
      instructions: 'You are a test agent',
      model: primary,
      inputProcessors: [router],
      errorProcessors: [router],
    });

    await (
      await agent.stream('Hello')
    ).text;

    expect(loopModelCounts).toEqual([1]);
    expect(primary.doStreamCalls).toHaveLength(1);
    expect(secondary.doStreamCalls).toHaveLength(1);
  });
});
