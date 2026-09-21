/**
 * Harness storage domain — durable session state for `@mastra/core/harness/v1`.
 *
 * The shapes here are JSON-serialisable by contract (see HARNESS_V1_SPEC.md
 * §5.1 "Serialization contract"). No `Date`, no `Map`/`Set`, no functions.
 * Time fields are epoch milliseconds.
 *
 * Threads and messages are NOT in this domain — they live under `MemoryStorage`
 * (see HARNESS_V1_SPEC.md §5.2). The harness layer composes the two.
 */

import type { LogicalMessageIdentity } from '../../../agent/message-list';

// ---------------------------------------------------------------------------
// SessionRecord
// ---------------------------------------------------------------------------

/**
 * Per-session permission rules. Plain JSON — no closures.
 *
 * `categories` holds per-category defaults; `tools` holds per-tool overrides
 * and wins over the category default. See HARNESS_V1_SPEC.md §5.1.
 */
export interface PermissionRules {
  categories: Record<string, 'allow' | 'deny' | 'ask'>;
  tools: Record<string, 'allow' | 'deny' | 'ask'>;
}

/**
 * Session-scoped permission grants. Cleared when the session ends.
 */
export interface SessionGrants {
  categories: string[];
  tools: string[];
}

/**
 * Aggregate token usage counters carried on the session record.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Bounded framework-observed identity/status for a tool execution. Raw tool
 * arguments and results are intentionally excluded from durable Harness state.
 */
export interface HarnessRunToolReceipt {
  toolCallId: string;
  toolName: string;
  status: 'success' | 'error';
}

/**
 * A persisted attachment reference on a queued or pending message.
 *
 * `kind: 'ref'` points at a row in the harness attachment index (the bytes
 * live in BlobStore or whatever the adapter delegates to). Durable refs carry
 * owner, size, digest, and source metadata so recovery can validate the bytes
 * that were admitted.
 * `kind: 'url'` is a remote URL fetched at message-build time.
 */
export type PersistedAttachment =
  | {
      kind: 'ref';
      name: string;
      mimeType: string;
      ownerSessionId: string;
      attachmentId: string;
      bytes: number;
      sha256: string;
      source: AttachmentSource;
      attachmentKind?: HarnessAttachmentKind;
      primitiveType?: HarnessPrimitiveType;
      elementType?: string;
      renderer?: AttachmentRendererDescriptor;
      schemaId?: string;
      metadata?: Record<string, JsonValue>;
      object?: AttachmentObjectPointer;
    }
  | { kind: 'url'; name: string; mimeType: string; url: string };

/**
 * A single item enqueued via `session.queue(...)`. Items added via
 * `session.message(...)` are NOT stored here — they go straight to the
 * agent layer's signal pipeline (see HARNESS_V1_SPEC.md §5.1 comment on
 * `QueuedItem`).
 *
 * `addTools` is intentionally not present: tool implementations are
 * closures and cannot be serialised, so `queue(...)` rejects them at
 * admission rather than dropping them silently after the fact.
 */
export interface QueuedItem {
  id: string;
  /**
   * Idempotency key for this queue admission. Older local-only queue items may
   * not have one yet; durable remote/channel/wakeup admissions must set it.
   */
  admissionId?: string;
  /**
   * Stable hash of the admitted queue inputs. Used with `admissionId` to
   * distinguish exact retries from same-key/different-payload conflicts.
   */
  admissionHash?: string;
  enqueuedAt: number;
  content: string;
  attachments: PersistedAttachment[];
  requestContext?: PersistedRequestContextInput;
  /** Validated native input/response identity captured at queue admission. */
  logicalMessageIdentity?: LogicalMessageIdentity;
  model?: string;
  mode?: string;
  yolo?: boolean;
  /**
   * Origin of this queued item. `'user'` (default) for items enqueued by
   * `session.queue(...)`, `'goal'` for harness-enqueued goal continuations.
   * The harness uses this marker to skip re-judging on continuation turns
   * (otherwise the judge loop would never terminate). See §4.7.
   */
  source?: 'user' | 'goal';
  /** Set when `source === 'goal'`. Identifies which goal produced the item. */
  goalId?: string;
  /**
   * Scheduling priority. Higher values drain first. Items with the same
   * priority drain in FIFO order (lowest `enqueuedAt` wins). Defaults to
   * 0 — equivalent to the legacy FIFO contract.
   */
  priority?: number;
  /**
   * Absolute deadline (epoch ms) past which the item must not start.
   * The drain emits `queue_item_expired`, removes the item, and marks
   * its `queueAdmissionReceipts` entry `failed` in the same CAS write.
   * Omit to opt out of deadline checks.
   */
  deadline?: number;
  /**
   * Absolute earliest-start timestamp (epoch ms). Items whose `notBefore` is
   * in the future remain in `pendingQueue` and are skipped by the scheduler so
   * eligible work behind them can still drain.
   */
  notBefore?: number;
}

/**
 * Outstanding agent suspension. At most one per session — the agent layer
 * can only be in one of {approval, suspension, question, plan} at a time, so
 * the four spec'd shapes collapse into a single tagged record. The actual
 * paused execution state (tool args, suspend payload, resume schema) lives
 * in the workflow snapshot under `MastraStorage.workflows` keyed by `runId`;
 * the harness only persists the pointer needed to call
 * `agent.resumeStream(resumeData, { runId, toolCallId })` plus a small
 * amount of UX surface so a fresh subscriber can render the prompt without
 * re-fetching the snapshot.
 *
 * §5.1f models pending interactions as four separate typed fields
 * (`pendingApproval`/`pendingSuspension`/`pendingQuestion`/`pendingPlan`). This
 * implementation deliberately uses ONE unified `pendingResume` field
 * discriminated by `kind` (see §5.1f "Implementation note"): a single field
 * structurally guarantees the §5.1f one-pending-interaction-per-run slot
 * invariant (two simultaneous pendings are unrepresentable, not merely
 * disallowed), and it carries the `sandbox-access` kind that the four-field
 * shape has no slot for. The four spec interfaces are the per-`kind` payload
 * contracts surfaced through `payload` / the display projection.
 */
export interface PendingResume {
  kind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval' | 'sandbox-access';
  /** Stable pending interaction id used by inbox/route callers. */
  itemId?: string;
  runId: string;
  toolCallId: string;
  /** Populated for tool-approval / tool-suspension; omitted otherwise. */
  toolName?: string;
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
  /**
   * Durable deadline for the user interaction. A live owner arms a local
   * wake-up and storage exposes due rows to the cold-row expiry worker, but the
   * exact expiry-vs-response winner is always committed under the session CAS.
   */
  expiresAt: number;
  /**
   * First-phase expiry marker. While present the row remains discoverable by
   * the due scan until durable queue/signal cleanup succeeds and a second CAS
   * clears `pendingResume`.
   */
  expiryStartedAt?: number;
  /** Present when this pending resume belongs to a queued turn. */
  queuedItemId?: string;
  /**
   * Present when this pending resume belongs to an owned `signal()` turn whose
   * durable per-`signalId` result evidence is left `pending` while suspended.
   * On terminal (non-suspended) resume the harness settles this signal's
   * evidence and projects `signal_completed`/`signal_failed` (§4.2f) so a
   * suspended owned signal does not stay pending forever.
   */
  originSignalId?: string;
  /** Mode whose backing agent produced this pending resume. */
  modeId?: string;
  /**
   * Per-turn `yolo` carried forward across suspend → resume so a queued turn
   * that requested auto-grant (`QueueOverrides.yolo`) keeps auto-granting
   * tool-approval interrupts on the resumed run too. `deny` is still a hard
   * block; `yolo` never bypasses it. Absent ⇒ no auto-grant on resume.
   */
  yolo?: boolean;
  /**
   * Runtime identities captured when this work was admitted. Recovery uses
   * these stable ids to fail closed if the process restarts with a different
   * execution surface.
   */
  runtimeDependencies?: HarnessRuntimeDependencyRefs;
  /**
   * §5.1 caller request context (the `app` metadata bag + trusted `channel`
   * projection) captured from the turn that SUSPENDED, so a `respondTo*` resume
   * rebuilds the SAME app bag the suspended run carried — mirroring how
   * `QueuedItem.requestContext` is threaded back in on queue drain. This is the
   * ORIGINAL turn's context, never the responder's. Absent on legacy rows ⇒
   * resume rebuilds with no caller app bag (prior behaviour). Storage-internal:
   * stripped from the public `SessionDisplayPending` / `PendingInteraction`
   * projections alongside `runtimeDependencies`.
   */
  requestContext?: PersistedRequestContextInput;
  /**
   * Immutable model-visible tool-name ceiling captured from a replacement
   * toolset turn. Reapplied on resume so processors cannot expand the surface.
   */
  toolSurfaceFence?: string[];
  /**
   * Cumulative provider usage already committed for this run when it parked.
   * Resume outputs restore that cumulative counter, so Harness subtracts this
   * durable baseline before adding the resumed segment to session usage.
   */
  accountedTokenUsage?: TokenUsage;
  /**
   * Framework-minted receipts observed before this run suspended. They let a
   * resumed terminal report cite pre-suspension tool work after process
   * rehydration without persisting tool inputs or outputs.
   */
  toolReceipts?: HarnessRunToolReceipt[];
  /** Receipt collection exceeded its bounded count/byte budget; verify closed. */
  toolReceiptsOverflow?: boolean;
  /**
   * Idempotency marker. Set by the resume helper before calling
   * `agent.resumeStream(...)` and observed on replay so a crash between
   * "wrote resumedAt" and "cleared pendingResume" does not double-resume.
   */
  resumedAt?: number;
  /**
   * Durable deadline for resolving an admitted resume whose process owner
   * disappeared before terminal evidence was committed. This is stamped in
   * the same CAS as `resumedAt`; storage indexes it as the row's next due
   * action so recovery does not depend on a browser reconnect.
   */
  resumeRecoveryAt?: number;
  /**
   * First-phase marker for stale admitted-resume cleanup. While present, the
   * row remains due/discoverable until queue/signal failure evidence is durable
   * and a second exact-generation CAS clears `pendingResume`.
   */
  resumeRecoveryStartedAt?: number;
  /**
   * Kind-specific UX surface — opaque to the harness, rendered by the UI.
   * Populated at suspend-capture time from the agent's `suspendPayload`.
   */
  payload?: {
    // tool-approval
    toolCategory?: string;
    input?: unknown;
    /** Reasons a conditional approval predicate surfaced (§10.2 `approvalReasons`). */
    approvalReasons?: string[];
    // tool-suspension
    suspendData?: unknown;
    // question
    question?: string;
    options?: { label: string; description?: string }[];
    selectionMode?: 'single_select' | 'multi_select';
    // plan-approval
    title?: string;
    plan?: string;
    // sandbox-access
    sandboxAccess?: {
      semanticType: 'file' | 'command' | 'network' | 'mcp' | 'custom';
      reason?: string;
      payload?: JsonValue;
    };
  };
  /**
   * Plan-approval only. Frozen at registration from the submitting mode's
   * `HarnessMode.transitionsTo`. A mode switch while the plan is pending does
   * not retarget the approval.
   */
  transitionModeId?: string;
  /**
   * Plan-approval only. Idempotency markers for the mode-flip side effect.
   * See HARNESS_V1_SPEC.md §5.1.
   */
  approvedTransitionModeId?: string;
  modeTransitionAppliedAt?: number;
}

