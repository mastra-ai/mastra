/**
 * New Telemetry Interface Design for Mastra
 * 
 * This file contains the new telemetry interface types that address the limitations
 * of the current system while incorporating best practices from Langfuse, Braintrust,
 * and OpenLLMetry.
 */

import type { Context, Span as OTelSpan } from '@opentelemetry/api';

// ============================================================================
// Core AI-Specific Span Types
// ============================================================================

/**
 * AI-specific span types with their associated metadata
 */
export enum SpanType {
  /** Agent run - root span for agent processes */
  AGENT_RUN = 'agent_run',
  /** Workflow run - root span for workflow processes */
  WORKFLOW_RUN = 'workflow_run',
  /** LLM generation with model calls, token usage, prompts, completions */
  LLM_GENERATION = 'llm_generation',
  /** Function/tool execution with inputs, outputs, errors */
  TOOL_CALL = 'tool_call',
  /** MCP (Model Context Protocol) tool execution */
  MCP_TOOL_CALL = 'mcp_tool_call',
  /** Memory retrieval with query, results, similarity scores */
  MEMORY_LOOKUP = 'memory_lookup',
  /** Memory updates with storage operations */
  MEMORY_UPDATE = 'memory_update',
  /** Vector search with embeddings, chunks, relevance scores */
  RAG_QUERY = 'rag_query',
  /** Embedding generation for documents and queries */
  EMBEDDING_GENERATION = 'embedding_generation',
  /** Evaluation execution with metrics and scoring */
  EVAL_EXECUTION = 'eval_execution',
  /** Workflow step execution with step status, data flow */
  WORKFLOW_STEP = 'workflow_step',
  /** Generic span for custom operations */
  GENERIC = 'generic',
}

// ============================================================================
// Type-Specific Metadata Interfaces
// ============================================================================

/**
 * Base metadata that all spans share
 */
export interface BaseSpanMetadata {
  /** Type of the span */
  type: SpanType;
  /** Custom tags for categorization */
  tags?: string[];
  /** User-defined attributes */
  attributes?: Record<string, any>;
  /** Timestamp when span was created */
  createdAt: Date;
  /** Optional parent span ID */
  parentSpanId?: string;
  /** Trace ID this span belongs to */
  traceId: string;
  /** Error information if span failed */
  error?: {
    message: string;
    code?: string;
    stack?: string;
    retryable?: boolean;
  };
}

/**
 * Agent Run metadata
 */
export interface AgentRunMetadata extends BaseSpanMetadata {
  type: SpanType.AGENT_RUN;
  /** Agent identifier */
  agentId: string;
  /** Agent name/type */
  agentName?: string;
  /** Execution context */
  context?: string;
  /** Available tools for this execution */
  availableTools?: string[];
  /** Input to the agent */
  input?: any;
  /** Agent's output */
  output?: any;
  /** Execution status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'suspended';
  /** Memory thread ID if using memory */
  threadId?: string;
  /** Workflow ID if part of a workflow */
  workflowId?: string;
  /** Maximum steps allowed */
  maxSteps?: number;
  /** Current step number */
  currentStep?: number;
}

/**
 * Workflow Run metadata
 */
export interface WorkflowRunMetadata extends BaseSpanMetadata {
  type: SpanType.WORKFLOW_RUN;
  /** Workflow identifier */
  workflowId: string;
  /** Workflow name/type */
  workflowName?: string;
  /** Workflow version */
  version?: string;
  /** Input to the workflow */
  input?: any;
  /** Workflow output */
  output?: any;
  /** Workflow status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'suspended' | 'cancelled';
  /** Total number of steps in workflow */
  totalSteps?: number;
  /** Current step index */
  currentStepIndex?: number;
  /** Whether workflow supports suspend/resume */
  suspendable?: boolean;
  /** Execution mode (sequential, parallel, conditional) */
  executionMode?: 'sequential' | 'parallel' | 'conditional' | 'graph';
  /** Workflow metadata */
  metadata?: Record<string, any>;
}

/**
 * LLM Generation metadata
 */
