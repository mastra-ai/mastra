/**
 * Tracing interfaces
 */
import type { MastraError } from '../../error';
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { RequestContext } from '../../request-context';
import type { LanguageModelUsage, ProviderMetadata, StepStartPayload } from '../../stream/types';
import type { WorkflowRunStatus, WorkflowStepStatus } from '../../workflows';

// ============================================================================
// Span Types
// ============================================================================

/**
 * AI-specific span types with their associated metadata
 */
export enum SpanType {
  /** Agent run - root span for agent processes */
  AGENT_RUN = 'agent_run',
  /** Generic span for custom operations */
  GENERIC = 'generic',
  /** Model generation with model calls, token usage, prompts, completions */
  MODEL_GENERATION = 'model_generation',
  /** Single model execution step within a generation (one API call) */
  MODEL_STEP = 'model_step',
  /** Individual model streaming chunk/event */
  MODEL_CHUNK = 'model_chunk',
  /** MCP (Model Context Protocol) tool execution */
  MCP_TOOL_CALL = 'mcp_tool_call',
  /** Input or Output Processor execution */
  PROCESSOR_RUN = 'processor_run',
  /** Function/tool execution with inputs, outputs, errors */
  TOOL_CALL = 'tool_call',
  /** Workflow run - root span for workflow processes */
  WORKFLOW_RUN = 'workflow_run',
  /** Workflow step execution with step status, data flow */
  WORKFLOW_STEP = 'workflow_step',
  /** Workflow conditional execution with condition evaluation */
  WORKFLOW_CONDITIONAL = 'workflow_conditional',
  /** Individual condition evaluation within conditional */
  WORKFLOW_CONDITIONAL_EVAL = 'workflow_conditional_eval',
  /** Workflow parallel execution */
  WORKFLOW_PARALLEL = 'workflow_parallel',
  /** Workflow loop execution */
  WORKFLOW_LOOP = 'workflow_loop',
  /** Workflow sleep operation */
  WORKFLOW_SLEEP = 'workflow_sleep',
  /** Workflow wait for event operation */
  WORKFLOW_WAIT_EVENT = 'workflow_wait_event',
}

export enum EntityType {
  /** Agent/Model execution */
  AGENT = 'agent',
  /** Eval */
  EVAL = 'eval',
  /** Input Processor */
  INPUT_PROCESSOR = 'input_processor',
  /** Output Processor */
  OUTPUT_PROCESSOR = 'output_processor',
  /** Workflow Step */
  WORKFLOW_STEP = 'workflow_step',
  /** Tool */
  TOOL = 'tool',
  /** Workflow */
  WORKFLOW_RUN = 'workflow_run',
}

// ============================================================================
// Type-Specific Attributes Interfaces
// ============================================================================

/**
 * Base attributes that all spans can have
 */
export interface AIBaseAttributes {}

/**
 * Agent Run attributes
 */
export interface AgentRunAttributes extends AIBaseAttributes {
  /** Conversation/thread/session identifier for multi-turn interactions */
  conversationId?: string;
  /** Agent Instructions **/
  instructions?: string;
  /** Agent Prompt **/
  prompt?: string;
  /** Available tools for this execution */
  availableTools?: string[];
  /** Maximum steps allowed */
  maxSteps?: number;
}

/**
 * Detailed breakdown of input token usage by type.
 * Based on OpenInference semantic conventions.
 */
export interface InputTokenDetails {
  /** Regular text tokens (non-cached, non-audio, non-image) */
  text?: number;
  /** Tokens served from cache (cache hit/read) */
  cacheRead?: number;
  /** Tokens written to cache (cache creation - Anthropic only) */
  cacheWrite?: number;
  /** Audio input tokens */
  audio?: number;
  /** Image input tokens (includes PDF pages) */
  image?: number;
}

/**
 * Detailed breakdown of output token usage by type.
 * Based on OpenInference semantic conventions.
 */
export interface OutputTokenDetails {
  /** Regular text output tokens */
  text?: number;
  /** Reasoning/thinking tokens (o1, Claude thinking, Gemini thoughts) */
  reasoning?: number;
  /** Audio output tokens */
  audio?: number;
  /** Image output tokens (DALL-E, etc.) */
  image?: number;
}

