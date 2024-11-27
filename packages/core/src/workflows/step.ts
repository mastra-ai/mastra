import { z } from "zod";

export class Step<
  TStepId extends string = any,
  TSchemaIn extends z.ZodSchema = any,
  TSchemaOut extends z.ZodSchema = any
> {
  id: TStepId;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  payload?: Partial<z.infer<TSchemaIn>>;
  action?: (args: z.infer<TSchemaIn>) => Promise<z.infer<TSchemaOut>>;

  constructor({id, inputSchema, outputSchema, payload, action}: {id: TStepId, inputSchema?: TSchemaIn, outputSchema?: TSchemaOut, payload?: Partial<z.infer<TSchemaIn>>, action?: (args: z.infer<TSchemaIn>) => Promise<z.infer<TSchemaOut>>}) {
    this.id = id;
    this.inputSchema = inputSchema;
    this.payload = payload;
    this.outputSchema = outputSchema;
    this.action = action;
  }
}
