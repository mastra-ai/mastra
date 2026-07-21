/**
 * Shared types for the headless / programmatic MastraCode API.
 *
 * These types are consumed by the core runner (`runMC`), the resolution policy,
 * the output formatters, and the CLI adapter. They are intentionally free of any
 * `process.*` access so the core API is usable from CI / Node code.
 */
import type { AgentController, AgentControllerEvent, Session } from '@mastra/core/agent-controller';

import type { GoalManager } from '../goal-manager.js';

export type RunMode = 'build' | 'plan' | 'fast';
export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high' | 'xhigh';

export const VALID_MODES = ['build', 'plan', 'fast'] as const;
export const VALID_THINKING_LEVELS = ['off', 'low', 'medium', 'high', 'xhigh'] as const;

/**
 * Named permission modes for non-interactive runs. Maps to a built-in
 * {@link ResolutionPolicy}:
 *  - `auto`   — approve every tool and auto-resolve suspensions (the default).
 *  - `deny`   — refuse every tool approval and abort on any suspension.
 */
export type PermissionMode = 'auto' | 'deny';
export const VALID_PERMISSION_MODES = ['auto', 'deny'] as const;

/** How `runMC` should resume `tool_approval_required` and `tool_suspended` events. */
export interface ResolutionPolicy {
  /**
   * Called for every `tool_approval_required` event. Return the decision; the
   * runner forwards it to `session.respondToToolApproval`.
   */
  onToolApproval(event: Extract<AgentControllerEvent, { type: 'tool_approval_required' }>): 'approve' | 'deny';
  /**
   * Called for every `tool_suspended` event. Return `resumeData` to resume the
   * tool, or `{ abort: true }` to abort the run.
   */
  onSuspension(
    event: Extract<AgentControllerEvent, { type: 'tool_suspended' }>,
  ): { resumeData: unknown } | { abort: true };
}

/** Thread selection / mutation options resolved up front by `runMC`. */
export interface RunMCThreadOptions {
  /** Resume a specific thread by its exact id. */
  id?: string;
  /** Resume the most recently updated thread instead of creating a new one. */
  continueLatest?: boolean;
  /** Clone the resolved (or current) thread before running — work on a copy. */
  clone?: boolean;
}

interface RunMCBaseOptions<TState extends Record<string, unknown> = Record<string, unknown>> {
  /** Controller built via `createMastraCode(...)`. */
  controller: AgentController<TState>;
  /** Session built via `createMastraCode(...)`. */
  session: Session<TState>;

  /** Explicit model id override. Takes precedence over `mode`. */
  model?: string;
  /** Execution mode; resolves a model from `modeDefaults` when `model` is absent. */
  mode?: RunMode;
  /** Per-mode default model ids (resolved from settings at startup). */
  modeDefaults?: Record<string, string>;
  /** Thinking-effort level. */
  thinkingLevel?: ThinkingLevel;
  /** Thread selection / mutation. */
  thread?: RunMCThreadOptions;
  /** Resource id for thread scoping. */
  resourceId?: string;
  /** Set or rename the thread title before running. */
  title?: string;
  /** Abort with `status: 'timeout'` (exit code 2) after this many ms without an event. */
  timeoutMs?: number;
  /**
   * Maximum number of agentic turns (assistant responses). When the limit is
   * reached the run aborts with `status: 'max_turns'` (exit code 1). No limit
   * by default.
   */
  maxTurns?: number;
  /** How approvals / suspensions are resolved. Defaults to {@link autoApprovePolicy}. */
  policy?: ResolutionPolicy;
  /** External abort signal; aborting it aborts the run. */
  signal?: AbortSignal;
}

export interface RunMCGoalOptions {
  objective: string;
  judgeModelId: string;
  maxRuns: number;
  goalManager?: GoalManager;
}

export type RunMCOptions<TState extends Record<string, unknown> = Record<string, unknown>> = RunMCBaseOptions<TState> &
  (
    | {
        /** The task to run as a regular headless turn. */
        prompt: string;
        goal?: never;
      }
    | {
        prompt?: never;
        /** Run a persisted goal instead of a regular prompt. */
        goal: RunMCGoalOptions;
      }
  );

export type RunMCStatus = 'completed' | 'done' | 'paused' | 'error' | 'aborted' | 'timeout' | 'max_turns';

export interface RunMCUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface RunMCToolCall {
  id: string;
  name: string;
  args: unknown;
}

export interface RunMCToolResult {
  id: string;
  name: string;
  result: unknown;
  isError: boolean;
}

export interface RunMCError {
  name: string;
  message: string;
  stack?: string;
}

export interface RunMCResult {
  status: RunMCStatus;
  /** Aggregated assistant text across all message_end events. */
  text: string;
  /** Goal objective when this was a goal run. */
  objective?: string;
  /** Terminal goal evaluation when this was a goal run. */
  goalEvent?: Extract<AgentControllerEvent, { type: 'goal_evaluation' }>;
  reason?: string;
  iterations?: number;
  maxRuns?: number;
  /** Underlying finish reason from `agent_end`, when the run finished normally. */
  finishReason?: string;
  usage?: RunMCUsage;
  toolCalls: RunMCToolCall[];
  toolResults: RunMCToolResult[];
  threadId?: string;
  error?: RunMCError;
  /** 0 success, 1 error/aborted/max_turns, 2 timeout. */
  exitCode: number;
}

/**
 * A handle to an in-flight `runMC` run. It is async-iterable over controller
 * events and also resolves to a final {@link RunMCResult} via `result`.
 *
 * Both `for await (const e of run)` and `await run.result` work on the same run;
 * awaiting `result` without iterating still drains events internally.
 */
export interface MCRun extends AsyncIterable<AgentControllerEvent> {
  /** Resolves once the run completes, times out, errors, or is aborted. */
  result: Promise<RunMCResult>;
  /** Abort the in-flight run. */
  abort(): void;
}
