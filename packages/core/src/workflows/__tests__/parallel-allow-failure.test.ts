import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createStep, createWorkflow } from '../workflow';

describe('Parallel Steps with allowFailure', () => {
  it('should allow failed steps when allowFailure is true', async () => {
    const successStep = createStep({
      id: 'success-step',
      inputSchema: z.any(),
      outputSchema: z.object({ value: z.string() }),
      execute: async () => {
        return { value: 'ok' };
      },
    });

    const failingStep = createStep({
      id: 'failing-step',
      inputSchema: z.any(),
      outputSchema: z.object({ value: z.string() }),
      execute: async () => {
        throw new Error('Step execution failed');
      },
    });

    const downstream = createStep({
      id: 'downstream',
      inputSchema: z.object({
        'success-step': z.object({ value: z.string() }).nullable(),
        'failing-step': z.object({ value: z.string() }).nullable(),
      }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ({ inputData }) => {
        const successResult = inputData['success-step'];
        const failedResult = inputData['failing-step'];
        return {
          result: `success=${successResult?.value ?? 'none'}, failed=${failedResult === null ? 'yes' : 'no'}`,
        };
      },
    });

    const workflow = createWorkflow({
      id: 'allow-failure-basic',
      inputSchema: z.any(),
      outputSchema: z.any(),
    })
      .parallel([successStep, failingStep], { allowFailure: true })
      .then(downstream)
      .commit();

    const run = await workflow.createRun({ runId: 'test-allow-failure-basic' });
    const result = await run.start({ inputData: {} });

    // The parallel block should succeed
    expect(result.status).toBe('success');

    // Individual step results should be tracked
    expect(result.steps['success-step']?.status).toBe('success');
    expect(result.steps['failing-step']?.status).toBe('failed');

    // Downstream step should have received null for the failed step
    expect(result.steps.downstream?.status).toBe('success');
    expect((result.steps.downstream as any)?.output?.result).toBe('success=ok, failed=yes');
  });

  it('should still fail the parallel block without allowFailure', async () => {
    const successStep = createStep({
      id: 'success-step',
      inputSchema: z.any(),
      outputSchema: z.object({ value: z.string() }),
      execute: async () => {
        return { value: 'ok' };
      },
    });

    const failingStep = createStep({
      id: 'failing-step',
      inputSchema: z.any(),
      outputSchema: z.object({ value: z.string() }),
      execute: async () => {
        throw new Error('Step execution failed');
      },
    });

    const workflow = createWorkflow({
      id: 'no-allow-failure',
      inputSchema: z.any(),
      outputSchema: z.any(),
    })
      .parallel([successStep, failingStep])
      .commit();

    const run = await workflow.createRun({ runId: 'test-no-allow-failure' });
    const result = await run.start({ inputData: {} });

    // Without allowFailure, the whole workflow should fail
    expect(result.status).toBe('failed');
  });

  it('should handle all steps failing with allowFailure', async () => {
    const failing1 = createStep({
      id: 'failing-1',
      inputSchema: z.any(),
      outputSchema: z.object({ value: z.string() }),
      execute: async () => {
        throw new Error('Fail 1');
      },
    });

    const failing2 = createStep({
      id: 'failing-2',
      inputSchema: z.any(),
      outputSchema: z.object({ value: z.string() }),
      execute: async () => {
        throw new Error('Fail 2');
      },
    });

    const downstream = createStep({
      id: 'downstream',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async ({ inputData }) => {
        return {
          allNull: inputData['failing-1'] === null && inputData['failing-2'] === null,
        };
      },
    });

    const workflow = createWorkflow({
      id: 'all-fail-allow-failure',
      inputSchema: z.any(),
      outputSchema: z.any(),
    })
      .parallel([failing1, failing2], { allowFailure: true })
      .then(downstream)
      .commit();

    const run = await workflow.createRun({ runId: 'test-all-fail' });
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('success');
    expect(result.steps['failing-1']?.status).toBe('failed');
    expect(result.steps['failing-2']?.status).toBe('failed');
    expect(result.steps.downstream?.status).toBe('success');
    expect((result.steps.downstream as any)?.output?.allNull).toBe(true);
  });

  it('should suspend correctly when one step suspends and another fails with allowFailure', async () => {
    const suspendingStep = createStep({
      id: 'suspending-step',
      inputSchema: z.any(),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ suspend }) => {
        await suspend();
        return { value: 'resumed' };
      },
    });

    const failingStep = createStep({
      id: 'failing-step',
      inputSchema: z.any(),
      outputSchema: z.object({ value: z.string() }),
      execute: async () => {
        throw new Error('Step execution failed');
      },
    });

    const workflow = createWorkflow({
      id: 'suspend-and-fail',
      inputSchema: z.any(),
      outputSchema: z.any(),
    })
      .parallel([suspendingStep, failingStep], { allowFailure: true })
      .commit();

    const run = await workflow.createRun({ runId: 'test-suspend-and-fail' });
    const result = await run.start({ inputData: {} });

    // Suspend should take priority over allowed failure
    expect(result.status).toBe('suspended');
  });
});
