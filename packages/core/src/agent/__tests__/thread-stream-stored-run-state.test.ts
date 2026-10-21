import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';
import { createTool } from '../../tools';
import type { WorkflowRunState, WorkflowRunStatus } from '../../workflows/types';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { AGENT_THREAD_KEY_SEPARATOR, createHarness, setupRuntime } from './thread-stream-test-utils';
import type { ThreadStreamHarness } from './thread-stream-test-utils';

// Lease-watch cases drive the thread-stream runtime directly with pubsub events,
// as the other thread-stream liveness tests do; no model is involved there. The
// replay and ordering cases run a real agent (model behaviour from aimock) to an
// approval and through its resume, so storage holds exactly what real runs leave.

const LEASE_TTL_MS = 15_000;

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

async function storeWithRun(runId: string, status: WorkflowRunStatus) {
  const storage = new InMemoryStore();
  const workflows = await storage.getStore('workflows');
  await workflows!.persistWorkflowSnapshot({
    workflowName: 'agentic-loop',
    runId,
    snapshot: {
      runId,
      status,
      value: {},
      context: {},
      serializedStepGraph: [],
      activePaths: [],
      activeStepsPath: {},
      suspendedPaths: {},
      resumeLabels: {},
      waitingPaths: {},
      timestamp: Date.now(),
    } as unknown as WorkflowRunState,
  });
  return storage;
}

function withStorage(harness: ThreadStreamHarness, storage: InMemoryStore) {
  harness.agent = {
    id: harness.agent.id,
    getMastraInstance: () => ({ getStorage: () => storage }),
  } as unknown as Agent<any, any, any, any>;
}

/** Streams a run whose producer then drops its lease, and returns the part types the subscriber saw. */
async function partsAfterLeaseLapse(harness: ThreadStreamHarness, parts: Array<Record<string, unknown>>) {
  const { runtime, pubsub, emit, streamPart } = setupRuntime(harness);
  const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
  pubsub.owners.set(key, harness.runId);

  const subscription = await runtime.subscribeToThread(
    harness.agent,
    { threadId: harness.threadId, resourceId: harness.resourceId },
    pubsub,
  );
  const collected: any[] = [];
  const consumed = (async () => {
    for await (const part of subscription.stream) collected.push(part);
  })();

  await emit({ type: 'run-registered', runId: harness.runId, streamId: harness.streamId, streamSeq: 1 });
  for (const part of parts) await streamPart(part);
  await flush();

  pubsub.owners.delete(key);
  await vi.advanceTimersByTimeAsync(LEASE_TTL_MS * 2);

  subscription.unsubscribe();
  await consumed;
  return collected.map(part => part.type);
}

