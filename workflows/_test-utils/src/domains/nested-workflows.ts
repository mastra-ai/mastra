/**
 * Nested workflows tests for workflows
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';

/**
 * Create all workflows needed for nested workflows tests.
 */
export function createNestedWorkflowsWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Test: should execute nested workflow as a step
  {
    const step1Action = vi.fn().mockResolvedValue({ value: 'step1' });
    const step2Action = vi.fn().mockResolvedValue({ value: 'step2' });
    const step3Action = vi.fn().mockResolvedValue({ value: 'step3' });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: step3Action,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const nestedWorkflow = createWorkflow({
      id: 'nested-basic-inner',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      steps: [step2, step3],
    })
      .then(step2)
      .then(step3)
      .commit();

    const mainWorkflow = createWorkflow({
      id: 'nested-basic-main',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    mainWorkflow.then(step1).then(nestedWorkflow).commit();

    workflows['nested-basic'] = {
      workflow: mainWorkflow,
      mocks: { step1Action, step2Action, step3Action },
      nestedWorkflowId: 'nested-basic-inner',
    };
  }

  // Test: should handle failing steps in nested workflows
  {
    const error = new Error('Step execution failed');
    const failingAction = vi.fn().mockImplementation(() => {
      throw error;
    });
    const successAction = vi.fn().mockResolvedValue({});

    const step1 = createStep({
      id: 'step1',
      execute: successAction,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const step2 = createStep({
      id: 'step2',
      execute: failingAction,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const nestedWorkflow = createWorkflow({
      id: 'nested-failing-inner',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      steps: [step2],
    })
      .then(step2)
      .commit();

    const mainWorkflow = createWorkflow({
      id: 'nested-failing-main',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    mainWorkflow.then(step1).then(nestedWorkflow).commit();

    workflows['nested-failing'] = {
      workflow: mainWorkflow,
      mocks: { successAction, failingAction },
      nestedWorkflowId: 'nested-failing-inner',
    };
  }

  // Test: should pass data between parent and nested workflow
  {
    const outerStep = createStep({
      id: 'outer-step',
      execute: async ({ inputData }) => {
        return { value: inputData.input + '-outer' };
      },
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const innerStep = createStep({
      id: 'inner-step',
      execute: async ({ inputData }) => {
        return { result: inputData.value + '-inner' };
      },
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const nestedWorkflow = createWorkflow({
      id: 'nested-data-passing-inner',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      steps: [innerStep],
    })
      .then(innerStep)
      .commit();

    const mainWorkflow = createWorkflow({
      id: 'nested-data-passing-main',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    mainWorkflow.then(outerStep).then(nestedWorkflow).commit();

    workflows['nested-data-passing'] = {
      workflow: mainWorkflow,
      mocks: {},
      nestedWorkflowId: 'nested-data-passing-inner',
    };
  }

  // Test: should execute nested workflow with conditions
  {
    const stepA = createStep({
      id: 'stepA',
      execute: async () => ({ value: 'a' }),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const stepB = createStep({
      id: 'stepB',
      execute: async () => ({ value: 'b' }),
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const stepC = createStep({
      id: 'stepC',
      execute: async () => ({ value: 'c' }),
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const nestedWorkflow = createWorkflow({
      id: 'nested-conditions-inner',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      steps: [stepB, stepC],
    });

    nestedWorkflow
      .then(stepB)
      .branch([[async ({ inputData }) => inputData.value === 'b', stepC]])
      .commit();

    const mainWorkflow = createWorkflow({
      id: 'nested-conditions-main',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    mainWorkflow.then(stepA).then(nestedWorkflow).commit();

    workflows['nested-conditions'] = {
      workflow: mainWorkflow,
      mocks: {},
      nestedWorkflowId: 'nested-conditions-inner',
    };
  }

  // Test: should handle multiple levels of nesting
  {
    const step1 = createStep({
      id: 'step1',
      execute: async () => ({ value: 'level1' }),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => ({ value: inputData.value + '-level2' }),
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async ({ inputData }) => ({ value: inputData.value + '-level3' }),
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    // Deepest nested workflow
    const innerWorkflow = createWorkflow({
      id: 'nested-multi-inner',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      steps: [step3],
    })
      .then(step3)
      .commit();

    // Middle nested workflow
    const middleWorkflow = createWorkflow({
      id: 'nested-multi-middle',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      steps: [step2],
    })
      .then(step2)
      .then(innerWorkflow)
      .commit();

    // Outer workflow
    const outerWorkflow = createWorkflow({
      id: 'nested-multi-outer',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    })
      .then(step1)
      .then(middleWorkflow)
      .commit();

    workflows['nested-multiple-levels'] = {
      workflow: outerWorkflow,
      mocks: {},
      middleWorkflowId: 'nested-multi-middle',
    };
  }

  // Test: should execute nested workflow with state
  {
    const step1 = createStep({
      id: 'step1',
      execute: async ({ state }: any) => {
        return { result: 'success', value: state.value };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string(), value: z.string() }),
      stateSchema: z.object({ value: z.string() }),
    });

    const nestedWorkflow = createWorkflow({
      id: 'nested-with-state-inner',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string(), value: z.string() }),
      stateSchema: z.object({ value: z.string() }),
      steps: [step1],
    })
      .then(step1)
      .commit();

    const mainWorkflow = createWorkflow({
      id: 'nested-with-state-main',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string(), value: z.string() }),
      stateSchema: z.object({ value: z.string(), otherValue: z.string() }),
    });

    mainWorkflow.then(nestedWorkflow).commit();

    workflows['nested-with-state'] = {
      workflow: mainWorkflow,
      mocks: {},
      nestedWorkflowId: 'nested-with-state-inner',
    };
  }

  // Test: should execute nested workflow with state being set by the nested workflow
  {
    const step1 = createStep({
      id: 'step1',
      execute: async ({ state, setState }: any) => {
        await setState({ ...state, value: state.value + '!!!' });
        return {};
      },
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      stateSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ state }: any) => {
        return { result: 'success', value: state.value };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string(), value: z.string() }),
      stateSchema: z.object({ value: z.string() }),
    });

    const nestedWorkflow = createWorkflow({
      id: 'nested-setstate-inner',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string(), value: z.string() }),
      stateSchema: z.object({ value: z.string() }),
      steps: [step1, step2],
    })
      .then(step1)
      .then(step2)
      .commit();

    const mainWorkflow = createWorkflow({
      id: 'nested-setstate-main',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string(), value: z.string() }),
      stateSchema: z.object({ value: z.string(), otherValue: z.string() }),
    });

    mainWorkflow.then(nestedWorkflow).commit();

    workflows['nested-setstate'] = {
      workflow: mainWorkflow,
      mocks: {},
      nestedWorkflowId: 'nested-setstate-inner',
    };
  }

  return workflows;
}

export function createNestedWorkflowsTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('Nested workflows', () => {
    it('should execute nested workflow as a step', async () => {
      const { workflow, mocks, nestedWorkflowId } = registry!['nested-basic']!;

      const result = await execute(workflow, {});

      expect(mocks.step1Action).toHaveBeenCalledTimes(1);
      expect(mocks.step2Action).toHaveBeenCalledTimes(1);
      expect(mocks.step3Action).toHaveBeenCalledTimes(1);

      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { value: 'step1' },
      });
      expect(result.steps[nestedWorkflowId]).toMatchObject({
        status: 'success',
        output: { value: 'step3' },
      });
    });

    it.skipIf(skipTests.nestedWorkflowFailure)('should handle failing steps in nested workflows', async () => {
      const { workflow, nestedWorkflowId } = registry!['nested-failing']!;

      const result = await execute(workflow, {});

      expect(result.steps.step1).toMatchObject({
        status: 'success',
        payload: {},
      });
      expect(result.steps[nestedWorkflowId]).toMatchObject({
        status: 'failed',
        payload: {},
      });
      expect((result.steps[nestedWorkflowId] as any)?.error).toBeInstanceOf(Error);
      expect(((result.steps[nestedWorkflowId] as any)?.error as Error).message).toMatch(/Step execution failed/);
    });

    it.skipIf(skipTests.nestedDataPassing)('should pass data between parent and nested workflow', async () => {
      const { workflow, nestedWorkflowId } = registry!['nested-data-passing']!;

      const result = await execute(workflow, { input: 'test' });

      expect(result.steps['outer-step']).toMatchObject({
        status: 'success',
        output: { value: 'test-outer' },
      });
      expect(result.steps[nestedWorkflowId]).toMatchObject({
        status: 'success',
        output: { result: 'test-outer-inner' },
      });
    });

    it('should execute nested workflow with conditions', async () => {
      const { workflow, nestedWorkflowId } = registry!['nested-conditions']!;

      const result = await execute(workflow, {});

      expect(result.steps.stepA).toMatchObject({
        status: 'success',
        output: { value: 'a' },
      });
      expect(result.steps[nestedWorkflowId]).toMatchObject({
        status: 'success',
      });
    });

    it.skipIf(skipTests.nestedMultipleLevels)('should handle multiple levels of nesting', async () => {
      const { workflow, middleWorkflowId } = registry!['nested-multiple-levels']!;

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { value: 'level1' },
      });
      expect(result.steps[middleWorkflowId]).toMatchObject({
        status: 'success',
        output: { value: 'level1-level2-level3' },
      });
    });

    it.skipIf(skipTests.state)('should execute nested workflow with state', async () => {
      const { workflow, nestedWorkflowId } = registry!['nested-with-state']!;

      const result = await execute(workflow, {}, { initialState: { value: 'test-state', otherValue: 'other' } });

      expect(result.status).toBe('success');
      expect(result.steps[nestedWorkflowId]).toMatchObject({
        status: 'success',
        output: { result: 'success', value: 'test-state' },
      });
    });

    it.skipIf(skipTests.state)(
      'should execute nested workflow with state being set by the nested workflow',
      async () => {
        const { workflow, nestedWorkflowId } = registry!['nested-setstate']!;

        const result = await execute(workflow, {}, { initialState: { value: 'test-state', otherValue: 'other' } });

        expect(result.status).toBe('success');
        expect(result.steps[nestedWorkflowId]).toMatchObject({
          status: 'success',
          output: { result: 'success', value: 'test-state!!!' },
        });
      },
    );
  });
}
