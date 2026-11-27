import { randomUUID } from 'node:crypto';
import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { GlideValkeyClient } from '../../../client';
import { getKey } from '../utils';
import { WorkflowsValkey } from '.';

const snapshot = (runId: string, status: WorkflowRunState['status'] = 'suspended'): WorkflowRunState =>
  ({
    runId,
    status,
    value: {},
    context: {},
    activePaths: [],
    activeStepsPath: {},
    serializedStepGraph: [],
    suspendedPaths: {},
    resumeLabels: {},
    waitingPaths: {},
    requestContext: {},
    timestamp: Date.now(),
  }) as WorkflowRunState;

describe('WorkflowsValkey resourceId keying', () => {
  let client: GlideValkeyClient;
  let store: WorkflowsValkey;
  let workflowName: string;

  // Runs stored before the resourceId was folded out of the key: the canonical key plus a
  // trailing `:resourceId:<id>` segment. Seeded directly so we can prove read compatibility.
  const legacyKey = (runId: string, resourceId: string) =>
    getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows', workflow_name: workflowName, run_id: runId, resourceId });

  const canonicalKey = (runId: string) =>
    getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows', workflow_name: workflowName, run_id: runId });

  const runKeys = async (runId: string) => {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const result = await client.scan(cursor, { MATCH: `*:run_id:${runId}*`, COUNT: 1000 });
      keys.push(...result.keys);
      cursor = result.cursor;
    } while (cursor !== '0');
    return keys;
  };

  const writeLegacy = async (runId: string, resourceId: string, createdAt: Date) => {
    await client.set(
      legacyKey(runId, resourceId),
      JSON.stringify({
        namespace: 'workflows',
        workflow_name: workflowName,
        run_id: runId,
        resourceId,
        snapshot: snapshot(runId),
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
      }),
    );
  };

  beforeAll(async () => {
    client = new GlideValkeyClient({
      addresses: [{ host: 'localhost', port: 6382 }],
      credentials: { password: 'valkey_password' },
    });
    await client.connect();
    store = new WorkflowsValkey({ client });
  });

  afterAll(async () => {
    await client.quit();
  });

  beforeEach(() => {
    workflowName = `wf-${randomUUID()}`;
  });

  it('loads, updates and deletes a run persisted with a resourceId', async () => {
    const runId = randomUUID();
    await store.persistWorkflowSnapshot({ workflowName, runId, resourceId: 'r1', snapshot: snapshot(runId) });

    expect((await store.loadWorkflowSnapshot({ workflowName, runId }))?.status).toBe('suspended');
    expect((await store.getWorkflowRunById({ workflowName, runId }))?.resourceId).toBe('r1');
    expect((await store.getWorkflowRunById({ runId }))?.resourceId).toBe('r1');

    await store.updateWorkflowState({ workflowName, runId, opts: { status: 'running' } });
    await store.updateWorkflowResults({
      workflowName,
      runId,
      stepId: 's1',
      result: { status: 'success', output: 1 } as any,
      requestContext: {},
    });

    const loaded = await store.loadWorkflowSnapshot({ workflowName, runId });
    expect(loaded?.status).toBe('running');
    expect(loaded?.context.s1).toBeDefined();
    // The resourceId lives on the record, not in the key: only the canonical key may exist.
    expect(await runKeys(runId)).toEqual([canonicalKey(runId)]);
    expect((await store.getWorkflowRunById({ workflowName, runId }))?.resourceId).toBe('r1');

    await store.deleteWorkflowRunById({ workflowName, runId });
    expect(await store.loadWorkflowSnapshot({ workflowName, runId })).toBeNull();
    expect(await runKeys(runId)).toHaveLength(0);
  });

  it('reads, updates and deletes runs stored under legacy resourceId keys', async () => {
    const runId = randomUUID();
    const createdAt = new Date('2025-01-01T00:00:00Z');
    await writeLegacy(runId, 'r1', createdAt);

    expect((await store.loadWorkflowSnapshot({ workflowName, runId }))?.status).toBe('suspended');
    expect((await store.getWorkflowRunById({ workflowName, runId }))?.resourceId).toBe('r1');
    expect((await store.getWorkflowRunById({ runId }))?.resourceId).toBe('r1');

    await store.updateWorkflowState({ workflowName, runId, opts: { status: 'running' } });
    const run = await store.getWorkflowRunById({ workflowName, runId });
    expect((run?.snapshot as WorkflowRunState).status).toBe('running');
    expect(run?.createdAt.toISOString()).toBe(createdAt.toISOString());
    expect(run?.resourceId).toBe('r1');

    const listed = await store.listWorkflowRuns({ workflowName, resourceId: 'r1' });
    expect(listed.total).toBe(1);
    expect((listed.runs[0]!.snapshot as WorkflowRunState).status).toBe('running');
    // The legacy copy and the canonical copy must not surface as two runs.
    expect((await store.listWorkflowRuns({ workflowName })).total).toBe(1);

    await store.deleteWorkflowRunById({ workflowName, runId });
    expect(await store.loadWorkflowSnapshot({ workflowName, runId })).toBeNull();
    expect(await runKeys(runId)).toHaveLength(0);
  });

  it('keeps createdAt and resourceId when re-persisting a legacy run', async () => {
    const runId = randomUUID();
    const createdAt = new Date('2025-01-01T00:00:00Z');
    await writeLegacy(runId, 'r1', createdAt);

    const loaded = await store.loadWorkflowSnapshot({ workflowName, runId });
    await store.persistWorkflowSnapshot({ workflowName, runId, resourceId: 'r1', snapshot: loaded! });

    const run = await store.getWorkflowRunById({ workflowName, runId });
    expect(run?.createdAt.toISOString()).toBe(createdAt.toISOString());
    expect(run?.resourceId).toBe('r1');
    expect(run!.updatedAt.getTime()).toBeGreaterThan(createdAt.getTime());
    // Re-persisting writes canonical from now on.
    expect(await runKeys(runId)).toContain(canonicalKey(runId));
  });

  it('filters listWorkflowRuns by the stored resourceId across key generations', async () => {
    const [a, b, c, legacy] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    await store.persistWorkflowSnapshot({ workflowName, runId: a, resourceId: 'r1', snapshot: snapshot(a) });
    await store.persistWorkflowSnapshot({ workflowName, runId: b, resourceId: 'r2', snapshot: snapshot(b) });
    await store.persistWorkflowSnapshot({ workflowName, runId: c, snapshot: snapshot(c) });
    await writeLegacy(legacy, 'r1', new Date());

    expect((await store.listWorkflowRuns({ workflowName })).total).toBe(4);
    const r1 = await store.listWorkflowRuns({ workflowName, resourceId: 'r1' });
    expect(r1.runs.map(r => r.runId).sort()).toEqual([a, legacy].sort());
    const r1Any = await store.listWorkflowRuns({ resourceId: 'r1' });
    expect(r1Any.runs.filter(r => r.workflowName === workflowName)).toHaveLength(2);
  });
});
