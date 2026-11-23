import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';

function textModel(text: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text', text }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
    }),
  });
}

describe('structured output usedFallbackValue', () => {
  const schema = z.object({ summary: z.string(), filesFound: z.number() });
  const valid = { summary: 'There are 3 files in the directory.', filesFound: 3 };
  const fallbackValue = { summary: 'unknown', filesFound: 0 };

  function createAgent(model: MockLanguageModelV2) {
    return new Agent({
      id: 'structured-output-fallback',
      name: 'Structured Output Fallback',
      instructions: 'You are a helpful assistant.',
      model,
    });
  }

  it('is true when the model output fails validation and the fallback value is returned', async () => {
    const result = await createAgent(textModel('[1, 2, 3]')).generate('Summarize the directory.', {
      structuredOutput: { schema, errorStrategy: 'fallback', fallbackValue },
    });

    expect(result.object).toEqual(fallbackValue);
    expect(result.usedFallbackValue).toBe(true);
    expect(result.finishReason).toBe('stop');
    expect(result.tripwire).toBeUndefined();
  });

  it('is false when the model output validates', async () => {
    const result = await createAgent(textModel(JSON.stringify(valid))).generate('Summarize the directory.', {
      structuredOutput: { schema, errorStrategy: 'fallback', fallbackValue },
    });

    expect(result.object).toEqual(valid);
    expect(result.usedFallbackValue).toBe(false);
  });

  it('is true when the separate structuring model fails and the fallback value is returned', async () => {
    const result = await createAgent(textModel('There are 3 files in the directory.')).generate(
      'Summarize the directory.',
      {
        structuredOutput: { schema, model: textModel('[1, 2, 3]'), errorStrategy: 'fallback', fallbackValue },
      },
    );

    expect(result.object).toEqual(fallbackValue);
    expect(result.usedFallbackValue).toBe(true);
  });

  it('is false under errorStrategy warn, which leaves the object undefined', async () => {
    const result = await createAgent(textModel('[1, 2, 3]')).generate('Summarize the directory.', {
      structuredOutput: { schema, errorStrategy: 'warn' },
    });

    expect(result.object).toBeUndefined();
    expect(result.usedFallbackValue).toBe(false);
  });

  it('is reported to the onFinish callback alongside the substituted object', async () => {
    let payload: { object?: unknown; usedFallbackValue?: boolean } | undefined;
    const result = await createAgent(textModel('[1, 2, 3]')).generate('Summarize the directory.', {
      structuredOutput: { schema, errorStrategy: 'fallback', fallbackValue },
      onFinish: p => {
        payload = p;
      },
    });

    expect(result.usedFallbackValue).toBe(true);
    expect(payload?.object).toEqual(fallbackValue);
    expect(payload?.usedFallbackValue).toBe(true);
  });

  it('is reported to the onFinish callback when the separate structuring model fails', async () => {
    let payload: { object?: unknown; usedFallbackValue?: boolean } | undefined;
    await createAgent(textModel('There are 3 files in the directory.')).generate('Summarize the directory.', {
      structuredOutput: { schema, model: textModel('[1, 2, 3]'), errorStrategy: 'fallback', fallbackValue },
      onFinish: p => {
        payload = p;
      },
    });

    expect(payload?.object).toEqual(fallbackValue);
    expect(payload?.usedFallbackValue).toBe(true);
  });

  it('reads false on a fresh stream and true once the object has been awaited', async () => {
    const stream = await createAgent(textModel('[1, 2, 3]')).stream('Summarize the directory.', {
      structuredOutput: { schema, errorStrategy: 'fallback', fallbackValue },
    });

    expect(stream.usedFallbackValue).toBe(false);
    expect(await stream.object).toEqual(fallbackValue);
    expect(stream.usedFallbackValue).toBe(true);
  });

  it('does not carry the flag from a discarded attempt onto the surviving one', async () => {
    let calls = 0;
    const model = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text' as const, text: ++calls === 1 ? '[1, 2, 3]' : JSON.stringify(valid) }],
        warnings: [],
      }),
      doStream: async () => {
        const text = ++calls === 1 ? '[1, 2, 3]' : JSON.stringify(valid);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start' as const, warnings: [] },
            { type: 'response-metadata' as const, id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start' as const, id: 'text-1' },
            { type: 'text-delta' as const, id: 'text-1', delta: text },
            { type: 'text-end' as const, id: 'text-1' },
            {
              type: 'finish' as const,
              finishReason: 'stop' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      },
    });

    let retried = false;
    const result = await createAgent(model).generate('Summarize the directory.', {
      maxProcessorRetries: 1,
      structuredOutput: { schema, errorStrategy: 'fallback', fallbackValue },
      outputProcessors: [
        {
          id: 'retry-once',
          processOutputStep: ({ messages, abort }) => {
            if (!retried) {
              retried = true;
              abort('retry once', { retry: true });
            }
            return messages;
          },
        },
      ],
    });

    expect(retried).toBe(true);
    expect(calls).toBe(2);
    expect(result.object).toEqual(valid);
    expect(result.usedFallbackValue).toBe(false);
  });

  it('is exposed on the stream result', async () => {
    const stream = await createAgent(textModel('[1, 2, 3]')).stream('Summarize the directory.', {
      structuredOutput: { schema, errorStrategy: 'fallback', fallbackValue },
    });

    expect(await stream.object).toEqual(fallbackValue);
    expect(stream.usedFallbackValue).toBe(true);
    expect((await stream.getFullOutput()).usedFallbackValue).toBe(true);
  });
});
