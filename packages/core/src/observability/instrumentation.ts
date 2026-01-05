/**
 * Instrumentation Helpers for Agentic Observability
 *
 * This module provides helpers for instrumenting agent, workflow, and tool
 * execution with structured logs and metrics.
 */

import type { IMastraLogger } from '../logger';
import type { LogContext } from '../logger/events';
import * as events from '../logger/event-builder';
import type { TracingContext, AnySpan } from './types/tracing';
import type {
  IMetricsCollector,
  AgentRunMetrics,
  WorkflowRunMetrics,
  ToolExecutionMetrics,
  ModelCallMetrics,
  HttpRequestMetrics,
  TokenUsage,
  GuardrailMetrics,
  HumanInterventionMetrics,
  MetricLabels,
} from './metrics';
import { NoOpMetricsCollector, MetricNames, classifyGoalState } from './metrics';

// ============================================================================
// Context Extraction
// ============================================================================

/**
 * Extract LogContext from available runtime context
 */
export function createLogContext(options: {
  tracingContext?: TracingContext;
  span?: AnySpan;
  agentId?: string;
  workflowId?: string;
  runId?: string;
  threadId?: string;
  resourceId?: string;
  sessionId?: string;
}): LogContext {
  const span = options.span || options.tracingContext?.currentSpan;

  return {
    traceId: span?.traceId,
    spanId: span?.id,
    parentSpanId: span?.parent?.id,
    agentId: options.agentId,
    workflowId: options.workflowId,
    runId: options.runId,
    threadId: options.threadId,
    resourceId: options.resourceId,
    sessionId: options.sessionId,
  };
}

// ============================================================================
// Agent Instrumentation
// ============================================================================

export interface AgentInstrumentationOptions {
  logger: IMastraLogger;
  metrics?: IMetricsCollector;
  agentId: string;
  agentName: string;
  runId: string;
  threadId?: string;
  resourceId?: string;
  tracingContext?: TracingContext;
}

/**
 * Tracks timing and metrics for an agent run
 */
export class AgentRunTracker {
  private startTime: number;
  private stepCount = 0;
  private toolCallCount = 0;
  private toolSuccessCount = 0;
  private toolFailureCount = 0;
  private tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  private context: LogContext;

  constructor(private options: AgentInstrumentationOptions) {
    this.startTime = Date.now();
    this.context = createLogContext({
      agentId: options.agentId,
      runId: options.runId,
      threadId: options.threadId,
      resourceId: options.resourceId,
      tracingContext: options.tracingContext,
    });
  }

  /**
   * Log agent started event
   */
  started(data: { model?: string; maxSteps?: number; toolCount?: number; hasMemory?: boolean }): void {
    const event = events.agentStarted(this.context, {
      agentName: this.options.agentName,
      ...data,
    });
    this.options.logger.logEvent?.(event);
  }

  /**
   * Record a model step
   */
  recordStep(): void {
    this.stepCount++;
  }

  /**
   * Record a tool call
   */
  recordToolCall(success: boolean, durationMs: number, toolName: string): void {
    this.toolCallCount++;
    if (success) {
      this.toolSuccessCount++;
    } else {
      this.toolFailureCount++;
    }

    // Log tool result
    const event = events.toolResult(this.context, {
      toolName,
      durationMs,
      success,
    });
    this.options.logger.logEvent?.(event);

    // Record metrics
    this.options.metrics?.recordToolExecution({
      toolName,
      durationMs,
      success,
      agentId: this.options.agentId,
    });
  }

  /**
   * Record token usage
   */
  recordTokens(usage: {
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    reasoningTokens?: number;
  }): void {
    this.tokenUsage.inputTokens += usage.inputTokens || 0;
    this.tokenUsage.outputTokens += usage.outputTokens || 0;
    if (usage.cachedTokens) {
      this.tokenUsage.cachedTokens = (this.tokenUsage.cachedTokens || 0) + usage.cachedTokens;
    }
    if (usage.reasoningTokens) {
      this.tokenUsage.reasoningTokens = (this.tokenUsage.reasoningTokens || 0) + usage.reasoningTokens;
    }
  }

  /**
   * Log and record agent completion
   */
  completed(data: { finishReason?: string }): AgentRunMetrics {
    const durationMs = Date.now() - this.startTime;

    // Log completion event
    const event = events.agentCompleted(this.context, {
      agentName: this.options.agentName,
      durationMs,
      stepCount: this.stepCount,
      toolCallCount: this.toolCallCount,
      finishReason: data.finishReason,
    });
    this.options.logger.logEvent?.(event);

    // Build metrics
    const metrics: AgentRunMetrics = {
      agentId: this.options.agentId,
      runId: this.options.runId,
      durationMs,
      stepCount: this.stepCount,
      toolCallCount: this.toolCallCount,
      toolSuccessCount: this.toolSuccessCount,
      toolFailureCount: this.toolFailureCount,
      tokenUsage: this.tokenUsage,
      finishReason: data.finishReason,
      success: true,
    };

    // Record metrics
    this.options.metrics?.recordAgentRun(metrics);

    return metrics;
  }