export interface LLMGenerationMetadata extends BaseSpanMetadata {
  type: SpanType.LLM_GENERATION;
  /** Model name (e.g., 'gpt-4', 'claude-3') */
  model: string;
  /** Model provider (e.g., 'openai', 'anthropic') */
  provider: string;
  /** Type of result/output this LLM call produced */
  resultType?: 'tool_selection' | 'response_generation' | 'reasoning' | 'planning' | 'evaluation';
  /** Input messages/prompts */
  input?: any;
  /** Generated output */
  output?: any;
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
  /** Time to first token (for streaming) */
  timeToFirstToken?: number;
  /** Tokens per second (for streaming) */
  tokensPerSecond?: number;
  /** Confidence in the generation (if available) */
  confidence?: number;
}

/**
 * Tool Call metadata
 */
export interface ToolCallMetadata extends BaseSpanMetadata {
  type: SpanType.TOOL_CALL;
  /** Name of the tool/function */
  toolName: string;
  /** Tool provider/source */
  toolProvider?: string;
  /** Input arguments */
  input?: any;
  /** Tool output */
  output?: any;
  /** Execution time in milliseconds */
  executionTime?: number;
  /** Whether tool execution was successful */
  success?: boolean;
}

/**
 * MCP Tool Call metadata
 */
export interface MCPToolCallMetadata extends BaseSpanMetadata {
  type: SpanType.MCP_TOOL_CALL;
  /** Name of the MCP tool/function */
  toolName: string;
  /** MCP server identifier */
  mcpServer: string;
  /** MCP server version */
  serverVersion?: string;
  /** Tool schema/signature */
  toolSchema?: any;
  /** Input arguments */
  input?: any;
  /** Tool output */
  output?: any;
  /** MCP-specific error type if tool failed */
  mcpErrorType?: string;
  /** Execution time in milliseconds */
  executionTime?: number;
  /** Whether tool execution was successful */
  success?: boolean;
  /** MCP protocol version */
  protocolVersion?: string;
  /** Connection status to MCP server */
  connectionStatus?: 'connected' | 'disconnected' | 'error';
}

/**
 * Memory Lookup metadata
 */
export interface MemoryLookupMetadata extends BaseSpanMetadata {
  type: SpanType.MEMORY_LOOKUP;
  /** Memory type (e.g., 'semantic', 'episodic', 'working') */
  memoryType: string;
  /** Search query */
  query?: string;
  /** Number of results requested */
  topK?: number;
  /** Similarity threshold */
  threshold?: number;
  /** Retrieved memories */
  results?: Array<{
    content: any;
    score: number;
    metadata?: Record<string, any>;
  }>;
  /** Thread/session context */
  threadId?: string;
  /** Vector embedding used for search */
  embedding?: number[];
}

/**
 * Memory Update metadata
 */
export interface MemoryUpdateMetadata extends BaseSpanMetadata {
  type: SpanType.MEMORY_UPDATE;
  /** Memory type (e.g., 'semantic', 'episodic', 'working') */
  memoryType: string;
  /** Operation type */
  operation: 'create' | 'update' | 'delete' | 'batch_insert';
  /** Data being stored */
  data?: any;
  /** Number of items being updated */
  itemCount?: number;
  /** Thread/session context */
  threadId?: string;
  /** Storage backend used */
  storageBackend?: string;
  /** Whether operation was successful */
  success?: boolean;
  /** Processing time in milliseconds */
  processingTime?: number;
  /** Size of data in bytes */
  dataSize?: number;
}

/**
 * RAG Query metadata
 */
export interface RAGQueryMetadata extends BaseSpanMetadata {
  type: SpanType.RAG_QUERY;
  /** Original user query */
  query: string;
  /** Processed/rewritten query */
  processedQuery?: string;
  /** Vector store used */
  vectorStore?: string;
  /** Number of chunks requested */
  topK?: number;
  /** Retrieved document chunks */
  chunks?: Array<{
    content: string;
    score: number;
    metadata?: Record<string, any>;
    chunkId?: string;
    documentId?: string;
  }>;
  /** Reranking information */
  reranking?: {
    model?: string;
    originalScores: number[];
    rerankedScores: number[];
  };
  /** Embedding model used */
  embeddingModel?: string;
}

/**
 * Embedding Generation metadata
 */
