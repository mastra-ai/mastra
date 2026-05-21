import { StorageDomain } from '../base';
import type {
  AcquireSessionLeaseInput,
  AgentSignalResultEvidence,
  AgentSignalResultStatus,
  AttachmentReference,
  AttachmentRecord,
  ChannelActionInitialClaim,
  ChannelActionReceipt,
  ChannelActionToken,
  ChannelDiagnosticsRows,
  ChannelOutboxItem,
  ChannelProviderDeliveryReceipt,
  ChannelInboxInitialClaim,
  ChannelInboxItem,
  CreateOrLoadChannelActionReceiptResult,
  CreateOrLoadChannelActionTokenResult,
  CreateOrLoadChannelInboxItemResult,
  CreateOrLoadHarnessWakeupItemResult,
  CreateOrLoadActiveSessionOptions,
  CreateOrLoadActiveSessionResult,
  DeleteSessionOptions,
  EnqueueChannelOutboxResult,
  HarnessRowErrorCode,
  HarnessSessionEventRecord,
  HarnessSessionEventReplayState,
  HarnessWakeupClaimStatus,
  HarnessWakeupInitialClaim,
  HarnessWakeupItem,
  ListActiveSessionsByThreadInput,
  ListChannelDiagnosticsInput,
  ListSessionsByThreadInput,
  ListSessionsInput,
  LoadedAttachment,
  OperationAdmissionEvidence,
  OperationAdmissionTombstone,
  QueueAdmissionReceipt,
  ReleaseSessionLeaseInput,
  RenewSessionLeaseInput,
  SaveAttachmentInput,
  SaveAttachmentReferenceInput,
  SaveAttachmentResult,
  SaveSessionOptions,
  SaveSessionResult,
  SessionLeaseResult,
  SessionRecord,
  SessionSummary,
  ThreadDeleteFenceLease,
  WithThreadDeleteFenceInput,
} from './types';

export interface WriteMessageResultEvidenceResult {
  created: boolean;
  evidence?: AgentSignalResultEvidence;
}

/**
 * Thrown by `saveSession` when `ifVersion` does not match the record's
 * current `version`. The caller should rehydrate and retry once
 * (HARNESS_V1_SPEC.md §5.8).
 */
export class HarnessStorageVersionConflictError extends Error {
  readonly name: string = 'HarnessStorageVersionConflictError';
  readonly code: 'harness.storage.version_conflict' | 'harness.storage.delete_guard_conflict' =
    'harness.storage.version_conflict';
  constructor(
    public readonly sessionId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super(`Session "${sessionId}" version conflict: expected ${expectedVersion}, found ${actualVersion}`);
  }
}

export type HarnessStorageDeleteGuardField =
  | 'ifVersion'
  | 'expectedResourceId'
  | 'expectedThreadId'
  | 'expectedParentSessionId'
  | 'expectedCreatedAt'
  | 'requireClosed';

export class HarnessStorageDeleteGuardConflictError extends HarnessStorageVersionConflictError {
  override readonly name = 'HarnessStorageDeleteGuardConflictError';
  override readonly code = 'harness.storage.delete_guard_conflict' as const;
  readonly guardCode = 'harness.storage.delete_guard_conflict' as const;
  constructor(
    sessionId: string,
    public readonly guard: HarnessStorageDeleteGuardField,
    expectedVersion: number,
    actualVersion: number,
  ) {
    super(sessionId, expectedVersion, actualVersion);
    this.message = `Session "${sessionId}" delete guard conflict on ${guard}`;
  }
}

/**
 * Thrown by `acquireSessionLease` / `renewSessionLease` / `releaseSessionLease`
 * / `saveSession` when another owner currently holds the lease.
 */
export class HarnessStorageLeaseConflictError extends Error {
  readonly name = 'HarnessStorageLeaseConflictError';
  readonly code = 'harness.storage.lease_conflict' as const;
  constructor(
    public readonly sessionId: string,
    public readonly heldBy: string,
    public readonly expiresAt: number,
  ) {
    super(`Session "${sessionId}" lease held by "${heldBy}" until ${new Date(expiresAt).toISOString()}`);
  }
}

/**
 * Thrown by guarded attachment delete when durable references still point at
 * the bytes. The harness layer maps this to the public
 * `HarnessAttachmentInUseError`.
 */
