/**
 * Harness v1 — runtime Session class.
 *
 * This is the in-memory authority for a single SessionRecord (§5.4). The
 * Harness creates one instance per live session and routes all writes to
 * the underlying record through it. The full surface is described in §4.2;
 * the M1 slice ships only identity + lifecycle. Everything else still throws
 * `Not implemented`.
 *
 * Lifecycle states tracked here:
 *   - 'live'    — session is in the harness's live map and holds the lease.
 *   - 'closed'  — `close()` has run; record has `closedAt` set in storage.
 *   - 'evicted' — flushed to storage and dropped from live map; the record
 *                 remains active and the session can be re-hydrated. Currently
 *                 unused; lands with §5.4 idle eviction.
 *
 * Once a Session leaves 'live', every method except identity reads throws.
 * Callers must re-resolve via `harness.session(...)` to get a fresh instance.
 */

import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { Agent } from '../../agent';
import type { AgentExecutionOptionsBase } from '../../agent/agent.types';
import type { AgentThreadSubscription, ToolsInput } from '../../agent/types';
import { ModelRouterLanguageModel } from '../../llm/model/router';
import { PrefillErrorHandler, ProviderHistoryCompat, StreamErrorRetryProcessor } from '../../processors';
import { RequestContext } from '../../request-context';
import type {
  GoalJudgeDecision,
  GoalState,
  HarnessStorage,
  PendingResume,
  PermissionRules,
  QueuedItem,
  SessionGrants,
  SessionRecord,
} from '../../storage/domains/harness';
import type { MastraModelOutput, FullOutput } from '../../stream/base/output';

import { ASK_USER_TOOL_ID, SUBMIT_PLAN_TOOL_ID } from '../../tools/builtin';
import type { Workspace } from '../../workspace';
import { convertStoredMessageToHarnessMessage } from '../_shared/message-conversion';
import type { StoredMessageRow } from '../_shared/message-conversion';
import type { HarnessMessage } from '../types';

import {
  HarnessConfigError,
  HarnessQueueFullError,
  HarnessSessionClosedError,
  HarnessValidationError,
  HarnessWorkspaceLostError,
} from './errors';
import { EventEmitter } from './events';
import type {
  EmitInput,
  HarnessEvent,
  HarnessEventListener,
  HarnessEventUnsubscribe,
  SubagentEndEvent,
  SubagentStartEvent,
  SubagentTextDeltaEvent,
  SubagentToolEndEvent,
  SubagentToolStartEvent,
  TaskUpdatedEvent,
} from './events';
import type { Harness } from './harness';
import { createSpawnSubagentTool, SPAWN_SUBAGENT_TOOL_ID } from './spawn-subagent-tool';
import type {
  AgentResult,
  AgentStream,
  GoalOptions,
  HarnessMode,
  HarnessRequestContext,
  ListMessagesOptions,
  MessageOptions,
  MessageOptionsDefault,
  MessageOptionsStream,
  MessageOptionsStructured,
  PermissionPolicy,
  QueueOptions,
  ToolCategory,
} from './types';

/**
 * Tool IDs the harness translates from `tool-call-approval` /
 * `tool-call-suspended` events into `question` / `plan-approval` `kind`s.
 * Shared with the built-in `askUser` / `submitPlan` tools so the contract
 * lives in a single place (`packages/core/src/tools/builtin`).
 */
const ASK_USER_TOOL_NAME = ASK_USER_TOOL_ID;
const SUBMIT_PLAN_TOOL_NAME = SUBMIT_PLAN_TOOL_ID;

export type SessionLifecycleState = 'live' | 'closed' | 'evicted';

/**
 * System prompt for the goal judge. Lifted verbatim from
 * mastracode/src/tui/goal-manager.ts so the harness-native judge produces
 * the same verdicts as the TUI implementation. The wording matters — the
 * "don't wait for yourself" rule and the asked-question-vs-checkpoint
 * distinction prevent the loop from flip-flopping.
 */
const JUDGE_SYSTEM_PROMPT = `You are the goal judge. Your decision directly controls whether the assistant continues working toward the goal.

Given a goal and the assistant's latest response, reason about whether the goal's requirements have been satisfied. Compare what the goal asks for against what the assistant has actually produced. Focus on substance, not phrasing.

Use "done" when the goal is fully achieved.
Use "waiting" only when the goal explicitly requires a user checkpoint, user feedback, human verification, human confirmation, or another external event outside the goal-judge loop before the assistant should continue, and the assistant has correctly stopped at that checkpoint. Do not use "waiting" merely because the assistant asked a question or could benefit from user input.
Use "continue" when the goal is not done and the assistant should keep working autonomously, including when it asked for input that the goal did not explicitly require.
If your previous decision was "waiting" for an explicit user checkpoint, keep choosing "waiting" when the user's latest response asks a question, requests clarification, or otherwise does not satisfy the checkpoint. Do not continue until the required user feedback/confirmation/verification has actually been provided.
If the goal says to wait for the goal judge, judge, evaluator, or you to respond, approve, verify, validate, tell the assistant to continue, or otherwise provide the next signal, treat your own decision as that judge response. Verification can be performed by you unless the goal explicitly says it needs human/user verification. Choose "continue" when the assistant should proceed to the next step. Do not choose "waiting" for judge-controlled checkpoints, because that would mean waiting for yourself.

Your "reason" field is sent back to the assistant as guidance when the goal is not yet done — be specific about what still needs to be accomplished. When choosing "continue", write the reason as an instruction for what the assistant should do next. When choosing "waiting", explain what specific user checkpoint is still outstanding.`;

/** Structured-output schema used by the goal judge call (§4.7). */
const GoalJudgeSchema = z.object({
  decision: z
    .enum(['done', 'continue', 'waiting'])
    .describe(
      'Whether the goal is done, should continue autonomously, or is at an explicit user checkpoint required by the goal',
    ),
  reason: z.string().describe('Brief explanation of what was accomplished or what remains to be done'),
});

/** Per-message cap on judge-context strings to keep judge latency bounded. */
const JUDGE_TRUNCATE_LIMIT = 4000;

// ---------------------------------------------------------------------------
// Permission helpers (§4.2e). Tiny shape validators kept module-scoped so the
// session methods stay focused on persistence + event emission.
// ---------------------------------------------------------------------------

const TOOL_CATEGORIES: readonly ToolCategory[] = ['read', 'edit', 'execute', 'mcp', 'other'];
const PERMISSION_POLICIES: readonly PermissionPolicy[] = ['allow', 'ask', 'deny'];

function assertToolCategory(method: string, value: unknown): asserts value is ToolCategory {
  if (typeof value !== 'string' || !TOOL_CATEGORIES.includes(value as ToolCategory)) {
    throw new HarnessValidationError(method, `unknown ToolCategory ${JSON.stringify(value)}`);
  }
}

function assertToolName(method: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HarnessValidationError(method, 'toolName must be a non-empty string');
  }
}

function assertPolicy(method: string, value: unknown): asserts value is PermissionPolicy {
  if (typeof value !== 'string' || !PERMISSION_POLICIES.includes(value as PermissionPolicy)) {
    throw new HarnessValidationError(method, `policy must be one of ${PERMISSION_POLICIES.join(' | ')}`);
  }
}

function truncateForJudge(value: string): string {
  return value.length > JUDGE_TRUNCATE_LIMIT ? value.slice(0, JUDGE_TRUNCATE_LIMIT) + '\n...[truncated]' : value;
}

function escapeGoalXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Continuation prompts. The wording matters — these are lifted verbatim
 * from `mastracode/src/tui/goal-manager.ts` + `commands/goal.ts` so the
 * harness-native goal API produces byte-identical kickoff/resume/judge-
 * continue messages.
 */

/** Kickoff sent by `setGoal` (parity with TUI's `createGoalReminderXml`). */
function buildKickoffContinuation(objective: string): string {
  return `<system-reminder type="goal">${escapeGoalXml(objective)}</system-reminder>`;
}

/** Continuation sent by `resumeGoal` (parity with TUI's `/goal resume`). */
function buildResumeContinuation(objective: string): string {
  return `Continue working toward the goal: ${objective}`;
}

/**
 * Continuation sent after a judge `continue` verdict (parity with TUI's
 * `GoalManager.buildContinuationPrompt`).
 */
function buildJudgeContinuation(opts: { turn: number; max: number; objective: string; judgeReason: string }): string {
  const message = `[Goal attempt ${opts.turn}/${opts.max}] The goal is not yet complete. Judge feedback: ${opts.judgeReason}\n\nContinue working toward the goal: ${opts.objective}`;
  return `<system-reminder type="goal-judge">${escapeGoalXml(message)}</system-reminder>`;
}

/**
 * Active-tool tracking for `SessionDisplayState.activeTools`. One entry per
 * `tool_start` that has not yet been settled by a matching `tool_end`. Drops
 * out on `tool_end` regardless of `isError`.
 */
export interface ActiveToolState {
  toolCallId: string;
  toolName: string;
  args: unknown;
  startedAt: number;
  /** Set when this tool call came from a spawned subagent, not the parent. */
  subagentSessionId?: string;
}

/**
 * Active-subagent tracking for `SessionDisplayState.activeSubagents`. Keyed
 * on the parent's `spawn_subagent` tool call id. Dropped on subagent close.
 */
export interface ActiveSubagentState {
  subagentSessionId: string;
  agentType: string;
  task: string;
  parentToolCallId: string;
  startedAt: number;
}

/** Cumulative token usage for the session's thread. */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Internal: outstanding `waitForIdle()` waiter. `check()` re-evaluates
 * `isBusy()` and resolves the underlying Promise if idle (returns `true`
 * when the waiter is satisfied); `reject()` finalises with an error
 * (close/timeout); `cleanup()` disposes timers + removes the waiter from
 * `_idleWaiters`.
 */
interface IdleWaiter {
  check: () => boolean;
  reject: (err: unknown) => void;
  cleanup: () => void;
}

/**
 * Point-in-time snapshot returned by `getDisplayState()` (§4.2). Reads off
 * the in-memory `SessionRecord` plus a few transient run-only fields.
 *
 * Persistent thread-level aggregates (task lists, modified-file ledgers, OM
 * progress) deliberately live in `session.state`, not here — see the
 * `getDisplayState()` doc-comment for the split rationale. All `Record<>`
 * collections returned here are fresh on every call; do not mutate them.
 */
export interface SessionDisplayState {
  // Identity
  sessionId: string;
  threadId: string;
  resourceId: string;
  parentSessionId?: string;
  lifecycleState: SessionLifecycleState;
  modeId: string;
  modelId: string;
  createdAt: number;
  lastActivityAt: number;

  // Run
  isRunning: boolean;
  currentRunId?: string;
  currentMessageId?: string;
  currentTraceId?: string;

  // Activity
  activeTools: Record<string, ActiveToolState>;
  toolInputBuffers: Record<string, { toolName: string; text: string }>;
  activeSubagents: Record<string, ActiveSubagentState>;

  // Tokens
  tokenUsage: TokenUsage;

  // Pending interrupt (full payload, not just a boolean — UIs need the args)
  pending: SessionRecord['pendingResume'] | null;

  // Queue
  queueDepth: number;
  currentQueuedItemId?: string;

  // Goal
  goal?: SessionRecord['goal'];
}

/**
 * Internal handle the Harness uses to construct + tear down a Session
 * without exposing those operations on the public API. Plain object so
 * tests can construct a Session in isolation if needed.
 */
export interface SessionInternals {
  harness: Harness;
  storage: HarnessStorage;
  ownerId: string;
  /** Initial record loaded under the lease. The Session takes ownership. */
  record: SessionRecord;
  /** Lease TTL the Harness acquired the lease for. */
  leaseExpiresAt: number;
}

export class Session {
  /** Stable identity. Frozen at construction. */
  readonly id: string;
  readonly resourceId: string;
  readonly threadId: string;
  readonly parentSessionId?: string;
  readonly subagentDepth: number;
  readonly createdAt: number;

  private _record: SessionRecord;
  private _state: SessionLifecycleState = 'live';
  private readonly _harness: Harness;
  private readonly _storage: HarnessStorage;
  private readonly _ownerId: string;
  private readonly _emitter: EventEmitter;

  /**
   * Queue resolvers indexed by `queuedItem.id`. Set in `queue()` so the
   * caller's promise settles when the head turn completes (or rejects on
   * permanent failure). Cleared after settle. Items recovered from
   * `pendingQueue` on hydration have no resolver — `queue_item_replayed` is
   * emitted instead and the turn runs purely for its side-effects.
   */
  private readonly _queueResolvers = new Map<
    string,
    { resolve: (result: AgentResult) => void; reject: (err: unknown) => void }
  >();
  /** `queuedItem.id` of the turn currently running (live or suspended). */
  private _currentQueuedItemId?: string;
  /** `queuedItem.source` of the turn currently running. Used by the goal
   *  judge loop to skip re-judging on goal-driven continuation turns. */
  private _currentQueuedItemSource?: 'user' | 'goal';
  /** True while `_maybeDrainQueue` is running so re-entrant kicks are no-ops. */
  private _draining = false;
  /**
   * Tracks the AbortController for the currently-running turn (message or
   * queued). Set when a turn begins, cleared on terminal completion or
   * suspension. `session.abort()` calls `abort()` on this controller. Also
   * powers `session.isRunning()` — non-undefined means a turn is in-flight.
   */
  private _currentTurnAbortController?: AbortController;
  /**
   * Transient per-turn tracking surfaced via `getDisplayState()`. Reset at
   * the start of every turn (in `_beginTurn` via `_resetTurnTracking`) and
   * mutated from `_drainStreamToEvents`, `_maybeCaptureSuspend`, and the
   * `_resume` path. Not persisted — these are run-only fields.
   */
  private _currentRunId?: string;
  private _currentMessageId?: string;
  private _currentTraceId?: string;
  private readonly _activeTools = new Map<string, ActiveToolState>();
  private readonly _toolInputBuffers = new Map<string, { toolName: string; text: string }>();
  private readonly _activeSubagents = new Map<string, ActiveSubagentState>();
  /** Cumulative usage for the session's thread. Updated on `agent_end`. */
  private _tokenUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  /**
   * Outstanding `waitForIdle()` callers. On close/evict each waiter is
   * rejected with `HarnessSessionClosedError` so callers don't hang on a
   * dead session.
   */
  private readonly _idleWaiters = new Set<IdleWaiter>();
  /**
   * In-process serialization for `_flushUpdate`. Concurrent setters chain
   * onto this so each CAS write reads the latest in-memory version. Without
   * this, two parallel callers both observe `version=N`, both attempt
   * `ifVersion: N`, and the loser hits a `HarnessStorageVersionConflictError`.
   */
  private _flushChain: Promise<void> = Promise.resolve();

