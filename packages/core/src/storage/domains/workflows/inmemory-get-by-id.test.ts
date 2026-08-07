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

describe('WorkflowsInMemory getWorkflowRunById', () => {
  it('finds a run by runId when workflowName is omitted', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;

    await workflows.persistWorkflowSnapshot({
      workflowName: 'wf-A',
      runId: 'run-1',
      snapshot: makeSnapshot('run-1', 'running'),
    });

    // workflowName is optional in the storage contract; the pg/libsql adapters
    // match by runId alone when it is omitted. The in-memory store must match.
    const run = await workflows.getWorkflowRunById({ runId: 'run-1' });

    expect(run).not.toBeNull();
    expect(run!.runId).toBe('run-1');
    expect(run!.workflowName).toBe('wf-A');
  });

  it('still filters by workflowName when one is provided', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;

    await workflows.persistWorkflowSnapshot({
      workflowName: 'wf-A',
      runId: 'run-1',
      snapshot: makeSnapshot('run-1', 'running'),
    });

    expect(await workflows.getWorkflowRunById({ runId: 'run-1', workflowName: 'wf-A' })).not.toBeNull();
    expect(await workflows.getWorkflowRunById({ runId: 'run-1', workflowName: 'wf-other' })).toBeNull();
  });

  it('returns null for an unknown runId', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;

    expect(await workflows.getWorkflowRunById({ runId: 'missing' })).toBeNull();
  });
});
