/**
 * Tracing interfaces
 *
 * Span types, attributes, span lifecycle, and tracing-specific types.
 * For top-level observability infrastructure (instances, exporters, bridges, config),
 * see observability.ts.
 */
import type { MastraError } from '../../error';
import type { Mastra } from '../../mastra';
import type { RequestContext } from '../../request-context';
import type { LanguageModelUsage, ProviderMetadata, StepStartPayload } from '../../stream/types';
import type { WorkflowRunStatus, WorkflowStepStatus } from '../../workflows';
import type { CustomSamplerOptions, ObservabilityInstance } from './core';
import type { FeedbackInput } from './feedback';
import type { ScoreInput } from './scores';

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
  /** Input Step Processor */
  INPUT_STEP_PROCESSOR = 'input_step_processor',
  /** Output Processor */
  OUTPUT_PROCESSOR = 'output_processor',
  /** Output Step Processor */
  OUTPUT_STEP_PROCESSOR = 'output_step_processor',
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
  /** Processor executor type (workflow or legacy) */
  processorExecutor?: 'workflow' | 'legacy';
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

export interface SpanErrorInfo {
  message: string;
  id?: string;
  domain?: string;
  category?: string;
  details?: Record<string, any>;
}

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
  errorInfo?: SpanErrorInfo;
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
 * Span data structure shared between exported and recorded spans.
 * Contains all span fields in a serializable format (no object references).
 *
 * This is the common base for:
 * - ExportedSpan: span data sent to exporters
 * - RecordedSpan: span data loaded from storage with annotation methods
 */
export interface SpanData<TType extends SpanType> extends BaseSpan<TType> {
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
 * Exported Span interface, used for tracing exporters.
 * This is the format sent to ObservabilityExporter implementations.
 */
export interface ExportedSpan<TType extends SpanType> extends SpanData<TType> {}

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
// Recorded Span & Trace Interfaces
// ============================================================================

/**
 * A recorded span is span data that has been captured/persisted and can have
 * scores and feedback attached post-hoc. Unlike live Span objects, RecordedSpan
 * has immutable core data but supports annotation methods.
 *
 * Spans are organized in a tree structure via parent/children references,
 * with all references pointing to the same objects in memory.
 *
 * Use cases:
 * - Spans loaded from storage for evaluation
 * - Spans from completed traces being annotated
 * - Post-hoc quality scoring and user feedback
 */
export interface RecordedSpan<TType extends SpanType> extends SpanData<TType> {
  /** Parent span reference (undefined for root spans) */
  readonly parent?: AnyRecordedSpan;

  /** Child spans in execution order */
  readonly children: ReadonlyArray<AnyRecordedSpan>;

  /**
   * Add a quality score to this recorded span.
   * Scores are emitted via the ObservabilityBus and can be persisted/exported.
   */
  addScore(score: ScoreInput): void;

  /**
   * Add user feedback to this recorded span.
   * Feedback is emitted via the ObservabilityBus and can be persisted/exported.
   */
  addFeedback(feedback: FeedbackInput): void;
}

/**
 * Union type for cases that need to handle any recorded span
 */
export type AnyRecordedSpan = RecordedSpan<keyof SpanTypeMap>;

/**
 * A recorded trace is a complete execution trace loaded from storage.
 * Provides both tree access (via rootSpan) and flat access (via spans).
 * All references point to the same span objects - no memory duplication.
 *
 * Obtained via mastra.getTrace(traceId) for post-execution annotation.
 */
export interface RecordedTrace {
  /** The trace identifier */
  readonly traceId: string;

  /** Root span of the trace tree (entry point for tree traversal) */
  readonly rootSpan: AnyRecordedSpan;

  /** All spans in flat array for iteration (same objects as in tree) */
  readonly spans: ReadonlyArray<AnyRecordedSpan>;

  /**
   * Get a specific recorded span by ID.
   * @param spanId - The span identifier
   * @returns The recorded span if found, null otherwise
   */
  getSpan(spanId: string): AnyRecordedSpan | null;

  /**
   * Add a score at the trace level.
   * Uses root span's metadata for context inheritance.
   */
  addScore(score: ScoreInput): void;

  /**
   * Add feedback at the trace level.
   * Uses root span's metadata for context inheritance.
   */
  addFeedback(feedback: FeedbackInput): void;
}

// ============================================================================
// Tracing Interfaces
// ============================================================================

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
   * Span ID to use for this span (1-16 hexadecimal characters).
   * Only used when rebuilding a span from cached data.
   */
  spanId?: string;
  /**
   * Parent span ID to use for this span (1-16 hexadecimal characters).
   * Only used for root spans without a parent.
   */
  parentSpanId?: string;
  /**
   * Start time for this span.
   * Only used when rebuilding a span from cached data.
   */
  startTime?: Date;
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
  /**
   * When true, input data will be hidden from all spans in this trace.
   */
  hideInput?: boolean;
  /**
   * When true, output data will be hidden from all spans in this trace.
   */
  hideOutput?: boolean;
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
  /**
   * When true, input data will be hidden from all spans in this trace.
   * Useful for protecting sensitive data from being logged.
   */
  hideInput?: boolean;
  /**
   * When true, output data will be hidden from all spans in this trace.
   * Useful for protecting sensitive data from being logged.
   */
  hideOutput?: boolean;
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

/**
 * Function type for formatting exported spans at the exporter level.
 *
 * This allows customization of how spans appear in vendor-specific observability platforms
 * (e.g., Langfuse, Braintrust). Unlike SpanOutputProcessor which operates on the internal
 * Span object before export, this formatter operates on the ExportedSpan data structure
 * after the span has been prepared for export.
 *
 * Formatters can be synchronous or asynchronous, enabling use cases like:
 * - Extract plain text from structured AI SDK messages for better readability
 * - Transform input/output format for specific vendor requirements
 * - Add or remove fields based on the target platform
 * - Redact or transform sensitive data in a vendor-specific way
 * - Enrich spans with data from external APIs (async)
 * - Perform database lookups to add context (async)
 *
 * @param span - The exported span to format
 * @returns The formatted span (sync) or a Promise resolving to the formatted span (async)
 *
 * @example
 * ```typescript
 * // Synchronous formatter that extracts plain text from AI messages
 * const plainTextFormatter: CustomSpanFormatter = (span) => {
 *   if (span.type === SpanType.AGENT_RUN && Array.isArray(span.input)) {
 *     const userMessage = span.input.find(m => m.role === 'user');
 *     return {
 *       ...span,
 *       input: userMessage?.content ?? span.input,
 *     };
 *   }
 *   return span;
 * };
 *
 * // Async formatter that enriches spans with external data
 * const enrichmentFormatter: CustomSpanFormatter = async (span) => {
 *   const userData = await fetchUserData(span.metadata?.userId);
 *   return {
 *     ...span,
 *     metadata: { ...span.metadata, userName: userData.name },
 *   };
 * };
 *
 * // Use with an exporter
 * new BraintrustExporter({
 *   customSpanFormatter: plainTextFormatter,
 * });
 * ```
 */
export type CustomSpanFormatter = (span: AnyExportedSpan) => AnyExportedSpan | Promise<AnyExportedSpan>;
