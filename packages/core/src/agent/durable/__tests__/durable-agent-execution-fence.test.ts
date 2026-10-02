/**
 * Execution fencing for durable agent runs (#23734).
 *
 * A durable run is driven by exactly one execution at a time. When recover()
 * takes a run over from an execution that is merely slow (not dead), the
 * superseded execution must stop without writing: no memory upsert over the
 * recovered answer, no snapshot deletion, no error/finish event, no further
 * LLM calls.
 *
 * These tests run both "processes" in one: the takeover by another process is
 * modelled by moving run ownership to a foreign owner, and that owner's
 * recovered answer by writing it to memory under the run's message id.
 *
 * Every case runs twice: with ownership in the workflows store (stores that
 * support run fencing) and in the pubsub lease (the fallback for stores that
 * don't).
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { PubSub } from '../../../events/pubsub';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { RequestContext } from '../../../request-context';
import { InMemoryStore, RUN_FENCE_CONFLICT_ERROR_ID } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { agentThreadStreamRuntime } from '../../thread-stream-runtime';
import { AGENT_STREAM_TOPIC, DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import {
  DurableExecutionFenceError,
  EXECUTION_ABANDONED_ERROR_ID,
  EXECUTION_CONFLICT_ERROR_ID,
  EXECUTION_LEASE_TTL_MS,
  ExecutionFence,
  RECOVER_RUN_ACTIVE_LOCALLY_ERROR_ID,
  RUN_ACTIVE_ERROR_ID,
  __resetExecutionFencesForTests,
  executionLeaseKey,
  getExecutionClaim,
  resolveLeaseProvider,
} from '../execution-fence';
import { globalRunRegistry } from '../run-registry';

const THREAD = 'fence-thread';
const RESOURCE = 'fence-resource';

/** A model whose first call blocks until `release()`, then answers with `text`. */
function gatedModel(text: string) {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  let signalEntered!: () => void;
  const entered = new Promise<void>(resolve => {
    signalEntered = resolve;
  });
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      signalEntered();
      await gate;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: text },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
  return { model, release, entered, calls: () => calls };
}

/** Read `stream` in the background, collecting chunks until cancelled. */
function collect(stream: ReadableStream<any>) {
  const chunks: any[] = [];
  const reader = stream.getReader();
  void (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        chunks.push(value);
      }
    } catch {
      // cancelled
    }
  })();
  return { chunks, stop: () => reader.cancel().catch(() => {}) };
}

