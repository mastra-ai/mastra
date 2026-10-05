import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { APICallError } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import type { Processor } from '../../../processors';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';
import { resolveRuntimeDependencies } from '../utils/resolve-runtime';

function makeFailThenAnswerModel(failures = 1, recordPrompt?: (prompt: unknown) => void) {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      calls++;
      recordPrompt?.(prompt);
      if (calls <= failures) {
        throw new APICallError({
          message: 'upstream failed',
          url: 'https://model.example.com/v1/messages',
          requestBodyValues: {},
          statusCode: 500,
          isRetryable: false,
        });
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-2', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'the retried answer' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

describe('durable agent API-error retry', () => {
  it('reports the API-error retry to the other processor hooks like Agent does', async () => {
    const run = async (durable: boolean) => {
      const seen: Record<string, number[]> = { inputStep: [], llmRequest: [], outputStep: [] };
      const observer: Processor = {
        id: 'retry-count-observer',
        processInputStep: async ({ retryCount }) => {
          seen.inputStep!.push(retryCount);
        },
        processLLMRequest: async ({ retryCount }) => {
          seen.llmRequest!.push(retryCount);
        },
        processOutputStep: async ({ retryCount, messageList }) => {
          seen.outputStep!.push(retryCount);
          return messageList;
        },
      };
      const agent = new Agent({
        id: 'api-error-retry-count',
        name: 'api-error-retry-count',
        instructions: 'You are helpful.',
        model: [{ model: makeFailThenAnswerModel() as LanguageModelV2, maxRetries: 0 }],
        inputProcessors: [observer],
        outputProcessors: [observer],
        maxProcessorRetries: 1,
        errorProcessors: [{ id: 'retry-on-api-error', processAPIError: async () => ({ retry: true }) }],
      });
      if (durable) {
        const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
        const { fullStream, cleanup } = await durableAgent.stream('hello', { maxProcessorRetries: 1 });
        for await (const _ of fullStream) {
          // drain
        }
        await cleanup?.();
      } else {
        const result = await agent.stream('hello', { maxProcessorRetries: 1 });
        await result.consumeStream();
      }
      return seen;
    };

    const expected = await run(false);
    expect(expected.outputStep).toEqual([1]);
    expect(await run(true)).toEqual(expected);
  });

  it('runs the memory error processors like Agent does', async () => {
    const run = async (durable: boolean) => {
      const processAPIError = vi.fn(async ({ retryCount }: { retryCount: number }) => ({ retry: retryCount === 0 }));
      const memory = new MockMemory();
      memory.getErrorProcessors = async () => [{ id: 'memory-recovery', processAPIError }];
      const agent = new Agent({
        id: 'memory-error-processor',
        name: 'memory-error-processor',
        instructions: 'You are helpful.',
        model: [{ model: makeFailThenAnswerModel() as LanguageModelV2, maxRetries: 0 }],
        memory,
      });
      const memoryOptions = { memory: { thread: `thread-${durable}`, resource: 'resource-memory-error' } };
      let text = '';
      if (durable) {
        const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
        const { fullStream, cleanup } = await durableAgent.stream('hello', memoryOptions);
        for await (const chunk of fullStream as AsyncIterable<any>) {
          if (chunk.type === 'text-delta') text += chunk.payload?.text ?? '';
        }
        await cleanup?.();
      } else {
        text = await (await agent.stream('hello', memoryOptions)).text;
      }
      return { calls: processAPIError.mock.calls.length, text };
    };

    const expected = await run(false);
    expect(expected).toEqual({ calls: 1, text: 'the retried answer' });
    expect(await run(true)).toEqual(expected);
  });

  it('lets an error processor rotate the response id before the retry', async () => {
    const rotations: Array<{ before: string | undefined; after: string | undefined }> = [];
    const memory = new MockMemory();
    const threadId = 'thread-recovered-rotation';
    const resourceId = 'resource-recovered-rotation';
    const agent = new Agent({
      id: 'durable-api-error-rotation',
      name: 'durable-api-error-rotation',
      instructions: 'You are helpful.',
      model: [{ model: makeFailThenAnswerModel() as LanguageModelV2, maxRetries: 0 }],
      memory,
      maxProcessorRetries: 1,
      errorProcessors: [
        {
          id: 'rotate-on-api-error',
          processAPIError: async ({ messageId, rotateResponseMessageId }) => {
            rotations.push({ before: messageId, after: rotateResponseMessageId?.() });
            return { retry: true };
          },
        },
      ],
    });

    const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
    const { fullStream, cleanup } = await durableAgent.stream('hello', {
      memory: { thread: threadId, resource: resourceId },
      maxProcessorRetries: 1,
    });

    const chunks: any[] = [];
    for await (const chunk of fullStream) {
      chunks.push(chunk);
    }
    await cleanup?.();

    const text = chunks
      .filter(chunk => chunk.type === 'text-delta')
      .map(chunk => chunk.payload?.text ?? '')
      .join('');
    expect(text).toBe('the retried answer');

    expect(rotations).toHaveLength(1);
    expect(rotations[0]!.before).toBeTruthy();
    expect(rotations[0]!.after).toBeTruthy();
    expect(rotations[0]!.after).not.toBe(rotations[0]!.before);
    await vi.waitFor(async () => {
      const recalled = await memory.recall({ threadId, resourceId });
      expect(recalled.messages.map(message => message.role)).toEqual(['user', 'assistant']);
    });
    const { messages } = await memory.recall({ threadId, resourceId });
    expect(messages.flatMap(message => message.content.parts ?? []).some(part => part.type === 'error')).toBe(false);
  });
  it('honors a call-time errorProcessors override in place of the resolved list', async () => {
    // Parity with the agentic engine: a call-time list replaces the resolved list,
    // including the shared stability defaults. The default stack never retries an
    // unmatched 500, so only the caller's processor can recover the call.
    const overrideRuns: string[] = [];
    const agent = new Agent({
      id: 'durable-api-error-override',
      name: 'durable-api-error-override',
      instructions: 'You are helpful.',
      model: [{ model: makeFailThenAnswerModel() as LanguageModelV2, maxRetries: 0 }],
      maxProcessorRetries: 1,
    });

    const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
    const { fullStream, cleanup } = await durableAgent.stream('hello', {
      maxProcessorRetries: 1,
      errorProcessors: [
        {
          id: 'call-time-retry',
          processAPIError: async () => {
            overrideRuns.push('call-time-retry');
            return { retry: true };
          },
        },
      ],
    });

    const chunks: any[] = [];
    for await (const chunk of fullStream) {
      chunks.push(chunk);
    }
    await cleanup?.();

    const text = chunks
      .filter(chunk => chunk.type === 'text-delta')
      .map(chunk => chunk.payload?.text ?? '')
      .join('');
    expect(text).toBe('the retried answer');
    expect(overrideRuns).toEqual(['call-time-retry']);
  });
  it('carries a rotated id into the next retry instead of falling back', async () => {
    const rotations: Array<{ before: string | undefined; after: string | undefined }> = [];
    const agent = new Agent({
      id: 'durable-api-error-rotation-chain',
      name: 'durable-api-error-rotation-chain',
      instructions: 'You are helpful.',
      model: [{ model: makeFailThenAnswerModel(2) as LanguageModelV2, maxRetries: 0 }],
      maxProcessorRetries: 2,
      errorProcessors: [
        {
          id: 'rotate-on-api-error',
          processAPIError: async ({ messageId, rotateResponseMessageId }) => {
            rotations.push({ before: messageId, after: rotateResponseMessageId?.() });
            return { retry: true };
          },
        },
      ],
    });

    const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
    const { fullStream, cleanup } = await durableAgent.stream('hello');
    for await (const _chunk of fullStream) {
    }
    await cleanup?.();

    expect(rotations).toHaveLength(2);
    expect(rotations[0]!.after).toBeTruthy();
    expect(rotations[1]!.before).toBe(rotations[0]!.after);
  });
  it('keeps the final partial response and error together after retry-budget rotation', async () => {
    let attempts = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        attempts++;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `response-${attempts}`, modelId: 'mock-model', timestamp: new Date(0) },
            { type: 'text-start', id: `text-${attempts}` },
            { type: 'text-delta', id: `text-${attempts}`, delta: `partial ${attempts}` },
            { type: 'text-end', id: `text-${attempts}` },
            { type: 'error', error: new Error('retry budget exhausted') },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'durable-api-error-terminal-rotation',
      name: 'durable-api-error-terminal-rotation',
      instructions: 'You are helpful.',
      model: [{ model: model as LanguageModelV2, maxRetries: 0 }],
      memory,
      maxProcessorRetries: 1,
      errorProcessors: [
        {
          id: 'rotate-on-api-error',
          processAPIError: async ({ rotateResponseMessageId }) => {
            rotateResponseMessageId?.();
            return { retry: true };
          },
        },
      ],
    });

    const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
    const threadId = 'thread-terminal-rotation';
    const resourceId = 'resource-terminal-rotation';
    const { fullStream, cleanup } = await durableAgent.stream('hello', {
      memory: { thread: threadId, resource: resourceId },
      maxProcessorRetries: 1,
    });
    try {
      for await (const _chunk of fullStream) {
      }
    } catch {
      // The terminal error is expected after the retry budget is exhausted.
    }

    await vi.waitFor(async () => {
      const recalled = await memory.recall({ threadId, resourceId });
      expect(recalled.messages.map(message => message.role)).toEqual(['user', 'assistant']);
    });
    const { messages } = await memory.recall({ threadId, resourceId });
    const [textPart, errorPart] = messages[1]?.content.parts ?? [];
    expect(textPart).toMatchObject({ type: 'text' });
    expect((textPart as { text?: string }).text).toMatch(/^partial [2-9]\d*$/);
    expect(errorPart).toMatchObject({
      type: 'error',
      error: { name: 'Error', message: 'retry budget exhausted' },
    });
    expect(messages[1]?.content.parts).toHaveLength(2);
    await cleanup?.();
  });

  it('lets an error processor put a signal in front of the retried request', async () => {
    const prompts: unknown[] = [];
    const agent = new Agent({
      id: 'durable-api-error-signal',
      name: 'durable-api-error-signal',
      instructions: 'You are helpful.',
      model: [{ model: makeFailThenAnswerModel(1, prompt => prompts.push(prompt)) as LanguageModelV2, maxRetries: 0 }],
      maxProcessorRetries: 1,
      errorProcessors: [
        {
          id: 'signal-on-api-error',
          processAPIError: async ({ sendSignal }) => {
            await sendSignal?.({ type: 'user', contents: 'keep the answer short this time' });
            return { retry: true };
          },
        },
      ],
    });

    const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
    const { fullStream, cleanup } = await durableAgent.stream('hello');
    for await (const _chunk of fullStream) {
    }
    await cleanup?.();

    expect(prompts).toHaveLength(2);
    expect(JSON.stringify(prompts[0])).not.toContain('keep the answer short this time');
    expect(JSON.stringify(prompts[1])).toContain('keep the answer short this time');
  });
});

