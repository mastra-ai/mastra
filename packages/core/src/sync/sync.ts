import { z } from 'zod';

import { SyncAction, SyncExecutionContext } from './types';

export class Sync<
  TId extends string,
  TSchemaIn extends z.ZodSchema,
  TSchemaOut extends z.ZodSchema,
  TContext extends SyncExecutionContext<TSchemaIn>,
> implements SyncAction<TId, TSchemaIn, TSchemaOut, TContext>
{
  id;
  description;
  inputSchema;
  outputSchema;
  execute;
  engine;

  constructor(opts: SyncAction<TId, TSchemaIn, TSchemaOut, TContext>) {
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema;
    this.outputSchema = opts.outputSchema;
    this.execute = opts.execute;
    this.engine = opts.engine;
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
