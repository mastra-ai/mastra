import { StorageDomain } from '../base';
import type {
  AcquireSessionLeaseInput,
  AgentSignalResultEvidence,
  AgentSignalResultStatus,
  AttachmentRecord,
  ListSessionsInput,
  LoadedAttachment,
  OperationAdmissionEvidence,
  OperationAdmissionTombstone,
  QueueAdmissionReceipt,
  ReleaseSessionLeaseInput,
  RenewSessionLeaseInput,
  SaveAttachmentInput,
  SaveSessionOptions,
  SaveSessionResult,
  SessionLeaseResult,
  SessionRecord,
  SessionSummary,
} from './types';

export interface WriteMessageResultEvidenceResult {
  created: boolean;
  evidence?: AgentSignalResultEvidence | OperationAdmissionTombstone;
}

/**
 * Thrown by `saveSession` when `ifVersion` does not match the record's
 * current `version`. The caller should rehydrate and retry once.
 */
export class HarnessStorageVersionConflictError extends Error {
  readonly name = 'HarnessStorageVersionConflictError';
  readonly code = 'harness.storage.version_conflict' as const;

  constructor(
    public readonly sessionId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super(`Session "${sessionId}" version conflict: expected ${expectedVersion}, found ${actualVersion}`);
  }
}

/**
 * Thrown by lease operations and `saveSession` when another owner currently
 * holds the lease.
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
 * Thrown by lease operations when the targeted session record does not exist.
 */
export class HarnessStorageSessionNotFoundError extends Error {
  readonly name = 'HarnessStorageSessionNotFoundError';
  readonly code = 'harness.storage.session_not_found' as const;

  constructor(public readonly sessionId: string) {
    super(`Session "${sessionId}" not found in harness storage`);
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

/**
 * Storage domain for the v1 Harness.
 *
 * Owns three resources:
 *
 *   1. Session records - durable session state persisted under an
 *      optimistic-CAS contract.
 *   2. Session leases - per-session ownership tokens that gate writes across
 *      multiple Harness instances pointing at the same store.
 *   3. Attachment metadata and bytes - an index from `attachmentId` to the
 *      stored attachment payload.
 *
 * Threads and messages are NOT in this domain - they live under
 * `MemoryStorage`. The harness layer composes the two.
 */
export abstract class HarnessStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'HARNESS',
    });
  }

  /**
   * Direct ID lookup. Returns the record regardless of `closedAt`.
   */
  abstract loadSession(opts: { sessionId: string }): Promise<SessionRecord | null>;

  /**
   * Lookup by (thread, resource). Returns only active records
   * (`closedAt === undefined`). If multiple active records match,
   * implementations return the most recent by `lastActivityAt`.
   */
  abstract loadSessionByThread(opts: { threadId: string; resourceId: string }): Promise<SessionRecord | null>;

  /**
   * List session summaries for a resource. Closed records are excluded by
   * default; pass `includeClosed: true` to surface them.
   */
  abstract listSessions(opts: ListSessionsInput): Promise<SessionSummary[]>;

  /**
   * Optimistic-CAS write of a session record.
   *
   * Throws `HarnessStorageVersionConflictError` on version mismatch.
   * Throws `HarnessStorageLeaseConflictError` when `ownerId` does not match
   * the row's current lease holder and the lease has not expired.
   */
  abstract saveSession(record: SessionRecord, opts: SaveSessionOptions): Promise<SaveSessionResult>;

  /**
   * Hard-delete of a single session record. No-op when the record does not
   * exist. Implementations should also delete attachments owned by the
   * session.
   */
  abstract deleteSession(opts: { sessionId: string }): Promise<void>;

  /**
   * Acquire the write lease for a session.
   */
  abstract acquireSessionLease(opts: AcquireSessionLeaseInput): Promise<SessionLeaseResult>;

  /**
   * Renew an existing lease.
   */
  abstract renewSessionLease(opts: RenewSessionLeaseInput): Promise<SessionLeaseResult>;

  /**
   * Release the lease. No-op when `opts.ownerId` does not match the current
   * owner.
   */
  abstract releaseSessionLease(opts: ReleaseSessionLeaseInput): Promise<void>;

  /**
   * Persist an attachment's bytes and index row.
   */
  abstract saveAttachment(opts: SaveAttachmentInput): Promise<void>;

  /**
   * Load an attachment by (sessionId, attachmentId). Returns null when the row
   * is missing.
   */
  abstract loadAttachment(opts: { sessionId: string; attachmentId: string }): Promise<LoadedAttachment | null>;

  /**
   * Delete a single attachment. No-op when the row is missing.
   */
  abstract deleteAttachment(opts: { sessionId: string; attachmentId: string }): Promise<void>;

  /**
   * Delete all attachments owned by a session.
   */
  abstract deleteAttachmentsForSession(opts: { sessionId: string }): Promise<void>;

  /**
   * Look up the index row only, without bytes.
   */
  abstract getAttachmentRecord(opts: { sessionId: string; attachmentId: string }): Promise<AttachmentRecord | null>;

  abstract loadMessageResultEvidence(opts: {
    sessionId: string;
    resourceId: string;
    threadId: string;
    signalId: string;
  }): Promise<AgentSignalResultStatus | OperationAdmissionTombstone | null>;

  abstract writeMessageResultEvidence(record: AgentSignalResultEvidence): Promise<WriteMessageResultEvidenceResult>;

  abstract loadQueueResultEvidence(opts: {
    sessionId: string;
    resourceId: string;
    queuedItemId: string;
  }): Promise<QueueAdmissionReceipt | OperationAdmissionTombstone | null>;

  abstract resolveOperationAdmissionEvidence(opts: {
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
    sessionId: string;
    resourceId: string;
    kind: 'message' | 'queue';
    signalId?: string;
    queuedItemId?: string;
    now: number;
  }): Promise<OperationAdmissionTombstone | null>;

  abstract deleteOperationAdmissionTombstonesForSession(opts: {
    sessionId: string;
    resourceId: string;
    threadId?: string;
    signalId?: string;
  }): Promise<void>;

  /**
   * Drop all session records, leases, and attachments held by this domain.
   * Intended for tests only.
   */
  abstract dangerouslyClearAll(): Promise<void>;
}