/**
 * Verdict returned by the goal judge model after evaluating an assistant turn
 * against the current goal objective. See HARNESS_V1_SPEC.md §4.7.
 */
export interface GoalJudgeDecision {
  decision: 'done' | 'continue' | 'waiting';
  reason: string;
  judgedAt: number;
}

/**
 * Active goal state. Set via `session.setGoal(...)`, evaluated by the judge
 * model after each assistant turn. See HARNESS_V1_SPEC.md §4.7.
 */
export interface GoalState {
  id: string;
  objective: string;
  status: 'active' | 'paused' | 'done';
  turnsUsed: number;
  maxTurns: number;
  judgeModelId: string;
  createdAt: number;
  /** Most recent judge verdict, persisted so subscribers can read it. */
  lastDecision?: GoalJudgeDecision;
}

/**
 * Per-session workspace state, only populated under `kind: 'per-session'`
 * with a `resumable: true` provider.
 */
export interface SessionWorkspaceState {
  providerId: string;
  state: unknown;
}

export type AttachmentSource = 'inline' | 'preupload' | 'url' | 'provider';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type HarnessAttachmentKind = 'file' | 'primitive' | 'element';

export type HarnessPrimitiveType = 'text' | 'markdown' | 'json' | 'table' | 'chart-data' | 'selection' | 'citation';

export interface AttachmentRendererDescriptor {
  id: string;
  version?: string;
}

export interface AttachmentObjectPointer {
  providerId: string;
  objectKey: string;
  etag?: string;
  storageClass?: string;
}

export interface AttachmentSemanticMetadata {
  kind?: HarnessAttachmentKind;
  primitiveType?: HarnessPrimitiveType;
  elementType?: string;
  renderer?: AttachmentRendererDescriptor;
  schemaId?: string;
  metadata?: Record<string, JsonValue>;
  object?: AttachmentObjectPointer;
}

export type AttachmentReferenceSource =
  | 'queued_item'
  | 'queue_receipt'
  | 'current_run'
  | 'message_history'
  | 'channel_inbox'
  | 'wakeup'
  | 'outbox';

/**
 * Durable session state. Loaded on hydration, flushed under the session's
 * write lease (see HARNESS_V1_SPEC.md §5.8).
 */
export interface SessionRecord {
  /**
   * Immutable Harness namespace. The runtime writes `default` for single
   * harness/local storage and the registered Mastra harness key when known.
   */
  harnessName: string;
  id: string;
  resourceId: string;
  threadId: string;
  /**
   * Storage-assigned lifetime identity used by the native durable projection
   * fence. Callers must not choose or rotate this value; adapters assign it
   * only when the session row is first created and preserve it for the row's
   * entire lifetime.
   */
  sessionIncarnation?: string;
  parentSessionId?: string;

  /**
   * `'subagent-tool'` opts the record into the auto-close-on-`subagent_end`
   * rule (HARNESS_V1_SPEC.md §5.6). `'top-level'` covers regular user
   * sessions and programmatic child sessions.
   */
  origin: 'top-level' | 'subagent-tool';

  /**
   * Depth of this session in the subagent tree. `0` for top-level sessions;
   * `parent.subagentDepth + 1` for sessions spawned via `spawn_subagent`.
   * Used by the built-in spawn tool to enforce `subagents.maxDepth`. Read
   * once at hydration; written once at session create. Defaults to `0`
   * when absent on records persisted before this field landed.
   */
  subagentDepth?: number;

  /**
   * The `subagents.types` key this session was spawned/delegated under, when it
   * is a subagent child (M4). Persisted so a child hydrated DIRECTLY by id — not
   * only via the parent's delegation-reattach — can re-resolve its
   * `SubagentDefinition` and restore the per-subagent overrides (`tools`,
   * `workspace`, and the `toolAllowlist` HARD capability scope) before any turn
   * or queue drain. Without this a restored/other-instance hydrate of a durable
   * delegated child would run fail-OPEN (its allowlist lost). Absent on
   * top-level sessions and on records persisted before this field landed.
   */
  subagentTypeId?: string;

  /**
   * True when this subagent child was created with a `toolAllowlist` (a HARD
   * capability scope), persisted so hydrate can FAIL CLOSED rather than fail
   * OPEN on config drift (M4): if `subagentTypeId`'s definition was DELETED from
   * config while this child persists, the allowlist cannot be re-resolved — but
   * because this flag records that the child WAS scoped, hydrate restores an
   * empty allowlist (deny every non-builtin tool) instead of leaving it unset.
   * Distinguishes a deleted-scoped child from a legitimately-unscoped one (which
   * leaves the flag false/absent and is correctly left unrestricted). Absent on
   * records persisted before this field landed — such a legacy scoped child
   * whose type is later deleted is indistinguishable from an unscoped one and
   * cannot fail closed; newly created scoped subagents always carry the flag.
   */
  subagentToolAllowlistScoped?: boolean;

  /**
   * True when the session was created with `threadId: { fresh: true }` and
   * therefore owns the underlying thread under `MemoryStorage`. Read by the
   * harness layer on cascade-delete to decide whether to tear the thread
   * down with the session.
   */
  ownsThread: boolean;

  // Per-turn defaults
  modeId: string;
  modelId: string;
  subagentModelOverrides: Record<string, string>;

  // Permissions
  permissionRules: PermissionRules;
  sessionGrants: SessionGrants;
  /**
   * §4.2e seed provenance: the stable hash of the `permissionRules` last SEEDED
   * by a mode entry (create / switchMode / plan-approval transition). Runtime
   * `setPolicy`/grant mutators do NOT update it, so `hash(permissionRules) ===
   * permissionRulesSeedHash` means "untouched since seed". On rehydrate the
   * harness uses this to re-seed an UNTOUCHED session when the mode's declared
   * permissions changed since it was persisted, while leaving runtime-overlaid
   * sessions alone. Absent on legacy records ⇒ no reconcile (leave as-is).
   */
  permissionRulesSeedHash?: string;

  // Counters
  tokenUsage: TokenUsage;

  // In-flight state — resumable across restarts.
  // At most one outstanding agent suspension per session (see PendingResume).
  pendingQueue: QueuedItem[];
  pendingResume?: PendingResume;
  /**
   * Narrow durable operational projection of the session's currently active or
   * recently interrupted run (§5.1a.2 / §5.1e). Not an admission ledger, event
   * log, outbox receipt, or replacement for agent/workflow run storage. Carries
   * the stable runtime identities used for fail-closed hydration repair after a
   * restart so a run is never silently resumed against a drifted tool/model/
   * workspace surface.
   */
  currentRun?: HarnessRunOperationalState;
  /**
   * Bounded coalesced assistant drafts for active/recent runs. Keyed by
   * `runId`. Durable snapshot consumers may render these as in-progress rows
   * until thread messages or operation-result evidence supersede them.
   */
  assistantDrafts?: Record<string, HarnessAssistantDraft>;
  queueAdmissionReceipts?: Record<string, QueueAdmissionReceipt>;
  inboxResponseReceipts?: Record<string, InboxResponseReceipt>;
  /** Latest bounded expiry evidence, keyed by exact pending-generation hash. */
  expiredPendingInteractions?: Record<string, ExpiredPendingInteractionReceipt>;

  // Legacy unsupported Harness OM intent. Current Harness builds never create
  // this field: enabled Harness OM and per-session model switches reject, while
  // OM is configured directly on the Agent Memory instance. A hydrated record
  // carrying this field parks turn/queue dispatch until
  // `session.om.clearOverride()` removes it. The optional shape remains readable
  // only so old rows can recover without losing admitted work.
  observationalMemory?: {
    scope?: 'thread' | 'resource';
    observerModelId?: string;
    reflectorModelId?: string;
    observationThreshold?: number;
    reflectionThreshold?: number;
  };

