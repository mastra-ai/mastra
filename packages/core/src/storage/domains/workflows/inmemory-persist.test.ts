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
