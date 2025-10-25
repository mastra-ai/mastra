import { createStep } from '@mastra/core/workflows';
import type { Step } from '@mastra/core/workflows';
import { z } from 'zod';

/**
 * Options for wrapping a Workflow step function as a Mastra step
 */
export interface WrapWorkflowStepOptions<
  TInput extends z.ZodType<any>,
  TOutput extends z.ZodType<any>
> {
  /**
   * Unique identifier for the step
   */
  id: string;

  /**
   * The compiled Workflow step function (from step-mode output)
   * This should be a plain async function with business logic
   */
  workflowStepFn: (...args: any[]) => Promise<any>;

  /**
   * Zod schema defining the input structure
   */
  inputSchema: TInput;

  /**
   * Zod schema defining the output structure
   */
  outputSchema: TOutput;

  /**
   * Optional description of what the step does
   */
  description?: string;

  /**
   * Optional number of retry attempts for this step
   */
  retries?: number;

  /**
   * Optional function to map Mastra step context to Workflow function arguments
   * By default, assumes single-argument function with inputData
   */
  argsMapper?: (inputData: z.infer<TInput>) => any[];
}

/**
 * Wraps a compiled Workflow step function as a Mastra step
 * 
 * This allows you to:
 * 1. Write step logic using Workflow's "use step" directive
 * 2. Compile with SWC in step mode to get plain async functions
 * 3. Wrap as Mastra steps for orchestration
 * 
 * @example
 * ```typescript
 * // Original Workflow code (workflows/math.ts):
 * export async function add(a: number, b: number) {
 *   'use step';
 *   return a + b;
 * }
 * 
 * // After compilation in step mode (.compiled/math.ts):
 * export async function add(a: number, b: number) {
 *   return a + b;
 * }
 * registerStepFunction("step//math.ts//add", add);
 * 
 * // Use in Mastra workflow:
 * import { add } from './.compiled/math';
 * 
 * const addStep = wrapWorkflowStep({
 *   id: 'add',
 *   workflowStepFn: add,
 *   inputSchema: z.object({ a: z.number(), b: z.number() }),
 *   outputSchema: z.number(),
 *   argsMapper: (input) => [input.a, input.b],
 * });
 * 
 * const workflow = createWorkflow({ ... })
 *   .then(addStep)
 *   .commit();
 * ```
 */
export function wrapWorkflowStep<
  TInput extends z.ZodType<any>,
  TOutput extends z.ZodType<any>
>(options: WrapWorkflowStepOptions<TInput, TOutput>): Step<
  string,
  any,
  TInput,
  TOutput,
  any,
  any
> {
  const {
    id,
    workflowStepFn,
    inputSchema,
    outputSchema,
    description,
    retries,
    argsMapper = (inputData) => [inputData],
  } = options;

  return createStep({
    id,
    description: description || `Workflow step: ${id}`,
    inputSchema,
    outputSchema,
    retries,
    execute: async ({ inputData, mastra, runtimeContext, tracingContext }) => {
      try {
        // Map the Mastra input data to Workflow function arguments
        const args = argsMapper(inputData);
        
        // Call the compiled Workflow step function
        // At this point, it's just a plain async function
        const result = await workflowStepFn(...args);
        
        return result;
      } catch (error) {
        // Preserve error context
        if (error instanceof Error) {
          error.message = `Workflow step '${id}' failed: ${error.message}`;
        }
        throw error;
      }
    },
  });
}

/**
 * Batch wrap multiple Workflow step functions
 * 
 * @example
 * ```typescript
 * import * as mathSteps from './.compiled/math';
 * 
 * const { add, multiply, divide } = wrapWorkflowSteps({
 *   add: {
 *     workflowStepFn: mathSteps.add,
 *     inputSchema: z.object({ a: z.number(), b: z.number() }),
 *     outputSchema: z.number(),
 *     argsMapper: (input) => [input.a, input.b],
 *   },
 *   multiply: {
 *     workflowStepFn: mathSteps.multiply,
 *     inputSchema: z.object({ a: z.number(), b: z.number() }),
 *     outputSchema: z.number(),
 *     argsMapper: (input) => [input.a, input.b],
 *   },
 * });
 * ```
 */
export function wrapWorkflowSteps<
  T extends Record<string, Omit<WrapWorkflowStepOptions<any, any>, 'id'>>
>(
  steps: T
): {
  [K in keyof T]: Step<
    string,
    any,
    T[K] extends WrapWorkflowStepOptions<infer TInput, any> ? TInput : never,
    T[K] extends WrapWorkflowStepOptions<any, infer TOutput> ? TOutput : never,
    any,
    any
  >;
} {
  return Object.fromEntries(
    Object.entries(steps).map(([id, options]) => [
      id,
      wrapWorkflowStep({ ...options, id }),
    ])
  ) as any;
}

/**
 * Helper type to infer Workflow step function signature
 */
export type InferWorkflowStepFn<T> = T extends (...args: infer Args) => Promise<infer Return>
  ? { args: Args; return: Return }
  : never;

/**
 * Type-safe wrapper builder that infers types from the Workflow step function
 * This is experimental and may not work perfectly with all function signatures
 */
export function wrapWorkflowStepAuto<
  TFn extends (...args: any[]) => Promise<any>
>(options: {
  id: string;
  workflowStepFn: TFn;
  description?: string;
  retries?: number;
}): Step<string, any, any, any, any, any> {
  // Note: This creates steps with `z.any()` schemas
  // Users should prefer explicit schemas for type safety
  return createStep({
    id: options.id,
    description: options.description,
    inputSchema: z.any(),
    outputSchema: z.any(),
    retries: options.retries,
    execute: async ({ inputData }) => {
      const args = Array.isArray(inputData) ? inputData : [inputData];
      return await options.workflowStepFn(...args);
    },
  });
}

export { createStep };
