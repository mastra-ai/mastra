import { z } from 'zod';

import { Mastra } from '../mastra';

import { StepAction, RetryConfig, StepExecutionContext } from './types';

export class Step<
  TStepId extends string = any,
  TSchemaIn extends z.ZodSchema = any,
  TSchemaOut extends z.ZodSchema = any,
  TContext extends StepExecutionContext<TSchemaIn> = StepExecutionContext<TSchemaIn>,
> implements StepAction<TStepId, TSchemaIn, TSchemaOut, TContext>
{
  id: TStepId;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  payload?: Partial<z.infer<TSchemaIn>>;
  execute: (context: TContext) => Promise<z.infer<TSchemaOut>>;
  retryConfig?: RetryConfig;
  mastra?: Mastra;

  constructor({
    id,
    description,
    execute,
    payload,
    outputSchema,
    inputSchema,
    retryConfig,
  }: StepAction<TStepId, TSchemaIn, TSchemaOut, TContext>) {
    this.id = id;
    this.description = description ?? '';
    this.inputSchema = inputSchema;
    this.payload = payload;
    this.outputSchema = outputSchema;
    this.execute = execute;
    this.retryConfig = retryConfig;
  }
}

export function createStep<
  TId extends string,
  TSchemaIn extends z.ZodSchema,
  TSchemaOut extends z.ZodSchema,
  TContext extends StepExecutionContext<TSchemaIn>,
>(opts: StepAction<TId, TSchemaIn, TSchemaOut, TContext>) {
  return new Step(opts);
}