  // Active goal
  goal?: GoalState;

  // Per-session workspace state
  workspace?: SessionWorkspaceState;

  // User-defined custom state (typed via TState generic on the Harness)
  state: unknown;

  // Lifecycle
  createdAt: number;
  lastActivityAt: number;
  closingAt?: number;
  closeDeadlineAt?: number;
  closedAt?: number;

  // Write-concurrency — see HARNESS_V1_SPEC.md §5.8.
  /** Monotonically incremented on every successful saveSession. */
  version: number;
  /** Owner Harness instance id, or undefined when no live Session holds the lease. */
  ownerId?: string;
  /** Epoch ms — when the current lease TTLs out. */
  leaseExpiresAt?: number;
  /**
   * Durable marker set when `Session.cancel(...)` runs. Once present, pending
   * resume attempts fail closed instead of resurrecting cancelled work after a
   * restart or race. First writer wins; later cancel attempts preserve the
   * original requestedAt/reason/requestedBy tuple.
   */
  cancelRequest?: {
    requestedAt: number;
    reason?: string;
    /** Free-form actor label, for example an A2A task id or route id. */
    requestedBy?: string;
  };
}

/** The schema identity for the first native durable session projection. */
export const HARNESS_SESSION_RECORD_POST_IMAGE_SCHEMA = 'session_record_post_image' as const;
export const HARNESS_SESSION_RECORD_POST_IMAGE_SCHEMA_VERSION = 1 as const;

/**
 * Configuration for the opt-in native record post-image capability. The
 * capability is disabled by default so adapters without the external schema
 * cannot claim atomic projection durability accidentally.
 */
export interface HarnessSessionRecordProjectionConfig {
  enabled?: boolean;
  /** Maximum UTF-8 bytes in one serialized post-image payload. */
  maxPayloadBytes?: number;
  /** Maximum delivery attempts before the intent is dead-lettered. */
  maxAttempts?: number;
  /** Maximum unsettled intents retained for this adapter namespace. */
  maxPendingIntents?: number;
  /** Maximum UTF-8 bytes retained by unsettled intents in this namespace. */
  maxPendingBytes?: number;
}

export type HarnessSessionRecordProjectionOption = boolean | HarnessSessionRecordProjectionConfig;

export type HarnessSessionRecordProjectionLifecycle = 'active' | 'closing' | 'closed';

/** Privacy-safe pending-interaction subset; raw suspend payloads are excluded. */
export interface HarnessSessionRecordProjectionPendingResume {
  kind: PendingResume['kind'];
  itemId?: string;
  runId: string;
  toolCallId: string;
  toolName?: string;
  source: PendingResume['source'];
  subagentToolCallId?: string;
  requestedAt: number;
  expiresAt: number;
  queuedItemId?: string;
  originSignalId?: string;
  modeId?: string;
  resumedAt?: number;
  resumeRecoveryAt?: number;
}

/** Bounded operational run subset retained for restart/read-model recovery. */
export interface HarnessSessionRecordProjectionRun {
  runId: string;
  status: HarnessRunStatus;
  modeId: string;
  modelId: string;
  startedAt: number;
  updatedAt: number;
  terminalAt?: number;
  finishReason?: string;
}

/**
 * Deterministic, bounded, record-derived payload for the native consumer.
 * Deliberately excludes state, workspace, permission/grant data, receipts,
 * OM configuration, raw queue items, raw tool/model payloads, and assistant
 * draft text. Live drafts remain owned by the display and transcript lanes.
 */
export interface HarnessSessionRecordPostImage {
  schema: typeof HARNESS_SESSION_RECORD_POST_IMAGE_SCHEMA;
  schemaVersion: typeof HARNESS_SESSION_RECORD_POST_IMAGE_SCHEMA_VERSION;
  sessionId: string;
  threadId: string;
  resourceId: string;
  parentSessionId?: string;
  modeId: string;
  modelId: string;
  createdAt: number;
  lastActivityAt: number;
  lifecycle: HarnessSessionRecordProjectionLifecycle;
  tokenUsage: TokenUsage;
  queueDepth: number;
  pendingResume?: HarnessSessionRecordProjectionPendingResume;
  currentRun?: HarnessSessionRecordProjectionRun;
}

export type HarnessSessionRecordProjectionStatus = 'pending' | 'claimed' | 'applied' | 'failed' | 'dead';

/** One atomically committed session post-image delivery intent. */
export interface HarnessSessionRecordProjectionIntent {
  id: string;
  operationId: string;
  harnessName: string;
  sessionId: string;
  sessionIncarnation: string;
  resourceId: string;
  threadId: string;
  revision: number;
  payloadDigest: string;
  payloadBytes: number;
  payload: HarnessSessionRecordPostImage;
  status: HarnessSessionRecordProjectionStatus;
  attempts: number;
  claimId?: string;
  claimExpiresAt?: number;
  nextAttemptAt?: number;
  appliedAt?: number;
  failedAt?: number;
  deadAt?: number;
  lastError?: { code: string; message: string; retryable?: boolean };
  createdAt: number;
  updatedAt: number;
}

/** Current lifetime fence for a session id, retained across hard deletion. */
export interface HarnessSessionRecordProjectionFence {
  harnessName: string;
  sessionId: string;
  sessionIncarnation: string;
  resourceId: string;
  threadId: string;
  revision: number;
  state: 'active' | 'deleted';
  updatedAt: number;
}

export interface ClaimSessionRecordProjectionIntentsInput {
  harnessName?: string;
  resourceId?: string;
  sessionId?: string;
  claimId: string;
  limit: number;
  now: number;
  claimTtlMs: number;
}

export interface RenewSessionRecordProjectionClaimInput {
  harnessName?: string;
  operationId: string;
  sessionId: string;
  sessionIncarnation: string;
  revision: number;
  payloadDigest: string;
  claimId: string;
  now: number;
  claimTtlMs: number;
}

export type SessionRecordProjectionAckStatus = 'applied' | 'duplicate' | 'fenced';

export interface AckSessionRecordProjectionInput {
  harnessName?: string;
  operationId: string;
  sessionId: string;
  sessionIncarnation: string;
  revision: number;
  payloadDigest: string;
  claimId: string;
  acknowledgedAt?: number;
}

export interface AckSessionRecordProjectionResult {
  status: SessionRecordProjectionAckStatus;
  operationId: string;
  sessionId: string;
  sessionIncarnation: string;
  revision: number;
  payloadDigest: string;
}

export interface FailSessionRecordProjectionInput {
  harnessName?: string;
  operationId: string;
  sessionId: string;
  sessionIncarnation: string;
  revision: number;
  payloadDigest: string;
  claimId: string;
  failedAt?: number;
  retryAt?: number;
  dead?: boolean;
  error: { code: string; message: string; retryable?: boolean };
}

export interface SessionRecordProjectionQueuePressureInput {
  harnessName?: string;
  resourceId?: string;
  sessionId?: string;
}

export interface SessionRecordProjectionQueuePressure {
  pendingIntents: number;
  pendingBytes: number;
  claimedIntents: number;
  failedIntents: number;
  deadIntents: number;
  appliedIntents: number;
  oldestPendingAt?: number;
  maxPendingIntents: number;
  maxPendingBytes: number;
  overLimit: boolean;
}

/** §5.1e — lifecycle status of a `HarnessRunOperationalState`. */
export type HarnessRunStatus = 'starting' | 'running' | 'waiting' | 'resuming' | 'completed' | 'failed' | 'interrupted';

/** §5.1e — which entry-point operation a run is executing. */
export type HarnessRunOperationRef =
  | { kind: 'signal'; admissionId?: string; admissionHash?: string; signalId?: string; channelInboxItemId?: string }
  | {
      kind: 'queue';
      queuedItemId: string;
      admissionId?: string;
      admissionHash?: string;
      signalId?: string;
      channelInboxItemId?: string;
    }
  | { kind: 'sync-generate'; operationId: string }
  | { kind: 'use-skill'; skillName: string; admissionId?: string; admissionHash?: string; signalId?: string }
  | { kind: 'inbox-response'; itemId: string; responseId: string; actionReceiptId?: string; resumeAttemptId: string };

/**
 * §5.1e — durable operational state for the session's current/most-recent run. Holds the stable
 * runtime identities (registry/config IDs only — never live closures or client objects) needed to
 * rehydrate or FAIL CLOSED after restart. Persisted at run-start and on each lifecycle transition.
 */
