import { z } from 'zod';

import { Tool as BaseTool } from './tool';
import { ToolAction, ToolExecutionContext } from './types';

export * from './tool';

export abstract class Tool<
  TId extends string,
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<TSchemaIn>,
> extends BaseTool<TId, TSchemaIn, TSchemaOut, TContext> {
  constructor(opts: ToolAction<TId, TSchemaIn, TSchemaOut, TContext>) {
    super(opts);

    console.warn('Please import from "@mastra/core/tools" instead of "@mastra/core"');
  }
}
