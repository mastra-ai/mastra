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

  it('is exposed on the stream result', async () => {
    const stream = await createAgent(textModel('[1, 2, 3]')).stream('Summarize the directory.', {
      structuredOutput: { schema, errorStrategy: 'fallback', fallbackValue },
    });

    expect(await stream.object).toEqual(fallbackValue);
    expect(stream.usedFallbackValue).toBe(true);
    expect((await stream.getFullOutput()).usedFallbackValue).toBe(true);
  });
});
