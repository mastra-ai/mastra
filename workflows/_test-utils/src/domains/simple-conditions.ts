/**
 * Simple Conditions tests for workflows
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';

/**
 * Create all workflows needed for simple conditions tests.
 */
export function createSimpleConditionsWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Test: should follow conditional chains
  {
    const step1Action = vi.fn().mockImplementation(() => {
      return Promise.resolve({ status: 'success' });
    });
    const step2Action = vi.fn().mockImplementation(() => {
      return Promise.resolve({ result: 'step2' });
    });
    const step3Action = vi.fn().mockImplementation(() => {
      return Promise.resolve({ result: 'step3' });
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({ status: z.string() }),
      outputSchema: z.object({ status: z.string() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ status: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });
    const step3 = createStep({
      id: 'step3',
      execute: step3Action,
      inputSchema: z.object({ status: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });
    const step4 = createStep({
      id: 'step4',
      execute: async ({ inputData }) => {
        return { result: inputData.result };
      },
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'cond-follow-chains',
      inputSchema: z.object({ status: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1, step2, step3, step4],
    });

    workflow
      .then(step1)
      .branch([
        [
          async ({ inputData }) => {
            return inputData.status === 'success';
          },
          step2,
        ],
        [
          async ({ inputData }) => {
            return inputData.status === 'failed';
          },
          step3,
        ],
      ])
      .map({
        result: {
          step: [step3, step2],
          path: 'result',
        },
      })
      .then(step4)
      .commit();

    workflows['cond-follow-chains'] = {
      workflow,
      mocks: { step1Action, step2Action, step3Action },
    };
  }

  // Test: should follow conditional chains with state
  {
    const step1Action = vi.fn().mockImplementation(({ state }) => {
      return Promise.resolve({ status: 'success', value: state.value });
    });
    const step2Action = vi.fn().mockImplementation(({ state }) => {
      return Promise.resolve({ result: 'step2', value: state.value });
    });
    const step3Action = vi.fn().mockImplementation(({ state }) => {
      return Promise.resolve({ result: 'step3', value: state.value });
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({ status: z.string() }),
      outputSchema: z.object({ status: z.string(), value: z.string() }),
      stateSchema: z.object({ value: z.string() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ status: z.string() }),
      outputSchema: z.object({ result: z.string(), value: z.string() }),
      stateSchema: z.object({ value: z.string() }),
    });
    const step3 = createStep({
      id: 'step3',
      execute: step3Action,
      inputSchema: z.object({ status: z.string() }),
      outputSchema: z.object({ result: z.string(), value: z.string() }),
      stateSchema: z.object({ value: z.string() }),
    });
    const step4 = createStep({
      id: 'step4',
      execute: async ({ inputData, state }) => {
        return { result: inputData.result, value: state.value };
      },
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.string(), value: z.string() }),
      stateSchema: z.object({ value: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'cond-chains-with-state',
      inputSchema: z.object({ status: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1, step2, step3, step4],
      stateSchema: z.object({ value: z.string() }),
    });

    workflow
      .then(step1)
      .branch([
        [
          async ({ inputData }) => {
            return inputData.status === 'success';
          },
          step2 as any,
        ],
        [
          async ({ inputData }) => {
            return inputData.status === 'failed';
          },
          step3 as any,
        ],
      ])
      .map({
        result: {
          step: [step3, step2],
          path: 'result',
        },
      })
      .then(step4)
      .commit();

    workflows['cond-chains-with-state'] = {
      workflow,
      mocks: { step1Action, step2Action, step3Action },
    };
  }

  // Test: should handle failing dependencies
  {
    let err: Error | undefined;
    const step1Action = vi.fn().mockImplementation(() => {
      err = new Error('Failed');
      throw err;
    });
    const step2Action = vi.fn();

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'cond-failing-deps',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      steps: [step1, step2],
    });

    workflow.then(step1).then(step2).commit();

    workflows['cond-failing-deps'] = {
      workflow,
      mocks: { step1Action, step2Action },
      getError: () => err,
    };
  }

  // Test: should support simple string conditions
  {
    const step1Action = vi.fn().mockResolvedValue({ status: 'success' });
    const step2Action = vi.fn().mockResolvedValue({ result: 'step2' });
    const step3Action = vi.fn().mockResolvedValue({ result: 'step3' });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ status: z.string() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ status: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });
    const step3 = createStep({
      id: 'step3',
      execute: step3Action,
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'cond-simple-string',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      steps: [step1, step2, step3],
      options: {
        validateInputs: false,
      },
    });
    workflow
      .then(step1)
      .branch([
        [
          async ({ inputData }) => {
            return inputData.status === 'success';
          },
          step2,
        ],
      ])
      .map({
        result: {
          step: step3,
          path: 'result',
        },
      })
      .branch([
        [
          async ({ inputData }) => {
            return inputData.result === 'unexpected value';
          },
          step3,
        ],
      ])
      .commit();

    workflows['cond-simple-string'] = {
      workflow,
      mocks: { step1Action, step2Action, step3Action },
    };
  }

  // Test: should support custom condition functions
  {
    const step1Action = vi.fn().mockResolvedValue({ count: 5 });
    const step2Action = vi.fn();

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      resumeSchema: z.object({ count: z.number() }),
      outputSchema: z.object({ count: z.number() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ count: z.number() }),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'cond-custom-function',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      steps: [step1, step2],
      options: {
        validateInputs: false,
      },
    });

    workflow
      .then(step1)
      .branch([
        [
          async ({ getStepResult }) => {
            const step1Result = getStepResult(step1);
            return step1Result ? step1Result.count > 3 : false;
          },
          step2,
        ],
      ])
      .commit();

    workflows['cond-custom-function'] = {
      workflow,
      mocks: { step1Action, step2Action },
    };
  }

  return workflows;
}

