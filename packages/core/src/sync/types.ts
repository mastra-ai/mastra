import { z } from 'zod';

import { IAction, IExecutionContext } from '../action';
import { WorkflowContext } from '../workflows';

export interface SyncExecutionContext<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TContext extends WorkflowContext = WorkflowContext,
> extends IExecutionContext<TSchemaIn, TContext> {}

export interface SyncAction<
  TId extends string,
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends SyncExecutionContext<TSchemaIn> = SyncExecutionContext<TSchemaIn>,
> extends IAction<TId, TSchemaIn, TSchemaOut, TContext> {}
