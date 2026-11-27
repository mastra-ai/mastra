/**
 * Two Mastra instances sharing one LibSQL file, each with its own in-process
 * broker, like two server instances without a shared PubSub. Instance A pins a
 * pending background task (`pinToWorker`) because work for it is already in
 * flight there. Instance B's stale-task recovery must leave the row alone while
 * A is alive, and treat it as a lost attempt once A dies.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { BackgroundTaskManager, TaskContext } from '@mastra/core/background-tasks';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from './index';

const LEASE_MS = 3_000;

let dir: string;
const cleanups: Array<() => Promise<void>> = [];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mastra-bg-pinned-'));
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  await rm(dir, { recursive: true, force: true });
});

async function instance(id: string, globalConcurrency: number): Promise<BackgroundTaskManager> {
  const mastra = new Mastra({
    logger: false,
    storage: new LibSQLStore({ id: `bg-pinned-${id}`, url: `file:${join(dir, 'shared.db')}` }),
    backgroundTasks: {
      enabled: true,
      globalConcurrency,
      perAgentConcurrency: globalConcurrency,
      leaseDurationMs: LEASE_MS,
    },
  });
  await mastra.startWorkers();
  const mgr = mastra.backgroundTaskManager!;
  cleanups.push(async () => {
    await mgr.shutdown();
    await mastra.stopWorkers();
  });
  return mgr;
}

const ctx = (execute: () => Promise<unknown>): TaskContext => ({ executor: { execute } });
const payload = (toolCallId: string, maxRetries = 0) => ({
  toolName: 'mcp-tool',
  toolCallId,
  args: {},
  agentId: 'mcp-server:ops',
  runId: toolCallId,
  maxRetries,
});

/** Instance A, with its only slot taken, pins a second task that queues locally. */
async function pinnedOnBusyInstance(maxRetries: number) {
  const a = await instance('a', 1);
  let release!: () => void;
  const busy = new Promise<void>(resolve => (release = resolve));
  const { task: blocker } = await a.enqueue(
    payload('blocker'),
    ctx(async () => {
      await busy;
      return 'blocker';
    }),
  );
  await vi.waitFor(async () => expect((await a.getTask(blocker.id))?.status).toBe('running'));

  const onA = vi.fn(async () => 'from-a');
  const { task } = await a.enqueue(payload('pinned', maxRetries), ctx(onA), { pinToWorker: true });
  return { a, release, onA, task };
}

/** Instance B starts later; its startup recovery scans the shared table. */
async function peer() {
  const b = await instance('b', 10);
  const onB = vi.fn(async () => 'from-b');
  b.registerStaticExecutor('mcp-tool', { execute: onB });
  return { b, onB };
}

/** Stops A's lease heartbeat without a graceful shutdown, like a crash. */
function crash(mgr: BackgroundTaskManager) {
  clearInterval((mgr as any).heartbeatInterval);
}

describe('pinned pending background tasks across instances (LibSQL)', () => {
  it('leaves a pinned row to its live owner', async () => {
    const { a, release, onA, task } = await pinnedOnBusyInstance(1);
    const { b, onB } = await peer();

    // Outlive the original lease; A's heartbeat keeps it pinned.
    await new Promise(resolve => setTimeout(resolve, LEASE_MS + 1_000));
    expect(onB).not.toHaveBeenCalled();
    expect(await b.getTask(task.id)).toMatchObject({ status: 'pending', ownerId: a.ownerId });

    release();
    await vi.waitFor(async () => expect(await a.getTask(task.id)).toMatchObject({ status: 'completed' }), {
      timeout: 3_000,
    });
    expect((await a.getTask(task.id))?.result).toBe('from-a');
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).not.toHaveBeenCalled();
  }, 20_000);

  it('runs a pinned row once on a peer after its owner dies, consuming a retry', async () => {
    const { a, release, onA, task } = await pinnedOnBusyInstance(1);
    crash(a);
    const { b, onB } = await peer();

    await vi.waitFor(async () => expect(await b.getTask(task.id)).toMatchObject({ status: 'completed' }), {
      timeout: LEASE_MS * 3,
      interval: 100,
    });
    expect(await b.getTask(task.id)).toMatchObject({ result: 'from-b', retryCount: 1 });
    expect(onB).toHaveBeenCalledTimes(1);
    expect(onA).not.toHaveBeenCalled();
    release();
  }, 20_000);

  it('fails a pinned row without retries after its owner dies, never running it on a peer', async () => {
    const { a, release, onA, task } = await pinnedOnBusyInstance(0);
    crash(a);
    const { b, onB } = await peer();

    await vi.waitFor(async () => expect((await b.getTask(task.id))?.status).toBe('failed'), {
      timeout: LEASE_MS * 3,
      interval: 100,
    });
    expect((await b.getTask(task.id))?.error?.message).toBe('Worker process terminated before task completed');
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(onB).not.toHaveBeenCalled();
    expect(onA).not.toHaveBeenCalled();
    release();
  }, 20_000);
});
