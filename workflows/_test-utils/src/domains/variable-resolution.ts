/**
 * Variable Resolution tests for workflows
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';

/**
 * Create all workflows needed for variable resolution tests.
 * These are created once and registered with Mastra/Inngest upfront.
 */
export function createVariableResolutionWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep, mapVariable } = ctx;
  const workflows: WorkflowRegistry = {};

  // Test: should resolve trigger data
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: z.object({ inputData: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: executeAction,
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'var-resolve-trigger-data',
      inputSchema: z.object({ inputData: z.string() }),
      outputSchema: z.object({}),
    });

    workflow.then(step1).then(step2).commit();

    workflows['var-resolve-trigger-data'] = { workflow, mocks: { executeAction } };
  }

  // Test: should provide access to step results via getStepResult helper
  {
    const step1Action = vi.fn().mockImplementation(async () => {
      return { value: 'step1-result' };
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({ inputValue: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const nonExecutedStep = createStep({
      id: 'non-executed-step',
      execute: vi.fn(),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    let step2Assertions: (() => void) | null = null;

    const step2 = createStep({
      id: 'step2',
      execute: async ({ getStepResult }) => {
        // Test accessing previous step result
        const step1Result = getStepResult(step1);
        const step1ResultFromString = getStepResult('step1');
        const failedStep = getStepResult(nonExecutedStep);

        // Store assertions to run after execution
        step2Assertions = () => {
          expect(step1Result).toEqual({ value: 'step1-result' });
          expect(step1ResultFromString).toEqual({ value: 'step1-result' });
          expect(failedStep).toBe(null);
        };

        return { value: 'step2-result' };
      },
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'var-get-step-result',
      inputSchema: z.object({ inputValue: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['var-get-step-result'] = {
      workflow,
      mocks: { step1Action },
      getStep2Assertions: () => step2Assertions,
      resetAssertions: () => {
        step2Assertions = null;
      },
    };
  }

  // Test: should resolve trigger data from context
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
    const triggerSchema = z.object({
      inputData: z.string(),
    });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'var-trigger-from-context',
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).commit();

    workflows['var-trigger-from-context'] = { workflow, mocks: { executeAction } };
  }

  // Test: should resolve trigger data from getInitData
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
    const triggerSchema = z.object({
      cool: z.string(),
    });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ getInitData }) => {
        const initData = getInitData<z.infer<typeof triggerSchema>>();
        return { result: initData };
      },
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.object({ cool: z.string() }) }),
    });

    const workflow = createWorkflow({
      id: 'var-get-init-data',
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
      steps: [step1, step2],
    });

    workflow.then(step1).then(step2).commit();

    workflows['var-get-init-data'] = { workflow, mocks: { executeAction } };
  }

  // Test: should resolve variables from previous steps via .map()
  {
    const step1Action = vi.fn().mockResolvedValue({
      nested: { value: 'step1-data' },
    });
    const step2Action = vi.fn().mockResolvedValue({ result: 'success' });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ nested: z.object({ value: z.string() }) }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ previousValue: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'var-map-previous-step',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow
      .then(step1)
      .map({
        previousValue: mapVariable({
          step: step1,
          path: 'nested.value',
        }),
      })
      .then(step2)
      .commit();

    workflows['var-map-previous-step'] = { workflow, mocks: { step1Action, step2Action } };
  }

  // Test: should resolve inputs from previous steps that are not objects
  {
    const step1 = createStep({
      id: 'step1',
      execute: async () => {
        return 'step1-data';
      },
      inputSchema: z.object({}),
      outputSchema: z.string(),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: 'success', input: inputData };
      },
      inputSchema: z.string(),
      outputSchema: z.object({ result: z.string(), input: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'var-non-object-output',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['var-non-object-output'] = { workflow, mocks: {} };
  }

  // Test: should resolve inputs from previous steps that are arrays
  {
    const step1 = createStep({
      id: 'step1',
      execute: async () => {
        return [{ str: 'step1-data' }];
      },
      inputSchema: z.object({}),
      outputSchema: z.array(z.object({ str: z.string() })),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: 'success', input: inputData };
      },
      inputSchema: z.array(z.object({ str: z.string() })),
      outputSchema: z.object({ result: z.string(), input: z.array(z.object({ str: z.string() })) }),
    });

    const workflow = createWorkflow({
      id: 'var-array-output',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['var-array-output'] = { workflow, mocks: {} };
  }

  // Test: should resolve constant values via .map()
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
    const triggerSchema = z.object({
      cool: z.string(),
    });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return {
          result: inputData.candidates.map((c: { name: string }) => c.name).join('') || 'none',
          second: inputData.iteration,
        };
      },
      inputSchema: z.object({ candidates: z.array(z.object({ name: z.string() })), iteration: z.number() }),
      outputSchema: z.object({ result: z.string(), second: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'var-map-constant',
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string(), second: z.number() }),
    });

    workflow
      .then(step1)
      .map({
        candidates: {
          value: [],
          schema: z.array(z.object({ name: z.string() })),
        },
        iteration: {
          value: 0,
          schema: z.number(),
        },
      })
      .then(step2)
      .commit();

    workflows['var-map-constant'] = { workflow, mocks: { executeAction } };
  }

  // Test: should resolve fully dynamic input via .map()
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
    const triggerSchema = z.object({
      cool: z.string(),
    });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return {
          result: inputData.candidates.map((c: { name: string }) => c.name).join(', ') || 'none',
          second: inputData.iteration,
        };
      },
      inputSchema: z.object({ candidates: z.array(z.object({ name: z.string() })), iteration: z.number() }),
      outputSchema: z.object({ result: z.string(), second: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'var-map-dynamic',
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string(), second: z.number() }),
    });

    workflow
      .then(step1)
      .map(async ({ inputData }) => {
        return {
          candidates: [{ name: inputData.result }, { name: 'hello' }],
          iteration: 0,
        };
      })
      .then(step2)
      .commit();

    workflows['var-map-dynamic'] = { workflow, mocks: { executeAction } };
  }

  // Test: should resolve trigger data and DI requestContext values via .map()
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
    const triggerSchema = z.object({
      cool: z.string(),
    });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: inputData.test, second: inputData.test2 };
      },
      inputSchema: z.object({ test: z.string(), test2: z.number() }),
      outputSchema: z.object({ result: z.string(), second: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'var-map-requestcontext',
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string(), second: z.number() }),
    });

    workflow
      .then(step1)
      .map({
        test: mapVariable({
          initData: workflow,
          path: 'cool',
        }),
        test2: {
          requestContextPath: 'life',
          schema: z.number(),
        },
      })
      .then(step2)
      .commit();

    workflows['var-map-requestcontext'] = { workflow, mocks: { executeAction } };
  }

  // Test: should resolve dynamic mappings via .map()
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
    const triggerSchema = z.object({
      cool: z.string(),
    });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: inputData.test, second: inputData.test2 };
      },
      inputSchema: z.object({ test: z.string(), test2: z.string() }),
      outputSchema: z.object({ result: z.string(), second: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'var-map-dynamic-fn',
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string(), second: z.string() }),
    });

    workflow
      .then(step1)
      .map({
        test: mapVariable({
          initData: workflow,
          path: 'cool',
        }),
        test2: {
          schema: z.string(),
          fn: async ({ inputData }) => {
            return 'Hello ' + inputData.result;
          },
        },
      })
      .then(step2)
      .map({
        result: mapVariable({
          step: step2,
          path: 'result',
        }),
        second: {
          schema: z.string(),
          fn: async ({ getStepResult }) => {
            return getStepResult(step1).result;
          },
        },
      })
      .commit();

    workflows['var-map-dynamic-fn'] = { workflow, mocks: { executeAction }, step1 };
  }

  // Test: should resolve dynamic mappings via .map() with custom step id
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
    const triggerSchema = z.object({
      cool: z.string(),
    });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: inputData.test, second: inputData.test2 };
      },
      inputSchema: z.object({ test: z.string(), test2: z.string() }),
      outputSchema: z.object({ result: z.string(), second: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'var-map-custom-step-id',
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string(), second: z.string() }),
    });

    workflow
      .then(step1)
      .map(
        {
          test: mapVariable({
            initData: workflow,
            path: 'cool',
          }),
          test2: {
            schema: z.string(),
            fn: async ({ inputData }) => {
              return 'Hello ' + inputData.result;
            },
          },
        },
        {
          id: 'step1-mapping',
        },
      )
      .then(step2)
      .map({
        result: mapVariable({
          step: step2,
          path: 'result',
        }),
        second: {
          schema: z.string(),
          fn: async ({ getStepResult }) => {
            return getStepResult(step1).result;
          },
        },
      })
      .commit();

    workflows['var-map-custom-step-id'] = { workflow, mocks: { executeAction }, step1 };
  }

  return workflows;
}