export interface HarnessRunOperationalState {
  runId: string;
  /** Mirrors the owning SessionRecord namespace; a mismatch is corrupt state, not a retargeting hint. */
  harnessName: string;
  traceId?: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  /** Resolved from the effective mode's `HarnessMode.agentId` at run start, persisted with mode/model. */
  agentId: string;
  /** Stable tool registry/config IDs only — not names, schemas, toolset objects, or client callbacks. */
  toolIds?: string[];
  /** Stable MCP binding/server IDs only — not transport sessions, subscriptions, or callbacks. */
  mcpBindingIds?: string[];
  workspaceProviderId?: string;
  /**
   * Snapshot of `HarnessConfig.runtimeCompatibilityGeneration` at run start. When present on a
   * non-terminal `currentRun`, hydration requires the current config's generation to match exactly;
   * a mismatch means the runtime-dependency surface drifted and the harness fails closed. Absence
   * falls back to ID-only validation.
   */
  runtimeCompatibilityGeneration?: string;
  /**
   * `true` when the run admitted a per-run executable tool surface that cannot be reconstructed from
   * stable persisted tool identities (e.g. `signal({ addTools })` / `useSkill({ addTools })` /
   * closure-backed extraTools). Those implementations are process-local closures that never persist,
   * so on hydration the harness fails closed for any non-terminal run carrying this flag (§5.7/§6.2).
   * Per-run; subagent runs do not inherit a parent's value.
   */
  nonRehydratableToolSurface?: boolean;
  requestContext?: PersistedRequestContextInput;
  operation: HarnessRunOperationRef;
  modeId: string;
  modelId: string;
  yolo?: boolean;
  /**
   * Pending item ids duplicated only for quick inspection after hydration. The authoritative
   * payloads remain the canonical `pendingResume`/pending fields; hydration rebuilds this array from
   * those — extra, missing, or wrong-kind entries do not authorize a pending item.
   */
  pendingItems?: Array<{
    itemId: string;
    kind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
    requestedAt: number;
  }>;
  status: HarnessRunStatus;
  startedAt: number;
  updatedAt: number;
  terminalAt?: number;
  finishReason?: string;
  error?: { code: HarnessRowErrorCode; message: string };
}

export type HarnessAssistantDraftStatus = 'streaming' | 'interrupted' | 'completed' | 'failed';
export type HarnessAssistantDraftFinishReason = 'complete' | 'aborted' | 'error';

/**
 * §5.1x — bounded durable projection of an assistant response that is still
 * being streamed or has just terminalized. This is not transcript history; the
 * thread message log and operation-result evidence remain authoritative for
 * completed content. It exists so first-party clients can reload/reconnect and
 * still render the latest coalesced assistant draft without replaying every
 * `text_delta`.
 */
export interface HarnessAssistantDraft {
  runId: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  signalId?: string;
  queuedItemId?: string;
  messageId?: string;
  text: string;
  status: HarnessAssistantDraftStatus;
  startedAt: number;
  updatedAt: number;
  terminalAt?: number;
  finishReason?: HarnessAssistantDraftFinishReason;
  truncated?: boolean;
}

// ---------------------------------------------------------------------------
// Span-summary (S3/S4/O1/O2/O6) — durable per-run history.
//
// One row per COMPLETED run, written once (first terminal wins) at the run's
// non-suspended terminal. This is analytics HISTORY — distinct from the
// single-run, fail-closed `HarnessRunOperationalState` recovery lane and never
// overwritten in place. Token usage is stored RAW; cost is a consumer concern
// (Doxa prices usage + modelId). PII-light: NO tool inputs/outputs are stored,
// only counts/durations.
// ---------------------------------------------------------------------------

/** Terminal disposition of a run in the durable summary. */
export type HarnessRunSummaryStatus = 'completed' | 'failed' | 'interrupted';

/** Compact per-run tool aggregate stored on a run summary (bounded by distinct tool names; no per-call payloads). */
export interface HarnessRunSummaryToolRollup {
  count: number;
  errors: number;
  totalDurationMs: number;
  maxDurationMs: number;
  perTool: Record<string, { count: number; errors: number; totalDurationMs: number }>;
}

/** Durable summary of one completed run (span-summary O1/O2). */
export interface HarnessRunSummary {
  harnessName: string;
  runId: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  agentId: string;
  modeId: string;
  modelId: string;
  traceId?: string;
  /** The driving operation's kind, when known (signal/queue/sync-generate/use-skill/inbox-response). */
  operationKind?: HarnessRunOperationRef['kind'];
  status: HarnessRunSummaryStatus;
  finishReason: string;
  /**
   * `true` when the run's start was lost to a process restart: `startedAt`,
   * `durationMs`, and `toolRollup` are then absent (not falsely precise), while
   * usage + identity + finishReason are still recorded.
   */
  reconstructed: boolean;
  startedAt?: number;
  completedAt: number;
  durationMs?: number;
  usage: TokenUsage;
  toolRollup?: HarnessRunSummaryToolRollup;
  /** When the summary was finalized (the run's terminal time; set by the writer, equals `completedAt`). */
  createdAt: number;
}

/** Save one run summary (span-summary). Idempotent: the FIRST terminal for a runId wins; later writes are no-ops. */
export interface SaveRunSummaryInput {
  summary: HarnessRunSummary;
}

export interface LoadRunSummaryInput {
  harnessName?: string;
  runId: string;
}

/**
 * List a session's completed-run summaries, newest first, ordered by
 * `(completedAt DESC, runId DESC)`. The keyset cursor is COMPOSITE
 * (`beforeCompletedAt` + `beforeRunId`) so rows that share a `completedAt`
 * across a page boundary are neither skipped nor duplicated. Pass BOTH cursor
 * fields from the previous result's `next*` to fetch the next page.
 */
export interface ListRunSummariesInput {
  harnessName?: string;
  sessionId: string;
  resourceId?: string;
  limit?: number;
  /** Composite keyset cursor (completedAt component). Pair with `beforeRunId`. */
  beforeCompletedAt?: number;
  /** Composite keyset cursor (runId tiebreaker for rows sharing `beforeCompletedAt`). */
  beforeRunId?: string;
}

export interface ListRunSummariesResult {
  summaries: HarnessRunSummary[];
  /** Present when more rows may exist; pass with `nextBeforeRunId` as the next call's cursor. */
  nextBeforeCompletedAt?: number;
  /** Composite cursor tiebreaker for the next page. */
  nextBeforeRunId?: string;
}

/**
 * Lightweight projection of `SessionRecord`, used by `listSessions(...)`.
 */
export interface SessionSummary {
  harnessName: string;
  id: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  origin: 'top-level' | 'subagent-tool';
  modeId: string;
  modelId: string;
  lastActivityAt: number;
  closingAt?: number;
  closeDeadlineAt?: number;
  closedAt?: number;
}

export interface DeleteSessionOptions {
  harnessName?: string;
  sessionId: string;
  /**
   * Optional delete guard. When provided, adapters must only delete the row if
   * the stored version still matches the caller's observed version.
   */
  ifVersion?: number;
  expectedResourceId?: string;
  expectedThreadId?: string;
  expectedParentSessionId?: string | null;
  expectedCreatedAt?: number;
  requireClosed?: boolean;
}

// §5.1d / §10-queue-admission-and-tombstones: the durable operation-kind token
// is `'signal' | 'queue'`. (`'message'` was pre-spec drift.) Durable backends
// that persist legacy `'message'` rows must normalize them to `'signal'` on
// read; the in-memory backend creates rows in-process so it has no legacy data.
export type HarnessOperationKind = 'signal' | 'queue';

export interface HarnessStoredPublicError {
  code: string;
  message: string;
}

/**
 * Durable execution ownership for one admitted `Session.signal()` receipt.
 *
 * The stable `runId` is an at-least-once execution identity. It prevents a
 * recovery attempt from inventing a different cold-run identity, but it does
 * not make provider or tool side effects exactly once.
 */
export type AgentSignalDispatchState =
  | { state: 'reserved' }
  | {
      state: 'dispatching';
      attemptId: string;
      claimExpiresAt: number;
      delivery: 'idle' | 'active';
      runId: string;
    }
  | {
      state: 'accepted';
      attemptId: string;
      delivery: 'idle' | 'active';
      runId: string;
      acceptedAt: number;
    };

export type AgentSignalResultStatus = (
  | { status: 'pending'; signalId: string; runId?: string }
  | { status: 'completed'; signalId: string; runId: string; result: unknown }
  | { status: 'failed'; signalId: string; runId?: string; error: HarnessStoredPublicError }
) & {
  modeId?: string;
  modelId?: string;
  /** Durable operation discriminator for admitted message and signal rows. */
  operationKind?: 'message' | 'signal';
  /** Present on public/channel signal admissions that use durable dispatch fencing. */
  dispatch?: AgentSignalDispatchState;
};

export interface AgentSignalAccepted {
  runId: string;
  signalId: string;
  duplicate: boolean;
  admissionId?: string;
  admissionHash?: string;
}

export type AgentSignalResultEvidence = AgentSignalResultStatus & {
  harnessName: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  admissionId?: string;
  admissionHash?: string;
  createdAt: number;
  updatedAt: number;
};

export interface QueueAdmissionReceipt {
  admissionId: string;
  admissionHash: string;
  queuedItemId: string;
  modeId?: string;
  /**
   * Runtime identities captured at queue admission. Legacy receipts omit this
   * and fall back to id-only validation for backwards compatibility.
   */
  runtimeDependencies?: HarnessRuntimeDependencyRefs;
  status: 'queued' | 'admitting' | 'accepted' | 'completed' | 'admission_failed' | 'failed' | 'dead';
  runId?: string;
  signalId?: string;
  result?: unknown;
  error?: HarnessStoredPublicError;
  attempts: number;
  enqueuedAt: number;
  admittingAt?: number;
  acceptedAt?: number;
  postRunFinalizedAt?: number;
  completedAt?: number;
  failedAt?: number;
  deadAt?: number;
  nextAttemptAt?: number;
  updatedAt: number;
}

