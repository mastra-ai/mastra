/**
 * A run that loses its thread lease must stop (#27543).
 *
 * Two Mastra instances stand in for two replicas: each has its own pubsub, so
 * the thread-stream runtime keeps separate state for each, while both share
 * one lease backend, as two processes share Redis. The old replica's lease is
 * dropped in that backend (an expiry during a backend blip), its next renewal
 * fails, and a successor run on the other replica takes the thread. The old
 * run must stop calling the model and tools instead of running beside it.
 *
 * The same must hold when the old replica can't reach the backend at all: its
 * renewals reject or never settle instead of returning false, so only a local
 * deadline can tell it the lease may have lapsed.
 */
import { EventEmitter } from 'node:events';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '300';
});

import { EventEmitterPubSub } from '../../events/event-emitter';
import { describeForAllEngines } from '../../loop/test-utils/aimock/aimock-scenario';
import { isDurableEngineVariant } from '../../loop/test-utils/aimock/types';
import type { EngineVariant } from '../../loop/test-utils/aimock/types';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { createDurableAgent, createEventedAgent } from '../durable';
import { assembleAgentFromFsEntry } from '../fs-routing';
import { verifyRunLease } from '../run-lease-fence';

const THREAD = 'lease-loss-thread';
const RESOURCE = 'lease-loss-user';
const LEASE_KEY = [RESOURCE, THREAD].join('\u0000');
const PARTITION_THREAD = 'lease-partition-thread';

/** One lease table shared by every replica, with real expiry, like Redis. */
class SharedLeases {
  leases = new Map<string, { owner: string; expiresAt: number }>();
  /** Confirmed thread-lease renewals, so a test can act right after one. */
  renewals = 0;

  /** The backend forgets the lease, so the owner's next renewal fails. */
  drop(key: string) {
    this.leases.delete(key);
  }

  owner(key: string) {
    const lease = this.leases.get(key);
    return lease && lease.expiresAt > Date.now() ? lease.owner : undefined;
  }
}

class ReplicaPubSub extends EventEmitterPubSub {
  /** How this replica's thread-lease calls fail once its connection to the lease backend is down. */
  partition: 'reject' | 'hang' | undefined;

  /** Pass one emitter to several replicas to share thread events between them, as Redis does. */
  constructor(
    private shared: SharedLeases,
    events?: EventEmitter,
  ) {
    super(events);
  }
  async #reach(key: string) {
    if (!key.startsWith(`${RESOURCE}\u0000`)) return;
    if (this.partition === 'reject') throw new Error('lease backend unreachable');
    if (this.partition === 'hang') await new Promise(() => {});
  }
  override async acquireLease(key: string, owner: string, ttlMs: number) {
    await this.#reach(key);
    const current = this.shared.owner(key);
    if (current && current !== owner) return { acquired: false, owner: current };
    this.shared.leases.set(key, { owner, expiresAt: Date.now() + ttlMs });
    return { acquired: true, owner };
  }
  override async getLeaseOwner(key: string) {
    await this.#reach(key);
    return this.shared.owner(key);
  }
  override async releaseLease(key: string, owner: string) {
    await this.#reach(key);
    if (this.shared.leases.get(key)?.owner === owner) this.shared.leases.delete(key);
  }
  override async renewLease(key: string, owner: string, ttlMs: number) {
    await this.#reach(key);
    if (this.shared.owner(key) !== owner) return false;
    this.shared.leases.set(key, { owner, expiresAt: Date.now() + ttlMs });
    if (key.startsWith(`${RESOURCE}\u0000`)) this.shared.renewals++;
    return true;
  }
  override async transferLease(key: string, fromOwner: string, toOwner: string) {
    await this.#reach(key);
    if (this.shared.owner(key) !== fromOwner) return false;
    const lease = this.shared.leases.get(key)!;
    this.shared.leases.set(key, { ...lease, owner: toOwner });
    return true;
  }
}

/** A pubsub that can't lease, like google-cloud-pubsub or a custom backend. */
class NoLeasePubSub extends EventEmitterPubSub {
  constructor() {
    super();
    for (const method of ['acquireLease', 'getLeaseOwner', 'releaseLease', 'renewLease', 'transferLease']) {
      Object.defineProperty(this, method, { value: undefined });
    }
  }
}

