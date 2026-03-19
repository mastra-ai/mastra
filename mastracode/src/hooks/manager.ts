/**
 * HookManager — high-level orchestration for the hooks system.
 * Created once at startup, provides methods for each lifecycle event.
 */
import { loadHooksConfig, getProjectHooksPath, getGlobalHooksPath } from './config.js';
import { runHooksForEvent } from './executor.js';
import type {
  HooksConfig,
  HookEventResult,
  HookStdinToolEvent,
  HookStdinUserPrompt,
  HookStdinStop,
  HookStdinSession,
  HookStdinNotification,
} from './types.js';

export class HookManager {
  private config: HooksConfig;
  private projectDir: string;
  private sessionId: string;

  constructor(projectDir: string, sessionId: string) {
    this.projectDir = projectDir;
    this.sessionId = sessionId;
    this.config = loadHooksConfig(projectDir);
  }

  reload(): void {
    this.config = loadHooksConfig(this.projectDir);
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  hasHooks(): boolean {
    return Object.keys(this.config).length > 0;
  }

  getConfig(): HooksConfig {
    return this.config;
  }

  getConfigPaths(): { project: string; global: string } {
    return {
      project: getProjectHooksPath(this.projectDir),
      global: getGlobalHooksPath(),
    };
  }

  // =========================================================================
  // Event Methods
  // =========================================================================

  async runPreToolUse(toolName: string, toolInput: unknown): Promise<HookEventResult> {
    const hooks = this.config.PreToolUse;
    if (!hooks || hooks.length === 0) {
      return { allowed: true, results: [], warnings: [] };
    }

    const stdin: HookStdinToolEvent = {
      session_id: this.sessionId,
      cwd: this.projectDir,
      hook_event_name: 'PreToolUse',
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
      return { allowed: true, results: [], warnings: [] };
    }

    const stdin: HookStdinToolEvent = {
      session_id: this.sessionId,
      cwd: this.projectDir,
      hook_event_name: 'PostToolUse',
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
      return { allowed: true, results: [], warnings: [] };
    }

    const stdin: HookStdinUserPrompt = {
      session_id: this.sessionId,
      cwd: this.projectDir,
      hook_event_name: 'UserPromptSubmit',
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
      return { allowed: true, results: [], warnings: [] };
    }

    const stdin: HookStdinStop = {
      session_id: this.sessionId,
      cwd: this.projectDir,
      hook_event_name: 'Stop',
      assistant_message: assistantMessage,
      stop_reason: stopReason,
    };

    return runHooksForEvent(hooks, stdin);
  }

  async runSessionStart(): Promise<HookEventResult> {
    const hooks = this.config.SessionStart;
    if (!hooks || hooks.length === 0) {
      return { allowed: true, results: [], warnings: [] };
    }

    const stdin: HookStdinSession = {
      session_id: this.sessionId,
      cwd: this.projectDir,
      hook_event_name: 'SessionStart',
    };

    return runHooksForEvent(hooks, stdin);
  }
  async runSessionEnd(): Promise<HookEventResult> {
    const hooks = this.config.SessionEnd;
    if (!hooks || hooks.length === 0) {
      return { allowed: true, results: [], warnings: [] };
    }

    const stdin: HookStdinSession = {
      session_id: this.sessionId,
      cwd: this.projectDir,
      hook_event_name: 'SessionEnd',
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
      session_id: this.sessionId,
      cwd: this.projectDir,
      hook_event_name: 'Notification',
      reason,
      message,
    };

    // Fire-and-forget — don't await
    runHooksForEvent(hooks, stdin).catch(() => {});
  }
}
