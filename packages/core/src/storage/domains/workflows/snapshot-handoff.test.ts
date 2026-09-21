import { describe, expect, it, vi } from 'vitest';
import { getErrorFromUnknown } from '../../../error';
import type { WorkflowRunState, WorkflowTerminalRecoveryAncestryV1 } from '../../../workflows';
import { createWorkflowTerminalGraphFingerprint } from '../../../workflows/terminal-continuation';
import { InMemoryStore } from '../../mock';
import { createEmptyWorkflowSnapshot } from '../../workflow-snapshot';
import { WorkflowSnapshotHandoffFenceError } from '../../workflow-snapshot-handoff';

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

  it('keeps enumerable Error fields in the persisted JSON projection', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'enumerable-error-workflow';
    const runId = 'enumerable-error-run';

    // Object.assign makes these own-enumerable: JSON.stringify persists them
    // into JSONB, so the canonical comparison must see them identically.
    const persistedError = Object.assign(new Error('boom'), {
      name: 'CustomError',
      cause: { reason: 'required' },
      code: 'E_PERSISTED',
    });
    const canonical = snapshot(runId, 'failed', { error: persistedError });
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: canonical });
    await expect(
      workflows.claimWorkflowSnapshotHandoff({
        workflowName,
        runId,
        expectedCanonical: { kind: 'present', snapshot: canonical },
        snapshot: snapshot(runId, 'waiting'),
        mutationFence: 'owner-a',
      }),
    ).resolves.toMatchObject({ status: 'created' });

    // A snapshot whose Error differs only in an enumerable field is a real
    // divergence, not a replay. Reuse the original timestamp so the Error
    // payload is the ONLY difference — a fresh timestamp would mask a
    // canonicalizer that wrongly drops enumerable Error fields.
    const divergentError = Object.assign(new Error('boom'), {
      name: 'CustomError',
      cause: { reason: 'changed' },
      code: 'E_PERSISTED',
    });
    const divergentCanonical = {
      ...snapshot(runId, 'failed', { error: divergentError }),
      timestamp: canonical.timestamp,
    };
    await workflows.persistWorkflowSnapshot({
      workflowName: 'enumerable-error-workflow-2',
      runId,
      snapshot: divergentCanonical,
    });
    await expect(
      workflows.claimWorkflowSnapshotHandoff({
        workflowName: 'enumerable-error-workflow-2',
        runId,
        expectedCanonical: { kind: 'present', snapshot: canonical },
        snapshot: snapshot(runId, 'waiting'),
        mutationFence: 'owner-b',
      }),
    ).resolves.toMatchObject({ status: 'conflict' });

    // A constructor-provided cause is non-enumerable: it stays out of the JSON
    // projection and does not create a phantom divergence.
    const specError = new Error('wrapped', { cause: 'inner' });
    const specCanonical = snapshot('spec-error-run', 'failed', { error: specError });
    await workflows.persistWorkflowSnapshot({
      workflowName: 'spec-error-workflow',
      runId: 'spec-error-run',
      snapshot: specCanonical,
    });
    await expect(
      workflows.claimWorkflowSnapshotHandoff({
        workflowName: 'spec-error-workflow',
        runId: 'spec-error-run',
        expectedCanonical: { kind: 'present', snapshot: specCanonical },
        snapshot: snapshot('spec-error-run', 'waiting'),
        mutationFence: 'owner-c',
      }),
    ).resolves.toMatchObject({ status: 'created' });
  });

  it('cannot be reentered by snapshot serialization mid-claim', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'reentrant-workflow';
    const runId = 'reentrant-run';

    // The outer claim's snapshot carries a toJSON that synchronously claims
    // the same run before the outer claim ever observes storage.
    const outerSnapshot = snapshot(runId, 'waiting', { phase: 'outer' });
    Object.defineProperty(outerSnapshot, 'trigger', {
      enumerable: true,
      value: {
        toJSON: () => {
          void workflows.claimWorkflowSnapshotHandoff({
            workflowName,
            runId,
            expectedCanonical: { kind: 'absent' },
            snapshot: snapshot(runId, 'waiting', { phase: 'inner' }),
            mutationFence: 'inner-owner',
          });
          return { armed: true };
        },
      },
    });

    const outer = await workflows.claimWorkflowSnapshotHandoff({
      workflowName,
      runId,
      expectedCanonical: { kind: 'absent' },
      snapshot: outerSnapshot,
      mutationFence: 'outer-owner',
    });
    // The reentrant claim wins: the outer claim observes its row instead of
    // overwriting it with a stale read.
    expect(outer.status).toBe('conflict');
    const stored = await workflows.listWorkflowSnapshotHandoffs({ workflowName });
    expect(stored.records).toHaveLength(1);
    expect(stored.records[0]).toMatchObject({ mutationFence: 'inner-owner', status: 'pending' });
  });

  it('pins every input field before caller serialization in claim', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'aliased-workflow';
    let runIdReads = 0;
    const input = {
      workflowName,
      get runId() {
        return runIdReads++ === 0 ? 'aliased-run' : 'swapped-run';
      },
      expectedCanonical: { kind: 'absent' as const },
      snapshot: snapshot('aliased-run', 'waiting'),
      mutationFence: 'aliased-owner',
    };

    const result = await workflows.claimWorkflowSnapshotHandoff(input);
    expect(result).toMatchObject({ status: 'created', record: { runId: 'aliased-run' } });
    const listed = await workflows.listWorkflowSnapshotHandoffs({ workflowName });
    expect(listed.records.map(record => record.runId)).toEqual(['aliased-run']);
  });

  it('fences a step update whose input serialization claims the handoff mid-flight', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'mid-flight-workflow';
    const runId = 'mid-flight-run';
    const stored = snapshot(runId, 'running');
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: stored });

    const armedSnapshot = snapshot(runId, 'running', { phase: 'update' });
    Object.defineProperty(armedSnapshot.value as Record<string, unknown>, 'trigger', {
      enumerable: true,
      get() {
        void workflows.claimWorkflowSnapshotHandoff({
          workflowName,
          runId,
          expectedCanonical: { kind: 'present', snapshot: stored },
          snapshot: snapshot(runId, 'waiting'),
          mutationFence: 'mid-flight-owner',
        });
        return { armed: true };
      },
    });

    await expect(workflows.persistWorkflowStepUpdate({ workflowName, runId, snapshot: armedSnapshot })).rejects.toThrow(
      WorkflowSnapshotHandoffFenceError,
    );
    // The fenced row is still the handoff owner's claim state, not the update.
    const listed = await workflows.listWorkflowSnapshotHandoffs({ workflowName });
    expect(listed.records).toHaveLength(1);
    expect(listed.records[0]).toMatchObject({ mutationFence: 'mid-flight-owner', status: 'pending' });
  });

  it('orders cursor ties in code-point order including astral names', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const claim = (workflowName: string, runId: string) =>
      workflows.claimWorkflowSnapshotHandoff({
        workflowName,
        runId,
        expectedCanonical: { kind: 'absent' },
        snapshot: snapshot(runId, 'waiting'),
        mutationFence: `${workflowName}-owner`,
      });

    const clock = vi.spyOn(Date, 'now').mockReturnValue(7_000);
    try {
      await claim('x￿', 'run-a');
      await claim('Ba', 'run-a');
      await claim('x💥', 'run-a');
      await claim('aB', 'run-a');
    } finally {
      clock.mockRestore();
    }

    // Code-point order (UTF-8 byte order, matching PostgreSQL COLLATE "C"):
    // 'B' < 'a' < 'x', and U+FFFF precedes U+1F4A5 even though a UTF-16
    // code-unit compare would invert the astral pair.
    const page1 = await workflows.listWorkflowSnapshotHandoffs({ limit: 2 });
    expect(page1.records.map(record => record.workflowName)).toEqual(['Ba', 'aB']);
    const page2 = await workflows.listWorkflowSnapshotHandoffs({ limit: 2, after: page1.nextCursor });
    expect(page2.records.map(record => record.workflowName)).toEqual(['x￿', 'x💥']);
    expect(page2.hasMore).toBe(false);
  });

  it('keeps an explicitly enumerable Error.message in the CAS projection', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'enumerable-message-workflow';
    const runId = 'enumerable-message-run';
    // A message made enumerable by the caller is part of the persisted JSON
    // document, so it participates in the canonical comparison.
    const visible = new Error('visible');
    Object.defineProperty(visible, 'message', {
      value: 'visible',
      writable: true,
      configurable: true,
      enumerable: true,
    });
    const canonical = snapshot(runId, 'failed', { error: visible });
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: canonical });
    await expect(
      workflows.claimWorkflowSnapshotHandoff({
        workflowName,
        runId,
        expectedCanonical: { kind: 'present', snapshot: canonical },
        snapshot: snapshot(runId, 'waiting'),
        mutationFence: 'owner-a',
      }),
    ).resolves.toMatchObject({ status: 'created' });

    const divergent = new Error('changed');
    Object.defineProperty(divergent, 'message', {
      value: 'changed',
      writable: true,
      configurable: true,
      enumerable: true,
    });
    await workflows.persistWorkflowSnapshot({
      workflowName: `${workflowName}-2`,
      runId,
      snapshot: { ...snapshot(runId, 'failed', { error: divergent }), timestamp: canonical.timestamp },
    });
    await expect(
      workflows.claimWorkflowSnapshotHandoff({
        workflowName: `${workflowName}-2`,
        runId,
        expectedCanonical: { kind: 'present', snapshot: canonical },
        snapshot: snapshot(runId, 'waiting'),
        mutationFence: 'owner-b',
      }),
    ).resolves.toMatchObject({ status: 'conflict' });
  });

  it('pins the expected canonical state before serializing the replacement snapshot', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'expected-pin-workflow';
    const runId = 'expected-pin-run';
    const stored = snapshot(runId, 'running');
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: stored });

    // The replacement snapshot's toJSON swaps the caller's expected snapshot
    // after the call starts; the expectation must already be materialized.
    const expectedCanonical = { kind: 'present' as const, snapshot: stored };
    const replacement = snapshot(runId, 'waiting');
    Object.defineProperty(replacement, 'trigger', {
      enumerable: true,
      value: {
        toJSON: () => {
          expectedCanonical.snapshot = snapshot(runId, 'failed', { swapped: true });
          return { armed: true };
        },
      },
    });

    await expect(
      workflows.claimWorkflowSnapshotHandoff({
        workflowName,
        runId,
        expectedCanonical,
        snapshot: replacement,
        mutationFence: 'owner-a',
      }),
    ).resolves.toMatchObject({ status: 'created' });
  });

  it('pins step-update identity before spreading caller input', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'step-pin-workflow';
    let runIdReads = 0;
    const input = {
      workflowName,
      get runId() {
        return runIdReads++ === 0 ? 'pinned-run' : 'swapped-run';
      },
      snapshot: snapshot('pinned-run', 'running'),
    };

    // snapshot.runId must be compared against the first captured identity, not
    // the getter's second value — a torn read would surface invalid_snapshot.
    const result = await workflows.persistWorkflowStepUpdate(input);
    expect(result).toMatchObject({ status: 'persisted' });
    const stored = await workflows.loadWorkflowSnapshot({ workflowName, runId: 'pinned-run' });
    expect(stored?.runId).toBe('pinned-run');
  });

  it('fails a mutation whose input serialization mutates shared state on every retry', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'nonconvergent-workflow';
    const runId = 'nonconvergent-run';
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: snapshot(runId, 'running') });

    // Every clone of this snapshot reentrantly rewrites the same row with a
    // plain snapshot, so the source record never stays stable long enough for
    // the consistency check to pass.
    const armed = snapshot(runId, 'running');
    Object.defineProperty(armed.value as Record<string, unknown>, 'trigger', {
      enumerable: true,
      get() {
        void workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: snapshot(runId, 'waiting') });
        return { armed: true };
      },
    });

    await expect(workflows.persistWorkflowStepUpdate({ workflowName, runId, snapshot: armed })).rejects.toThrow(
      /did not converge/,
    );
  });

  it('commits no nested admission records when a claim fences the child mid-admit', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'nested-parent';
    const runId = 'parent-run';
    const child = { workflowName: 'nested-child', runId: 'child-run' };
    const childKey = JSON.stringify([child.workflowName, child.runId]);

    const parent = snapshot(runId, 'running');
    parent.serializedStepGraph = NESTED_PARENT_GRAPH;
    parent.context = {
      nested: { status: 'running', payload: {}, metadata: {} },
    } as WorkflowRunState['context'];
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: parent });
    const parentBefore = JSON.stringify(await workflows.loadWorkflowSnapshot({ workflowName, runId }));

    // The first deep read of result.payload is the record helper's spread —
    // after the child fence assert but before the ancestry commit. Claiming
    // the child handoff there must abort the whole admission atomically.
    const result = {
      status: 'running' as const,
      get payload() {
        void workflows.claimWorkflowSnapshotHandoff({
          workflowName: child.workflowName,
          runId: child.runId,
          expectedCanonical: { kind: 'absent' },
          snapshot: snapshot(child.runId, 'waiting'),
          mutationFence: 'child-owner',
        });
        return {};
      },
    };
    const childSnapshot = snapshot(child.runId, 'running');
    childSnapshot.serializedStepGraph = [];

    await expect(
      workflows.admitWorkflowNestedRun({
        workflowName,
        runId,
        stepId: 'nested',
        nestedWorkflowName: child.workflowName,
        nestedRunId: child.runId,
        expectedChildGraphFingerprint: createWorkflowTerminalGraphFingerprint([]),
        result,
        requestContext: {},
        recoveryAncestry: nestedAncestry(child, { workflowName, runId }),
        initialChildSnapshot: { snapshot: childSnapshot },
      }),
    ).rejects.toThrow(WorkflowSnapshotHandoffFenceError);

    const db = (workflows as unknown as { db: { workflowTerminalRecoveryAncestries: Map<string, unknown> } }).db;
    expect(db.workflowTerminalRecoveryAncestries.get(childKey)).toBeUndefined();
    const parentAfter = JSON.stringify(await workflows.loadWorkflowSnapshot({ workflowName, runId }));
    expect(parentAfter).toBe(parentBefore);
  });

  it('rejects a transition whose replacement getter retargets the expected snapshot', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'getter-order-workflow';
    const runId = 'getter-order-run';

    const a = snapshot(runId, 'waiting', { phase: 'a' });
    const b = snapshot(runId, 'waiting', { phase: 'b' });
    await workflows.claimWorkflowSnapshotHandoff({
      workflowName,
      runId,
      expectedCanonical: { kind: 'absent' },
      snapshot: a,
      mutationFence: 'owner',
    });
    await workflows.transitionWorkflowSnapshotHandoff({
      workflowName,
      runId,
      expectedSnapshot: a,
      snapshot: b,
      mutationFence: 'owner',
    });

    // A stale A→C request whose `snapshot` getter rewrites expectedSnapshot to
    // B must still compare the pre-call expectation (A) against the stored
    // snapshot (B) and conflict — not silently adopt B and overwrite it.
    const input = {
      workflowName,
      runId,
      mutationFence: 'owner',
      expectedSnapshot: a,
      get snapshot() {
        input.expectedSnapshot = b;
        return snapshot(runId, 'waiting', { phase: 'c' });
      },
    };
    await expect(workflows.transitionWorkflowSnapshotHandoff(input)).resolves.toMatchObject({
      status: 'conflict',
    });
    const records = await workflows.listWorkflowSnapshotHandoffs({ workflowName });
    expect(records.records[0]?.snapshot).toMatchObject({ value: { phase: 'b' } });
  });

  it('re-checks the source row after reading the outcome snapshot resourceId', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'proto-resource-workflow';
    const runId = 'proto-resource-run';

    // cloneRunData preserves the snapshot prototype, so an inherited
    // `resourceId` getter fires when the stored-outcome record is built. On a
    // fresh run the record helper returns the proposal unwrapped, so the only
    // read is the record literal's — it must happen before the final source
    // check or a reentrant write is clobbered without a retry.
    let fired = false;
    const proto = {};
    Object.defineProperty(proto, 'resourceId', {
      get() {
        if (!fired) {
          fired = true;
          void workflows.persistWorkflowSnapshot({
            workflowName,
            runId,
            snapshot: snapshot(runId, 'success', { marker: 'newer' }),
          });
        }
        return 'proto-resource';
      },
    });
    const update = Object.setPrototypeOf(snapshot(runId, 'running'), proto);

    const result = await workflows.persistWorkflowStepUpdate({ workflowName, runId, snapshot: update });
    expect(result).toMatchObject({ status: 'finalized' });
    const stored = await workflows.loadWorkflowSnapshot({ workflowName, runId });
    expect(stored).toMatchObject({ status: 'success', value: { marker: 'newer' } });
  });

  it('fences a retried nested admission when the parent handoff is claimed mid-admit', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'nested-parent-fenced';
    const runId = 'parent-run';
    const child = { workflowName: 'nested-child-fenced', runId: 'child-run' };
    const childKey = JSON.stringify([child.workflowName, child.runId]);

    const parent = snapshot(runId, 'running');
    parent.serializedStepGraph = NESTED_PARENT_GRAPH;
    parent.context = {
      nested: { status: 'running', payload: {}, metadata: {} },
    } as WorkflowRunState['context'];
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: parent });

    const childSnapshot = snapshot(child.runId, 'running');
    childSnapshot.serializedStepGraph = [];
    const admitInput = () => ({
      workflowName,
      runId,
      stepId: 'nested',
      nestedWorkflowName: child.workflowName,
      nestedRunId: child.runId,
      expectedChildGraphFingerprint: createWorkflowTerminalGraphFingerprint([]),
      result: { status: 'running' as const, payload: {} },
      requestContext: {},
      recoveryAncestry: nestedAncestry(child, { workflowName, runId }),
      initialChildSnapshot: { snapshot: childSnapshot },
    });
    await expect(workflows.admitWorkflowNestedRun(admitInput())).resolves.toMatchObject({ status: 'admitted' });

    // Leave the binding + ancestry in place but drop the child snapshot row so
    // the next admission takes the already_bound + existingRecovery branch.
    await workflows.deleteWorkflowRunById({ workflowName: child.workflowName, runId: child.runId });

    // Re-persist the parent with an armed Error: cloneRunData invokes a cloned
    // Error's own toJSON for its stack signal, so this claims the parent
    // handoff from inside the admission loop's stored-snapshot clone. The flag
    // keeps the re-persist itself unfenced; the claim fires only during admit.
    const bound = (await workflows.loadWorkflowSnapshot({ workflowName, runId }))!;
    let armed = false;
    let claimed = false;
    const armedSnapshot = { ...bound, value: {} } as WorkflowRunState;
    const armedError = new Error('armed');
    Object.defineProperty(armedError, 'toJSON', {
      enumerable: false,
      configurable: true,
      value() {
        if (armed && !claimed) {
          claimed = true;
          void workflows.claimWorkflowSnapshotHandoff({
            workflowName,
            runId,
            expectedCanonical: { kind: 'present', snapshot: armedSnapshot },
            snapshot: snapshot(runId, 'waiting'),
            mutationFence: 'parent-owner',
          });
        }
        // Keep `stack` in the JSON form so cloneRunData retains the field and
        // keeps invoking toJSON on subsequent clones.
        return { armed: true, stack: 'x' };
      },
    });
    (armedSnapshot.value as Record<string, unknown>).err = armedError;
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: armedSnapshot });
    armed = true;

    await expect(workflows.admitWorkflowNestedRun(admitInput())).rejects.toThrow(WorkflowSnapshotHandoffFenceError);
    // The child must not be initialized and the ancestry must stay untouched.
    await expect(
      workflows.loadWorkflowSnapshot({ workflowName: child.workflowName, runId: child.runId }),
    ).resolves.toBeNull();
    const db = (
      workflows as unknown as {
        db: {
          workflowTerminalRecoveryAncestries: Map<
            string,
            { ancestry?: Array<{ childWorkflowName?: string; childRunId?: string }> }
          >;
        };
      }
    ).db;
    expect(db.workflowTerminalRecoveryAncestries.get(childKey)).toMatchObject({
      ancestry: [{ childWorkflowName: child.workflowName, childRunId: child.runId }],
    });
  });

  it('keeps non-enumerable backing data readable by a copied Error toJSON', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'error-backfill-workflow';
    const runId = 'error-backfill-run';

    // The clone copies toJSON verbatim; a toJSON that reads non-enumerable own
    // data must still see it, or the stored JSON projection diverges from what
    // durable adapters persist for the identical source object.
    const err = new Error('with-detail');
    Object.defineProperty(err, 'detail', {
      value: { code: 42 },
      writable: true,
      configurable: true,
      enumerable: false,
    });
    Object.defineProperty(err, 'toJSON', {
      value(this: Error & { detail?: unknown }) {
        return { detail: this.detail };
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
    const canonical = snapshot(runId, 'failed', { error: err });
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: canonical });
    await expect(
      workflows.claimWorkflowSnapshotHandoff({
        workflowName,
        runId,
        expectedCanonical: { kind: 'present', snapshot: canonical },
        snapshot: snapshot(runId, 'waiting'),
        mutationFence: 'owner-a',
      }),
    ).resolves.toMatchObject({ status: 'created' });
  });

  it('does not mutate the stored snapshot while observing canonical state', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'self-mutating-workflow';
    const runId = 'self-mutating-run';

    // A stored snapshot's own toJSON may mutate its fields mid-serialization.
    // Canonical observation must serialize a clone so the stored row stays
    // consistent with what the CAS comparison verified.
    let armed = false;
    const base = snapshot(runId, 'running', { n: 1 });
    const selfMutating = {
      ...base,
      toJSON(this: Record<string, unknown>) {
        const { toJSON: _omit, ...out } = this;
        if (armed) {
          armed = false;
          this.value = { n: 2 };
        }
        return out;
      },
    } as WorkflowRunState;
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: selfMutating });
    armed = true;

    await expect(
      workflows.claimWorkflowSnapshotHandoff({
        workflowName,
        runId,
        expectedCanonical: { kind: 'present', snapshot: base },
        snapshot: snapshot(runId, 'waiting'),
        mutationFence: 'owner-a',
      }),
    ).resolves.toMatchObject({ status: 'created' });
    const stored = await workflows.loadWorkflowSnapshot({ workflowName, runId });
    expect(stored).toMatchObject({ value: { n: 1 } });
  });
});
