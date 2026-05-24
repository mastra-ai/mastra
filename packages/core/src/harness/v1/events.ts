/**
 * Harness v1 — event surface (§10).
 *
 * `HarnessEvent` is a discriminated union of every event the harness can
 * emit. Every event flows through `EventEmitter.emit()`; subscribers see
 * a fully-stamped event with `id`, `timestamp`, and (where relevant)
 * `sessionId`.
 *
 * IDs are scoped to an emitter: `harness-v1:<epoch>:<seq>`. The epoch is
 * materialized on first emission/read unless a persisted epoch is supplied,
 * so SSE clients can detect a regenerated emitter and reset their replay
 * cursor (§10.5).
 *
 * Subscribers see only events emitted after `subscribe()` returns. Remote
 * callers that need history replay query the durable session event ledger.
 */

import { randomUUID } from 'node:crypto';

import type {
  GoalJudgeDecision,
  GoalState,
  JsonValue,
  PendingResume,
  SessionRecord,
} from '../../storage/domains/harness';
import type { HarnessTodo } from './builtin-tools/shared';

import { HarnessEventSerializationError, HarnessValidationError, getHarnessPublicErrorCode } from './errors';
import type { EventSerializationReason } from './errors';
import type { SessionLifecycleState } from './session';
import type { HarnessActorIdentity, PermissionPolicy, ToolCategory } from './types';

// ---------------------------------------------------------------------------
// Event base.
// ---------------------------------------------------------------------------

/**
 * Common fields stamped on every event. `sessionId` is set when the event
 * originated on a Session emitter; harness-level events (registry, lifecycle
 * across all sessions, intervals) leave it unset.
 *
 * `signalId` correlates an event back to the `message()` call that produced
 * it. `queuedItemId` correlates events back to a `queue()` item. Subagent
 * events also carry `subagentSessionId` so a parent subscriber can route by
 * origin (§10.6).
 */
export interface HarnessEventBase {
  /** Monotonic-within-emitter id formatted as `harness-v1:<epoch>:<seq>`. */
  id: string;
  timestamp: number;
  sessionId?: string;
  subagentSessionId?: string;
  runId?: string;
  signalId?: string;
  queuedItemId?: string;
}

// ---------------------------------------------------------------------------
// Lifecycle / state events (§10.2).
// ---------------------------------------------------------------------------

export interface SessionCreatedEvent extends HarnessEventBase {
  type: 'session_created';
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  modeId: string;
  modelId: string;
}

export interface SessionClosingEvent extends HarnessEventBase {
  type: 'session_closing';
  reason: 'requested' | 'shutdown';
  closingAt: number;
  closeDeadlineAt: number;
}

export interface SessionClosedEvent extends HarnessEventBase {
  type: 'session_closed';
  reason: 'requested' | 'shutdown';
}

export interface SessionEvictedEvent extends HarnessEventBase {
  type: 'session_evicted';
  reason: 'idle' | 'pressure' | 'pinned_timeout' | 'shutdown' | 'lease_lost';
}

/**
 * The session row has been hard-deleted from storage. Emitted as the
 * LAST event a subscriber will receive on this session before the
 * emitter is torn down. Mirrors `session_closed` / `session_evicted`
 * lifecycle parity for the stream-terminal contract.
 *
 * - `requested` — caller invoked `harness.deleteSession()` directly.
 * - `cascade`   — parent or ancestor was deleted; this session was
 *                 removed as part of the subtree cascade.
 */
export interface SessionDeletedEvent extends HarnessEventBase {
  type: 'session_deleted';
  reason: 'requested' | 'cascade';
}

/**
 * A new artifact (or a new version of an existing artifact) was written.
 * The event carries only safe metadata — no payload bytes. Consumers
 * fetch full content via `harness.artifacts.get()`.
 */
export interface ArtifactCreatedEvent extends HarnessEventBase {
  type: 'artifact_created';
  artifactId: string;
  artifactType: 'plan' | 'diff' | 'report' | 'screenshot' | 'patch' | 'custom';
  lineageRootId: string;
  parentArtifactId?: string;
  version: number;
  mimeType: string;
  sha256: string;
  bytes: number;
}

/**
 * A permission profile was applied to the session. The event carries
 * the profile identity, the resulting per-category posture, and the
 * apply mode so subscribers and the durable event ledger record an
 * auditable snapshot of every policy reset. The full per-tool rule
 * map and the session grants are NOT included — consumers that need
 * them call `session.permissions.getRules()` /
 * `session.permissions.getGrants()` directly.
 */
export interface PermissionProfileAppliedEvent extends HarnessEventBase {
  type: 'permission_profile_applied';
  profileName: string;
  previousProfileName?: string;
  mode: 'replace' | 'replace-preserve-denies';
  /** Snapshot of `permissionRules.categories` after the apply. */
  categories: Record<string, 'allow' | 'ask' | 'deny'>;
  /** Number of caller-set per-tool entries preserved (when applicable). */
  preservedToolDenies: number;
}

export interface ModeChangedEvent extends HarnessEventBase {
  type: 'mode_changed';
  modeId: string;
  previousModeId: string;
}

export interface ModelChangedEvent extends HarnessEventBase {
  type: 'model_changed';
  modelId: string;
  previousModelId: string;
}

export interface ModelOverrideSetEvent extends HarnessEventBase {
  type: 'model_override_set';
  agentType: string;
  modelId: string;
  previousModelId: string | null;
}

