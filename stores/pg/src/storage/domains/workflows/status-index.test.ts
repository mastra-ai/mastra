import { randomUUID } from 'node:crypto';
import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresStore } from '../../index';

const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';

describe('workflow snapshot status index', () => {
  let store: PostgresStore;
  let workflows: any;
  const workflowName = `status-index-${randomUUID()}`;

  beforeAll(async () => {
    store = new PostgresStore({ id: 'workflow-status-index-store', connectionString });
    await store.init();
    workflows = await store.getStore('workflows');

    for (let i = 0; i < 50; i++) {
      await workflows.persistWorkflowSnapshot({
        workflowName,
        runId: randomUUID(),
        snapshot: {
          status: i % 2 === 0 ? 'success' : 'failed',
          value: {},
          context: {},
          activePaths: [],
          serializedStepGraph: [],
          suspendedPaths: {},
          waitingPaths: {},
          runId: randomUUID(),
          timestamp: Date.now(),
        } as any,
      });
    }
  }, 60000);

  afterAll(async () => {
    await store?.close();
  });

  it('creates the expression index on (workflow_name, snapshot->>status, createdAt DESC)', async () => {
    const rows = await store.db.manyOrNone<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = $1 AND indexname = $2`,
      [TABLE_WORKFLOW_SNAPSHOT, 'mastra_workflow_snapshot_name_status_createdat_idx'],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.indexdef).toContain(`'status'`);
  });

  it('lets the planner use the index for the status predicate', async () => {
    const plan = await store.db.tx(async (t: any) => {
      await t.none('SET LOCAL enable_seqscan = off');
      return t.manyOrNone<{ 'QUERY PLAN': string }>(
        `EXPLAIN SELECT * FROM ${TABLE_WORKFLOW_SNAPSHOT} WHERE workflow_name = $1 AND snapshot ->> 'status' = $2 ORDER BY "createdAt" DESC`,
        [workflowName, 'failed'],
      );
    });

    const planText = plan.map(row => row['QUERY PLAN']).join('\n');
    expect(planText).toContain('mastra_workflow_snapshot_name_status_createdat_idx');
  });

  it('filters by status without the sanitizing regexp on jsonb columns', async () => {
    const runs = await workflows.listWorkflowRuns({ workflowName, status: 'failed' });

    expect(runs.total).toBe(25);
    expect(runs.runs.every(run => (run.snapshot as any).status === 'failed')).toBe(true);
  });

  it('still filters correctly when snapshots contain Unicode escape sequences', async () => {
    const runId = randomUUID();
    await workflows.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot: {
        status: 'suspended',
        value: { note: 'null \u0000 char and surrogate \ud800' },
        context: {},
        activePaths: [],
        serializedStepGraph: [],
        suspendedPaths: {},
        waitingPaths: {},
        runId,
        timestamp: Date.now(),
      } as any,
    });

    const runs = await workflows.listWorkflowRuns({ workflowName, status: 'suspended' });

    expect(runs.total).toBe(1);
    expect(runs.runs[0]!.runId).toBe(runId);
  });
});
