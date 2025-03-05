import type { ToolExecutionOptions, Tool } from 'ai';
import type { ZodSchema, z } from 'zod';

import type { IAction, IExecutionContext, MastraPrimitives } from '../action';
import type { Mastra } from '../mastra';

export type VercelTool = Tool;

export type CoreTool = {
  description?: string;
  parameters: ZodSchema;
  execute?: (params: any, options: ToolExecutionOptions) => Promise<any>;
};
export interface ToolExecutionContext<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TMastra extends MastraPrimitives | undefined = undefined,
> extends IExecutionContext<TSchemaIn> {
  mastra?: TMastra extends MastraPrimitives ? TMastra : Mastra;
}

export interface ToolAction<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn, MastraPrimitives | undefined> = ToolExecutionContext<TSchemaIn, MastraPrimitives | undefined>,
  TOptions extends unknown = unknown,
> extends IAction<string, TSchemaIn, TSchemaOut, TContext, TOptions> {
  description: string;
  execute: (
    context: TContext,
    options?: TOptions,
  ) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
  mastra?: Mastra;
}
