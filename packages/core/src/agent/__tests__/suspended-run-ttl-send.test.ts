/**
 * Sending to a thread right after the suspended-run TTL sweep evicted its parked run.
 *
 * The sweep stops renewing the evicted run's lease but leaves the lease to expire on
 * its own, because another instance may have resumed the same runId and now hold it
 * (see `suspended-run-ttl.test.ts`). Until it expires, an idle send loses the lease to
 * a run that nothing on this instance executes. Such a send must not be reported as
 * delivered to that run and then dropped: it waits for the lease to lapse and wakes a
 * new run. If the swept run is still renewing its lease past that point, another
 * instance resumed it, and the send is forwarded to it as before.
 *
 * Both TTLs are read once at module load, so they are shortened in a hoisted block.
 * Real timers are used throughout: the lease and the sweep both read the wall clock.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { Event } from '../../events/types';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { MastraModelOutput } from '../../stream/base/output';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const { SUSPENDED_RUN_TTL_MS, LEASE_TTL_MS } = vi.hoisted(() => {
  const suspendedTtlMs = 200;
  const leaseTtlMs = 800;
  process.env.MASTRA_SUSPENDED_RUN_TTL_MS = String(suspendedTtlMs);
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = String(leaseTtlMs);
  return { SUSPENDED_RUN_TTL_MS: suspendedTtlMs, LEASE_TTL_MS: leaseTtlMs };
});
// Vitest reuses a worker process across test files, so restore the defaults.
afterAll(() => {
  delete process.env.MASTRA_SUSPENDED_RUN_TTL_MS;
  delete process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS;
});

const RESOURCE_ID = 'resource-1';
const PARKED_THREAD_ID = 'thread-parked';
const SWEEP_THREAD_ID = 'thread-sweep';
const threadKey = (threadId: string) => [RESOURCE_ID, threadId].join('\u0000');
const threadTopic = (threadId: string) => `agent.thread-stream.${encodeURIComponent(threadKey(threadId))}`;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const textResponse = () => ({
  rawCall: { rawPrompt: null, rawSettings: {} },
  warnings: [],
  stream: convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: 'ok' },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  ]),
});

/** The first turn on the parked thread calls a tool that suspends; every other turn answers in text. */
function createSetup() {
  let parked = false;
  const prompts: string[] = [];
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }: any) => {
      const text = JSON.stringify(prompt);
      prompts.push(text);
      if (!parked && text.includes('park this thread')) {
        parked = true;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'waitForUser', input: '{}' },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        } as any;
      }
      return textResponse() as any;
    },
  });
  const waitForUser = createTool({
    id: 'waitForUser',
    description: 'Waits for the user.',
    inputSchema: z.object({}),
    suspendSchema: z.object({}),
    resumeSchema: z.object({ ok: z.boolean() }),
    execute: async (_input, context: any) => {
      await context.agent.suspend({});
    },
  });
  const memory = new MockMemory();
  // Thread runtime state is kept per pubsub, so a fresh one isolates each test.
  const pubsub = new EventEmitterPubSub();
  const agent = new Agent({
    id: 'send-after-sweep-agent',
    name: 'Send After Sweep Agent',
    instructions: 'You answer briefly.',
    model,
    memory,
    tools: { waitForUser },
  });
  new Mastra({ agents: { agent }, pubsub, logger: false });
  return { agent, memory, pubsub, prompts };
}

type Setup = ReturnType<typeof createSetup>;

async function drain(stream: { fullStream: AsyncIterable<unknown> }) {
  for await (const _chunk of stream.fullStream) {
    // drain to a terminal state
  }
}

async function streamTurn({ agent }: Setup, threadId: string, text: string) {
  const output = await agent.stream(text, { memory: { thread: threadId, resource: RESOURCE_ID } });
  await drain(output);
  return output.runId;
}

const activeRunId = ({ agent }: Setup) =>
  agent.getActiveThreadRunId({ threadId: PARKED_THREAD_ID, resourceId: RESOURCE_ID });

/** Park a run on the thread, then let it age past the TTL and sweep it with a turn on another thread. */
async function parkAndSweep(setup: Setup) {
  const parkedRunId = await streamTurn(setup, PARKED_THREAD_ID, 'park this thread');
  await vi.waitFor(() => expect(activeRunId(setup)).toBe(parkedRunId));
  await sleep(SUSPENDED_RUN_TTL_MS + 50);
  await streamTurn(setup, SWEEP_THREAD_ID, 'trigger the sweep');
  expect(activeRunId(setup)).toBeUndefined();
  // The sweep left the lease to expire on its own.
  expect(await setup.pubsub.getLeaseOwner(threadKey(PARKED_THREAD_ID))).toBe(parkedRunId);
  return parkedRunId;
}

function send({ agent }: Setup, text: string) {
  return agent.sendMessage(text, { resourceId: RESOURCE_ID, threadId: PARKED_THREAD_ID });
}

