/**
 * Metrics Types and Collector Interface for Agentic Applications
 *
 * This module defines the metrics infrastructure for tracking agent,
 * workflow, and tool execution metrics. It follows an adapter pattern
 * similar to the logger, allowing custom metrics backends.
 */

// ============================================================================
// Metric Labels
// ============================================================================

/**
 * Common labels for metrics - used for aggregation and filtering
 */
export interface MetricLabels {
  /** Agent ID */
  agentId?: string;
  /** Workflow ID */
  workflowId?: string;
  /** Model name/ID */
  model?: string;
  /** Provider (openai, anthropic, etc.) */
  provider?: string;
  /** Tool name */
  tool?: string;
  /** Environment (production, staging, dev) */
  environment?: string;
  /** Custom labels */
  [key: string]: string | undefined;
}

// ============================================================================
// Token & Cost Metrics
// ============================================================================

/**
 * Token usage breakdown
 */
export interface TokenUsage {
  /** Total input tokens */
  inputTokens: number;
  /** Total output tokens */
  outputTokens: number;
  /** Cached input tokens (prompt cache) */
  cachedTokens?: number;
  /** Reasoning/thinking tokens */
  reasoningTokens?: number;
  /** Cache write tokens (Anthropic) */
  cacheWriteTokens?: number;
}

/**
 * Cost breakdown for a single operation
 */
export interface CostBreakdown {
  /** Total cost in USD */
  totalCostUSD: number;
  /** Model/LLM cost */
  modelCostUSD?: number;
  /** Tool execution cost (external APIs) */
  toolCostUSD?: number;
  /** Cost by model (for multi-model scenarios) */
  costByModel?: Record<string, number>;
}

// ============================================================================
// Agent Metrics
// ============================================================================

/**
 * Metrics collected during a single agent run
 */
export interface AgentRunMetrics {
  /** Agent ID */
  agentId: string;
  /** Run ID */
  runId: string;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Number of model steps (LLM calls) */
  stepCount: number;
  /** Number of tool calls made */
  toolCallCount: number;
  /** Successful tool calls */
  toolSuccessCount: number;
  /** Failed tool calls */
  toolFailureCount: number;
  /** Token usage */
  tokenUsage: TokenUsage;
  /** Cost breakdown (if calculable) */
  cost?: CostBreakdown;
  /** Time to first token (streaming) */
  timeToFirstTokenMs?: number;
  /** Finish reason (stop, tool-calls, length, etc.) */
  finishReason?: string;
  /** Whether the run was successful */
  success: boolean;
  /** Error type if failed */
  errorType?: string;
}

/**
 * Aggregated agent metrics over a time period
 */
export interface AgentAggregateMetrics {
  /** Agent ID */
  agentId: string;
  /** Time period start */
  periodStart: Date;
  /** Time period end */
  periodEnd: Date;
  /** Total runs */
  totalRuns: number;
  /** Successful runs */
  successfulRuns: number;
  /** Failed runs */
  failedRuns: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average duration in ms */
  avgDurationMs: number;
  /** P50 duration */
  p50DurationMs: number;
  /** P95 duration */
  p95DurationMs: number;
  /** P99 duration */
  p99DurationMs: number;
  /** Total tokens used */
  totalTokens: TokenUsage;
  /** Total cost */
  totalCostUSD: number;
  /** Average cost per run */
  avgCostPerRun: number;
  /** Average tool calls per run */
  avgToolCallsPerRun: number;
  /** Tool success rate */
  toolSuccessRate: number;
}

// ============================================================================
// Workflow Metrics
// ============================================================================

/**
 * Metrics collected during a single workflow run
 */
export interface WorkflowRunMetrics {
  /** Workflow ID */
  workflowId: string;
  /** Run ID */
  runId: string;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Number of steps executed */
  stepsExecuted: number;
  /** Number of steps that succeeded */
  stepsSucceeded: number;
  /** Number of steps that failed */
  stepsFailed: number;
  /** Number of steps that were suspended */
  stepsSuspended: number;
  /** Final status */
  status: 'completed' | 'failed' | 'suspended';
  /** Token usage (if workflow contains agents) */
  tokenUsage?: TokenUsage;
  /** Cost breakdown */
  cost?: CostBreakdown;
  /** Whether the run was successful */
  success: boolean;
  /** Error type if failed */
  errorType?: string;
}

