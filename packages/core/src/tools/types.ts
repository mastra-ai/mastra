import type { WritableStream } from 'node:stream/web';
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

import type { MastraPrimitives, MastraUnion } from '../action';
export type { MastraPrimitives, MastraUnion };
import type { ToolBackgroundConfig } from '../background-tasks';
import type { MastraBrowser } from '../browser/browser';
import type { Mastra } from '../mastra';
import type { ObservabilityContext } from '../observability';
import type { RequestContext } from '../request-context';
import type { PublicSchema } from '../schema';
import type { SuspendOptions, OutputWriter } from '../workflows';
import type { Workspace } from '../workspace/workspace';
import type { ToolStream } from './stream';
import type { ValidationError } from './validation';

export type VercelTool = Tool;
export type VercelToolV5 = ToolV5;

export type ToolInvocationOptions = ToolExecutionOptions | ToolCallOptions;

/**
 * MCP-specific context properties available during tool execution in MCP environments.
 */
// Agent tool execution context - properties specific when tools are executed by agents
export interface AgentToolExecutionContext<TSuspend, TResume> {
  // Always present when called from agent context
  agentId: string;
  toolCallId: string;
  messages: any[];
  suspend: (suspendPayload: TSuspend, suspendOptions?: SuspendOptions) => Promise<void>;

  // Optional - memory identifiers
  threadId?: string;
  resourceId?: string;

  // Optional - only present if tool was previously suspended
  resumeData?: TResume;

  // Optional - original WritableStream passed from AI SDK (without Mastra metadata wrapping)
  writableStream?: WritableStream<any>;

  /**
   * Flushes the parent stream's pending messages to persistent storage.
   * See `MastraToolInvocationOptions.flushMessages` for details.
   */
  flushMessages?: () => Promise<void>;
}

