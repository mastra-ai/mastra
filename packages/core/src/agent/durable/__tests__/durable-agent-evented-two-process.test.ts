/**
 * Two-process-shaped topology for DurableAgent with `engine: 'evented'`.
 *
 * Models the `--workers` dedicated deployment: an API-tier Mastra instance
 * (publisher — workers NOT started, `MASTRA_WORKERS=false`) and a worker-tier
 * Mastra instance (consumer — workers started) that share the same pubsub and
 * storage. The publisher's agent call publishes the agentic-loop events to the
 * workflows topic; only the consumer's WorkflowEventProcessor executes them.
 *
 * Both instances run in one JS process here (EventEmitterPubSub can't cross a
 * real process boundary), which means the in-memory `globalRunRegistry` is
 * genuinely shared — a live run's steps can still see the publisher's registry
 * entry even when the consumer's processor executes them. Process-identity of
 * closure execution is therefore asserted where it can be made honest:
 *  - "no workers → no progress" proves the publisher performs no in-process
 *    execution and everything flows through the consumed workflows topic;
 *  - the process-death test clears the registry (the cross-process reality:
 *    the worker never had the publisher's entry) and proves the loop
 *    rehydrates from serialized input + storage and executes the consumer
 *    instance's own tool/model closures.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

function createToolCallThenTextModel(
  side: string,
  executedModels: string[],
  finalText: string,
  // The mock is call-count-stateful per model instance. A fresh "process"
  // resuming mid-run starts at call 0 but must produce the post-tool text
  // turn, not another tool call.
  textOnly = false,
) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      executedModels.push(side);
      callCount++;
      if (callCount === 1 && !textOnly) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call' as const,
              toolCallId: 'call-1',
              toolName: 'whereAmI',
              input: JSON.stringify({}),
              providerExecuted: false,
            },
            {
              type: 'finish' as const,
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: finalText },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 9, totalTokens: 19 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

function buildInstance({
  side,
  pubsub,
  storage,
  executedTools,
  executedModels,
  textOnly,
}: {
  side: 'publisher' | 'consumer';
  pubsub: EventEmitterPubSub;
  storage: MockStore;
  executedTools: string[];
  executedModels: string[];
  textOnly?: boolean;
}) {
  const whereAmI = createTool({
    id: 'whereAmI',
    description: 'Records which process executed the tool',
    inputSchema: z.object({}),
    execute: async () => {
      executedTools.push(side);
      return `executed-in-${side}`;
    },
  });
  const agent = new Agent({
    id: 'two-process-agent',
    instructions: 'Use tools.',
    model: createToolCallThenTextModel(side, executedModels, 'All done', textOnly) as LanguageModelV2,
    tools: { whereAmI },
  });
  const durableAgent = createDurableAgent({ agent, engine: 'evented' });
  const mastra = new Mastra({
    logger: false,
    storage,
    pubsub,
    agents: { [durableAgent.id]: durableAgent as any },
  });
  return { durableAgent, mastra };
}

describe('DurableAgent engine: evented — publisher/consumer topology', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it('publisher makes no progress without a consumer; consumer workers drive the run and the publisher receives the stream', async () => {
    const pubsub = new EventEmitterPubSub();
    const storage = new MockStore();
    const executedTools: string[] = [];
    const executedModels: string[] = [];

    const publisher = buildInstance({ side: 'publisher', pubsub, storage, executedTools, executedModels });
    const consumer = buildInstance({ side: 'consumer', pubsub, storage, executedTools, executedModels });

    // Negative control: no workers running anywhere — the publisher's call
    // publishes to the workflows topic but nothing consumes it, so the model
    // is never invoked. This proves the publisher performs no in-process
    // execution with engine: 'evented'.
    const { output: stalled, cleanup: stalledCleanup } = await publisher.durableAgent.stream('anyone there?');
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(executedModels).toEqual([]);
    expect(executedTools).toEqual([]);
    stalledCleanup?.();
    void stalled;

    // Worker-tier only: start the consumer's workers (the publisher never
    // starts its own — MASTRA_WORKERS=false).
    await consumer.mastra.startWorkers();
    cleanup = async () => {
      await consumer.mastra.stopWorkers();
      await pubsub.close();
    };

    const { output, cleanup: streamCleanup } = await publisher.durableAgent.stream('where am I?');
    const chunks: string[] = [];
    for await (const chunk of output.textStream) {
      chunks.push(chunk);
    }
    const text = await output.text;
    const finishReason = await output.finishReason;
    streamCleanup?.();

    // The publisher-side call yields the streamed result over pubsub while the
    // consumer's WorkflowEventProcessor executed the loop.
    expect(chunks.join('')).toBe('All done');
    expect(text).toBe('All done');
    expect(finishReason).toBe('stop');
    expect(executedModels.length).toBeGreaterThanOrEqual(2);
    expect(executedTools.length).toBe(1);
  }, 30000);

  it('a worker process without the publisher registry entry rehydrates from storage and executes its own closures', async () => {
    const storage = new MockStore();
    const executedTools: string[] = [];
    const executedModels: string[] = [];

    // ---- Process 1: suspend on tool approval. ----
    let pubsub = new EventEmitterPubSub();
    const publisher = buildInstance({ side: 'publisher', pubsub, storage, executedTools, executedModels });
    await publisher.mastra.startWorkers();

    const first = await publisher.durableAgent.generate('search', { requireToolApproval: true });
    expect(first.finishReason).toBe('suspended');
    const runId = first.runId!;
    expect(executedModels).toEqual(['publisher']);
    expect(executedTools).toEqual([]);

    // ---- Process death: nothing of process 1 survives but its storage. ----
    await publisher.mastra.stopWorkers();
    await pubsub.close();
    globalRunRegistry.clear();

    // ---- Process 2: a fresh worker-tier instance resumes the run. ----
    pubsub = new EventEmitterPubSub();
    const consumer = buildInstance({
      side: 'consumer',
      pubsub,
      storage,
      executedTools,
      executedModels,
      textOnly: true,
    });
    await consumer.mastra.startWorkers();
    cleanup = async () => {
      await consumer.mastra.stopWorkers();
      await pubsub.close();
    };

    const resumed = await consumer.durableAgent.resumeGenerate(runId, { approved: true });
    expect(resumed.text).toBe('All done');
    expect(resumed.finishReason).toBe('stop');

    // Tool and follow-up LLM turn ran with the consumer instance's closures —
    // resolved from serialized input + the consumer's Mastra registries, not
    // the (dead) publisher registry entry.
    expect(executedTools).toEqual(['consumer']);
    expect(executedModels).toEqual(['publisher', 'consumer']);
  }, 30000);
});
