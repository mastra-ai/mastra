import { createSampleSuspendedSnapshotWithThread } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import { TABLE_WORKFLOW_SNAPSHOT, TABLE_SCHEMAS } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { beforeEach, describe, expect, it } from 'vitest';

import { LibSQLDB } from '../../db';
import { WorkflowsLibSQL } from './index';

describe('WorkflowsLibSQL — snapshot serialization', () => {
  let workflows: WorkflowsLibSQL;

  beforeEach(async () => {
    const client = createClient({ url: ':memory:' });
    const db = new LibSQLDB({ client, maxRetries: 1, initialBackoffMs: 10 });
    await db.createTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
    });
    workflows = new WorkflowsLibSQL({ client });
  });

  // Regression test: the default workflow executor builds the success snapshot
  // with `snapshot.result` pointing at the same object as `context[step].output`.
  // safeStringify previously dropped the second visit of any shared reference,
  // silently stripping `snapshot.result` from every persisted run. listWorkflowRuns
  // and getWorkflowRunById then returned snapshots without `result`.
  it('preserves shared references between snapshot.result and context[step].output', async () => {
    const sharedOutput = { result: 3 };

    const snapshot = {
      runId: 'shared-ref-run',
      status: 'success',
      result: sharedOutput,
      value: {},
      context: {
        input: { a: 1, b: 2 },
        'add-numbers': {
          status: 'success',
          output: sharedOutput,
          startedAt: 1,
          endedAt: 2,
          payload: { a: 1, b: 2 },
        },
      },
      activePaths: [],
      serializedStepGraph: [],
      suspendedPaths: {},
      waitingPaths: {},
      timestamp: Date.now(),
    } as unknown as WorkflowRunState;

    await workflows.persistWorkflowSnapshot({
      workflowName: 'add-workflow',
      runId: 'shared-ref-run',
      snapshot,
    });

    const loaded = await workflows.loadWorkflowSnapshot({
      workflowName: 'add-workflow',
      runId: 'shared-ref-run',
    });

    expect(loaded).not.toBeNull();
    expect(loaded!.status).toBe('success');
    expect(loaded!.result).toEqual({ result: 3 });

    const byId = await workflows.getWorkflowRunById({
      runId: 'shared-ref-run',
      workflowName: 'add-workflow',
    });
    expect(byId).not.toBeNull();
    const byIdSnapshot = byId!.snapshot as WorkflowRunState;
    expect(byIdSnapshot.result).toEqual({ result: 3 });

    const listed = await workflows.listWorkflowRuns({ workflowName: 'add-workflow' });
    expect(listed.runs).toHaveLength(1);
    const listedSnapshot = listed.runs[0]!.snapshot as WorkflowRunState;
    expect(listedSnapshot.result).toEqual({ result: 3 });
    expect((listedSnapshot.context as any)['add-numbers'].output).toEqual({ result: 3 });
  });
});

describe('WorkflowsLibSQL — threadId filter pushdown', () => {
  let workflows: WorkflowsLibSQL;
  const workflowName = 'thread-filter-workflow';
  let agenticRunIdA: string;
  let durableRunIdA: string;

  beforeEach(async () => {
    const client = createClient({ url: ':memory:' });
    const db = new LibSQLDB({ client, maxRetries: 1, initialBackoffMs: 10 });
    await db.createTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
    });
    workflows = new WorkflowsLibSQL({ client });

    const agenticA = createSampleSuspendedSnapshotWithThread({ threadId: 'thread-a', layout: 'agentic-loop' });
    agenticRunIdA = agenticA.runId;
    const durableA = createSampleSuspendedSnapshotWithThread({ threadId: 'thread-a', layout: 'durable' });
    durableRunIdA = durableA.runId;
    const agenticB = createSampleSuspendedSnapshotWithThread({ threadId: 'thread-b', layout: 'agentic-loop' });
    const durableB = createSampleSuspendedSnapshotWithThread({ threadId: 'thread-b', layout: 'durable' });

    for (const { snapshot, runId } of [agenticA, durableA, agenticB, durableB]) {
      await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot });
    }
  });

  it('returns only runs matching the threadId, across both snapshot layouts', async () => {
    const { runs } = await workflows.listWorkflowRuns({ workflowName, threadId: 'thread-a' });

    expect(runs.map(run => run.runId).sort()).toEqual([agenticRunIdA, durableRunIdA].sort());
  });

  it('returns no runs for an unknown threadId', async () => {
    const { runs } = await workflows.listWorkflowRuns({ workflowName, threadId: 'thread-nope' });
    expect(runs).toHaveLength(0);
  });

  it('ignores memory info attached to non-suspended steps, matching the canonical extraction', async () => {
    // The canonical extraction (getSnapshotMemoryInfo) only reads __streamState from
    // steps whose status is 'suspended'; the SQL predicate must not match more than that.
    const runId = 'running-step-run';
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
    expect(runs.map(run => run.runId)).not.toContain(runId);
    expect(runs).toHaveLength(2);
  });
});