/** A model that calls `toolName` on its first call and answers with `text` afterwards. */
function toolCallThenTextModel(toolName: string, input: Record<string, unknown>, text: string) {
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      const body =
        calls === 1
          ? [
              {
                type: 'tool-call' as const,
                toolCallType: 'function' as const,
                toolCallId: 'call-1',
                toolName,
                input: JSON.stringify(input),
                providerExecuted: false,
              },
              {
                type: 'finish' as const,
                finishReason: 'tool-calls' as const,
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]
          : [
              { type: 'text-start' as const, id: 'text-1' },
              { type: 'text-delta' as const, id: 'text-1', delta: text },
              { type: 'text-end' as const, id: 'text-1' },
              {
                type: 'finish' as const,
                finishReason: 'stop' as const,
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: `resp-${calls}`, modelId: 'mock', timestamp: new Date(0) },
          ...body,
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
  return { model, calls: () => calls };
}

async function drain(stream: ReadableStream<any>) {
  const chunks: any[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

/** Let the acquire-mode claim wait out its grace period without real delay. */
async function withFakeClock(run: () => Promise<void>) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  try {
    const done = run();
    done.catch(() => {}); // surfaced by the `await` below, not as an unhandled rejection
    await vi.advanceTimersByTimeAsync(10_000);
    await done;
  } finally {
    vi.useRealTimers();
  }
}

function recoveredAssistantMessage(id: string, text: string) {
  return {
    id,
    role: 'assistant' as const,
    content: { format: 2 as const, parts: [{ type: 'text' as const, text }] },
    createdAt: new Date(),
    threadId: THREAD,
    resourceId: RESOURCE,
  };
}

type OwnershipBackend = 'storage' | 'lease';

/** A store whose run ownership lives in `backend`. */
function createStorage(backend: OwnershipBackend) {
  const storage = new InMemoryStore();
  if (backend === 'lease') vi.spyOn(storage.stores.workflows!, 'supportsRunFencing').mockReturnValue(false);
  return storage;
}

/** Plays the other process, through whichever backend holds run ownership. */
function foreignOwnership(backend: OwnershipBackend, storage: InMemoryStore, pubsub: PubSub) {
  const TTL = 60_000;
  if (backend === 'lease') {
    const leases = resolveLeaseProvider(pubsub);
    return {
      async takeOver(fence: ExecutionFence, owner: string) {
        const key = executionLeaseKey(fence.agentId, fence.runId);
        expect(await leases.transferLease(key, fence.executionId, owner, TTL)).toBe(true);
      },
      async hold(agentId: string, runId: string, owner: string) {
        expect((await leases.acquireLease(executionLeaseKey(agentId, runId), owner, TTL)).acquired).toBe(true);
      },
      async free(agentId: string, runId: string, owner: string) {
        await leases.releaseLease(executionLeaseKey(agentId, runId), owner);
      },
      /** Drop `fence`'s claim without anyone taking the run. */
      async vanish(fence: ExecutionFence) {
        await leases.releaseLease(executionLeaseKey(fence.agentId, fence.runId), fence.executionId);
      },
      async isHeldBy(agentId: string, runId: string, owner: string) {
        return leases.renewLease(executionLeaseKey(agentId, runId), owner, TTL);
      },
      owner: (agentId: string, runId: string) => leases.getLeaseOwner(executionLeaseKey(agentId, runId)),
    };
  }
  const workflows = storage.stores.workflows!;
  return {
    /** Claim the run and raise its memory to the claim, as recover() in another process does. */
    async takeOver(fence: ExecutionFence, owner: string) {
      const claimed = await workflows.claimRunOwnership({
        runId: fence.runId,
        ownerId: owner,
        leaseMs: TTL,
        force: true,
      });
      expect(claimed.acquired).toBe(true);
      const raised = await storage.stores.memory!.raiseRunFence({
        runId: fence.runId,
        generation: claimed.record!.generation,
        ownerId: owner,
      });
      expect(raised).toBe(true);
    },
    async hold(_agentId: string, runId: string, owner: string) {
      expect((await workflows.claimRunOwnership({ runId, ownerId: owner, leaseMs: TTL })).acquired).toBe(true);
    },
    async free(_agentId: string, runId: string, owner: string) {
      const record = await workflows.getRunOwnership({ runId });
      expect(await workflows.releaseRunOwnership({ runId, generation: record!.generation, ownerId: owner })).toBe(true);
    },
    async vanish(fence: ExecutionFence) {
      const released = await workflows.releaseRunOwnership({
        runId: fence.runId,
        generation: fence.generation!,
        ownerId: fence.executionId,
      });
      expect(released).toBe(true);
    },
    async isHeldBy(_agentId: string, runId: string, owner: string) {
      const record = await workflows.getRunOwnership({ runId });
      return !!record?.live && record.ownerId === owner;
    },
    async owner(_agentId: string, runId: string) {
      const record = await workflows.getRunOwnership({ runId });
      return record?.live ? (record.ownerId ?? undefined) : undefined;
    },
  };
}

describe.each<OwnershipBackend>(['storage', 'lease'])(
  'DurableAgent execution fencing (#23734), ownership in %s',
  backend => {
    let pubsub: EventEmitterPubSub;

    beforeEach(() => {
      pubsub = new EventEmitterPubSub();
    });

    afterEach(async () => {
      vi.restoreAllMocks();
      globalRunRegistry.clear();
      __resetExecutionFencesForTests();
      await pubsub.close();
    });

    /** A durable agent registered on a Mastra that persists `running` checkpoints, which recover() reads. */
    function buildAgent(args: {
      model: MockLanguageModelV2;
      storage: InMemoryStore;
      memory?: MockMemory;
      tools?: Record<string, any>;
      agents?: Record<string, Agent>;
    }) {
      const durableAgent = createDurableAgent({
        agent: new Agent({
          id: 'fence-agent',
          name: 'Fence Agent',
          instructions: 'You are a helpful agent.',
          model: args.model as LanguageModelV2,
          ...(args.memory ? { memory: args.memory } : {}),
          ...(args.tools ? { tools: args.tools } : {}),
          ...(args.agents ? { agents: args.agents } : {}),
        }),
        pubsub,
      });
      new Mastra({
        agents: { 'fence-agent': durableAgent as any },
        logger: false,
        storage: args.storage,
        pubsub,
        recovery: { durableAgents: 'auto' },
      });
      return durableAgent;
    }

    async function waitForCheckpoint(storage: InMemoryStore, runId: string) {
      const workflows = (await storage.getStore('workflows'))!;
      await vi.waitFor(async () => {
        expect(await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP })).not.toBeNull();
      });
    }

    async function assistantText(memory: MockMemory) {
      const { messages } = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
      return JSON.stringify(messages.filter(message => message.role === 'assistant').map(message => message.content));
    }

    it('a superseded execution does not overwrite the recovered answer, delete snapshots, or publish a terminal event', async () => {
      const storage = createStorage(backend);
      const memory = new MockMemory({ storage });
      const model = gatedModel('stale answer from the superseded execution');
      const baseAgent = new Agent({
        id: 'fence-agent',
        name: 'Fence Agent',
        instructions: 'You are a helpful agent.',
        model: model.model as LanguageModelV2,
        memory,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
      new Mastra({ agents: { 'fence-agent': durableAgent as any }, logger: false, storage, pubsub });

      const result = await durableAgent.stream('What is the answer?', {
        memory: { thread: THREAD, resource: RESOURCE },
      });
      const { runId } = result;
      const stream = collect(result.fullStream);
      const events: string[] = [];
      await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), (event: any) => {
        events.push(event.type === 'chunk' ? `chunk:${event.data?.type}` : event.type);
      });

      await model.entered;
      const messageId = stream.chunks.find(chunk => chunk.type === 'start')?.payload?.messageId;
      expect(messageId).toEqual(expect.any(String));

      // ---- Another process recovers the run: it takes the execution lease,
      // checkpoints the run, and settles the answer under the run's message id.
      const fence = ExecutionFence.getLocalActive(runId)!;
      const foreign = foreignOwnership(backend, storage, durableAgent.pubsub);
      await foreign.takeOver(fence, 'foreign-recoverer');

      const workflows = (await storage.getStore('workflows'))!;
      await workflows.persistWorkflowSnapshot({
        workflowName: DurableStepIds.AGENTIC_LOOP,
        runId,
        snapshot: {
          runId,
          status: 'running',
          value: {},
          context: {} as any,
          serializedStepGraph: [],
          activePaths: [],
          activeStepsPath: {},
          suspendedPaths: {},
          resumeLabels: {},
          waitingPaths: {},
          timestamp: Date.now(),
        },
      });
      await memory.saveMessages({ messages: [recoveredAssistantMessage(messageId, 'recovered answer')] });

      // ---- The superseded execution's model call finally returns.
      model.release();
      await fence.whenSettled;
      // Give any stray write or publish a chance to land before asserting.
      await new Promise(resolve => setTimeout(resolve, 50));

      const { messages } = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
      const assistant = messages.filter(message => message.role === 'assistant');
      expect(assistant).toHaveLength(1);
      expect(assistant[0]!.id).toBe(messageId);
      expect(JSON.stringify(assistant[0]!.content)).toContain('recovered answer');
      expect(JSON.stringify(messages)).not.toContain('stale answer');

      // The recoverer's checkpoint is neither deleted nor overwritten.
      const checkpoint = await workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId });
      expect(checkpoint?.status).toBe('running');
      expect(checkpoint?.context).toEqual({});
      expect(await fence.settle(async () => {})).toBe('superseded');
      expect(await foreign.owner(fence.agentId, runId)).toBe('foreign-recoverer');

      expect(events).not.toContain('finish');
      expect(events).not.toContain('error');
      expect(events).not.toContain('chunk:finish');
      expect(events).not.toContain('chunk:error');
      expect(model.calls()).toBe(1);

      await stream.stop();
      result.cleanup();
    });

    it.skipIf(backend === 'lease')(
      'storage rejects a write that passed its ownership checks before a takeover, and the execution aborts',
      async () => {
        const storage = createStorage(backend);
        const memory = new MockMemory({ storage });
        const model = gatedModel('stale answer from the superseded execution');
        model.release();
        const durableAgent = buildAgent({ model: model.model, storage, memory });

        // Hold the execution's assistant-message write after every ownership check before it passed.
        let releaseWrite!: () => void;
        const writeGate = new Promise<void>(resolve => {
          releaseWrite = resolve;
        });
        let signalWriteHeld!: () => void;
        const writeHeld = new Promise<void>(resolve => {
          signalWriteHeld = resolve;
        });
        const memoryStore = storage.stores.memory!;
        const saveMessages = memoryStore.saveMessages.bind(memoryStore);
        const outcomes: unknown[] = [];
        vi.spyOn(memoryStore, 'saveMessages').mockImplementation(async args => {
          if (args.messages.some(message => message.role === 'assistant')) {
            signalWriteHeld();
            await writeGate;
          }
          try {
            const saved = await saveMessages(args);
            outcomes.push('saved');
            return saved;
          } catch (error) {
            outcomes.push(error);
            throw error;
          }
        });

        const result = await durableAgent.stream('What is the answer?', {
          memory: { thread: THREAD, resource: RESOURCE },
        });
        const { runId } = result;
        const stream = collect(result.fullStream);
        const events: string[] = [];
        await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), (event: any) => {
          events.push(event.type === 'chunk' ? `chunk:${event.data?.type}` : event.type);
        });

        await writeHeld;
        const fence = ExecutionFence.getLocalActive(runId)!;
        expect(fence.isLost()).toBe(false);
        const { signal } = globalRunRegistry.get(runId)!.abortController!;

        await foreignOwnership(backend, storage, durableAgent.pubsub).takeOver(fence, 'foreign-recoverer');
        releaseWrite();
        await fence.whenSettled;

        expect(outcomes.at(-1)).toMatchObject({ id: RUN_FENCE_CONFLICT_ERROR_ID });
        expect(fence.isLost()).toBe(true);
        expect(signal.aborted).toBe(true);
        expect(signal.reason).toBeInstanceOf(DurableExecutionFenceError);
        expect(await fence.settle(async () => {})).toBe('superseded');
        expect(await assistantText(memory)).not.toContain('stale answer');
        expect(events).not.toContain('finish');
        expect(events).not.toContain('error');
        expect(model.calls()).toBe(1);

        await stream.stop();
        result.cleanup();
      },
    );

    it('recover() refuses a run a live foreign owner holds; recover({ force: true }) takes it over and releases the lease when done', async () => {
      const storage = createStorage(backend);
      const memory = new MockMemory({ storage });

      // ---- The original execution checkpoints the run, then belongs to a
      // process that is still alive but that this one knows nothing about.
      const original = gatedModel('stale answer from the original execution');
      const agentA = buildAgent({ model: original.model, storage, memory });
      const started = await agentA.stream('What is the answer?', { memory: { thread: THREAD, resource: RESOURCE } });
      const { runId } = started;
      const startedStream = collect(started.fullStream);
      await original.entered;
      await waitForCheckpoint(storage, runId);

      const originalFence = ExecutionFence.getLocalActive(runId)!;
      const foreign = foreignOwnership(backend, storage, agentA.pubsub);
      await foreign.takeOver(originalFence, 'foreign-original');
      await startedStream.stop();
      started.cleanup();
      globalRunRegistry.clear();
      __resetExecutionFencesForTests();

      // ---- This process refuses to drive a run someone still holds.
      const recovering = gatedModel('recovered answer');
      recovering.release();
      const agentB = buildAgent({ model: recovering.model, storage, memory });
      const refusedAt = Date.now();
      const refusal = await agentB.recover(runId).catch(error => error);
      expect(refusal).toMatchObject({
        id: RUN_ACTIVE_ERROR_ID,
        details: { runId, liveBy: 'claim', holder: 'foreign-original' },
      });
      expect(refusal.details.retryAt).toBeGreaterThanOrEqual(refusedAt + 1_000);
      expect(refusal.details.retryAt).toBeLessThanOrEqual(Date.now() + EXECUTION_LEASE_TTL_MS);
      expect(recovering.calls()).toBe(0);
      expect(globalRunRegistry.has(runId)).toBe(false);
      expect(ExecutionFence.getLocalActive(runId)).toBeUndefined();
      expect(await foreign.isHeldBy(originalFence.agentId, runId, 'foreign-original')).toBe(true);

      // ---- force takes it over.
      const recovered = await agentB.recover(runId, { force: true });
      const recoveryFence = ExecutionFence.getLocalActive(runId)!;
      expect(recoveryFence.executionId).not.toBe(originalFence.executionId);
      expect(await foreign.isHeldBy(originalFence.agentId, runId, 'foreign-original')).toBe(false);

      const chunks = await drain(recovered.fullStream);
      expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
      await recoveryFence.whenSettled;
      expect(await recoveryFence.settle(async () => {})).toBe('owned');
      expect(await foreign.owner(originalFence.agentId, runId)).toBeUndefined();

      await vi.waitFor(async () => expect(await assistantText(memory)).toContain('recovered answer'));
      expect(await assistantText(memory)).not.toContain('stale answer');
      expect(recovering.calls()).toBe(1);
      recovered.cleanup();
    });

    it('shutdown() stops an execution still running at the drain deadline without writing, and releases the run so the next boot recovers it without force', async () => {
      const storage = createStorage(backend);
      const memory = new MockMemory({ storage });
      const stuck = gatedModel('stale answer from the process that shut down');
      const durableAgent = createDurableAgent({
        agent: new Agent({
          id: 'fence-agent',
          name: 'Fence Agent',
          instructions: 'You are a helpful agent.',
          model: stuck.model as LanguageModelV2,
          memory,
        }),
        pubsub,
      });
      const mastra = new Mastra({
        agents: { 'fence-agent': durableAgent as any },
        logger: false,
        storage,
        pubsub,
        recovery: { durableAgents: 'auto' },
      });

      const started = await durableAgent.stream('What is the answer?', {
        memory: { thread: THREAD, resource: RESOURCE },
      });
      const { runId } = started;
      const stream = collect(started.fullStream);
      const events: string[] = [];
      await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), (event: any) => {
        events.push(event.type === 'chunk' ? `chunk:${event.data?.type}` : event.type);
      });
      await stuck.entered;
      await waitForCheckpoint(storage, runId);
      const fence = ExecutionFence.getLocalActive(runId)!;
      const { signal } = globalRunRegistry.get(runId)!.abortController!;
      const foreign = foreignOwnership(backend, storage, durableAgent.pubsub);

      // ---- The model call outlives the drain deadline.
      await mastra.shutdown({ drainTimeout: 50 });

      expect(signal.aborted).toBe(true);
      expect(signal.reason).toMatchObject({ id: EXECUTION_ABANDONED_ERROR_ID });
      expect(ExecutionFence.getLocalActive(runId)).toBeUndefined();
      expect(await fence.settle(async () => {})).toBe('superseded');
      expect(await foreign.owner(fence.agentId, runId)).toBeUndefined();

      // ---- The model call returns after shutdown: nothing it produces lands.
      stuck.release();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(await assistantText(memory)).not.toContain('stale answer');
      const workflows = (await storage.getStore('workflows'))!;
      const checkpoint = await workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId });
      expect(checkpoint?.status).toBe('running');
      expect(events).not.toContain('finish');
      expect(events).not.toContain('error');
      expect(events).not.toContain('chunk:finish');
      expect(events).not.toContain('chunk:error');
      await stream.stop();
      started.cleanup();

      // ---- The next boot recovers the run without forcing it.
      globalRunRegistry.clear();
      __resetExecutionFencesForTests();
      const next = gatedModel('recovered answer');
      next.release();
      const agentB = buildAgent({ model: next.model, storage, memory });
      if (backend === 'lease') {
        // A pubsub lease leaves no record of the released run, so its thread
        // lease marks it live until that lapses once the process exits.
        const refusal = await agentB.recover(runId).catch(error => error);
        const refusedBy = Date.now();
        expect(refusal).toMatchObject({ id: RUN_ACTIVE_ERROR_ID, details: { runId, liveBy: 'thread-lease' } });
        expect(refusal.details.retryAt).toBeLessThanOrEqual(refusedBy + agentThreadStreamRuntime.threadLeaseTtlMs);
        vi.spyOn(agentThreadStreamRuntime, 'isRunHoldingThreadLease').mockResolvedValue(false);
      }
      const recovered = await agentB.recover(runId);
      const chunks = await drain(recovered.fullStream);
      expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
      await vi.waitFor(async () => expect(await assistantText(memory)).toContain('recovered answer'));
      expect(await assistantText(memory)).not.toContain('stale answer');
      recovered.cleanup();
    });

    it('stream({ runId }) rejects with CONFLICT while another execution holds the run', async () => {
      const storage = createStorage(backend);
      const model = gatedModel('never produced');
      model.release();
      const durableAgent = buildAgent({ model: model.model, storage });
      const runId = 'held-run';
      const foreign = foreignOwnership(backend, storage, durableAgent.pubsub);
      await foreign.hold(durableAgent.id, runId, 'foreign-holder');

      await withFakeClock(async () => {
        await expect(durableAgent.stream('hello', { runId })).rejects.toMatchObject({
          id: EXECUTION_CONFLICT_ERROR_ID,
        });
      });

      expect(model.calls()).toBe(0);
      expect(globalRunRegistry.has(runId)).toBe(false);
      expect(await foreign.owner(durableAgent.id, runId)).toBe('foreign-holder');
    });

    it('a suspended run releases its lease; resume() claims it, and rejects with CONFLICT while it is held', async () => {
      const storage = createStorage(backend);
      const model = toolCallThenTextModel('lookup', { query: 'the answer' }, 'looked it up');
      const execute = vi.fn(async () => ({ found: true }));
      const lookup = createTool({
        id: 'lookup',
        description: 'Look something up',
        inputSchema: z.object({ query: z.string() }),
        requireApproval: true,
        execute,
      });
      const durableAgent = buildAgent({ model: model.model, storage, tools: { lookup } });

      let suspended = false;
      const started = await durableAgent.stream('Look it up', {
        requireToolApproval: true,
        onSuspended: () => {
          suspended = true;
        },
      });
      const { runId } = started;
      const suspendedFence = ExecutionFence.getLocalActive(runId)!;
      const foreign = foreignOwnership(backend, storage, durableAgent.pubsub);
      await vi.waitFor(() => expect(suspended).toBe(true));
      await suspendedFence.whenSettled;
      expect(await suspendedFence.settle(async () => {})).toBe('owned');
      expect(await foreign.owner(durableAgent.id, runId)).toBeUndefined();

      // ---- Another execution holds the run: resume() must not drive it.
      await foreign.hold(durableAgent.id, runId, 'foreign-holder');
      await withFakeClock(async () => {
        await expect(durableAgent.resume(runId, { approved: true })).rejects.toMatchObject({
          id: EXECUTION_CONFLICT_ERROR_ID,
        });
      });
      expect(execute).not.toHaveBeenCalled();
      expect(model.calls()).toBe(1);

      // ---- Once it is free, resume() claims it under a fresh execution id.
      await foreign.free(durableAgent.id, runId, 'foreign-holder');
      const resumed = await durableAgent.resume(runId, { approved: true });
      const resumedFence = ExecutionFence.getLocalActive(runId)!;
      expect(resumedFence.executionId).not.toBe(suspendedFence.executionId);
      const chunks = await drain(resumed.fullStream);
      expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
      expect(execute).toHaveBeenCalledTimes(1);
      expect(model.calls()).toBe(2);
      await resumedFence.whenSettled;
      expect(await resumedFence.settle(async () => {})).toBe('owned');
      expect(await foreign.owner(durableAgent.id, runId)).toBeUndefined();

      resumed.cleanup();
      started.cleanup();
    });

    it('recover() of a run this process is still executing rejects with RUN_ACTIVE_LOCALLY and leaves it running', async () => {
      const storage = createStorage(backend);
      const memory = new MockMemory({ storage });
      const model = gatedModel('the live answer');
      const durableAgent = buildAgent({ model: model.model, storage, memory });
      const result = await durableAgent.stream('What is the answer?', {
        memory: { thread: THREAD, resource: RESOURCE },
      });
      const { runId } = result;
      const stream = collect(result.fullStream);
      await model.entered;
      await waitForCheckpoint(storage, runId);

      const entry = globalRunRegistry.get(runId);
      const fence = ExecutionFence.getLocalActive(runId)!;
      const foreign = foreignOwnership(backend, storage, durableAgent.pubsub);

      await expect(durableAgent.recover(runId)).rejects.toMatchObject({ id: RECOVER_RUN_ACTIVE_LOCALLY_ERROR_ID });
      expect(globalRunRegistry.get(runId)).toBe(entry);
      expect(ExecutionFence.getLocalActive(runId)).toBe(fence);
      expect(fence.isLost()).toBe(false);
      expect(await foreign.owner(fence.agentId, runId)).toBe(fence.executionId);

      // ---- The live execution finishes as if recover() had never been called.
      model.release();
      await vi.waitFor(() => expect(stream.chunks.some(chunk => chunk.type === 'finish')).toBe(true));
      await fence.whenSettled;
      expect(await fence.settle(async () => {})).toBe('owned');
      await vi.waitFor(async () => expect(await assistantText(memory)).toContain('the live answer'));
      expect(model.calls()).toBe(1);

      await stream.stop();
      result.cleanup();
    });

    it('an execution whose lease vanished with no new owner reports the lease loss and keeps its snapshots', async () => {
      const storage = createStorage(backend);
      const memory = new MockMemory({ storage });
      const model = gatedModel('answer written without a lease');
      const durableAgent = buildAgent({ model: model.model, storage, memory });
      const result = await durableAgent.stream('What is the answer?', {
        memory: { thread: THREAD, resource: RESOURCE },
      });
      const { runId } = result;
      const stream = collect(result.fullStream);
      const errors: any[] = [];
      await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), (event: any) => {
        if (event.type === 'error') errors.push(event);
      });
      await model.entered;
      await waitForCheckpoint(storage, runId);

      const fence = ExecutionFence.getLocalActive(runId)!;
      await foreignOwnership(backend, storage, durableAgent.pubsub).vanish(fence);

      model.release();
      await fence.whenSettled;
      expect(await fence.settle(async () => {})).toBe('orphaned');

      await vi.waitFor(() => expect(errors).toHaveLength(1));
      expect(errors[0].data.error.message).toContain(`Durable run ${runId} lost its execution lease`);
      const workflows = (await storage.getStore('workflows'))!;
      expect(await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP })).not.toBeNull();
      expect(await assistantText(memory)).not.toContain('answer written without a lease');
      expect(model.calls()).toBe(1);

      await stream.stop();
      result.cleanup();
    });

    it('a delegated sub-agent sharing the requestContext does not disturb the parent execution', async () => {
      const storage = createStorage(backend);
      const memory = new MockMemory({ storage });
      const supervisorModel = toolCallThenTextModel('agent-researchAgent', { prompt: 'Research dolphins' }, 'Done');
      const subAgentModel = gatedModel('Dolphins are marine mammals.');
      subAgentModel.release();
      const researchAgent = new Agent({
        id: 'researchAgent',
        name: 'researchAgent',
        description: 'Researches a topic',
        instructions: 'You are a helpful sub-agent.',
        model: subAgentModel.model as LanguageModelV2,
      });
      const durableAgent = buildAgent({ model: supervisorModel.model, storage, memory, agents: { researchAgent } });

      const requestContext = new RequestContext();
      const result = await durableAgent.stream('Tell me about dolphins', {
        requestContext,
        memory: { thread: THREAD, resource: RESOURCE },
      });
      const { runId } = result;
      const fence = ExecutionFence.getLocalActive(runId)!;
      const chunks = await drain(result.fullStream);

      expect(chunks.some(chunk => chunk.type === 'error')).toBe(false);
      expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
      expect(subAgentModel.calls()).toBe(1);
      expect(supervisorModel.calls()).toBe(2);
      expect(getExecutionClaim(requestContext, runId)?.executionId).toBe(fence.executionId);
      await fence.whenSettled;
      expect(await fence.settle(async () => {})).toBe('owned');
      expect(await foreignOwnership(backend, storage, durableAgent.pubsub).owner(fence.agentId, runId)).toBeUndefined();
      await vi.waitFor(async () => expect(await assistantText(memory)).toContain('Done'));

      result.cleanup();
    });

    it('EventedAgent: a superseded execution checked by a worker without its fence does not overwrite the recovered answer or delete snapshots', async () => {
      const storage = createStorage(backend);
      const memory = new MockMemory({ storage });
      const model = gatedModel('stale answer from the superseded execution');
      // No agent pubsub: the evented agent adopts mastra.pubsub, which carries
      // both the engine's events and the execution lease.
      const eventedAgent = createEventedAgent({
        agent: new Agent({
          id: 'fence-agent',
          name: 'Fence Agent',
          instructions: 'You are a helpful agent.',
          model: model.model as LanguageModelV2,
          memory,
        }),
      });
      new Mastra({ agents: { 'fence-agent': eventedAgent as any }, logger: false, storage, pubsub });

      const result = await eventedAgent.stream('What is the answer?', {
        memory: { thread: THREAD, resource: RESOURCE },
      });
      const { runId } = result;
      const stream = collect(result.fullStream);
      const events: string[] = [];
      await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), (event: any) => {
        events.push(event.type === 'chunk' ? `chunk:${event.data?.type}` : event.type);
      });

      await model.entered;
      const messageId = stream.chunks.find(chunk => chunk.type === 'start')?.payload?.messageId;
      expect(messageId).toEqual(expect.any(String));

      // Forget the in-process fence, so the step checks go through the path a
      // remote worker takes: the workflows store, or the lease behind
      // mastra.getAgentById(agentId).
      const fence = ExecutionFence.getLocalActive(runId)!;
      __resetExecutionFencesForTests();

      const foreign = foreignOwnership(backend, storage, eventedAgent.pubsub);
      await foreign.takeOver(fence, 'foreign-recoverer');
      // The recoverer drives the run from the stored rows (the evented engine
      // keeps the nested iteration run under its own runId), so the superseded
      // execution must not write to them at all.
      const workflows = (await storage.getStore('workflows'))!;
      const statuses = async () => {
        const { runs } = await workflows.listWorkflowRuns({});
        return Object.fromEntries(runs.map(run => [run.workflowName, (run.snapshot as { status?: string }).status]));
      };
      expect(await statuses()).toEqual({
        [DurableStepIds.AGENTIC_LOOP]: 'running',
        [DurableStepIds.AGENTIC_EXECUTION]: 'running',
      });
      const writes = (
        ['persistWorkflowSnapshot', 'updateWorkflowResults', 'updateWorkflowState', 'deleteWorkflowRunById'] as const
      ).map(method => vi.spyOn(workflows, method));
      await memory.saveMessages({ messages: [recoveredAssistantMessage(messageId, 'recovered answer')] });

      model.release();
      await fence.whenSettled;
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(await assistantText(memory)).toContain('recovered answer');
      expect(await assistantText(memory)).not.toContain('stale answer');
      for (const write of writes) expect(write).not.toHaveBeenCalled();
      expect(await statuses()).toEqual({
        [DurableStepIds.AGENTIC_LOOP]: 'running',
        [DurableStepIds.AGENTIC_EXECUTION]: 'running',
      });
      expect(await fence.settle(async () => {})).toBe('superseded');
      expect(await foreign.owner(fence.agentId, runId)).toBe('foreign-recoverer');
      expect(events).not.toContain('finish');
      expect(events).not.toContain('error');
      expect(events).not.toContain('chunk:finish');
      expect(events).not.toContain('chunk:error');
      expect(model.calls()).toBe(1);

      await stream.stop();
      result.cleanup();
    });
  },
);