describe('durable serialized hasErrorProcessors flag', () => {
  it('is true when the caller configured error processors', async () => {
    const agent = new Agent({
      id: 'durable-flag-configured',
      name: 'durable-flag-configured',
      instructions: 'You are helpful.',
      model: [{ model: makeFailThenAnswerModel(0) as LanguageModelV2, maxRetries: 0 }],
      errorProcessors: [{ id: 'custom', processAPIError: async () => ({ retry: false }) }],
    });

    const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
    const { workflowInput } = await durableAgent.prepare('hello');

    expect((workflowInput.options as any).hasErrorProcessors).toBe(true);
  });

  it('is true for a call-time errorProcessors override', async () => {
    const agent = new Agent({
      id: 'durable-flag-override',
      name: 'durable-flag-override',
      instructions: 'You are helpful.',
      model: [{ model: makeFailThenAnswerModel(0) as LanguageModelV2, maxRetries: 0 }],
    });

    const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
    const { workflowInput } = await durableAgent.prepare('hello', {
      errorProcessors: [{ id: 'call-time', processAPIError: async () => ({ retry: false }) }],
    } as any);

    expect((workflowInput.options as any).hasErrorProcessors).toBe(true);
  });

  it('is false when only the framework default processors resolve', async () => {
    const agent = new Agent({
      id: 'durable-flag-defaults-only',
      name: 'durable-flag-defaults-only',
      instructions: 'You are helpful.',
      model: [{ model: makeFailThenAnswerModel(0) as LanguageModelV2, maxRetries: 0 }],
    });

    const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
    const { workflowInput, registryEntry } = await durableAgent.prepare('hello');

    // The resolved list still carries the framework defaults…
    expect(registryEntry.errorProcessors!.length).toBeGreaterThan(0);
    // …but the serialized flag says the caller configured none, so the
    // implicit retry-cap warning stays quiet for bare agents.
    expect((workflowInput.options as any).hasErrorProcessors).toBe(false);
  });
});

