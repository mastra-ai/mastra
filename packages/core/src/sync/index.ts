import { z } from 'zod';

import { ISyncAction, SyncExecutionContext } from './types';

export class Sync<
  TId extends string,
  TSchemaIn extends z.ZodSchema,
  TSchemaOut extends z.ZodSchema,
  TContext extends SyncExecutionContext<TSchemaIn>,
> implements ISyncAction<TId, TSchemaIn, TSchemaOut, TContext>
{
  id;
  description;
  inputSchema;
  outputSchema;
  execute;
  engine;

  constructor(opts: ISyncAction<TId, TSchemaIn, TSchemaOut, TContext>) {
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
>(opts: ISyncAction<TId, TSchemaIn, TSchemaOut, TContext>) {
  return new Sync(opts);
}