export interface StateChangedEvent extends HarnessEventBase {
  type: 'state_changed';
  changedKeys: string[];
}

// ---------------------------------------------------------------------------
// Permission events (§4.2e).
//
// Emitted whenever the session's permission rules or session-scoped grants
// change. Exactly one of `category` / `toolName` is set on each event so
// subscribers can route to per-category vs per-tool views without
// inspecting payload shape.
// ---------------------------------------------------------------------------

export interface PermissionGrantedEvent extends HarnessEventBase {
  type: 'permission_granted';
  category?: ToolCategory;
  toolName?: string;
  /**
   * Identity of the caller this grant applies to. Omitted for
   * session-level grants. Subscribers and audit consumers need this
   * to distinguish an actor overlay from a baseline session grant
   * change — otherwise mirrored permission state can drift.
   */
  actor?: HarnessActorIdentity;
}

export interface PermissionRevokedEvent extends HarnessEventBase {
  type: 'permission_revoked';
  category?: ToolCategory;
  toolName?: string;
  /** Identity of the caller this revoke applies to. Omitted for session-level revokes. */
  actor?: HarnessActorIdentity;
}

export interface PermissionPolicyChangedEvent extends HarnessEventBase {
  type: 'permission_policy_changed';
  category?: ToolCategory;
  toolName?: string;
  oldPolicy: PermissionPolicy | undefined;
  newPolicy: PermissionPolicy;
}

// ---------------------------------------------------------------------------
// Turn events (§10.2).
// ---------------------------------------------------------------------------

export interface AgentStartEvent extends HarnessEventBase {
  type: 'agent_start';
}

/**
 * Assistant message lifecycle (§10.2).
 *
 * Each assistant message produced inside a turn gets exactly one
 * `message_start`, zero or more `message_update` (text deltas), and one
 * `message_end`. `messageId` is stable across the trio and matches the
 * ai-sdk text-stream id, so a UI can address an in-flight message slot
 * directly.
 */
export interface MessageStartEvent extends HarnessEventBase {
  type: 'message_start';
  messageId: string;
}

export interface MessageUpdateEvent extends HarnessEventBase {
  type: 'message_update';
  messageId: string;
  delta: string;
}

export interface MessageEndEvent extends HarnessEventBase {
  type: 'message_end';
  messageId: string;
}

/**
 * Tool-input streaming (§10.2). Models that build arguments incrementally
 * surface a `tool_input_start` → N × `tool_input_delta` → `tool_input_end`
 * sequence before the actual `tool_start`. Models that emit a complete
 * `tool-call` chunk in one shot skip the triplet entirely; clients must
 * tolerate either shape.
 */
export interface ToolInputStartEvent extends HarnessEventBase {
  type: 'tool_input_start';
  toolCallId: string;
  toolName: string;
}

export interface ToolInputDeltaEvent extends HarnessEventBase {
  type: 'tool_input_delta';
  toolCallId: string;
  argsTextDelta: string;
  toolName?: string;
}

export interface ToolInputEndEvent extends HarnessEventBase {
  type: 'tool_input_end';
  toolCallId: string;
}

export interface ToolStartEvent extends HarnessEventBase {
  type: 'tool_start';
  toolCallId: string;
  toolName: string;
  args: unknown;
}

/**
 * Tool progress (§10.2). Long-running tools (shell, downloads, codegen)
 * publish incremental `partialResult`s between `tool_start` and `tool_end`.
 *
 * Source of truth is the `data-tool-update` chunk that tools write via
 * `ctx.writer?.custom({ type: 'data-tool-update', data: { toolCallId, partialResult } })` —
 * the same call works outside a Harness, where consumers read the chunk
 * directly from `agent.stream().fullStream`. Inside a Harness,
 * `_drainStreamToEvents` recognizes the whitelisted `data-tool-update`
 * chunk type and bridges it into this typed event so subscribers can
 * switch on `event.type === 'tool_update'`.
 */
export interface ToolUpdateEvent extends HarnessEventBase {
  type: 'tool_update';
  toolCallId: string;
  partialResult: unknown;
}

/**
 * Streaming shell output (§10.2). Tools that wrap a child process publish
 * stdout/stderr chunks via
 * `ctx.writer?.custom({ type: 'data-shell-output', data: { toolCallId, output, stream } })`.
 * Inside a Harness, `_drainStreamToEvents` bridges the whitelisted
 * `data-shell-output` chunk into this typed event. Outside a Harness, the
 * chunk surfaces directly on `agent.stream().fullStream`.
 */
export interface ShellOutputEvent extends HarnessEventBase {
  type: 'shell_output';
  toolCallId: string;
  output: string;
  stream: 'stdout' | 'stderr';
}

/**
 * Task list update (§10.2). Surfaces a new task list to subscribers
 * (TUI progress widget, sidebar, observers).
 *
 * Source of truth is the `data-task-updated` chunk that tools write via
 * `ctx.writer?.custom({ type: 'data-task-updated', data: { tasks } })` —
 * the same call works outside a Harness, where consumers read the chunk
 * directly from `agent.stream().fullStream`. Inside a Harness,
 * `_drainStreamToEvents` recognizes the whitelisted `data-task-updated`
 * chunk type and bridges it into this typed event so subscribers can
 * switch on `event.type === 'task_updated'`.
 *
 * The harness owns this event type — tools must not synthesize it through
 * `ctx.emitEvent`. Use `writer.custom` instead.
 */
