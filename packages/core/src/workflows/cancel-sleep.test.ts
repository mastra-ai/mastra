import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

// Regression coverage for https://github.com/mastra-ai/mastra/issues/17908
describe('workflow sleep cancellation', () => {
  const noopStep = (id: string, execute = vi.fn().mockResolvedValue({})) =>
    createStep({
      id,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute,
    });

  async function waitForWaitingStatus(storage: MockStore, workflowName: string, runId: string) {
    const store = await storage.getStore('workflows');

    await vi.waitFor(async () => {
      const snapshot = await store?.loadWorkflowSnapshot({ workflowName, runId });
      expect(snapshot?.status).toBe('waiting');
    });

    return store;
  }

  it.each([
    ['sleep', (workflow: ReturnType<typeof createWorkflow>) => workflow.sleep(60_000)],
    ['sleepUntil', (workflow: ReturnType<typeof createWorkflow>) => workflow.sleepUntil(new Date(Date.now() + 60_000))],
  ] as const)('cancel() interrupts %s and preserves the canceled status', async (_, addSleep) => {
    const afterSleep = vi.fn().mockResolvedValue({});
    const workflowId = `cancel-${_}-workflow`;
    const workflow = addSleep(
      createWorkflow({
        id: workflowId,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        options: { validateInputs: false },
      }).then(noopStep('before-sleep')),
    )
      .then(noopStep('after-sleep', afterSleep))
      .commit();

    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { [workflowId]: workflow } });
    const run = await workflow.createRun();
    const resultPromise = run.start({ inputData: {} });
    const store = await waitForWaitingStatus(storage, workflowId, run.runId);

    await run.cancel();
    const result = await resultPromise;

    expect(result.status).toBe('canceled');
    expect(afterSleep).not.toHaveBeenCalled();

    const snapshot = await store?.loadWorkflowSnapshot({ workflowName: workflowId, runId: run.runId });
    expect(snapshot?.status).toBe('canceled');
  });

  it('completes a sleep normally when the run is not canceled', async () => {
    const afterSleep = vi.fn().mockResolvedValue({});
    const workflow = createWorkflow({
      id: 'normal-sleep-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { validateInputs: false },
    })
      .then(noopStep('before-sleep'))
      .sleep(10)
      .then(noopStep('after-sleep', afterSleep))
      .commit();

    new Mastra({ logger: false, workflows: { 'normal-sleep-workflow': workflow } });
    const run = await workflow.createRun();
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('success');
    expect(afterSleep).toHaveBeenCalledOnce();
  });
});
