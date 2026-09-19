import { describe, expect, it } from 'vitest';
import type { WorkflowRunState } from '../../../workflows';
import { InMemoryStore } from '../../mock';

const snapshot = (runId: string, status: WorkflowRunState['status'], value: unknown = {}): WorkflowRunState =>
  ({
    runId,
    status,
    value,
    context: {},
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    serializedStepGraph: [],
    waitingPaths: {},
    timestamp: Date.now(),
  }) as WorkflowRunState;

describe('workflow snapshot handoff', () => {
  it('claims once, applies exact transitions, retains completion, and enumerates by cursor', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const input = {
      workflowName: 'handoff-workflow',
      runId: 'handoff-run',
      resourceId: 'resource-1',
      mutationFence: 'opaque-owner',
      snapshot: snapshot('handoff-run', 'waiting', { phase: 'claimed' }),
    };

    await expect(workflows.claimWorkflowSnapshotHandoff(input)).resolves.toMatchObject({ status: 'created' });
    await expect(workflows.claimWorkflowSnapshotHandoff(input)).resolves.toMatchObject({ status: 'existing' });

    const next = snapshot('handoff-run', 'waiting', { phase: 'transitioned' });
    await expect(
      workflows.transitionWorkflowSnapshotHandoff({
        ...input,
        expectedSnapshot: input.snapshot,
        expectedResourceId: input.resourceId,
        snapshot: next,
      }),
    ).resolves.toMatchObject({ status: 'transitioned', record: { status: 'pending' } });

    await expect(
      workflows.completeWorkflowSnapshotHandoff({
        ...input,
        expectedSnapshot: next,
        expectedResourceId: input.resourceId,
        snapshot: snapshot('handoff-run', 'success', { phase: 'completed' }),
      }),
    ).resolves.toMatchObject({ status: 'completed', record: { status: 'completed' } });
    await expect(
      workflows.completeWorkflowSnapshotHandoff({
        ...input,
        expectedSnapshot: next,
        expectedResourceId: input.resourceId,
        snapshot: next,
      }),
    ).resolves.toMatchObject({ status: 'already_completed' });

    await expect(workflows.listWorkflowSnapshotHandoffs({ status: 'completed', limit: 1 })).resolves.toMatchObject({
      hasMore: false,
      records: [{ workflowName: 'handoff-workflow', runId: 'handoff-run', status: 'completed' }],
    });
  });

  it('fences native writes while a handoff exists and keeps terminal execution status', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'fenced-workflow';
    const runId = 'fenced-run';
    const terminal = snapshot(runId, 'success', { native: true });
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: terminal });
    await workflows.claimWorkflowSnapshotHandoff({
      workflowName,
      runId,
      mutationFence: 'opaque-owner',
      snapshot: snapshot(runId, 'waiting', { product: true }),
    });

    await expect(
      workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: snapshot(runId, 'failed') }),
    ).rejects.toThrow('handoff fence');
    await expect(workflows.updateWorkflowState({ workflowName, runId, opts: { status: 'failed' } })).rejects.toThrow(
      'handoff fence',
    );
    await expect(workflows.deleteWorkflowRunById({ workflowName, runId })).rejects.toThrow('handoff fence');
    await expect(workflows.getWorkflowRunTerminalStatus({ workflowName, runId })).resolves.toEqual({
      status: 'terminal',
      terminalStatus: 'success',
    });
    await expect(workflows.loadWorkflowSnapshot({ workflowName, runId })).resolves.toMatchObject({ status: 'success' });
  });
});
