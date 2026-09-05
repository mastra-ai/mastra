import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { isMastraTimeoutError } from '../../../loop/timeout';
import { execute } from './execute';

const inputMessages = [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'hello' }] }];

const runExecute = async ({
  model,
  stepMs,
  firstChunkMs,
  maxRetries,
}: {
  model: MockLanguageModelV2;
  stepMs?: number;
  firstChunkMs?: number;
  maxRetries?: number;
}) => {
  const stream = execute({
    runId: 'test-run-id',
    model: model as any,
    inputMessages,
    tools: {},
    methodType: 'stream',
    modelSettings: { maxRetries, timeout: stepMs || firstChunkMs ? { stepMs, firstChunkMs } : undefined },
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

describe('modelSettings.timeout.firstChunkMs', () => {
  it('times out when only non-content metadata arrives', async () => {
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
          },
        }),
      }),
    });

    await expect(runExecute({ model, firstChunkMs: 50, maxRetries: 0 })).rejects.toMatchObject({
      timeoutType: 'firstChunk',
    });
  });

  it('clears the first-content budget after a content chunk arrives', async () => {
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'partial' });
            await new Promise(resolve => setTimeout(resolve, 80));
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

    const chunks = await runExecute({ model, firstChunkMs: 50, maxRetries: 0 });
    expect(chunks.some(chunk => chunk.type === 'text-delta')).toBe(true);
  });

  it.each([
    {
      name: 'reasoning delta',
      chunks: [
        { type: 'reasoning-start', id: 'reasoning-1' },
        { type: 'reasoning-delta', id: 'reasoning-1', delta: 'thinking' },
        { type: 'reasoning-end', id: 'reasoning-1' },
      ],
    },
    {
      name: 'tool call',
      chunks: [{ type: 'tool-call', toolCallId: 'tool-1', toolName: 'lookup', input: '{}' }],
    },
  ])('treats a $name as first content', async ({ chunks: contentChunks }) => {
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: new ReadableStream({
          async start(controller) {
            for (const chunk of contentChunks) controller.enqueue(chunk);
            await new Promise(resolve => setTimeout(resolve, 80));
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

    const chunks = await runExecute({ model, firstChunkMs: 50, maxRetries: 0 });
    expect(chunks.some(chunk => contentChunks.some(content => content.type === chunk.type))).toBe(true);
  });

  it('gives each retry attempt a fresh first-content budget', async () => {
    let attempt = 0;
    const doStream = vi.fn(async () => {
      attempt++;
      if (attempt === 1) throw new Error('retry me');

      return {
        stream: new ReadableStream({
          async start(controller) {
            await new Promise(resolve => setTimeout(resolve, 750));
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'done' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
      };
    });
    const model = new MockLanguageModelV2({ doStream: doStream as any });

    const chunks = await runExecute({ model, firstChunkMs: 1_500, maxRetries: 1 });

    expect(chunks.some(chunk => chunk.type === 'text-delta')).toBe(true);
    expect(doStream).toHaveBeenCalledTimes(2);
  }, 5_000);

  it('does not retry the same model after a first-content timeout', async () => {
    const doStream = vi.fn(async () => ({ stream: new ReadableStream() }));
    const model = new MockLanguageModelV2({ doStream: doStream as any });

    await expect(runExecute({ model, firstChunkMs: 50, maxRetries: 3 })).rejects.toSatisfy(isMastraTimeoutError);
    expect(doStream).toHaveBeenCalledTimes(1);
  });
});
