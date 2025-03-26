import type { ToolExecutionOptions } from 'ai';
import type { z } from 'zod';

import type { Mastra } from '../mastra';
import type { ToolAction, ToolExecutionContext } from './types';

export class Tool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<TSchemaIn>,
> implements ToolAction<TSchemaIn, TSchemaOut, TContext>
{
  id: string;
  description: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  execute?: ToolAction<TSchemaIn, TSchemaOut, TContext>['execute'];
  mastra?: Mastra;

  constructor(opts: ToolAction<TSchemaIn, TSchemaOut, TContext>) {
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema;
    this.outputSchema = opts.outputSchema;
    this.execute = opts.execute;
    this.mastra = opts.mastra;
  }
}

export function createTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<TSchemaIn>,
>(opts: ToolAction<TSchemaIn, TSchemaOut, TContext>) {
  return new Tool(opts);
}