export interface HarnessRuntimeDependencyRefs {
  modeId: string;
  agentId?: string;
  /**
   * Operator-managed compatibility token captured at admission/resume time.
   * When present, recovered work must match the current Harness runtime
   * generation before invoking agents. Omitted means legacy ID-only evidence.
   */
  runtimeCompatibilityGeneration?: string;
  /**
   * Evidence-only selected model id. The current Harness model catalog is a
   * UX surface, not an execution registry, so recovery does not fail closed on
   * this field until a stable runtime model registry exists.
   */
  modelId?: string;
  /**
   * Provider-backed workspaces persist the configured provider id. Shared
   * workspaces have no durable provider id, so they record the restart-stable
   * constant `'shared'` (PF-818) — a workspace-KIND change still drifts, but a
   * process restart of the same shared runtime does not fail closed. Explicitly
   * null means no workspace was configured at admission. Undefined means legacy
   * evidence that predates runtime dependency capture.
   */
  workspaceProviderId?: string | null;
}

export interface HarnessSessionEventRecord {
  harnessName: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  eventId: string;
  epoch: string;
  sequence: number;
  event: JsonValue;
  emittedAt: number;
  storedAt: number;
}

export interface HarnessSessionEventReplayState {
  epoch: string;
  oldestSequence: number;
  newestSequence: number;
}

export interface WorkspaceActionJournalPath {
  rootId: string;
  rootPath: string;
  path: string;
  relativePath: string;
}

export interface WorkspaceActionJournalEntry {
  id: string;
  harnessName: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  actionKind: 'file' | 'command' | 'network' | 'mcp';
  operation?: string;
  action: JsonValue;
  policyDecision: 'allow' | 'ask' | 'deny';
  policyReasons: string[];
  matchedRules: JsonValue[];
  path?: WorkspaceActionJournalPath;
  toPath?: WorkspaceActionJournalPath;
  cwd?: WorkspaceActionJournalPath;
  actor?: JsonValue;
  requestId?: string;
  /**
   * Optional observability correlation. Workspace action journaling is durable
   * audit evidence and must not depend on tracing being enabled.
   */
  traceId?: string;
  spanId?: string;
  /**
   * Producer-specific action evidence. Harness restore planning treats
   * `result.before` as the pre-action file state for file mutations:
   * `null` means the file did not exist, while an absent key means the
   * producer did not capture enough evidence for automatic restore planning.
   * Rename producers must set `result.toBefore` to the pre-action destination
   * state for automatic restore planning; `null` means the target path did not
   * exist before the rename.
   */
  result?: JsonValue;
  createdAt: number;
}

export interface AppendWorkspaceActionJournalEntryResult {
  created: boolean;
}

export interface WorkspaceActionJournalPathFilter {
  rootId?: string;
  path?: string;
  relativePath?: string;
  includeToPath?: boolean;
}

/**
 * Session-scoped workspace action journal query. `resourceId` is required as a
 * tenant/resource isolation fence; `threadId` narrows the session's observed
 * thread when the caller wants that exact committed identity. Pagination is a
 * stable `(createdAt, id)` cursor in ascending order. `affectedPath` requires
 * at least one concrete selector (`rootId`, `path`, or `relativePath`) and
 * matches those selectors with AND semantics against the source `path` by
 * default; set `includeToPath` when rename/move destinations should also be
 * considered affected. Command `cwd` is not an affected path. `spanId` is only
 * meaningful within a trace and requires `traceId` when filtering.
 */
export interface ListWorkspaceActionJournalInput {
  harnessName?: string;
  sessionId: string;
  resourceId: string;
  threadId?: string;
  actionKind?: WorkspaceActionJournalEntry['actionKind'];
  operation?: string;
  policyDecision?: WorkspaceActionJournalEntry['policyDecision'];
  requestId?: string;
  traceId?: string;
  spanId?: string;
  affectedPath?: WorkspaceActionJournalPathFilter;
  after?: {
    createdAt: number;
    id: string;
  };
  limit: number;
}

export interface InboxResponseReceipt {
  responseId: string;
  responseHash: string;
  resumeAttemptId: string;
  itemId: string;
  queuedItemId?: string;
  kind: PendingResume['kind'];
  runId: string;
  toolCallId: string;
  pendingRequestedAt: number;
  response: unknown;
  /** Tool-approval persistence requested by this response. */
  approvalScope?: 'once' | 'always';
  status: 'accepted' | 'applied' | 'failed' | 'dead';
  result?: unknown;
  error?: HarnessStoredPublicError;
  retryable?: boolean;
  acceptedAt: number;
  appliedAt?: number;
  failedAt?: number;
  deadAt?: number;
  updatedAt: number;
}

/**
 * Bounded durable tombstone for an interaction that reached its deadline
 * before a response was admitted. It lets a reconnecting client distinguish a
 * late response from an unknown/stale item after `pendingResume` is cleared.
 */
export interface ExpiredPendingInteractionReceipt {
  /** SHA-256 of kind/item/run/tool/requestedAt; prevents item-id ABA aliases. */
  generationKey: string;
  itemId: string;
  kind: PendingResume['kind'];
  runId: string;
  toolCallId: string;
  requestedAt: number;
  expiresAt: number;
  expiredAt: number;
  error: HarnessStoredPublicError;
}

export type HarnessRowErrorCode =
  | 'session_closed'
  | 'session_closing'
  | 'session_deleted'
  | 'live_session_limit'
  | 'session_locked'
  | 'queue_full'
  | 'override_conflict'
  | 'channel_binding_closed'
  | 'platform_unlinked'
  | 'operator_closed'
  | 'channel_payload_conflict'
  | 'delivery_operation_unavailable'
  | 'provider_payload_invalid'
  | 'worker_unavailable'
  | 'unknown';

/**
 * §14.3 base channel request-context fields. Descriptive metadata copied from the verified ingress
 * envelope + resolved binding; never overrides Harness identity. Persisted so the §14.1 recovery
 * worker can reconstruct the `ChannelIngressContext` and re-run `ingress.resolveResource` for a
 * 'received' row whose original envelope is gone (`conversationKind`/`trigger` are the policy input).
 */
interface BaseChannelRequestContext {
  harnessName: string;
  channelId: string;
  providerId: string;
  platform: string;
  conversationKind?: 'dm' | 'group-dm' | 'channel' | 'thread';
  trigger?: 'message' | 'mention' | 'subscribed-message' | 'command';
  externalTenantId?: string;
  externalChannelId?: string;
  externalThreadId: string;
  replyToMessageId?: string;
  /** Platform actor; `externalUserId` is the platform id, `linkedResourceId` is set only after app-level identity linking. */
  actor?: { externalUserId: string; displayName?: string; linkedResourceId?: string };
  /** Structured delivery capabilities of the channel surface (§14.3). */
  capabilities?: { markdown?: boolean; buttons?: boolean; files?: boolean; edits?: boolean; reactions?: boolean };
}

/**
 * §14.3 channel request context (tool-visible via §6.1). Inbound turns carry a verified
 * `externalMessageId`; binding-backed (scheduled/proactive) turns carry a required `bindingId` and
 * no inbound message id.
 */
export type ChannelRequestContext =
  | (BaseChannelRequestContext & { origin: 'inbound'; bindingId?: string; externalMessageId: string })
  | (BaseChannelRequestContext & { origin: 'scheduled' | 'proactive'; bindingId: string; externalMessageId?: never });

export interface PersistedRequestContextInput {
  channel?: ChannelRequestContext;
  metadata?: Record<string, JsonValue>;
}

export type ProviderCallbackSelectorKind = 'installation' | 'route-key' | 'external-tenant';

export interface HarnessProviderCallbackBinding {
  id: string;
  providerId: string;
  selectorKind: ProviderCallbackSelectorKind;
  selectorValue: string;
  harnessName: string;
  channelId: string;
  origin: JsonValue;
  status: 'active' | 'disabled' | 'undeliverable' | 'replaced';
  createdAt: number;
  updatedAt: number;
  replacedAt?: number;
  replacedByBindingId?: string;
  lastError?: { code: HarnessRowErrorCode; message: string; retryable?: boolean };
}

export interface ResolveProviderCallbackBindingResult {
  binding: HarnessProviderCallbackBinding;
  duplicate: boolean;
  conflict: boolean;
  replacedBindingId?: string;
}

/**
 * §5.1h durable per-conversation binding between a platform conversation and a
 * Harness session. Distinct from the in-memory registry `HarnessChannelBinding`
 * (config-time route identity); this is the durable bridge row that anchors a
 * binding generation for ingress/outbox work. There is at most one `active`
 * binding per `(harnessName, channelId, platform, externalTenantId,
 * externalChannelId, externalThreadId)` tuple; replacements mark the prior row
 * `replaced` rather than creating two active owners (§14.1).
 */
export interface ChannelBinding {
  id: string;
  harnessName: string;
  channelId: string;
  providerId: string;
  status: 'active' | 'replaced' | 'closed' | 'undeliverable';
  platform: string;
  externalTenantId?: string;
  externalChannelId?: string;
  externalThreadId: string;
  resourceId: string;
  threadId: string;
  sessionId: string;
  // Resource-resolution mode (NOT platform conversation kind). The registry's
  // 4-value HarnessChannelBinding mode is a separate config concept.
  mode: 'per-user-resource' | 'thread-resource' | 'shared-resource';
  generation: number; // starts at 1; increments on replacement
  createdAt: number;
  updatedAt: number;
  lastInboundAt?: number;
  lastOutboundAt?: number;
  closedAt?: number;
  closedReason?: Extract<
    HarnessRowErrorCode,
    'session_closed' | 'session_deleted' | 'platform_unlinked' | 'operator_closed'
  >;
  replacedByBindingId?: string;
  undeliverableReason?: string;
}

export interface ResolveChannelBindingResult {
  binding: ChannelBinding;
  created: boolean;
  replacedBindingId?: string;
}

