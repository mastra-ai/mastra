import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';
import type { MemoryStorage, RunFence, WorkflowsStorage } from '@mastra/core/storage';
import { isRunFenceConflictError } from '@mastra/core/storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetConnectionsAfterBusy } from '../../shared/reset-after-busy-client';
import { LibSQLStore } from '../index';
import type { SqliteClient, SqliteTransaction } from './client';
import { isLockError } from './utils';

/**
 * A client that counts statements refused because the database is locked,
 * and can stop the next fenced write right after its fence check.
 *
 * It wraps its connections the way a store-owned local client is wrapped, so a
 * refused statement doesn't leave its pooled connection unable to commit.
 */
function instrumentedClient(url: string, busyTimeoutMs: number) {
  const inner = resetConnectionsAfterBusy(createClient({ url, timeout: busyTimeoutMs })) as unknown as SqliteClient;
  let pause: { reached: () => void; released: Promise<void> } | undefined;
  let lockedOut = 0;
  const refused = (error: unknown) => {
    if (isLockError(error)) lockedOut++;
  };

  const client: SqliteClient = {
    execute: statement => inner.execute(statement),
    batch: (statements, mode) => inner.batch(statements, mode),
    async transaction(mode) {
      let tx: SqliteTransaction;
      try {
        tx = await inner.transaction(mode);
      } catch (error) {
        refused(error);
        throw error;
      }
      let fenceChecked = false;
      return {
        async execute(statement) {
          if (fenceChecked && pause) {
            const { reached, released } = pause;
            pause = undefined;
            reached();
            await released;
          }
          const result = await tx.execute(statement).catch((error: unknown) => {
            refused(error);
            throw error;
          });
          fenceChecked = typeof statement !== 'string' && statement.sql.startsWith('SELECT generation, ownerId FROM');
          return result;
        },
        commit: () => tx.commit(),
        rollback: () => tx.rollback(),
        close: () => tx.close(),
        get closed() {
          return tx.closed;
        },
      };
    },
    close: () => inner.close(),
    get closed() {
      return inner.closed;
    },
    get protocol() {
      return inner.protocol;
    },
  };

  return {
    client,
    lockedOut: () => lockedOut,
    /** Stops the next fenced write after its fence check; resolves once it has stopped there. */
    pauseAfterNextFenceCheck() {
      let release!: () => void;
      const released = new Promise<void>(resolve => (release = resolve));
      const reached = new Promise<void>(resolve => (pause = { reached: resolve, released }));
      return { reached, release };
    },
  };
}

/**
 * A fenced write checks ownership and writes in one transaction. These tests
 * stop a write between those two steps and take the run over meanwhile: the
 * takeover must wait for the in-flight write, and every write after it must be
 * rejected. Two stores with their own connections to one database file stand
 * in for two processes. B's busy timeout is kept short, so its wait shows up as
 * lock retries rather than a synchronous busy wait that would stall the test.
 */
describe('LibSQL run fencing: a takeover racing an in-flight write', () => {
  const LEASE_MS = 30_000;
  let tmpDir: string;
  let a: ReturnType<typeof instrumentedClient>;
  let b: ReturnType<typeof instrumentedClient>;
  let storeA: LibSQLStore;
  let storeB: LibSQLStore;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-run-fencing-'));
    const url = `file:${path.join(tmpDir, 'run-fencing.db')}`;
    a = instrumentedClient(url, 5_000);
    b = instrumentedClient(url, 1);
    await a.client.execute('PRAGMA journal_mode=WAL');
    storeA = new LibSQLStore({ id: 'run-fence-a', client: a.client });
    storeB = new LibSQLStore({ id: 'run-fence-b', client: b.client, initialBackoffMs: 10, maxRetries: 20 });
    await storeA.init();
    await storeB.init();
  });

  afterAll(async () => {
    await Promise.all([storeA, storeB].map(store => store?.close().catch(() => {})));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function track<T>(promise: Promise<T>, label: string, order: string[]) {
    const state = { settled: false };
    const tracked = promise.finally(() => {
      state.settled = true;
      order.push(label);
    });
    return { promise: tracked, settled: () => state.settled };
  }

  /** Resolves true once B has been locked out of a write, or false if `settled()` turns true first. */
  async function bLockedOut(settled: () => boolean): Promise<boolean> {
    const before = b.lockedOut();
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      if (b.lockedOut() > before) return true;
      if (settled()) return false;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('B was neither locked out nor done within 2s');
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

    // A passes its ownership check, then stops before writing.
    const pause = a.pauseAfterNextFenceCheck();
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
    await pause.reached;

    // B's takeover has to wait for A's transaction.
    const claimB = track(
      workflowsB.claimRunOwnership({ runId, ownerId: 'b', leaseMs: LEASE_MS, force: true }),
      'claim-b',
      order,
    );
    expect(await bLockedOut(claimB.settled)).toBe(true);

    pause.release();
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

    // A passes its fence check, then stops before writing.
    const pause = a.pauseAfterNextFenceCheck();
    const order: string[] = [];
    const writeA = track(memoryA.updateThread({ id: threadId, title: 'from-a', fence: fenceA }), 'write-a', order);
    await pause.reached;

    // B's fence raise has to wait for A's transaction.
    const raiseB = track(memoryB.raiseRunFence(fenceB), 'raise-b', order);
    expect(await bLockedOut(raiseB.settled)).toBe(true);

    pause.release();
    await writeA.promise;
    expect(await raiseB.promise).toBe(true);
    expect(order).toEqual(['write-a', 'raise-b']);

    // A's write landed before the raise; nothing from A lands after it.
    expect((await memoryB.getThreadById({ threadId }))?.title).toBe('from-a');
    await expectFenceConflict(memoryA.updateThread({ id: threadId, title: 'stale', fence: fenceA }));
    expect((await memoryB.getThreadById({ threadId }))?.title).toBe('from-a');
  });
});
