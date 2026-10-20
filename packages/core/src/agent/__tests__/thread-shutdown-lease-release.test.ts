/**
 * Shutting a replica down hands its thread runs back (#27364, case 5).
 *
 * Two Mastra instances stand in for two replicas: they share thread events,
 * as two processes share Redis, and one lease backend. One replica runs on a
 * thread while the other follows it. When the running replica shuts down for
 * a deploy, its process is about to die: it must say how each of its runs
 * ended and free the thread then, while it still can, rather than leave the
 * follower to wait out the lease and fail the run as having lost its lease.
 *
 * - case 5: a run parked on an approval.
 * - case 5b: a run still streaming. Shutdown doesn't abort it; it ends the run
 *   for everyone else and stops renewing the thread lease.
 */
import { EventEmitter } from 'node:events';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
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
import type { ToolAction } from '../../tools';
import { Agent } from '../agent';
import { createDurableAgent, createEventedAgent } from '../durable';
import { assembleAgentFromFsEntry } from '../fs-routing';

const RESOURCE = 'shutdown-user';
const LEASE_LOST = 'lost its lease before publishing a terminal event';

/** One lease table shared by every replica, with real expiry, like Redis. */
class SharedLeases {
  leases = new Map<string, { owner: string; expiresAt: number }>();

  owner(key: string) {
    const lease = this.leases.get(key);
    return lease && lease.expiresAt > Date.now() ? lease.owner : undefined;
  }
}

class ReplicaPubSub extends EventEmitterPubSub {
  /** Set once the replica's process is gone: it reaches neither the lease backend nor anyone else. */
  dead = false;

  constructor(
    private shared: SharedLeases,
    events: EventEmitter,
  ) {
    super(events);
  }
  override async publish(...args: Parameters<EventEmitterPubSub['publish']>) {
    if (this.dead) return;
    return super.publish(...args);
  }
  override async acquireLease(key: string, owner: string, ttlMs: number) {
    if (this.dead) throw new Error('process exited');
    const current = this.shared.owner(key);
    if (current && current !== owner) return { acquired: false, owner: current };
    this.shared.leases.set(key, { owner, expiresAt: Date.now() + ttlMs });
    return { acquired: true, owner };
  }
  override async getLeaseOwner(key: string) {
    return this.shared.owner(key);
  }
  override async releaseLease(key: string, owner: string) {
    if (this.dead) throw new Error('process exited');
    if (this.shared.leases.get(key)?.owner === owner) this.shared.leases.delete(key);
  }
  override async renewLease(key: string, owner: string, ttlMs: number) {
    if (this.dead) throw new Error('process exited');
    if (this.shared.owner(key) !== owner) return false;
    this.shared.leases.set(key, { owner, expiresAt: Date.now() + ttlMs });
    return true;
  }
  override async transferLease(key: string, fromOwner: string, toOwner: string) {
    if (this.dead) throw new Error('process exited');
    const lease = this.shared.leases.get(key);
    if (!lease || this.shared.owner(key) !== fromOwner) return false;
    this.shared.leases.set(key, { ...lease, owner: toOwner });
    return true;
  }
  /**
   * The emitter stands in for the shared backend, so closing it would cut the
   * other replica off too. A process closing its Redis connection doesn't.
   */
  override async close() {}
}

