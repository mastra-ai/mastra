import { describe, expect, it, vi } from 'vitest';
import { getErrorFromUnknown } from '../../../error';
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
      expectedCanonical: { kind: 'absent' as const },
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

    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    try {
      await workflows.claimWorkflowSnapshotHandoff({
        workflowName: 'a',
        runId: 'ordered-run',
        expectedCanonical: { kind: 'absent' },
        snapshot: snapshot('ordered-run', 'waiting'),
        mutationFence: 'a-owner',
      });
      await workflows.claimWorkflowSnapshotHandoff({
        workflowName: 'B',
        runId: 'ordered-run',
        expectedCanonical: { kind: 'absent' },
        snapshot: snapshot('ordered-run', 'waiting'),
        mutationFence: 'B-owner',
      });
    } finally {
      clock.mockRestore();
    }
    const firstPage = await workflows.listWorkflowSnapshotHandoffs({ status: 'pending', limit: 1 });
    expect(firstPage.records.map(record => record.workflowName)).toEqual(['B']);
    const secondPage = await workflows.listWorkflowSnapshotHandoffs({
      status: 'pending',
      limit: 1,
      after: firstPage.nextCursor,
    });
    expect(secondPage.records.map(record => record.workflowName)).toEqual(['a']);
  });

  it('fences native writes while a handoff exists and keeps terminal execution status', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'fenced-workflow';
    const runId = 'fenced-run';
    const terminal = snapshot(runId, 'success', { native: true });
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: terminal });
    const nativeFirstWorkflow = 'native-first-workflow';
    const nativeFirstRun = 'native-first-run';
    const nativeFirst = snapshot(nativeFirstRun, 'success', { native: true });
    await workflows.persistWorkflowSnapshot({
      workflowName: nativeFirstWorkflow,
      runId: nativeFirstRun,
      snapshot: nativeFirst,
    });
    const competingClaim = await workflows.claimWorkflowSnapshotHandoff({
      workflowName: nativeFirstWorkflow,
      runId: nativeFirstRun,
      expectedCanonical: { kind: 'absent' },
      snapshot: snapshot(nativeFirstRun, 'waiting'),
      mutationFence: 'native-first-owner',
    });
    expect(competingClaim).toMatchObject({
      status: 'conflict',
      observedCanonical: { kind: 'present', snapshot: { status: 'success' } },
    });
    await workflows.claimWorkflowSnapshotHandoff({
      workflowName,
      runId,
      expectedCanonical: { kind: 'present', snapshot: terminal },
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

  it('compares serializable errors using the persisted JSON representation', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const runId = 'serializable-error-run';
    const handoffSnapshot = snapshot(runId, 'failed', {
      error: getErrorFromUnknown(new Error('step failed'), { serializeStack: false }),
    });
    const input = {
      workflowName: 'serializable-error-workflow',
      runId,
      expectedCanonical: { kind: 'absent' as const },
      snapshot: handoffSnapshot,
      mutationFence: 'opaque-owner',
    };

    await expect(workflows.claimWorkflowSnapshotHandoff(input)).resolves.toMatchObject({ status: 'created' });
    await expect(workflows.claimWorkflowSnapshotHandoff(input)).resolves.toMatchObject({ status: 'existing' });
    await expect(
      workflows.completeWorkflowSnapshotHandoff({
        ...input,
        expectedSnapshot: handoffSnapshot,
        snapshot: snapshot(runId, 'success'),
      }),
    ).resolves.toMatchObject({ status: 'completed' });

    const bareErrorInput = {
      ...input,
      workflowName: 'bare-error-workflow',
      runId: 'bare-error-run',
      snapshot: snapshot('bare-error-run', 'failed', { error: new Error('plain error') }),
    };
    await expect(workflows.claimWorkflowSnapshotHandoff(bareErrorInput)).resolves.toMatchObject({ status: 'created' });
    await expect(workflows.claimWorkflowSnapshotHandoff(bareErrorInput)).resolves.toMatchObject({ status: 'existing' });
  });
});