export interface ListActiveChannelBindingsResult {
  bindings: ChannelBinding[];
  nextCursor?: string;
}

export interface ChannelInboxItem {
  id: string;
  harnessName: string;
  channelId: string;
  providerId: string;
  idempotencyKey: string;
  payloadHash: string;
  admissionHash?: string;
  admissionId: string;
  bindingId?: string;
  resourceId?: string;
  threadId?: string;
  sessionId?: string;
  runId?: string;
  signalId?: string;
  queuedItemId?: string;
  externalMessageId: string;
  receivedAt: number;
  admittedAt?: number;
  acceptedAt?: number;
  queuedAt?: number;
  failedAt?: number;
  deadAt?: number;
  updatedAt: number;
  status: 'received' | 'admitted' | 'accepted' | 'queued' | 'failed' | 'dead';
  // §14.2 chosen delivery mode, persisted before runtime admission so recovery
  // replays the SAME mode. Canonical tokens are `signal` / `queue` (the earlier
  // `message` spelling is superseded; see ChannelIngressDelivery).
  delivery?: 'signal' | 'queue';
  mode?: string;
  model?: string;
  attempts: number;
  claimId?: string;
  claimExpiresAt?: number;
  nextAttemptAt?: number;
  requestContext: PersistedRequestContextInput;
  content: string;
  attachments: PersistedAttachment[];
  /**
   * §14.2 record-only durability: the RAW inbound provider attachment refs as
   * received at record time, BEFORE the row resolves a session and normalizes
   * them into Harness-owned {@link PersistedAttachment}s. A route that records the
   * `received` row and ACKs before admission cannot yet scope the bytes to a
   * session, so `attachments` is `[]` on that row. Persisting the raw refs lets
   * FROM-SCRATCH recovery re-populate the ingress context and normalize the SAME
   * attachments the live path would have — otherwise a record-only crash recovers
   * with ZERO attachments and a different admissionHash. Cleared once the row is
   * admitted (`attachments` then carries the durable refs). Structurally the
   * `ChannelIngressContext.files` (`AttachmentRef`) JSON shape; mirrored here so
   * the storage domain stays decoupled from `harness/v1`.
   */
  rawFiles?: ChannelInboxRawFile[];
  lastError?: { code: HarnessRowErrorCode; message: string; retryable?: boolean };
}

/**
 * Raw inbound provider attachment ref persisted on a `received` channel inbox
 * row for record-only recovery. Mirrors `harness/v1`'s `AttachmentRef` JSON
 * shape (the storage domain must not import `harness/v1`). Only `attachmentId`
 * and `resourceId` are guaranteed; the rest are optional provider metadata that
 * survive a round-trip so recovery normalizes byte-for-byte what the live path
 * received.
 */
export interface ChannelInboxRawFile {
  attachmentId: string;
  resourceId: string;
  ownerSessionId?: string;
  bytes?: number;
  sha256?: string;
  source?: AttachmentSource;
  kind?: HarnessAttachmentKind;
  name?: string;
  mimeType?: string;
  primitiveType?: HarnessPrimitiveType;
  elementType?: string;
  renderer?: AttachmentRendererDescriptor;
  schemaId?: string;
  metadata?: Record<string, JsonValue>;
  object?: AttachmentObjectPointer;
}

export interface ChannelInboxInitialClaim {
  claimId: string;
  now: number;
  claimTtlMs: number;
}

export interface CreateOrLoadChannelInboxItemResult {
  item: ChannelInboxItem;
  duplicate: boolean;
  conflict: boolean;
  claimed: boolean;
}

export type ChannelActionKind = PendingResume['kind'];
export type ChannelActionAudience = JsonValue;

export interface ChannelActionActor {
  platformUserId: string;
  displayName?: string;
  metadata?: Record<string, JsonValue>;
}

export interface ChannelActionToken {
  actionTokenId: string;
  harnessName: string;
  channelId: string;
  providerId: string;
  resourceId: string;
  owningSessionId: string;
  itemId: string;
  kind: ChannelActionKind;
  bindingId: string;
  bindingGeneration: number;
  runId: string;
  pendingRequestedAt: number;
  audience: ChannelActionAudience;
  metadataHash: string;
  transportHash: string;
  keyId?: string;
  expiresAt?: number;
  revokedAt?: number;
  revokedReason?: Extract<HarnessRowErrorCode, 'session_deleted'>;
  createdAt: number;
  updatedAt: number;
}

export interface ChannelActionReceipt {
  id: string;
  harnessName: string;
  channelId: string;
  providerId: string;
  actionTokenId: string;
  actionId: string;
  bindingId: string;
  bindingGeneration: number;
  resourceId: string;
  owningSessionId: string;
  itemId: string;
  kind: ChannelActionKind;
  runId: string;
  pendingRequestedAt: number;
  audience: ChannelActionAudience;
  verifiedActor?: ChannelActionActor;
  responseHash: string;
  response: JsonValue;
  status: 'received' | 'accepted' | 'applied' | 'conflict' | 'failed' | 'dead';
  conflictReason?:
    | 'response_mismatch'
    | 'stale_item'
    | 'kind_mismatch'
    | 'run_mismatch'
    | 'binding_mismatch'
    | 'session_closed'
    | 'actor_not_allowed'
    | 'token_expired'
    | 'token_revoked';
  attempts: number;
  claimId?: string;
  claimExpiresAt?: number;
  nextAttemptAt?: number;
  acceptedAt?: number;
  appliedAt?: number;
  failedAt?: number;
  deadAt?: number;
  result?: JsonValue;
  lastError?: { code: HarnessRowErrorCode; message: string; retryable?: boolean };
  createdAt: number;
  updatedAt: number;
}

export interface ChannelActionInitialClaim {
  claimId: string;
  now: number;
  claimTtlMs: number;
}

export interface CreateOrLoadChannelActionTokenResult {
  token: ChannelActionToken;
  duplicate: boolean;
  conflict: boolean;
}

export interface CreateOrLoadChannelActionReceiptResult {
  receipt: ChannelActionReceipt;
  duplicate: boolean;
  conflict: boolean;
  claimed: boolean;
}

export type ChannelDeliverySemantics =
  | 'native-idempotency'
  | 'client-message-id'
  | 'lookup-reconcile'
  | 'at-least-once';

export type ChannelOutboxKind =
  | 'assistant-message'
  | 'message-edit'
  | 'inbox-prompt'
  | 'inbox-resolution'
  | 'status'
  | 'tool-result'
  | 'reaction'
  | 'custom';

export type ChannelOutboxOperationKind =
  | 'message-create'
  | 'message-edit'
  | 'reaction-add'
  | 'reaction-remove'
  | 'file-upload'
  | 'custom';

export interface ChannelOutboxSource {
  kind: 'session-event' | 'pending-resume' | 'queue' | 'wakeup' | 'operator' | 'custom';
  id?: string;
  metadata?: Record<string, JsonValue>;
}

export interface ChannelOutboxTarget {
  platform: string;
  externalTenantId?: string;
  externalChannelId?: string;
  externalThreadId: string;
  externalMessageId?: string;
}

export interface ChannelProviderDeliveryReceipt {
  providerMessageId?: string;
  providerThreadId?: string;
  deliveryId?: string;
  metadata?: Record<string, JsonValue>;
}

export interface ChannelOutboxEnqueueOptions {
  channelId: string;
  idempotencyKey: string;
  resourceId: string;
  threadId: string;
  sessionId?: string;
  owningSessionId?: string;
  source?: ChannelOutboxSource;
  target: ChannelOutboxTarget;
  kind: ChannelOutboxKind;
  operationKind: ChannelOutboxOperationKind;
  operationName?: string;
  payload: JsonValue;
  payloadHash?: string;
  deliverySemantics?: ChannelDeliverySemantics;
}

export interface ChannelOutboxItem extends Omit<ChannelOutboxEnqueueOptions, 'payloadHash' | 'deliverySemantics'> {
  id: string;
  harnessName: string;
  providerId: string;
  bindingId: string;
  bindingGeneration: number;
  payloadHash: string;
  deliverySemantics: ChannelDeliverySemantics;
  status: 'pending' | 'claimed' | 'sent' | 'failed' | 'dead';
  attempts: number;
  claimId?: string;
  claimExpiresAt?: number;
  nextAttemptAt?: number;
  sentAt?: number;
  failedAt?: number;
  deadAt?: number;
  providerMessageId?: string;
  providerReceipt?: ChannelProviderDeliveryReceipt;
  lastError?: { code: HarnessRowErrorCode; message: string; retryable?: boolean };
  createdAt: number;
  updatedAt: number;
}

export interface EnqueueChannelOutboxResult {
  outboxItemId: string;
  duplicate: boolean;
  conflict: boolean;
}

export interface ListChannelDiagnosticsInput {
  harnessName?: string;
  resourceId: string;
  sessionIds: readonly string[];
  /**
   * Maximum rows returned per channel ledger.
   */
  limit?: number;
}

export interface ChannelDiagnosticsRows {
  inbox: ChannelInboxItem[];
  actionTokens: ChannelActionToken[];
  actionReceipts: ChannelActionReceipt[];
  outbox: ChannelOutboxItem[];
}

export type HarnessWakeupSource = 'schedule' | 'proactive';

