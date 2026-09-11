/**
 * Workflow factory functions.
 *
 * These live in their own module so they can statically import both the base
 * `Workflow` class and the evented `createWorkflow` factory without creating
 * an ESM init-time cycle.  The cycle used to be:
 *
 *   workflow.ts  →  agent/agent.ts  →  workflow.ts
 *
 * (workflow.ts needed the Agent class for instanceof checks, and agent.ts
 * needed createWorkflow from workflow.ts.)
 *
 * By keeping the Workflow class in `workflow.ts` and the factories here,
 * neither module needs to import the other's runtime dependencies.
 */
import type { InferPublicSchema, PublicSchema } from '../schema';
import { createWorkflow as createEventedWorkflowImpl } from './evented/workflow';
import type { Step } from './step';
import type { CreateWorkflowParams, DefaultEngineType, InferSchemaOutput } from './types';
import { Workflow } from './workflow';

/**
 * Creates a workflow for composing typed steps. Declaring a `schedule`
 * automatically selects the evented engine.
 *
 * @example
 * `yourStep` is a configured step with string input and output.
 * ```typescript
 * import { createWorkflow } from '@mastra/core/workflows';
 * import { z } from 'zod';
 *
 * const workflow = createWorkflow({
 *   id: 'greeting',
 *   inputSchema: z.string(),
 *   outputSchema: z.string(),
 * }).then(yourStep).commit();
 * ```
 *
 * @see For documentation bundled with your installed package, locate
 * `@mastra/core/package.json` with your project's resolver or package-manager
 * tooling, then read `dist/docs/SKILL.md` from that package root and follow its
 * reference links. Use package-manager tools for virtual or archived packages.
 *
 * @see [Workflow documentation](https://mastra.ai/docs/workflows/overview)
 * if packaged docs are unavailable.
 */
export function createWorkflow<
  TWorkflowId extends string = string,
  TInputSchema extends PublicSchema<any> = PublicSchema<any>,
  TOutputSchema extends PublicSchema<any> = PublicSchema<any>,
  TStateSchema extends PublicSchema<any> | undefined = undefined,
  TSteps extends Step<string, any, any, any, any, any, DefaultEngineType>[] = Step[],
  TRequestContextSchema extends PublicSchema<any> | undefined = undefined,
>(params: CreateWorkflowParams<TWorkflowId, TStateSchema, TInputSchema, TOutputSchema, TSteps, TRequestContextSchema>) {
  if (params.schedule) {
    return createEventedWorkflowImpl(params as any) as unknown as Workflow<
      DefaultEngineType,
      TSteps,
      TWorkflowId,
      InferSchemaOutput<TStateSchema>,
      InferPublicSchema<TInputSchema>,
      InferPublicSchema<TOutputSchema>,
      InferPublicSchema<TInputSchema>,
      InferSchemaOutput<TRequestContextSchema>
    >;
  }
  return new Workflow<
    DefaultEngineType,
    TSteps,
    TWorkflowId,
    InferSchemaOutput<TStateSchema>,
    InferPublicSchema<TInputSchema>,
    InferPublicSchema<TOutputSchema>,
    InferPublicSchema<TInputSchema>,
    InferSchemaOutput<TRequestContextSchema>
  >(params as any);
}

/**
 * @internal Build a workflow on the evented execution engine.
 *
 * Used by internal code (agentic loop, prepare-stream) that always needs the
 * evented engine regardless of whether a schedule is declared.
 */
export function createEventedWorkflow<
  TWorkflowId extends string = string,
  TInputSchema extends PublicSchema<any> = PublicSchema<any>,
  TOutputSchema extends PublicSchema<any> = PublicSchema<any>,
  TStateSchema extends PublicSchema<any> | undefined = undefined,
  TSteps extends Step<string, any, any, any, any, any, DefaultEngineType>[] = Step[],
  TRequestContextSchema extends PublicSchema<any> | undefined = undefined,
>(params: CreateWorkflowParams<TWorkflowId, TStateSchema, TInputSchema, TOutputSchema, TSteps, TRequestContextSchema>) {
  return createEventedWorkflowImpl(params as any) as unknown as Workflow<
    DefaultEngineType,
    TSteps,
    TWorkflowId,
    InferSchemaOutput<TStateSchema>,
    InferPublicSchema<TInputSchema>,
    InferPublicSchema<TOutputSchema>,
    InferPublicSchema<TInputSchema>,
    InferSchemaOutput<TRequestContextSchema>
  >;
}

export function cloneWorkflow<
  TWorkflowId extends string = string,
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TSteps extends Step<string, any, any, any, any, any, DefaultEngineType>[] = Step<
    string,
    any,
    any,
    any,
    any,
    any,
    DefaultEngineType
  >[],
  TPrevSchema = TInput,
>(
  workflow: Workflow<DefaultEngineType, TSteps, string, TState, TInput, TOutput, TPrevSchema>,
  opts: { id: TWorkflowId },
): Workflow<DefaultEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> {
  const wf: Workflow<DefaultEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> = new Workflow({
    id: opts.id,
    inputSchema: workflow.inputSchema,
    outputSchema: workflow.outputSchema,
    steps: workflow.stepDefs,
    mastra: workflow.mastra,
    options: workflow.options,
  });

  wf.setStepFlow(workflow.stepGraph);
  wf.commit();
  return wf;
}