export interface TaskUpdatedEvent extends HarnessEventBase {
  type: 'task_updated';
  tasks: HarnessTodo[];
}

export type OMBufferedStatus = 'idle' | 'running' | 'complete';

export interface OMStatusEvent extends HarnessEventBase {
  type: 'om_status';
  windows: {
    active: {
      messages: { tokens: number; threshold: number };
      observations: { tokens: number; threshold: number };
    };
    buffered: {
      observations: {
        status: OMBufferedStatus;
        chunks: number;
        messageTokens: number;
        projectedMessageRemoval: number;
        observationTokens: number;
      };
      reflection: {
        status: OMBufferedStatus;
        inputObservationTokens: number;
        observationTokens: number;
      };
    };
  };
  recordId: string;
  threadId: string;
  stepNumber: number;
  generationCount: number;
}

export interface OMObservationStartEvent extends HarnessEventBase {
  type: 'om_observation_start';
  cycleId: string;
  operationType: 'observation';
  tokensToObserve: number;
}

export interface OMObservationEndEvent extends HarnessEventBase {
  type: 'om_observation_end';
  cycleId: string;
  durationMs: number;
  tokensObserved: number;
  observationTokens: number;
  observations?: string;
  currentTask?: string;
  suggestedResponse?: string;
}

export interface OMObservationFailedEvent extends HarnessEventBase {
  type: 'om_observation_failed';
  cycleId: string;
  error: string;
  durationMs: number;
}

export interface OMReflectionStartEvent extends HarnessEventBase {
  type: 'om_reflection_start';
  cycleId: string;
  tokensToReflect: number;
}

export interface OMReflectionEndEvent extends HarnessEventBase {
  type: 'om_reflection_end';
  cycleId: string;
  durationMs: number;
  compressedTokens: number;
  observations?: string;
}

export interface OMReflectionFailedEvent extends HarnessEventBase {
  type: 'om_reflection_failed';
  cycleId: string;
  error: string;
  durationMs: number;
}

export interface OMBufferingStartEvent extends HarnessEventBase {
  type: 'om_buffering_start';
  cycleId: string;
  operationType: 'observation' | 'reflection';
  tokensToBuffer: number;
}

export interface OMBufferingEndEvent extends HarnessEventBase {
  type: 'om_buffering_end';
  cycleId: string;
  operationType: 'observation' | 'reflection';
  tokensBuffered: number;
  bufferedTokens: number;
  observations?: string;
}

export interface OMBufferingFailedEvent extends HarnessEventBase {
  type: 'om_buffering_failed';
  cycleId?: string;
  operationType: 'observation' | 'reflection';
  error: string;
}

export interface OMActivationEvent extends HarnessEventBase {
  type: 'om_activation';
  cycleId: string;
  operationType: 'observation' | 'reflection';
  chunksActivated: number;
  tokensActivated: number;
  observationTokens: number;
  messagesActivated: number;
  generationCount: number;
  triggeredBy?: 'threshold' | 'ttl' | 'provider_change';
  lastActivityAt?: number;
  ttlExpiredMs?: number;
  activateAfterIdle?: number;
  previousModel?: string;
  currentModel?: string;
}

export interface OMThreadTitleUpdatedEvent extends HarnessEventBase {
  type: 'om_thread_title_updated';
  cycleId: string;
  threadId: string;
  oldTitle?: string;
  newTitle: string;
}

export interface ToolEndEvent extends HarnessEventBase {
  type: 'tool_end';
  toolCallId: string;
  result: unknown;
  isError: boolean;
}

export interface AgentEndEvent extends HarnessEventBase {
  type: 'agent_end';
  reason: 'complete' | 'aborted' | 'error' | 'suspended';
}

// ---------------------------------------------------------------------------
// Suspension events (§10.2). Emitted after the durable-parking barrier so
// any subscriber observing the event can reconstruct the pending state from
// storage (§5.4).
// ---------------------------------------------------------------------------

export interface SuspensionRequiredEvent extends HarnessEventBase {
  type: 'suspension_required';
  kind: PendingResume['kind'];
  toolCallId: string;
  toolName?: string;
}

export interface SuspensionResolvedEvent extends HarnessEventBase {
  type: 'suspension_resolved';
  kind: PendingResume['kind'];
  toolCallId: string;
}

/**
 * A sandbox-access request was registered via
 * `ctx.registerSandboxAccess(...)`. Mirrors `suspension_required`
 * but carries the structured sandbox-access payload (semantic type,
 * reason, opaque payload) so the approval UI / route can route on
 * shape without inspecting pendingResume state.
 */
export interface SandboxAccessRequestedEvent extends HarnessEventBase {
  type: 'sandbox_access_requested';
  requestId: string;
  toolCallId: string;
  semanticType: 'file' | 'command' | 'network' | 'mcp' | 'custom';
  reason?: string;
  payload?: JsonValue;
}

/**
 * The pending sandbox-access request was resolved via
 * `session.respondToSandboxAccess({approved, reason?})`. Fires after
 * the resume CAS commits but before the requesting tool's resume
 * runs — invalid responses, duplicate receipts, and concurrent
 * losers do not emit a resolved event, so subscribers can treat
 * this as an authoritative verdict for audit.
 */
export interface SandboxAccessResolvedEvent extends HarnessEventBase {
  type: 'sandbox_access_resolved';
  requestId: string;
  toolCallId: string;
  semanticType: 'file' | 'command' | 'network' | 'mcp' | 'custom';
  approved: boolean;
}