describeForAllEngines('thread lease loss', (engine: EngineVariant) => {
  let llm: LLMock;

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
  });

  afterAll(async () => {
    await llm.stop();
  });

  function replica(
    shared: SharedLeases,
    memory: MockMemory,
    tools: Record<string, any> = {},
    pubsub: EventEmitterPubSub = new ReplicaPubSub(shared),
  ) {
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const config = { model: openai('gpt-4o-mini'), memory, tools };
    const base =
      engine === 'fs'
        ? assembleAgentFromFsEntry({
            name: 'lease-loss-agent',
            config: { model: config.model, memory },
            instructionsMd: 'Keep ticking.',
            tools: Object.entries(tools).map(([key, tool]) => ({ key, tool })),
          })
        : new Agent({ id: 'lease-loss-agent', name: 'lease-loss-agent', instructions: 'Keep ticking.', ...config });
    const agent =
      engine === 'durable'
        ? createDurableAgent({ agent: base })
        : engine === 'evented'
          ? createEventedAgent({ agent: base, pubsub })
          : base;
    const mastra = new Mastra({ agents: engine === 'fs' ? {} : { agent: agent as any }, pubsub, logger: false });
    if (engine === 'fs') mastra.__registerFsAgents({ agent: agent as any });
    return mastra.getAgent('agent') as any;
  }

  async function startStream(agent: any, prompt: string, options: Record<string, any>) {
    const result = await agent.stream(prompt, options);
    if (!isDurableEngineVariant(engine)) return { output: result, drain: () => result.consumeStream() };
    return {
      output: result.output,
      drain: async () => {
        for await (const _ of result.fullStream) {
          // drain
        }
      },
    };
  }

  const oldRunRequests = () =>
    llm.getRequests().filter(request => JSON.stringify(request.body?.messages ?? []).includes('old run')).length;

  it('stops the run that lost its lease while the successor takes the thread', async () => {
    for (let i = 0; i < 40; i++) {
      llm.on(
        { userMessage: 'old run', sequenceIndex: i },
        { toolCalls: [{ id: `call_tick_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    llm.on({ userMessage: 'successor' }, { content: 'successor done' });

    const shared = new SharedLeases();
    const memory = new MockMemory();
    let ticks = 0;
    const tick = createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        await new Promise(resolve => setTimeout(resolve, 40));
        return 'ticked';
      },
    });
    const oldReplica = replica(shared, memory, { tick });
    const newReplica = replica(shared, memory);

    const { output: oldRun, drain } = await startStream(oldReplica, 'old run', {
      maxSteps: 40,
      memory: { thread: THREAD, resource: RESOURCE },
    });
    const oldDone = drain().catch(() => undefined);

    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 5_000 });
    const oldOwner = shared.owner(LEASE_KEY);
    expect(oldOwner).toBeDefined();

    shared.drop(LEASE_KEY);

    const { output: successor, drain: drainSuccessor } = await startStream(newReplica, 'successor', {
      memory: { thread: THREAD, resource: RESOURCE },
    });
    await drainSuccessor();
    expect(await successor.text).toBe('successor done');

    // Give the old replica's renewal timer (TTL/3 = 100ms) time to notice.
    await new Promise(resolve => setTimeout(resolve, 300));
    const requestsAfterLoss = oldRunRequests();
    const ticksAfterLoss = ticks;
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(oldRunRequests()).toBe(requestsAfterLoss);
    expect(ticks).toBe(ticksAfterLoss);
    expect(ticks).toBeLessThan(20);
    await oldDone;
    expect(await oldRun.finishReason).toBe('aborted');
  }, 20_000);

  it.each(['reject', 'hang'] as const)(
    'stops a run whose lease renewals %s once its lease may have lapsed',
    async partition => {
      const prompt = `partitioned run ${partition}`;
      const takeover = `takeover ${partition}`;
      for (let i = 0; i < 60; i++) {
        llm.on(
          { userMessage: prompt, sequenceIndex: i },
          { toolCalls: [{ id: `call_partitioned_${partition}_${i}`, name: 'tick', arguments: {} }] },
        );
      }
      for (let i = 0; i < 6; i++) {
        llm.on(
          { userMessage: takeover, sequenceIndex: i },
          { toolCalls: [{ id: `call_write_${partition}_${i}`, name: 'write', arguments: {} }] },
        );
      }
      llm.on({ userMessage: takeover, sequenceIndex: 6 }, { content: 'takeover done' });

      const shared = new SharedLeases();
      const memory = new MockMemory();
      const calls: Array<'old' | 'new'> = [];
      const tick = createTool({
        id: 'tick',
        description: 'Tick once',
        inputSchema: z.object({}),
        execute: async () => {
          calls.push('old');
          await new Promise(resolve => setTimeout(resolve, 40));
          return 'ticked';
        },
      });
      const write = createTool({
        id: 'write',
        description: 'Write once',
        inputSchema: z.object({}),
        execute: async () => {
          calls.push('new');
          await new Promise(resolve => setTimeout(resolve, 40));
          return 'written';
        },
      });
      const oldPubsub = new ReplicaPubSub(shared);
      const oldReplica = replica(shared, memory, { tick }, oldPubsub);
      const newReplica = replica(shared, memory, { write });
      const thread = `${PARTITION_THREAD}-${partition}`;
      const key = [RESOURCE, thread].join('\u0000');

      const { output: oldRun, drain } = await startStream(oldReplica, prompt, {
        maxSteps: 60,
        memory: { thread, resource: RESOURCE },
      });
      const oldDone = drain().catch(() => undefined);

      await vi.waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(2), { timeout: 5_000 });
      expect(shared.owner(key)).toBeDefined();

      // The old replica loses its connection to the lease backend, so its lease lapses unrenewed.
      oldPubsub.partition = partition;
      await vi.waitFor(() => expect(shared.owner(key)).toBeUndefined(), { timeout: 5_000 });
      const handover = calls.length;

      const { output: successor, drain: drainSuccessor } = await startStream(newReplica, takeover, {
        maxSteps: 10,
        memory: { thread, resource: RESOURCE },
      });
      await drainSuccessor();
      expect(await successor.text).toBe('takeover done');
      await new Promise(resolve => setTimeout(resolve, 600));

      const afterHandover = calls.slice(handover);
      expect(afterHandover.filter(call => call === 'new')).toHaveLength(6);
      expect(afterHandover.filter(call => call === 'old')).toHaveLength(0);
      await oldDone;
      expect(await oldRun.finishReason).toBe('aborted');
    },
    30_000,
  );

  it('stops a run on an abort request from another replica after its lease is gone', async () => {
    const thread = 'lease-gone-abort-thread';
    for (let i = 0; i < 200; i++) {
      llm.on(
        { userMessage: 'abort after loss', sequenceIndex: i },
        { toolCalls: [{ id: `call_abort_loss_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    const shared = new SharedLeases();
    const events = new EventEmitter();
    events.setMaxListeners(0);
    const memory = new MockMemory();
    let ticks = 0;
    const tick = createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'ticked';
      },
    });
    const oldReplica = replica(shared, memory, { tick }, new ReplicaPubSub(shared, events));
    const otherReplica = replica(shared, memory, {}, new ReplicaPubSub(shared, events));
    await otherReplica.subscribeToThread({ resourceId: RESOURCE, threadId: thread });

    const { output: oldRun, drain } = await startStream(oldReplica, 'abort after loss', {
      maxSteps: 200,
      memory: { thread, resource: RESOURCE },
    });
    const oldDone = drain().catch(() => undefined);
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(3), { timeout: 5_000 });

    // Drop the lease right after a confirmed renewal, so the old run only learns
    // of the loss on its next renewal, a third of a TTL later; the abort must not wait for that.
    const renewals = shared.renewals;
    await vi.waitFor(() => expect(shared.renewals).toBeGreaterThan(renewals), { timeout: 5_000 });
    shared.drop([RESOURCE, thread].join('\u0000'));
    expect(otherReplica.abortThreadStream({ resourceId: RESOURCE, threadId: thread })).toBe(true);
    const ticksAtAbort = ticks;
    await oldDone;

    expect(ticks - ticksAtAbort).toBeLessThanOrEqual(1);
    expect(await oldRun.finishReason).toBe('aborted');
  }, 20_000);

  it('runs no tool once a successor holds the lease, even before the next renewal', async () => {
    const thread = 'lease-takeover-thread';
    const key = [RESOURCE, thread].join('\u0000');
    for (let i = 0; i < 100; i++) {
      llm.on(
        { userMessage: 'fenced run', sequenceIndex: i },
        { toolCalls: [{ id: `call_fenced_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    for (let i = 0; i < 6; i++) {
      llm.on(
        { userMessage: 'fence handover', sequenceIndex: i },
        { toolCalls: [{ id: `call_handover_${i}`, name: 'write', arguments: {} }] },
      );
    }
    llm.on({ userMessage: 'fence handover', sequenceIndex: 6 }, { content: 'fence handover done' });

    const shared = new SharedLeases();
    const memory = new MockMemory();
    let oldOwner: string | undefined;
    let ticks = 0;
    const besideSuccessor: Array<string | undefined> = [];
    const tick = createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        const owner = shared.owner(key);
        if (oldOwner && owner && owner !== oldOwner) besideSuccessor.push(owner);
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'ticked';
      },
    });
    const write = createTool({
      id: 'write',
      description: 'Write once',
      inputSchema: z.object({}),
      execute: async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return 'written';
      },
    });
    const oldReplica = replica(shared, memory, { tick });
    const newReplica = replica(shared, memory, { write });

    const { output: oldRun, drain } = await startStream(oldReplica, 'fenced run', {
      maxSteps: 100,
      memory: { thread, resource: RESOURCE },
    });
    const oldDone = drain().catch(() => undefined);

    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 5_000 });
    oldOwner = shared.owner(key);
    expect(oldOwner).toBeDefined();
    // Take the thread right after a confirmed renewal, so the next one is a full interval away.
    const renewals = shared.renewals;
    await vi.waitFor(() => expect(shared.renewals).toBeGreaterThan(renewals), { timeout: 5_000 });
    shared.drop(key);

    const { output: successor, drain: drainSuccessor } = await startStream(newReplica, 'fence handover', {
      maxSteps: 10,
      memory: { thread, resource: RESOURCE },
    });
    await drainSuccessor();
    expect(await successor.text).toBe('fence handover done');
    await oldDone;

    expect(besideSuccessor).toEqual([]);
    expect(await oldRun.finishReason).toBe('aborted');
  }, 30_000);

  // Durable runs also share process-global registries by run id, so two live runs with one id is not a supported
  // setup there; this covers the thread-runtime engines, where only the tool fence was shared.
  it.skipIf(isDurableEngineVariant(engine))(
    'keeps fencing a run when an earlier run with the same id ends in another replica in the process',
    async () => {
      const thread = 'lease-shared-id-thread';
      const otherThread = 'lease-shared-id-other-thread';
      const key = [RESOURCE, thread].join('\u0000');
      const runId = `shared-run-${engine}`;
      for (let i = 0; i < 100; i++) {
        llm.on(
          { userMessage: 'shared id long', sequenceIndex: i },
          { toolCalls: [{ id: `call_shared_long_${i}`, name: 'tick', arguments: {} }] },
        );
      }
      llm.on(
        { userMessage: 'shared id short', sequenceIndex: 0 },
        { toolCalls: [{ id: 'call_shared_hold', name: 'hold', arguments: {} }] },
      );
      llm.on({ userMessage: 'shared id short', sequenceIndex: 1 }, { content: 'shared id short done' });
      for (let i = 0; i < 6; i++) {
        llm.on(
          { userMessage: 'shared id handover', sequenceIndex: i },
          { toolCalls: [{ id: `call_shared_handover_${i}`, name: 'write', arguments: {} }] },
        );
      }
      llm.on({ userMessage: 'shared id handover', sequenceIndex: 6 }, { content: 'shared id handover done' });

      const shared = new SharedLeases();
      const memory = new MockMemory();
      let oldOwner: string | undefined;
      let ticks = 0;
      const besideSuccessor: Array<string | undefined> = [];
      const tick = createTool({
        id: 'tick',
        description: 'Tick once',
        inputSchema: z.object({}),
        execute: async () => {
          ticks++;
          const owner = shared.owner(key);
          if (oldOwner && owner && owner !== oldOwner) besideSuccessor.push(owner);
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'ticked';
        },
      });
      const write = createTool({
        id: 'write',
        description: 'Write once',
        inputSchema: z.object({}),
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
          return 'written';
        },
      });
      let release!: () => void;
      const released = new Promise<void>(resolve => (release = resolve));
      let held = false;
      const hold = createTool({
        id: 'hold',
        description: 'Hold until released',
        inputSchema: z.object({}),
        execute: async () => {
          held = true;
          await released;
          return 'held';
        },
      });
      const oldReplica = replica(shared, memory, { tick });
      const otherReplica = replica(shared, memory, { hold });
      const newReplica = replica(shared, memory, { write });

      // Another Mastra instance in this process starts a run with the same id on another thread first.
      const { output: other, drain: drainOther } = await startStream(otherReplica, 'shared id short', {
        runId,
        maxSteps: 3,
        memory: { thread: otherThread, resource: RESOURCE },
      });
      const otherDone = drainOther();
      await vi.waitFor(() => expect(held).toBe(true), { timeout: 5_000 });

      const { output: oldRun, drain } = await startStream(oldReplica, 'shared id long', {
        runId,
        maxSteps: 100,
        memory: { thread, resource: RESOURCE },
      });
      const oldDone = drain().catch(() => undefined);
      await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 5_000 });

      // The earlier run ends while the later one is still running.
      release();
      await otherDone;
      expect(await other.text).toBe('shared id short done');

      oldOwner = shared.owner(key);
      expect(oldOwner).toBe(runId);
      const renewals = shared.renewals;
      await vi.waitFor(() => expect(shared.renewals).toBeGreaterThan(renewals), { timeout: 5_000 });
      shared.drop(key);

      const { output: successor, drain: drainSuccessor } = await startStream(newReplica, 'shared id handover', {
        maxSteps: 10,
        memory: { thread, resource: RESOURCE },
      });
      await drainSuccessor();
      expect(await successor.text).toBe('shared id handover done');
      await oldDone;

      expect(besideSuccessor).toEqual([]);
      expect(await oldRun.finishReason).toBe('aborted');
    },
    30_000,
  );

  it("runs none of the step's remaining tool calls once one of them finds the lease taken", async () => {
    const thread = 'lease-queued-calls-thread';
    const key = [RESOURCE, thread].join('\u0000');
    llm.on(
      { userMessage: 'queued calls', sequenceIndex: 0 },
      {
        toolCalls: Array.from({ length: 8 }, (_, i) => ({ id: `call_queued_${i}`, name: 'step', arguments: { n: i } })),
      },
    );
    llm.on({ userMessage: 'queued calls', sequenceIndex: 1 }, { content: 'queued calls done' });

    const shared = new SharedLeases();
    let runId: string | undefined;
    const ran: number[] = [];
    const step = createTool({
      id: 'step',
      description: 'Run one step',
      inputSchema: z.object({ n: z.number() }),
      execute: async ({ n }) => {
        ran.push(n);
        if (ran.length === 5) {
          // A successor on another replica takes the thread while the fifth call runs.
          runId = shared.owner(key);
          shared.leases.set(key, { owner: 'successor-run', expiresAt: Date.now() + 60_000 });
        }
        return 'stepped';
      },
    });
    const agent = replica(shared, new MockMemory(), { step });

    const { output, drain } = await startStream(agent, 'queued calls', {
      maxSteps: 3,
      toolCallConcurrency: 1,
      memory: { thread, resource: RESOURCE },
    });
    await drain().catch(() => undefined);

    expect(runId).toBeDefined();
    expect(ran).toHaveLength(5);
    expect(await output.finishReason).toBe('aborted');
    // The ended run leaves no fence behind, so a later run with its id can call tools.
    await vi.waitFor(() => expect(verifyRunLease(runId)).resolves.toBeUndefined());
  }, 20_000);

  it('runs no tool once its lease deadline has passed, even if the lease backend errors', async () => {
    const thread = 'stalled-deadline-thread';
    for (let i = 0; i < 40; i++) {
      llm.on(
        { userMessage: 'stalled deadline', sequenceIndex: i },
        { toolCalls: [0, 1, 2, 3].map(j => ({ id: `call_stalled_${i}_${j}`, name: 'tick', arguments: {} })) },
      );
    }
    const shared = new SharedLeases();
    let stall = false;
    /**
     * The event loop stalls past the lease TTL while an owner check is in flight, then the check errors, and so
     * does taking the lapsed lease back: nothing can prove the run still holds the thread.
     */
    class StallingPubSub extends ReplicaPubSub {
      override async getLeaseOwner(key: string) {
        if (!stall || !key.startsWith(`${RESOURCE}\u0000`)) return super.getLeaseOwner(key);
        const until = Date.now() + 400;
        while (Date.now() < until) {
          // stall
        }
        throw new Error('lease backend unreachable');
      }
      override async acquireLease(key: string, owner: string, ttlMs: number) {
        if (stall && key.startsWith(`${RESOURCE}\u0000`)) throw new Error('lease backend unreachable');
        return super.acquireLease(key, owner, ttlMs);
      }
    }
    let ticks = 0;
    const afterStall: number[] = [];
    const tick = createTool({
      id: 'tick',
      description: 'Tick',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        if (stall) afterStall.push(ticks);
        if (ticks === 3) stall = true;
        return 'ticked';
      },
    });

    const pubsub = new StallingPubSub(shared);
    const { output, drain } = await startStream(
      replica(shared, new MockMemory(), { tick }, pubsub),
      'stalled deadline',
      {
        maxSteps: 40,
        toolCallConcurrency: 1,
        memory: { thread, resource: RESOURCE },
      },
    );
    await drain().catch(() => undefined);

    expect(afterStall).toEqual([]);
  }, 30_000);
  it('leaves no fence for an ended run when a renewal settles after it released its lease', async () => {
    const runId = `late-renewal-run-${engine}`;
    for (const prompt of ['late renewal first', 'late renewal second']) {
      llm.on(
        { userMessage: prompt, sequenceIndex: 0 },
        { toolCalls: [{ id: `call_${prompt.replaceAll(' ', '_')}`, name: 'tick', arguments: {} }] },
      );
      llm.on({ userMessage: prompt, sequenceIndex: 1 }, { content: `${prompt} done` });
    }
    const shared = new SharedLeases();
    const firstKey = [RESOURCE, 'late-renewal-thread'].join('\u0000');
    let holdRenewal = false;
    let settle!: () => void;
    const settled = new Promise<void>(resolve => (settle = resolve));
    let onHeld!: () => void;
    const held = new Promise<void>(resolve => (onHeld = resolve));
    let onLateSettled!: () => void;
    const lateSettled = new Promise<void>(resolve => (onLateSettled = resolve));
    /** Holds one renewal of the first run in flight until the run has ended and released its lease. */
    class LateRenewalPubSub extends ReplicaPubSub {
      override async renewLease(key: string, owner: string, ttlMs: number) {
        if (!holdRenewal || key !== firstKey) return super.renewLease(key, owner, ttlMs);
        holdRenewal = false;
        onHeld();
        await settled;
        const renewed = await super.renewLease(key, owner, ttlMs);
        setTimeout(onLateSettled, 20);
        return renewed;
      }
    }
    let ticks = 0;
    const tick = createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        if (ticks === 1) {
          holdRenewal = true;
          await held;
        } else {
          // The first run's renewal finds its lease released and reports it lost while this run with the same id is live.
          settle();
          await lateSettled;
        }
        return 'ticked';
      },
    });
    const agent = replica(shared, new MockMemory(), { tick }, new LateRenewalPubSub(shared));

    const first = await startStream(agent, 'late renewal first', {
      runId,
      maxSteps: 3,
      memory: { thread: 'late-renewal-thread', resource: RESOURCE },
    });
    await first.drain();
    expect(await first.output.finishReason).not.toBe('aborted');
    await vi.waitFor(() => expect(shared.owner(firstKey)).toBeUndefined());

    const second = await startStream(agent, 'late renewal second', {
      runId,
      maxSteps: 3,
      memory: { thread: 'late-renewal-next-thread', resource: RESOURCE },
    });
    await second.drain();
    expect(ticks).toBe(2);
    expect(await second.output.finishReason).not.toBe('aborted');
    await vi.waitFor(() => expect(verifyRunLease(runId)).resolves.toBeUndefined());
  }, 20_000);

  it('runs tools on a pubsub that cannot lease', async () => {
    for (let i = 0; i < 2; i++) {
      llm.on(
        { userMessage: 'no lease run', sequenceIndex: i },
        { toolCalls: [{ id: `call_no_lease_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    llm.on({ userMessage: 'no lease run', sequenceIndex: 2 }, { content: 'no lease done' });

    let ticks = 0;
    const tick = createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        return 'ticked';
      },
    });
    const agent = replica(new SharedLeases(), new MockMemory(), { tick }, new NoLeasePubSub());

    const { output, drain } = await startStream(agent, 'no lease run', {
      maxSteps: 5,
      memory: { thread: 'no-lease-thread', resource: RESOURCE },
    });
    await drain();

    expect(ticks).toBe(2);
    expect(await output.text).toBe('no lease done');
    expect(await output.finishReason).not.toBe('aborted');
  }, 20_000);

  it('never aborts a run whose lease stays healthy across many renewals', async () => {
    for (let i = 0; i < 6; i++) {
      llm.on(
        { userMessage: 'healthy run', sequenceIndex: i },
        { toolCalls: [{ id: `call_healthy_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    llm.on({ userMessage: 'healthy run', sequenceIndex: 6 }, { content: 'healthy done' });

    const shared = new SharedLeases();
    let ticks = 0;
    const tick = createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        // 6 ticks x 100ms outlives the 300ms TTL, so the run only survives if renewals keep it.
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'ticked';
      },
    });
    const agent = replica(shared, new MockMemory(), { tick });

    const { output, drain } = await startStream(agent, 'healthy run', {
      maxSteps: 10,
      memory: { thread: 'healthy-thread', resource: RESOURCE },
    });
    await drain();

    expect(ticks).toBe(6);
    expect(await output.text).toBe('healthy done');
    expect(await output.finishReason).not.toBe('aborted');
  }, 20_000);

  it('keeps running tools while owner checks error inside the last confirmed renewal', async () => {
    for (let i = 0; i < 6; i++) {
      llm.on(
        { userMessage: 'owner check errors', sequenceIndex: i },
        { toolCalls: [{ id: `call_owner_errors_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    llm.on({ userMessage: 'owner check errors', sequenceIndex: 6 }, { content: 'owner check errors done' });

    const shared = new SharedLeases();
    /** Renewals still reach the backend, but every owner lookup fails. */
    class OwnerLookupErrorPubSub extends ReplicaPubSub {
      override async getLeaseOwner(key: string) {
        if (key.startsWith(`${RESOURCE}\u0000`)) throw new Error('lease backend unreachable');
        return super.getLeaseOwner(key);
      }
    }
    let ticks = 0;
    const tick = createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        // 6 ticks x 100ms outlives the 300ms TTL, so each call relies on a renewal confirmed since the last one.
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'ticked';
      },
    });
    const agent = replica(shared, new MockMemory(), { tick }, new OwnerLookupErrorPubSub(shared));

    const { output, drain } = await startStream(agent, 'owner check errors', {
      maxSteps: 10,
      memory: { thread: 'owner-check-errors-thread', resource: RESOURCE },
    });
    await drain();

    expect(ticks).toBe(6);
    expect(await output.text).toBe('owner check errors done');
    expect(await output.finishReason).not.toBe('aborted');
  }, 20_000);

  it('stops a run within about one TTL of its lease backend going silent', async () => {
    const thread = 'silent-backend-thread';
    const key = [RESOURCE, thread].join('\u0000');
    for (let i = 0; i < 100; i++) {
      llm.on(
        { userMessage: 'silent backend', sequenceIndex: i },
        { toolCalls: [{ id: `call_silent_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    const shared = new SharedLeases();
    let ticks = 0;
    const tick = createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        await new Promise(resolve => setTimeout(resolve, 40));
        return 'ticked';
      },
    });
    const pubsub = new ReplicaPubSub(shared);
    const { output, drain } = await startStream(replica(shared, new MockMemory(), { tick }, pubsub), 'silent backend', {
      maxSteps: 100,
      memory: { thread, resource: RESOURCE },
    });
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 5_000 });
    expect(shared.owner(key)).toBeDefined();

    // Every lease call now hangs, as when the connection to Redis is cut without an error.
    pubsub.partition = 'hang';
    const cutAt = Date.now();
    const finishReason = await output.finishReason;
    const settledAfter = Date.now() - cutAt;
    await done;

    expect(finishReason).toBe('aborted');
    // 100 ticks take over 4s, so only the local lease deadline (TTL 300ms) ends the run this early.
    expect(settledAfter).toBeLessThan(1_500);
  }, 20_000);

  // Durable runs share process-global registries by run id, so two live runs with one id is not a supported setup there.
  it.skipIf(isDurableEngineVariant(engine))(
    'documents that a run whose id a later live run reuses keeps calling tools after losing its lease',
    async () => {
      const runId = `two-live-run-${engine}`;
      const thread = 'two-live-earlier-thread';
      const key = [RESOURCE, thread].join('\u0000');
      llm.on(
        { userMessage: 'two live earlier', sequenceIndex: 0 },
        {
          toolCalls: Array.from({ length: 8 }, (_, i) => ({
            id: `call_two_live_${i}`,
            name: 'step',
            arguments: { n: i },
          })),
        },
      );
      llm.on({ userMessage: 'two live earlier', sequenceIndex: 1 }, { content: 'two live earlier done' });
      llm.on(
        { userMessage: 'two live later', sequenceIndex: 0 },
        { toolCalls: [{ id: 'call_two_live_hold', name: 'hold', arguments: {} }] },
      );
      llm.on({ userMessage: 'two live later', sequenceIndex: 1 }, { content: 'two live later done' });

      const shared = new SharedLeases();
      const memory = new MockMemory();
      let release: () => void = () => {};
      const released = new Promise<void>(resolve => (release = resolve));
      let onHolding: () => void = () => {};
      const holding = new Promise<void>(resolve => (onHolding = resolve));
      const hold = createTool({
        id: 'hold',
        description: 'Hold the run open',
        inputSchema: z.object({}),
        execute: async () => {
          onHolding();
          await released;
          return 'held';
        },
      });
      const laterReplica = replica(shared, memory, { hold });
      let later: { output: { text: Promise<string> }; drain: () => Promise<void> } | undefined;

      const ran: number[] = [];
      const step = createTool({
        id: 'step',
        description: 'Run one step',
        inputSchema: z.object({ n: z.number() }),
        execute: async ({ n }) => {
          ran.push(n);
          if (n === 0) {
            // Another replica in this process starts a run with the same id and keeps it live.
            later = await startStream(laterReplica, 'two live later', {
              runId,
              maxSteps: 3,
              memory: { thread: 'two-live-later-thread', resource: RESOURCE },
            });
            await holding;
          }
          // A successor takes the earlier run's thread while the fifth call runs.
          if (ran.length === 5) shared.leases.set(key, { owner: 'successor-run', expiresAt: Date.now() + 60_000 });
          return 'stepped';
        },
      });
      const earlier = await startStream(replica(shared, memory, { step }), 'two live earlier', {
        runId,
        maxSteps: 3,
        toolCallConcurrency: 1,
        memory: { thread, resource: RESOURCE },
      });
      await earlier.drain().catch(() => undefined);

      // Current behaviour (#27364 case 3): the tool fence is keyed by run id alone, so the later run's registration
      // replaced the earlier run's fence, and the earlier run's remaining calls are checked against the later run's
      // healthy lease instead of its own. With a fence per registration this would be 5, as when the id is not shared.
      expect(ran).toHaveLength(8);

      release();
      expect(later).toBeDefined();
      if (later) {
        await later.drain();
        expect(await later.output.text).toBe('two live later done');
      }
    },
    20_000,
  );

  it('keeps a run going when its renewals stall past the lease TTL and no other run took the thread', async () => {
    const thread = 'stalled-renewal-thread';
    for (let i = 0; i < 8; i++) {
      llm.on(
        { userMessage: 'stalled renewals', sequenceIndex: i },
        { toolCalls: [{ id: `call_stalled_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    llm.on({ userMessage: 'stalled renewals', sequenceIndex: 8 }, { content: 'stalled renewals done' });

    const shared = new SharedLeases();
    /** Renewals that hang until released, as on a machine too loaded to finish one in time. */
    class StallingRenewalsPubSub extends ReplicaPubSub {
      stalled: Promise<void> | undefined;
      override async renewLease(key: string, owner: string, ttlMs: number) {
        if (this.stalled && key.startsWith(`${RESOURCE}\u0000`)) await this.stalled;
        return super.renewLease(key, owner, ttlMs);
      }
    }
    const pubsub = new StallingRenewalsPubSub(shared);
    let ticks = 0;
    const tick = createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'ticked';
      },
    });
    const { output, drain } = await startStream(
      replica(shared, new MockMemory(), { tick }, pubsub),
      'stalled renewals',
      { maxSteps: 12, memory: { thread, resource: RESOURCE } },
    );
    const done = drain();
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 5_000 });

    let resume!: () => void;
    pubsub.stalled = new Promise<void>(resolve => (resume = resolve));
    // No renewal confirms for well past the TTL (300ms), so the lease expires and the run's deadline passes.
    await new Promise(resolve => setTimeout(resolve, 700));
    pubsub.stalled = undefined;
    resume();
    await done;

    expect(ticks).toBe(8);
    expect(await output.text).toBe('stalled renewals done');
    expect(await output.finishReason).not.toBe('aborted');
  }, 20_000);

  it('stops a run whose lapsed lease is not taken back within a renewal interval', async () => {
    const thread = 'slow-retake-thread';
    for (let i = 0; i < 100; i++) {
      llm.on(
        { userMessage: 'slow retake', sequenceIndex: i },
        { toolCalls: [{ id: `call_slow_retake_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    const shared = new SharedLeases();
    /** Once cut, renewals never answer and taking the lease back answers only after most of a TTL (300ms). */
    class SlowBackendPubSub extends ReplicaPubSub {
      cut = false;
      override async renewLease(key: string, owner: string, ttlMs: number) {
        if (this.cut && key.startsWith(`${RESOURCE}\u0000`)) await new Promise(() => {});
        return super.renewLease(key, owner, ttlMs);
      }
      override async acquireLease(key: string, owner: string, ttlMs: number) {
        if (this.cut && key.startsWith(`${RESOURCE}\u0000`)) await new Promise(resolve => setTimeout(resolve, 250));
        return super.acquireLease(key, owner, ttlMs);
      }
    }
    const pubsub = new SlowBackendPubSub(shared);
    let ticks = 0;
    const tick = createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        await new Promise(resolve => setTimeout(resolve, 20));
        return 'ticked';
      },
    });
    const { output, drain } = await startStream(replica(shared, new MockMemory(), { tick }, pubsub), 'slow retake', {
      maxSteps: 100,
      memory: { thread, resource: RESOURCE },
    });
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 5_000 });

    // A backend this slow can't show the run still holds the thread before another process could take it.
    const cutAt = Date.now();
    pubsub.cut = true;
    await done;

    expect(await output.finishReason).toBe('aborted');
    // Within a renewal interval of the cut (100ms here), not after a later, unrelated abort.
    expect(Date.now() - cutAt).toBeLessThan(2_000);
  }, 20_000);

  it('keeps a run going when a late renewal finds its lease expired and no other run took the thread', async () => {
    const thread = 'late-renewal-expired-thread';
    for (let i = 0; i < 8; i++) {
      llm.on(
        { userMessage: 'late renewal expired', sequenceIndex: i },
        { toolCalls: [{ id: `call_late_expired_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    llm.on({ userMessage: 'late renewal expired', sequenceIndex: 8 }, { content: 'late renewal expired done' });

    const shared = new SharedLeases();
    /** Every renewal waits until the lease has run out, as a renewal queued behind a stalled process does. */
    class LateRenewalsPubSub extends ReplicaPubSub {
      late = false;
      falseRenewals = 0;
      override async renewLease(key: string, owner: string, ttlMs: number) {
        if (this.late && key.startsWith(`${RESOURCE}\u0000`)) {
          const expiresAt = shared.leases.get(key)?.expiresAt ?? 0;
          await new Promise(resolve => setTimeout(resolve, Math.max(0, expiresAt - Date.now()) + 20));
        }
        const renewed = await super.renewLease(key, owner, ttlMs);
        if (!renewed) this.falseRenewals++;
        return renewed;
      }
    }
    const pubsub = new LateRenewalsPubSub(shared);
    let ticks = 0;
    const tick = createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'ticked';
      },
    });
    const { output, drain } = await startStream(
      replica(shared, new MockMemory(), { tick }, pubsub),
      'late renewal expired',
      { maxSteps: 12, memory: { thread, resource: RESOURCE } },
    );
    const done = drain();
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 5_000 });
    pubsub.late = true;
    await vi.waitFor(() => expect(pubsub.falseRenewals).toBeGreaterThan(0), { timeout: 5_000 });
    pubsub.late = false;
    await done;

    expect(ticks).toBe(8);
    expect(await output.text).toBe('late renewal expired done');
    expect(await output.finishReason).not.toBe('aborted');
  }, 20_000);

  it('says the run stopped because another run holds its thread lease', async () => {
    const thread = 'lease-lost-reason-thread';
    const key = [RESOURCE, thread].join('\u0000');
    for (let i = 0; i < 100; i++) {
      llm.on(
        { userMessage: 'reason run', sequenceIndex: i },
        { toolCalls: [{ id: `call_reason_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    const shared = new SharedLeases();
    let ticks = 0;
    const tick = createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        await new Promise(resolve => setTimeout(resolve, 20));
        return 'ticked';
      },
    });
    const agent = replica(shared, new MockMemory(), { tick });
    const subscription = await agent.subscribeToThread({ resourceId: RESOURCE, threadId: thread });
    const aborts: unknown[] = [];
    const watching = (async () => {
      for await (const chunk of subscription.stream as AsyncIterable<any>) {
        if (chunk?.type === 'abort') {
          aborts.push(chunk.payload);
          break;
        }
      }
    })();

    const { output, drain } = await startStream(agent, 'reason run', {
      maxSteps: 100,
      memory: { thread, resource: RESOURCE },
    });
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 5_000 });

    // Another process's run takes the thread.
    shared.leases.set(key, { owner: 'successor-run', expiresAt: Date.now() + 60_000 });
    await done;
    await watching;
    subscription.unsubscribe();

    expect(await output.finishReason).toBe('aborted');
    expect(aborts).toEqual([expect.objectContaining({ reason: 'thread-lease-lost' })]);
  }, 20_000);
});
