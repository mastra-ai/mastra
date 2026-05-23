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
 * See HARNESS_V1_SPEC.md §5.1 ("Persistence shapes — `pendingResume`").
 */
export interface PendingResume {
  kind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
  /** Stable pending interaction id used by inbox/route callers. */
  itemId?: string;
  runId: string;
  toolCallId: string;
  /** Populated for tool-approval / tool-suspension; omitted otherwise. */
  toolName?: string;
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
  /** Present when this pending resume belongs to a queued turn. */
  queuedItemId?: string;
  /** Mode whose backing agent produced this pending resume. */
  modeId?: string;
  /**
   * Runtime identities captured when this work was admitted. Recovery uses
   * these stable ids to fail closed if the process restarts with a different
   * execution surface.
   */
  runtimeDependencies?: HarnessRuntimeDependencyRefs;
  /**
   * Idempotency marker. Set by the resume helper before calling
   * `agent.resumeStream(...)` and observed on replay so a crash between
   * "wrote resumedAt" and "cleared pendingResume" does not double-resume.
   */
  resumedAt?: number;
  /**
   * Kind-specific UX surface — opaque to the harness, rendered by the UI.
   * Populated at suspend-capture time from the agent's `suspendPayload`.
   */
  payload?: {
    // tool-approval
    toolCategory?: string;
    input?: unknown;
    // tool-suspension
    suspendData?: unknown;
    // question
    question?: string;
    options?: { label: string; description?: string }[];
    selectionMode?: 'single_select' | 'multi_select';
    // plan-approval
    title?: string;
    plan?: string;
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
 * Discriminated failure modes for goal-judge invocations. Persisted on
 * `GoalState.lastFailure` so a recovered or replayed session can introspect
 * what went wrong without re-running the judge.
 *
 * - `timeout` — the judge model invocation timed out (AbortError or
 *   network-class timeout message). Retried with backoff before pausing.
 * - `provider_error` — non-transient provider/API error. Not retried.
 * - `invalid_verdict` — judge returned output that failed schema
 *   validation. Never falls through as `'continue'`.
 * - `max_turns` — the goal's `maxTurns` budget was exhausted while still
 *   `decision === 'continue'`. The judge itself succeeded.
 */
export type GoalJudgeFailureKind = 'timeout' | 'provider_error' | 'invalid_verdict' | 'max_turns';

export interface GoalJudgeFailure {
  kind: GoalJudgeFailureKind;
  message?: string;
  failedAt: number;
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
  /** Most recent judge-loop failure, persisted so recovered sessions can
   * introspect what went wrong. Cleared by `setGoal` and on a successful
   * judge verdict. */
  lastFailure?: GoalJudgeFailure;
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

  // Counters
  tokenUsage: TokenUsage;

  // In-flight state — resumable across restarts.
  // At most one outstanding agent suspension per session (see PendingResume).
  pendingQueue: QueuedItem[];
  pendingResume?: PendingResume;
  queueAdmissionReceipts?: Record<string, QueueAdmissionReceipt>;
  inboxResponseReceipts?: Record<string, InboxResponseReceipt>;

  // Observational memory config (per-session override)
  observationalMemory?: {
    observerModelId?: string;
    reflectorModelId?: string;
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

export type HarnessOperationKind = 'message' | 'queue';

export interface HarnessStoredPublicError {
  code: string;
  message: string;
}

export type AgentSignalResultStatus =
  | { status: 'pending'; signalId: string; runId?: string }
  | { status: 'completed'; signalId: string; runId: string; result: unknown }
  | { status: 'failed'; signalId: string; runId?: string; error: HarnessStoredPublicError };

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
   * workspaces have no durable provider id, so new work records a process-
   * scoped shared sentinel and fails closed after restart. Explicitly null
   * means no workspace was configured at admission. Undefined means legacy
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
 * considered affected. Command `cwd` is not an affected path.
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

export type HarnessRowErrorCode =
  | 'session_closed'
  | 'session_closing'
  | 'session_deleted'
  | 'live_session_limit'
  | 'session_locked'
  | 'queue_full'
  | 'override_conflict'
  | 'channel_binding_closed'
  | 'channel_payload_conflict'
  | 'delivery_operation_unavailable'
  | 'provider_payload_invalid'
  | 'worker_unavailable'
  | 'unknown';

export interface PersistedRequestContextInput {
  channel?: {
    origin: 'inbound' | 'binding';
    harnessName: string;
    channelId: string;
    providerId: string;
    platform: string;
    externalThreadId: string;
    externalMessageId?: string;
    bindingId?: string;
    externalTenantId?: string;
    externalChannelId?: string;
    actor?: {
      platformUserId: string;
      displayName?: string;
      metadata?: Record<string, JsonValue>;
    };
    capabilities?: Record<string, JsonValue>;
  };
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
  delivery?: 'message' | 'queue';
  mode?: string;
  model?: string;
  attempts: number;
  claimId?: string;
  claimExpiresAt?: number;
  nextAttemptAt?: number;
  requestContext: PersistedRequestContextInput;
  content: string;
  attachments: PersistedAttachment[];
  lastError?: { code: HarnessRowErrorCode; message: string; retryable?: boolean };
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

export interface SessionLeaseResult {
  /** Record version observed at lease time — caller passes this to `saveSession`. */
  version: number;
  /** Epoch ms when the lease expires if not renewed. */
  expiresAt: number;
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
