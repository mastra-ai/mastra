/**
 * Run count tests for workflows
 *
 * Tests that runCount and retryCount are properly provided to step execute functions.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';

/**
 * Create all workflows needed for run count tests.
 */
export function createRunCountWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Test: retryCount should exist and equal zero for the first run
  {
    const step1Action = vi.fn().mockImplementation(async ({ retryCount }) => {
      return { count: retryCount };
    });
    const step2Action = vi.fn().mockImplementation(async ({ retryCount }) => {
      return { count: retryCount };
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ count: z.number() }),
      outputSchema: z.object({ count: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'run-count-basic-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['run-count-basic-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action },
    };
  }

  // Test: multiple steps should have different run counts (using loops)
  {
    const step1 = createStep({
      id: 'step1',
      inputSchema: z.object({ count: z.number() }),
      outputSchema: z.object({ count: z.number() }),
      execute: async ({ inputData }) => {
        return { count: inputData.count + 1 };
      },
    });

    const step2 = createStep({
      id: 'step2',
      inputSchema: z.object({ count: z.number() }),
      outputSchema: z.object({ count: z.number() }),
      execute: async ({ inputData }) => {
        return { count: inputData.count + 1 };
      },
    });

    const workflow = createWorkflow({
      id: 'run-count-loop-workflow',
      inputSchema: z.object({ count: z.number() }),
      outputSchema: z.object({ count: z.number() }),
    });

    workflow
      .dowhile(step1, async ({ inputData }) => inputData.count < 3)
      .dountil(step2, async ({ inputData }) => inputData.count === 10)
      .commit();

    workflows['run-count-loop-workflow'] = {
      workflow,
      mocks: {},
    };
  }

  // Test: each loop iteration starts with retryCount 0 and its own retry budget
  {
    const recorder = { retryCounts: [] as number[], thrown: false };

    const body = createStep({
      id: 'body',
      inputSchema: z.object({ iteration: z.number() }),
      outputSchema: z.object({ iteration: z.number() }),
      retries: 1,
      execute: async ({ inputData, retryCount }) => {
        recorder.retryCounts.push(retryCount);
        const iteration = inputData.iteration + 1;
        if (iteration === 3 && !recorder.thrown) {
          recorder.thrown = true;
          throw new Error('Transient failure in iteration 3');
        }
        return { iteration };
      },
    });

    const workflow = createWorkflow({
      id: 'run-count-loop-retry-workflow',
      inputSchema: z.object({ iteration: z.number() }),
      outputSchema: z.object({ iteration: z.number() }),
    });

    workflow.dountil(body, async ({ iterationCount }) => iterationCount >= 4).commit();

    workflows['run-count-loop-retry-workflow'] = {
      workflow,
      mocks: { recorder },
      resetMocks: () => {
        recorder.retryCounts = [];
        recorder.thrown = false;
      },
    };
  }

  return workflows;
}

export function createRunCountTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('Run Count', () => {
    it.skipIf(skipTests.runCount)('retryCount should exist and equal zero for the first run', async () => {
      const { workflow, mocks } = registry!['run-count-basic-workflow']!;

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(mocks.step1Action).toHaveBeenCalledTimes(1);
      expect(mocks.step2Action).toHaveBeenCalledTimes(1);
      // retryCount should be 0 for first run
      expect(mocks.step1Action).toHaveBeenCalledWith(expect.objectContaining({ retryCount: 0 }));
      expect(mocks.step2Action).toHaveBeenCalledWith(expect.objectContaining({ retryCount: 0 }));
    });

    it.skipIf(skipTests.retryCount)('multiple steps should have different run counts in loops', async () => {
      const { workflow } = registry!['run-count-loop-workflow']!;

      const result = await execute(workflow, { count: 0 });

      expect(result.status).toBe('success');
      // step1 increments count each iteration, loops while count < 3: 0→1→2→3 (stops)
      expect(result.steps.step1).toHaveProperty('output', { count: 3 });
      // step2 continues from 3, loops until count === 10: 3→4→5→6→7→8→9→10 (stops)
      expect(result.steps.step2).toHaveProperty('output', { count: 10 });
    });

    it.skipIf(skipTests.retryCount)(
      'a loop body that fails once in a later iteration still gets its retry',
      async () => {
        const { workflow, mocks, resetMocks } = registry!['run-count-loop-retry-workflow']!;
        resetMocks!();

        const result = await execute(workflow, { iteration: 0 });

        // Iteration 3 fails on attempt 0 and succeeds on attempt 1.
        expect(mocks.recorder.retryCounts).toEqual([0, 0, 0, 1, 0]);
        expect(result.status).toBe('success');
        expect(result.steps.body).toHaveProperty('output', { iteration: 4 });
      },
    );
  });
}