async function persisted({ memory }: Setup, text: string) {
  const { messages } = await memory.recall({ threadId: PARKED_THREAD_ID, resourceId: RESOURCE_ID, perPage: false });
  return JSON.stringify(messages).includes(text);
}

/** Publish a wake request the way another instance asks this instance's claimed owner to run a message. */
function requestClaimedWake(
  { pubsub }: Setup,
  request: { id: string; targetSourceId?: string; replyTopic: string; expiresAt?: number },
) {
  const data = {
    type: 'idle-signal-enqueued',
    requestId: request.id,
    runId: `run-${request.id}`,
    sourceId: 'remote-sender',
    targetSourceId: request.targetSourceId,
    replyTopic: request.replyTopic,
    expiresAt: request.expiresAt,
    signal: { id: request.id, type: 'user', contents: request.id },
  };
  return pubsub.publish(threadTopic(PARKED_THREAD_ID), { type: data.type, runId: data.runId, data });
}

/** A run output that stays running until settled, standing in for a resume of the swept run. */
function createResumedRun(runId: string) {
  let status: 'running' | 'success' = 'running';
  let controller!: ReadableStreamDefaultController<unknown>;
  let finish!: () => void;
  const finished = new Promise<void>(resolve => {
    finish = resolve;
  });
  const output = {
    runId,
    get status() {
      return status;
    },
    fullStream: new ReadableStream<unknown>({
      start(streamController) {
        controller = streamController;
      },
    }),
    _waitUntilFinished: () => finished,
  } as unknown as MastraModelOutput<unknown>;
  return {
    output,
    settle() {
      status = 'success';
      controller.close();
      finish();
    },
  };
}

