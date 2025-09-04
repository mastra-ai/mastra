/**
 * AI Tracing interfaces
 */

import type { MastraError } from '../error';
import type { RuntimeContext } from '../runtime-context';
import type { WorkflowRunStatus, WorkflowStepStatus } from '../workflows';
import type { MastraAITracing } from './base';

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
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
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
 * AI Span interface with type safety
 */
export interface AISpan<TType extends AISpanType> {
  /** Unique span identifier */
  id: string;
  /** Name of the span */
  name: string;
  /** Type of the span */
  type: TType;
  /** When span started */
  startTime: Date;
  /** When span ended */
  endTime?: Date;
  /** Is an event span? (event occurs at startTime, has no endTime) */
  isEvent: boolean;
  /** AI-specific attributes - strongly typed based on span type */
  attributes?: AISpanTypeMap[TType];
  /** Parent span reference (undefined for root spans) */
  parent?: AnyAISpan;
  /** OpenTelemetry-compatible trace ID (32 hex chars) - present on all spans */
  traceId: string;
  /** Pointer to the AITracing instance */
  aiTracing: MastraAITracing;

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

  /** User-defined metadata */
  metadata?: Record<string, any>;

  // Methods for span lifecycle
  /** End the span */
  end(options?: { output?: any; attributes?: Partial<AISpanTypeMap[TType]>; metadata?: Record<string, any> }): void;

  /** Record an error for the span, optionally end the span as well */
  error(options: {
    error: MastraError | Error;
    attributes?: Partial<AISpanTypeMap[TType]>;
    metadata?: Record<string, any>;
    endSpan?: boolean;
  }): void;

  /** Update span attributes */
  update(options?: {
    input?: any;
    output?: any;
    attributes?: Partial<AISpanTypeMap[TType]>;
    metadata?: Record<string, any>;
  }): void;

  /** Create child span - can be any span type independent of parent */
  createChildSpan<TChildType extends AISpanType>(options: {
    type: TChildType;
    name: string;
    input?: any;
    attributes?: AISpanTypeMap[TChildType];
    metadata?: Record<string, any>;
  }): AISpan<TChildType>;

  /** Create event span - can be any span type independent of parent 
      Event spans have no input, and no endTime.
  */
  createEventSpan<TChildType extends AISpanType>(options: {
    type: TChildType;
    name: string;
    output?: any;
    attributes?: AISpanTypeMap[TChildType];
    metadata?: Record<string, any>;
  }): AISpan<TChildType>;

  /** Returns `TRUE` if the span is the root span of a trace */
  get isRootSpan(): boolean;
}

/**
 * Union type for cases that need to handle any span
 */
export type AnyAISpan = AISpan<keyof AISpanTypeMap>;

/**
 * Options for span creation
 */
export interface AISpanOptions<TType extends AISpanType> {
  /** Span name */
  name: string;
  /** Span type */
  type: TType;
  /** Input data */
  input?: any;
  /** Output data (for event spans) */
  output?: any;
  /** Span attributes */
  attributes?: AISpanTypeMap[TType];
  /** Span metadata */
  metadata?: Record<string, any>;
  /** Parent span */
  parent?: AnyAISpan;
  /** Is an event span? */
  isEvent: boolean;
}

// ============================================================================
// Configuration Types
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
 * Context for TraceSampling
 */
export interface TraceContext {
  runtimeContext?: RuntimeContext;
  metadata?: Record<string, any>;
}

/**
 * Sampling strategy configuration
 */
export type SamplingStrategy =
  | { type: SamplingStrategyType.ALWAYS }
  | { type: SamplingStrategyType.NEVER }
  | { type: SamplingStrategyType.RATIO; probability: number }
  | { type: SamplingStrategyType.CUSTOM; sampler: (traceContext: TraceContext) => boolean };

export type TracingStrategy = 'realtime' | 'batch-with-updates' | 'insert-only';

/**
 * Configuration for a single AI tracing instance
 */
export interface AITracingInstanceConfig {
  /** Service name for tracing */
  serviceName: string;
  /** Instance name from the registry */
  instanceName: string;
  /** Sampling strategy - controls whether tracing is collected (defaults to ALWAYS) */
  sampling?: SamplingStrategy;
  /** Custom exporters */
  exporters?: AITracingExporter[];
  /** Custom processors */
  processors?: AISpanProcessor[];
}

/**
 * Complete AI Tracing configuration
 */
export interface AITracingConfig {
  /** Map of tracing instance names to their configurations or pre-instantiated instances */
  instances: Record<string, Omit<AITracingInstanceConfig, 'instanceName'> | MastraAITracing>;
  /** Optional selector function to choose which tracing instance to use */
  selector?: TracingSelector;
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
  | { type: AITracingEventType.SPAN_STARTED; span: AnyAISpan }
  | { type: AITracingEventType.SPAN_UPDATED; span: AnyAISpan }
  | { type: AITracingEventType.SPAN_ENDED; span: AnyAISpan };

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
  process(span: AnyAISpan): AnyAISpan | null;
  /** Shutdown processor */
  shutdown(): Promise<void>;
}

// ============================================================================
// AI Tracing Selection Types
// ============================================================================

/**
 * Context provided to tracing selector functions
 */
export interface AITracingSelectorContext {
  /** Runtime context */
  runtimeContext?: RuntimeContext;
}

/**
 * Function to select which AI tracing instance to use for a given span
 * Returns the name of the tracing instance, or undefined to use default
 */
export type TracingSelector = (
  context: AITracingSelectorContext,
  availableTracers: ReadonlyMap<string, MastraAITracing>,
) => string | undefined;

/**
 * Context for AI tracing that flows through workflow and agent execution
 */
export interface TracingContext {
  /** Current AI span for creating child spans and adding metadata */
  currentSpan?: AnyAISpan;
}
