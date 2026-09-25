import { randomUUID } from 'node:crypto';
import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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

  it('lists bounded run summaries without selecting snapshot payloads', async () => {
    const client = store.db;
    const originalManyOrNone = client.manyOrNone.bind(client);
    const queries: string[] = [];
    const spy = vi.spyOn(client, 'manyOrNone').mockImplementation(((query: string, values: unknown[]) => {
      queries.push(query);
      return originalManyOrNone(query, values);
    }) as typeof client.manyOrNone);
    try {
      const result = await workflows.listWorkflowRunSummaries({ workflowName, status: 'failed', page: 0, perPage: 2 });
      expect(result.total).toBe(25);
      expect(result.runs).toHaveLength(2);
      expect(result.runs[0]).toMatchObject({ workflowName, status: 'failed' });
      expect(typeof result.runs[0].timestamp).toBe('number');
      expect(result.runs[0].createdAt).toBeInstanceOf(Date);
      expect(result.runs[0]).not.toHaveProperty('snapshot');
      expect(JSON.stringify(result)).not.toContain('serializedStepGraph');
      expect(queries.some(query => /SELECT workflow_name, run_id/.test(query) && !/SELECT \*/.test(query))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('omits invalid summary status and missing or non-numeric timestamps from legacy JSONB rows', async () => {
    const malformedName = `summary-legacy-${randomUUID()}`;
    const insert = async (snapshot: object) => {
      const runId = randomUUID();
      await store.db.none(
        `INSERT INTO ${TABLE_WORKFLOW_SNAPSHOT} (workflow_name, run_id, snapshot, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [malformedName, runId, snapshot],
      );
      return runId;
    };
    const valid = await insert({ status: 'success', timestamp: 123 });
    const missing = await insert({ status: 'bogus' });
    const text = await insert({ status: 'waiting', timestamp: '456' });

    const { runs, total } = await workflows.listWorkflowRunSummaries({ workflowName: malformedName });
    expect(total).toBe(3);
    const byId = new Map(runs.map((run: any) => [run.runId, run]));
    expect(byId.get(valid)).toMatchObject({ status: 'success', timestamp: 123 });
    expect(byId.get(missing).status).toBeUndefined();
    expect(byId.get(missing).timestamp).toBeUndefined();
    expect(byId.get(text).status).toBe('waiting');
    expect(byId.get(text).timestamp).toBeUndefined();
  });

  it('persists a snapshot with a real backslash before an unpaired surrogate without losing literal escapes', async () => {
    const runId = randomUUID();
    const note = { path: 'C:\\path\\\uD800-end', literal: String.raw`literal\uD800`, nullPath: 'C:\\path\\\0-end' };

    await expect(store.db.query('SELECT $1::jsonb', [JSON.stringify(note)])).rejects.toThrow();

    await workflows.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot: {
        status: 'running',
        value: note,
        context: {},
        activePaths: [],
        serializedStepGraph: [],
        suspendedPaths: {},
        waitingPaths: {},
        runId,
        timestamp: Date.now(),
      } as any,
    });

    const saved = await store.db.one<{ snapshot: { value: typeof note } }>(
      `SELECT snapshot FROM ${TABLE_WORKFLOW_SNAPSHOT} WHERE workflow_name = $1 AND run_id = $2`,
      [workflowName, runId],
    );
    expect(saved.snapshot.value).toEqual({
      path: 'C:\\path\\�-end',
      literal: note.literal,
      nullPath: 'C:\\path\\-end',
    });
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