  /**
   * Log and record agent error
   */
  error(error: Error & { id?: string; domain?: string; category?: string }): AgentRunMetrics {
    const durationMs = Date.now() - this.startTime;

    // Log error event
    const event = events.agentError(this.context, {
      agentName: this.options.agentName,
      errorId: error.id,
      errorDomain: error.domain,
      errorCategory: error.category,
      errorMessage: error.message,
      recoverable: false,
    });
    this.options.logger.logEvent?.(event);

    // Build metrics
    const metrics: AgentRunMetrics = {
      agentId: this.options.agentId,
      runId: this.options.runId,
      durationMs,
      stepCount: this.stepCount,
      toolCallCount: this.toolCallCount,
      toolSuccessCount: this.toolSuccessCount,
      toolFailureCount: this.toolFailureCount,
      tokenUsage: this.tokenUsage,
      success: false,
      errorType: error.name || 'Error',
    };

    // Record metrics
    this.options.metrics?.recordAgentRun(metrics);

    return metrics;
  }

  /**
   * Get the current log context
   */
  getContext(): LogContext {
    return this.context;
  }
}

// ============================================================================
// Workflow Instrumentation
// ============================================================================

export interface WorkflowInstrumentationOptions {
  logger: IMastraLogger;
  metrics?: IMetricsCollector;
  workflowId: string;
  workflowName: string;
  runId: string;
  tracingContext?: TracingContext;
}

/**
 * Tracks timing and metrics for a workflow run
 */
export class WorkflowRunTracker {
  private startTime: number;
  private stepsExecuted = 0;
  private stepsSucceeded = 0;
  private stepsFailed = 0;
  private stepsSuspended = 0;
  private context: LogContext;

  constructor(private options: WorkflowInstrumentationOptions) {
    this.startTime = Date.now();
    this.context = createLogContext({
      workflowId: options.workflowId,
      runId: options.runId,
      tracingContext: options.tracingContext,
    });
  }

  /**
   * Log workflow started event
   */
  started(data: { stepCount?: number }): void {
    const event = events.workflowStarted(this.context, {
      workflowName: this.options.workflowName,
      ...data,
    });
    this.options.logger.logEvent?.(event);
  }

  /**
   * Log step started
   */
  stepStarted(stepId: string, stepName?: string): void {
    const event = events.workflowStepStarted(this.context, {
      workflowName: this.options.workflowName,
      stepId,
      stepName,
    });
    this.options.logger.logEvent?.(event);
  }

  /**
   * Record step completion
   */
  stepCompleted(stepId: string, stepName: string | undefined, status: string, durationMs: number): void {
    this.stepsExecuted++;
    if (status === 'success' || status === 'completed') {
      this.stepsSucceeded++;
    } else if (status === 'failed' || status === 'error') {
      this.stepsFailed++;
    } else if (status === 'suspended') {
      this.stepsSuspended++;
    }

    const event = events.workflowStepCompleted(this.context, {
      workflowName: this.options.workflowName,
      stepId,
      stepName,
      durationMs,
      status,
    });
    this.options.logger.logEvent?.(event);
  }

  /**
   * Log and record workflow completion
   */
  completed(status: 'completed' | 'failed' | 'suspended'): WorkflowRunMetrics {
    const durationMs = Date.now() - this.startTime;

    // Log completion event
    const event = events.workflowCompleted(this.context, {
      workflowName: this.options.workflowName,
      durationMs,
      status,
      stepsExecuted: this.stepsExecuted,
    });
    this.options.logger.logEvent?.(event);

    // Build metrics
    const metrics: WorkflowRunMetrics = {
      workflowId: this.options.workflowId,
      runId: this.options.runId,
      durationMs,
      stepsExecuted: this.stepsExecuted,
      stepsSucceeded: this.stepsSucceeded,
      stepsFailed: this.stepsFailed,
      stepsSuspended: this.stepsSuspended,
      status,
      success: status === 'completed',
    };

    // Record metrics
    this.options.metrics?.recordWorkflowRun(metrics);

    return metrics;
  }

  /**
   * Get the current log context
   */
  getContext(): LogContext {
    return this.context;
  }
}

