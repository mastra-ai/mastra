import { z } from 'zod';

import { Mastra } from '../mastra';
import { WorkflowContext } from '../workflows';

export interface IExecutionContext<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TContext extends WorkflowContext = WorkflowContext,
> {
  context: TSchemaIn extends z.ZodSchema
    ? z.infer<TSchemaIn> & { machineContext?: TContext }
    : { machineContext?: TContext };
  runId?: string;
  mastra?: Mastra;
}

export interface IAction<
  TId extends string,
  TSchemaIn extends z.ZodSchema | undefined,
  TSchemaOut extends z.ZodSchema | undefined,
  TContext extends IExecutionContext<TSchemaIn>,
> {
  id: TId;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  mastra?: Mastra;
  payload?: TSchemaIn extends z.ZodSchema ? Partial<z.infer<TSchemaIn>> : unknown;
  execute: (context: TContext) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
  [key: string]: any;
}
