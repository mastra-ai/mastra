import type { Tool, ToolExecutionOptions } from 'ai';
import type { ZodSchema, z } from 'zod';

import type { IAction, IExecutionContext, MastraUnion } from '../action';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory';
import type { InferZodType, VariablesType } from '../utils';

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
  TSchemaVariables extends z.ZodSchema | undefined = undefined,
> extends IExecutionContext<TSchemaIn> {
  variables: VariablesType<TSchemaVariables>;
  memory?: MastraMemory;
  mastra?: MastraUnion;
}

export interface ToolAction<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TSchemaVariables extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn, TSchemaVariables> = ToolExecutionContext<
    TSchemaIn,
    TSchemaVariables
  >,
  TExtraArgs extends unknown[] = [options: ToolExecutionOptions],
> extends IAction<string, TSchemaIn, TSchemaOut, TContext, TExtraArgs> {
  description: string;
  variablesSchema?: TSchemaVariables;
  execute?: (context: TContext, ...extraArgs: TExtraArgs) => Promise<InferZodType<TSchemaOut, unknown>>;
  mastra?: Mastra;
}

/**
 * Any tool action is a tool action with any input, output, variables, context, and options.
 */
export type AnyToolAction = ToolAction<any, any, any, any>;

/**
 * A tool action with a defined variables schema, and any input, output, context, and options.
 */
export type ToolActionWithVars<TSchemaVariables extends z.ZodSchema | undefined> = ToolAction<
  any,
  any,
  TSchemaVariables,
  any
>;
