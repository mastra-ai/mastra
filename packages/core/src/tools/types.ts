import type { JSONObject } from '@ai-sdk/provider';
import type { ToolCallOptions, Tool, Schema } from 'ai';
import type { JSONSchema7Type } from 'json-schema';
import type { z } from 'zod';
// import type { ZodSchema, z } from 'zod';
import type * as z3 from 'zod/v3';
import type * as z4 from 'zod/v4/core';

import type { IAction, IExecutionContext, MastraUnion } from '../action';
import type { Mastra } from '../mastra';
import type { RuntimeContext } from '../runtime-context';

export type VercelTool = Tool;

export type ToolParameters<T = JSONObject> = z4.$ZodType<T> | z3.Schema<T> | Schema<T> | JSONSchema7Type;

// Define CoreTool as a discriminated union to match the AI SDK's Tool type
export type CoreTool<Parameters = ToolParameters> =
  | ({
      id?: string;
      description?: string;
      parameters: Parameters;
      execute?: (params: any, options: ToolCallOptions) => Promise<any>;
      // TODO: do we need this?
      // experimental_toToolResultContent?: (result: any) => any;
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
    ))
  | Tool<any, any>;

// TODO: Seems AI SDK v5 tools type doesn't allow JSON schema?
export type ConvertedCoreTool = CoreTool<Exclude<ToolParameters, JSONSchema7Type>>;

export type ToolSet<Parameters = ToolParameters> = Record<
  string,
  CoreTool<Parameters> & Pick<CoreTool<Parameters>, 'execute'>
>;
export type ConvertedToolSet = ToolSet<Exclude<ToolParameters, JSONSchema7Type>>;

// Duplicate of CoreTool but with parameters as Schema to make it easier to work with internally
export type InternalCoreTool = {
  id?: string;
  description?: string;
  parameters: Schema;
  execute?: (params: any, options: ToolCallOptions) => Promise<any>;
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
  runtimeContext: RuntimeContext;
}

export interface ToolAction<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<TSchemaIn>,
> extends IAction<string, TSchemaIn, TSchemaOut, TContext, ToolCallOptions> {
  description: string;
  execute?: (
    context: TContext,
    options?: ToolCallOptions,
  ) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
  mastra?: Mastra;
}