export class HarnessStorageAttachmentInUseError extends Error {
  readonly name = 'HarnessStorageAttachmentInUseError';
  readonly code = 'harness.storage.attachment_in_use' as const;
  constructor(
    public readonly sessionId: string,
    public readonly attachmentId: string,
    public readonly references: AttachmentReference[],
  ) {
    super(`Attachment "${attachmentId}" for session "${sessionId}" is still referenced`);
  }
}

export class HarnessStorageAttachmentUnavailableError extends Error {
  readonly name = 'HarnessStorageAttachmentUnavailableError';
  readonly code = 'harness.storage.attachment_unavailable' as const;
  constructor(
    public readonly sessionId: string,
    public readonly attachmentId: string,
  ) {
    super(`Attachment "${attachmentId}" for session "${sessionId}" is not available`);
  }
}

/**
 * Thrown by lease/attachment operations when the targeted session record
 * does not exist in storage.
 */
export class HarnessStorageSessionNotFoundError extends Error {
  readonly name = 'HarnessStorageSessionNotFoundError';
  readonly code = 'harness.storage.session_not_found' as const;
  constructor(public readonly sessionId: string) {
    super(`Session "${sessionId}" not found in harness storage`);
  }
}

export class HarnessStorageParentSessionUnavailableError extends Error {
  readonly name = 'HarnessStorageParentSessionUnavailableError';
  readonly code = 'harness.storage.parent_session_unavailable' as const;
  constructor(
    public readonly parentSessionId: string,
    public readonly reason: 'not_found' | 'closed' | 'closing',
  ) {
    super(`Parent session "${parentSessionId}" is unavailable for child admission: ${reason}`);
  }
}

export class HarnessStorageAdmissionConflictError extends Error {
  readonly name = 'HarnessStorageAdmissionConflictError';
  readonly code = 'harness.storage.admission_conflict' as const;
  constructor(
    public readonly sessionId: string,
    public readonly kind: 'message' | 'queue',
    public readonly admissionId: string,
  ) {
    super(`Admission "${admissionId}" for ${kind} in session "${sessionId}" conflicts with stored evidence`);
  }
}

export class HarnessStorageThreadDeleteFenceConflictError extends Error {
  readonly name = 'HarnessStorageThreadDeleteFenceConflictError';
  readonly code = 'harness.storage.thread_delete_fence_conflict' as const;
  constructor(
    public readonly threadId: string,
    public readonly ownerId?: string,
  ) {
    super(`Thread "${threadId}" is currently fenced for deletion`);
  }
}

export class HarnessStorageThreadDeleteFenceUnsupportedError extends Error {
  readonly name = 'HarnessStorageThreadDeleteFenceUnsupportedError';
  readonly code = 'harness.storage.thread_delete_fence_unsupported' as const;
  constructor() {
    super('HarnessStorage.withThreadDeleteFence must be implemented by this storage adapter');
  }
}

export class HarnessStorageSessionEventReplayUnsupportedError extends Error {
  readonly name = 'HarnessStorageSessionEventReplayUnsupportedError';
  readonly code = 'harness.storage.session_event_replay_unsupported' as const;
  constructor() {
    super('HarnessStorage session event replay must be implemented by this storage adapter');
  }
}

export class HarnessStorageChannelDiagnosticsUnsupportedError extends Error {
  readonly name = 'HarnessStorageChannelDiagnosticsUnsupportedError';
  readonly code = 'harness.storage.channel_diagnostics_unsupported' as const;
  constructor() {
    super('HarnessStorage channel diagnostics must be implemented by this storage adapter');
  }
}

export class HarnessStorageChannelInboxClaimConflictError extends Error {
  readonly name = 'HarnessStorageChannelInboxClaimConflictError';
  readonly code = 'harness.storage.channel_inbox_claim_conflict' as const;
  constructor(
    public readonly inboxItemId: string,
    public readonly claimId?: string,
  ) {
    super(`Channel inbox item "${inboxItemId}" is not held by claim "${claimId ?? '<none>'}"`);
  }
}

