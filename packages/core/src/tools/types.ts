import type { JSONObject } from '@ai-sdk/provider';
import type { ToolCallOptions, Tool, Schema } from 'ai';
import type { JSONSchema7Type } from 'json-schema';
import type { z } from 'zod';
import type * as z3 from 'zod/v3';
import type * as z4 from 'zod/v4/core';

import type { IAction, IExecutionContext, MastraUnion } from '../action';
import type { Mastra } from '../mastra';
import type { RuntimeContext } from '../runtime-context';

export type VercelTool = Tool;

export type ToolParameters<T = JSONObject> = z4.$ZodType<T> | z3.Schema<T> | Schema<T> | JSONSchema7Type;

// Base properties that all CoreTool variants must have
type CoreToolBase<Parameters = ToolParameters> = {
  description?: string;
  inputSchema: Parameters;
  outputSchema?: JSONSchema7Type | Schema;
  execute?: (params: any, options: ToolCallOptions) => Promise<any>;
};

// Enhanced CoreTool as a proper discriminated union with common base properties
export type CoreTool<Parameters = ToolParameters> = CoreToolBase<Parameters> &
  // Regular function tool (Mastra format)
  (| {
        type?: 'function' | undefined;
        id?: string;
        __isMastraTool: true;
      }
    // Vercel AI SDK v5 Tool (pass-through with extracted properties)
    | {
        type: 'vercel-v5-tool';
        tool: Tool<any, any>;
      }
    // Provider-defined tool (for integrations)
    | {
        type: 'provider-defined';
        id: `${string}.${string}`;
        args: Record<string, unknown>;
      }
  );

// Legacy type aliases for backward compatibility
export type MastraCoreTool<Parameters = ToolParameters> = Extract<CoreTool<Parameters>, { type?: 'function' }>;
export type VercelV5Tool<Parameters = ToolParameters> = Extract<CoreTool<Parameters>, { type: 'vercel-v5-tool' }>;

// AI SDK v5 compatible tool types
export type ConvertedCoreTool = CoreTool<Exclude<ToolParameters, JSONSchema7Type>>;

export type ToolSet<Parameters = ToolParameters> = Record<
  string,
  CoreTool<Parameters> & Pick<CoreTool<Parameters>, 'execute'>
>;

// Enhanced ConvertedToolSet that supports both Mastra and Vercel v5 tools
export type ConvertedToolSet = Record<
  string,
  // Support both original Mastra tools and new Vercel v5 tools
  | (MastraCoreTool<Exclude<ToolParameters, JSONSchema7Type>> & Pick<MastraCoreTool, 'execute'>)
  | (Tool<any, any> & {
      // Ensure v5 streaming callbacks are supported
      execute?: (input: any, options?: ToolCallOptions) => Promise<any>;
      onInputStart?: (options: { toolCallId: string }) => void;
      onInputDelta?: (options: { inputTextDelta: string; toolCallId: string }) => void;
      onInputAvailable?: (options: { input: any; toolCallId: string }) => void;
    })
>;

// Duplicate of CoreTool but with parameters as Schema to make it easier to work with internally
export type InternalCoreTool = {
  id?: string;
  description?: string;
  inputSchema: Schema;
  outputSchema?: Schema;
  execute?: (params: any, options: ToolCallOptions) => Promise<any>;
} & {
  type?: 'function' | undefined;
  id?: string;
  __isMastraTool: true;
} & ( // TODO: probably this is wrong for v5
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
