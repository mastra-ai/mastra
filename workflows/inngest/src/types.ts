import type { Step, WorkflowConfig } from '@mastra/core/workflows';
import type { GetStepTools, Inngest } from 'inngest';

// Extract Inngest's native flow control configuration types from createFunction first argument
export type InngestCreateFunctionConfig = Parameters<Inngest['createFunction']>[0];

// Extract specific flow control properties (excluding batching)
export type InngestFlowControlConfig = Pick<
  InngestCreateFunctionConfig,
  'concurrency' | 'rateLimit' | 'throttle' | 'debounce' | 'priority'
>;

// Cron config for scheduled workflows
export type InngestFlowCronConfig<TInputData, TInitialState> = {
  cron?: string;
  inputData?: TInputData;
  initialState?: TInitialState;
};

// Union type for Inngest workflows with flow control
export type InngestWorkflowConfig<
  TWorkflowId extends string,
  TState,
  TInput,
  TOutput,
  TSteps extends Step<string, any, any, any, any, any, InngestEngineType, any>[],
  TRequestContext extends Record<string, any> | unknown = unknown,
> = WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps, TRequestContext> &
  InngestFlowControlConfig &
  InngestFlowCronConfig<TInput, TState>;

// Compile-time compatibility assertion
export type _AssertInngestCompatibility =
  InngestFlowControlConfig extends Pick<Parameters<Inngest['createFunction']>[0], keyof InngestFlowControlConfig>
    ? true
    : never;
export const _compatibilityCheck: _AssertInngestCompatibility = true;

/**
 * Engine context handed to `execute({ engine })` for steps running on the
 * Inngest engine. `step` is Inngest's own step tooling, so `step.run`,
 * `step.sendEvent`, `step.waitForEvent` and `step.sleep` are checked at
 * compile time rather than duck-typed at runtime.
 */
export type InngestEngineType = {
  step: GetStepTools<Inngest.Any>;
};