export class HarnessStorageChannelInboxTransitionError extends Error {
  readonly name = 'HarnessStorageChannelInboxTransitionError';
  readonly code = 'harness.storage.channel_inbox_transition_invalid' as const;
  constructor(
    public readonly inboxItemId: string,
    public readonly fromStatus: ChannelInboxItem['status'] | undefined,
    public readonly toStatus: ChannelInboxItem['status'],
    reason: string,
  ) {
    super(
      `Channel inbox item "${inboxItemId}" cannot transition from "${fromStatus ?? '<missing>'}" to "${toStatus}": ${reason}`,
    );
  }
}

export class HarnessStorageChannelActionClaimConflictError extends Error {
  readonly name = 'HarnessStorageChannelActionClaimConflictError';
  readonly code = 'harness.storage.channel_action_claim_conflict' as const;
  constructor(
    public readonly receiptId: string,
    public readonly claimId?: string,
  ) {
    super(`Channel action receipt "${receiptId}" is not held by claim "${claimId ?? '<none>'}"`);
  }
}

export class HarnessStorageChannelActionTokenConflictError extends Error {
  readonly name = 'HarnessStorageChannelActionTokenConflictError';
  readonly code = 'harness.storage.channel_action_token_conflict' as const;
  constructor(
    public readonly actionTokenId: string,
    reason: string,
  ) {
    super(`Channel action token "${actionTokenId}" conflicts with stored token: ${reason}`);
  }
}

export class HarnessStorageChannelActionReceiptTransitionError extends Error {
  readonly name = 'HarnessStorageChannelActionReceiptTransitionError';
  readonly code = 'harness.storage.channel_action_receipt_transition_invalid' as const;
  constructor(
    public readonly receiptId: string,
    public readonly fromStatus: ChannelActionReceipt['status'] | undefined,
    public readonly toStatus: ChannelActionReceipt['status'],
    reason: string,
  ) {
    super(
      `Channel action receipt "${receiptId}" cannot transition from "${fromStatus ?? '<missing>'}" to "${toStatus}": ${reason}`,
    );
  }
}

export class HarnessStorageChannelOutboxClaimConflictError extends Error {
  readonly name = 'HarnessStorageChannelOutboxClaimConflictError';
  readonly code = 'harness.storage.channel_outbox_claim_conflict' as const;
  constructor(
    public readonly outboxItemId: string,
    public readonly claimId?: string,
  ) {
    super(`Channel outbox item "${outboxItemId}" is not held by claim "${claimId ?? '<none>'}"`);
  }
}

export class HarnessStorageChannelOutboxTransitionError extends Error {
  readonly name = 'HarnessStorageChannelOutboxTransitionError';
  readonly code = 'harness.storage.channel_outbox_transition_invalid' as const;
  constructor(
    public readonly outboxItemId: string,
    public readonly fromStatus: ChannelOutboxItem['status'] | undefined,
    public readonly toStatus: ChannelOutboxItem['status'],
    reason: string,
  ) {
    super(
      `Channel outbox item "${outboxItemId}" cannot transition from "${fromStatus ?? '<missing>'}" to "${toStatus}": ${reason}`,
    );
  }
}

export class HarnessStorageWakeupClaimConflictError extends Error {
  readonly name = 'HarnessStorageWakeupClaimConflictError';
  readonly code = 'harness.storage.wakeup_claim_conflict' as const;
  constructor(
    public readonly wakeupItemId: string,
    public readonly claimId?: string,
  ) {
    super(`Harness wakeup item "${wakeupItemId}" is not held by claim "${claimId ?? '<none>'}"`);
  }
}

export class HarnessStorageWakeupTransitionError extends Error {
  readonly name = 'HarnessStorageWakeupTransitionError';
  readonly code = 'harness.storage.wakeup_transition_invalid' as const;
  constructor(
    public readonly wakeupItemId: string,
    public readonly fromStatus: HarnessWakeupItem['status'] | undefined,
    public readonly toStatus: HarnessWakeupItem['status'],
    reason: string,
  ) {
    super(
      `Harness wakeup item "${wakeupItemId}" cannot transition from "${fromStatus ?? '<missing>'}" to "${toStatus}": ${reason}`,
    );
  }
}

