/**
 * AI Tracing interfaces
 */

import type { MastraError } from '../error';
import type { IMastraLogger } from '../logger';
import type { RuntimeContext } from '../runtime-context';
import type { WorkflowRunStatus, WorkflowStepStatus } from '../workflows';

// ============================================================================
// Core AI-Specific Span Types
// ============================================================================

/**
 * AI-specific span types with their associated metadata
 */
export enum AISpanType {
  /** Agent run - root span for agent processes */
  AGENT_RUN = 'agent_run',
  /** Generic span for custom operations */
  GENERIC = 'generic',
  /** LLM generation with model calls, token usage, prompts, completions */
  LLM_GENERATION = 'llm_generation',
  /** Individual LLM streaming chunk/event */
  LLM_CHUNK = 'llm_chunk',
  /** MCP (Model Context Protocol) tool execution */
  MCP_TOOL_CALL = 'mcp_tool_call',
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
  /** Agent identifier */
  agentId: string;
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
 * LLM Generation attributes
 */
export interface LLMGenerationAttributes extends AIBaseAttributes {
  /** Model name (e.g., 'gpt-4', 'claude-3') */
  model?: string;
  /** Model provider (e.g., 'openai', 'anthropic') */
  provider?: string;
  /** Type of result/output this LLM call produced */
  resultType?: 'tool_selection' | 'response_generation' | 'reasoning' | 'planning';
  /** Token usage statistics */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    promptCacheHitTokens?: number;
    promptCacheMissTokens?: number;
  };
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
}

/**
 * LLM Chunk attributes - for individual streaming chunks/events
 */
export interface LLMChunkAttributes extends AIBaseAttributes {
  /** Type of chunk (text-delta, reasoning-delta, tool-call, etc.) */
  chunkType?: string;
  /** Sequence number of this chunk in the stream */
  sequenceNumber?: number;
}

/**
 * Tool Call attributes
 */
export interface ToolCallAttributes extends AIBaseAttributes {
  toolId?: string;
  toolType?: string;
  toolDescription?: string;
  success?: boolean;
}

/**
 * MCP Tool Call attributes
 */
export interface MCPToolCallAttributes extends AIBaseAttributes {
  /** Id of the MCP tool/function */
  toolId: string;
  /** MCP server identifier */
  mcpServer: string;
  /** MCP server version */
  serverVersion?: string;
  /** Whether tool execution was successful */
  success?: boolean;
}

/**
 * Workflow Run attributes
 */
export interface WorkflowRunAttributes extends AIBaseAttributes {
  /** Workflow identifier */
  workflowId: string;
  /** Workflow status */
  status?: WorkflowRunStatus;
}

/**
 * Workflow Step attributes
 */
export interface WorkflowStepAttributes extends AIBaseAttributes {
  /** Step identifier */
  stepId: string;
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
export interface AISpanTypeMap {
  [AISpanType.AGENT_RUN]: AgentRunAttributes;
  [AISpanType.WORKFLOW_RUN]: WorkflowRunAttributes;
  [AISpanType.LLM_GENERATION]: LLMGenerationAttributes;
  [AISpanType.LLM_CHUNK]: LLMChunkAttributes;
  [AISpanType.TOOL_CALL]: ToolCallAttributes;
  [AISpanType.MCP_TOOL_CALL]: MCPToolCallAttributes;
  [AISpanType.WORKFLOW_STEP]: WorkflowStepAttributes;
  [AISpanType.WORKFLOW_CONDITIONAL]: WorkflowConditionalAttributes;
  [AISpanType.WORKFLOW_CONDITIONAL_EVAL]: WorkflowConditionalEvalAttributes;
  [AISpanType.WORKFLOW_PARALLEL]: WorkflowParallelAttributes;
  [AISpanType.WORKFLOW_LOOP]: WorkflowLoopAttributes;
  [AISpanType.WORKFLOW_SLEEP]: WorkflowSleepAttributes;
  [AISpanType.WORKFLOW_WAIT_EVENT]: WorkflowWaitEventAttributes;
  [AISpanType.GENERIC]: AIBaseAttributes;
}

/**
 * Union type for cases that need to handle any span type
 */
export type AnyAISpanAttributes = AISpanTypeMap[keyof AISpanTypeMap];

// ============================================================================
// Span Interfaces
// ============================================================================

/**
 * Base Span interface
 */
interface BaseSpan<TType extends AISpanType> {
  /** Unique span identifier */
  id: string;
  /** OpenTelemetry-compatible trace ID (32 hex chars) - present on all spans */
  traceId: string;
  /** Name of the span */
  name: string;
  /** Type of the span */
  type: TType;
  /** When span started */
  startTime: Date;
  /** When span ended */
  endTime?: Date;
  /** Is an internal span? (spans internal to the operation of mastra) */
  attributes?: AISpanTypeMap[TType];
  /** User-defined metadata */
  metadata?: Record<string, any>;
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
 * AI Span interface, used internally for tracing
 */
export interface AISpan<TType extends AISpanType> extends BaseSpan<TType> {
  /** Is an internal span? (spans internal to the operation of mastra) */
  isInternal: boolean;
  /** Parent span reference (undefined for root spans) */
  parent?: AnyAISpan;
  /** Pointer to the AITracing instance */
  aiTracing: AITracing;

