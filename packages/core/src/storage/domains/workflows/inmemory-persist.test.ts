import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('returns compact execution state without loading the full snapshot', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'compact-execution-state';
    const runId = 'run-compact-state';

    await workflows.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot: {
        ...makeSnapshot(runId, 'running'),
        executionGeneration: 'wfeg:compact-state',
        value: { large: 'x'.repeat(10_000) },
      },
    });
    const load = vi.spyOn(workflows, 'loadWorkflowSnapshot');

    await expect(workflows.getWorkflowExecutionState({ workflowName, runId })).resolves.toEqual({
      status: 'running',
      executionGeneration: 'wfeg:compact-state',
    });
    expect(load).not.toHaveBeenCalled();
    await expect(workflows.getWorkflowExecutionState({ workflowName, runId: 'missing-run' })).resolves.toBeNull();
  });

  it('atomically replaces both terminal state views with a storage-clock timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-12T15:00:00.000Z'));
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'terminal-final-state';
    const runId = 'run-final-state';
    const snapshot = makeSnapshot(runId, 'running');
    snapshot.context.__state = { stale: true } as never;
    snapshot.value = { stale: true };
    snapshot.timestamp = 1;
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot });

    const finalState = { exact: { answer: 42 } };
    await workflows.updateWorkflowState({
      workflowName,
      runId,
      opts: { status: 'success', finalState },
    });
    finalState.exact.answer = 0;

    await expect(workflows.loadWorkflowSnapshot({ workflowName, runId })).resolves.toMatchObject({
      status: 'success',
      context: { __state: { exact: { answer: 42 } } },
      value: { exact: { answer: 42 } },
      timestamp: Date.now(),
    });
  });

  it('preserves status when applying a metadata-only state patch', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'metadata-only-patch';
    const runId = 'run-suspended';
    await workflows.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot: makeSnapshot(runId, 'suspended'),
    });

    await workflows.updateWorkflowState({
      workflowName,
      runId,
      opts: {
        executionGeneration: 'wfeg:test',
        lifecycleResumeAttempt: 1,
        lifecycleStepStates: {
          step: { stepCallId: 'wfsc:test', stepAttempt: 2 },
        },
      },
    });

    await expect(workflows.loadWorkflowSnapshot({ workflowName, runId })).resolves.toMatchObject({
      status: 'suspended',
      executionGeneration: 'wfeg:test',
      lifecycleResumeAttempt: 1,
      lifecycleStepStates: {
        step: { stepCallId: 'wfsc:test', stepAttempt: 2 },
      },
    });
  });
});
