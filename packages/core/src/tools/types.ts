import { ZodSchema, z } from 'zod';

import { IAction, IExecutionContext } from '../action';

export type CoreTool = {
  description?: string;
  parameters: ZodSchema;
  execute: (params: any) => Promise<any>;
};

export interface ToolExecutionContext<TSchemaIn extends z.ZodSchema>
  extends IExecutionContext<z.infer<TSchemaIn>, any> {}

export interface ToolAction<
  TId extends string,
  TSchemaIn extends z.ZodSchema,
  TSchemaOut extends z.ZodSchema,
  TContext extends ToolExecutionContext<TSchemaIn>,
> extends IAction<TId, TSchemaIn, TSchemaOut, TContext> {}
