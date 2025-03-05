import type { ToolExecutionOptions } from 'ai';
import type { ZodSchema, z } from 'zod';

import type { IAction, IExecutionContext } from '../action';
import type { Mastra } from '../mastra';

export type CoreTool = {
  description?: string;
  parameters: ZodSchema;
  execute?: (params: any, options: ToolExecutionOptions) => Promise<any>;
};
export interface ToolExecutionContext<TSchemaIn extends z.ZodSchema | undefined = undefined>
  extends IExecutionContext<TSchemaIn> {}

export interface ToolAction<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<TSchemaIn>,
  TOptions extends unknown = unknown,
> extends IAction<string, TSchemaIn, TSchemaOut, TContext, TOptions> {
  description: string;
  execute: (
    context: TContext,
    options?: TOptions,
  ) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
  mastra?: Mastra;
}
