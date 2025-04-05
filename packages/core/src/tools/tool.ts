import type { z } from 'zod';

import type { Mastra } from '../mastra';
import type { ToolAction, ToolExecutionContext } from './types';

export class Tool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TSchemaVariables extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn, TSchemaVariables> = ToolExecutionContext<
    TSchemaIn,
    TSchemaVariables
  >,
> implements ToolAction<TSchemaIn, TSchemaOut, TSchemaVariables, TContext>
{
  id: string;
  description: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  variablesSchema?: TSchemaVariables;
  execute?: ToolAction<TSchemaIn, TSchemaOut, TSchemaVariables, TContext>['execute'];
  mastra?: Mastra;

  constructor(opts: ToolAction<TSchemaIn, TSchemaOut, TSchemaVariables, TContext>) {
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema;
    this.outputSchema = opts.outputSchema;
    this.variablesSchema = opts.variablesSchema;
    this.execute = opts.execute;
    this.mastra = opts.mastra;
  }
}

export function createTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TSchemaVariables extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn, TSchemaVariables> = ToolExecutionContext<
    TSchemaIn,
    TSchemaVariables
  >,
>(opts: ToolAction<TSchemaIn, TSchemaOut, TSchemaVariables, TContext>) {
  return new Tool(opts);
}
