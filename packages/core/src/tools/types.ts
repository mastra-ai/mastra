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

import type { MastraUnion } from '../action';
import type { Mastra } from '../mastra';
import type { TracingContext } from '../observability';
import type { RequestContext } from '../request-context';
import type { ZodLikeSchema, InferZodLikeSchema } from '../types/zod-compat';
import type { ToolStream } from './stream';
import type { ValidationError } from './validation';

export type VercelTool = Tool;
export type VercelToolV5 = ToolV5;

export type ToolInvocationOptions = ToolExecutionOptions | ToolCallOptions;

/**
 * MCP-specific context properties available during tool execution in MCP environments.
 */
// Agent tool execution context - properties specific when tools are executed by agents
export interface AgentToolExecutionContext<
  TSuspendSchema extends ZodLikeSchema = any,
  TResumeSchema extends ZodLikeSchema = any,
> {
  // Always present when called from agent context
  toolCallId: string;
  messages: any[];
  suspend: (suspendPayload: InferZodLikeSchema<TSuspendSchema>) => Promise<any>;

  // Optional - memory identifiers
  threadId?: string;
  resourceId?: string;

  // Optional - only present if tool was previously suspended
  resumeData?: InferZodLikeSchema<TResumeSchema>;

  // Optional - original WritableStream passed from AI SDK (without Mastra metadata wrapping)
  writableStream?: WritableStream<any>;
}

// Workflow tool execution context - properties specific when tools are executed in workflows
export interface WorkflowToolExecutionContext<
  TSuspendSchema extends ZodLikeSchema = any,
  TResumeSchema extends ZodLikeSchema = any,
> {
  // Always present when called from workflow context
  runId: string;
  workflowId: string;
  state: any;
  setState: (state: any) => void;
  suspend: (suspendPayload: InferZodLikeSchema<TSuspendSchema>) => Promise<any>;

  // Optional - only present if workflow step was previously suspended
  resumeData?: InferZodLikeSchema<TResumeSchema>;
}

// MCP tool execution context - properties specific when tools are executed via Model Context Protocol
export interface MCPToolExecutionContext {
  /** MCP protocol context passed by the server */
  extra: RequestHandlerExtra<any, any>;
  /** Elicitation handler for interactive user input during tool execution */
  elicitation: {
    sendRequest: (request: ElicitRequest['params']) => Promise<ElicitResult>;
  };
}

/**
 * Extended version of ToolInvocationOptions that includes Mastra-specific properties
 * for suspend/resume functionality, stream writing, and tracing context.
 *
 * This is used by CoreTool/InternalCoreTool for AI SDK compatibility (AI SDK expects this signature).
 * Mastra v1.0 tools (ToolAction) use ToolExecutionContext instead.
 *
 * CoreToolBuilder acts as the adapter layer:
 * - Receives: AI SDK calls with MastraToolInvocationOptions
 * - Converts to: ToolExecutionContext for Mastra tool execution
 * - Returns: Results back to AI SDK
 */
export type MastraToolInvocationOptions = ToolInvocationOptions & {
  suspend?: (suspendPayload: any) => Promise<any>;
  resumeData?: any;
  writableStream?: WritableStream<any> | ToolStream<any>;
  tracingContext?: TracingContext;
  /**
   * Optional MCP-specific context passed when tool is executed in MCP server.
   * This is populated by the MCP server and passed through to the tool's execution context.
   */
  mcp?: MCPToolExecutionContext;
};

/**
 * The type of tool registered with the MCP server.
 * This is used to categorize tools in the MCP Server playground.
 * If not specified, it defaults to a regular tool.
 */
export type MCPToolType = 'agent' | 'workflow';

// MCP-specific properties for tools
export interface MCPToolProperties {
  /**
   * The type of tool registered with the MCP server.
   * This is used to categorize tools in the MCP Server playground.
   * If not specified, it defaults to a regular tool.
   */
  toolType?: MCPToolType;
}

/**
 * CoreTool is the AI SDK-compatible tool format used when passing tools to the AI SDK.
 * This matches the AI SDK's Tool interface.
 *
 * CoreToolBuilder converts Mastra tools (ToolAction) to this format and handles the
 * signature transformation from Mastra's (inputData, context) to AI SDK format (params, options).
 *
 * Key differences from ToolAction:
 * - Uses 'parameters' instead of 'inputSchema' (AI SDK naming)
 * - Execute signature: (params, options: MastraToolInvocationOptions) (AI SDK format)
 * - Supports FlexibleSchema | Schema for broader AI SDK compatibility
 */
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

/**
 * InternalCoreTool is identical to CoreTool but with stricter typing.
 * Used internally where we know the schema has already been converted to AI SDK Schema format.
 *
 * The only difference: parameters must be Schema (not FlexibleSchema | Schema)
 */
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

// Unified tool execution context that works for all scenarios
export interface ToolExecutionContext<
  TSuspendSchema extends ZodLikeSchema = any,
  TResumeSchema extends ZodLikeSchema = any,
> {
  // ============ Common properties (available in all contexts) ============
  mastra?: MastraUnion;
  requestContext?: RequestContext;
  tracingContext?: TracingContext;
  abortSignal?: AbortSignal;

  // Writer is created by Mastra for ALL contexts (agent, workflow, direct execution)
  // Wraps chunks with metadata (toolCallId, toolName, runId) before passing to underlying stream
  writer?: ToolStream<any>;

  // ============ Context-specific nested properties ============

  // Agent-specific properties
  agent?: AgentToolExecutionContext<TSuspendSchema, TResumeSchema>;

  // Workflow-specific properties
  workflow?: WorkflowToolExecutionContext<TSuspendSchema, TResumeSchema>;

  // MCP (Model Context Protocol) specific context
  mcp?: MCPToolExecutionContext;
}

export interface ToolAction<
  TSchemaIn extends ZodLikeSchema | undefined = undefined,
  TSchemaOut extends ZodLikeSchema | undefined = undefined,
  TSuspendSchema extends ZodLikeSchema = any,
  TResumeSchema extends ZodLikeSchema = any,
  TContext extends ToolExecutionContext<TSuspendSchema, TResumeSchema> = ToolExecutionContext<
    TSuspendSchema,
    TResumeSchema
  >,
> {
  id: string;
  description: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  suspendSchema?: TSuspendSchema;
  resumeSchema?: TResumeSchema;
  // Execute signature with unified context type
  // First parameter: raw input data (validated against inputSchema)
  // Second parameter: unified execution context with all metadata
  // Returns: The expected output OR a validation error if input validation fails
  // Note: When no outputSchema is provided, returns any to allow property access
  execute?: (
    inputData: TSchemaIn extends ZodLikeSchema ? InferZodLikeSchema<TSchemaIn> : unknown,
    context?: TContext,
  ) => Promise<(TSchemaOut extends ZodLikeSchema ? InferZodLikeSchema<TSchemaOut> : any) | ValidationError>;
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
