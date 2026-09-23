import { randomUUID } from 'node:crypto';
import { InMemoryDB, WorkflowsInMemory, createEmptyWorkflowSnapshot } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WorkflowsPG } from '.';

// PF-4385 tombstone reopen: a delayed result write from a deleted execution
// lifetime must not merge into the snapshot a reopened lifetime installed
// under the same runId. updateWorkflowResults fences the caller-supplied
// executionGeneration against the stored snapshot inside the row lock before
// any merge; a write that carries no generation keeps the legacy unguarded
// behavior. Cases run against both adapters to pin cross-adapter parity.
describe('WorkflowsPG updateWorkflowResults executionGeneration fence', () => {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT) || 5434,
    database: process.env.POSTGRES_DB || 'postgres',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  });
  const workflows = new WorkflowsPG({ pool });

  beforeAll(async () => {
    await workflows.init();
  });

  afterAll(async () => {
    await pool.end();
  });

  const result = (output: unknown) =>
    ({
      status: 'success',
      output,
      payload: {},
      startedAt: 1,
      endedAt: 2,
    }) as any;

  const cleanup = async (workflowName: string) => {
    await pool.query(`DELETE FROM mastra_workflow_snapshot WHERE workflow_name = $1`, [workflowName]);
    await pool.query(`DELETE FROM mastra_workflow_parent_revisions WHERE workflow_name = $1`, [workflowName]);
  };

  it('merges a result write carrying the snapshot execution generation', async () => {
    const workflowName = `wfeg-matching-${randomUUID()}`;
    const runId = 'run';
    const memory = new WorkflowsInMemory({ db: new InMemoryDB() });
    try {
      for (const store of [memory, workflows] as const) {
        const snapshot = createEmptyWorkflowSnapshot(runId);
        snapshot.status = 'running';
        snapshot.executionGeneration = 'wfeg:lifetime-b';
        await store.persistWorkflowSnapshot({ workflowName, runId, snapshot });

        await expect(
          store.updateWorkflowResults({
            workflowName,
            runId,
            stepId: 'step-1',
            result: result({ data: 'fresh' }),
            requestContext: {},
            executionGeneration: 'wfeg:lifetime-b',
          }),
        ).resolves.toEqual({
          'step-1': expect.objectContaining({ status: 'success', output: { data: 'fresh' } }),
        });
      }
    } finally {
      await cleanup(workflowName);
    }
  });

  it('fences a stale-lifetime write without merging into the reopened snapshot', async () => {
    const workflowName = `wfeg-reopened-${randomUUID()}`;
    const runId = 'run';
    const memory = new WorkflowsInMemory({ db: new InMemoryDB() });
    try {
      for (const store of [memory, workflows] as const) {
        // Lifetime B reopened the runId after lifetime A was deleted; a
        // delayed result write still carrying A's generation must no-op.
        const snapshot = createEmptyWorkflowSnapshot(runId);
        snapshot.status = 'running';
        snapshot.executionGeneration = 'wfeg:lifetime-b';
        await store.persistWorkflowSnapshot({ workflowName, runId, snapshot });

        await expect(
          store.updateWorkflowResults({
            workflowName,
            runId,
            stepId: 'step-1',
            result: result({ data: 'stale' }),
            requestContext: {},
            executionGeneration: 'wfeg:lifetime-a',
          }),
        ).resolves.toEqual({});

        await expect(store.loadWorkflowSnapshot({ workflowName, runId })).resolves.toMatchObject({
          executionGeneration: 'wfeg:lifetime-b',
          context: {},
        });
      }
    } finally {
      await cleanup(workflowName);
    }
  });

  it('fences a generation-carrying write against a snapshot with no stored lineage', async () => {
    const workflowName = `wfeg-unversioned-${randomUUID()}`;
    const runId = 'run';
    const memory = new WorkflowsInMemory({ db: new InMemoryDB() });
    try {
      for (const store of [memory, workflows] as const) {
        const snapshot = createEmptyWorkflowSnapshot(runId);
        snapshot.status = 'running';
        await store.persistWorkflowSnapshot({ workflowName, runId, snapshot });

        await expect(
          store.updateWorkflowResults({
            workflowName,
            runId,
            stepId: 'step-1',
            result: result({ data: 'stale' }),
            requestContext: {},
            executionGeneration: 'wfeg:lifetime-a',
          }),
        ).resolves.toEqual({});
        await expect(store.loadWorkflowSnapshot({ workflowName, runId })).resolves.toMatchObject({
          context: {},
        });
      }
    } finally {
      await cleanup(workflowName);
    }
  });

  it('fences a generation-carrying write against a missing row instead of resurrecting it', async () => {
    const workflowName = `wfeg-missing-${randomUUID()}`;
    const runId = 'run';
    const memory = new WorkflowsInMemory({ db: new InMemoryDB() });
    try {
      for (const store of [memory, workflows] as const) {
        await expect(
          store.updateWorkflowResults({
            workflowName,
            runId,
            stepId: 'step-1',
            result: result({ data: 'stale' }),
            requestContext: {},
            executionGeneration: 'wfeg:lifetime-a',
          }),
        ).resolves.toEqual({});
        await expect(store.loadWorkflowSnapshot({ workflowName, runId })).resolves.toBeNull();
      }
    } finally {
      await cleanup(workflowName);
    }
  });

  it('keeps unguarded merges for writes that carry no execution generation', async () => {
    const workflowName = `wfeg-legacy-${randomUUID()}`;
    const runId = 'run';
    const memory = new WorkflowsInMemory({ db: new InMemoryDB() });
    try {
      for (const store of [memory, workflows] as const) {
        const snapshot = createEmptyWorkflowSnapshot(runId);
        snapshot.status = 'running';
        snapshot.executionGeneration = 'wfeg:lifetime-b';
        await store.persistWorkflowSnapshot({ workflowName, runId, snapshot });

        await expect(
          store.updateWorkflowResults({
            workflowName,
            runId,
            stepId: 'step-1',
            result: result({ data: 'legacy' }),
            requestContext: {},
          }),
        ).resolves.toEqual({
          'step-1': expect.objectContaining({ status: 'success', output: { data: 'legacy' } }),
        });
      }
    } finally {
      await cleanup(workflowName);
    }
  });
});