export interface EmbeddingGenerationMetadata extends BaseSpanMetadata {
  type: SpanType.EMBEDDING_GENERATION;
  /** Embedding model used */
  model: string;
  /** Model provider (e.g., 'openai', 'cohere', 'sentence-transformers') */
  provider: string;
  /** Input text or documents */
  input?: any;
  /** Generated embeddings */
  embeddings?: number[][] | number[];
  /** Embedding dimensions */
  dimensions?: number;
  /** Number of inputs processed */
  inputCount?: number;
  /** Token usage if applicable */
  usage?: {
    tokens?: number;
  };
  /** Model parameters */
  parameters?: {
    maxLength?: number;
    truncate?: 'left' | 'right' | 'none';
    normalize?: boolean;
  };
  /** Processing time in milliseconds */
  processingTime?: number;
  /** Whether operation was successful */
  success?: boolean;
  /** Embedding purpose (document, query, etc.) */
  purpose?: 'document' | 'query' | 'similarity' | 'classification';
}

/**
 * Workflow Step metadata
 */
export interface WorkflowStepMetadata extends BaseSpanMetadata {
  type: SpanType.WORKFLOW_STEP;
  /** Workflow identifier */
  workflowId: string;
  /** Step name/identifier */
  stepName: string;
  /** Step index in workflow */
  stepIndex?: number;
  /** Step status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'suspended';
  /** Input data for this step */
  input?: any;
  /** Output data from this step */
  output?: any;
  /** Whether step supports suspend/resume */
  suspendable?: boolean;
  /** Retry information */
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Evaluation Execution metadata
 */
export interface EvalExecutionMetadata extends BaseSpanMetadata {
  type: SpanType.EVAL_EXECUTION;
  /** Evaluation identifier */
  evalId: string;
  /** Evaluation name/type */
  evalName?: string;
  /** Evaluation version */
  version?: string;
  /** Metrics being evaluated */
  metrics: string[];
  /** Input data for evaluation */
  input?: any;
  /** Expected output/ground truth */
  expected?: any;
  /** Actual output being evaluated */
  actual?: any;
  /** Evaluation results */
  results?: Array<{
    metric: string;
    score: number | string;
    passed?: boolean;
    threshold?: number;
    details?: any;
  }>;
  /** Overall evaluation status */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Metrics that failed during evaluation */
  metricsFailed?: string[];
  /** Dataset information if using dataset */
  dataset?: {
    id: string;
    name?: string;
    version?: string;
  };
  /** Evaluation mode */
  mode?: 'single' | 'batch' | 'continuous';
  /** Processing time in milliseconds */
  processingTime?: number;
  /** LLM calls made during evaluation */
  llmCallsCount?: number;
}


/**
 * Union type for all span metadata
 */
export type SpanMetadata = 
  | AgentRunMetadata
  | WorkflowRunMetadata
  | LLMGenerationMetadata
  | ToolCallMetadata
  | MCPToolCallMetadata
  | MemoryLookupMetadata
  | MemoryUpdateMetadata
  | RAGQueryMetadata
  | EmbeddingGenerationMetadata
  | EvalExecutionMetadata
  | WorkflowStepMetadata
  | (BaseSpanMetadata & { type: SpanType.GENERIC });

// ============================================================================
// Scoring and Annotation Types
// ============================================================================

/**
 * Evaluation score that can be attached to spans or traces
 */
export interface EvaluationScore {
  /** Unique identifier for this score */
  id: string;
  /** Name of the score/metric */
  name: string;
  /** Numerical score value */
  value: number | null;
  /** Score range (e.g., [0, 1] or [0, 100]) */
  range?: [number, number];
  /** Categorical rating (e.g., 'good', 'bad', 'excellent') */
  category?: string;
  /** Scorer metadata */
  scorer: {
    /** Type of scorer (human, llm, code) */
    type: 'human' | 'llm' | 'code';
    /** Name/identifier of the scorer */
    name: string;
    /** Version of the scorer */
    version?: string;
    /** Model used (for LLM scorers) */
    model?: string;
  };
  /** When this score was created */
  createdAt: Date;
  /** Optional reasoning/explanation */
  reasoning?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Human annotation for spans
 */
export interface HumanAnnotation {
  /** Unique identifier */
  id: string;
  /** Annotator information */
  annotator: {
    /** User ID */
    userId: string;
    /** Display name */
    name?: string;
    /** User role */
    role?: string;
  };
  /** Annotation content */
  content: {
    /** Text comment */
    comment?: string;
    /** Rating/score */
    rating?: number;
    /** Tags */
    tags?: string[];
    /** Structured feedback */
    feedback?: Record<string, any>;
  };
  /** When annotation was created */
  createdAt: Date;
  /** Last modification time */
  updatedAt?: Date;
}

/**
 * LLM-generated annotation for spans
 */
export interface LLMAnnotation {
  /** Unique identifier */
  id: string;
  /** LLM that generated this annotation */
  model: {
    /** Model name */
    name: string;
    /** Provider */
    provider: string;
    /** Model version */
    version?: string;
  };
  /** Annotation content */
  content: {
    /** Generated comment/feedback */
    comment: string;
    /** Confidence in the annotation */
    confidence?: number;
    /** Structured evaluation */
    evaluation?: Record<string, any>;
    /** Reasoning trace */
    reasoning?: string[];
  };
  /** When annotation was generated */
  createdAt: Date;
  /** Prompt used to generate annotation */
  prompt?: string;
}

// ============================================================================
// Trace and Span Interfaces
// ============================================================================

/**
 * Represents a trace - the top-level execution unit
 */
export interface Trace {
  /** Unique trace identifier */
  id: string;
  /** Trace name/operation */
  name: string;
  /** When trace started */
  startTime: Date;
  /** When trace ended */
  endTime?: Date;
  /** Trace status */
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  /** User/session context */
  user?: {
    id?: string;
    sessionId?: string;
    [key: string]: any;
  };
  /** Custom attributes */
  attributes?: Record<string, any>;
  /** Tags for categorization */
  tags?: string[];
  /** Associated scores */
  scores?: EvaluationScore[];
  /** Human annotations */
  humanAnnotations?: HumanAnnotation[];
  /** LLM annotations */
  llmAnnotations?: LLMAnnotation[];
  /** Root spans (spans with no parent span) */
  rootSpans: AISpan[];
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Enhanced Span interface that wraps OpenTelemetry spans with AI-specific features
 */
export interface AISpan {
  /** Unique span identifier */
  id: string;
  /** OpenTelemetry span (for compatibility) */
  otelSpan?: OTelSpan;
  /** AI-specific metadata */
  metadata: SpanMetadata;
  /** Associated scores */
  scores?: EvaluationScore[];
  /** Human annotations */
  humanAnnotations?: HumanAnnotation[];
  /** LLM annotations */
  llmAnnotations?: LLMAnnotation[];
  /** Child spans */
  children: AISpan[];
  /** Parent span reference (undefined for root spans) */
  parent?: AISpan;
  /** Trace this span belongs to */
  trace: Trace;
  
