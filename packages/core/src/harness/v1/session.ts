/**
 * Harness v1 — runtime Session class.
 *
 * This is the in-memory authority for a single SessionRecord (§5.4). The
 * Harness creates one instance per live session and routes all writes to
 * the underlying record through it. The full surface is described in §4.2.
 *
 * The current local surface includes message/signal/queue turns, mode/model
 * and state mutation, display snapshots, message listing, pending inbox
 * responses, permissions, code/workspace skills, subagents, goals, event
 * forwarding, abort, idle waiting, wakeup queue admission, and the core
 * admission/mutation primitives used by remote routes, plus request-context
 * `registerQuestion` / `registerPlanApproval` pending registration. Remote
 * SDKs and full channel routing remain follow-up lanes.
 *
 * Lifecycle states tracked here:
 *   - 'live'    — session is in the harness's live map and holds the lease.
 *   - 'closing' — the durable close marker has committed; new work is rejected
 *                 while previously admitted turns drain until the close deadline.
 *   - 'closed'  — `close()` has run; record has `closedAt` set in storage.
 *   - 'deleted' — the session row has been hard-deleted from storage.
 *   - 'evicted' — flushed to storage and dropped from live map; the record
 *                 remains active and the session can be re-hydrated. Currently
 *                 unused; lands with §5.4 idle eviction.
 *
 * Once a Session leaves 'live', every method except identity reads throws.
 * Callers must re-resolve via `harness.session(...)` to get a fresh instance.
 */

import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

import { Agent } from '../../agent';
import type { AgentExecutionOptionsBase } from '../../agent/agent.types';
import type { AgentThreadSubscription, ToolsInput } from '../../agent/types';
import { ModelRouterLanguageModel } from '../../llm/model/router';
import { PrefillErrorHandler, ProviderHistoryCompat, StreamErrorRetryProcessor } from '../../processors';
import { RequestContext } from '../../request-context';
import {
  HarnessStorageAdmissionConflictError,
  HarnessStorageSessionEventReplayUnsupportedError,
} from '../../storage/domains/harness';
import type {
  GoalJudgeDecision,
  GoalState,
  AgentSignalResultEvidence,
  AgentSignalResultStatus,
  HarnessStorage,
  HarnessStorageAttachmentUnavailableError,
  HarnessRuntimeDependencyRefs,
  InboxResponseReceipt,
  QueueAdmissionReceipt,
  PendingResume,
  PermissionRules,
  PersistedAttachment,
  OperationAdmissionTombstone,
  PersistedRequestContextInput,
  QueuedItem,
  SaveAttachmentReferenceInput,
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
  HarnessAdmissionConflictError,
  HarnessAttachmentUnavailableError,
  HarnessConfigError,
  HarnessInboxItemNotFoundError,
  HarnessInboxResponseConflictError,
  HarnessOverrideConflictError,
  HarnessQueueFullError,
  HarnessSessionClosedError,
  HarnessSessionClosingError,
  HarnessSessionDeletedError,
  HarnessStateConflictError,
  HarnessSkillArgsValidationError,
  HarnessSkillNotFoundError,
  HarnessValidationError,
  HarnessWorkspaceLostError,
} from './errors';
import { EventEmitter, parseHarnessEventId, projectHarnessPublicError, snapshotHarnessEventForJson } from './events';
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
  AttachmentRef,
  GoalOptions,
  HarnessMode,
  InboxResponseOptions,
  InboxResponseResult,
  HarnessRequestContext,
  HarnessSkill,
  UseSkillOptions,
  ListMessagesOptions,
  MessageAdmissionResult,
  MessageOptions,
  MessageOptionsDefault,
  MessageOptionsStream,
  MessageOptionsStructured,
  ModelAuthStatus,
  PermissionPolicy,
  QueueAdmissionResult,
  QueueOptions,
  RegisterPlanApprovalParams,
  RegisterQuestionParams,
  SessionInjectSystemReminderOptions,
  SessionInjectSystemReminderResult,
  SessionSignalOptions,
  SessionSignalResult,
  SetStateOptions,
  ToolCategory,
} from './types';

type MessageAdmissionIdentity = {
  signalId: string;
  runId: string;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

type MessageAdmissionStart = {
  admissionHash: string;
  modeId: string;
  promise: Promise<AgentSignalResultEvidence | OperationAdmissionTombstone>;
};

type MessageAdmissionHashes = {
  primary: string;
  legacyCompatible: readonly string[];
};

type QueueResumeRecoveryResult =
  | { status: 'none' }
  | { status: 'completed'; result: AgentResult }
  | { status: 'stale' };

type ResumeResponseMode = 'agent-result' | 'inbox-receipt';
type InboxReceiptResponseOptions = InboxResponseOptions & { responseId: string };
type LegacyInboxResponseOptions = Omit<InboxResponseOptions, 'responseId'> & { responseId?: undefined };

/**
 * Tool IDs the harness translates from `tool-call-approval` /
 * `tool-call-suspended` events into `question` / `plan-approval` `kind`s.
 * Shared with the built-in `askUser` / `submitPlan` tools so the contract
 * lives in a single place (`packages/core/src/tools/builtin`).
 */
const ASK_USER_TOOL_NAME = ASK_USER_TOOL_ID;
const SUBMIT_PLAN_TOOL_NAME = SUBMIT_PLAN_TOOL_ID;
const MESSAGE_ADMISSION_DURABLE_WAIT_TIMEOUT_MS = 30_000;
const MESSAGE_ADMISSION_DURABLE_WAIT_INTERVAL_MS = 100;
const MESSAGE_RESULT_EVIDENCE_BACKGROUND_OBSERVE_TIMEOUT_MS = 5_000;
const QUEUE_ACCEPTED_RECOVERY_STALE_MS = 30_000;
const QUEUE_POST_RUN_FINALIZATION_RETRY_MS = 1_000;
const SUPPORTED_SKILL_ARG_SCHEMA_KEYS = new Set([
  'required',
  'properties',
  'type',
  'enum',
  'items',
  'additionalProperties',
]);

export type SessionLifecycleState = 'live' | 'closing' | 'closed' | 'deleted' | 'evicted';

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

function assertAgentType(method: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HarnessValidationError(method, 'agentType must be a non-empty string');
  }
}

function assertModelId(method: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HarnessValidationError(method, 'model must be a non-empty string');
  }
}

function assertPolicy(method: string, value: unknown): asserts value is PermissionPolicy {
  if (typeof value !== 'string' || !PERMISSION_POLICIES.includes(value as PermissionPolicy)) {
    throw new HarnessValidationError(method, `policy must be one of ${PERMISSION_POLICIES.join(' | ')}`);
  }
}

function isStorageAttachmentUnavailableError(err: unknown): err is HarnessStorageAttachmentUnavailableError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 'harness.storage.attachment_unavailable' &&
    typeof (err as { sessionId?: unknown }).sessionId === 'string' &&
    typeof (err as { attachmentId?: unknown }).attachmentId === 'string'
  );
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

interface ActiveTurnWaiter {
  promise: Promise<never>;
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

  // Pending interrupt (full UX payload, not recovery-only metadata)
  pending: SessionDisplayPending | null;

  // Queue
  queueDepth: number;
  currentQueuedItemId?: string;

  // Goal
  goal?: SessionRecord['goal'];
}

export type SessionDisplayPending = Omit<NonNullable<SessionRecord['pendingResume']>, 'runtimeDependencies'>;

