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
  TokenUsage,
} from './metrics';
import { NoOpMetricsCollector } from './metrics';

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
  started(data: {
    model?: string;
    maxSteps?: number;
    toolCount?: number;
    hasMemory?: boolean;
  }): void {
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
  recordTokens(usage: { inputTokens?: number; outputTokens?: number; cachedTokens?: number; reasoningTokens?: number }): void {
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
  request(data: {
    messageCount: number;
    streaming: boolean;
    temperature?: number;
    maxTokens?: number;
  }): void {
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
export function logToolCall(
  logger: IMastraLogger,
  context: LogContext,
  toolName: string,
  toolType?: string,
): void {
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
