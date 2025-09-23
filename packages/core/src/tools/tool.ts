import type { ToolExecutionOptions } from 'ai';
import type { ToolCallOptions } from 'ai-v5';
import type { z } from 'zod';

import type { Mastra } from '../mastra';
import type { ToolAction, ToolExecutionContext, ToolInvocationOptions } from './types';
import { validateToolInput } from './validation';

export class Tool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TSuspendSchema extends z.ZodSchema = any,
  TResumeSchema extends z.ZodSchema = any,
  TContext extends ToolExecutionContext<TSchemaIn, TSuspendSchema, TResumeSchema> = ToolExecutionContext<
    TSchemaIn,
    TSuspendSchema,
    TResumeSchema
  >,
> implements ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext>
{
  id: string;
  description: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  suspendSchema?: TSuspendSchema;
  resumeSchema?: TResumeSchema;
  execute?: ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext>['execute'];
  mastra?: Mastra;
  requireApproval?: boolean;

  constructor(opts: ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext>) {
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema;
    this.outputSchema = opts.outputSchema;
    this.suspendSchema = opts.suspendSchema;
    this.resumeSchema = opts.resumeSchema;
    this.mastra = opts.mastra;
    this.requireApproval = opts.requireApproval || false;

    // Wrap the execute function with validation if it exists
    if (opts.execute) {
      const originalExecute = opts.execute;
      this.execute = async (context: TContext, options?: ToolInvocationOptions) => {
        const { resumeData, suspend } = (options ?? {}) as {
          resumeData?: any;
          suspend?: (suspendPayload: any) => Promise<any>;
        };
        // Validate input if schema exists
        const { data, error } = validateToolInput(this.inputSchema, context, this.id);
        if (error) {
          return error as any;
        }

        return originalExecute({ ...(data as TContext), suspend, resumeData } as TContext, options);
      };
    }
  }
}

export function createTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TSuspendSchema extends z.ZodSchema = any,
  TResumeSchema extends z.ZodSchema = any,
  TContext extends ToolExecutionContext<TSchemaIn, TSuspendSchema, TResumeSchema> = ToolExecutionContext<
    TSchemaIn,
    TSuspendSchema,
    TResumeSchema
  >,
  TExecute extends ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext>['execute'] = ToolAction<
    TSchemaIn,
    TSchemaOut,
    TSuspendSchema,
    TResumeSchema,
    TContext
  >['execute'],
>(
  opts: ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> & {
    execute?: TExecute;
  },
): [TSchemaIn, TSchemaOut, TExecute] extends [z.ZodSchema, z.ZodSchema, Function]
  ? Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> & {
      inputSchema: TSchemaIn;
      outputSchema: TSchemaOut;
      execute: (context: TContext, options: ToolExecutionOptions | ToolCallOptions) => Promise<any>;
    }
  : Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> {
  return new Tool(opts) as any;
}