// ============================================================================
// Model Call Instrumentation
// ============================================================================

export interface ModelCallInstrumentationOptions {
  logger: IMastraLogger;
  metrics?: IMetricsCollector;
  model: string;
  provider?: string;
  agentId?: string;
  tracingContext?: TracingContext;
}

/**
 * Tracks a single model call
 */
export class ModelCallTracker {
  private startTime: number;
  private timeToFirstToken?: number;
  private context: LogContext;

  constructor(private options: ModelCallInstrumentationOptions) {
    this.startTime = Date.now();
    this.context = createLogContext({
      agentId: options.agentId,
      tracingContext: options.tracingContext,
    });
  }

  /**
   * Log model request
   */
  request(data: { messageCount: number; streaming: boolean; temperature?: number; maxTokens?: number }): void {
    const event = events.modelRequest(this.context, {
      model: this.options.model,
      provider: this.options.provider,
      ...data,
    });
    this.options.logger.logEvent?.(event);
  }

  /**
   * Record first token received (for streaming)
   */
  recordFirstToken(): void {
    if (this.timeToFirstToken === undefined) {
      this.timeToFirstToken = Date.now() - this.startTime;
    }
  }

  /**
   * Log model response/stream end
   */
  response(data: {
    inputTokens?: number;
    outputTokens?: number;
    finishReason?: string;
    cached?: boolean;
    isRetry?: boolean;
    retryAttempt?: number;
    isFallback?: boolean;
    fallbackFrom?: string;
  }): ModelCallMetrics {
    const durationMs = Date.now() - this.startTime;

    // Log response event
    const event = events.modelResponse(this.context, {
      model: this.options.model,
      provider: this.options.provider,
      durationMs,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      finishReason: data.finishReason,
      cached: data.cached,
    });
    this.options.logger.logEvent?.(event);

    // Build metrics
    const metrics: ModelCallMetrics = {
      model: this.options.model,
      provider: this.options.provider,
      durationMs,
      timeToFirstTokenMs: this.timeToFirstToken,
      tokenUsage: {
        inputTokens: data.inputTokens || 0,
        outputTokens: data.outputTokens || 0,
      },
      finishReason: data.finishReason,
      success: true,
      isRetry: data.isRetry || false,
      retryAttempt: data.retryAttempt,
      isFallback: data.isFallback || false,
      fallbackFrom: data.fallbackFrom,
      agentId: this.options.agentId,
    };

    // Record metrics
    this.options.metrics?.recordModelCall(metrics);

    return metrics;
  }

  /**
   * Log model error
   */
  error(error: Error): ModelCallMetrics {
    const durationMs = Date.now() - this.startTime;

    const metrics: ModelCallMetrics = {
      model: this.options.model,
      provider: this.options.provider,
      durationMs,
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
      success: false,
      isRetry: false,
      isFallback: false,
      agentId: this.options.agentId,
    };

    // Record metrics
    this.options.metrics?.recordModelCall(metrics);

    return metrics;
  }

  /**
   * Log retry
   */
  logRetry(attempt: number, maxRetries: number, reason: string): void {
    const event = events.modelRetry(this.context, {
      model: this.options.model,
      provider: this.options.provider,
      attempt,
      maxRetries,
      reason,
    });
    this.options.logger.logEvent?.(event);
  }

  /**
   * Log fallback
   */
  logFallback(toModel: string, reason: string): void {
    const event = events.modelFallback(this.context, {
      fromModel: this.options.model,
      toModel,
      reason,
    });
    this.options.logger.logEvent?.(event);
  }
}

// ============================================================================
// Tool Call Instrumentation
// ============================================================================

/**
 * Log and track a tool call
 */
export function logToolCall(logger: IMastraLogger, context: LogContext, toolName: string, toolType?: string): void {
  const event = events.toolCalled(context, {
    toolName,
    toolType,
  });
  logger.logEvent?.(event);
}

/**
 * Log and track a tool result
 */
export function logToolResult(
  logger: IMastraLogger,
  metrics: IMetricsCollector | undefined,
  context: LogContext,
  data: {
    toolName: string;
    toolType?: string;
    durationMs: number;
    success: boolean;
    errorMessage?: string;
    agentId?: string;
    workflowId?: string;
  },
): void {
  const event = events.toolResult(context, {
    toolName: data.toolName,
    toolType: data.toolType,
    durationMs: data.durationMs,
    success: data.success,
    errorMessage: data.errorMessage,
  });
  logger.logEvent?.(event);

  metrics?.recordToolExecution({
    toolName: data.toolName,
    toolType: data.toolType,
    durationMs: data.durationMs,
    success: data.success,
    errorMessage: data.errorMessage,
    agentId: data.agentId,
    workflowId: data.workflowId,
  });
}