/** Token usage statistics */
export interface UsageStats {
  /** Total input tokens (sum of all input details) */
  inputTokens?: number;
  /** Total output tokens (sum of all output details) */
  outputTokens?: number;
  /** Detailed breakdown of input token usage */
  inputDetails?: InputTokenDetails;
  /** Detailed breakdown of output token usage */
  outputDetails?: OutputTokenDetails;
}

/**
 * Model Generation attributes
 */
export interface ModelGenerationAttributes extends AIBaseAttributes {
  /** Model name (e.g., 'gpt-4', 'claude-3') */
  model?: string;
  /** Model provider (e.g., 'openai', 'anthropic') */
  provider?: string;
  /** Type of result/output this LLM call produced */
  resultType?: 'tool_selection' | 'response_generation' | 'reasoning' | 'planning';
  /** Token usage statistics */
  usage?: UsageStats;
  /** Model parameters */
  parameters?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    stopSequences?: string[];
    seed?: number;
    maxRetries?: number;
    abortSignal?: any;
    headers?: Record<string, string | undefined>;
  };
  /** Whether this was a streaming response */
  streaming?: boolean;
  /** Reason the generation finished */
  finishReason?: string;
  /**
   * When the first token/chunk of the completion was received.
   * Used to calculate time-to-first-token (TTFT) metrics.
   * Only applicable for streaming responses.
   */
  completionStartTime?: Date;
  /** Actual model used in the response (may differ from request model) */
  responseModel?: string;
  /** Unique identifier for the response */
  responseId?: string;
  /** Server address for the model endpoint */
  serverAddress?: string;
  /** Server port for the model endpoint */
  serverPort?: number;
}

/**
 * Model Step attributes - for a single model execution within a generation
 */
export interface ModelStepAttributes extends AIBaseAttributes {
  /** Index of this step in the generation (0, 1, 2, ...) */
  stepIndex?: number;
  /** Token usage statistics */
  usage?: UsageStats;
  /** Reason this step finished (stop, tool-calls, length, etc.) */
  finishReason?: string;
  /** Should execution continue */
  isContinued?: boolean;
  /** Result warnings */
  warnings?: Record<string, any>;
}

/**
 * Model Chunk attributes - for individual streaming chunks/events
 */
export interface ModelChunkAttributes extends AIBaseAttributes {
  /** Type of chunk (text-delta, reasoning-delta, tool-call, etc.) */
  chunkType?: string;
  /** Sequence number of this chunk in the stream */
  sequenceNumber?: number;
}

/**
 * Tool Call attributes
 */
export interface ToolCallAttributes extends AIBaseAttributes {
  toolType?: string;
  toolDescription?: string;
  success?: boolean;
}

/**
 * MCP Tool Call attributes
 */
export interface MCPToolCallAttributes extends AIBaseAttributes {
  /** MCP server identifier */
  mcpServer: string;
  /** MCP server version */
  serverVersion?: string;
  /** Whether tool execution was successful */
  success?: boolean;
}

/**
 * Processor attributes
 */
export interface ProcessorRunAttributes extends AIBaseAttributes {
  /** Processor type (input or output) */
  processorType: 'input' | 'output';
  /** Processor index in the agent */
  processorIndex?: number;
  /** MessageList mutations performed by this processor */
  messageListMutations?: Array<{
    type: 'add' | 'addSystem' | 'removeByIds' | 'clear';
    source?: string;
    count?: number;
    ids?: string[];
    text?: string;
    tag?: string;
    message?: any;
  }>;
}

/**
 * Workflow Run attributes
 */
export interface WorkflowRunAttributes extends AIBaseAttributes {
  /** Workflow status */
  status?: WorkflowRunStatus;
}

/**
 * Workflow Step attributes
 */
export interface WorkflowStepAttributes extends AIBaseAttributes {
  /** Step status */
  status?: WorkflowStepStatus;
}

/**
 * Workflow Conditional attributes
 */
export interface WorkflowConditionalAttributes extends AIBaseAttributes {
  /** Number of conditions evaluated */
  conditionCount: number;
  /** Which condition indexes evaluated to true */
  truthyIndexes?: number[];
  /** Which steps will be executed */
  selectedSteps?: string[];
}

/**
 * Workflow Conditional Evaluation attributes
 */
export interface WorkflowConditionalEvalAttributes extends AIBaseAttributes {
  /** Index of this condition in the conditional */
  conditionIndex: number;
  /** Result of condition evaluation */
  result?: boolean;
}