export interface HarnessWakeupItem {
  id: string;
  harnessName: string;
  source: HarnessWakeupSource;
  sourceId: string;
  fireId: string;
  idempotencyKey: string;
  payloadHash: string;
  admissionId: string;
  admissionHash?: string;
  resourceId?: string;
  threadId?: string;
  sessionId?: string;
  queuedItemId?: string;
  runId?: string;
  signalId?: string;
  dueAt: number;
  createdAt: number;
  updatedAt: number;
  claimedAt?: number;
  queuedAt?: number;
  completedAt?: number;
  failedAt?: number;
  deadAt?: number;
  status: 'due' | 'claimed' | 'queued' | 'completed' | 'failed' | 'dead';
  mode?: string;
  model?: string;
  yolo?: boolean;
  attempts: number;
  missedCount?: number;
  claimId?: string;
  claimExpiresAt?: number;
  nextAttemptAt?: number;
  requestContext?: PersistedRequestContextInput;
  content: string;
  attachments: PersistedAttachment[];
  result?: JsonValue;
  lastError?: { code: HarnessRowErrorCode; message: string; retryable?: boolean };
}

export type HarnessWakeupClaimStatus = Extract<HarnessWakeupItem['status'], 'due' | 'claimed' | 'failed'>;

export interface HarnessWakeupInitialClaim {
  claimId: string;
  now: number;
  claimTtlMs: number;
}

export interface CreateOrLoadHarnessWakeupItemResult {
  item: HarnessWakeupItem;
  duplicate: boolean;
  conflict: boolean;
  claimed: boolean;
}

export interface OperationAdmissionTombstone {
  kind: HarnessOperationKind;
  harnessName: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  admissionId?: string;
  admissionHash?: string;
  queuedItemId?: string;
  signalId?: string;
  runId?: string;
  terminalAt: number;
  compactedAt: number;
  expiresAt: number;
}

export type OperationAdmissionEvidence =
  | AgentSignalAccepted
  | AgentSignalResultEvidence
  | AgentSignalResultStatus
  | QueueAdmissionReceipt
  | OperationAdmissionTombstone;

/**
 * Canonical public name for the evidence rows returned by
 * `resolveOperationAdmissionEvidence`. Internal storage call sites still use
 * `OperationAdmissionEvidence`; this alias gives the Harness v1 public
 * contract a stable name without renaming adapter surfaces.
 */
export type HarnessOperationAdmissionEvidence = OperationAdmissionEvidence;

// ---------------------------------------------------------------------------
// Attachment metadata
// ---------------------------------------------------------------------------

/**
 * Metadata index row for a persisted file attachment. The actual bytes live
 * in `BlobStore` (or whatever the adapter delegates to); this row is the
 * harness-domain pointer.
 */
