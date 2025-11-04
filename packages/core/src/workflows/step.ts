import type { z } from 'zod';
import type { MastraScorers } from '../evals';
import type { Mastra } from '../mastra';
import type { TracingContext } from '../observability';
import type { RequestContext } from '../request-context';
import type { ChunkType } from '../stream/types';
import type { ToolStream } from '../tools/stream';
import type { DynamicArgument } from '../types';
import type { EMITTER_SYMBOL, STREAM_FORMAT_SYMBOL } from './constants';
import type { Emitter, StepResult } from './types';
import type { Workflow } from './workflow';

export type SuspendOptions = {
  resumeLabel?: string | string[];
};

export type ExecuteFunctionParams<TState, TStepInput, TResumeSchema, TSuspendSchema, EngineType> = {
  runId: string;
  resourceId?: string;
  workflowId: string;
  mastra: Mastra;
  requestContext: RequestContext;
  inputData: TStepInput;
  state: TState;
  setState(state: TState): void;
  resumeData?: TResumeSchema;
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
  suspend(suspendPayload: TSuspendSchema, suspendOptions?: SuspendOptions): Promise<any>;
  bail(result: any): any;
  abort(): any;
  resume?: {
    steps: string[];
    resumePayload: any;
  };
  [EMITTER_SYMBOL]: Emitter;
  [STREAM_FORMAT_SYMBOL]: 'legacy' | 'vnext' | undefined;
  engine: EngineType;
  abortSignal: AbortSignal;
  writer: ToolStream<ChunkType>;
  validateSchemas?: boolean;
};

export type ExecuteFunction<TState, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, EngineType> = (
  params: ExecuteFunctionParams<TState, TStepInput, TResumeSchema, TSuspendSchema, EngineType>,
) => Promise<TStepOutput>;

export type ConditionFunction<TState, TStepInput, TResumeSchema, TSuspendSchema, EngineType> = (
  params: ExecuteFunctionParams<TState, TStepInput, TResumeSchema, TSuspendSchema, EngineType>,
) => Promise<boolean>;

export type LoopConditionFunction<TState, TStepInput, TResumeSchema, TSuspendSchema, EngineType> = (
  params: ExecuteFunctionParams<TState, TStepInput, TResumeSchema, TSuspendSchema, EngineType> & {
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
> {
  id: TStepId;
  description?: string;
  inputSchema: TSchemaIn;
  outputSchema: TSchemaOut;
  resumeSchema?: TResumeSchema;
  suspendSchema?: TSuspendSchema;
  stateSchema?: TState;
  execute: ExecuteFunction<
    z.infer<TState>,
    z.infer<TSchemaIn>,
    z.infer<TSchemaOut>,
    z.infer<TResumeSchema>,
    z.infer<TSuspendSchema>,
    TEngineType
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