describe('thread stream runtime reads stored run state', () => {
  let llm: LLMock;

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
  });

  afterAll(async () => {
    await llm.stop();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** A real agent with an approval-gated tool, on storage and a pubsub that records thread events. */
  async function approvalAgent(engine: 'regular' | 'durable', prompt: string) {
    llm.on(
      { userMessage: prompt, sequenceIndex: 0 },
      { toolCalls: [{ id: `call_${engine}`, name: 'lookup', arguments: {} }] },
    );
    llm.on({ userMessage: prompt, sequenceIndex: 1 }, { content: 'done' });
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const storage = new InMemoryStore();
    const workflows = (await storage.getStore('workflows'))!;
    const pubsub = new EventEmitterPubSub();
    const published: Array<{ data: any; storedStatuses: Array<string | undefined> }> = [];
    const publish = pubsub.publish.bind(pubsub);
    pubsub.publish = async (topic, event) => {
      const data = (event as any)?.data;
      if (data?.runId && (data.type === 'run-registered' || data.type === 'run-suspended')) {
        const { runs } = await workflows.listWorkflowRuns({});
        const storedStatuses = runs.filter(run => run.runId === data.runId).map(run => (run.snapshot as any)?.status);
        published.push({ data, storedStatuses });
      }
      return publish(topic, event);
    };
    const base = new Agent({
      id: `stored-state-${engine}`,
      name: `stored-state-${engine}`,
      instructions: 'Look it up.',
      model: openai('gpt-4o-mini'),
      memory: new MockMemory(),
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Looks something up',
          inputSchema: z.object({}),
          requireApproval: true,
          execute: async () => ({ found: true }),
        }),
      },
    });
    const agent = engine === 'durable' ? createDurableAgent({ agent: base }) : base;
    const mastra = new Mastra({ agents: { agent: agent as any }, storage, pubsub, logger: false });
    return { agent: mastra.getAgent('agent') as any, workflows, published };
  }

  /** Streams to the approval prompt and returns the run id and the tool call awaiting approval. */
  async function runToApproval(agent: any, prompt: string, memory: { thread: string; resource: string }) {
    const result = await agent.stream(prompt, { memory });
    let toolCallId: string | undefined;
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
        // A durable stream stays open across the suspension.
        break;
      }
    }
    expect(toolCallId).toBeTruthy();
    return { runId: result.runId as string, toolCallId: toolCallId! };
  }

  it('parks a remote run whose lease lapsed when storage says the run is suspended', async () => {
    vi.useFakeTimers();
    const harness = createHarness('stored-lease-suspended');
    withStorage(harness, await storeWithRun(harness.runId, 'suspended'));

    // The producer parked the run and released the lease, but the suspension
    // prompt never reached this subscriber.
    const types = await partsAfterLeaseLapse(harness, [
      { type: 'start', payload: {} },
      { type: 'text-delta', payload: { text: 'waiting on approval' } },
    ]);

    expect(types).toEqual(['start', 'text-delta']);
  });

  it('still parks a run whose suspension prompt was seen when storage holds a terminal row', async () => {
    vi.useFakeTimers();
    const harness = createHarness('stored-lease-prompt-terminal');
    withStorage(harness, await storeWithRun(harness.runId, 'success'));

    const types = await partsAfterLeaseLapse(harness, [
      { type: 'start', payload: {} },
      { type: 'tool-call-approval', payload: { toolCallId: 'call-1', toolName: 'lookup', args: {} } },
    ]);

    expect(types).not.toContain('error');
  });

  it('persists the suspended row before publishing run-suspended and deletes it once the run finishes', async () => {
    // Guard for the replay fix below, which reads a missing row as "finished":
    // that is only sound while both loops keep this order. Passes with or without the fix.
    for (const engine of ['regular', 'durable'] as const) {
      const prompt = `ordering ${engine}`;
      const { agent, workflows, published } = await approvalAgent(engine, prompt);
      const memory = { thread: `ordering-${engine}-thread`, resource: `ordering-${engine}-user` };
      const { runId, toolCallId } = await runToApproval(agent, prompt, memory);
      await vi.waitFor(() => expect(published.some(event => event.data.type === 'run-suspended')).toBe(true));

      const suspended = published.find(event => event.data.type === 'run-suspended')!;
      expect(suspended.data.runId, engine).toBe(runId);
      expect(suspended.storedStatuses, engine).toContain('suspended');

      const resumed = await agent.approveToolCall({ runId, toolCallId, memory });
      for await (const _chunk of resumed.fullStream) {
        // drain
      }
      await vi.waitFor(async () => {
        const { runs } = await workflows.listWorkflowRuns({});
        expect(
          runs.filter(run => run.runId === runId),
          engine,
        ).toEqual([]);
      });
    }
  });

  it('does not block the thread on a replayed run-suspended of a run that resumed and finished', async () => {
    const prompt = 'replay finished run';
    const { agent, workflows, published } = await approvalAgent('regular', prompt);
    const harness = createHarness('stored-replay-finished');
    const memory = { thread: harness.threadId, resource: harness.resourceId };
    const { runId, toolCallId } = await runToApproval(agent, prompt, memory);
    await vi.waitFor(() => expect(published.some(event => event.data.type === 'run-suspended')).toBe(true));
    const resumed = await agent.approveToolCall({ runId, toolCallId, memory });
    for await (const _chunk of resumed.fullStream) {
      // drain
    }
    await vi.waitFor(async () => {
      const { runs } = await workflows.listWorkflowRuns({});
      expect(runs.filter(run => run.runId === runId)).toEqual([]);
    });

    // A fresh subscriber on a retained backend whose backlog holds only the
    // original leg up to its suspension: the resume's events were trimmed or never retained.
    vi.useFakeTimers();
    harness.agent = agent;
    harness.runId = runId;
    const { runtime, pubsub, emit, streamPart } = setupRuntime(harness);
    const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    pubsub.retain = true;
    // The lease is still held when the backlog replays, so the registration reads as live.
    pubsub.owners.set(key, runId);
    const registered = published.find(event => event.data.type === 'run-registered')!.data;
    harness.streamId = registered.streamId;
    await emit(registered);
    await streamPart({ type: 'tool-call-approval', payload: { toolCallId, toolName: 'lookup', args: {} } });
    await emit(published.find(event => event.data.type === 'run-suspended')!.data);
    await vi.advanceTimersByTimeAsync(1);

    const subscription = await runtime.subscribeToThread(
      harness.agent,
      { threadId: harness.threadId, resourceId: harness.resourceId },
      pubsub,
    );
    const replayedTypes: string[] = [];
    const consumed = (async () => {
      for await (const part of subscription.stream) replayedTypes.push((part as any).type);
    })();
    await flush();
    pubsub.owners.delete(key);
    await vi.advanceTimersByTimeAsync(LEASE_TTL_MS * 2);

    expect(runtime.getThreadState({ threadId: harness.threadId, resourceId: harness.resourceId }, pubsub)).toBe('idle');

    subscription.unsubscribe();
    await consumed;
    // The approval was already answered, so its stale prompt must not reach the subscriber.
    expect(replayedTypes).not.toContain('tool-call-approval');
  });

  it('keeps a live remote suspension parked when storage has no row for it', async () => {
    vi.useFakeTimers();
    const harness = createHarness('stored-live-missing');
    // Readable storage without a row, as with a policy that skips suspended snapshots.
    withStorage(harness, new InMemoryStore({ id: 'stored-live-missing' }));
    const { runtime, pubsub, emit, streamPart } = setupRuntime(harness);
    const key = [harness.resourceId, harness.threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    pubsub.owners.set(key, harness.runId);

    const subscription = await runtime.subscribeToThread(
      harness.agent,
      { threadId: harness.threadId, resourceId: harness.resourceId },
      pubsub,
    );
    const types: string[] = [];
    const consumed = (async () => {
      for await (const part of subscription.stream) types.push((part as any).type);
    })();

    await emit({ type: 'run-registered', runId: harness.runId, streamId: harness.streamId, streamSeq: 1 });
    await streamPart({ type: 'tool-call-approval', payload: { toolCallId: 'call-1', toolName: 'lookup', args: {} } });
    await emit({ type: 'run-suspended', runId: harness.runId, streamId: harness.streamId });
    await flush();

    expect(types).toContain('tool-call-approval');
    expect(runtime.getThreadState({ threadId: harness.threadId, resourceId: harness.resourceId }, pubsub)).toBe(
      'active',
    );

    subscription.unsubscribe();
    await consumed;
  });
  it('keeps a live local suspension parked when its run has no stored suspended row', async () => {
    const prompt = 'local missing row';
    llm.on(
      { userMessage: prompt, sequenceIndex: 0 },
      { toolCalls: [{ id: 'call_local', name: 'lookup', arguments: {} }] },
    );
    llm.on({ userMessage: prompt, sequenceIndex: 1 }, { content: 'done' });
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const storage = new InMemoryStore();
    const workflows = (await storage.getStore('workflows'))!;
    const pubsub = new EventEmitterPubSub();
    const suspendedEvents: unknown[] = [];
    const publish = pubsub.publish.bind(pubsub);
    pubsub.publish = async (topic, event) => {
      if ((event as any)?.data?.type === 'run-suspended') suspendedEvents.push((event as any).data);
      return publish(topic, event);
    };
    const base = new Agent({
      id: 'local-missing',
      name: 'local-missing',
      instructions: 'Look it up.',
      model: openai('gpt-4o-mini'),
      memory: new MockMemory(),
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Looks something up',
          inputSchema: z.object({}),
          requireApproval: true,
          execute: async () => ({ found: true }),
        }),
      },
    });
    // A policy that never persists snapshots: the live suspended run has no row.
    const durable = createDurableAgent({ agent: base, shouldPersistSnapshot: () => false });
    const mastra = new Mastra({ agents: { agent: durable as any }, storage, pubsub, logger: false });
    const agent = mastra.getAgent('agent') as any;
    const memory = { thread: 'local-missing-thread', resource: 'local-missing-user' };
    const ids = { threadId: memory.thread, resourceId: memory.resource };

    const subscription = await agent.subscribeToThread(ids);
    const consumed = (async () => {
      for await (const _part of subscription.stream);
    })();

    const result = await agent.stream(prompt, { memory });
    let toolCallId: string | undefined;
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
        break;
      }
    }
    expect(toolCallId).toBeTruthy();
    await vi.waitFor(() => expect(suspendedEvents.length).toBeGreaterThan(0));
    await new Promise(resolve => setTimeout(resolve, 200));
    const { runs } = await workflows.listWorkflowRuns({});
    expect(runs.filter(run => run.runId === result.runId)).toEqual([]);

    expect(agentThreadStreamRuntime.getActiveThreadRunId(ids, agent.getPubSub())).toBe(result.runId);
    expect(
      agentThreadStreamRuntime.getResumableThreadRunSuspension({ ...ids, runId: result.runId }, agent.getPubSub()),
    ).toBeDefined();

    subscription.unsubscribe();
    await consumed;
  });
});