  // Methods for span lifecycle
  /** End the span */
  end(options?: EndSpanOptions<TType>): void;

  /** Record an error for the span, optionally end the span as well */
  error(options: ErrorSpanOptions<TType>): void;

  /** Update span attributes */
  update(options: UpdateSpanOptions<TType>): void;

  /** Create child span - can be any span type independent of parent */
  createChildSpan<TChildType extends AISpanType>(options: ChildSpanOptions<TChildType>): AISpan<TChildType>;

  /** Create event span - can be any span type independent of parent */
  createEventSpan<TChildType extends AISpanType>(options: ChildEventOptions<TChildType>): AISpan<TChildType>;

  /** Returns `TRUE` if the span is the root span of a trace */
  get isRootSpan(): boolean;

  /** Returns `TRUE` if the span is a valid span (not a NO-OP Span) */
  get isValid(): boolean;

  /** Get the closest parent spanId that isn't an internal span */
  getParentSpanId(includeInternalSpans?: boolean): string | undefined;

  /** Returns a lightweight span ready for export */
  exportSpan(includeInternalSpans?: boolean): ExportedAISpan<TType> | undefined;
}

/**
 * Exported AI Span interface, used for tracing exporters
 */
export interface ExportedAISpan<TType extends AISpanType> extends BaseSpan<TType> {
  /** Parent span id reference (undefined for root spans) */
  parentSpanId?: string;
  /** `TRUE` if the span is the root span of a trace */
  isRootSpan: boolean;
}

/**
 * Union type for cases that need to handle any span
 */
export type AnyAISpan = AISpan<keyof AISpanTypeMap>;

/**
 * Union type for cases that need to handle any exported span
 */
export type AnyExportedAISpan = ExportedAISpan<keyof AISpanTypeMap>;

// ============================================================================
// Tracing Interfaces
// ============================================================================

/**
 * Primary interface for AI Tracing
 */
export interface AITracing {
  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<TracingConfig>>;

  /**
   * Get all exporters
   */
  getExporters(): readonly AITracingExporter[];

  /**
   * Get all processors
   */
  getProcessors(): readonly AISpanProcessor[];

  /**
   * Get the logger instance (for exporters and other components)
   */
  getLogger(): IMastraLogger;

  /**
   * Start a new span of a specific AISpanType
   */
  startSpan<TType extends AISpanType>(options: StartSpanOptions<TType>): AISpan<TType>;

  /**
   * Shutdown AI tracing and clean up resources
   */
  shutdown(): Promise<void>;

