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
import { DurableStepIds } from '../durable/constants';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { AGENT_THREAD_KEY_SEPARATOR, createHarness, setupRuntime } from './thread-stream-test-utils';
import type { ThreadStreamHarness } from './thread-stream-test-utils';

// Lease-watch cases drive the thread-stream runtime directly with pubsub events,
// as the other thread-stream liveness tests do; no model is involved there. The
// replay case runs a real agent (model behaviour from aimock) to an approval and
// through its resume, so storage holds exactly what real runs leave. The namespaced
// cases stub the advertised durable loop name the way suspended-run discovery tests do.

const LEASE_TTL_MS = 15_000;

const NAMESPACED_LOOP = `inngest:${DurableStepIds.AGENTIC_LOOP}`;

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

async function storeWithRun(runId: string, status: WorkflowRunStatus, workflowName = 'agentic-loop') {
  const storage = new InMemoryStore();
  const workflows = await storage.getStore('workflows');
  await workflows!.persistWorkflowSnapshot({
    workflowName,
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

function withStorage(harness: ThreadStreamHarness, storage: InMemoryStore, durableLoopWorkflowName?: string) {
  harness.agent = {
    id: harness.agent.id,
    durableLoopWorkflowName,
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

  /** A real agent with an approval-gated tool, on storage and a pubsub whose thread events are observed. */
  async function approvalAgent(prompt: string, memory: { thread: string; resource: string }) {
    llm.on(
      { userMessage: prompt, sequenceIndex: 0 },
      { toolCalls: [{ id: 'call_regular', name: 'lookup', arguments: {} }] },
    );
    llm.on({ userMessage: prompt, sequenceIndex: 1 }, { content: 'done' });
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const storage = new InMemoryStore();
    const workflows = (await storage.getStore('workflows'))!;
    const pubsub = new EventEmitterPubSub();
    const published: Array<{ data: any }> = [];
    const key = [memory.resource, memory.thread].join(AGENT_THREAD_KEY_SEPARATOR);
    await pubsub.subscribe(`agent.thread-stream.${encodeURIComponent(key)}`, event => {
      const data = (event as any)?.data;
      if (data?.type === 'run-registered' || data?.type === 'run-suspended') published.push({ data });
    });
    const base = new Agent({
      id: 'stored-state',
      name: 'stored-state',
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
    const mastra = new Mastra({ agents: { agent: base }, storage, pubsub, logger: false });
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

  it('parks a remote run whose lease lapsed when only the advertised durable loop row says suspended', async () => {
    vi.useFakeTimers();
    const harness = createHarness('stored-lease-namespaced');
    withStorage(harness, await storeWithRun(harness.runId, 'suspended', NAMESPACED_LOOP), NAMESPACED_LOOP);

    const types = await partsAfterLeaseLapse(harness, [
      { type: 'start', payload: {} },
      { type: 'text-delta', payload: { text: 'waiting on approval' } },
    ]);

    expect(types).toEqual(['start', 'text-delta']);
  });

  it('keeps a replayed suspension pending when only the advertised durable loop row says suspended', async () => {
    vi.useFakeTimers();
    const harness = createHarness('stored-replay-namespaced');
    withStorage(harness, await storeWithRun(harness.runId, 'suspended', NAMESPACED_LOOP), NAMESPACED_LOOP);
    const { runtime, pubsub, emit, streamPart } = setupRuntime(harness);
    pubsub.retain = true;
    await emit({ type: 'run-registered', runId: harness.runId, streamId: harness.streamId, streamSeq: 1 });
    await streamPart({ type: 'tool-call-approval', payload: { toolCallId: 'call-1', toolName: 'lookup', args: {} } });
    await emit({ type: 'run-suspended', runId: harness.runId, streamId: harness.streamId });
    await vi.advanceTimersByTimeAsync(1);

    const subscription = await runtime.subscribeToThread(
      harness.agent,
      { threadId: harness.threadId, resourceId: harness.resourceId },
      pubsub,
    );
    const types: string[] = [];
    const consumed = (async () => {
      for await (const part of subscription.stream) types.push((part as any).type);
    })();
    await flush();

    subscription.unsubscribe();
    await consumed;
    // The run is still waiting on approval, so the replayed prompt must reach the subscriber.
    expect(types).toContain('tool-call-approval');
  });

  it('does not block the thread on a replayed run-suspended of a run that resumed and finished', async () => {
    const prompt = 'replay finished run';
    const harness = createHarness('stored-replay-finished');
    const memory = { thread: harness.threadId, resource: harness.resourceId };
    const { agent, workflows, published } = await approvalAgent(prompt, memory);
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

    const suspendedEvents: unknown[] = [];
    const key = [memory.resource, memory.thread].join(AGENT_THREAD_KEY_SEPARATOR);
    await pubsub.subscribe(`agent.thread-stream.${encodeURIComponent(key)}`, event => {
      if ((event as any)?.data?.type === 'run-suspended') suspendedEvents.push((event as any).data);
    });

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
