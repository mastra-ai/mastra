import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { WorkflowsStorageDO } from './index';

const snapshot = (runId: string, result: unknown) =>
  ({
    runId,
    status: 'running',
    value: {},
    context: {},
    serializedStepGraph: [],
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    waitingPaths: {},
    timestamp: Date.now(),
    result,
  }) as any;

describe('WorkflowsStorageDO listWorkflowRuns status filter with deeply nested snapshots', () => {
  it('skips snapshots SQLite cannot parse instead of failing the whole query', async () => {
    const db = new DatabaseSync(':memory:');
    const sql = {
      exec: (query: string, ...params: any[]) => {
        const rows = db.prepare(query).all(...params);
        return { toArray: () => rows };
      },
    };
    const workflows = new WorkflowsStorageDO({ sql: sql as never });
    await workflows.init();

    let deep: unknown = 1;
    for (let i = 0; i < 1100; i++) deep = [deep];

    await workflows.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'shallow',
      snapshot: snapshot('shallow', { ok: true }),
    });
    await workflows.persistWorkflowSnapshot({ workflowName: 'wf', runId: 'deep', snapshot: snapshot('deep', deep) });

    const all = await workflows.listWorkflowRuns({ workflowName: 'wf' });
    expect(all.runs.map(r => r.runId).sort()).toEqual(['deep', 'shallow']);

    const filtered = await workflows.listWorkflowRuns({ workflowName: 'wf', status: 'running', page: 0, perPage: 10 });
    expect(filtered.runs.map(r => r.runId)).toEqual(['shallow']);
    expect(filtered.total).toBe(1);
  });
});
