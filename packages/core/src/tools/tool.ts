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
  execute?: ToolAction<TSchemaIn, TSchemaOut, TContext>['execute'];
  mastra?: Mastra;

  constructor(opts: ToolAction<TSchemaIn, TSchemaOut, TContext>) {
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema;
    this.outputSchema = opts.outputSchema;
    this.execute = opts.execute;
    this.mastra = opts.mastra;
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
  const tool = new Tool(opts);

  // Wrap execute with validation if inputSchema exists
  if (tool.inputSchema && tool.execute) {
    const originalExecute = tool.execute;
    // Use any type to bypass type checking for validation errors
    (tool as any).execute = async (context: TContext, options?: any) => {
      // Validate input if schema exists
      if (tool.inputSchema && 'safeParse' in tool.inputSchema) {
        const validation = tool.inputSchema.safeParse(context.context);
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
      return originalExecute(context, options);
    };
  }

  return tool as any;
}
