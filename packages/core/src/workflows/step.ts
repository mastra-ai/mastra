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

  constructor({
    id,
    action,
    payload,
    outputSchema,
    inputSchema,
  }: {
    id: TStepId;
    inputSchema?: TSchemaIn;
    outputSchema?: TSchemaOut;
    payload?: Partial<z.infer<TSchemaIn>>;
    action?: ({ data, runId }: { data: z.infer<TSchemaIn>; runId: string }) => Promise<z.infer<TSchemaOut>>;
  }) {
    this.id = id;
    this.inputSchema = inputSchema;
    this.payload = payload;
    this.outputSchema = outputSchema;
    this.action = action;
  }
}