  // Methods for span lifecycle
  /** End the span */
  end(endTime?: Date): void;
  /** Add a score to this span */
  addScore(score: Omit<EvaluationScore, 'id' | 'createdAt'>): void;
  /** Add human annotation */
  addHumanAnnotation(annotation: Omit<HumanAnnotation, 'id' | 'createdAt'>): void;
  /** Add LLM annotation */
  addLLMAnnotation(annotation: Omit<LLMAnnotation, 'id' | 'createdAt'>): void;
  /** Create child span */
  createChildSpan(metadata: Omit<SpanMetadata, 'traceId' | 'parentSpanId' | 'createdAt'>): AISpan;
  /** Update span metadata */
  updateMetadata(updates: Partial<SpanMetadata>): void;
  /** Export span for distributed tracing */
  export(): Promise<string>;
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
  | { type: 'custom'; sampler: (traceContext: any) => boolean };

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  /** Service name for telemetry */
  serviceName?: string;
  /** Whether telemetry is enabled */
  enabled?: boolean;
  /** Sampling strategy */
  sampling?: SamplingStrategy;
  /** Context propagation settings */
  context?: {
    /** Whether to include input/output in spans */
    includeIO?: boolean;
    /** Maximum size for serialized data */
    maxDataSize?: number;
    /** Fields to exclude from serialization */
    excludeFields?: string[];
  };
  /** Error handling configuration */
  errorHandling?: {
    /** Whether to retry failed exports */
    enableRetries?: boolean;
    /** Maximum retry attempts */
    maxRetries?: number;
    /** Retry delay in milliseconds */
    retryDelay?: number;
    /** Whether to use exponential backoff */
    exponentialBackoff?: boolean;
  };
}

/**
 * Shared telemetry configuration for constructor
 */
export interface SharedTelemetryConfig {
  /** Telemetry options */
  options?: TelemetryConfig;
  /** Custom exporters */
  exporters?: TelemetryExporter[];
  /** Custom processors */
  processors?: SpanProcessor[];
  /** Custom samplers */
  samplers?: TelemetrySampler[];
}

// ============================================================================
// Capability Detection
// ============================================================================

/**
 * Telemetry capabilities that implementations can support
 */
export interface TelemetrySupports {
  /** Basic tracing capabilities */
  tracing: boolean;
  /** AI-specific span types */
  aiSpanTypes: boolean;
  /** Human annotations on spans */
  humanAnnotations: boolean;
  /** LLM annotations on spans */
  llmAnnotations: boolean;
  /** Context propagation */
  contextPropagation: boolean;
  /** OpenTelemetry compatibility */
  openTelemetry: boolean;
  /** Distributed tracing */
  distributedTracing: boolean;
  /** Custom exporters */
  customExporters: boolean;
  /** Sampling strategies */
  sampling: boolean;
}

// ============================================================================
// Exporter and Processor Interfaces
// ============================================================================

/**
 * Telemetry events that can be exported
 */
export type TelemetryEvent = 
  | { type: 'trace_started'; trace: Trace }
  | { type: 'trace_updated'; trace: Trace }
  | { type: 'trace_ended'; trace: Trace }
  | { type: 'span_started'; span: AISpan }
  | { type: 'span_updated'; span: AISpan }
  | { type: 'span_ended'; span: AISpan }
  | { type: 'score_added'; targetType: 'trace' | 'span'; targetId: string; score: EvaluationScore }
  | { type: 'annotation_added'; targetType: 'trace' | 'span'; targetId: string; annotation: HumanAnnotation | LLMAnnotation };

/**
 * Interface for telemetry exporters
 */
export interface TelemetryExporter {
  /** Exporter name */
  name: string;
  