/**
 * Storage domain for the v1 Harness — see HARNESS_V1_SPEC.md §5.
 *
 * Owns four resource groups:
 *
 *   1. **Session records** — durable session state (mode, model, permissions,
 *      pending queue, pending approval/suspension/question/plan, goal,
 *      workspace state, custom user state). Persisted under an
 *      optimistic-CAS contract: every write supplies an `ifVersion` and the
 *      adapter bumps to `ifVersion + 1` on success.
 *
 *   2. **Session leases** — per-session ownership tokens that gate writes
 *      across multiple Harness instances pointing at the same store
 *      (HARNESS_V1_SPEC.md §5.8). Acquire-renew-release pattern with TTL.
 *
 *   3. **Attachment metadata** — index rows mapping `attachmentId` to
 *      `(ownerSessionId, name, mimeType, bytes, sha256, source)` and the
 *      underlying bytes. Adapters are free to delegate the bytes to a
 *      separate blob store (S3, R2, local disk) under the same interface.
 *
 *   4. **Thread delete fences** — short-lived thread-scoped ownership tokens
 *      that block active-session admission while `threads.delete(...)` proves
 *      storage ownership before deleting global MemoryStorage thread rows.
 *
 * Threads and messages are NOT in this domain — they live under
 * `MemoryStorage`. The harness layer composes the two.
 */
export abstract class HarnessStorage extends StorageDomain {
  get supportsAtomicDeleteSessions(): boolean {
    return this.deleteSessions !== HarnessStorage.prototype.deleteSessions;
  }

  constructor() {
    super({
      component: 'STORAGE',
      name: 'HARNESS',
    });
  }

  // -------------------------------------------------------------------------
  // Session records
  // -------------------------------------------------------------------------

  /**
   * Direct ID lookup. Returns the record regardless of `closedAt` — this is
   * the path that powers history APIs.
   *
   * Resource scoping is NOT enforced here; the harness layer cross-checks
   * `resourceId` against the returned record before surfacing it.
   */
  abstract loadSession(opts: { harnessName?: string; sessionId: string }): Promise<SessionRecord | null>;

  /**
   * Lookup by (thread, resource). Returns only **active** records
   * (`closedAt === undefined`). Returns `null` when no active record exists,
   * even if one or more closed records match — close-then-reopen-by-thread
   * is guaranteed to create a fresh session (HARNESS_V1_SPEC.md §5.3).
   *
   * Implementations reject new rows that would create a second active session
   * for the same `(harnessName, resourceId, threadId)` admission key.
   */
  abstract loadSessionByThread(opts: {
    harnessName?: string;
    threadId: string;
    resourceId: string;
  }): Promise<SessionRecord | null>;

  /**
   * List session summaries for a resource. Closed records are excluded by
   * default; pass `includeClosed: true` to surface them. `parentSessionId`
   * filters to direct children — adapters MUST push this filter to the
   * storage layer (no in-memory fan-out).
   */
  abstract listSessions(opts: ListSessionsInput): Promise<SessionSummary[]>;

  /**
   * List session summaries for an exact `(resourceId, threadId)` key. Closed
   * records are excluded by default; pass `includeClosed: true` to surface
   * closed historical owners. Adapters must push the thread filter to the
   * storage layer because this powers `threads.delete(...)` root discovery.
   * The base implementation fails closed so custom adapters do not silently
   * fall back to resource-wide scans.
   */
  async listSessionsByThread(_opts: ListSessionsByThreadInput): Promise<SessionSummary[]> {
    throw new Error('HarnessStorage.listSessionsByThread must be implemented by this storage adapter');
  }

  /**
   * List active sessions for a thread across all resources and, by default,
   * every harness namespace visible to this adapter. Pass `harnessName` only
   * when a caller explicitly needs a namespace-scoped view. Used before global
   * `MemoryStorage.deleteThread(...)` calls, where deleting by thread id could
   * otherwise remove messages for a live session in another resource or
   * harness namespace backed by the same Harness storage adapter. Adapters
   * that back `threads.delete(...)` must override this method; the base
   * implementation fails closed because returning incomplete ownership data
   * before a global memory-thread delete could cause data loss.
   */
  async listActiveSessionsByThread(_opts: ListActiveSessionsByThreadInput): Promise<SessionSummary[]> {
    throw new Error('HarnessStorage.listActiveSessionsByThread must be implemented by this storage adapter');
  }

