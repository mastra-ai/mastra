import { describe, expect, it, vi } from 'vitest';
import { getErrorFromUnknown } from '../../../error';
import type { WorkflowRunState, WorkflowTerminalRecoveryAncestryV1 } from '../../../workflows';
import { createWorkflowTerminalGraphFingerprint } from '../../../workflows/terminal-continuation';
import { InMemoryStore } from '../../mock';
import { createEmptyWorkflowSnapshot } from '../../workflow-snapshot';

const NESTED_PARENT_GRAPH: WorkflowRunState['serializedStepGraph'] = [
  { type: 'step', step: { id: 'nested', component: 'WORKFLOW' } },
];

function nestedAncestry(
  child: { workflowName: string; runId: string },
  parent: { workflowName: string; runId: string },
): WorkflowTerminalRecoveryAncestryV1 {
  return [
    {
      version: 1,
      childWorkflowName: child.workflowName,
      childRunId: child.runId,
      parentWorkflowName: parent.workflowName,
      parentRunId: parent.runId,
      parentGraphFingerprint: createWorkflowTerminalGraphFingerprint(NESTED_PARENT_GRAPH),
      source: { kind: 'step', stepId: 'nested', executionPath: [0] },
      inputPointer: { kind: 'parent-source-payload', stepId: 'nested' },
      resultPointer: { kind: 'retained-terminal-result', workflowName: child.workflowName, runId: child.runId },
      resumeMetadata: { wasResume: false, resumeSteps: [] },
    },
  ];
}

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

    const presentWorkflowName = 'present-error-workflow';
    const presentRunId = 'present-error-run';
    const presentCanonical = snapshot(presentRunId, 'failed', { error: new Error('present error') });
    await workflows.persistWorkflowSnapshot({
      workflowName: presentWorkflowName,
      runId: presentRunId,
      snapshot: presentCanonical,
    });
    const presentInput = {
      workflowName: presentWorkflowName,
      runId: presentRunId,
      expectedCanonical: { kind: 'present' as const, snapshot: presentCanonical },
      snapshot: snapshot(presentRunId, 'waiting'),
      mutationFence: 'present-owner',
    };
    await expect(workflows.claimWorkflowSnapshotHandoff(presentInput)).resolves.toMatchObject({ status: 'created' });
    await expect(workflows.claimWorkflowSnapshotHandoff(presentInput)).resolves.toMatchObject({ status: 'existing' });

    const unsafeWorkflowName = 'unsafe-json-workflow';
    const unsafeRunId = 'unsafe-json-run';
    const unsafeCanonical = snapshot(unsafeRunId, 'waiting', {
      payload: `a${String.fromCharCode(0)}b${String.fromCharCode(0xd800)}`,
    });
    await workflows.persistWorkflowSnapshot({
      workflowName: unsafeWorkflowName,
      runId: unsafeRunId,
      snapshot: unsafeCanonical,
    });
    const unsafeInput = {
      workflowName: unsafeWorkflowName,
      runId: unsafeRunId,
      expectedCanonical: { kind: 'present' as const, snapshot: unsafeCanonical },
      snapshot: snapshot(unsafeRunId, 'waiting'),
      mutationFence: 'unsafe-owner',
    };
    await expect(workflows.claimWorkflowSnapshotHandoff(unsafeInput)).resolves.toMatchObject({ status: 'created' });
    await expect(workflows.claimWorkflowSnapshotHandoff(unsafeInput)).resolves.toMatchObject({ status: 'existing' });
  });

  it('fences late step, resume, nested, and update writes while pending and after completion', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'fenced-lifecycle-workflow';
    const runId = 'fenced-lifecycle-run';
    const nestedChild = { workflowName: 'nested-workflow', runId: 'nested-run' };
    const terminal: WorkflowRunState = {
      ...createEmptyWorkflowSnapshot(runId),
      status: 'success',
      serializedStepGraph: NESTED_PARENT_GRAPH,
      context: {
        nested: { status: 'running', payload: {}, metadata: {} },
      } as WorkflowRunState['context'],
      value: { native: true },
    };
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: terminal });
    const claimed = snapshot(runId, 'waiting', { product: true });
    await workflows.claimWorkflowSnapshotHandoff({
      workflowName,
      runId,
      expectedCanonical: { kind: 'present', snapshot: terminal },
      mutationFence: 'opaque-owner',
      snapshot: claimed,
    });

    const resumeInput = {
      workflowName,
      runId,
      resumeOperationHash: `sha256:${'0'.repeat(64)}` as `sha256:${string}`,
      executionGeneration: 'gen-1',
      lifecycleResumeAttempt: 0,
      lifecycleStepStates: {},
      nextLifecycleResumeAttempt: 1,
      operationReplayContext: { version: 1 as const, steps: [] },
    };
    const nestedInput = {
      workflowName,
      runId,
      stepId: 'nested',
      nestedWorkflowName: nestedChild.workflowName,
      nestedRunId: nestedChild.runId,
      expectedChildGraphFingerprint: createWorkflowTerminalGraphFingerprint([]),
      result: { status: 'running' as const, payload: {} },
      requestContext: {},
      recoveryAncestry: nestedAncestry(nestedChild, { workflowName, runId }),
    };
    const assertFenced = () => [
      expect(
        workflows.persistWorkflowStepUpdate({ workflowName, runId, snapshot: snapshot(runId, 'running') }),
      ).rejects.toThrow('handoff fence'),
      expect(workflows.admitWorkflowResume(resumeInput)).rejects.toThrow('handoff fence'),
      expect(workflows.bindWorkflowNestedRunOwnership(nestedInput)).rejects.toThrow('handoff fence'),
      expect(workflows.admitWorkflowNestedRun(nestedInput)).rejects.toThrow('handoff fence'),
      expect(
        workflows.updateWorkflowResults({
          workflowName,
          runId,
          stepId: 'step',
          result: { status: 'success', output: {} },
          requestContext: {},
        }),
      ).rejects.toThrow('handoff fence'),
      expect(
        workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: snapshot(runId, 'failed') }),
      ).rejects.toThrow('handoff fence'),
      expect(workflows.deleteWorkflowRunById({ workflowName, runId })).rejects.toThrow('handoff fence'),
    ];
    await Promise.all(assertFenced());

    await expect(
      workflows.completeWorkflowSnapshotHandoff({
        workflowName,
        runId,
        expectedResourceId: undefined,
        expectedSnapshot: claimed,
        mutationFence: 'opaque-owner',
        snapshot: snapshot(runId, 'success', { product: 'final' }),
      }),
    ).resolves.toMatchObject({ status: 'completed' });

    // The fence is permanent: every native mutation stays rejected and a new
    // owner cannot re-claim or resurrect the run after completion.
    await Promise.all(assertFenced());
    await expect(
      workflows.claimWorkflowSnapshotHandoff({
        workflowName,
        runId,
        expectedCanonical: { kind: 'present', snapshot: terminal },
        mutationFence: 'other-owner',
        snapshot: snapshot(runId, 'waiting'),
      }),
    ).resolves.toMatchObject({ status: 'conflict', record: { status: 'completed' } });
    await expect(workflows.loadWorkflowSnapshot({ workflowName, runId })).resolves.toMatchObject({ status: 'success' });
    await expect(workflows.getWorkflowRunTerminalStatus({ workflowName, runId })).resolves.toEqual({
      status: 'terminal',
      terminalStatus: 'success',
    });
  });

  it('reports an exact transition replay as a conflict carrying the stored record', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const runId = 'replay-run';
    const first = snapshot(runId, 'waiting', { phase: 'claimed' });
    const second = snapshot(runId, 'waiting', { phase: 'transitioned' });
    const input = {
      workflowName: 'replay-workflow',
      runId,
      expectedCanonical: { kind: 'absent' as const },
      resourceId: 'resource-1',
      mutationFence: 'opaque-owner',
      snapshot: first,
    };
    await workflows.claimWorkflowSnapshotHandoff(input);
    const transition = {
      workflowName: input.workflowName,
      runId,
      expectedResourceId: input.resourceId,
      expectedSnapshot: first,
      resourceId: 'resource-1',
      snapshot: second,
      mutationFence: input.mutationFence,
    };
    await expect(workflows.transitionWorkflowSnapshotHandoff(transition)).resolves.toMatchObject({
      status: 'transitioned',
    });
    // A stale expected resource or snapshot conflicts without rewriting the row.
    await expect(
      workflows.transitionWorkflowSnapshotHandoff({ ...transition, expectedResourceId: 'resource-stale' }),
    ).resolves.toMatchObject({ status: 'conflict', record: { resourceId: 'resource-1' } });
    // A lost-ack retry observes the stored winner rather than double-applying.
    await expect(workflows.transitionWorkflowSnapshotHandoff(transition)).resolves.toMatchObject({
      status: 'conflict',
      record: { snapshot: { value: { phase: 'transitioned' } }, mutationFence: 'opaque-owner' },
    });
    await expect(
      workflows.transitionWorkflowSnapshotHandoff({
        ...transition,
        expectedSnapshot: second,
        snapshot: first,
      }),
    ).resolves.toMatchObject({ status: 'transitioned' });
  });

  it('paginates deterministically across equal timestamps and isolates unrelated runs', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const claim = (workflowName: string, runId: string, resourceId?: string) =>
      workflows.claimWorkflowSnapshotHandoff({
        workflowName,
        runId,
        expectedCanonical: { kind: 'absent' },
        ...(resourceId === undefined ? {} : { resourceId }),
        snapshot: snapshot(runId, 'waiting'),
        mutationFence: `${workflowName}-owner`,
      });

    const clock = vi.spyOn(Date, 'now').mockReturnValue(5_000);
    try {
      await claim('shared', 'run-c', 'resource-c');
      await claim('shared', 'run-a', 'resource-a');
      await claim('other', 'run-b', 'resource-b');
      await claim('shared', 'run-b', 'resource-shared-b');
    } finally {
      clock.mockRestore();
    }

    // Equal updatedAt ties resolve by (workflowName, runId) in both adapters.
    const page1 = await workflows.listWorkflowSnapshotHandoffs({ limit: 2 });
    expect(page1.records.map(record => `${record.workflowName}/${record.runId}`)).toEqual([
      'other/run-b',
      'shared/run-a',
    ]);
    const page2 = await workflows.listWorkflowSnapshotHandoffs({ limit: 2, after: page1.nextCursor });
    expect(page2.records.map(record => `${record.workflowName}/${record.runId}`)).toEqual([
      'shared/run-b',
      'shared/run-c',
    ]);
    expect(page2.hasMore).toBe(false);

    // A fence on one run never reaches a sibling run or a same-id run in
    // another workflow, and listing is scoped by workflowName.
    await expect(workflows.listWorkflowSnapshotHandoffs({ workflowName: 'shared' })).resolves.toMatchObject({
      records: { length: 3 },
      hasMore: false,
    });
    await workflows.persistWorkflowSnapshot({
      workflowName: 'untouched',
      runId: 'run-a',
      snapshot: snapshot('run-a', 'running'),
    });
    await workflows.persistWorkflowSnapshot({
      workflowName: 'other',
      runId: 'different-run',
      snapshot: snapshot('different-run', 'running'),
    });
  });
});
