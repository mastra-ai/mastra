/**
 * A run that loses its thread lease must stop (#27543).
 *
 * Two Mastra instances stand in for two replicas: each has its own pubsub, so
 * the thread-stream runtime keeps separate state for each, while both share
 * one lease backend, as two processes share Redis. The old replica's lease is
 * dropped in that backend (an expiry during a backend blip), its next renewal
 * fails, and a successor run on the other replica takes the thread. The old
 * run must stop calling the model and tools instead of running beside it.
 */
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

/** One lease table shared by every replica, with real expiry, like Redis. */
class SharedLeases {
  leases = new Map<string, { owner: string; expiresAt: number }>();

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
  constructor(private shared: SharedLeases) {
    super();
  }
  override async acquireLease(key: string, owner: string, ttlMs: number) {
    const current = this.shared.owner(key);
    if (current && current !== owner) return { acquired: false, owner: current };
    this.shared.leases.set(key, { owner, expiresAt: Date.now() + ttlMs });
    return { acquired: true, owner };
  }
  override async getLeaseOwner(key: string) {
    return this.shared.owner(key);
  }
  override async releaseLease(key: string, owner: string) {
    if (this.shared.leases.get(key)?.owner === owner) this.shared.leases.delete(key);
  }
  override async renewLease(key: string, owner: string, ttlMs: number) {
    if (this.shared.owner(key) !== owner) return false;
    this.shared.leases.set(key, { owner, expiresAt: Date.now() + ttlMs });
    return true;
  }
  override async transferLease(key: string, fromOwner: string, toOwner: string) {
    if (this.shared.owner(key) !== fromOwner) return false;
    const lease = this.shared.leases.get(key)!;
    this.shared.leases.set(key, { ...lease, owner: toOwner });
    return true;
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

  function replica(shared: SharedLeases, memory: MockMemory, tools: Record<string, any> = {}) {
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const pubsub = new ReplicaPubSub(shared);
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
