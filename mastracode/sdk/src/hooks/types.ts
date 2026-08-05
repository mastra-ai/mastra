/**
 * Type definitions for the hooks system.
 * Hooks are user-configured shell commands that run at lifecycle events.
 */

// =============================================================================
// Hook Event Names
// =============================================================================
export type HookEventName =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Stop'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Notification'
  | 'AgentStart'
  | 'AgentEnd'
  | 'PermissionRequest'
  | 'PermissionResult'
  | 'Interrupt'
  | 'SubagentStart'
  | 'SubagentEnd';

export type BlockingHookEvent = 'PreToolUse' | 'Stop' | 'UserPromptSubmit';

/** Lifecycle hook events are non-blocking: they observe behavior without changing it. */
export type LifecycleHookEvent =
  | 'AgentStart'
  | 'AgentEnd'
  | 'PermissionRequest'
  | 'PermissionResult'
  | 'Interrupt'
  | 'SubagentStart'
  | 'SubagentEnd';

export function isBlockingEvent(event: HookEventName): event is BlockingHookEvent {
  return event === 'PreToolUse' || event === 'Stop' || event === 'UserPromptSubmit';
}

// =============================================================================
// Hook Configuration
// =============================================================================

export interface HookMatcher {
  /** Regex pattern matched against tool_name (PreToolUse/PostToolUse only). */
  tool_name?: string;
}

export interface HookDefinition {
  /** Hook type. Only "command" supported in phase 1. */
  type: 'command';
  /** Shell command to execute via /bin/sh -c. */
  command: string;
  /** Optional matcher to filter when this hook runs. */
  matcher?: HookMatcher;
  /** Timeout in ms. Default 10000. Process killed after timeout. */
  timeout?: number;
  /** Human-readable description for /hooks display. */
  description?: string;
}
export interface HooksConfig {
  PreToolUse?: HookDefinition[];
  PostToolUse?: HookDefinition[];
  Stop?: HookDefinition[];
  UserPromptSubmit?: HookDefinition[];
  SessionStart?: HookDefinition[];
  SessionEnd?: HookDefinition[];
  Notification?: HookDefinition[];
  AgentStart?: HookDefinition[];
  AgentEnd?: HookDefinition[];
  PermissionRequest?: HookDefinition[];
  PermissionResult?: HookDefinition[];
  Interrupt?: HookDefinition[];
  SubagentStart?: HookDefinition[];
  SubagentEnd?: HookDefinition[];
}

// =============================================================================
// Stdin Protocol (JSON sent to hook process)
// =============================================================================

export interface HookStdinBase {
  session_id: string;
  cwd: string;
  hook_event_name: HookEventName;
  /**
   * Stable MastraCode-generated id for the active agent run. Present on events
   * emitted while a run is active (AgentStart..AgentEnd, tool hooks, Stop).
   * Absent outside a run (SessionStart, SessionEnd, Notification fired idle).
   */
  run_id?: string;
}

export interface HookStdinToolEvent extends HookStdinBase {
  hook_event_name: 'PreToolUse' | 'PostToolUse';
  tool_name: string;
  tool_input: unknown;
  tool_output?: unknown;
  tool_error?: boolean;
}

export interface HookStdinUserPrompt extends HookStdinBase {
  hook_event_name: 'UserPromptSubmit';
  user_message: string;
}

export interface HookStdinStop extends HookStdinBase {
  hook_event_name: 'Stop';
  assistant_message?: string;
  stop_reason: 'complete' | 'aborted' | 'error';
}
export interface HookStdinSession extends HookStdinBase {
  hook_event_name: 'SessionStart' | 'SessionEnd';
}

export interface HookStdinNotification extends HookStdinBase {
  hook_event_name: 'Notification';
  /** Why the notification fired: agent_done, ask_question, tool_approval, plan_approval, sandbox_access */
  reason: string;
  /** Optional human-readable message for the notification. */
  message?: string;
}

export interface HookStdinAgentStart extends HookStdinBase {
  hook_event_name: 'AgentStart';
  run_id: string;
}

export interface HookStdinAgentEnd extends HookStdinBase {
  hook_event_name: 'AgentEnd';
  run_id: string;
  stop_reason: 'complete' | 'aborted' | 'error' | 'suspended';
}

export type PermissionKind = 'tool_approval' | 'sandbox_access' | 'plan_approval';

export interface HookStdinPermissionRequest extends HookStdinBase {
  hook_event_name: 'PermissionRequest';
  run_id: string;
  permission_kind: PermissionKind;
  tool_call_id: string;
  tool_name: string;
  tool_input?: unknown;
}

export type PermissionDecision = 'approved' | 'declined' | 'dismissed' | 'auto_approved' | 'auto_declined';

export interface HookStdinPermissionResult extends HookStdinBase {
  hook_event_name: 'PermissionResult';
  run_id: string;
  permission_kind: PermissionKind;
  tool_call_id: string;
  tool_name: string;
  tool_input?: unknown;
  decision: PermissionDecision;
}

export type InterruptReason = 'user_interrupt' | 'goal_judge_interrupt' | 'process_sigint';

export interface HookStdinInterrupt extends HookStdinBase {
  hook_event_name: 'Interrupt';
  run_id: string;
  reason: InterruptReason;
}

export interface HookStdinSubagentStart extends HookStdinBase {
  hook_event_name: 'SubagentStart';
  run_id: string;
  tool_call_id: string;
  agent_type: string;
  task: string;
  model_id?: string;
  forked?: boolean;
}

export interface HookStdinSubagentEnd extends HookStdinBase {
  hook_event_name: 'SubagentEnd';
  run_id: string;
  tool_call_id: string;
  agent_type: string;
  result: unknown;
  is_error: boolean;
  duration_ms: number;
}

export type HookStdin =
  | HookStdinToolEvent
  | HookStdinUserPrompt
  | HookStdinStop
  | HookStdinSession
  | HookStdinNotification
  | HookStdinAgentStart
  | HookStdinAgentEnd
  | HookStdinPermissionRequest
  | HookStdinPermissionResult
  | HookStdinInterrupt
  | HookStdinSubagentStart
  | HookStdinSubagentEnd;

// =============================================================================
// Stdout Protocol (JSON read from hook process)
// =============================================================================

export interface HookStdout {
  decision?: 'allow' | 'block';
  reason?: string;
  additionalContext?: string;
}

// =============================================================================
// Execution Results
// =============================================================================

export interface HookResult {
  hook: HookDefinition;
  exitCode: number;
  stdout?: HookStdout;
  stderr?: string;
  timedOut: boolean;
  durationMs: number;
}

export interface HookEventResult {
  allowed: boolean;
  blockReason?: string;
  additionalContext?: string;
  results: HookResult[];
  warnings: string[];
}
