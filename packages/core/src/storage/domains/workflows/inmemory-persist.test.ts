import { describe, expect, it } from 'vitest';
import type { WorkflowRunState } from '../../../workflows';
import { InMemoryStore } from '../../mock';

const makeSnapshot = (runId: string, status: WorkflowRunState['status']): WorkflowRunState =>
  ({
    runId,
    status,
    value: {},
    context: {},
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    serializedStepGraph: [],
    waitingPaths: {},
    timestamp: Date.now(),
  }) as WorkflowRunState;

describe('WorkflowsInMemory persistWorkflowSnapshot', () => {
  // Regression test for https://github.com/mastra-ai/mastra/issues/18003
  // The reference in-memory store previously reset createdAt on every re-persist, so the
  // canonical semantics disagreed with the persistent stores. Re-persisting an existing run
  // must preserve the original createdAt and only advance updatedAt.
  it('preserves createdAt and advances updatedAt when re-persisting a run (issue #18003)', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'wf';
    const runId = 'run-1';

    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: makeSnapshot(runId, 'running') });
    const first = await workflows.getWorkflowRunById({ runId, workflowName });
    expect(first).not.toBeNull();
    const createdAtBefore = new Date(first!.createdAt).getTime();

    await new Promise(resolve => setTimeout(resolve, 50));
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: makeSnapshot(runId, 'success') });
    const second = await workflows.getWorkflowRunById({ runId, workflowName });
    expect(second).not.toBeNull();

    expect(new Date(second!.createdAt).getTime()).toBe(createdAtBefore);
    expect(new Date(second!.updatedAt).getTime()).toBeGreaterThan(createdAtBefore);
  });
});

describe('WorkflowsInMemory guarded snapshot writes', () => {
  it('rejects a write whose expectedStatus does not match the persisted status', async () => {
    const workflows = (await new InMemoryStore().getStore('workflows'))!;
    const workflowName = 'wf';
    const runId = 'run-guarded';

    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: makeSnapshot(runId, 'canceled') });
    const written = await workflows.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot: makeSnapshot(runId, 'success'),
      expectedStatus: ['running', 'success'],
    });

    expect(written).toBe(false);
    expect(await workflows.loadWorkflowRunStatus({ workflowName, runId })).toBe('canceled');
  });

  it('inserts a new run regardless of expectedStatus', async () => {
    const workflows = (await new InMemoryStore().getStore('workflows'))!;

    const written = await workflows.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'run-new',
      snapshot: makeSnapshot('run-new', 'running'),
      expectedStatus: ['running'],
    });

    expect(written).toBe(true);
    expect(await workflows.loadWorkflowRunStatus({ workflowName: 'wf', runId: 'run-new' })).toBe('running');
    expect(await workflows.loadWorkflowRunStatus({ workflowName: 'wf', runId: 'missing' })).toBeNull();
  });
});
