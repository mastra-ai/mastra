import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

// Regression coverage for https://github.com/mastra-ai/mastra/issues/27805
// A run canceled through another Mastra instance that shares storage (e.g. a second process)
// must stop before its next step and keep the persisted `canceled` status.
describe('cancel() from another Mastra instance sharing storage', () => {
  const workflowId = 'cancel-remote-run';

  const buildWorkflow = (hooks: { firstStep?: () => Promise<void>; laterStep?: () => void }) =>
    createWorkflow({
      id: workflowId,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { validateInputs: false },
    })
      .then(
        createStep({
          id: 'first',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => {
            await hooks.firstStep?.();
            return {};
          },
        }),
      )
      .then(
        createStep({
          id: 'later',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => {
            hooks.laterStep?.();
            return {};
          },
        }),
      )
      .commit();

  it('does not run later steps or overwrite the stored canceled status', async () => {
    const storage = new MockStore();

    let releaseFirstStep!: () => void;
    let firstStepStarted!: () => void;
    const firstStepStartedPromise = new Promise<void>(resolve => (firstStepStarted = resolve));
    let laterStepExecuted = false;

    const owner = new Mastra({
      workflows: {
        [workflowId]: buildWorkflow({
          firstStep: () =>
            new Promise<void>(resolve => {
              releaseFirstStep = resolve;
              firstStepStarted();
            }),
          laterStep: () => {
            laterStepExecuted = true;
          },
        }),
      },
      storage,
      logger: false,
    });
    const other = new Mastra({ workflows: { [workflowId]: buildWorkflow({}) }, storage, logger: false });

    const run = await owner.getWorkflow(workflowId).createRun();
    const resultPromise = run.start({ inputData: {} });
    await firstStepStartedPromise;

    const remoteRun = await other.getWorkflow(workflowId).createRun({ runId: run.runId });
    await remoteRun.cancel();

    const workflowsStore = await storage.getStore('workflows');
    const afterCancel = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflowId, runId: run.runId });
    expect(afterCancel?.status).toBe('canceled');

    releaseFirstStep();
    const result = await resultPromise;

    expect(laterStepExecuted).toBe(false);
    expect(result.status).toBe('canceled');
    const persisted = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflowId, runId: run.runId });
    expect(persisted?.status).toBe('canceled');
  });
});
