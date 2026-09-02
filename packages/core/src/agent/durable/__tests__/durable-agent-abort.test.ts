/**
 * DurableAgent abort-signal tests
 *
 * Exercises the runtime abort path added by the `abort_signal_durable` slice:
 *   - `result.abort()` mid-stream flips the registry-installed AbortController,
 *     the LLM step surfaces an AbortError, and the pubsub bridge dispatches
 *     `onAbort`.
 *   - An externally-supplied pre-aborted `abortSignal` short-circuits the run.
 *
 * The model mock honours `options.abortSignal` by rejecting `doStream` with an
 * AbortError once the signal fires, mirroring real AI SDK provider behaviour.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { MockMemory } from '../../../memory/mock';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

/** @param onCall - invoked as soon as the model starts streaming, to synchronize on a live run. */
function createAbortableModel(onCall?: () => void) {
  return new MockLanguageModelV2({
    doStream: async ({ abortSignal }: { abortSignal?: AbortSignal }) => {
      onCall?.();
      // If the caller already aborted before the call landed, fail fast with
      // the canonical AbortError name so the durable abort heuristic fires.
      if (abortSignal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            // Hold the stream open and resolve with an AbortError as soon as
            // the signal fires — the durable step then catches AbortError and
            // emits the abort event to the bridge.
            if (abortSignal) {
              abortSignal.addEventListener(
                'abort',
                () => {
                  const err = new Error('Aborted');
                  err.name = 'AbortError';
                  controller.error(err);
                },
                { once: true },
              );
            }
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

describe('DurableAgent abort signal', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('result.abort() cancels the run and invokes onAbort', async () => {
    const mockModel = createAbortableModel();
    const baseAgent = new Agent({
      id: 'abort-runtime-agent',
      name: 'Abort Runtime Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    let abortPayload: unknown;
    const { output, runId, abort, cleanup } = await durableAgent.stream('Go', {
      onAbort: data => {
        abortPayload = data;
      },
    });

    // Give the workflow a tick to subscribe + call doStream before we abort.
    await new Promise(r => setTimeout(r, 10));
    abort();

    try {
      await output.consumeStream();
    } catch {
      // The bridge errors the stream after firing onAbort; expected.
    }

    expect(runId).toBeDefined();
    expect(abortPayload).toBeDefined();

    cleanup();
  });

  it('onAbort receives the text streamed before the abort', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async ({ abortSignal }: { abortSignal?: AbortSignal }) => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Hello' });
            abortSignal?.addEventListener(
              'abort',
              () => {
                const err = new Error('Aborted');
                err.name = 'AbortError';
                controller.error(err);
              },
              { once: true },
            );
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
    const baseAgent = new Agent({
      id: 'abort-partial-text-agent',
      name: 'Abort Partial Text Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    let abortPayload: { steps: unknown[]; text?: string } | undefined;
    const { output, abort, cleanup } = await durableAgent.stream('Go', {
      onAbort: data => {
        abortPayload = data;
      },
    });

    // Abort once the streamed text is observed, so the abort deterministically
    // lands after the delta reached the collector.
    for await (const chunk of output.fullStream as AsyncIterable<{ type: string }>) {
      if (chunk.type === 'text-delta') abort();
    }

    expect(abortPayload?.text).toBe('Hello');

    cleanup();
  });

  it('persists already-streamed assistant text to memory after abort (#22593)', async () => {
    const mockMemory = new MockMemory();
    const mockModel = new MockLanguageModelV2({
      doStream: async ({ abortSignal }: { abortSignal?: AbortSignal }) => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Hello' });
            abortSignal?.addEventListener(
              'abort',
              () => {
                const err = new Error('Aborted');
                err.name = 'AbortError';
                controller.error(err);
              },
              { once: true },
            );
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
    const baseAgent = new Agent({
      id: 'abort-persist-agent',
      name: 'Abort Persist Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      memory: mockMemory,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const threadId = 'thread-abort-persist';
    const resourceId = 'resource-abort-persist';

    let abortPayload: { steps: unknown[]; text?: string } | undefined;
    const { output, abort, cleanup } = await durableAgent.stream('Go', {
      memory: { thread: threadId, resource: resourceId },
      onAbort: data => {
        abortPayload = data;
      },
    });

    // Abort once the streamed text is observed, so the abort deterministically
    // lands after the delta reached the collector.
    for await (const chunk of output.fullStream as AsyncIterable<{ type: string }>) {
      if (chunk.type === 'text-delta') abort();
    }

    expect(abortPayload?.text).toBe('Hello');
    const lastStep = abortPayload?.steps.at(-1) as { finishReason?: string } | undefined;
    expect(lastStep?.finishReason).toBe('abort');

    // Wait for the finalize-run flush to land in memory.
    await vi.waitFor(async () => {
      const recalled = await mockMemory.recall({ threadId, resourceId });
      expect(recalled.messages.length).toBeGreaterThan(0);
    });

    const { messages } = await mockMemory.recall({ threadId, resourceId });
    const assistantMessage = messages.find(message => message.role === 'assistant');
    expect(assistantMessage, 'partial assistant message was not persisted to memory after abort').toBeDefined();
    expect(JSON.stringify(assistantMessage?.content)).toContain('Hello');

    cleanup();
  });

  it('persists streamed text when a response processor throws AbortError after streaming (#22593)', async () => {
    const mockMemory = new MockMemory();
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Hello' });
            controller.enqueue({ type: 'text-end', id: 'text-1' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
    // A non-TripWire AbortError from processLLMResponse is rethrown into the
    // outer catch, which must still persist the already-streamed text.
    const abortingProcessor = {
      name: 'abort-on-response',
      processLLMResponse: async () => {
        const err = new Error('Aborted by processor');
        err.name = 'AbortError';
        throw err;
      },
    };
    const baseAgent = new Agent({
      id: 'processor-abort-agent',
      name: 'Processor Abort Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
      memory: mockMemory,
      inputProcessors: [abortingProcessor as any],
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const threadId = 'thread-processor-abort';
    const resourceId = 'resource-processor-abort';

    const { output, cleanup } = await durableAgent.stream('Go', {
      memory: { thread: threadId, resource: resourceId },
    });

    for await (const _chunk of output.fullStream as AsyncIterable<unknown>) {
      // drain until the run settles
    }

    await vi.waitFor(async () => {
      const recalled = await mockMemory.recall({ threadId, resourceId });
      expect(recalled.messages.length).toBeGreaterThan(0);
    });

    const { messages } = await mockMemory.recall({ threadId, resourceId });
    const assistantMessage = messages.find(message => message.role === 'assistant');
    expect(assistantMessage, 'partial assistant message was not persisted after processor abort').toBeDefined();
    expect(JSON.stringify(assistantMessage?.content)).toContain('Hello');

    cleanup();
  });

  it('observe().abort() still completes when cleanup is called immediately', async () => {
    const mockModel = createAbortableModel();
    const baseAgent = new Agent({
      id: 'abort-observed-agent',
      name: 'Abort Observed Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const source = await durableAgent.stream('Go');
    await new Promise(r => setTimeout(r, 10));

    let finishReason: string | undefined;
    const observed = await durableAgent.observe(source.runId, {
      onFinish: result => {
        finishReason = result.finishReason;
      },
    });

    const sourceConsumption = source.output.consumeStream().catch(() => undefined);
    const observedConsumption = observed.output.consumeStream().catch(() => undefined);

    void observed.abort();
    observed.cleanup();

    await Promise.all([sourceConsumption, observedConsumption]);

    expect(finishReason).toBe('abort');

    source.cleanup();
  });

  it('abortRunStream() before stream() short-circuits the run', async () => {
    const doStream = vi.fn(async ({ abortSignal }: { abortSignal?: AbortSignal }) => {
      if (abortSignal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }

      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'completed' });
            controller.enqueue({ type: 'text-end', id: 'text-1' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    });
    const baseAgent = new Agent({
      id: 'abort-before-start-agent',
      name: 'Abort Before Start Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({ doStream }) as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    const runId = 'abort-before-start-run';

    durableAgent.abortRunStream(runId);

    let abortPayload: unknown;
    const { output, cleanup } = await durableAgent.stream('Go', {
      runId,
      onAbort: data => {
        abortPayload = data;
      },
    });

    try {
      await output.consumeStream();
    } catch {
      // expected — the run starts with an already-aborted signal
    }

    expect(abortPayload).toBeDefined();
    expect(doStream).not.toHaveBeenCalled();

    cleanup();
  });

  it('abortThreadStream stops a durable run that is already executing', async () => {
    // A durable run keeps its controller on the durable run registry, not in
    // the thread runtime's prepared-run map, so the base implementation reaches
    // neither: without the durable abort request the run streams on.
    // Resolves when the model is actually streaming, so the abort below lands
    // on a run under way rather than on one that has not started yet.
    let streaming: () => void;
    const modelCalled = new Promise<void>(resolve => {
      streaming = resolve;
    });
    const baseAgent = new Agent({
      id: 'abort-thread-stream-agent',
      name: 'Abort Thread Stream Agent',
      instructions: 'Test',
      model: createAbortableModel(() => streaming()) as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const threadId = 'abort-thread-stream-thread';
    const resourceId = 'abort-thread-stream-resource';

    let abortPayload: { steps: { finishReason?: string }[] } | undefined;
    const { output, cleanup } = await durableAgent.stream('Go', {
      memory: { thread: threadId, resource: resourceId },
      onAbort: data => {
        abortPayload = data;
      },
    });

    await modelCalled;
    expect(durableAgent.abortThreadStream({ threadId, resourceId })).toBe(true);

    // Awaited without a catch: the run has to end through the abort path,
    // rather than by surfacing some unrelated stream failure.
    await output.consumeStream();

    expect(abortPayload?.steps.at(-1)?.finishReason).toBe('abort');

    cleanup();
  });

  it('abortRunStream stops a durable run that is already executing', async () => {
    let streaming: () => void;
    const modelCalled = new Promise<void>(resolve => {
      streaming = resolve;
    });
    const baseAgent = new Agent({
      id: 'abort-run-stream-agent',
      name: 'Abort Run Stream Agent',
      instructions: 'Test',
      model: createAbortableModel(() => streaming()) as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    let abortPayload: { steps: { finishReason?: string }[] } | undefined;
    const { output, runId, cleanup } = await durableAgent.stream('Go', {
      memory: { thread: 'abort-run-stream-thread', resource: 'abort-run-stream-resource' },
      onAbort: data => {
        abortPayload = data;
      },
    });

    await modelCalled;
    expect(durableAgent.abortRunStream(runId)).toBe(true);

    // Awaited without a catch: the run has to end through the abort path,
    // rather than by surfacing some unrelated stream failure.
    await output.consumeStream();

    expect(abortPayload?.steps.at(-1)?.finishReason).toBe('abort');

    cleanup();
  });

  it('pre-aborted external abortSignal short-circuits the run', async () => {
    const mockModel = createAbortableModel();
    const baseAgent = new Agent({
      id: 'abort-preaborted-agent',
      name: 'Abort Preaborted Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const controller = new AbortController();
    controller.abort();

    let abortPayload: unknown;
    const { output, cleanup } = await durableAgent.stream('Go', {
      abortSignal: controller.signal,
      onAbort: data => {
        abortPayload = data;
      },
    });

    try {
      await output.consumeStream();
    } catch {
      // expected — the run never produced a normal finish
    }

    expect(abortPayload).toBeDefined();

    cleanup();
  });
});
