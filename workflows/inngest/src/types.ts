import type { Step, WorkflowConfig } from '@mastra/core/workflows';
import type { Inngest, InngestFunction } from 'inngest';

// Extract Inngest's native flow control configuration types
export type InngestCreateFunctionConfig = Parameters<Inngest['createFunction']>[0];
export type InngestCreateFunctionEventConfig = InngestFunction.Trigger<string>;

// Extract specific flow control properties (excluding batching)
export type InngestFlowControlConfig = Pick<
  InngestCreateFunctionConfig,
  'concurrency' | 'rateLimit' | 'throttle' | 'debounce' | 'priority'
>;

export type InngestFlowCronConfig<TInputData, TInitialState> = Pick<InngestCreateFunctionEventConfig, 'cron'> & {
  inputData?: TInputData;
  initialState?: TInitialState;
};

// Union type for Inngest workflows with flow control
export type InngestWorkflowConfig<
  TWorkflowId extends string,
  TState,
  TInput,
  TOutput,
  TSteps extends Step<string, any, any, any, any, any, any, any>[],
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
