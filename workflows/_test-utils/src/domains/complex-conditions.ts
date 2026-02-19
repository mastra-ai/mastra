/**
 * Complex Conditions tests for workflows
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';

/**
 * Create all workflows needed for complex conditions tests.
 */
export function createComplexConditionsWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Test: should handle nested AND/OR conditions
  {
    const step1Action = vi.fn().mockResolvedValue({
      status: 'partial',
      score: 75,
      flags: { isValid: true },
    });
    const step2Action = vi.fn().mockResolvedValue({ result: 'step2' });
    const step3Action = vi.fn().mockResolvedValue({ result: 'step3' });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({
        status: z.string(),
        score: z.number(),
        flags: z.object({ isValid: z.boolean() }),
      }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({
        status: z.string(),
        score: z.number(),
        flags: z.object({ isValid: z.boolean() }),
      }),
      outputSchema: z.object({ result: z.string() }),
    });
    const step3 = createStep({
      id: 'step3',
      execute: step3Action,
      inputSchema: z.object({
        result: z.string(),
      }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'complex-nested-and-or',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow
      .then(step1)
      .branch([
        [
          async ({ getStepResult }) => {
            const step1Result = getStepResult(step1);
            return step1Result?.status === 'success' || (step1Result?.status === 'partial' && step1Result?.score >= 70);
          },
          step2,
        ],
      ])
      .map({
        result: {
          step: step2,
          path: 'result',
        },
      })
      .branch([
        [
          async ({ inputData, getStepResult }) => {
            const step1Result = getStepResult(step1);
            return !inputData.result || step1Result?.score < 70;
          },
          step3,
        ],
      ])
      .map({
        result: {
          step: step3,
          path: 'result',
        },
      })
      .commit();

    workflows['complex-nested-and-or'] = {
      workflow,
      mocks: { step1Action, step2Action, step3Action },
    };
  }

  return workflows;
}

/**
 * Create tests for complex conditions.
 */
export function createComplexConditionsTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute } = ctx;

  describe('Complex Conditions', () => {
    it('should handle nested AND/OR conditions', async () => {
      const { workflow, mocks } = registry!['complex-nested-and-or']!;
      const result = await execute(workflow, {});

      expect(mocks.step2Action).toHaveBeenCalled();
      expect(mocks.step3Action).not.toHaveBeenCalled();
      expect(result.steps.step2).toMatchObject({
        status: 'success',
        output: { result: 'step2' },
        payload: {
          status: 'partial',
          score: 75,
          flags: { isValid: true },
        },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });
  });
}
