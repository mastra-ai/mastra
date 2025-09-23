import type { ToolExecutionOptions, Tool, Schema } from 'ai';
import type { ToolCallOptions, Tool as ToolV5 } from 'ai-v5';
import type { JSONSchema7Type } from 'json-schema';
import type { ZodSchema, z } from 'zod';

import type { IAction, IExecutionContext, MastraUnion } from '../action';
import type { TracingContext } from '../ai-tracing';
import type { Mastra } from '../mastra';
import type { RuntimeContext } from '../runtime-context';
import type { ToolStream } from './stream';

export type VercelTool = Tool;
export type VercelToolV5 = ToolV5;

export type ToolInvocationOptions = ToolExecutionOptions | ToolCallOptions;

// Define CoreTool as a discriminated union to match the AI SDK's Tool type
export type CoreTool = {
  id?: string;
  description?: string;
  parameters: ZodSchema | JSONSchema7Type | Schema;
  outputSchema?: ZodSchema | JSONSchema7Type | Schema;
  execute?: (params: any, options: ToolInvocationOptions) => Promise<any>;
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

// Duplicate of CoreTool but with parameters as Schema to make it easier to work with internally
export type InternalCoreTool = {
  id?: string;
  description?: string;
  parameters: Schema;
  outputSchema?: Schema;
  execute?: (params: any, options: ToolInvocationOptions) => Promise<any>;
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
  TSuspendSchema extends z.ZodSchema = any,
  TResumeSchema extends z.ZodSchema = any,
> extends IExecutionContext<TSchemaIn> {
  mastra?: MastraUnion;
  runtimeContext: RuntimeContext;
  writer?: ToolStream<any>;
  tracingContext?: TracingContext;
  suspend: (suspendPayload: z.infer<TSuspendSchema>) => Promise<any>;
  resumeData?: z.infer<TResumeSchema>;
}

export interface ToolAction<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TSuspendSchema extends z.ZodSchema = any,
  TResumeSchema extends z.ZodSchema = any,
  TContext extends ToolExecutionContext<TSchemaIn, TSuspendSchema, TResumeSchema> = ToolExecutionContext<
    TSchemaIn,
    TSuspendSchema,
    TResumeSchema
  >,
> extends IAction<string, TSchemaIn, TSchemaOut, TContext, ToolInvocationOptions> {
  suspendSchema?: TSuspendSchema;
  resumeSchema?: TResumeSchema;
  description: string;
  execute?: (
    context: TContext,
    options?: ToolInvocationOptions,
  ) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
  mastra?: Mastra;
  requireApproval?: boolean;
  onInputStart?: (options: ToolCallOptions) => void | PromiseLike<void>;
  onInputDelta?: (
    options: {
      inputTextDelta: string;
    } & ToolCallOptions,
  ) => void | PromiseLike<void>;
  onInputAvailable?: (
    options: {
      input: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : unknown;
    } & ToolCallOptions,
  ) => void | PromiseLike<void>;
}