  /** Export telemetry events */
  exportEvent(event: TelemetryEvent): Promise<void>;
  
  /** Shutdown exporter */
  shutdown(): Promise<void>;
}

/**
 * Interface for span processors
 */
export interface SpanProcessor {
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
export interface TelemetrySampler {
  /** Sampler name */
  name: string;
  /** Determine if trace should be sampled */
  shouldSample(traceContext: any): boolean;
}

// ============================================================================
// Instrumentation Types
// ============================================================================

/**
 * Options for span creation
 */
export interface SpanOptions {
  /** Span name */
  name: string;
  /** Span metadata */
  metadata: Omit<SpanMetadata, 'traceId' | 'createdAt'>;
  /** Parent span */
  parent?: AISpan;
  /** OpenTelemetry context */
  context?: Context;
  /** Custom attributes */
  attributes?: Record<string, any>;
  /** Internal callback for span lifecycle events (set by telemetry instance) */
  _callbacks?: {
    onEnd?: (span: AISpan) => void;
    onUpdate?: (span: AISpan) => void;
    onScoreAdded?: (span: AISpan, score: EvaluationScore) => void;
    onAnnotationAdded?: (span: AISpan, annotation: HumanAnnotation | LLMAnnotation) => void;
  };
}

/**
 * Options for tracing class methods
 */
export interface TracingOptions {
  /** Span name prefix */
  spanNamePrefix?: string;
  /** Default span type for methods */
  defaultSpanType?: SpanType;
  /** Methods to exclude from tracing */
  excludeMethods?: string[];
  /** Custom attributes to add to all spans */
  attributes?: Record<string, any>;
}

/**
 * Options for decorator-based instrumentation
 */
export interface DecoratorOptions {
  /** Span name (defaults to method name) */
  spanName?: string;
  /** Span type */
  spanType?: SpanType;
  /** Custom attributes */
  attributes?: Record<string, any>;
}