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
  SessionStartSource,
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
  SessionWorktreeInfo,
} from './types.js';

const emptyResult = (): HookEventResult => ({ allowed: true, results: [], warnings: [] });

export class HookManager {
  private config: HooksConfig;
  private projectDir: string;
  private sessionId: string;
  private configDirName: string;
  private homeDir?: string;
  private runId?: string;
  private worktree?: SessionWorktreeInfo;
  /** True once SessionStart has fired, so later thread binds announce themselves. */
  private sessionStarted = false;
  /** A thread-change SessionStart still running; other events wait for it so hooks see the new session first. */
  private pendingSessionStart?: Promise<unknown>;

  constructor(
    projectDir: string,
    sessionId: string,
    configDirName = DEFAULT_CONFIG_DIR,
    homeDir?: string,
    worktree?: SessionWorktreeInfo,
  ) {
    this.worktree = worktree;
    this.projectDir = projectDir;
    this.sessionId = sessionId;
    this.configDirName = configDirName;
    this.homeDir = homeDir;
    this.config = loadHooksConfig(projectDir, configDirName, homeDir);
  }

  reload(): void {
    this.config = loadHooksConfig(this.projectDir, this.configDirName, this.homeDir);
  }

  /**
   * Bind hooks to a thread. After SessionStart has fired, binding a different thread
   * (the first message creating one, `/new`, a resumed thread) fires SessionStart again
   * with `source: 'thread_change'`, so a hook that tracks sessions learns the new id
   * before any event of that thread reaches it.
   */
  setSessionId(sessionId: string): void {
    if (sessionId === this.sessionId) return;
    this.sessionId = sessionId;
    if (this.sessionStarted) {
      const run = this.runSessionStart('thread_change').catch(() => {});
      this.pendingSessionStart = run;
      void run.finally(() => {
        if (this.pendingSessionStart === run) this.pendingSessionStart = undefined;
      });
    }
  }

