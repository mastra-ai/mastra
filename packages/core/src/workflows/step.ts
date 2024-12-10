import { z } from 'zod';

import { RetryConfig, WorkflowContext } from './types';

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
    context: z.infer<TSchemaIn> & WorkflowContext['stepResults'];
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
      context: z.infer<TSchemaIn> & WorkflowContext['stepResults'];
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
