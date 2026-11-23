import { randomUUID } from 'node:crypto';

import { createClient } from '@libsql/client';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../storage';
import type { GuardedStartArgs, GuardedStartResult } from './fixtures/guarded-start-peer';
import { createXprocEnv, PEER_TIMEOUT_MS } from './peer-helper';
import type { XprocEnv } from './peer-helper';

const FIXTURE = new URL('./fixtures/guarded-start-peer.ts', import.meta.url);
// How long the test keeps the write lock once both workers are trying to start.
const LOCK_HOLD_MS = 300;
const PENDING = Symbol('pending');

// COR-1596: two worker processes that get the same next loop iteration (a broker
// redelivery, a reclaimed message) must not both run it. Only the database's write
// lock is shared between processes, so the guard check has to happen under it.
describe.skipIf(process.platform === 'win32').each([1, 2] as const)(
  'LibSQL guarded step start across processes (storage v%i)',
  storageVersion => {
    let env: XprocEnv;
    let storage: LibSQLStore;

    beforeEach(async () => {
      env = await createXprocEnv({ workers: false });
      storage = new LibSQLStore({ id: 'guarded-start-main', url: env.dbUrl });
      await storage.init();
    });

    afterEach(async () => {
      try {
        await env.cleanup();
      } finally {
        await storage.close();
      }
    });

    it(
      'lets one worker process start the next loop iteration and rejects the other without writing',
      async () => {
        const workflows = (await storage.getStore('workflows'))!;
        const workflowName = 'guarded-start-race';
        const runId = randomUUID();
        // The loop body's first iteration finished; the next one is expected to follow `first`.
        const finished: StepResult<any, any, any, any> = {
          status: 'success',
          payload: {},
          output: 1,
          startedAt: 1,
          endedAt: 2,
          metadata: { startedBy: 'first' },
        };
        const snapshot: WorkflowRunState = {
          runId,
          status: 'running',
          context: { step: finished },
          value: { n: 1 },
          activePaths: [],
          activeStepsPath: {},
          serializedStepGraph: [],
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        };
        if (storageVersion === 1) {
          await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot });
        } else {
          const { context, value, ...header } = snapshot;
          await workflows.writeWorkflowRunCheckpoint({ workflowName, runId, header, steps: context, state: value });
        }
        const load = () => workflows.loadWorkflowSnapshot({ workflowName, runId, storageVersion });
        // A storage v2 append moves the run's `lastSeq` on by its entry count; a rejected one leaves it.
        const lastSeq = async () => {
          const client = createClient({ url: env.dbUrl });
          try {
            const { rows } = await client.execute({
              sql: 'SELECT lastSeq FROM mastra_workflow_runs WHERE workflow_name = ? AND run_id = ?',
              args: [workflowName, runId],
            });
            return Number(rows[0]!.lastSeq);
          } finally {
            client.close();
          }
        };
        const before = (await load())!;
        const lastSeqBefore = storageVersion === 2 ? await lastSeq() : undefined;

        const eventIds = ['second-a', 'second-b'];
        const peers = await Promise.all(
          eventIds.map((eventId, index) =>
            env.spawnPeer(
              FIXTURE,
              {
                storageVersion,
                workflowName,
                runId,
                stepId: 'step',
                eventId,
                expectedStartedBy: 'first',
              } satisfies GuardedStartArgs,
              { role: `worker-${index + 1}`, workers: false },
            ),
          ),
        );
        await Promise.all(peers.map(peer => peer.waitFor('ready')));

        // Hold the write lock from a third connection, so both starts are waiting on it when it is released.
        const holder = createClient({ url: env.dbUrl });
        const lock = await holder.transaction('write');
        let results: GuardedStartResult[];
        try {
          for (const peer of peers) peer.send('go');
          await Promise.all(peers.map(peer => peer.waitFor('starting')));
          const outcomes = peers.map(peer => peer.result<GuardedStartResult>());
          let timer: NodeJS.Timeout | undefined;
          const held = new Promise<typeof PENDING>(
            resolve => (timer = setTimeout(() => resolve(PENDING), LOCK_HOLD_MS)),
          );
          // Neither start can finish while another connection holds the lock.
          expect(await Promise.race([...outcomes, held])).toBe(PENDING);
          clearTimeout(timer);
          await lock.commit();
          results = await Promise.all(outcomes);
        } finally {
          lock.close();
          holder.close();
        }

        expect(results.filter(result => result.won)).toHaveLength(1);
        expect(results.filter(result => !result.won)).toEqual([{ won: false, conflict: true, reason: 'stale' }]);
        const winner = eventIds[results.findIndex(result => result.won)];
        // The stored run holds the winner's start and request context, and nothing from the rejected delivery.
        expect(await load()).toEqual({
          ...before,
          requestContext: { startedBy: winner },
          context: {
            ...before.context,
            step: { status: 'running', startedAt: 1, payload: {}, metadata: { startedBy: winner } },
          },
        });
        // Only the winner's one-entry append landed.
        if (storageVersion === 2) expect(await lastSeq()).toBe(lastSeqBefore! + 1);
      },
      PEER_TIMEOUT_MS + 15_000,
    );
  },
);
