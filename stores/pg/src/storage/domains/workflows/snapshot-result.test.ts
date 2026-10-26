import { randomUUID } from 'node:crypto';
import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresStore } from '../../index';

const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';

// #28169: a successful run's `result` is the last step's output; the row stores it once.
describe('workflow completion snapshot result', () => {
  let store: PostgresStore;
  let workflows: any;
  const workflowName = `snapshot-result-${randomUUID()}`;

  beforeAll(async () => {
    store = new PostgresStore({ id: 'workflow-snapshot-result-store', connectionString });
    await store.init();
    workflows = await store.getStore('workflows');
  }, 60000);

  afterAll(async () => {
    await store?.close();
  });

  function successSnapshot(runId: string, output: unknown, result: unknown): WorkflowRunState {
    return {
      runId,
      status: 'success',
      result,
      value: {},
      context: {
        input: [0],
        item: { status: 'success', output, payload: [0], startedAt: 1, endedAt: 2 },
      },
      activePaths: [],
      activeStepsPath: {},
      serializedStepGraph: [],
      suspendedPaths: {},
      resumeLabels: {},
      waitingPaths: {},
      timestamp: 1,
    } as unknown as WorkflowRunState;
  }

  it('stores the output once and restores result on every read path', async () => {
    const runId = randomUUID();
    const output = Array.from({ length: 20 }, (_, i) => ({ i, blob: 'x'.repeat(10_000) }));
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: successSnapshot(runId, output, output) });

    const raw = await store.db.one<{ snapshot: string }>(
      `SELECT snapshot::text AS snapshot FROM ${TABLE_WORKFLOW_SNAPSHOT} WHERE run_id = $1`,
      [runId],
    );
    const outputBytes = Buffer.byteLength(JSON.stringify(output), 'utf8');
    expect(Buffer.byteLength(raw.snapshot, 'utf8')).toBeLessThan(outputBytes * 1.2);
    expect(JSON.parse(raw.snapshot)).not.toHaveProperty('result');
    expect(JSON.parse(raw.snapshot).resultFromStep).toBe('item');

    const loaded = await workflows.loadWorkflowSnapshot({ workflowName, runId });
    expect(loaded.result).toEqual(output);
    expect(loaded).not.toHaveProperty('resultFromStep');
    const byId = await workflows.getWorkflowRunById({ runId, workflowName });
    expect(byId.snapshot.result).toEqual(output);
    const listed = await workflows.listWorkflowRuns({ workflowName });
    expect(listed.runs.find((run: any) => run.runId === runId).snapshot.result).toEqual(output);
  });

  it('reads rows written with an inline result unchanged', async () => {
    const runId = randomUUID();
    const legacy = successSnapshot(runId, [{ i: 0 }], [{ i: 0 }]);
    await store.db.none(
      `INSERT INTO ${TABLE_WORKFLOW_SNAPSHOT} (workflow_name, run_id, snapshot, "createdAt", "updatedAt") VALUES ($1, $2, $3::jsonb, NOW(), NOW())`,
      [workflowName, runId, JSON.stringify(legacy)],
    );

    expect(await workflows.loadWorkflowSnapshot({ workflowName, runId })).toEqual(legacy);
    const byId = await workflows.getWorkflowRunById({ runId, workflowName });
    expect(byId.snapshot).toEqual(legacy);
  });
});
