import type { z } from 'zod';

import { Tool as BaseTool } from './tool';
import type { ToolAction, ToolExecutionContext } from './types';

export * from './tool';

export class Tool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TSuspendSchema extends z.ZodSchema = any,
  TResumeSchema extends z.ZodSchema = any,
  TContext extends ToolExecutionContext<TSuspendSchema, TResumeSchema> = ToolExecutionContext<
    TSuspendSchema,
    TResumeSchema
  >,
> extends BaseTool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> {
  constructor(opts: ToolAction<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext>) {
    super(opts);

    console.warn('Please import "Tool" from "@mastra/core/tools" instead of "@mastra/core"');
  }
}
