/**
 * Schema Validation tests for workflows
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';

/**
 * Create all workflows needed for schema validation tests.
 */
export function createSchemaValidationWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Test: should throw error if trigger data is invalid
  {
    const triggerSchema = z.object({
      required: z.string(),
      nested: z.object({
        value: z.number(),
      }),
    });

    const step1 = createStep({
      id: 'step1',
      execute: vi.fn().mockResolvedValue({ result: 'success' }),
      inputSchema: z.object({
        required: z.string(),
        nested: z.object({
          value: z.number(),
        }),
      }),
      outputSchema: z.object({
        result: z.string(),
      }),
    });

    const workflow = createWorkflow({
      id: 'schema-invalid-trigger',
      inputSchema: triggerSchema,
      outputSchema: z.object({
        result: z.string(),
      }),
      steps: [step1],
      options: { validateInputs: true },
    });

    workflow.then(step1).commit();

    workflows['schema-invalid-trigger'] = { workflow, mocks: {} };
  }

  // Test: should use default value from inputSchema
  {
    const triggerSchema = z.object({
      required: z.string(),
      nested: z
        .object({
          value: z.number(),
        })
        .optional()
        .default({ value: 1 }),
    });

    const step1 = createStep({
      id: 'step1',
      execute: async ({ inputData }) => {
        return inputData;
      },
      inputSchema: triggerSchema,
      outputSchema: triggerSchema,
    });

    const workflow = createWorkflow({
      id: 'schema-default-value',
      inputSchema: triggerSchema,
      outputSchema: triggerSchema,
      steps: [step1],
      options: { validateInputs: true },
    });

    workflow.then(step1).commit();

    workflows['schema-default-value'] = { workflow, mocks: {} };
  }

  // Test: should throw error if inputData is invalid
  {
    const successAction = vi.fn().mockImplementation(() => {
      return { result: 'success' };
    });

    const step1 = createStep({
      id: 'step1',
      execute: successAction,
      inputSchema: z.object({
        start: z.string(),
      }),
      outputSchema: z.object({
        start: z.string(),
      }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: successAction,
      inputSchema: z.object({
        start: z.string(),
      }),
      outputSchema: z.object({
        result: z.string(),
      }),
    });

    const workflow = createWorkflow({
      id: 'schema-invalid-input',
      inputSchema: z.object({
        start: z.string(),
      }),
      outputSchema: z.object({
        result: z.string(),
      }),
      steps: [step1, step2],
      options: { validateInputs: true },
    });

    workflow.then(step1).then(step2).commit();

    workflows['schema-invalid-input'] = { workflow, mocks: { successAction } };
  }

  // Test: should use default value from inputSchema for step input
  {
    const step1 = createStep({
      id: 'step1',
      execute: async () => ({ someValue: 'test' }),
      inputSchema: z.object({}),
      outputSchema: z.object({ someValue: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: inputData.defaultedValue + '-processed' };
      },
      inputSchema: z.object({
        defaultedValue: z.string().default('default-value'),
      }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'schema-step-default',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1, step2],
      options: { validateInputs: true },
    });

    workflow.then(step1).then(step2).commit();

    workflows['schema-step-default'] = { workflow, mocks: {} };
  }

  // Test: should allow a steps input schema to be a subset of the previous step output schema
  {
    const step1 = createStep({
      id: 'step1',
      execute: async () => ({
        value1: 'test1',
        value2: 'test2',
        value3: 'test3',
      }),
      inputSchema: z.object({}),
      outputSchema: z.object({
        value1: z.string(),
        value2: z.string(),
        value3: z.string(),
      }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: inputData.value1 + '-processed' };
      },
      inputSchema: z.object({
        value1: z.string(),
      }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'schema-subset-input',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1, step2],
    });

    workflow.then(step1).then(step2).commit();

    workflows['schema-subset-input'] = { workflow, mocks: {} };
  }

  // Test: should properly validate input schema when .map is used after .foreach - bug #11313
  {
    const mapAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { value: inputData.value + 11 };
    });

    const mapStep = createStep({
      id: 'map',
      description: 'Maps (+11) on the current value',
      inputSchema: z.object({
        value: z.number(),
      }),
      outputSchema: z.object({
        value: z.number(),
      }),
      execute: mapAction,
    });

    const finalStep = createStep({
      id: 'final',
      description: 'Final step that prints the result',
      inputSchema: z.object({
        inputValue: z.number(),
      }),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      execute: async ({ inputData }) => {
        return { finalValue: inputData.inputValue };
      },
    });

    const workflow = createWorkflow({
      steps: [mapStep, finalStep],
      id: 'schema-map-after-foreach-bug-11313',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
    });

    workflow
      .foreach(mapStep)
      .map(
        async ({ inputData }) => {
          return {
            inputValue: inputData.reduce((acc: number, curr: { value: number }) => acc + curr.value, 0),
          };
        },
        { id: 'map-step' },
      )
      .then(finalStep)
      .commit();

    workflows['schema-map-after-foreach-bug-11313'] = {
      workflow,
      mocks: { mapAction },
      resetMocks: () => {
        mapAction.mockClear();
      },
    };
  }

  return workflows;
}

