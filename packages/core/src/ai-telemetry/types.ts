/**
 * AI Telemetry interfaces
 */

import type { MastraError } from '../error';
import type { RuntimeContext } from '../runtime-context';
import type { WorkflowRunStatus, WorkflowStepStatus } from '../workflows';
import type { MastraAITelemetry } from './base';

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
  /** Current step number */
  currentStep?: number;
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
  toolType?: string;
  success?: boolean;
}

/**
 * MCP Tool Call metadata
 */
export interface MCPToolCallMetadata extends AIBaseMetadata {
  /** Name of the MCP tool/function */
  toolName: string;
  /** MCP server identifier */
  mcpServer: string;
  /** MCP server version */
  serverVersion?: string;
  /** Tool schema/signature */
  toolSchema?: any;
  /** MCP-specific error type if tool failed */
  mcpErrorType?: string;
  /** Whether tool execution was successful */
  success?: boolean;
  /** MCP protocol version */
  protocolVersion?: string;
  /** Connection status to MCP server */
  connectionStatus?: 'connected' | 'disconnected' | 'error';
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
 * Complete span metadata (system + user provided)
 */
export type AISpanMetadata =
  | AgentRunMetadata
  | WorkflowRunMetadata
  | LLMGenerationMetadata
  | ToolCallMetadata
  | MCPToolCallMetadata
  | WorkflowStepMetadata
  | AIBaseMetadata; // For generic spans

// ============================================================================
// Span Interfaces
// ============================================================================

/**
 * AI Span interface
 */
export interface AISpan<TMetadata extends AISpanMetadata = AISpanMetadata> {
  /** Unique span identifier */
  id: string;
  /** Name of the span */
  name: string;
  /** Type of the span */
  type: AISpanType;
  /** When span started */
  startTime: Date;
  /** When span ended */
  endTime?: Date;
  /** AI-specific metadata */
  metadata: TMetadata;
  /** Child spans */
  children: AISpan[];
  /** Parent span reference (undefined for root spans) */
  parent?: AISpan;
  /** The top-level span */
  trace: AISpan;
  /** Pointer to the AITelemetry instance */
  aiTelemetry: MastraAITelemetry;

  // Methods for span lifecycle
  /** End the span */
  end(metadata?: Partial<TMetadata>): void;

  /** Record an error for the span, optionally end the span as well */
  error(error: MastraError | Error, endSpan: boolean): void;

  /** Update span metadata */
  update(metadata: Partial<TMetadata>): void;

  /** Create child span */
  createChildSpan(options: AISpanOptions<TMetadata>): AISpan;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Sampling strategy configuration
 */
export type SamplingStrategy =
  | { type: 'always_on' }
  | { type: 'always_off' }
  | { type: 'ratio'; probability: number }
  | { type: 'custom'; sampler: (traceContext: AITraceContext) => boolean };

/**
 * Complete AI Telemetry configuration that combines all options
 */
export interface AITelemetryConfig {
  /** Service name for telemetry */
  serviceName?: string;
  /** Whether telemetry is enabled */
  enabled?: boolean;
  /** Sampling strategy */
  sampling?: SamplingStrategy;
  /** Output settings */
  settings?: {
    /** Whether to include input/output in spans */
    includeIO?: boolean;
    /** Fields to exclude from serialization */
    excludeFields?: string[];
  };
  /** Custom exporters */
  exporters?: AITelemetryExporter[];
  /** Custom processors */
  processors?: AISpanProcessor[];
  /** Custom samplers */
  samplers?: AITelemetrySampler[];
}

// ============================================================================
// Exporter and Processor Interfaces
// ============================================================================

/**
 * Telemetry events that can be exported
 */
export type AITelemetryEvent =
  | { type: 'span_started'; span: AISpan }
  | { type: 'span_updated'; span: AISpan }
  | { type: 'span_ended'; span: AISpan };

/**
 * Interface for telemetry exporters
 */
export interface AITelemetryExporter {
  /** Exporter name */
  name: string;

  /** Export telemetry events */
  exportEvent(event: AITelemetryEvent): Promise<void>;

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
  process(span: AISpan): AISpan | null;
  /** Shutdown processor */
  shutdown(): Promise<void>;
}

/**
 * Interface for telemetry samplers
 */
export interface AITelemetrySampler {
  /** Sampler name */
  name: string;
  /** Determine if trace should be sampled */
  shouldSample(traceContext: AITraceContext): boolean;
}

/**
 * Options for span creation (internal - used by telemetry system)
 */
export interface AISpanOptions<TMetadata extends AISpanMetadata = AISpanMetadata> {
  /** Span name */
  name: string;
  /** Span type */
  type: AISpanType;
  /** Span metadata (partial - system fields will be filled in) */
  metadata: Partial<TMetadata>;
  /** Parent span */
  parent?: AISpan;
  /** Internal callback for span lifecycle events (set by telemetry instance) */
  _callbacks?: {
    onEnd?: (span: AISpan) => void;
    onUpdate?: (span: AISpan) => void;
  };
}

/**
 * Context for TraceSampling
 */
export interface AITraceContext {
  runtimeContext?: RuntimeContext;
  attributes?: Record<string, any>;
}