/**
 * The session-level cancellation primitive ran. Emitted exactly once
 * per durable `cancelRequest` commit — concurrent retries that lose
 * the CAS do not re-emit. Carries the durable `requestedAt` /
 * `reason` / `requestedBy` triple so a downstream auditor can
 * reconstruct who cancelled what without reading storage.
 *
 * Per-queued-item cancellations are reported via
 * {@link QueueItemCancelledEvent}; this event covers the session-
 * scope verdict.
 */
export interface TaskCancellationRequestedEvent extends HarnessEventBase {
  type: 'task_cancellation_requested';
  requestedAt: number;
  reason?: string;
  requestedBy?: string;
}

/**
 * A queued turn was removed before it could start, either by a
 * session-wide cancel or by `session.cancelQueuedItem(...)`. Emitted
 * once per cleared item, in queue order. Outcome is also reflected
 * by the queue-resolver rejecting the original `session.queue(...)`
 * promise; subscribers who need the audit row should listen to this
 * event rather than the rejection.
 */
export interface QueueItemCancelledEvent extends HarnessEventBase {
  type: 'queue_item_cancelled';
  queuedItemId: string;
  admissionId?: string;
  reason?: string;
}

/**
 * A queued item was removed by the scheduler because its `deadline`
 * passed before the drain could start it. The item never ran; its
 * `queueAdmissionReceipts` entry is marked `failed` in the same CAS
 * write that drops it from `pendingQueue`. Deadline expiry is a
 * scheduler-side verdict, distinct from caller cancellation
 * ({@link QueueItemCancelledEvent}).
 */
export interface QueueItemExpiredEvent extends HarnessEventBase {
  type: 'queue_item_expired';
  queuedItemId: string;
  admissionId?: string;
  /** Epoch ms — the deadline that was missed. */
  deadline: number;
}

// ---------------------------------------------------------------------------
// Queue events (§10.2). The queue's lifecycle is: `enqueued → started →
// removed`. Outcome is observable through the turn's own `agent_end`
// (correlated by `queuedItemId`) and the resolved/rejected `queue()` promise,
// so we don't emit `queue_item_completed` / `queue_item_failed` — that would
// be a redundant restatement of `agent_end`.
//
//   - `queue_item_started`  — drain pulled the head item; turn is about to
//                             begin under a fresh `runId`.
//   - `queue_item_replayed` — same, but emitted instead of `started` when
//                             the source is crash-recovery rather than a
//                             live `queue()` call. The original caller's
//                             promise is gone; events flow but no resolver
//                             settles.
// ---------------------------------------------------------------------------

export interface QueueItemStartedEvent extends HarnessEventBase {
  type: 'queue_item_started';
  queuedItemId: string;
}

export interface QueueItemReplayedEvent extends HarnessEventBase {
  type: 'queue_item_replayed';
  queuedItemId: string;
}

// ---------------------------------------------------------------------------
// Custom events (§10.3) — escape hatch for callers that want to attach their
// own typed events to the same subscription channel. Type must be dotted
// and not start with the reserved harness prefix; payload must be JSON-
// serializable.
// ---------------------------------------------------------------------------

export interface CustomEvent extends HarnessEventBase {
  type: `${string}.${string}`;
  payload?: unknown;
}

// ---------------------------------------------------------------------------
// Thread lifecycle events (§10.2 — sidebar surface).
//
// Threads are the durable artifact (message log + title), distinct from
// the runtime Session. These events fire on the harness emitter so a
// sidebar can be reactive without polling. `thread_deleted` fires AFTER
// any cascade-close of the active session, so subscribers see the
// session_closed event first.
// ---------------------------------------------------------------------------

export interface ThreadCreatedEvent extends HarnessEventBase {
  type: 'thread_created';
  threadId: string;
  resourceId: string;
  title?: string;
}

export interface ThreadRenamedEvent extends HarnessEventBase {
  type: 'thread_renamed';
  threadId: string;
  resourceId: string;
  title: string;
  previousTitle?: string;
}

export interface ThreadDeletedEvent extends HarnessEventBase {
  type: 'thread_deleted';
  threadId: string;
  resourceId: string;
  /** True when a live session was cascaded-closed as part of the delete. */
  cascadedSessionClose: boolean;
}

export interface ThreadClonedEvent extends HarnessEventBase {
  type: 'thread_cloned';
  threadId: string;
  resourceId: string;
  sourceThreadId: string;
  title?: string;
}

/**
 * Emitted after `harness.threads.setSettings()` commits a patch to a thread's
 * metadata. `patch` includes only the keys that actually changed (no-op
 * writes do not emit). `removedKeys` lists keys that were present before and
 * absent after — drives reactive UI invalidation without subscribers having
 * to diff metadata themselves.
 */
export interface ThreadSettingsChangedEvent extends HarnessEventBase {
  type: 'thread_settings_changed';
  threadId: string;
  resourceId: string;
  /** Keys whose values changed (does not include removed keys). */
  patch: Record<string, unknown>;
  /** Keys that were deleted by this patch (had `value: undefined`). */
  removedKeys: string[];
}

