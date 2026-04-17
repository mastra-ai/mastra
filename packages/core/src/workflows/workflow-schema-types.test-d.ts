import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from './workflow';

describe('Workflow schema type inference', () => {
  describe('schemas with .optional().default()', () => {
    it('should allow chaining a step whose inputSchema matches the workflow inputSchema with optional defaults', () => {
      const schema = z.object({
        requiredField: z.string(),
        optionalWithDefault: z.number().optional().default(10),
      });

      const step = createStep({
        id: 'my-step',
        inputSchema: schema,
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ inputData }) => {
          return { result: `Value: ${inputData.optionalWithDefault}` };
        },
      });

      const workflow = createWorkflow({
        id: 'my-workflow',
        inputSchema: schema,
        outputSchema: z.object({ result: z.string() }),
      });

      // This should not produce a type error — the workflow and step share the same schema,
      // so the step's input should be compatible with the workflow's input after parsing.
      const chained = workflow.then(step);

      expectTypeOf(chained).not.toBeNever();
    });

    it('should allow chaining when step inputSchema has a subset of optional default fields', () => {
      const workflowSchema = z.object({
        name: z.string(),
        count: z.number().optional().default(5),
      });

      const stepSchema = z.object({
        name: z.string(),
        count: z.number().optional().default(5),
      });

      const step = createStep({
        id: 'subset-step',
        inputSchema: stepSchema,
        outputSchema: z.object({ done: z.boolean() }),
        execute: async ({ inputData }) => {
          return { done: inputData.count > 0 };
        },
      });

      const workflow = createWorkflow({
        id: 'subset-workflow',
        inputSchema: workflowSchema,
        outputSchema: z.object({ done: z.boolean() }),
      });

      // Should compile without error
      const chained = workflow.then(step);

      expectTypeOf(chained).not.toBeNever();
    });

    it('should allow dowhile with optional default schemas', () => {
      const schema = z.object({
        value: z.number(),
        threshold: z.number().optional().default(100),
      });

      const step = createStep({
        id: 'loop-step',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ inputData }) => {
          return { value: inputData.value + 1, threshold: inputData.threshold };
        },
      });

      const workflow = createWorkflow({
        id: 'dowhile-workflow',
        inputSchema: schema,
        outputSchema: schema,
      });

      const chained = workflow.dowhile(step, async ({ inputData }) => inputData.value < 10);

      expectTypeOf(chained).not.toBeNever();
    });

    it('should allow dountil with optional default schemas', () => {
      const schema = z.object({
        value: z.number(),
        threshold: z.number().optional().default(100),
      });

      const step = createStep({
        id: 'loop-step',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ inputData }) => {
          return { value: inputData.value + 1, threshold: inputData.threshold };
        },
      });

      const workflow = createWorkflow({
        id: 'dountil-workflow',
        inputSchema: schema,
        outputSchema: schema,
      });

      const chained = workflow.dountil(step, async ({ inputData }) => inputData.value >= 10);

      expectTypeOf(chained).not.toBeNever();
    });

    it('should allow foreach with optional default schemas in array elements', () => {
      const elementSchema = z.object({
        value: z.number(),
        threshold: z.number().optional().default(100),
      });

      const step = createStep({
        id: 'each-step',
        inputSchema: elementSchema,
        outputSchema: elementSchema,
        execute: async ({ inputData }) => {
          return { value: inputData.value + 1, threshold: inputData.threshold };
        },
      });

      const arrayStep = createStep({
        id: 'produce-array',
        inputSchema: z.object({ items: z.array(elementSchema) }),
        outputSchema: z.array(elementSchema),
        execute: async ({ inputData }) => inputData.items,
      });

      const workflow = createWorkflow({
        id: 'foreach-workflow',
        inputSchema: z.object({ items: z.array(elementSchema) }),
        outputSchema: z.array(elementSchema),
      });

      const chained = workflow.then(arrayStep).foreach(step);

      expectTypeOf(chained).not.toBeNever();
    });

    it('should type inputData in dowhile condition as the step output schema', () => {
      const inputSchema = z.object({
        taskId: z.string(),
      });
      const outputSchema = z.object({
        taskId: z.string(),
        status: z.string(),
      });

      const step = createStep({
        id: 'fetch-task',
        inputSchema,
        outputSchema,
        execute: async ({ inputData }) => {
          return { taskId: inputData.taskId, status: 'pending' };
        },
      });

      const workflow = createWorkflow({
        id: 'poll-workflow',
        inputSchema,
        outputSchema,
      });

      workflow.dowhile(step, async ({ inputData }) => {
        // inputData should be typed as the step's OUTPUT schema, not input schema.
        // After the fix, `status` should be a known property typed as string.
        expectTypeOf(inputData).not.toBeAny();
        expectTypeOf(inputData.status).toBeString();
        expectTypeOf(inputData.taskId).toBeString();
        return inputData.status === 'pending';
      });
    });

    it('should type inputData in dountil condition as the step output schema', () => {
      const inputSchema = z.object({
        taskId: z.string(),
      });
      const outputSchema = z.object({
        taskId: z.string(),
        status: z.string(),
      });

      const step = createStep({
        id: 'fetch-task',
        inputSchema,
        outputSchema,
        execute: async ({ inputData }) => {
          return { taskId: inputData.taskId, status: 'pending' };
        },
      });

      const workflow = createWorkflow({
        id: 'poll-workflow',
        inputSchema,
        outputSchema,
      });

      workflow.dountil(step, async ({ inputData }) => {
        // inputData should be typed as the step's OUTPUT schema, not input schema.
        // After the fix, `status` should be a known property typed as string.
        expectTypeOf(inputData).not.toBeAny();
        expectTypeOf(inputData.status).toBeString();
        expectTypeOf(inputData.taskId).toBeString();
        return inputData.status === 'completed';
      });
    });

    it('should type inputData in dowhile condition with output-only fields', () => {
      // Scenario: output has fields that input does NOT have.
      // The condition should see the output fields, not the input fields.
      const step = createStep({
        id: 'process-step',
        inputSchema: z.object({ seed: z.number() }),
        outputSchema: z.object({ seed: z.number(), result: z.number(), done: z.boolean() }),
        execute: async ({ inputData }) => {
          return { seed: inputData.seed, result: inputData.seed * 2, done: false };
        },
      });

      const workflow = createWorkflow({
        id: 'process-workflow',
        inputSchema: z.object({ seed: z.number() }),
        outputSchema: z.object({ seed: z.number(), result: z.number(), done: z.boolean() }),
      });

      workflow.dowhile(step, async ({ inputData }) => {
        expectTypeOf(inputData).not.toBeAny();
        // `result` and `done` only exist on output, not input
        expectTypeOf(inputData.result).toBeNumber();
        expectTypeOf(inputData.done).toBeBoolean();
        expectTypeOf(inputData.seed).toBeNumber();
        return !inputData.done;
      });
    });

    it('should type inputData in dountil condition with output-only fields', () => {
      const step = createStep({
        id: 'process-step',
        inputSchema: z.object({ seed: z.number() }),
        outputSchema: z.object({ seed: z.number(), result: z.number(), done: z.boolean() }),
        execute: async ({ inputData }) => {
          return { seed: inputData.seed, result: inputData.seed * 2, done: false };
        },
      });

      const workflow = createWorkflow({
        id: 'process-workflow',
        inputSchema: z.object({ seed: z.number() }),
        outputSchema: z.object({ seed: z.number(), result: z.number(), done: z.boolean() }),
      });

      workflow.dountil(step, async ({ inputData }) => {
        expectTypeOf(inputData).not.toBeAny();
        expectTypeOf(inputData.result).toBeNumber();
        expectTypeOf(inputData.done).toBeBoolean();
        expectTypeOf(inputData.seed).toBeNumber();
        return inputData.done;
      });
    });

    it('should type iterationCount as number in loop condition', () => {
      const schema = z.object({ value: z.number() });

      const step = createStep({
        id: 'loop-step',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ inputData }) => ({ value: inputData.value + 1 }),
      });

      const workflow = createWorkflow({
        id: 'iter-workflow',
        inputSchema: schema,
        outputSchema: schema,
      });

      workflow.dowhile(step, async ({ inputData, iterationCount }) => {
        expectTypeOf(iterationCount).toBeNumber();
        expectTypeOf(inputData).not.toBeAny();
        return inputData.value < 10;
      });

      workflow.dountil(step, async ({ inputData, iterationCount }) => {
        expectTypeOf(iterationCount).toBeNumber();
        expectTypeOf(inputData).not.toBeAny();
        return inputData.value >= 10;
      });
    });

    it('should still reject steps with incompatible input schemas', () => {
      const workflowSchema = z.object({
        name: z.string(),
      });

      const incompatibleStepSchema = z.object({
        totallyDifferent: z.number(),
      });

      const step = createStep({
        id: 'incompatible-step',
        inputSchema: incompatibleStepSchema,
        outputSchema: z.object({ done: z.boolean() }),
        execute: async () => {
          return { done: true };
        },
      });

      const workflow = createWorkflow({
        id: 'reject-workflow',
        inputSchema: workflowSchema,
        outputSchema: z.object({ done: z.boolean() }),
      });

      // @ts-expect-error - step input schema is incompatible with workflow input
      workflow.then(step);
    });
  });
});
