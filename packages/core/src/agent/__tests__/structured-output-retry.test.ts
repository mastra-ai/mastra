import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';

function textModel(texts: string[]) {
  let call = 0;
  const nextText = () => texts[Math.min(call++, texts.length - 1)]!;
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text', text: nextText() }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: nextText() },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
    }),
  });
}

describe('structured output retries with a separate structuring model', () => {
  const schema = z.object({ summary: z.string(), filesFound: z.number() });
  const valid = { summary: 'There are 3 files in the directory.', filesFound: 3 };
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  function createAgent() {
    return new Agent({
      id: 'structured-output-retry',
      name: 'Structured Output Retry',
      instructions: 'You are a helpful assistant.',
      model: textModel(['There are 3 files in the directory.']),
    });
  }

  it('retries the step when the structuring run fails and maxProcessorRetries allows it', async () => {
    const structuringModel = textModel(['[1, 2, 3]', JSON.stringify(valid)]);

    const result = await createAgent().generate('Summarize the directory.', {
      maxProcessorRetries: 1,
      structuredOutput: { schema, model: structuringModel },
    });

    expect(result.object).toEqual(valid);
    expect(result.tripwire).toBeUndefined();
    expect(result.finishReason).toBe('stop');
    expect(structuringModel.doStreamCalls).toHaveLength(2);
  });

  it('ends the run with a retryable tripwire once the retry budget is exhausted', async () => {
    const structuringModel = textModel(['[1, 2, 3]']);

    const result = await createAgent().generate('Summarize the directory.', {
      maxProcessorRetries: 1,
      structuredOutput: { schema, model: structuringModel },
    });

    expect(result.object).toBeUndefined();
    expect(result.tripwire?.reason).toContain('Structured output validation failed');
    expect(result.tripwire?.retry).toBe(true);
    expect(result.tripwire?.processorId).toBe('structured-output');
    expect(structuringModel.doStreamCalls).toHaveLength(2);
  });

  it('ends the run with a tripwire without retrying when maxProcessorRetries is unset', async () => {
    const structuringModel = textModel(['[1, 2, 3]']);

    const result = await createAgent().generate('Summarize the directory.', {
      structuredOutput: { schema, model: structuringModel },
    });

    expect(result.object).toBeUndefined();
    expect(result.tripwire?.reason).toContain('Structured output validation failed');
    expect(structuringModel.doStreamCalls).toHaveLength(1);
  });
});
