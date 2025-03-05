import type { ToolExecutionOptions, Tool } from 'ai';
import type { ZodSchema, z } from 'zod';

import type { IAction, IExecutionContext } from '../action';
import type { WorkflowContext } from '../workflows';

export type VercelTool = Tool;

export type CoreTool = {
  description?: string;
  parameters: ZodSchema;
  execute?: (params: any, options: ToolExecutionOptions) => Promise<any>;
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
  TOptions extends unknown = unknown,
> extends IAction<TId, TSchemaIn, TSchemaOut, TContext, TOptions> {}
