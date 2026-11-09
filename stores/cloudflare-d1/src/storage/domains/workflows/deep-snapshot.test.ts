import { Miniflare } from 'miniflare';
import { afterAll, describe, expect, it } from 'vitest';

import { D1Store } from '../../index';

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

describe('listWorkflowRuns status filter with deeply nested snapshots', () => {
  const mf = new Miniflare({ modules: true, script: 'export default {};', d1Databases: { TEST_DB: ':memory:' } });
  afterAll(() => mf.dispose());

  it('skips snapshots SQLite cannot parse instead of failing the whole query', async () => {
    const binding = await mf.getD1Database('TEST_DB');
    const store = new D1Store({ id: 'deep-snapshot', binding: binding as any });
    await store.init();
    const workflows = (await store.getStore('workflows'))!;

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