/**
 * Workflow Parallel attributes
 */
export interface WorkflowParallelAttributes extends AIBaseAttributes {
  /** Number of parallel branches */
  branchCount: number;
  /** Step IDs being executed in parallel */
  parallelSteps?: string[];
}

/**
 * Workflow Loop attributes
 */
export interface WorkflowLoopAttributes extends AIBaseAttributes {
  /** Type of loop (foreach, dowhile, dountil) */
  loopType?: 'foreach' | 'dowhile' | 'dountil';
  /** Current iteration number (for individual iterations) */
  iteration?: number;
  /** Total iterations (if known) */
  totalIterations?: number;
  /** Number of steps to run concurrently in foreach loop */
  concurrency?: number;
}

/**
 * Workflow Sleep attributes
 */
export interface WorkflowSleepAttributes extends AIBaseAttributes {
  /** Sleep duration in milliseconds */
  durationMs?: number;
  /** Sleep until date */
  untilDate?: Date;
  /** Sleep type */
  sleepType?: 'fixed' | 'dynamic';
}

/**
 * Workflow Wait Event attributes
 */
export interface WorkflowWaitEventAttributes extends AIBaseAttributes {
  /** Event name being waited for */
  eventName?: string;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Whether event was received or timed out */
  eventReceived?: boolean;
  /** Wait duration in milliseconds */
  waitDurationMs?: number;
}

/**
 * AI-specific span types mapped to their attributes
 */
export interface SpanTypeMap {
  [SpanType.AGENT_RUN]: AgentRunAttributes;
  [SpanType.WORKFLOW_RUN]: WorkflowRunAttributes;
  [SpanType.MODEL_GENERATION]: ModelGenerationAttributes;
  [SpanType.MODEL_STEP]: ModelStepAttributes;
  [SpanType.MODEL_CHUNK]: ModelChunkAttributes;
  [SpanType.TOOL_CALL]: ToolCallAttributes;
  [SpanType.MCP_TOOL_CALL]: MCPToolCallAttributes;
  [SpanType.PROCESSOR_RUN]: ProcessorRunAttributes;
  [SpanType.WORKFLOW_STEP]: WorkflowStepAttributes;
  [SpanType.WORKFLOW_CONDITIONAL]: WorkflowConditionalAttributes;
  [SpanType.WORKFLOW_CONDITIONAL_EVAL]: WorkflowConditionalEvalAttributes;
  [SpanType.WORKFLOW_PARALLEL]: WorkflowParallelAttributes;
  [SpanType.WORKFLOW_LOOP]: WorkflowLoopAttributes;
  [SpanType.WORKFLOW_SLEEP]: WorkflowSleepAttributes;
  [SpanType.WORKFLOW_WAIT_EVENT]: WorkflowWaitEventAttributes;
  [SpanType.GENERIC]: AIBaseAttributes;
}

/**
 * Union type for cases that need to handle any span type
 */
export type AnySpanAttributes = SpanTypeMap[keyof SpanTypeMap];

// ============================================================================
// Span Interfaces
// ============================================================================

/**
 * Base Span interface
 */
interface BaseSpan<TType extends SpanType> {
  /** Unique span identifier */
  id: string;
  /** OpenTelemetry-compatible trace ID (32 hex chars) - present on all spans */
  traceId: string;
  /** Name of the span */
  name: string;
  /** Type of the span */
  type: TType;
  /** Entity type that created the span */
  entityType?: EntityType;
  /** Entity id that created the span */
  entityId?: string;
  /** Entity name that created the span */
  entityName?: string;
  /** When span started */
  startTime: Date;
  /** When span ended */
  endTime?: Date;
  /** Span-type specific attributes */
  attributes?: SpanTypeMap[TType];
  /** User-defined metadata */
  metadata?: Record<string, any>;
  /** Labels used to categorize and filter traces. Only valid on root spans. */
  tags?: string[];
  /** Input passed at the start of the span */
  input?: any;
  /** Output generated at the end of the span */
  output?: any;
  /** Error information if span failed */
  errorInfo?: {
    message: string;
    id?: string;
    domain?: string;
    category?: string;
    details?: Record<string, any>;
  };
  /** Is an event span? (event occurs at startTime, has no endTime) */
  isEvent: boolean;
}

/**
 * Span interface, used internally for tracing
 */
