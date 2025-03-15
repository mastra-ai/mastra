import type { ToolExecutionOptions, Tool } from 'ai';
import type { ZodSchema, z } from 'zod';

import type { IAction, IExecutionContext, MastraUnion } from '../action';
import type { Mastra } from '../mastra';

export type VercelTool = Tool;

// Define CoreTool as a discriminated union to match the AI SDK's Tool type
export type CoreTool = {
  id?: string;
  description?: string;
  parameters: ZodSchema;
  execute?: (params: any, options: ToolExecutionOptions) => Promise<any>;
} & (
  | {
      type?: 'function' | undefined;
      id?: string;
    }
  | {
      type: 'provider-defined';
      id: `${string}.${string}`;
      args: Record<string, unknown>;
    }
);

export interface ToolExecutionContext<TSchemaIn extends z.ZodSchema | undefined = undefined>
  extends IExecutionContext<TSchemaIn> {
  mastra?: MastraUnion;
}

export interface ToolAction<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<TSchemaIn>,
  TOptions extends unknown = unknown,
> extends IAction<string, TSchemaIn, TSchemaOut, TContext, TOptions> {
  description: string;
  execute?: (
    context: TContext,
    options?: TOptions,
  ) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
  mastra?: Mastra;
}