// ============================================================================
// Tool Metrics
// ============================================================================

/**
 * Metrics for a single tool execution
 */
export interface ToolExecutionMetrics {
  /** Tool name */
  toolName: string;
  /** Tool type (local, mcp, etc.) */
  toolType?: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Whether execution was successful */
  success: boolean;
  /** Error message if failed */
  errorMessage?: string;
  /** Agent that called the tool */
  agentId?: string;
  /** Workflow that called the tool */
  workflowId?: string;
}

// ============================================================================
// Model Metrics
// ============================================================================

// ============================================================================
// HTTP Metrics
// ============================================================================

/**
 * Metrics for a single HTTP request
 */
export interface HttpRequestMetrics {
  /** HTTP method */
  method: string;
  /** Request URL or path */
  url: string;
  /** Host/domain */
  host?: string;
  /** Request direction */
  direction: 'outbound' | 'inbound';
  /** What initiated the request */
  source?: 'tool' | 'agent' | 'workflow' | 'mcp' | 'server' | 'integration';
  /** Response status code */
  statusCode: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Whether the request was successful */
  success: boolean;
  /** Request body size in bytes */
  requestSize?: number;
  /** Response body size in bytes */
  responseSize?: number;
  /** Associated agent ID */
  agentId?: string;
  /** Associated workflow ID */
  workflowId?: string;
  /** Error type if failed */
  errorType?: string;
}

/**
 * Aggregated HTTP metrics over a time period
 */
export interface HttpAggregateMetrics {
  /** Time period start */
  periodStart: Date;
  /** Time period end */
  periodEnd: Date;
  /** Total requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average duration in ms */
  avgDurationMs: number;
  /** P50 duration */
  p50DurationMs: number;
  /** P95 duration */
  p95DurationMs: number;
  /** P99 duration */
  p99DurationMs: number;
  /** Total bytes sent */
  totalBytesSent: number;
  /** Total bytes received */
  totalBytesReceived: number;
  /** Requests by status code */
  byStatusCode: Record<number, number>;
  /** Requests by host */
  byHost: Record<string, number>;
}

/**
 * Metrics for a single model call
 */
export interface ModelCallMetrics {
  /** Model ID */
  model: string;
  /** Provider */
  provider?: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Time to first token (streaming) */
  timeToFirstTokenMs?: number;
  /** Token usage */
  tokenUsage: TokenUsage;
  /** Finish reason */
  finishReason?: string;
  /** Whether call was successful */
  success: boolean;
  /** Whether this was a retry */
  isRetry: boolean;
  /** Retry attempt number (1-based) */
  retryAttempt?: number;
  /** Whether a fallback model was used */
  isFallback: boolean;
  /** Original model if fallback was used */
  fallbackFrom?: string;
  /** Agent ID */
  agentId?: string;
}

// ============================================================================
// Metric Names Constants
// ============================================================================

/**
 * Standard metric names for consistency across implementations.
 * Use these constants when calling incrementCounter, recordHistogram, etc.
 */