describe('durable error-processor resolution', () => {
  const throwingResolver = async (): Promise<Processor[]> => {
    throw new Error('resolver unavailable');
  };

  it('keeps the configured output processors when the error-processor resolver throws', async () => {
    const redactor: Processor = {
      id: 'output-redactor',
      processOutputStream: vi.fn(async ({ part }) =>
        part.type === 'text-delta' ? { ...part, payload: { ...part.payload, text: '[REDACTED]' } } : part,
      ),
    };
    const agent = new Agent({
      id: 'durable-error-resolver-throws',
      name: 'durable-error-resolver-throws',
      instructions: 'You are helpful.',
      model: [{ model: makeFailThenAnswerModel(0) as LanguageModelV2, maxRetries: 0 }],
      outputProcessors: [redactor],
      errorProcessors: throwingResolver,
    });

    const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
    const stream = await durableAgent.stream('hello');
    const chunks: any[] = [];
    for await (const chunk of stream.fullStream) chunks.push(chunk);
    await stream.cleanup?.();

    const text = chunks
      .filter(chunk => chunk.type === 'text-delta')
      .map(chunk => chunk.payload.text)
      .join('');
    expect(redactor.processOutputStream).toHaveBeenCalled();
    expect(text).toBe('[REDACTED]');
  });

  it('resolves a dynamic error-processor list once and shares it with the request lane', async () => {
    const resolver = vi.fn((): Processor[] => [
      { id: 'dynamic-error', processLLMRequest: () => undefined, processAPIError: () => undefined },
    ]);
    const agent = new Agent({
      id: 'durable-error-resolver-once',
      name: 'durable-error-resolver-once',
      instructions: 'You are helpful.',
      model: [{ model: makeFailThenAnswerModel(0) as LanguageModelV2, maxRetries: 0 }],
      errorProcessorDefaults: false,
      errorProcessors: resolver,
    });

    const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
    const { registryEntry, workflowInput } = await durableAgent.prepare('hello');

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(registryEntry.llmRequestInputProcessors).toEqual([registryEntry.errorProcessors![0]]);
    expect((workflowInput.options as any).hasErrorProcessors).toBe(true);
  });

  describe('after the run registry entry is lost', () => {
    async function prepareThenEvict(agent: Agent, options?: Record<string, unknown>) {
      const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
      const mastra = new Mastra({ agents: { [agent.id]: durableAgent as any }, logger: false });
      const { runId, workflowInput } = await durableAgent.prepare('hello', options as any);
      // A worker in another process (or after a restart) has no registry entry and rebuilds the
      // pipeline from the registered agent plus the serialized workflow input.
      globalRunRegistry.delete(runId);
      try {
        return await resolveRuntimeDependencies({ mastra, runId, agentId: agent.id, input: workflowInput });
      } finally {
        globalRunRegistry.delete(runId);
      }
    }

    it('keeps a call-time empty errorProcessors override', async () => {
      const agent = new Agent({
        id: 'durable-rebuild-empty-override',
        name: 'durable-rebuild-empty-override',
        instructions: 'You are helpful.',
        model: [{ model: makeFailThenAnswerModel(0) as LanguageModelV2, maxRetries: 0 }],
      });

      const rebuilt = await prepareThenEvict(agent, { errorProcessors: [] });

      expect(rebuilt.errorProcessors).toEqual([]);
      expect(rebuilt.llmRequestInputProcessors).toEqual([]);
    });

    it("rebuilds the wrapped agent's error processors, not the defaults", async () => {
      const custom: Processor = { id: 'custom', processLLMRequest: () => undefined, processAPIError: () => undefined };
      const agent = new Agent({
        id: 'durable-rebuild-wrapped-config',
        name: 'durable-rebuild-wrapped-config',
        instructions: 'You are helpful.',
        model: [{ model: makeFailThenAnswerModel(0) as LanguageModelV2, maxRetries: 0 }],
        errorProcessorDefaults: false,
        errorProcessors: [custom],
      });

      const rebuilt = await prepareThenEvict(agent);

      expect(rebuilt.errorProcessors).toEqual([custom]);
      expect(rebuilt.llmRequestInputProcessors).toEqual([custom]);
    });

    it('resolves the defaults without an override', async () => {
      const agent = new Agent({
        id: 'durable-rebuild-defaults',
        name: 'durable-rebuild-defaults',
        instructions: 'You are helpful.',
        model: [{ model: makeFailThenAnswerModel(0) as LanguageModelV2, maxRetries: 0 }],
      });

      const rebuilt = await prepareThenEvict(agent);

      expect(rebuilt.errorProcessors!.map(processor => processor.id)).toEqual([
        'provider-history-compat',
        'prefill-error-handler',
        'stream-error-retry-processor',
      ]);
    });
  });
});