  /** Cached workspace handle. Resolves lazily on first `getWorkspace()` call. */
  private _workspace?: Workspace;
  /** Dedup promise so concurrent `getWorkspace()` calls share one provision attempt. */
  private _workspaceResolving?: Promise<Workspace>;
  /**
   * True when a non-resumable per-session workspace was found in storage on
   * rehydrate. Set by `_publish` via {@link _markWorkspaceLost}. The first
   * `getWorkspace()` call throws {@link HarnessWorkspaceLostError}; callers
   * can drop the marker and reprovision by calling `clearWorkspaceLost()`.
   */
  private _workspaceLost = false;

  // -------------------------------------------------------------------------
  // Thread subscription — §4.2 signal routing.
  //
  // One AgentThreadSubscription per Session, lazy-acquired on the first
  // signal-routed `message()` call. The subscription multiplexes every run
  // on the (resource, thread) tuple — idle-start wakes, mid-flight signal
  // deliveries, resume runs, queue drains — so a single drain loop owns
  // chunk → harness event translation for the whole session lifetime.
  //
  // Subscription lifetime ends with `close()` (explicit) or session
  // eviction (the new Session that rehydrates will lazy-open its own).
  // Cross-agent mode switches re-open against the new agent — see
  // `_ensureThreadSubscription` for the teardown contract.
  // -------------------------------------------------------------------------

  /** Cached thread subscription. Lazy. One per Session at a time. */
  private _threadSubscription?: AgentThreadSubscription<unknown>;
  /** Agent the current subscription was opened against. Used to detect
   *  cross-agent mode switches that require re-opening. */
  private _threadSubscriptionAgent?: Agent;
  /** Handle to the running drain loop, awaited by `close()`. */
  private _threadSubscriptionDrain?: Promise<void>;
  /** True once the subscription has been torn down (by close or eviction).
   *  Guards re-opens and re-entrant teardown. */
  private _threadSubscriptionClosed = false;
  /**
   * Per-run completion promises, keyed by `runId`. The drain loop resolves
   * (or rejects) the matching entry on a terminal chunk (`finish` / `error` /
   * `abort` / `tool-call-suspended`). `_awaitRunCompletion(runId)` reads
   * here. Entries left over on `close()` are rejected so callers don't hang.
   */
  private readonly _runCompletionPromises = new Map<
    string,
    { resolve: (full: FullOutput<unknown>) => void; reject: (err: unknown) => void }
  >();
  /**
   * Cache of run completion results that landed before any caller had a chance
   * to register a waiter. `sendSignal()` returns synchronously and the runtime
   * can drive the entire run to completion in the same microtask tick, so by
   * the time `_awaitRunCompletion(runId)` runs the terminal chunk may already
   * have been processed. Entries are consumed by the first matching
   * `_awaitRunCompletion` call.
   */
  private readonly _completedRuns = new Map<
    string,
    { ok: true; full: FullOutput<unknown> } | { ok: false; err: unknown }
  >();

  /** @internal — constructed by the Harness, not directly. */
  constructor(internals: SessionInternals) {
    this.id = internals.record.id;
    this.resourceId = internals.record.resourceId;
    this.threadId = internals.record.threadId;
    this.parentSessionId = internals.record.parentSessionId;
    this.subagentDepth = internals.record.subagentDepth ?? 0;
    this.createdAt = internals.record.createdAt;

    this._record = internals.record;
    this._harness = internals.harness;
    this._storage = internals.storage;
    this._ownerId = internals.ownerId;
    this._emitter = new EventEmitter({ sessionId: this.id });
  }

  // -------------------------------------------------------------------------
  // Events — §10.
  // -------------------------------------------------------------------------

  /**
   * Subscribe to events emitted on this session. Returns an unsubscribe
   * function. Listeners see only events emitted after `subscribe()` returns;
   * there is no automatic backfill (use `listMessages()` for history).
   *
   * Listener exceptions and rejected promises are isolated — they will not
   * disrupt the producer or other listeners.
   */
  subscribe(listener: HarnessEventListener): HarnessEventUnsubscribe {
    this._assertLive('subscribe()');
    return this._emitter.subscribe(listener);
  }

  /** @internal — used by the Harness to publish events on this session's emitter. */
  _emit(event: EmitInput): HarnessEvent {
    return this._emitter.emit(event);
  }

  /**
   * Emit an event that belongs to a turn (agent_*, message_*, tool_*,
   * suspension_*). Auto-stamps `queuedItemId` from `_currentQueuedItemId`
   * when a queued turn is running so subscribers can correlate every event
   * back to its `queue()` item.
   */
  private _emitTurnEvent(event: EmitInput): HarnessEvent {
    if (this._currentQueuedItemId !== undefined && (event as { queuedItemId?: string }).queuedItemId === undefined) {
      return this._emitter.emit({ ...event, queuedItemId: this._currentQueuedItemId } as EmitInput);
    }
    return this._emitter.emit(event);
  }

  /**
   * @internal — publish a `subagent_*` event on this session's emitter.
   * Called by the spawn-subagent bridge when forwarding a child session's
   * own `agent_start` / `text_delta` / `tool_start` / `tool_end` /
   * `agent_end` into the parent's subscriber stream as the corresponding
   * `subagent_*` event (§10.6).
   *
   * Auto-stamps `parentId` (this session's id) and `queuedItemId` from
   * `_currentQueuedItemId` so a subscriber can correlate every nested
   * event back to the parent's `queue()` item that spawned it. Callers
   * supply `depth` (child's depth in the subagent tree) and the rest of
   * the event payload.
   */
  _emitSubagentEvent(
    event:
      | Omit<SubagentStartEvent, 'id' | 'timestamp' | 'sessionId' | 'parentId'>
      | Omit<SubagentTextDeltaEvent, 'id' | 'timestamp' | 'sessionId' | 'parentId'>
      | Omit<SubagentToolStartEvent, 'id' | 'timestamp' | 'sessionId' | 'parentId'>
      | Omit<SubagentToolEndEvent, 'id' | 'timestamp' | 'sessionId' | 'parentId'>
      | Omit<SubagentEndEvent, 'id' | 'timestamp' | 'sessionId' | 'parentId'>,
  ): HarnessEvent {
    const stamped = { ...event, parentId: this.id } as EmitInput;
    if (this._currentQueuedItemId !== undefined && (stamped as { queuedItemId?: string }).queuedItemId === undefined) {
      return this._emitter.emit({ ...stamped, queuedItemId: this._currentQueuedItemId } as EmitInput);
    }
    return this._emitter.emit(stamped);
  }

  /** @internal — number of registered listeners (for tests). */
  get _internalListenerCount(): number {
    return this._emitter.listenerCount;
  }

  /**
   * Mark a turn as in-flight and mint the AbortController the agent run will
   * use. `session.abort()` aborts this controller. If the caller supplied
   * their own `AbortSignal`, we forward it into the session controller so a
   * single signal reaches the agent.
   *
   * Returns the controller so the calling path can hand `controller.signal`
   * to `agent.stream` / `agent.generate` / `agent.resumeStream`.
   */
  private _beginTurn(callerSignal: AbortSignal | undefined): AbortController {
    const controller = new AbortController();
    if (callerSignal) {
      if (callerSignal.aborted) {
        controller.abort((callerSignal as { reason?: unknown }).reason);
      } else {
        callerSignal.addEventListener('abort', () => controller.abort((callerSignal as { reason?: unknown }).reason), {
          once: true,
        });
      }
    }
    this._currentTurnAbortController = controller;
    this._resetTurnTracking();
    return controller;
  }

  /**
   * Clear per-turn transient display-state fields. Cumulative aggregates
   * (`_tokenUsage`) intentionally persist across turns within a session.
   */
  private _resetTurnTracking(): void {
    this._currentRunId = undefined;
    this._currentMessageId = undefined;
    this._currentTraceId = undefined;
    this._activeTools.clear();
    this._toolInputBuffers.clear();
    // `_activeSubagents` is keyed by parent tool call id and naturally drops
    // entries on subagent close; do not clear here so a long-running subagent
    // spanning multiple parent turns still renders.
  }

  /**
   * Clear the in-flight turn marker so `isRunning()` reports false and the
   * next `session.abort()` is a no-op. Run-only display fields (`currentRunId`,
   * active-tool map, input buffers) clear too so an idle session reports
   * idle state. Cumulative aggregates (`_tokenUsage`) are preserved.
   */
  private _endTurn(controller: AbortController): void {
    if (this._currentTurnAbortController === controller) {
      this._currentTurnAbortController = undefined;
      this._currentRunId = undefined;
      this._currentMessageId = undefined;
      this._currentTraceId = undefined;
      this._activeTools.clear();
      this._toolInputBuffers.clear();
    }
    this._notifyMaybeIdle();
  }

  /**
   * Fold the `FullOutput` from a completed (or suspended) agent run into the
   * session's transient display state: capture `runId` if not yet set and
   * accumulate token usage. Called from every site that has the full output.
   */
  private _recordTurnCompletion(full: FullOutput<unknown>): void {
    if (full.runId && this._currentRunId === undefined) {
      this._currentRunId = full.runId;
    }
    const usage = (full as { totalUsage?: unknown; usage?: unknown }).totalUsage ?? (full as { usage?: unknown }).usage;
    if (usage && typeof usage === 'object') {
      const u = usage as {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
        inputTokens?: number;
        outputTokens?: number;
      };
      const prompt = u.promptTokens ?? u.inputTokens;
      const completion = u.completionTokens ?? u.outputTokens;
      if (typeof prompt === 'number') this._tokenUsage.promptTokens += prompt;
      if (typeof completion === 'number') this._tokenUsage.completionTokens += completion;
      if (typeof u.totalTokens === 'number') this._tokenUsage.totalTokens += u.totalTokens;
    }
  }

  /**
   * True while a turn (message or queued) is in flight against the agent.
   * Goes back to false on terminal completion, suspension, or abort.
   * Subscribers should drive UI affordances (e.g. spinner, ESC-to-cancel)
   * from this signal in combination with `lifecycleState`.
   */
  isRunning(): boolean {
    return this._currentTurnAbortController !== undefined;
  }

  /**
   * True when the session has any pending work — an in-flight turn, an
   * active queue drain, a queued item awaiting its turn, or a pending
   * `respondTo*` suspension. False only when the session is fully idle.
   *
   * Broader than `isRunning()`: a session can be `!isRunning()` but still
   * `isBusy()` (queue items not yet drained, awaiting `respondToQuestion`,
   * etc.). UI affordances that care about "anything happening at all"
   * (e.g. "session is working" indicators) should read this; affordances
   * tied to a single live turn (spinner, abort button) should read
   * `isRunning()`.
   */
  isBusy(): boolean {
    if (this._currentTurnAbortController !== undefined) return true;
    if (this._draining) return true;
    if (this._currentQueuedItemId !== undefined) return true;
    if ((this._record.pendingQueue?.length ?? 0) > 0) return true;
    if (this._record.pendingResume !== undefined) return true;
    return false;
  }

  /**
   * Number of items currently waiting in `pendingQueue` (excluding any
   * queued item already drained into a live turn — that one is tracked
   * via `_currentQueuedItemId`). Cheap, synchronous, safe to poll from UI.
   */
  getQueueDepth(): number {
    return this._record.pendingQueue?.length ?? 0;
  }

  /**
   * Cumulative token usage for this session, accumulated across every
   * completed turn (manual or queued). Returns a fresh shallow copy so
   * callers can't mutate the running aggregate.
   *
   * Note: this is **not** persisted across rehydration — token counts
   * reset to zero when a closed/evicted session is hydrated from storage.
   * Callers that need cross-process aggregates should sum from message
   * history themselves.
   */
  getTokenUsage(): TokenUsage {
    return { ...this._tokenUsage };
  }

