import { createStep as coreCreateStep } from '@mastra/core/workflows';
import type { CreateWorkflowParams, InferSchemaOutput, Step, StepParams, WorkflowConfig } from '@mastra/core/workflows';
import type { PublicSchema, InferPublicSchema } from '@mastra/core/schema';
import { RenderProvider, type RenderOptions } from './provider.js';
import { RenderWorkflow } from './workflow.js';
import { stepPolicies } from './manifest.js';
import { taskPolicySchema, type TaskPolicy } from './policy.js';

type SupportedContextKeys =
  | 'runId'
  | 'workflowId'
  | 'resourceId'
  | 'mastra'
  | 'requestContext'
  | 'inputData'
  | 'state'
  | 'setState'
  | 'getInitData'
  | 'getStepResult';
type RenderStepParams<
  Id extends string,
  S extends PublicSchema | undefined,
  I extends PublicSchema,
  O extends PublicSchema,
  C extends PublicSchema | undefined,
> = Omit<
  StepParams<Id, S, I, O, undefined, undefined, C>,
  'execute' | 'retries' | 'scorers' | 'resumeSchema' | 'suspendSchema'
> & {
  render?: TaskPolicy;
  execute: (
    context: Pick<Parameters<StepParams<Id, S, I, O, undefined, undefined, C>['execute']>[0], SupportedContextKeys>,
  ) => Promise<InferPublicSchema<O>>;
};

export function init(options: RenderOptions) {
  const provider = new RenderProvider(options);
  function createStep<
    Id extends string,
    S extends PublicSchema | undefined,
    I extends PublicSchema,
    O extends PublicSchema,
    C extends PublicSchema | undefined = undefined,
  >(params: RenderStepParams<Id, S, I, O, C>) {
    const { render, execute, ...rest } = params;
    const step = coreCreateStep({ ...rest, retries: 0, execute: context => execute(context) });
    stepPolicies.set(step, taskPolicySchema.parse(render ?? {}));
    return step;
  }
  function createWorkflow<
    Id extends string,
    S extends PublicSchema | undefined,
    I extends PublicSchema,
    O extends PublicSchema,
    Steps extends Step[] = Step[],
    C extends PublicSchema | undefined = undefined,
  >(
    config: Omit<CreateWorkflowParams<Id, S, I, O, Steps, C>, 'executionEngine' | 'retryConfig' | 'schedule'> & {
      render?: Omit<TaskPolicy, 'retry'>;
    },
  ) {
    const { render, ...rest } = config;
    // Like Mastra's schema-first factory, bridge schema identity inference to the class's value-type parameters.
    // The same schemas are passed unchanged; the core constructor normalizes and validates them.
    return new RenderWorkflow<
      Id,
      InferSchemaOutput<S>,
      InferSchemaOutput<I>,
      InferSchemaOutput<O>,
      Steps,
      InferSchemaOutput<C>
    >(
      rest as unknown as WorkflowConfig<
        Id,
        InferSchemaOutput<S>,
        InferSchemaOutput<I>,
        InferSchemaOutput<O>,
        Steps,
        InferSchemaOutput<C>
      >,
      provider,
      render,
    );
  }
  return { createStep, createWorkflow, provider };
}

export { createMemoryPersistence } from './persistence/memory.js';
export { createPostgresPersistence } from './persistence/postgres.js';
export type { RenderPersistence, RunRecord, RunStatus } from './persistence/types.js';
export type { RenderOptions } from './provider.js';
export type { TaskPolicy } from './policy.js';
export type { RenderTransport, ProviderRun } from './transport.js';
export {
  RenderCapabilityError,
  RenderProtocolError,
  RenderSubmissionUnknownError,
  RenderRunConflictError,
} from './errors.js';
