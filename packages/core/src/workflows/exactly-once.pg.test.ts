import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../mastra';
import { createStep, createWorkflow } from './workflow';
import { PostgresStore } from '../../../../stores/pg/src/storage';

const PG_URL = process.env.PG_TEST_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

// Only run when a Postgres URL is provided
const maybe = PG_URL ? describe : describe.skip;

maybe('Exactly-once with Postgres', () => {
  let store: PostgresStore;
  let mastra: Mastra;

  beforeAll(async () => {
    store = new PostgresStore({ id: 'pg-test', connectionString: PG_URL! });
    await store.init();
  }, 30000);

  afterAll(async () => {
    // nothing specific to close for pg-promise
  });

  it('acquires exclusive lock on restart (second caller blocked)', async () => {
    const wf = createWorkflow({
      id: 'xo-wf-lock',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
    });
    const step = createStep({
      id: 'one',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });
    wf.then(step).commit();

    mastra = new Mastra({ storage: store, workflows: { 'xo-wf-lock': wf } });

    const runId = 'xo-lock-run';
    // Seed a running snapshot to allow restart
    await store.persistWorkflowSnapshot({
      workflowName: wf.id,
      runId,
      snapshot: {
        runId,
        status: 'running',
        value: {},
        context: { input: {} },
        activePaths: [0],
        activeStepsPath: { one: [0] },
        serializedStepGraph: [],
        suspendedPaths: {},
        waitingPaths: {},
        resumeLabels: {},
        timestamp: Date.now(),
      } as any,
    });

    const run1 = await wf.createRun({ runId });
    const run2 = await wf.createRun({ runId });

    const p1 = run1.restart();
    const p2 = run2.restart();

    let failed = 0;
    try {
      await p1;
    } catch {
      failed++;
    }
    try {
      await p2;
    } catch {
      failed++;
    }
    // Exactly one should fail to acquire lock
    expect(failed).toBe(1);
  }, 30000);

  it('CAS fencing rejects writes with mismatched token', async () => {
    const wfName = 'xo-wf-cas';
    const runId = 'xo-cas-run';

    // Acquire lock to register metadata (token)
    const ok = await store.tryAcquireWorkflowRunLock({ workflowName: wfName, runId });
    expect(ok).toBe(true);
    const info = await store.getWorkflowRunLock({ workflowName: wfName, runId });
    expect(info?.holder).toBeTruthy();

    // Attempt to persist with wrong fencingToken
    await expect(
      store.persistWorkflowSnapshot({
        workflowName: wfName,
        runId,
        snapshot: {
          runId,
          status: 'running',
          value: {},
          context: { input: {} },
          activePaths: [],
          activeStepsPath: {},
          serializedStepGraph: [],
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          fencingToken: 'not-the-token',
          timestamp: Date.now(),
        } as any,
      }),
    ).rejects.toThrowError(/CAS_MISMATCH/i);

    // Cleanup
    await store.releaseWorkflowRunLock({ workflowName: wfName, runId });
  }, 30000);
});

