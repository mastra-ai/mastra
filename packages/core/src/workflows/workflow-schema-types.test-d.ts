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

    it('should reject commit when a final map output does not satisfy the workflow output schema', () => {
      const inputSchema = z.object({ query: z.string() });
      const outputSchema = z.object({
        summary: z.string(),
        items: z.array(z.string()),
      });

      const workflow = createWorkflow({
        id: 'typed-map-output-workflow',
        inputSchema,
        outputSchema,
      }).map(async () => 123);

      // @ts-expect-error - final map output must satisfy the workflow output schema
      workflow.commit();
    });

    it('should reject commit when map output is a supertype of the workflow output schema', () => {
      const inputSchema = z.object({ query: z.string() });
      const outputSchema = z.object({
        summary: z.string(),
        items: z.array(z.string()),
      });

      const workflow = createWorkflow({
        id: 'supertype-map-output-workflow',
        inputSchema,
        outputSchema,
      }).map(async ({ inputData }) => ({
        summary: inputData.query,
      }));

      // @ts-expect-error - map output is missing 'items', a supertype of the output schema
      workflow.commit();
    });

    it('should allow a map output that satisfies the workflow output schema', () => {
      const inputSchema = z.object({ query: z.string() });
      const outputSchema = z.object({
        summary: z.string(),
        items: z.array(z.string()),
      });

      const workflow = createWorkflow({
        id: 'valid-typed-map-output-workflow',
        inputSchema,
        outputSchema,
      })
        .map(async ({ inputData }) => ({
          summary: inputData.query,
          items: [inputData.query],
        }))
        .commit();

      expectTypeOf(workflow).not.toBeNever();
    });

    it('should reject commit when a final .then() step output does not satisfy the workflow output schema', () => {
      const step = createStep({
        id: 'wrong-output-step',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ count: z.number() }),
        execute: async () => ({ count: 42 }),
      });

      const workflow = createWorkflow({
        id: 'then-mismatch-workflow',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({
          summary: z.string(),
          items: z.array(z.string()),
        }),
      }).then(step);

      // @ts-expect-error - step output { count: number } does not satisfy workflow output { summary: string, items: string[] }
      workflow.commit();
    });

    it('should allow commit when a final .then() step output satisfies the workflow output schema', () => {
      const step = createStep({
        id: 'matching-output-step',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({
          summary: z.string(),
          items: z.array(z.string()),
        }),
        execute: async ({ inputData }) => ({
          summary: inputData.query,
          items: [inputData.query],
        }),
      });

      const workflow = createWorkflow({
        id: 'then-match-workflow',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({
          summary: z.string(),
          items: z.array(z.string()),
        }),
      })
        .then(step)
        .commit();

      expectTypeOf(workflow).not.toBeNever();
    });

    it('should allow commit when outputSchema is z.any() regardless of last step output', () => {
      const step = createStep({
        id: 'any-output-step',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ count: z.number() }),
        execute: async () => ({ count: 42 }),
      });

      // outputSchema is z.any() — commit should always succeed regardless of last step output
      const workflow = createWorkflow({
        id: 'any-output-schema-workflow',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.any(),
      })
        .then(step)
        .commit();

      expectTypeOf(workflow).not.toBeNever();
    });

    it('should allow commit after object-style map regardless of workflow outputSchema', () => {
      const step = createStep({
        id: 'some-step',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ value: z.number() }),
        execute: async () => ({ value: 1 }),
      });

      // Object-style map({ key: { step, path } }) cannot statically infer its output shape
      // because `path` is a runtime string. commit() must always be allowed after it.
      // `as any` is required here: the map overload's mappingConfig is a wide union of several
      // variant shapes, and TS cannot narrow a plain object literal to the correct variant
      // without an explicit cast.
      const workflow = createWorkflow({
        id: 'object-map-workflow',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ summary: z.string(), items: z.array(z.string()) }),
      })
        .then(step)
        .map({ summary: { step, path: 'value' } } as any)
        .commit();

      expectTypeOf(workflow).not.toBeNever();
    });
  });

  describe('.map() type inference', () => {
    it('should infer return type of function-based .map and propagate to next .then()', () => {
      const step = createStep({
        id: 'needs-count',
        inputSchema: z.object({ count: z.number() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ inputData }) => ({ result: String(inputData.count) }),
      });

      const workflow = createWorkflow({
        id: 'map-workflow',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      })
        .map(async () => ({ count: 42 }))
        .then(step);

      expectTypeOf(workflow).not.toBeNever();
    });

    it('should error when .map output does not match next step input', () => {
      const step = createStep({
        id: 'needs-count',
        inputSchema: z.object({ count: z.number() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ inputData }) => ({ result: String(inputData.count) }),
      });

      const workflow = createWorkflow({
        id: 'invalid-map-workflow',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      }).map(async () => 123);

      // @ts-expect-error - map returns number, step expects { count: number }
      workflow.then(step);
    });

    it('should work with sync function callbacks', () => {
      const step = createStep({
        id: 'sync-needs-count',
        inputSchema: z.object({ count: z.number() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ inputData }) => ({ result: String(inputData.count) }),
      });

      const workflow = createWorkflow({
        id: 'sync-map-workflow',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      })
        .map(() => ({ count: 42 }))
        .then(step);

      expectTypeOf(workflow).not.toBeNever();
    });
  });

  describe('.commit() output validation', () => {
    it('should error when final step output does not match outputSchema', () => {
      const workflow = createWorkflow({
        id: 'invalid-commit-workflow',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ summary: z.string(), items: z.array(z.string()) }),
      }).map(async () => 123);

      // @ts-expect-error - map returns number, outputSchema expects { summary, items }
      workflow.commit();
    });

    it('should allow commit when final output matches outputSchema', () => {
      const workflow = createWorkflow({
        id: 'valid-commit-workflow',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ result: z.string() }),
      })
        .map(async () => ({ result: 'done' }))
        .commit();

      expectTypeOf(workflow).not.toBeNever();
    });
  });
});
