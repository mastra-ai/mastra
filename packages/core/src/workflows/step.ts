import type { z } from 'zod';
import type { MastraScorers } from '../evals';
import type { PubSub } from '../events/pubsub';
import type { Mastra } from '../mastra';
import type { TracingContext } from '../observability';
import type { RequestContext } from '../request-context';
import type { ToolStream } from '../tools/stream';
import type { DynamicArgument } from '../types';
import type { ZodLikeSchema, InferZodLikeSchema } from '../types/zod-compat';
import type { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from './constants';
import type { StepResult } from './types';
import type { Workflow } from './workflow';

export type SuspendOptions = {
  resumeLabel?: string | string[];
} & Record<string, any>;

export type ExecuteFunctionParams<
  TState,
  TStepInput,
  TResumeSchema,
  TSuspendSchema,
  EngineType,
  TRequestContextSchema extends ZodLikeSchema | undefined = undefined,
> = {
  runId: string;
  resourceId?: string;
  workflowId: string;
  mastra: Mastra;
  requestContext: TRequestContextSchema extends ZodLikeSchema
    ? RequestContext<InferZodLikeSchema<TRequestContextSchema>>
    : RequestContext;
  inputData: TStepInput;
  state: TState;
  setState(state: TState): Promise<void>;
  resumeData?: TResumeSchema;
  suspendData?: TSuspendSchema;
  retryCount: number;
  tracingContext: TracingContext;
  getInitData<T extends z.ZodType<any>>(): z.infer<T>;
  getInitData<T extends Workflow<any, any, any, any, any>>(): T extends undefined
    ? unknown
    : z.infer<NonNullable<T['inputSchema']>>;
  getStepResult<T extends Step<any, any, any, any, any, any>>(
    stepId: T,
  ): T['outputSchema'] extends undefined ? unknown : z.infer<NonNullable<T['outputSchema']>>;
  getStepResult(stepId: string): any;
  suspend(suspendPayload?: TSuspendSchema, suspendOptions?: SuspendOptions): Promise<any>;
  bail(result: any): any;
  abort(): any;
  resume?: {
    steps: string[];
    resumePayload: any;
  };
  restart?: boolean;
  [PUBSUB_SYMBOL]: PubSub;
  [STREAM_FORMAT_SYMBOL]: 'legacy' | 'vnext' | undefined;
  engine: EngineType;
  abortSignal: AbortSignal;
  writer: ToolStream;
  validateSchemas?: boolean;
};

export type ConditionFunctionParams<
  TState,
  TStepInput,
  TResumeSchema,
  TSuspendSchema,
  EngineType,
  TRequestContextSchema extends ZodLikeSchema | undefined = undefined,
> = Omit<
  ExecuteFunctionParams<TState, TStepInput, TResumeSchema, TSuspendSchema, EngineType, TRequestContextSchema>,
  'setState' | 'suspend'
>;

export type ExecuteFunction<
  TState,
  TStepInput,
  TStepOutput,
  TResumeSchema,
  TSuspendSchema,
  EngineType,
  TRequestContextSchema extends ZodLikeSchema | undefined = undefined,
> = (
  params: ExecuteFunctionParams<TState, TStepInput, TResumeSchema, TSuspendSchema, EngineType, TRequestContextSchema>,
) => Promise<TStepOutput>;

export type ConditionFunction<
  TState,
  TStepInput,
  TResumeSchema,
  TSuspendSchema,
  EngineType,
  TRequestContextSchema extends ZodLikeSchema | undefined = undefined,
> = (
  params: ConditionFunctionParams<TState, TStepInput, TResumeSchema, TSuspendSchema, EngineType, TRequestContextSchema>,
) => Promise<boolean>;

export type LoopConditionFunction<
  TState,
  TStepInput,
  TResumeSchema,
  TSuspendSchema,
  EngineType,
  TRequestContextSchema extends ZodLikeSchema | undefined = undefined,
> = (
  params: ConditionFunctionParams<
    TState,
    TStepInput,
    TResumeSchema,
    TSuspendSchema,
    EngineType,
    TRequestContextSchema
  > & {
    iterationCount: number;
  },
) => Promise<boolean>;

// Define a Step interface
export interface Step<
  TStepId extends string = string,
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TSchemaIn extends z.ZodType<any> = z.ZodType<any>,
  TSchemaOut extends z.ZodType<any> = z.ZodType<any>,
  TResumeSchema extends z.ZodType<any> = z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any> = z.ZodType<any>,
  TEngineType = any,
  TRequestContextSchema extends ZodLikeSchema | undefined = undefined,
> {
  id: TStepId;
  description?: string;
  inputSchema: TSchemaIn;
  outputSchema: TSchemaOut;
  resumeSchema?: TResumeSchema;
  suspendSchema?: TSuspendSchema;
  stateSchema?: TState;
  /**
   * Schema for validating and typing the requestContext.
   * When provided, the requestContext will be validated at runtime using .parse()
   * and the execute function will receive a typed RequestContext.
   *
   * @example
   * ```typescript
   * const myStep = createStep({
   *   id: 'my-step',
   *   requestContextSchema: z.object({
   *     userId: z.string(),
   *     tenantId: z.string(),
   *   }),
   *   execute: async ({ requestContext }) => {
   *     // requestContext is typed!
   *     const userId = requestContext.get('userId'); // string
   *   }
   * });
   * ```
   */
  requestContextSchema?: TRequestContextSchema;
  execute: ExecuteFunction<
    z.infer<TState>,
    z.infer<TSchemaIn>,
    z.infer<TSchemaOut>,
    z.infer<TResumeSchema>,
    z.infer<TSuspendSchema>,
    TEngineType,
    TRequestContextSchema
  >;
  scorers?: DynamicArgument<MastraScorers>;
  retries?: number;
  component?: string;
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
