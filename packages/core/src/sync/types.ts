import { z } from 'zod';

import { IAction, IExecutionContext } from '../action';

export interface SyncExecutionContext<TSchemaIn extends z.ZodSchema>
  extends IExecutionContext<z.infer<TSchemaIn>, any> {}

export interface SyncAction<
  TId extends string,
  TSchemaIn extends z.ZodSchema,
  TSchemaOut extends z.ZodSchema,
  TContext extends SyncExecutionContext<TSchemaIn>,
> extends IAction<TId, TSchemaIn, TSchemaOut, TContext> {}
