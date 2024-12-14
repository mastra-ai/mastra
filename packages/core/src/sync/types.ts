import { z } from 'zod';

import { IAction, IExecutionContext } from '../action';
import { MastraEngine } from '../engine';

export interface SyncExecutionContext<TSchemaIn extends z.ZodSchema> extends IExecutionContext<z.infer<TSchemaIn>> {
  engine?: MastraEngine;
}

export interface SyncAction<
  TId extends string,
  TSchemaIn extends z.ZodSchema,
  TSchemaOut extends z.ZodSchema,
  TContext extends SyncExecutionContext<TSchemaIn>,
> extends IAction<TId, TSchemaIn, TSchemaOut, TContext> {
  engine?: MastraEngine;
}