export interface Span<TType extends SpanType> extends BaseSpan<TType> {
  /** Is an internal span? (spans internal to the operation of mastra) */
  isInternal: boolean;
  /** Parent span reference (undefined for root spans) */
  parent?: AnySpan;
  /** Pointer to the ObservabilityInstance instance */
  observabilityInstance: ObservabilityInstance;
  /** Trace-level state shared across all spans in this trace */
  traceState?: TraceState;

  // Methods for span lifecycle
  /** End the span */
  end(options?: EndSpanOptions<TType>): void;

  /** Record an error for the span, optionally end the span as well */
  error(options: ErrorSpanOptions<TType>): void;

  /** Update span attributes */
  update(options: UpdateSpanOptions<TType>): void;

  /** Create child span - can be any span type independent of parent */
  createChildSpan(options: ChildSpanOptions<SpanType.MODEL_GENERATION>): AIModelGenerationSpan;
  createChildSpan<TChildType extends SpanType>(options: ChildSpanOptions<TChildType>): Span<TChildType>;

  /** Create event span - can be any span type independent of parent */
  createEventSpan<TChildType extends SpanType>(options: ChildEventOptions<TChildType>): Span<TChildType>;

  /** Returns `TRUE` if the span is the root span of a trace */
  get isRootSpan(): boolean;

  /** Returns `TRUE` if the span is a valid span (not a NO-OP Span) */
  get isValid(): boolean;

  /** Get the closest parent spanId that isn't an internal span */
  getParentSpanId(includeInternalSpans?: boolean): string | undefined;

  /** Find the closest parent span of a specific type by walking up the parent chain */
  findParent<T extends SpanType>(spanType: T): Span<T> | undefined;

  /** Returns a lightweight span ready for export */
  exportSpan(includeInternalSpans?: boolean): ExportedSpan<TType> | undefined;

  /** Returns the traceId on span, unless NoOpSpan, then undefined */
  get externalTraceId(): string | undefined;

  /**
   * Execute an async function within this span's tracing context.
   *
   * When a bridge is configured, this enables auto-instrumented operations
   * (HTTP requests, database queries, etc.) to be properly nested under this
   * span in the external tracing system.
   *
   * @param fn - The async function to execute within the span context
   * @returns The result of the function execution
   *
   * @example
   * ```typescript
   * const result = await modelSpan.executeInContext(async () => {
   *   return model.generateText(...);
   * });
   * ```
   */
  executeInContext<T>(fn: () => Promise<T>): Promise<T>;

  /**
   * Execute a synchronous function within this span's tracing context.
   *
   * When a bridge is configured, this enables auto-instrumented operations
   * (HTTP requests, database queries, etc.) to be properly nested under this
   * span in the external tracing system.
   *
   * @param fn - The synchronous function to execute within the span context
   * @returns The result of the function execution
   *
   * @example
   * ```typescript
   * const result = modelSpan.executeInContextSync(() => {
   *   return model.streamText(...);
   * });
   * ```
   */
  executeInContextSync<T>(fn: () => T): T;
}

export interface BridgeSpanContext {
  /**
   * Execute an async function within this span's tracing context.
   *
   * When a bridge is configured, this enables auto-instrumented operations
   * (HTTP requests, database queries, etc.) to be properly nested under this
   * span in the external tracing system.
   *
   * @param fn - The async function to execute within the span context
   * @returns The result of the function execution
   *
   * @example
   * ```typescript
   * const result = await modelSpan.executeInContext(async () => {
   *   return model.generateText(...);
   * });
   * ```
   */
  executeInContext<T>(fn: () => Promise<T>): Promise<T>;

  /**
   * Execute a synchronous function within this span's tracing context.
   *
   * When a bridge is configured, this enables auto-instrumented operations
   * (HTTP requests, database queries, etc.) to be properly nested under this
   * span in the external tracing system.
   *
   * @param fn - The synchronous function to execute within the span context
   * @returns The result of the function execution
   *
   * @example
   * ```typescript
   * const result = modelSpan.executeInContextSync(() => {
   *   return model.streamText(...);
   * });
   * ```
   */
  executeInContextSync<T>(fn: () => T): T;
}

/**
 * Specialized span interface for MODEL_GENERATION spans
 * Provides access to creating a ModelSpanTracker for tracking MODEL_STEP and MODEL_CHUNK spans
 */
