import type { Tool, ToolExecutionOptions } from 'ai';
import type { ZodSchema, z } from 'zod';

import type { IAction, IExecutionContext, MastraUnion } from '../action';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory';
import type { DependenciesType } from '../utils';

export type VercelTool = Tool;

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

export interface ToolExecutionContext<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaDeps extends z.ZodSchema | undefined = undefined,
> extends IExecutionContext<TSchemaIn> {
  dependencies: DependenciesType<TSchemaDeps>;
  memory?: MastraMemory;
}

export interface ToolExecutionContext<TSchemaIn extends z.ZodSchema | undefined = undefined>
  extends IExecutionContext<TSchemaIn> {
  mastra?: MastraUnion;
}

export interface ToolAction<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TSchemaDeps extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn, TSchemaDeps> = ToolExecutionContext<TSchemaIn, TSchemaDeps>,
> extends IAction<string, TSchemaIn, TSchemaOut, TContext, ToolExecutionOptions> {
  description: string;
  dependenciesSchema?: TSchemaDeps;
  execute?: (
    context: TContext,
    options?: ToolExecutionOptions,
  ) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
  mastra?: Mastra;
}

/**
 * Any tool action is a tool action with any input, output, dependencies, context, and options.
 */
export type AnyToolAction = ToolAction<any, any, any, any>;

/**
 * A tool action with a defined dependencies schema, and any input, output, context, and options.
 */
export type ToolActionWithDeps<TSchemaDeps extends z.ZodSchema | undefined> = ToolAction<any, any, TSchemaDeps, any>;
