import type { WritableStream } from 'node:stream/web';
import type {
  Tool,
  ToolV5,
  FlexibleSchema,
  ToolCallOptions,
  ToolExecutionOptions,
  Schema,
} from '@internal/external-types';
import type { ElicitRequest, ElicitResult, ServerContext } from '@modelcontextprotocol/server';
import type { MastraPrimitives, MastraUnion } from '../action';
export type { MastraPrimitives, MastraUnion };
import type { ActorSignal } from '../auth/ee';
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
 * Context passed to a global `requireToolApproval` function, evaluated per tool call.
 */
export type ToolApprovalContext = {
  /** Name of the tool being called. */
  toolName: string;
  /** Arguments the model is passing to the tool. */
  args: Record<string, unknown>;
  /** Plain object view of the request context, when available. */
  requestContext?: Record<string, unknown>;
  /** Active workspace, when the run is bound to one. */
  workspace?: Workspace;
};

/**
 * Function form of the global `requireToolApproval` option. Evaluated per tool call;
 * return `true` to require approval for that call, `false` to allow it. Enables
 * conditional, per-call approval policies (e.g. regex matching on `toolName`).
 */
export type RequireToolApprovalFn = (ctx: ToolApprovalContext) => boolean | Promise<boolean>;

/**
 * Global tool approval setting. `true` requires approval for every tool call,
 * `false`/omitted requires none, and a function decides per call.
 */
export type RequireToolApproval = boolean | RequireToolApprovalFn;

/**
 * Context passed to a per-tool `needsApprovalFn` alongside the parsed tool input.
 * This is the same context surfaced to a tool-level `requireApproval` function.
 */
export type NeedsApprovalContext = {
  /** Plain object view of the request context, when available. */
  requestContext?: Record<string, unknown>;
  /** Active workspace, when the run is bound to one. */
  workspace?: Workspace;
};

/**
 * Per-tool approval predicate attached to a tool instance.
 *
 * This is the runtime-resolved form of a tool's `requireApproval` function (or of an
 * MCP server-level `requireToolApproval` function wrapped by the MCP client). It is
 * evaluated per tool call with the parsed input and the available context; return
 * `true` to require approval for that call, `false` to allow it.
 *
 * It is attached to the tool instance by {@link CoreToolBuilder} / the MCP client and
 * read by the agent runtime. Prefer the public `requireApproval` option on
 * `createTool` over setting this directly.
 */
export type NeedsApprovalFn = (input: any, ctx?: NeedsApprovalContext) => boolean | Promise<boolean>;

export interface ToolHookContext<
  TInput = unknown,
  TContext = unknown,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  /** The name exposed to the model for this tool call. */
  toolName: string;
  /** Input passed to the tool. */
  input: TInput;
  /** Execution context passed to the tool. */
  context: TContext;
  /** Optional adapter-specific metadata. */
  metadata?: TMetadata;
}

export interface ToolBeforeHookResult<TOutput = unknown> {
  /** Set to false to skip the tool execution and return `output` instead. */
  proceed: false;
  output: TOutput;
}

export interface ToolAfterHookContext<
  TInput = unknown,
  TOutput = unknown,
  TContext = unknown,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> extends ToolHookContext<TInput, TContext, TMetadata> {
  /** Tool output when execution completed. Undefined when execution failed before producing output. */
  output?: TOutput;
  /** Error thrown by the tool, if execution failed. */
  error?: unknown;
}

export interface ToolHooks<
  TInput = unknown,
  TOutput = unknown,
  TContext = unknown,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  beforeToolCall?: (
    context: ToolHookContext<TInput, TContext, TMetadata>,
  ) => void | ToolBeforeHookResult<TOutput> | Promise<void | ToolBeforeHookResult<TOutput>>;
  afterToolCall?: (context: ToolAfterHookContext<TInput, TOutput, TContext, TMetadata>) => void | Promise<void>;
}

