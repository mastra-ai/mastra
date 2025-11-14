import type { ToolExecutionOptions } from 'ai';
import type { z } from 'zod';

// Client-side tool execution context (simplified version without server dependencies)
export interface ClientToolExecutionContext<TSchemaIn extends z.ZodSchema | undefined = undefined> {
  context: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : unknown;
}

// Client-side tool action interface
export interface ClientToolAction<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
> {
  id: string;
  description: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  execute?: (
    context: ClientToolExecutionContext<TSchemaIn>,
    options?: ToolExecutionOptions,
  ) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
}

// Client-side tool class (simplified version without server dependencies)
export class ClientTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
> implements ClientToolAction<TSchemaIn, TSchemaOut>
{
  id: string;
  description: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  execute?: ClientToolAction<TSchemaIn, TSchemaOut>['execute'];

  constructor(opts: ClientToolAction<TSchemaIn, TSchemaOut>) {
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema;
    this.outputSchema = opts.outputSchema;
    this.execute = opts.execute;
  }
}

// Client-side createTool function
export function createTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
>(opts: ClientToolAction<TSchemaIn, TSchemaOut>): ClientTool<TSchemaIn, TSchemaOut> {
  return new ClientTool(opts);
}