export const MetricNames = {
  // Agent metrics
  AGENT_RUNS_TOTAL: 'agent_runs_total',
  AGENT_RUNS_SUCCESS: 'agent_runs_success_total',
  AGENT_RUNS_ERROR: 'agent_runs_error_total',
  AGENT_RUN_DURATION: 'agent_run_duration_ms',
  AGENT_TOOL_CALLS: 'agent_tool_calls_total',

  // Workflow metrics
  WORKFLOW_RUNS_TOTAL: 'workflow_runs_total',
  WORKFLOW_RUNS_SUCCESS: 'workflow_runs_completed_total',
  WORKFLOW_RUNS_FAILED: 'workflow_runs_failed_total',
  WORKFLOW_RUNS_SUSPENDED: 'workflow_runs_suspended_total',
  WORKFLOW_RUN_DURATION: 'workflow_run_duration_ms',
  WORKFLOW_STEPS_EXECUTED: 'workflow_steps_executed_total',

  // Tool metrics
  TOOL_CALLS_TOTAL: 'tool_calls_total',
  TOOL_CALLS_SUCCESS: 'tool_calls_success_total',
  TOOL_CALLS_ERROR: 'tool_calls_error_total',
  TOOL_CALL_DURATION: 'tool_call_duration_ms',

  // Model metrics
  MODEL_CALLS_TOTAL: 'model_calls_total',
  MODEL_CALLS_SUCCESS: 'model_calls_success_total',
  MODEL_CALLS_ERROR: 'model_calls_error_total',
  MODEL_RETRIES: 'model_retries_total',
  MODEL_FALLBACKS: 'model_fallbacks_total',
  MODEL_CALL_DURATION: 'model_call_duration_ms',
  MODEL_TIME_TO_FIRST_TOKEN: 'model_time_to_first_token_ms',

  // Token metrics
  TOKENS_INPUT: 'tokens_input_total',
  TOKENS_OUTPUT: 'tokens_output_total',
  TOKENS_TOTAL: 'tokens_total',
  TOKENS_CACHED: 'tokens_cached_total',
  TOKENS_REASONING: 'tokens_reasoning_total',

  // Cost metrics
  COST_USD: 'cost_usd_total',
  COST_MODEL_USD: 'cost_model_usd_total',
  COST_TOOL_USD: 'cost_tool_usd_total',

  // HTTP metrics
  HTTP_REQUESTS_TOTAL: 'http_requests_total',
  HTTP_REQUESTS_SUCCESS: 'http_requests_success_total',
  HTTP_REQUESTS_ERROR: 'http_requests_error_total',
  HTTP_REQUEST_DURATION: 'http_request_duration_ms',
  HTTP_BYTES_SENT: 'http_bytes_sent_total',
  HTTP_BYTES_RECEIVED: 'http_bytes_received_total',
} as const;

// ============================================================================
// Metrics Collector Interface
// ============================================================================

/**
 * Interface for collecting and reporting metrics.
 * Implementations can send metrics to various backends (Prometheus, DataDog, etc.)
 */
export interface IMetricsCollector {
  // ---- Counter Operations ----

  /**
   * Increment a counter metric
   * @param name Metric name
   * @param labels Labels for the metric
   * @param value Value to increment by (default: 1)
   */
  incrementCounter(name: string, labels?: MetricLabels, value?: number): void;

  // ---- Gauge Operations ----

  /**
   * Set a gauge metric value
   * @param name Metric name
   * @param labels Labels for the metric
   * @param value Value to set
   */
  setGauge(name: string, labels: MetricLabels, value: number): void;

  // ---- Histogram Operations ----

  /**
   * Record a value in a histogram
   * @param name Metric name
   * @param labels Labels for the metric
   * @param value Value to record
   */
  recordHistogram(name: string, labels: MetricLabels, value: number): void;

  // ---- High-Level Recording Methods ----

  /**
   * Record metrics from an agent run
   */
  recordAgentRun(metrics: AgentRunMetrics): void;

  /**
   * Record metrics from a workflow run
   */
  recordWorkflowRun(metrics: WorkflowRunMetrics): void;

  /**
   * Record metrics from a tool execution
   */
  recordToolExecution(metrics: ToolExecutionMetrics): void;

  /**
   * Record metrics from a model call
   */
  recordModelCall(metrics: ModelCallMetrics): void;

  /**
   * Record metrics from an HTTP request
   */
  recordHttpRequest(metrics: HttpRequestMetrics): void;

  /**
   * Record token usage
   */
  recordTokenUsage(usage: TokenUsage, labels?: MetricLabels): void;

  /**
   * Record cost
   */
  recordCost(cost: CostBreakdown, labels?: MetricLabels): void;

  // ---- Lifecycle ----

  /**
   * Flush any buffered metrics
   */
  flush(): Promise<void>;

  /**
   * Shutdown the collector
   */
  shutdown(): Promise<void>;
}

// ============================================================================
// Base Metrics Collector (Abstract)
// ============================================================================

