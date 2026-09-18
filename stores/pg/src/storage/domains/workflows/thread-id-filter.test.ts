import { randomUUID } from 'node:crypto';
import { createSampleSuspendedSnapshotWithThread } from '@internal/storage-test-utils';
import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresStore } from '../../index';
import { connectionString } from '../../test-utils';
import { WORKFLOW_SNAPSHOT_THREAD_ID_EXPR } from './index';

describe('workflow snapshot threadId filter (jsonb)', () => {
  let store: PostgresStore;
  let workflows: any;
  const workflowName = `thread-filter-${randomUUID()}`;
  let agenticRunIdA: string;
  let durableRunIdA: string;

  beforeAll(async () => {
    store = new PostgresStore({ id: 'workflow-thread-filter-store', connectionString });
    await store.init();
    workflows = await store.getStore('workflows');

    const agenticA = createSampleSuspendedSnapshotWithThread({ threadId: 'thread-a', layout: 'agentic-loop' });
    agenticRunIdA = agenticA.runId;
    const durableA = createSampleSuspendedSnapshotWithThread({ threadId: 'thread-a', layout: 'durable' });
    durableRunIdA = durableA.runId;
    const agenticB = createSampleSuspendedSnapshotWithThread({ threadId: 'thread-b', layout: 'agentic-loop' });
    const durableB = createSampleSuspendedSnapshotWithThread({ threadId: 'thread-b', layout: 'durable' });

    for (const { snapshot, runId } of [agenticA, durableA, agenticB, durableB]) {
      await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot });
    }
  }, 60000);

  afterAll(async () => {
    await store?.close();
  });

  it('creates the threadId expression index', async () => {
    const rows = await store.db.manyOrNone<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = $1 AND indexname = $2`,
      [TABLE_WORKFLOW_SNAPSHOT, 'mastra_workflow_snapshot_threadid_idx'],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.indexdef).toContain('jsonb_path_query_first');
  });

  it('lets the planner use the index for the threadId predicate', async () => {
    const plan: Array<{ 'QUERY PLAN': string }> = await store.db.tx(async (t: any) => {
      await t.none('SET LOCAL enable_seqscan = off');
      return t.manyOrNone(
        `EXPLAIN SELECT * FROM ${TABLE_WORKFLOW_SNAPSHOT} WHERE ${WORKFLOW_SNAPSHOT_THREAD_ID_EXPR} = $1`,
        ['thread-a'],
      );
    });

    const planText = plan.map(row => row['QUERY PLAN']).join('\n');
    expect(planText).toContain('mastra_workflow_snapshot_threadid_idx');
  });

  it('returns only runs matching the threadId, across both snapshot layouts', async () => {
    const { runs } = await workflows.listWorkflowRuns({ workflowName, threadId: 'thread-a' });

    expect(runs.map((run: { runId: string }) => run.runId).sort()).toEqual([agenticRunIdA, durableRunIdA].sort());
  });

  it('returns no runs for an unknown threadId', async () => {
    const { runs } = await workflows.listWorkflowRuns({ workflowName, threadId: 'thread-nope' });
    expect(runs).toHaveLength(0);
  });

  it('ignores memory info attached to non-suspended steps, matching the canonical extraction', async () => {
    // getSnapshotMemoryInfo (@mastra/core) only reads __streamState from steps whose
    // status is 'suspended'; the SQL predicate must not match more than that.
    const runId = `running-step-${randomUUID()}`;
    const snapshot = {
      runId,
      status: 'running',
      value: {},
      context: {
        'some-step': {
          status: 'running',
          payload: {},
          suspendPayload: { __streamState: { messageList: { memoryInfo: { threadId: 'thread-a' } } } },
        },
        input: {},
      },
      activePaths: [],
      serializedStepGraph: [],
      suspendedPaths: {},
      waitingPaths: {},
      timestamp: Date.now(),
    } as unknown as WorkflowRunState;
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot });

    const { runs } = await workflows.listWorkflowRuns({ workflowName, threadId: 'thread-a' });
    expect(runs.map((run: { runId: string }) => run.runId)).not.toContain(runId);
    expect(runs).toHaveLength(2);
  });
});

describe('workflow snapshot threadId filter (legacy text snapshot column)', () => {
  const testSchema = `thread_filter_legacy_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const workflowName = 'legacy-thread-workflow';
  let adminPool: Pool;
  let legacyStore: PostgresStore;
  let workflows: any;
  let legacyRunId: string;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString });
    const client = await adminPool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${testSchema}`);
      // Old-style table whose snapshot column is TEXT, simulating a database that
      // predates the jsonb migration.
      await client.query(`
        CREATE TABLE ${testSchema}.${TABLE_WORKFLOW_SNAPSHOT} (
          "workflow_name" TEXT NOT NULL,
          "run_id" TEXT NOT NULL,
          "resourceId" TEXT,
          "snapshot" TEXT NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          PRIMARY KEY ("workflow_name", "run_id")
        )
      `);

      const { snapshot, runId } = createSampleSuspendedSnapshotWithThread({
        threadId: 'thread-a',
        layout: 'agentic-loop',
      });
      legacyRunId = runId;
      await client.query(
        `INSERT INTO ${testSchema}.${TABLE_WORKFLOW_SNAPSHOT} ("workflow_name", "run_id", "snapshot") VALUES ($1, $2, $3)`,
        [workflowName, runId, JSON.stringify(snapshot)],
      );
    } finally {
      client.release();
    }

    legacyStore = new PostgresStore({
      id: 'workflow-thread-filter-legacy-store',
      connectionString,
      schemaName: testSchema,
    });
    await legacyStore.init();
    workflows = await legacyStore.getStore('workflows');
  }, 60000);

  afterAll(async () => {
    await legacyStore?.close();
    const client = await adminPool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
    } finally {
      client.release();
      await adminPool.end();
    }
  }, 30000);

  it('skips the threadId filter without erroring and returns a superset', async () => {
    // The jsonb expression cannot run against a text column, so the filter is
    // skipped entirely: even a non-matching threadId still returns every row and
    // the caller (Agent.listSuspendedRuns) re-verifies in-process.
    const { runs } = await workflows.listWorkflowRuns({ workflowName, threadId: 'thread-that-does-not-match' });
    expect(runs.map((run: { runId: string }) => run.runId)).toContain(legacyRunId);
  });
});
