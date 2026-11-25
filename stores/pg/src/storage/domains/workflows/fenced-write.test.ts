import { AsyncLocalStorage } from 'node:async_hooks';
import { MastraError } from '@mastra/core/error';
import { isRunFenceConflictError, setRunFenceContext, TABLE_WORKFLOW_RUN_OWNERS } from '@mastra/core/storage';
import type { RunFence, RunFenceScope, WorkflowRunHeader, WorkflowsStorage } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

const LEASE_MS = 15_000;
const workflowName = 'wf-fenced-write';

const snapshot = (runId: string, value: unknown) =>
  ({ runId, status: 'running', value, context: {}, activePaths: [], timestamp: 1 }) as unknown as WorkflowRunState;

const header = (runId: string) =>
  ({
    runId,
    status: 'running',
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    serializedStepGraph: [],
    waitingPaths: {},
    timestamp: 1,
  }) as unknown as WorkflowRunHeader;

/**
 * Makes the pool's connection go silent right after the first statement that reads the run owners
 * table: later statements on it are never sent. To the server this is a client cut by a half-open
 * partition, or one whose event loop stalled, which nothing on localhost can produce directly.
 */
function cutAfterFenceCheck(pool: pg.Pool) {
  let cut: pg.PoolClient | undefined;
  let closed = false;
  const stalled: Array<(error: Error) => void> = [];
  let checked!: () => void;
  const fenceChecked = new Promise<void>(resolve => (checked = resolve));
  pool.on('connect', client => {
    const query = client.query.bind(client) as (...args: unknown[]) => unknown;
    (client as { query: unknown }).query = (...args: unknown[]) => {
      if (client === cut) {
        if (closed) return Promise.reject(new Error('connection cut'));
        return new Promise((_, reject) => stalled.push(reject));
      }
      const text = typeof args[0] === 'string' ? args[0] : (args[0] as { text?: string } | undefined)?.text;
      if (cut || !text?.includes(TABLE_WORKFLOW_RUN_OWNERS)) return query(...args);
      cut = client as pg.PoolClient;
      const callback = typeof args.at(-1) === 'function' ? (args.pop() as (...a: unknown[]) => void) : undefined;
      const result = query(...args) as Promise<unknown>;
      result.then(checked, checked);
      if (!callback) return result;
      result.then(
        res => callback(null, res),
        error => callback(error),
      );
      return undefined;
    };
  });
  return {
    fenceChecked,
    /** Fails the statements the cut connection held back, so a transaction stuck on it lets go of it. */
    close: () => {
      closed = true;
      for (const reject of stalled) reject(new Error('connection cut'));
    },
  };
}