export type ToolPayloadTransformTarget = 'display' | 'transcript';

export type ToolPayloadTransformPhase =
  | 'input-delta'
  | 'input-available'
  | 'output-available'
  | 'error'
  | 'approval'
  | 'suspend'
  | 'resume';

export type ToolPayloadTransformContext<TInput = unknown, TOutput = unknown, TError = unknown> = {
  target: ToolPayloadTransformTarget;
  phase: ToolPayloadTransformPhase;
  toolName: string;
  toolCallId: string;
  input?: TInput;
  inputTextDelta?: string;
  output?: TOutput;
  error?: TError;
  suspendPayload?: unknown;
  resumeData?: unknown;
  providerMetadata?: Record<string, unknown>;
  context?: Record<string, unknown>;
};

export type ToolPayloadTransformResult = unknown;

export type ToolPayloadTransformFunction<TInput = unknown, TOutput = unknown, TError = unknown> = (
  context: ToolPayloadTransformContext<TInput, TOutput, TError>,
) => ToolPayloadTransformResult | Promise<ToolPayloadTransformResult>;

export type ToolPayloadTransformTargetConfig<TInput = unknown, TOutput = unknown, TError = unknown> = {
  input?: ToolPayloadTransformFunction<TInput, TOutput, TError>;
  inputDelta?: ToolPayloadTransformFunction<TInput, TOutput, TError>;
  output?: ToolPayloadTransformFunction<TInput, TOutput, TError>;
  error?: ToolPayloadTransformFunction<TInput, TOutput, TError>;
  approval?: ToolPayloadTransformFunction<TInput, TOutput, TError>;
  suspend?: ToolPayloadTransformFunction<TInput, TOutput, TError>;
  resume?: ToolPayloadTransformFunction<TInput, TOutput, TError>;
};

export type ToolPayloadTransform<TInput = unknown, TOutput = unknown, TError = unknown> = Partial<
  Record<ToolPayloadTransformTarget, ToolPayloadTransformTargetConfig<TInput, TOutput, TError>>
>;

export type ToolPayloadTransformPolicy = {
  transformToolPayload?: ToolPayloadTransformFunction;
  targets?: ToolPayloadTransformTarget[];
};

/**
 * Observability helpers available on the tool execution context.
 * Wraps child span creation and structured log emission in a
 * null-safe API that callers never need to check — when no tracing
 * context is active, `span` runs the function directly and `log` is
 * a no-op.
 */
export interface ToolObserve {
  span<T>(name: string, fn: () => Promise<T> | T, attributes?: Record<string, unknown>): Promise<T>;
  log(level: 'debug' | 'info' | 'warn' | 'error' | 'fatal', message: string, data?: Record<string, unknown>): void;
}

/**
 * A no-op ToolObserve implementation. `span` runs the function
 * directly; `log` does nothing. Used as the default when no
 * collector/tracing context is active, so user code never needs to
 * null-check `observe`.
 */
export const noopObserve: ToolObserve = {
  async span<T>(_name: string, fn: () => Promise<T> | T): Promise<T> {
    return fn();
  },
  log(): void {},
};

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

/** Log levels for MCP `notifications/message`, ordered per RFC 5424. */
export type MCPLoggingLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

export type MCPServerContext = ServerContext & {
  signal: ServerContext['mcpReq']['signal'];
  requestId: ServerContext['mcpReq']['id'];
  authInfo?: NonNullable<ServerContext['http']>['authInfo'];
  sendNotification: ServerContext['mcpReq']['notify'];
  sendRequest: ServerContext['mcpReq']['send'];
  _meta?: ServerContext['mcpReq']['_meta'];
};

