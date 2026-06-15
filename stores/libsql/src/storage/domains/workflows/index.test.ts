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