export interface AttachmentRecord {
  /** Session that owns the attachment bytes. */
  ownerSessionId: string;
  /** Stable identifier referenced by `PersistedAttachment.attachmentId`. */
  attachmentId: string;
  /** Original filename (display only). */
  name: string;
  /** MIME type, validated at upload. */
  mimeType: string;
  /** Size of the underlying bytes. */
  bytes: number;
  /** Hex SHA-256 digest of the underlying bytes. */
  sha256: string;
  /** Where the attachment came from. */
  source: AttachmentSource;
  /** Semantic class for UI/replay consumers. Defaults to `file` for legacy rows. */
  kind?: HarnessAttachmentKind;
  primitiveType?: HarnessPrimitiveType;
  elementType?: string;
  renderer?: AttachmentRendererDescriptor;
  schemaId?: string;
  metadata?: Record<string, JsonValue>;
  object?: AttachmentObjectPointer;
  /** Epoch ms. */
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Method input/output shapes
// ---------------------------------------------------------------------------

export interface ListSessionsInput {
  harnessName?: string;
  resourceId: string;
  /** When true, includes records with `closedAt` set. */
  includeClosed?: boolean;
  /** Filter to direct children of this parent. */
  parentSessionId?: string;
}

export interface ListSessionsByThreadInput {
  /** When omitted, searches every resource visible to this adapter. */
  harnessName?: string;
  resourceId?: string;
  threadId: string;
  /** When true, includes records with `closedAt` set. */
  includeClosed?: boolean;
}

export interface ListActiveSessionsByThreadInput {
  /** When omitted, searches every harness namespace visible to this adapter. */
  harnessName?: string;
  threadId: string;
}

/** Stable keyset position for the cold-row pending-interaction expiry scan. */
export interface PendingInteractionDueScanCursor {
  dueAt: number;
  sessionId: string;
}

/**
 * Exact pending generation returned by the storage due scan. Callers must
 * compare every identity field under the session CAS before beginning or
 * completing expiry; this projection is discovery evidence, not authority to
 * mutate a newer pending interaction.
 */
export interface PendingInteractionExpiryGeneration {
  harnessName: string;
  sessionId: string;
  resourceId: string;
  kind: PendingResume['kind'];
  itemId: string;
  runId: string;
  toolCallId: string;
  requestedAt: number;
  /** Effective storage-discovery deadline for expiry or resume recovery. */
  dueAt: number;
  /** Original user-interaction deadline; never moves after suspension. */
  expiresAt: number;
  /** Present after phase one has durably claimed expiry cleanup. */
  expiryStartedAt?: number;
  /** Present after a user response has been admitted for provider dispatch. */
  resumedAt?: number;
  /** Due time for ambiguous admitted-resume recovery. */
  resumeRecoveryAt?: number;
  /** Present after phase one has claimed stale-resume recovery cleanup. */
  resumeRecoveryStartedAt?: number;
}

export interface ListDuePendingInteractionsInput {
  harnessName?: string;
  /** Inclusive upper bound (epoch ms) for due interactions. */
  now: number;
  /** Positive page size; adapters cap it at the storage-wide maximum. */
  limit: number;
  /** Return rows strictly after this `(dueAt, sessionId)` position. */
  cursor?: PendingInteractionDueScanCursor;
}

export interface ListDuePendingInteractionsResult {
  items: PendingInteractionExpiryGeneration[];
  nextCursor?: PendingInteractionDueScanCursor;
}

export interface WithThreadDeleteFenceInput {
  threadId: string;
  /** Unique acquisition token; only the current matching owner may release a fence. */
  ownerId: string;
  ttlMs: number;
}

export interface ThreadDeleteFenceLease {
  threadId: string;
  ownerId: string;
  /**
   * Assert that this owner still holds a live delete fence. Durable adapters
   * should renew the fence during this check so callers can place it
   * immediately before destructive global-memory operations.
   */
  assertActive(): Promise<void>;
}

export interface SaveSessionOptions {
  harnessName?: string;
  /** The Harness instance currently holding the lease. */
  ownerId: string;
  /**
   * Optimistic concurrency token. Must match the record's current `version`.
   * Use `0` for first insert.
   */
  ifVersion: number;
}

export interface SaveSessionResult {
  /** New version after the write — `ifVersion + 1`. */
  version: number;
}

export interface CreateOrLoadActiveSessionOptions {
  initialLease: {
    ownerId: string;
    ttlMs: number;
  };
}

export interface CreateOrLoadActiveSessionResult {
  record: SessionRecord;
  created: boolean;
  leaseAcquired: boolean;
  version: number;
  expiresAt?: number;
  storageNow: number;
}

export interface AcquireSessionLeaseInput {
  harnessName?: string;
  sessionId: string;
  ownerId: string;
  ttlMs: number;
}

export interface RenewSessionLeaseInput {
  harnessName?: string;
  sessionId: string;
  ownerId: string;
  ttlMs: number;
}

export interface ReleaseSessionLeaseInput {
  harnessName?: string;
  sessionId: string;
  ownerId: string;
}

/**
 * Renew the parent/root lease AND every active descendant lease entry under it
 * on a single storage-linearized cycle (§5.8). Subagent/child sessions have no
 * separately-renewable lease — they share the parent/root owner — so the live
 * owner extends the whole subtree through this one call, capping each
 * descendant's expiry at the new parent expiry.
 */
export interface RenewSessionLeaseSubtreeInput {
  harnessName?: string;
  rootSessionId: string;
  ownerId: string;
  ttlMs: number;
}

export interface SessionLeaseResult {
  /** Record version observed at lease time — caller passes this to `saveSession`. */
  version: number;
  /** Epoch ms when the lease expires if not renewed. */
  expiresAt: number;
}

export interface SubtreeSessionLeaseResult extends SessionLeaseResult {
  /**
   * Number of active descendant lease entries renewed alongside the root in the
   * same atomic cycle. The renewal is committed in ONE storage-linearized pass,
   * so it never returns a parent-only partial success (§5.8). If an active
   * descendant has been claimed by a DIFFERENT instance (ownerId moved), the
   * subtree was split: the call throws `HarnessStorageLeaseConflictError` and
   * renews nothing, leaving the owner to fence itself. A same-owner descendant
   * whose mirror lapsed is re-adopted to the capped expiry — that IS the §5.8
   * repair (re-running subtree renewal extends a lagging mirror), not a fence.
   */
  renewedDescendantCount: number;
}

export interface SaveAttachmentInput {
  harnessName?: string;
  sessionId: string;
  attachmentId: string;
  name: string;
  mimeType: string;
  source: AttachmentSource;
  data: Uint8Array;
  semantic?: AttachmentSemanticMetadata;
}

export interface SaveAttachmentResult {
  attachmentId: string;
  bytes: number;
  sha256: string;
}

export interface LoadedAttachment {
  name: string;
  mimeType: string;
  bytes: number;
  sha256: string;
  data: Uint8Array;
  semantic?: AttachmentSemanticMetadata;
}

export interface AttachmentReference {
  source: AttachmentReferenceSource;
  sourceId: string;
  retainedUntil?: number;
}

export interface SaveAttachmentReferenceInput extends AttachmentReference {
  harnessName?: string;
  /** Session that owns the referenced attachment bytes. */
  sessionId: string;
  attachmentId: string;
}

// ---------------------------------------------------------------------------
// Plan tasks (HARNESS_V1_SPEC.md §5.1k / §4.8f)
//
// `HarnessPlanTask` is the durable, arbitrary-depth, MODEL-AUTHORED agent
// task/todo TREE. It is distinct from the runtime work-unit `HarnessTask` in
// contracts.ts (which is unrelated and unchanged). Plan tasks are session-owned
// and isolated by `(harnessName, sessionId)`; every mutation flows through the
// live `Session` under its lease, so the storage mutators are
// session-owner-fenced (§5.6 / §5.8). Status ROLLUP, `blockedBy` cycle checks,
// the plan tool (§6.4), and the `plan_task_*` custom event (§10.3) are DEFERRED
// to TM-3 / TM-4 / TM-5; TM-2 ships only the durable storage layer.
// ---------------------------------------------------------------------------

export type HarnessPlanTaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled' | 'failed';

/**
 * Whether the current `status` was written by an explicit caller/model action
 * or DERIVED by the harness from child rollup. Rollup is DEFERRED to TM-4 — until
 * then every write is `'explicit'`.
 */
export type HarnessPlanTaskStatusSource = 'explicit' | 'derived';

/**
 * Durable model-authored plan-tree node (§5.1k). Adjacency-list edge via
 * `parentTaskId` gives arbitrary depth; `order` sorts siblings. The per-row
 * `version` is the field-write OCC token, mutated only under the session-owner
 * fence (§5.8) — NOT an independent cross-process authority.
 */
export interface HarnessPlanTask {
  /** Generated stable id (never the model's free-text title). */
  taskId: string;
  /** Optional idempotency key so a retried create resolves to the same row. */
  idempotencyKey?: string;
  /**
   * Immutable hash of the normalized create request associated with
   * `idempotencyKey`. Current creates that provide an idempotency key must also
   * provide this as a non-empty string. The field remains optional on the
   * durable row shape so pre-hash rows can still be read and replayed by key.
   * It lets orchestration distinguish an exact replay from key reuse after
   * mutable task fields have changed.
   */
  idempotencyInputHash?: string;
  harnessName: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  /** Adjacency-list edge to the parent node; absent for roots. */
  parentTaskId?: string;
  /** Sibling ordering within one parent (and among roots). */
  order: number;
  status: HarnessPlanTaskStatus;
  statusSource: HarnessPlanTaskStatusSource;
  /** Imperative task title. */
  content: string;
  /** Present-continuous label shown while in progress. */
  activeForm?: string;
  priority?: number;
  /**
   * Stored as data only in TM-2. Cycle-checking + rollup that consume
   * `blockedBy` are DEFERRED to TM-4.
   */
  blockedBy?: string[];
  origin?: string;
  /** Subagent session id this task was delegated to (TM-6). */
  delegatedSubagentSessionId?: string;
  /**
   * Subagent TYPE id of the delegation (§9). Persisted with the session id so a
   * delegated subagent reattached after rehydrate can re-resolve its
   * `SubagentDefinition` and restore the `tools` / `workspace` overrides (which
   * are applied to the live child in-memory and not otherwise durable).
   */
  delegatedSubagentTypeId?: string;
  metadata?: JsonValue;
  createdAt: number;
  updatedAt: number;
  /**
   * Wall-clock time the task FIRST transitioned to `in_progress` (span-summary
   * O7). Set once (preserved across later status oscillation) so a consumer can
   * compute work duration as `completedAt - startedAt`. Absent until the task
   * has started and on rows persisted before this field landed.
   */
  startedAt?: number;
  completedAt?: number;
  /** Per-row OCC token, advanced on each `updatePlanTask` under the fence. */
  version: number;
}

/**
 * Session-owner fence shared by every plan-task mutator (§5.6 / §5.8). The
 * adapter verifies, against the owning `SessionRecord`, that `ownerId` still
 * holds the unexpired lease and that the session's `version` matches
 * `ifSessionVersion` before any plan-task row changes — mirroring how
 * `saveSession` fences. The SESSION is the serialized writer, so plan-task
 * writes fence on the session's lease + version, not bare per-row OCC.
 */
export interface PlanTaskSessionFence {
  harnessName?: string;
  sessionId: string;
  ownerId: string;
  /** Expected current `SessionRecord.version`. */
  ifSessionVersion: number;
}

/** Create one plan-task node. */
export interface CreatePlanTaskInput {
  fence: PlanTaskSessionFence;
  /**
   * The node to insert. `version`, `createdAt`, and `updatedAt` are adapter-set
   * on insert (callers may pass them; adapters normalize). `taskId` must be
   * caller-supplied (stable id). When `idempotencyKey` matches an existing
   * task in the same session, the existing row is returned unchanged. A new
   * create that provides `idempotencyKey` must also provide a non-empty
   * `idempotencyInputHash`.
   */
  task: HarnessPlanTask;
}

/**
 * Partial field write of a plan task by `taskId`, guarded by per-row OCC
 * (`ifVersion`) INSIDE the session-owner fence. Only the provided fields are
 * written; omitted fields are unchanged. Pass a field explicitly to `null`-able
 * clearing via the dedicated optional booleans where a field is optional.
 */
export interface UpdatePlanTaskInput {
  fence: PlanTaskSessionFence;
  taskId: string;
  /** Per-row OCC token observed on read. */
  ifVersion: number;
  patch: {
    parentTaskId?: string;
    clearParentTaskId?: boolean;
    order?: number;
    status?: HarnessPlanTaskStatus;
    statusSource?: HarnessPlanTaskStatusSource;
    content?: string;
    activeForm?: string;
    clearActiveForm?: boolean;
    priority?: number;
    clearPriority?: boolean;
    blockedBy?: string[];
    clearBlockedBy?: boolean;
    origin?: string;
    delegatedSubagentSessionId?: string;
    clearDelegatedSubagentSessionId?: boolean;
    delegatedSubagentTypeId?: string;
    clearDelegatedSubagentTypeId?: boolean;
    metadata?: JsonValue;
    clearMetadata?: boolean;
    startedAt?: number;
    completedAt?: number;
    clearCompletedAt?: boolean;
  };
}

export interface UpdatePlanTaskResult {
  /** New per-row version after the write — `ifVersion + 1`. */
  version: number;
}

/** Cascade-delete a task plus every descendant (NOT reparent-to-root). */
export interface DeletePlanTaskSubtreeInput {
  fence: PlanTaskSessionFence;
  rootTaskId: string;
}

export interface DeletePlanTaskSubtreeResult {
  /** Number of plan-task rows removed (root + descendants). */
  deletedCount: number;
}

/**
 * One operation in a transaction-shaped multi-row mutation. Used by
 * decompose/reparent in TM-3 / TM-4. All ops apply under one adapter boundary
 * or none do.
 */
export type PlanTaskMutationOp =
  | { kind: 'create'; task: HarnessPlanTask }
  | {
      kind: 'update';
      taskId: string;
      ifVersion: number;
      patch: UpdatePlanTaskInput['patch'];
    }
  | { kind: 'deleteSubtree'; rootTaskId: string };

export interface MutatePlanTasksForSessionInput {
  fence: PlanTaskSessionFence;
  ops: PlanTaskMutationOp[];
}

export interface ListPlanTasksInput {
  harnessName?: string;
  sessionId: string;
  /** Page size. */
  limit: number;
  /** Opaque cursor returned by the previous page. */
  cursor?: string;
}

export interface ListPlanTasksResult {
  tasks: HarnessPlanTask[];
  /** Present when more rows remain; pass to the next `listPlanTasks` call. */
  cursor?: string;
}

/**
 * The anti-forgetting bounded read: returns the next-N nodes of the subtree
 * under `rootTaskId` (or the whole forest's roots-down when omitted), bounded
 * by `depth` and optionally filtered by `status`. Always capped by `limit`.
 */
export interface LoadPlanTaskSubtreeInput {
  harnessName?: string;
  sessionId: string;
  /** Root to walk from; omit to walk from session roots (no parent). */
  rootTaskId?: string;
  /**
   * Max depth relative to the root (0 = just the root node / the roots when
   * `rootTaskId` is omitted). Unbounded when omitted.
   */
  depth?: number;
  /** Restrict to nodes with this status. */
  status?: HarnessPlanTaskStatus;
  /** Hard cap on returned nodes (the bounded next-N). */
  limit: number;
}

export interface LoadPlanTaskSubtreeResult {
  tasks: HarnessPlanTask[];
  /** True when the bound (`limit`/`depth`) clipped the subtree. */
  truncated: boolean;
}

/**
 * Cheap whole-tree aggregate for the bounded display-state summary (§5.1k /
 * TM-5). A `COUNT(*) GROUP BY status` over the session's plan tasks — never a
 * full-row load — so the display summary's `total`/`byStatus`/`rootCount` stay
 * EXACT regardless of tree size (a bounded single-page read would undercount a
 * tree larger than the page).
 */
export interface CountPlanTasksByStatusInput {
  harnessName?: string;
  sessionId: string;
}

export interface PlanTaskCountSummary {
  /** Total number of plan-task nodes in the session tree. */
  total: number;
  /** Count of nodes in each status (only present statuses appear). */
  byStatus: Partial<Record<HarnessPlanTaskStatus, number>>;
  /** Number of root nodes (parent_task_id NULL or not resolvable in the set). */
  rootCount: number;
}