  /** Dispatch an event's hooks once a pending thread-change SessionStart has finished. */
  private async dispatch(...args: Parameters<typeof runHooksForEvent>): Promise<HookEventResult> {
    if (this.pendingSessionStart) await this.pendingSessionStart;
    return runHooksForEvent(...args);
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

  /**
   * Session stdin, carrying worktree identity when there is one. Emitted on both
   * session events so a hook that provisions on start can tear down on end using
   * the same fields.
   */
  private sessionStdin(hook_event_name: 'SessionStart' | 'SessionEnd', source?: SessionStartSource): HookStdinSession {
    const stdin: HookStdinSession = this.baseStdinFields(hook_event_name);
    if (source) stdin.source = source;
    if (this.worktree) {
      stdin.worktree_path = this.worktree.path;
      if (this.worktree.branch) stdin.branch = this.worktree.branch;
      if (this.worktree.mainRepoPath) stdin.main_repo_path = this.worktree.mainRepoPath;
    }
    return stdin;
  }

  // =========================================================================
  // Blocking Event Methods (decisions enforced by callers)
  // =========================================================================

  async runPreToolUse(toolName: string, toolInput: unknown): Promise<HookEventResult> {
    const hooks = this.config.PreToolUse;
    if (!hooks || hooks.length === 0) {
      return emptyResult();
    }

    const stdin: HookStdinToolEvent = {
      ...this.baseStdinFields('PreToolUse'),
      tool_name: toolName,
      tool_input: toolInput,
    };

    return this.dispatch(hooks, stdin, { tool_name: toolName });
  }

  async runPostToolUse(
    toolName: string,
    toolInput: unknown,
    toolOutput: unknown,
    toolError: boolean,
  ): Promise<HookEventResult> {
    const hooks = this.config.PostToolUse;
    if (!hooks || hooks.length === 0) {
      return emptyResult();
    }

    const stdin: HookStdinToolEvent = {
      ...this.baseStdinFields('PostToolUse'),
      tool_name: toolName,
      tool_input: toolInput,
      tool_output: toolOutput,
      tool_error: toolError,
    };

    return this.dispatch(hooks, stdin, { tool_name: toolName });
  }

  async runUserPromptSubmit(userMessage: string): Promise<HookEventResult> {
    const hooks = this.config.UserPromptSubmit;
    if (!hooks || hooks.length === 0) {
      return emptyResult();
    }

    const stdin: HookStdinUserPrompt = {
      ...this.baseStdinFields('UserPromptSubmit'),
      user_message: userMessage,
    };

    return this.dispatch(hooks, stdin);
  }

  async runStop(
    assistantMessage: string | undefined,
    stopReason: 'complete' | 'aborted' | 'error',
  ): Promise<HookEventResult> {
    const hooks = this.config.Stop;
    if (!hooks || hooks.length === 0) {
      return emptyResult();
    }

    const stdin: HookStdinStop = {
      ...this.baseStdinFields('Stop'),
      assistant_message: assistantMessage,
      stop_reason: stopReason,
    };

    return this.dispatch(hooks, stdin);
  }

  async runSessionStart(source: SessionStartSource = 'startup'): Promise<HookEventResult> {
    this.sessionStarted = true;
    const hooks = this.config.SessionStart;
    if (!hooks || hooks.length === 0) {
      return emptyResult();
    }

    const stdin: HookStdinSession = this.sessionStdin('SessionStart', source);

    return runHooksForEvent(hooks, stdin);
  }
  async runSessionEnd(): Promise<HookEventResult> {
    const hooks = this.config.SessionEnd;
    if (!hooks || hooks.length === 0) {
      return emptyResult();
    }

    const stdin: HookStdinSession = this.sessionStdin('SessionEnd');

    return this.dispatch(hooks, stdin);
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
    this.dispatch(hooks, stdin).catch(() => {});
  }

  // =========================================================================
  // Lifecycle Event Methods (non-blocking: observe behavior, never enforce)
  // =========================================================================

  async runAgentStart(): Promise<HookEventResult> {
    const hooks = this.config.AgentStart;
    if (!hooks || hooks.length === 0) {
      return emptyResult();
    }
    const runId = this.runId;
    if (!runId) {
      return emptyResult();
    }

    const stdin: HookStdinAgentStart = {
      ...this.baseStdinFields('AgentStart'),
      run_id: runId,
    };

    return this.dispatch(hooks, stdin);
  }

  async runAgentEnd(stopReason: 'complete' | 'aborted' | 'error' | 'suspended'): Promise<HookEventResult> {
    const hooks = this.config.AgentEnd;
    if (!hooks || hooks.length === 0) {
      return emptyResult();
    }
    const runId = this.runId;
    if (!runId) {
      return emptyResult();
    }

    const stdin: HookStdinAgentEnd = {
      ...this.baseStdinFields('AgentEnd'),
      run_id: runId,
      stop_reason: stopReason,
    };

    return this.dispatch(hooks, stdin);
  }

  async runPermissionRequest(
    permissionKind: PermissionKind,
    toolCallId: string,
    toolName: string,
    toolInput?: unknown,
  ): Promise<HookEventResult> {
    const hooks = this.config.PermissionRequest;
    if (!hooks || hooks.length === 0) {
      return emptyResult();
    }
    const runId = this.runId;
    if (!runId) {
      return emptyResult();
    }

    const stdin: HookStdinPermissionRequest = {
      ...this.baseStdinFields('PermissionRequest'),
      run_id: runId,
      permission_kind: permissionKind,
      tool_call_id: toolCallId,
      tool_name: toolName,
      ...(toolInput !== undefined ? { tool_input: toolInput } : {}),
    };

    return this.dispatch(hooks, stdin);
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
      return emptyResult();
    }

    const runId = this.runId;
    if (!runId) {
      return emptyResult();
    }

    const stdin: HookStdinPermissionResult = {
      ...this.baseStdinFields('PermissionResult'),
      run_id: runId,
      permission_kind: permissionKind,
      tool_call_id: toolCallId,
      tool_name: toolName,
      decision,
      ...(toolInput !== undefined ? { tool_input: toolInput } : {}),
    };

    return this.dispatch(hooks, stdin);
  }

  async runInterrupt(reason: InterruptReason): Promise<HookEventResult> {
    const hooks = this.config.Interrupt;
    if (!hooks || hooks.length === 0) {
      return emptyResult();
    }

    const runId = this.runId;
    if (!runId) {
      return emptyResult();
    }

    const stdin: HookStdinInterrupt = {
      ...this.baseStdinFields('Interrupt'),
      run_id: runId,
      reason,
    };

    return this.dispatch(hooks, stdin);
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
      return emptyResult();
    }
    const runId = this.runId;
    if (!runId) {
      return emptyResult();
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

    return this.dispatch(hooks, stdin);
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
      return emptyResult();
    }
    const runId = this.runId;
    if (!runId) {
      return emptyResult();
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

    return this.dispatch(hooks, stdin);
  }
}
