/**
 * Structured Log Events for Agentic Applications
 *
 * These event types represent meaningful occurrences during agent, workflow,
 * and tool execution. All events are structured and correlatable.
 */

import type { LogLevel } from './constants';

// ============================================================================
// Correlation Context
// ============================================================================

/**
 * Context for correlating logs, metrics, and traces.
 * All log events should include this context when available.
 */
export interface LogContext {
  /** OpenTelemetry-compatible trace ID */
  traceId?: string;
  /** Current span ID */
  spanId?: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Agent ID if event is agent-related */
  agentId?: string;
  /** Workflow ID if event is workflow-related */
  workflowId?: string;
  /** Workflow run ID */
  runId?: string;
  /** Thread/conversation ID for memory */
  threadId?: string;
  /** User/resource ID */
  resourceId?: string;
  /** Session ID for grouping related runs */
  sessionId?: string;
}

// ============================================================================
// Base Event Types
// ============================================================================

/**
 * Base interface for all structured log events
 */
export interface BaseLogEvent {
  /** Event category for filtering/routing */
  category: LogEventCategory;
  /** Event name (e.g., 'agent.started', 'tool.called') */
  event: string;
  /** Log level */
  level: LogLevel;
  /** Correlation context */
  context: LogContext;
  /** Event timestamp */
  timestamp: Date;
  /** Human-readable message */
  message: string;
  /** Event-specific data */
  data?: Record<string, unknown>;
}

/**
 * Categories for log events - used for filtering and routing
 */
export type LogEventCategory =
  | 'lifecycle' // Agent/workflow state transitions
  | 'model' // LLM operations
  | 'tool' // Tool executions
  | 'memory' // Memory operations
  | 'decision' // Agent decision points
  | 'resource' // Resource consumption (tokens, cost)
  | 'quality' // Quality signals (scores, feedback)
  | 'http' // HTTP requests and responses
  | 'guardrail' // Guardrail/tripwire triggers
  | 'human' // Human-in-the-loop interactions
  | 'error'; // Errors and failures

// ============================================================================
// Lifecycle Events
// ============================================================================

export interface AgentStartedEvent extends BaseLogEvent {
  category: 'lifecycle';
  event: 'agent.started';
  data: {
    agentName: string;
    model?: string;
    maxSteps?: number;
    toolCount?: number;
    hasMemory?: boolean;
  };
}

export interface AgentCompletedEvent extends BaseLogEvent {
  category: 'lifecycle';
  event: 'agent.completed';
  data: {
    agentName: string;
    durationMs: number;
    stepCount: number;
    toolCallCount: number;
    finishReason?: string;
  };
}

export interface AgentErrorEvent extends BaseLogEvent {
  category: 'error';
  event: 'agent.error';
  data: {
    agentName: string;
    errorId?: string;
    errorDomain?: string;
    errorCategory?: string;
    errorMessage: string;
    recoverable: boolean;
  };
}

export interface WorkflowStartedEvent extends BaseLogEvent {
  category: 'lifecycle';
  event: 'workflow.started';
  data: {
    workflowName: string;
    stepCount?: number;
  };
}

export interface WorkflowCompletedEvent extends BaseLogEvent {
  category: 'lifecycle';
  event: 'workflow.completed';
  data: {
    workflowName: string;
    durationMs: number;
    status: string;
    stepsExecuted: number;
  };
}

export interface WorkflowStepStartedEvent extends BaseLogEvent {
  category: 'lifecycle';
  event: 'workflow.step.started';
  data: {
    workflowName: string;
    stepId: string;
    stepName?: string;
  };
}

export interface WorkflowStepCompletedEvent extends BaseLogEvent {
  category: 'lifecycle';
  event: 'workflow.step.completed';
  data: {
    workflowName: string;
    stepId: string;
    stepName?: string;
    durationMs: number;
    status: string;
  };
}

export interface WorkflowSuspendedEvent extends BaseLogEvent {
  category: 'lifecycle';
  event: 'workflow.suspended';
  data: {
    workflowName: string;
    stepId: string;
    reason?: string;
  };
}

