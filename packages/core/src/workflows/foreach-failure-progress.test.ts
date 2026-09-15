import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

/**
 * Regression tests for `foreach` losing per-iteration progress when an
 * iteration fails.
 *
 * The `foreach` loop already knows how to skip iterations that completed in a
 * previous attempt: it persists each iteration's result into
 * `__workflow_meta.foreachOutput` and, on re-entry, reuses every entry whose
 * status is `success` instead of re-running it. That machinery was only ever
 * fed by the *suspend* path, though — when an iteration threw, the loop
 * returned the failing iteration's error and dropped the accumulated progress
 * on the floor.
 *
 * The consequence (issue #21749) was that re-running a failed `foreach` —
 * whether through `run.timeTravel({ step })` or a plain re-run — restarted at
 * index 0 and executed the already-successful iterations a second time,
 * duplicating whatever external side effects they had (publishing, billing,
 * uploads, notifications).
 *
 * The fix persists the same `foreachOutput` metadata on the failure path, so
 * only iterations that did not succeed are retried.
 */
describe('foreach: per-iteration progress survives a failed iteration', () => {
  /**
   * Builds the reporter's reproduction: two items, where the *second* one
   * throws on its first attempt only. After the initial run each item has
   * executed exactly once; a subsequent recovery must only touch item 1.
   */
  const makeWorkflow = (executions: number[], concurrency: number) => {
    const seed = createStep({
      id: 'seed',
      inputSchema: z.object({}),
      outputSchema: z.array(z.number()),
      execute: async () => [0, 1],
    });

    const processItem = createStep({
      id: 'process-item',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => {
        executions[inputData] += 1;

        if (inputData === 1 && executions[inputData] === 1) {
          throw new Error('transient failure');
        }

        return inputData;
      },
    });

    const workflow = createWorkflow({
      id: 'foreach-failure-progress',
      inputSchema: z.object({}),
      outputSchema: z.array(z.number()),
      retryConfig: { attempts: 0 },
    })
      .then(seed)
      .foreach(processItem, { concurrency });

    workflow.commit();
    return workflow;
  };

  const setup = async (concurrency = 1) => {
    const executions = [0, 0];
    const storage = new MockStore();
    const workflow = makeWorkflow(executions, concurrency);
    new Mastra({
      workflows: { 'foreach-failure-progress': workflow },
      storage,
      logger: false,
    });

    const run = await workflow.createRun();
    const first = await run.start({ inputData: {} });

    expect(first.status).toBe('failed');
    // Item 0 succeeded, item 1 threw: each ran exactly once.
    expect(executions).toEqual([1, 1]);

    return { executions, run, storage };
  };

  const readForeachOutput = async (storage: MockStore, runId: string) => {
    const store = await storage.getStore('workflows');
    const snapshot = await store?.loadWorkflowSnapshot({
      workflowName: 'foreach-failure-progress',
      runId,
    });
    const stepCtx = snapshot?.context?.['process-item'] as
      | { status?: string; suspendPayload?: { __workflow_meta?: { foreachOutput?: any[] } } }
      | undefined;
    return { status: stepCtx?.status, foreachOutput: stepCtx?.suspendPayload?.__workflow_meta?.foreachOutput ?? [] };
  };

  it('does not re-run successful iterations when time travelling to the failed foreach', async () => {
    const { executions, run } = await setup();

    const result = await run.timeTravel({ step: 'process-item' });

    // Item 0 already succeeded, so it must not execute again. Only item 1 is retried.
    expect(executions).toEqual([1, 2]);
    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.result).toEqual([0, 1]);
  });

  it('records per-iteration progress on the failed foreach step result', async () => {
    const { run, storage } = await setup();

    // The durable half of the fix: the snapshot must remember which iterations
    // already succeeded. Without this, no re-entry path — time travel or
    // otherwise — has anything to skip.
    const { status, foreachOutput } = await readForeachOutput(storage, run.runId);

    expect(status).toBe('failed');
    expect(foreachOutput[0]?.status).toBe('success');
    expect(foreachOutput[0]?.output).toBe(0);
    // The iteration that threw must be recorded as failed so it is retried.
    expect(foreachOutput[1]?.status).toBe('failed');
  });

  it('leaves restart behaviour unchanged', async () => {
    const { executions, run } = await setup();

    // `restart` is crash recovery: on a run that already reached a terminal
    // state it returns the recorded snapshot rather than re-executing steps
    // (see parallel-nested-restart.test.ts). Recording foreach progress on the
    // failure result must not change that, in either direction — no iteration
    // is replayed, and none is newly skipped.
    const result = await run.restart();

    expect(executions).toEqual([1, 1]);
    expect(result.status).toBe('failed');
  });

  it('preserves successful iterations regardless of concurrent completion order', async () => {
    const executions = [0, 0, 0];
    const seed = createStep({
      id: 'out-of-order-seed',
      inputSchema: z.object({}),
      outputSchema: z.array(z.number()),
      execute: async () => [0, 1, 2],
    });
    const processItem = createStep({
      id: 'out-of-order-process-item',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => {
        executions[inputData]! += 1;
        if (inputData === 0) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        if (inputData === 1 && executions[inputData] === 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error('transient failure');
        }
        return inputData;
      },
    });
    const workflow = createWorkflow({
      id: 'out-of-order-foreach-failure-progress',
      inputSchema: z.object({}),
      outputSchema: z.array(z.number()),
      retryConfig: { attempts: 0 },
    })
      .then(seed)
      .foreach(processItem, { concurrency: 3 });
    workflow.commit();
    new Mastra({ workflows: { workflow }, storage: new MockStore(), logger: false });

    const run = await workflow.createRun();
    const first = await run.start({ inputData: {} });

    expect(first.status).toBe('failed');
    expect(executions).toEqual([1, 1, 1]);

    const result = await run.timeTravel({ step: 'out-of-order-process-item' });

    expect(executions).toEqual([1, 2, 1]);
    expect(result.status).toBe('success');
  });
});
