import { z } from 'zod';

import { Mastra } from '../mastra';

import { ToolAction, ToolExecutionContext } from './types';

export class Tool<
  TId extends string,
  TSchemaIn extends z.ZodSchema,
  TSchemaOut extends z.ZodSchema,
  TContext extends ToolExecutionContext<TSchemaIn>,
> implements ToolAction<TId, TSchemaIn, TSchemaOut, TContext>
{
  id: TId;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  execute: (context: TContext) => Promise<z.infer<TSchemaOut>>;
  mastra?: Mastra;

  constructor(opts: ToolAction<TId, TSchemaIn, TSchemaOut, TContext>) {
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema;
    this.outputSchema = opts.outputSchema;
    this.execute = opts.execute;
    this.mastra = opts.mastra;
  }
}

export function createTool<
  TId extends string,
  TSchemaIn extends z.ZodSchema,
  TSchemaOut extends z.ZodSchema,
  TContext extends ToolExecutionContext<TSchemaIn>,
>(opts: ToolAction<TId, TSchemaIn, TSchemaOut, TContext>) {
  return new Tool(opts);
}
