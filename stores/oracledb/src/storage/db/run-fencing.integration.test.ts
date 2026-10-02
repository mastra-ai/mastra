import { randomUUID } from 'node:crypto';
import type { MemoryStorage, RunFence, WorkflowsStorage } from '@mastra/core/storage';
import {
  isRunFenceConflictError,
  TABLE_MEMORY_RUN_FENCES,
  TABLE_THREADS,
  TABLE_WORKFLOW_RUN_OWNERS,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import oracledb from 'oracledb';
import type { Connection } from 'oracledb';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { isOracleErrorCode } from '../../shared/connection';
import { qualifyName } from '../../vector/identifiers';
import { OracleStore } from '../index';

const connection = {
  user: process.env.ORACLE_DATABASE_USER ?? 'mastra_test',
  password: process.env.ORACLE_DATABASE_PASSWORD ?? 'mastra_test_password',
  connectString: process.env.ORACLE_DATABASE_CONNECT_STRING ?? 'localhost:1521/FREEPDB1',
};

const ORA_RESOURCE_BUSY = -54;

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

/**
 * A fenced write checks ownership and writes in one transaction. These tests
 * stop a write between those two steps and take the run over meanwhile: the
 * takeover must wait for the in-flight write, and every write after it must be
 * rejected. Two stores with their own pools stand in for two processes.
 *
 * The test user cannot read v$session, so instead of asking Oracle who blocks
 * whom, the tests see the in-flight write holding the claim row (a NOWAIT probe
 * fails with ORA-00054) and the takeover still pending while it does.
 */
describe.runIf(process.env.RUN_ORACLE_STORAGE_INTEGRATION === 'true')(
  'Oracle run fencing: a takeover racing an in-flight write',
  () => {
    const LEASE_MS = 30_000;
    // Long enough for an unblocked claim to finish many times over.
    const STILL_WAITING_MS = 1_000;
    const heldLocks = new Set<() => Promise<void>>();
    let storeA: OracleStore;
    let storeB: OracleStore;
    let probe: Connection;

    beforeAll(async () => {
      storeA = new OracleStore({ id: 'run-fence-a', ...connection, skipDefaultIndexes: true });
      storeB = new OracleStore({ id: 'run-fence-b', ...connection, skipDefaultIndexes: true });
      await storeA.init();
      await storeB.init();
      probe = await oracledb.getConnection(connection);
    });

    // A failed assertion must not leave a lock behind for the next test to hang on.
    afterEach(async () => {
      await Promise.all([...heldLocks].map(release => release()));
    });

    afterAll(async () => {
      await probe?.close().catch(() => {});
      await Promise.all([storeA, storeB].map(store => store?.close().catch(() => {})));
    });

    /** Holds a row lock on a separate connection until `release` is called. */
    async function lockRow(table: string, where: string, binds: Record<string, string>) {
      const holder = await oracledb.getConnection(connection);
      await holder.execute(`SELECT 1 FROM ${qualifyName(table)} WHERE ${where} FOR UPDATE`, binds);
      const release = async () => {
        if (!heldLocks.delete(release)) return;
        await holder.rollback();
        await holder.close();
      };
      heldLocks.add(release);
      return release;
    }

    /**
     * Resolves true once another session holds the run's claim row, or false if
     * `settled()` turns true first. A probe that gets the lock lets go at once.
     */
    async function claimRowHeld(table: string, runId: string, settled: () => boolean): Promise<boolean> {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        if (settled()) return false;
        try {
          await probe.execute(`SELECT 1 FROM ${qualifyName(table)} WHERE "runId" = :runId FOR UPDATE NOWAIT`, {
            runId,
          });
          await probe.rollback();
        } catch (error) {
          if (isOracleErrorCode(error, [ORA_RESOURCE_BUSY])) return true;
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw new Error(`nothing locked the claim row of run ${runId} within 10s`);
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
      const releaseSnapshot = await lockRow(
        TABLE_WORKFLOW_SNAPSHOT,
        'workflow_name = :workflowName AND run_id = :runId',
        {
          workflowName,
          runId,
        },
      );
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
      expect(await claimRowHeld(TABLE_WORKFLOW_RUN_OWNERS, runId, writeA.settled)).toBe(true);

      // B's takeover has to wait for A's transaction.
      const claimB = track(
        workflowsB.claimRunOwnership({ runId, ownerId: 'b', leaseMs: LEASE_MS, force: true }),
        'claim-b',
        order,
      );
      await new Promise(resolve => setTimeout(resolve, STILL_WAITING_MS));
      expect(claimB.settled()).toBe(false);
      expect(writeA.settled()).toBe(false);

      await releaseSnapshot();
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
        thread: {
          id: threadId,
          resourceId: 'resource',
          title: 'initial',
          metadata: {},
          createdAt: now,
          updatedAt: now,
        },
        fence: fenceA,
      });

      // A passes its fence check, then waits on the thread row.
      const releaseThread = await lockRow(TABLE_THREADS, 'id = :threadId', { threadId });
      const order: string[] = [];
      const writeA = track(memoryA.updateThread({ id: threadId, title: 'from-a', fence: fenceA }), 'write-a', order);
      expect(await claimRowHeld(TABLE_MEMORY_RUN_FENCES, runId, writeA.settled)).toBe(true);

      // B's fence raise has to wait for A's transaction.
      const raiseB = track(memoryB.raiseRunFence(fenceB), 'raise-b', order);
      await new Promise(resolve => setTimeout(resolve, STILL_WAITING_MS));
      expect(raiseB.settled()).toBe(false);
      expect(writeA.settled()).toBe(false);

      await releaseThread();
      await writeA.promise;
      expect(await raiseB.promise).toBe(true);
      expect(order).toEqual(['write-a', 'raise-b']);

      // A's write landed before the raise; nothing from A lands after it.
      expect((await memoryB.getThreadById({ threadId }))?.title).toBe('from-a');
      await expectFenceConflict(memoryA.updateThread({ id: threadId, title: 'stale', fence: fenceA }));
      expect((await memoryB.getThreadById({ threadId }))?.title).toBe('from-a');
    });
  },
);