  /**
   * Run a small critical section while new active-session admission for this
   * thread is fenced. Durable adapters persist the fence so another process
   * cannot create a session after the active-session guard and before the
   * global memory-thread delete. The base implementation fails closed because a
   * no-op fence is unsafe for `threads.delete(...)`.
   */
  async withThreadDeleteFence<T>(
    _opts: WithThreadDeleteFenceInput,
    fn: (fence: ThreadDeleteFenceLease) => Promise<T>,
  ): Promise<T> {
    void fn;
    throw new HarnessStorageThreadDeleteFenceUnsupportedError();
  }

  /**
   * Optimistic-CAS write of a session record.
   *
   * - For first insert, pass `ifVersion: 0`. Adapters create the row with
   *   `version: 1` and return `{ version: 1 }`.
   * - For updates, pass the version observed on read. Adapters update only
   *   when the row's current version matches and bump to `ifVersion + 1`.
   *
   * Throws `HarnessStorageVersionConflictError` on version mismatch.
   * Throws `HarnessStorageLeaseConflictError` when `ownerId` does not match
   * the row's current lease holder (and the lease has not expired).
   */
  abstract saveSession(record: SessionRecord, opts: SaveSessionOptions): Promise<SaveSessionResult>;

  /**
   * CAS write of a session record plus durable attachment reference rows in
   * one adapter operation. Used by queue admission so a racing attachment
   * delete either happens before the queued item exists, or observes the new
   * reference and fails. Implementations must also reject if any referenced
   * attachment row is missing. The session record must already exist.
   */
  abstract saveSessionWithAttachmentReferences(
    record: SessionRecord,
    opts: SaveSessionOptions,
    references: SaveAttachmentReferenceInput[],
  ): Promise<SaveSessionResult>;

  /**
   * Atomic active-session admission. Returns the existing active row for
   * `(harnessName, resourceId, threadId)` without overwriting it; otherwise
   * inserts `record`. When `record.parentSessionId` is present and no active
   * row already exists, adapters must also verify the parent exists in the
   * same harness/resource and is neither closing nor closed in the same atomic
   * admission boundary. A created row also receives the caller's initial lease.
   *
   * Throws `HarnessStorageParentSessionUnavailableError` from
   * `createOrLoadActiveSession` when parent verification fails.
   */
  abstract createOrLoadActiveSession(
    record: SessionRecord,
    opts: CreateOrLoadActiveSessionOptions,
  ): Promise<CreateOrLoadActiveSessionResult>;

  /**
   * Hard-delete of a single session record. Adapters do NOT implement cascade
   * themselves. No-op when the record does not exist. Optional
   * `DeleteSessionOptions` guard fields are CAS fences: if any provided guard
   * does not match the stored row, adapters reject without deleting the row.
   *
   * Implementations should also delete attachments owned by the session
   * (equivalent to `deleteAttachmentsForSession`) to keep the index clean.
   */
  abstract deleteSession(opts: DeleteSessionOptions): Promise<void>;

  /**
   * Hard-delete a collected session subtree under one guarded adapter boundary.
   * Adapters must either delete every still-existing guarded row or reject
   * without deleting any of them. The default preserves single-session legacy
   * adapter compatibility; adapters must override this for multi-session
   * all-or-nothing batch semantics.
   */
  async deleteSessions(opts: { sessions: DeleteSessionOptions[] }): Promise<void> {
    if (opts.sessions.length > 1) {
      throw new Error(
        'HarnessStorage.deleteSessions must be overridden by this storage adapter for atomic batch deletes',
      );
    }
    for (const session of opts.sessions) {
      await this.deleteSession(session);
    }
  }

  // -------------------------------------------------------------------------
  // Session leases (HARNESS_V1_SPEC.md §5.8)
  // -------------------------------------------------------------------------

  /**
   * Acquire the write lease for a session.
   *
   * Succeeds when:
   *   - the row has no `ownerId`, OR
   *   - the row's lease has expired (`leaseExpiresAt <= now`), OR
   *   - the row's `ownerId` already matches `opts.ownerId` (idempotent).
   *
   * Otherwise throws `HarnessStorageLeaseConflictError`. Callers that want
   * blocking or stealing semantics implement them above this primitive.
   *
   * Throws `HarnessStorageSessionNotFoundError` when the row does not exist.
   */
  abstract acquireSessionLease(opts: AcquireSessionLeaseInput): Promise<SessionLeaseResult>;

