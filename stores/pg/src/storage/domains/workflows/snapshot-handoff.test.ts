import { randomUUID } from 'node:crypto';
import {
  createEmptyWorkflowSnapshot,
  createWorkflowTerminalGraphFingerprint,
  WorkflowSnapshotHandoffFenceError,
} from '@mastra/core/storage';
import type { WorkflowRunState, WorkflowTerminalRecoveryAncestryV1 } from '@mastra/core/workflows';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { PostgresStore } from '../../index';

const NESTED_PARENT_GRAPH: WorkflowRunState['serializedStepGraph'] = [
  { type: 'step', step: { id: 'nested', component: 'WORKFLOW' } },
];
const EMPTY_CHILD_GRAPH_FINGERPRINT = createWorkflowTerminalGraphFingerprint([]);

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

const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';

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

describe('workflow snapshot handoff in PostgreSQL', () => {
  let store: PostgresStore;
  let workflows: any;

  beforeAll(async () => {
    store = new PostgresStore({ id: `workflow-handoff-${randomUUID()}`, connectionString });
    await store.init();
    workflows = await store.getStore('workflows');
  }, 60000);

  afterAll(async () => {
    await store?.close();
  });

  it('serializes concurrent claims and applies exact transition/completion retries', async () => {
    const workflowName = `handoff-${randomUUID()}`;
    const runId = randomUUID();
    const pending = snapshot(runId, 'waiting', { phase: 'claimed' });
    const input = {
      workflowName,
      runId,
      expectedCanonical: { kind: 'absent' },
      resourceId: 'resource-1',
      snapshot: pending,
      mutationFence: 'opaque-owner',
    };

    const claims = await Promise.all([
      workflows.claimWorkflowSnapshotHandoff(input),
      workflows.claimWorkflowSnapshotHandoff(input),
    ]);
    expect(claims.map((claim: any) => claim.status).sort()).toEqual(['created', 'existing']);

    const transitioned = snapshot(runId, 'waiting', { phase: 'transitioned' });
    await expect(
      workflows.transitionWorkflowSnapshotHandoff({
        ...input,
        expectedResourceId: 'resource-stale',
        expectedSnapshot: pending,
        snapshot: transitioned,
      }),
    ).resolves.toMatchObject({ status: 'conflict', record: { resourceId: 'resource-1' } });
    await expect(
      workflows.transitionWorkflowSnapshotHandoff({
        ...input,
        expectedResourceId: input.resourceId,
        expectedSnapshot: pending,
        snapshot: transitioned,
      }),
    ).resolves.toMatchObject({ status: 'transitioned', record: { status: 'pending' } });

    const completed = snapshot(runId, 'success', { phase: 'completed' });
    await expect(
      workflows.completeWorkflowSnapshotHandoff({
        ...input,
        expectedResourceId: input.resourceId,
        expectedSnapshot: transitioned,
        snapshot: completed,
      }),
    ).resolves.toMatchObject({ status: 'completed', record: { status: 'completed' } });
    await expect(
      workflows.completeWorkflowSnapshotHandoff({
        ...input,
        expectedResourceId: input.resourceId,
        expectedSnapshot: transitioned,
        snapshot: pending,
      }),
    ).resolves.toMatchObject({ status: 'already_completed' });
  });

  it('retains the terminal native row and rejects late native mutation/deletion', async () => {
    const workflowName = `fenced-${randomUUID()}`;
    const runId = randomUUID();
    const terminal = snapshot(runId, 'success', { native: true });
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: terminal });
    const nativeFirstWorkflow = `native-first-${randomUUID()}`;
    const nativeFirstRun = randomUUID();
    const nativeFirst = snapshot(nativeFirstRun, 'success', { native: true });
    await workflows.persistWorkflowSnapshot({
      workflowName: nativeFirstWorkflow,
      runId: nativeFirstRun,
      snapshot: nativeFirst,
    });
    await expect(
      workflows.claimWorkflowSnapshotHandoff({
        workflowName: nativeFirstWorkflow,
        runId: nativeFirstRun,
        expectedCanonical: { kind: 'absent' },
        snapshot: snapshot(nativeFirstRun, 'waiting'),
        mutationFence: 'native-first-owner',
      }),
    ).resolves.toMatchObject({
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
    ).rejects.toThrow();
    await expect(workflows.updateWorkflowState({ workflowName, runId, opts: { status: 'failed' } })).rejects.toThrow();
    await expect(workflows.deleteWorkflowRunById({ workflowName, runId })).rejects.toThrow();
    await expect(workflows.getWorkflowRunTerminalStatus({ workflowName, runId })).resolves.toEqual({
      status: 'terminal',
      terminalStatus: 'success',
    });

    const rows = await store.db.any<{ status: string; terminal_status: string }>(
      `SELECT handoff.status, revision.terminal_status
       FROM mastra_workflow_snapshot_handoffs AS handoff
       JOIN mastra_workflow_parent_revisions AS revision
         ON revision.workflow_name = handoff.workflow_name AND revision.run_id = handoff.run_id
       WHERE handoff.workflow_name = $1 AND handoff.run_id = $2`,
      [workflowName, runId],
    );
    expect(rows).toEqual([{ status: 'pending', terminal_status: 'success' }]);
  });

  it('blocks a late create after a pre-native absent claim', async () => {
    const workflowName = `pre-native-${randomUUID()}`;
    const runId = randomUUID();
    await workflows.claimWorkflowSnapshotHandoff({
      workflowName,
      runId,
      expectedCanonical: { kind: 'absent' },
      mutationFence: 'opaque-owner',
      snapshot: snapshot(runId, 'waiting'),
    });

    await expect(
      workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: snapshot(runId, 'running') }),
    ).rejects.toThrow();
    await expect(workflows.listWorkflowSnapshotHandoffs({ workflowName })).resolves.toMatchObject({
      records: [{ workflowName, runId, status: 'pending' }],
      hasMore: false,
    });

    const sanitizedWorkflowName = `sanitized-${randomUUID()}`;
    const sanitizedRunId = randomUUID();
    const sanitizedCanonical = snapshot(sanitizedRunId, 'waiting', { payload: `a${String.fromCharCode(0)}b` });
    await workflows.persistWorkflowSnapshot({
      workflowName: sanitizedWorkflowName,
      runId: sanitizedRunId,
      snapshot: sanitizedCanonical,
    });
    const sanitizedInput = {
      workflowName: sanitizedWorkflowName,
      runId: sanitizedRunId,
      expectedCanonical: { kind: 'present' as const, snapshot: sanitizedCanonical },
      snapshot: snapshot(sanitizedRunId, 'waiting'),
      mutationFence: 'sanitized-owner',
    };
    await expect(workflows.claimWorkflowSnapshotHandoff(sanitizedInput)).resolves.toMatchObject({ status: 'created' });
    await expect(workflows.claimWorkflowSnapshotHandoff(sanitizedInput)).resolves.toMatchObject({ status: 'existing' });
  });

  it('keeps fenced snapshots out of retention pruning', async () => {
    const workflowName = `retention-fenced-${randomUUID()}`;
    const runId = randomUUID();
    const canonical = snapshot(runId, 'waiting');
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: canonical });
    await workflows.claimWorkflowSnapshotHandoff({
      workflowName,
      runId,
      expectedCanonical: { kind: 'present', snapshot: canonical },
      snapshot: snapshot(runId, 'waiting', { handoff: true }),
      mutationFence: 'opaque-owner',
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    await workflows.prune({ workflowSnapshot: { maxAge: '0ms' } });

    await expect(workflows.loadWorkflowSnapshot({ workflowName, runId })).resolves.toMatchObject({ status: 'waiting' });
    await expect(workflows.listWorkflowSnapshotHandoffs({ workflowName })).resolves.toMatchObject({
      records: [{ workflowName, runId, status: 'pending' }],
      hasMore: false,
    });
  });

  it('serializes a pre-native claim against a concurrent first snapshot write', async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const workflowName = `race-${attempt}-${randomUUID()}`;
      const runId = randomUUID();
      const canonical = snapshot(runId, 'running', { native: true });
      const [claim, persist] = await Promise.allSettled([
        workflows.claimWorkflowSnapshotHandoff({
          workflowName,
          runId,
          expectedCanonical: { kind: 'absent' },
          snapshot: snapshot(runId, 'waiting'),
          mutationFence: 'race-owner',
        }),
        workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: canonical }),
      ]);

      const claimCreated = claim.status === 'fulfilled' && claim.value.status === 'created';
      const persistWon = persist.status === 'fulfilled';
      // Exactly one ordering may win: either the claim lands first and fences
      // the native write, or the native row commits and the claim conflicts.
      expect(claimCreated !== persistWon).toBe(true);
      if (claimCreated) {
        expect(persist.status).toBe('rejected');
        expect((persist as PromiseRejectedResult).reason.message).toMatch(/handoff fence/);
      } else {
        expect(claim.status).toBe('fulfilled');
        expect((claim as PromiseFulfilledResult<any>).value).toMatchObject({
          status: 'conflict',
          observedCanonical: { kind: 'present' },
        });
      }

      // Regardless of ordering the durable state is consistent: a handoff row
      // and a mutable snapshot row never coexist.
      const rows = await store.db.any<{ handoffs: number; snapshots: number }>(
        `SELECT
           (SELECT count(*)::int FROM mastra_workflow_snapshot_handoffs
             WHERE workflow_name = $1 AND run_id = $2) AS handoffs,
           (SELECT count(*)::int FROM mastra_workflow_snapshot
             WHERE workflow_name = $1 AND run_id = $2) AS snapshots`,
        [workflowName, runId],
      );
      expect(rows).toEqual([{ handoffs: claimCreated ? 1 : 0, snapshots: persistWon ? 1 : 0 }]);
    }
  });

  it('fences late step, resume, nested, and delete writes after completion', async () => {
    const workflowName = `lifecycle-${randomUUID()}`;
    const runId = randomUUID();
    const nestedChild = { workflowName: `nested-${randomUUID()}`, runId: randomUUID() };
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
    await workflows.completeWorkflowSnapshotHandoff({
      workflowName,
      runId,
      expectedSnapshot: claimed,
      mutationFence: 'opaque-owner',
      snapshot: snapshot(runId, 'success', { product: 'final' }),
    });

    const resumeInput = {
      workflowName,
      runId,
      resumeOperationHash: `sha256:${'0'.repeat(64)}`,
      executionGeneration: 'gen-1',
      lifecycleResumeAttempt: 0,
      lifecycleStepStates: {},
      nextLifecycleResumeAttempt: 1,
      operationReplayContext: { version: 1, steps: [] },
    };
    const nestedInput = {
      workflowName,
      runId,
      stepId: 'nested',
      nestedWorkflowName: nestedChild.workflowName,
      nestedRunId: nestedChild.runId,
      expectedChildGraphFingerprint: EMPTY_CHILD_GRAPH_FINGERPRINT,
      result: { status: 'running', payload: {} },
      requestContext: {},
      recoveryAncestry: nestedAncestry(nestedChild, { workflowName, runId }),
    };
    const fenced = [
      expect(
        workflows.persistWorkflowStepUpdate({ workflowName, runId, snapshot: snapshot(runId, 'running') }),
      ).rejects.toThrow(/handoff fence/),
      expect(workflows.admitWorkflowResume(resumeInput)).rejects.toThrow(/handoff fence/),
      expect(workflows.bindWorkflowNestedRunOwnership(nestedInput)).rejects.toThrow(/handoff fence/),
      expect(workflows.admitWorkflowNestedRun(nestedInput)).rejects.toThrow(/handoff fence/),
      expect(
        workflows.updateWorkflowResults({
          workflowName,
          runId,
          stepId: 'step',
          result: { status: 'success', output: {} },
          requestContext: {},
        }),
      ).rejects.toThrow(/handoff fence/),
      expect(
        workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: snapshot(runId, 'failed') }),
      ).rejects.toThrow(/handoff fence/),
      expect(workflows.deleteWorkflowRunById({ workflowName, runId })).rejects.toThrow(/handoff fence/),
    ];
    await Promise.all(fenced);

    // A completed sentinel keeps the canonical terminal row readable and
    // rejects a different owner's claim without resurrecting the run.
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

  it('rolls back a crashed claim transaction and replays a lost completion acknowledgement', async () => {
    const workflowName = `crash-${randomUUID()}`;
    const runId = randomUUID();
    const injected = new Error('injected commit loss');
    const original = (workflows as any).lockWorkflowSnapshotHandoff;
    (workflows as any).lockWorkflowSnapshotHandoff = async () => {
      throw injected;
    };
    await expect(
      workflows.claimWorkflowSnapshotHandoff({
        workflowName,
        runId,
        expectedCanonical: { kind: 'absent' },
        snapshot: snapshot(runId, 'waiting'),
        mutationFence: 'crash-owner',
      }),
    ).rejects.toBe(injected);
    delete (workflows as any).lockWorkflowSnapshotHandoff;

    // The provisional parent revision and the handoff row roll back together.
    const left = await store.db.any<{ handoffs: number; revisions: number }>(
      `SELECT
         (SELECT count(*)::int FROM mastra_workflow_snapshot_handoffs
           WHERE workflow_name = $1 AND run_id = $2) AS handoffs,
         (SELECT count(*)::int FROM mastra_workflow_parent_revisions
           WHERE workflow_name = $1 AND run_id = $2) AS revisions`,
      [workflowName, runId],
    );
    expect(left).toEqual([{ handoffs: 0, revisions: 0 }]);

    const input = {
      workflowName,
      runId,
      expectedCanonical: { kind: 'absent' as const },
      resourceId: 'resource-1',
      snapshot: snapshot(runId, 'waiting', { phase: 'claimed' }),
      mutationFence: 'crash-owner',
    };
    await expect(workflows.claimWorkflowSnapshotHandoff(input)).resolves.toMatchObject({ status: 'created' });
    // A completion whose acknowledgement is lost replays idempotently.
    await expect(
      workflows.completeWorkflowSnapshotHandoff({
        ...input,
        expectedResourceId: input.resourceId,
        expectedSnapshot: input.snapshot,
        snapshot: snapshot(runId, 'success', { product: 'final' }),
      }),
    ).resolves.toMatchObject({ status: 'completed' });
    await expect(
      workflows.completeWorkflowSnapshotHandoff({
        ...input,
        expectedResourceId: input.resourceId,
        expectedSnapshot: input.snapshot,
        snapshot: snapshot(runId, 'success', { product: 'final' }),
      }),
    ).resolves.toMatchObject({ status: 'already_completed' });
    await expect(workflows.claimWorkflowSnapshotHandoff(input)).resolves.toMatchObject({
      status: 'completed',
      record: { status: 'completed' },
    });
  });

  it('paginates handoffs deterministically across equal timestamps and isolates workflows', async () => {
    const prefix = `page-${randomUUID()}`;
    const runIds = [`${prefix}-c`, `${prefix}-a`, `${prefix}-b`];
    for (const runId of runIds) {
      await workflows.claimWorkflowSnapshotHandoff({
        workflowName: `${prefix}-shared`,
        runId,
        expectedCanonical: { kind: 'absent' },
        resourceId: `resource-${runId}`,
        snapshot: snapshot(runId, 'waiting'),
        mutationFence: `${prefix}-owner`,
      });
    }
    await workflows.claimWorkflowSnapshotHandoff({
      workflowName: `${prefix}-other`,
      runId: `${prefix}-a`,
      expectedCanonical: { kind: 'absent' },
      snapshot: snapshot(`${prefix}-a`, 'waiting'),
      mutationFence: `${prefix}-other-owner`,
    });
    // Force identical updated_at so ordering must resolve on the key tiebreak.
    await store.db.none(
      `UPDATE mastra_workflow_snapshot_handoffs SET created_at = 424242, updated_at = 424242
       WHERE workflow_name LIKE $1`,
      [`${prefix}-%`],
    );

    const expected = [
      `${prefix}-other/${prefix}-a`,
      `${prefix}-shared/${prefix}-a`,
      `${prefix}-shared/${prefix}-b`,
      `${prefix}-shared/${prefix}-c`,
    ];
    const seen: string[] = [];
    let cursor: any;
    do {
      const page = await workflows.listWorkflowSnapshotHandoffs({
        workflowName: undefined,
        status: 'pending',
        limit: 2,
        after: cursor,
      });
      for (const record of page.records) {
        if (record.workflowName.startsWith(prefix)) seen.push(`${record.workflowName}/${record.runId}`);
      }
      cursor = page.nextCursor;
      if (!page.hasMore) break;
    } while (cursor);
    expect(seen).toEqual(expected);

    await expect(workflows.listWorkflowSnapshotHandoffs({ workflowName: `${prefix}-shared` })).resolves.toMatchObject({
      records: { length: 3 },
    });
    // A sibling workflow's runs stay mutable even when a same-runId handoff exists.
    await workflows.persistWorkflowSnapshot({
      workflowName: `${prefix}-untouched`,
      runId: `${prefix}-a`,
      snapshot: snapshot(`${prefix}-a`, 'running'),
    });
  });

  it('retains the completed sentinel and canonical row through pruning', async () => {
    const workflowName = `retained-${randomUUID()}`;
    const runId = randomUUID();
    const canonical = snapshot(runId, 'success', { native: true });
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: canonical });
    const claimed = snapshot(runId, 'waiting', { product: true });
    await workflows.claimWorkflowSnapshotHandoff({
      workflowName,
      runId,
      expectedCanonical: { kind: 'present', snapshot: canonical },
      mutationFence: 'opaque-owner',
      snapshot: claimed,
    });
    await workflows.completeWorkflowSnapshotHandoff({
      workflowName,
      runId,
      expectedSnapshot: claimed,
      mutationFence: 'opaque-owner',
      snapshot: snapshot(runId, 'success', { product: 'final' }),
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    await workflows.prune({ workflowSnapshot: { maxAge: '0ms' } });

    await expect(workflows.loadWorkflowSnapshot({ workflowName, runId })).resolves.toMatchObject({ status: 'success' });
    await expect(workflows.listWorkflowSnapshotHandoffs({ workflowName, status: 'completed' })).resolves.toMatchObject({
      records: [{ workflowName, runId, status: 'completed' }],
      hasMore: false,
    });
    await expect(workflows.deleteWorkflowRunById({ workflowName, runId })).rejects.toThrow(/handoff fence/);
  });

  it('keeps enumerable Error fields in the persisted JSON projection', async () => {
    const workflowName = `enum-error-${randomUUID()}`;
    const runId = randomUUID();

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
    // divergence, not a replay.
    const divergentName = `${workflowName}-divergent`;
    const divergentError = Object.assign(new Error('boom'), {
      name: 'CustomError',
      cause: { reason: 'changed' },
      code: 'E_PERSISTED',
    });
    await workflows.persistWorkflowSnapshot({
      workflowName: divergentName,
      runId,
      snapshot: snapshot(runId, 'failed', { error: divergentError }),
    });
    await expect(
      workflows.claimWorkflowSnapshotHandoff({
        workflowName: divergentName,
        runId,
        expectedCanonical: { kind: 'present', snapshot: canonical },
        snapshot: snapshot(runId, 'waiting'),
        mutationFence: 'owner-b',
      }),
    ).resolves.toMatchObject({ status: 'conflict' });

    // A constructor-provided cause is non-enumerable: it stays out of the JSON
    // projection and does not create a phantom divergence.
    const specName = `${workflowName}-spec`;
    const specRunId = randomUUID();
    const specCanonical = snapshot(specRunId, 'failed', { error: new Error('wrapped', { cause: 'inner' }) });
    await workflows.persistWorkflowSnapshot({ workflowName: specName, runId: specRunId, snapshot: specCanonical });
    await expect(
      workflows.claimWorkflowSnapshotHandoff({
        workflowName: specName,
        runId: specRunId,
        expectedCanonical: { kind: 'present', snapshot: specCanonical },
        snapshot: snapshot(specRunId, 'waiting'),
        mutationFence: 'owner-c',
      }),
    ).resolves.toMatchObject({ status: 'created' });
  });

  it('orders cursor ties in code-point order including astral names', async () => {
    const prefix = `collate-${randomUUID()}`;
    const names = [`${prefix}-x￿`, `${prefix}-Ba`, `${prefix}-x💥`, `${prefix}-aB`];
    for (const workflowName of names) {
      await workflows.claimWorkflowSnapshotHandoff({
        workflowName,
        runId: `${prefix}-run`,
        expectedCanonical: { kind: 'absent' },
        snapshot: snapshot(`${prefix}-run`, 'waiting'),
        mutationFence: `${workflowName}-owner`,
      });
    }
    // Force identical updated_at so ordering must resolve on the key tiebreak.
    await store.db.none(
      `UPDATE mastra_workflow_snapshot_handoffs SET created_at = 515151, updated_at = 515151
       WHERE workflow_name LIKE $1`,
      [`${prefix}-%`],
    );

    // Code-point order (UTF-8 byte order via COLLATE "C"): 'B' < 'a' < 'x',
    // and U+FFFF precedes U+1F4A5 even though a UTF-16 code-unit compare would
    // invert the astral pair.
    const expected = [`${prefix}-Ba`, `${prefix}-aB`, `${prefix}-x￿`, `${prefix}-x💥`];
    const seen: string[] = [];
    let cursor: any;
    do {
      const page = await workflows.listWorkflowSnapshotHandoffs({ status: 'pending', limit: 2, after: cursor });
      for (const record of page.records) {
        if (record.workflowName.startsWith(prefix)) seen.push(record.workflowName);
      }
      cursor = page.nextCursor;
      if (!page.hasMore) break;
    } while (cursor);
    expect(seen).toEqual(expected);
  });

  it('pins every input field before caller serialization in claim', async () => {
    const workflowName = `aliased-${randomUUID()}`;
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
    await expect(workflows.listWorkflowSnapshotHandoffs({ workflowName })).resolves.toMatchObject({
      records: [{ runId: 'aliased-run' }],
    });
  });

  it('surfaces the typed fence error from every mutation path', async () => {
    const workflowName = `typed-fence-${randomUUID()}`;
    const runId = randomUUID();
    const terminal = { ...createEmptyWorkflowSnapshot(runId), status: 'success' as const };
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: terminal });
    const claimed = snapshot(runId, 'waiting', { product: true });
    await workflows.claimWorkflowSnapshotHandoff({
      workflowName,
      runId,
      expectedCanonical: { kind: 'present', snapshot: terminal },
      mutationFence: 'typed-owner',
      snapshot: claimed,
    });

    const fenced = [
      workflows.persistWorkflowStepUpdate({ workflowName, runId, snapshot: snapshot(runId, 'running') }),
      workflows.updateWorkflowResults({
        workflowName,
        runId,
        stepId: 'step',
        result: { status: 'success', output: {} },
        requestContext: {},
      }),
      workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: snapshot(runId, 'failed') }),
      workflows.deleteWorkflowRunById({ workflowName, runId }),
    ];
    // Attach rejection handlers before awaiting so none surface unhandled.
    await Promise.all(
      fenced.flatMap(promise => [
        expect(promise).rejects.toThrow(WorkflowSnapshotHandoffFenceError),
        expect(promise).rejects.toMatchObject({ code: 'WORKFLOW_SNAPSHOT_HANDOFF_FENCED' }),
      ]),
    );
  });
});
