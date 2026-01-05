/**
 * Event Builder Helpers
 *
 * Provides convenient factory functions for creating structured log events
 * with proper typing and defaults.
 */

import { LogLevel } from './constants';
import type {
  AgentLogEvent,
  LogContext,
  AgentStartedEvent,
  AgentCompletedEvent,
  AgentErrorEvent,
  WorkflowStartedEvent,
  WorkflowCompletedEvent,
  WorkflowStepStartedEvent,
  WorkflowStepCompletedEvent,
  ModelRequestEvent,
  ModelResponseEvent,
  ModelStreamStartEvent,
  ModelStreamEndEvent,
  ModelRetryEvent,
  ModelFallbackEvent,
  ToolCalledEvent,
  ToolResultEvent,
  MemoryRetrievedEvent,
  MemorySavedEvent,
  TokenUsageEvent,
  CostIncurredEvent,
  ScoreComputedEvent,
  DecisionMadeEvent,
  GuardrailTriggeredEvent,
  RateLimitEvent,
  TimeoutEvent,
} from './events';

// ============================================================================
// Agent Events
// ============================================================================

export function agentStarted(
  context: LogContext,
  data: AgentStartedEvent['data'],
): AgentStartedEvent {
  return {
    category: 'lifecycle',
    event: 'agent.started',
    level: LogLevel.INFO,
    context,
    timestamp: new Date(),
    message: `Agent ${data.agentName} started`,
    data,
  };
}

export function agentCompleted(
  context: LogContext,
  data: AgentCompletedEvent['data'],
): AgentCompletedEvent {
  return {
    category: 'lifecycle',
    event: 'agent.completed',
    level: LogLevel.INFO,
    context,
    timestamp: new Date(),
    message: `Agent ${data.agentName} completed in ${data.durationMs}ms with ${data.stepCount} steps`,
    data,
  };
}

export function agentError(
  context: LogContext,
  data: AgentErrorEvent['data'],
): AgentErrorEvent {
  return {
    category: 'error',
    event: 'agent.error',
    level: LogLevel.ERROR,
    context,
    timestamp: new Date(),
    message: `Agent ${data.agentName} error: ${data.errorMessage}`,
    data,
  };
}

// ============================================================================
// Workflow Events
// ============================================================================

export function workflowStarted(
  context: LogContext,
  data: WorkflowStartedEvent['data'],
): WorkflowStartedEvent {
  return {
    category: 'lifecycle',
    event: 'workflow.started',
    level: LogLevel.INFO,
    context,
    timestamp: new Date(),
    message: `Workflow ${data.workflowName} started`,
    data,
  };
}

export function workflowCompleted(
  context: LogContext,
  data: WorkflowCompletedEvent['data'],
): WorkflowCompletedEvent {
  return {
    category: 'lifecycle',
    event: 'workflow.completed',
    level: LogLevel.INFO,
    context,
    timestamp: new Date(),
    message: `Workflow ${data.workflowName} ${data.status} in ${data.durationMs}ms`,
    data,
  };
}

export function workflowStepStarted(
  context: LogContext,
  data: WorkflowStepStartedEvent['data'],
): WorkflowStepStartedEvent {
  return {
    category: 'lifecycle',
    event: 'workflow.step.started',
    level: LogLevel.DEBUG,
    context,
    timestamp: new Date(),
    message: `Step ${data.stepName || data.stepId} started`,
    data,
  };
}

export function workflowStepCompleted(
  context: LogContext,
  data: WorkflowStepCompletedEvent['data'],
): WorkflowStepCompletedEvent {
  return {
    category: 'lifecycle',
    event: 'workflow.step.completed',
    level: LogLevel.DEBUG,
    context,
    timestamp: new Date(),
    message: `Step ${data.stepName || data.stepId} ${data.status} in ${data.durationMs}ms`,
    data,
  };
}

// ============================================================================
// Model Events
// ============================================================================

export function modelRequest(
  context: LogContext,
  data: ModelRequestEvent['data'],
): ModelRequestEvent {
  return {
    category: 'model',
    event: 'model.request',
    level: LogLevel.DEBUG,
    context,
    timestamp: new Date(),
    message: `Model request to ${data.model} with ${data.messageCount} messages`,
    data,
  };
}

export function modelResponse(
  context: LogContext,
  data: ModelResponseEvent['data'],
): ModelResponseEvent {
  const tokens = data.inputTokens && data.outputTokens
    ? ` (${data.inputTokens}+${data.outputTokens} tokens)`
    : '';
  return {
    category: 'model',
    event: 'model.response',
    level: LogLevel.DEBUG,
    context,
    timestamp: new Date(),
    message: `Model response from ${data.model} in ${data.durationMs}ms${tokens}`,
    data,
  };
}

export function modelStreamStart(
  context: LogContext,
  data: ModelStreamStartEvent['data'],
): ModelStreamStartEvent {
  return {
    category: 'model',
    event: 'model.stream.start',
    level: LogLevel.DEBUG,
    context,
    timestamp: new Date(),
    message: `Stream started from ${data.model}`,
    data,
  };
}

export function modelStreamEnd(
  context: LogContext,
  data: ModelStreamEndEvent['data'],
): ModelStreamEndEvent {
  const ttft = data.timeToFirstTokenMs ? ` (TTFT: ${data.timeToFirstTokenMs}ms)` : '';
  return {
    category: 'model',
    event: 'model.stream.end',
    level: LogLevel.DEBUG,
    context,
    timestamp: new Date(),
    message: `Stream ended from ${data.model} in ${data.durationMs}ms${ttft}`,
    data,
  };
}

