import type { MastraScorers } from '../evals';
import type { PubSub } from '../events';
import type { Mastra } from '../mastra';
import type { ObservabilityContext } from '../observability';
import type { RequestContext } from '../request-context';
import type { InferZodLikeSchema, SchemaWithValidation } from '../stream/base/schema';
import type { ToolStream } from '../tools/stream';
import type { DynamicArgument } from '../types';
import type { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from './constants';
import type { OutputWriter, StepResult, StepMetadata } from './types';
import type { AnyWorkflow } from './workflow';

export type SuspendOptions = {
  resumeLabel?: string | string[];
} & Record<string, any>;

// Create a unique symbol that only exists at the type level
declare const SuspendBrand: unique symbol;

// Create a branded type that can ONLY be produced by suspend()
export type InnerOutput = void & { readonly [SuspendBrand]: never };

export type ExecuteFunctionParams<
  TState,
  TStepInput,
  TStepOutput,
  TResume,
  TSuspend,
  EngineType,
  TRequestContext extends Record<string, any> | unknown = unknown,
> = Partial<ObservabilityContext> & {
  runId: string;
  resourceId?: string;
  workflowId: string;
  mastra: Mastra;
  requestContext: RequestContext<TRequestContext>;
  inputData: TStepInput;
  state: TState;
  setState(state: TState): Promise<void>;
  resumeData?: TResume;
  suspendData?: TSuspend;
  retryCount: number;
  getInitData<T>(): T extends AnyWorkflow ? InferZodLikeSchema<T['inputSchema']> : T;
  getStepResult<TOutput>(step: string): TOutput;
  getStepResult<TStep extends Step<string, any, any, any, any, any, EngineType>>(
    step: TStep,
  ): InferZodLikeSchema<TStep['outputSchema']>;
  suspend: unknown extends TSuspend
    ? (suspendPayload?: TSuspend, suspendOptions?: SuspendOptions) => InnerOutput | Promise<InnerOutput>
    : (suspendPayload: TSuspend, suspendOptions?: SuspendOptions) => InnerOutput | Promise<InnerOutput>;
  bail(result: TStepOutput): InnerOutput;
  bail(result?: unknown): InnerOutput;
  abort(): void;
  resume?: {
    steps: string[];
    resumePayload: TResume;
  };
  restart?: boolean;
  [PUBSUB_SYMBOL]: PubSub;
  [STREAM_FORMAT_SYMBOL]: 'legacy' | 'vnext' | undefined;
  engine: EngineType;
  abortSignal: AbortSignal;
  writer: ToolStream;
  outputWriter?: OutputWriter;
  validateSchemas?: boolean;
};

export type ConditionFunctionParams<
  TState,
  TStepInput,
  TStepOutput,
  TResumeSchema,
  TSuspendSchema,
  EngineType,
  TRequestContext extends Record<string, any> | unknown = unknown,
> = Omit<
  ExecuteFunctionParams<TState, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, EngineType, TRequestContext>,
  'setState' | 'suspend'
>;

export type ExecuteFunction<
  TState,
  TStepInput,
  TStepOutput,
  TResumeSchema,
  TSuspendSchema,
  EngineType,
  TRequestContext extends Record<string, any> | unknown = unknown,
> = (
  params: ExecuteFunctionParams<
    TState,
    TStepInput,
    TStepOutput,
    TResumeSchema,
    TSuspendSchema,
    EngineType,
    TRequestContext
  >,
) => Promise<TStepOutput | InnerOutput>;

export type ConditionFunction<
  TState,
  TStepInput,
  TStepOutput,
  TResumeSchema,
  TSuspendSchema,
  EngineType,
  TRequestContext extends Record<string, any> | unknown = unknown,
> = (
  params: ConditionFunctionParams<
    TState,
    TStepInput,
    TStepOutput,
    TResumeSchema,
    TSuspendSchema,
    EngineType,
    TRequestContext
  >,
) => Promise<boolean>;

export type LoopConditionFunction<
  TState,
  TStepInput,
  TStepOutput,
  TResumeSchema,
  TSuspendSchema,
  EngineType,
  TRequestContext extends Record<string, any> | unknown = unknown,
> = (
  params: ConditionFunctionParams<
    TState,
    TStepInput,
    TStepOutput,
    TResumeSchema,
    TSuspendSchema,
    EngineType,
    TRequestContext
  > & {
    iterationCount: number;
  },
) => Promise<boolean>;

// Define a Step interface
export interface Step<
  TStepId extends string = string,
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TResume = unknown,
  TSuspend = unknown,
  TEngineType = any,
  TRequestContext extends Record<string, any> | unknown = unknown,
> {
  id: TStepId;
  description?: string;
  inputSchema: SchemaWithValidation<TInput>;
  outputSchema: SchemaWithValidation<TOutput>;
  resumeSchema?: SchemaWithValidation<TResume>;
  suspendSchema?: SchemaWithValidation<TSuspend>;
  stateSchema?: SchemaWithValidation<TState>;
  /**
   * Optional schema for validating request context values.
   * When provided, the request context will be validated against this schema before step execution.
   */
  requestContextSchema?: SchemaWithValidation<TRequestContext>;
  execute: ExecuteFunction<TState, TInput, TOutput, TResume, TSuspend, TEngineType, TRequestContext>;
  scorers?: DynamicArgument<MastraScorers>;
  retries?: number;
  component?: string;
  metadata?: StepMetadata;
}

export const getStepResult = (stepResults: Record<string, StepResult<any, any, any, any>>, step: any) => {
  let result;

  if (typeof step === 'string') {
    result = stepResults[step];
  } else {
    if (!step?.id) {
      return null;
    }

    result = stepResults[step.id];
  }

  return result?.status === 'success' ? result.output : null;
};