// ---------------------------------------------------------------------------
// Subagent events (§10.2 / §10.6 — parent-session attribution).
//
// Emitted on the *parent* session's subscriber when a subagent session
// makes progress. `toolCallId` is the parent's `spawn_subagent` tool-call
// handle (stable for the subagent's lifetime). `subagentSessionId` is the
// child session id, addressable for response routing. `agentType` is the
// child's registered subagent type from `HarnessConfig.subagents.types`.
// `depth` is the child's depth in the subagent tree (`>= 1` for any
// subagent event; parent session itself is depth 0).
//
// `parentId` is the parent's session id, repeated on every subagent event
// to make routing trivial in flat consumers that see events from many
// sessions.
// ---------------------------------------------------------------------------

export interface SubagentStartEvent extends HarnessEventBase {
  type: 'subagent_start';
  toolCallId: string;
  subagentSessionId: string;
  agentType: string;
  task: string;
  modelId: string;
  forked?: boolean;
  parentId?: string;
  depth: number;
}

export interface SubagentTextDeltaEvent extends HarnessEventBase {
  type: 'subagent_text_delta';
  toolCallId: string;
  subagentSessionId: string;
  agentType: string;
  delta: string;
  parentId?: string;
  depth: number;
}

export interface SubagentToolStartEvent extends HarnessEventBase {
  type: 'subagent_tool_start';
  toolCallId: string;
  subagentSessionId: string;
  agentType: string;
  innerToolCallId: string;
  toolName: string;
  args?: unknown;
  parentId?: string;
  depth: number;
}

export interface SubagentToolEndEvent extends HarnessEventBase {
  type: 'subagent_tool_end';
  toolCallId: string;
  subagentSessionId: string;
  agentType: string;
  innerToolCallId: string;
  toolName: string;
  output: unknown;
  isError: boolean;
  parentId?: string;
  depth: number;
}

export interface SubagentEndEvent extends HarnessEventBase {
  type: 'subagent_end';
  toolCallId: string;
  subagentSessionId: string;
  agentType: string;
  output: unknown;
  isError: boolean;
  durationMs: number;
  parentId?: string;
  depth: number;
}

// ---------------------------------------------------------------------------
// Goal events (§4.7 / §10.2).
//
// Goals are a standing objective attached to a session that survives across
// turns. While a goal is `active`, the harness invokes a separate judge
// model after every assistant turn and dispatches its verdict
// (`done` / `continue` / `waiting`). See §4.7 for the full lifecycle.
// ---------------------------------------------------------------------------

export interface GoalSetEvent extends HarnessEventBase {
  type: 'goal_set';
  goal: GoalState;
}

export interface GoalJudgedEvent extends HarnessEventBase {
  type: 'goal_judged';
  goalId: string;
  decision: GoalJudgeDecision;
  turnsUsed: number;
  maxTurns: number;
}

export interface GoalDoneEvent extends HarnessEventBase {
  type: 'goal_done';
  goalId: string;
  reason: string;
  turnsUsed: number;
}

/**
 * Reason discriminator for `goal_paused`. The three `judge_*` variants
 * replace the legacy catch-all `'judge_failed'`; emitters classify the
 * failure mode so subscribers can distinguish a recoverable transient
 * timeout from a malformed-verdict bug or a non-transient provider error.
 */
export type GoalPausedReason =
  | 'requested'
  | 'budget_exhausted'
  | 'judge_timeout'
  | 'judge_provider_error'
  | 'judge_invalid_verdict';

export interface GoalPausedEvent extends HarnessEventBase {
  type: 'goal_paused';
  goalId: string;
  reason: GoalPausedReason;
}

export interface GoalResumedEvent extends HarnessEventBase {
  type: 'goal_resumed';
  goalId: string;
}

export interface GoalClearedEvent extends HarnessEventBase {
  type: 'goal_cleared';
  goalId: string;
}

// ---------------------------------------------------------------------------
// Workspace events (§2.7 / §10.2).
//
// Emitted when a workspace transitions through lifecycle states (initial
// resolve, ready, destroying, destroyed) and when the provider's
// create/resume hook throws. `sessionId` and `resourceId` are populated
// for `per-session` / `per-resource` ownership; `shared` workspaces emit
// at the harness level with both fields absent.
// ---------------------------------------------------------------------------

export interface WorkspaceStatusChangedEvent extends HarnessEventBase {
  type: 'workspace_status_changed';
  sessionId?: string;
  resourceId?: string;
  providerId?: string;
  status: 'initializing' | 'ready' | 'destroying' | 'destroyed' | 'lost' | 'error';
}

export interface WorkspaceErrorEvent extends HarnessEventBase {
  type: 'workspace_error';
  sessionId?: string;
  resourceId?: string;
  providerId?: string;
  error: { name: string; message: string };
}

export interface WorkspaceActionJournalUnsupportedEvent extends HarnessEventBase {
  type: 'workspace_action_journal_unsupported';
  resourceId: string;
  threadId: string;
  toolName: string;
  /** Mirrors `HarnessWorkspaceActionKind` — kept as a union here to avoid a
   * cross-module import cycle. Includes the new `'network'` and `'mcp'`
   * kinds that the classifier now recognizes. */
  actionKind: 'file' | 'command' | 'network' | 'mcp';
  operation: string;
}