export interface AIModelGenerationSpan extends Span<SpanType.MODEL_GENERATION> {
  /** Create a ModelSpanTracker for tracking model execution steps and chunks */
  createTracker(): IModelSpanTracker | undefined;
}

/**
 * Exported Span interface, used for tracing exporters
 */
export interface ExportedSpan<TType extends SpanType> extends BaseSpan<TType> {
  /** Parent span id reference (undefined for root spans) */
  parentSpanId?: string;
  /** `TRUE` if the span is the root span of a trace */
  isRootSpan: boolean;
  /**
   * Tags for this trace (only present on root spans).
   * Tags are string labels used to categorize and filter traces.
   */
  tags?: string[];
}

/**
 * Options for ending a model generation span
 */
export interface EndGenerationOptions extends EndSpanOptions<SpanType.MODEL_GENERATION> {
  /** Raw usage data from AI SDK - will be converted to UsageStats with cache token details */
  usage?: LanguageModelUsage;
  /** Provider-specific metadata for extracting cache tokens */
  providerMetadata?: ProviderMetadata;
}

export interface IModelSpanTracker {
  getTracingContext(): TracingContext;
  reportGenerationError(options: ErrorSpanOptions<SpanType.MODEL_GENERATION>): void;
  endGeneration(options?: EndGenerationOptions): void;
  wrapStream<T extends { pipeThrough: Function }>(stream: T): T;
  startStep(payload?: StepStartPayload): void;
}

/**
 * Union type for cases that need to handle any span
 */
export type AnySpan = Span<keyof SpanTypeMap>;

/**
 * Union type for cases that need to handle any exported span
 */
export type AnyExportedSpan = ExportedSpan<keyof SpanTypeMap>;

// ============================================================================
// Tracing Interfaces
// ============================================================================

/**
 * Primary interface for Observability
 */
export interface ObservabilityInstance {
  /**
   * Get current configuration
   */
  getConfig(): Readonly<ObservabilityInstanceConfig>;

  /**
   * Get all exporters
   */
  getExporters(): readonly ObservabilityExporter[];

  /**
   * Get all span output processors
   */
  getSpanOutputProcessors(): readonly SpanOutputProcessor[];

  /**
   * Get the logger instance (for exporters and other components)
   */
  getLogger(): IMastraLogger;

  /**
   * Get the bridge instance if configured
   */
  getBridge(): ObservabilityBridge | undefined;

  /**
   * Start a new span of a specific SpanType
   */
  startSpan<TType extends SpanType>(options: StartSpanOptions<TType>): Span<TType>;

  /**
   * Shutdown tracing and clean up resources
   */
  shutdown(): Promise<void>;

  /**
   * Override setLogger to add tracing specific initialization log
   */
  __setLogger(logger: IMastraLogger): void;
}

// ============================================================================
// Span Create/Update/Error Option Types
// ============================================================================

interface CreateBaseOptions<TType extends SpanType> {
  /** Span attributes */
  attributes?: SpanTypeMap[TType];
  /** Span metadata */
  metadata?: Record<string, any>;
  /** Span name */
  name: string;
  /** Span type */
  type: TType;
  /** Entity type that created the span */
  entityType?: EntityType;
  /** Entity id that created the span */
  entityId?: string;
  /** Entity name that created the span */
  entityName?: string;
  /** Policy-level tracing configuration */
  tracingPolicy?: TracingPolicy;
  /** Request Context for metadata extraction */
  requestContext?: RequestContext;
}

/**
 * Options for creating new spans
 */
export interface CreateSpanOptions<TType extends SpanType> extends CreateBaseOptions<TType> {
  /** Input data */
  input?: any;
  /** Output data (for event spans) */
  output?: any;
  /** Labels used to categorize and filter traces. Only valid on root spans. */
  tags?: string[];
  /** Parent span */
  parent?: AnySpan;
  /** Is an event span? */
  isEvent?: boolean;
  /**
   * Trace ID to use for this span (1-32 hexadecimal characters).
   * Only used for root spans without a parent.
   */
  traceId?: string;
  /**
   * Parent span ID to use for this span (1-16 hexadecimal characters).
   * Only used for root spans without a parent.
   */
  parentSpanId?: string;
  /** Trace-level state shared across all spans in this trace */
  traceState?: TraceState;
}

/**
 * Options for starting new spans
 */
