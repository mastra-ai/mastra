import type { ToolExecutionOptions } from 'ai';
import type { z } from 'zod';

import type { Mastra } from '../mastra';
import type { ToolAction, ToolExecutionContext } from './types';

export class Tool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TSchemaDeps extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn, TSchemaDeps> = ToolExecutionContext<TSchemaIn, TSchemaDeps>,
  TOptions extends ToolExecutionOptions = ToolExecutionOptions,
> implements ToolAction<TSchemaIn, TSchemaOut, TSchemaDeps, TContext, TOptions>
{
  id: string;
  description: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  dependenciesSchema?: TSchemaDeps;
  execute?: (
    context: TContext,
    options?: TOptions,
  ) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
  mastra?: Mastra;

  constructor(opts: ToolAction<TSchemaIn, TSchemaOut, TSchemaDeps, TContext, TOptions>) {
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema;
    this.outputSchema = opts.outputSchema;
    this.dependenciesSchema = opts.dependenciesSchema;
    this.execute = opts.execute;
    this.mastra = opts.mastra;
  }
}

export function createTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TSchemaDeps extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn, TSchemaDeps> = ToolExecutionContext<TSchemaIn, TSchemaDeps>,
  TOptions extends ToolExecutionOptions = ToolExecutionOptions,
>(opts: ToolAction<TSchemaIn, TSchemaOut, TSchemaDeps, TContext, TOptions>) {
  return new Tool(opts);
}