export function modelRetry(
  context: LogContext,
  data: ModelRetryEvent['data'],
): ModelRetryEvent {
  return {
    category: 'model',
    event: 'model.retry',
    level: LogLevel.WARN,
    context,
    timestamp: new Date(),
    message: `Retrying ${data.model} (attempt ${data.attempt}/${data.maxRetries}): ${data.reason}`,
    data,
  };
}

export function modelFallback(
  context: LogContext,
  data: ModelFallbackEvent['data'],
): ModelFallbackEvent {
  return {
    category: 'model',
    event: 'model.fallback',
    level: LogLevel.WARN,
    context,
    timestamp: new Date(),
    message: `Falling back from ${data.fromModel} to ${data.toModel}: ${data.reason}`,
    data,
  };
}

// ============================================================================
// Tool Events
// ============================================================================

export function toolCalled(
  context: LogContext,
  data: ToolCalledEvent['data'],
): ToolCalledEvent {
  return {
    category: 'tool',
    event: 'tool.called',
    level: LogLevel.INFO,
    context,
    timestamp: new Date(),
    message: `Tool ${data.toolName} called`,
    data,
  };
}

export function toolResult(
  context: LogContext,
  data: ToolResultEvent['data'],
): ToolResultEvent {
  const status = data.success ? 'succeeded' : 'failed';
  return {
    category: 'tool',
    event: 'tool.result',
    level: data.success ? LogLevel.INFO : LogLevel.WARN,
    context,
    timestamp: new Date(),
    message: `Tool ${data.toolName} ${status} in ${data.durationMs}ms`,
    data,
  };
}

// ============================================================================
// Memory Events
// ============================================================================

export function memoryRetrieved(
  context: LogContext,
  data: MemoryRetrievedEvent['data'],
): MemoryRetrievedEvent {
  return {
    category: 'memory',
    event: 'memory.retrieved',
    level: LogLevel.DEBUG,
    context,
    timestamp: new Date(),
    message: `Retrieved ${data.messagesCount} messages via ${data.strategy} in ${data.durationMs}ms`,
    data,
  };
}

export function memorySaved(
  context: LogContext,
  data: MemorySavedEvent['data'],
): MemorySavedEvent {
  return {
    category: 'memory',
    event: 'memory.saved',
    level: LogLevel.DEBUG,
    context,
    timestamp: new Date(),
    message: `Saved ${data.messageCount} messages in ${data.durationMs}ms`,
    data,
  };
}

// ============================================================================
// Resource Events
// ============================================================================

export function tokenUsage(
  context: LogContext,
  data: TokenUsageEvent['data'],
): TokenUsageEvent {
  return {
    category: 'resource',
    event: 'resource.tokens',
    level: LogLevel.DEBUG,
    context,
    timestamp: new Date(),
    message: `Token usage: ${data.inputTokens} in, ${data.outputTokens} out (${data.totalTokens} total)`,
    data,
  };
}

export function costIncurred(
  context: LogContext,
  data: CostIncurredEvent['data'],
): CostIncurredEvent {
  return {
    category: 'resource',
    event: 'resource.cost',
    level: LogLevel.INFO,
    context,
    timestamp: new Date(),
    message: `Cost: $${data.costUSD.toFixed(4)} (${data.costType})`,
    data,
  };
}

// ============================================================================
// Quality Events
// ============================================================================

export function scoreComputed(
  context: LogContext,
  data: ScoreComputedEvent['data'],
): ScoreComputedEvent {
  return {
    category: 'quality',
    event: 'quality.score',
    level: LogLevel.INFO,
    context,
    timestamp: new Date(),
    message: `Score ${data.scorerName}: ${data.score}${data.maxScore ? `/${data.maxScore}` : ''}`,
    data,
  };
}

// ============================================================================
// Decision Events
// ============================================================================

export function decisionMade(
  context: LogContext,
  data: DecisionMadeEvent['data'],
): DecisionMadeEvent {
  return {
    category: 'decision',
    event: 'decision.made',
    level: LogLevel.DEBUG,
    context,
    timestamp: new Date(),
    message: `Decision (${data.decisionType}): ${data.decision}`,
    data,
  };
}

export function guardrailTriggered(
  context: LogContext,
  data: GuardrailTriggeredEvent['data'],
): GuardrailTriggeredEvent {
  return {
    category: 'decision',
    event: 'guardrail.triggered',
    level: data.action === 'blocked' ? LogLevel.WARN : LogLevel.INFO,
    context,
    timestamp: new Date(),
    message: `Guardrail ${data.guardrailName || data.guardrailId} ${data.action}`,
    data,
  };
}

// ============================================================================
// Error Events
// ============================================================================

export function rateLimitHit(
  context: LogContext,
  data: RateLimitEvent['data'],
): RateLimitEvent {
  return {
    category: 'error',
    event: 'error.rate_limit',
    level: LogLevel.WARN,
    context,
    timestamp: new Date(),
    message: `Rate limit hit for ${data.provider}${data.retryAfterMs ? `, retry after ${data.retryAfterMs}ms` : ''}`,
    data,
  };
}

export function timeout(
  context: LogContext,
  data: TimeoutEvent['data'],
): TimeoutEvent {
  return {
    category: 'error',
    event: 'error.timeout',
    level: LogLevel.ERROR,
    context,
    timestamp: new Date(),
    message: `Timeout in ${data.operation} after ${data.timeoutMs}ms`,
    data,
  };
}

// ============================================================================
// Generic Event Builder
// ============================================================================

/**
 * Create a generic log event when specific builders don't fit
 */
export function createEvent(
  category: AgentLogEvent['category'],
  event: string,
  level: LogLevel,
  message: string,
  context: LogContext = {},
  data?: Record<string, unknown>,
): AgentLogEvent {
  return {
    category,
    event,
    level,
    message,
    context,
    timestamp: new Date(),
    data,
  } as AgentLogEvent;
}
