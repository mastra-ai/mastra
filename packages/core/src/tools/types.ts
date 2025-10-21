import type {
  Tool,
  ToolV5,
  FlexibleSchema,
  ToolCallOptions,
  ToolExecutionOptions,
  Schema,
} from '@internal/external-types';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ElicitRequest, ElicitResult } from '@modelcontextprotocol/sdk/types.js';

import type { IAction, IExecutionContext, MastraUnion } from '../action';
import type { TracingContext } from '../ai-tracing';
import type { Mastra } from '../mastra';
import type { RuntimeContext } from '../runtime-context';
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

/**
 * The type of tool registered with the MCP server.
 * This is used to categorize tools in the MCP Server playground.
 * If not specified, it defaults to a regular tool.
 */
export type MCPToolType = 'agent' | 'workflow';

/**
 * MCP-specific tool invocation options that extend the base Mastra options.
 * These are passed to tools when they're executed in an MCP context.
 */
export type MCPToolInvocationOptions = MastraToolInvocationOptions & {
  /** MCP protocol context passed by the server */
  extra?: RequestHandlerExtra<any, any>;
  /** Elicitation handler for interactive user input during tool execution */
  elicitation?: {
    sendRequest: (request: ElicitRequest['params']) => Promise<ElicitResult>;
  };
};

// MCP-specific properties for tools
export interface MCPToolProperties {
  /**
   * The type of tool registered with the MCP server.
   * This is used to categorize tools in the MCP Server playground.
   * If not specified, it defaults to a regular tool.
   */
  toolType?: MCPToolType;
}

// Define CoreTool as a discriminated union to match the AI SDK's Tool type
export type CoreTool = {
  description?: string;
  parameters: FlexibleSchema<any> | Schema;
  outputSchema?: FlexibleSchema<any> | Schema;
  execute?: (params: any, options: MastraToolInvocationOptions) => Promise<any>;
  /**
   * Optional MCP-specific properties.
   * Only populated when the tool is being used in an MCP context.
   */
  mcp?: MCPToolProperties;
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
  /**
   * Optional MCP-specific properties.
   * Only populated when the tool is being used in an MCP context.
   */
  mcp?: MCPToolProperties;
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
  runtimeContext: RuntimeContext;
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
