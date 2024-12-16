import { z } from 'zod';

import { Mastra } from '../mastra';

import { SyncAction, SyncExecutionContext } from './types';

export class Sync<
  TId extends string,
  TSchemaIn extends z.ZodSchema,
  TSchemaOut extends z.ZodSchema,
  TContext extends SyncExecutionContext<TSchemaIn>,
> implements SyncAction<TId, TSchemaIn, TSchemaOut, TContext>
{
  id: TId;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  mastra?: Mastra;
  execute: (context: TContext) => Promise<z.infer<TSchemaOut>>;

  constructor(opts: SyncAction<TId, TSchemaIn, TSchemaOut, TContext>) {
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema;
    this.outputSchema = opts.outputSchema;
    this.execute = opts.execute;
    this.mastra = opts.mastra;
  }
}

export function createSync<
  TId extends string,
  TSchemaIn extends z.ZodSchema,
  TSchemaOut extends z.ZodSchema,
  TContext extends SyncExecutionContext<TSchemaIn>,
>(opts: SyncAction<TId, TSchemaIn, TSchemaOut, TContext>) {
  return new Sync(opts);
}