export type HarnessEvent =
  | SessionCreatedEvent
  | SessionClosingEvent
  | SessionClosedEvent
  | SessionEvictedEvent
  | SessionDeletedEvent
  | ArtifactCreatedEvent
  | PermissionProfileAppliedEvent
  | ModeChangedEvent
  | ModelChangedEvent
  | ModelOverrideSetEvent
  | StateChangedEvent
  | PermissionGrantedEvent
  | PermissionRevokedEvent
  | PermissionPolicyChangedEvent
  | AgentStartEvent
  | MessageStartEvent
  | MessageUpdateEvent
  | MessageEndEvent
  | ToolInputStartEvent
  | ToolInputDeltaEvent
  | ToolInputEndEvent
  | ToolStartEvent
  | ToolUpdateEvent
  | ShellOutputEvent
  | TaskUpdatedEvent
  | OMStatusEvent
  | OMObservationStartEvent
  | OMObservationEndEvent
  | OMObservationFailedEvent
  | OMReflectionStartEvent
  | OMReflectionEndEvent
  | OMReflectionFailedEvent
  | OMBufferingStartEvent
  | OMBufferingEndEvent
  | OMBufferingFailedEvent
  | OMActivationEvent
  | OMThreadTitleUpdatedEvent
  | ToolEndEvent
  | AgentEndEvent
  | SuspensionRequiredEvent
  | SuspensionResolvedEvent
  | SandboxAccessRequestedEvent
  | SandboxAccessResolvedEvent
  | TaskCancellationRequestedEvent
  | QueueItemCancelledEvent
  | QueueItemExpiredEvent
  | QueueItemStartedEvent
  | QueueItemReplayedEvent
  | ThreadCreatedEvent
  | ThreadRenamedEvent
  | ThreadDeletedEvent
  | ThreadClonedEvent
  | ThreadSettingsChangedEvent
  | SubagentStartEvent
  | SubagentTextDeltaEvent
  | SubagentToolStartEvent
  | SubagentToolEndEvent
  | SubagentEndEvent
  | GoalSetEvent
  | GoalJudgedEvent
  | GoalDoneEvent
  | GoalPausedEvent
  | GoalResumedEvent
  | GoalClearedEvent
  | WorkspaceStatusChangedEvent
  | WorkspaceErrorEvent
  | WorkspaceActionJournalUnsupportedEvent
  | CustomEvent;

export type HarnessEventListener = (event: HarnessEvent) => void | Promise<void>;
export type HarnessEventUnsubscribe = () => void;

export const HARNESS_EVENT_ID_PREFIX = 'harness-v1';

export interface ParsedHarnessEventId {
  epoch: string;
  sequence: number;
}

export function formatHarnessEventId(epoch: string, sequence: number): string {
  if (epoch.length === 0 || epoch.includes(':')) {
    throw new HarnessValidationError('eventId.epoch', 'epoch must be non-empty and must not contain ":"');
  }
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new HarnessValidationError('eventId.sequence', 'sequence must be a non-negative safe integer');
  }
  return `${HARNESS_EVENT_ID_PREFIX}:${epoch}:${sequence}`;
}

export function parseHarnessEventId(eventId: string): ParsedHarnessEventId {
  const parts = eventId.split(':');
  if (parts.length !== 3 || parts[0] !== HARNESS_EVENT_ID_PREFIX || parts[1] === '' || parts[2] === '') {
    throw new HarnessValidationError('lastEventId', 'expected event id grammar harness-v1:<epoch>:<seq>');
  }
  const sequenceText = parts[2]!;
  if (!/^(0|[1-9][0-9]*)$/.test(sequenceText)) {
    throw new HarnessValidationError('lastEventId', 'event id sequence must be an unsigned decimal integer');
  }
  const sequence = Number(sequenceText);
  if (!Number.isSafeInteger(sequence)) {
    throw new HarnessValidationError('lastEventId', 'event id sequence must be within JavaScript safe integer range');
  }
  return { epoch: parts[1]!, sequence };
}

export function snapshotHarnessEventForJson(value: unknown, path = 'event'): JsonValue {
  try {
    const encoded = JSON.stringify(value, harnessEventJsonReplacer);
    if (encoded === undefined) {
      throw new HarnessValidationError(path, 'must be JSON-serializable for event replay');
    }
    return JSON.parse(encoded) as JsonValue;
  } catch (err) {
    if (err instanceof HarnessValidationError) throw err;
    throw new HarnessValidationError(path, 'must be JSON-serializable for event replay');
  }
}

export function projectHarnessPublicError(err: unknown): { code: string; message: string } {
  if (err instanceof Error) {
    return { code: getHarnessPublicErrorCode(err) ?? err.name ?? 'harness.message_failed', message: err.message };
  }
  return { code: 'harness.message_failed', message: String(err) };
}

function harnessEventJsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      ...projectHarnessPublicError(value),
    };
  }
  return value;
}

// ---------------------------------------------------------------------------
// Emitter.
// ---------------------------------------------------------------------------

/**
 * Shape of an event before `emit()` stamps the framework fields. Callers
 * provide the type-discriminated payload; the emitter fills in `id`,
 * `timestamp`, `sessionId` (when configured), and (optionally)
 * `subagentSessionId` / `runId` / `signalId` / `queuedItemId`.
 *
 * Distributes Omit over the union so the discriminator is preserved.
 */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

export type EmitInput = DistributiveOmit<HarnessEvent, 'id' | 'timestamp' | 'sessionId'>;

/**
 * Per-emitter scope applied to every event the emitter publishes. Used so
 * the Session emitter automatically stamps `sessionId`; harness-level
 * emitters leave it unset.
 */
export interface EmitterScope {
  sessionId?: string;
}

