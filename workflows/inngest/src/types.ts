import type { Step, WorkflowConfig } from '@mastra/core/workflows';
import type { Inngest, InngestFunction } from 'inngest';
import type z from 'zod';

// Extract Inngest's native flow control configuration types
export type InngestCreateFunctionConfig = Parameters<Inngest['createFunction']>[0];
export type InngestCreateFunctionEventConfig = InngestFunction.Trigger<string>;

// Extract specific flow control properties (excluding batching)
export type InngestFlowControlConfig = Pick<
  InngestCreateFunctionConfig,
  'concurrency' | 'rateLimit' | 'throttle' | 'debounce' | 'priority'
>;

export type InngestFlowCronConfig<
  TInputData extends z.ZodType<any> = z.ZodType<any>,
  TInitialState extends z.ZodObject<any> = z.ZodObject<any>,
> = Pick<InngestCreateFunctionEventConfig, 'cron'> & {
  inputData?: z.infer<TInputData>;
  initialState?: z.infer<TInitialState>;
};

// Union type for Inngest workflows with flow control
export type InngestWorkflowConfig<
  TWorkflowId extends string = string,
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[] = Step<string, any, any, any, any, any>[],
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
