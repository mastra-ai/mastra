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
  | 'Notification';

export type BlockingHookEvent = 'PreToolUse' | 'Stop' | 'UserPromptSubmit';

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
}

// =============================================================================
// Stdin Protocol (JSON sent to hook process)
// =============================================================================

export interface HookStdinBase {
  session_id: string;
  cwd: string;
  hook_event_name: HookEventName;
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

export type HookStdin =
  | HookStdinToolEvent
  | HookStdinUserPrompt
  | HookStdinStop
  | HookStdinSession
  | HookStdinNotification;

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
