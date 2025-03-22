import type { z } from 'zod';

import { Tool as BaseTool } from './tool';
import type { ToolAction, ToolExecutionContext } from './types';

export * from './tool';

export class Tool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TSchemaDeps extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn, TSchemaDeps> = ToolExecutionContext<TSchemaIn, TSchemaDeps>,
> extends BaseTool<TSchemaIn, TSchemaOut, TSchemaDeps, TContext> {
  constructor(opts: ToolAction<TSchemaIn, TSchemaOut, TSchemaDeps, TContext>) {
    super(opts);

    console.warn('Please import "Tool" from "@mastra/core/tools" instead of "@mastra/core"');
  }
}
