/**
 * if-else branching tests for workflows
 *
 * Uses MockRegistry pattern to decouple mocks from workflow definitions,
 * enabling proper test isolation via resetMocks().
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for branching tests.
 */
export function createBranchingWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Create a mock registry for this domain
  const mockRegistry = new MockRegistry();

  // Test: should run the if-then branch
  {
    // Register mock factories
    mockRegistry.register('branch-if-then:start', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        const newValue = (inputData?.startValue ?? 0) + 1;
        return { newValue };
      }),
    );
    mockRegistry.register('branch-if-then:other', () =>
      vi.fn().mockImplementation(async () => {
        return { other: 26 };
      }),
    );
    mockRegistry.register('branch-if-then:final', () =>
      vi.fn().mockImplementation(async ({ getStepResult }) => {
        const startVal = getStepResult(startStep)?.newValue ?? 0;
        const otherVal = getStepResult(otherStep)?.other ?? 0;
        return { finalValue: startVal + otherVal };
      }),
    );

    const startStep = createStep({
      id: 'start',
      description: 'Increments the current value by 1',
      inputSchema: z.object({
        startValue: z.number(),
      }),
      outputSchema: z.object({
        newValue: z.number(),
      }),
      execute: async ctx => mockRegistry.get('branch-if-then:start')(ctx),
    });

    const otherStep = createStep({
      id: 'other',
      description: 'Other step',
      inputSchema: z.object({ newValue: z.number() }),
      outputSchema: z.object({
        other: z.number(),
      }),
      execute: async ctx => mockRegistry.get('branch-if-then:other')(ctx),
    });

    const finalIf = createStep({
      id: 'finalIf',
      description: 'Final step that prints the result',
      inputSchema: z.object({ newValue: z.number() }),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      execute: async ctx => mockRegistry.get('branch-if-then:final')(ctx),
    });
    const finalElse = createStep({
      id: 'finalElse',
      description: 'Final step that prints the result',
      inputSchema: z.object({ other: z.number() }),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      execute: async ctx => mockRegistry.get('branch-if-then:final')(ctx),
    });

    const counterWorkflow = createWorkflow({
      id: 'branch-if-then',
      inputSchema: z.object({
        startValue: z.number(),
      }),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      steps: [startStep, finalIf],
    });

    const elseBranch = createWorkflow({
      id: 'branch-if-then-else-nested',
      inputSchema: z.object({ newValue: z.number() }),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      steps: [otherStep, finalElse],
    })
      .then(otherStep)
      .then(finalElse)
      .commit();

    counterWorkflow
      .then(startStep)
      .branch([
        [
          async ({ inputData }) => {
            const current = inputData.newValue;
            return !current || current < 5;
          },
          finalIf,
        ],
        [
          async ({ inputData }) => {
            const current = inputData.newValue;
            return current >= 5;
          },
          elseBranch,
        ],
      ])
      .commit();

    workflows['branch-if-then'] = {
      workflow: counterWorkflow,
      mocks: {
        get start() {
          return mockRegistry.get('branch-if-then:start');
        },
        get other() {
          return mockRegistry.get('branch-if-then:other');
        },
        get final() {
          return mockRegistry.get('branch-if-then:final');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should run the else branch
  {
    // Register mock factories
    mockRegistry.register('branch-else:start', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        const newValue = (inputData?.startValue ?? 0) + 1;
        return { newValue };
      }),
    );
    mockRegistry.register('branch-else:other', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        return { newValue: inputData.newValue, other: 26 };
      }),
    );
    mockRegistry.register('branch-else:final', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        const startVal = inputData?.newValue ?? 0;
        const otherVal = inputData?.other ?? 0;
        return { finalValue: startVal + otherVal };
      }),
    );

    const startStep = createStep({
      id: 'start',
      description: 'Increments the current value by 1',
      inputSchema: z.object({
        startValue: z.number(),
      }),
      outputSchema: z.object({
        newValue: z.number(),
      }),
      execute: async ctx => mockRegistry.get('branch-else:start')(ctx),
    });

    const otherStep = createStep({
      id: 'other',
      description: 'Other step',
      inputSchema: z.object({ newValue: z.number() }),
      outputSchema: z.object({
        other: z.number(),
        newValue: z.number(),
      }),
      execute: async ctx => mockRegistry.get('branch-else:other')(ctx),
    });

    const finalIf = createStep({
      id: 'finalIf',
      description: 'Final step that prints the result',
      inputSchema: z.object({ newValue: z.number() }),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      execute: async ctx => mockRegistry.get('branch-else:final')(ctx),
    });
    const finalElse = createStep({
      id: 'finalElse',
      description: 'Final step that prints the result',
      inputSchema: z.object({ other: z.number(), newValue: z.number() }),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      execute: async ctx => mockRegistry.get('branch-else:final')(ctx),
    });

    const counterWorkflow = createWorkflow({
      id: 'branch-else',
      inputSchema: z.object({
        startValue: z.number(),
      }),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      steps: [startStep, finalIf],
    });

    const elseBranch = createWorkflow({
      id: 'branch-else-nested',
      inputSchema: z.object({ newValue: z.number() }),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      steps: [otherStep, finalElse],
    })
      .then(otherStep)
      .then(finalElse)
      .commit();

    counterWorkflow
      .then(startStep)
      .branch([
        [
          async ({ inputData }) => {
            const current = inputData.newValue;
            return !current || current < 5;
          },
          finalIf,
        ],
        [
          async ({ inputData }) => {
            const current = inputData.newValue;
            return current >= 5;
          },
          elseBranch,
        ],
      ])
      .commit();

    workflows['branch-else'] = {
      workflow: counterWorkflow,
      mocks: {
        get start() {
          return mockRegistry.get('branch-else:start');
        },
        get other() {
          return mockRegistry.get('branch-else:other');
        },
        get final() {
          return mockRegistry.get('branch-else:final');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should handle three-way branching
  {
    mockRegistry.register('branch-threeway:check', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        return { category: inputData.value };
      }),
    );
    mockRegistry.register('branch-threeway:low', () =>
      vi.fn().mockImplementation(async () => ({ result: 'low' })),
    );
    mockRegistry.register('branch-threeway:medium', () =>
      vi.fn().mockImplementation(async () => ({ result: 'medium' })),
    );
    mockRegistry.register('branch-threeway:high', () =>
      vi.fn().mockImplementation(async () => ({ result: 'high' })),
    );

    const checkStep = createStep({
      id: 'check',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ category: z.number() }),
      execute: async ctx => mockRegistry.get('branch-threeway:check')(ctx),
    });

    const lowStep = createStep({
      id: 'low',
      inputSchema: z.object({ category: z.number() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ctx => mockRegistry.get('branch-threeway:low')(ctx),
    });

    const mediumStep = createStep({
      id: 'medium',
      inputSchema: z.object({ category: z.number() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ctx => mockRegistry.get('branch-threeway:medium')(ctx),
    });

    const highStep = createStep({
      id: 'high',
      inputSchema: z.object({ category: z.number() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ctx => mockRegistry.get('branch-threeway:high')(ctx),
    });

    const workflow = createWorkflow({
      id: 'branch-threeway',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow
      .then(checkStep)
      .branch([
        [async ({ inputData }) => inputData.category < 33, lowStep],
        [async ({ inputData }) => inputData.category >= 33 && inputData.category < 66, mediumStep],
        [async ({ inputData }) => inputData.category >= 66, highStep],
      ])
      .commit();

    workflows['branch-threeway'] = {
      workflow,
      mocks: {
        get check() {
          return mockRegistry.get('branch-threeway:check');
        },
        get low() {
          return mockRegistry.get('branch-threeway:low');
        },
        get medium() {
          return mockRegistry.get('branch-threeway:medium');
        },
        get high() {
          return mockRegistry.get('branch-threeway:high');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should pass correct data to selected branch
  {
    mockRegistry.register('branch-data:initial', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        return {
          processedValue: inputData.rawValue * 2,
          flag: inputData.rawValue > 50,
        };
      }),
    );
    mockRegistry.register('branch-data:truePath', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        // Should receive processedValue and flag from previous step
        return { final: `processed: ${inputData.processedValue}, flag: ${inputData.flag}` };
      }),
    );
    mockRegistry.register('branch-data:falsePath', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        return { final: `small: ${inputData.processedValue}` };
      }),
    );

    const initialStep = createStep({
      id: 'initial',
      inputSchema: z.object({ rawValue: z.number() }),
      outputSchema: z.object({ processedValue: z.number(), flag: z.boolean() }),
      execute: async ctx => mockRegistry.get('branch-data:initial')(ctx),
    });

    const truePathStep = createStep({
      id: 'truePath',
      inputSchema: z.object({ processedValue: z.number(), flag: z.boolean() }),
      outputSchema: z.object({ final: z.string() }),
      execute: async ctx => mockRegistry.get('branch-data:truePath')(ctx),
    });

    const falsePathStep = createStep({
      id: 'falsePath',
      inputSchema: z.object({ processedValue: z.number(), flag: z.boolean() }),
      outputSchema: z.object({ final: z.string() }),
      execute: async ctx => mockRegistry.get('branch-data:falsePath')(ctx),
    });

    const workflow = createWorkflow({
      id: 'branch-data-passing',
      inputSchema: z.object({ rawValue: z.number() }),
      outputSchema: z.object({ final: z.string() }),
    });

    workflow
      .then(initialStep)
      .branch([
        [async ({ inputData }) => inputData.flag === true, truePathStep],
        [async ({ inputData }) => inputData.flag === false, falsePathStep],
      ])
      .commit();

    workflows['branch-data-passing'] = {
      workflow,
      mocks: {
        get initial() {
          return mockRegistry.get('branch-data:initial');
        },
        get truePath() {
          return mockRegistry.get('branch-data:truePath');
        },
        get falsePath() {
          return mockRegistry.get('branch-data:falsePath');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  return workflows;
}

/**
 * Create tests for branching.
 */
export function createBranchingTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('if-else branching', () => {
    it('should run the if-then branch', async () => {
      const { workflow, mocks } = registry!['branch-if-then'];
      const result = await execute(workflow, { startValue: 1 });

      expect(mocks.start).toHaveBeenCalledTimes(1);
      expect(mocks.other).toHaveBeenCalledTimes(0);
      expect(mocks.final).toHaveBeenCalledTimes(1);
      // @ts-expect-error
      expect(result.steps.finalIf.output).toEqual({ finalValue: 2 });
      // @ts-expect-error
      expect(result.steps.start.output).toEqual({ newValue: 2 });
    });

    it.skipIf(skipTests.branchingElse)('should run the else branch', async () => {
      const { workflow, mocks } = registry!['branch-else'];
      const result = await execute(workflow, { startValue: 6 });

      expect(mocks.start).toHaveBeenCalledTimes(1);
      expect(mocks.other).toHaveBeenCalledTimes(1);
      expect(mocks.final).toHaveBeenCalledTimes(1);
      // @ts-expect-error
      expect(result.steps['branch-else-nested'].output).toEqual({ finalValue: 26 + 6 + 1 });
      // @ts-expect-error
      expect(result.steps.start.output).toEqual({ newValue: 7 });
    });

    it('should handle three-way branching - low path', async () => {
      const { workflow, mocks } = registry!['branch-threeway'];
      const result = await execute(workflow, { value: 10 });

      expect(mocks.check).toHaveBeenCalledTimes(1);
      expect(mocks.low).toHaveBeenCalledTimes(1);
      expect(mocks.medium).toHaveBeenCalledTimes(0);
      expect(mocks.high).toHaveBeenCalledTimes(0);
      expect(result.status).toBe('success');
      // @ts-expect-error
      expect(result.steps.low?.output).toEqual({ result: 'low' });
    });

    it('should handle three-way branching - medium path', async () => {
      const { workflow, mocks } = registry!['branch-threeway'];
      const result = await execute(workflow, { value: 50 });

      expect(mocks.check).toHaveBeenCalledTimes(1);
      expect(mocks.low).toHaveBeenCalledTimes(0);
      expect(mocks.medium).toHaveBeenCalledTimes(1);
      expect(mocks.high).toHaveBeenCalledTimes(0);
      expect(result.status).toBe('success');
      // @ts-expect-error
      expect(result.steps.medium?.output).toEqual({ result: 'medium' });
    });

    it('should handle three-way branching - high path', async () => {
      const { workflow, mocks } = registry!['branch-threeway'];
      const result = await execute(workflow, { value: 80 });

      expect(mocks.check).toHaveBeenCalledTimes(1);
      expect(mocks.low).toHaveBeenCalledTimes(0);
      expect(mocks.medium).toHaveBeenCalledTimes(0);
      expect(mocks.high).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('success');
      // @ts-expect-error
      expect(result.steps.high?.output).toEqual({ result: 'high' });
    });

    it('should pass correct data to selected branch - true path', async () => {
      const { workflow, mocks } = registry!['branch-data-passing'];
      const result = await execute(workflow, { rawValue: 100 });

      expect(mocks.initial).toHaveBeenCalledTimes(1);
      expect(mocks.truePath).toHaveBeenCalledTimes(1);
      expect(mocks.falsePath).toHaveBeenCalledTimes(0);

      expect(result.status).toBe('success');
      // @ts-expect-error
      expect(result.steps.initial?.output).toEqual({ processedValue: 200, flag: true });
      // @ts-expect-error
      expect(result.steps.truePath?.output).toEqual({ final: 'processed: 200, flag: true' });
    });

    it('should pass correct data to selected branch - false path', async () => {
      const { workflow, mocks } = registry!['branch-data-passing'];
      const result = await execute(workflow, { rawValue: 25 });

      expect(mocks.initial).toHaveBeenCalledTimes(1);
      expect(mocks.truePath).toHaveBeenCalledTimes(0);
      expect(mocks.falsePath).toHaveBeenCalledTimes(1);

      expect(result.status).toBe('success');
      // @ts-expect-error
      expect(result.steps.initial?.output).toEqual({ processedValue: 50, flag: false });
      // @ts-expect-error
      expect(result.steps.falsePath?.output).toEqual({ final: 'small: 50' });
    });
  });
}
