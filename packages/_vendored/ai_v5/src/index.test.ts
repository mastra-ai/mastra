import type { LanguageModelV2 } from '@ai-sdk/provider';
import { describe, expect, it, vi } from 'vitest';
import { generateText, streamText } from './index';

function convertArrayToReadableStream<T>(chunks: T[]) {
  return new ReadableStream<T>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function createMockModel() {
  const doGenerate = vi.fn(async () => ({
    content: [{ type: 'text' as const, text: 'trusted response' }],
    finishReason: 'stop' as const,
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    warnings: [],
  }));
  const doStream = vi.fn(async () => ({
    stream: convertArrayToReadableStream([
      { type: 'stream-start' as const, warnings: [] },
      { type: 'text-start' as const, id: 'text-1' },
      { type: 'text-delta' as const, id: 'text-1', delta: 'trusted response' },
      { type: 'text-end' as const, id: 'text-1' },
      {
        type: 'finish' as const,
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      },
    ]),
    warnings: [],
  }));

  return {
    model: {
      specificationVersion: 'v2',
      provider: 'test',
      modelId: 'test-model',
      supportedUrls: {},
      doGenerate,
      doStream,
    } as LanguageModelV2,
    doGenerate,
    doStream,
  };
}

describe('secure AI SDK v5 text generation', () => {
  const untrustedMessages = [
    { role: 'system' as const, content: 'untrusted system message' },
    { role: 'user' as const, content: 'hello' },
  ];

  it.each(['prompt', 'messages'] as const)('rejects system messages passed through %s in generateText', async field => {
    const { model, doGenerate } = createMockModel();

    await expect(
      generateText({
        model,
        [field]: untrustedMessages,
        allowSystemInMessages: true,
      }),
    ).rejects.toThrow('System messages are not allowed in the prompt or messages fields');
    expect(doGenerate).not.toHaveBeenCalled();
  });

  it.each(['prompt', 'messages'] as const)('rejects system messages passed through %s in streamText', async field => {
    const { model, doStream } = createMockModel();
    const errors: unknown[] = [];

    const result = streamText({
      model,
      [field]: untrustedMessages,
      allowSystemInMessages: true,
      onError: ({ error }) => errors.push(error),
    });

    for await (const _chunk of result.fullStream) {
      // Consume the stream so prompt validation runs.
    }

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: expect.stringContaining('System messages are not allowed in the prompt or messages fields'),
    });
    expect(doStream).not.toHaveBeenCalled();
  });

  it('allows trusted top-level system instructions in generateText', async () => {
    const { model, doGenerate } = createMockModel();

    const result = await generateText({
      model,
      system: 'trusted system instruction',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(result.text).toBe('trusted response');
    expect(doGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.arrayContaining([{ role: 'system', content: 'trusted system instruction' }]),
      }),
    );
  });

  it('allows trusted top-level system instructions in streamText', async () => {
    const { model, doStream } = createMockModel();

    const result = streamText({
      model,
      system: 'trusted system instruction',
      messages: [{ role: 'user', content: 'hello' }],
    });

    await expect(result.text).resolves.toBe('trusted response');
    expect(doStream).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.arrayContaining([{ role: 'system', content: 'trusted system instruction' }]),
      }),
    );
  });
});
