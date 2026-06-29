/**
 * HookManager — high-level orchestration for the hooks system.
 * Created once at startup, provides methods for each lifecycle event.
 */
import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { loadHooksConfig, getProjectHooksPath, getGlobalHooksPath } from './config.js';
import { runHooksForEvent } from './executor.js';
import type {
  HooksConfig,
  HookEventResult,
  HookEventName,
  HookStdinToolEvent,
  HookStdinUserPrompt,
  HookStdinStop,
  HookStdinSession,
  HookStdinNotification,
  HookStdinAgentStart,
  HookStdinAgentEnd,
  HookStdinPermissionRequest,
  HookStdinPermissionResult,
  HookStdinInterrupt,
  HookStdinSubagentStart,
  HookStdinSubagentEnd,
  PermissionKind,
  PermissionDecision,
  InterruptReason,
} from './types.js';

const EMPTY_RESULT: HookEventResult = { allowed: true, results: [], warnings: [] };

export class HookManager {
  private config: HooksConfig;
  private projectDir: string;
  private sessionId: string;
  private configDirName: string;
  private homeDir?: string;
  private runId?: string;

  constructor(projectDir: string, sessionId: string, configDirName = DEFAULT_CONFIG_DIR, homeDir?: string) {
    this.projectDir = projectDir;
    this.sessionId = sessionId;
    this.configDirName = configDirName;
    this.homeDir = homeDir;
    this.config = loadHooksConfig(projectDir, configDirName, homeDir);
  }

