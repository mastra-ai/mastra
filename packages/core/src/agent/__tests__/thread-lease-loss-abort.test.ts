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
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '300';
  process.env.MASTRA_AGENT_THREAD_LEASE_LOST_TOOL_GRACE_MS = '1500';
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

  it('lets a command already running finish, keeps its result, then stops the run that lost its lease', async () => {
    const thread = 'lease-lost-running-command-thread';
    const key = [RESOURCE, thread].join('\u0000');
    const prompt = 'running command run';
    llm.on(
      { userMessage: prompt, sequenceIndex: 0 },
      { toolCalls: [{ id: 'call_running_command', name: 'run_command', arguments: {} }] },
    );
    llm.on({ userMessage: prompt, sequenceIndex: 1 }, { content: 'must not be asked for' });

    const shared = new SharedLeases();
    const memory = new MockMemory();
    let started = false;
    let command: { exitCode: number | null; signal: NodeJS.Signals | null; stdout: string } | undefined;
    const runCommand = createTool({
      id: 'run_command',
      description: 'Run a command',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        // A real child process, stopped by the run's abort signal the way a workspace command is.
        const child = spawn('sh', ['-c', 'sleep 1; echo command finished'], { signal: context?.abortSignal });
        started = true;
        let stdout = '';
        child.stdout.on('data', data => (stdout += data));
        child.on('error', () => {});
        command = await new Promise(resolve =>
          child.on('close', (exitCode, signal) => resolve({ exitCode, signal, stdout })),
        );
        return command.stdout.trim() || `killed by ${command.signal}`;
      },
    });
    const agent = replica(shared, memory, { run_command: runCommand });
    const subscription = await agent.subscribeToThread({ resourceId: RESOURCE, threadId: thread });
    const aborts: unknown[] = [];
    const toolResults: unknown[] = [];
    const watching = (async () => {
      for await (const chunk of subscription.stream as AsyncIterable<any>) {
        if (chunk?.type === 'tool-result') toolResults.push(chunk.payload?.result);
        if (chunk?.type === 'abort') {
          aborts.push(chunk.payload);
          break;
        }
      }
    })();

    const { output, drain } = await startStream(agent, prompt, {
      maxSteps: 4,
      memory: { thread, resource: RESOURCE },
    });
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(started).toBe(true), { timeout: 5_000 });

    // Another process's run takes the thread while the command is running.
    shared.leases.set(key, { owner: 'successor-run', expiresAt: Date.now() + 60_000 });
    await done;
    await watching;
    subscription.unsubscribe();

    // The command ran to its end and its result was kept, and the run then stopped without asking the model again.
    expect(command).toEqual({ exitCode: 0, signal: null, stdout: 'command finished\n' });
    expect(toolResults).toEqual(['command finished']);
    expect(await output.finishReason).toBe('aborted');
    expect(aborts).toEqual([expect.objectContaining({ reason: 'thread-lease-lost' })]);
    expect(
      llm.getRequests().filter(request => JSON.stringify(request.body?.messages ?? []).includes(prompt)),
    ).toHaveLength(1);
  }, 20_000);

  it('lets a model response already streaming finish, keeps it, then stops the run that lost its lease', async () => {
    const thread = 'lease-lost-streaming-response-thread';
    const key = [RESOURCE, thread].join('\u0000');
    const prompt = 'streaming response run';
    const answer = Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ');
    // A real streamed response that takes over a second to arrive.
    llm.on({ userMessage: prompt, sequenceIndex: 0 }, { content: answer }, { streamingProfile: { tps: 30 } });
    llm.on({ userMessage: prompt, sequenceIndex: 1 }, { content: 'must not be asked for' });

    const shared = new SharedLeases();
    const agent = replica(shared, new MockMemory());
    const subscription = await agent.subscribeToThread({ resourceId: RESOURCE, threadId: thread });
    let streamed = '';
    const aborts: unknown[] = [];
    const watching = (async () => {
      for await (const chunk of subscription.stream as AsyncIterable<any>) {
        if (chunk?.type === 'text-delta') streamed += chunk.payload?.text ?? '';
        if (chunk?.type === 'abort') {
          aborts.push(chunk.payload);
          break;
        }
      }
    })();

    const { output, drain } = await startStream(agent, prompt, { maxSteps: 4, memory: { thread, resource: RESOURCE } });
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(streamed.length).toBeGreaterThan(0), { timeout: 5_000 });

    // Another process's run takes the thread while the response is still streaming.
    shared.leases.set(key, { owner: 'successor-run', expiresAt: Date.now() + 60_000 });
    let successorKept = true;
    const watchingOwner = setInterval(() => {
      if (shared.owner(key) !== 'successor-run') successorKept = false;
    }, 10);
    await done;
    await watching;
    clearInterval(watchingOwner);
    subscription.unsubscribe();

    // The whole response arrived, the lost run never took the thread back, and it stopped without another step.
    expect(streamed).toBe(answer);
    expect(successorKept).toBe(true);
    expect(await output.finishReason).toBe('aborted');
    expect(aborts).toEqual([expect.objectContaining({ reason: 'thread-lease-lost' })]);
    expect(
      llm.getRequests().filter(request => JSON.stringify(request.body?.messages ?? []).includes(prompt)),
    ).toHaveLength(1);
  }, 20_000);

  it('lets a request already sent fail after the lease is lost, without retrying it or trying a fallback model', async () => {
    const thread = 'lease-lost-failed-request-thread';
    const key = [RESOURCE, thread].join('\u0000');
    const models: string[] = [];
    let answer = () => {};
    const answered = new Promise<void>(resolve => (answer = resolve));
    // A provider that takes the request and answers 503 only later; any further request answers normally.
    const server = createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      const model = JSON.parse(body).model;
      models.push(model);
      if (models.length === 1) {
        await answered;
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'temporarily unavailable', type: 'server_error' } }));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const chunk = (delta: object, finish_reason: string | null) =>
        res.write(
          `data: ${JSON.stringify({ id: 'r', object: 'chat.completion.chunk', created: 1, model, choices: [{ index: 0, delta, finish_reason }] })}\n\n`,
        );
      chunk({ role: 'assistant', content: 'must not be asked for' }, null);
      chunk({}, 'stop');
      res.end('data: [DONE]\n\n');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    const provider = createOpenAI({ apiKey: 'local-test', baseURL: `http://127.0.0.1:${address.port}/v1` });
    const shared = new SharedLeases();
    const memory = new MockMemory();
    const pubsub = new ReplicaPubSub(shared);
    const model = [
      { model: provider.chat('gpt-4o-mini'), maxRetries: 1 },
      { model: provider.chat('gpt-4o'), maxRetries: 0 },
    ];
    const base =
      engine === 'fs'
        ? assembleAgentFromFsEntry({ name: 'failed-request-agent', config: { model, memory }, instructionsMd: 'Test' })
        : new Agent({ id: 'failed-request-agent', name: 'failed-request-agent', instructions: 'Test', model, memory });
    const built =
      engine === 'durable'
        ? createDurableAgent({ agent: base })
        : engine === 'evented'
          ? createEventedAgent({ agent: base, pubsub })
          : base;
    const mastra = new Mastra({ agents: engine === 'fs' ? {} : { agent: built as any }, pubsub, logger: false });
    if (engine === 'fs') mastra.__registerFsAgents({ agent: built as any });

    try {
      const { output, drain } = await startStream(mastra.getAgent('agent') as any, 'failed request run', {
        maxSteps: 4,
        memory: { thread, resource: RESOURCE },
      });
      const done = drain().catch(() => undefined);
      await vi.waitFor(() => expect(models).toHaveLength(1), { timeout: 5_000 });

      // Another run takes the thread while the request is out; the run learns it on its next renewal.
      shared.leases.set(key, { owner: 'successor-run', expiresAt: Date.now() + 60_000 });
      await new Promise(resolve => setTimeout(resolve, 400));
      answer();
      await done;

      // The failed request was the last one: no retry, no fallback model.
      expect(models).toEqual(['gpt-4o-mini']);
      expect(await output.finishReason).toBe('aborted');
      expect(shared.owner(key)).toBe('successor-run');
    } finally {
      answer();
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }, 20_000);

  it('sends no retry when the lease is lost while a failed request waits to be retried', async () => {
    const thread = 'lease-lost-retry-delay-thread';
    const key = [RESOURCE, thread].join('\u0000');
    const models: string[] = [];
    let failedAt = 0;
    // The first request fails at once with a retryable 503; any further request answers normally.
    const server = createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      const model = JSON.parse(body).model;
      models.push(model);
      if (models.length === 1) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'temporarily unavailable', type: 'server_error' } }));
        failedAt = Date.now();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const chunk = (delta: object, finish_reason: string | null) =>
        res.write(
          `data: ${JSON.stringify({ id: 'r', object: 'chat.completion.chunk', created: 1, model, choices: [{ index: 0, delta, finish_reason }] })}\n\n`,
        );
      chunk({ role: 'assistant', content: 'must not be asked for' }, null);
      chunk({}, 'stop');
      res.end('data: [DONE]\n\n');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    const provider = createOpenAI({ apiKey: 'local-test', baseURL: `http://127.0.0.1:${address.port}/v1` });
    const shared = new SharedLeases();
    const memory = new MockMemory();
    const pubsub = new ReplicaPubSub(shared);
    const model = [{ model: provider.chat('gpt-4o-mini'), maxRetries: 1 }];
    const base =
      engine === 'fs'
        ? assembleAgentFromFsEntry({ name: 'retry-delay-agent', config: { model, memory }, instructionsMd: 'Test' })
        : new Agent({ id: 'retry-delay-agent', name: 'retry-delay-agent', instructions: 'Test', model, memory });
    const built =
      engine === 'durable'
        ? createDurableAgent({ agent: base })
        : engine === 'evented'
          ? createEventedAgent({ agent: base, pubsub })
          : base;
    const mastra = new Mastra({ agents: engine === 'fs' ? {} : { agent: built as any }, pubsub, logger: false });
    if (engine === 'fs') mastra.__registerFsAgents({ agent: built as any });

    try {
      const { output, drain } = await startStream(mastra.getAgent('agent') as any, 'retry delay run', {
        maxSteps: 4,
        memory: { thread, resource: RESOURCE },
      });
      const done = drain().catch(() => undefined);
      await vi.waitFor(() => expect(failedAt).toBeGreaterThan(0), { timeout: 5_000 });

      // The request has failed and its retry waits about a second. Another run takes the thread meanwhile.
      shared.leases.set(key, { owner: 'successor-run', expiresAt: Date.now() + 60_000 });
      await done;

      expect(await output.finishReason).toBe('aborted');
      // No request goes out after the lease is lost: the retry is never sent.
      expect(models).toEqual(['gpt-4o-mini']);
      expect(shared.owner(key)).toBe('successor-run');
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }, 20_000);

  it('keeps renewing while a step runs, and once another run owns the thread only waits for the step', async () => {
    const thread = 'lease-renewal-during-step-thread';
    const key = [RESOURCE, thread].join('\u0000');
    const prompt = 'renewal during step run';
    llm.on(
      { userMessage: prompt, sequenceIndex: 0 },
      { toolCalls: [{ id: 'call_renewal_step', name: 'run_command', arguments: {} }] },
    );
    llm.on({ userMessage: prompt, sequenceIndex: 1 }, { content: 'must not be asked for' });

    const shared = new SharedLeases();
    let lost = false;
    const callsAfterLoss: string[] = [];
    class CountingPubSub extends ReplicaPubSub {
      override async renewLease(leaseKey: string, owner: string, ttlMs: number) {
        if (lost && leaseKey === key) callsAfterLoss.push(`renew ${owner}`);
        return super.renewLease(leaseKey, owner, ttlMs);
      }
      override async acquireLease(leaseKey: string, owner: string, ttlMs: number) {
        if (lost && leaseKey === key) callsAfterLoss.push(`acquire ${owner}`);
        return super.acquireLease(leaseKey, owner, ttlMs);
      }
    }
    let started = false;
    const runCommand = createTool({
      id: 'run_command',
      description: 'Run a command',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        const child = spawn('sh', ['-c', 'sleep 1.5; echo command finished'], { signal: context?.abortSignal });
        started = true;
        let stdout = '';
        child.stdout.on('data', data => (stdout += data));
        child.on('error', () => {});
        await new Promise(resolve => child.on('close', resolve));
        return stdout.trim();
      },
    });
    const agent = replica(shared, new MockMemory(), { run_command: runCommand }, new CountingPubSub(shared));
    const { output, drain } = await startStream(agent, prompt, { maxSteps: 4, memory: { thread, resource: RESOURCE } });
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(started).toBe(true), { timeout: 5_000 });

    // The lease is renewed while the command runs (every 100ms at this test's 300ms TTL).
    const renewalsBefore = shared.renewals;
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(shared.renewals - renewalsBefore).toBeGreaterThanOrEqual(3);

    // Another run takes the thread. The held run neither keeps renewing nor takes it back while its command finishes.
    shared.leases.set(key, { owner: 'successor-run', expiresAt: Date.now() + 60_000 });
    lost = true;
    await done;
    expect(callsAfterLoss.length).toBeLessThanOrEqual(1);
    expect(shared.owner(key)).toBe('successor-run');
    expect(await output.finishReason).toBe('aborted');
  }, 20_000);

  it('keeps a run whose retake handover outlasts the retake lease, as long as nobody else holds the thread', async () => {
    const thread = 'slow-handover-thread';
    const key = [RESOURCE, thread].join('\u0000');
    const prompt = 'slow handover run';
    for (let i = 0; i < 12; i++) {
      llm.on(
        { userMessage: prompt, sequenceIndex: i },
        { toolCalls: [{ id: `call_slow_handover_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    llm.on({ userMessage: prompt, sequenceIndex: 12 }, { content: 'slow handover done' });

    const shared = new SharedLeases();
    /**
     * Once cut, the run's own renewals hang, so its lease lapses and it takes the thread back. Handing a retake
     * token over to the run then takes twice the lease duration (300ms); renewing that token still works.
     */
    class SlowHandoverPubSub extends ReplicaPubSub {
      cut = false;
      handovers = 0;
      override async renewLease(k: string, owner: string, ttlMs: number) {
        if (this.cut && k === key && !owner.includes('\u0000retake\u0000')) await new Promise(() => {});
        return super.renewLease(k, owner, ttlMs);
      }
      override async transferLease(k: string, from: string, to: string) {
        if (k === key && from.includes('\u0000retake\u0000')) {
          this.handovers++;
          this.cut = false;
          await new Promise(resolve => setTimeout(resolve, 600));
        }
        return super.transferLease(k, from, to);
      }
    }
    const pubsub = new SlowHandoverPubSub(shared);
    let ticks = 0;
    const tick = createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        await new Promise(resolve => setTimeout(resolve, 150));
        return 'ticked';
      },
    });
    const { output, drain } = await startStream(replica(shared, new MockMemory(), { tick }, pubsub), prompt, {
      maxSteps: 20,
      toolCallConcurrency: 1,
      memory: { thread, resource: RESOURCE },
    });
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 10_000 });

    // Nobody else wants the thread; the backend is only slow to hand it over.
    pubsub.cut = true;
    await done;

    expect(pubsub.handovers).toBeGreaterThan(0);
    expect(await output.finishReason).toBe('stop');
    expect(await output.text).toBe('slow handover done');
    expect(ticks).toBe(12);
  }, 30_000);

  it('keeps a run whose failed handover is still releasing its retake token when it takes the thread again', async () => {
    const thread = 'handover-release-race-thread';
    const key = [RESOURCE, thread].join('\u0000');
    const prompt = 'handover release race run';
    for (let i = 0; i < 12; i++) {
      llm.on(
        { userMessage: prompt, sequenceIndex: i },
        { toolCalls: [{ id: `call_release_race_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    llm.on({ userMessage: prompt, sequenceIndex: 12 }, { content: 'release race done' });

    const shared = new SharedLeases();
    /**
     * Once cut, the run's own renewals hang, so its lease lapses and it takes the thread back. The first handover of
     * the retake token fails, and giving that token back takes longer than taking the thread again under a new one,
     * so the new take still finds the old token holding the lease. Nobody else ever holds the thread.
     */
    class ReleaseRacePubSub extends ReplicaPubSub {
      cut = false;
      handovers = 0;
      override async renewLease(k: string, owner: string, ttlMs: number) {
        if (this.cut && k === key && !owner.includes('\u0000retake\u0000')) await new Promise(() => {});
        return super.renewLease(k, owner, ttlMs);
      }
      override async transferLease(k: string, from: string, to: string, ttlMs: number) {
        if (k === key && from.includes('\u0000retake\u0000') && ++this.handovers === 1) {
          this.cut = false;
          throw new Error('transfer failed: connection reset');
        }
        return super.transferLease(k, from, to, ttlMs);
      }
      override async releaseLease(k: string, owner: string) {
        if (k === key && owner.includes('\u0000retake\u0000')) await new Promise(resolve => setTimeout(resolve, 80));
        return super.releaseLease(k, owner);
      }
    }
    const pubsub = new ReleaseRacePubSub(shared);
    let ticks = 0;
    const tick = createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        await new Promise(resolve => setTimeout(resolve, 150));
        return 'ticked';
      },
    });
    const { output, drain } = await startStream(replica(shared, new MockMemory(), { tick }, pubsub), prompt, {
      maxSteps: 20,
      toolCallConcurrency: 1,
      memory: { thread, resource: RESOURCE },
    });
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 10_000 });

    pubsub.cut = true;
    await done;

    expect(await output.finishReason).toBe('stop');
    expect(await output.text).toBe('release race done');
    expect(pubsub.handovers).toBeGreaterThan(1);
    expect(ticks).toBe(12);
  }, 30_000);

  it('spaces out retakes while every handover fails, and goes on once one succeeds', async () => {
    const thread = 'failing-handover-pacing-thread';
    const key = [RESOURCE, thread].join('\u0000');
    const prompt = 'failing handover pacing run';
    llm.on(
      { userMessage: prompt, sequenceIndex: 0 },
      { toolCalls: [{ id: 'call_failing_handover', name: 'run_command', arguments: {} }] },
    );
    llm.on({ userMessage: prompt, sequenceIndex: 1 }, { content: 'failing handover done' });

    const shared = new SharedLeases();
    /** Once cut, the run's own renewals hang; every handover of a retake token is rejected until healed. */
    class FailingHandoverPubSub extends ReplicaPubSub {
      cut = false;
      failing = true;
      handovers = 0;
      override async renewLease(k: string, owner: string, ttlMs: number) {
        if (this.cut && k === key && !owner.includes('\u0000retake\u0000')) await new Promise(() => {});
        return super.renewLease(k, owner, ttlMs);
      }
      override async transferLease(k: string, from: string, to: string, ttlMs: number) {
        if (k === key && from.includes('\u0000retake\u0000')) {
          this.handovers++;
          if (this.failing) throw new Error('transfer rejected');
          this.cut = false;
        }
        return super.transferLease(k, from, to, ttlMs);
      }
    }
    const pubsub = new FailingHandoverPubSub(shared);
    let started = false;
    let finish = () => {};
    const finished = new Promise<void>(resolve => (finish = resolve));
    const runCommand = createTool({
      id: 'run_command',
      description: 'Run a command',
      inputSchema: z.object({}),
      execute: async () => {
        started = true;
        await finished;
        return 'command finished';
      },
    });
    const { output, drain } = await startStream(
      replica(shared, new MockMemory(), { run_command: runCommand }, pubsub),
      prompt,
      {
        maxSteps: 4,
        memory: { thread, resource: RESOURCE },
      },
    );
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(started).toBe(true), { timeout: 5_000 });

    pubsub.cut = true;
    await vi.waitFor(() => expect(pubsub.handovers).toBeGreaterThan(0), { timeout: 5_000 });
    const before = pubsub.handovers;
    await new Promise(resolve => setTimeout(resolve, 1_000));
    const inOneSecond = pubsub.handovers - before;

    pubsub.failing = false;
    finish();
    await done;

    // A backend that rejects every handover at once is asked again at a measured pace, not in a tight loop.
    expect(inOneSecond).toBeLessThan(100);
    expect(await output.finishReason).toBe('stop');
    expect(await output.text).toBe('failing handover done');
  }, 30_000);

  it('keeps a run whose lease backend stops answering during a running command, once it gets the lease back', async () => {
    const thread = 'silent-backend-running-command-thread';
    const prompt = 'silent backend command run';
    llm.on(
      { userMessage: prompt, sequenceIndex: 0 },
      { toolCalls: [{ id: 'call_silent_backend_command', name: 'run_command', arguments: {} }] },
    );
    llm.on({ userMessage: prompt, sequenceIndex: 1 }, { content: 'command run finished' });

    const shared = new SharedLeases();
    /** Once cut, renewals never answer and taking the lease back answers only after several renewal intervals. */
    class SlowBackendPubSub extends ReplicaPubSub {
      cut = false;
      override async renewLease(key: string, owner: string, ttlMs: number) {
        if (this.cut && key.startsWith(`${RESOURCE}\u0000`)) await new Promise(() => {});
        return super.renewLease(key, owner, ttlMs);
      }
      override async acquireLease(key: string, owner: string, ttlMs: number) {
        if (this.cut && key.startsWith(`${RESOURCE}\u0000`)) await new Promise(resolve => setTimeout(resolve, 400));
        return super.acquireLease(key, owner, ttlMs);
      }
    }
    const pubsub = new SlowBackendPubSub(shared);
    let started = false;
    let command: { exitCode: number | null; signal: NodeJS.Signals | null; stdout: string } | undefined;
    const runCommand = createTool({
      id: 'run_command',
      description: 'Run a command',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        const child = spawn('sh', ['-c', 'sleep 1; echo command finished'], { signal: context?.abortSignal });
        started = true;
        let stdout = '';
        child.stdout.on('data', data => (stdout += data));
        child.on('error', () => {});
        command = await new Promise(resolve =>
          child.on('close', (exitCode, signal) => resolve({ exitCode, signal, stdout })),
        );
        return command.stdout.trim() || `killed by ${command.signal}`;
      },
    });
    const { output, drain } = await startStream(
      replica(shared, new MockMemory(), { run_command: runCommand }, pubsub),
      prompt,
      { maxSteps: 4, memory: { thread, resource: RESOURCE } },
    );
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(started).toBe(true), { timeout: 5_000 });

    // Nobody else wants the thread: the backend is only slow. The run waits for its answer instead of stopping.
    pubsub.cut = true;
    await done;

    expect(command).toEqual({ exitCode: 0, signal: null, stdout: 'command finished\n' });
    expect(await output.finishReason).toBe('stop');
    expect(await output.text).toContain('command run finished');
    expect(
      llm.getRequests().filter(request => JSON.stringify(request.body?.messages ?? []).includes(prompt)),
    ).toHaveLength(2);
  }, 20_000);

  it('stops a run that lost its lease after a grace period when its running tool never returns', async () => {
    const thread = 'lease-lost-hung-tool-thread';
    const key = [RESOURCE, thread].join('\u0000');
    const prompt = 'hung tool run';
    llm.on(
      { userMessage: prompt, sequenceIndex: 0 },
      { toolCalls: [{ id: 'call_hung_tool', name: 'hang', arguments: {} }] },
    );
    llm.on({ userMessage: prompt, sequenceIndex: 1 }, { content: 'must not be asked for' });

    const shared = new SharedLeases();
    let started = false;
    const hang = createTool({
      id: 'hang',
      description: 'Never return',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        started = true;
        // Runs until the run's abort signal stops it, like a command that never exits.
        await new Promise((_resolve, reject) =>
          context?.abortSignal?.addEventListener('abort', () => reject(new Error('stopped')), { once: true }),
        );
      },
    });
    const { output, drain } = await startStream(replica(shared, new MockMemory(), { hang }), prompt, {
      maxSteps: 4,
      memory: { thread, resource: RESOURCE },
    });
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(started).toBe(true), { timeout: 5_000 });

    const lostAt = Date.now();
    shared.leases.set(key, { owner: 'successor-run', expiresAt: Date.now() + 60_000 });
    await done;
    const waited = Date.now() - lostAt;

    // The run waited for the tool for the grace period (1.5s here), then stopped without asking the model again.
    expect(await output.finishReason).toBe('aborted');
    expect(waited).toBeGreaterThanOrEqual(1_300);
    expect(waited).toBeLessThan(6_000);
    expect(
      llm.getRequests().filter(request => JSON.stringify(request.body?.messages ?? []).includes(prompt)),
    ).toHaveLength(1);
  }, 20_000);

  it.each(['reject', 'hang'] as const)(
    'stops a run whose lease renewals %s once it can see another run took the thread',
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
      const successorDone = drainSuccessor();
      // A backend that can't answer is no reason to stop a run with a step running, and its tool waits for the
      // lease. Once the connection is back, it sees the successor holds the thread and stops.
      await vi.waitFor(() => expect(calls).toContain('new'), { timeout: 5_000 });
      oldPubsub.partition = undefined;
      await successorDone;
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

  it('runs no tool while its lease backend errors past the deadline, and goes on once it answers', async () => {
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
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(stall).toBe(true), { timeout: 5_000 });
    await new Promise(resolve => setTimeout(resolve, 1_000));
    expect(afterStall).toEqual([]);

    stall = false;
    if (isDurableEngineVariant(engine)) {
      // A durable run also holds its own execution claim, which the 400ms stalls let lapse. That claim, not the
      // thread lease, stops it, and it says so.
      await done;
      expect(afterStall).toEqual([]);
      expect(String((await output.error)?.message ?? '')).toContain(
        'could not verify that this execution still owns the run',
      );
      return;
    }
    // The backend answers again and nobody else took the thread: the run takes its lease back and goes on.
    const ticksBack = ticks;
    await vi.waitFor(() => expect(ticks).toBeGreaterThan(ticksBack), { timeout: 5_000 });
    await done;
    expect(afterStall).toEqual([]);
    expect(await output.finishReason).not.toBe('aborted');
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

  it('keeps a run waiting, running no tool, while its lease backend is silent, and goes on once it answers', async () => {
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
    const agent = replica(shared, new MockMemory(), { tick }, pubsub);
    const { output, drain } = await startStream(agent, 'silent backend', {
      maxSteps: 100,
      memory: { thread, resource: RESOURCE },
    });
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 5_000 });
    expect(shared.owner(key)).toBeDefined();

    // Every lease call now hangs, as when the connection to Redis is cut without an error.
    let settled = false;
    void output.finishReason.then(() => (settled = true));
    pubsub.partition = 'hang';
    const ticksAtCut = ticks;
    await new Promise(resolve => setTimeout(resolve, 1_000));
    // The tool that was running finishes; no other starts without the lease, and the run isn't stopped.
    expect(ticks - ticksAtCut).toBeLessThanOrEqual(1);
    expect(settled).toBe(false);

    // The backend answers again and nobody else took the thread: the run takes its lease back and goes on.
    pubsub.partition = undefined;
    const ticksBack = ticks;
    await vi.waitFor(() => expect(ticks).toBeGreaterThan(ticksBack + 2), { timeout: 5_000 });
    expect(settled).toBe(false);
    expect(shared.owner(key)).toBeDefined();
    expect(agent.abortThreadStream({ resourceId: RESOURCE, threadId: thread })).toBe(true);
    await done;
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

  it('keeps a run going while its own retake holds the lease under its temporary token', async () => {
    const thread = `own-retake-fence-thread-${engine}`;
    const key = [RESOURCE, thread].join('\u0000');
    const runId = `own-retake-run-${engine}`;
    const prompt = `own retake fence ${engine}`;
    for (let i = 0; i < 10; i++) {
      llm.on(
        { userMessage: prompt, sequenceIndex: i },
        { toolCalls: [{ id: `call_own_retake_${engine}_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    llm.on({ userMessage: prompt, sequenceIndex: 10 }, { content: 'own retake fence done' });

    const shared = new SharedLeases();
    let releaseHandover: (() => void) | undefined;
    let handoverStarted: (() => void) | undefined;
    const handover = new Promise<void>(resolve => (handoverStarted = resolve));
    /**
     * Renewals hang past the TTL, as on a process too loaded to finish one in time, so the lease lapses and the run
     * takes it back. The retake then holds the lease under its own temporary token for a moment before handing it to
     * the run id, as a slow backend does, and a queued tool call checks the fence inside that window.
     */
    class StalledHandoverPubSub extends ReplicaPubSub {
      stalled: Promise<void> | undefined;
      ownerReads = 0;
      override async getLeaseOwner(k: string) {
        if (k === key) this.ownerReads++;
        return super.getLeaseOwner(k);
      }
      override async renewLease(k: string, owner: string, ttlMs: number) {
        if (this.stalled && k === key) await this.stalled;
        return super.renewLease(k, owner, ttlMs);
      }
      override async transferLease(k: string, from: string, to: string) {
        if (k === key && from.includes('\u0000retake\u0000')) {
          handoverStarted?.();
          await new Promise<void>(resolve => (releaseHandover = resolve));
        }
        return super.transferLease(k, from, to);
      }
    }
    const pubsub = new StalledHandoverPubSub(shared);
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
    const { output, drain } = await startStream(replica(shared, new MockMemory(), { tick }, pubsub), prompt, {
      runId,
      maxSteps: 12,
      memory: { thread, resource: RESOURCE },
    });
    const done = drain();
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 15_000 });

    let resume!: () => void;
    pubsub.stalled = new Promise<void>(resolve => (resume = resolve));
    await handover;
    expect(shared.owner(key)?.startsWith(`${runId}\u0000retake\u0000`)).toBe(true);

    // The fence must wait for that handover instead of stopping the run. Once it has read the token as owner it
    // either fails at once or keeps waiting for the retake, so one turn is enough to tell the two apart.
    const readsBefore = pubsub.ownerReads;
    let fenceState = 'pending';
    const fence = verifyRunLease(runId).then(
      () => {
        fenceState = 'resolved';
      },
      () => {
        fenceState = 'rejected';
      },
    );
    await vi.waitFor(() => expect(pubsub.ownerReads).toBeGreaterThan(readsBefore), { timeout: 2_000 });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fenceState).toBe('pending');

    // Released inside the same interval, the retake hands the lease over and the run keeps the thread.
    releaseHandover?.();
    pubsub.stalled = undefined;
    resume();
    await fence;
    expect(fenceState).toBe('resolved');
    await done;

    expect(await output.text).toBe('own retake fence done');
    expect(await output.finishReason).not.toBe('aborted');
  }, 30_000);

  it('waits on a handoff that outlives a renewal interval while a step runs, and frees its token once the run stops', async () => {
    const thread = `slow-handoff-bound-thread-${engine}`;
    const key = [RESOURCE, thread].join('\u0000');
    const runId = `slow-handoff-run-${engine}`;
    const prompt = `slow handoff bound ${engine}`;
    for (let i = 0; i < 40; i++) {
      llm.on(
        { userMessage: prompt, sequenceIndex: i },
        { toolCalls: [{ id: `call_slow_handoff_${engine}_${i}`, name: 'tick', arguments: {} }] },
      );
    }

    const shared = new SharedLeases();
    const released: string[] = [];
    let handoverStarted: (() => void) | undefined;
    const handover = new Promise<void>(resolve => (handoverStarted = resolve));
    /**
     * The handoff never answers. While the run has a step running it waits, but once the run is stopped it must
     * give up and free the temporary token instead of holding the thread under a lease nothing renews.
     */
    class SilentHandoffPubSub extends ReplicaPubSub {
      stalled: Promise<void> | undefined;
      override async renewLease(k: string, owner: string, ttlMs: number) {
        if (this.stalled && k === key) await this.stalled;
        return super.renewLease(k, owner, ttlMs);
      }
      override async transferLease(k: string, from: string, to: string) {
        if (k === key && from.includes('\u0000retake\u0000')) {
          handoverStarted?.();
          await new Promise(() => {});
        }
        return super.transferLease(k, from, to);
      }
      override async releaseLease(k: string, owner: string) {
        if (k === key) released.push(owner);
        return super.releaseLease(k, owner);
      }
    }
    const pubsub = new SilentHandoffPubSub(shared);
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
    const agent = replica(shared, new MockMemory(), { tick }, pubsub);
    const { output, drain } = await startStream(agent, prompt, {
      runId,
      maxSteps: 100,
      memory: { thread, resource: RESOURCE },
    });
    let settled = false;
    void output.finishReason.then(() => (settled = true));
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 15_000 });

    let resume!: () => void;
    pubsub.stalled = new Promise<void>(resolve => (resume = resolve));
    await handover;

    // Several intervals on, the run still waits for the handoff and keeps the token.
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(settled).toBe(false);
    expect(released.some(owner => owner.startsWith(`${runId}\u0000retake\u0000`))).toBe(false);

    // Once the run is stopped, the retake gives up and releases the token lease it took.
    const stoppedAt = Date.now();
    expect(agent.abortThreadStream({ resourceId: RESOURCE, threadId: thread })).toBe(true);
    resume();
    await vi.waitFor(() => expect(released.some(owner => owner.startsWith(`${runId}\u0000retake\u0000`))).toBe(true), {
      timeout: 1_500,
    });
    expect(Date.now() - stoppedAt).toBeLessThan(1_500);
    await vi.waitFor(() => expect(output.finishReason).resolves.toBe('aborted'), { timeout: 2_000 });
    await done;
  }, 30_000);

  it('leaves a late handoff alone when a successor holds the same run id', async () => {
    const thread = `late-handoff-successor-thread-${engine}`;
    const key = [RESOURCE, thread].join('\u0000');
    const runId = `late-handoff-run-${engine}`;
    const prompt = `reused id late handoff ${engine}`;
    // One tool call holds the run open while the lease lapses, so nothing here depends on how many steps fit.
    llm.on(
      { userMessage: prompt },
      { toolCalls: [{ id: `call_late_handoff_${engine}`, name: 'tick', arguments: {} }] },
    );

    const shared = new SharedLeases();
    const released: string[] = [];
    let releaseTool!: () => void;
    const toolGate = new Promise<void>(resolve => (releaseTool = resolve));
    let handoverStarted: (() => void) | undefined;
    const handover = new Promise<void>(resolve => (handoverStarted = resolve));
    let releaseHandoff: (() => void) | undefined;
    /** The handoff answers only after the retake gave up, and then installs the run id on a lease nobody renews. */
    class LateHandoffPubSub extends ReplicaPubSub {
      cut = false;
      transfers: Array<{ from: string; to: string }> = [];
      override async renewLease(k: string, owner: string, ttlMs: number) {
        if (this.cut && k === key) await new Promise(() => {});
        return super.renewLease(k, owner, ttlMs);
      }
      override async transferLease(k: string, from: string, to: string) {
        if (k === key) this.transfers.push({ from, to });
        if (k === key && from.includes('\u0000retake\u0000')) {
          handoverStarted?.();
          await new Promise<void>(resolve => (releaseHandoff = resolve));
        }
        return super.transferLease(k, from, to);
      }
      override async releaseLease(k: string, owner: string) {
        released.push(owner);
        if (k !== key) return super.releaseLease(k, owner);
        // A backend whose release of the temporary token loses the race with the handoff still grants it.
        if (owner.includes('\u0000retake\u0000')) return;
        return super.releaseLease(k, owner);
      }
    }
    const pubsub = new LateHandoffPubSub(shared);
    let ticking = false;
    const tick = createTool({
      id: 'tick',
      description: 'Wait while the lease is retaken',
      inputSchema: z.object({}),
      execute: async () => {
        ticking = true;
        await toolGate;
        return 'ticked';
      },
    });
    const agent = replica(shared, new MockMemory(), { tick }, pubsub);
    const { output, drain } = await startStream(agent, prompt, {
      runId,
      maxSteps: 3,
      memory: { thread, resource: RESOURCE },
    });
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(ticking).toBe(true), { timeout: 15_000 });
    const queuedMarker = `queued input during abandoned handoff ${engine}`;
    llm.on({ userMessage: queuedMarker }, { content: 'queued input ran here' });
    const queued = agent.sendSignal(
      { type: 'user-message', contents: queuedMarker },
      { resourceId: RESOURCE, threadId: thread },
    );
    expect(await queued.accepted).toMatchObject({ action: 'deliver', runId });

    pubsub.cut = true;
    shared.drop(key);
    await handover;
    // The run is stopped while its tool still runs, so this attempt gives up on its handoff within an interval,
    // while the temporary token it took is still live.
    expect(agent.abortThreadStream({ resourceId: RESOURCE, threadId: thread })).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 150));

    releaseHandoff?.();
    // The abandoned handoff lands after the give-up and installs the run id on a lease nothing renews here.
    await vi.waitFor(() => expect(shared.owner(key)).toBe(runId), { timeout: 2_000 });
    const remote = new ReplicaPubSub(shared);
    expect(await remote.acquireLease(key, runId, 60_000)).toMatchObject({ acquired: true });
    const releasedBefore = released.length;
    releaseTool();
    await done;
    expect(await output.finishReason).toBe('aborted');

    // Ending under that run id must leave the lease to expire: whatever runs next under the same id owns it.
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(released.slice(releasedBefore)).not.toContain(runId);
    expect(
      pubsub.transfers.filter(transfer => transfer.from === runId),
      'marked record must not transfer a same-id successor lease to a local drain',
    ).toEqual([]);
    expect(shared.owner(key)).toBe(runId);

    // The marker belongs to this record, so a later execution that reuses the id on the same thread still frees
    // the lease it acquires. Checking a different thread would pass without ever consulting the marker.
    released.length = 0;
    const laterPrompt = `reused id later run ${engine}`;
    llm.on({ userMessage: laterPrompt }, { content: 'later finished' });
    const later = await startStream(agent, laterPrompt, {
      runId,
      maxSteps: 2,
      memory: { thread, resource: RESOURCE },
    });
    const releasesBeforeLater = released.length;
    await later.drain();
    await vi.waitFor(() => expect(released.slice(releasesBeforeLater)).toContain(runId), { timeout: 5_000 });
  }, 40_000);

  it.each([false, true])(
    'never acknowledges delivery to a temporary retake lease token (stuck=%s)',
    async stuck => {
      const thread = `retake-token-signal-thread-${stuck}`;
      const key = [RESOURCE, thread].join('\u0000');
      const marker = `primary-retake-input-${engine}-${stuck}`;
      const concurrentMarker = `concurrent-retake-input-${engine}-${stuck}`;
      const runId = `retaking-run-${engine}-${stuck}`;
      const prompt = `retake signal owner ${stuck}`;
      llm.on(
        { userMessage: prompt, sequenceIndex: 0 },
        { toolCalls: [{ id: `call_retake_signal_${engine}_${stuck}`, name: 'tick', arguments: {} }] },
      );
      llm.on({ userMessage: prompt, sequenceIndex: 1 }, { content: 'owner finished' });
      llm.on({ userMessage: marker }, { content: 'primary signal received' });
      llm.on({ userMessage: concurrentMarker }, { content: 'concurrent signal received' });
      const shared = new SharedLeases();
      const events = new EventEmitter();
      let releaseTransfer!: () => void;
      const transferGate = new Promise<void>(resolve => (releaseTransfer = resolve));
      let releaseTool!: () => void;
      const toolGate = new Promise<void>(resolve => (releaseTool = resolve));
      class RetakingPubSub extends ReplicaPubSub {
        cut = false;
        tokenHeld = false;
        override async renewLease(key: string, owner: string, ttlMs: number) {
          if (this.cut && key.startsWith(`${RESOURCE}\u0000`)) await new Promise(() => {});
          return super.renewLease(key, owner, ttlMs);
        }
        override async transferLease(key: string, from: string, to: string) {
          if (from.includes('\u0000retake\u0000')) {
            this.tokenHeld = true;
            await transferGate;
          }
          return super.transferLease(key, from, to);
        }
      }
      const ownerPubSub = new RetakingPubSub(shared, events);
      let ticking = false;
      const tick = createTool({
        id: 'tick',
        description: 'Wait while the lease is retaken',
        inputSchema: z.object({}),
        execute: async () => {
          ticking = true;
          await toolGate;
          return 'ticked';
        },
      });
      const { output, drain } = await startStream(replica(shared, new MockMemory(), { tick }, ownerPubSub), prompt, {
        runId,
        maxSteps: 3,
        memory: { thread, resource: RESOURCE },
      });
      const done = drain().catch(() => undefined);
      let accepted: { action: string; runId?: string } | undefined;
      let concurrentAccepted: { action: string; runId?: string } | undefined;
      let signalIds: string[] = [];
      let forwardedEvents: Array<{ type?: string; runId?: string; signal?: { id: string } }> = [];
      let handover: ReturnType<typeof setTimeout> | undefined;
      const senderPubSub = new ReplicaPubSub(shared, events);
      const published = vi.spyOn(senderPubSub, 'publish');
      const startedAt = performance.now();
      try {
        await vi.waitFor(() => expect(ticking).toBe(true));
        ownerPubSub.cut = true;
        shared.drop(key);
        await vi.waitFor(() => expect(ownerPubSub.tokenHeld).toBe(true));
        expect(shared.owner(key)).toContain('\u0000retake\u0000');
        const sender = replica(shared, new MockMemory(), {}, senderPubSub);
        const sent = sender.sendSignal(
          { type: 'user-message', contents: marker },
          { resourceId: RESOURCE, threadId: thread, ifIdle: { behavior: 'wake' } },
        );
        await new Promise(resolve => setTimeout(resolve, 10));
        const concurrent = sender.sendSignal(
          { type: 'user-message', contents: concurrentMarker },
          { resourceId: RESOURCE, threadId: thread, ifIdle: { behavior: 'wake' } },
        );
        signalIds = [sent.signal.id, concurrent.signal.id];
        if (!stuck) handover = setTimeout(releaseTransfer, 20);
        [accepted, concurrentAccepted] = await Promise.all([sent.accepted, concurrent.accepted]);
      } finally {
        clearTimeout(handover);
        ownerPubSub.cut = false;
        releaseTransfer();
        releaseTool();
        await done;
        forwardedEvents = published.mock.calls
          .map(([, event]) => event.data as { type?: string; runId?: string; signal?: { id: string } })
          .filter(event => event.type === 'signal-enqueued' && signalIds.includes(event.signal?.id ?? ''));
        published.mockRestore();
      }
      expect(accepted).toMatchObject({ action: stuck ? 'blocked' : 'deliver', runId });
      expect(concurrentAccepted).toMatchObject({ action: stuck ? 'blocked' : 'deliver', runId });
      expect(performance.now() - startedAt).toBeLessThan(2_000);
      // A handoff that doesn't answer while the run's tool is running is waited for, not taken as a loss: the run
      // goes on once it lands. Signals sent meanwhile are still never acknowledged to the temporary token.
      expect(await output.finishReason).toBe('stop');
      for (const signalId of signalIds) {
        const matching = forwardedEvents.filter(event => event.signal?.id === signalId);
        expect(matching).toHaveLength(stuck ? 0 : 1);
        if (!stuck) expect(matching[0]?.runId).toBe(runId);
      }
      const requests = llm.getRequests().map(request => JSON.stringify(request.body));
      expect(requests.some(request => request.includes(marker))).toBe(!stuck);
      expect(requests.some(request => request.includes(concurrentMarker))).toBe(!stuck);
    },
    20_000,
  );

  it.each([
    ['follow-up', false],
    ['idle', false],
    ['follow-up', true],
    ['idle', true],
  ] as const)(
    'never forwards the %s drain to a retake token (stuck=%s)',
    async (queue, stuck) => {
      const thread = `retake-drain-${queue}-${stuck}`;
      const key = [RESOURCE, thread].join('\u0000');
      const runId = `draining-run-${engine}-${queue}-${stuck}`;
      const successor = `successor-${engine}-${queue}-${stuck}`;
      const token = `${successor}\u0000retake\u0000attempt`;
      const prompt = `retake drain ${queue} ${stuck}`;
      llm.on(
        { userMessage: prompt, sequenceIndex: 0 },
        { toolCalls: [{ id: `call_drain_${engine}_${queue}_${stuck}`, name: 'tick', arguments: {} }] },
      );
      llm.on({ userMessage: prompt, sequenceIndex: 1 }, { content: 'draining owner finished' });
      const shared = new SharedLeases();
      let releaseAcquire!: () => void;
      const acquireGate = new Promise<void>(resolve => (releaseAcquire = resolve));
      class DrainPubSub extends ReplicaPubSub {
        draining = false;
        override async transferLease(leaseKey: string, from: string, to: string) {
          if (leaseKey === key && from === runId && to !== runId) {
            this.draining = true;
            shared.leases.set(key, { owner: token, expiresAt: Date.now() + 60_000 });
            return false;
          }
          return super.transferLease(leaseKey, from, to);
        }
        override async acquireLease(leaseKey: string, owner: string, ttlMs: number) {
          if (leaseKey === key && this.draining) {
            await acquireGate;
            if (!stuck) shared.leases.set(key, { owner: successor, expiresAt: Date.now() + 60_000 });
          }
          return super.acquireLease(leaseKey, owner, ttlMs);
        }
      }
      const pubsub = new DrainPubSub(shared);
      const published = vi.spyOn(pubsub, 'publish');
      let releaseTool!: () => void;
      const toolGate = new Promise<void>(resolve => (releaseTool = resolve));
      let ticking = false;
      const tick = createTool({
        id: 'tick',
        description: 'Hold the run until its follow-up is queued',
        inputSchema: z.object({}),
        execute: async () => {
          ticking = true;
          await toolGate;
          return 'ticked';
        },
      });
      const agent = replica(shared, new MockMemory(), { tick }, pubsub);
      const target = { resourceId: RESOURCE, threadId: thread };
      let sent: ReturnType<Agent['sendSignal']> | undefined;
      const { output, drain } = await startStream(agent, prompt, {
        runId,
        maxSteps: 2,
        memory: { thread, resource: RESOURCE },
        onFinish: async () => {
          if (queue === 'follow-up') {
            // Input arriving after the final model step must use the follow-up drain.
            sent = agent.sendSignal({ type: 'user-message', contents: 'queued during retake' }, target);
            await sent!.accepted;
          }
        },
      });
      const done = drain();
      let concurrent: ReturnType<Agent['sendSignal']> | undefined;
      let concurrentAccepted: { action: string; runId?: string } | undefined;
      try {
        await vi.waitFor(() => expect(ticking).toBe(true));
        if (queue === 'idle') {
          sent = agent.queueMessage('queued during retake', target);
          await sent!.accepted;
        }
        releaseTool();
        await vi.waitFor(() => expect(pubsub.draining).toBe(true));
        concurrent = agent.sendSignal(
          { type: 'user-message', contents: 'concurrent during drain reservation' },
          target,
        );
        releaseAcquire();
        concurrentAccepted = await concurrent.accepted;
        await done;
        expect(sent).toBeDefined();
        const signalIds = [sent!.signal.id, concurrent.signal.id];
        const forwarded = () =>
          published.mock.calls
            .map(([, event]) => event.data as { type?: string; runId?: string; signal?: { id: string } })
            .filter(
              event =>
                event?.type === 'signal-enqueued' &&
                signalIds.includes(event.signal?.id ?? '') &&
                event.runId !== runId,
            );
        expect(concurrentAccepted).toMatchObject({ action: stuck ? 'blocked' : 'deliver', runId: successor });
        if (stuck) {
          await new Promise(resolve => setTimeout(resolve, 200));
          expect(forwarded()).toEqual([]);
          expect(agent.cancelQueuedMessages({ ...target, signalIds: [sent!.signal.id] })).toEqual({
            cancelledSignalIds: [sent!.signal.id],
          });
        } else {
          await vi.waitFor(() => expect(forwarded()).toHaveLength(2));
          for (const signalId of signalIds) {
            expect(forwarded().filter(event => event.signal?.id === signalId)).toEqual([
              expect.objectContaining({ runId: successor }),
            ]);
          }
        }
        expect(await output.finishReason).toBe('stop');
      } finally {
        releaseTool();
        releaseAcquire();
        await done;
        published.mockRestore();
      }
    },
    20_000,
  );

  it('keeps a run going while its lapsed lease is taken back slowly, as long as a step runs', async () => {
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
    const agent = replica(shared, new MockMemory(), { tick }, pubsub);
    const { output, drain } = await startStream(agent, 'slow retake', {
      maxSteps: 100,
      memory: { thread, resource: RESOURCE },
    });
    let settled = false;
    void output.finishReason.then(() => (settled = true));
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 5_000 });

    // Every renewal now hangs, so the lease lapses each TTL (300ms), and taking it back takes most of a TTL. Nobody
    // else wants the thread: the run waits for each answer and keeps going through several lapses.
    pubsub.cut = true;
    // Past several lapses, the run is still ticking.
    await new Promise(resolve => setTimeout(resolve, 1_000));
    const ticksLater = ticks;
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(ticksLater + 3), { timeout: 10_000 });
    expect(settled).toBe(false);
    expect(agent.abortThreadStream({ resourceId: RESOURCE, threadId: thread })).toBe(true);
    await done;
  }, 20_000);

  it('frees the thread when a retake it gave up on is granted after the run stopped', async () => {
    const thread = 'late-retake-grant-thread';
    const key = [RESOURCE, thread].join('\u0000');
    for (let i = 0; i < 100; i++) {
      llm.on(
        { userMessage: 'late retake grant', sequenceIndex: i },
        { toolCalls: [{ id: `call_late_grant_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    const shared = new SharedLeases();
    /** Once cut, renewals never answer and a retake is granted only after the run gave up on it. */
    class LateGrantPubSub extends ReplicaPubSub {
      cut = false;
      grantedLate = false;
      /** Thread-lease acquires sent after the cut. */
      sent = 0;
      override async renewLease(key: string, owner: string, ttlMs: number) {
        if (this.cut && key.startsWith(`${RESOURCE}\u0000`)) await new Promise(() => {});
        return super.renewLease(key, owner, ttlMs);
      }
      override async acquireLease(key: string, owner: string, ttlMs: number) {
        if (!this.cut || !key.startsWith(`${RESOURCE}\u0000`)) return super.acquireLease(key, owner, ttlMs);
        this.sent++;
        await new Promise(resolve => setTimeout(resolve, 250));
        const lease = await super.acquireLease(key, owner, ttlMs);
        this.grantedLate = lease.acquired;
        return lease;
      }
    }
    const pubsub = new LateGrantPubSub(shared);
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
    const agent = replica(shared, new MockMemory(), { tick }, pubsub);
    const { output, drain } = await startStream(agent, 'late retake grant', {
      maxSteps: 100,
      memory: { thread, resource: RESOURCE },
    });
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 5_000 });
    pubsub.cut = true;
    // The run is stopped while its retake is on its way, so it gives up on that retake.
    await vi.waitFor(() => expect(pubsub.sent).toBeGreaterThan(0), { timeout: 5_000 });
    expect(agent.abortThreadStream({ resourceId: RESOURCE, threadId: thread })).toBe(true);
    await done;
    expect(await output.finishReason).toBe('aborted');

    // The backend granted the abandoned retake to a run that no longer exists. Nothing renews that lease,
    // so the thread must be freed at once rather than stay held for a TTL.
    await vi.waitFor(() => expect(pubsub.grantedLate).toBe(true), { timeout: 5_000 });
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(shared.owner(key)).toBeUndefined();
  }, 20_000);

  it("never frees a successor's lease when a retake it gave up on settles after the successor took the run", async () => {
    const thread = 'late-retake-successor-thread';
    const key = [RESOURCE, thread].join('\u0000');
    for (let i = 0; i < 100; i++) {
      llm.on(
        { userMessage: 'late retake after takeover', sequenceIndex: i },
        { toolCalls: [{ id: `call_late_takeover_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    const shared = new SharedLeases();
    /** Once cut, renewals never answer and a retake reaches the backend only after the run gave up on it. */
    class LateRetakePubSub extends ReplicaPubSub {
      cut = false;
      /** Thread-lease acquires that reached the backend after the cut, and those still on their way. */
      settled = 0;
      pending = 0;
      override async renewLease(key: string, owner: string, ttlMs: number) {
        if (this.cut && key.startsWith(`${RESOURCE}\u0000`)) await new Promise(() => {});
        return super.renewLease(key, owner, ttlMs);
      }
      override async acquireLease(key: string, owner: string, ttlMs: number) {
        if (!this.cut || !key.startsWith(`${RESOURCE}\u0000`)) return super.acquireLease(key, owner, ttlMs);
        this.pending++;
        await new Promise(resolve => setTimeout(resolve, 250));
        try {
          return await super.acquireLease(key, owner, ttlMs);
        } finally {
          this.pending--;
          this.settled++;
        }
      }
    }
    const pubsub = new LateRetakePubSub(shared);
    const runId = `late-retake-successor-${engine}`;
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
    const agent = replica(shared, new MockMemory(), { tick }, pubsub);
    const { output, drain } = await startStream(agent, 'late retake after takeover', {
      runId,
      maxSteps: 100,
      memory: { thread, resource: RESOURCE },
    });
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 5_000 });
    pubsub.cut = true;
    // The run is stopped while its retake is on its way, so it gives up on that retake.
    await vi.waitFor(() => expect(pubsub.pending).toBeGreaterThan(0), { timeout: 5_000 });
    expect(agent.abortThreadStream({ resourceId: RESOURCE, threadId: thread })).toBe(true);
    await done;
    expect(await output.finishReason).toBe('aborted');

    // Another process recovers the same run (a durable recover does this) and takes the thread under the
    // run's id while this process's abandoned retake is still on its way to the backend.
    const successor = await new ReplicaPubSub(shared).acquireLease(key, runId, 60_000);
    expect(successor.acquired).toBe(true);

    // Wait until every acquire the abandoned retake sent has settled, and for what it does after.
    await vi.waitFor(
      () => {
        expect(pubsub.settled).toBeGreaterThan(0);
        expect(pubsub.pending).toBe(0);
      },
      { timeout: 5_000 },
    );
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(shared.owner(key)).toBe(runId);
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

  it('stops a run whose retake is refused because another run took the thread during the lapse', async () => {
    const thread = 'refused-retake-thread';
    const key = [RESOURCE, thread].join('\u0000');
    for (let i = 0; i < 100; i++) {
      llm.on(
        { userMessage: 'refused retake', sequenceIndex: i },
        { toolCalls: [{ id: `call_refused_${i}`, name: 'tick', arguments: {} }] },
      );
    }
    const modelCalls = () =>
      llm.getRequests().filter(request => JSON.stringify(request.body?.messages ?? []).includes('refused retake'))
        .length;
    const shared = new SharedLeases();
    /**
     * Once cut, the lease backend stops answering renewals and owner checks, as one behind a partition does,
     * and another process's run takes the thread. Only an acquire still gets through, so the run's
     * deadline sends it to retake the lease, and the retake must be refused.
     */
    class LapseThenTakenPubSub extends ReplicaPubSub {
      cut = false;
      override async renewLease(key: string, owner: string, ttlMs: number) {
        if (this.cut && key.startsWith(`${RESOURCE}\u0000`)) await new Promise(() => {});
        return super.renewLease(key, owner, ttlMs);
      }
      override async getLeaseOwner(key: string) {
        if (this.cut && key.startsWith(`${RESOURCE}\u0000`)) await new Promise(() => {});
        return super.getLeaseOwner(key);
      }
    }
    const pubsub = new LapseThenTakenPubSub(shared);
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
    const agent = replica(shared, new MockMemory(), { tick }, pubsub);
    const subscription = await agent.subscribeToThread({ resourceId: RESOURCE, threadId: thread });
    const aborts: unknown[] = [];
    let callsAtAbort = -1;
    let ticksAtAbort = -1;
    const watching = (async () => {
      for await (const chunk of subscription.stream as AsyncIterable<any>) {
        if (chunk?.type === 'abort') {
          callsAtAbort = modelCalls();
          ticksAtAbort = ticks;
          aborts.push(chunk.payload);
          break;
        }
      }
    })();

    const { output, drain } = await startStream(agent, 'refused retake', {
      maxSteps: 100,
      memory: { thread, resource: RESOURCE },
    });
    const done = drain().catch(() => undefined);
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 5_000 });
    pubsub.cut = true;
    shared.leases.set(key, { owner: 'successor-run', expiresAt: Date.now() + 60_000 });
    const ticksAtTakeover = ticks;
    await done;
    await watching;
    subscription.unsubscribe();
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(await output.finishReason).toBe('aborted');
    expect(aborts).toEqual([expect.objectContaining({ reason: 'thread-lease-lost' })]);
    // No tool call starts once the thread was taken (one may already be running), and nothing runs after the abort.
    expect(ticks - ticksAtTakeover).toBeLessThanOrEqual(1);
    expect(ticks).toBe(ticksAtAbort);
    expect(modelCalls()).toBe(callsAtAbort);
    expect(shared.owner(key)).toBe('successor-run');
  }, 20_000);
});