export interface StartSpanOptions<TType extends SpanType> extends CreateSpanOptions<TType> {
  /**
   * Options passed when using a custom sampler strategy
   */
  customSamplerOptions?: CustomSamplerOptions;
  /** Tracing options for this execution */
  tracingOptions?: TracingOptions;
}

/**
 * Options for new child spans
 */
export interface ChildSpanOptions<TType extends SpanType> extends CreateBaseOptions<TType> {
  /** Input data */
  input?: any;
}

/**
 * Options for new child events
 * Event spans have no input, and no endTime
 */
export interface ChildEventOptions<TType extends SpanType> extends CreateBaseOptions<TType> {
  /** Output data */
  output?: any;
}

interface UpdateBaseOptions<TType extends SpanType> {
  /** Span attributes */
  attributes?: Partial<SpanTypeMap[TType]>;
  /** Span metadata */
  metadata?: Record<string, any>;
}

export interface EndSpanOptions<TType extends SpanType> extends UpdateBaseOptions<TType> {
  /** Output data */
  output?: any;
}

export interface UpdateSpanOptions<TType extends SpanType> extends UpdateBaseOptions<TType> {
  /** Input data */
  input?: any;
  /** Output data */
  output?: any;
}

export interface ErrorSpanOptions<TType extends SpanType> extends UpdateBaseOptions<TType> {
  /** The error associated with the issue */
  error: MastraError | Error;
  /** End the span when true */
  endSpan?: boolean;
}

export interface GetOrCreateSpanOptions<TType extends SpanType> {
  type: TType;
  name: string;
  entityType?: EntityType;
  entityId?: string;
  entityName?: string;
  input?: any;
  attributes?: SpanTypeMap[TType];
  metadata?: Record<string, any>;
  tracingPolicy?: TracingPolicy;
  tracingOptions?: TracingOptions;
  tracingContext?: TracingContext;
  requestContext?: RequestContext;
  mastra?: Mastra;
}

// ============================================================================
// Lifecycle Types
// ============================================================================

export interface ObservabilityEntrypoint {
  shutdown(): Promise<void>;

  setMastraContext(options: { mastra: Mastra }): void;

  setLogger(options: { logger: IMastraLogger }): void;

  getSelectedInstance(options: ConfigSelectorOptions): ObservabilityInstance | undefined;

  // Registry management methods
  registerInstance(name: string, instance: ObservabilityInstance, isDefault?: boolean): void;
  getInstance(name: string): ObservabilityInstance | undefined;
  getDefaultInstance(): ObservabilityInstance | undefined;
  listInstances(): ReadonlyMap<string, ObservabilityInstance>;
  unregisterInstance(name: string): boolean;
  hasInstance(name: string): boolean;
  setConfigSelector(selector: ConfigSelector): void;
  clear(): void;
}

/**
 * Bitwise options to set different types of spans as internal in
 * a workflow or agent execution.
 */
export enum InternalSpans {
  /** No spans are marked internal */
  NONE = 0,
  /** Workflow spans are marked internal */
  WORKFLOW = 1 << 0, // 0001
  /** Agent spans are marked internal */
  AGENT = 1 << 1, // 0010
  /** Tool spans are marked internal */
  TOOL = 1 << 2, // 0100
  /** Model spans are marked internal */
  MODEL = 1 << 3, // 1000

  /** All spans are marked internal */
  ALL = (1 << 4) - 1, // 1111 (all bits set up to 3)
}

/**
 * Policy-level tracing configuration applied when creating
 * a workflow or agent. Unlike TracingOptions, which are
 * provided at execution time, policies define persistent rules
 * for how spans are treated across all executions of the
 * workflow/agent.
 */
export interface TracingPolicy {
  /**
   * Bitwise options to set different types of spans as Internal in
   * a workflow or agent execution. Internal spans are hidden by
   * default in exported traces.
   */
  internal?: InternalSpans;
}

/**
 * Trace-level state computed once at the start of a trace
 * and shared by all spans within that trace.
 */
export interface TraceState {
  /**
   * RequestContext keys to extract as metadata for all spans in this trace.
   * Computed by merging the tracing config's requestContextKeys
   * with the per-request requestContextKeys.
   */
  requestContextKeys: string[];
}

/**
 * Options passed when starting a new agent or workflow execution
 */
