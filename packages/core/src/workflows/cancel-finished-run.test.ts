import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createWorkflow as createEventedWorkflow, createStep as createEventedStep } from './evented';
import { createStep } from './workflow';

// Regression coverage for https://github.com/mastra-ai/mastra/issues/25414
describe('cancel() on a finished run', () => {
  const engines = [
    ['default', createWorkflow, createStep],
    ['evented', createEventedWorkflow, createEventedStep],
  ] as const;

  describe.each(engines)('%s engine', (engine, makeWorkflow, makeStep) => {
    it.each([
      ['success', async () => ({})],
      [
        'failed',
        async () => {
          throw new Error('boom');
        },
      ],
    ] as const)('preserves %s status', async (expected, execute) => {
      const workflowId = `cancel-finished-${engine}-${expected}`;
      const workflow = (makeWorkflow as typeof createWorkflow)({
        id: workflowId,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        options: { validateInputs: false },
      })
        .then(
          (makeStep as typeof createStep)({
            id: 'step',
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            execute,
          }),
        )
        .commit();

      const storage = new MockStore();
      const mastra = new Mastra({ workflows: { [workflowId]: workflow }, storage, logger: false });
      if (engine === 'evented') await mastra.startEventEngine();

      try {
        const run = await mastra.getWorkflow(workflowId).createRun();
        const result = await run.start({ inputData: {} });
        expect(result.status).toBe(expected);

        await run.cancel();

        const store = await storage.getStore('workflows');
        const snapshot = await store?.loadWorkflowSnapshot({ workflowName: workflowId, runId: run.runId });
        expect(snapshot?.status).toBe(expected);
      } finally {
        if (engine === 'evented') await mastra.stopEventEngine();
      }
    });
  });
});
