import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { MockMemory } from '../../memory/mock';
import type { ErrorProcessor, ErrorProcessorOrWorkflow } from '../../processors';
import type { RequestContext } from '../../request-context';
import { Agent } from '../agent';

/**
 * Memory contributes error processors the way it contributes input and output processors, so it
 * can recover from failed model calls without the user registering anything.
 */

function createFailOnceModel() {
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
        content: [{ type: 'text' as const, text: 'recovered' }],
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
          { type: 'text-delta', id: 'text-1', delta: 'recovered' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });

  return { model, getCalls: () => calls };
}

class RecoveringMemory extends MockMemory {
  readonly order: string[] = [];
  readonly processAPIError = vi.fn(async ({ retryCount }: { retryCount: number }) => {
    this.order.push('memory');
    return { retry: retryCount === 0 };
  });

  override async getErrorProcessors(
    _configured: ErrorProcessorOrWorkflow[] = [],
    _context?: RequestContext,
  ): Promise<ErrorProcessor[]> {
    return [{ id: 'memory-recovery', processAPIError: this.processAPIError }];
  }
}

function createAgent(memory: RecoveringMemory, model: MockLanguageModelV2, extra: Record<string, unknown> = {}) {
  return new Agent({
    id: 'memory-error-agent',
    name: 'Memory error agent',
    instructions: 'Answer.',
    model,
    memory,
    ...extra,
  });
}

const memoryOptions = { memory: { thread: 'thread-1', resource: 'resource-1' } };

describe('memory error processors', () => {
  it.each(['generate', 'stream'] as const)('run when a model call fails (%s)', async method => {
    const memory = new RecoveringMemory();
    const { model, getCalls } = createFailOnceModel();
    const agent = createAgent(memory, model);

    const text =
      method === 'generate'
        ? (await agent.generate('hello', memoryOptions)).text
        : await (
            await agent.stream('hello', memoryOptions)
          ).text;

    expect(memory.processAPIError).toHaveBeenCalledTimes(1);
    expect(getCalls()).toBe(2);
    expect(text).toBe('recovered');
  });

  it('are kept when a call overrides errorProcessors with an empty list', async () => {
    const memory = new RecoveringMemory();
    const { model } = createFailOnceModel();
    const agent = createAgent(memory, model);

    const result = await agent.generate('hello', { ...memoryOptions, errorProcessors: [] });

    expect(memory.processAPIError).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('recovered');
  });

  it('run after configured error processors', async () => {
    const memory = new RecoveringMemory();
    const { model } = createFailOnceModel();
    const configured: ErrorProcessor = {
      id: 'configured-observer',
      processAPIError: async () => {
        memory.order.push('configured');
      },
    };
    const agent = createAgent(memory, model, { errorProcessors: [configured] });

    await agent.generate('hello', memoryOptions);

    expect(memory.order).toEqual(['configured', 'memory']);
  });

  it('run with errorProcessorDefaults disabled', async () => {
    const memory = new RecoveringMemory();
    const { model } = createFailOnceModel();
    const agent = createAgent(memory, model, { errorProcessorDefaults: false });

    const result = await agent.generate('hello', memoryOptions);

    expect(memory.processAPIError).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('recovered');
  });

  it('are listed with the agent error processors but not with its configured ones', async () => {
    const memory = new RecoveringMemory();
    const { model } = createFailOnceModel();
    const agent = createAgent(memory, model);

    const listed = await agent.listErrorProcessors();

    expect(listed.map(processor => processor.id)).toContain('memory-recovery');
    expect(await agent.getConfiguredProcessorIds()).not.toContain('memory-recovery');
  });
});
