/**
 * Multiple chains tests for workflows
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';

/**
 * Create all workflows needed for multiple chains tests.
 */
export function createMultipleChainsWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Test: should run multiple chains in parallel
  {
    const step1 = createStep({
      id: 'step1',
      execute: vi.fn().mockResolvedValue({ result: 'success1' }),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    const step2 = createStep({
      id: 'step2',
      execute: vi.fn().mockResolvedValue({ result: 'success2' }),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    const step3 = createStep({
      id: 'step3',
      execute: vi.fn().mockResolvedValue({ result: 'success3' }),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    const step4 = createStep({
      id: 'step4',
      execute: vi.fn().mockResolvedValue({ result: 'success4' }),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    const step5 = createStep({
      id: 'step5',
      execute: vi.fn().mockResolvedValue({ result: 'success5' }),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'chains-parallel',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      steps: [step1, step2, step3, step4, step5],
    });
    workflow
      .parallel([
        createWorkflow({
          id: 'nested-a',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          steps: [step1, step2, step3],
        })
          .then(step1)
          .then(step2)
          .then(step3)
          .commit(),
        createWorkflow({
          id: 'nested-b',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          steps: [step4, step5],
        })
          .then(step4)
          .then(step5)
          .commit(),
      ])
      .commit();

    workflows['chains-parallel'] = { workflow, mocks: {} };
  }

  return workflows;
}

/**
 * Create tests for multiple chains.
 */
export function createMultipleChainsTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute } = ctx;

  describe('multiple chains', () => {
    // Extra settling time for parallel nested workflow tests - these create more
    // concurrent Inngest invocations and can overwhelm the dev server
    beforeAll(async () => {
      console.log('[multiple-chains] Extra 5s settling time before parallel nested workflow tests...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    });

    it('should run multiple chains in parallel', async () => {
      const { workflow } = registry!['chains-parallel']!;
      const result = await execute(workflow, {});

      expect(result.steps['nested-a']).toMatchObject({
        status: 'success',
        output: { result: 'success3' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result.steps['nested-b']).toMatchObject({
        status: 'success',
        output: { result: 'success5' },
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
    });
  });
}
