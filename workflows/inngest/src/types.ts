import type { Step, WorkflowConfig } from '@mastra/core/workflows';
import type { Inngest } from 'inngest';

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
  TSteps extends Step<string, any, any, any, any, any, InngestEngineType>[],
> = WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps> &
  InngestFlowControlConfig &
  InngestFlowCronConfig<TInput, TState>;

// Compile-time compatibility assertion
export type _AssertInngestCompatibility =
  InngestFlowControlConfig extends Pick<Parameters<Inngest['createFunction']>[0], keyof InngestFlowControlConfig>
    ? true
    : never;
export const _compatibilityCheck: _AssertInngestCompatibility = true;

export type InngestEngineType = {
  step: any;
};
