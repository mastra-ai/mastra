import { z } from 'zod';

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

  constructor({
    id,
    description,
    execute,
    payload,
    outputSchema,
    inputSchema,
    retryConfig,
  }: {
    id: TStepId;
    description?: string;
    inputSchema?: TSchemaIn;
    outputSchema?: TSchemaOut;
    retryConfig?: RetryConfig;
    payload?: Partial<z.infer<TSchemaIn>>;
    execute: (context: TContext) => Promise<z.infer<TSchemaOut>>;
  }) {
    this.id = id;
    this.description = description ?? '';
    this.inputSchema = inputSchema;
    this.payload = payload;
    this.outputSchema = outputSchema;
    this.execute = execute;
    this.retryConfig = retryConfig;
  }
}
