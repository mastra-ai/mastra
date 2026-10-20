/**
 * A run parked on a tool approval keeps its saved snapshot when the lease
 * backend goes down for longer than the lease TTL (#27731).
 *
 * A parked run calls neither the model nor tools, so a lapsed thread lease
 * gives nothing to stop. Aborting it anyway deletes the snapshot it needs to
 * resume, so a backend blip silently throws away the pending approval. A run
 * that has been partly resumed is executing again, so it is still stopped.
 */
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
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { createDurableAgent, createEventedAgent } from '../durable';
import { assembleAgentFromFsEntry } from '../fs-routing';

const RESOURCE = 'parked-lease-user';

/** A lease backend that can be taken down and healed. */
class FlakyLeasePubSub extends EventEmitterPubSub {
  leases = new Map<string, { owner: string; expiresAt: number }>();
  down = false;
  readonly #parked = new Set<string>();
  readonly #parkWaiters = new Map<string, () => void>();

  /** Resolves once the runtime has published `run-suspended` for the run, i.e. it is parked, not still suspending. */
  parked(runId: string): Promise<void> {
    if (this.#parked.has(runId)) return Promise.resolve();
    return new Promise(resolve => this.#parkWaiters.set(runId, resolve));
  }
  override async publish(...args: Parameters<EventEmitterPubSub['publish']>) {
    const data = args[1].data as { type?: string; runId?: string } | undefined;
    if (data?.type === 'run-suspended' && data.runId) {
      this.#parked.add(data.runId);
      this.#parkWaiters.get(data.runId)?.();
    }
    return super.publish(...args);
  }

  #owner(key: string) {
    const lease = this.leases.get(key);
    return lease && lease.expiresAt > Date.now() ? lease.owner : undefined;
  }
  async #reach(key: string) {
    if (key.startsWith(`${RESOURCE}\u0000`) && this.down) throw new Error('lease backend unreachable');
  }
  override async acquireLease(key: string, owner: string, ttlMs: number) {
    await this.#reach(key);
    const current = this.#owner(key);
    if (current && current !== owner) return { acquired: false, owner: current };
    this.leases.set(key, { owner, expiresAt: Date.now() + ttlMs });
    return { acquired: true, owner };
  }
  override async getLeaseOwner(key: string) {
    await this.#reach(key);
    return this.#owner(key);
  }
  override async releaseLease(key: string, owner: string) {
    await this.#reach(key);
    if (this.leases.get(key)?.owner === owner) this.leases.delete(key);
  }
  override async renewLease(key: string, owner: string, ttlMs: number) {
    await this.#reach(key);
    if (this.#owner(key) !== owner) return false;
    this.leases.set(key, { owner, expiresAt: Date.now() + ttlMs });
    return true;
  }
  override async transferLease(key: string, fromOwner: string, toOwner: string) {
    await this.#reach(key);
    if (this.#owner(key) !== fromOwner) return false;
    const lease = this.leases.get(key)!;
    this.leases.set(key, { ...lease, owner: toOwner });
    return true;
  }
}

function heldLeaseOwners(pubsub: FlakyLeasePubSub): string[] {
  return [...pubsub.leases.entries()]
    .filter(([key, lease]) => key.startsWith(`${RESOURCE}\u0000`) && lease.expiresAt > Date.now())
    .map(([, lease]) => lease.owner);
}

function buildAgent(
  engine: EngineVariant,
  llmUrl: string,
  tool: ReturnType<typeof createTool<any, any, any>>,
  pubsub: FlakyLeasePubSub,
  storage: InMemoryStore,
): any {
  const memory = new MockMemory();
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llmUrl.replace(/\/+$/, '')}/v1` });
  const model = openai('gpt-4o-mini');
  const base =
    engine === 'fs'
      ? assembleAgentFromFsEntry({
          name: 'parked-lease-agent',
          config: { model, memory },
          instructionsMd: 'Archive what you are asked to.',
          tools: [{ key: tool.id, tool }],
        })
      : new Agent({
          id: 'parked-lease-agent',
          name: 'parked-lease-agent',
          instructions: 'Archive what you are asked to.',
          model,
          memory,
          tools: { [tool.id]: tool },
        });
  const wrapped =
    engine === 'durable'
      ? createDurableAgent({ agent: base })
      : engine === 'evented'
        ? createEventedAgent({ agent: base, pubsub })
        : base;
  const mastra = new Mastra({
    agents: engine === 'fs' ? {} : { agent: wrapped as any },
    pubsub,
    storage,
    logger: false,
  });
  if (engine === 'fs') mastra.__registerFsAgents({ agent: wrapped as any });
  return mastra.getAgent('agent');
}

describeForAllEngines('parked run across a lease backend outage', (engine: EngineVariant) => {
  let llm: LLMock;

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
  });

  afterAll(async () => {
    await llm.stop();
  });

  it.each(['is unreachable', 'forgets the lease'] as const)(
    'keeps the snapshot of a parked run when the backend %s past the TTL, and resumes it',
    async outage => {
      const tag = `${engine}-${outage === 'is unreachable' ? 'down' : 'forgot'}`;
      const thread = `parked-lease-thread-${tag}`;
      llm.on(
        { userMessage: `archive ${tag}`, hasToolResult: false },
        { toolCalls: [{ id: `call_archive_${tag}`, name: 'archive', arguments: { item: 'a' } }] },
      );
      llm.on({ toolCallId: `call_archive_${tag}`, hasToolResult: true }, { content: 'Archived.' });

      const pubsub = new FlakyLeasePubSub();
      let executions = 0;
      const leaseOwnersDuringResume: string[][] = [];
      const archive = createTool({
        id: 'archive',
        description: 'Archive an item',
        inputSchema: z.object({ item: z.string() }),
        requireApproval: true,
        execute: async () => {
          executions++;
          leaseOwnersDuringResume.push(heldLeaseOwners(pubsub));
          return { archived: true };
        },
      });

      const storage = new InMemoryStore();
      const agent = buildAgent(engine, llm.url, archive, pubsub, storage);

      const result = await agent.stream(`archive ${tag}`, { memory: { thread, resource: RESOURCE } });
      const output = isDurableEngineVariant(engine) ? result.output : result;
      const chunkTypes: string[] = [];
      for await (const chunk of result.fullStream) {
        chunkTypes.push(chunk.type);
        // Durable streams stay open while a run is parked.
        if (chunk.type === 'tool-call-approval') break;
      }
      expect(chunkTypes).toContain('tool-call-approval');
      const runId: string = output.runId ?? result.runId;
      // The approval chunk can arrive while the run is still suspending; take the backend down only once it is parked.
      await pubsub.parked(runId);

      const workflows = (await storage.getStore('workflows'))!;
      const snapshots = async () =>
        (await workflows.listWorkflowRuns({})).runs.filter(run => run.runId === runId).length;
      await vi.waitFor(async () => expect(await snapshots()).toBeGreaterThan(0), { timeout: 5_000 });
      const parkedSnapshots = await snapshots();

      if (outage === 'is unreachable') {
        // Down for over three TTLs: every renewal rejects, so the local lease deadline fires.
        pubsub.down = true;
        await new Promise(resolve => setTimeout(resolve, 1_000));
        pubsub.down = false;
      } else {
        // The backend lost the lease (e.g. it expired during a blip), so the next renewal returns false.
        pubsub.leases.clear();
      }
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(await snapshots()).toBe(parkedSnapshots);

      const resumed = await agent.approveToolCall({ runId, toolCallId: `call_archive_${tag}` });
      for await (const _ of resumed.fullStream) {
        // drain
      }
      expect(executions).toBe(1);
      // The resume took the thread lease again rather than running without one.
      expect(leaseOwnersDuringResume).toEqual([[expect.any(String)]]);
      expect(await resumed.text).toBe('Archived.');
    },
    20_000,
  );

  /** Parks a run on an approval, then lets the backend forget its lease past the TTL. */
  async function parkAndLoseLease(tag: string, execute: () => Promise<unknown>) {
    const thread = `parked-lease-thread-${tag}`;
    llm.on(
      { userMessage: `archive ${tag}`, hasToolResult: false },
      { toolCalls: [{ id: `call_archive_${tag}`, name: 'archive', arguments: { item: 'a' } }] },
    );
    llm.on({ toolCallId: `call_archive_${tag}`, hasToolResult: true }, { content: 'Archived.' });
    const archive = createTool({
      id: 'archive',
      description: 'Archive an item',
      inputSchema: z.object({ item: z.string() }),
      requireApproval: true,
      execute,
    });
    const pubsub = new FlakyLeasePubSub();
    const agent = buildAgent(engine, llm.url, archive, pubsub, new InMemoryStore());
    const result = await agent.stream(`archive ${tag}`, { memory: { thread, resource: RESOURCE } });
    const output = isDurableEngineVariant(engine) ? result.output : result;
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'tool-call-approval') break;
    }
    const runId: string = output.runId ?? result.runId;
    // The approval chunk can arrive while the run is still suspending; drop the lease only once it is parked.
    await pubsub.parked(runId);
    const leaseKey = [...pubsub.leases.keys()].find(key => key.endsWith(thread));
    expect(leaseKey).toBeDefined();
    pubsub.leases.clear();
    // Several TTLs pass, so the renewal fails and the lease would be free for a successor.
    await new Promise(resolve => setTimeout(resolve, 600));
    return { agent, pubsub, runId, leaseKey: leaseKey!, toolCallId: `call_archive_${tag}` };
  }

  it('holds the thread lease again while the resumed tool runs after a lapse', async () => {
    let ctx!: Awaited<ReturnType<typeof parkAndLoseLease>>;
    const owners: (string | undefined)[] = [];
    ctx = await parkAndLoseLease(`${engine}-relock`, async () => {
      // Sample across more than three TTLs, so a lease without renewal would have lapsed.
      for (let i = 0; i < 4; i++) {
        const lease = ctx.pubsub.leases.get(ctx.leaseKey);
        owners.push(lease && lease.expiresAt > Date.now() ? lease.owner : undefined);
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      return { archived: true };
    });

    const resumed = await ctx.agent.approveToolCall({ runId: ctx.runId, toolCallId: ctx.toolCallId });
    for await (const _ of resumed.fullStream) {
      // drain
    }
    expect(await resumed.text).toBe('Archived.');
    expect(owners).toEqual([ctx.runId, ctx.runId, ctx.runId, ctx.runId]);
  }, 20_000);

  // Normal and fs resumes register through the non-strict registerRun, which deliberately runs on
  // when another owner holds the lease, so they still run the tool beside a successor. Changing that
  // is a separate behaviour decision; `it.fails` flags the gap until then.
  const refuseIt = isDurableEngineVariant(engine) ? it : it.fails;
  refuseIt(
    'refuses to resume a parked run whose lapsed lease a successor now holds',
    async () => {
      let executions = 0;
      const ctx = await parkAndLoseLease(`${engine}-taken`, async () => {
        executions++;
        return { archived: true };
      });
      ctx.pubsub.leases.set(ctx.leaseKey, { owner: 'successor-run', expiresAt: Date.now() + 60_000 });

      let refusal: unknown;
      try {
        const resumed = await ctx.agent.approveToolCall({ runId: ctx.runId, toolCallId: ctx.toolCallId });
        for await (const chunk of resumed.fullStream) {
          if (chunk.type === 'error') refusal ??= chunk.payload?.error;
        }
      } catch (error) {
        refusal = error;
      }
      // Give a resume that slipped through time to reach the tool.
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(executions).toBe(0);
      expect(String((refusal as Error | undefined)?.message ?? refusal)).toContain(
        'thread lease is held by successor-run',
      );
      expect(ctx.pubsub.leases.get(ctx.leaseKey)?.owner).toBe('successor-run');
    },
    20_000,
  );

  it('still stops a partly resumed run that loses its lease while a sibling suspension is pending', async () => {
    const tag = `${engine}-partial`;
    const thread = `parked-lease-thread-${tag}`;
    llm.on(
      { userMessage: `ask two ${tag}`, hasToolResult: false },
      {
        toolCalls: [
          { id: `call_a_${tag}`, name: 'ask', arguments: { q: 'a' } },
          { id: `call_b_${tag}`, name: 'ask', arguments: { q: 'b' } },
        ],
      },
    );
    llm.on({ userMessage: `ask two ${tag}`, hasToolResult: true }, { content: 'Answered.' });

    let toolStarted!: () => void;
    const started = new Promise<void>(resolve => (toolStarted = resolve));
    let toolAborted = false;
    // Suspends at runtime with no suspend schema, so sibling calls run (and suspend) side by side.
    const ask = createTool({
      id: 'ask',
      description: 'Ask the user a question',
      inputSchema: z.object({ q: z.string() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) return await context?.agent?.suspend({ question: 'ok?' });
        toolStarted();
        // Runs until the run is stopped, or gives up after a while.
        const signal = context?.abortSignal;
        await new Promise<void>(resolve => {
          const timer = setTimeout(resolve, 3_000);
          signal?.addEventListener('abort', () => {
            toolAborted = true;
            clearTimeout(timer);
            resolve();
          });
        });
        return { answered: true };
      },
    });

    const pubsub = new FlakyLeasePubSub();
    const agent = buildAgent(engine, llm.url, ask, pubsub, new InMemoryStore());

    const result = await agent.stream(`ask two ${tag}`, { memory: { thread, resource: RESOURCE } });
    const output = isDurableEngineVariant(engine) ? result.output : result;
    const suspended: string[] = [];
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'tool-call-suspended') suspended.push(chunk.payload.toolCallId);
      if (suspended.length === 2) break;
    }
    expect(suspended).toHaveLength(2);
    const runId: string = output.runId ?? result.runId;

    // Resume one call: its tool runs while the sibling suspension stays pending.
    const resumed = await agent.resumeStream({ answer: 'yes' }, { runId, toolCallId: suspended[0] });
    void (async () => {
      for await (const _ of resumed.fullStream) {
        // drain
      }
    })().catch(() => {});
    await started;
    // The backend lost the lease, so the next renewal returns false while the resumed tool runs.
    pubsub.leases.clear();
    await vi.waitFor(() => expect(toolAborted).toBe(true), { timeout: 2_000 });
  }, 20_000);
});