export interface TracingOptions {
  /** Metadata to add to the root trace span */
  metadata?: Record<string, any>;
  /**
   * Additional RequestContext keys to extract as metadata for this trace.
   * These keys are added to the requestContextKeys config.
   * Supports dot notation for nested values (e.g., 'user.id', 'session.data.experimentId').
   */
  requestContextKeys?: string[];
  /**
   * Trace ID to use for this execution (1-32 hexadecimal characters).
   * If provided, this trace will be part of the specified trace rather than starting a new one.
   */
  traceId?: string;
  /**
   * Parent span ID to use for this execution (1-16 hexadecimal characters).
   * If provided, the root span will be created as a child of this span.
   */
  parentSpanId?: string;
  /**
   * Tags to apply to this trace.
   * Tags are string labels that can be used to categorize and filter traces
   * Note: Tags are only applied to the root span of a trace.
   */
  tags?: string[];
}

export interface SpanIds {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

/**
 * Context for tracing that flows through workflow and agent execution
 */
export interface TracingContext {
  /** Current Span for creating child spans and adding metadata */
  currentSpan?: AnySpan;
}

/**
 * Properties returned to the user for working with traces externally.
 */
export type TracingProperties = {
  /** Trace ID used on the execution (if the execution was traced). */
  traceId?: string;
};

// ============================================================================
// Registry Config Interfaces
// ============================================================================

/**
 * Options for controlling serialization of span data.
 * These options control how input, output, and attributes are cleaned before export.
 */
export interface SerializationOptions {
  /** Maximum length for string values (default: 1024) */
  maxStringLength?: number;
  /** Maximum depth for nested objects (default: 6) */
  maxDepth?: number;
  /** Maximum number of items in arrays (default: 50) */
  maxArrayLength?: number;
  /** Maximum number of keys in objects (default: 50) */
  maxObjectKeys?: number;
}

/**
 * Configuration for a single observability instance
 */
export interface ObservabilityInstanceConfig {
  /** Unique identifier for this config in the observability registry */
  name: string;
  /** Service name for observability */
  serviceName: string;
  /** Sampling strategy - controls whether tracing is collected (defaults to ALWAYS) */
  sampling?: SamplingStrategy;
  /** Custom exporters */
  exporters?: ObservabilityExporter[];
  /** Custom processors */
  spanOutputProcessors?: SpanOutputProcessor[];
  /** OpenTelemetry bridge for integration with existing OTEL infrastructure */
  bridge?: ObservabilityBridge;
  /** Set to `true` if you want to see spans internal to the operation of mastra */
  includeInternalSpans?: boolean;
  /**
   * RequestContext keys to automatically extract as metadata for all spans
   * created with this observability configuration.
   * Supports dot notation for nested values.
   */
  requestContextKeys?: string[];
  /**
   * Options for controlling serialization of span data (input/output/attributes).
   * Use these to customize truncation limits for large payloads.
   */
  serializationOptions?: SerializationOptions;
}

/**
 * Complete Observability registry configuration
 */
export interface ObservabilityRegistryConfig {
  /** Enables default exporters, with sampling: always, and sensitive data filtering */
  default?: {
    enabled?: boolean;
  };
  /** Map of tracing instance names to their configurations or pre-instantiated instances */
  configs?: Record<string, Omit<ObservabilityInstanceConfig, 'name'> | ObservabilityInstance>;
  /** Optional selector function to choose which tracing instance to use */
  configSelector?: ConfigSelector;
}

// ============================================================================
// Sampling Strategy Interfaces
// ============================================================================

/**
 * Sampling strategy types
 */
export enum SamplingStrategyType {
  ALWAYS = 'always',
  NEVER = 'never',
  RATIO = 'ratio',
  CUSTOM = 'custom',
}

/**
 * Sampling strategy configuration
 */
export type SamplingStrategy =
  | { type: SamplingStrategyType.ALWAYS }
  | { type: SamplingStrategyType.NEVER }
  | { type: SamplingStrategyType.RATIO; probability: number }
  | { type: SamplingStrategyType.CUSTOM; sampler: (options?: CustomSamplerOptions) => boolean };

/**
 * Options passed when using a custom sampler strategy
 */
export interface CustomSamplerOptions {
  requestContext?: RequestContext;
  metadata?: Record<string, any>;
}

// ============================================================================
// Exporter and Processor Interfaces
// ============================================================================

/**
 * Tracing event types
 */
export enum TracingEventType {
  SPAN_STARTED = 'span_started',
  SPAN_UPDATED = 'span_updated',
  SPAN_ENDED = 'span_ended',
}

/**
 * Tracing events that can be exported
 */
export type TracingEvent =
  | { type: TracingEventType.SPAN_STARTED; exportedSpan: AnyExportedSpan }
  | { type: TracingEventType.SPAN_UPDATED; exportedSpan: AnyExportedSpan }
  | { type: TracingEventType.SPAN_ENDED; exportedSpan: AnyExportedSpan };

export interface InitExporterOptions {
  mastra?: Mastra;
  config?: ObservabilityInstanceConfig;
}

export interface InitBridgeOptions {
  mastra?: Mastra;
  config?: ObservabilityInstanceConfig;
}

/**
 * Interface for tracing exporters
 */
export interface ObservabilityExporter {
  /** Exporter name */
  name: string;