  /**
   * Renew an existing lease — bumps `leaseExpiresAt` to `now + ttlMs`.
   *
   * Throws `HarnessStorageLeaseConflictError` when the row's current
   * `ownerId` does not match `opts.ownerId`, or when the lease has already
   * expired (no implicit re-acquire — caller must use `acquire` for that).
   * Throws `HarnessStorageSessionNotFoundError` when the row does not exist.
   */
  abstract renewSessionLease(opts: RenewSessionLeaseInput): Promise<SessionLeaseResult>;

  /**
   * Release the lease (clears `ownerId` and `leaseExpiresAt`). No-op when
   * `opts.ownerId` does not match the current owner — releasing a lease you
   * do not hold should not throw, since the common cause is "we noticed our
   * lease expired and another instance picked it up".
   *
   * Throws `HarnessStorageSessionNotFoundError` when the row does not exist.
   */
  abstract releaseSessionLease(opts: ReleaseSessionLeaseInput): Promise<void>;

  // -------------------------------------------------------------------------
  // Attachments
  // -------------------------------------------------------------------------

  /**
   * Persist an attachment's bytes and index row. Attachment IDs are immutable:
   * when the row already exists, adapters return the existing row's size and
   * digest without overwriting bytes or metadata.
   *
   * Adapters MAY delegate the bytes to a blob store but the index row
   * (filename, mime type, size, digest, source, owning session) must be
   * queryable through `getAttachmentRecord`; `loadAttachment` returns the
   * byte payload plus replay-validation metadata.
   */
  abstract saveAttachment(opts: SaveAttachmentInput): Promise<SaveAttachmentResult>;

  /**
   * Load an attachment by (sessionId, attachmentId). Returns null when the
   * row is missing.
   */
  abstract loadAttachment(opts: {
    harnessName?: string;
    sessionId: string;
    attachmentId: string;
  }): Promise<LoadedAttachment | null>;

  /**
   * Delete a single attachment. No-op when the row is missing.
   * Throws `HarnessStorageAttachmentInUseError` while references remain.
   */
  abstract deleteAttachment(opts: { harnessName?: string; sessionId: string; attachmentId: string }): Promise<void>;

  /**
   * Delete all attachments owned by a session. Called from `deleteSession`
   * implementations so the index does not leak rows when a session is torn
   * down. Referenced rows are skipped; force cleanup belongs to the lifecycle
   * delete lane.
   */
  abstract deleteAttachmentsForSession(opts: { harnessName?: string; sessionId: string }): Promise<void>;

  /**
   * Look up the index row only (without bytes). Useful for attachment
   * metadata listings (e.g. message rendering).
   */
  abstract getAttachmentRecord(opts: {
    harnessName?: string;
    sessionId: string;
    attachmentId: string;
  }): Promise<AttachmentRecord | null>;

  /**
   * Register durable references to attachment bytes. Source ids are scoped by
   * source: queued item id for `queued_item`, message id for
   * `message_history`, run id for `current_run`, and source-specific row ids
   * for channel/wakeup/outbox references.
   */
  abstract recordAttachmentReferences(references: SaveAttachmentReferenceInput[]): Promise<void>;

  abstract deleteAttachmentReferences(references: SaveAttachmentReferenceInput[]): Promise<void>;

  abstract listAttachmentReferences(opts: {
    harnessName?: string;
    sessionId: string;
    attachmentId: string;
  }): Promise<AttachmentReference[]>;

  // -------------------------------------------------------------------------
  // Admission/result evidence
  // -------------------------------------------------------------------------

