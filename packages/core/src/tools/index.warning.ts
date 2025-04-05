import type { z } from 'zod';

import { Tool as BaseTool } from './tool';
import type { ToolAction, ToolExecutionContext } from './types';

export * from './tool';

export class Tool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TSchemaVariables extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn, TSchemaVariables> = ToolExecutionContext<
    TSchemaIn,
    TSchemaVariables
  >,
> extends BaseTool<TSchemaIn, TSchemaOut, TSchemaVariables, TContext> {
  constructor(opts: ToolAction<TSchemaIn, TSchemaOut, TSchemaVariables, TContext>) {
    super(opts);

    console.warn('Please import "Tool" from "@mastra/core/tools" instead of "@mastra/core"');
  }
}
