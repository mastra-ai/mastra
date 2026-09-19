import { randomUUID } from 'node:crypto';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { PostgresStore } from '../../index';

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
    await workflows.claimWorkflowSnapshotHandoff({
      workflowName,
      runId,
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
  });
});