/**
 * Create tests for schema validation.
 */
export function createSchemaValidationTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('Schema Validation', () => {
    it.skipIf(skipTests.schemaValidationThrows)('should throw error if trigger data is invalid', async () => {
      const { workflow } = registry!['schema-invalid-trigger'];

      try {
        await execute(workflow, {
          required: 'test',
          // @ts-expect-error - intentionally passing invalid data
          nested: { value: 'not-a-number' },
        });
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as any)?.stack).toContain(
          'Error: Invalid input data: \n- nested.value: Expected number, received string',
        );
      }
    });

    it('should use default value from inputSchema', async () => {
      const { workflow } = registry!['schema-default-value'];
      const result = await execute(workflow, {
        required: 'test',
      });

      expect(result.status).toBe('success');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        payload: { required: 'test', nested: { value: 1 } },
        output: { required: 'test', nested: { value: 1 } },
      });

      // @ts-expect-error - result type is not inferred
      expect(result.result).toEqual({ required: 'test', nested: { value: 1 } });
    });

    it.skipIf(skipTests.schemaValidationThrows)('should throw error if inputData is invalid', async () => {
      const { workflow } = registry!['schema-invalid-input'];

      try {
        await execute(workflow, {
          // @ts-expect-error - intentionally passing invalid data
          start: 123,
        });
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as any)?.stack).toContain(
          'Error: Invalid input data: \n- start: Expected string, received number',
        );
      }
    });

    it('should use default value from inputSchema for step input', async () => {
      const { workflow } = registry!['schema-step-default'];
      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(result.steps.step2).toMatchObject({
        status: 'success',
        output: { result: 'default-value-processed' },
      });
    });

    it('should allow a steps input schema to be a subset of the previous step output schema', async () => {
      const { workflow } = registry!['schema-subset-input'];
      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(result.steps.step2).toMatchObject({
        status: 'success',
        output: { result: 'test1-processed' },
      });
    });

    // Bug regression test #11313 - .map after .foreach should properly validate schema
    it('should properly validate input schema when .map is used after .foreach - bug #11313', async () => {
      const { workflow, mocks, resetMocks } = registry!['schema-map-after-foreach-bug-11313'];
      resetMocks?.();

      const result = await execute(workflow, [{ value: 1 }, { value: 22 }, { value: 333 }]);

      expect(mocks.mapAction).toHaveBeenCalledTimes(3);
      expect(result.steps).toMatchObject({
        map: {
          status: 'success',
          output: [{ value: 12 }, { value: 33 }, { value: 344 }],
        },
        'map-step': {
          status: 'success',
          output: { inputValue: 12 + 33 + 344 }, // 389
        },
        final: {
          status: 'success',
          output: { finalValue: 389 },
        },
      });
    });
  });
}
