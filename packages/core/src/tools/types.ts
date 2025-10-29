import type {
  Tool,
  ToolV5,
  FlexibleSchema,
  ToolCallOptions,
  ToolExecutionOptions,
  Schema,
} from '@internal/external-types';

import type { IAction, IExecutionContext, MastraUnion } from '../action';
import type { TracingContext } from '../ai-tracing';
import type { Mastra } from '../mastra';
import type { RequestContext } from '../runtime-context';
import type { ZodLikeSchema, InferZodLikeSchema } from '../types/zod-compat';
import type { ToolStream } from './stream';

export type VercelTool = Tool;
export type VercelToolV5 = ToolV5;

export type ToolInvocationOptions = ToolExecutionOptions | ToolCallOptions;

/**
 * Extended version of ToolInvocationOptions that includes Mastra-specific properties
 * for suspend/resume functionality, stream writing, and tracing context.
 */
export type MastraToolInvocationOptions = ToolInvocationOptions & {
  suspend?: (suspendPayload: any) => Promise<any>;
  resumeData?: any;
  writableStream?: WritableStream<any> | ToolStream<any>;
  tracingContext?: TracingContext;
};

// Define CoreTool as a discriminated union to match the AI SDK's Tool type
export type CoreTool = {
  description?: string;
  parameters: FlexibleSchema<any> | Schema;
  outputSchema?: FlexibleSchema<any> | Schema;
  execute?: (params: any, options: MastraToolInvocationOptions) => Promise<any>;
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
  description?: string;
  parameters: Schema;
  outputSchema?: Schema;
  execute?: (params: any, options: MastraToolInvocationOptions) => Promise<any>;
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
  TSchemaIn extends ZodLikeSchema | undefined = undefined,
  TSuspendSchema extends ZodLikeSchema = any,
  TResumeSchema extends ZodLikeSchema = any,
> extends IExecutionContext<TSchemaIn> {
  mastra?: MastraUnion;
  requestContext: RequestContext;
  writer?: ToolStream<any>;
  tracingContext?: TracingContext;
  suspend?: (suspendPayload: InferZodLikeSchema<TSuspendSchema>) => Promise<any>;
  resumeData?: InferZodLikeSchema<TResumeSchema>;
}

export interface ToolAction<
  TSchemaIn extends ZodLikeSchema | undefined = undefined,
  TSchemaOut extends ZodLikeSchema | undefined = undefined,
  TSuspendSchema extends ZodLikeSchema = any,
  TResumeSchema extends ZodLikeSchema = any,
  TContext extends ToolExecutionContext<TSchemaIn, TSuspendSchema, TResumeSchema> = ToolExecutionContext<
    TSchemaIn,
    TSuspendSchema,
    TResumeSchema
  >,
> extends IAction<string, TSchemaIn, TSchemaOut, TContext, MastraToolInvocationOptions> {
  suspendSchema?: TSuspendSchema;
  resumeSchema?: TResumeSchema;
  description: string;
  execute?: (
    context: TContext,
    options?: MastraToolInvocationOptions,
  ) => Promise<TSchemaOut extends ZodLikeSchema ? InferZodLikeSchema<TSchemaOut> : unknown>;
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
      input: InferZodLikeSchema<TSchemaIn>;
    } & ToolCallOptions,
  ) => void | PromiseLike<void>;
}
