import type EventEmitter from 'events';
import type { z } from 'zod';
import type { Mastra } from '../..';
import type { NewWorkflow } from './workflow';

// Define a type for the execute function
export type ExecuteFunction<TStepInput, TStepOutput, TResumeSchema, TSuspendSchema> = (params: {
  mastra: Mastra;
  inputData: TStepInput;
  resumeData?: TResumeSchema;
  getInitData<T extends NewWorkflow<any, any, any, any, any>>(): T extends undefined
    ? unknown
    : z.infer<NonNullable<T['inputSchema']>>;
  getStepResult<T extends NewStep<any, any, any>>(
    stepId: T,
  ): T['outputSchema'] extends undefined ? unknown : z.infer<NonNullable<T['outputSchema']>>;
  // TODO: should this be a schema you can define on the step?
  suspend(suspendPayload: TSuspendSchema): Promise<void>;
  resume?: {
    steps: NewStep<string, any, any>[];
    resumePayload: any;
  };
  emitter: EventEmitter;
}) => Promise<TStepOutput>;

// Define a Step interface
export interface NewStep<
  TStepId extends string = string,
  TSchemaIn extends z.ZodObject<any> = z.ZodObject<any>,
  TSchemaOut extends z.ZodObject<any> = z.ZodObject<any>,
  TResumeSchema extends z.ZodObject<any> = z.ZodObject<any>,
  TSuspendSchema extends z.ZodObject<any> = z.ZodObject<any>,
> {
  id: TStepId;
  description?: string;
  inputSchema: TSchemaIn;
  outputSchema: TSchemaOut;
  resumeSchema?: TResumeSchema;
  suspendSchema?: TSuspendSchema;
  execute: ExecuteFunction<z.infer<TSchemaIn>, z.infer<TSchemaOut>, z.infer<TResumeSchema>, z.infer<TSuspendSchema>>;
  retries?: number;
}