describe('WorkflowsLibSQL — updateWorkflowState', () => {
  let workflows: WorkflowsLibSQL;

  beforeEach(async () => {
    const client = createClient({ url: ':memory:' });
    const db = new LibSQLDB({ client, maxRetries: 1, initialBackoffMs: 10 });
    await db.createTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
    });
    workflows = new WorkflowsLibSQL({ client });
  });

  it('advances updatedAt when the snapshot state changes', async () => {
    const workflowName = 'wf';
    const runId = 'state-run';
    const createdAt = new Date('2026-01-01T00:00:00.000Z');

    await workflows.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot: { status: 'suspended', context: {} } as unknown as WorkflowRunState,
      createdAt,
      updatedAt: createdAt,
    });

    await workflows.updateWorkflowState({ workflowName, runId, opts: { status: 'running' } as any });

    const run = await workflows.getWorkflowRunById({ workflowName, runId });
    expect(run?.createdAt.toISOString()).toBe(createdAt.toISOString());
    expect(run!.updatedAt.getTime()).toBeGreaterThan(createdAt.getTime());
  });
});

// #28169: a successful run's `result` is the last step's output; the row stores it once.
describe('WorkflowsLibSQL — completion snapshot result', () => {
  let client: ReturnType<typeof createClient>;
  let workflows: WorkflowsLibSQL;
  const workflowName = 'result-workflow';

  beforeEach(async () => {
    client = createClient({ url: ':memory:' });
    const db = new LibSQLDB({ client, maxRetries: 1, initialBackoffMs: 10 });
    await db.createTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
    });
    workflows = new WorkflowsLibSQL({ client });
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

  async function rawSnapshot(runId: string) {
    const row = await client.execute({
      sql: `SELECT json(snapshot) as snapshot FROM ${TABLE_WORKFLOW_SNAPSHOT} WHERE run_id = ?`,
      args: [runId],
    });
    return row.rows[0]!.snapshot as string;
  }

  it('stores the output once and restores result on every read path', async () => {
    const output = Array.from({ length: 20 }, (_, i) => ({ i, blob: 'x'.repeat(10_000) }));
    await workflows.persistWorkflowSnapshot({
      workflowName,
      runId: 'new-run',
      snapshot: successSnapshot('new-run', output, output),
    });

    const raw = await rawSnapshot('new-run');
    const outputBytes = Buffer.byteLength(JSON.stringify(output), 'utf8');
    expect(Buffer.byteLength(raw, 'utf8')).toBeLessThan(outputBytes * 1.2);
    expect(JSON.parse(raw)).not.toHaveProperty('result');
    expect(JSON.parse(raw).resultFromStep).toBe('item');

    const loaded = await workflows.loadWorkflowSnapshot({ workflowName, runId: 'new-run' });
    expect(loaded?.result).toEqual(output);
    expect(loaded).not.toHaveProperty('resultFromStep');
    const byId = await workflows.getWorkflowRunById({ runId: 'new-run', workflowName });
    expect((byId!.snapshot as WorkflowRunState).result).toEqual(output);
    const listed = await workflows.listWorkflowRuns({ workflowName });
    expect((listed.runs[0]!.snapshot as WorkflowRunState).result).toEqual(output);
  });

  it('reads rows written with an inline result unchanged', async () => {
    const legacy = successSnapshot('legacy-run', [{ i: 0 }], [{ i: 0 }]);
    const now = new Date().toISOString();
    await client.execute({
      sql: `INSERT INTO ${TABLE_WORKFLOW_SNAPSHOT} (workflow_name, run_id, snapshot, createdAt, updatedAt) VALUES (?, ?, jsonb(?), ?, ?)`,
      args: [workflowName, 'legacy-run', JSON.stringify(legacy), now, now],
    });

    expect(await workflows.loadWorkflowSnapshot({ workflowName, runId: 'legacy-run' })).toEqual(legacy);
    const byId = await workflows.getWorkflowRunById({ runId: 'legacy-run', workflowName });
    expect(byId!.snapshot).toEqual(legacy);
  });
});
