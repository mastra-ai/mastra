import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PostgresStore } from '../..';
import { Mastra } from '../../../../../../packages/core/src/mastra';
import type { WorkflowOptions } from '../../../../../../packages/core/src/workflows';
import {
  createStep,
  createWorkflow as createEventedWorkflow,
} from '../../../../../../packages/core/src/workflows/evented';
import { describeOccurrenceReplayCases } from '../../../../../../packages/core/src/workflows/evented/test-utils/occurrence-replay-cases';
import { RedeliveryDriver } from '../../../../../../packages/core/src/workflows/evented/test-utils/redelivery-driver';
import { connectionString, TEST_CONFIG } from '../../test-utils';

describe.each([1, 2] as const)('Postgres evented occurrence replay on storage v%i', storageVersion => {
  const schemaName = `evented_guard_v${storageVersion}_${Date.now()}`;
  const storage = new PostgresStore({ ...TEST_CONFIG, id: 'evented-guard', schemaName });
  const createWorkflow = ((params: Parameters<typeof createEventedWorkflow>[0]) => {
    const options: WorkflowOptions<any> = { ...params.options, storageVersion };
    return createEventedWorkflow({ ...params, options });
  }) as typeof createEventedWorkflow;
  beforeAll(async () => {
    await storage.init();
    expect((await storage.getStore('workflows'))!.supportsWorkflowStepGuards()).toBe(true);
  });
  // Checked here rather than in the shared cases, so it also runs when only this file's case is selected.
  afterAll(async () => {
    try {
      // A v2 run must never fall back to the v1 snapshot table.
      if (storageVersion === 2) {
        const { n } = await storage.db.one(`SELECT count(*)::int AS n FROM "${schemaName}".mastra_workflow_snapshot`);
        expect(n).toBe(0);
      }
    } finally {
      await storage.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await storage.close();
    }
  });

  it('keeps the committed terminal result when the read replica still sees a running step', async () => {
    const readPool = new Pool({ connectionString, max: 1 });
    const replicaStorage = new PostgresStore({ ...TEST_CONFIG, id: 'lagging-reader', schemaName, readPool });
    await replicaStorage.init();
    const staleStatus = async (runId: string) => {
      if (storageVersion === 1) {
        const { rows } = await readPool.query(
          `SELECT snapshot FROM "${schemaName}".mastra_workflow_snapshot WHERE run_id = $1`,
          [runId],
        );
        return rows[0].snapshot.status;
      }
      const { rows } = await readPool.query(
        `SELECT status FROM "${schemaName}".mastra_workflow_runs WHERE run_id = $1`,
        [runId],
      );
      return rows[0].status;
    };
    const driver = new RedeliveryDriver();
    const schema = z.object({ n: z.number() });
    const step = createStep({
      id: 'finish',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ runId }) => {
        // Keep a real PostgreSQL read view behind the primary's terminal commit.
        await readPool.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        expect(await staleStatus(runId)).toBe('running');
        return { n: 1 };
      },
    });
    // Storage v2 doesn't prune snapshots, so its terminal result keeps the step output.
    const workflow = createWorkflow({
      id: `replica-prune-${randomUUID()}`,
      inputSchema: schema,
      outputSchema: schema,
      options:
        storageVersion === 1
          ? {
              pruneSnapshot: ({ snapshot }) => ({
                ...snapshot,
                context: Object.fromEntries(
                  Object.entries(snapshot.context).map(([id, result]) => [
                    id,
                    result?.status === 'success' ? { ...result, output: {} } : result,
                  ]),
                ),
              }),
            }
          : undefined,
    })
      .then(step)
      .commit();
    const mastra = new Mastra({
      storage: replicaStorage,
      pubsub: driver.pubsub,
      workflows: { [workflow.id]: workflow },
    });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun({ resourceId: 'replica-owner' });
      expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'success', result: { n: 1 } });
      await expect
        .poll(() => driver.events.some(event => event.type === 'workflow.end' && event.runId === run.runId))
        .toBe(true);
      const end = driver.events.find(event => event.type === 'workflow.end' && event.runId === run.runId)!;
      await driver.redeliverEvent(end);
      const store = (await replicaStorage.getStore('workflows'))!;
      const completed = await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
      expect(completed).toMatchObject({
        status: 'success',
        result: { output: { n: 1 } },
        context: {
          finish: {
            output: storageVersion === 1 ? {} : { n: 1 },
            metadata: { __continuationStarted: true },
          },
        },
      });
      expect(await staleStatus(run.runId)).toBe('running');
      await readPool.query('ROLLBACK');
      expect(await store.getWorkflowRunById({ workflowName: workflow.id, runId: run.runId })).toMatchObject({
        resourceId: 'replica-owner',
      });
    } finally {
      await readPool.query('ROLLBACK');
      await mastra.stopWorkers();
      driver.dispose();
      await replicaStorage.close();
      await readPool.end();
    }
  }, 8_000);

  describeOccurrenceReplayCases({ getStorage: () => storage, storageVersion });
});
