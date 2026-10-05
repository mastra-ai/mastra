import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import type { Processor } from '../../processors';
import { Agent } from '../agent';

/**
 * `processAPIError` is documented for every processor lane, but agents combine their input and
 * output processors into one workflow each, and the error runner skips workflows. These tests
 * pin that a processor registered as an input or output processor still gets its error hook.
 */

function createFailOnceModel(responseText: string) {
  let calls = 0;
  const failure = () =>
    new APICallError({
      message: 'request rejected',
      url: 'https://api.example.com/v1/messages',
      requestBodyValues: {},
      statusCode: 400,
      isRetryable: false,
    });

  const model = new MockLanguageModelV2({
    doGenerate: async () => {
      calls++;
      if (calls === 1) throw failure();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text' as const, text: responseText }],
        warnings: [],
      };
    },
    doStream: async () => {
      calls++;
      if (calls === 1) throw failure();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: responseText },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });

  return { model, getCalls: () => calls };
}

function createRecoveringProcessor(id: string) {
  const processAPIError = vi.fn(async ({ retryCount }: { retryCount: number }) => ({ retry: retryCount === 0 }));
  // A second hook keeps the processor valid in its lane, as real input/output processors are.
  const processor: Processor = { id, processInput: async ({ messages }) => messages, processAPIError };
  return { processor, processAPIError };
}

describe('processAPIError on input and output processors in an agent', () => {
  it.each(['generate', 'stream'] as const)('runs for an input processor (%s)', async method => {
    const { model, getCalls } = createFailOnceModel('recovered');
    const { processor, processAPIError } = createRecoveringProcessor('input-recovery');
    const agent = new Agent({
      id: 'input-lane-agent',
      name: 'Input lane agent',
      instructions: 'Answer.',
      model,
      inputProcessors: [processor],
    });

    const text =
      method === 'generate' ? (await agent.generate('hello')).text : await (await agent.stream('hello')).text;

    expect(processAPIError).toHaveBeenCalledTimes(1);
    expect(getCalls()).toBe(2);
    expect(text).toBe('recovered');
  });

  it('runs for an output processor', async () => {
    const { model, getCalls } = createFailOnceModel('recovered');
    const processAPIError = vi.fn(async ({ retryCount }: { retryCount: number }) => ({ retry: retryCount === 0 }));
    const processor: Processor = {
      id: 'output-recovery',
      processOutputResult: async ({ messages }) => messages,
      processAPIError,
    };
    const agent = new Agent({
      id: 'output-lane-agent',
      name: 'Output lane agent',
      instructions: 'Answer.',
      model,
      outputProcessors: [processor],
    });

    const result = await agent.generate('hello');

    expect(processAPIError).toHaveBeenCalledTimes(1);
    expect(getCalls()).toBe(2);
    expect(result.text).toBe('recovered');
  });

  it('runs a processor registered in several lanes once per failure', async () => {
    const { model } = createFailOnceModel('recovered');
    const processAPIError = vi.fn(async () => undefined);
    const processor: Processor = {
      id: 'multi-lane',
      processInput: async ({ messages }) => messages,
      processOutputResult: async ({ messages }) => messages,
      processAPIError,
    };
    const agent = new Agent({
      id: 'multi-lane-agent',
      name: 'Multi lane agent',
      instructions: 'Answer.',
      model,
      inputProcessors: [processor],
      outputProcessors: [processor],
      errorProcessors: [processor],
    });

    await agent.generate('hello').catch(() => undefined);

    expect(processAPIError).toHaveBeenCalledTimes(1);
  });
});
