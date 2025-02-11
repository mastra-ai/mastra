import { ZodSchema, z } from 'zod';

import { type IAction, type IExecutionContext } from '../action';
import { type WorkflowContext } from '../workflows';

export type CoreTool = {
  description?: string;
  parameters: ZodSchema;
  execute: (params: any) => Promise<any>;
};
export interface ToolExecutionContext<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TContext extends WorkflowContext = WorkflowContext,
> extends IExecutionContext<TSchemaIn, TContext> {}

export interface ToolAction<
  TId extends string,
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<TSchemaIn>,
> extends IAction<TId, TSchemaIn, TSchemaOut, TContext> {}
