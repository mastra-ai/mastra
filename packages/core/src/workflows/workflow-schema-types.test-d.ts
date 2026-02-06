import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
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
