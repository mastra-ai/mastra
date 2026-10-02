import { randomUUID } from 'node:crypto';
import type { MemoryStorage, RunFence, WorkflowsStorage } from '@mastra/core/storage';
import { isRunFenceConflictError } from '@mastra/core/storage';
import { createPool } from 'mysql2/promise';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MySQLStore } from '../index';
import type { MySQLStoreConfig } from '../index';

const TEST_CONFIG: MySQLStoreConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'mastra',
  password: process.env.MYSQL_PASSWORD || 'mastra',
  database: process.env.MYSQL_DB || 'mastra',
  max: 5,
};

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

/**
 * A fenced write checks ownership and writes in one transaction. These tests
 * stop a write between those two steps and take the run over meanwhile: the
 * takeover must wait for the in-flight write, and every write after it must be
 * rejected. Two stores with their own pools stand in for two processes.
 */
describe('MySQL run fencing: a takeover racing an in-flight write', () => {
  const LEASE_MS = 30_000;
  let storeA: MySQLStore;
  let storeB: MySQLStore;
  let pool: Pool;
  // Lock waits are only visible with server-wide privileges.
  let monitor: Pool;

  beforeAll(async () => {
    pool = createPool({
      host: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      user: TEST_CONFIG.user,
      password: TEST_CONFIG.password,
      database: TEST_CONFIG.database,
      connectionLimit: 2,
    });
    monitor = createPool({
      host: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      user: 'root',
      password: process.env.MYSQL_ROOT_PASSWORD || 'root',
      connectionLimit: 1,
    });
    storeA = new MySQLStore({ ...TEST_CONFIG, id: 'run-fence-a' });
    storeB = new MySQLStore({ ...TEST_CONFIG, id: 'run-fence-b' });
    await storeA.init();
    await storeB.init();
  });

  afterAll(async () => {
    await Promise.all([storeA, storeB].map(store => store?.close().catch(() => {})));
    await Promise.all([pool, monitor].map(p => p?.end().catch(() => {})));
  });

  /** Holds a row lock on a separate connection until `release` is called. */
  async function lockRow(table: string, where: string, params: unknown[]) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.execute(`SELECT 1 FROM \`${table}\` WHERE ${where} FOR UPDATE`, params);
    const [rows] = await connection.query<RowDataPacket[]>('SELECT CONNECTION_ID() AS id');
    return {
      id: Number(rows[0]!.id),
      release: async () => {
        await connection.rollback();
        connection.release();
      },
    };
  }

  /** Resolves with the id of a connection blocked by `id`, or null if `settled()` turns true first. */
  async function connectionBlockedBy(id: number, settled: () => boolean): Promise<number | null> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (settled()) return null;
      const [rows] = await monitor.query<RowDataPacket[]>(
        `SELECT waiting.PROCESSLIST_ID AS id
         FROM performance_schema.data_lock_waits w
         JOIN performance_schema.threads waiting ON waiting.THREAD_ID = w.REQUESTING_THREAD_ID
         JOIN performance_schema.threads blocking ON blocking.THREAD_ID = w.BLOCKING_THREAD_ID
         WHERE blocking.PROCESSLIST_ID = ?`,
        [id],
      );
      if (rows[0]) return Number(rows[0].id);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error(`nothing blocked on connection ${id} within 10s`);
  }

  function track<T>(promise: Promise<T>, label: string, order: string[]) {
    const state = { settled: false };
    const tracked = promise.finally(() => {
      state.settled = true;
      order.push(label);
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
    const snapshotLock = await lockRow('mastra_workflow_snapshot', 'workflow_name = ? AND run_id = ?', [
      workflowName,
      runId,
    ]);
    const order: string[] = [];
    const writeA = track(
      workflowsA.updateWorkflowResults({
        workflowName,
        runId,
        stepId: 'step-a',
        result: { status: 'success', output: 'from-a', payload: {}, startedAt: 1, endedAt: 2 } as any,
        requestContext: {},
        fence: fenceA,
      }),
      'write-a',
      order,
    );
    const idA = await connectionBlockedBy(snapshotLock.id, writeA.settled);
    expect(idA).not.toBeNull();

    // B's takeover has to wait for A's transaction.
    const claimB = track(
      workflowsB.claimRunOwnership({ runId, ownerId: 'b', leaseMs: LEASE_MS, force: true }),
      'claim-b',
      order,
    );
    expect(await connectionBlockedBy(idA!, claimB.settled)).not.toBeNull();

    await snapshotLock.release();
    await writeA.promise;
    const claimedB = await claimB.promise;
    expect(order).toEqual(['write-a', 'claim-b']);
    expect(claimedB).toMatchObject({ acquired: true, record: { generation: fenceA.generation + 1, ownerId: 'b' } });

    // A's write landed before the takeover; nothing from A lands after it.
    const loaded = await workflowsB.loadWorkflowSnapshot({ workflowName, runId });
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
    const threadLock = await lockRow('mastra_threads', 'id = ?', [threadId]);
    const order: string[] = [];
    const writeA = track(memoryA.updateThread({ id: threadId, title: 'from-a', fence: fenceA }), 'write-a', order);
    const idA = await connectionBlockedBy(threadLock.id, writeA.settled);
    expect(idA).not.toBeNull();

    // B's fence raise has to wait for A's transaction.
    const raiseB = track(memoryB.raiseRunFence(fenceB), 'raise-b', order);
    expect(await connectionBlockedBy(idA!, raiseB.settled)).not.toBeNull();

    await threadLock.release();
    await writeA.promise;
    expect(await raiseB.promise).toBe(true);
    expect(order).toEqual(['write-a', 'raise-b']);

    // A's write landed before the raise; nothing from A lands after it.
    expect((await memoryB.getThreadById({ threadId }))?.title).toBe('from-a');
    await expectFenceConflict(memoryA.updateThread({ id: threadId, title: 'stale', fence: fenceA }));
    expect((await memoryB.getThreadById({ threadId }))?.title).toBe('from-a');
  });
});
