import type { z } from 'zod';
import type { Emitter, Mastra } from '..';
import type { DynamicArgument } from '../agent/types';
import type { RuntimeContext } from '../di';
import type { Scorers } from '../eval';
import type { EMITTER_SYMBOL } from './constants';
import type { Workflow } from './workflow';

export type ExecuteFunctionParams<TStepInput, TResumeSchema, TSuspendSchema, EngineType> = {
  runId: string;
  workflowId: string;
  mastra: Mastra;
  runtimeContext: RuntimeContext;
  inputData: TStepInput;
  resumeData?: TResumeSchema;
  runCount: number;
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
};

// Define a type for the execute function
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
  scorers?: DynamicArgument<Scorers>;
  execute: ExecuteFunction<
    z.infer<TSchemaIn>,
    z.infer<TSchemaOut>,
    z.infer<TResumeSchema>,
    z.infer<TSuspendSchema>,
    TEngineType
  >;
  retries?: number;
}