// ============================================================================
// Memory Instrumentation
// ============================================================================

/**
 * Log memory retrieval
 */
export function logMemoryRetrieved(
  logger: IMastraLogger,
  context: LogContext,
  data: {
    strategy: 'history' | 'semantic' | 'working';
    messagesCount: number;
    durationMs: number;
  },
): void {
  const event = events.memoryRetrieved(context, data);
  logger.logEvent?.(event);
}

/**
 * Log memory save
 */
export function logMemorySaved(
  logger: IMastraLogger,
  context: LogContext,
  data: {
    messageCount: number;
    durationMs: number;
  },
): void {
  const event = events.memorySaved(context, data);
  logger.logEvent?.(event);
}

// ============================================================================
// HTTP Instrumentation
// ============================================================================

export interface HttpInstrumentationOptions {
  logger: IMastraLogger;
  metrics?: IMetricsCollector;
  direction: 'outbound' | 'inbound';
  source?: 'tool' | 'agent' | 'workflow' | 'mcp' | 'server' | 'integration';
  agentId?: string;
  workflowId?: string;
  tracingContext?: TracingContext;
}

/**
 * Tracks a single HTTP request
 */
export class HttpRequestTracker {
  private startTime: number;
  private context: LogContext;
  private method: string;
  private url: string;
  private host?: string;
  private path?: string;

  constructor(
    private options: HttpInstrumentationOptions,
    request: { method: string; url: string },
  ) {
    this.startTime = Date.now();
    this.method = request.method.toUpperCase();
    this.url = request.url;

    // Parse URL for host and path
    try {
      const parsed = new URL(request.url);
      this.host = parsed.host;
      this.path = parsed.pathname;
    } catch {
      // URL might be relative or invalid
      this.path = request.url;
    }

    this.context = createLogContext({
      agentId: options.agentId,
      workflowId: options.workflowId,
      tracingContext: options.tracingContext,
    });
  }

  /**
   * Log the outgoing request
   */
  logRequest(data?: { contentLength?: number; headers?: Record<string, string> }): void {
    const event = events.httpRequest(this.context, {
      method: this.method,
      url: this.url,
      host: this.host,
      path: this.path,
      direction: this.options.direction,
      source: this.options.source,
      contentLength: data?.contentLength,
      headers: data?.headers,
    });
    this.options.logger.logEvent?.(event);
  }

  /**
   * Log and record successful response
   */
  response(data: { statusCode: number; statusText?: string; contentLength?: number }): HttpRequestMetrics {
    const durationMs = Date.now() - this.startTime;
    const success = data.statusCode >= 200 && data.statusCode < 400;

    // Log response event
    const event = events.httpResponse(this.context, {
      method: this.method,
      url: this.url,
      host: this.host,
      path: this.path,
      direction: this.options.direction,
      source: this.options.source,
      statusCode: data.statusCode,
      statusText: data.statusText,
      durationMs,
      contentLength: data.contentLength,
      success,
    });
    this.options.logger.logEvent?.(event);

    // Build and record metrics
    const metrics: HttpRequestMetrics = {
      method: this.method,
      url: this.url,
      host: this.host,
      direction: this.options.direction,
      source: this.options.source,
      statusCode: data.statusCode,
      durationMs,
      success,
      responseSize: data.contentLength,
      agentId: this.options.agentId,
      workflowId: this.options.workflowId,
    };

    this.options.metrics?.recordHttpRequest(metrics);

    return metrics;
  }

  /**
   * Log and record error
   */
  error(error: Error): HttpRequestMetrics {
    const durationMs = Date.now() - this.startTime;

    // Log error event
    const event = events.httpError(this.context, {
      method: this.method,
      url: this.url,
      host: this.host,
      path: this.path,
      direction: this.options.direction,
      source: this.options.source,
      errorType: error.name,
      errorMessage: error.message,
      durationMs,
    });
    this.options.logger.logEvent?.(event);

    // Build and record metrics
    const metrics: HttpRequestMetrics = {
      method: this.method,
      url: this.url,
      host: this.host,
      direction: this.options.direction,
      source: this.options.source,
      statusCode: 0,
      durationMs,
      success: false,
      errorType: error.name,
      agentId: this.options.agentId,
      workflowId: this.options.workflowId,
    };

    this.options.metrics?.recordHttpRequest(metrics);

    return metrics;
  }
}

/**
 * Create an HTTP request tracker for outbound requests (to external APIs)
 */
