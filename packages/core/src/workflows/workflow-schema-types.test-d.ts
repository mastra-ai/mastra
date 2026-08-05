import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { createTool } from '../tools';
import { createWorkflow } from './create';
import { createStep } from './workflow';

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

  // Regression: https://github.com/mastra-ai/mastra/issues/15989
  // foreach/dowhile/dountil dropped the TRequestContext generic on the step
  // parameter, causing typed requestContextSchema steps to be rejected even
  // when the workflow declared a matching requestContextSchema.
  describe('requestContextSchema inference in loop helpers', () => {
    const requestContextSchema = z.object({
      propA: z.string(),
      propB: z.number(),
    });

    it('foreach should accept a step whose requestContextSchema matches the workflow', () => {
      const elementSchema = z.object({ value: z.number() });

      const step = createStep({
        id: 'each-with-ctx',
        inputSchema: elementSchema,
        outputSchema: elementSchema,
        requestContextSchema,
        execute: async ({ inputData }) => inputData,
      });

      const workflow = createWorkflow({
        id: 'foreach-with-ctx',
        inputSchema: z.array(elementSchema),
        outputSchema: z.array(elementSchema),
        requestContextSchema,
      });

      const chained = workflow.foreach(step);
      expectTypeOf(chained).not.toBeNever();
    });

    it('dowhile should accept a step whose requestContextSchema matches the workflow', () => {
      const schema = z.object({ value: z.number() });

      const step = createStep({
        id: 'dowhile-with-ctx',
        inputSchema: schema,
        outputSchema: schema,
        requestContextSchema,
        execute: async ({ inputData }) => ({ value: inputData.value + 1 }),
      });

      const workflow = createWorkflow({
        id: 'dowhile-ctx-workflow',
        inputSchema: schema,
        outputSchema: schema,
        requestContextSchema,
      });

      const chained = workflow.dowhile(step, async ({ inputData }) => inputData.value < 10);
      expectTypeOf(chained).not.toBeNever();
    });

    it('dountil should accept a step whose requestContextSchema matches the workflow', () => {
      const schema = z.object({ value: z.number() });

      const step = createStep({
        id: 'dountil-with-ctx',
        inputSchema: schema,
        outputSchema: schema,
        requestContextSchema,
        execute: async ({ inputData }) => ({ value: inputData.value + 1 }),
      });

      const workflow = createWorkflow({
        id: 'dountil-ctx-workflow',
        inputSchema: schema,
        outputSchema: schema,
        requestContextSchema,
      });

      const chained = workflow.dountil(step, async ({ inputData }) => inputData.value >= 10);
      expectTypeOf(chained).not.toBeNever();
    });

    it('foreach should accept a step that does not declare a requestContextSchema in a workflow that does', () => {
      const elementSchema = z.object({ value: z.number() });

      const step = createStep({
        id: 'each-no-ctx',
        inputSchema: elementSchema,
        outputSchema: elementSchema,
        execute: async ({ inputData }) => inputData,
      });

      const workflow = createWorkflow({
        id: 'foreach-with-ctx-noctx-step',
        inputSchema: z.array(elementSchema),
        outputSchema: z.array(elementSchema),
        requestContextSchema,
      });

      const chained = workflow.foreach(step);
      expectTypeOf(chained).not.toBeNever();
    });

    it('foreach should reject a step whose requestContextSchema does not match the workflow', () => {
      const elementSchema = z.object({ value: z.number() });

      const step = createStep({
        id: 'each-bad-ctx',
        inputSchema: elementSchema,
        outputSchema: elementSchema,
        requestContextSchema: z.object({ otherProp: z.boolean() }),
        execute: async ({ inputData }) => inputData,
      });

      const workflow = createWorkflow({
        id: 'foreach-mismatch',
        inputSchema: z.array(elementSchema),
        outputSchema: z.array(elementSchema),
        requestContextSchema,
      });

      // @ts-expect-error - step's requestContextSchema does not match the workflow's
      workflow.foreach(step);
    });

    it('dowhile should reject a step whose requestContextSchema does not match the workflow', () => {
      const schema = z.object({ value: z.number() });

      const step = createStep({
        id: 'dowhile-bad-ctx',
        inputSchema: schema,
        outputSchema: schema,
        requestContextSchema: z.object({ otherProp: z.boolean() }),
        execute: async ({ inputData }) => ({ value: inputData.value + 1 }),
      });

      const workflow = createWorkflow({
        id: 'dowhile-mismatch',
        inputSchema: schema,
        outputSchema: schema,
        requestContextSchema,
      });

      // @ts-expect-error - step's requestContextSchema does not match the workflow's
      workflow.dowhile(step, async ({ inputData }) => inputData.value < 10);
    });

    it('dountil should reject a step whose requestContextSchema does not match the workflow', () => {
      const schema = z.object({ value: z.number() });

      const step = createStep({
        id: 'dountil-bad-ctx',
        inputSchema: schema,
        outputSchema: schema,
        requestContextSchema: z.object({ otherProp: z.boolean() }),
        execute: async ({ inputData }) => ({ value: inputData.value + 1 }),
      });

      const workflow = createWorkflow({
        id: 'dountil-mismatch',
        inputSchema: schema,
        outputSchema: schema,
        requestContextSchema,
      });

      // @ts-expect-error - step's requestContextSchema does not match the workflow's
      workflow.dountil(step, async ({ inputData }) => inputData.value >= 10);
    });
  });

  // Regression: https://github.com/mastra-ai/mastra/issues/16975
  // parallel() dropped the TRequestContext generic on the step parameter,
  // causing typed requestContextSchema steps to be rejected with a misleading
  // "Expected Step with state schema that is a subset of workflow state" error.
  describe('requestContextSchema inference in parallel', () => {
    const requestContextSchema = z.object({
      userId: z.string(),
    });

    it('parallel should accept steps whose requestContextSchema matches the workflow', () => {
      const stepA = createStep({
        id: 'step-a',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ a: z.string() }),
        requestContextSchema,
        execute: async ({ inputData }) => ({ a: inputData.name }),
      });

      const stepB = createStep({
        id: 'step-b',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ b: z.string() }),
        requestContextSchema,
        execute: async () => ({ b: 'step-b' }),
      });

      const workflow = createWorkflow({
        id: 'repro',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        requestContextSchema,
      });

      const chained = workflow.parallel([stepA, stepB]);
      expectTypeOf(chained).not.toBeNever();
    });

    it('parallel should reject a step whose requestContextSchema does not match the workflow', () => {
      const step = createStep({
        id: 'bad-ctx',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ a: z.string() }),
        requestContextSchema: z.object({ otherProp: z.boolean() }),
        execute: async ({ inputData }) => ({ a: inputData.name }),
      });

      const workflow = createWorkflow({
        id: 'parallel-mismatch',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        requestContextSchema,
      });

      // @ts-expect-error - step's requestContextSchema does not match the workflow's
      workflow.parallel([step]);
    });
  });

  // Regression: https://github.com/mastra-ai/mastra/issues/14627
  // createWorkflow must infer the workflow state type from stateSchema so that
  // `state` in dowhile/dountil condition callbacks is typed from the schema,
  // not `unknown`. (state was already correct inside createStep; the factory
  // is what lost the inference.) These tests guard against regressing it.
  describe('stateSchema inference (issue #14627)', () => {
    const stateSchema = z.object({
      attempts: z.number(),
      lastError: z.string().optional(),
    });
    const ioSchema = z.object({ value: z.number() });

    const loopStep = createStep({
      id: 'loop-step',
      inputSchema: ioSchema,
      outputSchema: ioSchema,
      stateSchema,
      execute: async ({ inputData }) => ({ value: inputData.value + 1 }),
    });

    it('types `state` in the dowhile condition from the workflow stateSchema', () => {
      const workflow = createWorkflow({
        id: 'dowhile-state',
        inputSchema: ioSchema,
        outputSchema: ioSchema,
        stateSchema,
      });

      workflow.dowhile(loopStep, async ({ state }) => {
        expectTypeOf(state).not.toBeUnknown();
        expectTypeOf(state).not.toBeAny();
        expectTypeOf(state.attempts).toBeNumber();
        expectTypeOf(state.lastError).toEqualTypeOf<string | undefined>();
        return state.attempts < 5;
      });
    });

    it('types `state` in the dountil condition from the workflow stateSchema', () => {
      const workflow = createWorkflow({
        id: 'dountil-state',
        inputSchema: ioSchema,
        outputSchema: ioSchema,
        stateSchema,
      });

      workflow.dountil(loopStep, async ({ state }) => {
        expectTypeOf(state).not.toBeUnknown();
        expectTypeOf(state).not.toBeAny();
        expectTypeOf(state.attempts).toBeNumber();
        expectTypeOf(state.lastError).toEqualTypeOf<string | undefined>();
        return state.attempts >= 5;
      });
    });

    it('leaves `state` as unknown when no stateSchema is declared', () => {
      const workflow = createWorkflow({
        id: 'no-state',
        inputSchema: ioSchema,
        outputSchema: ioSchema,
      });

      workflow.dowhile(loopStep, async ({ state }) => {
        expectTypeOf(state).toBeUnknown();
        return true;
      });
    });
  });
});

