import { randomUUID } from 'node:crypto';
import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { createClient } from 'redis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { RedisClient } from '../../types';
import { getKey } from '../utils';
import { WorkflowsRedis } from '.';

const url = 'redis://:redis_password@localhost:6380';

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

const legacyKey = (workflowName: string, runId: string, resourceId: string) =>
  getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows', workflow_name: workflowName, run_id: runId, resourceId });

describe('WorkflowsRedis resourceId keying', () => {
  let client: RedisClient;
  let store: WorkflowsRedis;
  let workflowName: string;

  const runKeys = async (runId: string) => {
    const keys: string[] = [];
    for await (const batch of (client as any).scanIterator({ MATCH: `*:run_id:${runId}*` })) {
      keys.push(...(Array.isArray(batch) ? batch : [batch]));
    }
    return keys;
  };

  const writeLegacy = async (runId: string, resourceId: string, createdAt: Date) => {
    await client.set(
      legacyKey(workflowName, runId, resourceId),
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
    client = createClient({ url }) as unknown as RedisClient;
    await (client as any).connect();
    store = new WorkflowsRedis({ client });
  });

  afterAll(async () => {
    await (client as any).quit();
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
    expect(await runKeys(runId)).toHaveLength(1);
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

    await store.updateWorkflowState({ workflowName, runId, opts: { status: 'running' } });
    const run = await store.getWorkflowRunById({ workflowName, runId });
    expect((run?.snapshot as WorkflowRunState).status).toBe('running');
    expect(run?.createdAt.toISOString()).toBe(createdAt.toISOString());
    expect(run?.resourceId).toBe('r1');

    const listed = await store.listWorkflowRuns({ workflowName, resourceId: 'r1' });
    expect(listed.total).toBe(1);
    expect((listed.runs[0]!.snapshot as WorkflowRunState).status).toBe('running');

    await store.deleteWorkflowRunById({ workflowName, runId });
    expect(await store.loadWorkflowSnapshot({ workflowName, runId })).toBeNull();
    expect(await runKeys(runId)).toHaveLength(0);
  });

  it('keeps createdAt when re-persisting a legacy run with its resourceId', async () => {
    const runId = randomUUID();
    const createdAt = new Date('2025-01-01T00:00:00Z');
    await writeLegacy(runId, 'r1', createdAt);

    const snapshot = await store.loadWorkflowSnapshot({ workflowName, runId });
    await store.persistWorkflowSnapshot({ workflowName, runId, resourceId: 'r1', snapshot: snapshot! });

    const run = await store.getWorkflowRunById({ workflowName, runId });
    expect(run?.createdAt.toISOString()).toBe(createdAt.toISOString());
  });

  it('filters listWorkflowRuns by resourceId on the record', async () => {
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
