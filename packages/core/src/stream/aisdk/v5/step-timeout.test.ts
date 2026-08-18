import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { isMastraTimeoutError } from '../../../loop/timeout';
import { execute } from './execute';

const inputMessages = [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'hello' }] }];

const runExecute = async ({
  model,
  stepMs,
  maxRetries,
}: {
  model: MockLanguageModelV2;
  stepMs?: number;
  maxRetries?: number;
}) => {
  const stream = execute({
    runId: 'test-run-id',
    model: model as any,
    inputMessages,
    tools: {},
    methodType: 'stream',
    modelSettings: { maxRetries, timeout: stepMs ? { stepMs } : undefined },
    shouldThrowError: true,
    onResult: () => {},
    options: {},
  } as any);

  const chunks: any[] = [];
  for await (const chunk of stream as any) {
    chunks.push(chunk);
  }
  return chunks;
};

describe('modelSettings.timeout.stepMs', () => {
  it('times out a model that never establishes a stream', async () => {
    const model = new MockLanguageModelV2({ doStream: () => new Promise(() => {}) });

    await expect(runExecute({ model, stepMs: 50, maxRetries: 0 })).rejects.toSatisfy(isMastraTimeoutError);
  });

  it('times out a model that opens a stream then stalls mid-emission', async () => {
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'partial' });
            // Never closes: the budget must still fire while the stream is being read.
          },
        }),
      }),
    });

    await expect(runExecute({ model, stepMs: 50, maxRetries: 0 })).rejects.toSatisfy(isMastraTimeoutError);
  });

  it('does not retry the same model after a step timeout', async () => {
    const doStream = vi.fn(() => new Promise(() => {}));
    const model = new MockLanguageModelV2({ doStream: doStream as any });

    await expect(runExecute({ model, stepMs: 50, maxRetries: 3 })).rejects.toSatisfy(isMastraTimeoutError);
    expect(doStream).toHaveBeenCalledTimes(1);
  });

  it('leaves calls that finish within the budget untouched', async () => {
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'done' });
            controller.enqueue({ type: 'text-end', id: 'text-1' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
      }),
    });

    const chunks = await runExecute({ model, stepMs: 30_000, maxRetries: 0 });

    expect(chunks.some(chunk => chunk.type === 'text-delta')).toBe(true);
    expect(chunks.some(chunk => chunk.type === 'error')).toBe(false);
  });
});