/**
 * Create tests for simple conditions.
 */
export function createSimpleConditionsTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('Simple Conditions', () => {
    it('should follow conditional chains', async () => {
      const { workflow, mocks } = registry!['cond-follow-chains']!;
      const result = await execute(workflow, { status: 'success' });

      expect(mocks.step1Action).toHaveBeenCalled();
      expect(mocks.step2Action).toHaveBeenCalled();
      expect(mocks.step3Action).not.toHaveBeenCalled();
      expect(result.steps).toMatchObject({
        input: { status: 'success' },
        step1: { status: 'success', output: { status: 'success' } },
        step2: { status: 'success', output: { result: 'step2' } },
        step4: { status: 'success', output: { result: 'step2' } },
      });
    });

    it.skipIf(skipTests.state)('should follow conditional chains with state', async () => {
      const { workflow, mocks } = registry!['cond-chains-with-state']!;
      const result = await execute(workflow, { status: 'success' }, { initialState: { value: 'test-state' } });

      expect(mocks.step1Action).toHaveBeenCalled();
      expect(mocks.step2Action).toHaveBeenCalled();
      expect(mocks.step3Action).not.toHaveBeenCalled();
      expect(result.steps).toMatchObject({
        input: { status: 'success' },
        step1: { status: 'success', output: { status: 'success', value: 'test-state' } },
        step2: { status: 'success', output: { result: 'step2', value: 'test-state' } },
        step4: { status: 'success', output: { result: 'step2', value: 'test-state' } },
      });
    });

    it('should handle failing dependencies', async () => {
      const { workflow, mocks } = registry!['cond-failing-deps']!;

      let result: Awaited<ReturnType<typeof execute>> | undefined = undefined;
      try {
        result = await execute(workflow, {});
      } catch {
        // do nothing
      }

      expect(mocks.step1Action).toHaveBeenCalled();
      expect(mocks.step2Action).not.toHaveBeenCalled();
      expect((result?.steps as any)?.input).toEqual({});

      const step1Result = result?.steps?.step1;
      expect(step1Result).toBeDefined();
      expect(step1Result).toMatchObject({
        status: 'failed',
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect((step1Result as any)?.error).toBeInstanceOf(Error);
      expect(((step1Result as any)?.error as Error).message).toBe('Failed');
    });

    it('should support simple string conditions', async () => {
      const { workflow, mocks } = registry!['cond-simple-string']!;
      const result = await execute(workflow, { status: 'success' });

      expect(mocks.step1Action).toHaveBeenCalled();
      expect(mocks.step2Action).toHaveBeenCalled();
      expect(mocks.step3Action).not.toHaveBeenCalled();
      expect(result.steps).toMatchObject({
        input: { status: 'success' },
        step1: {
          status: 'success',
          output: { status: 'success' },
          payload: {},
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        step2: {
          status: 'success',
          output: { result: 'step2' },
          payload: { status: 'success' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });
    });

    it('should support custom condition functions', async () => {
      const { workflow, mocks } = registry!['cond-custom-function']!;
      const result = await execute(workflow, { count: 5 });

      expect(mocks.step2Action).toHaveBeenCalled();
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { count: 5 },
        payload: { count: 5 },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result.steps.step2).toMatchObject({
        status: 'success',
        payload: { count: 5 },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(result.steps.step2!.output === undefined || !('output' in result.steps.step2!)).toBe(true);
    });
  });
}