/**
 * Abstract base class for metrics collectors.
 *
 * Extend this class to create custom metrics backends (Prometheus, DataDog, etc.).
 * You only need to implement the primitive operations:
 * - incrementCounter
 * - setGauge
 * - recordHistogram
 * - flush
 * - shutdown
 *
 * The high-level recording methods (recordAgentRun, recordWorkflowRun, etc.)
 * are provided with default implementations that call the primitive operations.
 *
 * @example
 * ```typescript
 * class PrometheusMetricsCollector extends BaseMetricsCollector {
 *   private registry: Registry;
 *
 *   incrementCounter(name: string, labels?: MetricLabels, value = 1): void {
 *     // Push to Prometheus counter
 *   }
 *
 *   setGauge(name: string, labels: MetricLabels, value: number): void {
 *     // Set Prometheus gauge
 *   }
 *
 *   recordHistogram(name: string, labels: MetricLabels, value: number): void {
 *     // Observe in Prometheus histogram
 *   }
 *
 *   async flush(): Promise<void> {
 *     // Push to Pushgateway if needed
 *   }
 *
 *   async shutdown(): Promise<void> {
 *     // Cleanup
 *   }
 * }
 * ```
 */
export abstract class BaseMetricsCollector implements IMetricsCollector {
  // ---- Abstract primitive operations (must implement) ----

  abstract incrementCounter(name: string, labels?: MetricLabels, value?: number): void;
  abstract setGauge(name: string, labels: MetricLabels, value: number): void;
  abstract recordHistogram(name: string, labels: MetricLabels, value: number): void;
  abstract flush(): Promise<void>;
  abstract shutdown(): Promise<void>;

  // ---- High-level recording methods (default implementations) ----

  /**
   * Record metrics from an agent run.
   * Override this method if you need custom behavior.
   */
  recordAgentRun(metrics: AgentRunMetrics): void {
    const labels: MetricLabels = { agentId: metrics.agentId };

    this.incrementCounter(MetricNames.AGENT_RUNS_TOTAL, labels);
    if (metrics.success) {
      this.incrementCounter(MetricNames.AGENT_RUNS_SUCCESS, labels);
    } else {
      this.incrementCounter(MetricNames.AGENT_RUNS_ERROR, { ...labels, errorType: metrics.errorType });
    }
    this.recordHistogram(MetricNames.AGENT_RUN_DURATION, labels, metrics.durationMs);
    this.incrementCounter(MetricNames.AGENT_TOOL_CALLS, labels, metrics.toolCallCount);
    this.recordTokenUsage(metrics.tokenUsage, labels);
    if (metrics.cost) {
      this.recordCost(metrics.cost, labels);
    }
  }

  /**
   * Record metrics from a workflow run.
   * Override this method if you need custom behavior.
   */
  recordWorkflowRun(metrics: WorkflowRunMetrics): void {
    const labels: MetricLabels = { workflowId: metrics.workflowId };

    this.incrementCounter(MetricNames.WORKFLOW_RUNS_TOTAL, labels);
    this.incrementCounter(`workflow_runs_${metrics.status}_total`, labels);
    this.recordHistogram(MetricNames.WORKFLOW_RUN_DURATION, labels, metrics.durationMs);
    this.incrementCounter(MetricNames.WORKFLOW_STEPS_EXECUTED, labels, metrics.stepsExecuted);
  }

  /**
   * Record metrics from a tool execution.
   * Override this method if you need custom behavior.
   */
  recordToolExecution(metrics: ToolExecutionMetrics): void {
    const labels: MetricLabels = {
      tool: metrics.toolName,
      toolType: metrics.toolType,
      agentId: metrics.agentId,
    };

    this.incrementCounter(MetricNames.TOOL_CALLS_TOTAL, labels);
    if (metrics.success) {
      this.incrementCounter(MetricNames.TOOL_CALLS_SUCCESS, labels);
    } else {
      this.incrementCounter(MetricNames.TOOL_CALLS_ERROR, labels);
    }
    this.recordHistogram(MetricNames.TOOL_CALL_DURATION, labels, metrics.durationMs);
  }