  abstract loadMessageResultEvidence(opts: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
    signalId: string;
  }): Promise<AgentSignalResultStatus | OperationAdmissionTombstone | null>;

  abstract writeMessageResultEvidence(record: AgentSignalResultEvidence): Promise<WriteMessageResultEvidenceResult>;

  abstract loadQueueResultEvidence(opts: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    queuedItemId: string;
  }): Promise<QueueAdmissionReceipt | OperationAdmissionTombstone | null>;

  abstract resolveOperationAdmissionEvidence(opts: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId?: string;
    kind: 'message' | 'queue';
    admissionId: string;
    attemptedAdmissionHash: string;
  }): Promise<{
    status: 'none' | 'duplicate' | 'conflict';
    evidence?: OperationAdmissionEvidence;
    storedAdmissionHash?: string;
  }>;

  abstract writeOperationAdmissionTombstone(record: OperationAdmissionTombstone): Promise<void>;

  abstract compactOperationResultEvidence(opts: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    kind: 'message' | 'queue';
    signalId?: string;
    queuedItemId?: string;
    now: number;
  }): Promise<OperationAdmissionTombstone | null>;

  abstract deleteOperationAdmissionTombstonesForSession(opts: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId?: string;
    signalId?: string;
  }): Promise<void>;

  // -------------------------------------------------------------------------
  // Session event replay
  // -------------------------------------------------------------------------

  async appendSessionEvent(_record: HarnessSessionEventRecord): Promise<void> {
    throw new HarnessStorageSessionEventReplayUnsupportedError();
  }

  async getSessionEventReplayState(_opts: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
  }): Promise<HarnessSessionEventReplayState | null> {
    throw new HarnessStorageSessionEventReplayUnsupportedError();
  }

  async listSessionEvents(_opts: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
    epoch: string;
    afterSequence: number;
    limit: number;
  }): Promise<HarnessSessionEventRecord[]> {
    throw new HarnessStorageSessionEventReplayUnsupportedError();
  }

  // -------------------------------------------------------------------------
  // Channel inbox ledger
  // -------------------------------------------------------------------------

  abstract saveChannelInboxItem(record: ChannelInboxItem): Promise<void>;

  /**
   * Atomic insert-or-load for provider callback retries. The unique
   * idempotency identity is `(harnessName, channelId, idempotencyKey)`;
   * `payloadHash` is the adapter-normalized content/files/context hash used
   * to distinguish exact provider retries from same-key payload conflicts.
   * `initialClaim` may claim a newly created row or an unclaimed/expired
   * existing row, but it must not steal an unexpired active claim.
   */
  abstract createOrLoadChannelInboxItem(
    record: ChannelInboxItem,
    opts?: { initialClaim?: ChannelInboxInitialClaim },
  ): Promise<CreateOrLoadChannelInboxItemResult>;

  abstract loadChannelInboxItemByIdempotencyKey(opts: {
    harnessName: string;
    channelId: string;
    idempotencyKey: string;
  }): Promise<ChannelInboxItem | null>;

  abstract claimChannelInboxItems(opts: {
    harnessName: string;
    channelId?: string;
    statuses: Array<'received' | 'admitted' | 'failed'>;
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<ChannelInboxItem[]>;

  abstract renewChannelInboxClaim(opts: {
    harnessName?: string;
    inboxItemId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }>;

  abstract updateChannelInboxItem(
    record: ChannelInboxItem,
    opts: { claimId: string; harnessName?: string },
  ): Promise<void>;

  // -------------------------------------------------------------------------
  // Channel action token and receipt ledger
  // -------------------------------------------------------------------------

  abstract createOrLoadChannelActionToken(record: ChannelActionToken): Promise<CreateOrLoadChannelActionTokenResult>;

  abstract loadChannelActionTokenById(opts: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
  }): Promise<ChannelActionToken | null>;

  abstract loadChannelActionTokenByTransportHash(opts: {
    harnessName: string;
    channelId: string;
    transportHash: string;
  }): Promise<ChannelActionToken | null>;

  abstract loadChannelActionTokenForPendingItem(opts: {
    harnessName: string;
    channelId: string;
    bindingId: string;
    bindingGeneration: number;
    owningSessionId: string;
    itemId: string;
    kind: ChannelActionToken['kind'];
    runId: string;
    pendingRequestedAt: number;
    metadataHash: string;
  }): Promise<ChannelActionToken | null>;

  abstract revokeChannelActionToken(opts: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
    revokedAt?: number;
    revokedReason?: ChannelActionToken['revokedReason'];
  }): Promise<ChannelActionToken>;

  abstract saveChannelActionReceipt(record: ChannelActionReceipt): Promise<void>;

  abstract createOrLoadChannelActionReceipt(
    record: ChannelActionReceipt,
    opts?: { initialClaim?: ChannelActionInitialClaim },
  ): Promise<CreateOrLoadChannelActionReceiptResult>;

  abstract loadChannelActionReceiptByActionId(opts: {
    harnessName: string;
    channelId: string;
    actionId: string;
  }): Promise<ChannelActionReceipt | null>;

  abstract loadChannelActionReceiptByTokenId(opts: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
  }): Promise<ChannelActionReceipt | null>;

  abstract claimChannelActionReceipts(opts: {
    harnessName: string;
    channelId?: string;
    statuses: Array<'received' | 'accepted' | 'failed'>;
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<ChannelActionReceipt[]>;

  abstract renewChannelActionReceiptClaim(opts: {
    harnessName?: string;
    receiptId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }>;

  abstract updateChannelActionReceipt(
    record: ChannelActionReceipt,
    opts: { claimId: string; harnessName?: string },
  ): Promise<void>;

  // -------------------------------------------------------------------------
  // Channel outbox ledger
  // -------------------------------------------------------------------------

  /**
   * Atomic enqueue-or-load for provider-visible outbound effects. The unique
   * idempotency identity is `(harnessName, bindingId, idempotencyKey)`.
   * Exact duplicates must keep the first row; same-key rows with different
   * payload hash, operation identity, or delivery semantics return
   * `conflict: true` before any provider-visible side effect can run.
   */
  abstract enqueueChannelOutbox(record: ChannelOutboxItem): Promise<EnqueueChannelOutboxResult>;

  /**
   * Claims due pending/failed/expired-claimed rows for dispatch. Implementors
   * must enforce per-binding head-of-line ordering: a later non-terminal row
   * for one binding must not be claimed while an earlier non-terminal row for
   * the same binding remains unsettled.
   */
  abstract claimChannelOutbox(opts: {
    harnessName: string;
    channelId?: string;
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<ChannelOutboxItem[]>;

  abstract renewChannelOutboxClaim(opts: {
    harnessName?: string;
    outboxItemId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }>;

  abstract markChannelOutboxSent(opts: {
    harnessName?: string;
    outboxItemId: string;
    claimId: string;
    sentAt?: number;
    providerMessageId?: string;
    providerReceipt?: ChannelProviderDeliveryReceipt;
  }): Promise<void>;

  abstract markChannelOutboxFailed(opts: {
    harnessName?: string;
    outboxItemId: string;
    claimId: string;
    retryAt?: number;
    dead?: boolean;
    error: { code: HarnessRowErrorCode; message: string; retryable?: boolean };
  }): Promise<void>;

  /**
   * Read-only session-scoped channel ledger diagnostics. Implementations must
   * push `resourceId` and `sessionIds` filters to storage and must not mutate,
   * claim, dispatch, retry, or reconcile rows.
   */
  async listChannelDiagnosticsRows(_opts: ListChannelDiagnosticsInput): Promise<ChannelDiagnosticsRows> {
    throw new HarnessStorageChannelDiagnosticsUnsupportedError();
  }

  // -------------------------------------------------------------------------
  // Wakeup ledger
  // -------------------------------------------------------------------------

  abstract createOrLoadHarnessWakeupItem(
    record: HarnessWakeupItem,
    opts?: { initialClaim?: HarnessWakeupInitialClaim },
  ): Promise<CreateOrLoadHarnessWakeupItemResult>;

  abstract loadHarnessWakeupItemByIdempotencyKey(opts: {
    harnessName: string;
    idempotencyKey: string;
  }): Promise<HarnessWakeupItem | null>;

  abstract loadHarnessWakeupItemBySourceFire(opts: {
    harnessName: string;
    source: HarnessWakeupItem['source'];
    sourceId: string;
    fireId: string;
  }): Promise<HarnessWakeupItem | null>;

  abstract claimHarnessWakeupItems(opts: {
    harnessName: string;
    source?: HarnessWakeupItem['source'];
    statuses: HarnessWakeupClaimStatus[];
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<HarnessWakeupItem[]>;

  abstract renewHarnessWakeupClaim(opts: {
    harnessName?: string;
    wakeupItemId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }>;

  abstract updateHarnessWakeupItem(
    record: HarnessWakeupItem,
    opts: { claimId: string; harnessName?: string },
  ): Promise<void>;

  // -------------------------------------------------------------------------
  // Test-only
  // -------------------------------------------------------------------------

  /**
   * Drop all session records, leases, and attachments held by this domain.
   * Required by the `StorageDomain` contract; intended for tests only.
   */
  abstract dangerouslyClearAll(): Promise<void>;
}
