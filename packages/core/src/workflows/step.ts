import type { z } from 'zod';
import type { TracingContext } from '../ai-tracing';
import type { Mastra } from '../mastra';
import type { RuntimeContext } from '../runtime-context';
import type { MastraScorers } from '../scores';
import type { ChunkType } from '../stream/types';
import type { ToolStream } from '../tools/stream';
import type { DynamicArgument } from '../types';
import type { EMITTER_SYMBOL } from './constants';
import type { Emitter } from './types';
import type { Workflow } from './workflow';

export type ExecuteFunctionParams<TStepInput, TResumeSchema, TSuspendSchema, EngineType> = {
  runId: string;
  workflowId: string;
  mastra: Mastra;
  runtimeContext: RuntimeContext;
  inputData: TStepInput;
  resumeData?: TResumeSchema;
  runCount: number;
  tracingContext: TracingContext;
  getInitData<T extends z.ZodType<any>>(): z.infer<T>;
  getInitData<T extends Workflow<any, any, any, any, any>>(): T extends undefined
    ? unknown
    : z.infer<NonNullable<T['inputSchema']>>;
  getStepResult<T extends Step<any, any, any>>(
    stepId: T,
  ): T['outputSchema'] extends undefined ? unknown : z.infer<NonNullable<T['outputSchema']>>;
  // TODO: should this be a schema you can define on the step?
  suspend(suspendPayload: TSuspendSchema): Promise<any>;
  bail(result: any): any;
  abort(): any;
  resume?: {
    steps: string[];
    resumePayload: any;
  };
  [EMITTER_SYMBOL]: Emitter;
  engine: EngineType;
  abortSignal: AbortSignal;
  writer: ToolStream<ChunkType>;
};

export type ExecuteFunction<TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, EngineType> = (
  params: ExecuteFunctionParams<TStepInput, TResumeSchema, TSuspendSchema, EngineType>,
) => Promise<TStepOutput>;

// Define a Step interface
export interface Step<
  TStepId extends string = string,
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
  execute: ExecuteFunction<
    z.infer<TSchemaIn>,
    z.infer<TSchemaOut>,
    z.infer<TResumeSchema>,
    z.infer<TSuspendSchema>,
    TEngineType
  >;
  scorers?: DynamicArgument<MastraScorers>;
  retries?: number;
}
