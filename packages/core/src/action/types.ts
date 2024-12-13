import { z } from 'zod';

export interface ExecuteContext<TInput = any> {
  context: TInput;
}

export interface IAction<
  TId extends string = string,
  TSchemaIn extends z.ZodSchema = z.ZodSchema,
  TSchemaOut extends z.ZodSchema = z.ZodSchema,
  TContext extends ExecuteContext<z.infer<TSchemaIn>> = ExecuteContext<z.infer<TSchemaIn>>,
> {
  id: TId;
  description: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  payload?: Partial<z.infer<TSchemaIn>>;
  execute: (context: TContext) => Promise<z.infer<TSchemaOut>>;
}