describe('sending to a thread whose suspended run was just swept', () => {
  it('wakes a new run instead of reporting delivery to the swept run', async () => {
    const setup = createSetup();
    const parkedRunId = await parkAndSweep(setup);
    const promptsBefore = setup.prompts.length;

    const sentAt = Date.now();
    const accepted = await send(setup, 'message inside the lease window').accepted;

    expect(accepted.action).toBe('wake');
    if (accepted.action !== 'wake') throw new Error('Expected a wake');
    expect(accepted.runId).not.toBe(parkedRunId);
    // It waited out the swept run's lease rather than racing it.
    expect(Date.now() - sentAt).toBeLessThan(LEASE_TTL_MS + 1_000);
    await drain(accepted.output);
    expect(setup.prompts.slice(promptsBefore).some(prompt => prompt.includes('message inside the lease window'))).toBe(
      true,
    );
    expect(await persisted(setup, 'message inside the lease window')).toBe(true);
    await setup.pubsub.close();
  }, 15_000);

  it('folds a follow-up sent while the first send waits into the woken run', async () => {
    const setup = createSetup();
    await parkAndSweep(setup);

    const first = send(setup, 'first message in the window');
    await sleep(50);
    const second = await send(setup, 'second message in the window').accepted;
    const accepted = await first.accepted;

    if (accepted.action !== 'wake') throw new Error('Expected a wake');
    expect(second).toEqual({ action: 'deliver', runId: accepted.runId });
    await drain(accepted.output);
    expect(await persisted(setup, 'first message in the window')).toBe(true);
    expect(await persisted(setup, 'second message in the window')).toBe(true);
    await setup.pubsub.close();
  }, 15_000);

  it('still forwards to the swept run when another instance resumed it and keeps its lease', async () => {
    const setup = createSetup();
    const parkedRunId = await parkAndSweep(setup);
    // Another instance resumed the run: it holds the same runId's lease and keeps renewing it.
    const renewal = setInterval(() => {
      void setup.pubsub.renewLease(threadKey(PARKED_THREAD_ID), parkedRunId, LEASE_TTL_MS);
    }, LEASE_TTL_MS / 4);
    const enqueued: Event[] = [];
    await setup.pubsub.subscribe(threadTopic(PARKED_THREAD_ID), event => {
      if (event.type === 'signal-enqueued') enqueued.push(event);
    });
    const streamSpy = vi.spyOn(setup.agent, 'stream');

    try {
      const accepted = await send(setup, 'message for the resumed run').accepted;

      expect(accepted).toEqual({ action: 'deliver', runId: parkedRunId });
      expect(streamSpy).not.toHaveBeenCalled();
      await vi.waitFor(() =>
        expect(
          enqueued.some(
            event => event.runId === parkedRunId && JSON.stringify(event.data).includes('message for the resumed run'),
          ),
        ).toBe(true),
      );
    } finally {
      clearInterval(renewal);
      await setup.pubsub.close();
    }
  }, 15_000);

  it('hands follow-ups queued during the wait to the swept run when it is resumed on this instance', async () => {
    const setup = createSetup();
    const parkedRunId = await parkAndSweep(setup);

    const first = send(setup, 'first message before the resume');
    await sleep(50);
    await send(setup, 'second message before the resume').accepted;
    // The swept run is resumed here while the first send is still waiting out its lease.
    const resumed = createResumedRun(parkedRunId);
    await agentThreadStreamRuntime.registerRun(
      setup.agent,
      resumed.output,
      { memory: { thread: PARKED_THREAD_ID, resource: RESOURCE_ID } },
      setup.agent.getPubSub(),
    );

    try {
      expect(await first.accepted).toEqual({ action: 'deliver', runId: parkedRunId });
      const received: string[] = [];
      await vi.waitFor(() => {
        for (const signal of agentThreadStreamRuntime.drainPendingSignals(parkedRunId, setup.agent.getPubSub())) {
          received.push(JSON.stringify(signal.contents));
        }
        expect(received.join()).toContain('first message before the resume');
        expect(received.join()).toContain('second message before the resume');
      });
    } finally {
      resumed.settle();
      await setup.pubsub.close();
    }
  }, 15_000);

  it('starts the run when the lease backend fails while waiting, instead of reporting delivery to the swept run', async () => {
    const setup = createSetup();
    const parkedRunId = await parkAndSweep(setup);
    const acquireLease = setup.pubsub.acquireLease.bind(setup.pubsub);
    let attempts = 0;
    const acquireSpy = vi
      .spyOn(setup.pubsub, 'acquireLease')
      .mockImplementation(async (key: string, owner: string, ttlMs: number) => {
        if (key === threadKey(PARKED_THREAD_ID) && owner !== parkedRunId && ++attempts > 1) {
          throw new Error('lease backend unavailable');
        }
        return acquireLease(key, owner, ttlMs);
      });

    try {
      const accepted = await send(setup, 'message during a lease outage').accepted;

      expect(attempts).toBeGreaterThan(1);
      expect(accepted.action).toBe('wake');
      if (accepted.action !== 'wake') throw new Error('Expected a wake');
      expect(accepted.runId).not.toBe(parkedRunId);
      await drain(accepted.output);
      expect(await persisted(setup, 'message during a lease outage')).toBe(true);
    } finally {
      acquireSpy.mockRestore();
      await setup.pubsub.close();
    }
  }, 15_000);

  it('forwards a wake request queued behind the waiting send to a run resumed elsewhere', async () => {
    const setup = createSetup();
    const parkedRunId = await parkAndSweep(setup);
    const enqueued: string[] = [];
    const replies: { type: string }[] = [];
    const replyTopic = `${threadTopic(PARKED_THREAD_ID)}.test-reply`;
    await setup.pubsub.subscribe(threadTopic(PARKED_THREAD_ID), event => {
      if (event.type === 'signal-enqueued' && event.runId === parkedRunId) enqueued.push(JSON.stringify(event.data));
    });
    await setup.pubsub.subscribe(replyTopic, event => {
      replies.push(event.data as { type: string });
    });
    // Another instance resumed the run and keeps renewing its lease.
    const renewal = setInterval(() => {
      void setup.pubsub.renewLease(threadKey(PARKED_THREAD_ID), parkedRunId, LEASE_TTL_MS);
    }, LEASE_TTL_MS / 4);
    let claim: { unsubscribe: () => void } | undefined;

    try {
      const waiting = send(setup, 'local message while waiting');
      await sleep(50);
      // The thread is claimed while the send waits, and a wake request from another
      // instance is queued behind the send's reservation.
      claim = await setup.agent.claimThreadOwnership({ resourceId: RESOURCE_ID, threadId: PARKED_THREAD_ID });
      const targetSourceId = await setup.pubsub.getLeaseOwner(`thread-claim:${threadKey(PARKED_THREAD_ID)}`);
      await requestClaimedWake(setup, {
        id: 'remote-message-while-waiting',
        targetSourceId,
        replyTopic,
        expiresAt: Date.now() + 5_000,
      });
      await vi.waitFor(() => expect(replies).toEqual([expect.objectContaining({ type: 'idle-signal-accepted' })]));

      expect(await waiting.accepted).toEqual({ action: 'deliver', runId: parkedRunId });
      await vi.waitFor(() => {
        expect(enqueued.join()).toContain('local message while waiting');
        expect(enqueued.join()).toContain('remote-message-while-waiting');
      });
    } finally {
      clearInterval(renewal);
      claim?.unsubscribe();
      await setup.pubsub.close();
    }
  }, 15_000);

  it('forwards straight away when the lease belongs to a run this instance never swept', async () => {
    const setup = createSetup();
    // A run on another instance holds the thread; nothing was swept here.
    await setup.pubsub.acquireLease(threadKey(PARKED_THREAD_ID), 'remote-run', LEASE_TTL_MS * 10);
    const streamSpy = vi.spyOn(setup.agent, 'stream');

    const sentAt = Date.now();
    const accepted = await send(setup, 'message for the remote run').accepted;

    expect(accepted).toEqual({ action: 'deliver', runId: 'remote-run' });
    expect(Date.now() - sentAt).toBeLessThan(LEASE_TTL_MS / 2);
    expect(streamSpy).not.toHaveBeenCalled();
    await setup.pubsub.close();
  }, 15_000);
});
