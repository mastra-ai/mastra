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
  /** MCP (Model Context Protocol) tool execution */
  MCP_TOOL_CALL = 'mcp_tool_call',
  /** Function/tool execution with inputs, outputs, errors */
  TOOL_CALL = 'tool_call',
  /** Workflow run - root span for workflow processes */
  WORKFLOW_RUN = 'workflow_run',
  /** Workflow step execution with step status, data flow */
  WORKFLOW_STEP = 'workflow_step',
}

// ============================================================================
// Type-Specific Metadata Interfaces
// ============================================================================

/**
 * Base metadata that all spans can have
 */
export interface AIBaseMetadata {
  /** Input passed at the start of the span */
  input?: any;
  /** Output generated at the end of the span */
  output?: any;

  /** Error information if span failed */
  error?: {
    message: string;
    id?: string;
    domain?: string;
    category?: string;
    details?: Record<string, any>;
  };

  /** Custom tags for categorization */
  tags?: string[];
  /** User-defined attributes */
  attributes?: Record<string, any>;
}

/**
 * Agent Run metadata
 */
export interface AgentRunMetadata extends AIBaseMetadata {
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
 * LLM Generation metadata
 */
export interface LLMGenerationMetadata extends AIBaseMetadata {
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
}

/**
 * Tool Call metadata
 */
export interface ToolCallMetadata extends AIBaseMetadata {
  toolId?: string;
  success?: boolean;
}

/**
 * MCP Tool Call metadata
 */
export interface MCPToolCallMetadata extends AIBaseMetadata {
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
 * Workflow Run metadata
 */
export interface WorkflowRunMetadata extends AIBaseMetadata {
  /** Workflow identifier */
  workflowId: string;
  /** Workflow status */
  status?: WorkflowRunStatus;
}

/**
 * Workflow Step metadata
 */
export interface WorkflowStepMetadata extends AIBaseMetadata {
  /** Step identifier */
  stepId: string;
  /** Step status */
  status?: WorkflowStepStatus;
}

/**
 * AI-specific span types mapped to their metadata
 */
export interface AISpanTypeMap {
  [AISpanType.AGENT_RUN]: AgentRunMetadata;
  [AISpanType.WORKFLOW_RUN]: WorkflowRunMetadata;
  [AISpanType.LLM_GENERATION]: LLMGenerationMetadata;
  [AISpanType.TOOL_CALL]: ToolCallMetadata;
  [AISpanType.MCP_TOOL_CALL]: MCPToolCallMetadata;
  [AISpanType.WORKFLOW_STEP]: WorkflowStepMetadata;
  [AISpanType.GENERIC]: AIBaseMetadata;
}

/**
 * Union type for cases that need to handle any span type
 */
export type AnyAISpanMetadata = AISpanTypeMap[keyof AISpanTypeMap];

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
  /** AI-specific metadata - strongly typed based on span type */
  metadata: AISpanTypeMap[TType];
  /** The top-level span - can be any type */
  trace: AnyAISpan;
  /** OpenTelemetry-compatible trace ID (32 hex chars) - present on all spans */
  traceId: string;
  /** Pointer to the AITracing instance */
  aiTracing: MastraAITracing;

  // Methods for span lifecycle
  /** End the span */
  end(metadata?: Partial<AISpanTypeMap[TType]>): void;

  /** Record an error for the span, optionally end the span as well */
  error(error: MastraError | Error, endSpan?: boolean): void;

  /** Update span metadata */
  update(metadata: Partial<AISpanTypeMap[TType]>): void;

  /** Create child span - can be any span type independent of parent */
  createChildSpan<TChildType extends AISpanType>(
    type: TChildType,
    name: string,
    metadata: AISpanTypeMap[TChildType],
  ): AISpan<TChildType>;
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
  /** Span metadata */
  metadata: AISpanTypeMap[TType];
  /** Parent span */
  parent?: AISpan<any>;
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
export interface AITraceContext {
  runtimeContext?: RuntimeContext;
  attributes?: Record<string, any>;
}

/**
 * Sampling strategy configuration
 */
export type SamplingStrategy =
  | { type: SamplingStrategyType.ALWAYS }
  | { type: SamplingStrategyType.NEVER }
  | { type: SamplingStrategyType.RATIO; probability: number }
  | { type: SamplingStrategyType.CUSTOM; sampler: (traceContext: AITraceContext) => boolean };

/**
 * Complete AI Tracing configuration that combines all options
 */
export interface AITracingConfig {
  /** Service name for tracing */
  serviceName: string;
  /** Sampling strategy - controls whether tracing is collected */
  sampling: SamplingStrategy;
  /** Custom exporters */
  exporters?: AITracingExporter[];
  /** Custom processors */
  processors?: AISpanProcessor[];
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
