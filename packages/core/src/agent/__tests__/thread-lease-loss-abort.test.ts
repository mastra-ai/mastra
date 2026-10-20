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
});
