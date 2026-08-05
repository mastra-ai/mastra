import type { Agent } from '@mastra/core/agent';
import type { MastraScorers } from '@mastra/core/evals';
import type { InferPublicSchema, PublicSchema, StandardSchemaWithJSON } from '@mastra/core/schema';
import { createTool, type Tool, type ToolExecutionContext } from '@mastra/core/tools';
import type { DynamicArgument } from '@mastra/core/types';
import { createStep as createCoreStep, Workflow } from '@mastra/core/workflows';
import type { AgentStepOptions, Step, StepMetadata, StepParams } from '@mastra/core/workflows';
import type { WorkflowSdkEngineType, WorkflowSdkWorkflowConfig } from './types';
import { WorkflowSdkWorkflow, type WorkflowSdkRunnerRef } from './workflow';

export { WORKFLOW_SDK_ENGINE_TYPE, MASTRA_EVENT_NAMESPACE } from './constants';
export { WorkflowSdkExecutionEngine } from './execution-engine';
export {
  clearWorkflowRegistry,
  getRegisteredWorkflow,
  listRegisteredWorkflowIds,
  registerWorkflow,
  requireRegisteredWorkflow,
} from './registry';
export { WorkflowSdkRun, type WorkflowSdkRunOptions } from './run';
export { WorkflowSdkWorkflow, type WorkflowSdkRunnerRef, type WorkflowSdkWorkflowParams } from './workflow';
export type {
  WorkflowSdkEngineType,
  WorkflowSdkWorkflowConfig,
  MastraOp,
  MastraOpPath,
  MastraOpRequest,
  MastraOpResponse,
  MastraRunnerParams,
  MastraRunnerResult,
  SerializedOpError,
} from './types';

// ============================================
// createStep — Workflow SDK-typed wrappers over the core builders
// ============================================

/** Creates a step from explicit params. */
export function createStep<
  TStepId extends string,
  TStateSchema extends PublicSchema | undefined,
  TInputSchema extends PublicSchema,
  TOutputSchema extends PublicSchema,
  TResumeSchema extends PublicSchema | undefined = undefined,
  TSuspendSchema extends PublicSchema | undefined = undefined,
>(
  params: StepParams<TStepId, TStateSchema, TInputSchema, TOutputSchema, TResumeSchema, TSuspendSchema>,
): Step<
  TStepId,
  TStateSchema extends PublicSchema ? InferPublicSchema<TStateSchema> : unknown,
  InferPublicSchema<TInputSchema>,
  InferPublicSchema<TOutputSchema>,
  TResumeSchema extends PublicSchema ? InferPublicSchema<TResumeSchema> : unknown,
  TSuspendSchema extends PublicSchema ? InferPublicSchema<TSuspendSchema> : unknown,
  WorkflowSdkEngineType
>;

/** Creates a step from an agent with structured output. */
export function createStep<TStepId extends string, TStepOutput>(
  agent: Agent<TStepId, any>,
  agentOptions: AgentStepOptions<TStepOutput> & {
    structuredOutput: { schema: StandardSchemaWithJSON<TStepOutput> };
    retries?: number;
    scorers?: DynamicArgument<MastraScorers>;
    metadata?: StepMetadata;
  },
): Step<TStepId, unknown, { prompt: string }, TStepOutput, unknown, unknown, WorkflowSdkEngineType>;

/** Creates a step from an agent, defaulting to a `{ text: string }` output. */
export function createStep<
  TStepId extends string,
  TStepInput extends { prompt: string },
  TStepOutput extends { text: string },
  TResume,
  TSuspend,
>(
  agent: Agent<TStepId, any>,
  agentOptions?: AgentStepOptions<TStepOutput> & {
    retries?: number;
    scorers?: DynamicArgument<MastraScorers>;
  },
): Step<TStepId, unknown, TStepInput, TStepOutput, TResume, TSuspend, WorkflowSdkEngineType>;

/** Creates a step from a tool. */
export function createStep<
  TSchemaIn,
  TSchemaOut,
  TSuspend,
  TResume,
  TContext extends ToolExecutionContext<TSuspend, TResume, any> = ToolExecutionContext<TSuspend, TResume>,
  TId extends string = string,
  TRequestContext extends Record<string, any> | unknown = unknown,
>(
  tool: Tool<TSchemaIn, TSchemaOut, TSuspend, TResume, TContext, TId, TRequestContext>,
  toolOptions?: { retries?: number; scorers?: DynamicArgument<MastraScorers>; metadata?: StepMetadata },
): Step<TId, unknown, TSchemaIn, TSchemaOut, TSuspend, TResume, WorkflowSdkEngineType>;

