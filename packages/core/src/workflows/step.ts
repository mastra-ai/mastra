import { z } from 'zod';

import { ActionContext, RetryConfig } from './types';

export class Step<
  TStepId extends string = any,
  TSchemaIn extends z.ZodSchema = any,
  TSchemaOut extends z.ZodSchema = any,
> {
  id: TStepId;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  payload?: Partial<z.infer<TSchemaIn>>;
  action?: ({
    context,
    runId,
  }: {
    context: ActionContext<z.infer<TSchemaIn>>;
    runId: string;
  }) => Promise<z.infer<TSchemaOut>>;
  retryConfig?: RetryConfig;

  constructor({
    id,
    action,
    payload,
    outputSchema,
    inputSchema,
    retryConfig,
  }: {
    id: TStepId;
    inputSchema?: TSchemaIn;
    outputSchema?: TSchemaOut;
    retryConfig?: RetryConfig;
    payload?: Partial<z.infer<TSchemaIn>>;
    action?: ({
      context,
      runId,
    }: {
      context: ActionContext<z.infer<TSchemaIn>>;
      runId: string;
    }) => Promise<z.infer<TSchemaOut>>;
  }) {
    this.id = id;
    this.inputSchema = inputSchema;
    this.payload = payload;
    this.outputSchema = outputSchema;
    this.action = action;
    this.retryConfig = retryConfig;
  }
}
