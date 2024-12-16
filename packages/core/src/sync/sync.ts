import { z } from 'zod';

import { Mastra } from '../mastra';

import { SyncAction, SyncExecutionContext } from './types';

export class Sync<
  TId extends string,
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends SyncExecutionContext<TSchemaIn> = SyncExecutionContext<TSchemaIn>,
> implements SyncAction<TId, TSchemaIn, TSchemaOut, TContext>
{
  id: TId;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  mastra?: Mastra;
  execute: (context: TContext) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;

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
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends SyncExecutionContext<TSchemaIn> = SyncExecutionContext<TSchemaIn>,
>(opts: SyncAction<TId, TSchemaIn, TSchemaOut, TContext>) {
  return new Sync(opts);
}
