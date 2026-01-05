/**
 * Agentic Instrumentation - Metrics and logging for agent execution
 *
 * This module provides instrumentation hooks for collecting agentic-specific metrics
 * from within the agent execution paths (AgenticLoopWorkflow, ToolCallStep, ProcessorRunner).
 */

import type { IMetricsCollector, GuardrailMetrics, HumanInterventionMetrics, MetricLabels } from './metrics';
import { MetricNames, classifyGoalState } from './metrics';
import { getGlobalMetricsCollector } from './instrumentation';
import * as logEvents from '../logger/event-builder';
import type { LogContext } from '../logger/events';
import type { IMastraLogger } from '../logger';

// ============================================================================
// Types
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
    const event = logEvents.guardrailTriggered(logContext, {
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
    const event = logEvents.humanApprovalRequested(logContext, {
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
    const event = logEvents.humanApprovalResponse(logContext, {
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
    const event = logEvents.goalState(logContext, {
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
    const event = logEvents.stepAnalysis(logContext, {
      stepIndex: analysis.stepNumber,
      stepType: analysis.stepType,
      toolCalls: analysis.toolNames,
      llmTimeMs: analysis.durationMs, // Approximate as total duration
      toolTimeMs: 0, // Would need to track separately
      tokenUsage: analysis.tokenUsage,
    });
    logger.debug(event.message, event);
  }

  // Record metrics
  const labels: MetricLabels = {
    agentId: context.agentId,
    stepType: analysis.stepType,
  };

  // Record step duration using the appropriate metric name
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
    const event = logEvents.backtrack(logContext, {
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

/**
 * Record comprehensive agent run completion metrics
 */
export function recordAgentRunCompletion(options: {
  completion: AgentRunCompletion;
  logger?: IMastraLogger;
  metrics?: IMetricsCollector;
}): void {
  const { completion, metrics = getGlobalMetricsCollector() } = options;

  // Use the IMetricsCollector.recordAgentRun method for comprehensive recording
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
    // Agentic-specific
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
// Run State Tracker
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
      // mixed
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
