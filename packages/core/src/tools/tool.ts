import type { z } from 'zod';

import type { Mastra } from '../mastra';
import type { ToolAction, ToolExecutionContext } from './types';

export class Tool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<TSchemaIn>,
> implements ToolAction<TSchemaIn, TSchemaOut, TContext>
{
  id: string;
  description: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  private _execute?: ToolAction<TSchemaIn, TSchemaOut, TContext>['execute'];
  mastra?: Mastra;

  constructor(opts: ToolAction<TSchemaIn, TSchemaOut, TContext>) {
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema;
    this.outputSchema = opts.outputSchema;
    this._execute = opts.execute;
    this.mastra = opts.mastra;
  }

  async execute(context: TContext, options?: any): Promise<any> {
    if (!this._execute) {
      throw new Error(`Tool ${this.id} does not have an execute function`);
    }

    // Validate input if schema exists
    if (this.inputSchema && 'safeParse' in this.inputSchema) {
      const validation = this.inputSchema.safeParse(context.context);
      if (!validation.success) {
        // Format validation errors for agent understanding
        const errorMessages = validation.error.errors
          .map((e: any) => `- ${e.path?.join('.') || 'root'}: ${e.message}`)
          .join('\n');

        // Return error as a result instead of throwing
        return {
          error: true,
          message: `Tool validation failed. Please fix the following errors and try again:\n${errorMessages}\n\nProvided arguments: ${JSON.stringify(context.context, null, 2)}`,
          validationErrors: validation.error.format(),
        };
      }
      // Use validated data
      context = { ...context, context: validation.data };
    }

    return this._execute(context, options);
  }
}

export function createTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<TSchemaIn>,
  TExecute extends ToolAction<TSchemaIn, TSchemaOut, TContext>['execute'] = ToolAction<
    TSchemaIn,
    TSchemaOut,
    TContext
  >['execute'],
>(
  opts: ToolAction<TSchemaIn, TSchemaOut, TContext> & {
    execute?: TExecute;
  },
): [TSchemaIn, TSchemaOut, TExecute] extends [z.ZodSchema, z.ZodSchema, Function]
  ? Tool<TSchemaIn, TSchemaOut, TContext> & {
      inputSchema: TSchemaIn;
      outputSchema: TSchemaOut;
      execute: (context: TContext) => Promise<any>;
    }
  : Tool<TSchemaIn, TSchemaOut, TContext> {
  return new Tool(opts) as any;
}
