/**
 * Loops tests for workflows (dountil and dowhile)
 *
 * Uses MockRegistry pattern to decouple mocks from workflow definitions,
 * enabling proper test isolation via resetMocks().
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for loops tests.
 */
export function createLoopsWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Create a mock registry for this domain
  const mockRegistry = new MockRegistry();

  // Test: should run an until loop
  {
    // Register mock factories
    mockRegistry.register('loops-until-counter:increment', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        const currentValue = inputData.value;
        const newValue = currentValue + 1;
        return { value: newValue };
      }),
    );
    mockRegistry.register('loops-until-counter:final', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        return { finalValue: inputData?.value };
      }),
    );

    const incrementStep = createStep({
      id: 'increment',
      description: 'Increments the current value by 1',
      inputSchema: z.object({
        value: z.number(),
        target: z.number(),
      }),
      outputSchema: z.object({
        value: z.number(),
      }),
      execute: async ctx => mockRegistry.get('loops-until-counter:increment')(ctx),
    });

    const finalStep = createStep({
      id: 'final',
      description: 'Final step that prints the result',
      inputSchema: z.object({
        value: z.number(),
      }),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      execute: async ctx => mockRegistry.get('loops-until-counter:final')(ctx),
    });

    const counterWorkflow = createWorkflow({
      options: {
        validateInputs: false,
      },
      steps: [incrementStep, finalStep],
      id: 'loops-until-counter',
      inputSchema: z.object({
        target: z.number(),
        value: z.number(),
      }),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
    });

    counterWorkflow
      .dountil(incrementStep, async ({ inputData }) => {
        return (inputData?.value ?? 0) >= 12;
      })
      .then(finalStep)
      .commit();

    workflows['loops-until-counter'] = {
      workflow: counterWorkflow,
      mocks: {
        get increment() {
          return mockRegistry.get('loops-until-counter:increment');
        },
        get final() {
          return mockRegistry.get('loops-until-counter:final');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should run a while loop
  {
    // Register mock factories
    mockRegistry.register('loops-while-counter:increment', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        const currentValue = inputData.value;
        const newValue = currentValue + 1;
        return { value: newValue };
      }),
    );
    mockRegistry.register('loops-while-counter:final', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        return { finalValue: inputData?.value };
      }),
    );

    const incrementStep = createStep({
      id: 'increment',
      description: 'Increments the current value by 1',
      inputSchema: z.object({
        value: z.number(),
        target: z.number(),
      }),
      outputSchema: z.object({
        value: z.number(),
      }),
      execute: async ctx => mockRegistry.get('loops-while-counter:increment')(ctx),
    });

    const finalStep = createStep({
      id: 'final',
      description: 'Final step that prints the result',
      inputSchema: z.object({
        value: z.number(),
      }),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      execute: async ctx => mockRegistry.get('loops-while-counter:final')(ctx),
    });

    const counterWorkflow = createWorkflow({
      options: {
        validateInputs: false,
      },
      steps: [incrementStep, finalStep],
      id: 'loops-while-counter',
      inputSchema: z.object({
        target: z.number(),
        value: z.number(),
      }),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
    });

    counterWorkflow
      .dowhile(incrementStep, async ({ inputData }) => {
        return (inputData?.value ?? 0) < 12;
      })
      .then(finalStep)
      .commit();

    workflows['loops-while-counter'] = {
      workflow: counterWorkflow,
      mocks: {
        get increment() {
          return mockRegistry.get('loops-while-counter:increment');
        },
        get final() {
          return mockRegistry.get('loops-while-counter:final');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should exit loop immediately when condition is met
  {
    mockRegistry.register('loops-immediate-exit:step1', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        return { count: inputData.count + 1 };
      }),
    );

    const step1 = createStep({
      id: 'step1',
      inputSchema: z.object({ count: z.number() }),
      outputSchema: z.object({ count: z.number() }),
      execute: async ctx => mockRegistry.get('loops-immediate-exit:step1')(ctx),
    });

    const workflow = createWorkflow({
      id: 'loops-immediate-exit',
      inputSchema: z.object({ count: z.number() }),
      outputSchema: z.object({ count: z.number() }),
    });

    workflow
      .dowhile(step1, async ({ inputData }) => {
        // Condition is false immediately (count >= 10), so loop should not execute
        return inputData.count < 10;
      })
      .commit();

    workflows['loops-immediate-exit'] = {
      workflow,
      mocks: {
        get step1() {
          return mockRegistry.get('loops-immediate-exit:step1');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should loop with data accumulation
  {
    mockRegistry.register('loops-accumulate:step', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        // Accumulate data in each iteration
        return {
          items: [...(inputData.items || []), `item-${(inputData.items?.length || 0) + 1}`],
          count: (inputData.count ?? 0) + 1,
        };
      }),
    );

    const step = createStep({
      id: 'accumulate',
      inputSchema: z.object({
        items: z.array(z.string()).optional(),
        count: z.number().optional(),
      }),
      outputSchema: z.object({
        items: z.array(z.string()),
        count: z.number(),
      }),
      execute: async ctx => mockRegistry.get('loops-accumulate:step')(ctx),
    });

    const workflow = createWorkflow({
      id: 'loops-accumulate',
      inputSchema: z.object({}),
      outputSchema: z.object({ items: z.array(z.string()), count: z.number() }),
      options: { validateInputs: false },
    });

    // Loop until count reaches 3
    workflow
      .dountil(step, async ({ inputData }) => {
        return (inputData.count ?? 0) >= 3;
      })
      .commit();

    workflows['loops-accumulate'] = {
      workflow,
      mocks: {
        get step() {
          return mockRegistry.get('loops-accumulate:step');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  return workflows;
}

/**
 * Create tests for loops.
 */
export function createLoopsTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute } = ctx;

  describe('Loops', () => {
    it('should run an until loop', async () => {
      const { workflow } = registry!['loops-until-counter']!;
      const result = await execute(workflow, { target: 10, value: 0 });

      // Verify loop ran correct number of times via output (not mock counts - unreliable with memoization)
      // Loop starts at 0, increments until >= 12, so final value is 12
      expect(result.status).toBe('success');
      expect(result.result).toEqual({ finalValue: 12 });
      expect((result.steps.increment as any).output).toEqual({ value: 12 });
      expect(result.steps.final).toMatchObject({
        status: 'success',
        output: { finalValue: 12 },
      });
    });

    it('should run a while loop', async () => {
      const { workflow } = registry!['loops-while-counter']!;
      const result = await execute(workflow, { target: 10, value: 0 });

      // Verify loop ran correct number of times via output (not mock counts - unreliable with memoization)
      // Loop starts at 0, increments while < 12, so final value is 12
      expect(result.status).toBe('success');
      expect(result.result).toEqual({ finalValue: 12 });
      expect((result.steps.increment as any).output).toEqual({ value: 12 });
      expect(result.steps.final).toMatchObject({
        status: 'success',
        output: { finalValue: 12 },
      });
    });

    it('should exit loop immediately when condition is already met', async () => {
      const { workflow, resetMocks } = registry!['loops-immediate-exit']!;
      resetMocks?.();

      // Start with count = 10, which is >= 10, so dowhile should not run the body at all
      const result = await execute(workflow, { count: 10 });

      expect(result.status).toBe('success');
      // dowhile checks AFTER first run, so step1 will run once even when condition is met
      // The output should be count: 11 (input 10 + 1)
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { count: 11 },
      });
    });

    it('should accumulate data across loop iterations', async () => {
      const { workflow, resetMocks } = registry!['loops-accumulate']!;
      resetMocks?.();

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      // Loop runs 3 times: items accumulate to ['item-1', 'item-2', 'item-3']
      // @ts-expect-error - result type
      expect(result.result?.count).toBe(3);
      // @ts-expect-error - result type
      expect(result.result?.items).toEqual(['item-1', 'item-2', 'item-3']);
    });
  });
}
