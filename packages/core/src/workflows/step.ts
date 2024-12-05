import { z } from 'zod';

export class Step<
  TStepId extends string = any,
  TSchemaIn extends z.ZodSchema = any,
  TSchemaOut extends z.ZodSchema = any,
> {
  id: TStepId;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  payload?: Partial<z.infer<TSchemaIn>>;
  action?: ({ data, runId }: { data: z.infer<TSchemaIn>; runId: string }) => Promise<z.infer<TSchemaOut>>;
  timeout?: number;
  delay?: number;

  constructor({
    id,
    action,
    payload,
    outputSchema,
    inputSchema,
    timeout,
    delay,
  }: {
    id: TStepId;
    inputSchema?: TSchemaIn;
    outputSchema?: TSchemaOut;
    timeout?: number;
    delay?: number;
    payload?: Partial<z.infer<TSchemaIn>>;
    action?: ({ data, runId }: { data: z.infer<TSchemaIn>; runId: string }) => Promise<z.infer<TSchemaOut>>;
  }) {
    this.id = id;
    this.inputSchema = inputSchema;
    this.payload = payload;
    this.outputSchema = outputSchema;
    this.action = action;
    this.timeout = timeout;
    this.delay = delay;
  }
}