function pendingResumeForDisplay(pending: SessionRecord['pendingResume']): SessionDisplayPending | null {
  if (!pending) return null;
  const { runtimeDependencies: _runtimeDependencies, ...displayPending } = pending;
  return displayPending;
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
  /** Durable event replay cursor seed from the previous live owner, if any. */
  eventReplaySeed?: { epoch: string; nextSequence: number };
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
    { promise: Promise<AgentResult>; resolve: (result: AgentResult) => void; reject: (err: unknown) => void }
  >();
  /** `queuedItem.id` of the turn currently running (live or suspended). */
  private _currentQueuedItemId?: string;
  /** `queuedItem.source` of the turn currently running. Used by the goal
   *  judge loop to skip re-judging on goal-driven continuation turns. */
  private _currentQueuedItemSource?: 'user' | 'goal';
  /** Hydrated queue items should emit `queue_item_replayed` once per session instance. */
  private readonly _replayedQueuedItemIds = new Set<string>();
  /** Fresh remote queue admissions have no local promise resolver but are not crash replays. */
  private readonly _liveAdmittedQueuedItemIds = new Set<string>();
  /** True while `_maybeDrainQueue` is running so re-entrant kicks are no-ops. */
  private _draining = false;
  private _queuedResumeRecoveryTimer?: ReturnType<typeof setTimeout>;
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
  private readonly _activeTurnWaiters = new Set<ActiveTurnWaiter>();
  private readonly _operationEvidenceSignalIds = new Set<string>();
  private readonly _activeTools = new Map<string, ActiveToolState>();
  private readonly _toolInputBuffers = new Map<string, { toolName: string; text: string }>();
  private readonly _activeSubagents = new Map<string, ActiveSubagentState>();
  /** Cumulative usage for the session's thread. Updated on `agent_end`. */
  private _tokenUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  /**
   * Outstanding `waitForIdle()` callers. On close/evict each waiter is
   * rejected so callers don't hang on a dead session.
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
  // Skill discovery cache (§4.6).
  //
  // Workspace skill discovery is async and lazy. We cache the merged code +
  // workspace catalog for the lifetime of this in-memory Session instance.
  // Concurrent `skills.list` / `skills.get` calls during a generation build
  // share the same in-flight promise (single-flight), avoiding duplicate
  // discovery work. `skills.refresh()` clears the cache so the next read
  // re-runs discovery through the workspace skill source.
  // -------------------------------------------------------------------------
  private _skillsCache?: HarnessSkill[];
  private _skillsResolving?: Promise<HarnessSkill[]>;

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
   * Per-run completion promises, keyed by `runId`. `_watchRunCompletion()`
   * resolves or rejects the matching entry after the runtime output finishes.
   * Entries left over on `close()` are rejected so callers don't hang.
   */
  private readonly _runCompletionPromises = new Map<
    string,
    {
      promise: Promise<FullOutput<unknown>>;
      resolve: (full: FullOutput<unknown>) => void;
      reject: (err: unknown) => void;
    }
  >();
  /**
   * Cache of run completion results that landed before any caller had a chance
   * to register a waiter. `sendSignal()` returns synchronously and the runtime
   * can drive the entire run to completion in the same microtask tick, so by
   * the time `_awaitRunCompletion(runId)` runs the terminal chunk may already
   * have been processed. Entries are retained so duplicate admission waiters
   * that converge on the same run can all observe the terminal result.
   */
  private readonly _completedRuns = new Map<
    string,
    { ok: true; full: FullOutput<unknown> } | { ok: false; err: unknown }
  >();
  private readonly _messageAdmissionStarts = new Map<string, MessageAdmissionStart>();
  private _eventPersistenceTail: Promise<void> = Promise.resolve();
  private _eventPersistenceError: unknown;

  /** @internal — constructed by the Harness, not directly. */
  constructor(internals: SessionInternals) {
    this.id = internals.record.id;
    this.resourceId = internals.record.resourceId;
    this.threadId = internals.record.threadId;
    this.parentSessionId = internals.record.parentSessionId;
    this.subagentDepth = internals.record.subagentDepth ?? 0;
    this.createdAt = internals.record.createdAt;

    this._record = internals.record;
    if (this._record.closedAt !== undefined) {
      this._state = 'closed';
    } else if (this._record.closingAt !== undefined) {
      this._state = 'closing';
    }
    this._harness = internals.harness;
    this._storage = internals.storage;
    this._ownerId = internals.ownerId;
    this._emitter = new EventEmitter(
      { sessionId: this.id },
      {
        onEvent: event => this._enqueueSessionEventPersistence(event),
        epoch: internals.eventReplaySeed?.epoch,
        nextSequence: internals.eventReplaySeed?.nextSequence,
      },
    );
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

  async lookupMessageResult(signalId: string): Promise<AgentSignalResultStatus | OperationAdmissionTombstone | null> {
    this._assertLive('lookupMessageResult()');
    if (signalId.length === 0) {
      throw new HarnessValidationError('lookupMessageResult().signalId', 'signalId must be a non-empty string');
    }
    const record = this.getRecord();
    return this._storage.loadMessageResultEvidence({
      harnessName: record.harnessName,
      sessionId: record.id,
      resourceId: record.resourceId,
      threadId: record.threadId,
      signalId,
    });
  }

  async lookupQueueResult(queuedItemId: string): Promise<QueueAdmissionReceipt | OperationAdmissionTombstone | null> {
    this._assertLive('lookupQueueResult()');
    if (queuedItemId.length === 0) {
      throw new HarnessValidationError('lookupQueueResult().queuedItemId', 'queuedItemId must be a non-empty string');
    }
    const record = this.getRecord();
    return this._storage.loadQueueResultEvidence({
      harnessName: record.harnessName,
      sessionId: record.id,
      resourceId: record.resourceId,
      queuedItemId,
    });
  }

  async getEventReplayState() {
    this._assertLive('getEventReplayState()');
    await this._flushEventPersistence();
    const record = this.getRecord();
    return this._storage.getSessionEventReplayState({
      harnessName: record.harnessName,
      sessionId: record.id,
      resourceId: record.resourceId,
      threadId: record.threadId,
    });
  }

  async listEventsAfter(opts: { epoch: string; afterSequence: number; limit: number }) {
    this._assertLive('listEventsAfter()');
    if (opts.epoch.length === 0) {
      throw new HarnessValidationError('listEventsAfter().epoch', 'epoch must be a non-empty string');
    }
    if (!Number.isSafeInteger(opts.afterSequence) || opts.afterSequence < 0) {
      throw new HarnessValidationError(
        'listEventsAfter().afterSequence',
        'afterSequence must be a non-negative safe integer',
      );
    }
    if (!Number.isSafeInteger(opts.limit) || opts.limit < 1) {
      throw new HarnessValidationError('listEventsAfter().limit', 'limit must be a positive safe integer');
    }
    await this._flushEventPersistence();
    const record = this.getRecord();
    return this._storage.listSessionEvents({
      harnessName: record.harnessName,
      sessionId: record.id,
      resourceId: record.resourceId,
      threadId: record.threadId,
      epoch: opts.epoch,
      afterSequence: opts.afterSequence,
      limit: opts.limit,
    });
  }

  /** @internal — used by the Harness to publish events on this session's emitter. */
  _emit(event: EmitInput): HarnessEvent {
    return this._emitter.emit(event);
  }

  /** @internal — waits for prior event ledger writes before replay decisions. */
  async _flushEventPersistence(): Promise<void> {
    await this._eventPersistenceTail;
    if (this._eventPersistenceError !== undefined) {
      throw this._eventPersistenceError;
    }
  }

  private _enqueueSessionEventPersistence(event: HarnessEvent): void {
    if (this._eventPersistenceError !== undefined) return;
    let parsed: ReturnType<typeof parseHarnessEventId>;
    let storedEvent: JsonValue;
    try {
      parsed = parseHarnessEventId(event.id);
      storedEvent = snapshotHarnessEventForJson(event);
    } catch (err) {
      this._eventPersistenceError = err;
      console.error('[harness/v1] session event serialization failed:', err);
      return;
    }
    const record = this._record;
    const task = this._eventPersistenceTail
      .catch(() => undefined)
      .then(async () => {
        if (this._eventPersistenceError !== undefined) return;
        await this._storage.appendSessionEvent({
          harnessName: record.harnessName,
          sessionId: record.id,
          resourceId: record.resourceId,
          threadId: record.threadId,
          eventId: event.id,
          epoch: parsed.epoch,
          sequence: parsed.sequence,
          event: storedEvent,
          emittedAt: event.timestamp,
          storedAt: Date.now(),
        });
      });
    this._eventPersistenceTail = task.catch(err => {
      if (err instanceof HarnessStorageSessionEventReplayUnsupportedError) return;
      this._eventPersistenceError = err;
      console.error('[harness/v1] session event persistence failed:', err);
    });
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

  private _createActiveTurnWaiter(): ActiveTurnWaiter {
    let reject!: (err: unknown) => void;
    const waiter: ActiveTurnWaiter = {
      promise: new Promise<never>((_, rej) => {
        reject = rej;
      }),
      reject: err => reject(err),
      cleanup: () => {
        this._activeTurnWaiters.delete(waiter);
      },
    };
    this._activeTurnWaiters.add(waiter);
    if (this._state === 'deleted') {
      this._activeTurnWaiters.delete(waiter);
      waiter.reject(new HarnessSessionDeletedError(this.id));
    }
    return waiter;
  }

  private _rejectActiveTurnWaiters(reason: unknown): void {
    if (this._activeTurnWaiters.size === 0) return;
    const waiters = Array.from(this._activeTurnWaiters);
    this._activeTurnWaiters.clear();
    for (const waiter of waiters) {
      waiter.reject(reason);
    }
  }

  private _raceActiveTurnWaiter<T>(promise: Promise<T>, activeTurnWaiter?: Promise<never>): Promise<T> {
    return activeTurnWaiter ? Promise.race([promise, activeTurnWaiter]) : promise;
  }

  private _shouldWriteTurnFailureEvidence(err: unknown): boolean {
    return this._state !== 'deleted' && !(err instanceof HarnessSessionDeletedError);
  }

  private async _withActiveDeletedWaiter<T>(fn: (activeTurnWaiter: Promise<never>) => Promise<T>): Promise<T> {
    const activeTurnWaiter = this._createActiveTurnWaiter();
    void activeTurnWaiter.promise.catch(() => {});
    try {
      return await fn(activeTurnWaiter.promise);
    } finally {
      activeTurnWaiter.cleanup();
    }
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
   * `HarnessSessionClosingError` if close starts while waiting,
   * `HarnessSessionClosedError` if the session closes first, or
   * `HarnessSessionDeletedError` if hard-delete removes the session first.
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

  /** @internal — close uses this after the durable closing marker commits. */
  _waitForCloseDrain(closeDeadlineAt: number): Promise<void> {
    void this._maybeDrainQueue();
    if (!this.isBusy()) return Promise.resolve();
    const timeoutMs = Math.max(0, closeDeadlineAt - Date.now());

    return new Promise<void>(resolve => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const resolveAfter = (settle?: Promise<void>) => {
        cleanup();
        if (settle) {
          void settle.finally(resolve);
          return;
        }
        resolve();
      };
      const waiter: IdleWaiter = {
        check: () => {
          if (!this.isBusy()) {
            resolveAfter();
            return true;
          }
          return false;
        },
        reject: () => {
          resolveAfter();
        },
        cleanup: () => {},
      };
      const cleanup = () => {
        if (timer !== undefined) clearTimeout(timer);
        this._idleWaiters.delete(waiter);
      };
      waiter.cleanup = cleanup;
      this._idleWaiters.add(waiter);
      if (timeoutMs === 0) {
        this.abort({ reason: 'session_close_timeout' });
        resolveAfter(this._failPendingQueueForClose(new HarnessSessionClosingError(this.id)));
      } else {
        timer = setTimeout(() => {
          timer = undefined;
          this.abort({ reason: 'session_close_timeout' });
          resolveAfter(this._failPendingQueueForClose(new HarnessSessionClosingError(this.id)));
        }, timeoutMs);
      }
    });
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

  /** True once the session has reached a terminal local state. */
  get isClosed(): boolean {
    return this._state === 'closed' || this._state === 'deleted';
  }

  /** True while close is draining admitted flushes or after the durable closing marker commits. */
  get isClosing(): boolean {
    return this._state === 'closing' || (this._record.closingAt !== undefined && this._record.closedAt === undefined);
  }

  /** Read-only snapshot of the underlying record. */
  getRecord(): Readonly<SessionRecord> {
    return this._record;
  }

  // -------------------------------------------------------------------------
  // Lifecycle.
  // -------------------------------------------------------------------------

  /**
   * Soft-close: persist `closingAt`, reject new work, drain admitted turns
   * until the close deadline, terminalize descendants, set `closedAt`, release
   * the lease, and drop from the live map. Final — the same `sessionId` cannot be re-hydrated.
   * Idempotent: a second call is a no-op once `closed`. The cascade through
   * descendants (§5.5) is driven by the Harness, not by this method directly.
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
    return this._getWorkspaceUnchecked();
  }

  private async _getWorkspaceUnchecked(): Promise<Workspace | undefined> {
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
  // Skills — §4.6.
  //
  // Code-registered skills are merged ahead of workspace-discovered skills.
  // Workspace-discovered entries are projected from the configured
  // `WorkspaceSkills` source into `HarnessSkill` descriptors. Discovery runs
  // asynchronously on the first `list` / `get` / `use` call per in-memory
  // Session instance and the merged result is cached for the session's
  // lifetime. Concurrent calls during a generation share a single-flight
  // promise. `refresh()` drops the cache so the next call re-runs discovery.
  //
  // `use(ref, opts?)` resolves a code-registered or workspace skill by name
  // or relative path, validates declared args, appends a JSON code block
  // carrying the validated args to the skill body, and delegates to the
  // signal-driven message path. The returned `AgentResult` is the underlying
  // turn's result.
  // -------------------------------------------------------------------------

  /**
   * Skill discovery, inspection, and programmatic execution — see §4.6
   * and §4.2c.
   *
   * Code-registered skills are merged ahead of workspace-discovered skills.
   * Workspace-discovered skills are projected into `HarnessSkill`
   * descriptors. Discovery runs asynchronously on the first `list` /
   * `get` / `use` call per in-memory Session instance and is cached for
   * the session's lifetime. Concurrent callers share a single-flight
   * promise. `refresh()` drops the cache so the next call re-runs
   * discovery.
   */
  readonly skills = Object.freeze({
    /**
     * List skills available to this session.
     *
     * Returns code-registered skills plus workspace-discovered skills.
     * If the session has no workspace configured, only code-registered
     * skills are returned.
     */
    list: (): Promise<HarnessSkill[]> => this._skillsList(),
    /**
     * Look up a skill by name. Returns `undefined` when the name does not
     * resolve in the code or workspace catalogues.
     */
    get: (name: string): Promise<HarnessSkill | undefined> => this._skillsGet(name),
    /**
     * Drop the cached workspace-discovery result. The next `list` / `get`
     * / `use` call re-runs discovery through the configured workspace
     * skill source. Local-only — absent from `RemoteSession` (§13.5).
     */
    refresh: (): Promise<void> => this._skillsRefresh(),
    /**
     * Resolve a code-registered skill by name, or a workspace skill by name
     * or relative path, optionally validate provided arguments against the
     * skill's declared args schema, append a JSON code block of the validated
     * args to the skill instructions, and dispatch the result
     * through the signal-driven message path as a single turn. Resolves
     * to the underlying turn's `AgentResult`.
     *
     * Throws {@link HarnessSkillNotFoundError} when `ref` does not match
     * any skill, and {@link HarnessSkillArgsValidationError} when declared
     * args are invalid.
     */
    use: (ref: string, opts?: UseSkillOptions): Promise<AgentResult> => this._skillsUse(ref, opts),
  });

  private async _skillsList(): Promise<HarnessSkill[]> {
    this._assertLive('skills.list()');
    return this._resolveSkills();
  }

  private async _skillsGet(name: string): Promise<HarnessSkill | undefined> {
    this._assertLive('skills.get()');
    if (typeof name !== 'string' || name.length === 0) {
      throw new HarnessValidationError('skills.get()', 'name must be a non-empty string');
    }
    const codeSkill = this._harness._getCodeSkill(name);
    if (codeSkill) return codeSkill;
    const skills = await this._resolveSkills();
    return skills.find(s => s.name === name);
  }

  private async _skillsRefresh(): Promise<void> {
    this._assertLive('skills.refresh()');
    // Drop cached generation. Any in-flight discovery promise is allowed to
    // run to completion (its result will not repopulate the cache because
    // `_resolveSkills` always writes through `_skillsCache` after the
    // promise it awaits, and the next caller is guaranteed to enter the
    // `_skillsResolving === undefined` branch and start a fresh build).
    this._skillsCache = undefined;
    this._skillsResolving = undefined;
  }

  /**
   * Resolve a code-registered skill by name, or a workspace skill by name or
   * relative path, validate any declared args schema, inject the validated
   * args as a JSON code block into the skill instructions, and dispatch the
   * result through `message()` as a single turn. Returns the underlying
   * `AgentResult`.
   *
   * Reference resolution mirrors Flue's workspace `session.skill(ref, ...)`
   * behavior for explicit workspace paths, then checks the static code
   * registry by name, then falls back to workspace skill names. A code skill
   * owns its name, but does not hide an otherwise shadowed workspace skill's
   * explicit path reference.
   */
  private _isExplicitWorkspaceSkillRef(ref: string): boolean {
    return (
      ref.includes('/') || ref.startsWith('./') || ref.startsWith('../') || /\.(?:md|mdx|txt|yaml|yml)$/i.test(ref)
    );
  }

  private async _skillsUse(ref: string, opts?: UseSkillOptions): Promise<AgentResult> {
    this._assertLive('skills.use()');
    if (typeof ref !== 'string' || ref.length === 0) {
      throw new HarnessValidationError('skills.use()', 'ref must be a non-empty string');
    }

    const tryWorkspaceSkill = async () => {
      const workspace = await this.getWorkspace();
      const skills = workspace?.skills;
      return skills ? skills.get(ref) : undefined;
    };

    if (this._isExplicitWorkspaceSkillRef(ref)) {
      const skill = await tryWorkspaceSkill();
      if (skill) {
        const args = opts?.args;
        this._validateSkillArgs(skill.name, skill.metadata, args);
        const expandedContent = this._buildSkillPrompt(skill.instructions, args);
        return this.message({
          content: expandedContent,
          ...(opts?.modelOverride ? { model: opts.modelOverride } : {}),
        });
      }
    }

    const codeSkill = this._harness._getCodeSkill(ref);
    if (codeSkill) {
      this._validateSkillArgs(codeSkill.name, codeSkill.metadata, opts?.args);
      const expandedContent = this._buildSkillPrompt(codeSkill.instructions, opts?.args);
      return this.message({
        content: expandedContent,
        ...(opts?.modelOverride ? { model: opts.modelOverride } : {}),
      });
    }

    // Force workspace materialization. Unlike `list` / `get`, `use` must
    // produce a definitive answer (start a turn or refuse with a typed
    // not-found error).
    const workspace = await this.getWorkspace();
    const skills = workspace?.skills;
    if (!skills) {
      throw new HarnessSkillNotFoundError(ref, ['code-registered']);
    }

    // `WorkspaceSkills.get` accepts either the frontmatter `name` or a
    // relative path under the configured skill source.
    const skill = await skills.get(ref);
    if (!skill) {
      throw new HarnessSkillNotFoundError(ref, ['code-registered', 'workspace']);
    }
    const args = opts?.args;
    this._validateSkillArgs(skill.name, skill.metadata, args);

    // Build the expanded prompt: skill instructions + (optional) JSON
    // code block carrying validated args. Skill authors reference the
    // args naturally in Markdown.
    const expandedContent = this._buildSkillPrompt(skill.instructions, args);

    return this.message({
      content: expandedContent,
      ...(opts?.modelOverride ? { model: opts.modelOverride } : {}),
    });
  }

  /**
   * Validate `metadata.args` as a small JSON-schema-ish object. The harness
   * supports the common prompt-arg fields used by workspace frontmatter:
   * `required`, `properties`, `type`, `enum`, `items`, and
   * `additionalProperties`. Unsupported or malformed schema shapes fail
   * before a skill turn starts.
   */
  private _validateSkillArgs(
    skillName: string,
    metadata: Record<string, unknown> | undefined,
    args: Record<string, unknown> | undefined,
  ): void {
    if (args !== undefined && (!args || typeof args !== 'object' || Array.isArray(args))) {
      throw new HarnessSkillArgsValidationError(skillName, ['args must be an object']);
    }

    const issues: string[] = [];
    if (args !== undefined) {
      this._validateJsonSerializableSkillArg('$', args, new WeakSet(), issues);
    }
    if (!metadata || typeof metadata !== 'object') {
      if (issues.length > 0) throw new HarnessSkillArgsValidationError(skillName, issues);
      return;
    }
    const argsField = (metadata as Record<string, unknown>).args;
    if (argsField === undefined) {
      if (issues.length > 0) throw new HarnessSkillArgsValidationError(skillName, issues);
      return;
    }
    if (!this._isPlainRecord(argsField)) {
      throw new HarnessSkillArgsValidationError(skillName, ['unsupported args schema: expected object']);
    }

    const issueCountBeforeSchemaShape = issues.length;
    this._validateSkillArgSchemaShape('$', argsField, issues, new WeakSet());
    if (issues.length > issueCountBeforeSchemaShape) {
      throw new HarnessSkillArgsValidationError(skillName, issues);
    }

    this._validateSkillArgSchemaValue('$', args ?? {}, argsField, issues);
    if (issues.length > 0) {
      throw new HarnessSkillArgsValidationError(skillName, issues);
    }
  }

  private _validateSkillArgSchemaShape(
    path: string,
    schema: Record<string, unknown>,
    issues: string[],
    seen: WeakSet<object>,
  ): void {
    if (seen.has(schema)) {
      issues.push(`${path} must not contain circular args schema references`);
      return;
    }
    seen.add(schema);

    for (const key of Object.keys(schema)) {
      if (!SUPPORTED_SKILL_ARG_SCHEMA_KEYS.has(key)) {
        issues.push(`${path}.${key} is not a supported args schema field`);
      }
    }

    const required = schema.required;
    if (
      required !== undefined &&
      (!Array.isArray(required) || required.some(k => typeof k !== 'string' || k.length === 0))
    ) {
      issues.push(`${path}.required must be an array of non-empty strings`);
    }

    const enumValues = schema.enum;
    if (enumValues !== undefined) {
      if (!Array.isArray(enumValues)) {
        issues.push(`${path}.enum must be an array`);
      } else {
        enumValues.forEach((candidate, index) => {
          this._validateJsonSerializableSkillArg(`${path}.enum[${index}]`, candidate, new WeakSet(), issues);
        });
      }
    }

    const declaredType = schema.type;
    if (declaredType !== undefined) {
      this._validateSkillArgDeclaredType(path, declaredType, issues);
    }

    const properties = schema.properties;
    if (properties !== undefined) {
      if (!this._isPlainRecord(properties)) {
        issues.push(`${path}.properties must be an object`);
      } else {
        for (const [key, childSchema] of Object.entries(properties)) {
          if (!this._isPlainRecord(childSchema)) {
            issues.push(`${path}.properties.${key} must be an object`);
            continue;
          }
          this._validateSkillArgSchemaShape(path === '$' ? key : `${path}.${key}`, childSchema, issues, seen);
        }
      }
    }

    const additionalProperties = schema.additionalProperties;
    if (additionalProperties !== undefined && additionalProperties !== true && additionalProperties !== false) {
      issues.push(`${path}.additionalProperties must be boolean`);
    }

    const items = schema.items;
    if (items !== undefined) {
      if (!this._isPlainRecord(items)) {
        issues.push(`${path}.items must be an object`);
      } else {
        this._validateSkillArgSchemaShape(`${path}[]`, items, issues, seen);
      }
    }

    seen.delete(schema);
  }

  private _validateSkillArgSchemaValue(
    path: string,
    value: unknown,
    schema: Record<string, unknown>,
    issues: string[],
  ): void {
    const required = schema.required;
    if (Array.isArray(required) && this._isPlainRecord(value)) {
      for (const key of required) {
        if (!Object.prototype.hasOwnProperty.call(value, key) || value[key] === undefined) {
          issues.push(`missing required arg: "${path === '$' ? key : `${path}.${key}`}"`);
        }
      }
    }

    const enumValues = schema.enum;
    if (Array.isArray(enumValues) && !enumValues.some(candidate => this._skillArgValuesEqual(candidate, value))) {
      issues.push(`${path} must be one of ${JSON.stringify(enumValues)}`);
    }

    const declaredType = schema.type;
    if (declaredType !== undefined && !this._matchesSkillArgType(value, declaredType, path, issues)) return;

    const properties = schema.properties;
    const additionalProperties = schema.additionalProperties;
    if (this._isPlainRecord(properties) && this._isPlainRecord(value)) {
      for (const [key, childSchema] of Object.entries(properties)) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        if (!this._isPlainRecord(childSchema)) continue;
        this._validateSkillArgSchemaValue(path === '$' ? key : `${path}.${key}`, value[key], childSchema, issues);
      }
    }
    if (additionalProperties === false && this._isPlainRecord(value)) {
      const allowedKeys = this._isPlainRecord(properties) ? new Set(Object.keys(properties)) : new Set<string>();
      for (const key of Object.keys(value)) {
        if (!allowedKeys.has(key)) issues.push(`unsupported arg: "${path === '$' ? key : `${path}.${key}`}"`);
      }
    }

    const items = schema.items;
    if (this._isPlainRecord(items) && Array.isArray(value)) {
      value.forEach((item, index) => {
        this._validateSkillArgSchemaValue(`${path}[${index}]`, item, items, issues);
      });
    }
  }

  private _validateSkillArgDeclaredType(path: string, declaredType: unknown, issues: string[]): void {
    const allowedTypes = Array.isArray(declaredType) ? declaredType : [declaredType];
    const supported = new Set(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']);
    if (allowedTypes.some(type => typeof type !== 'string' || !supported.has(type))) {
      issues.push(`${path}.type must be a supported JSON schema type`);
    }
  }

  private _matchesSkillArgType(value: unknown, declaredType: unknown, path: string, issues: string[]): boolean {
    const allowedTypes = Array.isArray(declaredType) ? declaredType : [declaredType];
    const supported = new Set(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']);
    if (allowedTypes.some(type => typeof type !== 'string' || !supported.has(type))) {
      issues.push(`${path}.type must be a supported JSON schema type`);
      return false;
    }

    const actualMatches = allowedTypes.some(type => {
      switch (type) {
        case 'string':
          return typeof value === 'string';
        case 'number':
          return typeof value === 'number' && Number.isFinite(value);
        case 'integer':
          return Number.isInteger(value);
        case 'boolean':
          return typeof value === 'boolean';
        case 'object':
          return this._isPlainRecord(value);
        case 'array':
          return Array.isArray(value);
        case 'null':
          return value === null;
        default:
          return false;
      }
    });
    if (!actualMatches) {
      issues.push(`${path} must be ${allowedTypes.join(' | ')}`);
    }
    return actualMatches;
  }

  private _isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  private _skillArgValuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) && Array.isArray(right)) {
      return (
        left.length === right.length && left.every((value, index) => this._skillArgValuesEqual(value, right[index]))
      );
    }
    if (this._isPlainRecord(left) && this._isPlainRecord(right)) {
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      if (leftKeys.length !== rightKeys.length) return false;
      return leftKeys.every(
        key => Object.prototype.hasOwnProperty.call(right, key) && this._skillArgValuesEqual(left[key], right[key]),
      );
    }
    return false;
  }

  private _validateJsonSerializableSkillArg(
    path: string,
    value: unknown,
    seen: WeakSet<object>,
    issues: string[],
  ): void {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) issues.push(`${path} must be JSON-serializable`);
      return;
    }
    if (value === undefined || typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
      issues.push(`${path} must be JSON-serializable`);
      return;
    }
    if (typeof value !== 'object') return;
    if (
      Object.prototype.hasOwnProperty.call(value, 'toJSON') &&
      typeof (value as { toJSON?: unknown }).toJSON === 'function'
    ) {
      issues.push(`${path}.toJSON is not supported in skill args`);
      return;
    }
    if (seen.has(value)) {
      issues.push(`${path} must not contain circular references`);
      return;
    }
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => this._validateJsonSerializableSkillArg(`${path}[${index}]`, item, seen, issues));
    } else if (this._isPlainRecord(value)) {
      for (const [key, child] of Object.entries(value)) {
        this._validateJsonSerializableSkillArg(path === '$' ? key : `${path}.${key}`, child, seen, issues);
      }
    } else {
      issues.push(`${path} must be JSON-serializable`);
    }
    seen.delete(value);
  }

  /**
   * Compose the skill prompt body. When args are supplied, append a JSON
   * code block carrying them. No delimiters beyond the Markdown fence —
   * skill authors reference args inline in their instructions.
   */
  private _buildSkillPrompt(instructions: string, args: Record<string, unknown> | undefined): string {
    if (!args || Object.keys(args).length === 0) return instructions;
    const json = JSON.stringify(args, null, 2);
    return `${instructions}\n\n\`\`\`json\n${json}\n\`\`\``;
  }

  /**
   * Internal: resolve the skill catalog for this session, sharing a
   * single-flight promise across concurrent callers.
   */
  private async _resolveSkills(): Promise<HarnessSkill[]> {
    if (this._skillsCache) return this._skillsCache;
    if (this._skillsResolving) return this._skillsResolving;

    const build = async (): Promise<HarnessSkill[]> => {
      const codeSkills = this._harness._listCodeSkills();
      const workspace = await this.getWorkspace();
      const workspaceSkills = workspace?.skills;
      if (!workspaceSkills) {
        // No workspace, or workspace has no skill source configured.
        return codeSkills;
      }
      const entries = await workspaceSkills.list();
      const codeNames = new Set(codeSkills.map(skill => skill.name));
      const projected = await Promise.all(
        entries
          .filter(meta => !codeNames.has(meta.name))
          .map(async meta => {
            const skill = await workspaceSkills.get(meta.path ?? meta.name);
            return {
              name: meta.name,
              description: meta.description,
              instructions: skill?.instructions ?? '',
              ...(meta.path ? { filePath: meta.path } : {}),
              // Pass through arbitrary skill frontmatter metadata so callers can
              // discover skill-level flags (e.g. `metadata.goal === true` for
              // goal-mode skills). Workspace's `SkillMetadata.metadata` is
              // typed `Record<string, unknown>` and is already JSON-serialisable.
              ...(meta.metadata ? { metadata: meta.metadata } : {}),
            };
          }),
      );
      return [...codeSkills, ...projected];
    };

    const pending = build();
    this._skillsResolving = pending;
    try {
      const result = await pending;
      // Only populate the cache when our own promise is still the
      // session-tracked one. If `skills.refresh()` ran while we were
      // resolving, `_skillsResolving` was cleared (or replaced by a
      // newer build) and we must not stomp it.
      if (this._skillsResolving === pending) {
        this._skillsCache = result;
      }
      return result;
    } finally {
      if (this._skillsResolving === pending) {
        this._skillsResolving = undefined;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Signal-routing helpers (§4.2). One long-lived thread subscription per
  // Session multiplexes every run on the thread into a single chunk
  // stream. `message()` calls `agent.sendSignal()`, gets a `runId` back,
  // and awaits the matching entry in `_runCompletionPromises`. Completion
  // settlement is handled by `_watchRunCompletion()`; the drain loop only
  // emits harness events from stream chunks.
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
      if (this._state === 'deleted') {
        throw new HarnessSessionDeletedError(this.id);
      }
      if (this._state === 'closed' || this._state === 'evicted') {
        throw new HarnessSessionClosedError(this.id);
      }
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
    if (this._threadSubscriptionClosed) {
      try {
        sub.unsubscribe();
      } catch {
        // Best-effort — hard-delete or close won while subscribeToThread was pending.
      }
      if (this._state === 'deleted') {
        throw new HarnessSessionDeletedError(this.id);
      }
      if (this._state === 'closed' || this._state === 'evicted') {
        throw new HarnessSessionClosedError(this.id);
      }
      throw new HarnessValidationError(
        '_ensureThreadSubscription()',
        'Session is closed; cannot install thread subscription.',
      );
    }
    this._threadSubscription = sub;
    this._threadSubscriptionAgent = agent;
    this._threadSubscriptionDrain = this._drainSubscriptionStream(sub);
    // Surface drain rejections to outstanding awaiters; the drain loop itself
    // swallows them in its `finally` block.
    void this._threadSubscriptionDrain.catch(() => {});
    return sub;
  }

  private async _ensureThreadSubscriptionOrDeleted(agent: Agent): Promise<AgentThreadSubscription<unknown>> {
    const activeTurnWaiter = this._createActiveTurnWaiter();
    void activeTurnWaiter.promise.catch(() => {});
    try {
      return await this._raceActiveTurnWaiter(this._ensureThreadSubscription(agent), activeTurnWaiter.promise);
    } finally {
      activeTurnWaiter.cleanup();
    }
  }

  /**
   * Returns a Promise that resolves with a synthetic `FullOutput` when the
   * run with the given id terminates. The drain loop resolves (or rejects)
   * the entry. If `close()` runs while the entry is pending, the entry is
   * rejected with a typed error.
   */
  private _awaitRunCompletion(runId: string): Promise<FullOutput<unknown>> {
    // Fast path: the run may have already terminated before this call ran.
    // Keep the cached result reusable so duplicate admission callers that
    // converge on the same runId can still observe the terminal output even
    // if another waiter arrived first.
    const cached = this._completedRuns.get(runId);
    if (cached) {
      return cached.ok ? Promise.resolve(cached.full) : Promise.reject(cached.err);
    }
    // Multiple callers can await the same run (e.g. `message()` followed by
    // an active-delivery `signal()` that drains into the same run). Memoize
    // the promise so they all see the same resolution.
    const existing = this._runCompletionPromises.get(runId);
    if (existing) return existing.promise;
    let resolve!: (full: FullOutput<unknown>) => void;
    let reject!: (err: unknown) => void;
    const promise = new Promise<FullOutput<unknown>>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this._runCompletionPromises.set(runId, { promise, resolve, reject });
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
    let out: MastraModelOutput<unknown> & { _waitUntilFinished?: () => Promise<void> };
    try {
      out = (await agent.waitForRunOutput(runId)) as MastraModelOutput<unknown> & {
        _waitUntilFinished?: () => Promise<void>;
      };
    } catch (err) {
      const waiter = this._runCompletionPromises.get(runId);
      this._runCompletionPromises.delete(runId);
      this._rememberCompletedRun(runId, { ok: false, err });
      waiter?.reject(err);
      return;
    }
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
   * in `_completedRuns` so later `_awaitRunCompletion(runId)` calls can
   * observe it.
   */
  private async _handleRunTerminal(runId: string, out: MastraModelOutput<unknown>): Promise<void> {
    const waiter = this._runCompletionPromises.get(runId);
    this._runCompletionPromises.delete(runId);
    const cached = this._completedRuns.get(runId);
    if (cached && !cached.ok) {
      if (waiter) waiter.reject(cached.err);
      return;
    }
    try {
      const full = (await out.getFullOutput()) as FullOutput<unknown>;
      this._rememberCompletedRun(runId, { ok: true, full });
      if (waiter) waiter.resolve(full);
    } catch (err) {
      this._rememberCompletedRun(runId, { ok: false, err });
      if (waiter) waiter.reject(err);
    }
  }

  private _rememberCompletedRun(
    runId: string,
    entry: { ok: true; full: FullOutput<unknown> } | { ok: false; err: unknown },
  ): void {
    if (this._completedRuns.has(runId)) return;
    this._completedRuns.set(runId, entry);
    while (this._completedRuns.size > 64) {
      const oldest = this._completedRuns.keys().next().value;
      if (oldest === undefined) return;
      this._completedRuns.delete(oldest);
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
    if (opts.admissionId !== undefined && opts.output !== undefined) {
      throw new HarnessValidationError(
        'message().admissionId',
        'admissionId is not supported with sync structured output',
      );
    }
    if (opts.admissionId !== undefined && opts.additionalTools !== undefined) {
      throw new HarnessValidationError('message().admissionId', 'admissionId cannot be combined with additionalTools');
    }
    if (opts.admissionId !== undefined && opts.admissionId.length === 0) {
      throw new HarnessValidationError('message().admissionId', 'admissionId must be a non-empty string');
    }

    // Resolve the effective mode (per-call override wins, else session's).
    const effectiveModeId = opts.mode ?? this._record.modeId;
    const effectiveModelId = opts.model ?? this._record.modelId;
    const mode = this._harness._getMode(effectiveModeId);
    const agent = this._harness.getAgentForMode(effectiveModeId);
    const admissionHashes =
      opts.admissionId !== undefined
        ? this._computeMessageAdmissionHashes(opts, {
            modeId: effectiveModeId,
            modelId: effectiveModelId,
          })
        : undefined;
    const admissionHash = admissionHashes?.primary;
    const compatibleAdmissionHashes = admissionHashes?.legacyCompatible;
    const duplicate =
      opts.admissionId !== undefined
        ? await this._resolveMessageAdmissionDuplicate({
            admissionId: opts.admissionId,
            admissionHash: admissionHash!,
            compatibleAdmissionHashes,
          })
        : undefined;
    if (duplicate) {
      this._assertOpenForTurn('message()');
      return this._returnDuplicateMessageResult(duplicate, opts);
    }
    const admissionIdentity =
      opts.admissionId !== undefined ? this._messageAdmissionIdentity(opts.admissionId) : undefined;

    // Per-turn additionalTools merge with the mode's surface, never replace.
    const toolsets = this._buildToolsets(mode, opts.additionalTools);

    const admissionStart =
      opts.admissionId !== undefined
        ? createDeferred<AgentSignalResultEvidence | OperationAdmissionTombstone>()
        : undefined;
    if (admissionStart) void admissionStart.promise.catch(() => {});
    if (admissionIdentity !== undefined && admissionHash !== undefined && admissionStart !== undefined) {
      const existingStart = this._messageAdmissionStarts.get(opts.admissionId!);
      if (existingStart) {
        if (existingStart.admissionHash !== admissionHash) {
          throw new HarnessAdmissionConflictError(
            this.id,
            opts.admissionId!,
            existingStart.admissionHash,
            admissionHash,
          );
        }
        const evidence = await existingStart.promise;
        return this._returnDuplicateMessageResult(evidence, opts);
      }
      this._messageAdmissionStarts.set(opts.admissionId!, {
        admissionHash,
        modeId: effectiveModeId,
        promise: admissionStart.promise,
      });
    }

    // Every turn runs under a session-owned AbortController so
    // `session.abort()` can cancel the in-flight run. If the caller passes
    // their own AbortSignal, we forward it into the session controller so
    // both paths converge on a single signal handed to the agent.
    const turnAbortController = this._beginTurn(opts.abortSignal);
    const turnAbortSignal = turnAbortController.signal;
    const activeTurnWaiter = this._createActiveTurnWaiter();
    void activeTurnWaiter.promise.catch(() => {});
    const finishOwnedMessageTurn = () => {
      activeTurnWaiter.cleanup();
      this._endTurn(turnAbortController);
    };
    const failOwnedMessageTurnBeforeDispatch = (err: unknown) => {
      finishOwnedMessageTurn();
      admissionStart?.reject(err);
      if (opts.admissionId !== undefined) this._messageAdmissionStarts.delete(opts.admissionId);
    };
    const assertOwnedMessageTurnNotDeleted = () => {
      if (this._state === 'deleted') {
        const err = new HarnessSessionDeletedError(this.id);
        failOwnedMessageTurnBeforeDispatch(err);
        throw err;
      }
    };
    let requestContext;
    try {
      requestContext = await Promise.race([
        this._buildRequestContext({
          modeId: effectiveModeId,
          modelId: effectiveModelId,
          abortSignal: turnAbortSignal,
        }),
        activeTurnWaiter.promise,
      ]);
    } catch (err) {
      failOwnedMessageTurnBeforeDispatch(err);
      throw err;
    }
    assertOwnedMessageTurnNotDeleted();

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
        const result = await Promise.race([
          agent.generate(opts.content, {
            ...baseExecOptions,
            structuredOutput: { schema: opts.output as never },
          }),
          activeTurnWaiter.promise,
        ]);
        const full = result as FullOutput<unknown>;
        this._recordTurnCompletion(full);
        await Promise.race([
          this._maybeCaptureSuspend(full, undefined, effectiveModeId, effectiveModelId),
          activeTurnWaiter.promise,
        ]);
        this._emitTurnEvent({
          type: 'agent_end',
          reason: full.finishReason === 'suspended' ? 'suspended' : 'complete',
          runId: full.runId,
        });
        await Promise.race([this._runGoalJudge(full, false), activeTurnWaiter.promise]);
        return full.object;
      } finally {
        finishOwnedMessageTurn();
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
    try {
      await Promise.race([this._ensureThreadSubscription(agent), activeTurnWaiter.promise]);
    } catch (err) {
      failOwnedMessageTurnBeforeDispatch(err);
      throw err;
    }
    assertOwnedMessageTurnNotDeleted();

    if (admissionIdentity !== undefined && admissionHash !== undefined && admissionStart !== undefined) {
      try {
        const reservation = await Promise.race([
          this._writeMessageResultEvidence(
            {
              status: 'pending',
              signalId: admissionIdentity.signalId,
              runId: admissionIdentity.runId,
              admissionId: opts.admissionId!,
              admissionHash,
            },
            { compatibleAdmissionHashes },
          ),
          activeTurnWaiter.promise,
        ]);
        if (!reservation.created) {
          this._messageAdmissionStarts.delete(opts.admissionId!);
          const existing =
            reservation.evidence ??
            (await this._resolveMessageAdmissionDuplicate({
              admissionId: opts.admissionId!,
              admissionHash,
              compatibleAdmissionHashes,
            }));
          if (existing) {
            admissionStart.resolve(existing);
            try {
              return await this._returnDuplicateMessageResult(existing, opts);
            } finally {
              finishOwnedMessageTurn();
            }
          }
          const conflict = new HarnessAdmissionConflictError(this.id, opts.admissionId!, '', admissionHash);
          admissionStart.reject(conflict);
          throw conflict;
        }
      } catch (err) {
        failOwnedMessageTurnBeforeDispatch(err);
        throw err;
      }
      assertOwnedMessageTurnNotDeleted();
    }

    let signal;
    try {
      signal = agent.sendSignal(
        {
          ...(admissionIdentity ? { id: admissionIdentity.signalId } : {}),
          type: 'user-message',
          contents: opts.content as never,
        },
        {
          ...(admissionIdentity ? { runId: admissionIdentity.runId } : {}),
          resourceId: this.resourceId,
          threadId: this.threadId,
          ifIdle: { behavior: 'wake', streamOptions: baseExecOptions as never },
        },
      );
    } catch (err) {
      let thrown = err;
      if (admissionIdentity !== undefined && admissionHash !== undefined) {
        try {
          await Promise.race([
            this._writeMessageResultEvidence(
              {
                status: 'failed',
                signalId: admissionIdentity.signalId,
                runId: admissionIdentity.runId,
                admissionId: opts.admissionId!,
                admissionHash,
                error: projectHarnessPublicError(err),
              },
              { compatibleAdmissionHashes },
            ).catch(() => {}),
            activeTurnWaiter.promise,
          ]);
        } catch (evidenceErr) {
          if (evidenceErr instanceof HarnessSessionDeletedError) thrown = evidenceErr;
        }
      }
      failOwnedMessageTurnBeforeDispatch(thrown);
      throw thrown;
    }

    // Register the completion waiter BEFORE the drain has a chance to see
    // a terminal chunk for this runId (the run can start synchronously on
    // the wake path).
    const completion = this._awaitRunCompletion(signal.runId);
    void completion.catch(() => {});
    let admissionStartSettled = false;
    const resolveMessageAdmissionStart = () => {
      if (
        admissionStartSettled ||
        admissionStart === undefined ||
        admissionIdentity === undefined ||
        admissionHash === undefined
      ) {
        return;
      }
      admissionStartSettled = true;
      const now = Date.now();
      admissionStart.resolve({
        status: 'pending',
        harnessName: this._record.harnessName,
        sessionId: this.id,
        resourceId: this.resourceId,
        threadId: this.threadId,
        signalId: signal.signal.id,
        runId: signal.runId,
        admissionId: opts.admissionId!,
        admissionHash,
        createdAt: now,
        updatedAt: now,
      });
    };
    const rejectMessageAdmissionStart = (err: unknown) => {
      if (admissionStartSettled || admissionStart === undefined) return;
      admissionStartSettled = true;
      admissionStart.reject(err);
    };

    const pendingEvidenceWrite =
      admissionIdentity !== undefined
        ? this._writeMessageResultEvidence(
            {
              status: 'pending',
              signalId: signal.signal.id,
              runId: signal.runId,
              ...(opts.admissionId !== undefined ? { admissionId: opts.admissionId } : {}),
              ...(admissionHash !== undefined ? { admissionHash } : {}),
            },
            { compatibleAdmissionHashes },
          )
        : Promise.resolve();
    void pendingEvidenceWrite.catch(() => {});

    const failDispatchedMessageTurn = async (err: unknown) => {
      turnAbortController.abort(err);
      finishOwnedMessageTurn();
      rejectMessageAdmissionStart(err);
      void completion.catch(() => {});
      const waiter = this._runCompletionPromises.get(signal.runId);
      this._runCompletionPromises.delete(signal.runId);
      this._rememberCompletedRun(signal.runId, { ok: false, err });
      waiter?.reject(err);
      if (admissionIdentity !== undefined && this._shouldWriteTurnFailureEvidence(err)) {
        this._writeMessageResultEvidenceBestEffortInBackground(
          {
            status: 'failed',
            signalId: signal.signal.id,
            runId: signal.runId,
            error: projectHarnessPublicError(err),
            admissionId: opts.admissionId!,
            admissionHash: admissionHash!,
          },
          { compatibleAdmissionHashes },
        );
      }
      if (opts.admissionId !== undefined) this._messageAdmissionStarts.delete(opts.admissionId);
      void this._maybeDrainQueue();
    };

    const awaitPendingMessageEvidence = async () => {
      await Promise.race([pendingEvidenceWrite, activeTurnWaiter.promise]);
      resolveMessageAdmissionStart();
    };

    // Streaming path: hand the live `MastraModelOutput` back. The drain
    // loop is responsible for harness events; we still keep the turn
    // in-flight (so `isRunning()` reports true) until the run completes.
    if (opts.stream === true) {
      let out = agent.getRunOutput(signal.runId) as MastraModelOutput<unknown> | undefined;
      if (!out && (signal.output || admissionIdentity !== undefined)) {
        try {
          await awaitPendingMessageEvidence();
        } catch (err) {
          await failDispatchedMessageTurn(err);
          throw err;
        }
        try {
          out = signal.output
            ? ((await Promise.race([signal.output, activeTurnWaiter.promise])) as MastraModelOutput<unknown>)
            : ((await Promise.race([
                agent.waitForRunOutput(signal.runId) as Promise<MastraModelOutput<unknown>>,
                activeTurnWaiter.promise,
                completion.then(
                  () => undefined,
                  () => undefined,
                ),
                delay(MESSAGE_ADMISSION_DURABLE_WAIT_TIMEOUT_MS).then(() => undefined),
              ])) as MastraModelOutput<unknown> | undefined);
        } catch (err) {
          finishOwnedMessageTurn();
          void completion.catch(() => {});
          const waiter = this._runCompletionPromises.get(signal.runId);
          this._runCompletionPromises.delete(signal.runId);
          this._rememberCompletedRun(signal.runId, { ok: false, err });
          waiter?.reject(err);
          if (admissionIdentity !== undefined && this._shouldWriteTurnFailureEvidence(err)) {
            this._writeMessageResultEvidenceBestEffortInBackground(
              {
                status: 'failed',
                signalId: signal.signal.id,
                runId: signal.runId,
                error: projectHarnessPublicError(err),
                admissionId: opts.admissionId!,
                admissionHash: admissionHash!,
              },
              { compatibleAdmissionHashes },
            );
          }
          if (opts.admissionId !== undefined) this._messageAdmissionStarts.delete(opts.admissionId);
          void this._maybeDrainQueue();
          throw err;
        }
      }
      if (!out) {
        const err = new HarnessConfigError('message()', 'agent did not register a run for the dispatched signal');
        // Drop the completion waiter so duplicate retries do not treat an
        // unregistered run as live forever.
        await failDispatchedMessageTurn(err);
        throw err;
      }
      try {
        await awaitPendingMessageEvidence();
      } catch (err) {
        await failDispatchedMessageTurn(err);
        throw err;
      }
      let streamCompletedEvidenceWriteFailed = false;
      void Promise.race([completion, activeTurnWaiter.promise])
        .then(async full => {
          this._recordTurnCompletion(full);
          if (admissionIdentity === undefined) return full;
          await Promise.race([
            this._writeMessageResultEvidence(
              {
                status: 'completed',
                signalId: signal.signal.id,
                runId: signal.runId,
                result: full,
                admissionId: opts.admissionId!,
                admissionHash: admissionHash!,
              },
              { compatibleAdmissionHashes },
            ).catch(err => {
              streamCompletedEvidenceWriteFailed = true;
              throw err;
            }),
            activeTurnWaiter.promise,
          ]);
          return full;
        })
        .then(async full => {
          await Promise.race([
            this._maybeCaptureSuspend(full, undefined, effectiveModeId, effectiveModelId),
            activeTurnWaiter.promise,
          ]);
          this._emitTurnEvent({
            type: 'agent_end',
            reason: full.finishReason === 'suspended' ? 'suspended' : 'complete',
            runId: full.runId,
          });
          await Promise.race([this._runGoalJudge(full, false), activeTurnWaiter.promise]);
        })
        .catch(err => {
          if (
            admissionIdentity !== undefined &&
            !streamCompletedEvidenceWriteFailed &&
            this._shouldWriteTurnFailureEvidence(err)
          ) {
            void this._writeMessageResultEvidence(
              {
                status: 'failed',
                signalId: signal.signal.id,
                runId: signal.runId,
                error: projectHarnessPublicError(err),
                admissionId: opts.admissionId!,
                admissionHash: admissionHash!,
              },
              { compatibleAdmissionHashes },
            ).catch(() => {});
          }
          // The caller owns the visible stream; swallow drain-side errors.
        })
        .finally(() => {
          if (opts.admissionId !== undefined) this._deleteMessageAdmissionStartSoon(opts.admissionId);
          finishOwnedMessageTurn();
          void this._maybeDrainQueue();
        });
      return out;
    }

    // Default path: wait for stream startup and the completion watcher to
    // deliver this run's bundled `FullOutput`, then run post-turn bookkeeping.
    let streamStarted = signal.output === undefined;
    let completedEvidenceWriteFailed = false;
    try {
      // The pre-dispatch reservation is the durable admission barrier here.
      // Keep the post-dispatch pending refresh best-effort so completion
      // evidence remains the authoritative default-path result.
      await Promise.race([pendingEvidenceWrite.catch(() => {}), activeTurnWaiter.promise]);
      resolveMessageAdmissionStart();
      if (signal.output) {
        await Promise.race([signal.output, activeTurnWaiter.promise]);
        streamStarted = true;
      }
      const full = await Promise.race([completion, activeTurnWaiter.promise]);
      this._recordTurnCompletion(full);
      if (admissionIdentity !== undefined) {
        try {
          await Promise.race([
            this._writeMessageResultEvidenceBestEffort(
              {
                status: 'completed',
                signalId: signal.signal.id,
                runId: signal.runId,
                result: full,
                admissionId: opts.admissionId!,
                admissionHash: admissionHash!,
              },
              { compatibleAdmissionHashes },
            ),
            activeTurnWaiter.promise,
          ]);
        } catch (err) {
          completedEvidenceWriteFailed = true;
          throw err;
        }
      }
      await Promise.race([
        this._maybeCaptureSuspend(full, undefined, effectiveModeId, effectiveModelId),
        activeTurnWaiter.promise,
      ]);
      this._emitTurnEvent({
        type: 'agent_end',
        reason: full.finishReason === 'suspended' ? 'suspended' : 'complete',
        runId: full.runId,
      });
      await Promise.race([this._runGoalJudge(full, false), activeTurnWaiter.promise]);
      return full;
    } catch (err) {
      if (!streamStarted) {
        void completion.catch(() => {});
        const waiter = this._runCompletionPromises.get(signal.runId);
        this._runCompletionPromises.delete(signal.runId);
        this._rememberCompletedRun(signal.runId, { ok: false, err });
        waiter?.reject(err);
      }
      if (
        admissionIdentity !== undefined &&
        !completedEvidenceWriteFailed &&
        this._shouldWriteTurnFailureEvidence(err)
      ) {
        await Promise.race([
          this._writeMessageResultEvidence(
            {
              status: 'failed',
              signalId: signal.signal.id,
              runId: signal.runId,
              error: projectHarnessPublicError(err),
              admissionId: opts.admissionId!,
              admissionHash: admissionHash!,
            },
            { compatibleAdmissionHashes },
          ).catch(() => {}),
          activeTurnWaiter.promise,
        ]);
      }
      throw err;
    } finally {
      if (opts.admissionId !== undefined) this._messageAdmissionStarts.delete(opts.admissionId);
      finishOwnedMessageTurn();
      // Now that the manual turn has cleared the in-flight guard, kick
      // the queue drain so any item that was admitted mid-turn can run.
      void this._maybeDrainQueue();
    }
  }

  /**
   * Admit a default message turn and return the durable signal identity
   * without awaiting the eventual AgentResult. Remote HTTP routes use this
   * surface to preserve local `message(...)` promise semantics in the SDK:
   * the POST only proves admission, and SSE/result lookup settle the result.
   */
  async admitMessage(opts: MessageOptionsDefault): Promise<MessageAdmissionResult> {
    this._assertLive('admitMessage()');
    if (opts.admissionId === undefined || opts.admissionId.length === 0) {
      throw new HarnessValidationError('admitMessage().admissionId', 'admissionId must be a non-empty string');
    }
    if (opts.output !== undefined || opts.sync !== undefined || opts.stream !== undefined) {
      throw new HarnessConfigError('admitMessage()', 'admitMessage only accepts default message options');
    }
    if (opts.additionalTools !== undefined) {
      throw new HarnessValidationError(
        'admitMessage().admissionId',
        'admissionId cannot be combined with additionalTools',
      );
    }

    const effectiveModeId = opts.mode ?? this._record.modeId;
    const admissionHashes = this._computeMessageAdmissionHashes(opts, {
      modeId: effectiveModeId,
      modelId: opts.model ?? this._record.modelId,
    });
    const duplicate = await this._resolveMessageAdmissionDuplicate({
      admissionId: opts.admissionId,
      admissionHash: admissionHashes.primary,
      compatibleAdmissionHashes: admissionHashes.legacyCompatible,
    });
    if (duplicate) {
      this._assertOpenForTurn('admitMessage()');
      const signalId = duplicate.signalId;
      if (signalId === undefined) {
        throw new HarnessValidationError('admitMessage().admissionId', 'duplicate message result evidence has expired');
      }
      return {
        accepted: true,
        signalId,
        ...(duplicate.runId !== undefined ? { runId: duplicate.runId } : {}),
        duplicate: true,
      };
    }

    const existingStart = this._messageAdmissionStarts.get(opts.admissionId);
    if (existingStart) {
      if (existingStart.admissionHash !== admissionHashes.primary) {
        throw new HarnessAdmissionConflictError(
          this.id,
          opts.admissionId,
          existingStart.admissionHash,
          admissionHashes.primary,
        );
      }
      const evidence = await existingStart.promise;
      const signalId = evidence.signalId;
      if (signalId === undefined) {
        throw new HarnessValidationError('admitMessage().admissionId', 'message admission evidence has expired');
      }
      return {
        accepted: true,
        signalId,
        ...(evidence.runId !== undefined ? { runId: evidence.runId } : {}),
        duplicate: true,
      };
    }

    const streamPromise = this.message({ ...opts, stream: true });
    void streamPromise.catch(() => {});
    const admissionStart = await this._waitForMessageAdmissionStart(opts.admissionId, streamPromise);
    const evidence =
      admissionStart.started !== undefined
        ? await admissionStart.started.promise
        : await this._resolveMessageAdmissionDuplicate({
            admissionId: opts.admissionId,
            admissionHash: admissionHashes.primary,
            compatibleAdmissionHashes: admissionHashes.legacyCompatible,
          });
    if (evidence === undefined && admissionStart.streamError !== undefined) {
      throw admissionStart.streamError;
    }
    if (evidence === undefined) {
      throw new HarnessConfigError('admitMessage()', 'message admission evidence was not recorded');
    }
    const signalId = evidence.signalId;
    if (signalId === undefined) {
      throw new HarnessValidationError('admitMessage().admissionId', 'message admission evidence has expired');
    }
    return {
      accepted: true,
      signalId,
      ...(evidence.runId !== undefined ? { runId: evidence.runId } : {}),
      duplicate: admissionStart.started === undefined,
    };
  }

  private async _waitForMessageAdmissionStart(
    admissionId: string,
    streamPromise: Promise<unknown>,
  ): Promise<{ started?: MessageAdmissionStart; streamError?: unknown }> {
    const settled: { status: 'pending' | 'fulfilled' | 'rejected'; error?: unknown } = { status: 'pending' };
    void streamPromise.then(
      () => {
        settled.status = 'fulfilled';
      },
      error => {
        settled.status = 'rejected';
        settled.error = error;
      },
    );

    while (true) {
      const started = this._messageAdmissionStarts.get(admissionId);
      if (started) return { started };
      if (settled.status === 'rejected') return { streamError: settled.error };
      if (settled.status === 'fulfilled') {
        return {};
      }
      await delay(0);
    }
  }

  private _deleteMessageAdmissionStartSoon(admissionId: string): void {
    const timer = setTimeout(() => {
      this._messageAdmissionStarts.delete(admissionId);
    }, 0);
    timer.unref?.();
  }

  private async _resolveMessageAdmissionDuplicate({
    admissionId,
    admissionHash,
    compatibleAdmissionHashes,
  }: {
    admissionId: string;
    admissionHash: string;
    compatibleAdmissionHashes?: readonly string[];
  }): Promise<AgentSignalResultEvidence | OperationAdmissionTombstone | undefined> {
    const resolved = await this._storage.resolveOperationAdmissionEvidence({
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      kind: 'message',
      admissionId,
      attemptedAdmissionHash: admissionHash,
    });
    if (resolved.status === 'none') return undefined;
    if (resolved.status === 'conflict') {
      if (
        resolved.storedAdmissionHash !== undefined &&
        compatibleAdmissionHashes?.includes(resolved.storedAdmissionHash)
      ) {
        return resolved.evidence as AgentSignalResultEvidence | OperationAdmissionTombstone | undefined;
      }
      throw new HarnessAdmissionConflictError(this.id, admissionId, resolved.storedAdmissionHash ?? '', admissionHash);
    }
    return resolved.evidence as AgentSignalResultEvidence | OperationAdmissionTombstone | undefined;
  }

  private async _returnDuplicateMessageResult(
    evidence: AgentSignalResultEvidence | OperationAdmissionTombstone,
    opts: MessageOptions,
  ): Promise<AgentResult | AgentStream | unknown> {
    return this._withActiveDeletedWaiter(async activeDeleted => {
      if ('status' in evidence) {
        if (opts.stream === true) {
          if (evidence.status === 'pending') {
            const agent = this._harness.getAgentForMode(this._messageDuplicateModeId(evidence, opts));
            await this._raceActiveTurnWaiter(this._ensureThreadSubscription(agent), activeDeleted);
            const runId = await this._pendingMessageRunId(evidence);
            if (runId && this._completedRuns.has(runId)) {
              const cached = this._completedRuns.get(runId);
              if (cached?.ok && evidence.admissionId !== undefined && evidence.admissionHash !== undefined) {
                await this._writeMessageResultEvidenceBestEffort({
                  status: 'completed',
                  signalId: evidence.signalId,
                  runId,
                  result: cached.full,
                  admissionId: evidence.admissionId,
                  admissionHash: evidence.admissionHash,
                });
              }
              throw new HarnessValidationError('message().admissionId', 'duplicate stream is no longer live');
            }
            let output = runId ? (agent.getRunOutput(runId) as AgentStream | undefined) : undefined;
            let retainedCompletedOutput = false;
            if (
              output &&
              (output as { status?: string }).status !== undefined &&
              (output as { status?: string }).status !== 'running'
            ) {
              retainedCompletedOutput = true;
              output = undefined;
            }
            if (runId && !output && !retainedCompletedOutput) {
              const waitAbortController = new AbortController();
              const completion = this._runCompletionPromises.get(runId)?.promise.then(
                () => undefined,
                () => undefined,
              );
              try {
                output = (await Promise.race([
                  this._raceActiveTurnWaiter(
                    (
                      agent.waitForRunOutput(runId, { abortSignal: waitAbortController.signal }) as Promise<AgentStream>
                    ).catch(() => undefined),
                    activeDeleted,
                  ),
                  ...(completion ? [completion] : []),
                  delay(MESSAGE_ADMISSION_DURABLE_WAIT_TIMEOUT_MS, waitAbortController.signal).then(
                    () => undefined,
                    () => undefined,
                  ),
                ])) as AgentStream | undefined;
              } finally {
                waitAbortController.abort(
                  new HarnessValidationError('message().admissionId', 'duplicate stream wait ended'),
                );
              }
            }
            if (output) return output;
          }
          throw new HarnessValidationError('message().admissionId', 'duplicate stream is no longer live');
        }
        if (evidence.status === 'completed') return evidence.result as AgentResult;
        if (evidence.status === 'failed') throw publicErrorProjectionToError(evidence.error);
        const runId = await this._pendingMessageRunId(evidence);
        if (runId) {
          const agent = this._harness.getAgentForMode(this._messageDuplicateModeId(evidence, opts));
          await this._raceActiveTurnWaiter(this._ensureThreadSubscription(agent), activeDeleted);
          const cached = this._completedRuns.get(runId);
          if (cached) {
            if (!cached.ok) throw cached.err;
            if (evidence.admissionId !== undefined && evidence.admissionHash !== undefined) {
              await this._writeMessageResultEvidenceBestEffort({
                status: 'completed',
                signalId: evidence.signalId,
                runId,
                result: cached.full,
                admissionId: evidence.admissionId,
                admissionHash: evidence.admissionHash,
              });
            }
            return cached.full;
          }
          if (!this._hasLiveMessageRun(agent, runId)) {
            return this._raceActiveTurnWaiter(this._awaitDurableMessageResult(evidence, opts), activeDeleted);
          }
          return this._raceActiveTurnWaiter(this._awaitRunCompletion(runId), activeDeleted);
        }
      }
      throw new HarnessValidationError('message().admissionId', 'duplicate message result evidence has expired');
    });
  }

  private async _pendingMessageRunId(evidence: AgentSignalResultEvidence): Promise<string | undefined> {
    if (evidence.status !== 'pending') return evidence.runId;
    const starting = evidence.admissionId ? this._messageAdmissionStarts.get(evidence.admissionId) : undefined;
    if (!starting) return evidence.runId;
    try {
      const startingEvidence = await starting.promise;
      return startingEvidence.runId ?? evidence.runId;
    } catch {
      return evidence.runId;
    }
  }

  private _messageDuplicateModeId(evidence: AgentSignalResultEvidence, opts: MessageOptions): string {
    const starting = evidence.admissionId ? this._messageAdmissionStarts.get(evidence.admissionId) : undefined;
    return starting?.modeId ?? opts.mode ?? this._record.modeId;
  }

  private _hasLiveMessageRun(agent: Agent, runId: string): boolean {
    return Boolean(
      agent.getRunOutput(runId) || this._runCompletionPromises.has(runId) || this._completedRuns.has(runId),
    );
  }

  private async _awaitDurableMessageResult(
    evidence: AgentSignalResultEvidence,
    opts: MessageOptions,
  ): Promise<AgentResult> {
    const deadline = Date.now() + MESSAGE_ADMISSION_DURABLE_WAIT_TIMEOUT_MS;
    while (true) {
      throwIfAborted(opts.abortSignal, 'message().admissionId');
      const latest = await this._storage.loadMessageResultEvidence({
        harnessName: this._record.harnessName,
        sessionId: this.id,
        resourceId: this.resourceId,
        threadId: this.threadId,
        signalId: evidence.signalId,
      });
      if (!latest) {
        throw new HarnessValidationError('message().admissionId', 'duplicate message result evidence has expired');
      }
      if ('status' in latest) {
        if (latest.status === 'completed') return latest.result as AgentResult;
        if (latest.status === 'failed') throw publicErrorProjectionToError(latest.error);
      } else {
        throw new HarnessValidationError('message().admissionId', 'duplicate message result evidence has expired');
      }
      if (Date.now() >= deadline) {
        throw new HarnessValidationError('message().admissionId', 'pending message admission is not live');
      }
      await delay(MESSAGE_ADMISSION_DURABLE_WAIT_INTERVAL_MS, opts.abortSignal);
    }
  }

  private _messageAdmissionIdentity(admissionId: string): MessageAdmissionIdentity {
    const digest = sha256CanonicalJson({
      kind: 'message-admission',
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      admissionId,
    });
    return {
      signalId: `harness-message-${digest.slice(0, 32)}`,
      runId: `harness-message-${digest.slice(32, 64)}`,
    };
  }

  private async _writeMessageResultEvidence(
    status: AgentSignalResultStatus & { admissionId?: string; admissionHash?: string },
    options?: { compatibleAdmissionHashes?: readonly string[] },
  ): Promise<{ created: boolean; evidence?: AgentSignalResultEvidence | OperationAdmissionTombstone }> {
    const now = Date.now();
    this._operationEvidenceSignalIds.add(status.signalId);
    try {
      const result = await this._storage.writeMessageResultEvidence({
        ...status,
        harnessName: this._record.harnessName,
        sessionId: this.id,
        resourceId: this.resourceId,
        threadId: this.threadId,
        createdAt: now,
        updatedAt: now,
      });
      await this._cleanupOperationEvidenceIfDeleted(status);
      return result;
    } catch (err) {
      if (err instanceof HarnessStorageAdmissionConflictError && status.admissionId && status.admissionHash) {
        const duplicate = await this._resolveMessageAdmissionDuplicate({
          admissionId: status.admissionId,
          admissionHash: status.admissionHash,
          compatibleAdmissionHashes: options?.compatibleAdmissionHashes,
        });
        if (duplicate) return { created: false, evidence: duplicate };
        throw new HarnessAdmissionConflictError(this.id, status.admissionId, '', status.admissionHash);
      }
      throw err;
    }
  }

  private async _cleanupOperationEvidenceIfDeleted(status: { signalId: string }): Promise<void> {
    if (this._state !== 'deleted') return;
    await this._storage
      .deleteOperationAdmissionTombstonesForSession({
        harnessName: this._record.harnessName,
        sessionId: this.id,
        resourceId: this.resourceId,
        threadId: this.threadId,
        signalId: status.signalId,
      })
      .catch(() => {});
  }

  private async _writeMessageResultEvidenceBestEffort(
    status: AgentSignalResultStatus & { admissionId?: string; admissionHash?: string },
    options?: { compatibleAdmissionHashes?: readonly string[] },
  ): Promise<void> {
    try {
      await this._writeMessageResultEvidence(status, options);
    } catch (err) {
      if (status.admissionId !== undefined) throw err;
      // The initial pre-dispatch admission reservation is the durable barrier.
      // Non-idempotent callers have no durable replay contract, so storage
      // evidence is only best-effort for them.
    }
  }

  private _writeMessageResultEvidenceBestEffortInBackground(
    status: AgentSignalResultStatus & { admissionId?: string; admissionHash?: string },
    options?: { compatibleAdmissionHashes?: readonly string[] },
  ): void {
    const write = this._writeMessageResultEvidenceBestEffort(status, options);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>(resolve => {
      timer = setTimeout(resolve, MESSAGE_RESULT_EVIDENCE_BACKGROUND_OBSERVE_TIMEOUT_MS);
      timer.unref?.();
    });
    void Promise.race([write, timeout])
      .catch(() => {})
      .finally(() => {
        if (timer !== undefined) clearTimeout(timer);
      });
  }

  private _computeMessageAdmissionHashes(
    opts: MessageOptions,
    stable: { modeId: string; modelId: string },
  ): MessageAdmissionHashes {
    const primary = sha256CanonicalJson(this._messageAdmissionHashInput(opts, undefined, { hashVersion: 2 }));
    // Pre-v2 evidence hashed the effective mode/model. Keep compatibility
    // candidates for the current effective tuple only; old evidence does not
    // persist enough metadata to safely infer previous defaults after drift.
    const legacyCompatible = [
      sha256CanonicalJson(this._messageAdmissionHashInput(opts, stable)),
      sha256CanonicalJson(this._messageAdmissionHashInput(opts, stable, { includeAttachmentMetadata: false })),
    ];
    return {
      primary,
      legacyCompatible: [...new Set(legacyCompatible)].filter(hash => hash !== primary),
    };
  }

  private _messageAdmissionHashInput(
    opts: MessageOptions,
    stable?: { modeId: string; modelId: string },
    options?: { hashVersion?: number; includeAttachmentMetadata?: boolean },
  ) {
    return {
      kind: 'message',
      ...(options?.hashVersion !== undefined ? { hashVersion: options.hashVersion } : {}),
      content: opts.content,
      ...(stable !== undefined
        ? { mode: stable.modeId, model: stable.modelId }
        : {
            ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
            ...(opts.model !== undefined ? { model: opts.model } : {}),
          }),
      attachments: (opts.attachments ?? []).map(attachment => ({
        attachmentId: attachment.attachmentId,
        resourceId: attachment.resourceId,
        ...(attachment.ownerSessionId !== undefined ? { ownerSessionId: attachment.ownerSessionId } : {}),
        ...(attachment.bytes !== undefined ? { bytes: attachment.bytes } : {}),
        ...(attachment.sha256 !== undefined ? { sha256: attachment.sha256 } : {}),
        ...(attachment.source !== undefined ? { source: attachment.source } : {}),
        ...(options?.includeAttachmentMetadata !== false
          ? {
              ...(attachment.kind !== undefined ? { kind: attachment.kind } : {}),
              ...(attachment.name !== undefined ? { name: attachment.name } : {}),
              ...(attachment.mimeType !== undefined ? { mimeType: attachment.mimeType } : {}),
              ...(attachment.primitiveType !== undefined ? { primitiveType: attachment.primitiveType } : {}),
              ...(attachment.elementType !== undefined ? { elementType: attachment.elementType } : {}),
              ...(attachment.renderer !== undefined ? { renderer: attachment.renderer } : {}),
              ...(attachment.schemaId !== undefined ? { schemaId: attachment.schemaId } : {}),
              ...(attachment.metadata !== undefined ? { metadata: cloneAttachmentMetadata(attachment.metadata) } : {}),
              ...(attachment.object !== undefined ? { object: attachment.object } : {}),
            }
          : {}),
      })),
    };
  }

  // -------------------------------------------------------------------------
  // signal() — §4.2.
  //
  // Optimistic user-message primitive. Resolves with the routing decision
  // (`id`, `runId`, `willInterleave`) on the first await tick so callers
  // can render an optimistic transcript row before the turn completes,
  // then await `result` for the eventual `AgentResult`.
  //
  // Two delivery shapes:
  //
  //   * Idle thread → wakes a fresh run. This call owns the turn:
  //     `_beginTurn`, `agent_start`, await completion in a background
  //     continuation, `agent_end` + judge + `_endTurn` + drain.
  //
  //   * Active-delivery → an existing run is in flight on this thread.
  //     The signal drains mid-flight into the running execution loop;
  //     no new turn boundary, no `agent_start`/`agent_end`. `result`
  //     resolves with the existing run's `AgentResult`.
  //
  // Per-turn overrides (`mode`, `additionalTools`) on an active-delivery
  // dispatch reject at admission with `HarnessOverrideConflictError` —
  // the in-flight run's surface was committed when it started and cannot
  // be changed mid-flight.
  // -------------------------------------------------------------------------
  async signal(opts: SessionSignalOptions): Promise<SessionSignalResult> {
    this._assertLive('signal()');
    if (typeof opts.content !== 'string') {
      throw new HarnessValidationError('signal()', '`content` must be a string');
    }

    // Resolve effective mode + backing agent.
    const effectiveModeId = opts.mode ?? this._record.modeId;
    const mode = this._harness._getMode(effectiveModeId);
    const agent = this._harness.getAgentForMode(effectiveModeId);

    // Open the thread subscription before reading `activeRunId()` so the
    // routing decision sees the live runtime state.
    const subscriptionWaiter = this._createActiveTurnWaiter();
    void subscriptionWaiter.promise.catch(() => {});
    const subscription = this._ensureThreadSubscription(agent);
    void subscription.catch(() => {});
    const sub = await Promise.race([subscription, subscriptionWaiter.promise]).finally(() => {
      subscriptionWaiter.cleanup();
    });
    this._assertLive('signal()');

    const activeRunId = sub.activeRunId();
    const willInterleave = activeRunId !== null;

    // Active-delivery + per-turn overrides → reject at admission.
    if (willInterleave) {
      if (effectiveModeId !== this._record.modeId) {
        throw new HarnessOverrideConflictError(
          this.id,
          'mode',
          `cannot override mode on a signal that drains into an active run (run ${activeRunId})`,
        );
      }
      if (opts.additionalTools !== undefined) {
        throw new HarnessOverrideConflictError(
          this.id,
          'additionalTools',
          `cannot supply additionalTools on a signal that drains into an active run (run ${activeRunId})`,
        );
      }
    }

    if (!willInterleave) {
      // Owned-turn path: same bookkeeping as the message() default path.
      const turnAbortController = this._beginTurn(opts.abortSignal);
      const turnAbortSignal = turnAbortController.signal;
      const activeTurnWaiter = this._createActiveTurnWaiter();
      void activeTurnWaiter.promise.catch(() => {});
      const finishOwnedSignalTurn = () => {
        activeTurnWaiter.cleanup();
        this._endTurn(turnAbortController);
      };
      const assertOwnedSignalTurnNotDeleted = () => {
        if (this._state === 'deleted') {
          throw new HarnessSessionDeletedError(this.id);
        }
      };
      let dispatched;
      try {
        const toolsets = this._buildToolsets(mode, opts.additionalTools);
        const requestContext = await Promise.race([
          this._buildRequestContext({
            modeId: effectiveModeId,
            modelId: this._record.modelId,
            abortSignal: turnAbortSignal,
          }),
          activeTurnWaiter.promise,
        ]);
        const baseExecOptions: AgentExecutionOptionsBase<unknown> = {
          memory: { thread: this.threadId, resource: this.resourceId },
          abortSignal: turnAbortSignal,
          requestContext,
          ...(toolsets ? { toolsets } : {}),
          ...(mode.instructions ? { instructions: mode.instructions } : {}),
        };
        assertOwnedSignalTurnNotDeleted();
        this._emitTurnEvent({ type: 'agent_start' });

        dispatched = agent.sendSignal(
          { type: 'user-message', contents: opts.content as never },
          {
            resourceId: this.resourceId,
            threadId: this.threadId,
            ifIdle: { behavior: 'wake', streamOptions: baseExecOptions as never },
          },
        );
      } catch (err) {
        finishOwnedSignalTurn();
        throw err;
      }

      // Register the completion waiter before any terminal chunks land.
      const completion = this._awaitRunCompletion(dispatched.runId);
      const completionOrDelete = Promise.race([completion, activeTurnWaiter.promise]);

      // Background continuation runs the post-turn bookkeeping so the
      // caller's `result` promise resolves with the final AgentResult.
      const result: Promise<AgentResult> = completionOrDelete
        .then(async full => {
          this._recordTurnCompletion(full);
          await Promise.race([
            this._maybeCaptureSuspend(full, undefined, effectiveModeId, this._record.modelId),
            activeTurnWaiter.promise,
          ]);
          this._emitTurnEvent({
            type: 'agent_end',
            reason: full.finishReason === 'suspended' ? 'suspended' : 'complete',
            runId: full.runId,
          });
          await Promise.race([this._runGoalJudge(full, false), activeTurnWaiter.promise]);
          return full as AgentResult;
        })
        .finally(() => {
          finishOwnedSignalTurn();
          void this._maybeDrainQueue();
        });

      // Swallow `result` rejections at the inner level so the
      // background continuation doesn't surface as an unhandled
      // rejection if the caller never awaits `result`. The caller's
      // copy still rejects.
      void result.catch(() => {});

      return {
        id: dispatched.signal.id,
        runId: dispatched.runId,
        willInterleave: false,
        accepted: true,
        signal: dispatched.signal,
        result,
      };
    }

    // Active-delivery path: signal drains into the existing run. No turn
    // bookkeeping owned here; the in-flight run owns its own completion.
    // Pass empty streamOptions — the runtime ignores them when active.
    const dispatched = agent.sendSignal(
      { type: 'user-message', contents: opts.content as never },
      {
        resourceId: this.resourceId,
        threadId: this.threadId,
        ifIdle: { behavior: 'wake', streamOptions: {} as never },
      },
    );

    // Shared completion promise with whichever caller owns the run.
    const completion = this._awaitRunCompletion(dispatched.runId);
    void completion.catch(() => {});

    return {
      id: dispatched.signal.id,
      runId: dispatched.runId,
      willInterleave: true,
      accepted: true,
      signal: dispatched.signal,
      result: completion as Promise<AgentResult>,
    };
  }

  // -------------------------------------------------------------------------
  // injectSystemReminder() — §4.2.
  //
  // System-reminder injection primitive used by goal-judge continuations
  // and other harness-internal nudges. Behaves like `signal()` but with
  // signal type `'system-reminder'` and no exposed `result` promise — the
  // caller doesn't await the run's `AgentResult`. When the reminder wakes
  // an idle thread, full turn bookkeeping still runs in the background
  // (`agent_start`/`agent_end` are emitted, the judge runs, etc.). When
  // it drains into an active run, the active run's lifecycle absorbs it.
  // -------------------------------------------------------------------------
  async injectSystemReminder(
    content: string,
    opts?: SessionInjectSystemReminderOptions,
  ): Promise<SessionInjectSystemReminderResult> {
    this._assertLive('injectSystemReminder()');
    if (typeof content !== 'string' || content.length === 0) {
      throw new HarnessValidationError('injectSystemReminder()', '`content` must be a non-empty string');
    }

    const effectiveModeId = this._record.modeId;
    const mode = this._harness._getMode(effectiveModeId);
    const agent = this._harness.getAgentForMode(effectiveModeId);

    const subscriptionWaiter = this._createActiveTurnWaiter();
    void subscriptionWaiter.promise.catch(() => {});
    const subscription = this._ensureThreadSubscription(agent);
    void subscription.catch(() => {});
    const sub = await Promise.race([subscription, subscriptionWaiter.promise]).finally(() => {
      subscriptionWaiter.cleanup();
    });
    this._assertLive('injectSystemReminder()');
    const activeRunId = sub.activeRunId();
    const willInterleave = activeRunId !== null;

    if (!willInterleave) {
      // Owned-turn path: full turn bookkeeping in a background
      // continuation. Caller doesn't get a result handle.
      const turnAbortController = this._beginTurn(undefined);
      const turnAbortSignal = turnAbortController.signal;
      const activeTurnWaiter = this._createActiveTurnWaiter();
      void activeTurnWaiter.promise.catch(() => {});
      const finishOwnedReminderTurn = () => {
        activeTurnWaiter.cleanup();
        this._endTurn(turnAbortController);
      };
      const assertOwnedReminderTurnNotDeleted = () => {
        if (this._state === 'deleted') {
          throw new HarnessSessionDeletedError(this.id);
        }
      };
      let dispatched;
      try {
        const toolsets = this._buildToolsets(mode, undefined);
        const requestContext = await Promise.race([
          this._buildRequestContext({
            modeId: effectiveModeId,
            modelId: this._record.modelId,
            abortSignal: turnAbortSignal,
          }),
          activeTurnWaiter.promise,
        ]);
        const baseExecOptions: AgentExecutionOptionsBase<unknown> = {
          memory: { thread: this.threadId, resource: this.resourceId },
          abortSignal: turnAbortSignal,
          requestContext,
          ...(toolsets ? { toolsets } : {}),
          ...(mode.instructions ? { instructions: mode.instructions } : {}),
        };
        assertOwnedReminderTurnNotDeleted();
        this._emitTurnEvent({ type: 'agent_start' });

        dispatched = agent.sendSignal(
          {
            type: 'system-reminder',
            contents: content,
            ...(opts?.attributes ? { attributes: opts.attributes } : {}),
            ...(opts?.metadata ? { metadata: opts.metadata } : {}),
          },
          {
            resourceId: this.resourceId,
            threadId: this.threadId,
            ifIdle: { behavior: 'wake', streamOptions: baseExecOptions as never },
          },
        );
      } catch (err) {
        finishOwnedReminderTurn();
        throw err;
      }

      const completion = this._awaitRunCompletion(dispatched.runId);
      const completionOrDelete = Promise.race([completion, activeTurnWaiter.promise]);
      const result = completionOrDelete
        .then(async full => {
          this._recordTurnCompletion(full);
          await Promise.race([
            this._maybeCaptureSuspend(full, undefined, effectiveModeId, this._record.modelId),
            activeTurnWaiter.promise,
          ]);
          this._emitTurnEvent({
            type: 'agent_end',
            reason: full.finishReason === 'suspended' ? 'suspended' : 'complete',
            runId: full.runId,
          });
          await Promise.race([this._runGoalJudge(full, false), activeTurnWaiter.promise]);
        })
        .finally(() => {
          finishOwnedReminderTurn();
          void this._maybeDrainQueue();
        });
      void result.catch(() => {});

      return {
        id: dispatched.signal.id,
        runId: dispatched.runId,
        willInterleave: false,
        accepted: true,
        signal: dispatched.signal,
      };
    }

    // Active-delivery path: drain into the live run.
    const dispatched = agent.sendSignal(
      {
        type: 'system-reminder',
        contents: content,
        ...(opts?.attributes ? { attributes: opts.attributes } : {}),
        ...(opts?.metadata ? { metadata: opts.metadata } : {}),
      },
      {
        resourceId: this.resourceId,
        threadId: this.threadId,
        ifIdle: { behavior: 'wake', streamOptions: {} as never },
      },
    );

    return {
      id: dispatched.signal.id,
      runId: dispatched.runId,
      willInterleave: true,
      accepted: true,
      signal: dispatched.signal,
    };
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
  private async _maybeCaptureSuspend(
    full: FullOutput<unknown>,
    queuedItemId = this._currentQueuedItemId,
    modeId = this._record.modeId,
    modelId = this._modelIdForQueuedItem(queuedItemId),
  ): Promise<void> {
    if (full.finishReason !== 'suspended') return;
    const payload = full.suspendPayload as
      | { toolCallId: string; toolName: string; args?: unknown; suspendPayload?: unknown }
      | undefined;
    if (!payload || !full.runId) return;

    const kind = this._classifyResumeKind(payload);
    const existing = this._record.pendingResume;
    if (
      existing &&
      existing.kind === kind &&
      existing.runId === full.runId &&
      existing.toolCallId === payload.toolCallId
    ) {
      return;
    }
    const pending: PendingResume = {
      kind,
      itemId: `${kind}:${payload.toolCallId}`,
      runId: full.runId,
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      source: 'parent',
      requestedAt: Date.now(),
      ...(queuedItemId !== undefined ? { queuedItemId } : {}),
      modeId,
      runtimeDependencies: this._harness._runtimeDependenciesForMode(modeId, modelId),
      payload: this._buildResumePayload(kind, payload),
    };

    if (kind === 'plan-approval') {
      const mode = this._harness._getMode(modeId);
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

  /**
   * Session model namespace (§4.2a). Surfaced as a namespace for symmetry
   * with `harness.models.*` (§9). Mutators write under the session lease
   * and resolve only after the durable transition commits.
   */
  readonly models = Object.freeze({
    current: (): string => this._modelsCurrent(),
    hasSelected: (): boolean => this._modelsHasSelected(),
    currentAuthStatus: (): Promise<ModelAuthStatus> => this._modelsCurrentAuthStatus(),
    switch: (opts: { model: string }): Promise<void> => this._modelsSwitch(opts),
    setSubagent: (opts: { agentType: string; model: string }): Promise<void> => this._modelsSetSubagent(opts),
    getSubagent: (opts: { agentType: string }): string | null => this._modelsGetSubagent(opts),
  });

  /** Resolved model id for the next turn. Falls back to `''` when nothing has been selected. */
  private _modelsCurrent(): string {
    this._assertLive('models.current()');
    return this._record.modelId;
  }

  /**
   * True once any model has been chosen for this session — either an
   * explicit `models.switch()` call or a `models.setSubagent()` pin. Useful
   * for boot flows that want to gate UI on "has the user picked yet?"
   * without inspecting raw record fields.
   */
  private _modelsHasSelected(): boolean {
    this._assertLive('models.hasSelected()');
    if (this._record.modelId && this._record.modelId.length > 0) return true;
    if (Object.keys(this._record.subagentModelOverrides ?? {}).length > 0) return true;
    return false;
  }

  /**
   * Auth status for the currently resolved model. Routed through
   * `harness.models.getAuthStatus()` when the current model is in the
   * catalog; returns `'unknown'` when no model is selected or the model
   * isn't registered (we don't want the auth-status check to throw on a
   * free-form id the agent layer will accept anyway).
   */
  private async _modelsCurrentAuthStatus(): Promise<ModelAuthStatus> {
    this._assertLive('models.currentAuthStatus()');
    const modelId = this._record.modelId;
    if (!modelId) return 'unknown';
    const entry = await this._harness.models.get(modelId);
    if (!entry) return 'unknown';
    return this._harness.models.getAuthStatus(modelId);
  }

  /** Switch the session's default model id. Free-form string — validated by the agent layer. */
  private async _modelsSwitch(opts: { model: string }): Promise<void> {
    this._assertLive('models.switch()');
    assertModelId('models.switch', opts.model);
    const previousModelId = this._record.modelId;
    if (previousModelId === opts.model) return;
    await this._flushUpdate(prev => ({ ...prev, modelId: opts.model }));
    this._emitter.emit({ type: 'model_changed', modelId: opts.model, previousModelId });
  }

  /**
   * Pin a model for spawned subagents of a given `agentType`. Override is
   * persisted in `SessionRecord.subagentModelOverrides` and read back by
   * the spawn machinery via `models.getSubagent()`. Emits
   * `model_override_set`. No-op when the same mapping is already set.
   */
  private async _modelsSetSubagent(opts: { agentType: string; model: string }): Promise<void> {
    this._assertLive('models.setSubagent()');
    assertAgentType('models.setSubagent', opts.agentType);
    assertModelId('models.setSubagent', opts.model);
    const previousModelId = this._record.subagentModelOverrides?.[opts.agentType] ?? null;
    if (previousModelId === opts.model) return;
    await this._flushUpdate(prev => ({
      ...prev,
      subagentModelOverrides: {
        ...(prev.subagentModelOverrides ?? {}),
        [opts.agentType]: opts.model,
      },
    }));
    this._emitter.emit({
      type: 'model_override_set',
      agentType: opts.agentType,
      modelId: opts.model,
      previousModelId,
    });
  }

  /** Read the pinned subagent model for an `agentType`, or `null` when unset. */
  private _modelsGetSubagent(opts: { agentType: string }): string | null {
    this._assertLive('models.getSubagent()');
    assertAgentType('models.getSubagent', opts.agentType);
    return this._record.subagentModelOverrides?.[opts.agentType] ?? null;
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
  setState<TState = unknown>(updates: Partial<TState>, opts?: SetStateOptions): Promise<void>;
  setState<TState = unknown>(updater: (prev: TState) => TState, opts?: SetStateOptions): Promise<void>;
  async setState<TState = unknown>(
    updatesOrUpdater: Partial<TState> | ((prev: TState) => TState),
    opts?: SetStateOptions,
  ): Promise<void> {
    this._assertLive('setState()');
    await this._flushUpdate(prev => {
      const current = (prev.state ?? {}) as TState;
      const next =
        typeof updatesOrUpdater === 'function'
          ? (updatesOrUpdater as (prev: TState) => TState)(current)
          : ({ ...(current as object), ...(updatesOrUpdater as object) } as TState);
      return { ...prev, state: next };
    }, opts);
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

      // Pending interrupt — UX payload only; recovery metadata stays internal.
      pending: pendingResumeForDisplay(rec.pendingResume),

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
        resourceId: this.resourceId,
        perPage: limit,
        page: 0,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      return result.messages
        .slice()
        .reverse()
        .map(msg => convertStoredMessageToHarnessMessage(msg as unknown as StoredMessageRow));
    }

    const result = await memory.listMessages({ threadId: this.threadId, resourceId: this.resourceId, perPage: false });
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
      mode: this._record.modeId,
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
  async respondToToolApproval(
    opts: { approved: boolean; reason?: string } & InboxReceiptResponseOptions,
  ): Promise<InboxResponseResult>;
  async respondToToolApproval(
    opts: { approved: boolean; reason?: string } & LegacyInboxResponseOptions,
  ): Promise<AgentResult>;
  async respondToToolApproval(
    opts: { approved: boolean; reason?: string } & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult>;
  async respondToToolApproval(
    opts: { approved: boolean; reason?: string } & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult> {
    return this._resume(
      'tool-approval',
      compactJsonObject({
        approved: opts.approved,
        reason: opts.reason,
      }),
      opts,
    );
  }

  /** Resume a pending tool-suspension. `resumeData` is forwarded to the tool. */
  async respondToToolSuspension(
    opts: { resumeData: unknown } & InboxReceiptResponseOptions,
  ): Promise<InboxResponseResult>;
  async respondToToolSuspension(opts: { resumeData: unknown } & LegacyInboxResponseOptions): Promise<AgentResult>;
  async respondToToolSuspension(
    opts: { resumeData: unknown } & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult>;
  async respondToToolSuspension(
    opts: { resumeData: unknown } & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult> {
    return this._resume('tool-suspension', opts.resumeData, opts);
  }

  /** Resume a pending `ask_user` question. */
  async respondToQuestion(opts: { answer: unknown } & InboxReceiptResponseOptions): Promise<InboxResponseResult>;
  async respondToQuestion(opts: { answer: unknown } & LegacyInboxResponseOptions): Promise<AgentResult>;
  async respondToQuestion(opts: { answer: unknown } & InboxResponseOptions): Promise<AgentResult | InboxResponseResult>;
  async respondToQuestion(
    opts: { answer: unknown } & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult> {
    return this._resume('question', { answer: opts.answer }, opts);
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
  async respondToPlanApproval(
    opts: {
      approved: boolean;
      revision?: string;
      transitionToMode?: string;
    } & InboxReceiptResponseOptions,
  ): Promise<InboxResponseResult>;
  async respondToPlanApproval(
    opts: {
      approved: boolean;
      revision?: string;
      transitionToMode?: string;
    } & LegacyInboxResponseOptions,
  ): Promise<AgentResult>;
  async respondToPlanApproval(
    opts: {
      approved: boolean;
      revision?: string;
      transitionToMode?: string;
    } & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult>;
  async respondToPlanApproval(
    opts: {
      approved: boolean;
      revision?: string;
      transitionToMode?: string;
    } & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult> {
    if (opts.transitionToMode !== undefined) {
      // Validate eagerly so callers see a clean error rather than a CAS-time
      // throw from inside the resume flow.
      this._harness._getMode(opts.transitionToMode);
    }
    return this._resume(
      'plan-approval',
      compactJsonObject({
        approved: opts.approved,
        revision: opts.revision,
        transitionToMode: opts.transitionToMode,
      }),
      opts,
    );
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

  private async _resume(
    expectedKind: PendingResume['kind'],
    resumeData: unknown,
    responseOptions: InboxResponseOptions = {},
  ): Promise<AgentResult | InboxResponseResult> {
    this._assertLive(`respond[${expectedKind}]`);
    const responseId = getOwnRecordValue(responseOptions as Record<string, unknown>, 'responseId');
    if (responseId !== undefined && typeof responseId !== 'string') {
      throw new HarnessValidationError(`respond[${expectedKind}].responseId`, 'responseId must be a string');
    }
    const responseMode: ResumeResponseMode = responseId !== undefined ? 'inbox-receipt' : 'agent-result';
    if (responseId !== undefined && responseId.length === 0) {
      throw new HarnessValidationError(`respond[${expectedKind}].responseId`, 'responseId must be a non-empty string');
    }
    const requestedItemId = getOwnRecordValue(responseOptions as Record<string, unknown>, 'itemId');
    if (requestedItemId !== undefined && typeof requestedItemId !== 'string') {
      throw new HarnessValidationError(`respond[${expectedKind}].itemId`, 'itemId must be a string');
    }

    const storedReceipt =
      responseId !== undefined ? getOwnRecordValue(this._record.inboxResponseReceipts, responseId) : undefined;
    if (storedReceipt !== undefined) {
      const duplicate = this._resolveStoredInboxResponse(expectedKind, resumeData, responseOptions);
      if (storedReceipt.status === 'applied') {
        return duplicate!;
      }
      if (this._record.pendingResume === undefined) {
        const recoveredReceipt = await this._applyInboxReceiptFromCompletedQueue(storedReceipt);
        if (recoveredReceipt) return this._inboxReceiptResult(recoveredReceipt, true);
        return duplicate!;
      }
    }

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

    const itemId = pending.itemId ?? pending.toolCallId;
    if (requestedItemId !== undefined && requestedItemId !== itemId) {
      throw new HarnessInboxItemNotFoundError(this.id, requestedItemId);
    }
    const responseHash =
      responseId !== undefined
        ? this._computeInboxResponseHash({
            kind: expectedKind,
            itemId,
            runId: pending.runId,
            pendingRequestedAt: pending.requestedAt,
            response: resumeData,
          })
        : undefined;
    const persistedResponse =
      responseId !== undefined ? assertJsonValue(resumeData, `respond[${expectedKind}].response`) : undefined;
    const existingReceipt =
      responseId !== undefined ? getOwnRecordValue(this._record.inboxResponseReceipts, responseId) : undefined;
    if (existingReceipt !== undefined) {
      this._assertMatchingInboxReceipt(existingReceipt, {
        kind: expectedKind,
        itemId,
        responseId: responseId!,
        responseHash: responseHash!,
      });
      this._throwStoredInboxResponseFailure(existingReceipt);
      if (
        responseMode === 'inbox-receipt' &&
        (pending.resumedAt === undefined || existingReceipt.status === 'applied')
      ) {
        return this._inboxReceiptResult(existingReceipt, true);
      }
      if (existingReceipt.status === 'applied' && existingReceipt.result !== undefined) {
        return existingReceipt.result as AgentResult;
      }
    }

    // Idempotency: a crash between "marked resumed" and "cleared pending"
    // surfaces here on the next call. We do not replay the agent — the prior
    // resumeStream() either landed (and cleared pending in a later flush we
    // lost) or is being completed by a sibling caller. Either way, the safe
    // move is to surface the suspended state to the caller and let them
    // re-fetch via getDisplayState / listMessages.
    if (pending.resumedAt !== undefined) {
      if (existingReceipt !== undefined && responseMode === 'inbox-receipt') {
        const recovery = await this._maybeRecoverStaleQueuedResume();
        if (recovery.status === 'completed') {
          await this._markInboxResponseApplied(existingReceipt.responseId, recovery.result);
          const receipt =
            getOwnRecordValue(this._record.inboxResponseReceipts, existingReceipt.responseId) ?? existingReceipt;
          return this._inboxReceiptResult(receipt, true);
        }
        if (recovery.status === 'stale') {
          const stale = new QueueResumeRecoveryStaleError();
          await this._markInboxResponseFailed(existingReceipt.responseId, stale);
          throw stale;
        }
        if (
          this._currentTurnAbortController === undefined &&
          this._queuedItemIdForPendingResume(pending) === undefined &&
          Date.now() >= pending.resumedAt + QUEUE_ACCEPTED_RECOVERY_STALE_MS
        ) {
          const stale = new QueueResumeRecoveryStaleError();
          await this._markInboxResponseFailedAndClearPending(existingReceipt.responseId, pending, stale);
          throw stale;
        }
        return this._inboxReceiptResult(existingReceipt, true);
      }
      const recovery = await this._maybeRecoverStaleQueuedResume();
      if (recovery.status === 'completed') {
        if (responseMode === 'inbox-receipt') {
          throw new HarnessValidationError(
            `respond[${expectedKind}]`,
            'pending resume already responded; no matching inbox response receipt exists',
          );
        }
        return recovery.result;
      }
      if (recovery.status === 'stale') {
        const stale = new QueueResumeRecoveryStaleError();
        if (responseId !== undefined) {
          await this._markInboxResponseFailed(responseId, stale);
        }
        throw stale;
      }
      if (
        this._currentTurnAbortController === undefined &&
        this._queuedItemIdForPendingResume(pending) === undefined &&
        Date.now() >= pending.resumedAt + QUEUE_ACCEPTED_RECOVERY_STALE_MS
      ) {
        const stale = new QueueResumeRecoveryStaleError();
        await this._markInboxResponseFailedAndClearPending(responseId, pending, stale);
        throw stale;
      }
      throw new HarnessValidationError(
        `respond[${expectedKind}]`,
        'pending resume already responded; awaiting agent confirmation',
      );
    }

    const pendingQueuedItemId = this._queuedItemIdForPendingResume(pending);
    if (pendingQueuedItemId !== undefined) {
      this._ensureQueuedItemContext(pendingQueuedItemId);
    }

    // For plan-approval, resolve the active-mode flip before finalizing the
    // resumed turn. Queued terminal resumes persist this flip with the
    // completed receipt so crash recovery cannot observe "completed plan
    // approval, old mode".
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

    const previousModeId = this._record.modeId;
    const resumeModeId = this._modeIdForPendingResume(pending);
    const resumeRuntimeDependencies = this._runtimeDependenciesForPendingResume(pending);
    let agent: Agent;
    try {
      agent = this._harness._resolveAgentForRuntimeDependencies(
        resumeRuntimeDependencies,
        `pending ${expectedKind} resume`,
      ).agent;
    } catch (err) {
      if (responseId !== undefined) {
        await this._recordInboxResponsePreDispatchFailure(
          {
            responseId,
            responseHash: responseHash!,
            itemId,
            queuedItemId: pendingQueuedItemId,
            kind: expectedKind,
            pending,
            response: persistedResponse,
          },
          err,
        );
      }
      throw err;
    }

    // Mark resumed under the lease BEFORE calling the agent (idempotency
    // marker per §5.4 / §5.7). On crash here, the next caller observes
    // resumedAt set and rejects rather than double-resuming.
    const resumedAt = Date.now();
    let duplicateReceiptAfterAdmission: InboxResponseReceipt | undefined;
    let pendingAlreadyResumedAfterAdmission = false;
    await this._flushUpdate(prev => {
      const currentReceipt =
        responseId !== undefined ? getOwnRecordValue(prev.inboxResponseReceipts, responseId) : undefined;
      if (currentReceipt !== undefined) {
        this._assertMatchingInboxReceipt(currentReceipt, {
          kind: expectedKind,
          itemId,
          responseId: currentReceipt.responseId,
          responseHash: responseHash!,
        });
        duplicateReceiptAfterAdmission = currentReceipt;
        return prev;
      }

      const currentPending = prev.pendingResume;
      if (
        currentPending === undefined ||
        currentPending.resumedAt !== undefined ||
        currentPending.kind !== expectedKind ||
        currentPending.runId !== pending.runId ||
        currentPending.toolCallId !== pending.toolCallId ||
        (currentPending.itemId ?? currentPending.toolCallId) !== itemId
      ) {
        pendingAlreadyResumedAfterAdmission = true;
        return prev;
      }

      const next: SessionRecord = {
        ...prev,
        pendingResume: { ...currentPending, resumedAt },
      };
      if (responseId === undefined) return next;

      next.inboxResponseReceipts = {
        ...(prev.inboxResponseReceipts ?? {}),
        [responseId]: {
          responseId,
          responseHash: responseHash!,
          resumeAttemptId: responseId,
          itemId,
          ...(pendingQueuedItemId !== undefined ? { queuedItemId: pendingQueuedItemId } : {}),
          kind: expectedKind,
          runId: pending.runId,
          toolCallId: pending.toolCallId,
          pendingRequestedAt: pending.requestedAt,
          response: persistedResponse,
          status: 'accepted',
          acceptedAt: resumedAt,
          updatedAt: resumedAt,
        } satisfies InboxResponseReceipt,
      };
      return next;
    });
    if (duplicateReceiptAfterAdmission !== undefined) {
      this._throwStoredInboxResponseFailure(duplicateReceiptAfterAdmission);
      return this._inboxReceiptResult(duplicateReceiptAfterAdmission, true);
    }
    if (pendingAlreadyResumedAfterAdmission) {
      const recovery = await this._maybeRecoverStaleQueuedResume();
      if (recovery.status === 'completed') {
        if (responseMode === 'inbox-receipt') {
          throw new HarnessValidationError(
            `respond[${expectedKind}]`,
            'pending resume already responded; no matching inbox response receipt exists',
          );
        }
        return recovery.result;
      }
      if (recovery.status === 'stale') {
        const stale = new QueueResumeRecoveryStaleError();
        if (responseId !== undefined) {
          await this._markInboxResponseFailed(responseId, stale);
        }
        throw stale;
      }
      throw new HarnessValidationError(
        `respond[${expectedKind}]`,
        'pending resume already responded; awaiting agent confirmation',
      );
    }

    // Resumed runs run under a session-owned AbortController too, so
    // `session.abort()` can cancel an in-flight resume (e.g. ESC after the
    // user approved a tool that's now grinding through a long workflow).
    const turnAbortController = this._beginTurn(undefined);
    const activeTurnWaiter = this._createActiveTurnWaiter();
    void activeTurnWaiter.promise.catch(() => {});
    const finishResumedTurn = () => {
      activeTurnWaiter.cleanup();
      this._endTurn(turnAbortController);
    };
    const assertResumedTurnNotDeleted = () => {
      if (this._state === 'deleted') {
        throw new HarnessSessionDeletedError(this.id);
      }
    };
    let full: FullOutput<unknown>;
    try {
      assertResumedTurnNotDeleted();
      const resumeStream = agent.resumeStream(resumeData, {
        runId: pending.runId,
        toolCallId: pending.toolCallId,
        abortSignal: turnAbortController.signal,
      });
      void resumeStream.catch(() => {});
      const out = await Promise.race([resumeStream, activeTurnWaiter.promise]);
      const fullOutput = out.getFullOutput() as Promise<FullOutput<unknown>>;
      void fullOutput.catch(() => {});
      full = await Promise.race([fullOutput, activeTurnWaiter.promise]);
      const resumedQueuedItemId = this._queuedItemIdForPendingResume(pending);
      if (full.finishReason !== 'suspended' && resumedQueuedItemId !== undefined) {
        await Promise.race([
          this._markQueuedTurnCompleted(resumedQueuedItemId, full, { modeId: modeFlipTarget }),
          activeTurnWaiter.promise,
        ]);
      }
    } catch (err) {
      let thrown = err;
      if (responseId !== undefined) {
        try {
          await Promise.race([this._markInboxResponseFailed(responseId, err), activeTurnWaiter.promise]);
        } catch (responseErr) {
          thrown = responseErr;
        }
      }
      finishResumedTurn();
      throw thrown;
    }

    // Clear pending + apply any remaining mode flip in a single CAS write. A
    // queued terminal resume has already persisted its completed receipt before
    // this point, so crash recovery never sees "pending cleared, queue still
    // accepted".
    const completingQueuedItemId = full.finishReason !== 'suspended' ? pendingQueuedItemId : undefined;
    try {
      if (completingQueuedItemId !== undefined) {
        if (modeFlipTarget && modeFlipTarget !== previousModeId) {
          await Promise.race([
            this._flushUpdate(prev => ({ ...prev, modeId: modeFlipTarget })),
            activeTurnWaiter.promise,
          ]);
        }
        const queuedItem = this._record.pendingQueue.find(item => item.id === completingQueuedItemId);
        if (queuedItem) {
          try {
            await Promise.race([this._markQueuedPostRunFinalized(completingQueuedItemId), activeTurnWaiter.promise]);
          } catch (err) {
            if (err instanceof HarnessSessionDeletedError) throw err;
            throw new QueuePostRunFinalizationPendingError(Date.now() + QUEUE_POST_RUN_FINALIZATION_RETRY_MS, err);
          }
        }
        this._recordTurnCompletion(full);
      } else {
        this._recordTurnCompletion(full);
      }
      const queueCompletedAt = Date.now();
      const responseAppliedAt = queueCompletedAt;
      await Promise.race([
        this._flushUpdate(prev => {
          const next: SessionRecord = { ...prev };
          delete next.pendingResume;
          const receipt =
            responseId !== undefined ? getOwnRecordValue(prev.inboxResponseReceipts, responseId) : undefined;
          if (receipt) {
            next.inboxResponseReceipts = {
              ...(prev.inboxResponseReceipts ?? {}),
              [receipt.responseId]: {
                ...receipt,
                status: 'applied',
                result: full,
                appliedAt: receipt.appliedAt ?? responseAppliedAt,
                updatedAt: responseAppliedAt,
              },
            };
          }
          if (modeFlipTarget) next.modeId = modeFlipTarget;
          if (completingQueuedItemId !== undefined) {
            next.pendingQueue = (prev.pendingQueue ?? []).filter(x => x.id !== completingQueuedItemId);
            const receipt = prev.queueAdmissionReceipts?.[completingQueuedItemId];
            if (receipt) {
              next.queueAdmissionReceipts = {
                ...(prev.queueAdmissionReceipts ?? {}),
                [completingQueuedItemId]: {
                  ...receipt,
                  status: 'completed',
                  result: full,
                  completedAt: receipt.completedAt ?? queueCompletedAt,
                  updatedAt: queueCompletedAt,
                },
              };
            }
          }
          return next;
        }),
        activeTurnWaiter.promise,
      ]);

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
      await Promise.race([
        this._maybeCaptureSuspend(full, pendingQueuedItemId, resumeModeId, resumeRuntimeDependencies.modelId),
        activeTurnWaiter.promise,
      ]);

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
        await Promise.race([this._runGoalJudge(full, wasGoalDriven), activeTurnWaiter.promise]);
        if (completingQueuedItemId !== undefined) {
          this._currentQueuedItemId = undefined;
          this._currentQueuedItemSource = undefined;
          const resolver = this._queueResolvers.get(completingQueuedItemId);
          if (resolver) {
            this._queueResolvers.delete(completingQueuedItemId);
            resolver.resolve(full as AgentResult);
          }
          this._notifyMaybeIdle();
          void this._maybeDrainQueue();
        }
      }
    } catch (err) {
      if (err instanceof QueuePostRunFinalizationPendingError && completingQueuedItemId !== undefined) {
        this._deferQueuedTurnRetry(err);
      }
      throw err;
    } finally {
      finishResumedTurn();
    }
    if (responseMode === 'inbox-receipt') {
      const receipt =
        responseId !== undefined ? getOwnRecordValue(this._record.inboxResponseReceipts, responseId) : undefined;
      if (receipt) return this._inboxReceiptResult(receipt, false);
    }
    return full as AgentResult;
  }

  private _resolveStoredInboxResponse(
    expectedKind: PendingResume['kind'],
    resumeData: unknown,
    responseOptions: InboxResponseOptions,
  ): InboxResponseResult | undefined {
    const responseId = getOwnRecordValue(responseOptions as Record<string, unknown>, 'responseId');
    if (typeof responseId !== 'string') return undefined;
    const receipt = getOwnRecordValue(this._record.inboxResponseReceipts, responseId);
    if (receipt === undefined) return undefined;
    if (receipt.kind !== expectedKind) {
      throw new HarnessInboxResponseConflictError(this.id, receipt.itemId, responseId);
    }
    const requestedItemId = getOwnRecordValue(responseOptions as Record<string, unknown>, 'itemId');
    if (requestedItemId !== undefined && typeof requestedItemId !== 'string') {
      throw new HarnessValidationError(`respond[${expectedKind}].itemId`, 'itemId must be a string');
    }
    if (requestedItemId !== undefined && receipt.itemId !== requestedItemId) {
      throw new HarnessInboxItemNotFoundError(this.id, requestedItemId);
    }
    const attemptedHash = this._computeInboxResponseHash({
      kind: expectedKind,
      itemId: receipt.itemId,
      runId: receipt.runId,
      pendingRequestedAt: receipt.pendingRequestedAt,
      response: resumeData,
    });
    if (attemptedHash !== receipt.responseHash) {
      throw new HarnessInboxResponseConflictError(this.id, receipt.itemId, responseId);
    }
    this._throwStoredInboxResponseFailure(receipt);
    return this._inboxReceiptResult(receipt, true);
  }

  private _assertMatchingInboxReceipt(
    receipt: InboxResponseReceipt,
    input: { kind: PendingResume['kind']; itemId: string; responseId: string; responseHash: string },
  ): void {
    if (receipt.kind !== input.kind || receipt.itemId !== input.itemId || receipt.responseHash !== input.responseHash) {
      throw new HarnessInboxResponseConflictError(this.id, input.itemId, input.responseId);
    }
  }

  private _inboxReceiptResult(receipt: InboxResponseReceipt, duplicate: boolean): InboxResponseResult {
    return {
      itemId: receipt.itemId,
      kind: receipt.kind,
      status: receipt.status === 'applied' ? 'applied' : 'accepted',
      responseId: receipt.responseId,
      duplicate,
    };
  }

  private _throwStoredInboxResponseFailure(receipt: InboxResponseReceipt): void {
    if (receipt.status !== 'failed' && receipt.status !== 'dead') return;
    throw publicErrorProjectionToError(
      receipt.error ?? { code: 'harness.inbox_response_failed', message: 'inbox response failed' },
    );
  }

  private async _applyInboxReceiptFromCompletedQueue(
    receipt: InboxResponseReceipt,
  ): Promise<InboxResponseReceipt | undefined> {
    if (receipt.queuedItemId === undefined) return undefined;
    const completed = this._record.queueAdmissionReceipts?.[receipt.queuedItemId];
    if (completed?.status !== 'completed' || completed.runId !== receipt.runId || completed.result === undefined) {
      return undefined;
    }
    await this._markInboxResponseApplied(receipt.responseId, completed.result as AgentResult);
    return getOwnRecordValue(this._record.inboxResponseReceipts, receipt.responseId) ?? receipt;
  }

  private async _markInboxResponseApplied(responseId: string, result: AgentResult): Promise<void> {
    const appliedAt = Date.now();
    await this._flushUpdate(prev => {
      const receipt = getOwnRecordValue(prev.inboxResponseReceipts, responseId);
      if (!receipt || receipt.status === 'applied') return prev;
      return {
        ...prev,
        inboxResponseReceipts: {
          ...(prev.inboxResponseReceipts ?? {}),
          [responseId]: {
            ...receipt,
            status: 'applied',
            result,
            appliedAt: receipt.appliedAt ?? appliedAt,
            updatedAt: appliedAt,
          },
        },
      };
    });
  }

  private async _recordInboxResponsePreDispatchFailure(
    input: {
      responseId: string;
      responseHash: string;
      itemId: string;
      queuedItemId?: string;
      kind: PendingResume['kind'];
      pending: PendingResume;
      response: unknown;
    },
    err: unknown,
  ): Promise<void> {
    const failedAt = Date.now();
    await this._flushUpdate(prev => {
      const currentReceipt = getOwnRecordValue(prev.inboxResponseReceipts, input.responseId);
      if (currentReceipt !== undefined) {
        this._assertMatchingInboxReceipt(currentReceipt, {
          kind: input.kind,
          itemId: input.itemId,
          responseId: input.responseId,
          responseHash: input.responseHash,
        });
        return prev;
      }
      return {
        ...prev,
        inboxResponseReceipts: {
          ...(prev.inboxResponseReceipts ?? {}),
          [input.responseId]: {
            responseId: input.responseId,
            responseHash: input.responseHash,
            resumeAttemptId: input.responseId,
            itemId: input.itemId,
            ...(input.queuedItemId !== undefined ? { queuedItemId: input.queuedItemId } : {}),
            kind: input.kind,
            runId: input.pending.runId,
            toolCallId: input.pending.toolCallId,
            pendingRequestedAt: input.pending.requestedAt,
            response: input.response,
            status: 'failed',
            error: projectHarnessPublicError(err),
            retryable: false,
            acceptedAt: failedAt,
            failedAt,
            updatedAt: failedAt,
          } satisfies InboxResponseReceipt,
        },
      };
    });
  }

  private async _markInboxResponseFailed(responseId: string, err: unknown): Promise<void> {
    const failedAt = Date.now();
    await this._flushUpdate(prev => {
      const receipt = getOwnRecordValue(prev.inboxResponseReceipts, responseId);
      if (!receipt || receipt.status === 'applied' || receipt.status === 'failed' || receipt.status === 'dead') {
        return prev;
      }
      return {
        ...prev,
        inboxResponseReceipts: {
          ...(prev.inboxResponseReceipts ?? {}),
          [responseId]: {
            ...receipt,
            status: 'failed',
            error: projectHarnessPublicError(err),
            retryable: false,
            failedAt: receipt.failedAt ?? failedAt,
            updatedAt: failedAt,
          },
        },
      };
    });
  }

  private async _markInboxResponseFailedAndClearPending(
    responseId: string | undefined,
    pending: PendingResume,
    err: unknown,
  ): Promise<void> {
    const failedAt = Date.now();
    await this._flushUpdate(prev => {
      const receipt = responseId !== undefined ? getOwnRecordValue(prev.inboxResponseReceipts, responseId) : undefined;
      const current = prev.pendingResume;
      const currentItemId = current ? (current.itemId ?? current.toolCallId) : undefined;
      const pendingItemId = pending.itemId ?? pending.toolCallId;
      const canClearPending =
        current !== undefined &&
        current.runId === pending.runId &&
        current.toolCallId === pending.toolCallId &&
        currentItemId === pendingItemId &&
        current.resumedAt === pending.resumedAt &&
        current.queuedItemId === undefined;

      if (
        (!receipt || receipt.status === 'applied' || receipt.status === 'failed' || receipt.status === 'dead') &&
        !canClearPending
      ) {
        return prev;
      }

      const next: SessionRecord = { ...prev };
      if (receipt && receipt.status !== 'applied' && receipt.status !== 'failed' && receipt.status !== 'dead') {
        next.inboxResponseReceipts = {
          ...(prev.inboxResponseReceipts ?? {}),
          [receipt.responseId]: {
            ...receipt,
            status: 'failed',
            error: projectHarnessPublicError(err),
            retryable: false,
            failedAt: receipt.failedAt ?? failedAt,
            updatedAt: failedAt,
          },
        };
      }
      if (canClearPending) {
        delete next.pendingResume;
      }
      return next;
    });
  }

  private _computeInboxResponseHash(input: {
    kind: PendingResume['kind'];
    itemId: string;
    runId: string;
    pendingRequestedAt: number;
    response: unknown;
  }): string {
    return sha256CanonicalJson(input);
  }

  private _queuedItemIdForPendingResume(pending: PendingResume): string | undefined {
    if (pending.queuedItemId !== undefined) return pending.queuedItemId;
    if (this._currentQueuedItemId !== undefined) return this._currentQueuedItemId;
    return (this._record.pendingQueue ?? []).find(item => {
      const receipt = this._record.queueAdmissionReceipts?.[item.id];
      return (receipt?.status === 'accepted' || receipt?.status === 'completed') && receipt.runId === pending.runId;
    })?.id;
  }

  private _modeIdForPendingResume(pending: PendingResume): string {
    const queuedItemId = this._queuedItemIdForPendingResume(pending);
    const queuedItem = queuedItemId ? this._record.pendingQueue.find(item => item.id === queuedItemId) : undefined;
    const receipt = queuedItemId ? this._record.queueAdmissionReceipts?.[queuedItemId] : undefined;
    return pending.modeId ?? receipt?.modeId ?? queuedItem?.mode ?? this._record.modeId;
  }

  private _modelIdForQueuedItem(queuedItemId: string | undefined): string {
    const queuedItem = queuedItemId ? this._record.pendingQueue.find(item => item.id === queuedItemId) : undefined;
    const receipt = queuedItemId ? this._record.queueAdmissionReceipts?.[queuedItemId] : undefined;
    return queuedItem?.model ?? receipt?.runtimeDependencies?.modelId ?? this._record.modelId;
  }

  private _runtimeDependenciesForPendingResume(pending: PendingResume): HarnessRuntimeDependencyRefs {
    const queuedItemId = this._queuedItemIdForPendingResume(pending);
    const queuedItem = queuedItemId ? this._record.pendingQueue.find(item => item.id === queuedItemId) : undefined;
    const receipt = queuedItemId ? this._record.queueAdmissionReceipts?.[queuedItemId] : undefined;
    const modeId = this._modeIdForPendingResume(pending);
    const modelId = queuedItem?.model ?? this._record.modelId;
    return pending.runtimeDependencies ?? receipt?.runtimeDependencies ?? { modeId, ...(modelId ? { modelId } : {}) };
  }

  private async _maybeRecoverStaleQueuedResume(): Promise<QueueResumeRecoveryResult> {
    if (this._currentTurnAbortController !== undefined) return { status: 'none' };
    const pending = this._record.pendingResume;
    if (pending?.resumedAt === undefined) return { status: 'none' };
    const queuedItemId = this._queuedItemIdForPendingResume(pending);
    if (queuedItemId === undefined) return { status: 'none' };
    if (!this._queueResolvers.has(queuedItemId)) {
      this._emitQueueItemReplayedOnce(queuedItemId);
    }
    this._ensureQueuedItemContext(queuedItemId);

    const currentReceipt = this._record.queueAdmissionReceipts?.[queuedItemId];
    if (currentReceipt?.status === 'completed') {
      const queuedItem = this._record.pendingQueue.find(item => item.id === queuedItemId);
      const shouldRunPostRunSideEffects = queuedItem !== undefined && currentReceipt.postRunFinalizedAt === undefined;
      if (shouldRunPostRunSideEffects) {
        try {
          await this._markQueuedPostRunFinalized(queuedItemId);
        } catch (err) {
          this._deferQueuedTurnRetry(
            new QueuePostRunFinalizationPendingError(Date.now() + QUEUE_POST_RUN_FINALIZATION_RETRY_MS, err),
          );
          return { status: 'none' };
        }
      }
      await this._flushUpdate(prev => {
        const current = prev.pendingResume;
        if (
          !current ||
          current.runId !== pending.runId ||
          current.toolCallId !== pending.toolCallId ||
          current.resumedAt !== pending.resumedAt
        ) {
          return prev;
        }
        const next: SessionRecord = {
          ...prev,
          pendingQueue: (prev.pendingQueue ?? []).filter(item => item.id !== queuedItemId),
        };
        delete next.pendingResume;
        return next;
      });
      if (shouldRunPostRunSideEffects && queuedItem) {
        await this._finalizeQueuedRunCompletion(
          queuedItem,
          currentReceipt.result as FullOutput<unknown>,
          pending.modeId ?? currentReceipt.modeId ?? queuedItem.mode ?? this._record.modeId,
        );
      }
      this._currentQueuedItemId = undefined;
      this._currentQueuedItemSource = undefined;
      const resolver = this._queueResolvers.get(queuedItemId);
      if (resolver) {
        this._queueResolvers.delete(queuedItemId);
        resolver.resolve(currentReceipt.result as AgentResult);
      }
      this._notifyMaybeIdle();
      void this._maybeDrainQueue();
      return { status: 'completed', result: currentReceipt.result as AgentResult };
    }

    const retryAt = pending.resumedAt + QUEUE_ACCEPTED_RECOVERY_STALE_MS;
    if (Date.now() < retryAt) {
      if (this._queuedResumeRecoveryTimer === undefined) {
        const delayMs = Math.max(0, retryAt - Date.now());
        this._queuedResumeRecoveryTimer = setTimeout(() => {
          this._queuedResumeRecoveryTimer = undefined;
          void this._maybeDrainQueue();
        }, delayMs);
        this._queuedResumeRecoveryTimer.unref?.();
      }
      return { status: 'none' };
    }

    if (this._queuedResumeRecoveryTimer !== undefined) {
      clearTimeout(this._queuedResumeRecoveryTimer);
      this._queuedResumeRecoveryTimer = undefined;
    }

    const err = new QueueResumeRecoveryStaleError();
    const now = Date.now();
    await this._flushUpdate(prev => {
      const current = prev.pendingResume;
      if (
        !current ||
        current.runId !== pending.runId ||
        current.toolCallId !== pending.toolCallId ||
        current.resumedAt !== pending.resumedAt
      ) {
        return prev;
      }
      const receipt = prev.queueAdmissionReceipts?.[queuedItemId];
      const next: SessionRecord = {
        ...prev,
        pendingQueue: (prev.pendingQueue ?? []).filter(item => item.id !== queuedItemId),
      };
      delete next.pendingResume;
      if (receipt) {
        if (receipt.status === 'completed') {
          return next;
        }
        next.queueAdmissionReceipts = {
          ...(prev.queueAdmissionReceipts ?? {}),
          [queuedItemId]: {
            ...receipt,
            status: 'failed',
            error: projectHarnessPublicError(err),
            failedAt: receipt.failedAt ?? now,
            updatedAt: now,
          },
        };
      }
      return next;
    });

    const current = this._record.pendingResume;
    if (
      current?.runId === pending.runId &&
      current.toolCallId === pending.toolCallId &&
      current.resumedAt === pending.resumedAt
    ) {
      return { status: 'none' };
    }

    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    const resolver = this._queueResolvers.get(queuedItemId);
    if (resolver) {
      this._queueResolvers.delete(queuedItemId);
      resolver.reject(err);
    }
    this._notifyMaybeIdle();
    return { status: 'stale' };
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
  //      by dispatching a deterministic `agent.sendSignal()` turn (so
  //      `agent_start`, `message_*`, `tool_*`, `suspension_*`, `agent_end`
  //      all flow with `queuedItemId` stamped automatically by
  //      `_emitTurnEvent`).
  //   3. If the turn suspends, the head item stays in `pendingQueue` and
  //      `_currentQueuedItemId` stays set. The next `respondTo*` call calls
  //      into `_resume`; on terminal completion the resume path settles the
  //      resolver + removes the head + kicks drain again.
  //   4. If the turn completes without suspending, the queue receipt,
  //      signal-result evidence, resolver, and head item settle together.
  //
  // Promise resolution: the eventual `AgentResult` once the turn fully ends
  // (including any suspend → resume cycles). Rejection surfaces admission
  // conflicts, queued-run failures, stale accepted recovery, or expired
  // duplicate-result evidence.
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
    const admission = await this._admitQueue(opts, 'queue()');
    if (admission.duplicate) {
      return this._withActiveDeletedWaiter(activeDeleted =>
        this._raceActiveTurnWaiter(this._returnDuplicateQueueResult(admission.evidence, activeDeleted), activeDeleted),
      );
    }

    const queued = createDeferred<AgentResult>();
    const promise = queued.promise;
    this._queueResolvers.set(admission.queuedItemId, { promise, resolve: queued.resolve, reject: queued.reject });
    // Kick the drain — fire-and-forget. Drain handles its own errors and
    // settles the resolver via `_completeQueuedTurn` / `_failQueuedTurn`.
    void this._maybeDrainQueue();
    void promise.catch(() => {});
    return promise;
  }

  /**
   * Admit a queued turn without awaiting its eventual AgentResult. This is the
   * remote-route counterpart to `queue(...)`; SDK promises settle from
   * session events or result lookup routes.
   */
  async admitQueue(opts: QueueOptions): Promise<QueueAdmissionResult> {
    if (opts.admissionId === undefined || opts.admissionId.length === 0) {
      throw new HarnessValidationError('admitQueue().admissionId', 'admissionId must be a non-empty string');
    }
    const admission = await this._admitQueue(opts, 'admitQueue()');
    if (!admission.duplicate) {
      this._liveAdmittedQueuedItemIds.add(admission.queuedItemId);
    }
    void this._maybeDrainQueue();
    return { accepted: true, queuedItemId: admission.queuedItemId, duplicate: admission.duplicate };
  }

  private async _admitQueue(
    opts: QueueOptions,
    methodName: 'queue()' | 'admitQueue()',
    internal?: {
      persistedAttachments?: PersistedAttachment[];
      persistedRequestContext?: PersistedRequestContextInput;
      expectedAdmissionHash?: string;
    },
  ): Promise<{
    queuedItemId: string;
    evidence: QueueAdmissionReceipt | OperationAdmissionTombstone;
    duplicate: boolean;
  }> {
    this._assertLive(methodName);
    if (typeof opts.content !== 'string' || opts.content.length === 0) {
      throw new HarnessValidationError(`${methodName}.content`, 'must be a non-empty string');
    }
    if (opts.mode !== undefined) {
      // Validates and throws on unknown id.
      this._harness._getMode(opts.mode);
    }
    if (opts.admissionId !== undefined && opts.admissionId.length === 0) {
      throw new HarnessValidationError(`${methodName}.admissionId`, 'admissionId must be a non-empty string');
    }

    const attachments =
      internal?.persistedAttachments ??
      (await this._resolveAttachmentRefs(`${methodName}.attachments`, opts.attachments ?? []));
    if (internal?.persistedAttachments) {
      this._validatePersistedAttachments(`${methodName}.attachments`, attachments);
    }
    const effectiveModeId = opts.mode ?? this._record.modeId;
    const admissionId = opts.admissionId ?? `queue-${randomUUID()}`;
    const admissionHash = this._computeQueueAdmissionHash(opts, attachments, internal?.persistedRequestContext);
    if (internal?.expectedAdmissionHash !== undefined && internal.expectedAdmissionHash !== admissionHash) {
      throw new HarnessAdmissionConflictError(this.id, admissionId, internal.expectedAdmissionHash, admissionHash);
    }
    const duplicate = opts.admissionId
      ? await this._resolveQueueAdmissionDuplicate({ admissionId, admissionHash })
      : undefined;
    if (duplicate) {
      this._assertOpenForTurn(methodName);
      const queuedItemId = duplicate.queuedItemId;
      if (queuedItemId === undefined) {
        throw new HarnessValidationError(`${methodName}.admissionId`, 'duplicate queue result evidence has expired');
      }
      return { queuedItemId, evidence: duplicate, duplicate: true };
    }

    const cap = this._harness._internalMaxQueueDepth;
    if ((this._record.pendingQueue?.length ?? 0) >= cap) {
      throw new HarnessQueueFullError(this.id, cap);
    }
    const queuedItemId = this._queueAdmissionQueuedItemId(admissionId);
    const item: QueuedItem = {
      id: queuedItemId,
      admissionId,
      admissionHash,
      enqueuedAt: Date.now(),
      content: opts.content,
      attachments,
      ...(internal?.persistedRequestContext
        ? { requestContext: clonePersistedRequestContext(internal.persistedRequestContext) }
        : {}),
      ...(opts.model !== undefined ? { model: opts.model } : {}),
      mode: effectiveModeId,
      ...(opts.yolo !== undefined ? { yolo: opts.yolo } : {}),
    };
    const attachmentReferences = attachments
      .filter((attachment): attachment is Extract<PersistedAttachment, { kind: 'ref' }> => attachment.kind === 'ref')
      .map(attachment => ({
        harnessName: this._record.harnessName,
        sessionId: attachment.ownerSessionId,
        attachmentId: attachment.attachmentId,
        source: 'queued_item' as const,
        sourceId: item.id,
      }));
    let admittedReceipt: QueueAdmissionReceipt | undefined;
    const receipt: QueueAdmissionReceipt = {
      admissionId,
      admissionHash,
      queuedItemId: item.id,
      modeId: effectiveModeId,
      runtimeDependencies: this._harness._runtimeDependenciesForMode(
        effectiveModeId,
        item.model ?? this._record.modelId,
      ),
      status: 'queued',
      attempts: 0,
      enqueuedAt: item.enqueuedAt,
      updatedAt: item.enqueuedAt,
    };

    try {
      // Atomic check + append: re-check capacity inside the updater so a
      // concurrent in-process `queue()` cannot push us past the cap. Exact
      // admission retries are resolved here too so they do not append or
      // consume queue capacity even when racing the original admission.
      await this._flushUpdate(
        prev => {
          for (const existing of Object.values(prev.queueAdmissionReceipts ?? {})) {
            if (existing.admissionId !== admissionId) continue;
            if (existing.admissionHash !== admissionHash) {
              throw new HarnessAdmissionConflictError(this.id, admissionId, existing.admissionHash, admissionHash);
            }
            admittedReceipt = existing;
            return prev;
          }
          if (prev.closingAt !== undefined || this.isClosing) {
            throw new HarnessSessionClosingError(this.id);
          }
          if ((prev.pendingQueue?.length ?? 0) >= cap) {
            throw new HarnessQueueFullError(this.id, cap);
          }
          return {
            ...prev,
            pendingQueue: [...(prev.pendingQueue ?? []), item],
            queueAdmissionReceipts: {
              ...(prev.queueAdmissionReceipts ?? {}),
              [item.id]: receipt,
            },
          };
        },
        { attachmentReferences },
      );
    } catch (err) {
      if (isStorageAttachmentUnavailableError(err)) {
        throw new HarnessAttachmentUnavailableError(err.sessionId, 'not_found', err.attachmentId);
      }
      throw err;
    }

    if (admittedReceipt) {
      this._assertOpenForTurn(methodName);
      return { queuedItemId: admittedReceipt.queuedItemId, evidence: admittedReceipt, duplicate: true };
    }

    return { queuedItemId: item.id, evidence: receipt, duplicate: false };
  }

  /**
   * @internal
   * Worker-only admission for durable wakeups. Wakeup rows already carry
   * persisted attachment/request-context records, so this path must not
   * reinterpret them as caller-provided attachment refs or route request
   * context through public queue options.
   */
  async _admitWakeupQueue(item: {
    content: string;
    admissionId: string;
    admissionHash?: string;
    mode?: string;
    model?: string;
    yolo?: boolean;
    attachments: PersistedAttachment[];
    requestContext?: PersistedRequestContextInput;
  }): Promise<QueueAdmissionResult> {
    const admission = await this._admitQueue(
      {
        content: item.content,
        admissionId: item.admissionId,
        ...(item.mode !== undefined ? { mode: item.mode } : {}),
        ...(item.model !== undefined ? { model: item.model } : {}),
        ...(item.yolo === true ? { yolo: true } : {}),
      },
      'admitQueue()',
      {
        persistedAttachments: item.attachments.map(clonePersistedAttachment),
        ...(item.requestContext ? { persistedRequestContext: clonePersistedRequestContext(item.requestContext) } : {}),
        ...(item.admissionHash ? { expectedAdmissionHash: item.admissionHash } : {}),
      },
    );
    if (!admission.duplicate) {
      this._liveAdmittedQueuedItemIds.add(admission.queuedItemId);
    }
    void this._maybeDrainQueue();
    return { accepted: true, queuedItemId: admission.queuedItemId, duplicate: admission.duplicate };
  }

  private async _resolveQueueAdmissionDuplicate({
    admissionId,
    admissionHash,
  }: {
    admissionId: string;
    admissionHash: string;
  }): Promise<QueueAdmissionReceipt | OperationAdmissionTombstone | undefined> {
    const resolved = await this._storage.resolveOperationAdmissionEvidence({
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      kind: 'queue',
      admissionId,
      attemptedAdmissionHash: admissionHash,
    });
    if (resolved.status === 'none') return undefined;
    if (resolved.status === 'conflict') {
      throw new HarnessAdmissionConflictError(this.id, admissionId, resolved.storedAdmissionHash ?? '', admissionHash);
    }
    return resolved.evidence as QueueAdmissionReceipt | OperationAdmissionTombstone | undefined;
  }

  private async _returnDuplicateQueueResult(
    evidence: QueueAdmissionReceipt | OperationAdmissionTombstone,
    activeDeleted?: Promise<never>,
  ): Promise<AgentResult> {
    if ('kind' in evidence) {
      throw new HarnessValidationError('queue().admissionId', 'duplicate queue result evidence has expired');
    }
    if (evidence.status === 'completed' && evidence.postRunFinalizedAt !== undefined) {
      return evidence.result as AgentResult;
    }
    if (evidence.status === 'failed' || evidence.status === 'admission_failed') {
      throw publicErrorProjectionToError(
        evidence.error ?? { code: 'harness.queue_failed', message: 'queued turn failed' },
      );
    }
    if (evidence.status === 'dead') {
      throw publicErrorProjectionToError(
        evidence.error ?? { code: 'harness.queue_exhausted', message: 'queued turn exhausted retry attempts' },
      );
    }
    const resolver = this._queueResolvers.get(evidence.queuedItemId);
    if (resolver) return this._raceActiveTurnWaiter(resolver.promise, activeDeleted);
    void this._maybeDrainQueue();
    return this._awaitDurableQueueResult(evidence, activeDeleted);
  }

  private async _awaitDurableQueueResult(
    receipt: QueueAdmissionReceipt,
    activeDeleted?: Promise<never>,
  ): Promise<AgentResult> {
    const deadline = Date.now() + MESSAGE_ADMISSION_DURABLE_WAIT_TIMEOUT_MS;
    while (true) {
      this._assertNotDeleted();
      const latest = await this._raceActiveTurnWaiter(
        this._storage.loadQueueResultEvidence({
          harnessName: this._record.harnessName,
          sessionId: this.id,
          resourceId: this.resourceId,
          queuedItemId: receipt.queuedItemId,
        }),
        activeDeleted,
      );
      this._assertNotDeleted();
      if (!latest) {
        throw new HarnessValidationError('queue().admissionId', 'duplicate queue result evidence has expired');
      }
      if ('kind' in latest) {
        throw new HarnessValidationError('queue().admissionId', 'duplicate queue result evidence has expired');
      }
      if (latest.status === 'completed' && latest.postRunFinalizedAt !== undefined) return latest.result as AgentResult;
      if (latest.status === 'failed' || latest.status === 'admission_failed') {
        throw publicErrorProjectionToError(
          latest.error ?? { code: 'harness.queue_failed', message: 'queued turn failed' },
        );
      }
      if (latest.status === 'dead') {
        throw publicErrorProjectionToError(
          latest.error ?? { code: 'harness.queue_exhausted', message: 'queued turn exhausted retry attempts' },
        );
      }
      const waitMs = Math.min(MESSAGE_ADMISSION_DURABLE_WAIT_INTERVAL_MS, Math.max(0, deadline - Date.now()));
      if (waitMs === 0) {
        throw new HarnessValidationError('queue().admissionId', 'duplicate queue result evidence has expired');
      }
      await this._raceActiveTurnWaiter(delay(waitMs), activeDeleted);
    }
  }

  private _queueAdmissionQueuedItemId(admissionId: string): string {
    const digest = sha256CanonicalJson({
      kind: 'queue-admission',
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      admissionId,
    });
    return `q-${digest.slice(0, 32)}`;
  }

  private _queueSignalIdentity(item: QueuedItem): MessageAdmissionIdentity {
    const digest = sha256CanonicalJson({
      kind: 'queue-signal',
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      queuedItemId: item.id,
      admissionId: item.admissionId,
    });
    return {
      signalId: `harness-queue-${digest.slice(0, 32)}`,
      runId: `harness-queue-${digest.slice(32, 64)}`,
    };
  }

  private _computeQueueAdmissionHash(
    opts: QueueOptions,
    attachments: PersistedAttachment[],
    requestContext?: PersistedRequestContextInput,
  ): string {
    return sha256CanonicalJson({
      kind: 'queue',
      content: opts.content,
      ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
      ...(opts.model !== undefined ? { model: opts.model } : {}),
      ...(opts.yolo === true ? { yolo: true } : {}),
      attachments: attachments.map(attachment => ({
        kind: attachment.kind,
        name: attachment.name,
        mimeType: attachment.mimeType,
        ...(attachment.kind === 'ref'
          ? {
              attachmentId: attachment.attachmentId,
              resourceId: this.resourceId,
              ownerSessionId: attachment.ownerSessionId,
              bytes: attachment.bytes,
              sha256: attachment.sha256,
              source: attachment.source,
              attachmentKind: attachment.attachmentKind ?? 'file',
              ...(attachment.primitiveType ? { primitiveType: attachment.primitiveType } : {}),
              ...(attachment.elementType ? { elementType: attachment.elementType } : {}),
              ...(attachment.renderer ? { renderer: attachment.renderer } : {}),
              ...(attachment.schemaId ? { schemaId: attachment.schemaId } : {}),
              ...(attachment.metadata ? { metadata: cloneAttachmentMetadata(attachment.metadata) } : {}),
              ...(attachment.object ? { object: attachment.object } : {}),
            }
          : { url: attachment.url }),
      })),
      ...(requestContext ? { requestContext: clonePersistedRequestContext(requestContext) } : {}),
    });
  }

  private async _updateQueueAdmissionReceipt(
    queuedItemId: string,
    update: (receipt: QueueAdmissionReceipt, now: number) => QueueAdmissionReceipt,
  ): Promise<void> {
    await this._flushUpdate(prev => {
      const current = prev.queueAdmissionReceipts?.[queuedItemId];
      if (!current) return prev;
      const now = Date.now();
      return {
        ...prev,
        queueAdmissionReceipts: {
          ...(prev.queueAdmissionReceipts ?? {}),
          [queuedItemId]: update(current, now),
        },
      };
    });
  }

  private async _resolveAttachmentRefs(field: string, refs: AttachmentRef[]): Promise<PersistedAttachment[]> {
    const attachments: PersistedAttachment[] = [];
    for (let i = 0; i < refs.length; i += 1) {
      const ref = refs[i]!;
      const ownerSessionId = ref.ownerSessionId ?? this.id;
      if (ownerSessionId !== this.id) {
        throw new HarnessValidationError(`${field}[${i}].ownerSessionId`, 'attachment must belong to this session');
      }
      const record = await this._storage.getAttachmentRecord({
        harnessName: this._record.harnessName,
        sessionId: this.id,
        attachmentId: ref.attachmentId,
      });
      if (!record) {
        throw new HarnessAttachmentUnavailableError(this.id, 'not_found', ref.attachmentId);
      }
      if (ref.bytes !== undefined && ref.bytes !== record.bytes) {
        throw new HarnessValidationError(`${field}[${i}].bytes`, 'attachment byte count does not match storage');
      }
      if (ref.sha256 !== undefined && ref.sha256 !== record.sha256) {
        throw new HarnessValidationError(`${field}[${i}].sha256`, 'attachment digest does not match storage');
      }
      attachments.push({
        kind: 'ref',
        name: record.name,
        mimeType: record.mimeType,
        ownerSessionId: record.ownerSessionId,
        attachmentId: record.attachmentId,
        bytes: record.bytes,
        sha256: record.sha256,
        source: record.source,
        attachmentKind: record.kind ?? 'file',
        ...(record.primitiveType ? { primitiveType: record.primitiveType } : {}),
        ...(record.elementType ? { elementType: record.elementType } : {}),
        ...(record.renderer ? { renderer: { ...record.renderer } } : {}),
        ...(record.schemaId ? { schemaId: record.schemaId } : {}),
        ...(record.metadata ? { metadata: cloneAttachmentMetadata(record.metadata) } : {}),
        ...(record.object ? { object: { ...record.object } } : {}),
      });
    }
    return attachments;
  }

  private _validatePersistedAttachments(field: string, attachments: PersistedAttachment[]): void {
    for (let i = 0; i < attachments.length; i += 1) {
      const attachment = attachments[i]!;
      if (attachment.kind !== 'ref') continue;
      if (attachment.ownerSessionId !== this.id) {
        throw new HarnessValidationError(`${field}[${i}].ownerSessionId`, 'attachment must belong to this session');
      }
    }
  }

  /**
   * Drain pending queue items head-of-line. No-op while another drain is
   * running, the session is suspended (`pendingResume` set), or the queue
   * is empty. Each item runs as a fresh turn; if the turn suspends, drain
   * exits early and resumes from `_resume()` once the user responds.
   */
  private async _maybeDrainQueue(): Promise<void> {
    if (this._draining) return;
    if (!this._canDrainQueue()) return;
    // A live suspension means a previous queued turn is awaiting a
    // `respondTo*` call — drain stays parked until that resolves.
    if (this._record.pendingResume !== undefined) {
      const recovery = await this._maybeRecoverStaleQueuedResume();
      if (recovery.status === 'none') return;
    }
    if (this._currentQueuedItemId !== undefined) return;
    // A manual `message()` turn is in flight — wait for it to settle.
    // `_recordTurnCompletion` will re-kick the drain on its way out.
    if (this._currentTurnAbortController !== undefined) return;

    this._draining = true;
    try {
      while (this._canDrainQueue() && (this._record.pendingQueue?.length ?? 0) > 0) {
        // Bail if a previous iteration left the session suspended.
        if (this._record.pendingResume !== undefined) return;

        const head = this._record.pendingQueue?.[0];
        if (!head) return;
        this._currentQueuedItemId = head.id;
        this._currentQueuedItemSource = head.source ?? 'user';
        const isLiveAdmission = this._queueResolvers.has(head.id) || this._liveAdmittedQueuedItemIds.delete(head.id);
        const isReplay = !isLiveAdmission;
        if (isReplay) {
          this._emitQueueItemReplayedOnce(head.id);
        } else {
          this._emitter.emit({ type: 'queue_item_started', queuedItemId: head.id });
        }

        let suspended = false;
        try {
          const full = await this._runQueuedTurn(head);
          suspended = full.finishReason === 'suspended';
          if (!suspended) {
            await this._completeQueuedTurn(head.id, full as AgentResult);
          }
        } catch (err) {
          if (err instanceof QueueRecoveryPendingError) {
            this._parkQueuedTurn(head.id, err);
            return;
          }
          if (err instanceof QueuePostRunFinalizationPendingError) {
            this._deferQueuedTurnRetry(err);
            return;
          }
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
    await this._validateQueuedAttachmentRefs(item);
    const currentReceipt = this._record.queueAdmissionReceipts?.[item.id];
    const effectiveModeId = currentReceipt?.modeId ?? item.mode ?? this._record.modeId;
    const identity = this._queueSignalIdentity(item);
    let shouldMarkAdmitting = true;
    if (currentReceipt) {
      if (currentReceipt.status === 'completed') {
        const full = currentReceipt.result as FullOutput<unknown>;
        if (currentReceipt.postRunFinalizedAt === undefined) {
          await this._finalizeCompletedQueuedTurn(item, full, effectiveModeId);
        }
        return full;
      }
      if (currentReceipt.status === 'failed' || currentReceipt.status === 'admission_failed') {
        throw publicErrorProjectionToError(
          currentReceipt.error ?? { code: 'harness.queue_failed', message: 'queued turn failed' },
        );
      }
      if (currentReceipt.status === 'dead') {
        throw publicErrorProjectionToError(
          currentReceipt.error ?? {
            code: 'harness.queue_exhausted',
            message: 'queued turn exhausted retry attempts',
          },
        );
      }
    }
    if (
      currentReceipt &&
      (currentReceipt.status === 'admitting' || currentReceipt.status === 'accepted') &&
      currentReceipt.runId &&
      currentReceipt.signalId
    ) {
      const recoveredTerminal = await this._withActiveDeletedWaiter(activeDeleted =>
        this._recoverQueuedTerminalEvidence(item, currentReceipt, effectiveModeId, activeDeleted),
      );
      if (recoveredTerminal) return recoveredTerminal;
    }
    const runtimeDependencies = this._runtimeDependenciesForQueuedTurn(item, currentReceipt, effectiveModeId);
    const { mode, agent } = this._harness._resolveAgentForRuntimeDependencies(
      runtimeDependencies,
      `queued item "${item.id}" recovery`,
    );
    if (
      currentReceipt &&
      (currentReceipt.status === 'admitting' || currentReceipt.status === 'accepted') &&
      currentReceipt.runId &&
      currentReceipt.signalId
    ) {
      const recovered = await this._recoverQueuedDispatch(item, currentReceipt, agent, effectiveModeId);
      if (recovered) return recovered;
    }
    if (shouldMarkAdmitting) {
      await this._updateQueueAdmissionReceipt(item.id, (receipt, now) => ({
        ...receipt,
        status: 'admitting',
        runId: identity.runId,
        signalId: identity.signalId,
        modeId: receipt.modeId ?? effectiveModeId,
        attempts: receipt.attempts + 1,
        admittingAt: receipt.admittingAt ?? now,
        updatedAt: now,
      }));
    }

    const toolsets = this._buildToolsets(mode);
    // Queued turns run under a session-owned AbortController so
    // `session.abort()` can cancel an in-flight queued run too.
    const turnAbortController = this._beginTurn(undefined);
    const activeTurnWaiter = this._createActiveTurnWaiter();
    void activeTurnWaiter.promise.catch(() => {});
    const finishQueuedTurn = () => {
      activeTurnWaiter.cleanup();
      this._endTurn(turnAbortController);
    };
    const assertQueuedTurnNotDeleted = () => {
      if (this._state === 'deleted') {
        throw new HarnessSessionDeletedError(this.id);
      }
    };

    try {
      const requestContext = await Promise.race([
        this._buildRequestContext({
          modeId: effectiveModeId,
          modelId: this._modelIdForQueuedItem(item.id),
          abortSignal: turnAbortController.signal,
          persistedRequestContext: item.requestContext,
        }),
        activeTurnWaiter.promise,
      ]);
      assertQueuedTurnNotDeleted();
      const baseExecOptions: AgentExecutionOptionsBase<unknown> = {
        memory: { thread: this.threadId, resource: this.resourceId },
        abortSignal: turnAbortController.signal,
        requestContext,
        ...(toolsets ? { toolsets } : {}),
        ...(mode.instructions ? { instructions: mode.instructions } : {}),
      };

      this._emitTurnEvent({ type: 'agent_start' });

      await Promise.race([this._ensureThreadSubscription(agent), activeTurnWaiter.promise]);
      assertQueuedTurnNotDeleted();
      await Promise.race([
        this._writeQueueSignalResultEvidence({
          status: 'pending',
          signalId: identity.signalId,
          runId: identity.runId,
        }),
        activeTurnWaiter.promise,
      ]);
      assertQueuedTurnNotDeleted();
      const signal = agent.sendSignal(
        { id: identity.signalId, type: 'user-message', contents: item.content as never },
        {
          runId: identity.runId,
          resourceId: this.resourceId,
          threadId: this.threadId,
          ifIdle: { behavior: 'wake', streamOptions: baseExecOptions as never },
        },
      );
      const signalIdentity =
        signal.runId === identity.runId && signal.signal.id === identity.signalId
          ? identity
          : { runId: signal.runId, signalId: signal.signal.id };
      const completion = this._awaitQueuedRunCompletion(
        item,
        signalIdentity.runId,
        signalIdentity.signalId,
        effectiveModeId,
        activeTurnWaiter.promise,
      );
      void completion.catch(() => {});
      if (signalIdentity !== identity) {
        await Promise.race([
          this._writeQueueSignalResultEvidence({
            status: 'pending',
            signalId: signalIdentity.signalId,
            runId: signalIdentity.runId,
          }),
          activeTurnWaiter.promise,
        ]);
      }
      await Promise.race([
        this._updateQueueAdmissionReceipt(item.id, (receipt, now) => ({
          ...receipt,
          status: 'accepted',
          runId: signalIdentity.runId,
          signalId: signalIdentity.signalId,
          modeId: receipt.modeId ?? effectiveModeId,
          acceptedAt: receipt.acceptedAt ?? now,
          updatedAt: now,
        })).catch(() => {}),
        activeTurnWaiter.promise,
      ]);
      return await Promise.race([completion, activeTurnWaiter.promise]);
    } finally {
      finishQueuedTurn();
    }
  }

  private _runtimeDependenciesForQueuedTurn(
    item: QueuedItem,
    receipt: QueueAdmissionReceipt | undefined,
    modeId: string,
  ): HarnessRuntimeDependencyRefs {
    const modelId = item.model ?? this._record.modelId;
    return receipt?.runtimeDependencies ?? { modeId, ...(modelId ? { modelId } : {}) };
  }

  private async _recoverQueuedDispatch(
    item: QueuedItem,
    receipt: QueueAdmissionReceipt,
    agent: Agent,
    modeId: string,
  ): Promise<FullOutput<unknown> | undefined> {
    if (!receipt.runId || !receipt.signalId) return undefined;

    return this._withActiveDeletedWaiter(async activeDeleted => {
      await this._raceActiveTurnWaiter(this._ensureThreadSubscription(agent), activeDeleted);
      if (this._hasLiveMessageRun(agent, receipt.runId!)) {
        return this._awaitQueuedRunCompletion(item, receipt.runId!, receipt.signalId!, modeId, activeDeleted);
      }

      const terminalEvidence = await this._recoverQueuedTerminalEvidence(item, receipt, modeId, activeDeleted);
      if (terminalEvidence) return terminalEvidence;

      const recovery = await this._raceActiveTurnWaiter(this._inspectQueueReceiptMemory(receipt), activeDeleted);
      if (recovery.status === 'pending') {
        const dispatchAt = receipt.acceptedAt ?? receipt.admittingAt ?? receipt.updatedAt;
        const retryAt = dispatchAt + QUEUE_ACCEPTED_RECOVERY_STALE_MS;
        if (Date.now() >= retryAt) throw new QueueRecoveryStaleError();
        throw new QueueRecoveryPendingError(retryAt);
      }

      return undefined;
    });
  }

  private async _recoverQueuedTerminalEvidence(
    item: QueuedItem,
    receipt: QueueAdmissionReceipt,
    modeId: string,
    activeTurnWaiter?: Promise<never>,
  ): Promise<FullOutput<unknown> | undefined> {
    if (!receipt.runId || !receipt.signalId) return undefined;

    const evidence = await this._raceActiveTurnWaiter(this._loadQueueSignalResultEvidence(receipt), activeTurnWaiter);
    if (evidence.status === 'completed') {
      const full = evidence.result as FullOutput<unknown>;
      await this._raceActiveTurnWaiter(this._markQueuedTurnCompleted(item.id, full), activeTurnWaiter);
      if (receipt.postRunFinalizedAt === undefined) {
        await this._finalizeCompletedQueuedTurn(item, full, modeId, activeTurnWaiter);
      }
      return full;
    }
    if (evidence.status === 'failed') {
      throw publicErrorProjectionToError(
        evidence.error ?? { code: 'harness.queue_failed', message: 'queued turn failed' },
      );
    }

    return undefined;
  }

  private _queueReceiptTerminalFailureError(queuedItemId: string): Error | undefined {
    return this._queueReceiptTerminalFailureErrorFromReceipt(this._record.queueAdmissionReceipts?.[queuedItemId]);
  }

  private _queueReceiptTerminalFailureErrorFromReceipt(receipt: QueueAdmissionReceipt | undefined): Error | undefined {
    if (
      !receipt ||
      (receipt.status !== 'failed' && receipt.status !== 'dead' && receipt.status !== 'admission_failed')
    ) {
      return undefined;
    }
    return publicErrorProjectionToError(
      receipt.error ?? {
        code: receipt.status === 'dead' ? 'harness.queue_exhausted' : 'harness.queue_failed',
        message: receipt.status === 'dead' ? 'queued turn exhausted retry attempts' : 'queued turn failed',
      },
    );
  }

  private async _awaitQueuedRunCompletion(
    item: QueuedItem,
    runId: string,
    signalId: string,
    modeId: string,
    activeTurnWaiter?: Promise<never>,
  ): Promise<FullOutput<unknown>> {
    let full: FullOutput<unknown>;
    try {
      full = await this._raceActiveTurnWaiter(this._awaitRunCompletion(runId), activeTurnWaiter);
    } catch (err) {
      if (this._shouldWriteTurnFailureEvidence(err)) {
        await this._raceActiveTurnWaiter(
          this._writeQueueSignalResultEvidence({
            status: 'failed',
            signalId,
            runId,
            error: projectHarnessPublicError(err),
          }).catch(() => {}),
          activeTurnWaiter,
        );
      }
      throw err;
    }

    const terminalFailure = this._queueReceiptTerminalFailureError(item.id);
    if (terminalFailure) throw terminalFailure;

    if (full.finishReason !== 'suspended') {
      await this._raceActiveTurnWaiter(this._markQueuedTurnCompleted(item.id, full), activeTurnWaiter);
      await this._finalizeCompletedQueuedTurn(item, full, modeId, activeTurnWaiter);
      await this._raceActiveTurnWaiter(
        this._writeQueueSignalResultEvidence({
          status: 'completed',
          signalId,
          runId,
          result: full,
        }).catch(() => {}),
        activeTurnWaiter,
      );
    } else {
      await this._finalizeQueuedRunCompletion(item, full, modeId, activeTurnWaiter);
    }
    return full;
  }

  private async _finalizeCompletedQueuedTurn(
    item: QueuedItem,
    full: FullOutput<unknown>,
    modeId: string,
    activeTurnWaiter?: Promise<never>,
  ): Promise<void> {
    if (this._record.queueAdmissionReceipts?.[item.id]?.postRunFinalizedAt === undefined) {
      // Mark before running non-idempotent post-run side effects. Recovery may
      // retry a failed marker write, but must not replay goal continuations,
      // token accounting, or terminal turn events after the marker persists.
      try {
        await this._raceActiveTurnWaiter(this._markQueuedPostRunFinalized(item.id), activeTurnWaiter);
      } catch (err) {
        if (err instanceof HarnessSessionDeletedError) throw err;
        throw new QueuePostRunFinalizationPendingError(Date.now() + QUEUE_POST_RUN_FINALIZATION_RETRY_MS, err);
      }
    }
    await this._finalizeQueuedRunCompletion(item, full, modeId, activeTurnWaiter);
  }

  private async _markQueuedTurnCompleted(
    queuedItemId: string,
    full: FullOutput<unknown>,
    opts?: { modeId?: string },
  ): Promise<void> {
    let terminalFailure: Error | undefined;
    await this._flushUpdate(prev => {
      const receipt = prev.queueAdmissionReceipts?.[queuedItemId];
      if (!receipt && opts?.modeId === undefined) return prev;
      const receiptTerminalFailure = this._queueReceiptTerminalFailureErrorFromReceipt(receipt);
      if (receiptTerminalFailure) {
        terminalFailure = receiptTerminalFailure;
        return prev;
      }
      const now = Date.now();
      const next: SessionRecord = { ...prev };
      if (opts?.modeId !== undefined) next.modeId = opts.modeId;
      if (receipt) {
        next.queueAdmissionReceipts = {
          ...(prev.queueAdmissionReceipts ?? {}),
          [queuedItemId]:
            receipt.status === 'completed'
              ? receipt
              : {
                  ...receipt,
                  status: 'completed',
                  result: full,
                  completedAt: receipt.completedAt ?? now,
                  updatedAt: now,
                },
        };
      }
      return next;
    });
    if (terminalFailure) throw terminalFailure;
  }

  private async _finalizeQueuedRunCompletion(
    item: QueuedItem,
    full: FullOutput<unknown>,
    modeId?: string,
    activeTurnWaiter?: Promise<never>,
  ): Promise<FullOutput<unknown>> {
    this._recordTurnCompletion(full);
    await this._raceActiveTurnWaiter(
      this._maybeCaptureSuspend(full, item.id, modeId ?? item.mode ?? this._record.modeId),
      activeTurnWaiter,
    );
    this._emitTurnEvent({
      type: 'agent_end',
      reason: full.finishReason === 'suspended' ? 'suspended' : full.finishReason === 'error' ? 'error' : 'complete',
      runId: full.runId,
    });
    await this._raceActiveTurnWaiter(this._runGoalJudge(full, (item.source ?? 'user') === 'goal'), activeTurnWaiter);
    return full;
  }

  private async _markQueuedPostRunFinalized(queuedItemId: string): Promise<void> {
    await this._updateQueueAdmissionReceipt(queuedItemId, (receipt, now) =>
      receipt.postRunFinalizedAt !== undefined
        ? receipt
        : {
            ...receipt,
            postRunFinalizedAt: now,
            updatedAt: now,
          },
    );
  }

  private async _loadQueueSignalResultEvidence(
    receipt: QueueAdmissionReceipt,
  ): Promise<AgentSignalResultStatus | { status: 'not_found' }> {
    if (!receipt.signalId) return { status: 'not_found' };
    const evidence = await this._storage.loadMessageResultEvidence({
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      signalId: receipt.signalId,
    });
    if (!evidence || 'kind' in evidence) return { status: 'not_found' };
    return evidence;
  }

  private async _writeQueueSignalResultEvidence(status: AgentSignalResultStatus): Promise<void> {
    const now = Date.now();
    this._operationEvidenceSignalIds.add(status.signalId);
    await this._storage.writeMessageResultEvidence({
      ...status,
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      createdAt: now,
      updatedAt: now,
    });
    await this._cleanupOperationEvidenceIfDeleted(status);
  }

  private async _inspectQueueReceiptMemory(
    receipt: QueueAdmissionReceipt,
  ): Promise<{ status: 'not_found' } | { status: 'pending' }> {
    if (!receipt.signalId) return { status: 'not_found' };

    const memory = await this._harness._internalTryGetMemoryStorage();
    if (!memory) return { status: 'not_found' };

    const result = await memory.listMessages({ threadId: this.threadId, resourceId: this.resourceId, perPage: false });
    const messages = result.messages as StoredMessageRow[];
    return messages.some(message => message.id === receipt.signalId) ? { status: 'pending' } : { status: 'not_found' };
  }

  private async _validateQueuedAttachmentRefs(item: QueuedItem): Promise<void> {
    for (const attachment of item.attachments) {
      if (attachment.kind !== 'ref') continue;
      const loaded = await this._storage.loadAttachment({
        harnessName: this._record.harnessName,
        sessionId: attachment.ownerSessionId,
        attachmentId: attachment.attachmentId,
      });
      if (!loaded) {
        throw new HarnessAttachmentUnavailableError(attachment.ownerSessionId, 'not_found', attachment.attachmentId);
      }
      if (loaded.sha256 !== attachment.sha256) {
        throw new HarnessAttachmentUnavailableError(
          attachment.ownerSessionId,
          'digest_mismatch',
          attachment.attachmentId,
        );
      }
      if (loaded.bytes !== attachment.bytes) {
        throw new HarnessAttachmentUnavailableError(
          attachment.ownerSessionId,
          'bytes_mismatch',
          attachment.attachmentId,
        );
      }
    }
  }

  private async _registerQuestion(
    params: RegisterQuestionParams & { runId?: string; toolCallId?: string; modeId?: string; modelId?: string },
  ): Promise<void> {
    this._assertOpenForTurn('ctx.registerQuestion');
    if (typeof params.questionId !== 'string' || params.questionId.length === 0) {
      throw new HarnessValidationError('ctx.registerQuestion.questionId', 'must be a non-empty string');
    }
    if (typeof params.question !== 'string' || params.question.length === 0) {
      throw new HarnessValidationError('ctx.registerQuestion.question', 'must be a non-empty string');
    }
    if (
      params.selectionMode !== undefined &&
      params.selectionMode !== 'single_select' &&
      params.selectionMode !== 'multi_select'
    ) {
      throw new HarnessValidationError('ctx.registerQuestion.selectionMode', 'must be single_select or multi_select');
    }
    const runId = params.runId ?? this._currentRunId;
    const toolCallId = params.toolCallId ?? params.questionId;
    if (!runId) {
      throw new HarnessValidationError('ctx.registerQuestion.runId', 'active run id is required');
    }
    const pending: PendingResume = {
      kind: 'question',
      itemId: params.questionId,
      runId,
      toolCallId,
      toolName: ASK_USER_TOOL_NAME,
      source: (this._record.subagentDepth ?? 0) > 0 ? 'subagent' : 'parent',
      requestedAt: Date.now(),
      modeId: params.modeId ?? this._record.modeId,
      runtimeDependencies: this._harness._runtimeDependenciesForMode(
        params.modeId ?? this._record.modeId,
        params.modelId ?? this._modelIdForQueuedItem(this._currentQueuedItemId),
      ),
      payload: {
        question: params.question,
        ...(params.options ? { options: params.options } : {}),
        ...(params.selectionMode ? { selectionMode: params.selectionMode } : {}),
      },
    };
    let registered = false;
    await this._flushUpdate(prev => {
      const current = prev.pendingResume;
      if (current) {
        if (current.kind === 'question' && current.runId === runId && current.toolCallId === toolCallId) {
          return prev;
        }
        throw new HarnessValidationError('ctx.registerQuestion', `pending resume is already "${current.kind}"`);
      }
      registered = true;
      return { ...prev, pendingResume: pending };
    });
    if (!registered) return;
    this._emitTurnEvent({
      type: 'suspension_required',
      kind: 'question',
      toolCallId,
      toolName: ASK_USER_TOOL_NAME,
      runId,
    });
  }

  private async _registerPlanApproval(
    params: RegisterPlanApprovalParams & { runId?: string; toolCallId?: string; modeId?: string; modelId?: string },
  ): Promise<void> {
    this._assertOpenForTurn('ctx.registerPlanApproval');
    if (typeof params.planId !== 'string' || params.planId.length === 0) {
      throw new HarnessValidationError('ctx.registerPlanApproval.planId', 'must be a non-empty string');
    }
    if (params.title !== undefined && typeof params.title !== 'string') {
      throw new HarnessValidationError('ctx.registerPlanApproval.title', 'must be a string when provided');
    }
    if (typeof params.plan !== 'string' || params.plan.length === 0) {
      throw new HarnessValidationError('ctx.registerPlanApproval.plan', 'must be a non-empty string');
    }
    const runId = params.runId ?? this._currentRunId;
    const toolCallId = params.toolCallId ?? params.planId;
    if (!runId) {
      throw new HarnessValidationError('ctx.registerPlanApproval.runId', 'active run id is required');
    }
    const submittingModeId = params.modeId ?? this._record.modeId;
    const submittingMode = this._harness._getMode(submittingModeId);
    const pending: PendingResume = {
      kind: 'plan-approval',
      itemId: params.planId,
      runId,
      toolCallId,
      toolName: SUBMIT_PLAN_TOOL_NAME,
      source: (this._record.subagentDepth ?? 0) > 0 ? 'subagent' : 'parent',
      requestedAt: Date.now(),
      modeId: submittingModeId,
      runtimeDependencies: this._harness._runtimeDependenciesForMode(
        submittingModeId,
        params.modelId ?? this._modelIdForQueuedItem(this._currentQueuedItemId),
      ),
      payload: {
        ...(params.title !== undefined ? { title: params.title } : {}),
        plan: params.plan,
      },
      ...(submittingMode.transitionsTo ? { transitionModeId: submittingMode.transitionsTo } : {}),
    };
    let registered = false;
    await this._flushUpdate(prev => {
      const current = prev.pendingResume;
      if (current) {
        if (current.kind === 'plan-approval' && current.runId === runId && current.toolCallId === toolCallId) {
          return prev;
        }
        throw new HarnessValidationError('ctx.registerPlanApproval', `pending resume is already "${current.kind}"`);
      }
      registered = true;
      return { ...prev, pendingResume: pending };
    });
    if (!registered) return;
    this._emitTurnEvent({
      type: 'suspension_required',
      kind: 'plan-approval',
      toolCallId,
      toolName: SUBMIT_PLAN_TOOL_NAME,
      runId,
    });
  }

  /**
   * Settle a queued item's resolver with success and remove it from the
   * head of `pendingQueue`. The CAS write here is the durable record that
   * the item ran exactly once. Crash recovery uses `pendingQueue[0]`,
   * `pendingResume`, queue receipts, and signal-result evidence to decide
   * whether to replay, await, or fail a previously admitted item.
   */
  private async _completeQueuedTurn(itemId: string, result: AgentResult): Promise<void> {
    if (this.isClosed) {
      const resolver = this._queueResolvers.get(itemId);
      if (resolver) {
        this._queueResolvers.delete(itemId);
        resolver.resolve(result);
      }
      return;
    }
    const now = Date.now();
    let terminalFailure: Error | undefined;
    await this._flushUpdate(prev => {
      const receipt = prev.queueAdmissionReceipts?.[itemId];
      const receiptTerminalFailure = this._queueReceiptTerminalFailureErrorFromReceipt(receipt);
      if (receiptTerminalFailure) {
        terminalFailure = receiptTerminalFailure;
        return prev;
      }
      return {
        ...prev,
        pendingQueue: (prev.pendingQueue ?? []).filter(x => x.id !== itemId),
        ...(receipt
          ? {
              queueAdmissionReceipts: {
                ...(prev.queueAdmissionReceipts ?? {}),
                [itemId]: {
                  ...receipt,
                  status: 'completed',
                  result,
                  completedAt: receipt.completedAt ?? now,
                  updatedAt: now,
                },
              },
            }
          : {}),
      };
    });
    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    const resolver = this._queueResolvers.get(itemId);
    if (resolver) {
      this._queueResolvers.delete(itemId);
      if (terminalFailure) {
        resolver.reject(terminalFailure);
      } else {
        resolver.resolve(result);
      }
    }
    this._notifyMaybeIdle();
    if (terminalFailure) return;
    // Kick the drain again — there may be more items waiting.
    void this._maybeDrainQueue();
  }

  /** Same as `_completeQueuedTurn` but rejects the resolver with `err`. */
  private async _failQueuedTurn(itemId: string, err: unknown): Promise<void> {
    if (this.isClosed) {
      const resolver = this._queueResolvers.get(itemId);
      if (resolver) {
        this._queueResolvers.delete(itemId);
        resolver.reject(err);
      }
      return;
    }
    const now = Date.now();
    let completedResult: AgentResult | undefined;
    await this._flushUpdate(prev => {
      const receipt = prev.queueAdmissionReceipts?.[itemId];
      if (receipt?.status === 'completed') {
        completedResult = receipt.result as AgentResult | undefined;
        return {
          ...prev,
          pendingQueue: (prev.pendingQueue ?? []).filter(x => x.id !== itemId),
        };
      }
      return {
        ...prev,
        pendingQueue: (prev.pendingQueue ?? []).filter(x => x.id !== itemId),
        ...(receipt
          ? {
              queueAdmissionReceipts: {
                ...(prev.queueAdmissionReceipts ?? {}),
                [itemId]: {
                  ...receipt,
                  status: 'failed',
                  error: projectHarnessPublicError(err),
                  failedAt: receipt.failedAt ?? now,
                  updatedAt: now,
                },
              },
            }
          : {}),
      };
    });
    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    const resolver = this._queueResolvers.get(itemId);
    if (resolver) {
      this._queueResolvers.delete(itemId);
      if (completedResult !== undefined) {
        resolver.resolve(completedResult);
      } else {
        resolver.reject(err);
      }
    }
    this._notifyMaybeIdle();
    void this._maybeDrainQueue();
  }

  private async _failPendingQueueForClose(err: unknown): Promise<void> {
    const queuedIds = (this._record.pendingQueue ?? []).map(item => item.id);
    if (queuedIds.length === 0) return;

    const completedResults = new Map<string, AgentResult>();
    const failedIds = new Set<string>();
    const now = Date.now();
    await this._flushUpdate(prev => {
      const next: SessionRecord = {
        ...prev,
        pendingQueue: [],
      };
      const receipts = prev.queueAdmissionReceipts ?? {};
      const nextReceipts: Record<string, QueueAdmissionReceipt> = { ...receipts };
      for (const item of prev.pendingQueue ?? []) {
        const receipt = receipts[item.id];
        if (!receipt) {
          failedIds.add(item.id);
          continue;
        }
        if (receipt.status === 'completed') {
          completedResults.set(item.id, receipt.result as AgentResult);
          continue;
        }
        failedIds.add(item.id);
        nextReceipts[item.id] = {
          ...receipt,
          status: 'failed',
          error: projectHarnessPublicError(err),
          failedAt: receipt.failedAt ?? now,
          updatedAt: now,
        };
      }
      next.queueAdmissionReceipts = nextReceipts;
      return next;
    });

    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    for (const itemId of queuedIds) {
      const resolver = this._queueResolvers.get(itemId);
      if (!resolver) continue;
      this._queueResolvers.delete(itemId);
      const completed = completedResults.get(itemId);
      if (completed !== undefined) {
        resolver.resolve(completed);
      } else if (failedIds.has(itemId)) {
        resolver.reject(err);
      }
    }
    this._notifyMaybeIdle();
  }

  private _parkQueuedTurn(itemId: string, err: unknown): void {
    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    this._notifyMaybeIdle();
    if (err instanceof QueueRecoveryPendingError) {
      const delayMs = Math.max(0, err.retryAt - Date.now());
      const timer = setTimeout(() => void this._maybeDrainQueue(), delayMs);
      timer.unref?.();
      return;
    }
    const resolver = this._queueResolvers.get(itemId);
    if (resolver) {
      this._queueResolvers.delete(itemId);
      resolver.reject(err);
    }
  }

  private _emitQueueItemReplayedOnce(queuedItemId: string): void {
    if (this._replayedQueuedItemIds.has(queuedItemId)) return;
    this._replayedQueuedItemIds.add(queuedItemId);
    this._emitter.emit({ type: 'queue_item_replayed', queuedItemId });
  }

  private _ensureQueuedItemContext(queuedItemId: string): void {
    if (this._currentQueuedItemId !== undefined) return;
    const queuedItem = this._record.pendingQueue.find(item => item.id === queuedItemId);
    this._currentQueuedItemId = queuedItemId;
    this._currentQueuedItemSource = queuedItem?.source ?? 'user';
  }

  private _deferQueuedTurnRetry(err: QueuePostRunFinalizationPendingError): void {
    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    this._notifyMaybeIdle();
    const delayMs = Math.max(0, err.retryAt - Date.now());
    const timer = setTimeout(() => void this._maybeDrainQueue(), delayMs);
    timer.unref?.();
  }

  /** @internal — used by the Harness on hydration to start replay drain. */
  async _kickQueueDrain(): Promise<void> {
    return this._maybeDrainQueue();
  }

  // -------------------------------------------------------------------------
  // Internal helpers.
  // -------------------------------------------------------------------------

  private _assertLive(_method: string): void {
    if (this._state === 'deleted') {
      throw new HarnessSessionDeletedError(this.id);
    }
    if (this.isClosing) {
      throw new HarnessSessionClosingError(this.id);
    }
    if (this._state !== 'live') {
      throw new HarnessSessionClosedError(this.id);
    }
  }

  private _assertNotDeleted(): void {
    if (this._state === 'deleted') {
      throw new HarnessSessionDeletedError(this.id);
    }
  }

  private _assertOpenForTurn(_method: string): void {
    if (this._state === 'deleted') {
      throw new HarnessSessionDeletedError(this.id);
    }
    if (this._state === 'closed') {
      throw new HarnessSessionClosedError(this.id);
    }
  }

  private _canDrainQueue(): boolean {
    if (this._state === 'live') return true;
    if (!this.isClosing) return false;
    return this._record.closeDeadlineAt === undefined || Date.now() < this._record.closeDeadlineAt;
  }

  /**
   * Apply an update to the in-memory record, CAS-write to storage, and
   * adopt the returned version. Single point of truth so every setter
   * stays consistent with the lease + version contract (§5.8).
   */
  private _flushUpdate(
    update: (prev: SessionRecord) => SessionRecord,
    opts?: { attachmentReferences?: SaveAttachmentReferenceInput[]; ifVersion?: number },
  ): Promise<void> {
    if (this._state === 'closed') {
      return Promise.reject(new HarnessSessionClosedError(this.id));
    }
    if (this._state === 'deleted') {
      return Promise.reject(new HarnessSessionDeletedError(this.id));
    }
    if (this._state === 'evicted') {
      return Promise.reject(new HarnessSessionClosedError(this.id));
    }
    const run = async (): Promise<void> => {
      if (opts?.ifVersion !== undefined && this._record.version !== opts.ifVersion) {
        throw new HarnessStateConflictError(this.id, opts.ifVersion, this._record.version);
      }
      const next: SessionRecord = {
        ...update(this._record),
        lastActivityAt: Date.now(),
      };
      const saveOpts = {
        harnessName: this._record.harnessName,
        ownerId: this._ownerId,
        ifVersion: this._record.version,
      };
      const saved =
        opts?.attachmentReferences && opts.attachmentReferences.length > 0
          ? await this._storage.saveSessionWithAttachmentReferences(next, saveOpts, opts.attachmentReferences)
          : await this._storage.saveSession(next, saveOpts);
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
  private async _buildRequestContext(turn: {
    modeId: string;
    modelId: string;
    abortSignal: AbortSignal;
    persistedRequestContext?: PersistedRequestContextInput;
  }): Promise<RequestContext> {
    const session = this;
    const stateSnapshot = (this._record.state ?? {}) as unknown;
    const persistedRequestContext = turn.persistedRequestContext
      ? clonePersistedRequestContext(turn.persistedRequestContext)
      : undefined;
    // Resolve the workspace eagerly so tools see a populated `ctx.workspace`
    // without each tool re-awaiting. Errors here surface as the turn's
    // failure; workspace_error is still emitted via the registry.
    let workspace: Workspace | undefined;
    try {
      workspace = await this._getWorkspaceUnchecked();
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
      ...(persistedRequestContext?.metadata ? { app: persistedRequestContext.metadata } : {}),
      ...(persistedRequestContext?.channel ? { channel: persistedRequestContext.channel } : {}),
      state: stateSnapshot,
      getState: () => (session._record.state ?? {}) as unknown,
      setState: ((updatesOrUpdater: unknown) =>
        session._setTurnState(
          updatesOrUpdater as Partial<unknown> | ((prev: unknown) => unknown),
        )) as HarnessRequestContext<unknown>['setState'],
      abortSignal: turn.abortSignal,
      registerQuestion: params => session._registerQuestion({ ...params, modeId: turn.modeId, modelId: turn.modelId }),
      registerPlanApproval: params =>
        session._registerPlanApproval({ ...params, modeId: turn.modeId, modelId: turn.modelId }),
      // Subagent linkage — set from the record so spawned sessions report
      // their depth + parent linkage on the harness slot.
      subagentDepth: this._record.subagentDepth ?? 0,
      source: (this._record.subagentDepth ?? 0) > 0 ? 'subagent' : 'parent',
      parentSessionId: this._record.parentSessionId,
      getSubagentModel: params => {
        const agentType = params?.agentType;
        if (!agentType) return null;
        return this._record.subagentModelOverrides?.[agentType] ?? null;
      },
      // Tool-facing skill execution. Delegates back to the owning session
      // so resolution, args validation, prompt construction, and dispatch
      // stay in one place (§4.6).
      useSkill: (ref, opts) => session._skillsUse(ref, opts),
      ...(workspace ? { workspace } : {}),
    };
    const entries: [string, unknown][] = [['harness', harnessSlot]];
    if (persistedRequestContext?.metadata) {
      entries.push(['app', persistedRequestContext.metadata]);
    }
    if (persistedRequestContext?.channel) {
      entries.push(['channel', persistedRequestContext.channel]);
    }
    return new RequestContext(entries);
  }

  private async _setTurnState<TState = unknown>(
    updatesOrUpdater: Partial<TState> | ((prev: TState) => TState),
  ): Promise<void> {
    // Tool-facing state writes belong to an already-admitted turn, so they
    // remain valid while close drains. `_flushUpdate` still rejects after the
    // terminal closed marker lands.
    await this._flushUpdate(prev => {
      const current = (prev.state ?? {}) as TState;
      const next =
        typeof updatesOrUpdater === 'function'
          ? (updatesOrUpdater as (prev: TState) => TState)(current)
          : ({ ...(current as object), ...(updatesOrUpdater as object) } as TState);
      return { ...prev, state: next };
    });
  }

  /** @internal — used by the Harness as soon as close starts. */
  _beginClosing(): void {
    if (this.isClosed) {
      return;
    }
    this._state = 'closing';
    this._rejectIdleWaiters(new HarnessSessionClosingError(this.id));
  }

  /** @internal — restore admission if close failed before the durable marker committed. */
  _restoreLiveAfterFailedClose(): void {
    if (this._state === 'closing' && this._record.closingAt === undefined && this._record.closedAt === undefined) {
      this._state = 'live';
    }
  }

  /**
   * @internal — used by the Harness after close starts. New work is rejected
   * immediately while previously admitted flushes serialize before the marker.
   */
  _flushClosingMarker(params: { closeTimeoutMs: number }): Promise<SessionRecord> {
    if (this.isClosed) {
      return Promise.resolve(this._record);
    }
    this._beginClosing();

    const run = async (): Promise<SessionRecord> => {
      const closingAt = this._record.closingAt ?? Date.now();
      const closeDeadlineAt = this._record.closeDeadlineAt ?? closingAt + params.closeTimeoutMs;
      const next: SessionRecord = {
        ...this._record,
        closingAt,
        closeDeadlineAt,
        lastActivityAt: Date.now(),
      };
      const saved = await this._storage.saveSession(next, {
        harnessName: this._record.harnessName,
        ownerId: this._ownerId,
        ifVersion: this._record.version,
      });
      this._record = { ...next, version: saved.version };
      return this._record;
    };
    const next = this._flushChain.then(run, run);
    this._flushChain = next.then(
      () => {},
      () => {},
    );
    return next;
  }

  /** @internal — used by the Harness after descendants are terminalized. */
  _flushClosedMarker(closedAt: number): Promise<SessionRecord> {
    const run = async (): Promise<SessionRecord> => {
      if (this._record.closedAt !== undefined) {
        return this._record;
      }
      const next: SessionRecord = {
        ...this._record,
        lastActivityAt: closedAt,
        closedAt,
      };
      const saved = await this._storage.saveSession(next, {
        harnessName: this._record.harnessName,
        ownerId: this._ownerId,
        ifVersion: this._record.version,
      });
      this._record = { ...next, version: saved.version };
      return this._record;
    };
    const next = this._flushChain.then(run, run);
    this._flushChain = next.then(
      () => {},
      () => {},
    );
    return next;
  }

  /**
   * @internal — used by the Harness during `close()` to mark this instance
   * terminal. Does not touch storage or release the lease — those are the
   * harness's job. Idempotent.
   */
  _markClosed(updatedRecord: SessionRecord): void {
    this._record = updatedRecord;
    this._state = 'closed';
    this._tearDownThreadSubscription(new HarnessValidationError('session.close()', 'Session closed'));
    this._rejectIdleWaiters(new HarnessSessionClosedError(this.id));
  }

  /** @internal — used by Harness hard-delete after storage has removed the row. */
  _markDeleted(): void {
    const err = new HarnessSessionDeletedError(this.id);
    this._state = 'deleted';
    this._rejectIdleWaiters(err);
    this._rejectActiveTurnWaiters(err);
    const activeTurn = this._currentTurnAbortController;
    if (activeTurn) {
      activeTurn.abort('session_deleted');
      this._endTurn(activeTurn);
    }
    if (this._queuedResumeRecoveryTimer !== undefined) {
      clearTimeout(this._queuedResumeRecoveryTimer);
      this._queuedResumeRecoveryTimer = undefined;
    }
    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    for (const [queuedItemId, resolver] of this._queueResolvers) {
      this._queueResolvers.delete(queuedItemId);
      resolver.reject(err);
    }
    this._tearDownThreadSubscription(err);
  }

  /** @internal — signal identities that may have written operation evidence for this live session. */
  _deletedOperationEvidenceSignalIds(): string[] {
    return Array.from(this._operationEvidenceSignalIds);
  }

  /** @internal — harness bridge subscription that remains valid while closing. */
  _subscribeInternal(listener: HarnessEventListener): HarnessEventUnsubscribe {
    return this._emitter.subscribe(listener);
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
   * Synchronous teardown for the thread subscription on close/evict/delete.
   * Unsubscribes, marks the subscription closed, and rejects every outstanding entry in
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

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function sha256CanonicalJson(value: unknown): string {
  return createHash('sha256')
    .update(canonicalJson(assertJsonValue(value)), 'utf8')
    .digest('hex');
}

function assertJsonValue(value: unknown, path = 'value'): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new HarnessValidationError(path, 'must be a finite JSON number');
    }
    return value;
  }
  if (Array.isArray(value)) {
    const out: JsonValue[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) throw new HarnessValidationError(`${path}[${index}]`, 'sparse arrays are not allowed');
      out.push(assertJsonValue(value[index], `${path}[${index}]`));
    }
    return out;
  }
  if (typeof value === 'object' && value !== null && isPlainJsonObject(value)) {
    const out: Record<string, JsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) out[key] = assertJsonValue(entry, `${path}.${key}`);
    }
    return out;
  }
  throw new HarnessValidationError(path, 'must be JSON-serializable for admission hashing');
}

function compactJsonObject<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function getOwnRecordValue<T>(record: Record<string, T> | undefined, key: string): T | undefined {
  if (!record || !Object.prototype.hasOwnProperty.call(record, key)) return undefined;
  return record[key];
}

function isPlainJsonObject(value: object): value is Record<string, unknown> {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key]!)}`)
    .join(',')}}`;
}

function publicErrorProjectionToError(error: { code: string; message: string }): Error {
  const projected = new Error(error.message);
  projected.name = error.code;
  (projected as Error & { code: string }).code = error.code;
  return projected;
}

function cloneAttachmentMetadata(metadata: Record<string, JsonValue>): Record<string, JsonValue> {
  return JSON.parse(JSON.stringify(metadata)) as Record<string, JsonValue>;
}

function clonePersistedAttachment(attachment: PersistedAttachment): PersistedAttachment {
  return JSON.parse(JSON.stringify(attachment)) as PersistedAttachment;
}

function clonePersistedRequestContext(input: PersistedRequestContextInput): PersistedRequestContextInput {
  return JSON.parse(JSON.stringify(input)) as PersistedRequestContextInput;
}

class QueueRecoveryPendingError extends Error {
  code = 'harness.queue_recovery_pending';
  readonly retryAt: number;

  constructor(retryAt: number) {
    super('queued turn was accepted by the signal runtime and is awaiting durable terminal result evidence');
    this.name = 'harness.queue_recovery_pending';
    this.retryAt = retryAt;
  }
}

class QueueRecoveryStaleError extends Error {
  code = 'harness.queue_recovery_stale';

  constructor() {
    super('queued turn was accepted by the signal runtime but no live run or durable terminal result is available');
    this.name = 'harness.queue_recovery_stale';
  }
}

class QueueResumeRecoveryStaleError extends Error {
  code = 'harness.queue_resume_recovery_stale';

  constructor() {
    super('queued turn resume was marked in flight but no terminal queue result is available');
    this.name = 'harness.queue_resume_recovery_stale';
  }
}

class QueuePostRunFinalizationPendingError extends Error {
  code = 'harness.queue_post_run_finalization_pending';
  readonly retryAt: number;
  readonly cause: unknown;

  constructor(retryAt: number, cause: unknown) {
    super('queued turn completed and is waiting for post-run finalization to persist');
    this.name = 'harness.queue_post_run_finalization_pending';
    this.retryAt = retryAt;
    this.cause = cause;
  }
}

function throwIfAborted(signal: AbortSignal | undefined, path: string): void {
  if (!signal?.aborted) return;
  throw signal.reason ?? new HarnessValidationError(path, 'operation aborted');
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal, 'delay()');
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new HarnessValidationError('delay()', 'operation aborted'));
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
