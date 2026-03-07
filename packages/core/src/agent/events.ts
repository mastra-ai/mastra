/**
 * Event listener that receives agent events.
 */
export type AgentEventListener = (event: AgentEvent) => void | Promise<void>;

/**
 * Map of event type to its payload, used for typed `on()` overloads.
 */
export interface AgentEventMap {
  mode_changed: AgentModeChangedEvent;
  model_changed: AgentModelChangedEvent;
  state_changed: AgentStateChangedEvent;
  error: AgentErrorEvent;
}

// ---------------------------------------------------------------------------
// Individual event types
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

export interface AgentErrorEvent {
  type: 'error';
  error: Error;
  errorType?: string;
}

/**
 * Union of all events the Agent can emit.
 * This set will grow as more orchestration features are added.
 */
export type AgentEvent = AgentModeChangedEvent | AgentModelChangedEvent | AgentStateChangedEvent | AgentErrorEvent;
