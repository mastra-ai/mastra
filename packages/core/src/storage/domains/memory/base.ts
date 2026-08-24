import type { MastraMessageContentV2 } from '../../../agent';
import type { MastraDBMessage, StorageThreadType } from '../../../memory/types';
import type {
  StorageResourceType,
  ThreadOrderBy,
  ThreadSortDirection,
  StorageListMessagesInput,
  StorageListMessagesByResourceIdInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageOrderBy,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  ObservationalMemoryRecord,
  ObservationalMemoryHistoryOptions,
  CreateObservationalMemoryInput,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  UpdateBufferedReflectionInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  SwapBufferedReflectionToActiveInput,
  CreateReflectionGenerationInput,
  UpdateObservationalMemoryConfigInput,
  AcquireObservationBufferClaimInput,
  RenewObservationBufferClaimInput,
  ReleaseObservationBufferClaimInput,
  CommitBufferedObservationsInput,
  CommitBufferedObservationsResult,
  ObservationBufferClaimOutcome,
  ObservationBufferClaimStatus,
} from '../../types';
import { StorageDomain } from '../base';

/**
 * Internal lease policy for observation-buffer claims.
 * A two-minute lease renewed every thirty seconds gives a four-to-one margin
 * that tolerates ordinary scheduling delay while bounding crash recovery.
 * These are internal, test-injectable (leaseMs is passed per operation) and
 * intentionally not user-configurable.
 */
export const OBSERVATION_BUFFER_CLAIM_LEASE_MS = 120_000;
export const OBSERVATION_BUFFER_CLAIM_RENEW_INTERVAL_MS = 30_000;