// MCP tool execution context - properties specific when tools are executed via Model Context Protocol
export interface MCPToolExecutionContext {
  /** MCP protocol context passed by the server */
  extra: MCPServerContext;
  /** Elicitation handler for interactive user input during tool execution */
  elicitation: {
    sendRequest: (request: ElicitRequest['params']) => Promise<ElicitResult>;
  };
  /**
   * Sends a `notifications/message` log notification to the calling client.
   * Messages below the client's minimum level (set via `logging/setLevel`) are dropped.
   */
  log?: (level: MCPLoggingLevel, message: string, data?: Record<string, unknown>) => Promise<void>;
  /**
   * Sends a `notifications/progress` notification to the calling client.
   * No-op if the caller did not request progress tracking (no progressToken in `_meta`).
   */
  progress?: (params: { progress: number; total?: number; message?: string }) => Promise<void>;
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
    /** Trusted server-side signal for this tool FGA check. */
    actor?: ActorSignal;
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
    /** Observability helper to expose on the final tool execution context. */
    observe?: ToolObserve;
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
  /** Instructions advertised by the MCP server during initialize. */
  serverInstructions?: string;
  /** Whether the agent should append these instructions to its system prompt. Defaults to false (opt-in). */
  forwardInstructions?: boolean;
  /** Maximum number of characters to forward into the agent system prompt. */
  instructionsMaxLength?: number;
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
  transform?: ToolPayloadTransform;
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
  transform?: ToolPayloadTransform;
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
  /** Trusted server-side signal forwarded for nested FGA checks. */
  actor?: ActorSignal;

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

  /**
   * Observability helpers for recording child spans and structured logs
   * from inside a tool's execute function. Always provided — when no
   * tracing context is active, `span` runs the function directly and
   * `log` is a no-op. No null-checking needed.
   *
   * ```ts
   * execute: async ({ userId }, { observe }) => {
   *   observe.log('info', 'fetching user', { userId })
   *   return observe.span('fetch user', () => fetch(`/api/users/${userId}`))
   * }
   * ```
   */
  observe: ToolObserve;
}

/**
 * Context received by a tool's `execute` callback. The runtime always provides
 * `requestContext` (an empty one is created if the caller passed none), so it
 * is non-optional here — like `observe`. No null-checking needed.
 */
export type ToolExecuteContext<TContext, TRequestContext extends Record<string, any> | unknown = unknown> = Omit<
  TContext,
  'requestContext'
> & {
  requestContext: RequestContext<TRequestContext>;
};

/** The `execute` callback signature used by `createTool` and `new Tool(...)`. */
export type ToolExecuteFunction<
  TSchemaIn,
  TSchemaOut,
  TContext,
  TRequestContext extends Record<string, any> | unknown = unknown,
> = (
  inputData: TSchemaIn,
  context: ToolExecuteContext<TContext, TRequestContext>,
) => Promise<TSchemaOut | ValidationError | void>;

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
  /**
   * Optional target-aware transform for tool payloads that leave runtime.
   *
   * Runtime execution still receives raw inputs and outputs. These transforms
   * are used by display and transcript serializers to avoid exposing internal
   * payload fields.
   */
  transform?: ToolPayloadTransform<TSchemaIn, TSchemaOut>;
  // Execute signature with unified context type
  // First parameter: raw input data (validated against inputSchema)
  // Second parameter: unified execution context with all metadata
  // Returns: The expected output, a validation error, or void when the tool
  // suspends via `context.agent?.suspend?.(...)` / `context.workflow?.suspend?.(...)`.
  // When `suspend` has been called, the tool runtime skips output validation
  // (see `Tool.execute` in tool.ts), so returning `undefined` after `suspend`
  // is the supported idiom (e.g. `return await suspend(...)`).
  // Note: When no outputSchema is provided, returns any to allow property access
  // Note: For outputSchema, we use the input type because Zod transforms are applied during validation
  // Note: { error?: never } enables inline type narrowing with 'error' in result checks
  execute?: (inputData: TSchemaIn, context: TContext) => Promise<TSchemaOut | ValidationError | void>;
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