describe('Postgres single-statement fenced writes', () => {
  const schemaName = `fenced_write_${Date.now()}`;
  let claimerStore: PostgresStore;
  let claimer: WorkflowsStorage;

  beforeAll(async () => {
    claimerStore = new PostgresStore({ ...TEST_CONFIG, id: 'fenced-write-claimer', schemaName });
    await claimerStore.init();
    claimer = (await claimerStore.getStore('workflows'))!;
  });

  afterAll(async () => {
    try {
      await claimerStore.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } finally {
      await claimerStore.close();
    }
  });

  const claim = async (runId: string, ownerId: string): Promise<RunFence> => {
    const { record } = await claimer.claimRunOwnership({ runId, ownerId, leaseMs: LEASE_MS, force: true });
    return { runId, ownerId, generation: record!.generation };
  };

  // The default engine's main writes: v1 snapshot saves and v2 header appends.
  const writes = [
    {
      name: 'snapshot save (storage v1)',
      write: (store: WorkflowsStorage, fence: RunFence) =>
        store.persistWorkflowSnapshot({
          workflowName,
          runId: fence.runId,
          snapshot: snapshot(fence.runId, 'a'),
          fence,
        }),
    },
    {
      name: 'run append (storage v2)',
      write: (store: WorkflowsStorage, fence: RunFence) =>
        store.appendWorkflowRunEntries({
          workflowName,
          runId: fence.runId,
          header: header(fence.runId),
          steps: {},
          fence,
        }),
    },
  ];

  // A takeover's claim updates the owner row the fenced write checked. If the check held a lock on
  // that row past its own statement, a cut writer would block the takeover until the server noticed
  // the dead connection, which with default keepalive settings can take hours.
  it.each(writes)(
    'a takeover is not held up by a $name whose client is cut after the fence check',
    async ({ write }) => {
      const runId = `run-${crypto.randomUUID()}`;
      const fence = await claim(runId, 'owner-a');
      const pool = new pg.Pool({ ...(TEST_CONFIG as pg.PoolConfig), max: 2 });
      const connection = cutAfterFenceCheck(pool);
      const writerStore = new PostgresStore({ id: 'fenced-write-writer', pool, schemaName });
      try {
        await writerStore.init();
        const writer = (await writerStore.getStore('workflows'))!;
        const writing = write(writer, fence).then(
          result => ({ result }),
          (error: unknown) => ({ error }),
        );
        await connection.fenceChecked;

        let timer: ReturnType<typeof setTimeout> | undefined;
        const takeover = await Promise.race([
          claimer.claimRunOwnership({ runId, ownerId: 'owner-b', leaseMs: LEASE_MS, force: true }),
          new Promise<'blocked'>(resolve => (timer = setTimeout(() => resolve('blocked'), LEASE_MS / 10))),
        ]);
        clearTimeout(timer);
        expect(takeover).toMatchObject({ acquired: true, record: { ownerId: 'owner-b' } });
        // The silenced connection still returns the fenced statement's own result, so the write
        // landed before the takeover rather than failing ahead of it.
        expect(await writing).toEqual({ result: expect.anything() });
      } finally {
        await connection.close();
        await pool.end();
      }
    },
  );

  // Each round races one fenced save against one forced claim. A save may win or lose, but a save
  // that reports success must be visible to the first read after the claim returns; otherwise it
  // committed after the takeover and overwrote what the new owner may already have read.
  it('a fenced snapshot save racing a takeover lands before it or not at all', async () => {
    const writerStore = new PostgresStore({ ...TEST_CONFIG, id: 'fenced-write-racer', schemaName });
    try {
      await writerStore.init();
      const writer = (await writerStore.getStore('workflows'))!;
      // A large snapshot makes the write's statement long enough to overlap the claim.
      const padding = 'x'.repeat(256 * 1024);
      const runId = `run-${crypto.randomUUID()}`;
      let fence = await claim(runId, 'owner-0');
      const storedRound = async () =>
        ((await claimer.loadWorkflowSnapshot({ workflowName, runId })) as { value?: { round: number } } | null)?.value
          ?.round;
      let accepted: number | undefined;
      for (let round = 1; round <= 400; round++) {
        const save = writer
          .persistWorkflowSnapshot({ workflowName, runId, snapshot: snapshot(runId, { round, padding }), fence })
          .then(
            () => true,
            error => {
              if (isRunFenceConflictError(error)) return false;
              throw error;
            },
          );
        // Spread the claim's start over the save's flight, so rounds land on every interleaving.
        await new Promise(resolve => setTimeout(resolve, round % 4));
        const next = await claim(runId, `owner-${round}`);
        const seen = await storedRound();
        if (await save) {
          accepted = round;
          expect(seen).toBe(round);
        } else {
          // A refused save wrote nothing, also after it settled.
          expect(await storedRound()).toBe(accepted);
        }
        fence = next;
      }
    } finally {
      await writerStore.close();
    }
  }, 60_000);

  // A writer that lost the run must learn so even when its value can't be serialized, as when the
  // fence was checked before serializing. A current writer gets the store's own error.
  it('a draft that cannot be serialized reports a stale fence first, and writes nothing', async () => {
    const runId = `run-${crypto.randomUUID()}`;
    await claimer.appendWorkflowRunEntries({ workflowName, runId, header: header(runId), steps: {} });
    const stale = await claim(runId, 'owner-a');
    const current = await claim(runId, 'owner-b');
    const stored = await claimer.loadWorkflowRunHeader({ workflowName, runId });
    const scopes = new AsyncLocalStorage<RunFenceScope | undefined>();
    const context = setRunFenceContext({ current: () => scopes.getStore(), run: (s, f) => scopes.run(s, f) });
    const draft = (fence: RunFence) =>
      context.run({ fenceFor: () => fence }, () =>
        claimer.appendWorkflowRunStateDraft({
          workflowName,
          runId,
          state: {
            value: {
              toJSON() {
                throw new Error('cannot serialize');
              },
            },
          },
        }),
      );

    await expect(draft(stale)).rejects.toSatisfy(isRunFenceConflictError);
    await expect(draft(current)).rejects.toSatisfy(
      error => error instanceof MastraError && !isRunFenceConflictError(error),
    );
    expect((await claimer.loadWorkflowRunHeader({ workflowName, runId }))!.lastSeq).toBe(stored!.lastSeq);
  });
});
