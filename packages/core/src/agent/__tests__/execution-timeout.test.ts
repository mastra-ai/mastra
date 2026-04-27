import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';

function timeoutAwareModel({
  modelId = 'slow-model',
  text = 'slow response',
}: { modelId?: string; text?: string } = {}) {
  return new MockLanguageModelV2({
    provider: 'test-provider',
    modelId,
    doGenerate: async ({ abortSignal }) => {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 100);
        abortSignal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          },
          { once: true },
        );
      });

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text' as const, text }],
        warnings: [],
      };
    },
    doStream: async ({ abortSignal }) => {
      return await new Promise((_, reject) => {
        abortSignal?.addEventListener(
          'abort',
          () => reject(new DOMException('The operation was aborted.', 'AbortError')),
          { once: true },
        );
      });
    },
  });
}

function textModel(text: string, { modelId = 'fast-model' }: { modelId?: string } = {}) {
  return new MockLanguageModelV2({
    provider: 'test-provider',
    modelId,
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: 'text', text }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        {
          type: 'response-metadata',
          id: `${modelId}-response`,
          modelId,
          timestamp: new Date(0),
        },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

describe('agent execution timeout', () => {
  it('fails a run when the agent-level execution timeout is reached', async () => {
    const agent = new Agent({
      id: 'timeout-fail-agent',
      name: 'Timeout Fail Agent',
      instructions: 'You are a test agent.',
      model: timeoutAwareModel(),
      execution: {
        maxExecutionMs: 10,
        onTimeout: { strategy: 'fail' },
      },
    });

    await expect(agent.generate('hello')).rejects.toMatchObject({
      code: 'AGENT_EXECUTION_TIMEOUT',
    });
  });

  it('uses run-level execution timeout overrides', async () => {
    const agent = new Agent({
      id: 'timeout-override-agent',
      name: 'Timeout Override Agent',
      instructions: 'You are a test agent.',
      model: timeoutAwareModel(),
      execution: {
        maxExecutionMs: 1_000,
        onTimeout: { strategy: 'fail' },
      },
    });

    const startedAt = Date.now();

    await expect(
      agent.generate('hello', {
        execution: {
          maxExecutionMs: 10,
          onTimeout: { strategy: 'fail' },
        },
      }),
    ).rejects.toMatchObject({
      code: 'AGENT_EXECUTION_TIMEOUT',
    });

    expect(Date.now() - startedAt).toBeLessThan(500);
  });

  it('falls back to the next model when timeout strategy is fallback-model', async () => {
    const slowModel = timeoutAwareModel({ modelId: 'slow-primary' });
    const fallbackModel = textModel('fallback response', { modelId: 'fast-fallback' });

    const agent = new Agent({
      id: 'timeout-fallback-agent',
      name: 'Timeout Fallback Agent',
      instructions: 'You are a test agent.',
      model: [
        { model: slowModel, maxRetries: 0 },
        { model: fallbackModel, maxRetries: 0 },
      ],
      execution: {
        maxExecutionMs: 10,
        onTimeout: {
          strategy: 'fallback-model',
          maxFallbackHops: 1,
        },
      },
    });

    const result = await agent.generate('hello');

    expect(result.text).toBe('fallback response');
  });
});
