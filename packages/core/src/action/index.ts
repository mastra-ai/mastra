import { z } from 'zod';

export interface IExecutionContext<TPayload, TContext> {
  context: TPayload & { machineContext?: TContext };
  runId?: string;
}

export interface IAction<
  TId extends string,
  TSchemaIn extends z.ZodSchema,
  TSchemaOut extends z.ZodSchema,
  TContext extends IExecutionContext<z.infer<TSchemaIn>, any>,
> {
  id: TId;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  payload?: Partial<z.infer<TSchemaIn>>;
  execute: (context: TContext) => Promise<z.infer<TSchemaOut>>;
  [key: string]: any;
}