  /**
   * Override setLogger to add AI tracing specific initialization log
   */
  __setLogger(logger: IMastraLogger): void;
}

// ============================================================================
// Span Create/Update/Error Option Types
// ============================================================================

interface CreateBaseOptions<TType extends AISpanType> {
  /** Span attributes */
  attributes?: AISpanTypeMap[TType];
  /** Span metadata */
  metadata?: Record<string, any>;
  /** Span name */
  name: string;
  /** Span type */
  type: TType;
  /** Policy-level tracing configuration */
  tracingPolicy?: TracingPolicy;
}

/**
 * Options for creating new spans
 */
export interface CreateSpanOptions<TType extends AISpanType> extends CreateBaseOptions<TType> {
  /** Input data */
  input?: any;
  /** Output data (for event spans) */
  output?: any;
  /** Parent span */
  parent?: AnyAISpan;
  /** Is an event span? */
  isEvent?: boolean;
}

/**
 * Options for starting new spans
 */
export interface StartSpanOptions<TType extends AISpanType> extends CreateSpanOptions<TType> {
  /**
   * Options passed when using a custom sampler strategy
   */
  customSamplerOptions?: CustomSamplerOptions;
}

/**
 * Options for new child spans
 */
export interface ChildSpanOptions<TType extends AISpanType> extends CreateBaseOptions<TType> {
  /** Input data */
  input?: any;
}

/**
 * Options for new child events
 * Event spans have no input, and no endTime
 */
export interface ChildEventOptions<TType extends AISpanType> extends CreateBaseOptions<TType> {
  /** Output data */
  output?: any;
}

interface UpdateBaseOptions<TType extends AISpanType> {
  /** Span attributes */
  attributes?: Partial<AISpanTypeMap[TType]>;
  /** Span metadata */
  metadata?: Record<string, any>;
}

export interface EndSpanOptions<TType extends AISpanType> extends UpdateBaseOptions<TType> {
  /** Output data */
  output?: any;
}

export interface UpdateSpanOptions<TType extends AISpanType> extends UpdateBaseOptions<TType> {
  /** Input data */
  input?: any;
  /** Output data */
  output?: any;
}

export interface ErrorSpanOptions<TType extends AISpanType> extends UpdateBaseOptions<TType> {
  /** The error associated with the issue */
  error: MastraError | Error;
  /** End the span when true */
  endSpan?: boolean;
}

// ============================================================================
// Lifecycle Types
// ============================================================================

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
  /** LLM spans are marked internal */
  LLM = 1 << 3, // 1000

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
 * Options passed when starting a new agent or workflow execution
 */
export interface TracingOptions {
  /** Metadata to add to the root trace span */
  metadata?: Record<string, any>;
}

/**
 * Context for AI tracing that flows through workflow and agent execution
 */
export interface TracingContext {
  /** Current AI span for creating child spans and adding metadata */
  currentSpan?: AnyAISpan;
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
 * Configuration for a single tracing instance
 */
export interface TracingConfig {
  /** Unique identifier for this config in the ai tracing registry */
  name: string;
  /** Service name for tracing */
  serviceName: string;
  /** Sampling strategy - controls whether tracing is collected (defaults to ALWAYS) */
  sampling?: SamplingStrategy;
  /** Custom exporters */
  exporters?: AITracingExporter[];
  /** Custom processors */
  processors?: AISpanProcessor[];
  /** Set to `true` if you want to see spans internal to the operation of mastra */
  includeInternalSpans?: boolean;
}

/**
 * Complete AI Tracing registry configuration
 */
export interface ObservabilityRegistryConfig {
  /** Enables default exporters, with sampling: always, and sensitive data filtering */
  default?: {
    enabled?: boolean;
  };
  /** Map of tracing instance names to their configurations or pre-instantiated instances */
  configs?: Record<string, Omit<TracingConfig, 'name'> | AITracing>;
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
  runtimeContext?: RuntimeContext;
  metadata?: Record<string, any>;
}

// ============================================================================
// Exporter and Processor Interfaces
// ============================================================================

/**
 * AI Tracing event types
 */
export enum AITracingEventType {
  SPAN_STARTED = 'span_started',
  SPAN_UPDATED = 'span_updated',
  SPAN_ENDED = 'span_ended',
}

/**
 * Tracing events that can be exported
 */
export type AITracingEvent =
  | { type: AITracingEventType.SPAN_STARTED; exportedSpan: AnyExportedAISpan }
  | { type: AITracingEventType.SPAN_UPDATED; exportedSpan: AnyExportedAISpan }
  | { type: AITracingEventType.SPAN_ENDED; exportedSpan: AnyExportedAISpan };

/**
 * Interface for tracing exporters
 */
export interface AITracingExporter {
  /** Exporter name */
  name: string;

  /** Initialize exporter (called after all dependencies are ready) */
  init?(): void;

  /** Export tracing events */
  exportEvent(event: AITracingEvent): Promise<void>;

  /** Shutdown exporter */
  shutdown(): Promise<void>;
}

/**
 * Interface for span processors
 */
export interface AISpanProcessor {
  /** Processor name */
  name: string;
  /** Process span before export */
  process(span?: AnyAISpan): AnyAISpan | undefined;
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
  /** Runtime context */
  runtimeContext?: RuntimeContext;
}

/**
 * Function to select which AI tracing instance to use for a given span
 * Returns the name of the tracing instance, or undefined to use default
 */
export type ConfigSelector = (
  options: ConfigSelectorOptions,
  availableConfigs: ReadonlyMap<string, AITracing>,
) => string | undefined;

// ============================================================================
// Tracing Storage Interfaces
// ============================================================================

export type TracingStrategy = 'realtime' | 'batch-with-updates' | 'insert-only';