export function trackOutboundRequest(
  logger: IMastraLogger,
  request: { method: string; url: string },
  options?: {
    metrics?: IMetricsCollector;
    source?: 'tool' | 'agent' | 'workflow' | 'mcp' | 'integration';
    agentId?: string;
    workflowId?: string;
    tracingContext?: TracingContext;
  },
): HttpRequestTracker {
  return new HttpRequestTracker(
    {
      logger,
      metrics: options?.metrics,
      direction: 'outbound',
      source: options?.source,
      agentId: options?.agentId,
      workflowId: options?.workflowId,
      tracingContext: options?.tracingContext,
    },
    request,
  );
}

/**
 * Create an HTTP request tracker for inbound requests (to Mastra server)
 */
export function trackInboundRequest(
  logger: IMastraLogger,
  request: { method: string; url: string },
  options?: {
    metrics?: IMetricsCollector;
    agentId?: string;
    workflowId?: string;
  },
): HttpRequestTracker {
  return new HttpRequestTracker(
    {
      logger,
      metrics: options?.metrics,
      direction: 'inbound',
      source: 'server',
      agentId: options?.agentId,
      workflowId: options?.workflowId,
    },
    request,
  );
}

/**
 * Simple function to log and record a completed HTTP request
 * Use this when you don't need the tracker pattern
 */
export function logHttpRequest(
  logger: IMastraLogger,
  metrics: IMetricsCollector | undefined,
  context: LogContext,
  data: {
    method: string;
    url: string;
    statusCode: number;
    durationMs: number;
    direction: 'outbound' | 'inbound';
    source?: 'tool' | 'agent' | 'workflow' | 'mcp' | 'server' | 'integration';
    success?: boolean;
    requestSize?: number;
    responseSize?: number;
    agentId?: string;
    workflowId?: string;
  },
): void {
  const success = data.success ?? (data.statusCode >= 200 && data.statusCode < 400);

  // Log response event
  const event = events.httpResponse(context, {
    method: data.method,
    url: data.url,
    direction: data.direction,
    source: data.source,
    statusCode: data.statusCode,
    durationMs: data.durationMs,
    contentLength: data.responseSize,
    success,
  });
  logger.logEvent?.(event);

  // Record metrics
  metrics?.recordHttpRequest({
    method: data.method,
    url: data.url,
    direction: data.direction,
    source: data.source,
    statusCode: data.statusCode,
    durationMs: data.durationMs,
    success,
    requestSize: data.requestSize,
    responseSize: data.responseSize,
    agentId: data.agentId,
    workflowId: data.workflowId,
  });
}

// ============================================================================
// Global Metrics Collector
// ============================================================================

let globalMetricsCollector: IMetricsCollector = new NoOpMetricsCollector();

/**
 * Set the global metrics collector
 */
export function setGlobalMetricsCollector(collector: IMetricsCollector): void {
  globalMetricsCollector = collector;
}

/**
 * Get the global metrics collector
 */
export function getGlobalMetricsCollector(): IMetricsCollector {
  return globalMetricsCollector;
}

// ============================================================================
// Agentic Instrumentation Types
// ============================================================================

/**
 * Context for agentic instrumentation - passed through execution paths
 */
export interface AgenticInstrumentationContext {
  /** Agent ID */
  agentId: string;
  /** Run ID for this execution */
  runId: string;
  /** Thread ID if using memory */
  threadId?: string;
  /** Resource ID if available */
  resourceId?: string;
  /** Trace ID for distributed tracing */
  traceId?: string;
  /** Parent span ID */
  spanId?: string;
}

/**
 * Step analysis for reasoning efficiency metrics
 */
export interface StepAnalysis {
  stepNumber: number;
  stepType: 'thinking' | 'action' | 'mixed';
  hasToolCalls: boolean;
  toolCallCount: number;
  toolNames: string[];
  durationMs: number;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens?: number;
  };
}

/**
 * Goal state analysis
 */
export interface GoalStateAnalysis {
  state: 'completed' | 'incomplete' | 'blocked' | 'failed' | 'abandoned';
  finishReason?: string;
  stepsCompleted: number;
  totalDurationMs: number;
  reason?: string;
}

/**
 * Comprehensive agent run completion metrics
 */
export interface AgentRunCompletion {
  context: AgenticInstrumentationContext;
  durationMs: number;
  stepCount: number;
  toolCallCount: number;
  toolSuccessCount: number;
  toolFailureCount: number;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
    reasoningTokens?: number;
  };
  finishReason?: string;
  success: boolean;
  errorType?: string;
  // Agentic-specific
  goalCompleted: boolean;
  guardrailTriggerCount: number;
  humanInterventionCount: number;
  backtrackCount: number;
  thinkingStepCount: number;
  actionStepCount: number;
  timeToFirstActionMs?: number;
}

