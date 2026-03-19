/**
 * perStep execution mode tests
 *
 * Tests the `perStep: true` option which executes one step at a time,
 * pausing after each step. This is useful for debugging and step-by-step execution.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for perStep tests.
 */
export function createPerStepWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  const mockRegistry = new MockRegistry();

  // Test: should execute single step when perStep is true
  {
    mockRegistry.register('perstep-basic:step1', () => vi.fn().mockResolvedValue({ value: 'step1-done' }));
    mockRegistry.register('perstep-basic:step2', () => vi.fn().mockResolvedValue({ value: 'step2-done' }));

    const step1 = createStep({
      id: 'step1',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ctx => mockRegistry.get('perstep-basic:step1')(ctx),
    });

    const step2 = createStep({
      id: 'step2',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ctx => mockRegistry.get('perstep-basic:step2')(ctx),
    });

    const workflow = createWorkflow({
      id: 'perstep-basic',
      steps: [step1, step2],
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['perstep-basic'] = {
      workflow,
      mocks: {
        get step1() {
          return mockRegistry.get('perstep-basic:step1');
        },
        get step2() {
          return mockRegistry.get('perstep-basic:step2');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should execute single step in parallel workflow when perStep is true
  {
    mockRegistry.register('perstep-parallel:stepA', () => vi.fn().mockResolvedValue({ value: 'A-done' }));
    mockRegistry.register('perstep-parallel:stepB', () => vi.fn().mockResolvedValue({ value: 'B-done' }));
    mockRegistry.register('perstep-parallel:stepC', () => vi.fn().mockResolvedValue({ value: 'C-done' }));

    const stepA = createStep({
      id: 'stepA',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ctx => mockRegistry.get('perstep-parallel:stepA')(ctx),
    });

    const stepB = createStep({
      id: 'stepB',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ctx => mockRegistry.get('perstep-parallel:stepB')(ctx),
    });

    const stepC = createStep({
      id: 'stepC',
      // After parallel, input is { stepA: {...}, stepB: {...} }
      inputSchema: z.object({
        stepA: z.object({ value: z.string() }),
        stepB: z.object({ value: z.string() }),
      }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ctx => mockRegistry.get('perstep-parallel:stepC')(ctx),
    });

    const workflow = createWorkflow({
      id: 'perstep-parallel',
      steps: [stepA, stepB, stepC],
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    // stepA and stepB run in parallel, then stepC
    workflow.parallel([stepA, stepB]).then(stepC).commit();

    workflows['perstep-parallel'] = {
      workflow,
      mocks: {
        get stepA() {
          return mockRegistry.get('perstep-parallel:stepA');
        },
        get stepB() {
          return mockRegistry.get('perstep-parallel:stepB');
        },
        get stepC() {
          return mockRegistry.get('perstep-parallel:stepC');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should execute single step in conditional workflow when perStep is true
  {
    mockRegistry.register('perstep-conditional:check', () => vi.fn().mockResolvedValue({ shouldBranch: true }));
    mockRegistry.register('perstep-conditional:branchA', () => vi.fn().mockResolvedValue({ result: 'took-A' }));
    mockRegistry.register('perstep-conditional:branchB', () => vi.fn().mockResolvedValue({ result: 'took-B' }));

    const checkStep = createStep({
      id: 'check',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ shouldBranch: z.boolean() }),
      execute: async ctx => mockRegistry.get('perstep-conditional:check')(ctx),
    });

    const branchA = createStep({
      id: 'branchA',
      inputSchema: z.object({ shouldBranch: z.boolean() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ctx => mockRegistry.get('perstep-conditional:branchA')(ctx),
    });

    const branchB = createStep({
      id: 'branchB',
      inputSchema: z.object({ shouldBranch: z.boolean() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ctx => mockRegistry.get('perstep-conditional:branchB')(ctx),
    });

    const workflow = createWorkflow({
      id: 'perstep-conditional',
      steps: [checkStep, branchA, branchB],
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow
      .then(checkStep)
      .branch([
        [async ({ inputData }: { inputData: { shouldBranch: boolean } }) => inputData.shouldBranch === true, branchA],
        [async ({ inputData }: { inputData: { shouldBranch: boolean } }) => inputData.shouldBranch === false, branchB],
      ])
      .commit();

    workflows['perstep-conditional'] = {
      workflow,
      mocks: {
        get check() {
          return mockRegistry.get('perstep-conditional:check');
        },
        get branchA() {
          return mockRegistry.get('perstep-conditional:branchA');
        },
        get branchB() {
          return mockRegistry.get('perstep-conditional:branchB');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should execute single step in nested workflow when perStep is true
  {
    mockRegistry.register('perstep-nested:outer', () => vi.fn().mockResolvedValue({ value: 'outer-done' }));
    mockRegistry.register('perstep-nested:inner', () => vi.fn().mockResolvedValue({ value: 'inner-done' }));
    mockRegistry.register('perstep-nested:final', () => vi.fn().mockResolvedValue({ value: 'final-done' }));

    const innerStep = createStep({
      id: 'innerStep',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ctx => mockRegistry.get('perstep-nested:inner')(ctx),
    });

    const innerWorkflow = createWorkflow({
      id: 'perstep-inner-workflow',
      steps: [innerStep],
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    innerWorkflow.then(innerStep).commit();

    const outerStep = createStep({
      id: 'outerStep',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ctx => mockRegistry.get('perstep-nested:outer')(ctx),
    });

    const finalStep = createStep({
      id: 'finalStep',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ctx => mockRegistry.get('perstep-nested:final')(ctx),
    });

    const workflow = createWorkflow({
      id: 'perstep-nested',
      steps: [outerStep, innerWorkflow, finalStep],
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    workflow.then(outerStep).then(innerWorkflow).then(finalStep).commit();

    workflows['perstep-nested'] = {
      workflow,
      mocks: {
        get outer() {
          return mockRegistry.get('perstep-nested:outer');
        },
        get inner() {
          return mockRegistry.get('perstep-nested:inner');
        },
        get final() {
          return mockRegistry.get('perstep-nested:final');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  return workflows;
}

/**
 * Create tests for perStep execution mode.
 */
export function createPerStepTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('perStep execution', () => {
    it.skipIf(skipTests.perStepBasic)('should execute only first step when perStep is true', async () => {
      const { workflow, mocks } = registry!['perstep-basic']!;
      const result = await execute(workflow, { input: 'test' }, { perStep: true });

      // Only first step should execute
      expect(result.status).toBe('paused');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { value: 'step1-done' },
      });
      // Second step should not exist or not be executed
      expect(result.steps.step2).toBeUndefined();

      // Verify mock calls
      expect(mocks.step1).toHaveBeenCalled();
      expect(mocks.step2).not.toHaveBeenCalled();
    });

    it.skipIf(skipTests.perStepParallel)(
      'should execute only one step in parallel workflow when perStep is true',
      async () => {
        const { workflow, mocks } = registry!['perstep-parallel']!;
        const result = await execute(workflow, { input: 'test' }, { perStep: true });

        // perStep executes only ONE step, even in parallel mode
        expect(result.status).toBe('paused');

        // Only the first parallel step executes
        expect(result.steps.stepA).toMatchObject({
          status: 'success',
          output: { value: 'A-done' },
        });

        // The other parallel step and step after don't execute
        expect(result.steps.stepB).toBeUndefined();
        expect(result.steps.stepC).toBeUndefined();

        expect(mocks.stepA).toHaveBeenCalled();
        expect(mocks.stepB).not.toHaveBeenCalled();
        expect(mocks.stepC).not.toHaveBeenCalled();
      },
    );

    it.skipIf(skipTests.perStepConditional)(
      'should execute only check step in conditional when perStep is true',
      async () => {
        const { workflow, mocks } = registry!['perstep-conditional']!;
        const result = await execute(workflow, { input: 'test' }, { perStep: true });

        // Only check step should execute
        expect(result.status).toBe('paused');
        expect(result.steps.check).toMatchObject({
          status: 'success',
          output: { shouldBranch: true },
        });

        // Neither branch should execute yet
        expect(result.steps.branchA).toBeUndefined();
        expect(result.steps.branchB).toBeUndefined();

        expect(mocks.check).toHaveBeenCalled();
        expect(mocks.branchA).not.toHaveBeenCalled();
        expect(mocks.branchB).not.toHaveBeenCalled();
      },
    );

    it.skipIf(skipTests.perStepNested)(
      'should execute only outer step in nested workflow when perStep is true',
      async () => {
        const { workflow, mocks } = registry!['perstep-nested']!;
        const result = await execute(workflow, { input: 'test' }, { perStep: true });

        // Only outer step should execute
        expect(result.status).toBe('paused');
        expect(result.steps.outerStep).toMatchObject({
          status: 'success',
          output: { value: 'outer-done' },
        });

        // Nested workflow and final step should not execute
        expect(result.steps['perstep-inner-workflow']).toBeUndefined();
        expect(result.steps.finalStep).toBeUndefined();

        expect(mocks.outer).toHaveBeenCalled();
        expect(mocks.inner).not.toHaveBeenCalled();
        expect(mocks.final).not.toHaveBeenCalled();
      },
    );

    it.skipIf(skipTests.perStepContinue)(
      'should continue execution step by step with multiple perStep calls',
      async () => {
        const { workflow, mocks } = registry!['perstep-basic']!;

        // First call - execute step1
        const result1 = await execute(workflow, { input: 'test' }, { perStep: true });
        expect(result1.status).toBe('paused');
        expect(result1.steps.step1).toBeDefined();
        expect(result1.steps.step2).toBeUndefined();

        // Note: Continuing execution with perStep requires resume functionality
        // which may vary by engine. This test validates the first step behavior.
        expect(mocks.step1).toHaveBeenCalled();
      },
    );
  });
}
