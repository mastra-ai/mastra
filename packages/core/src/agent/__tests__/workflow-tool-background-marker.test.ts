/**
 * A workflow an agent runs as a background task must keep the
 * `mastra.workflowTool` marker on its stored result (#30219). Workflow tools
 * can't define `toModelOutput`, so tracing uses that marker to show their
 * result in the next MODEL_STEP input instead of `[tool-result: workflow-<name>]`.
 *
 * Background completion records the result through `applyBackgroundToolResult`.
 * When the original tool call is gone (e.g. after a restart) it appends a new
 * tool message built from `baseProviderMetadata` and the metadata
 * `transformForTranscript` returns, so both must carry the marker too.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { applyBackgroundToolResult } from '../../loop/shared/steps/background-task-result-core';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable/create-durable-agent';

// Pass-through spy: lets the test await background completion and read the
// arguments each engine hands the shared core, without changing behavior.
vi.mock('../../loop/shared/steps/background-task-result-core', async importOriginal => {
  const actual = await importOriginal<typeof import('../../loop/shared/steps/background-task-result-core')>();
  return { ...actual, applyBackgroundToolResult: vi.fn(actual.applyBackgroundToolResult) };
});

function workflowCallThenAnswerModel() {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream(
        call++ === 0
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'workflow-weatherWorkflow',
                input: JSON.stringify({ inputData: { city: 'Paris' }, _background: { disposition: 'awaited' } }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Sunny in Paris' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ],
      ),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

function createWeatherWorkflow() {
  const lookup = createStep({
    id: 'lookup',
    inputSchema: z.object({ city: z.string() }),
    outputSchema: z.object({ city: z.string(), condition: z.string() }),
    execute: async ({ inputData }) => {
      await new Promise(r => setTimeout(r, 50));
      return { city: inputData.city, condition: 'sunny' };
    },
  });
  return createWorkflow({
    id: 'weatherWorkflow',
    inputSchema: z.object({ city: z.string() }),
    outputSchema: z.object({ city: z.string(), condition: z.string() }),
  })
    .then(lookup)
    .commit();
}

async function waitFor(cond: () => boolean, timeoutMs = 5000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition');
    await new Promise(r => setTimeout(r, 50));
  }
}

function findInvocationPart(messages: any[], toolCallId: string) {
  for (const msg of messages) {
    for (const part of msg?.content?.parts ?? []) {
      if (part?.type === 'tool-invocation' && part.toolInvocation?.toolCallId === toolCallId) return part;
    }
  }
  return undefined;
}

describe.each(['agent', 'durable'] as const)('background workflow tool result marker (%s)', engine => {
  const storage = new MockStore();
  const spy = vi.mocked(applyBackgroundToolResult);
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    spy.mockClear();
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
    const bgStore = await storage.getStore('backgroundTasks');
    await bgStore?.dangerouslyClearAll();
  });

  it('marks the stored result and the metadata recovery would append (#30219)', async () => {
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'bg-workflow-agent',
      name: 'BG Workflow Agent',
      instructions: 'Use the weather workflow',
      model: workflowCallThenAnswerModel() as LanguageModelV2,
      workflows: { weatherWorkflow: createWeatherWorkflow() },
      backgroundTasks: { tools: { weatherWorkflow: true } },
      memory,
    });
    const registered = engine === 'durable' ? createDurableAgent({ agent, pubsub }) : agent;
    const mastra = new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true },
      agents: { 'bg-workflow-agent': registered as Agent },
    });
    await mastra.startWorkers();

    const memoryOptions = { memory: { thread: `thread-${engine}`, resource: `resource-${engine}` } };
    if (engine === 'durable') {
      const { output, cleanup } = await (registered as ReturnType<typeof createDurableAgent>).stream(
        'Weather in Paris?',
        memoryOptions,
      );
      await output.consumeStream();
      cleanup();
    } else {
      await (await agent.stream('Weather in Paris?', memoryOptions)).consumeStream();
    }
    await waitFor(() => spy.mock.calls.length > 0);
    await Promise.all(spy.mock.results.map(r => r.value));

    const recalled = await memory.recall({ threadId: `thread-${engine}`, resourceId: `resource-${engine}` });
    const part = findInvocationPart(recalled.messages as any[], 'call-1');
    expect(part?.toolInvocation?.state).toBe('result');
    expect(part?.toolInvocation?.result).toMatchObject({ result: { city: 'Paris', condition: 'sunny' } });
    expect(part?.providerMetadata?.mastra?.workflowTool).toBe(true);

    const [deps] = spy.mock.calls[0]!;
    expect((deps.baseProviderMetadata as any)?.mastra?.workflowTool).toBe(true);
    const transcript = await deps.transformForTranscript!(part.toolInvocation.result);
    expect((transcript.providerMetadata as any)?.mastra?.workflowTool).toBe(true);

    await mastra.backgroundTaskManager?.shutdown();
  });
});
