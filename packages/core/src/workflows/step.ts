import { z } from 'zod';

import { type MastraPrimitives } from '../action';

import { type StepAction, type RetryConfig, type StepExecutionContext } from './types';

export class Step<
  TStepId extends string = any,
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends StepExecutionContext<TSchemaIn> = StepExecutionContext<TSchemaIn>,
> implements StepAction<TStepId, TSchemaIn, TSchemaOut, TContext>
{
  id: TStepId;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  payload?: TSchemaIn extends z.ZodSchema ? Partial<z.infer<TSchemaIn>> : unknown;
  execute: (context: TContext) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
  retryConfig?: RetryConfig;
  mastra?: MastraPrimitives;

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
  TSchemaIn extends z.ZodSchema | undefined,
  TSchemaOut extends z.ZodSchema | undefined,
  TContext extends StepExecutionContext<TSchemaIn>,
>(opts: StepAction<TId, TSchemaIn, TSchemaOut, TContext>) {
  return new Step(opts);
}