/**
 * Tiny pub/sub primitive used by `Session` and `Harness`. Listeners are
 * dispatched in registration order. A throwing or rejecting listener is
 * isolated (logged to console) so a buggy subscriber cannot disrupt the
 * producer or other listeners.
 *
 * Event IDs are formatted `harness-v1:<epoch>:<seq>`; the epoch is a
 * per-emitter UUID materialized on first emission/read unless a persisted
 * epoch is supplied. Clients that have buffered an `id` from a previous epoch
 * and rejoin can detect mismatch and reset.
 */
export class EventEmitter {
  private readonly listeners: HarnessEventListener[] = [];
  private epoch?: string;
  private seq: number;
  private readonly scope: EmitterScope;
  private readonly onEvent?: HarnessEventListener;

  constructor(
    scope: EmitterScope = {},
    opts: { onEvent?: HarnessEventListener; epoch?: string; nextSequence?: number } = {},
  ) {
    this.scope = scope;
    this.onEvent = opts.onEvent;
    this.epoch = opts.epoch;
    this.seq = opts.nextSequence ?? 0;
    formatHarnessEventId(this.epoch ?? 'pending-epoch', this.seq);
  }

  subscribe(listener: HarnessEventListener): HarnessEventUnsubscribe {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) this.listeners.splice(index, 1);
    };
  }

  emit(event: EmitInput, overrides?: { sessionId?: string }): HarnessEvent {
    const sessionId = overrides?.sessionId ?? this.scope.sessionId;
    this.validateCustomEvent(event, sessionId);
    const stamped = {
      ...event,
      id: formatHarnessEventId(this.epochId, this.seq++),
      timestamp: Date.now(),
      ...(sessionId !== undefined && { sessionId }),
    } as HarnessEvent;
    this.dispatch(stamped);
    return stamped;
  }

  /**
   * Re-emit an already-stamped event (e.g. when a Harness bridges a Session
   * event into its own subscriber pool). The original `id` / `timestamp` /
   * `sessionId` are preserved; the bridging emitter does NOT re-stamp.
   */
  forward(event: HarnessEvent): void {
    this.dispatch(event);
  }

  /** Number of currently registered listeners — for tests. */
  get listenerCount(): number {
    return this.listeners.length;
  }

  /** Current epoch id — for tests and for diagnostics on rehydrate. */
  get epochId(): string {
    this.epoch ??= randomUUID();
    return this.epoch;
  }

  private validateCustomEvent(event: EmitInput, sessionId: string | undefined): void {
    const eventType = (event as { type?: unknown }).type;
    if (typeof eventType !== 'string' || RESERVED_EVENT_TYPES.has(eventType)) return;

    assertCustomEventType(eventType);
    if (Object.prototype.hasOwnProperty.call(event, 'payload')) {
      assertJsonSerializable(eventType, sessionId, (event as { payload?: unknown }).payload);
    }
  }

  private dispatch(event: HarnessEvent): void {
    if (this.onEvent) {
      try {
        const result = this.onEvent(event);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(err => console.error('[harness/v1] event persistence rejected:', err));
        }
      } catch (err) {
        console.error('[harness/v1] event persistence threw:', err);
      }
    }
    // Snapshot before iteration: a listener may call its own `unsubscribe()`
    // (or another listener's) synchronously, and `unsubscribe()` mutates
    // `this.listeners` via `splice()`. Iterating the live array would skip
    // the sibling that occupied the index of the removed listener.
    for (const listener of [...this.listeners]) {
      try {
        const result = listener(event);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(err => console.error('[harness/v1] event listener rejected:', err));
        }
      } catch (err) {
        console.error('[harness/v1] event listener threw:', err);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers consumed by Session/Harness.
// ---------------------------------------------------------------------------

/**
 * Map `pendingResume.kind` to the suspension event kind. Emitted by
 * `Session` after the pending record commits.
 */
export function suspensionRequiredFor(pending: PendingResume): SuspensionRequiredEvent {
  return {
    type: 'suspension_required',
    id: '',
    timestamp: 0,
    kind: pending.kind,
    toolCallId: pending.toolCallId,
    toolName: pending.toolName,
  } as SuspensionRequiredEvent;
}

/**
 * Map a `SessionRecord` to the payload of `session_created`. Centralized so
 * the Session and Harness emit identical fields.
 */
export function sessionCreatedPayload(
  record: SessionRecord,
): Omit<SessionCreatedEvent, keyof HarnessEventBase | 'type'> {
  return {
    resourceId: record.resourceId,
    threadId: record.threadId,
    parentSessionId: record.parentSessionId,
    modeId: record.modeId,
    modelId: record.modelId,
  };
}

// ---------------------------------------------------------------------------
// Reserved-event metadata (§6.2, §10.3).
//
// Tools emit data via `ctx.writer?.custom({ type: 'data-*', data })` and
// the harness whitelists known `data-*` chunk types in `_drainStreamToEvents`
// to bridge them into typed events. These reserved sets capture the names
// the harness owns so future custom-event surfaces can validate against
// them as a single source of truth.
// ---------------------------------------------------------------------------

/** Harness-owned event types — exhaustive list per spec §6.2 / §10.2. */
const RESERVED_EVENT_TYPES: ReadonlySet<string> = new Set([
  'session_created',
  'session_closing',
  'session_closed',
  'session_evicted',
  'session_deleted',
  'artifact_created',
  'permission_profile_applied',
  'session_pin_overflow',
  'mode_changed',
  'model_changed',
  'model_override_set',
  'state_changed',
  'agent_start',
  'agent_end',
  'message_start',
  'message_update',
  'message_end',
  'om_status',
  'om_observation_start',
  'om_observation_end',
  'om_observation_failed',
  'om_reflection_start',
  'om_reflection_end',
  'om_reflection_failed',
  'om_buffering_start',
  'om_buffering_end',
  'om_buffering_failed',
  'om_activation',
  'om_thread_title_updated',
  'tool_input_start',
  'tool_input_delta',
  'tool_input_end',
  'tool_start',
  'tool_update',
  'shell_output',
  'task_updated',
  'tool_end',
  'suspension_required',
  'suspension_resolved',
  'sandbox_access_requested',
  'sandbox_access_resolved',
  'task_cancellation_requested',
  'queue_item_cancelled',
  'queue_item_expired',
  'queue_item_started',
  'queue_item_replayed',
  'queue_item_failed',
  'queue_item_completed',
  'thread_created',
  'thread_renamed',
  'thread_deleted',
  'thread_cloned',
  'thread_settings_changed',
  'goal_set',
  'goal_judged',
  'goal_done',
  'goal_paused',
  'goal_resumed',
  'goal_cleared',
  'workspace_status_changed',
  'workspace_error',
  'workspace_action_journal_unsupported',
  'permission_granted',
  'permission_revoked',
  'permission_policy_changed',
  'subagent_start',
  'subagent_text_delta',
  'subagent_tool_start',
  'subagent_tool_end',
  'subagent_end',
]);

/** Prefixes reserved for built-in event families (subagent_*, goal_*, etc.). */
const RESERVED_EVENT_PREFIXES: readonly string[] = [
  'subagent_',
  'goal_',
  'queue_',
  'session_',
  'workspace_',
  'thread_',
  'permission_',
];

/**
 * Throws `HarnessValidationError` if `type` collides with a harness-owned
 * event type or omits the required dotted prefix. Custom events must follow
 * `<namespace>.<rest>` per spec §10.3.
 */
/**
 * Predicate matching `assertCustomEventType` — true iff `type` is a
 * valid custom event type (dotted, non-reserved). Used by helpers that
 * need to branch on custom vs built-in events without relying on the
 * brittle `type.includes('.')` heuristic.
 */
export function isCustomEventType(type: string): boolean {
  if (RESERVED_EVENT_TYPES.has(type)) return false;
  for (const prefix of RESERVED_EVENT_PREFIXES) {
    if (type.startsWith(prefix)) return false;
  }
  return type.includes('.');
}

export function assertCustomEventType(type: string): void {
  if (RESERVED_EVENT_TYPES.has(type)) {
    throw new HarnessValidationError('event.type', `"${type}" is a reserved harness event type`);
  }
  for (const prefix of RESERVED_EVENT_PREFIXES) {
    if (type.startsWith(prefix)) {
      throw new HarnessValidationError(
        'event.type',
        `"${type}" uses reserved prefix "${prefix}*" — custom events need a different namespace`,
      );
    }
  }
  if (!type.includes('.')) {
    throw new HarnessValidationError(
      'event.type',
      `custom event "${type}" must be dotted (e.g. "myorg.tool.progress")`,
    );
  }
}

/**
 * Walks an event payload and throws `HarnessEventSerializationError` on the
 * first non-JSON-serializable value. Catches functions, Symbols, BigInts,
 * Dates, Map/Set, typed arrays, class instances with a non-plain prototype,
 * `undefined`, and cyclic refs.
 *
 * `sessionId` is threaded through purely for the error payload.
 */
export function assertJsonSerializable(eventType: string, sessionId: string | undefined, value: unknown): void {
  const seen = new WeakSet<object>();
  walk(value, 'event');

  function fail(path: string, reason: EventSerializationReason): never {
    throw new HarnessEventSerializationError(sessionId, eventType, path, reason);
  }

  function walk(node: unknown, path: string): void {
    if (node === null) return;
    const t = typeof node;
    if (t === 'string' || t === 'number' || t === 'boolean') return;
    if (t === 'undefined') return fail(path, 'undefined');
    if (t === 'function') return fail(path, 'function');
    if (t === 'symbol') return fail(path, 'symbol');
    if (t === 'bigint') return fail(path, 'bigint');

    if (Array.isArray(node)) {
      if (seen.has(node)) return fail(path, 'cyclic');
      seen.add(node);
      for (let i = 0; i < node.length; i++) walk(node[i], `${path}[${i}]`);
      return;
    }

    if (node instanceof Date) return fail(path, 'date');
    if (node instanceof Map) return fail(path, 'map');
    if (node instanceof Set) return fail(path, 'set');
    if (ArrayBuffer.isView(node) || node instanceof ArrayBuffer) return fail(path, 'typed-array');

    if (t === 'object') {
      const proto = Object.getPrototypeOf(node);
      if (proto !== null && proto !== Object.prototype) {
        return fail(path, 'class-instance');
      }
      if (seen.has(node as object)) return fail(path, 'cyclic');
      seen.add(node as object);
      for (const key of Object.keys(node as object)) {
        walk((node as Record<string, unknown>)[key], `${path}.${key}`);
      }
      return;
    }

    fail(path, 'unknown');
  }
}

// Re-export so consumers that import HarnessEvent get the lifecycle import for free.
export type { SessionLifecycleState };
