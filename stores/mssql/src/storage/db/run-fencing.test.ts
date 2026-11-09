import { randomUUID } from 'node:crypto';
import type { MemoryStorage, RunFence, WorkflowsStorage } from '@mastra/core/storage';
import { isRunFenceConflictError } from '@mastra/core/storage';
import sql from 'mssql';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MSSQLStore } from '../index';

const TEST_CONFIG = {
  server: process.env.MSSQL_HOST || 'localhost',
  port: Number(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DB || 'master',
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || 'Your_password123',
};

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

/**
 * A fenced write checks ownership and writes in one transaction. These tests
 * stop a write between those two steps and take the run over meanwhile: the
 * takeover must wait for the in-flight write, and every write after it must be
 * rejected. Two stores with their own pools stand in for two processes.
 */
describe.runIf(process.env.ENABLE_TESTS === 'true')('MSSQL run fencing: a takeover racing an in-flight write', () => {
  const LEASE_MS = 30_000;
  // Own schema, so other test files clearing the shared tables never queue behind these locks.
  const SCHEMA = 'run_fence_race';
  const heldLocks = new Set<() => Promise<void>>();
  let storeA: MSSQLStore;
  let storeB: MSSQLStore;
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    pool = new sql.ConnectionPool({ ...TEST_CONFIG, options: { encrypt: true, trustServerCertificate: true } });
    await pool.connect();
    storeA = new MSSQLStore({ ...TEST_CONFIG, id: 'run-fence-a', schemaName: SCHEMA });
    storeB = new MSSQLStore({ ...TEST_CONFIG, id: 'run-fence-b', schemaName: SCHEMA });
    await storeA.init();
    await storeB.init();
  });

  // A failed assertion must not leave a lock behind for the next test to hang on.
  afterEach(async () => {
    await Promise.all([...heldLocks].map(release => release()));
  });

  afterAll(async () => {
    await Promise.all([storeA, storeB].map(store => store?.close().catch(() => {})));
    await pool?.close().catch(() => {});
  });

  /**
   * Holds an update lock on a row on a separate connection until `release` is
   * called. Update locks still let plain reads through, so a write blocks on
   * the row only when it writes it or reads it for update.
   */
  async function lockRow(table: string, where: string, params: Record<string, unknown>) {
    const transaction = pool.transaction();
    await transaction.begin();
    const request = transaction.request();
    for (const [name, value] of Object.entries(params)) request.input(name, value);
    await request.query(`SELECT 1 FROM [${SCHEMA}].[${table}] WITH (UPDLOCK, HOLDLOCK, ROWLOCK) WHERE ${where}`);
    const session = await transaction.request().query<{ id: number }>('SELECT @@SPID AS id');
    const release = async () => {
      if (!heldLocks.delete(release)) return;
      await transaction.rollback();
    };
    heldLocks.add(release);
    return { id: session.recordset[0]!.id, release };
  }

  /** Resolves with the id of a session blocked by `id`, or null if `settled()` turns true first. */
  async function sessionBlockedBy(id: number, settled: () => boolean): Promise<number | null> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (settled()) return null;
      const result = await pool
        .request()
        .input('id', id)
        .query<{ id: number }>('SELECT session_id AS id FROM sys.dm_exec_requests WHERE blocking_session_id = @id');
      if (result.recordset[0]) return result.recordset[0].id;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error(`nothing blocked on session ${id} within 10s`);
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
    const snapshotLock = await lockRow(
      'mastra_workflow_snapshot',
      'workflow_name = @workflowName AND run_id = @runId',
      {
        workflowName,
        runId,
      },
    );
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
    const idA = await sessionBlockedBy(snapshotLock.id, writeA.settled);
    expect(idA).not.toBeNull();

    // B's takeover has to wait for A's transaction. B reads the run as soon as
    // its claim returns, so the read shows whether A committed first.
    const claimB = track(
      workflowsB
        .claimRunOwnership({ runId, ownerId: 'b', leaseMs: LEASE_MS, force: true })
        .then(async claimed => ({ claimed, loaded: await workflowsB.loadWorkflowSnapshot({ workflowName, runId }) })),
    );
    expect(await sessionBlockedBy(idA!, claimB.settled)).not.toBeNull();

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
    const threadLock = await lockRow('mastra_threads', 'id = @threadId', { threadId });
    const writeA = track(memoryA.updateThread({ id: threadId, title: 'from-a', fence: fenceA }));
    const idA = await sessionBlockedBy(threadLock.id, writeA.settled);
    expect(idA).not.toBeNull();

    // B's fence raise has to wait for A's transaction. B reads the thread as
    // soon as its raise returns, so the read shows whether A committed first.
    const raiseB = track(
      memoryB
        .raiseRunFence(fenceB)
        .then(async raised => ({ raised, thread: await memoryB.getThreadById({ threadId }) })),
    );
    expect(await sessionBlockedBy(idA!, raiseB.settled)).not.toBeNull();

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
