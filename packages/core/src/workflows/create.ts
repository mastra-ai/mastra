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
import { createWorkflow as createEventedWorkflowImpl } from './evented/workflow';
import type { Step } from './step';
import type { DefaultEngineType, WorkflowConfig } from './types';
import { Workflow } from './workflow';

/**
 * Create a workflow, auto-promoting to the evented engine when a `schedule`
 * is declared.
 */
export function createWorkflow<
  TWorkflowId extends string = string,
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TSteps extends Step<string, any, any, any, any, any, DefaultEngineType>[] = Step[],
  TRequestContext extends Record<string, any> | unknown = unknown,
>(params: WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps, TRequestContext>) {
  if (params.schedule) {
    return createEventedWorkflowImpl(
      params as WorkflowConfig<TWorkflowId, TState, TInput, TOutput, Step[]>,
    ) as unknown as Workflow<DefaultEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TInput, TRequestContext>;
  }
  return new Workflow<DefaultEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TInput, TRequestContext>(params);
}

/**
 * @internal Build a workflow on the evented execution engine.
 *
 * Used by internal code (agentic loop, prepare-stream) that always needs the
 * evented engine regardless of whether a schedule is declared.
 */
export function createEventedWorkflow<
  TWorkflowId extends string = string,
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TSteps extends Step<string, any, any, any, any, any, DefaultEngineType>[] = Step[],
  TRequestContext extends Record<string, any> | unknown = unknown,
>(params: WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps, TRequestContext>) {
  return createEventedWorkflowImpl(
    params as WorkflowConfig<TWorkflowId, TState, TInput, TOutput, Step[]>,
  ) as unknown as Workflow<DefaultEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TInput, TRequestContext>;
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