  /** Initialize exporter with tracing configuration and/or access to Mastra */
  init?(options: InitExporterOptions): void;

  /** Sets logger instance on the exporter.  */
  __setLogger?(logger: IMastraLogger): void;

  /** Export tracing events */
  exportTracingEvent(event: TracingEvent): Promise<void>;

  addScoreToTrace?({
    traceId,
    spanId,
    score,
    reason,
    scorerName,
    metadata,
  }: {
    traceId: string;
    spanId?: string;
    score: number;
    reason?: string;
    scorerName: string;
    metadata?: Record<string, any>;
  }): Promise<void>;

  /** Shutdown exporter */
  shutdown(): Promise<void>;
}

/**
 * Interface for observability bridges
 */
export interface ObservabilityBridge {
  /** Bridge name */
  name: string;

  /** Initialize bridge with observability configuration and/or access to Mastra */
  init?(options: InitBridgeOptions): void;

  /** Sets logger instance on the bridge  */
  __setLogger?(logger: IMastraLogger): void;

  /**
   * Export Mastra tracing events to OTEL infrastructure
   * Called for SPAN_STARTED, SPAN_UPDATED, SPAN_ENDED events
   *
   * @param event - Tracing event with exported span
   */
  exportTracingEvent(event: TracingEvent): Promise<void>;

  /**
   * Execute an async function within the tracing context of a Mastra span.
   * This enables auto-instrumented operations (HTTP, DB) to have correct parent spans
   * in the external tracing system (e.g., OpenTelemetry, DataDog, etc.).
   *
   * @param spanId - The ID of the Mastra span to use as context
   * @param fn - The async function to execute within the span context
   * @returns The result of the function execution
   */
  executeInContext?<T>(spanId: string, fn: () => Promise<T>): Promise<T>;

  /**
   * Execute a synchronous function within the tracing context of a Mastra span.
   * This enables auto-instrumented operations (HTTP, DB) to have correct parent spans
   * in the external tracing system (e.g., OpenTelemetry, DataDog, etc.).
   *
   * @param spanId - The ID of the Mastra span to use as context
   * @param fn - The synchronous function to execute within the span context
   * @returns The result of the function execution
   */
  executeInContextSync?<T>(spanId: string, fn: () => T): T;

  /**
   * Create a span in the bridge's tracing system.
   * Called during Mastra span construction to get bridge-generated identifiers.
   *
   * @param options - Span creation options from Mastra
   * @returns Span identifiers (spanId, traceId, parentSpanId) from bridge, or undefined if creation fails
   */
  createSpan(options: CreateSpanOptions<SpanType>): SpanIds | undefined;

  /** Shutdown bridge and cleanup resources */
  shutdown(): Promise<void>;
}

/**
 * Interface for span processors
 */
export interface SpanOutputProcessor {
  /** Processor name */
  name: string;
  /** Process span before export */
  process(span?: AnySpan): AnySpan | undefined;
  /** Shutdown processor */
  shutdown(): Promise<void>;
}

// ============================================================================
// Tracing Config Selector Interfaces
// ============================================================================

/**
 *  Options passed when using a custom tracing config selector
 */
export interface ConfigSelectorOptions {
  /** Request Context */
  requestContext?: RequestContext;
}

/**
 * Function to select which tracing instance to use for a given span
 * Returns the name of the tracing instance, or undefined to use default
 */
export type ConfigSelector = (
  options: ConfigSelectorOptions,
  availableConfigs: ReadonlyMap<string, ObservabilityInstance>,
) => string | undefined;