describeForAllEngines('thread runs at shutdown', (engine: EngineVariant) => {
  let llm: LLMock;

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
  });

  afterAll(async () => {
    await llm.stop();
  });

  function replica(shared: SharedLeases, events: EventEmitter, memory: MockMemory, tools: Record<string, ToolAction>) {
    const pubsub = new ReplicaPubSub(shared, events);
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const model = openai('gpt-4o-mini');
    const base =
      engine === 'fs'
        ? assembleAgentFromFsEntry({
            name: 'shutdown-agent',
            config: { model, memory },
            instructionsMd: 'Keep ticking.',
            tools: Object.entries(tools).map(([key, tool]) => ({ key, tool })),
          })
        : new Agent({
            id: 'shutdown-agent',
            name: 'shutdown-agent',
            instructions: 'Keep ticking.',
            model,
            memory,
            tools,
          });
    const agent =
      engine === 'durable'
        ? createDurableAgent({ agent: base })
        : engine === 'evented'
          ? createEventedAgent({ agent: base, pubsub })
          : base;
    const mastra = new Mastra({ agents: engine === 'fs' ? {} : { agent }, pubsub, logger: false });
    if (engine === 'fs') mastra.__registerFsAgents({ agent: base });
    return { mastra, pubsub, agent: mastra.getAgent('agent') };
  }

  /** Follow the thread from a replica that isn't running it, recording what it sees. */
  async function follow(agent: Agent, threadId: string) {
    const subscription = await agent.subscribeToThread({ resourceId: RESOURCE, threadId });
    const types: string[] = [];
    const errors: string[] = [];
    let runEnded = false;
    void (async () => {
      for await (const part of subscription.stream) {
        types.push(part.type);
        if (part.type === 'error') errors.push(String(part.payload.error));
        if (part.type === 'finish' || part.type === 'error' || part.type === 'abort') runEnded = true;
      }
    })();
    return {
      types,
      errors,
      ended: () => runEnded || (types.length > 0 && !subscription.activeRunId()),
      unsubscribe: () => subscription.unsubscribe(),
    };
  }

  async function startStream(agent: Agent, prompt: string, threadId: string, extra: { requireToolApproval?: boolean }) {
    const result = await agent.stream(prompt, {
      maxSteps: 60,
      memory: { thread: threadId, resource: RESOURCE },
      ...extra,
    });
    const output = isDurableEngineVariant(engine) && 'output' in result ? result.output : result;
    void output.consumeStream().catch(() => undefined);
    return output;
  }

  function tickTool(counter: { ticks: number }) {
    return createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        counter.ticks++;
        await new Promise(resolve => setTimeout(resolve, 20));
        return 'ticked';
      },
    });
  }

  it('ends a still-streaming run for followers and frees its thread, without aborting it (5b)', async () => {
    const threadId = `shutdown-running-${engine}`;
    const key = [RESOURCE, threadId].join('\u0000');
    for (let i = 0; i < 60; i++) {
      llm.on(
        { userMessage: 'keep running', sequenceIndex: i },
        { toolCalls: [{ id: `call_run_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    const shared = new SharedLeases();
    const events = new EventEmitter();
    events.setMaxListeners(0);
    const memory = new MockMemory();
    const counter = { ticks: 0 };
    const running = replica(shared, events, memory, { tick: tickTool(counter) });
    const observer = replica(shared, events, memory, {});
    const follower = await follow(observer.agent, threadId);

    const output = await startStream(running.agent, 'keep running', threadId, {});
    await vi.waitFor(() => expect(counter.ticks).toBeGreaterThanOrEqual(2), { timeout: 5_000 });
    expect(shared.owner(key)).toBeDefined();

    await running.mastra.shutdown({ drainTimeout: 200 });
    // The thread is free as soon as shutdown returns, not one lease TTL later.
    expect(shared.owner(key)).toBeUndefined();
    if (!isDurableEngineVariant(engine)) {
      // Not aborted: the run keeps going for as long as its process lives.
      // (Shutdown already stops durable executions, for recovery elsewhere.)
      const ticksAtShutdown = counter.ticks;
      await vi.waitFor(() => expect(counter.ticks).toBeGreaterThan(ticksAtShutdown), { timeout: 5_000 });
    }
    running.pubsub.dead = true;

    await vi.waitFor(() => expect(follower.ended()).toBe(true), { timeout: 5_000 });
    // Well past the lease TTL: the follower never reports a lost lease.
    await new Promise(resolve => setTimeout(resolve, 900));
    expect(follower.errors.filter(error => error.includes(LEASE_LOST))).toEqual([]);
    expect(follower.types).not.toContain('error');

    follower.unsubscribe();
    await observer.mastra.shutdown({ drainTimeout: 200 });
    void output;
  }, 20_000);

  it('announces a run parked on an approval as suspended and frees its thread (5)', async () => {
    const threadId = `shutdown-parked-${engine}`;
    const key = [RESOURCE, threadId].join('\u0000');
    llm.on({ userMessage: 'needs approval' }, { toolCalls: [{ id: 'call_parked', name: 'tick', arguments: {} }] });
    const shared = new SharedLeases();
    const events = new EventEmitter();
    events.setMaxListeners(0);
    const memory = new MockMemory();
    const counter = { ticks: 0 };
    const running = replica(shared, events, memory, { tick: tickTool(counter) });
    const observer = replica(shared, events, memory, {});
    const follower = await follow(observer.agent, threadId);

    await startStream(running.agent, 'needs approval', threadId, { requireToolApproval: true });
    await vi.waitFor(() => expect(follower.types).toContain('tool-call-approval'), { timeout: 5_000 });
    expect(shared.owner(key)).toBeDefined();

    await running.mastra.shutdown({ drainTimeout: 200 });
    expect(shared.owner(key)).toBeUndefined();
    running.pubsub.dead = true;

    await new Promise(resolve => setTimeout(resolve, 900));
    expect(follower.errors.filter(error => error.includes(LEASE_LOST))).toEqual([]);
    expect(follower.types).not.toContain('error');
    expect(counter.ticks).toBe(0);

    follower.unsubscribe();
    await observer.mastra.shutdown({ drainTimeout: 200 });
  }, 20_000);
});