/**
 * Type-level inference for the declarative `agent` / `tool` / `mapping` builders.
 *
 * These assertions lock in the output-type inference rules so downstream
 * `.then` / `.map` see the right previous-step schema.
 */
const agent = new Agent({
  id: 'typed-agent',
  name: 'typed-agent',
  instructions: 'noop',
  model: {} as any,
});

const numberTool = createTool({
  id: 'number-tool',
  description: 'tool',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ doubled: z.number() }),
  execute: async ({ value }) => ({ doubled: value * 2 }),
});

describe('declarative builder output inference', () => {
  it('.agent() (no structuredOutput) advances prev schema to { text: string }', () => {
    createWorkflow({ id: 'wf', inputSchema: z.object({ prompt: z.string() }), outputSchema: z.any() })
      .agent(agent)
      .map(async ({ inputData }) => {
        expectTypeOf(inputData).toEqualTypeOf<{ text: string }>();
        return inputData;
      });
  });

  it('.agent() with structuredOutput advances prev schema to the structured type', () => {
    createWorkflow({ id: 'wf', inputSchema: z.object({ prompt: z.string() }), outputSchema: z.any() })
      .agent(agent, { structuredOutput: { schema: z.object({ score: z.number() }) } })
      .map(async ({ inputData }) => {
        expectTypeOf(inputData).toEqualTypeOf<{ score: number }>();
        return inputData;
      });
  });

  it('.tool() advances prev schema to the tool output type', () => {
    createWorkflow({ id: 'wf', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .tool(numberTool)
      .map(async ({ inputData }) => {
        expectTypeOf(inputData.doubled).toBeNumber();
        return inputData;
      });
  });

  it('.then(createStep(agent)) infers { text: string } (option B)', () => {
    createWorkflow({ id: 'wf', inputSchema: z.object({ prompt: z.string() }), outputSchema: z.any() })
      .then(createStep(agent))
      .map(async ({ inputData }) => {
        expectTypeOf(inputData).toEqualTypeOf<{ text: string }>();
        return inputData;
      });
  });

  it('.then(createStep(tool)) infers the tool output type (option B)', () => {
    createWorkflow({ id: 'wf', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .then(createStep(numberTool))
      .map(async ({ inputData }) => {
        expectTypeOf(inputData.doubled).toBeNumber();
        return inputData;
      });
  });

  it('string-id .agent() falls back to { text: string }', () => {
    createWorkflow({ id: 'wf', inputSchema: z.object({ prompt: z.string() }), outputSchema: z.any() })
      .agent('some-registered-agent')
      .map(async ({ inputData }) => {
        expectTypeOf(inputData).toEqualTypeOf<{ text: string }>();
        return inputData;
      });
  });

  it('string-id .tool() falls back to unknown', () => {
    createWorkflow({ id: 'wf', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .tool('some-registered-tool')
      .map(async ({ inputData }) => {
        expectTypeOf(inputData).toBeUnknown();
        return inputData;
      });
  });
});

/**
 * Input-chaining constraints for the declarative builders: the previous step's
 * output must be assignable to the next step's input. These lock in that
 * `.tool()` / `.agent()` (and the `.then(createStep(...))` paths) reject
 * mismatched chains, not just infer the output direction.
 */
describe('declarative builder input chaining', () => {
  // tool consuming `{ doubled: number }` (the output of `numberTool`)
  const halveTool = createTool({
    id: 'halve-tool',
    description: 'tool',
    inputSchema: z.object({ doubled: z.number() }),
    outputSchema: z.object({ halved: z.number() }),
    execute: async ({ doubled }) => ({ halved: doubled / 2 }),
  });

  // step that produces a concrete `{ prompt: string }` output (so a downstream
  // agent receives a real type rather than `any`)
  const toPrompt = createStep({
    id: 'to-prompt',
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ prompt: z.string() }),
    execute: async () => ({ prompt: 'x' }),
  });

  // step whose output is intentionally incompatible with `numberTool`'s input
  const wrongShape = createStep({
    id: 'wrong-shape',
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ nope: z.boolean() }),
    execute: async () => ({ nope: true }),
  });

  it('.tool() accepts a chain whose prev output matches the tool input', () => {
    const wf = createWorkflow({ id: 'wf', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .tool(numberTool) // -> { doubled: number }
      .tool(halveTool); // input { doubled: number } -> OK
    expectTypeOf(wf).not.toBeNever();
  });

  it('.tool() rejects chaining a tool whose input does not match the prev output', () => {
    createWorkflow({ id: 'wf', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .tool(numberTool) // -> { doubled: number }
      // @ts-expect-error - { doubled: number } is not assignable to tool input { value: number }
      .tool(numberTool);
  });

  it('.tool() rejects a tool after a step producing the wrong shape', () => {
    createWorkflow({ id: 'wf', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .then(wrongShape) // -> { nope: boolean }
      // @ts-expect-error - { nope: boolean } is not assignable to tool input { value: number }
      .tool(numberTool);
  });

  it('.tool() keeps the `.map()` (any output) escape hatch', () => {
    const wf = createWorkflow({ id: 'wf', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .map(async () => ({ anything: 'goes' })) // map output is `any`
      .tool(numberTool); // compiles via the `any` escape hatch
    expectTypeOf(wf).not.toBeNever();
  });

  it('.agent() accepts a chain whose prev output is { prompt: string }', () => {
    const wf = createWorkflow({ id: 'wf', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .then(toPrompt) // -> { prompt: string }
      .agent(agent); // input { prompt: string } -> OK
    expectTypeOf(wf).not.toBeNever();
  });

  it('.agent() rejects a chain whose prev output is not { prompt: string }', () => {
    createWorkflow({ id: 'wf', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      // @ts-expect-error - { value: number } is not assignable to agent input { prompt: string }
      .agent(agent);
  });

  it('.then(createStep(tool)) rejects a mismatched prev output', () => {
    createWorkflow({ id: 'wf', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      .tool(numberTool) // -> { doubled: number }
      // @ts-expect-error - { doubled: number } is not assignable to tool input { value: number }
      .then(createStep(numberTool));
  });

  it('.then(createStep(agent)) requires { prompt: string } (locks in createStepFromAgent input type)', () => {
    createWorkflow({ id: 'wf', inputSchema: z.object({ value: z.number() }), outputSchema: z.any() })
      // @ts-expect-error - { value: number } is not assignable to agent input { prompt: string }
      .then(createStep(agent));
  });
});