  /**
   * Resolve when the session goes fully idle (`!isBusy()`). If the session
   * is already idle when called, resolves on the next microtask.
   *
   * Rejects with `HarnessValidationError` if `timeoutMs` is provided and
   * elapses before the session becomes idle. Rejects with
   * `HarnessSessionClosedError` if the session closes while waiting.
   *
   * Useful in tests and TUI flows that want to await a clean boundary
   * before tearing down or asserting final state.
   */
  waitForIdle(opts?: { timeoutMs?: number }): Promise<void> {
    this._assertLive('waitForIdle()');
    if (!this.isBusy()) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const waiter: IdleWaiter = {
        check: () => {
          if (!this.isBusy()) {
            cleanup();
            resolve();
            return true;
          }
          return false;
        },
        reject,
        cleanup: () => {},
      };
      const cleanup = () => {
        if (timer !== undefined) clearTimeout(timer);
        this._idleWaiters.delete(waiter);
      };
      waiter.cleanup = cleanup;
      this._idleWaiters.add(waiter);
      if (opts?.timeoutMs !== undefined) {
        timer = setTimeout(() => {
          cleanup();
          reject(new HarnessValidationError('waitForIdle()', `session did not become idle within ${opts.timeoutMs}ms`));
        }, opts.timeoutMs);
      }
    });
  }

  /**
   * Re-check `isBusy()` and resolve every `waitForIdle()` waiter whose
   * predicate is now satisfied. Cheap when there are no waiters (common
   * case). Called from every state transition that might tip the session
   * idle: `_endTurn`, queue drain shutdown, queued-turn settlement.
   */
  private _notifyMaybeIdle(): void {
    if (this._idleWaiters.size === 0) return;
    if (this.isBusy()) return;
    const waiters = Array.from(this._idleWaiters);
    for (const w of waiters) w.check();
  }

  /**
   * Cancel the in-flight turn (if any). The agent receives the abort signal
   * and unwinds. No-op when no turn is running. The optional `reason` is
   * forwarded as the `AbortSignal.reason` so tools can branch on it.
   */
  abort(opts?: { reason?: string }): void {
    const controller = this._currentTurnAbortController;
    if (!controller) return;
    controller.abort(opts?.reason ?? 'session_aborted');
  }

  /** @internal — emitter epoch (for tests). */
  get _internalEmitterEpoch(): string {
    return this._emitter.epochId;
  }

  // -------------------------------------------------------------------------
  // Identity / inspection — usable in any lifecycle state.
  // -------------------------------------------------------------------------

  /** Last-known `lastActivityAt`. Updated whenever the record is flushed. */
  get lastActivityAt(): number {
    return this._record.lastActivityAt;
  }

  /** Current lifecycle state. */
  get lifecycleState(): SessionLifecycleState {
    return this._state;
  }

  /** True once `close()` has settled. */
  get isClosed(): boolean {
    return this._state === 'closed';
  }

  /** Read-only snapshot of the underlying record. */
  getRecord(): Readonly<SessionRecord> {
    return this._record;
  }

  // -------------------------------------------------------------------------
  // Lifecycle.
  // -------------------------------------------------------------------------

  /**
   * Soft-close: flush, set `closedAt`, release the lease, drop from the live
   * map. Final — the same `sessionId` cannot be re-hydrated. Idempotent: a
   * second call is a no-op once `closed`. The cascade through descendants
   * (§5.5) is driven by the Harness, not by this method directly.
   *
   * @internal — public users go through `harness.closeSession({ sessionId })`
   * or `session.close()` (defined here) which currently delegates back to
   * the harness so cascade is enforced in one place. We expose this method
   * so the harness has a clear hook; the harness method is still the
   * recommended call site.
   */
  async close(): Promise<void> {
    if (this._state === 'closed') return;
    await this._harness._closeSession(this);
  }

  // -------------------------------------------------------------------------
  // Workspace — §2.7 / §4.2.
  // -------------------------------------------------------------------------

  /**
   * Resolve this session's workspace. Returns `undefined` when the harness
   * has no workspace configured. Caches the result for the lifetime of the
   * Session (the workspace is released on `close()` per the ownership model).
   *
   * Throws {@link HarnessWorkspaceLostError} when the session's
   * `per-session` workspace was provisioned by a non-resumable provider
   * and a process restart has dropped the underlying state. Callers can
   * decide whether to surface the error or call `clearWorkspaceLost()` and
   * try again with a fresh workspace.
   */
  async getWorkspace(): Promise<Workspace | undefined> {
    this._assertLive('getWorkspace()');
    if (this._workspace) return this._workspace;
    if (this._workspaceResolving) return this._workspaceResolving;

    const kind = this._harness._workspaceKind;
    if (!kind) return undefined;

    if (this._workspaceLost) {
      throw new HarnessWorkspaceLostError(this.id, this._harness._workspaceRegistry.providerId ?? 'unknown');
    }

    const resolve = async (): Promise<Workspace> => {
      if (kind === 'shared') {
        return this._harness._workspaceRegistry.acquireShared();
      }
      if (kind === 'per-resource') {
        return this._harness._workspaceRegistry.acquirePerResource({ resourceId: this.resourceId });
      }
      // kind === 'per-session'
      // Subagent sessions with `workspace: 'inherit'` reuse the parent's entry.
      // The spawn tool flips `_subagentFreshWorkspace` for the `fresh` case so
      // we don't accidentally inherit when a fresh workspace is requested.
      if (this.parentSessionId && this._subagentInheritWorkspace) {
        return this._harness._workspaceRegistry.inheritPerSession({
          parentSessionId: this.parentSessionId,
          childSessionId: this.id,
          resourceId: this.resourceId,
        });
      }
      const storedProviderId = this._record.workspace?.providerId;
      const storedState = this._record.workspace?.state;
      return this._harness._workspaceRegistry.acquirePerSession({
        resourceId: this.resourceId,
        sessionId: this.id,
        ...(this.parentSessionId ? { parentSessionId: this.parentSessionId } : {}),
        ...(storedProviderId ? { storedProviderId } : {}),
        ...(storedState !== undefined ? { storedState } : {}),
        onStateUpdate: async state => {
          await this._persistWorkspaceState(state);
        },
      });
    };

    this._workspaceResolving = resolve();
    try {
      this._workspace = await this._workspaceResolving;
      return this._workspace;
    } finally {
      this._workspaceResolving = undefined;
    }
  }

  /**
   * @internal — used by the harness during hydration when the stored record
   * carries workspace state but the configured provider is non-resumable.
   */
  _markWorkspaceLost(): void {
    this._workspaceLost = true;
  }

  /**
   * @internal — set by the spawn-subagent tool flow to indicate the child
   * session should inherit its parent's workspace rather than provisioning
   * a fresh one. `undefined` for top-level sessions; defaults to `true` for
   * subagent sessions unless the spawn definition opts into `'fresh'`.
   */
  _subagentInheritWorkspace?: boolean;

  /** @internal — writes the latest opaque workspace state into the session record. */
  private async _persistWorkspaceState(state: unknown): Promise<void> {
    const providerId = this._harness._workspaceRegistry.providerId;
    if (!providerId) return;
    await this._flushUpdate(record => ({
      ...record,
      workspace: { providerId, state },
    }));
  }

  // -------------------------------------------------------------------------
  // Signal-routing helpers (§4.2). One long-lived thread subscription per
  // Session multiplexes every run on the thread into a single chunk
  // stream. `message()` calls `agent.sendSignal()`, gets a `runId` back,
  // and awaits the matching entry in `_runCompletionPromises`. The drain
  // loop resolves that entry when a terminal chunk (`finish` / `error` /
  // `abort` / `tool-call-suspended`) for the run arrives.
  // -------------------------------------------------------------------------

  /**
   * Lazy-acquire the thread subscription against the given agent. Idempotent
   * when called with the same agent. If the agent changed (cross-agent mode
   * switch on the same thread), tears down the existing subscription and
   * opens a new one against the new agent so the chunk stream stays in
   * sync with the run the next `sendSignal()` will land on.
   */
  private async _ensureThreadSubscription(agent: Agent): Promise<AgentThreadSubscription<unknown>> {
    if (this._threadSubscriptionClosed) {
      throw new HarnessValidationError(
        '_ensureThreadSubscription()',
        'Session is closed; cannot re-open thread subscription.',
      );
    }
    if (this._threadSubscription && this._threadSubscriptionAgent?.id === agent.id) {
      return this._threadSubscription;
    }
    if (this._threadSubscription) {
      // Cross-agent mode switch: tear down the old subscription so we don't
      // mix chunks from two agents on the same thread.
      this._threadSubscription.unsubscribe();
      if (this._threadSubscriptionDrain) {
        await this._threadSubscriptionDrain.catch(() => {});
      }
      this._threadSubscription = undefined;
      this._threadSubscriptionAgent = undefined;
      this._threadSubscriptionDrain = undefined;
    }
    const sub = await agent.subscribeToThread({ resourceId: this.resourceId, threadId: this.threadId });
    this._threadSubscription = sub;
    this._threadSubscriptionAgent = agent;
    this._threadSubscriptionDrain = this._drainSubscriptionStream(sub);
    // Surface drain rejections to outstanding awaiters; the drain loop itself
    // swallows them in its `finally` block.
    void this._threadSubscriptionDrain.catch(() => {});
    return sub;
  }

  /**
   * Returns a Promise that resolves with a synthetic `FullOutput` when the
   * run with the given id terminates. The drain loop resolves (or rejects)
   * the entry. If `close()` runs while the entry is pending, the entry is
   * rejected with a typed error.
   */
  private _awaitRunCompletion(runId: string): Promise<FullOutput<unknown>> {
    // Fast path: the run may have already terminated before this call ran.
    // Consume the cached result.
    const cached = this._completedRuns.get(runId);
    if (cached) {
      this._completedRuns.delete(runId);
      return cached.ok ? Promise.resolve(cached.full) : Promise.reject(cached.err);
    }
    const existing = this._runCompletionPromises.get(runId);
    if (existing) {
      return new Promise<FullOutput<unknown>>((_resolve, reject) => {
        // Replace the resolver to chain a second waiter — but our normal
        // usage only ever awaits once per `runId`, so this is a defensive
        // path. Forbid for clarity.
        reject(
          new HarnessValidationError(
            '_awaitRunCompletion()',
            `Run ${runId} already has an outstanding completion waiter`,
          ),
        );
      });
    }
    const promise = new Promise<FullOutput<unknown>>((resolve, reject) => {
      this._runCompletionPromises.set(runId, { resolve, reject });
    });
    // Single canonical settler: wait for the runtime to register the run's
    // `MastraModelOutput`, then await its `_waitUntilFinished()`. The drain
    // loop emits events from chunks; it does NOT settle completion. This
    // keeps event emission and completion delivery on independent paths and
    // is robust to runs that finish without emitting an explicit terminal
    // chunk in `fullStream` (test doubles, abort-before-first-chunk, etc.).
    void this._watchRunCompletion(runId);
    return promise;
  }

  /**
   * Canonical completion watcher. Acquires the run's `MastraModelOutput`
   * from the runtime via `waitForRunOutput()` (event-driven — no polling),
   * awaits `_waitUntilFinished()`, then settles the outstanding completion
   * promise (or stashes the result in `_completedRuns` if the waiter has not
   * been registered yet, e.g. for very fast runs).
   *
   * The captured `out` reference is threaded through to `_handleRunTerminal`
   * because the runtime drops the record from `getRunOutput()` after
   * `_waitUntilFinished()` resolves.
   */
  private async _watchRunCompletion(runId: string): Promise<void> {
    const agent = this._threadSubscriptionAgent;
    if (!agent) return;
    const out = (await agent.waitForRunOutput(runId)) as MastraModelOutput<unknown> & {
      _waitUntilFinished?: () => Promise<void>;
    };
    try {
      if (typeof out._waitUntilFinished === 'function') {
        await out._waitUntilFinished();
      }
    } catch {
      // Ignore — settlement happens via `_handleRunTerminal` below, which
      // will pick up the run's own error state via `getFullOutput()`.
    }
    await this._handleRunTerminal(runId, out as MastraModelOutput<unknown>);
  }

  /**
   * Drain the long-lived subscription stream. The drain is the **sole event
   * emitter** for the session — each chunk is translated into the matching
   * harness event(s) via `_emitForChunk`. Completion delivery is handled
   * elsewhere (`_watchRunCompletion` driven by `_waitUntilFinished()`); this
   * loop deliberately does not inspect terminal chunks.
   *
   * On drain shutdown (stream end or unhandled error) every outstanding
   * completion promise is rejected so callers don't hang.
   */
  private async _drainSubscriptionStream(sub: AgentThreadSubscription<unknown>): Promise<void> {
    try {
      for await (const chunk of sub.stream) {
        const runId = (chunk as { runId?: string }).runId;
        if (runId && this._currentRunId === undefined) {
          // First chunk for a run marks our "current run" for getDisplayState().
          this._currentRunId = runId;
        }
        this._emitForChunk(chunk);
      }
    } catch (err) {
      for (const [, entry] of this._runCompletionPromises) {
        entry.reject(err);
      }
      this._runCompletionPromises.clear();
    } finally {
      // Stream ended normally — any caller still waiting for a runId whose
      // completion we never observed would hang forever otherwise.
      for (const [, entry] of this._runCompletionPromises) {
        entry.reject(
          new HarnessValidationError('_drainSubscriptionStream()', 'Thread subscription closed before run completion'),
        );
      }
      this._runCompletionPromises.clear();
    }
  }

  /**
   * Settle the outstanding completion waiter for `runId` with the bundled
   * `FullOutput`. Always called from `_watchRunCompletion` with the output
   * reference captured at registration time (runtime cleanup may have
   * already dropped it from `getRunOutput()` by now).
   *
   * If no waiter is registered yet (very fast run), the result is stashed
   * in `_completedRuns` so the next `_awaitRunCompletion(runId)` call can
   * consume it.
   */
  private async _handleRunTerminal(runId: string, out: MastraModelOutput<unknown>): Promise<void> {
    const waiter = this._runCompletionPromises.get(runId);
    this._runCompletionPromises.delete(runId);
    try {
      const full = (await out.getFullOutput()) as FullOutput<unknown>;
      if (waiter) waiter.resolve(full);
      else this._completedRuns.set(runId, { ok: true, full });
    } catch (err) {
      if (waiter) waiter.reject(err);
      else this._completedRuns.set(runId, { ok: false, err });
    }
  }

  /**
   * Translate a single fullStream chunk into the matching harness event(s).
   * Extracted from `_drainStreamToEvents` so the long-lived subscription
   * drain is the single consumer of chunks.
   */
  private _emitForChunk(chunk: { type: string; payload?: unknown; data?: unknown; runId?: string }): void {
    switch (chunk.type) {
      case 'text-start': {
        const payload = chunk.payload as { id: string };
        this._currentMessageId = payload.id;
        this._emitTurnEvent({ type: 'message_start', messageId: payload.id });
        return;
      }
      case 'text-delta': {
        const payload = chunk.payload as { id: string; text?: string };
        if (typeof payload?.text === 'string' && payload.text.length > 0) {
          this._emitTurnEvent({
            type: 'message_update',
            messageId: payload.id,
            delta: payload.text,
          });
        }
        return;
      }
      case 'text-end': {
        const payload = chunk.payload as { id: string };
        this._emitTurnEvent({ type: 'message_end', messageId: payload.id });
        if (this._currentMessageId === payload.id) {
          this._currentMessageId = undefined;
        }
        return;
      }
      case 'tool-call-input-streaming-start': {
        const payload = chunk.payload as { toolCallId: string; toolName: string };
        this._toolInputBuffers.set(payload.toolCallId, { toolName: payload.toolName, text: '' });
        this._emitTurnEvent({
          type: 'tool_input_start',
          toolCallId: payload.toolCallId,
          toolName: payload.toolName,
        });
        return;
      }
      case 'tool-call-delta': {
        const payload = chunk.payload as { toolCallId: string; argsTextDelta: string; toolName?: string };
        const prev = this._toolInputBuffers.get(payload.toolCallId);
        const toolName = prev?.toolName ?? payload.toolName ?? '';
        this._toolInputBuffers.set(payload.toolCallId, {
          toolName,
          text: (prev?.text ?? '') + payload.argsTextDelta,
        });
        this._emitTurnEvent({
          type: 'tool_input_delta',
          toolCallId: payload.toolCallId,
          argsTextDelta: payload.argsTextDelta,
        });
        return;
      }
      case 'tool-call-input-streaming-end': {
        const payload = chunk.payload as { toolCallId: string };
        this._toolInputBuffers.delete(payload.toolCallId);
        this._emitTurnEvent({ type: 'tool_input_end', toolCallId: payload.toolCallId });
        return;
      }
      case 'tool-call': {
        const payload = chunk.payload as { toolCallId: string; toolName: string; args: unknown };
        this._activeTools.set(payload.toolCallId, {
          toolCallId: payload.toolCallId,
          toolName: payload.toolName,
          args: payload.args,
          startedAt: Date.now(),
        });
        this._toolInputBuffers.delete(payload.toolCallId);
        this._emitTurnEvent({
          type: 'tool_start',
          toolCallId: payload.toolCallId,
          toolName: payload.toolName,
          args: payload.args,
        });
        return;
      }
      case 'tool-result': {
        const payload = chunk.payload as { toolCallId: string; result: unknown; isError?: boolean };
        this._activeTools.delete(payload.toolCallId);
        this._emitTurnEvent({
          type: 'tool_end',
          toolCallId: payload.toolCallId,
          result: payload.result,
          isError: payload.isError ?? false,
        });
        return;
      }
      case 'tool-error': {
        const payload = chunk.payload as { toolCallId: string; error: unknown };
        this._activeTools.delete(payload.toolCallId);
        this._emitTurnEvent({
          type: 'tool_end',
          toolCallId: payload.toolCallId,
          result: payload.error,
          isError: true,
        });
        return;
      }
      default: {
        // Bridge whitelisted data-* writer chunks (§10.2) into typed harness events.
        if (typeof chunk.type === 'string' && chunk.type.startsWith('data-')) {
          const data = (chunk as { data?: unknown }).data;
          if (chunk.type === 'data-task-updated') {
            const tasks = (data as { tasks?: unknown })?.tasks;
            if (Array.isArray(tasks)) {
              this._emitTurnEvent({ type: 'task_updated', tasks: tasks as TaskUpdatedEvent['tasks'] });
            }
          } else if (chunk.type === 'data-tool-update') {
            const payload = data as { toolCallId?: unknown; partialResult?: unknown } | undefined;
            if (
              payload &&
              typeof payload.toolCallId === 'string' &&
              payload.toolCallId.length > 0 &&
              this._activeTools.has(payload.toolCallId)
            ) {
              this._emitTurnEvent({
                type: 'tool_update',
                toolCallId: payload.toolCallId,
                partialResult: payload.partialResult,
              });
            }
          } else if (chunk.type === 'data-shell-output') {
            const payload = data as { toolCallId?: unknown; output?: unknown; stream?: unknown } | undefined;
            if (
              payload &&
              typeof payload.toolCallId === 'string' &&
              payload.toolCallId.length > 0 &&
              typeof payload.output === 'string' &&
              (payload.stream === 'stdout' || payload.stream === 'stderr') &&
              this._activeTools.has(payload.toolCallId)
            ) {
              this._emitTurnEvent({
                type: 'shell_output',
                toolCallId: payload.toolCallId,
                output: payload.output,
                stream: payload.stream,
              });
            }
          }
        }
        return;
      }
    }
  }

  // -------------------------------------------------------------------------
  // message() — §4.2.
  //
  // Always-accept signal-driven entry point. Three return shapes:
  //
  //   * default                          → AgentResult (await everything)
  //   * { stream: true }                 → live MastraModelOutput
  //   * { output: schema, sync: true }   → fail-fast structured object
  //
  // Default + stream paths route through `agent.sendSignal()` (Slice A).
  // Structured + sync path stays on `agent.generate()` so typed-output
  // turn boundaries remain fail-fast and uncoupled from the subscription
  // multiplexer.
  // -------------------------------------------------------------------------

  /** Default: bundle the full agent output and return when the run finishes. */
  async message(opts: MessageOptionsDefault): Promise<AgentResult>;
  /** Streaming: hand the live `MastraModelOutput` back to the caller. */
  async message(opts: MessageOptionsStream): Promise<AgentStream>;
  /** Structured + sync: fail-fast typed object output. */
  async message<S extends z.ZodTypeAny>(opts: MessageOptionsStructured<S>): Promise<z.infer<S>>;
  async message(opts: MessageOptions): Promise<AgentResult | AgentStream | unknown> {
    this._assertLive('message()');

    if (opts.stream === true && opts.output !== undefined) {
      throw new HarnessConfigError('message()', '`stream: true` and `output` are mutually exclusive');
    }
    if (opts.output !== undefined && opts.sync !== true) {
      throw new HarnessConfigError('message()', 'structured `output` requires `sync: true` (typed turn boundary)');
    }

    // Resolve the effective mode (per-call override wins, else session's).
    const effectiveModeId = opts.mode ?? this._record.modeId;
    const mode = this._harness._getMode(effectiveModeId);
    const agent = this._harness.getAgentForMode(effectiveModeId);

    // Per-turn additionalTools merge with the mode's surface, never replace.
    const toolsets = this._buildToolsets(mode, opts.additionalTools);

    // Every turn runs under a session-owned AbortController so
    // `session.abort()` can cancel the in-flight run. If the caller passes
    // their own AbortSignal, we forward it into the session controller so
    // both paths converge on a single signal handed to the agent.
    const turnAbortController = this._beginTurn(opts.abortSignal);
    const turnAbortSignal = turnAbortController.signal;
    const requestContext = await this._buildRequestContext({
      modeId: effectiveModeId,
      abortSignal: turnAbortSignal,
    });

    const baseExecOptions: AgentExecutionOptionsBase<unknown> = {
      memory: { thread: this.threadId, resource: this.resourceId },
      abortSignal: turnAbortSignal,
      requestContext,
      ...(toolsets ? { toolsets } : {}),
      ...(mode.instructions ? { instructions: mode.instructions } : {}),
    };

    // agent_start signals the turn has begun. Subscribers can latch their
    // accumulators here. Emitted before either agent.stream() or
    // agent.generate() so structured/sync paths still see the boundary.
    this._emitTurnEvent({ type: 'agent_start' });

    // Structured + sync path: agent.generate with structuredOutput.
    if (opts.output !== undefined && opts.sync === true) {
      try {
        const result = await agent.generate(opts.content, {
          ...baseExecOptions,
          structuredOutput: { schema: opts.output as never },
        });
        const full = result as FullOutput<unknown>;
        this._recordTurnCompletion(full);
        await this._maybeCaptureSuspend(full);
        this._emitTurnEvent({
          type: 'agent_end',
          reason: full.finishReason === 'suspended' ? 'suspended' : 'complete',
          runId: full.runId,
        });
        await this._runGoalJudge(full, false);
        return full.object;
      } finally {
        this._endTurn(turnAbortController);
      }
    }

    // Signal-routed path: every non-structured message goes through
    // `agent.sendSignal()`. The long-lived thread subscription is the
    // single chunk consumer for this Session; the drain loop emits
    // per-chunk harness events and resolves `_runCompletionPromises[runId]`
    // when the run terminates.
    //
    // On an idle thread the agent starts a fresh run with
    // `agent.stream(signal, streamOptions)`; on an active same-agent run
    // the signal drains mid-flight into the running execution loop. Both
    // paths surface chunks through the same subscription stream.
    await this._ensureThreadSubscription(agent);

    const signal = agent.sendSignal(
      { type: 'user-message', contents: opts.content as never },
      {
        resourceId: this.resourceId,
        threadId: this.threadId,
        ifIdle: { behavior: 'wake', streamOptions: baseExecOptions as never },
      },
    );

    // Register the completion waiter BEFORE the drain has a chance to see
    // a terminal chunk for this runId (the run can start synchronously on
    // the wake path).
    const completion = this._awaitRunCompletion(signal.runId);

    // Streaming path: hand the live `MastraModelOutput` back. The drain
    // loop is responsible for harness events; we still keep the turn
    // in-flight (so `isRunning()` reports true) until the run completes.
    if (opts.stream === true) {
      const out = agent.getRunOutput(signal.runId) as MastraModelOutput<unknown> | undefined;
      if (!out) {
        this._endTurn(turnAbortController);
        // Drop the completion waiter so the drain doesn't try to resolve into
        // a dead listener.
        this._runCompletionPromises.delete(signal.runId);
        throw new HarnessConfigError('message()', 'agent did not register a run for the dispatched signal');
      }
      void completion
        .then(full => {
          this._recordTurnCompletion(full);
          return this._maybeCaptureSuspend(full).then(() => {
            this._emitTurnEvent({
              type: 'agent_end',
              reason: full.finishReason === 'suspended' ? 'suspended' : 'complete',
              runId: full.runId,
            });
            return this._runGoalJudge(full, false);
          });
        })
        .catch(() => {
          // The caller owns the visible stream; swallow drain-side errors.
        })
        .finally(() => {
          this._endTurn(turnAbortController);
          void this._maybeDrainQueue();
        });
      return out;
    }

    // Default path: wait for the drain to deliver this run's terminal
    // chunk and bundled `FullOutput`, then run post-turn bookkeeping.
    try {
      const full = await completion;
      this._recordTurnCompletion(full);
      await this._maybeCaptureSuspend(full);
      this._emitTurnEvent({
        type: 'agent_end',
        reason: full.finishReason === 'suspended' ? 'suspended' : 'complete',
        runId: full.runId,
      });
      await this._runGoalJudge(full, false);
      return full;
    } finally {
      this._endTurn(turnAbortController);
      // Now that the manual turn has cleared the in-flight guard, kick
      // the queue drain so any item that was admitted mid-turn can run.
      void this._maybeDrainQueue();
    }
  }

  /**
   * If the agent run finished suspended, persist a `PendingResume` pointer
   * derived from `FullOutput.suspendPayload` + `runId`. Subsequent calls to
   * `respondTool*` use this pointer to call `agent.resumeStream(...)`.
   *
   * Maps the agent's `tool-call-approval` / `tool-call-suspended` chunks to
   * the four harness-layer kinds:
   *   - tool name `ask_user`     → 'question'
   *   - tool name `submit_plan`  → 'plan-approval'
   *   - payload has `suspendPayload` → 'tool-suspension'
   *   - else                          → 'tool-approval'
   *
   * No-op when the run did not suspend.
   */
  private async _maybeCaptureSuspend(full: FullOutput<unknown>): Promise<void> {
    if (full.finishReason !== 'suspended') return;
    const payload = full.suspendPayload as
      | { toolCallId: string; toolName: string; args?: unknown; suspendPayload?: unknown }
      | undefined;
    if (!payload || !full.runId) return;

    const kind = this._classifyResumeKind(payload);
    const pending: PendingResume = {
      kind,
      runId: full.runId,
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      source: 'parent',
      requestedAt: Date.now(),
      payload: this._buildResumePayload(kind, payload),
    };

    if (kind === 'plan-approval') {
      const mode = this._harness._getMode(this._record.modeId);
      if (mode.transitionsTo) pending.transitionModeId = mode.transitionsTo;
    }

    await this._flushUpdate(prev => ({ ...prev, pendingResume: pending }));

    // Emit suspension_required AFTER the durable-parking barrier (§5.4) so
    // any subscriber observing this event can reconstruct the pending state
    // from storage.
    this._emitTurnEvent({
      type: 'suspension_required',
      kind,
      toolCallId: pending.toolCallId,
      toolName: pending.toolName,
      runId: pending.runId,
    });
  }

  private _classifyResumeKind(payload: { toolName: string; suspendPayload?: unknown }): PendingResume['kind'] {
    if (payload.toolName === ASK_USER_TOOL_NAME) return 'question';
    if (payload.toolName === SUBMIT_PLAN_TOOL_NAME) return 'plan-approval';
    if ('suspendPayload' in payload && payload.suspendPayload !== undefined) return 'tool-suspension';
    return 'tool-approval';
  }

  private _buildResumePayload(
    kind: PendingResume['kind'],
    payload: { args?: unknown; suspendPayload?: unknown },
  ): PendingResume['payload'] {
    switch (kind) {
      case 'tool-approval':
        return { input: payload.args };
      case 'tool-suspension':
        return { input: payload.args, suspendData: payload.suspendPayload };
      case 'question': {
        const args = (payload.args ?? {}) as {
          question?: string;
          options?: { label: string; description?: string }[];
          selectionMode?: 'single_select' | 'multi_select';
        };
        return {
          question: args.question,
          options: args.options,
          selectionMode: args.selectionMode,
        };
      }
      case 'plan-approval': {
        const args = (payload.args ?? {}) as { title?: string; plan?: string };
        return { title: args.title, plan: args.plan };
      }
    }
  }

  // -------------------------------------------------------------------------
  // Mode / model getters + setters — §4.2.
  //
  // The session is the local authority for the active mode/model id; the
  // backing agent is selected via Harness lookup. Setters CAS-write through
  // storage so a concurrent harness instance that holds the lease cannot
  // observe a stale value.
  // -------------------------------------------------------------------------

  /** Resolved active mode (per the session record). */
  getCurrentMode(): HarnessMode {
    this._assertLive('getCurrentMode()');
    return this._harness._getMode(this._record.modeId);
  }

  /** Active model id for the session. */
  getCurrentModel(): string {
    this._assertLive('getCurrentModel()');
    return this._record.modelId;
  }

  /**
   * Switch the active mode for subsequent turns. The backing agent flips
   * with the next `message()`/`queue()` call. Throws if the mode id is
   * unknown.
   */
  async switchMode(opts: { mode: string }): Promise<void> {
    this._assertLive('switchMode()');
    // Validates and throws on unknown id.
    this._harness._getMode(opts.mode);
    const previousModeId = this._record.modeId;
    if (previousModeId === opts.mode) return;
    await this._flushUpdate(prev => ({ ...prev, modeId: opts.mode }));
    this._emitter.emit({ type: 'mode_changed', modeId: opts.mode, previousModeId });
  }

  /** Switch the active model id. Free-form string — validated by the agent layer. */
  async switchModel(opts: { model: string }): Promise<void> {
    this._assertLive('switchModel()');
    const previousModelId = this._record.modelId;
    if (previousModelId === opts.model) return;
    await this._flushUpdate(prev => ({ ...prev, modelId: opts.model }));
    this._emitter.emit({ type: 'model_changed', modelId: opts.model, previousModelId });
  }

  // -------------------------------------------------------------------------
  // Custom state (§4.2 / §6.1).
  //
  // The session holds an opaque typed state blob persisted alongside the
  // SessionRecord. The two write forms are equivalent surfaces, but the
  // functional form gives tools an atomic read-modify-write that doesn't
  // stomp concurrent writes from earlier in the same turn.
  // -------------------------------------------------------------------------

  /** Returns the current state. Always resolves with the latest persisted value. */
  async getState<TState = unknown>(): Promise<TState> {
    this._assertLive('getState()');
    return (this._record.state ?? {}) as TState;
  }

  /**
   * Replace or merge the session state. The object form does a shallow merge;
   * the functional form atomically reads the current state, runs the updater,
   * and writes the result. The functional form is the right choice for tools
   * that bump counters or otherwise depend on the previous value.
   */
  setState<TState = unknown>(updates: Partial<TState>): Promise<void>;
  setState<TState = unknown>(updater: (prev: TState) => TState): Promise<void>;
  async setState<TState = unknown>(updatesOrUpdater: Partial<TState> | ((prev: TState) => TState)): Promise<void> {
    this._assertLive('setState()');
    await this._flushUpdate(prev => {
      const current = (prev.state ?? {}) as TState;
      const next =
        typeof updatesOrUpdater === 'function'
          ? (updatesOrUpdater as (prev: TState) => TState)(current)
          : ({ ...(current as object), ...(updatesOrUpdater as object) } as TState);
      return { ...prev, state: next };
    });
  }

  // -------------------------------------------------------------------------
  // getDisplayState — §4.2.
  //
  // Point-in-time snapshot used by TUIs / Studio. Reads off the in-memory
  // `SessionRecord` plus transient per-turn tracking (`_currentRunId`,
  // `_activeTools`, `_toolInputBuffers`, `_activeSubagents`, `_tokenUsage`).
  // Doesn't touch storage. Returned Record/Map projections are fresh on
  // every call — do not mutate them.
  //
  // Persistent thread-level aggregates (task lists, modified-file ledgers,
  // OM progress) live in `session.state`, not here — see the spec doc-comment
  // in §4.2 for the split rationale.
  // -------------------------------------------------------------------------

  getDisplayState(): SessionDisplayState {
    this._assertLive('getDisplayState()');
    const rec = this._record;
    const snapshot: SessionDisplayState = {
      // Identity
      sessionId: this.id,
      threadId: this.threadId,
      resourceId: this.resourceId,
      lifecycleState: this._state,
      modeId: rec.modeId,
      modelId: rec.modelId,
      createdAt: this.createdAt,
      lastActivityAt: rec.lastActivityAt,

      // Run
      isRunning: this.isRunning(),

      // Activity — fresh projections so callers can't mutate internal maps
      activeTools: Object.fromEntries(this._activeTools.entries()),
      toolInputBuffers: Object.fromEntries(this._toolInputBuffers.entries()),
      activeSubagents: Object.fromEntries(this._activeSubagents.entries()),

      // Tokens — copy so the caller can't mutate the running aggregate
      tokenUsage: { ...this._tokenUsage },

      // Pending interrupt — full payload, single field (see §5.1)
      pending: rec.pendingResume ?? null,

      // Queue
      queueDepth: rec.pendingQueue.length,
    };
    if (this.parentSessionId !== undefined) snapshot.parentSessionId = this.parentSessionId;
    if (this._currentRunId !== undefined) snapshot.currentRunId = this._currentRunId;
    if (this._currentMessageId !== undefined) snapshot.currentMessageId = this._currentMessageId;
    if (this._currentTraceId !== undefined) snapshot.currentTraceId = this._currentTraceId;
    if (this._currentQueuedItemId !== undefined) snapshot.currentQueuedItemId = this._currentQueuedItemId;
    if (rec.goal !== undefined) snapshot.goal = rec.goal;
    return snapshot;
  }

  // -------------------------------------------------------------------------
  // listMessages — §4.2, §4.4.
  //
  // Read-only history readback for this session's thread, returned
  // oldest-first. Delegates to the memory storage domain on the bound Mastra
  // instance and maps each row into the public `HarnessMessage` partition
  // (spec §11.1) via the shared converter.
  //
  // Returns `[]` when memory storage is not configured (e.g. ad-hoc threads,
  // tests with no storage wired). Throws if the session is no longer live.
  // -------------------------------------------------------------------------

  async listMessages(opts?: ListMessagesOptions): Promise<HarnessMessage[]> {
    this._assertLive('listMessages()');
    const memory = await this._harness._internalTryGetMemoryStorage();
    if (!memory) return [];

    const limit = opts?.limit;
    if (limit !== undefined && (!Number.isFinite(limit) || limit < 0 || !Number.isInteger(limit))) {
      throw new HarnessValidationError('limit', `\`limit\` must be a non-negative integer; received ${String(limit)}`);
    }
    if (limit === 0) return [];

    // When `limit` is set, fetch the most recent N (DESC) and reverse to
    // restore chronological order. Otherwise fetch the full thread history
    // in natural order — mirrors the legacy harness's two-path behaviour.
    if (limit !== undefined) {
      const result = await memory.listMessages({
        threadId: this.threadId,
        perPage: limit,
        page: 0,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      return result.messages
        .slice()
        .reverse()
        .map(msg => convertStoredMessageToHarnessMessage(msg as unknown as StoredMessageRow));
    }

    const result = await memory.listMessages({ threadId: this.threadId, perPage: false });
    return result.messages.map(msg => convertStoredMessageToHarnessMessage(msg as unknown as StoredMessageRow));
  }

  // -------------------------------------------------------------------------
  // Goals — §4.7.
  //
  // A goal is a standing objective attached to the session that survives
  // across turns. While the goal is `active`, the harness invokes a separate
  // judge model after every assistant turn (`_recordTurnCompletion` hook)
  // and dispatches its verdict (`done` / `continue` / `waiting`). On
  // `continue`, the harness self-enqueues a continuation turn via the
  // session's own `pendingQueue` so user follow-ups preempt it cleanly.
  //
  // Goals are session-scoped (not thread-scoped) and are forbidden on
  // subagent sessions — subagents are bounded units of work that already
  // terminate at task completion.
  // -------------------------------------------------------------------------

  /**
   * Attach a goal to this session. Replaces any existing goal (emits
   * `goal_cleared` for the prior goal first, then `goal_set`). Resets the
   * turn counter and persists to `SessionRecord.goal`.
   *
   * When `kickoff` is `true` (default), an initial continuation turn is
   * enqueued so the agent starts working without an explicit `message()`.
   */
  async setGoal(opts: GoalOptions): Promise<GoalState> {
    this._assertLive('setGoal()');
    if (this.parentSessionId !== undefined || this._record.origin === 'subagent-tool') {
      throw new HarnessValidationError('setGoal', 'goals cannot be set on subagent sessions (parent owns the loop)');
    }
    if (typeof opts.objective !== 'string' || opts.objective.length === 0) {
      throw new HarnessValidationError('setGoal.objective', 'must be a non-empty string');
    }
    if (opts.maxTurns !== undefined && (!Number.isInteger(opts.maxTurns) || opts.maxTurns < 1)) {
      throw new HarnessValidationError('setGoal.maxTurns', 'must be a positive integer');
    }

    const defaults = this._harness._internalGoalDefaults;
    const judgeModelId = opts.judgeModel ?? defaults.defaultJudgeModel;
    if (typeof judgeModelId !== 'string' || judgeModelId.length === 0) {
      throw new HarnessValidationError(
        'setGoal.judgeModel',
        'no judge model provided and `goals.defaultJudgeModel` is not configured',
      );
    }

    const priorId = this._record.goal?.id;
    const goal: GoalState = {
      id: `goal-${randomUUID()}`,
      objective: opts.objective,
      status: 'active',
      turnsUsed: 0,
      maxTurns: opts.maxTurns ?? defaults.defaultMaxTurns,
      judgeModelId,
      createdAt: Date.now(),
    };

    await this._flushUpdate(prev => ({ ...prev, goal }));
    if (priorId !== undefined) {
      this._emit({ type: 'goal_cleared', goalId: priorId });
    }
    this._emit({ type: 'goal_set', goal });

    if (opts.kickoff !== false) {
      await this._enqueueGoalContinuation(goal, buildKickoffContinuation(opts.objective));
    }

    return goal;
  }

  /** Return the active goal, if any. */
  getGoal(): GoalState | undefined {
    this._assertLive('getGoal()');
    return this._record.goal;
  }

  /** Pause auto-continuations without losing the goal. Emits `goal_paused`. */
  async pauseGoal(): Promise<GoalState | undefined> {
    this._assertLive('pauseGoal()');
    const goal = this._record.goal;
    if (!goal || goal.status === 'paused') return goal;
    const updated: GoalState = { ...goal, status: 'paused' };
    await this._flushUpdate(prev => ({ ...prev, goal: updated }));
    this._emit({ type: 'goal_paused', goalId: goal.id, reason: 'requested' });
    return updated;
  }

  /**
   * Resume an inactive goal. Re-emits `goal_resumed` and enqueues a fresh
   * continuation turn so the agent picks up where it left off.
   */
  async resumeGoal(): Promise<GoalState | undefined> {
    this._assertLive('resumeGoal()');
    const goal = this._record.goal;
    if (!goal) return undefined;
    if (goal.status === 'active') return goal;
    const updated: GoalState = { ...goal, status: 'active' };
    await this._flushUpdate(prev => ({ ...prev, goal: updated }));
    this._emit({ type: 'goal_resumed', goalId: goal.id });
    await this._enqueueGoalContinuation(updated, buildResumeContinuation(updated.objective));
    return updated;
  }

  /** Drop the goal entirely. Emits `goal_cleared`. */
  async clearGoal(): Promise<void> {
    this._assertLive('clearGoal()');
    const goal = this._record.goal;
    if (!goal) return;
    await this._flushUpdate(prev => {
      const next = { ...prev };
      delete next.goal;
      return next;
    });
    this._emit({ type: 'goal_cleared', goalId: goal.id });
  }

  /**
   * Re-point judge model and/or budget on the in-flight goal. Parity with
   * TUI's `GoalManager.updateJudgeDefaults`. Both fields are optional; pass
   * only what you want to change. Does not reset `turnsUsed`, does not emit
   * `goal_paused`/`goal_resumed`. No-op when no goal is set.
   *
   * Returns the updated goal, or `undefined` if there's nothing to update.
   */
  async updateJudgeDefaults(opts: { judgeModelId?: string; maxTurns?: number }): Promise<GoalState | undefined> {
    this._assertLive('updateJudgeDefaults()');
    const goal = this._record.goal;
    if (!goal) return undefined;
    if (opts.judgeModelId === undefined && opts.maxTurns === undefined) return goal;
    if (opts.maxTurns !== undefined && (!Number.isFinite(opts.maxTurns) || opts.maxTurns <= 0)) {
      throw new HarnessValidationError('maxTurns', 'maxTurns must be a positive number');
    }
    const updated: GoalState = {
      ...goal,
      ...(opts.judgeModelId !== undefined ? { judgeModelId: opts.judgeModelId } : {}),
      ...(opts.maxTurns !== undefined ? { maxTurns: opts.maxTurns } : {}),
    };
    await this._flushUpdate(prev => ({ ...prev, goal: updated }));
    return updated;
  }

  /**
   * @internal — enqueue a goal-driven continuation turn. Caller is responsible
   * for building the final prompt content (kickoff / resume / judge-continue
   * each use a distinct template — see `buildKickoffContinuation` /
   * `buildResumeContinuation` / `buildJudgeContinuation`). Marked with
   * `source: 'goal'` so the judge loop knows to skip re-judging on the
   * resulting turn (otherwise the loop would never terminate).
   */
  private async _enqueueGoalContinuation(goal: GoalState, content: string): Promise<void> {
    const cap = this._harness._internalMaxQueueDepth;
    if ((this._record.pendingQueue?.length ?? 0) >= cap) {
      // Drop continuation silently — user activity has filled the queue,
      // we'll re-judge after they drain. Better than failing the judge call.
      return;
    }
    const item: QueuedItem = {
      id: `q-${randomUUID()}`,
      enqueuedAt: Date.now(),
      content,
      attachments: [],
      source: 'goal',
      goalId: goal.id,
    };
    await this._flushUpdate(prev => ({
      ...prev,
      pendingQueue: [...(prev.pendingQueue ?? []), item],
    }));
    void this._maybeDrainQueue();
  }

  /**
   * @internal — invoked from `_recordTurnCompletion` after every assistant
   * turn settles. Implements the judge loop (§4.7).
   *
   * Triple stale-goal gate: we capture the goal id before fetching context,
   * before calling the judge, and before enqueueing the continuation. If
   * any check fails the verdict is discarded silently (no event, no state
   * change) — the user has already moved on.
   */
  private async _runGoalJudge(turn: FullOutput<unknown>, wasGoalDriven: boolean): Promise<void> {
    // Skip re-judging on goal-driven continuation turns to avoid a tight
    // loop where every continuation triggers another judge call. The
    // judge only runs after user-driven turns; continuations are auto-
    // generated from the prior judge call.
    if (wasGoalDriven) return;

    const goal = this._record.goal;
    if (!goal || goal.status !== 'active') return;

    const evaluatedGoalId = goal.id;

    // Suspended turns don't count toward the judge loop — wait for resume.
    if (turn.finishReason === 'suspended') return;

    // Gate 1 — re-read goal after the async context fetch. If it's been
    // cleared / paused / replaced, drop this judge cycle silently.
    const context = await this._getJudgeContext(turn);
    if (this._record.goal?.id !== evaluatedGoalId || this._record.goal.status !== 'active') return;

    // No-assistant-message fallback: parity with TUI's evaluateAfterTurn.
    // The judge has nothing to score, but the agent still made some attempt
    // (typically a tool call without a closing assistant message). Push a
    // gentle nudge unless we've hit the budget.
    if (!context.lastAssistantContent) {
      if (goal.turnsUsed >= goal.maxTurns) {
        await this._flushUpdate(prev =>
          prev.goal && prev.goal.id === evaluatedGoalId
            ? { ...prev, goal: { ...prev.goal, status: 'paused' as const } }
            : prev,
        );
        this._emit({ type: 'goal_paused', goalId: evaluatedGoalId, reason: 'budget_exhausted' });
        return;
      }
      await this._enqueueGoalContinuation(
        goal,
        buildJudgeContinuation({
          turn: goal.turnsUsed,
          max: goal.maxTurns,
          objective: goal.objective,
          judgeReason: 'No response yet, keep working.',
        }),
      );
      return;
    }

    let decision: GoalJudgeDecision;
    try {
      decision = await this._callJudge(goal, turn);
    } catch {
      // Gate 2a — goal might have changed during the judge call.
      if (this._record.goal?.id !== evaluatedGoalId) return;
      await this._flushUpdate(prev =>
        prev.goal && prev.goal.id === evaluatedGoalId
          ? { ...prev, goal: { ...prev.goal, status: 'paused' as const } }
          : prev,
      );
      this._emit({ type: 'goal_paused', goalId: evaluatedGoalId, reason: 'judge_failed' });
      return;
    }

    // Gate 2b — goal might have changed during the judge call.
    if (this._record.goal?.id !== evaluatedGoalId) return;

    const turnsUsed = decision.decision === 'waiting' ? goal.turnsUsed : goal.turnsUsed + 1;
    const updated: GoalState = { ...goal, turnsUsed, lastDecision: decision };

    await this._flushUpdate(prev =>
      prev.goal && prev.goal.id === evaluatedGoalId ? { ...prev, goal: updated } : prev,
    );

    this._emit({
      type: 'goal_judged',
      goalId: evaluatedGoalId,
      decision,
      turnsUsed,
      maxTurns: updated.maxTurns,
    });

    if (decision.decision === 'done') {
      await this._flushUpdate(prev =>
        prev.goal && prev.goal.id === evaluatedGoalId
          ? { ...prev, goal: { ...prev.goal, status: 'done' as const } }
          : prev,
      );
      this._emit({ type: 'goal_done', goalId: evaluatedGoalId, reason: decision.reason, turnsUsed });
      return;
    }

    if (decision.decision === 'waiting') return;

    // decision.decision === 'continue'
    if (turnsUsed >= updated.maxTurns) {
      await this._flushUpdate(prev =>
        prev.goal && prev.goal.id === evaluatedGoalId
          ? { ...prev, goal: { ...prev.goal, status: 'paused' as const } }
          : prev,
      );
      this._emit({ type: 'goal_paused', goalId: evaluatedGoalId, reason: 'budget_exhausted' });
      return;
    }

    // Gate 3 — final stale check before enqueueing.
    if (this._record.goal?.id !== evaluatedGoalId || this._record.goal.status !== 'active') return;
    await this._enqueueGoalContinuation(
      updated,
      buildJudgeContinuation({
        turn: turnsUsed,
        max: updated.maxTurns,
        objective: updated.objective,
        judgeReason: decision.reason,
      }),
    );
  }

  /**
   * @internal — execute the judge model. Returns a `GoalJudgeDecision`.
   *
   * Test-injection hook: when `__testJudge` is set on this session, it
   * runs in place of the real judge call so unit tests can drive verdicts
   * deterministically without standing up a live model.
   */
  private async _callJudge(goal: GoalState, turn: FullOutput<unknown>): Promise<GoalJudgeDecision> {
    const hook = this.__testJudge;
    if (hook) {
      const verdict = await hook(goal);
      return { ...verdict, judgedAt: Date.now() };
    }
    // Real judge path. Mirrors the TUI's GoalManager.callJudge:
    //   - dedicated `goal-judge` Agent with JUDGE_SYSTEM_PROMPT baked in
    //   - input processor: ProviderHistoryCompat (history-shape parity
    //     across providers, esp. Anthropic)
    //   - error processors: StreamErrorRetryProcessor, PrefillErrorHandler,
    //     ProviderHistoryCompat (retry flaky judge streams cleanly)
    //   - dedicated memory thread `${sessionId}-${goalId}` so the judge
    //     sees continuity across iterations (its own prior verdicts)
    //   - structured output via the judge schema
    //   - context: goal + last user content + assistantStepsSinceLastUser
    //     + truncated last assistant content (4000-char cap)
    const context = await this._getJudgeContext(turn);
    const judgeAgent = this._createJudgeAgent(goal);
    const memory = await judgeAgent.getMemory({ requestContext: new RequestContext() });
    const judgeThreadId = `${this._record.id}-${goal.id}`;

    if (memory) {
      const existing = await memory.getThreadById({ threadId: judgeThreadId });
      if (!existing) {
        await memory.createThread({
          threadId: judgeThreadId,
          resourceId: this._record.resourceId,
          title: `Goal judge: ${goal.objective.slice(0, 80)}`,
          metadata: {
            goalJudge: true,
            parentSessionId: this._record.id,
            goalId: goal.id,
          },
        });
      }
    }

    const truncatedAssistant = truncateForJudge(context.lastAssistantContent ?? 'No response yet, keep working.');
    const recentUser = context.lastUserContent
      ? `\n\nLatest user message:\n${truncateForJudge(context.lastUserContent)}\n\nAssistant steps since that user message: ${context.assistantStepsSinceLastUser}`
      : '';
    const prompt = `Goal: ${goal.objective}${recentUser}\n\nLatest assistant message:\n${truncatedAssistant}`;

    const stream = await judgeAgent.stream(prompt, {
      ...(memory ? { memory: { thread: judgeThreadId, resource: this._record.resourceId } } : {}),
      structuredOutput: { schema: GoalJudgeSchema },
    } as never);

    await (stream as { consumeStream: () => Promise<void> }).consumeStream();
    const full = (await (stream as { getFullOutput: () => Promise<unknown> }).getFullOutput()) as {
      object?: unknown;
    };
    const obj = full.object as { decision: 'done' | 'continue' | 'waiting'; reason: string } | undefined;
    if (!obj || typeof obj !== 'object') {
      throw new Error('judge returned no structured output');
    }
    return { decision: obj.decision, reason: obj.reason, judgedAt: Date.now() };
  }

  /** @internal — test-only hook used by `session.goal.test.ts`. */
  __testJudge?: (goal: GoalState) => Promise<Omit<GoalJudgeDecision, 'judgedAt'>>;

  /**
   * Build the conversation context the judge sees: the latest user content,
   * how many assistant steps have happened since that user message, and the
   * latest assistant content. Mirrors `GoalManager.getRecentConversationContext`.
   */
  private async _getJudgeContext(turn?: FullOutput<unknown>): Promise<{
    lastUserContent: string | null;
    assistantStepsSinceLastUser: number;
    lastAssistantContent: string | null;
  }> {
    let messages: HarnessMessage[] = [];
    try {
      messages = await this.listMessages();
    } catch {
      // listMessages can fail in ad-hoc-thread setups; we'll fall back to
      // the in-memory turn text below.
    }

    let lastUserIndex = -1;
    let lastAssistantContent: string | null = null;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i] as { role?: string; content?: unknown } | undefined;
      if (!msg) continue;
      if (!lastAssistantContent && msg.role === 'assistant') {
        lastAssistantContent = this._extractTextContent(msg.content);
      }
      if (msg.role === 'user') {
        lastUserIndex = i;
        break;
      }
    }

    // Storage may not have the assistant turn yet (depends on the agent
    // wiring). Fall back to the in-memory `turn.text` we just produced.
    if (!lastAssistantContent && turn) {
      const text = (turn as { text?: string }).text;
      if (typeof text === 'string' && text.length > 0) {
        lastAssistantContent = text;
      }
    }

    const lastUserContent =
      lastUserIndex >= 0 ? this._extractTextContent((messages[lastUserIndex] as { content?: unknown }).content) : null;
    const assistantStepsSinceLastUser =
      lastUserIndex >= 0
        ? messages.slice(lastUserIndex + 1).filter(m => (m as { role?: string }).role === 'assistant').length
        : 0;

    return {
      lastUserContent,
      assistantStepsSinceLastUser,
      lastAssistantContent,
    };
  }

  private _extractTextContent(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter(part => (part as { type?: string })?.type === 'text')
        .map(part => (part as { text?: string }).text ?? '')
        .join('\n');
    }
    return String(content ?? '');
  }

  /**
   * Construct the dedicated judge Agent. The processor chain matches the
   * TUI's GoalManager so the harness-native judge has the same robustness
   * against provider history quirks and transient stream errors.
   *
   * The judge agent is bound to the same Mastra instance as the parent
   * session so it inherits memory/storage wiring.
   */
  private _createJudgeAgent(goal: GoalState): Agent {
    const model = new ModelRouterLanguageModel(goal.judgeModelId as never);
    return new Agent({
      id: 'goal-judge',
      name: 'Goal Judge',
      instructions: JUDGE_SYSTEM_PROMPT,
      model,
      mastra: this._harness.mastra,
      inputProcessors: [new ProviderHistoryCompat()],
      errorProcessors: [new StreamErrorRetryProcessor(), new PrefillErrorHandler(), new ProviderHistoryCompat()],
    });
  }

  // -------------------------------------------------------------------------
  // Suspend / resume — §4.2.
  //
  // When `message()` (or a queued turn) finishes with `finishReason
  // === 'suspended'`, the harness persists a `PendingResume` record holding
  // the agent's `runId` + `toolCallId` + UX-facing payload. Callers respond
  // through one of four typed entry points; all funnel into `_resume(...)`,
  // which is the single place that calls `agent.resumeStream(...)`.
  //
  // `pendingResume.resumedAt` is set under the lease before the agent call so
  // a crash between "marked resumed" and "cleared pending" replays as a no-op
  // on rehydration (idempotent at-least-once).
  // -------------------------------------------------------------------------

  /** Resume a pending tool-approval. `approved: false` rejects the call. */
  async respondToToolApproval(opts: { approved: boolean }): Promise<AgentResult> {
    return this._resume('tool-approval', { approved: opts.approved });
  }

  /** Resume a pending tool-suspension. `resumeData` is forwarded to the tool. */
  async respondToToolSuspension(opts: { resumeData: unknown }): Promise<AgentResult> {
    return this._resume('tool-suspension', opts.resumeData);
  }

  /** Resume a pending `ask_user` question. */
  async respondToQuestion(opts: { answer: unknown }): Promise<AgentResult> {
    return this._resume('question', { answer: opts.answer });
  }

  /**
   * Resume a pending `submit_plan` approval.
   *
   * On `approved: true` the harness flips the active mode to:
   *   - `opts.transitionToMode` when supplied (overrides mode-declared default), OR
   *   - the submitting mode's declared `transitionsTo` when set, OR
   *   - no-op (stays in the submitting mode).
   *
   * `revision` is free-form reviewer feedback forwarded to the tool as
   * `resumeData.revision` (see `submitPlan` resume schema). It is independent
   * of approval — the reviewer can approve with a revision note or reject
   * with revision guidance.
   */
  async respondToPlanApproval(opts: {
    approved: boolean;
    revision?: string;
    transitionToMode?: string;
  }): Promise<AgentResult> {
    if (opts.transitionToMode !== undefined) {
      // Validate eagerly so callers see a clean error rather than a CAS-time
      // throw from inside the resume flow.
      this._harness._getMode(opts.transitionToMode);
    }
    return this._resume('plan-approval', {
      approved: opts.approved,
      revision: opts.revision,
      transitionToMode: opts.transitionToMode,
    });
  }

  // -------------------------------------------------------------------------
  // Permissions (§4.2e).
  //
  // Session-scoped grants (`SessionRecord.sessionGrants`) and policy rules
  // (`SessionRecord.permissionRules`) compose with the tool's static
  // approval flag, the harness `defaultPermissionPolicy`, and any
  // resolver-supplied category to decide allow/ask/deny on each tool call.
  //
  // Both surfaces are persisted under the session's write lease so a crash
  // mid-grant either lands entirely or not at all.
  // -------------------------------------------------------------------------

  /**
   * Session permissions namespace (§4.2e). All mutators write
   * `SessionRecord.permissionRules` / `SessionRecord.sessionGrants` under
   * the session lease and resolve only after the durable transition
   * commits. Validation, closed-session, ownership, or storage failures
   * reject before any event or display projection is emitted.
   */
  readonly permissions = Object.freeze({
    grantCategory: (opts: { category: ToolCategory }): Promise<void> => this._permGrantCategory(opts),
    grantTool: (opts: { toolName: string }): Promise<void> => this._permGrantTool(opts),
    revokeCategory: (opts: { category: ToolCategory }): Promise<void> => this._permRevokeCategory(opts),
    revokeTool: (opts: { toolName: string }): Promise<void> => this._permRevokeTool(opts),
    getGrants: (): Readonly<SessionGrants> => this._permGetGrants(),
    getRules: (): Readonly<PermissionRules> => this._permGetRules(),
    setPolicy: (
      opts:
        | { category: ToolCategory; toolName?: never; policy: PermissionPolicy }
        | { toolName: string; category?: never; policy: PermissionPolicy },
    ): Promise<void> => this._permSetPolicy(opts),
  });

  /**
   * Grant every tool in a category for the lifetime of this session
   * ("don't ask again for `read` tools"). No-op if already granted.
   * Emits `permission_granted` on a transition.
   */
  private async _permGrantCategory(opts: { category: ToolCategory }): Promise<void> {
    this._assertLive('permissions.grantCategory()');
    assertToolCategory('permissions.grantCategory', opts.category);
    if (this._record.sessionGrants.categories.includes(opts.category)) return;
    await this._flushUpdate(prev => ({
      ...prev,
      sessionGrants: {
        ...prev.sessionGrants,
        categories: [...prev.sessionGrants.categories, opts.category],
      },
    }));
    this._emitter.emit({ type: 'permission_granted', category: opts.category });
  }

  /**
   * Grant a specific tool for the lifetime of this session. No-op if
   * already granted. Emits `permission_granted` on a transition.
   */
  private async _permGrantTool(opts: { toolName: string }): Promise<void> {
    this._assertLive('permissions.grantTool()');
    assertToolName('permissions.grantTool', opts.toolName);
    if (this._record.sessionGrants.tools.includes(opts.toolName)) return;
    await this._flushUpdate(prev => ({
      ...prev,
      sessionGrants: {
        ...prev.sessionGrants,
        tools: [...prev.sessionGrants.tools, opts.toolName],
      },
    }));
    this._emitter.emit({ type: 'permission_granted', toolName: opts.toolName });
  }

  /**
   * Revoke a previously granted category. No-op if not granted. Emits
   * `permission_revoked` on a transition.
   */
  private async _permRevokeCategory(opts: { category: ToolCategory }): Promise<void> {
    this._assertLive('permissions.revokeCategory()');
    assertToolCategory('permissions.revokeCategory', opts.category);
    const idx = this._record.sessionGrants.categories.indexOf(opts.category);
    if (idx === -1) return;
    await this._flushUpdate(prev => ({
      ...prev,
      sessionGrants: {
        ...prev.sessionGrants,
        categories: prev.sessionGrants.categories.filter(c => c !== opts.category),
      },
    }));
    this._emitter.emit({ type: 'permission_revoked', category: opts.category });
  }

  /**
   * Revoke a previously granted tool. No-op if not granted. Emits
   * `permission_revoked` on a transition.
   */
  private async _permRevokeTool(opts: { toolName: string }): Promise<void> {
    this._assertLive('permissions.revokeTool()');
    assertToolName('permissions.revokeTool', opts.toolName);
    const idx = this._record.sessionGrants.tools.indexOf(opts.toolName);
    if (idx === -1) return;
    await this._flushUpdate(prev => ({
      ...prev,
      sessionGrants: {
        ...prev.sessionGrants,
        tools: prev.sessionGrants.tools.filter(t => t !== opts.toolName),
      },
    }));
    this._emitter.emit({ type: 'permission_revoked', toolName: opts.toolName });
  }

  /** Read-only snapshot of the session's current grants. */
  private _permGetGrants(): Readonly<SessionGrants> {
    this._assertLive('permissions.getGrants()');
    const { categories, tools } = this._record.sessionGrants;
    return Object.freeze({ categories: [...categories], tools: [...tools] });
  }

  /** Read-only snapshot of the session's current per-category / per-tool rules. */
  private _permGetRules(): Readonly<PermissionRules> {
    this._assertLive('permissions.getRules()');
    const { categories, tools } = this._record.permissionRules;
    return Object.freeze({ categories: { ...categories }, tools: { ...tools } });
  }

  /**
   * Set a permission rule. Exactly one of `category` / `toolName` must be
   * set — the wire shape and the storage shape both keep these
   * dimensions separate so subscribers can route without inspecting the
   * payload. Emits `permission_policy_changed` on a transition.
   */
  private async _permSetPolicy(
    opts:
      | { category: ToolCategory; toolName?: never; policy: PermissionPolicy }
      | { toolName: string; category?: never; policy: PermissionPolicy },
  ): Promise<void> {
    this._assertLive('permissions.setPolicy()');
    if ((opts.category === undefined) === (opts.toolName === undefined)) {
      throw new HarnessValidationError('permissions.setPolicy', 'must set exactly one of "category" or "toolName"');
    }
    assertPolicy('permissions.setPolicy', opts.policy);
    if (opts.category !== undefined) {
      assertToolCategory('permissions.setPolicy', opts.category);
      const oldPolicy = this._record.permissionRules.categories[opts.category];
      if (oldPolicy === opts.policy) return;
      await this._flushUpdate(prev => ({
        ...prev,
        permissionRules: {
          ...prev.permissionRules,
          categories: { ...prev.permissionRules.categories, [opts.category!]: opts.policy },
        },
      }));
      this._emitter.emit({
        type: 'permission_policy_changed',
        category: opts.category,
        oldPolicy,
        newPolicy: opts.policy,
      });
      return;
    }
    assertToolName('permissions.setPolicy', opts.toolName!);
    const oldPolicy = this._record.permissionRules.tools[opts.toolName!];
    if (oldPolicy === opts.policy) return;
    await this._flushUpdate(prev => ({
      ...prev,
      permissionRules: {
        ...prev.permissionRules,
        tools: { ...prev.permissionRules.tools, [opts.toolName!]: opts.policy },
      },
    }));
    this._emitter.emit({
      type: 'permission_policy_changed',
      toolName: opts.toolName,
      oldPolicy,
      newPolicy: opts.policy,
    });
  }

  private async _resume(expectedKind: PendingResume['kind'], resumeData: unknown): Promise<AgentResult> {
    this._assertLive(`respond[${expectedKind}]`);

    const pending = this._record.pendingResume;
    if (!pending) {
      throw new HarnessValidationError(`respond[${expectedKind}]`, 'no pending resume on this session');
    }
    if (pending.kind !== expectedKind) {
      throw new HarnessValidationError(
        `respond[${expectedKind}]`,
        `pending resume is "${pending.kind}", not "${expectedKind}"`,
      );
    }

    // Idempotency: a crash between "marked resumed" and "cleared pending"
    // surfaces here on the next call. We do not replay the agent — the prior
    // resumeStream() either landed (and cleared pending in a later flush we
    // lost) or is being completed by a sibling caller. Either way, the safe
    // move is to surface the suspended state to the caller and let them
    // re-fetch via getDisplayState / listMessages.
    if (pending.resumedAt !== undefined) {
      throw new HarnessValidationError(
        `respond[${expectedKind}]`,
        'pending resume already responded; awaiting agent confirmation',
      );
    }

    // Mark resumed under the lease BEFORE calling the agent (idempotency
    // marker per §5.4 / §5.7). On crash here, the next caller observes
    // resumedAt set and rejects rather than double-resuming.
    const resumedAt = Date.now();
    await this._flushUpdate(prev => ({
      ...prev,
      pendingResume: prev.pendingResume ? { ...prev.pendingResume, resumedAt } : prev.pendingResume,
    }));

    // For plan-approval, flip the active mode atomically with clearing the
    // pending record. Done inside the same _flushUpdate below so the mode
    // change and pending-clear land in one CAS write.
    //
    // Resolution order on approval:
    //   1. Caller-supplied `transitionToMode` overrides everything.
    //   2. Falls back to the submitting mode's declared `transitionsTo`
    //      (captured into `pending.transitionModeId` at suspend time).
    //   3. Otherwise no flip.
    let modeFlipTarget: string | undefined;
    if (expectedKind === 'plan-approval') {
      const data = resumeData as { approved: boolean; transitionToMode?: string };
      if (data.approved) {
        const candidate = data.transitionToMode ?? pending.transitionModeId;
        if (candidate && candidate !== this._record.modeId) {
          // Validate the target mode exists before we hand off to the agent.
          // (Caller-supplied `transitionToMode` is also validated up-front in
          // `respondToPlanApproval`; this catches the pending-record path.)
          this._harness._getMode(candidate);
          modeFlipTarget = candidate;
        }
      }
    }

    // Resumed runs run under a session-owned AbortController too, so
    // `session.abort()` can cancel an in-flight resume (e.g. ESC after the
    // user approved a tool that's now grinding through a long workflow).
    const turnAbortController = this._beginTurn(undefined);
    const agent = this._harness.getAgentForMode(this._record.modeId);
    let full: FullOutput<unknown>;
    try {
      const out = await agent.resumeStream(resumeData, {
        runId: pending.runId,
        toolCallId: pending.toolCallId,
        abortSignal: turnAbortController.signal,
      });
      full = (await out.getFullOutput()) as FullOutput<unknown>;
      this._recordTurnCompletion(full);
    } catch (err) {
      this._endTurn(turnAbortController);
      throw err;
    }

    // Clear pending + apply mode flip in a single CAS write. The mode flip
    // and pending-clear must land together so a replay does not see
    // "pending cleared, mode not yet flipped" or vice versa.
    const previousModeId = this._record.modeId;
    await this._flushUpdate(prev => {
      const next: SessionRecord = { ...prev };
      delete next.pendingResume;
      if (modeFlipTarget) next.modeId = modeFlipTarget;
      return next;
    });

    // Pending resolved — emit before the (optional) re-suspension capture
    // so subscribers see ordering: resolved → (mode_changed?) → required?.
    this._emitTurnEvent({
      type: 'suspension_resolved',
      kind: expectedKind,
      toolCallId: pending.toolCallId,
      runId: pending.runId,
    });
    if (modeFlipTarget && modeFlipTarget !== previousModeId) {
      this._emitter.emit({
        type: 'mode_changed',
        modeId: modeFlipTarget,
        previousModeId,
      });
    }

    // The resumed run can itself suspend again (multi-step approval chains).
    // Mirror message()'s post-run hook so the next respond* call sees the
    // new pending record.
    await this._maybeCaptureSuspend(full);

    // If the resumed run did NOT suspend again, the turn is complete from
    // the harness's perspective. Surface that to subscribers via agent_end.
    if (full.finishReason !== 'suspended') {
      this._emitTurnEvent({
        type: 'agent_end',
        reason: full.finishReason === 'error' ? 'error' : 'complete',
        runId: full.runId,
      });

      // If this was the terminal completion of a queued turn, settle the
      // resolver, remove the head item, clear current, then kick the drain
      // for the next item.
      const wasGoalDriven = (this._currentQueuedItemSource ?? 'user') === 'goal';
      if (this._currentQueuedItemId !== undefined) {
        await this._completeQueuedTurn(this._currentQueuedItemId, full as AgentResult);
      }
      await this._runGoalJudge(full, wasGoalDriven);
    }
    this._endTurn(turnAbortController);
    return full as AgentResult;
  }

  // -------------------------------------------------------------------------
  // queue() — wait-for-idle FIFO turn queue (§4.2 / §6).
  //
  // Append-then-drain. The capacity check + durable append are atomic per
  // session: two concurrent `queue()` calls on the same Session instance
  // race on the in-process `_flushUpdate` lock, so neither can both observe
  // available space and commit past the cap. Cross-instance contention is
  // covered by the lease + version CAS on the underlying record.
  //
  // Drain semantics:
  //   1. `queue()` admits → flush record → register resolver → kick drain.
  //   2. Drain pulls head item, emits `queue_item_started`, runs the turn
  //      via the same code path as `message()` default (so `agent_start`,
  //      `message_*`, `tool_*`, `suspension_*`, `agent_end` all flow with
  //      `queuedItemId` stamped automatically by `_emitTurnEvent`).
  //   3. If the turn suspends, the head item stays in `pendingQueue` and
  //      `_currentQueuedItemId` stays set. The next `respondTo*` call calls
  //      into `_resume`; on terminal completion the resume path settles the
  //      resolver + removes the head + kicks drain again.
  //   4. If the turn completes without suspending, the message() default
  //      path settles the same way (post-`agent_end` hook below).
  //
  // Promise resolution: the eventual `AgentResult` once the turn fully ends
  // (including any suspend → resume cycles). Rejection only for "never got
  // to run" cases (closed session before drain reached the item, or a
  // permanent storage failure during admission).
  // -------------------------------------------------------------------------

  /**
   * Append a turn to the durable queue. Resolves with the eventual
   * `AgentResult` once the turn fully completes — including any
   * suspend → resume cycles.
   *
   * Rejects synchronously with:
   *   - `HarnessConfigError` if the session is not live, or `mode` is unknown.
   *   - `HarnessValidationError` if `content` is empty.
   *   - `HarnessQueueFullError` if `pendingQueue.length` is already at
   *     `sessions.maxQueueDepth`.
   */
  async queue(opts: QueueOptions): Promise<AgentResult> {
    this._assertLive('queue()');
    if (typeof opts.content !== 'string' || opts.content.length === 0) {
      throw new HarnessValidationError('queue().content', 'must be a non-empty string');
    }
    if (opts.mode !== undefined) {
      // Validates and throws on unknown id.
      this._harness._getMode(opts.mode);
    }

    const cap = this._harness._internalMaxQueueDepth;
    if ((this._record.pendingQueue?.length ?? 0) >= cap) {
      throw new HarnessQueueFullError(this.id, cap);
    }

    const item: QueuedItem = {
      id: `q-${randomUUID()}`,
      enqueuedAt: Date.now(),
      content: opts.content,
      attachments: [],
      ...(opts.model !== undefined ? { model: opts.model } : {}),
      ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
      ...(opts.yolo !== undefined ? { yolo: opts.yolo } : {}),
    };

    // Atomic check + append: re-check capacity inside the updater so a
    // concurrent in-process `queue()` cannot push us past the cap.
    let admitted = true;
    await this._flushUpdate(prev => {
      if ((prev.pendingQueue?.length ?? 0) >= cap) {
        admitted = false;
        return prev;
      }
      return { ...prev, pendingQueue: [...(prev.pendingQueue ?? []), item] };
    });
    if (!admitted) {
      throw new HarnessQueueFullError(this.id, cap);
    }

    return new Promise<AgentResult>((resolve, reject) => {
      this._queueResolvers.set(item.id, { resolve, reject });
      // Kick the drain — fire-and-forget. Drain handles its own errors and
      // settles the resolver via `_completeQueuedTurn` / `_failQueuedTurn`.
      void this._maybeDrainQueue();
    });
  }

  /**
   * Drain pending queue items head-of-line. No-op while another drain is
   * running, the session is suspended (`pendingResume` set), or the queue
   * is empty. Each item runs as a fresh turn; if the turn suspends, drain
   * exits early and resumes from `_resume()` once the user responds.
   */
  private async _maybeDrainQueue(): Promise<void> {
    if (this._draining) return;
    if (this._state !== 'live') return;
    // A live suspension means a previous queued turn is awaiting a
    // `respondTo*` call — drain stays parked until that resolves.
    if (this._record.pendingResume !== undefined) return;
    if (this._currentQueuedItemId !== undefined) return;
    // A manual `message()` turn is in flight — wait for it to settle.
    // `_recordTurnCompletion` will re-kick the drain on its way out.
    if (this._currentTurnAbortController !== undefined) return;

    this._draining = true;
    try {
      while (this._state === 'live' && (this._record.pendingQueue?.length ?? 0) > 0) {
        // Bail if a previous iteration left the session suspended.
        if (this._record.pendingResume !== undefined) return;

        const head = this._record.pendingQueue?.[0];
        if (!head) return;
        this._currentQueuedItemId = head.id;
        this._currentQueuedItemSource = head.source ?? 'user';
        const isReplay = !this._queueResolvers.has(head.id);
        this._emitter.emit(
          isReplay
            ? { type: 'queue_item_replayed', queuedItemId: head.id }
            : { type: 'queue_item_started', queuedItemId: head.id },
        );

        let suspended = false;
        try {
          const full = await this._runQueuedTurn(head);
          suspended = full.finishReason === 'suspended';
          if (!suspended) {
            await this._completeQueuedTurn(head.id, full as AgentResult);
          }
        } catch (err) {
          // Permanent failure during the turn — reject the resolver and
          // remove the item so we don't replay it forever.
          await this._failQueuedTurn(head.id, err);
        }

        if (suspended) {
          // Stop draining; `_resume()` will re-kick when the user responds.
          return;
        }
      }
    } finally {
      this._draining = false;
      this._notifyMaybeIdle();
    }
  }

  /**
   * Run a single queued item as a turn. Mirrors `message()`'s default path
   * but pulls overrides off the queued item rather than per-call options.
   * Returns the `FullOutput` so the drain loop can decide whether the head
   * stays in place (suspended) or is removed (complete / error).
   */
  private async _runQueuedTurn(item: QueuedItem): Promise<FullOutput<unknown>> {
    const effectiveModeId = item.mode ?? this._record.modeId;
    const mode = this._harness._getMode(effectiveModeId);
    const agent = this._harness.getAgentForMode(effectiveModeId);

    const toolsets = this._buildToolsets(mode);
    // Queued turns run under a session-owned AbortController so
    // `session.abort()` can cancel an in-flight queued run too.
    const turnAbortController = this._beginTurn(undefined);
    const requestContext = await this._buildRequestContext({
      modeId: effectiveModeId,
      abortSignal: turnAbortController.signal,
    });
    const baseExecOptions: AgentExecutionOptionsBase<unknown> = {
      memory: { thread: this.threadId, resource: this.resourceId },
      abortSignal: turnAbortController.signal,
      requestContext,
      ...(toolsets ? { toolsets } : {}),
      ...(mode.instructions ? { instructions: mode.instructions } : {}),
    };

    this._emitTurnEvent({ type: 'agent_start' });

    try {
      await this._ensureThreadSubscription(agent);
      const signal = agent.sendSignal(
        { type: 'user-message', contents: item.content as never },
        {
          resourceId: this.resourceId,
          threadId: this.threadId,
          ifIdle: { behavior: 'wake', streamOptions: baseExecOptions as never },
        },
      );
      const full = await this._awaitRunCompletion(signal.runId);
      this._recordTurnCompletion(full);
      await this._maybeCaptureSuspend(full);
      this._emitTurnEvent({
        type: 'agent_end',
        reason: full.finishReason === 'suspended' ? 'suspended' : 'complete',
        runId: full.runId,
      });
      await this._runGoalJudge(full, (item.source ?? 'user') === 'goal');
      return full;
    } finally {
      this._endTurn(turnAbortController);
    }
  }

  /**
   * Settle a queued item's resolver with success and remove it from the
   * head of `pendingQueue`. The CAS write here is the durable record that
   * the item ran exactly once. Crash recovery uses `pendingQueue[0]` and
   * the absence of `pendingResume` to decide whether to replay.
   */
  private async _completeQueuedTurn(itemId: string, result: AgentResult): Promise<void> {
    await this._flushUpdate(prev => ({
      ...prev,
      pendingQueue: (prev.pendingQueue ?? []).filter(x => x.id !== itemId),
    }));
    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    const resolver = this._queueResolvers.get(itemId);
    if (resolver) {
      this._queueResolvers.delete(itemId);
      resolver.resolve(result);
    }
    this._notifyMaybeIdle();
    // Kick the drain again — there may be more items waiting.
    void this._maybeDrainQueue();
  }

  /** Same as `_completeQueuedTurn` but rejects the resolver with `err`. */
  private async _failQueuedTurn(itemId: string, err: unknown): Promise<void> {
    await this._flushUpdate(prev => ({
      ...prev,
      pendingQueue: (prev.pendingQueue ?? []).filter(x => x.id !== itemId),
    }));
    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    const resolver = this._queueResolvers.get(itemId);
    if (resolver) {
      this._queueResolvers.delete(itemId);
      resolver.reject(err);
    }
    this._notifyMaybeIdle();
    void this._maybeDrainQueue();
  }

  /** @internal — used by the Harness on hydration to start replay drain. */
  async _kickQueueDrain(): Promise<void> {
    return this._maybeDrainQueue();
  }

  // -------------------------------------------------------------------------
  // Internal helpers.
  // -------------------------------------------------------------------------

  private _assertLive(method: string): void {
    if (this._state !== 'live') {
      throw new HarnessConfigError(method, `session is ${this._state}`);
    }
  }

  /**
   * Apply an update to the in-memory record, CAS-write to storage, and
   * adopt the returned version. Single point of truth so every setter
   * stays consistent with the lease + version contract (§5.8).
   */
  private _flushUpdate(update: (prev: SessionRecord) => SessionRecord): Promise<void> {
    const run = async (): Promise<void> => {
      const next: SessionRecord = {
        ...update(this._record),
        lastActivityAt: Date.now(),
      };
      const saved = await this._storage.saveSession(next, {
        ownerId: this._ownerId,
        ifVersion: this._record.version,
      });
      this._record = { ...next, version: saved.version };
    };
    // Chain so concurrent callers serialize against the latest in-memory
    // version. Swallow chain-link errors so one caller's failure doesn't
    // poison subsequent flushes.
    const next = this._flushChain.then(run, run);
    this._flushChain = next.catch(() => {});
    return next;
  }

  /**
   * Build the toolset surface for a single turn:
   *   - mode.tools (replace) wins over agent's own tools
   *   - mode.additionalTools merges with agent's tools
   *   - per-call additionalTools layer on top of whatever the mode produced
   *
   * Returns undefined when no overrides apply (agent runs with its own tools).
   */
  private _buildToolsets(mode: HarnessMode, callAdditional?: ToolsInput): Record<string, ToolsInput> | undefined {
    const toolsets: Record<string, ToolsInput> = {};
    if (mode.tools) toolsets[`mode:${mode.id}`] = mode.tools;
    if (mode.additionalTools) toolsets[`mode:${mode.id}:add`] = mode.additionalTools;
    if (callAdditional) toolsets[`call:additional`] = callAdditional;

    // Built-in `spawn_subagent` tool. Registered automatically when the
    // harness has any subagent types configured. Closes over this session
    // so the tool can resolve the registry, create child sessions, bridge
    // events back, and enforce the depth cap (§9).
    const spawn = createSpawnSubagentTool(this);
    if (spawn) {
      toolsets['harness:builtin'] = { [SPAWN_SUBAGENT_TOOL_ID]: spawn };
    }

    return Object.keys(toolsets).length === 0 ? undefined : toolsets;
  }

  /**
   * Build the per-turn `RequestContext` that the agent passes to tools. The
   * `'harness'` slot exposes `HarnessRequestContext` (§6.1). Tools read it
   * with `context.requestContext.get('harness')`.
   *
   * The slot is constructed fresh per turn so identity reads, the state
   * snapshot, abort plumbing, and event emission all see the current state
   * of the session. Functional `setState` updates serialize through the
   * same `_flushUpdate` chain that backs `Session.setState`.
   */
  private async _buildRequestContext(turn: { modeId: string; abortSignal: AbortSignal }): Promise<RequestContext> {
    const session = this;
    const stateSnapshot = (this._record.state ?? {}) as unknown;
    // Resolve the workspace eagerly so tools see a populated `ctx.workspace`
    // without each tool re-awaiting. Errors here surface as the turn's
    // failure; workspace_error is still emitted via the registry.
    let workspace: Workspace | undefined;
    try {
      workspace = await this.getWorkspace();
    } catch {
      // Leave undefined — tools that need a workspace will get a null slot.
      // The registry has already emitted workspace_error so subscribers know.
      workspace = undefined;
    }
    const harnessSlot: HarnessRequestContext<unknown> = {
      harnessId: this._harness.ownerId,
      sessionId: this.id,
      threadId: this.threadId,
      resourceId: this.resourceId,
      modeId: turn.modeId,
      state: stateSnapshot,
      getState: () => (session._record.state ?? {}) as unknown,
      setState: ((updatesOrUpdater: unknown) => {
        if (typeof updatesOrUpdater === 'function') {
          return session.setState(updatesOrUpdater as (prev: unknown) => unknown);
        }
        return session.setState(updatesOrUpdater as Partial<unknown>);
      }) as HarnessRequestContext<unknown>['setState'],
      abortSignal: turn.abortSignal,
      registerQuestion: () => {
        throw new HarnessConfigError('ctx.registerQuestion', 'not implemented in this milestone');
      },
      registerPlanApproval: () => {
        throw new HarnessConfigError('ctx.registerPlanApproval', 'not implemented in this milestone');
      },
      // Subagent linkage — set from the record so spawned sessions report
      // their depth + parent linkage on the harness slot.
      subagentDepth: this._record.subagentDepth ?? 0,
      source: (this._record.subagentDepth ?? 0) > 0 ? 'subagent' : 'parent',
      parentSessionId: this._record.parentSessionId,
      getSubagentModel: () => null,
      ...(workspace ? { workspace } : {}),
    };
    return new RequestContext([['harness', harnessSlot]]);
  }

  /**
   * @internal — used by the Harness during `close()` and `shutdown()` to
   * mark this instance terminal. Does not touch storage or release the
   * lease — those are the harness's job. Idempotent.
   */
  _markClosed(updatedRecord: SessionRecord): void {
    this._record = updatedRecord;
    this._state = 'closed';
    this._tearDownThreadSubscription(new HarnessValidationError('session.close()', 'Session closed'));
    this._rejectIdleWaiters(new HarnessSessionClosedError(this.id));
  }

  /**
   * @internal — used by the Harness when an idle/pressure eviction drops the
   * instance from the live map (§5.4). The record stays active in storage;
   * the session can be re-hydrated. Currently unused; lands with eviction.
   */
  _markEvicted(updatedRecord: SessionRecord): void {
    this._record = updatedRecord;
    this._state = 'evicted';
    this._tearDownThreadSubscription(new HarnessValidationError('session.evict()', 'Session evicted'));
    this._rejectIdleWaiters(new HarnessSessionClosedError(this.id));
  }

  /**
   * Reject every outstanding `waitForIdle()` waiter with `reason`. Drains
   * `_idleWaiters` via each waiter's own `cleanup` so subscribers and
   * timers are properly disposed. Idempotent.
   */
  private _rejectIdleWaiters(reason: unknown): void {
    if (this._idleWaiters.size === 0) return;
    const waiters = Array.from(this._idleWaiters);
    this._idleWaiters.clear();
    for (const w of waiters) {
      w.cleanup();
      w.reject(reason);
    }
  }

  /**
   * Synchronous teardown for the thread subscription on close/evict. Unsubscribes,
   * marks the subscription closed, and rejects every outstanding entry in
   * `_runCompletionPromises` so awaiters don't hang on a dead subscription.
   * The drain loop's `for-await` exits naturally once `unsubscribe()` wakes it.
   */
  private _tearDownThreadSubscription(reason: unknown): void {
    if (this._threadSubscriptionClosed) return;
    this._threadSubscriptionClosed = true;
    try {
      this._threadSubscription?.unsubscribe();
    } catch {
      // Best-effort — subscription may already be done.
    }
    for (const [, entry] of this._runCompletionPromises) {
      entry.reject(reason);
    }
    this._runCompletionPromises.clear();
  }

  /** @internal — accessor for the Harness when it needs the owner id back. */
  get _internalOwnerId(): string {
    return this._ownerId;
  }

  /** @internal — accessor for the Harness when it needs the record version. */
  get _internalRecordVersion(): number {
    return this._record.version;
  }

  /** @internal — accessor for the Harness when it needs the storage handle. */
  get _internalStorage(): HarnessStorage {
    return this._storage;
  }
}