// ============================================================================
// Guardrail Instrumentation
// ============================================================================

/**
 * Emit guardrail triggered event and record metrics
 */
export function emitGuardrailTriggered(options: {
  context: AgenticInstrumentationContext;
  processorId: string;
  processorName?: string;
  action: 'blocked' | 'warned' | 'modified' | 'retry';
  reason?: string;
  willRetry?: boolean;
  metadata?: Record<string, unknown>;
  logger?: IMastraLogger;
  metrics?: IMetricsCollector;
}): void {
  const {
    context,
    processorId,
    processorName,
    action,
    reason,
    willRetry,
    metadata,
    logger,
    metrics = getGlobalMetricsCollector(),
  } = options;

  const logContext: LogContext = {
    agentId: context.agentId,
    runId: context.runId,
    threadId: context.threadId,
    traceId: context.traceId,
    spanId: context.spanId,
  };

  // Emit structured log event
  if (logger) {
    const event = events.guardrailTriggered(logContext, {
      guardrailId: processorId,
      guardrailName: processorName,
      action,
      reason,
      willRetry,
      metadata,
    });
    logger.info(event.message, event);
  }

  // Record metrics
  const guardrailMetrics: GuardrailMetrics = {
    agentId: context.agentId,
    runId: context.runId,
    processorId,
    reason: reason || 'Unknown reason',
    willRetry: willRetry ?? false,
    metadata,
    timestamp: new Date(),
  };

  metrics.recordGuardrailTrigger(guardrailMetrics);
}

// ============================================================================
// Human Intervention Instrumentation
// ============================================================================

/**
 * Emit human approval requested event and record metrics
 */
export function emitHumanApprovalRequested(options: {
  context: AgenticInstrumentationContext;
  toolName: string;
  toolCallId: string;
  args?: unknown;
  reason?: string;
  logger?: IMastraLogger;
  metrics?: IMetricsCollector;
}): void {
  const { context, toolName, toolCallId, args, reason, logger, metrics = getGlobalMetricsCollector() } = options;

  const logContext: LogContext = {
    agentId: context.agentId,
    runId: context.runId,
    threadId: context.threadId,
    traceId: context.traceId,
    spanId: context.spanId,
  };

  // Emit structured log event
  if (logger) {
    const event = events.humanApprovalRequested(logContext, {
      toolName,
      toolCallId,
      args,
      reason,
    });
    logger.info(event.message, event);
  }

  // Record metrics
  const humanMetrics: HumanInterventionMetrics = {
    agentId: context.agentId,
    runId: context.runId,
    type: 'approval_requested',
    toolName,
    toolCallId,
    timestamp: new Date(),
  };

  metrics.recordHumanIntervention(humanMetrics);
}

/**
 * Emit human approval response event and record metrics
 */
export function emitHumanApprovalResponse(options: {
  context: AgenticInstrumentationContext;
  toolName: string;
  toolCallId: string;
  approved: boolean;
  waitTimeMs?: number;
  reason?: string;
  logger?: IMastraLogger;
  metrics?: IMetricsCollector;
}): void {
  const {
    context,
    toolName,
    toolCallId,
    approved,
    waitTimeMs,
    reason,
    logger,
    metrics = getGlobalMetricsCollector(),
  } = options;

  const logContext: LogContext = {
    agentId: context.agentId,
    runId: context.runId,
    threadId: context.threadId,
    traceId: context.traceId,
    spanId: context.spanId,
  };

  // Emit structured log event
  if (logger) {
    const event = events.humanApprovalResponse(logContext, {
      toolName,
      toolCallId,
      approved,
      waitTimeMs,
      reason,
    });
    logger.info(event.message, event);
  }

  // Record metrics
  const humanMetrics: HumanInterventionMetrics = {
    agentId: context.agentId,
    runId: context.runId,
    type: approved ? 'approved' : 'declined',
    toolName,
    toolCallId,
    waitTimeMs,
    timestamp: new Date(),
  };

  metrics.recordHumanIntervention(humanMetrics);
}

// ============================================================================
// Goal State Instrumentation
// ============================================================================

/**
 * Emit goal state event and record metrics
 */
