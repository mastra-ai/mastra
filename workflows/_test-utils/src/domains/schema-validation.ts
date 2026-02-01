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
  });
}
