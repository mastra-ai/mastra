import { agentThreadStreamRuntime } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdRunThreadLease, INNGEST_AGENT_THREAD_BUSY_ERROR_ID, waitForThreadToFree } from './thread-lease';

const LOOP = 'inngest:agentic-loop';
const TTL = agentThreadStreamRuntime.threadLeaseTtlMs;

function setup() {
  const pubsub = new EventEmitterPubSub();
  const statuses = new Map<string, string>();
  const mastra = {
    pubsub,
    getAgentById: () => {
      throw new Error('not registered');
    },
    getStorage: () => ({
      getStore: async () => ({
        loadWorkflowSnapshot: async ({ runId }: { runId: string }) =>
          statuses.has(runId) ? { status: statuses.get(runId) } : null,
      }),
    }),
  } as unknown as Mastra;
  const owner = () => agentThreadStreamRuntime.getThreadLeaseOwnerRunId(pubsub, { threadId: 't1', resourceId: 'r1' });
  // What the caller's registerRun takes: the bare run-id owner.
  const callerTakesLease = (runId: string) =>
    agentThreadStreamRuntime.reclaimDurableThreadLease(pubsub, runId, 't1', 'r1');
  const target = (runId: string) => ({ runId, state: { threadId: 't1', resourceId: 'r1' } });
  return { pubsub, mastra, statuses, owner, callerTakesLease, target };
}

describe('Inngest agent thread lease', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a run's thread busy while its steps execute after its caller stopped renewing (#29766)", async () => {
    const { mastra, statuses, owner, callerTakesLease, target } = setup();
    expect(await callerTakesLease('run-a')).toBe(true);
    statuses.set('run-a', 'running');

    // The caller exits; only the worker executing the run's step is left.
    const release = await holdRunThreadLease(mastra, target('run-a'), LOOP);
    await vi.advanceTimersByTimeAsync(TTL * 3);
    expect(await owner()).toBe('run-a');
    // A second run on the thread can't take it.
    expect(await callerTakesLease('run-b')).toBe(false);

    // After the run's last step the lease runs out on its own.
    release();
    await vi.advanceTimersByTimeAsync(TTL + 1);
    expect(await owner()).toBeUndefined();
  });

  it('shares one lease across parallel steps of the same run', async () => {
    const { mastra, owner, target } = setup();
    const releaseA = await holdRunThreadLease(mastra, target('run-a'), LOOP);
    const releaseB = await holdRunThreadLease(mastra, target('run-a'), LOOP);
    releaseA();
    await vi.advanceTimersByTimeAsync(TTL * 2);
    expect(await owner()).toBe('run-a');
    releaseB();
    await vi.advanceTimersByTimeAsync(TTL + 1);
    expect(await owner()).toBeUndefined();
  });

  it('refuses to execute a step while another executing run holds the thread', async () => {
    const { mastra, statuses, callerTakesLease, target } = setup();
    await callerTakesLease('run-a');
    statuses.set('run-a', 'running');
    await expect(holdRunThreadLease(mastra, target('run-b'), LOOP)).rejects.toMatchObject({
      id: INNGEST_AGENT_THREAD_BUSY_ERROR_ID,
    });
  });

  it('waits out the lease of a run that already finished', async () => {
    const { mastra, statuses, owner, callerTakesLease, target } = setup();
    await callerTakesLease('run-a');
    statuses.set('run-a', 'success');
    let held = false;
    const pending = holdRunThreadLease(mastra, target('run-b'), LOOP).then(release => {
      held = true;
      return release;
    });
    await vi.advanceTimersByTimeAsync(TTL / 2);
    expect(held).toBe(false);
    await vi.advanceTimersByTimeAsync(TTL);
    (await pending)();
    expect(held).toBe(true);
    expect(await owner()).toBe('run-b');
  });

  it('does nothing for read-only runs or runs without a thread', async () => {
    const { mastra, owner } = setup();
    (await holdRunThreadLease(mastra, { runId: 'run-a', state: {} }, LOOP))();
    (
      await holdRunThreadLease(
        mastra,
        { runId: 'run-a', state: { threadId: 't1', resourceId: 'r1', memoryConfig: { readOnly: true } } },
        LOOP,
      )
    )();
    expect(await owner()).toBeUndefined();
  });

  it('holds a new run back until the executing run on its thread finishes', async () => {
    const { mastra, pubsub, statuses, callerTakesLease, target } = setup();
    await callerTakesLease('run-a');
    statuses.set('run-a', 'running');
    const releaseA = await holdRunThreadLease(mastra, target('run-a'), LOOP);

    let started = false;
    const waiting = waitForThreadToFree(
      mastra,
      pubsub,
      { runId: 'run-b', threadId: 't1', resourceId: 'r1' },
      LOOP,
    ).then(() => {
      started = true;
    });
    await vi.advanceTimersByTimeAsync(TTL * 3);
    expect(started).toBe(false);

    statuses.set('run-a', 'success');
    releaseA();
    await vi.advanceTimersByTimeAsync(2_000);
    await waiting;
    expect(started).toBe(true);
  });

  it("doesn't hold a new run back for a suspended run, its own run, or an aborted wait", async () => {
    const { mastra, pubsub, statuses, callerTakesLease } = setup();
    await callerTakesLease('run-a');
    statuses.set('run-a', 'suspended');
    await waitForThreadToFree(mastra, pubsub, { runId: 'run-b', threadId: 't1', resourceId: 'r1' }, LOOP);
    await waitForThreadToFree(mastra, pubsub, { runId: 'run-a', threadId: 't1', resourceId: 'r1' }, LOOP);

    statuses.set('run-a', 'running');
    const controller = new AbortController();
    const waiting = waitForThreadToFree(
      mastra,
      pubsub,
      { runId: 'run-b', threadId: 't1', resourceId: 'r1' },
      LOOP,
      controller.signal,
    );
    const outcome = expect(waiting).rejects.toThrow('stop');
    controller.abort(new Error('stop'));
    await outcome;
  });
});