  reload(): void {
    this.config = loadHooksConfig(this.projectDir, this.configDirName, this.homeDir);
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /** Set the active agent run id. Included as `run_id` in all hook stdin while a run is active. */
  setRunId(runId: string): void {
    this.runId = runId;
  }

  /** Clear the active run id. Call only after end-of-run hooks (AgentEnd, Stop) have been dispatched. */
  clearRunId(): void {
    this.runId = undefined;
  }

  getRunId(): string | undefined {
    return this.runId;
  }

  hasHooks(): boolean {
    return Object.keys(this.config).length > 0;
  }

  getConfig(): HooksConfig {
    return this.config;
  }

  getConfigPaths(): { project: string; global: string } {
    return {
      project: getProjectHooksPath(this.projectDir, this.configDirName),
      global: getGlobalHooksPath(this.configDirName, this.homeDir),
    };
  }

  // =========================================================================
  // Stdin Helpers
  // =========================================================================

  /**
   * Build the common stdin base fields. `run_id` is included when an active run
   * is set, so every event dispatched during a run carries the same identifier.
   */
  private baseStdinFields<T extends HookEventName>(
    hook_event_name: T,
  ): {
    session_id: string;
    cwd: string;
    hook_event_name: T;
    run_id?: string;
  } {
    const base: { session_id: string; cwd: string; hook_event_name: T; run_id?: string } = {
      session_id: this.sessionId,
      cwd: this.projectDir,
      hook_event_name,
    };
    if (this.runId) base.run_id = this.runId;
    return base;
  }

  // =========================================================================
  // Blocking Event Methods (decisions enforced by callers)
  // =========================================================================

  async runPreToolUse(toolName: string, toolInput: unknown): Promise<HookEventResult> {
    const hooks = this.config.PreToolUse;
    if (!hooks || hooks.length === 0) {
      return EMPTY_RESULT;
    }

    const stdin: HookStdinToolEvent = {
      ...this.baseStdinFields('PreToolUse'),
      tool_name: toolName,
      tool_input: toolInput,
    };

    return runHooksForEvent(hooks, stdin, { tool_name: toolName });
  }

  async runPostToolUse(
    toolName: string,
    toolInput: unknown,
    toolOutput: unknown,
    toolError: boolean,
  ): Promise<HookEventResult> {
    const hooks = this.config.PostToolUse;
    if (!hooks || hooks.length === 0) {
      return EMPTY_RESULT;
    }

    const stdin: HookStdinToolEvent = {
      ...this.baseStdinFields('PostToolUse'),
      tool_name: toolName,
      tool_input: toolInput,
      tool_output: toolOutput,
      tool_error: toolError,
    };

    return runHooksForEvent(hooks, stdin, { tool_name: toolName });
  }

  async runUserPromptSubmit(userMessage: string): Promise<HookEventResult> {
    const hooks = this.config.UserPromptSubmit;
    if (!hooks || hooks.length === 0) {
      return EMPTY_RESULT;
    }

    const stdin: HookStdinUserPrompt = {
      ...this.baseStdinFields('UserPromptSubmit'),
      user_message: userMessage,
    };

    return runHooksForEvent(hooks, stdin);
  }

  async runStop(
    assistantMessage: string | undefined,
    stopReason: 'complete' | 'aborted' | 'error',
  ): Promise<HookEventResult> {
    const hooks = this.config.Stop;
    if (!hooks || hooks.length === 0) {
      return EMPTY_RESULT;
    }

    const stdin: HookStdinStop = {
      ...this.baseStdinFields('Stop'),
      assistant_message: assistantMessage,
      stop_reason: stopReason,
    };

    return runHooksForEvent(hooks, stdin);
  }

  async runSessionStart(): Promise<HookEventResult> {
    const hooks = this.config.SessionStart;
    if (!hooks || hooks.length === 0) {
      return EMPTY_RESULT;
    }

    const stdin: HookStdinSession = {
      ...this.baseStdinFields('SessionStart'),
    };

    return runHooksForEvent(hooks, stdin);
  }
  async runSessionEnd(): Promise<HookEventResult> {
    const hooks = this.config.SessionEnd;
    if (!hooks || hooks.length === 0) {
      return EMPTY_RESULT;
    }

    const stdin: HookStdinSession = {
      ...this.baseStdinFields('SessionEnd'),
    };

    return runHooksForEvent(hooks, stdin);
  }

  /**
   * Fire notification hooks (non-blocking, fire-and-forget).
   * Called when the TUI is waiting for user input.
   */
  runNotification(reason: string, message?: string): void {
    const hooks = this.config.Notification;
    if (!hooks || hooks.length === 0) return;

    const stdin: HookStdinNotification = {
      ...this.baseStdinFields('Notification'),
      reason,
      message,
    };

    // Fire-and-forget — don't await
    runHooksForEvent(hooks, stdin).catch(() => {});
  }

  // =========================================================================
  // Lifecycle Event Methods (non-blocking: observe behavior, never enforce)
  // =========================================================================

  async runAgentStart(): Promise<HookEventResult> {
    const hooks = this.config.AgentStart;
    if (!hooks || hooks.length === 0) {
      return EMPTY_RESULT;
    }
    const runId = this.runId;
    if (!runId) {
      return EMPTY_RESULT;
    }

    const stdin: HookStdinAgentStart = {
      ...this.baseStdinFields('AgentStart'),
      run_id: runId,
    };

    return runHooksForEvent(hooks, stdin);
  }

  async runAgentEnd(stopReason: 'complete' | 'aborted' | 'error' | 'suspended'): Promise<HookEventResult> {
    const hooks = this.config.AgentEnd;
    if (!hooks || hooks.length === 0) {
      return EMPTY_RESULT;
    }
    const runId = this.runId;
    if (!runId) {
      return EMPTY_RESULT;
    }

    const stdin: HookStdinAgentEnd = {
      ...this.baseStdinFields('AgentEnd'),
      run_id: runId,
      stop_reason: stopReason,
    };

    return runHooksForEvent(hooks, stdin);
  }

  async runPermissionRequest(
    permissionKind: PermissionKind,
    toolCallId: string,
    toolName: string,
    toolInput?: unknown,
  ): Promise<HookEventResult> {
    const hooks = this.config.PermissionRequest;
    if (!hooks || hooks.length === 0) {
      return EMPTY_RESULT;
    }
    const runId = this.runId;
    if (!runId) {
      return EMPTY_RESULT;
    }

    const stdin: HookStdinPermissionRequest = {
      ...this.baseStdinFields('PermissionRequest'),
      run_id: runId,
      permission_kind: permissionKind,
      tool_call_id: toolCallId,
      tool_name: toolName,
      ...(toolInput !== undefined ? { tool_input: toolInput } : {}),
    };

    return runHooksForEvent(hooks, stdin);
  }

  async runPermissionResult(
    permissionKind: PermissionKind,
    toolCallId: string,
    toolName: string,
    decision: PermissionDecision,
    toolInput?: unknown,
  ): Promise<HookEventResult> {
    const hooks = this.config.PermissionResult;
    if (!hooks || hooks.length === 0) {
      return EMPTY_RESULT;
    }

    const stdin: HookStdinPermissionResult = {
      ...this.baseStdinFields('PermissionResult'),
      permission_kind: permissionKind,
      tool_call_id: toolCallId,
      tool_name: toolName,
      decision,
      ...(toolInput !== undefined ? { tool_input: toolInput } : {}),
    };

    return runHooksForEvent(hooks, stdin);
  }

  async runInterrupt(reason: InterruptReason): Promise<HookEventResult> {
    const hooks = this.config.Interrupt;
    if (!hooks || hooks.length === 0) {
      return EMPTY_RESULT;
    }

    const stdin: HookStdinInterrupt = {
      ...this.baseStdinFields('Interrupt'),
      reason,
    };

    return runHooksForEvent(hooks, stdin);
  }

  async runSubagentStart(
    toolCallId: string,
    agentType: string,
    task: string,
    modelId?: string,
    forked?: boolean,
  ): Promise<HookEventResult> {
    const hooks = this.config.SubagentStart;
    if (!hooks || hooks.length === 0) {
      return EMPTY_RESULT;
    }
    const runId = this.runId;
    if (!runId) {
      return EMPTY_RESULT;
    }

    const stdin: HookStdinSubagentStart = {
      ...this.baseStdinFields('SubagentStart'),
      run_id: runId,
      tool_call_id: toolCallId,
      agent_type: agentType,
      task,
      ...(modelId !== undefined ? { model_id: modelId } : {}),
      ...(forked !== undefined ? { forked } : {}),
    };

    return runHooksForEvent(hooks, stdin);
  }

  async runSubagentEnd(
    toolCallId: string,
    agentType: string,
    result: unknown,
    isError: boolean,
    durationMs: number,
  ): Promise<HookEventResult> {
    const hooks = this.config.SubagentEnd;
    if (!hooks || hooks.length === 0) {
      return EMPTY_RESULT;
    }
    const runId = this.runId;
    if (!runId) {
      return EMPTY_RESULT;
    }

    const stdin: HookStdinSubagentEnd = {
      ...this.baseStdinFields('SubagentEnd'),
      run_id: runId,
      tool_call_id: toolCallId,
      agent_type: agentType,
      result,
      is_error: isError,
      duration_ms: durationMs,
    };

    return runHooksForEvent(hooks, stdin);
  }
}