export interface WorkflowResumedEvent extends BaseLogEvent {
  category: 'lifecycle';
  event: 'workflow.resumed';
  data: {
    workflowName: string;
    stepId: string;
  };
}

// ============================================================================
// Model Events
// ============================================================================

export interface ModelRequestEvent extends BaseLogEvent {
  category: 'model';
  event: 'model.request';
  data: {
    model: string;
    provider?: string;
    messageCount: number;
    streaming: boolean;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface ModelResponseEvent extends BaseLogEvent {
  category: 'model';
  event: 'model.response';
  data: {
    model: string;
    provider?: string;
    durationMs: number;
    inputTokens?: number;
    outputTokens?: number;
    finishReason?: string;
    cached?: boolean;
  };
}

export interface ModelStreamStartEvent extends BaseLogEvent {
  category: 'model';
  event: 'model.stream.start';
  data: {
    model: string;
    provider?: string;
  };
}

export interface ModelStreamEndEvent extends BaseLogEvent {
  category: 'model';
  event: 'model.stream.end';
  data: {
    model: string;
    provider?: string;
    durationMs: number;
    timeToFirstTokenMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    finishReason?: string;
  };
}

export interface ModelRetryEvent extends BaseLogEvent {
  category: 'model';
  event: 'model.retry';
  data: {
    model: string;
    provider?: string;
    attempt: number;
    maxRetries: number;
    reason: string;
  };
}

export interface ModelFallbackEvent extends BaseLogEvent {
  category: 'model';
  event: 'model.fallback';
  data: {
    fromModel: string;
    toModel: string;
    reason: string;
  };
}

// ============================================================================
// Tool Events
// ============================================================================

export interface ToolCalledEvent extends BaseLogEvent {
  category: 'tool';
  event: 'tool.called';
  data: {
    toolName: string;
    toolType?: string;
    inputPreview?: string;
  };
}

export interface ToolResultEvent extends BaseLogEvent {
  category: 'tool';
  event: 'tool.result';
  data: {
    toolName: string;
    toolType?: string;
    durationMs: number;
    success: boolean;
    outputPreview?: string;
    errorMessage?: string;
  };
}

export interface ToolApprovalRequestedEvent extends BaseLogEvent {
  category: 'tool';
  event: 'tool.approval.requested';
  data: {
    toolName: string;
    inputPreview?: string;
  };
}

export interface ToolApprovalResultEvent extends BaseLogEvent {
  category: 'tool';
  event: 'tool.approval.result';
  data: {
    toolName: string;
    approved: boolean;
    durationMs: number;
  };
}

export interface McpToolCalledEvent extends BaseLogEvent {
  category: 'tool';
  event: 'mcp.tool.called';
  data: {
    toolName: string;
    serverName: string;
    serverVersion?: string;
  };
}

export interface McpToolResultEvent extends BaseLogEvent {
  category: 'tool';
  event: 'mcp.tool.result';
  data: {
    toolName: string;
    serverName: string;
    durationMs: number;
    success: boolean;
    errorMessage?: string;
  };
}

// ============================================================================
// Memory Events
// ============================================================================

export interface MemoryRetrievedEvent extends BaseLogEvent {
  category: 'memory';
  event: 'memory.retrieved';
  data: {
    strategy: 'history' | 'semantic' | 'working';
    messagesCount: number;
    durationMs: number;
  };
}

export interface MemorySavedEvent extends BaseLogEvent {
  category: 'memory';
  event: 'memory.saved';
  data: {
    messageCount: number;
    durationMs: number;
  };
}

export interface MemorySemanticSearchEvent extends BaseLogEvent {
  category: 'memory';
  event: 'memory.semantic.search';
  data: {
    query?: string;
    resultsCount: number;
    durationMs: number;
  };
}

// ============================================================================
// Decision Events
// ============================================================================

export interface DecisionMadeEvent extends BaseLogEvent {
  category: 'decision';
  event: 'decision.made';
  data: {
    decisionType: 'tool_selection' | 'response' | 'delegation' | 'branch';
    decision: string;
    alternatives?: string[];
    confidence?: number;
  };
}

export interface GuardrailTriggeredEvent extends BaseLogEvent {
  category: 'decision';
  event: 'guardrail.triggered';
  data: {
    /** Guardrail/processor ID */
    guardrailId: string;
    guardrailName?: string;
    /** Action taken */
    action: 'blocked' | 'warned' | 'modified' | 'retry';
    /** Reason for trigger */
    reason?: string;
    /** Whether the agent will retry */
    willRetry?: boolean;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
  };
}

// ============================================================================
// Resource Events
// ============================================================================

export interface TokenUsageEvent extends BaseLogEvent {
  category: 'resource';
  event: 'resource.tokens';
  data: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedTokens?: number;
    reasoningTokens?: number;
  };
}

export interface CostIncurredEvent extends BaseLogEvent {
  category: 'resource';
  event: 'resource.cost';
  data: {
    costUSD: number;
    costType: 'model' | 'tool' | 'total';
    breakdown?: {
      model?: string;
      inputCost?: number;
      outputCost?: number;
    };
  };
}

// ============================================================================
// Quality Events
// ============================================================================

export interface ScoreComputedEvent extends BaseLogEvent {
  category: 'quality';
  event: 'quality.score';
  data: {
    scorerName: string;
    score: number;
    maxScore?: number;
    reason?: string;
  };
}

export interface FeedbackReceivedEvent extends BaseLogEvent {
  category: 'quality';
  event: 'quality.feedback';
  data: {
    feedbackType: 'thumbsUp' | 'thumbsDown' | 'rating' | 'correction' | 'comment';
    value?: number | string | boolean;
  };
}

// ============================================================================
// HTTP Events
// ============================================================================

export interface HttpRequestEvent extends BaseLogEvent {
  category: 'http';
  event: 'http.request';
  data: {
    method: string;
    url: string;
    host?: string;
    path?: string;
    /** Request direction: outbound (to external API) or inbound (to Mastra server) */
    direction: 'outbound' | 'inbound';
    /** What initiated this request */
    source?: 'tool' | 'agent' | 'workflow' | 'mcp' | 'server' | 'integration';
    /** Content length in bytes */
    contentLength?: number;
    /** Request headers (sanitized - no auth) */
    headers?: Record<string, string>;
  };
}

export interface HttpResponseEvent extends BaseLogEvent {
  category: 'http';
  event: 'http.response';
  data: {
    method: string;
    url: string;
    host?: string;
    path?: string;
    direction: 'outbound' | 'inbound';
    source?: 'tool' | 'agent' | 'workflow' | 'mcp' | 'server' | 'integration';
    statusCode: number;
    statusText?: string;
    durationMs: number;
    /** Response content length in bytes */
    contentLength?: number;
    /** Whether the request was successful (2xx) */
    success: boolean;
  };
}

export interface HttpErrorEvent extends BaseLogEvent {
  category: 'http';
  event: 'http.error';
  data: {
    method: string;
    url: string;
    host?: string;
    path?: string;
    direction: 'outbound' | 'inbound';
    source?: 'tool' | 'agent' | 'workflow' | 'mcp' | 'server' | 'integration';
    statusCode?: number;
    errorType: string;
    errorMessage: string;
    durationMs: number;
  };
}

// ============================================================================
// Agentic Events (Unique to AI Agents)
// ============================================================================

export interface GoalStateEvent extends BaseLogEvent {
  category: 'lifecycle';
  event: 'agent.goal';
  data: {
    agentName: string;
    state: 'completed' | 'incomplete' | 'blocked' | 'failed' | 'abandoned';
    finishReason?: string;
    stepCount: number;
    durationMs: number;
  };
}

export interface HumanApprovalRequestedEvent extends BaseLogEvent {
  category: 'human';
  event: 'human.approval_requested';
  data: {
    toolName: string;
    toolCallId: string;
    args?: Record<string, unknown>;
  };
}

export interface HumanApprovalResponseEvent extends BaseLogEvent {
  category: 'human';
  event: 'human.approval_response';
  data: {
    toolName: string;
    toolCallId: string;
    approved: boolean;
    waitTimeMs: number;
  };
}

export interface BacktrackEvent extends BaseLogEvent {
  category: 'lifecycle';
  event: 'agent.backtrack';
  data: {
    agentName: string;
    reason: string;
    fromStep: number;
    processorId?: string;
  };
}

export interface StepAnalysisEvent extends BaseLogEvent {
  category: 'lifecycle';
  event: 'agent.step';
  data: {
    stepIndex: number;
    stepType: 'thinking' | 'action' | 'mixed';
    llmTimeMs: number;
    toolTimeMs: number;
    toolCalls: string[];
    finishReason?: string;
  };
}

// ============================================================================
// Error Events
// ============================================================================

export interface RateLimitEvent extends BaseLogEvent {
  category: 'error';
  event: 'error.rate_limit';
  data: {
    provider: string;
    retryAfterMs?: number;
    endpoint?: string;
  };
}

export interface TimeoutEvent extends BaseLogEvent {
  category: 'error';
  event: 'error.timeout';
  data: {
    operation: string;
    timeoutMs: number;
  };
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * All lifecycle events
 */
export type LifecycleEvent =
  | AgentStartedEvent
  | AgentCompletedEvent
  | WorkflowStartedEvent
  | WorkflowCompletedEvent
  | WorkflowStepStartedEvent
  | WorkflowStepCompletedEvent
  | WorkflowSuspendedEvent
  | WorkflowResumedEvent;

/**
 * All model events
 */
export type ModelEvent =
  | ModelRequestEvent
  | ModelResponseEvent
  | ModelStreamStartEvent
  | ModelStreamEndEvent
  | ModelRetryEvent
  | ModelFallbackEvent;

/**
 * All tool events
 */
export type ToolEvent =
  | ToolCalledEvent
  | ToolResultEvent
  | ToolApprovalRequestedEvent
  | ToolApprovalResultEvent
  | McpToolCalledEvent
  | McpToolResultEvent;

/**
 * All memory events
 */
export type MemoryEvent = MemoryRetrievedEvent | MemorySavedEvent | MemorySemanticSearchEvent;

/**
 * All decision events
 */
export type DecisionEvent = DecisionMadeEvent | GuardrailTriggeredEvent;

/**
 * All resource events
 */
export type ResourceEvent = TokenUsageEvent | CostIncurredEvent;

/**
 * All quality events
 */
export type QualityEvent = ScoreComputedEvent | FeedbackReceivedEvent;

/**
 * All HTTP events
 */
export type HttpEvent = HttpRequestEvent | HttpResponseEvent | HttpErrorEvent;

/**
 * All human-in-the-loop events
 */
export type HumanEvent = HumanApprovalRequestedEvent | HumanApprovalResponseEvent;

/**
 * All agentic-specific events (unique to AI agents)
 */
export type AgenticEvent = HumanEvent | GoalStateEvent | BacktrackEvent | StepAnalysisEvent;

/**
 * All error events (beyond AgentErrorEvent)
 */
export type ErrorEvent = AgentErrorEvent | RateLimitEvent | TimeoutEvent;

/**
 * Union of all structured log events
 */
export type AgentLogEvent =
  | LifecycleEvent
  | ModelEvent
  | ToolEvent
  | MemoryEvent
  | DecisionEvent
  | ResourceEvent
  | QualityEvent
  | HttpEvent
  | AgenticEvent
  | ErrorEvent;

// ============================================================================
// Event Builder Helpers
// ============================================================================

/**
 * Creates a base event with common fields populated
 */
export function createBaseEvent(
  category: LogEventCategory,
  event: string,
  level: LogLevel,
  message: string,
  context: LogContext = {},
): BaseLogEvent {
  return {
    category,
    event,
    level,
    message,
    context,
    timestamp: new Date(),
  };
}
