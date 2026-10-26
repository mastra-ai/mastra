/**
 * DurableAgent.observe() must give output processors the running inner Agent as
 * `args.agent`, both when the run registry entry is still live and on a cold
 * observe that rebuilds the stream from the persisted run (including a run
 * pinned to another agent version).
 *
 * MockLanguageModelV2 instead of aimock: these tests only need a fixed text
 * stream to replay, not provider request/response behaviour.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import type { Processor } from '../../../processors';
import { InMemoryStore } from '../../../storage';
import type { WorkflowRunState } from '../../../workflows/types';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';
import { emitChunkEvent, emitFinishEvent } from '../stream-adapter';

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

async function drain(stream: ReadableStream<any>) {
  const out: any[] = [];
  for await (const c of stream) out.push(c);
  return out;
}

function createRecorder(agents: unknown[]): Processor {
  return {
    id: 'agent-recorder',
    processOutputStream: async ({ part, agent }) => {
      agents.push(agent);
      return part;
    },
  };
}

describe('DurableAgent.observe() passes the inner Agent to output processors', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await pubsub.close();
  });

  it.each([
    ['live registry entry', false],
    ['cold observe without a registry entry', true],
  ])('replayed chunks see the inner Agent (%s)', async (_label, dropRegistryEntry) => {
    const cachingPubsub = new CachingPubSub(pubsub, new InMemoryServerCache());
    const observedAgents: unknown[] = [];
    const baseAgent = new Agent({
      id: 'observe-agent',
      name: 'Observe Agent',
      instructions: 'You are a helpful agent.',
      model: createTextModel('Hello.') as LanguageModelV2,
      outputProcessors: [createRecorder(observedAgents)],
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub: cachingPubsub, cleanupTimeoutMs: 60_000 });
    new Mastra({
      agents: { 'observe-agent': durableAgent },
      logger: false,
      storage: new InMemoryStore(),
      pubsub: cachingPubsub,
    });

    const result = await durableAgent.stream('Say hello', { maxSteps: 1 });
    await drain(result.fullStream);

    if (dropRegistryEntry) {
      durableAgent.runRegistry.cleanup(result.runId);
      globalRunRegistry.delete(result.runId);
    }
    observedAgents.length = 0;

    const observed = await durableAgent.observe(result.runId, { offset: 0 });
    const replayed = await drain(observed.fullStream);

    expect(replayed.some(c => c.type === 'text-delta')).toBe(true);
    expect(observedAgents.length).toBeGreaterThan(0);
    for (const agent of observedAgents) expect(agent).toBe(baseAgent);
  });

  it('a cold observe of a run pinned to another version sees the pinned inner Agent', async () => {
    const store = new InMemoryStore();
    const baseAgent = new Agent({
      id: 'pinned-observe-agent',
      name: 'Pinned Observe Agent',
      instructions: 'You are a helpful agent.',
      model: createTextModel('unused') as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    const mastra = new Mastra({ agents: { pinnedObserveAgent: durableAgent }, storage: store, logger: false });

    // Stands in for the editor: `Mastra.resolveVersionedAgent` returns the
    // DurableAgent's `__fork()`, which wraps a fork of the inner Agent.
    const observedAgents: unknown[] = [];
    let pinnedInner: Agent | undefined;
    vi.spyOn(mastra, 'resolveVersionedAgent').mockImplementation(async (agent, selector) => {
      const fork = agent.__fork();
      if ('versionId' in selector && selector.versionId) {
        fork.__setRawConfig({ resolvedVersionId: selector.versionId });
      }
      fork.__markStoredVersionApplied();
      pinnedInner = (fork as unknown as { agent: Agent }).agent;
      vi.spyOn(fork, 'listOutputProcessors').mockResolvedValue([createRecorder(observedAgents)]);
      return fork as typeof agent;
    });

    const runId = 'pinned-observe-run';
    const memory = { threadId: 't-pinned-observe', resourceId: 'r-pinned-observe' };
    const workflows = (await store.getStore('workflows'))!;
    await workflows.persistWorkflowSnapshot({
      workflowName: DurableStepIds.AGENTIC_LOOP,
      runId,
      resourceId: memory.resourceId,
      snapshot: {
        runId,
        status: 'running',
        value: {},
        context: {
          input: {
            __workflowKind: 'durable-agent',
            runId,
            agentId: durableAgent.id,
            agentVersionId: 'v1',
            messageListState: { memoryInfo: memory },
            state: memory,
          },
        },
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        serializedStepGraph: [],
        waitingPaths: {},
        timestamp: Date.now(),
      } as unknown as WorkflowRunState,
    });

    const observed = await durableAgent.observe(runId);
    const chunks = drain(observed.fullStream);
    await emitChunkEvent(pubsub, runId, {
      type: 'text-delta',
      runId,
      from: 'AGENT',
      payload: { id: 'text-1', text: 'Hi' },
    } as any);
    await emitFinishEvent(pubsub, runId, {
      output: { text: 'Hi', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, steps: [] },
      stepResult: { reason: 'stop', warnings: [], isContinued: false },
    });
    await chunks;

    expect(pinnedInner).toBeInstanceOf(Agent);
    expect(pinnedInner).not.toBe(baseAgent);
    expect(observedAgents.length).toBeGreaterThan(0);
    for (const agent of observedAgents) expect(agent).toBe(pinnedInner);
  });
});
