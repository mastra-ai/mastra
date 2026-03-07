/**
 * Event listener that receives agent events.
 */
export type AgentEventListener = (event: AgentEvent) => void | Promise<void>;

/**
 * Map of event type to its payload, used for typed `on()` overloads.
 */
export interface AgentEventMap {
  // Orchestration
  mode_changed: AgentModeChangedEvent;
  model_changed: AgentModelChangedEvent;
  state_changed: AgentStateChangedEvent;

  // Streaming lifecycle
  send_start: AgentSendStartEvent;
  send_end: AgentSendEndEvent;

  // Message
  message_start: AgentMessageStartEvent;
  message_update: AgentMessageUpdateEvent;
  message_end: AgentMessageEndEvent;

  // Tool
  tool_start: AgentToolStartEvent;
  tool_end: AgentToolEndEvent;
  tool_input_start: AgentToolInputStartEvent;
  tool_input_delta: AgentToolInputDeltaEvent;
  tool_input_end: AgentToolInputEndEvent;
  tool_approval_required: AgentToolApprovalRequiredEvent;

  // Usage
  usage_update: AgentUsageUpdateEvent;

  // Error
  error: AgentErrorEvent;
}

// ---------------------------------------------------------------------------
// Orchestration events
// ---------------------------------------------------------------------------

export interface AgentModeChangedEvent {
  type: 'mode_changed';
  modeId: string;
  previousModeId: string;
}

export interface AgentModelChangedEvent {
  type: 'model_changed';
  modelId: string;
  scope?: 'global' | 'mode';
  modeId?: string;
}

export interface AgentStateChangedEvent {
  type: 'state_changed';
  state: Record<string, unknown>;
  changedKeys: string[];
}

// ---------------------------------------------------------------------------
// Streaming lifecycle events
// ---------------------------------------------------------------------------

export interface AgentSendStartEvent {
  type: 'send_start';
}

export interface AgentSendEndEvent {
  type: 'send_end';
  reason: 'complete' | 'aborted' | 'error';
}

// ---------------------------------------------------------------------------
// Message events
// ---------------------------------------------------------------------------

export interface AgentMessageContent {
  type: 'text' | 'thinking' | 'tool_call' | 'tool_result';
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  args?: unknown;
  result?: unknown;
  isError?: boolean;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: AgentMessageContent[];
  createdAt: Date;
  stopReason?: 'complete' | 'tool_use' | 'aborted' | 'error';
}

export interface AgentMessageStartEvent {
  type: 'message_start';
  message: AgentMessage;
}

export interface AgentMessageUpdateEvent {
  type: 'message_update';
  message: AgentMessage;
}

export interface AgentMessageEndEvent {
  type: 'message_end';
  message: AgentMessage;
}

// ---------------------------------------------------------------------------
// Tool events
// ---------------------------------------------------------------------------

export interface AgentToolStartEvent {
  type: 'tool_start';
  toolCallId: string;
  toolName: string;
  args: unknown;
}

export interface AgentToolEndEvent {
  type: 'tool_end';
  toolCallId: string;
  result: unknown;
  isError: boolean;
}

export interface AgentToolInputStartEvent {
  type: 'tool_input_start';
  toolCallId: string;
  toolName: string;
}

export interface AgentToolInputDeltaEvent {
  type: 'tool_input_delta';
  toolCallId: string;
  argsTextDelta: string;
  toolName?: string;
}

export interface AgentToolInputEndEvent {
  type: 'tool_input_end';
  toolCallId: string;
}

export interface AgentToolApprovalRequiredEvent {
  type: 'tool_approval_required';
  toolCallId: string;
  toolName: string;
  args: unknown;
}

// ---------------------------------------------------------------------------
// Usage events
// ---------------------------------------------------------------------------

export interface AgentUsageUpdateEvent {
  type: 'usage_update';
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

// ---------------------------------------------------------------------------
// Error events
// ---------------------------------------------------------------------------

export interface AgentErrorEvent {
  type: 'error';
  error: Error;
  errorType?: string;
  retryable?: boolean;
}

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

/**
 * Union of all events the Agent can emit.
 */
export type AgentEvent =
  | AgentModeChangedEvent
  | AgentModelChangedEvent
  | AgentStateChangedEvent
  | AgentSendStartEvent
  | AgentSendEndEvent
  | AgentMessageStartEvent
  | AgentMessageUpdateEvent
  | AgentMessageEndEvent
  | AgentToolStartEvent
  | AgentToolEndEvent
  | AgentToolInputStartEvent
  | AgentToolInputDeltaEvent
  | AgentToolInputEndEvent
  | AgentToolApprovalRequiredEvent
  | AgentUsageUpdateEvent
  | AgentErrorEvent;