  /**
   * Record metrics from a model call.
   * Override this method if you need custom behavior.
   */
  recordModelCall(metrics: ModelCallMetrics): void {
    const labels: MetricLabels = {
      model: metrics.model,
      provider: metrics.provider,
      agentId: metrics.agentId,
    };

    this.incrementCounter(MetricNames.MODEL_CALLS_TOTAL, labels);
    if (metrics.success) {
      this.incrementCounter(MetricNames.MODEL_CALLS_SUCCESS, labels);
    } else {
      this.incrementCounter(MetricNames.MODEL_CALLS_ERROR, labels);
    }
    if (metrics.isRetry) {
      this.incrementCounter(MetricNames.MODEL_RETRIES, labels);
    }
    if (metrics.isFallback) {
      this.incrementCounter(MetricNames.MODEL_FALLBACKS, { ...labels, fallbackFrom: metrics.fallbackFrom });
    }
    this.recordHistogram(MetricNames.MODEL_CALL_DURATION, labels, metrics.durationMs);
    if (metrics.timeToFirstTokenMs !== undefined) {
      this.recordHistogram(MetricNames.MODEL_TIME_TO_FIRST_TOKEN, labels, metrics.timeToFirstTokenMs);
    }
    this.recordTokenUsage(metrics.tokenUsage, labels);
  }

  /**
   * Record metrics from an HTTP request.
   * Override this method if you need custom behavior.
   */
  recordHttpRequest(metrics: HttpRequestMetrics): void {
    const labels: MetricLabels = {
      method: metrics.method,
      host: metrics.host,
      direction: metrics.direction,
      source: metrics.source,
      agentId: metrics.agentId,
      workflowId: metrics.workflowId,
    };

    this.incrementCounter(MetricNames.HTTP_REQUESTS_TOTAL, labels);
    if (metrics.success) {
      this.incrementCounter(MetricNames.HTTP_REQUESTS_SUCCESS, labels);
    } else {
      this.incrementCounter(MetricNames.HTTP_REQUESTS_ERROR, { ...labels, errorType: metrics.errorType });
    }

    // Track by status code
    this.incrementCounter('http_requests_by_status', { ...labels, statusCode: String(metrics.statusCode) });

    // Record latency
    this.recordHistogram(MetricNames.HTTP_REQUEST_DURATION, labels, metrics.durationMs);

    // Record bytes if available
    if (metrics.requestSize) {
      this.incrementCounter(MetricNames.HTTP_BYTES_SENT, labels, metrics.requestSize);
    }
    if (metrics.responseSize) {
      this.incrementCounter(MetricNames.HTTP_BYTES_RECEIVED, labels, metrics.responseSize);
    }
  }

  /**
   * Record token usage.
   * Override this method if you need custom behavior.
   */
  recordTokenUsage(usage: TokenUsage, labels: MetricLabels = {}): void {
    this.incrementCounter(MetricNames.TOKENS_INPUT, labels, usage.inputTokens);
    this.incrementCounter(MetricNames.TOKENS_OUTPUT, labels, usage.outputTokens);
    this.incrementCounter(MetricNames.TOKENS_TOTAL, labels, usage.inputTokens + usage.outputTokens);
    if (usage.cachedTokens) {
      this.incrementCounter(MetricNames.TOKENS_CACHED, labels, usage.cachedTokens);
    }
    if (usage.reasoningTokens) {
      this.incrementCounter(MetricNames.TOKENS_REASONING, labels, usage.reasoningTokens);
    }
  }

  /**
   * Record cost.
   * Override this method if you need custom behavior.
   */
  recordCost(cost: CostBreakdown, labels: MetricLabels = {}): void {
    this.incrementCounter(MetricNames.COST_USD, labels, cost.totalCostUSD);
    if (cost.modelCostUSD !== undefined) {
      this.incrementCounter(MetricNames.COST_MODEL_USD, labels, cost.modelCostUSD);
    }
    if (cost.toolCostUSD !== undefined) {
      this.incrementCounter(MetricNames.COST_TOOL_USD, labels, cost.toolCostUSD);
    }
  }
}

// ============================================================================
// No-Op Metrics Collector
// ============================================================================

/**
 * No-op implementation of IMetricsCollector.
 * Used when metrics collection is not configured.
 */
export class NoOpMetricsCollector implements IMetricsCollector {
  incrementCounter(_name: string, _labels?: MetricLabels, _value?: number): void {
    // No-op
  }

  setGauge(_name: string, _labels: MetricLabels, _value: number): void {
    // No-op
  }

  recordHistogram(_name: string, _labels: MetricLabels, _value: number): void {
    // No-op
  }

  recordAgentRun(_metrics: AgentRunMetrics): void {
    // No-op
  }