function isPlainObj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Constants for metadata key validation
const SAFE_METADATA_KEY_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const MAX_METADATA_KEY_LENGTH = 128;
const DISALLOWED_METADATA_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export abstract class MemoryStorage extends StorageDomain {
  /**
   * Whether this storage adapter supports Observational Memory.
   * Adapters that implement OM methods should set this to true.
   * Defaults to false for backwards compatibility with custom adapters.
   */
  readonly supportsObservationalMemory?: boolean = false;

  /**
   * Whether this adapter's `updateThread` treats an omitted `title`/`metadata`
   * as "leave that column untouched" (partial update).
   *
   * Adapters compiled before partial updates existed require both fields and
   * may write `NULL` into the title column when it is omitted. They won't set
   * this flag, so `patchThread` backfills the current title for them.
   * Adapters that implement partial updates must set this to true.
   */
  readonly supportsPartialThreadUpdate?: boolean = false;

  constructor() {
    super({
      component: 'STORAGE',
      name: 'MEMORY',
    });
  }

  abstract getThreadById({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId?: string;
  }): Promise<StorageThreadType | null>;

  abstract saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType>;

  /**
   * Update a thread's title and/or metadata.
   *
   * `title` and `metadata` are each optional and independent: omitting one
   * leaves that column untouched rather than blanking it. Callers that only
   * need to change metadata (working memory, for example) must omit `title`
   * instead of reading the thread and passing its title back, because a title
   * generated between that read and this write would be silently overwritten.
   */
  abstract updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageThreadType>;

  /**
   * Partial-update a thread's title and/or metadata, tolerating adapters that
   * predate partial `updateThread` support.
   *
   * Adapters that declare `supportsPartialThreadUpdate` receive the arguments
   * as-is (omitted fields are left untouched). For legacy adapters — whose
   * `updateThread` writes both columns unconditionally and would blank or
   * `NULL` an omitted title — the current values are read and backfilled
   * first. That restores the legacy adapter's previous behavior (including
   * its title-clobbering race) instead of crashing on a NOT NULL constraint.
   *
   * Callers that only change metadata should use this instead of calling
   * `updateThread` directly.
   */
  async patchThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    if (!this.supportsPartialThreadUpdate && (title === undefined || metadata === undefined)) {
      const existing = await this.getThreadById({ threadId: id });
      if (existing) {
        title = title ?? existing.title ?? '';
        metadata = metadata ?? existing.metadata ?? {};
      }
    }
    return this.updateThread({
      id,
      ...(title !== undefined ? { title } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
    });
  }

  abstract deleteThread({ threadId }: { threadId: string }): Promise<void>;

  abstract listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput>;

  /**
   * List messages by resource ID only (across all threads).
   * Used by Observational Memory and LongMemEval for resource-scoped queries.
   *
   * @param args - Resource ID and pagination/filtering options
   * @returns Paginated list of messages for the resource
   */
  async listMessagesByResourceId(_args: StorageListMessagesByResourceIdInput): Promise<StorageListMessagesOutput> {
    throw new Error(
      `Resource-scoped message listing is not implemented by this storage adapter (${this.constructor.name}). ` +
        `Use an adapter that supports Observational Memory (pg, libsql, mongodb, convex) or disable observational memory.`,
    );
  }

  abstract listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }>;

  abstract saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }>;

  abstract updateMessages(args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraDBMessage[]>;

  async deleteMessages(_messageIds: string[]): Promise<void> {
    throw new Error(
      `Message deletion is not supported by this storage adapter (${this.constructor.name}). ` +
        `The deleteMessages method needs to be implemented in the storage adapter.`,
    );
  }

  /**
   * List threads with optional filtering by resourceId and metadata.
   *
   * @param args - Filter, pagination, and ordering options
   * @param args.filter - Optional filters for resourceId and/or metadata
   * @param args.filter.resourceId - Optional resource ID to filter by
   * @param args.filter.metadata - Optional metadata key-value pairs to filter by (AND logic)
   * @returns Paginated list of threads matching the filters
   */
  abstract listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput>;

  /**
   * Clone a thread and its messages to create a new independent thread.
   * The cloned thread will have clone metadata stored in its metadata field.
   *
   * @param args - Clone configuration options
   * @returns The newly created thread and the cloned messages
   */
  async cloneThread(_args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    throw new Error(
      `Thread cloning is not implemented by this storage adapter (${this.constructor.name}). ` +
        `The cloneThread method needs to be implemented in the storage adapter.`,
    );
  }

  async getResourceById(_: { resourceId: string }): Promise<StorageResourceType | null> {
    throw new Error(
      `Resource working memory is not implemented by this storage adapter (${this.constructor.name}). ` +
        `This is likely a bug - all Mastra storage adapters should implement resource support. ` +
        `Please report this issue at https://github.com/mastra-ai/mastra/issues`,
    );
  }

  async saveResource(_: { resource: StorageResourceType }): Promise<StorageResourceType> {
    throw new Error(
      `Resource working memory is not implemented by this storage adapter (${this.constructor.name}). ` +
        `This is likely a bug - all Mastra storage adapters should implement resource support. ` +
        `Please report this issue at https://github.com/mastra-ai/mastra/issues`,
    );
  }

  async updateResource(_: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    throw new Error(
      `Resource working memory is not implemented by this storage adapter (${this.constructor.name}). ` +
        `This is likely a bug - all Mastra storage adapters should implement resource support. ` +
        `Please report this issue at https://github.com/mastra-ai/mastra/issues`,
    );
  }

  protected parseOrderBy(
    orderBy?: StorageOrderBy,
    defaultDirection: ThreadSortDirection = 'DESC',
  ): { field: ThreadOrderBy; direction: ThreadSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in THREAD_ORDER_BY_SET ? orderBy.field : 'createdAt',
      direction:
        orderBy?.direction && orderBy.direction in THREAD_THREAD_SORT_DIRECTION_SET
          ? orderBy.direction
          : defaultDirection,
    };
  }

  // ============================================
  // Observational Memory Methods
  // ============================================

  /**
   * Get the current observational memory record for a thread/resource.
   * Returns the most recent active record.
   */
  async getObservationalMemory(
    _threadId: string | null,
    _resourceId: string,
  ): Promise<ObservationalMemoryRecord | null> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Get observational memory history (previous generations).
   * Returns records in reverse chronological order (newest first).
   */
  async getObservationalMemoryHistory(
    _threadId: string | null,
    _resourceId: string,
    _limit?: number,
    _options?: ObservationalMemoryHistoryOptions,
  ): Promise<ObservationalMemoryRecord[]> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Create a new observational memory record.
   * Called when starting observations for a new thread/resource.
   */
  async initializeObservationalMemory(_input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Update active observations.
   * Called when observations are created and immediately activated (no buffering).
   */
  async updateActiveObservations(_input: UpdateActiveObservationsInput): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  // ============================================
  // Buffering Methods (for async observation/reflection)
  // These methods support async buffering when `bufferTokens` is configured.
  // ============================================

  /**
   * Update buffered observations.
   * Called when observations are created asynchronously via `bufferTokens`.
   */
  async updateBufferedObservations(_input: UpdateBufferedObservationsInput): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Swap buffered observations to active.
   * Atomic operation that:
   * 1. Appends bufferedObservations → activeObservations (based on activationRatio)
   * 2. Moves activated bufferedMessageIds → observedMessageIds
   * 3. Keeps remaining buffered content if activationRatio < 100
   * 4. Updates lastObservedAt
   *
   * Returns info about what was activated for UI feedback.
   */
  async swapBufferedToActive(_input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Create a new generation from a reflection.
   * Creates a new record with:
   * - originType: 'reflection'
   * - activeObservations containing the reflection
   * - generationCount incremented from the current record
   */
  async createReflectionGeneration(_input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Update buffered reflection (async reflection in progress).
   * Called when reflection runs asynchronously via `bufferTokens`.
   */
  async updateBufferedReflection(_input: UpdateBufferedReflectionInput): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Swap buffered reflection to active observations.
   * Creates a new generation where activeObservations = bufferedReflection + unreflected observations.
   * The `tokenCount` in input is the processor-computed token count for the combined content.
   */
  async swapBufferedReflectionToActive(
    _input: SwapBufferedReflectionToActiveInput,
  ): Promise<ObservationalMemoryRecord> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Set the isReflecting flag.
   */
  async setReflectingFlag(_id: string, _isReflecting: boolean): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Set the isObserving flag.
   */
  async setObservingFlag(_id: string, _isObserving: boolean): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * @deprecated Compatibility helper only (migrations/tests). This is NOT
   * ownership authority: it writes the boolean unconditionally, so observation
   * buffering must use the claim operations below instead.
   *
   * Set the isBufferingObservation flag and update lastBufferedAtTokens.
   * @param id - Record ID
   * @param isBuffering - Whether buffering is in progress
   * @param lastBufferedAtTokens - The pending token count at which this buffer was triggered (only set when isBuffering=true)
   */
  async setBufferingObservationFlag(_id: string, _isBuffering: boolean, _lastBufferedAtTokens?: number): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /*
   * Observation-buffer claim contract.
   *
   * The persisted claim is the ONLY ownership authority for observation
   * buffering. Process-local registries may deduplicate promises within one
   * process but must never clear, steal, or validate a persisted foreign
   * claim. The storage-owned state machine is:
   *
   * - unclaimed: owner token is null → acquirable.
   * - legacy marker: owner token is null while `isBufferingObservation=true`
   *   (a row written by a pre-claim binary). Reserved only until
   *   `updatedAt + leaseMs` (legacy grace = one lease), then atomically
   *   takeable. Legacy `false` rows are immediately unclaimed.
   * - live claim: matching token with `expiresAt > authoritativeNow` may
   *   renew, commit, or release.
   * - expired claim: `expiresAt <= authoritativeNow` cannot renew, commit, or
   *   release — even before another owner takes over.
   * - replaced/released claim: an old token always loses.
   *
   * Time contract: every predicate evaluates `authoritativeNow` inside the
   * same atomic backend operation using the backend's clock
   * (CURRENT_TIMESTAMP or equivalent; Convex mutation time; an injected clock
   * for in-memory). `expiresAt == authoritativeNow` is expired. Adapters must
   * not mix client-created expiry with server-side comparison.
   *
   * Protected side effects after acquisition — candidate-message sealing,
   * buffering start-marker persistence, buffered-chunk append, token-boundary
   * update, and release — must each be owner-conditioned or harmless/
   * idempotent. If ownership expires between side effects, the persisted
   * post-state must never strand sealed messages or leave a marker that
   * blocks a successor: a takeover re-seals under the new token, and stale
   * chunks are fenced out of the successor's commit/activation.
   *
   * Activation/swap may consume committed chunks but must never clear a
   * foreign live claim: it owner-conditionally releases the claim it holds,
   * or leaves a different live claim intact. Reset paths clear only absent,
   * expired, or owned claims through this contract.
   *
   * Result semantics: operations return only the caller's own claim or
   * `{ ok: false, reason: 'lost' }` — a foreign owner's token is never
   * exposed. A missing record throws the adapter's established not-found
   * error.
   */

  /**
   * Atomically acquire the observation-buffer claim.
   * The predicate accepts only unclaimed, expired, or legacy-grace-expired
   * state, evaluated against the backend's authoritative clock inside one
   * atomic operation. On success it persists the owner token, acquisition/
   * renewal timestamps, `expiresAt = now + leaseMs`, sets
   * `isBufferingObservation = true` for legacy readers, and records
   * `lastBufferedAtTokens` when provided.
   */
  async acquireObservationBufferClaim(
    _input: AcquireObservationBufferClaimInput,
  ): Promise<ObservationBufferClaimOutcome> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Renew the lease of an owned, unexpired claim.
   * Only a matching token with an unexpired lease may renew; an expired owner
   * returns `lost` even before takeover. Renewal writes a strictly advancing
   * expiry (`now + leaseMs`).
   */
  async renewObservationBufferClaim(_input: RenewObservationBufferClaimInput): Promise<ObservationBufferClaimOutcome> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Release an owned, unexpired claim.
   * Clears the owner token, claim timestamps, and `isBufferingObservation`.
   * A foreign or expired owner returns `lost` and mutates nothing.
   */
  async releaseObservationBufferClaim(
    _input: ReleaseObservationBufferClaimInput,
  ): Promise<ObservationBufferClaimOutcome> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Owner-conditioned buffered-observation commit.
   * Applies the chunk append and `lastBufferedAtTime` boundary update only
   * while `ownerToken` matches the persisted claim and the lease is unexpired
   * per the backend clock, in one atomic operation. A stale or foreign owner
   * gets `{ committed: false, reason: 'lost' }` and mutates nothing.
   */
  async commitBufferedObservations(_input: CommitBufferedObservationsInput): Promise<CommitBufferedObservationsResult> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Backend-evaluated claim liveness for status readers.
   * `live` is true only when an owner token is present and the lease is
   * unexpired per the same backend clock the claim operations use. Never
   * exposes the owner token.
   */
  async getObservationBufferClaimStatus(_id: string): Promise<ObservationBufferClaimStatus> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Set the isBufferingReflection flag.
   * Called when async reflection buffering starts (true) or ends/fails (false).
   */
  async setBufferingReflectionFlag(_id: string, _isBuffering: boolean): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Insert a fully-formed observational memory record.
   * Used by thread cloning to copy OM state with remapped IDs.
   */
  async insertObservationalMemoryRecord(_record: ObservationalMemoryRecord): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Clear all observational memory for a thread/resource.
   * Removes all records and history.
   */
  async clearObservationalMemory(_threadId: string | null, _resourceId: string): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Set the pending message token count.
   * Called at the end of each OM processing step to persist the current
   * context window token count so the UI can display it on page load.
   */
  async setPendingMessageTokens(_id: string, _tokenCount: number): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Update the config of an existing observational memory record.
   * The provided config is deep-merged into the record's existing config.
   */
  async updateObservationalMemoryConfig(_input: UpdateObservationalMemoryConfigInput): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Deep-merge two plain objects. Available for subclasses to merge
   * partial config overrides into existing record configs.
   */
  protected deepMergeConfig(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const output: Record<string, unknown> = { ...target };
    for (const key of Object.keys(source)) {
      const tVal = target[key];
      const sVal = source[key];
      if (isPlainObj(tVal) && isPlainObj(sVal)) {
        output[key] = this.deepMergeConfig(tVal, sVal);
      } else if (sVal !== undefined) {
        output[key] = sVal;
      }
    }
    return output;
  }

  /**
   * Validates metadata keys to prevent SQL injection attacks and prototype pollution.
   * Keys must start with a letter or underscore, followed by alphanumeric characters or underscores.
   * @param metadata - The metadata object to validate
   * @throws Error if any key contains invalid characters or is a disallowed key
   */
  protected validateMetadataKeys(metadata: Record<string, unknown> | undefined): void {
    if (!metadata) return;

    for (const key of Object.keys(metadata)) {
      // First check for disallowed prototype pollution keys
      if (DISALLOWED_METADATA_KEYS.has(key)) {
        throw new Error(`Invalid metadata key: "${key}".`);
      }

      // Then check pattern
      if (!SAFE_METADATA_KEY_PATTERN.test(key)) {
        throw new Error(
          `Invalid metadata key: "${key}". Keys must start with a letter or underscore and contain only alphanumeric characters and underscores.`,
        );
      }

      // Also limit key length to prevent potential issues
      if (key.length > MAX_METADATA_KEY_LENGTH) {
        throw new Error(`Metadata key "${key}" exceeds maximum length of ${MAX_METADATA_KEY_LENGTH} characters.`);
      }
    }
  }

  /**
   * Validates pagination parameters and returns safe offset.
   * @param page - Page number (0-indexed)
   * @param perPage - Items per page (0 is allowed and returns empty results)
   * @throws Error if page is negative, perPage is negative/invalid, or offset would overflow
   */
  protected validatePagination(page: number, perPage: number): void {
    if (!Number.isFinite(page) || !Number.isSafeInteger(page) || page < 0) {
      throw new Error('page must be >= 0');
    }

    // perPage: 0 is allowed (returns empty results), negative values are rejected
    if (!Number.isFinite(perPage) || !Number.isSafeInteger(perPage) || perPage < 0) {
      throw new Error('perPage must be >= 0');
    }

    // Skip overflow check when perPage is 0 (no offset needed)
    if (perPage === 0) {
      return;
    }

    // Prevent overflow when calculating offset
    const offset = page * perPage;
    if (!Number.isSafeInteger(offset) || offset > Number.MAX_SAFE_INTEGER) {
      throw new Error('page value too large');
    }
  }

  /**
   * Validates pagination input before normalization.
   * Use this when accepting raw perPageInput (number | false) from callers.
   *
   * When perPage is false (fetch all), page must be 0 since pagination is disabled.
   * When perPage is a number, delegates to validatePagination for full validation.
   *
   * @param page - Page number (0-indexed)
   * @param perPageInput - Items per page as number, or false to fetch all results
   * @throws Error if perPageInput is false and page !== 0
   * @throws Error if perPageInput is invalid (not false or a non-negative safe integer)
   * @throws Error if page is invalid or offset would overflow
   */
  protected validatePaginationInput(page: number, perPageInput: number | false): void {
    // Validate perPageInput type first
    if (perPageInput !== false) {
      if (typeof perPageInput !== 'number' || !Number.isFinite(perPageInput) || !Number.isSafeInteger(perPageInput)) {
        throw new Error('perPage must be false or a safe integer');
      }
      if (perPageInput < 0) {
        throw new Error('perPage must be >= 0');
      }
    }

    // When fetching all (perPage: false), only page 0 is valid
    if (perPageInput === false) {
      if (page !== 0) {
        throw new Error('page must be 0 when perPage is false');
      }
      // Still validate page is a valid integer
      if (!Number.isFinite(page) || !Number.isSafeInteger(page)) {
        throw new Error('page must be >= 0');
      }
      return;
    }

    // For numeric perPage, delegate to existing validation
    this.validatePagination(page, perPageInput);
  }
}

const THREAD_ORDER_BY_SET: Record<ThreadOrderBy, true> = {
  createdAt: true,
  updatedAt: true,
};

const THREAD_THREAD_SORT_DIRECTION_SET: Record<ThreadSortDirection, true> = {
  ASC: true,
  DESC: true,
};
