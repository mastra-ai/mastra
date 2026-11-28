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

  it('creates a snapshot when results arrive for a run that does not exist yet', async () => {
    const runId = randomUUID();
    await store.updateWorkflowResults({
      workflowName,
      runId,
      stepId: 's1',
      result: { status: 'success', output: 1 } as any,
      requestContext: {},
    });

    const loaded = await store.loadWorkflowSnapshot({ workflowName, runId });
    expect(loaded?.context.s1).toBeDefined();
    expect(await runKeys(runId)).toEqual([canonicalKey(runId)]);
  });

  // Run IDs are free-form, so a canonical key whose run ID contains `:` is byte-identical to a
  // legacy `:resourceId:` key of a shorter run ID. Key shape alone cannot tell the two apart.
  const collidingRunId = 'r:resourceId:x';

  it('does not read a colon-named run as the legacy record of the run ID it collides with', async () => {
    await store.persistWorkflowSnapshot({
      workflowName,
      runId: collidingRunId,
      resourceId: 'other',
      snapshot: snapshot(collidingRunId),
    });

    // `r:resourceId:x` is a different run; it must not answer for `r`.
    expect(await store.loadWorkflowSnapshot({ workflowName, runId: 'r' })).toBeNull();
    expect(await store.getWorkflowRunById({ workflowName, runId: 'r' })).toBeNull();
    expect((await store.getWorkflowRunById({ workflowName, runId: collidingRunId }))?.runId).toBe(collidingRunId);
    expect((await store.loadWorkflowSnapshot({ workflowName, runId: collidingRunId }))?.runId).toBe(collidingRunId);
  });

  it('does not delete a colon-named run when deleting the run ID it collides with', async () => {
    await store.persistWorkflowSnapshot({
      workflowName,
      runId: collidingRunId,
      resourceId: 'other',
      snapshot: snapshot(collidingRunId),
    });

    await store.deleteWorkflowRunById({ workflowName, runId: 'r' });

    expect((await store.getWorkflowRunById({ workflowName, runId: collidingRunId }))?.runId).toBe(collidingRunId);
    expect(await client.get(canonicalKey(collidingRunId))).not.toBeNull();
  });

  it('lists and filters a colon-named run separately from the run ID it collides with', async () => {
    await writeLegacy('r', 'x', new Date('2025-01-01T00:00:00Z'));
    // A distinct resourceId keeps the two keys apart, so both runs can be listed at once.
    await store.persistWorkflowSnapshot({
      workflowName,
      runId: 'r:resourceId:y',
      resourceId: 'other',
      snapshot: snapshot('r:resourceId:y'),
    });

    const listed = await store.listWorkflowRuns({ workflowName });
    expect(listed.total).toBe(2);
    expect(listed.runs.map(run => run.runId).sort()).toEqual(['r', 'r:resourceId:y'].sort());

    const byLegacyResource = await store.listWorkflowRuns({ workflowName, resourceId: 'x' });
    expect(byLegacyResource.runs.map(run => run.runId)).toEqual(['r']);
    const byCollidingResource = await store.listWorkflowRuns({ workflowName, resourceId: 'other' });
    expect(byCollidingResource.runs.map(run => run.runId)).toEqual(['r:resourceId:y']);
  });

  it('does not inherit createdAt or resourceId from the run it collides with', async () => {
    const collidingCreatedAt = new Date('2020-01-01T00:00:00Z');
    await store.persistWorkflowSnapshot({
      workflowName,
      runId: collidingRunId,
      resourceId: 'other',
      createdAt: collidingCreatedAt,
      snapshot: snapshot(collidingRunId),
    });

    await store.persistWorkflowSnapshot({ workflowName, runId: 'r', resourceId: 'x', snapshot: snapshot('r') });

    const run = await store.getWorkflowRunById({ workflowName, runId: 'r' });
    expect(run!.createdAt.getTime()).toBeGreaterThan(collidingCreatedAt.getTime());
    expect(run!.resourceId).toBe('x');
  });

  it('does not delete the legacy run when deleting the colon-named run whose canonical key it occupies', async () => {
    await writeLegacy('r', 'x', new Date('2025-01-01T00:00:00Z'));

    // The canonical key of `r:resourceId:x` holds run `r`'s legacy record; deleting the colon-named
    // run must not destroy the run that actually owns the key.
    await store.deleteWorkflowRunById({ workflowName, runId: collidingRunId });

    expect((await store.loadWorkflowSnapshot({ workflowName, runId: 'r' }))?.runId).toBe('r');
    expect(await client.get(canonicalKey(collidingRunId))).not.toBeNull();

    // Deleting the owning run still removes it.
    await store.deleteWorkflowRunById({ workflowName, runId: 'r' });
    expect(await client.get(canonicalKey(collidingRunId))).toBeNull();
  });

  it('does not inherit createdAt or resourceId from the legacy run whose canonical key the run ID occupies', async () => {
    const legacyCreatedAt = new Date('2020-01-01T00:00:00Z');
    await writeLegacy('r', 'x', legacyCreatedAt);

    const before = Date.now();
    await store.persistWorkflowSnapshot({ workflowName, runId: collidingRunId, snapshot: snapshot(collidingRunId) });

    const run = await store.getWorkflowRunById({ workflowName, runId: collidingRunId });
    expect(run!.runId).toBe(collidingRunId);
    expect(run!.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(run!.resourceId).toBeUndefined();
  });

  it('reads the true legacy record when a colliding run shares the scanned key pattern', async () => {
    await writeLegacy('r', 'x', new Date('2025-01-01T00:00:00Z'));
    await store.persistWorkflowSnapshot({
      workflowName,
      runId: 'r:resourceId:y',
      resourceId: 'other',
      snapshot: snapshot('r:resourceId:y'),
    });

    // Both keys match the legacy pattern for `r`; only the record naming `r` may be returned.
    const loaded = await store.loadWorkflowSnapshot({ workflowName, runId: 'r' });
    expect(loaded?.runId).toBe('r');
    expect((await store.getWorkflowRunById({ workflowName, runId: 'r' }))?.resourceId).toBe('x');

    await store.deleteWorkflowRunById({ workflowName, runId: 'r' });
    expect(await store.loadWorkflowSnapshot({ workflowName, runId: 'r' })).toBeNull();
    expect((await store.getWorkflowRunById({ workflowName, runId: 'r:resourceId:y' }))?.runId).toBe('r:resourceId:y');
  });

  it('leaves a colliding run in a sibling workflow intact when deleting', async () => {
    const sibling = `wf-${randomUUID()}`;
    const siblingKey = getKey(TABLE_WORKFLOW_SNAPSHOT, {
      namespace: 'workflows',
      workflow_name: sibling,
      run_id: collidingRunId,
    });
    await store.persistWorkflowSnapshot({
      workflowName: sibling,
      runId: collidingRunId,
      resourceId: 'other',
      snapshot: snapshot(collidingRunId),
    });

    await store.deleteWorkflowRunById({ workflowName, runId: 'r' });

    expect(await client.get(siblingKey)).not.toBeNull();
  });

  it('does not hand a legacy record to the longer run ID whose canonical key it occupies', async () => {
    await writeLegacy('r', 'r2', new Date('2025-01-01T00:00:00Z'));

    // The legacy key of run `r` with resource `r2` is byte-identical to the canonical key of
    // run `r:resourceId:r2`, which is a different, non-existent run.
    expect(await store.loadWorkflowSnapshot({ workflowName, runId: 'r:resourceId:r2' })).toBeNull();
    expect(await store.getWorkflowRunById({ workflowName, runId: 'r:resourceId:r2' })).toBeNull();
    // The legacy record still answers for the run that owns it.
    expect((await store.loadWorkflowSnapshot({ workflowName, runId: 'r' }))?.runId).toBe('r');
  });

  it('treats glob metacharacters in the workflow name literally', async () => {
    const globName = 'wf[1]*?\\^-x';
    const runId = randomUUID();
    await store.persistWorkflowSnapshot({ workflowName: globName, runId, resourceId: 'r1', snapshot: snapshot(runId) });

    expect((await store.loadWorkflowSnapshot({ workflowName: globName, runId }))?.status).toBe('suspended');
    expect((await store.getWorkflowRunById({ workflowName: globName, runId }))?.resourceId).toBe('r1');
    expect((await store.listWorkflowRuns({ workflowName: globName })).total).toBe(1);
    // A sibling workflow whose name merely starts with the same characters must not leak in.
    await store.persistWorkflowSnapshot({
      workflowName: `${globName}-extra`,
      runId: randomUUID(),
      snapshot: snapshot(runId),
    });
    expect((await store.listWorkflowRuns({ workflowName: globName })).total).toBe(1);

    await store.deleteWorkflowRunById({ workflowName: globName, runId });
    expect(await store.loadWorkflowSnapshot({ workflowName: globName, runId })).toBeNull();
  });
});
