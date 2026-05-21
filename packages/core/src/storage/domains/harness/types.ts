/**
 * Harness storage domain - durable session state for `@mastra/core/harness/v1`.
 *
 * The shapes here are JSON-serializable by contract. No `Date`, no
 * `Map`/`Set`, no functions. Time fields are epoch milliseconds.
 *
 * Threads and messages are NOT in this domain - they live under
 * `MemoryStorage`. The harness layer composes the two.
 */

/**
 * Per-session permission rules. Plain JSON - no closures.
 *
 * `categories` holds per-category defaults; `tools` holds per-tool overrides
 * and wins over the category default.
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
 * `kind: 'ref'` points at a row in the harness attachment index.
 * `kind: 'url'` is a remote URL fetched at message-build time.
 */
export type PersistedAttachment =
  | { kind: 'ref'; name: string; mimeType: string; attachmentId: string }
  | { kind: 'url'; name: string; mimeType: string; url: string };

/**
 * A single item enqueued via `session.queue(...)`.
 *
 * `addTools` is intentionally not present: tool implementations are closures
 * and cannot be serialized, so `queue(...)` rejects them at admission rather
 * than dropping them silently after the fact.
 */
export interface QueuedItem {
  id: string;
  /** Idempotency key captured when the queue item was admitted. */
  admissionId?: string;
  /** Stable hash of the admitted queue inputs. */
  admissionHash?: string;
  enqueuedAt: number;
  content: string;
  attachments: PersistedAttachment[];
  model?: string;
  mode?: string;
  yolo?: boolean;
  /**
   * Origin of this queued item. `'user'` (default) for items enqueued by
   * `session.queue(...)`, `'goal'` for harness-enqueued goal continuations.
   */
  source?: 'user' | 'goal';
  /** Set when `source === 'goal'`. Identifies which goal produced the item. */
  goalId?: string;
}

/**
 * Outstanding agent suspension. At most one per session - the agent layer can
 * only be in one of {approval, suspension, question, plan} at a time, so the
 * four spec'd shapes collapse into a single tagged record.
 */
export interface PendingResume {
  kind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
  runId: string;
  toolCallId: string;
  /** Populated for tool-approval / tool-suspension; omitted otherwise. */
  toolName?: string;
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
  /** Set when the suspension belongs to the head queue item. */
  queuedItemId?: string;
  /**
   * Idempotency marker. Set by the resume helper before calling
   * `agent.resumeStream(...)` and observed on replay so a crash between
   * "wrote resumedAt" and "cleared pendingResume" does not double-resume.
   */
  resumedAt?: number;
  /**
   * Kind-specific UX surface - opaque to the harness, rendered by the UI.
   * Populated at suspend-capture time from the agent's `suspendPayload`.
   */
  payload?: {
    toolCategory?: string;
    input?: unknown;
    suspendData?: unknown;
    question?: string;
    options?: { label: string; description?: string }[];
    selectionMode?: 'single_select' | 'multi_select';
    title?: string;
    plan?: string;
  };
  /**
   * Plan-approval only. Frozen at registration from the submitting mode's
   * transitions. A mode switch while the plan is pending does not retarget
   * the approval.
   */
  transitionModeId?: string;
  /** Plan-approval only. Idempotency markers for the mode-flip side effect. */
  approvedTransitionModeId?: string;
  modeTransitionAppliedAt?: number;
}

/**
 * Verdict returned by the goal judge model after evaluating an assistant turn
 * against the current goal objective.
 */
export interface GoalJudgeDecision {
  decision: 'done' | 'continue' | 'waiting';
  reason: string;
  judgedAt: number;
}

/**
 * Active goal state. Set via `session.setGoal(...)`, evaluated by the judge
 * model after each assistant turn.
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

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type AttachmentSource = 'inline' | 'preupload' | 'url' | 'provider';

export type HarnessAttachmentKind = 'file' | 'primitive' | 'element';

export type HarnessKnownPrimitiveType =
  | 'text'
  | 'markdown'
  | 'json'
  | 'table'
  | 'chart-data'
  | 'selection'
  | 'citation';

export type HarnessPrimitiveType = HarnessKnownPrimitiveType | (string & {});

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

/**
 * Per-session workspace state, only populated under a resumable per-session
 * workspace provider.
 */
export interface SessionWorkspaceState {
  providerId: string;
  state: unknown;
}

/**
 * Durable session state. Loaded on hydration, flushed under the session's
 * write lease.
 */
export interface SessionRecord {
  id: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  /**
   * `'subagent-tool'` opts the record into the auto-close-on-subagent-end rule.
   * `'top-level'` covers regular user sessions and programmatic child sessions.
   */
  origin: 'top-level' | 'subagent-tool';
  /**
   * Depth of this session in the subagent tree. `0` for top-level sessions;
   * `parent.subagentDepth + 1` for sessions spawned via `spawn_subagent`.
   */
  subagentDepth?: number;
  /**
   * True when the session was created with `threadId: { fresh: true }` and
   * therefore owns the underlying thread under `MemoryStorage`.
   */
  ownsThread: boolean;
  modeId: string;
  modelId: string;
  subagentModelOverrides: Record<string, string>;
  permissionRules: PermissionRules;
  sessionGrants: SessionGrants;
  tokenUsage: TokenUsage;
  pendingQueue: QueuedItem[];
  pendingResume?: PendingResume;
  observationalMemory?: {
    observerModelId?: string;
    reflectorModelId?: string;
  };
  queueAdmissionReceipts?: Record<string, QueueAdmissionReceipt>;
  goal?: GoalState;
  workspace?: SessionWorkspaceState;
  state: unknown;
  createdAt: number;
  lastActivityAt: number;
  closedAt?: number;
  /** Monotonically incremented on every successful saveSession. */
  version: number;
  /** Owner Harness instance id, or undefined when no live Session holds the lease. */
  ownerId?: string;
  /** Epoch ms - when the current lease TTLs out. */
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

/**
 * Metadata index row for a persisted file attachment.
 */
export interface AttachmentRecord {
  /** Session that owns the attachment bytes. */
  ownerSessionId: string;
  /** Stable identifier referenced by `PersistedAttachment.attachmentId`. */
  attachmentId: string;
  /** Owning session - bytes are deleted with the session. */
  sessionId: string;
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
  /** New version after the write - `ifVersion + 1`. */
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
  /** Record version observed at lease time - caller passes this to `saveSession`. */
  version: number;
  /** Epoch ms when the lease expires if not renewed. */
  expiresAt: number;
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
  sessionId: string;
  resourceId: string;
  threadId: string;
  admissionId?: string;
  admissionHash?: string;
  createdAt: number;
  updatedAt: number;
};

export interface HarnessRuntimeDependencyRefs {
  modeId: string;
  agentId?: string;
  modelId?: string;
  workspaceProviderId?: string | null;
}

export interface QueueAdmissionReceipt {
  admissionId: string;
  admissionHash: string;
  queuedItemId: string;
  modeId?: string;
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

export interface OperationAdmissionTombstone {
  kind: HarnessOperationKind;
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

export interface SaveAttachmentInput {
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