export function emitGoalState(options: {
  context: AgenticInstrumentationContext;
  analysis: GoalStateAnalysis;
  logger?: IMastraLogger;
  metrics?: IMetricsCollector;
}): void {
  const { context, analysis, logger, metrics = getGlobalMetricsCollector() } = options;

  const logContext: LogContext = {
    agentId: context.agentId,
    runId: context.runId,
    threadId: context.threadId,
    traceId: context.traceId,
    spanId: context.spanId,
  };

  // Emit structured log event
  if (logger) {
    const event = events.goalState(logContext, {
      agentName: context.agentId,
      state: analysis.state,
      stepCount: analysis.stepsCompleted,
      durationMs: analysis.totalDurationMs,
      finishReason: analysis.finishReason,
    });
    logger.info(event.message, event);
  }

  // Record metrics
  const labels: MetricLabels = {
    agentId: context.agentId,
  };

  metrics.recordGoalState(analysis.state, labels);
}

/**
 * Analyze finish reason and determine goal state
 */
export function analyzeGoalState(
  finishReason: string | undefined,
  hasError: boolean,
  wasSuspended: boolean,
): GoalStateAnalysis['state'] {
  // Handle error/suspension overrides first
  if (hasError) {
    return 'failed';
  }
  if (wasSuspended) {
    return 'blocked';
  }

  // Use the classifyGoalState utility for the rest
  const result = classifyGoalState(finishReason);
  // Map 'unknown' to 'incomplete' for our purposes
  return result === 'unknown' ? 'incomplete' : result;
}

// ============================================================================
// Step Analysis Instrumentation
// ============================================================================

/**
 * Emit step analysis event and record metrics
 */
export function emitStepAnalysis(options: {
  context: AgenticInstrumentationContext;
  analysis: StepAnalysis;
  logger?: IMastraLogger;
  metrics?: IMetricsCollector;
}): void {
  const { context, analysis, logger, metrics = getGlobalMetricsCollector() } = options;

  const logContext: LogContext = {
    agentId: context.agentId,
    runId: context.runId,
    threadId: context.threadId,
    traceId: context.traceId,
    spanId: context.spanId,
  };

  // Emit structured log event
  if (logger) {
    const event = events.stepAnalysis(logContext, {
      stepIndex: analysis.stepNumber,
      stepType: analysis.stepType,
      toolCalls: analysis.toolNames,
      llmTimeMs: analysis.durationMs,
      toolTimeMs: 0,
      tokenUsage: analysis.tokenUsage,
    });
    logger.debug(event.message, event);
  }

  // Record metrics
  const labels: MetricLabels = {
    agentId: context.agentId,
    stepType: analysis.stepType,
  };

  // Record step duration
  metrics.recordHistogram(MetricNames.AGENT_RUN_DURATION, labels, analysis.durationMs);

  // Increment step type counters
  if (analysis.stepType === 'thinking') {
    metrics.incrementCounter(MetricNames.THINKING_STEPS, labels);
  } else if (analysis.stepType === 'action') {
    metrics.incrementCounter(MetricNames.ACTION_STEPS, labels);
  }
}

/**
 * Analyze a step to determine its type
 */
export function analyzeStep(options: {
  hasToolCalls: boolean;
  toolCallCount: number;
  toolNames: string[];
  hasReasoning: boolean;
  hasText: boolean;
}): 'thinking' | 'action' | 'mixed' {
  const { hasToolCalls, hasReasoning } = options;

  if (hasToolCalls && hasReasoning) {
    return 'mixed';
  } else if (hasToolCalls) {
    return 'action';
  } else {
    return 'thinking';
  }
}

// ============================================================================
// Backtrack Instrumentation
// ============================================================================

/**
 * Emit backtrack event and record metrics
 */
export function emitBacktrack(options: {
  context: AgenticInstrumentationContext;
  fromStep: number;
  toStep: number;
  reason: string;
  processorId?: string;
  logger?: IMastraLogger;
  metrics?: IMetricsCollector;
}): void {
  const { context, fromStep, reason, processorId, logger, metrics = getGlobalMetricsCollector() } = options;

  const logContext: LogContext = {
    agentId: context.agentId,
    runId: context.runId,
    threadId: context.threadId,
    traceId: context.traceId,
    spanId: context.spanId,
  };

  // Emit structured log event
  if (logger) {
    const event = events.backtrack(logContext, {
      agentName: context.agentId,
      fromStep,
      reason,
      processorId,
    });
    logger.info(event.message, event);
  }

  // Record metrics
  const labels: MetricLabels = {
    agentId: context.agentId,
  };

  metrics.incrementCounter(MetricNames.BACKTRACK_COUNT, labels);
}

// ============================================================================
// Run Completion Instrumentation
// ============================================================================

/**
 * Record comprehensive agent run completion metrics
 */
