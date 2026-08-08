import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

/**
 * Regression tests for issue-02:
 *
 *   Workflow cancel() did not interrupt sleep()/sleepUntil() — the run kept
 *   executing for the full duration and then overwrote the canceled status
 *   with 'running' and published a sleep-step 'success'.
 *
 * Expected behaviour:
 *   - cancel() interrupts an in-flight sleep immediately (no full-duration wait),
 *   - the downstream step never runs,
 *   - the result settles as 'canceled', and
 *   - the persisted status is 'canceled' and is NOT flipped back to 'running' /
 *     'success' after cancellation.
 */
describe('workflow cancel interrupts sleep (issue-02)', () => {
  const noopStep = (id: string, fn = vi.fn().mockResolvedValue({})) =>
    createStep({
      id,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: fn,
    });

  it('cancel() during .sleep() interrupts immediately and the run stays canceled', async () => {
    const SLEEP_MS = 60_000;
    const afterSleep = vi.fn().mockResolvedValue({});

    const workflow = createWorkflow({
      id: 'cancel-sleep-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { validateInputs: false },
    })
      .then(noopStep('a'))
      .sleep(SLEEP_MS)
      .then(noopStep('b', afterSleep))
      .commit();

    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { 'cancel-sleep-wf': workflow } });

    const run = await workflow.createRun();

    const startedAt = Date.now();
    const resultPromise = run.start({ inputData: {} });
    setTimeout(() => void run.cancel(), 200);

    const result = await resultPromise;
    const elapsed = Date.now() - startedAt;

    // The wait is interrupted — we settle far sooner than the 60s duration.
    expect(elapsed).toBeLessThan(5_000);
    // The step after the sleep never runs.
    expect(afterSleep).not.toHaveBeenCalled();
    // The result settles as canceled, not success.
    expect(result.status).toBe('canceled');

    // Storage reflects 'canceled' and was not overwritten back to 'running'/'success'.
    const store = await storage.getStore('workflows');
    const snapshot = await store?.loadWorkflowSnapshot({
      workflowName: 'cancel-sleep-wf',
      runId: run.runId,
    });
    expect(snapshot?.status).toBe('canceled');
  }, 15_000);

  it('cancel() during .sleepUntil() interrupts immediately and the run stays canceled', async () => {
    const afterSleep = vi.fn().mockResolvedValue({});

    const workflow = createWorkflow({
      id: 'cancel-sleep-until-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { validateInputs: false },
    })
      .then(noopStep('a'))
      .sleepUntil(new Date(Date.now() + 60_000))
      .then(noopStep('b', afterSleep))
      .commit();

    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { 'cancel-sleep-until-wf': workflow } });

    const run = await workflow.createRun();

    const startedAt = Date.now();
    const resultPromise = run.start({ inputData: {} });
    setTimeout(() => void run.cancel(), 200);

    const result = await resultPromise;
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeLessThan(5_000);
    expect(afterSleep).not.toHaveBeenCalled();
    expect(result.status).toBe('canceled');

    const store = await storage.getStore('workflows');
    const snapshot = await store?.loadWorkflowSnapshot({
      workflowName: 'cancel-sleep-until-wf',
      runId: run.runId,
    });
    expect(snapshot?.status).toBe('canceled');
  }, 15_000);
});
