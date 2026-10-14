import { randomUUID } from 'node:crypto';
import type { MemoryStorage, RunFence, WorkflowsStorage } from '@mastra/core/storage';
import { isRunFenceConflictError } from '@mastra/core/storage';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../index';
import { connectionString, TEST_CONFIG } from '../test-utils';

/**
 * A fenced write checks ownership and writes in one transaction. These tests
 * stop a write between those two steps and take the run over meanwhile: the
 * takeover must wait for the in-flight write, and every write after it must be
 * rejected. Two stores with their own pools stand in for two processes.
 */
describe('PostgreSQL run fencing: a takeover racing an in-flight write', () => {
  const schemaName = `run_fence_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const LEASE_MS = 30_000;
  const heldLocks = new Set<() => Promise<void>>();
  let storeA: PostgresStore;
  let storeB: PostgresStore;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    storeA = new PostgresStore({ ...TEST_CONFIG, id: 'run-fence-a', schemaName });
    storeB = new PostgresStore({ ...TEST_CONFIG, id: 'run-fence-b', schemaName });
    await storeA.init();
    await storeB.init();
  });

  // A failed assertion must not leave a lock behind for the next test to hang on.
  afterEach(async () => {
    await Promise.all([...heldLocks].map(release => release()));
  });

  afterAll(async () => {
    await Promise.all([storeA, storeB].map(store => store?.close().catch(() => {})));
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.end();
  });

  /** Holds a row lock on a separate connection until `release` is called. */
  async function lockRow(table: string, where: string, params: unknown[]) {
    const client: PoolClient = await pool.connect();
    await client.query('BEGIN');
    await client.query(`SELECT 1 FROM "${schemaName}"."${table}" WHERE ${where} FOR UPDATE`, params);
    const { rows } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    const release = async () => {
      if (!heldLocks.delete(release)) return;
      try {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    };
    heldLocks.add(release);
    return { pid: rows[0]!.pid, release };
  }

  /** Resolves with the pid of a backend blocked by `pid`, or null if `settled()` turns true first. */
  async function backendBlockedBy(pid: number, settled: () => boolean): Promise<number | null> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (settled()) return null;
      const { rows } = await pool.query<{ pid: number }>(
        `SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))`,
        [pid],
      );
      if (rows[0]) return rows[0].pid;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error(`nothing blocked on backend ${pid} within 10s`);
  }

  function track<T>(promise: Promise<T>) {
    const state = { settled: false };
    const tracked = promise.finally(() => {
      state.settled = true;
    });
    return { promise: tracked, settled: () => state.settled };
  }

  async function expectFenceConflict(write: Promise<unknown>) {
    const error = await write.then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(isRunFenceConflictError(error)).toBe(true);
  }

  const snapshot = (runId: string, value: Record<string, unknown>) =>
    ({
      runId,
      status: 'running',
      value,
      context: {},
      activePaths: [],
      activeStepsPath: {},
      serializedStepGraph: [],
      suspendedPaths: {},
      waitingPaths: {},
      resumeLabels: {},
      timestamp: Date.now(),
    }) as any;

  it('workflows: a forced claim waits for the in-flight write, and later writes are rejected', async () => {
    const workflowsA = (await storeA.getStore('workflows')) as WorkflowsStorage;
    const workflowsB = (await storeB.getStore('workflows')) as WorkflowsStorage;
    const workflowName = 'run-fence-race';
    const runId = randomUUID();

    const claimA = await workflowsA.claimRunOwnership({ runId, ownerId: 'a', leaseMs: LEASE_MS });
    expect(claimA.acquired).toBe(true);
    const fenceA: RunFence = { runId, generation: claimA.record!.generation, ownerId: 'a' };
    await workflowsA.persistWorkflowSnapshot({ workflowName, runId, snapshot: snapshot(runId, {}), fence: fenceA });

    // A passes its ownership check, then waits on the snapshot row.
    const snapshotLock = await lockRow('mastra_workflow_snapshot', 'workflow_name = $1 AND run_id = $2', [
      workflowName,
      runId,
    ]);
    const writeA = track(
      workflowsA.updateWorkflowResults({
        workflowName,
        runId,
        stepId: 'step-a',
        result: { status: 'success', output: 'from-a', payload: {}, startedAt: 1, endedAt: 2 } as any,
        requestContext: {},
        fence: fenceA,
      }),
    );
    const pidA = await backendBlockedBy(snapshotLock.pid, writeA.settled);
    expect(pidA).not.toBeNull();

    // B's takeover has to wait for A's transaction. B reads the run as soon as
    // its claim returns, so the read shows whether A committed first.
    const claimB = track(
      workflowsB
        .claimRunOwnership({ runId, ownerId: 'b', leaseMs: LEASE_MS, force: true })
        .then(async claimed => ({ claimed, loaded: await workflowsB.loadWorkflowSnapshot({ workflowName, runId }) })),
    );
    expect(await backendBlockedBy(pidA!, claimB.settled)).not.toBeNull();

    await snapshotLock.release();
    await writeA.promise;
    const { claimed, loaded } = await claimB.promise;
    expect(claimed).toMatchObject({ acquired: true, record: { generation: fenceA.generation + 1, ownerId: 'b' } });

    // A's write landed before the takeover; nothing from A lands after it.
    expect((loaded?.context as any)['step-a']?.output).toBe('from-a');
    await expectFenceConflict(
      workflowsA.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: snapshot(runId, { stale: true }),
        fence: fenceA,
      }),
    );
    expect((await workflowsB.loadWorkflowSnapshot({ workflowName, runId }))?.value).toEqual({});
  });

  it('memory: raising the fence waits for the in-flight write, and later writes are rejected', async () => {
    const memoryA = (await storeA.getStore('memory')) as MemoryStorage;
    const memoryB = (await storeB.getStore('memory')) as MemoryStorage;
    const runId = randomUUID();
    const threadId = randomUUID();
    const fenceA: RunFence = { runId, generation: 1, ownerId: 'a' };
    const fenceB: RunFence = { runId, generation: 2, ownerId: 'b' };

    expect(await memoryA.raiseRunFence(fenceA)).toBe(true);
    const now = new Date();
    await memoryA.saveThread({
      thread: { id: threadId, resourceId: 'resource', title: 'initial', metadata: {}, createdAt: now, updatedAt: now },
      fence: fenceA,
    });

    // A passes its fence check, then waits on the thread row.
    const threadLock = await lockRow('mastra_threads', 'id = $1', [threadId]);
    const writeA = track(memoryA.updateThread({ id: threadId, title: 'from-a', fence: fenceA }));
    const pidA = await backendBlockedBy(threadLock.pid, writeA.settled);
    expect(pidA).not.toBeNull();

    // B's fence raise has to wait for A's transaction. B reads the thread as
    // soon as its raise returns, so the read shows whether A committed first.
    const raiseB = track(
      memoryB
        .raiseRunFence(fenceB)
        .then(async raised => ({ raised, thread: await memoryB.getThreadById({ threadId }) })),
    );
    expect(await backendBlockedBy(pidA!, raiseB.settled)).not.toBeNull();

    await threadLock.release();
    await writeA.promise;
    const { raised, thread } = await raiseB.promise;
    expect(raised).toBe(true);

    // A's write landed before the raise; nothing from A lands after it.
    expect(thread?.title).toBe('from-a');
    await expectFenceConflict(memoryA.updateThread({ id: threadId, title: 'stale', fence: fenceA }));
    expect((await memoryB.getThreadById({ threadId }))?.title).toBe('from-a');
  });
});