/**
 * Create tests for variable resolution.
 * Tests use pre-registered workflows from the registry.
 */
export function createVariableResolutionTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { createWorkflow, createStep, execute, mapVariable, skipTests } = ctx;

  // If no registry provided, use legacy mode (create workflows inline)
  const useRegistry = registry !== undefined;

  describe('Variable Resolution', () => {
    it('should resolve trigger data', async () => {
      if (useRegistry) {
        const { workflow } = registry!['var-resolve-trigger-data']!;
        const result = await execute(workflow, { inputData: 'test-input' });

        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: { result: 'success' },
          payload: { inputData: 'test-input' },
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success' },
          payload: { result: 'success' },
        });
      } else {
        // Legacy inline mode
        const executeAction = vi.fn().mockResolvedValue({ result: 'success' });

        const step1 = createStep({
          id: 'step1',
          execute: executeAction,
          inputSchema: z.object({ inputData: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });
        const step2 = createStep({
          id: 'step2',
          execute: executeAction,
          inputSchema: z.object({ result: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({ inputData: z.string() }),
          outputSchema: z.object({}),
        });

        workflow.then(step1).then(step2).commit();

        const result = await execute(workflow, { inputData: 'test-input' });

        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: { result: 'success' },
          payload: { inputData: 'test-input' },
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success' },
          payload: { result: 'success' },
        });
      }
    });

    it('should provide access to step results via getStepResult helper', async () => {
      if (useRegistry) {
        const entry = registry!['var-get-step-result']!;
        entry.resetAssertions?.();

        const result = await execute(entry.workflow, { inputValue: 'test-input' });

        expect(entry.mocks.step1Action).toHaveBeenCalled();
        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: { value: 'step1-result' },
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { value: 'step2-result' },
        });

        // Run assertions captured during step execution
        const assertions = entry.getStep2Assertions?.();
        if (assertions) assertions();
      } else {
        // Legacy inline mode
        const step1Action = vi.fn().mockImplementation(async ({ inputData }) => {
          expect(inputData).toEqual({ inputValue: 'test-input' });
          return { value: 'step1-result' };
        });

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({ inputValue: z.string() }),
          outputSchema: z.object({ value: z.string() }),
        });

        const nonExecutedStep = createStep({
          id: 'non-executed-step',
          execute: vi.fn(),
          inputSchema: z.object({}),
          outputSchema: z.object({}),
        });

        const step2 = createStep({
          id: 'step2',
          execute: async ({ getStepResult }) => {
            // Test accessing previous step result
            const step1Result = getStepResult(step1);
            expect(step1Result).toEqual({ value: 'step1-result' });
            const step1ResultFromString = getStepResult('step1');
            expect(step1ResultFromString).toEqual({ value: 'step1-result' });

            const failedStep = getStepResult(nonExecutedStep);
            expect(failedStep).toBe(null);

            return { value: 'step2-result' };
          },
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({ inputValue: z.string() }),
          outputSchema: z.object({ value: z.string() }),
        });

        workflow.then(step1).then(step2).commit();

        const result = await execute(workflow, { inputValue: 'test-input' });

        expect(step1Action).toHaveBeenCalled();
        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: { value: 'step1-result' },
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { value: 'step2-result' },
        });
      }
    });

    it('should resolve trigger data from context', async () => {
      if (useRegistry) {
        const { workflow, mocks } = registry!['var-trigger-from-context']!;
        await execute(workflow, { inputData: 'test-input' });

        expect(mocks.executeAction).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { inputData: 'test-input' },
          }),
        );
      } else {
        // Legacy inline mode
        const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          inputData: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute: executeAction,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        workflow.then(step1).commit();

        await execute(workflow, { inputData: 'test-input' });

        expect(executeAction).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { inputData: 'test-input' },
          }),
        );
      }
    });

    it.skipIf(skipTests.getInitData)('should resolve trigger data from getInitData', async () => {
      if (useRegistry) {
        const { workflow, mocks } = registry!['var-get-init-data']!;
        const result = await execute(workflow, { cool: 'test-input' });

        expect(mocks.executeAction).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { cool: 'test-input' },
          }),
        );

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: { cool: 'test-input' } },
        });
      } else {
        // Legacy inline mode
        const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          cool: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute: executeAction,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const step2 = createStep({
          id: 'step2',
          execute: async ({ getInitData }) => {
            const initData = getInitData<z.infer<typeof triggerSchema>>();
            return { result: initData };
          },
          inputSchema: z.object({ result: z.string() }),
          outputSchema: z.object({ result: z.object({ cool: z.string() }) }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
          steps: [step1, step2],
        });

        workflow.then(step1).then(step2).commit();

        const result = await execute(workflow, { cool: 'test-input' });

        expect(executeAction).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { cool: 'test-input' },
          }),
        );

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: { cool: 'test-input' } },
        });
      }
    });

    it.skipIf(skipTests.mapPreviousStep)('should resolve variables from previous steps via .map()', async () => {
      if (useRegistry) {
        const { workflow, mocks } = registry!['var-map-previous-step']!;
        const result = await execute(workflow, {});

        expect(mocks.step2Action).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: {
              previousValue: 'step1-data',
            },
          }),
        );
        expect(result.status).toBe('success');
      } else {
        // Legacy inline mode
        const step1Action = vi.fn().mockResolvedValue({
          nested: { value: 'step1-data' },
        });
        const step2Action = vi.fn().mockResolvedValue({ result: 'success' });

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({}),
          outputSchema: z.object({ nested: z.object({ value: z.string() }) }),
        });
        const step2 = createStep({
          id: 'step2',
          execute: step2Action,
          inputSchema: z.object({ previousValue: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({ result: z.string() }),
        });

        workflow
          .then(step1)
          .map({
            previousValue: mapVariable({
              step: step1,
              path: 'nested.value',
            }),
          })
          .then(step2)
          .commit();

        const result = await execute(workflow, {});

        expect(step2Action).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: {
              previousValue: 'step1-data',
            },
          }),
        );
        expect(result.status).toBe('success');
      }
    });

    it.skipIf(skipTests.nonObjectOutput)('should resolve inputs from previous steps that are not objects', async () => {
      if (useRegistry) {
        const { workflow } = registry!['var-non-object-output']!;
        const result = await execute(workflow, {});

        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: 'step1-data',
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success', input: 'step1-data' },
        });
      } else {
        // Legacy inline mode
        const step1 = createStep({
          id: 'step1',
          execute: async () => {
            return 'step1-data';
          },
          inputSchema: z.object({}),
          outputSchema: z.string(),
        });
        const step2 = createStep({
          id: 'step2',
          execute: async ({ inputData }) => {
            return { result: 'success', input: inputData };
          },
          inputSchema: z.string(),
          outputSchema: z.object({ result: z.string(), input: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({ result: z.string() }),
        });

        workflow.then(step1).then(step2).commit();

        const result = await execute(workflow, {});

        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: 'step1-data',
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success', input: 'step1-data' },
        });
      }
    });

    it('should resolve inputs from previous steps that are arrays', async () => {
      if (useRegistry) {
        const { workflow } = registry!['var-array-output']!;
        const result = await execute(workflow, {});

        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: [{ str: 'step1-data' }],
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success', input: [{ str: 'step1-data' }] },
        });
      } else {
        // Legacy inline mode
        const step1 = createStep({
          id: 'step1',
          execute: async () => {
            return [{ str: 'step1-data' }];
          },
          inputSchema: z.object({}),
          outputSchema: z.array(z.object({ str: z.string() })),
        });
        const step2 = createStep({
          id: 'step2',
          execute: async ({ inputData }) => {
            return { result: 'success', input: inputData };
          },
          inputSchema: z.array(z.object({ str: z.string() })),
          outputSchema: z.object({ result: z.string(), input: z.array(z.object({ str: z.string() })) }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({ result: z.string() }),
        });

        workflow.then(step1).then(step2).commit();

        const result = await execute(workflow, {});

        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: [{ str: 'step1-data' }],
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success', input: [{ str: 'step1-data' }] },
        });
      }
    });

    it('should resolve constant values via .map()', async () => {
      if (useRegistry) {
        const { workflow } = registry!['var-map-constant']!;
        const result = await execute(workflow, { cool: 'test-input' });

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'none', second: 0 },
          payload: { candidates: [], iteration: 0 },
        });
      } else {
        // Legacy inline mode
        const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          cool: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute: executeAction,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const step2 = createStep({
          id: 'step2',
          execute: async ({ inputData }) => {
            return {
              result: inputData.candidates.map((c: { name: string }) => c.name).join('') || 'none',
              second: inputData.iteration,
            };
          },
          inputSchema: z.object({ candidates: z.array(z.object({ name: z.string() })), iteration: z.number() }),
          outputSchema: z.object({ result: z.string(), second: z.number() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string(), second: z.number() }),
        });

        workflow
          .then(step1)
          .map({
            candidates: {
              value: [],
              schema: z.array(z.object({ name: z.string() })),
            },
            iteration: {
              value: 0,
              schema: z.number(),
            },
          })
          .then(step2)
          .commit();

        const result = await execute(workflow, { cool: 'test-input' });

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'none', second: 0 },
          payload: { candidates: [], iteration: 0 },
        });
      }
    });

    it('should resolve fully dynamic input via .map()', async () => {
      if (useRegistry) {
        const { workflow } = registry!['var-map-dynamic']!;
        const result = await execute(workflow, { cool: 'test-input' });

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success, hello', second: 0 },
          payload: { candidates: [{ name: 'success' }, { name: 'hello' }], iteration: 0 },
        });
      } else {
        // Legacy inline mode
        const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          cool: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute: executeAction,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const step2 = createStep({
          id: 'step2',
          execute: async ({ inputData }) => {
            return {
              result: inputData.candidates.map((c: { name: string }) => c.name).join(', ') || 'none',
              second: inputData.iteration,
            };
          },
          inputSchema: z.object({ candidates: z.array(z.object({ name: z.string() })), iteration: z.number() }),
          outputSchema: z.object({ result: z.string(), second: z.number() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string(), second: z.number() }),
        });

        workflow
          .then(step1)
          .map(async ({ inputData }) => {
            return {
              candidates: [{ name: inputData.result }, { name: 'hello' }],
              iteration: 0,
            };
          })
          .then(step2)
          .commit();

        const result = await execute(workflow, { cool: 'test-input' });

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success, hello', second: 0 },
          payload: { candidates: [{ name: 'success' }, { name: 'hello' }], iteration: 0 },
        });
      }
    });

    it.skipIf(skipTests.mapRequestContextPath)(
      'should resolve trigger data and DI requestContext values via .map()',
      async () => {
        if (useRegistry) {
          const { workflow, mocks } = registry!['var-map-requestcontext']!;
          // Create a Map-like requestContext
          const requestContext = new Map([['life', 42]]);

          const result = await execute(workflow, { cool: 'test-input' }, { requestContext: requestContext as any });

          expect(mocks.executeAction).toHaveBeenCalledWith(
            expect.objectContaining({
              inputData: { cool: 'test-input' },
            }),
          );

          expect(result.steps.step2).toMatchObject({
            status: 'success',
            output: { result: 'test-input', second: 42 },
            payload: { test: 'test-input', test2: 42 },
          });
        }
      },
    );

    it.skipIf(skipTests.mapDynamicFn)('should resolve dynamic mappings via .map()', async () => {
      if (useRegistry) {
        const { workflow, mocks } = registry!['var-map-dynamic-fn']!;
        const result = await execute(workflow, { cool: 'test-input' });

        if (result.status !== 'success') {
          throw new Error('Workflow should have succeeded');
        }

        expect(mocks.executeAction).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { cool: 'test-input' },
          }),
        );

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'test-input', second: 'Hello success' },
          payload: { test: 'test-input', test2: 'Hello success' },
        });

        expect(result.result).toEqual({
          result: 'test-input',
          second: 'success',
        });
      }
    });

    it.skipIf(skipTests.mapCustomStepId)('should resolve dynamic mappings via .map() with custom step id', async () => {
      if (useRegistry) {
        const { workflow, mocks } = registry!['var-map-custom-step-id']!;
        const result = await execute(workflow, { cool: 'test-input' });

        if (result.status !== 'success') {
          throw new Error('Workflow should have succeeded');
        }

        expect(mocks.executeAction).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { cool: 'test-input' },
          }),
        );

        expect(result.steps['step1-mapping']).toBeDefined();

        expect(result.steps['step1-mapping']).toMatchObject({
          status: 'success',
          output: { test: 'test-input', test2: 'Hello success' },
          payload: { result: 'success' },
        });

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'test-input', second: 'Hello success' },
          payload: { test: 'test-input', test2: 'Hello success' },
        });

        expect(result.result).toEqual({
          result: 'test-input',
          second: 'success',
        });
      }
    });
  });
}
