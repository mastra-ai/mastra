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
import { InMemoryServerCache } from '../../../cache/inmemory';
import type { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { PubSub } from '../../../events/pubsub';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { RequestContext } from '../../../request-context';
import { InMemoryStore, RUN_FENCE_CONFLICT_ERROR_ID, resolveRunFence } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { SaveQueueManager } from '../../save-queue';
import { agentThreadStreamRuntime } from '../../thread-stream-runtime';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes, DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import {
  DurableExecutionFenceError,
  EXECUTION_ABANDONED_ERROR_ID,
  EXECUTION_CONFLICT_ERROR_ID,
  EXECUTION_LEASE_RENEW_INTERVAL_MS,
  EXECUTION_LEASE_TTL_MS,
  ExecutionFence,
  RECOVER_RUN_ACTIVE_LOCALLY_ERROR_ID,
  RUN_ACTIVE_ERROR_ID,
  __resetExecutionFencesForTests,
  executionLeaseKey,
  getExecutionClaim,
  resolveLeaseProvider,
} from '../execution-fence';
import { runInRunFenceScope } from '../run-fence-scope';
import { globalRunRegistry } from '../run-registry';
import { emitChunkEvent, emitErrorEvent } from '../stream-adapter';

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

/**
 * A model that records each call's prompt; call `n` waits for `gates[n - 1]`, when given, before it answers.
 * With `firstCalls`, the first call calls that tool instead of answering.
 */
function recordingModel(gates: Array<Promise<void> | undefined>, firstCalls?: string) {
  const prompts: string[] = [];
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const call = prompts.push(JSON.stringify(prompt));
      await gates[call - 1];
      const body =
        call === 1 && firstCalls
          ? [
              {
                type: 'tool-call' as const,
                toolCallType: 'function' as const,
                toolCallId: 'call-1',
                toolName: firstCalls,
                input: '{}',
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
              { type: 'text-delta' as const, id: 'text-1', delta: `answer ${call}` },
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
          { type: 'response-metadata' as const, id: `resp-${call}`, modelId: 'mock', timestamp: new Date(0) },
          ...body,
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

function gate() {
  let open!: () => void;
  const opened = new Promise<void>(resolve => {
    open = resolve;
  });
  return { opened, open };
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
      cache?: InMemoryServerCache;
      cleanupTimeoutMs?: number;
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
        ...(args.cache ? { cache: args.cache } : {}),
        ...(args.cleanupTimeoutMs !== undefined ? { cleanupTimeoutMs: args.cleanupTimeoutMs } : {}),
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

    it.each(['default', 'evented'] as const)(
      '%s: losing ownership at the initial input barrier neither writes the request nor calls the model (COR-1472)',
      async engine => {
        const storage = createStorage(backend);
        const memory = new MockMemory({ storage });
        const model = gatedModel('This execution must never reach the model.');
        const agent = new Agent({
          id: 'barrier-fence-agent',
          name: 'Barrier Fence Agent',
          instructions: 'Answer the request.',
          model: model.model as LanguageModelV2,
          memory,
        });
        const durableAgent =
          engine === 'evented' ? createEventedAgent({ agent, pubsub }) : createDurableAgent({ agent, pubsub });
        new Mastra({ agents: { agent: durableAgent }, storage, pubsub, logger: false });
        const runId = `initial-barrier-${backend}-${engine}`;
        let fence: ExecutionFence | undefined;
        const flushMessages = SaveQueueManager.prototype.flushMessages;
        // Move ownership immediately before the real queued guard runs; keep the queue and storage real.
        vi.spyOn(SaveQueueManager.prototype, 'flushMessages').mockImplementationOnce(async function (...args) {
          fence = ExecutionFence.getLocalActive(runId)!;
          await foreignOwnership(backend, storage, pubsub).takeOver(fence, 'barrier-recoverer');
          return flushMessages.apply(this, args);
        });

        const result = await durableAgent.stream('Do not lose or execute this superseded request.', {
          runId,
          memory: { thread: THREAD, resource: RESOURCE },
        });
        const stream = collect(result.fullStream);
        try {
          await vi.waitFor(() => expect(fence).toBeDefined());
          await fence!.whenSettled;
          expect(fence!.isLost()).toBe(true);
          expect(model.calls()).toBe(0);
          const store = (await storage.getStore('memory'))!;
          expect((await store.listMessages({ threadId: THREAD, perPage: false })).messages).toEqual([]);
          expect(await foreignOwnership(backend, storage, pubsub).isHeldBy(agent.id, runId, 'barrier-recoverer')).toBe(
            true,
          );
        } finally {
          model.release();
          await stream.stop();
          result.cleanup();
          await foreignOwnership(backend, storage, pubsub).free(agent.id, runId, 'barrier-recoverer');
        }
      },
    );

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

    it.skipIf(backend === 'lease')(
      "recover({ force: true }) announces its claim on the run stream, and the run's readers drop what the superseded execution still publishes",
      async () => {
        const storage = createStorage(backend);
        const memory = new MockMemory({ storage });
        // Processes that hand a run to each other share the stream cache, as they share the bus.
        const cache = new InMemoryServerCache();

        const original = gatedModel('stale answer from the original execution');
        const agentA = buildAgent({ model: original.model, storage, memory, cache });
        const publish = vi.spyOn(pubsub, 'publish');
        const started = await agentA.stream('What is the answer?', { memory: { thread: THREAD, resource: RESOURCE } });
        const { runId } = started;
        // The original caller keeps reading: it follows the run across the takeover.
        const startedStream = collect(started.fullStream);
        const events: Array<{ type: string; generation?: number }> = [];
        // A frame reaches the transport only after it is in the run log, so a reader
        // that attaches after stream() started reads the log (which is what replay
        // from an offset does) instead of racing the live publish of frame 0.
        await (agentA.pubsub as unknown as CachingPubSub).subscribeWithReplay(AGENT_STREAM_TOPIC(runId), event => {
          events.push({
            type: event.type === 'chunk' ? `chunk:${(event.data as any)?.type}` : event.type,
            generation: event.generation,
          });
        });
        await original.entered;
        await waitForCheckpoint(storage, runId);

        const originalGeneration = ExecutionFence.getLocalActive(runId)!.generation!;
        expect(originalGeneration).toEqual(expect.any(Number));
        // The real LLM execution boundary precedes any model or processor output.
        const history = await (agentA.pubsub as CachingPubSub).getHistory(AGENT_STREAM_TOPIC(runId), 0);
        const abandonedStartAt = history.findLast(event => event.type === AgentStreamEventTypes.ITERATION_START)?.index;
        expect(abandonedStartAt).toEqual(expect.any(Number));
        // Simulate a model step published before its result was checkpointed.
        await agentA.pubsub.publish(AGENT_STREAM_TOPIC(runId), {
          type: AgentStreamEventTypes.STEP_START,
          runId,
          data: { type: 'step-start', payload: { messageId: 'same-message' } },
          stepIndex: 0,
          generation: originalGeneration,
          producedAt: Date.now(),
        });
        // The original execution's events so far carry its claim.
        await vi.waitFor(() => expect(events.length).toBeGreaterThan(0));
        expect(events.every(event => event.generation === originalGeneration)).toBe(true);

        // ---- This process forgets it drives the run, as a restarted process would, and takes it over.
        globalRunRegistry.clear();
        __resetExecutionFencesForTests();
        const recovering = gatedModel('recovered answer');
        const agentB = buildAgent({ model: recovering.model, storage, memory, cache });
        const recovered = await agentB.recover(runId, { force: true });
        const recoveredStream = collect(recovered.fullStream);
        const recoveredGeneration = ExecutionFence.getLocalActive(runId)!.generation!;
        expect(recoveredGeneration).toBeGreaterThan(originalGeneration);

        // ---- The original execution publishes before it notices the takeover.
        await runInRunFenceScope({ fenceFor: () => undefined, generationFor: () => originalGeneration }, () =>
          emitChunkEvent(pubsub, runId, {
            type: 'text-delta',
            payload: { id: 'text-1', text: 'late stale chunk' },
          } as any),
        );
        original.release();
        recovering.release();

        await vi.waitFor(() => expect(recoveredStream.chunks.some(chunk => chunk.type === 'finish')).toBe(true));
        await vi.waitFor(() => expect(startedStream.chunks.some(chunk => chunk.type === 'finish')).toBe(true));

        const textOf = (chunks: any[]) =>
          chunks
            .filter(chunk => chunk.type === 'text-delta')
            .map(chunk => chunk.payload.text)
            .join('');
        expect(textOf(recoveredStream.chunks)).toBe('recovered answer');
        expect(textOf(startedStream.chunks)).toBe('recovered answer');

        // The claim is announced before the recovered execution publishes, and everything it publishes carries it.
        const claimedAt = events.findIndex(event => event.type === AgentStreamEventTypes.OWNERSHIP_CLAIMED);
        expect(events[claimedAt]?.generation).toBe(recoveredGeneration);
        const replay = await (agentA.pubsub as CachingPubSub).getHistory(AGENT_STREAM_TOPIC(runId), 0);
        expect((replay[claimedAt]?.data as { supersededFrom?: number }).supersededFrom).toBe(abandonedStartAt);
        const replayed: Array<{ type: string; generation?: number }> = [];
        const unsubscribe = await agentB.__subscribeToRunStream(runId, {}, event => replayed.push(event));
        expect(
          replayed.filter(
            event => event.type === AgentStreamEventTypes.STEP_START && event.generation === originalGeneration,
          ),
        ).toHaveLength(0);
        await unsubscribe();
        const afterClaim = events.slice(claimedAt + 1);
        expect(afterClaim.some(event => event.type === 'finish' && event.generation === recoveredGeneration)).toBe(
          true,
        );
        expect(
          afterClaim
            .filter(event => event.generation !== recoveredGeneration)
            .every(e => e.generation === originalGeneration),
        ).toBe(true);
        expect(events.slice(0, claimedAt).every(event => event.generation === originalGeneration)).toBe(true);

        // On the thread stream, the recovery registration supersedes the original execution's stream.
        const registrations = publish.mock.calls
          .map(([, event]) => (event as { data?: any }).data)
          .filter(data => data?.type === 'run-registered' && data.runId === runId)
          .map(({ generation, supersedes }) => ({ generation, supersedes }));
        expect(registrations).toEqual([
          { generation: originalGeneration, supersedes: undefined },
          { generation: recoveredGeneration, supersedes: true },
        ]);

        await startedStream.stop();
        started.cleanup();
        recovered.cleanup();
      },
    );

    it.skipIf(backend === 'lease')(
      'uses the highest generation when a stale step start arrives after its successor',
      async () => {
        const storage = createStorage(backend);
        const memory = new MockMemory({ storage });
        const cache = new InMemoryServerCache();
        const original = gatedModel('original answer');
        const agentA = buildAgent({ model: original.model, storage, memory, cache });
        const started = await agentA.stream('What is the answer?', { memory: { thread: THREAD, resource: RESOURCE } });
        const { runId } = started;
        const originalStream = collect(started.fullStream);
        await original.entered;
        await waitForCheckpoint(storage, runId);
        const originalGeneration = ExecutionFence.getLocalActive(runId)!.generation!;

        // A prior takeover already started this iteration; its predecessor publishes a late start.
        // The next recovery must select the highest generation, not the last appended start.
        const successorStart = (await (agentA.pubsub as CachingPubSub).getHistory(AGENT_STREAM_TOPIC(runId), 0)).length;
        for (const generation of [originalGeneration + 1, originalGeneration]) {
          await agentA.pubsub.publish(AGENT_STREAM_TOPIC(runId), {
            type: AgentStreamEventTypes.ITERATION_START,
            runId,
            data: {},
            stepIndex: 0,
            generation,
            producedAt: Date.now(),
          });
        }

        globalRunRegistry.clear();
        __resetExecutionFencesForTests();
        const recovering = gatedModel('recovered answer');
        const agentB = buildAgent({ model: recovering.model, storage, memory, cache });
        const recovered = await agentB.recover(runId, { force: true });
        const claims = await (agentB.pubsub as CachingPubSub).getHistory(AGENT_STREAM_TOPIC(runId), 0);
        const claim = claims.findLast(event => event.type === AgentStreamEventTypes.OWNERSHIP_CLAIMED);
        expect((claim?.data as { supersededFrom?: number })?.supersededFrom).toBe(successorStart);
        original.release();
        recovering.release();
        await drain(recovered.fullStream);
        await originalStream.stop();
        started.cleanup();
        recovered.cleanup();
      },
    );

    it.skipIf(backend === 'lease')(
      'replay omits the superseded output of a tool call that recovery runs again, and keeps tool calls that finished',
      async () => {
        const storage = createStorage(backend);
        const memory = new MockMemory({ storage });
        const cache = new InMemoryServerCache();
        // MockLanguageModelV2 rather than aimock: the model call must be scripted in-process alongside a gated tool.
        let modelCalls = 0;
        const model = new MockLanguageModelV2({
          doStream: async () => {
            modelCalls++;
            const toolCall = (toolCallId: string, id: string) => ({
              type: 'tool-call' as const,
              toolCallType: 'function' as const,
              toolCallId,
              toolName: 'lookup',
              input: JSON.stringify({ id }),
              providerExecuted: false,
            });
            const body =
              modelCalls === 1
                ? [
                    toolCall('call-fast', 'fast'),
                    toolCall('call-slow', 'slow'),
                    {
                      type: 'finish' as const,
                      finishReason: 'tool-calls' as const,
                      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                    },
                  ]
                : [
                    { type: 'text-start' as const, id: 'text-1' },
                    { type: 'text-delta' as const, id: 'text-1', delta: 'final answer' },
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
                {
                  type: 'response-metadata' as const,
                  id: `resp-${modelCalls}`,
                  modelId: 'mock',
                  timestamp: new Date(0),
                },
                ...body,
              ]),
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          },
        });
        const slowGate = gate();
        let slowEntered!: () => void;
        const slowStarted = new Promise<void>(resolve => {
          slowEntered = resolve;
        });
        const toolRuns: string[] = [];
        const lookupTool = (blockSlow: boolean) =>
          createTool({
            id: 'lookup',
            description: 'Look something up',
            inputSchema: z.object({ id: z.string() }),
            execute: async ({ id }) => {
              toolRuns.push(id);
              if (blockSlow && id === 'slow') {
                slowEntered();
                await slowGate.opened;
              }
              return { found: id };
            },
          });

        const agentA = buildAgent({ model, storage, memory, cache, tools: { lookup: lookupTool(true) } });
        const started = await agentA.stream('What is the answer?', { memory: { thread: THREAD, resource: RESOURCE } });
        const { runId } = started;
        const originalStream = collect(started.fullStream);
        await slowStarted;
        const originalGeneration = ExecutionFence.getLocalActive(runId)!.generation!;

        // Wait until the model step and the fast tool call are checkpointed while the slow one still runs.
        const workflows = (await storage.getStore('workflows'))!;
        await vi.waitFor(async () => {
          const parent = await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
          const parentSnapshot = parent?.snapshot as any;
          const nestedRunId = parentSnapshot?.context?.[DurableStepIds.AGENTIC_EXECUTION]?.metadata?.nestedRunId;
          const nested = await workflows.getWorkflowRunById({
            runId: nestedRunId ?? runId,
            workflowName: DurableStepIds.AGENTIC_EXECUTION,
          });
          const context = (nested?.snapshot as any)?.context;
          expect(context?.[DurableStepIds.LLM_EXECUTION]?.status).toBe('success');
          expect(context?.[DurableStepIds.TOOL_CALL]?.metadata?.foreachProgress?.[0]).toBeDefined();
        });

        // The slow call's result is published before the run is taken over, but never checkpointed.
        await agentA.pubsub.publish(AGENT_STREAM_TOPIC(runId), {
          type: AgentStreamEventTypes.CHUNK,
          runId,
          data: {
            type: 'tool-result',
            runId,
            from: 'AGENT',
            payload: { toolCallId: 'call-slow', toolName: 'lookup', result: { found: 'stale' } },
          },
          generation: originalGeneration,
          producedAt: Date.now(),
        });

        globalRunRegistry.clear();
        __resetExecutionFencesForTests();
        const agentB = buildAgent({ model, storage, memory, cache, tools: { lookup: lookupTool(false) } });
        const recovered = await agentB.recover(runId, { force: true });
        const recoveredGeneration = ExecutionFence.getLocalActive(runId)!.generation!;
        expect(recoveredGeneration).toBeGreaterThan(originalGeneration);
        const history = await (agentB.pubsub as CachingPubSub).getHistory(AGENT_STREAM_TOPIC(runId), 0);
        const claim = history.findLast(event => event.type === AgentStreamEventTypes.OWNERSHIP_CLAIMED);
        expect(claim?.data).toMatchObject({ supersededToolCallIds: ['call-slow'] });
        const staleAt = history.findIndex(event => (event.data as any)?.payload?.result?.found === 'stale');
        expect(staleAt).toBeGreaterThan(-1);
        expect(staleAt).toBeLessThan(history.indexOf(claim!));

        const recoveredChunks = await drain(recovered.fullStream);
        expect(recoveredChunks.some(chunk => chunk.type === 'finish')).toBe(true);
        slowGate.open();
        // Recovery runs only the call that had not finished.
        expect(toolRuns).toEqual(['fast', 'slow', 'slow']);

        const replayed: Array<{ type: string; generation?: number; data?: any }> = [];
        const unsubscribe = await agentB.__subscribeToRunStream(runId, {}, event => replayed.push(event));
        await unsubscribe();
        const chunks = replayed.filter(event => event.type === AgentStreamEventTypes.CHUNK).map(event => event.data);
        const resultsFor = (toolCallId: string) =>
          chunks
            .filter(chunk => chunk?.type === 'tool-result' && chunk.payload?.toolCallId === toolCallId)
            .map(chunk => chunk.payload.result);
        // The model step's tool calls were checkpointed and stay; the fast call's result stays.
        expect(chunks.filter(chunk => chunk?.type === 'tool-call').map(chunk => chunk.payload.toolCallId)).toEqual([
          'call-fast',
          'call-slow',
        ]);
        expect(resultsFor('call-fast')).toEqual([{ found: 'fast' }]);
        // The slow call's superseded result is replaced by the one its re-run published.
        expect(resultsFor('call-slow')).toEqual([{ found: 'slow' }]);

        await originalStream.stop();
        started.cleanup();
        recovered.cleanup();
      },
    );

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

    it('a timed-out boot recovery keeps its live owner until shutdown and discards late provider output', async () => {
      const storage = createStorage(backend);
      const workflows = (await storage.getStore('workflows'))!;
      const crashed = gatedModel('output from the crashed process');
      const crashedAgent = buildAgent({ model: crashed.model, storage });
      const started = await crashedAgent.stream('What is the answer?');
      const { runId } = started;
      const originalStream = collect(started.fullStream);
      await crashed.entered;
      await waitForCheckpoint(storage, runId);
      const originalFence = ExecutionFence.getLocalActive(runId)!;
      await originalFence.abandon();
      crashed.release();
      await originalFence.whenSettled;
      await originalStream.stop();
      started.cleanup();
      globalRunRegistry.clear();
      __resetExecutionFencesForTests();

      const next = gatedModel('late output from timed-out recovery');
      const durableAgent = createDurableAgent({
        agent: new Agent({
          id: 'fence-agent',
          name: 'Fence Agent',
          instructions: 'You are a helpful agent.',
          model: next.model as LanguageModelV2,
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
      const foreign = foreignOwnership(backend, storage, durableAgent.pubsub);
      const publish = vi.spyOn(pubsub, 'publish');
      const recover = vi.spyOn(durableAgent, 'recoverActiveRuns');
      const persist = vi.spyOn(workflows, 'persistWorkflowSnapshot');
      const remove = vi.spyOn(durableAgent, 'deleteRunSnapshots');
      vi.useFakeTimers();
      try {
        const recoveryStartedAt = Date.now();
        const recovery = mastra.recoverAllDurableAgents();
        await vi.waitFor(() => expect(next.calls()).toBe(1));
        const fence = ExecutionFence.getLocalActive(runId)!;
        const execution = globalRunRegistry.get(runId)!.workflowExecution!;
        const signal = globalRunRegistry.get(runId)!.abortController!.signal;
        expect(fence).toBeDefined();

        await vi.advanceTimersByTimeAsync(30_000);
        expect(await recovery).toEqual({ agents: 1, recovered: 0, succeeded: 0, failed: 0, skipped: 1 });
        const batch = await recover.mock.results[0]!.value;
        expect(batch).toEqual({
          recovered: [{ runId, status: 'skipped', reason: 'recovery-timeout', retryAt: expect.any(Number) }],
          succeeded: 0,
          failed: 0,
        });
        expect(batch.recovered[0]!.retryAt).toBeGreaterThanOrEqual(recoveryStartedAt + 60_000);
        expect(batch.recovered[0]!.retryAt).toBeLessThanOrEqual(Date.now() + 30_000);
        expect(ExecutionFence.getLocalActive(runId)).toBe(fence);
        expect(await foreign.owner(fence.agentId, runId)).toBe(fence.executionId);
        expect(signal.aborted).toBe(false);
        expect(remove).not.toHaveBeenCalled();

        const shutdown = mastra.shutdown({ drainTimeout: 100 });
        await vi.advanceTimersByTimeAsync(100);
        await shutdown;
        expect(signal.aborted).toBe(true);
        expect(signal.reason).toMatchObject({ id: EXECUTION_ABANDONED_ERROR_ID });
        expect(ExecutionFence.getLocalActive(runId)).toBeUndefined();
        expect(await foreign.owner(fence.agentId, runId)).toBeUndefined();

        const checkpoint = await workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId });
        expect(checkpoint?.status).toBe('running');
        persist.mockClear();
        next.release();
        await execution.catch(() => {});
        await vi.advanceTimersByTimeAsync(100);
        expect(await workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId })).toEqual(
          checkpoint,
        );
        expect(persist).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
        const events = publish.mock.calls
          .filter(([topic]) => topic === AGENT_STREAM_TOPIC(runId))
          .map(([, event]) => (event.type === 'chunk' ? `chunk:${event.data?.type}` : event.type));
        expect(events).not.toContain('finish');
        expect(events).not.toContain('error');
        expect(events).not.toContain('chunk:finish');
        expect(events).not.toContain('chunk:error');
      } finally {
        next.release();
        vi.useRealTimers();
        await mastra.shutdown({ drainTimeout: 0 });
      }
    });

    it('shutdown() waits for a recovery re-check still claiming its run, and releases the run it claimed', async () => {
      const storage = createStorage(backend);

      // ---- A crashed process left the run checkpointed as running.
      const crashed = gatedModel('never produced');
      const crashedAgent = buildAgent({ model: crashed.model, storage });
      const { runId } = await crashedAgent.stream('What is the answer?');
      await crashed.entered;
      await waitForCheckpoint(storage, runId);
      const crashedFence = ExecutionFence.getLocalActive(runId)!;
      globalRunRegistry.clear();
      __resetExecutionFencesForTests();
      const foreign = foreignOwnership(backend, storage, crashedAgent.pubsub);
      await foreign.vanish(crashedFence);

      const next = gatedModel('recovered answer');
      const durableAgent = createDurableAgent({
        agent: new Agent({
          id: 'fence-agent',
          name: 'Fence Agent',
          instructions: 'You are a helpful agent.',
          model: next.model as LanguageModelV2,
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

      // ---- Boot recovery skipped the run, so a re-check is due right away; it blocks mid-claim.
      vi.spyOn(durableAgent, 'recoverActiveRuns').mockResolvedValueOnce({
        recovered: [{ runId, status: 'skipped', reason: 'run-active', retryAt: Date.now() }],
        succeeded: 0,
        failed: 0,
      });
      let enterClaim!: () => void;
      const claimEntered = new Promise<void>(resolve => (enterClaim = resolve));
      let releaseClaim!: () => void;
      const claimGate = new Promise<void>(resolve => (releaseClaim = resolve));
      const claim = ExecutionFence.claim.bind(ExecutionFence);
      vi.spyOn(ExecutionFence, 'claim').mockImplementation(async args => {
        enterClaim();
        await claimGate;
        return claim(args);
      });
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await mastra.recoverAllDurableAgents();
      await claimEntered;

      // ---- A claim that lands during shutdown is released without starting the model.
      const shutdown = mastra.shutdown({ drainTimeout: 200 });
      releaseClaim();
      await shutdown;
      expect(next.calls()).toBe(0);

      expect(ExecutionFence.getLocalActive(runId)).toBeUndefined();
      expect(await foreign.owner(durableAgent.id, runId)).toBeUndefined();
      next.release();
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

    it('a resume() that fails to read the suspended run after claiming it releases the run, so a retry resumes it', async () => {
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

      // ---- The first snapshot read made while resume() holds the run fails.
      const workflows = storage.stores.workflows!;
      const getWorkflowRunById = workflows.getWorkflowRunById.bind(workflows);
      let failedRead = false;
      vi.spyOn(workflows, 'getWorkflowRunById').mockImplementation(async args => {
        if (!failedRead && ExecutionFence.getLocalActive(runId)) {
          failedRead = true;
          throw new Error('storage unavailable');
        }
        return getWorkflowRunById(args);
      });

      await expect(durableAgent.resume(runId, { approved: true })).rejects.toThrow('storage unavailable');
      expect(failedRead).toBe(true);
      expect(ExecutionFence.getLocalActive(runId)).toBeUndefined();
      expect(await foreign.owner(durableAgent.id, runId)).toBeUndefined();
      expect(execute).not.toHaveBeenCalled();

      // ---- A retry claims the run and finishes it.
      const resumed = await durableAgent.resume(runId, { approved: true });
      const resumedFence = ExecutionFence.getLocalActive(runId)!;
      const chunks = await drain(resumed.fullStream);
      expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
      expect(execute).toHaveBeenCalledTimes(1);
      expect(model.calls()).toBe(2);
      await resumedFence.whenSettled;
      expect(await foreign.owner(durableAgent.id, runId)).toBeUndefined();

      resumed.cleanup();
      started.cleanup();
    });

    it('a resume() whose workflow lookup throws after claiming the run releases the run, so a retry resumes it', async () => {
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

      // ---- The first workflow lookup made while resume() holds the run throws.
      const getWorkflow = durableAgent.getWorkflow.bind(durableAgent);
      let failedLookup = false;
      vi.spyOn(durableAgent, 'getWorkflow').mockImplementation(() => {
        if (!failedLookup && ExecutionFence.getLocalActive(runId)) {
          failedLookup = true;
          throw new Error('workflow unavailable');
        }
        return getWorkflow();
      });

      const failed = await durableAgent.resume(runId, { approved: true }).catch(() => undefined);
      if (failed) await drain(failed.fullStream).catch(() => undefined);
      expect(failedLookup).toBe(true);
      await vi.waitFor(() => expect(ExecutionFence.getLocalActive(runId)).toBeUndefined());
      expect(await foreign.owner(durableAgent.id, runId)).toBeUndefined();
      expect(execute).not.toHaveBeenCalled();
      failed?.cleanup();

      // ---- A retry claims the run and finishes it.
      const resumed = await durableAgent.resume(runId, { approved: true });
      const resumedFence = ExecutionFence.getLocalActive(runId)!;
      const chunks = await drain(resumed.fullStream);
      expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
      expect(execute).toHaveBeenCalledTimes(1);
      await resumedFence.whenSettled;
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

    it.each([
      ['stream', 'takeOver'],
      ['stream', 'vanish'],
      ['resume', 'takeOver'],
      ['resume', 'vanish'],
      ['generate', 'takeOver'],
      ['generate', 'vanish'],
      ['recover', 'takeOver'],
      ['recover', 'vanish'],
    ] as const)(
      "cleaning up after a %s() execution that lost its run (%s) leaves the run's topics to whoever takes it over",
      async (caller, loss) => {
        const storage = createStorage(backend);
        const memory = new MockMemory({ storage });
        const originalCall = gate();
        const lostCall = gate();
        // A resumed run first suspends on a tool call awaiting approval; a
        // recovered run was first driven by an execution that lost it.
        const earlier = caller === 'resume' || caller === 'recover' ? 1 : 0;
        const { model, prompts } = recordingModel(
          [caller === 'recover' ? originalCall.opened : undefined, lostCall.opened].slice(1 - earlier),
          caller === 'resume' ? 'lookup' : undefined,
        );
        const lookup = createTool({
          id: 'lookup',
          description: 'Look something up',
          inputSchema: z.object({}),
          requireApproval: true,
          execute: async () => ({ found: true }),
        });
        const durableAgent = buildAgent({ model, storage, memory, tools: { lookup }, cleanupTimeoutMs: 10 });
        const clearTopic = vi.spyOn(durableAgent.pubsub, 'clearTopic');
        const runId = crypto.randomUUID();
        const cleanups: Array<() => void> = [];

        let ended: Promise<unknown>;
        if (caller === 'generate') {
          ended = durableAgent.generate('What is the answer?', {
            runId,
            memory: { thread: THREAD, resource: RESOURCE },
          });
        } else {
          let suspended = false;
          const started = await durableAgent.stream('What is the answer?', {
            runId,
            memory: { thread: THREAD, resource: RESOURCE },
            requireToolApproval: caller === 'resume',
            onSuspended: () => {
              suspended = true;
            },
          });
          cleanups.push(started.cleanup);
          let result = started;
          if (caller === 'resume') {
            const suspendedFence = ExecutionFence.getLocalActive(runId)!;
            await vi.waitFor(() => expect(suspended).toBe(true));
            await suspendedFence.whenSettled;
            result = await durableAgent.resume(runId, { approved: true });
            cleanups.push(result.cleanup);
          }
          if (caller === 'recover') {
            // The first execution loses the run with nobody taking it over and
            // ends; this process then recovers the run. `force`: the lost
            // execution still holds the thread's lease.
            await vi.waitFor(() => expect(prompts).toHaveLength(1));
            await waitForCheckpoint(storage, runId);
            await foreignOwnership(backend, storage, durableAgent.pubsub).vanish(ExecutionFence.getLocalActive(runId)!);
            originalCall.open();
            await drain(started.fullStream).catch(() => {});
            result = await durableAgent.recover(runId, { force: true });
            cleanups.push(result.cleanup);
          }
          ended = drain(result.fullStream);
        }
        ended.catch(() => {}); // awaited below
        await vi.waitFor(() => expect(prompts).toHaveLength(earlier + 1));
        await waitForCheckpoint(storage, runId);

        const fence = ExecutionFence.getLocalActive(runId)!;
        const foreign = foreignOwnership(backend, storage, durableAgent.pubsub);
        if (loss === 'takeOver') await foreign.takeOver(fence, 'foreign-recoverer');
        else await foreign.vanish(fence);

        lostCall.open();
        await fence.whenSettled;
        expect(await fence.settle(async () => {})).toBe(loss === 'takeOver' ? 'superseded' : 'orphaned');
        // A lost lease is reported by the execution itself; a run taken over
        // ends when the execution that took it ends.
        if (loss === 'takeOver') {
          await emitErrorEvent(durableAgent.pubsub, runId, new Error('ended elsewhere'), (fence.generation ?? 0) + 1);
        }
        await ended.catch(() => {});

        // The caller's cleanup ran (its timer, or generate()'s own) and dropped
        // the run's registry entry...
        await vi.waitFor(() => expect(globalRunRegistry.get(runId)).toBeUndefined());
        for (const cleanup of cleanups) cleanup();
        // ...but left the topics alone.
        expect(clearTopic).not.toHaveBeenCalledWith(AGENT_STREAM_TOPIC(runId));
        expect(clearTopic).not.toHaveBeenCalledWith(`workflow.events.v2.${runId}`);
      },
    );

    it.each([
      ['stream', 'before'],
      ['stream', 'after'],
      ['resume', 'before'],
      ['resume', 'after'],
    ] as const)(
      'a follow-up queued for a run its %s() execution lost reaches the execution that recovers the run in this process, started %s the lost one ends',
      async (caller, recoveryStarts) => {
        const storage = createStorage(backend);
        const memory = new MockMemory({ storage });
        const originalCall = gate();
        const recoveryCall = gate();
        // A resumed run first suspends on a tool call awaiting approval.
        const earlier = caller === 'resume' ? 1 : 0;
        const { model, prompts } = recordingModel(
          [...Array(earlier), originalCall.opened, recoveryCall.opened],
          caller === 'resume' ? 'lookup' : undefined,
        );
        const lookup = createTool({
          id: 'lookup',
          description: 'Look something up',
          inputSchema: z.object({}),
          requireApproval: true,
          execute: async () => ({ found: true }),
        });
        const durableAgent = buildAgent({ model, storage, memory, tools: { lookup } });
        let suspended = false;
        const started = await durableAgent.stream('What is the answer?', {
          memory: { thread: THREAD, resource: RESOURCE },
          requireToolApproval: caller === 'resume',
          onSuspended: () => {
            suspended = true;
          },
        });
        const { runId } = started;
        let result = started;
        if (caller === 'resume') {
          const suspendedFence = ExecutionFence.getLocalActive(runId)!;
          await vi.waitFor(() => expect(suspended).toBe(true));
          await suspendedFence.whenSettled;
          result = await durableAgent.resume(runId, { approved: true });
        }
        const stream = collect(result.fullStream);
        await vi.waitFor(() => expect(prompts).toHaveLength(earlier + 1));
        await waitForCheckpoint(storage, runId);

        const sent = durableAgent.sendSignal(
          { type: 'user-message', contents: 'follow-up' },
          { runId, threadId: THREAD, resourceId: RESOURCE },
        );
        expect(await sent.accepted).toMatchObject({ action: 'deliver', runId });

        // ---- The execution's claim lapses with nobody taking the run (say,
        // storage was unreachable while it renewed), and it notices.
        const fence = ExecutionFence.getLocalActive(runId)!;
        await foreignOwnership(backend, storage, durableAgent.pubsub).vanish(fence);
        await expect(fence.verify()).rejects.toBeInstanceOf(DurableExecutionFenceError);

        const publish = vi.spyOn(pubsub, 'publish');
        const endLostExecution = async () => {
          originalCall.open();
          await fence.whenSettled;
          // Before any recovery, the lost execution reports the lost lease, which
          // ends its run on the thread. After the recovery claimed the run, it is
          // superseded and ends without a word. Then its caller cleans up.
          if (recoveryStarts === 'after') {
            await vi.waitFor(() =>
              expect(
                publish.mock.calls.some(([, event]) => event.type === 'run-completed' && event.runId === runId),
              ).toBe(true),
            );
          }
          await stream.stop();
          result.cleanup();
        };
        if (recoveryStarts === 'after') await endLostExecution();

        // ---- This process recovers the run. `force`: the lost execution still
        // holds the thread's lease, which counts as live for a lease-backed run.
        const recovered = await durableAgent.recover(runId, { force: true });
        if (recoveryStarts === 'before') {
          await vi.waitFor(() => expect(prompts).toHaveLength(earlier + 2));
          await endLostExecution();
        }
        recoveryCall.open();

        const chunks = await drain(recovered.fullStream);
        expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
        // The follow-up cancels the lost execution's request, which has no output
        // yet. Whether the recovery repeats that request depends on whether the
        // cancellation was checkpointed first. Either way, its last request is the
        // first to carry the follow-up, exactly once.
        const recoveryPrompts = prompts.slice(earlier + 1);
        expect(recoveryPrompts.slice(0, -1).some(prompt => prompt.includes('follow-up'))).toBe(false);
        expect(recoveryPrompts.at(-1)!.split('"text":"follow-up"')).toHaveLength(2);

        recovered.cleanup();
        started.cleanup();
      },
    );

    // generate() runs aren't registered with the thread runtime, so they take
    // no follow-ups; what matters is that its own cleanup spares the recovery.
    it.each(['before', 'after'] as const)(
      'a generate() execution that lost its run leaves alone the state of the execution that recovers the run in this process, started %s the lost one ends',
      async recoveryStarts => {
        const storage = createStorage(backend);
        const memory = new MockMemory({ storage });
        const originalCall = gate();
        const recoveryCall = gate();
        const { model, prompts } = recordingModel([originalCall.opened, recoveryCall.opened]);
        const durableAgent = buildAgent({ model, storage, memory });
        const clearTopic = vi.spyOn(durableAgent.pubsub, 'clearTopic');
        const runId = crypto.randomUUID();
        const generated = durableAgent.generate('What is the answer?', {
          runId,
          memory: { thread: THREAD, resource: RESOURCE },
        });
        generated.catch(() => {}); // awaited below
        await vi.waitFor(() => expect(prompts).toHaveLength(1));
        await waitForCheckpoint(storage, runId);

        const fence = ExecutionFence.getLocalActive(runId)!;
        await foreignOwnership(backend, storage, durableAgent.pubsub).vanish(fence);
        await expect(fence.verify()).rejects.toBeInstanceOf(DurableExecutionFenceError);

        const endLostExecution = async () => {
          originalCall.open();
          await fence.whenSettled;
        };
        if (recoveryStarts === 'after') {
          // Before any recovery, the lost execution reports the lost lease,
          // which ends generate() and runs its cleanup.
          await endLostExecution();
          await expect(generated).rejects.toThrow(`Durable run ${runId} lost its execution lease`);
        }

        const recovered = await durableAgent.recover(runId, { force: true });
        const recoveredEntry = globalRunRegistry.get(runId);
        const recoveredLocalEntry = durableAgent.runRegistry.get(runId);
        expect(recoveredEntry).toBeDefined();
        if (recoveryStarts === 'before') {
          await vi.waitFor(() => expect(prompts).toHaveLength(2));
          await endLostExecution();
        }
        recoveryCall.open();

        const chunks = await drain(recovered.fullStream);
        expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
        // After the recovery claimed the run, the lost execution is superseded
        // and ends without a word; its generate() ends with the run, as the
        // recovery finishes it, and then cleans up.
        if (recoveryStarts === 'before') await generated;
        expect(globalRunRegistry.get(runId)).toBe(recoveredEntry);
        expect(durableAgent.runRegistry.get(runId)).toBe(recoveredLocalEntry);
        expect(clearTopic).not.toHaveBeenCalledWith(AGENT_STREAM_TOPIC(runId));

        // The recovery's own cleanup still finds its state, and clears it.
        recovered.cleanup();
        expect(globalRunRegistry.get(runId)).toBeUndefined();
        expect(clearTopic).toHaveBeenCalledWith(AGENT_STREAM_TOPIC(runId));
      },
    );

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

    describe.each(['durable', 'evented'] as const)('%s in-flight tool ownership loss (COR-1473)', kind => {
      it.each([false, true])(
        'aborts the actual tool signal without canceling the successor (remote worker: %s)',
        async remote => {
          const storage = createStorage(backend);
          const memory = new MockMemory({ storage });
          const modelGate = gate();
          const toolEntered = gate();
          const toolAborted = gate();
          const releaseTool = gate();
          const { model, prompts } = recordingModel([modelGate.opened], 'lookup');
          let toolSignal: AbortSignal | undefined;
          const lookup = createTool({
            id: 'lookup',
            description: 'Wait for a lookup, honoring cancellation.',
            inputSchema: z.object({}),
            outputSchema: z.object({ result: z.string() }),
            execute: async (_input, context) => {
              toolSignal = context?.abortSignal;
              const onAbort = () => {
                toolAborted.open();
                releaseTool.open();
              };
              toolSignal?.addEventListener('abort', onAbort, { once: true });
              toolEntered.open();
              try {
                await releaseTool.opened;
                // An abort-aware tool may return after cleanup instead of throwing.
                // Its stale result must still never be persisted or fed to a model.
                return { result: 'stale lookup result' };
              } finally {
                toolSignal?.removeEventListener('abort', onAbort);
              }
            },
          });
          const agent = new Agent({
            id: 'fence-agent',
            name: 'Fence Agent',
            instructions: 'Call lookup.',
            model: model as LanguageModelV2,
            memory,
            tools: { lookup },
          });
          const durableAgent =
            kind === 'durable' ? createDurableAgent({ agent, pubsub }) : createEventedAgent({ agent });
          new Mastra({
            agents: { 'fence-agent': durableAgent as any },
            logger: false,
            storage,
            pubsub,
            recovery: { durableAgents: 'auto' },
          });
          const canceled: string[] = [];
          const publish = pubsub.publish.bind(pubsub);
          vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event, options) => {
            if (event.type === 'workflow.cancel') canceled.push(event.runId);
            return publish(topic, event, options);
          });
          const started = await durableAgent.stream('Look it up.', {
            memory: { thread: THREAD, resource: RESOURCE },
          });
          const original = collect(started.fullStream);
          const pollCallbacks: Array<() => void> = [];
          try {
            await vi.waitFor(() => expect(prompts).toHaveLength(1));
            const fence = ExecutionFence.getLocalActive(started.runId)!;
            expect(fence).toBeDefined();
            if (remote) {
              // Forget the driver before the tool's wrapper starts, not after it
              // subscribed to a local fence. This exercises remote worker reads.
              __resetExecutionFencesForTests();
              const setInterval = globalThis.setInterval;
              vi.spyOn(globalThis, 'setInterval').mockImplementation((callback, delay, ...args) => {
                if (delay === EXECUTION_LEASE_RENEW_INTERVAL_MS) pollCallbacks.push(() => callback(...args));
                return setInterval(callback, delay, ...args);
              });
            }
            modelGate.open();
            await toolEntered.opened;
            expect(toolSignal).toBeInstanceOf(AbortSignal);
            expect(toolSignal!.aborted).toBe(false);
            const foreign = foreignOwnership(backend, storage, durableAgent.pubsub);
            await foreign.takeOver(fence, 'foreign-recoverer');
            if (remote) {
              expect(ExecutionFence.getLocalActive(started.runId)).toBeUndefined();
              expect(pollCallbacks.length).toBeGreaterThan(0);
              // Run the real interval callback without waiting ten seconds or
              // faking runtime timers; the ownership reads and tool stay real.
              for (const poll of pollCallbacks) poll();
            } else {
              await expect(fence.verify()).rejects.toBeInstanceOf(DurableExecutionFenceError);
            }
            await vi.waitFor(() => expect(toolSignal!.aborted).toBe(true));
            await toolAborted.opened;
            expect(toolSignal!.reason).toBeInstanceOf(DurableExecutionFenceError);
            await fence.whenSettled;
            expect(prompts).toHaveLength(1);
            expect(await assistantText(memory)).not.toContain('stale lookup result');
            const { runs } = await storage.stores.workflows!.listWorkflowRuns({});
            expect(JSON.stringify(runs.map(run => run.snapshot))).not.toContain('stale lookup result');
            expect(canceled).toEqual([]);
            expect(await foreign.owner(fence.agentId, fence.runId)).toBe('foreign-recoverer');
            expect(original.chunks.some(chunk => chunk.type === 'tool-result')).toBe(false);

            const recovered = await durableAgent.recover(started.runId, { force: true });
            try {
              const recoveryFence = ExecutionFence.getLocalActive(started.runId)!;
              const chunks = await drain(recovered.fullStream);
              expect(chunks.some(chunk => chunk.type === 'error')).toBe(false);
              expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
              await recoveryFence.whenSettled;
              expect(await assistantText(memory)).toContain('answer 2');
            } finally {
              recovered.cleanup();
            }
          } finally {
            modelGate.open();
            releaseTool.open();
            await original.stop();
            started.cleanup();
          }
        },
      );
    });

    it('EventedAgent: the finish published by an execution that lost its run does not end the execution that recovered it', async () => {
      const storage = createStorage(backend);
      const memory = new MockMemory({ storage });
      const originalCall = gate();
      const recoveryCall = gate();
      const { model, prompts } = recordingModel([originalCall.opened, recoveryCall.opened]);
      const eventedAgent = createEventedAgent({
        agent: new Agent({
          id: 'fence-agent',
          name: 'Fence Agent',
          instructions: 'You are a helpful agent.',
          model: model as LanguageModelV2,
          memory,
        }),
      });
      new Mastra({
        agents: { 'fence-agent': eventedAgent as any },
        logger: false,
        storage,
        pubsub,
        recovery: { durableAgents: 'auto' },
      });
      const finishes: string[] = [];
      const publish = pubsub.publish.bind(pubsub);
      vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event, options) => {
        if (topic === 'workflows-finish' && event.runId) finishes.push(`${event.runId}:${event.type}`);
        return publish(topic, event, options);
      });

      const started = await eventedAgent.stream('What is the answer?', {
        memory: { thread: THREAD, resource: RESOURCE },
      });
      const { runId } = started;
      const original = collect(started.fullStream);
      await vi.waitFor(() => expect(prompts).toHaveLength(1));
      await waitForCheckpoint(storage, runId);

      const fence = ExecutionFence.getLocalActive(runId)!;
      await foreignOwnership(backend, storage, eventedAgent.pubsub).vanish(fence);
      await expect(fence.verify()).rejects.toBeInstanceOf(DurableExecutionFenceError);

      const recovered = await eventedAgent.recover(runId, { force: true });
      const recovery = ExecutionFence.getLocalActive(runId)!;
      expect(recovery).not.toBe(fence);
      await vi.waitFor(() => expect(prompts).toHaveLength(2));

      originalCall.open();
      await fence.whenSettled;
      await vi.waitFor(() => expect(finishes).toContain(`${runId}:workflow.fail`));
      recoveryCall.open();

      const chunks = await drain(recovered.fullStream);
      expect(chunks.some(chunk => chunk.type === 'error')).toBe(false);
      expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true);
      await vi.waitFor(async () => expect(await assistantText(memory)).toContain('answer 2'));
      // recover() is done only once its workflow settles; the next test recovers the same runId.
      await recovery.whenSettled;

      await original.stop();
      recovered.cleanup();
      started.cleanup();
    });
  },
);

describe.each(['durable', 'evented'] as const)('%s agent: the storage fence covers every run write', kind => {
  /** Records whether each `workflows` event left this process. */
  class RecordingPubSub extends EventEmitterPubSub {
    workflowEvents: Array<{ topic: string; localOnly: boolean }> = [];
    override publish(topic: string, event: any, options?: { localOnly?: boolean }) {
      if (topic.startsWith('workflows')) this.workflowEvents.push({ topic, localOnly: !!options?.localOnly });
      return super.publish(topic, event, options);
    }
  }

  afterEach(() => {
    vi.restoreAllMocks();
    globalRunRegistry.clear();
    __resetExecutionFencesForTests();
  });

  it("every workflows write carries the claim of the segment that makes it, including the evented engine's nested runs", async () => {
    const pubsub = new RecordingPubSub();
    const storage = new InMemoryStore();
    const workflows = storage.stores.workflows!;
    let segment = 0;
    const writes: Array<{ segment: number; workflowName: string; runId: string; fence: unknown }> = [];
    for (const method of ['persistWorkflowSnapshot', 'updateWorkflowResults', 'updateWorkflowState'] as const) {
      const write = workflows[method].bind(workflows) as (args: any) => Promise<any>;
      vi.spyOn(workflows, method).mockImplementation(async (args: any) => {
        writes.push({
          segment,
          workflowName: args.workflowName,
          runId: args.runId,
          fence: resolveRunFence(workflows, args.fence, args.runId),
        });
        return write(args);
      });
    }
    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up',
      inputSchema: z.object({ query: z.string() }),
      requireApproval: true,
      execute: async () => ({ found: true }),
    });
    const agent = (kind === 'durable' ? createDurableAgent : createEventedAgent)({
      agent: new Agent({
        id: 'fence-agent',
        name: 'Fence Agent',
        instructions: 'You are a helpful agent.',
        model: toolCallThenTextModel('lookup', { query: 'the answer' }, 'looked it up').model as LanguageModelV2,
        tools: { lookup },
        memory: new MockMemory({ storage }),
      }),
    });
    new Mastra({ agents: { 'fence-agent': agent as any }, logger: false, storage, pubsub });

    // Segment 0 suspends on the approval; segment 1 resumes the stored nested
    // run under a new claim.
    let suspended = false;
    const started = await agent.stream('Look it up', {
      requireToolApproval: true,
      memory: { thread: THREAD, resource: RESOURCE },
      onSuspended: () => {
        suspended = true;
      },
    });
    const { runId } = started;
    const claims = [ExecutionFence.getLocalActive(runId)!];
    await vi.waitFor(() => expect(suspended).toBe(true));
    await claims[0]!.whenSettled;

    segment = 1;
    const resumed = await agent.resume(runId, { approved: true });
    claims.push(ExecutionFence.getLocalActive(runId)!);
    expect(await resumed.output.text).toBe('looked it up');
    await claims[1]!.whenSettled;

    expect(new Set(writes.filter(write => write.segment === 0).map(write => write.workflowName))).toEqual(
      new Set([DurableStepIds.AGENTIC_LOOP, DurableStepIds.AGENTIC_EXECUTION]),
    );
    if (kind === 'evented') {
      // The evented engine stores each loop iteration under its own run id: a
      // fresh one in the first segment, and in the resumed segment the stored
      // one, read back from the parent's step metadata.
      for (const n of [0, 1]) {
        expect(writes.some(write => write.segment === n && write.runId !== runId)).toBe(true);
      }
    }
    for (const write of writes) {
      const claim = claims[write.segment]!;
      expect(write).toMatchObject({ fence: { runId, generation: claim.generation, ownerId: claim.executionId } });
    }
    expect(claims[1]!.generation).toBe(claims[0]!.generation! + 1);
    // The fence reaches the evented engine's writes through the async context
    // of the publish, so the events that drive the run must not leave this
    // process. `workflows-finish` may: it drives no writes, and a waiter
    // ignores another execution's finish.
    expect(pubsub.workflowEvents.filter(event => event.topic === 'workflows' && !event.localOnly)).toEqual([]);

    resumed.cleanup();
    started.cleanup();
    await pubsub.close();
  });
});
