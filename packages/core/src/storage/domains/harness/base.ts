import { StorageDomain } from '../base';
import type {
  AcquireSessionLeaseInput,
  AttachmentRecord,
  ListSessionsInput,
  LoadedAttachment,
  ReleaseSessionLeaseInput,
  RenewSessionLeaseInput,
  SaveAttachmentInput,
  SaveSessionOptions,
  SaveSessionResult,
  SessionLeaseResult,
  SessionRecord,
  SessionSummary,
} from './types';

/**
 * Thrown by `saveSession` when `ifVersion` does not match the record's
 * current `version`. The caller should rehydrate and retry once
 * (HARNESS_V1_SPEC.md §5.8).
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

/**
 * Storage domain for the v1 Harness — see HARNESS_V1_SPEC.md §5.
 *
 * Owns three resources:
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
 *      `(sessionId, name, mimeType, sizeBytes)` and the underlying bytes.
 *      Adapters are free to delegate the bytes to a separate blob store
 *      (S3, R2, local disk) under the same interface.
 *
 * Threads and messages are NOT in this domain — they live under
 * `MemoryStorage`. The harness layer composes the two.
 */
export abstract class HarnessStorage extends StorageDomain {
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
  abstract loadSession(opts: { sessionId: string }): Promise<SessionRecord | null>;

  /**
   * Lookup by (thread, resource). Returns only **active** records
   * (`closedAt === undefined`). Returns `null` when no active record exists,
   * even if one or more closed records match — close-then-reopen-by-thread
   * is guaranteed to create a fresh session (HARNESS_V1_SPEC.md §5.3).
   *
   * If multiple active records match (a degenerate state), implementations
   * return the most recent by `lastActivityAt`.
   */
  abstract loadSessionByThread(opts: { threadId: string; resourceId: string }): Promise<SessionRecord | null>;

  /**
   * List session summaries for a resource. Closed records are excluded by
   * default; pass `includeClosed: true` to surface them. `parentSessionId`
   * filters to direct children — adapters MUST push this filter to the
   * storage layer (no in-memory fan-out).
   */
  abstract listSessions(opts: ListSessionsInput): Promise<SessionSummary[]>;

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
   * Hard-delete of a single session record. The harness layer's
   * `harness.deleteSession(...)` walks the `parentSessionId` chain and
   * calls this method once per descendant — adapters do NOT implement
   * cascade themselves. No-op when the record does not exist.
   *
   * Implementations should also delete attachments owned by the session
   * (equivalent to `deleteAttachmentsForSession`) to keep the index clean.
   */
  abstract deleteSession(opts: { sessionId: string }): Promise<void>;

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
   * Persist an attachment's bytes and index row.
   *
   * Adapters MAY delegate the bytes to a blob store but the index row
   * (filename, mime type, size, owning session) must be queryable through
   * `loadAttachment`.
   */
  abstract saveAttachment(opts: SaveAttachmentInput): Promise<void>;

  /**
   * Load an attachment by (sessionId, attachmentId). Returns null when the
   * row is missing.
   */
  abstract loadAttachment(opts: { sessionId: string; attachmentId: string }): Promise<LoadedAttachment | null>;

  /**
   * Delete a single attachment. No-op when the row is missing.
   */
  abstract deleteAttachment(opts: { sessionId: string; attachmentId: string }): Promise<void>;

  /**
   * Delete all attachments owned by a session. Called from `deleteSession`
   * implementations so the index does not leak rows when a session is torn
   * down.
   */
  abstract deleteAttachmentsForSession(opts: { sessionId: string }): Promise<void>;

  /**
   * Look up the index row only (without bytes). Useful for attachment
   * metadata listings (e.g. message rendering).
   */
  abstract getAttachmentRecord(opts: { sessionId: string; attachmentId: string }): Promise<AttachmentRecord | null>;

  // -------------------------------------------------------------------------
  // Test-only
  // -------------------------------------------------------------------------

  /**
   * Drop all session records, leases, and attachments held by this domain.
   * Required by the `StorageDomain` contract; intended for tests only.
   */
  abstract dangerouslyClearAll(): Promise<void>;
}