// Workflow tool execution context - properties specific when tools are executed in workflows
export interface WorkflowToolExecutionContext<TSuspend, TResume> {
  // Always present when called from workflow context
  runId: string;
  workflowId: string;
  state: any;
  setState: (state: any) => void;
  suspend: (suspendPayload: TSuspend, suspendOptions?: SuspendOptions) => Promise<void>;
  // Optional - only present if workflow step was previously suspended
  resumeData?: TResume;
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
export type MastraToolInvocationOptions = ToolInvocationOptions &
  Partial<ObservabilityContext> & {
    suspend?: (suspendPayload: any, suspendOptions?: SuspendOptions) => Promise<any>;
    resumeData?: any;
    outputWriter?: OutputWriter;
    /**
     * Optional MCP-specific context passed when tool is executed in MCP server.
     * This is populated by the MCP server and passed through to the tool's execution context.
     */
    mcp?: MCPToolExecutionContext;
    /**
     * Workspace for tool execution. When provided at execution time, this overrides
     * any workspace configured at tool build time. Allows dynamic workspace selection
     * per-step via prepareStep.
     */
    workspace?: Workspace;
    /**
     * Request context for tool execution. When provided at execution time, this overrides
     * any requestContext configured at tool build time. Allows workflow steps to forward
     * their requestContext (e.g., authenticated API clients, feature flags) to tools.
     */
    requestContext?: RequestContext;
    /**
     * Flushes the parent stream's pending messages to persistent storage.
     *
     * The agent stream batches message saves through a `SaveQueueManager`
     * (100ms debounce). Tools that read the thread's persisted history
     * mid-stream (e.g. cloning the thread, exporting it, handing off to a
     * sibling agent) must call this first, otherwise the store will be
     * missing the latest user / assistant messages.
     *
     * Populated automatically by the agent tool-call step. No-op when the
     * stream is not memory-backed.
     */
    flushMessages?: () => Promise<void>;
  };

/**
 * The type of tool registered with the MCP server.
 * This is used to categorize tools in the MCP Server playground.
 * If not specified, it defaults to a regular tool.
 */
export type MCPToolType = 'agent' | 'workflow';

/**
 * Metadata identifying a tool as originating from an MCP server.
 * Set automatically by the MCP client when creating tools.
 * Used by CoreToolBuilder to create MCP_TOOL_CALL spans instead of TOOL_CALL spans.
 */
export interface McpMetadata {
  serverName: string;
  serverVersion?: string;
}

/**
 * MCP Tool Annotations for describing tool behavior and UI presentation.
 * These annotations are part of the MCP protocol and are used by clients
 * like OpenAI Apps SDK to control tool card display and permission hints.
 *
 * @see https://spec.modelcontextprotocol.io/specification/2025-03-26/server/tools/#tool-annotations
 */
export interface ToolAnnotations {
  /**
   * A human-readable title for the tool.
   * Used for display purposes in UI components.
   */
  title?: string;
  /**
   * If true, the tool does not modify its environment.
   * This hint indicates the tool only reads data and has no side effects.
   * @default false
   */
  readOnlyHint?: boolean;
  /**
   * If true, the tool may perform destructive updates to its environment.
   * If false, the tool performs only additive updates.
   * This hint helps clients determine if confirmation should be required.
   * @default true
   */
  destructiveHint?: boolean;
  /**
   * If true, calling the tool repeatedly with the same arguments
   * will have no additional effect on its environment.
   * This hint indicates idempotent behavior.
   * @default false
   */
  idempotentHint?: boolean;
  /**
   * If true, this tool may interact with an "open world" of external
   * entities (e.g., web search, external APIs).
   * If false, the tool's domain is closed and fully defined.
   * @default true
   */
  openWorldHint?: boolean;
}

// MCP-specific properties for tools
export interface MCPToolProperties {
  /**
   * The type of tool registered with the MCP server.
   * This is used to categorize tools in the MCP Server playground.
   * If not specified, it defaults to a regular tool.
   */
  toolType?: MCPToolType;
  /**
   * MCP tool annotations for describing tool behavior and UI presentation.
   * These are exposed via MCP protocol and used by clients like OpenAI Apps SDK.
   * @see https://spec.modelcontextprotocol.io/specification/2025-03-26/server/tools/#tool-annotations
   */
  annotations?: ToolAnnotations;
  /**
   * Arbitrary metadata that will be passed through to MCP clients.
   * This field allows custom metadata to be attached to tools for
   * client-specific functionality.
   */
  _meta?: Record<string, unknown>;
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
   * Enables strict tool input generation for providers that support it.
   */
  strict?: boolean;
  /**
   * Provider-specific options passed to the model when this tool is used.
   */
  providerOptions?: Record<string, Record<string, unknown>>;
  /**
   * Optional MCP-specific properties.
   * Only populated when the tool is being used in an MCP context.
   */
  mcp?: MCPToolProperties;
  /**
   * Optional function to transform tool output before returning to the model.
   * Receives the raw tool output and returns a transformed representation.
   * Passed through from the original tool definition.
   */
  toModelOutput?: (output: unknown) => unknown;
  /**
   * Examples of valid tool inputs. Each example contains an `input` object
   * showing what valid arguments look like.
   * Passed through to the AI SDK which forwards them to model providers
   * that support input examples (e.g., Anthropic's `input_examples` beta feature).
   */
  inputExamples?: Array<{ input: Record<string, unknown> }>;
  onInputStart?: (options: ToolCallOptions) => void | PromiseLike<void>;
  onInputDelta?: (options: { inputTextDelta: string } & ToolCallOptions) => void | PromiseLike<void>;
  onInputAvailable?: (options: { input: any } & ToolCallOptions) => void | PromiseLike<void>;
  onOutput?: (
    options: { output: any; toolName: string } & Omit<ToolCallOptions, 'messages'>,
  ) => void | PromiseLike<void>;
  /** Background task configuration for this tool. */
  background?: ToolBackgroundConfig;
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
   * Enables strict tool input generation for providers that support it.
   */
  strict?: boolean;
  /**
   * Provider-specific options passed to the model when this tool is used.
   */
  providerOptions?: Record<string, Record<string, unknown>>;
  /**
   * Optional MCP-specific properties.
   * Only populated when the tool is being used in an MCP context.
   */
  mcp?: MCPToolProperties;
  /**
   * Optional function to transform tool output before returning to the model.
   * Receives the raw tool output and returns a transformed representation.
   * Passed through from the original tool definition.
   */
  toModelOutput?: (output: unknown) => unknown;
  /**
   * Examples of valid tool inputs. Each example contains an `input` object
   * showing what valid arguments look like.
   * Passed through to the AI SDK which forwards them to model providers
   * that support input examples (e.g., Anthropic's `input_examples` beta feature).
   */
  inputExamples?: Array<{ input: Record<string, unknown> }>;
  onInputStart?: (options: ToolCallOptions) => void | PromiseLike<void>;
  onInputDelta?: (options: { inputTextDelta: string } & ToolCallOptions) => void | PromiseLike<void>;
  onInputAvailable?: (options: { input: any } & ToolCallOptions) => void | PromiseLike<void>;
  onOutput?: (
    options: { output: any; toolName: string } & Omit<ToolCallOptions, 'messages'>,
  ) => void | PromiseLike<void>;
  /** Background task configuration for this tool. */
  background?: ToolBackgroundConfig;
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
  TSuspend = unknown,
  TResume = unknown,
  TRequestContext extends Record<string, any> | unknown = unknown,
> extends Partial<ObservabilityContext> {
  // ============ Common properties (available in all contexts) ============
  mastra?: MastraUnion;
  requestContext?: RequestContext<TRequestContext>;
  abortSignal?: AbortSignal;

  /**
   * Workspace available for tool execution. When provided, tools can access:
   * - workspace.filesystem - for file operations (read, write, list, etc.)
   * - workspace.sandbox - for command execution
   *
   * This allows tools to work with the agent's configured workspace.
   */
  workspace?: Workspace;

  /**
   * Browser available for tool execution. When provided, tools can access
   * browser capabilities for web automation, screenshots, and data extraction.
   *
   * The browser is lazily initialized - it will be launched on first use.
   */
  browser?: MastraBrowser;

  // Writer is created by Mastra for ALL contexts (agent, workflow, direct execution)
  // Wraps chunks with metadata (toolCallId, toolName, runId) before passing to underlying stream
  writer?: ToolStream;

  // ============ Context-specific nested properties ============

  // Agent-specific properties
  agent?: AgentToolExecutionContext<TSuspend, TResume>;

  // Workflow-specific properties
  workflow?: WorkflowToolExecutionContext<TSuspend, TResume>;

  // MCP (Model Context Protocol) specific context
  mcp?: MCPToolExecutionContext;
}

export interface ToolAction<
  TSchemaIn,
  TSchemaOut,
  TSuspend = unknown,
  TResume = unknown,
  TContext extends ToolExecutionContext<TSuspend, TResume, any> = ToolExecutionContext<TSuspend, TResume>,
  TId extends string = string,
  TRequestContext extends Record<string, any> | unknown = unknown,
> {
  id: TId;
  description: string;
  inputSchema?: PublicSchema<TSchemaIn>;
  outputSchema?: PublicSchema<TSchemaOut>;
  suspendSchema?: PublicSchema<TSuspend>;
  resumeSchema?: PublicSchema<TResume>;
  /**
   * Optional schema for validating request context values.
   * When provided, the request context will be validated against this schema before tool execution.
   * If validation fails, a validation error is returned instead of executing the tool.
   */
  requestContextSchema?: PublicSchema<TRequestContext>;
  /**
   * Optional MCP-specific properties.
   * Only populated when the tool is being used in an MCP context.
   */
  mcp?: MCPToolProperties;
  /**
   * Optional function to transform tool output before returning to the model.
   * Receives the raw tool output and returns a transformed representation.
   * Passed through from the original tool definition.
   */
  toModelOutput?: (output: TSchemaOut) => unknown;
  // Execute signature with unified context type
  // First parameter: raw input data (validated against inputSchema)
  // Second parameter: unified execution context with all metadata
  // Returns: The expected output OR a validation error if input validation fails
  // Note: When no outputSchema is provided, returns any to allow property access
  // Note: For outputSchema, we use the input type because Zod transforms are applied during validation
  // Note: { error?: never } enables inline type narrowing with 'error' in result checks
  execute?: (inputData: TSchemaIn, context: TContext) => Promise<TSchemaOut | ValidationError>;
  mastra?: Mastra;
  /**
   * Whether the tool requires explicit user approval before execution.
   * Pass `true` to always require approval, or a function evaluated per-call
   * with the tool input (and optional request context/workspace) to require
   * approval conditionally.
   */
  requireApproval?:
    | boolean
    | ((
        input: TSchemaIn,
        ctx?: { requestContext?: Record<string, unknown>; workspace?: Workspace },
      ) => boolean | Promise<boolean>);
  /**
   * Enables strict tool input generation for providers that support it.
   * When enabled, supported providers will attempt to generate arguments
   * that exactly match the tool schema.
   */
  strict?: boolean;
  /**
   * Provider-specific options passed to the model when this tool is used.
   * Keys are provider names (e.g., 'anthropic', 'openai'), values are provider-specific configs.
   * @example
   * ```typescript
   * providerOptions: {
   *   anthropic: {
   *     cacheControl: { type: 'ephemeral' }
   *   }
   * }
   * ```
   */
  providerOptions?: Record<string, Record<string, unknown>>;
  /**
   * Metadata identifying this tool as originating from an MCP server.
   * Set automatically by the MCP client when creating tools.
   * Used by CoreToolBuilder to create MCP_TOOL_CALL spans instead of TOOL_CALL spans.
   */
  mcpMetadata?: McpMetadata;
  /**
   * Examples of valid tool inputs. Each example contains an `input` object
   * showing what valid arguments look like.
   * Passed through to the AI SDK which forwards them to model providers
   * that support input examples (e.g., Anthropic's `input_examples` beta feature).
   */
  inputExamples?: Array<{ input: Record<string, unknown> }>;
  onInputStart?: (options: ToolCallOptions) => void | PromiseLike<void>;
  onInputDelta?: (
    options: {
      inputTextDelta: string;
    } & ToolCallOptions,
  ) => void | PromiseLike<void>;
  onInputAvailable?: (
    options: {
      input: TSchemaIn;
    } & ToolCallOptions,
  ) => void | PromiseLike<void>;
  onOutput?: (
    options: {
      output: TSchemaOut;
      toolName: string;
    } & Omit<ToolCallOptions, 'messages'>,
  ) => void | PromiseLike<void>;
  /**
   * Background task configuration for this tool.
   * When enabled, the tool can be executed in the background while the agent conversation continues.
   */
  background?: ToolBackgroundConfig;
}