/**
 * Delegates to `@mastra/core`'s builder and re-types the result for the Workflow SDK
 * engine.
 *
 * Step construction is engine-agnostic — the engine only shows up in the type
 * parameter, which is what stops a step authored for one engine being dropped
 * into a workflow running on another. Reimplementing the agent, tool and
 * processor adaptation here would be a copy that silently drifts from core.
 */
export function createStep(params: any, agentOrToolOptions?: any): Step<any, any, any, any, any, any, any> {
  // A nested workflow used as a step keeps its identity so the graph can
  // recognise it later.
  if (params instanceof Workflow) {
    return params as unknown as Step<any, any, any, any, any, any, any>;
  }
  return createCoreStep(params, agentOrToolOptions) as Step<any, any, any, any, any, any, any>;
}

// ============================================
// init
// ============================================

export interface WorkflowSdkInitConfig {
  /**
   * The `mastraRunner` workflow function.
   *
   * Import it from your own `workflows/` re-export rather than from
   * `@mastra/workflow-sdk/workflows` directly, so it carries the workflow id your
   * build assigned:
   *
   * ```ts
   * import { mastraRunner } from '../../workflows/mastra';
   * ```
   */
  runner: WorkflowSdkRunnerRef;
}

/**
 * Builds the Mastra authoring API bound to a Workflow SDK runner.
 *
 * ```ts
 * import { init } from '@mastra/workflow-sdk';
 * import { mastraRunner } from '@mastra/workflow-sdk/workflows';
 *
 * const { createWorkflow, createStep } = init({ runner: mastraRunner });
 * ```
 */
export function init<TRequestContext = unknown>(config: WorkflowSdkInitConfig) {
  if (!config?.runner) {
    throw new Error(
      'init() requires a `runner`. Pass the `mastraRunner` function exported from ' +
        '"@mastra/workflow-sdk/workflows" (re-exported through your own workflows/ directory).',
    );
  }

  function cloneWorkflow<
    TWorkflowId extends string = string,
    TState = unknown,
    TInput = unknown,
    TOutput = unknown,
    TSteps extends Step<string, any, any, any, any, any, WorkflowSdkEngineType>[] = Step<
      string,
      any,
      any,
      any,
      any,
      any,
      WorkflowSdkEngineType
    >[],
    TPrev = TInput,
  >(
    workflow: WorkflowSdkWorkflow<TSteps, string, TState, TInput, TOutput, TPrev, TRequestContext>,
    opts: { id: TWorkflowId },
  ): WorkflowSdkWorkflow<TSteps, TWorkflowId, TState, TInput, TOutput, TPrev, TRequestContext> {
    const cloned = new WorkflowSdkWorkflow<TSteps, TWorkflowId, TState, TInput, TOutput, TPrev, TRequestContext>(
      {
        id: opts.id,
        description: workflow.description,
        inputSchema: workflow.inputSchema as PublicSchema<TInput>,
        outputSchema: workflow.outputSchema as PublicSchema<TOutput>,
        stateSchema: workflow.stateSchema,
        requestContextSchema: workflow.requestContextSchema,
        retryConfig: workflow.retryConfig,
        steps: workflow.stepDefs,
        mastra: workflow.mastra,
        options: workflow.options,
      },
      { runner: config.runner },
    );
    cloned.setStepFlow(workflow.stepGraph);
    cloned.commit();
    return cloned;
  }

  return {
    createTool,
    createStep,
    createWorkflow<
      TWorkflowId extends string = string,
      TState = any,
      TInput = any,
      TOutput = any,
      TSteps extends Step<string, any, any, any, any, any, WorkflowSdkEngineType>[] = Step<
        string,
        any,
        any,
        any,
        any,
        any,
        WorkflowSdkEngineType
      >[],
    >(params: WorkflowSdkWorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps, TRequestContext>) {
      return new WorkflowSdkWorkflow<TSteps, TWorkflowId, TState, TInput, TOutput, TInput, TRequestContext>(params, {
        runner: config.runner,
      });
    },
    cloneStep<TStepId extends string>(
      step: Step<TStepId, any, any, any, any, any, WorkflowSdkEngineType>,
      opts: { id: TStepId },
    ): Step<TStepId, any, any, any, any, any, WorkflowSdkEngineType> {
      // A nested workflow used as a step must stay a real workflow instance:
      // `#collectStepRetries` and `registerNested` check `instanceof`, which a
      // spread copy would fail.
      if (step instanceof WorkflowSdkWorkflow) {
        return cloneWorkflow(step, { id: opts.id }) as unknown as Step<
          TStepId,
          any,
          any,
          any,
          any,
          any,
          WorkflowSdkEngineType
        >;
      }
      return { ...step, id: opts.id };
    },
    cloneWorkflow,
  };
}