export function recordAgentRunCompletion(options: {
  completion: AgentRunCompletion;
  logger?: IMastraLogger;
  metrics?: IMetricsCollector;
}): void {
  const { completion, metrics = getGlobalMetricsCollector() } = options;

  metrics.recordAgentRun({
    agentId: completion.context.agentId,
    runId: completion.context.runId,
    durationMs: completion.durationMs,
    stepCount: completion.stepCount,
    toolCallCount: completion.toolCallCount,
    toolSuccessCount: completion.toolSuccessCount,
    toolFailureCount: completion.toolFailureCount,
    tokenUsage: completion.tokenUsage,
    finishReason: completion.finishReason,
    success: completion.success,
    errorType: completion.errorType,
    goalCompleted: completion.goalCompleted,
    guardrailTriggerCount: completion.guardrailTriggerCount,
    humanInterventionCount: completion.humanInterventionCount,
    backtrackCount: completion.backtrackCount,
    thinkingStepCount: completion.thinkingStepCount,
    actionStepCount: completion.actionStepCount,
    timeToFirstActionMs: completion.timeToFirstActionMs,
  });
}

// ============================================================================
// Agentic Run State Tracker
// ============================================================================

/**
 * Tracks agentic metrics during a run for later aggregation
 */
export class AgenticRunStateTracker {
  private context: AgenticInstrumentationContext;
  private startTime: number;
  private firstActionTime?: number;
  private stepCount = 0;
  private thinkingStepCount = 0;
  private actionStepCount = 0;
  private toolCallCount = 0;
  private toolSuccessCount = 0;
  private toolFailureCount = 0;
  private guardrailTriggerCount = 0;
  private humanInterventionCount = 0;
  private backtrackCount = 0;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private totalReasoningTokens = 0;
  private totalCachedTokens = 0;

  constructor(context: AgenticInstrumentationContext) {
    this.context = context;
    this.startTime = Date.now();
  }

  getContext(): AgenticInstrumentationContext {
    return this.context;
  }

  recordStep(analysis: StepAnalysis): void {
    this.stepCount++;

    if (analysis.stepType === 'thinking') {
      this.thinkingStepCount++;
    } else if (analysis.stepType === 'action') {
      this.actionStepCount++;
      if (!this.firstActionTime) {
        this.firstActionTime = Date.now();
      }
    } else {
      this.actionStepCount++;
      this.thinkingStepCount++;
      if (!this.firstActionTime) {
        this.firstActionTime = Date.now();
      }
    }

    this.toolCallCount += analysis.toolCallCount;

    if (analysis.tokenUsage) {
      this.totalInputTokens += analysis.tokenUsage.inputTokens;
      this.totalOutputTokens += analysis.tokenUsage.outputTokens;
      this.totalReasoningTokens += analysis.tokenUsage.reasoningTokens || 0;
    }
  }

  recordToolResult(success: boolean): void {
    if (success) {
      this.toolSuccessCount++;
    } else {
      this.toolFailureCount++;
    }
  }

  recordGuardrailTrigger(): void {
    this.guardrailTriggerCount++;
  }

  recordHumanIntervention(): void {
    this.humanInterventionCount++;
  }

  recordBacktrack(): void {
    this.backtrackCount++;
  }

  recordTokenUsage(usage: { inputTokens?: number; outputTokens?: number; cachedTokens?: number }): void {
    this.totalInputTokens += usage.inputTokens || 0;
    this.totalOutputTokens += usage.outputTokens || 0;
    this.totalCachedTokens += usage.cachedTokens || 0;
  }

  getCompletion(finishReason: string | undefined, success: boolean, errorType?: string): AgentRunCompletion {
    const endTime = Date.now();
    const durationMs = endTime - this.startTime;
    const timeToFirstActionMs = this.firstActionTime ? this.firstActionTime - this.startTime : undefined;

    return {
      context: this.context,
      durationMs,
      stepCount: this.stepCount,
      toolCallCount: this.toolCallCount,
      toolSuccessCount: this.toolSuccessCount,
      toolFailureCount: this.toolFailureCount,
      tokenUsage: {
        inputTokens: this.totalInputTokens,
        outputTokens: this.totalOutputTokens,
        cachedTokens: this.totalCachedTokens,
        reasoningTokens: this.totalReasoningTokens,
      },
      finishReason,
      success,
      errorType,
      goalCompleted: analyzeGoalState(finishReason, !success, false) === 'completed',
      guardrailTriggerCount: this.guardrailTriggerCount,
      humanInterventionCount: this.humanInterventionCount,
      backtrackCount: this.backtrackCount,
      thinkingStepCount: this.thinkingStepCount,
      actionStepCount: this.actionStepCount,
      timeToFirstActionMs,
    };
  }
}
