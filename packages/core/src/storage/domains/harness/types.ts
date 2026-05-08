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
 * live in BlobStore or whatever the adapter delegates to).
 * `kind: 'url'` is a remote URL fetched at message-build time.
 */
export type PersistedAttachment =
  | { kind: 'ref'; name: string; mimeType: string; attachmentId: string }
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
  enqueuedAt: number;
  content: string;
  attachments: PersistedAttachment[];
  model?: string;
  mode?: string;
  yolo?: boolean;
}

/**
 * Pending tool-approval gate. Model wants to call a tool; the user decides.
 */
export interface PendingApproval {
  kind: 'tool-approval';
  runId: string;
  toolCallId: string;
  toolName: string;
  toolCategory?: string;
  input: unknown;
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
}

/**
 * Pending tool-suspension. The tool's body called `suspend(...)` and is
 * waiting for an external resume payload.
 */
export interface PendingToolSuspension {
  kind: 'tool-suspension';
  runId: string;
  toolCallId: string;
  toolName: string;
  /** Opaque payload chosen by the tool author. */
  suspendData: unknown;
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
}

/**
 * Pending user question — the agent called `ask_user(...)`.
 */
export interface PendingQuestion {
  kind: 'question';
  runId: string;
  toolCallId: string;
  question: string;
  options?: { label: string; description?: string }[];
  selectionMode?: 'single_select' | 'multi_select';
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
}

/**
 * Pending plan approval. Approving a plan may transition the session's mode;
 * see HARNESS_V1_SPEC.md §5.1 for the idempotency markers.
 */
export interface PendingPlanApproval {
  kind: 'plan-approval';
  runId: string;
  toolCallId: string;
  title: string;
  plan: string;
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
  /** Frozen at registration from the submitting mode's `transitionsTo`. */
  transitionModeId?: string;
  /** Idempotency markers for the mode-flip side effect. */
  approvedTransitionModeId?: string;
  modeTransitionAppliedAt?: number;
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
  judgeModelId?: string;
  judgeAnswersQuestions?: boolean;
}

/**
 * Per-session workspace state, only populated under `kind: 'per-session'`
 * with a `resumable: true` provider.
 */
export interface SessionWorkspaceState {
  providerId: string;
  state: unknown;
}

/**
 * Durable session state. Loaded on hydration, flushed under the session's
 * write lease (see HARNESS_V1_SPEC.md §5.8).
 */
export interface SessionRecord {
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

  // In-flight state — resumable across restarts
  pendingQueue: QueuedItem[];
  pendingApproval?: PendingApproval;
  pendingSuspension?: PendingToolSuspension;
  pendingQuestion?: PendingQuestion;
  pendingPlan?: PendingPlanApproval;

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
  id: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  origin: 'top-level' | 'subagent-tool';
  modeId: string;
  modelId: string;
  lastActivityAt: number;
  closedAt?: number;
}

// ---------------------------------------------------------------------------
// Attachment metadata
// ---------------------------------------------------------------------------

/**
 * Metadata index row for a persisted file attachment. The actual bytes live
 * in `BlobStore` (or whatever the adapter delegates to); this row is the
 * harness-domain pointer.
 */
export interface AttachmentRecord {
  /** Stable identifier referenced by `PersistedAttachment.attachmentId`. */
  attachmentId: string;
  /** Owning session — bytes are deleted with the session. */
  sessionId: string;
  /** Original filename (display only). */
  name: string;
  /** MIME type, validated at upload. */
  mimeType: string;
  /** Size of the underlying bytes. */
  sizeBytes: number;
  /** Epoch ms. */
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Method input/output shapes
// ---------------------------------------------------------------------------

export interface ListSessionsInput {
  resourceId: string;
  /** When true, includes records with `closedAt` set. */
  includeClosed?: boolean;
  /** Filter to direct children of this parent. */
  parentSessionId?: string;
}

export interface SaveSessionOptions {
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

export interface AcquireSessionLeaseInput {
  sessionId: string;
  ownerId: string;
  ttlMs: number;
}

export interface RenewSessionLeaseInput {
  sessionId: string;
  ownerId: string;
  ttlMs: number;
}

export interface ReleaseSessionLeaseInput {
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
  sessionId: string;
  attachmentId: string;
  name: string;
  mimeType: string;
  data: Uint8Array;
}

export interface LoadedAttachment {
  name: string;
  mimeType: string;
  data: Uint8Array;
}