  recordWorkflowRun(_metrics: WorkflowRunMetrics): void {
    // No-op
  }

  recordToolExecution(_metrics: ToolExecutionMetrics): void {
    // No-op
  }

  recordModelCall(_metrics: ModelCallMetrics): void {
    // No-op
  }

  recordHttpRequest(_metrics: HttpRequestMetrics): void {
    // No-op
  }

  recordTokenUsage(_usage: TokenUsage, _labels?: MetricLabels): void {
    // No-op
  }

  recordCost(_cost: CostBreakdown, _labels?: MetricLabels): void {
    // No-op
  }

  async flush(): Promise<void> {
    // No-op
  }

  async shutdown(): Promise<void> {
    // No-op
  }
}

// ============================================================================
// In-Memory Metrics Collector
// ============================================================================

/**
 * Simple in-memory metrics collector for development and testing.
 * Extends BaseMetricsCollector and stores raw metrics for inspection.
 *
 * This is useful for:
 * - Unit tests that need to verify metrics were recorded
 * - Development environments for debugging
 * - Prototyping before integrating a real metrics backend
 */
export class InMemoryMetricsCollector extends BaseMetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private agentRuns: AgentRunMetrics[] = [];
  private workflowRuns: WorkflowRunMetrics[] = [];
  private toolExecutions: ToolExecutionMetrics[] = [];
  private modelCalls: ModelCallMetrics[] = [];
  private httpRequests: HttpRequestMetrics[] = [];

  private makeKey(name: string, labels?: MetricLabels): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  // ---- Primitive operations (required by BaseMetricsCollector) ----

  incrementCounter(name: string, labels?: MetricLabels, value = 1): void {
    const key = this.makeKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }

  setGauge(name: string, labels: MetricLabels, value: number): void {
    const key = this.makeKey(name, labels);
    this.gauges.set(key, value);
  }

  recordHistogram(name: string, labels: MetricLabels, value: number): void {
    const key = this.makeKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
  }

  async flush(): Promise<void> {
    // In-memory, nothing to flush
  }

  async shutdown(): Promise<void> {
    // In-memory, nothing to shutdown
  }

  // ---- Override high-level methods to also store raw metrics ----

  override recordAgentRun(metrics: AgentRunMetrics): void {
    this.agentRuns.push(metrics);
    super.recordAgentRun(metrics);
  }

  override recordWorkflowRun(metrics: WorkflowRunMetrics): void {
    this.workflowRuns.push(metrics);
    super.recordWorkflowRun(metrics);
  }

  override recordToolExecution(metrics: ToolExecutionMetrics): void {
    this.toolExecutions.push(metrics);
    super.recordToolExecution(metrics);
  }

  override recordModelCall(metrics: ModelCallMetrics): void {
    this.modelCalls.push(metrics);
    super.recordModelCall(metrics);
  }

  override recordHttpRequest(metrics: HttpRequestMetrics): void {
    this.httpRequests.push(metrics);
    super.recordHttpRequest(metrics);
  }

  // ---- Accessors for testing/debugging ----

  getCounter(name: string, labels?: MetricLabels): number {
    return this.counters.get(this.makeKey(name, labels)) || 0;
  }

  getGauge(name: string, labels?: MetricLabels): number | undefined {
    return this.gauges.get(this.makeKey(name, labels));
  }

  getHistogram(name: string, labels?: MetricLabels): number[] {
    return this.histograms.get(this.makeKey(name, labels)) || [];
  }

  getAgentRuns(): AgentRunMetrics[] {
    return [...this.agentRuns];
  }

  getWorkflowRuns(): WorkflowRunMetrics[] {
    return [...this.workflowRuns];
  }

  getToolExecutions(): ToolExecutionMetrics[] {
    return [...this.toolExecutions];
  }

  getModelCalls(): ModelCallMetrics[] {
    return [...this.modelCalls];
  }

  getHttpRequests(): HttpRequestMetrics[] {
    return [...this.httpRequests];
  }

  getAllCounters(): Map<string, number> {
    return new Map(this.counters);
  }

  clear(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.agentRuns = [];
    this.workflowRuns = [];
    this.toolExecutions = [];
    this.modelCalls = [];
    this.httpRequests = [];
  }
}
