import { createHash, randomUUID } from 'node:crypto';

import type { InMemoryDB } from '../inmemory-db';
import {
  CHANNEL_BINDING_EXTERNAL_ID_SENTINEL,
  HarnessStorage,
  HarnessStorageAdmissionConflictError,
  HarnessStorageAttachmentInUseError,
  HarnessStorageAttachmentUnavailableError,
  HarnessStorageChannelActionClaimConflictError,
  HarnessStorageChannelActionReceiptTransitionError,
  HarnessStorageChannelActionTokenConflictError,
  HarnessStorageChannelBindingConflictError,
  HarnessStorageChannelInboxClaimConflictError,
  HarnessStorageChannelInboxTransitionError,
  HarnessStorageChannelOutboxClaimConflictError,
  HarnessStorageChannelOutboxTransitionError,
  HarnessStorageDeleteGuardConflictError,
  HarnessStorageLeaseConflictError,
  HarnessStorageParentSessionUnavailableError,
  HarnessStoragePlanTaskNotFoundError,
  HarnessStoragePlanTaskVersionConflictError,
  HarnessStorageProviderCallbackBindingTransitionError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageSessionRecordProjectionUnsupportedError,
  HarnessStorageSessionProjectionBackpressureError,
  HarnessStorageSessionProjectionClaimConflictError,
  HarnessStorageSessionProjectionIncarnationError,
  HarnessStorageSessionProjectionIdentityError,
  HarnessStorageThreadDeleteFenceConflictError,
  HarnessStorageVersionConflictError,
  HarnessStorageWakeupClaimConflictError,
  HarnessStorageWakeupTransitionError,
  normalizePendingInteractionDueScanInput,
} from './base';
import type {
  CompareAndSwapSignalDispatchInput,
  CompareAndSwapSignalDispatchResult,
  CompareAndSwapSignalTerminalInput,
  CompareAndSwapSignalTerminalResult,
  WriteMessageResultEvidenceResult,
} from './base';
import {
  applyPlanTaskPatch,
  assertPlanTaskCreateIdempotencyInput,
  comparePlanTaskOrder,
  decodePlanTaskCursor,
  encodePlanTaskCursor,
  planTaskAfterCursor,
  walkPlanTaskSubtree,
} from './plan-task-helpers';
import {
  buildHarnessSessionRecordProjectionIntent,
  projectHarnessSessionRecordProjectionFence,
} from './session-record-projection';
import type {
  AcquireSessionLeaseInput,
  AgentSignalResultEvidence,
  AgentSignalDispatchState,
  AppendWorkspaceActionJournalEntryResult,
  AttachmentReference,
  AttachmentRecord,
  AttachmentSemanticMetadata,
  ChannelActionReceipt,
  ChannelActionToken,
  ChannelBinding,
  ResolveChannelBindingResult,
  ListActiveChannelBindingsResult,
  ChannelDiagnosticsRows,
  ChannelInboxItem,
  ChannelOutboxItem,
  ChannelProviderDeliveryReceipt,
  HarnessProviderCallbackBinding,
  CreateOrLoadActiveSessionOptions,
  CreateOrLoadChannelActionReceiptResult,
  CreateOrLoadChannelActionTokenResult,
  CreateOrLoadChannelInboxItemResult,
  CreateOrLoadHarnessWakeupItemResult,
  CreateOrLoadActiveSessionResult,
  CountPlanTasksByStatusInput,
  CreatePlanTaskInput,
  HarnessRunSummary,
  SaveRunSummaryInput,
  LoadRunSummaryInput,
  ListRunSummariesInput,
  ListRunSummariesResult,
  DeletePlanTaskSubtreeInput,
  DeletePlanTaskSubtreeResult,
  HarnessPlanTask,
  HarnessPlanTaskStatus,
  ListPlanTasksInput,
  ListPlanTasksResult,
  LoadPlanTaskSubtreeInput,
  LoadPlanTaskSubtreeResult,
  PlanTaskCountSummary,
  MutatePlanTasksForSessionInput,
  PlanTaskMutationOp,
  PlanTaskSessionFence,
  UpdatePlanTaskInput,
  UpdatePlanTaskResult,
  DeleteSessionOptions,
  HarnessSessionEventRecord,
  HarnessSessionEventReplayState,
  HarnessSessionRecordProjectionIntent,
  HarnessSessionRecordProjectionOption,
  HarnessWakeupClaimStatus,
  HarnessWakeupItem,
  ListActiveSessionsByThreadInput,
  ListChannelDiagnosticsInput,
  ListDuePendingInteractionsInput,
  ListDuePendingInteractionsResult,
  ListSessionsByThreadInput,
  ListSessionsInput,
  ListWorkspaceActionJournalInput,
  LoadedAttachment,
  JsonValue,
  OperationAdmissionEvidence,
  OperationAdmissionTombstone,
  PendingResume,
  ProviderCallbackSelectorKind,
  QueueAdmissionReceipt,
  ReleaseSessionLeaseInput,
  RenewSessionLeaseInput,
  RenewSessionLeaseSubtreeInput,
  ResolveProviderCallbackBindingResult,
  SaveAttachmentReferenceInput,
  SaveAttachmentInput,
  SaveAttachmentResult,
  SaveSessionOptions,
  SaveSessionResult,
  SessionLeaseResult,
  SubtreeSessionLeaseResult,
  SessionRecord,
  AckSessionRecordProjectionInput,
  AckSessionRecordProjectionResult,
  ClaimSessionRecordProjectionIntentsInput,
  FailSessionRecordProjectionInput,
  RenewSessionRecordProjectionClaimInput,
  SessionRecordProjectionQueuePressure,
  SessionRecordProjectionQueuePressureInput,
  SessionSummary,
  PendingInteractionExpiryGeneration,
  ThreadDeleteFenceLease,
  WithThreadDeleteFenceInput,
  WorkspaceActionJournalEntry,
} from './types';

/**
 * In-memory `HarnessStorage` adapter — backs onto the shared `InMemoryDB`
 * Maps so it composes naturally with the other in-memory domains
 * (`InMemoryMemory`, etc.).
 *
 * Records are stored by reference; reads return the live row, callers should
 * treat returned `SessionRecord`s as read-only and pass a fresh object to
 * `saveSession` for updates. This matches the pattern used by `InMemoryMemory`.
 */
export class InMemoryHarness extends HarnessStorage {
  private db: InMemoryDB;
  private readonly harnessName: string;
  private readonly compactionLocks = new Map<string, Promise<void>>();

  constructor({
    db,
    harnessName = 'default',
    sessionRecordProjection,
  }: {
    db: InMemoryDB;
    harnessName?: string;
    sessionRecordProjection?: HarnessSessionRecordProjectionOption;
  }) {
    super({ sessionRecordProjection });
    this.db = db;
    this.harnessName = harnessName;
  }

  override get supportsSessionRecordProjection(): boolean {
    return this.sessionRecordProjection.enabled;
  }

  // -------------------------------------------------------------------------
  // Session records
  // -------------------------------------------------------------------------

  async loadSession({
    sessionId,
    harnessName,
  }: {
    sessionId: string;
    harnessName?: string;
  }): Promise<SessionRecord | null> {
    const record = this.db.harnessSessions.get(
      sessionKey(resolveHarnessName(harnessName, this.harnessName), sessionId),
    );
    return record ? cloneSessionRecord(record) : null;
  }

  async loadSessionByThread({
    threadId,
    resourceId,
    harnessName,
  }: {
    threadId: string;
    resourceId: string;
    harnessName?: string;
  }): Promise<SessionRecord | null> {
    let candidate: SessionRecord | null = null;
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    for (const record of this.db.harnessSessions.values()) {
      if (record.harnessName !== namespace) continue;
      if (record.threadId !== threadId || record.resourceId !== resourceId) continue;
      // §5.2a/§5.5: return the current owner including Closed (reopen candidate)
      // and Closing records; deleted records are already removed from the map.
      if (candidate === null || record.lastActivityAt > candidate.lastActivityAt) {
        candidate = record;
      }
    }
    return candidate ? cloneSessionRecord(candidate) : null;
  }

  async listSessions({
    resourceId,
    includeClosed = false,
    parentSessionId,
    harnessName,
  }: ListSessionsInput): Promise<SessionSummary[]> {
    const matched: SessionRecord[] = [];
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    for (const record of this.db.harnessSessions.values()) {
      if (record.harnessName !== namespace) continue;
      if (record.resourceId !== resourceId) continue;
      if (!includeClosed && record.closedAt !== undefined) continue;
      if (parentSessionId !== undefined && record.parentSessionId !== parentSessionId) continue;
      matched.push(record);
    }
    matched.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    return matched.map(toSummary);
  }

  async listSessionsByThread({
    resourceId,
    threadId,
    includeClosed = false,
    harnessName,
  }: ListSessionsByThreadInput): Promise<SessionSummary[]> {
    const matched: SessionRecord[] = [];
    const namespace = harnessName === undefined ? undefined : resolveHarnessName(harnessName, this.harnessName);
    for (const record of this.db.harnessSessions.values()) {
      if (namespace !== undefined && record.harnessName !== namespace) continue;
      if (resourceId !== undefined && record.resourceId !== resourceId) continue;
      if (record.threadId !== threadId) continue;
      if (!includeClosed && record.closedAt !== undefined) continue;
      matched.push(record);
    }
    matched.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    return matched.map(toSummary);
  }

  async listActiveSessionsByThread({
    threadId,
    harnessName,
  }: ListActiveSessionsByThreadInput): Promise<SessionSummary[]> {
    const matched: SessionRecord[] = [];
    const namespace = harnessName === undefined ? undefined : resolveHarnessName(harnessName, this.harnessName);
    for (const record of this.db.harnessSessions.values()) {
      if (namespace !== undefined && record.harnessName !== namespace) continue;
      if (record.threadId !== threadId || record.closedAt !== undefined) continue;
      matched.push(record);
    }
    matched.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    return matched.map(toSummary);
  }

  async listDuePendingInteractions(input: ListDuePendingInteractionsInput): Promise<ListDuePendingInteractionsResult> {
    const { now, limit, cursor } = normalizePendingInteractionDueScanInput(input);
    const namespace = resolveHarnessName(input.harnessName, this.harnessName);
    const due: PendingInteractionExpiryGeneration[] = [];

    for (const record of this.db.harnessSessions.values()) {
      if (record.harnessName !== namespace || record.closedAt !== undefined) continue;
      const pending = record.pendingResume;
      if (!isDueScannablePendingResume(pending)) {
        continue;
      }
      const dueAt = pendingResumeDueAt(pending);
      if (dueAt > now) continue;
      if (cursor !== undefined && (dueAt < cursor.dueAt || (dueAt === cursor.dueAt && record.id <= cursor.sessionId))) {
        continue;
      }
      due.push({
        harnessName: record.harnessName,
        sessionId: record.id,
        resourceId: record.resourceId,
        kind: pending.kind,
        itemId: pending.itemId,
        runId: pending.runId,
        toolCallId: pending.toolCallId,
        requestedAt: pending.requestedAt,
        dueAt,
        expiresAt: pending.expiresAt,
        ...(pending.expiryStartedAt !== undefined ? { expiryStartedAt: pending.expiryStartedAt } : {}),
        ...(pending.resumedAt !== undefined ? { resumedAt: pending.resumedAt } : {}),
        ...(pending.resumeRecoveryAt !== undefined ? { resumeRecoveryAt: pending.resumeRecoveryAt } : {}),
        ...(pending.resumeRecoveryStartedAt !== undefined
          ? { resumeRecoveryStartedAt: pending.resumeRecoveryStartedAt }
          : {}),
      });
    }

    due.sort((a, b) => a.dueAt - b.dueAt || compareStrings(a.sessionId, b.sessionId));
    const page = due.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map(cloneJson),
      ...(due.length > limit && last ? { nextCursor: { dueAt: last.dueAt, sessionId: last.sessionId } } : {}),
    };
  }

  async withThreadDeleteFence<T>(
    { threadId, ownerId, ttlMs }: WithThreadDeleteFenceInput,
    fn: (fence: ThreadDeleteFenceLease) => Promise<T>,
  ): Promise<T> {
    const now = Date.now();
    const leaseId = randomUUID();
    const existing = this.db.harnessThreadDeleteFences.get(threadId);
    if (existing && existing.expiresAt > now) {
      throw new HarnessStorageThreadDeleteFenceConflictError(threadId, existing.ownerId);
    }
    this.db.harnessThreadDeleteFences.set(threadId, {
      threadId,
      ownerId,
      leaseId,
      createdAt: now,
      expiresAt: now + ttlMs,
    });
    const renewalIntervalMs = Math.max(1, Math.floor(ttlMs / 3));
    const renewal = setInterval(() => {
      const current = this.db.harnessThreadDeleteFences.get(threadId);
      if (current?.ownerId === ownerId && current.leaseId === leaseId && current.expiresAt > Date.now()) {
        current.expiresAt = Date.now() + ttlMs;
      }
    }, renewalIntervalMs);
    (renewal as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.();
    const fence: ThreadDeleteFenceLease = {
      threadId,
      ownerId,
      assertActive: async () => {
        const current = this.db.harnessThreadDeleteFences.get(threadId);
        if (current?.ownerId !== ownerId || current.leaseId !== leaseId || current.expiresAt <= Date.now()) {
          throw new HarnessStorageThreadDeleteFenceConflictError(threadId, current?.ownerId);
        }
        current.expiresAt = Date.now() + ttlMs;
      },
    };
    try {
      return await fn(fence);
    } finally {
      clearInterval(renewal);
      const current = this.db.harnessThreadDeleteFences.get(threadId);
      if (current?.ownerId === ownerId && current.leaseId === leaseId) {
        this.db.harnessThreadDeleteFences.delete(threadId);
      }
    }
  }

  async saveSession(record: SessionRecord, opts: SaveSessionOptions): Promise<SaveSessionResult> {
    const harnessName = opts.harnessName ?? record.harnessName ?? this.harnessName;
    const existing = this.db.harnessSessions.get(sessionKey(harnessName, record.id));

    if (existing) {
      // Lease check first — the lease is the authoritative ownership token.
      assertLeaseHolder(existing, opts.ownerId);

      if (existing.version !== opts.ifVersion) {
        throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, existing.version);
      }
    } else {
      // First insert: ifVersion must be 0.
      if (opts.ifVersion !== 0) {
        throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, 0);
      }
      const fence = this.db.harnessThreadDeleteFences.get(record.threadId);
      if (fence && fence.expiresAt > Date.now()) {
        throw new HarnessStorageThreadDeleteFenceConflictError(record.threadId);
      }
      if (record.closedAt === undefined) {
        for (const active of this.db.harnessSessions.values()) {
          if (active.harnessName !== harnessName) continue;
          if (active.resourceId !== record.resourceId || active.threadId !== record.threadId) continue;
          if (active.closedAt !== undefined) continue;
          throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, active.version);
        }
      }
    }

    const nextVersion = opts.ifVersion + 1;
    const sessionIncarnation = this.projectionSessionIncarnation(record, existing);
    const stored: SessionRecord = {
      ...record,
      harnessName,
      ...(sessionIncarnation !== undefined ? { sessionIncarnation } : {}),
      version: nextVersion,
      // Preserve current lease metadata — `saveSession` does not mutate it.
      ownerId: existing?.ownerId,
      leaseExpiresAt: existing?.leaseExpiresAt,
    };

    const projection = this.prepareProjectionWrite(stored, sessionIncarnation, nextVersion);
    if (projection !== undefined) this.assertProjectionCapacity(projection.intent);

    this.db.harnessSessions.set(sessionKey(harnessName, record.id), cloneSessionRecord(stored));
    if (projection !== undefined) this.commitProjectionWrite(projection);
    return { version: nextVersion };
  }

  async saveSessionWithAttachmentReferences(
    record: SessionRecord,
    opts: SaveSessionOptions,
    references: SaveAttachmentReferenceInput[],
  ): Promise<SaveSessionResult> {
    const harnessName = opts.harnessName ?? record.harnessName ?? this.harnessName;
    const existing = this.db.harnessSessions.get(sessionKey(harnessName, record.id));

    if (existing) {
      assertLeaseHolder(existing, opts.ownerId);

      if (existing.version !== opts.ifVersion) {
        throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, existing.version);
      }
    } else {
      throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, 0);
    }

    for (const ref of references) {
      if (ref.harnessName !== undefined && resolveHarnessName(ref.harnessName, harnessName) !== harnessName) {
        throw new HarnessStorageAttachmentUnavailableError(ref.sessionId, ref.attachmentId);
      }
      if (!this.db.harnessAttachmentRecords.has(attachmentKey(harnessName, ref.sessionId, ref.attachmentId))) {
        throw new HarnessStorageAttachmentUnavailableError(ref.sessionId, ref.attachmentId);
      }
    }

    const nextVersion = opts.ifVersion + 1;
    const sessionIncarnation = this.projectionSessionIncarnation(record, existing);
    const stored: SessionRecord = {
      ...record,
      harnessName,
      ...(sessionIncarnation !== undefined ? { sessionIncarnation } : {}),
      version: nextVersion,
      ownerId: existing.ownerId,
      leaseExpiresAt: existing.leaseExpiresAt,
    };
    const projection = this.prepareProjectionWrite(stored, sessionIncarnation, nextVersion);
    if (projection !== undefined) this.assertProjectionCapacity(projection.intent);
    this.db.harnessSessions.set(sessionKey(harnessName, record.id), cloneSessionRecord(stored));
    for (const ref of references) {
      this.db.harnessAttachmentReferences.set(attachmentReferenceKey({ ...ref, harnessName }), {
        source: ref.source,
        sourceId: ref.sourceId,
        ...(ref.retainedUntil !== undefined ? { retainedUntil: ref.retainedUntil } : {}),
      });
    }
    if (projection !== undefined) this.commitProjectionWrite(projection);
    return { version: nextVersion };
  }

  async createOrLoadActiveSession(
    record: SessionRecord,
    opts: CreateOrLoadActiveSessionOptions,
  ): Promise<CreateOrLoadActiveSessionResult> {
    const namespace = resolveHarnessName(record.harnessName, this.harnessName);
    const storageNow = Date.now();
    const fence = this.db.harnessThreadDeleteFences.get(record.threadId);
    if (fence && fence.expiresAt > storageNow) {
      throw new HarnessStorageThreadDeleteFenceConflictError(record.threadId);
    }

    for (const existing of this.db.harnessSessions.values()) {
      if (existing.harnessName !== namespace) continue;
      if (existing.resourceId !== record.resourceId || existing.threadId !== record.threadId) continue;
      // §5.3/§5.5: a Closed (reopenable) or Closing current owner still occupies
      // the (harnessName, resourceId, threadId) key. Return it as the current
      // owner so the caller reopens it (closed) or fails new work (closing)
      // rather than creating a second active owner behind it.
      if (this.sessionRecordProjection.enabled) {
        this.assertProjectionIncarnation(existing);
        this.assertProjectionFence(existing, 'active', existing.version);
      }
      return {
        record: cloneSessionRecord(existing),
        created: false,
        leaseAcquired: false,
        version: existing.version,
        expiresAt: existing.leaseExpiresAt,
        storageNow,
      };
    }

    if (record.parentSessionId !== undefined) {
      const parent = this.db.harnessSessions.get(sessionKey(namespace, record.parentSessionId));
      if (!parent || parent.resourceId !== record.resourceId) {
        throw new HarnessStorageParentSessionUnavailableError(record.parentSessionId, 'not_found');
      }
      if (parent.closedAt !== undefined) {
        throw new HarnessStorageParentSessionUnavailableError(record.parentSessionId, 'closed');
      }
      if (parent.closingAt !== undefined) {
        throw new HarnessStorageParentSessionUnavailableError(
          record.parentSessionId,
          'closing',
          parent.closingAt,
          parent.closeDeadlineAt,
        );
      }
    }

    const key = sessionKey(namespace, record.id);
    const existingById = this.db.harnessSessions.get(key);
    if (existingById) {
      throw new HarnessStorageVersionConflictError(record.id, 0, existingById.version);
    }

    const expiresAt = storageNow + opts.initialLease.ttlMs;
    const sessionIncarnation = this.sessionRecordProjection.enabled ? randomUUID() : undefined;
    const stored: SessionRecord = {
      ...record,
      harnessName: namespace,
      ...(sessionIncarnation !== undefined ? { sessionIncarnation } : {}),
      version: 1,
      ownerId: opts.initialLease.ownerId,
      leaseExpiresAt: expiresAt,
    };
    const projection = this.prepareProjectionWrite(stored, sessionIncarnation, 1, storageNow);
    if (projection !== undefined) this.assertProjectionCapacity(projection.intent);
    this.db.harnessSessions.set(key, cloneSessionRecord(stored));
    if (projection !== undefined) this.commitProjectionWrite(projection);
    return {
      record: cloneSessionRecord(stored),
      created: true,
      leaseAcquired: true,
      version: 1,
      expiresAt,
      storageNow,
    };
  }

  async deleteSession(opts: DeleteSessionOptions): Promise<void> {
    await this.deleteSessions({ sessions: [opts] });
  }

  async deleteSessions({ sessions }: { sessions: DeleteSessionOptions[] }): Promise<void> {
    const existingSessions = new Map<string, { namespace: string; sessionId: string; record: SessionRecord }>();
    for (const opts of sessions) {
      const { sessionId } = opts;
      const namespace = resolveHarnessName(opts.harnessName, this.harnessName);
      const existing = this.db.harnessSessions.get(sessionKey(namespace, sessionId));
      if (!existing) continue;
      assertDeleteGuard(existing, opts);
      if (this.sessionRecordProjection.enabled) {
        this.assertProjectionIncarnation(existing);
        this.assertProjectionFence(existing, 'active', existing.version);
      }
      existingSessions.set(sessionKey(namespace, sessionId), { namespace, sessionId, record: existing });
    }

    for (const { namespace, sessionId } of existingSessions.values()) {
      this.db.harnessSessions.delete(sessionKey(namespace, sessionId));
    }

    for (const { namespace, sessionId, record } of existingSessions.values()) {
      if (this.sessionRecordProjection.enabled) {
        this.assertProjectionIncarnation(record);
        this.db.harnessSessionRecordProjectionFences.set(
          projectionFenceKey(namespace, sessionId),
          projectHarnessSessionRecordProjectionFence(record, {
            sessionIncarnation: record.sessionIncarnation!,
            state: 'deleted',
            revision: record.version,
            updatedAt: Date.now(),
          }),
        );
        for (const intent of this.db.harnessSessionRecordProjectionIntents.values()) {
          if (
            intent.harnessName !== namespace ||
            intent.sessionId !== sessionId ||
            intent.sessionIncarnation !== record.sessionIncarnation ||
            intent.status === 'applied' ||
            intent.status === 'dead'
          ) {
            continue;
          }
          intent.status = 'dead';
          intent.deadAt = Date.now();
          intent.failedAt = intent.deadAt;
          intent.claimId = undefined;
          intent.claimExpiresAt = undefined;
          intent.nextAttemptAt = undefined;
          intent.updatedAt = intent.deadAt;
          intent.lastError = {
            code: 'session_projection.deleted',
            message: 'Session lifetime was deleted',
          };
        }
      }
    }

    for (const { namespace, sessionId, record } of existingSessions.values()) {
      await this.cleanupDeletedSession({
        namespace,
        sessionId,
        resourceId: record.resourceId,
        threadId: record.threadId,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Native session record projection
  // -------------------------------------------------------------------------

  async claimSessionRecordProjectionIntents(
    input: ClaimSessionRecordProjectionIntentsInput,
  ): Promise<HarnessSessionRecordProjectionIntent[]> {
    this.assertProjectionEnabled();
    assertProjectionClaimInput(input);
    const namespace = resolveHarnessName(input.harnessName, this.harnessName);
    const candidates = [...this.db.harnessSessionRecordProjectionIntents.values()]
      .filter(intent => {
        if (intent.harnessName !== namespace) return false;
        if (input.resourceId !== undefined && intent.resourceId !== input.resourceId) return false;
        if (input.sessionId !== undefined && intent.sessionId !== input.sessionId) return false;
        if (intent.status === 'applied' || intent.status === 'dead') return false;
        if (intent.attempts >= this.sessionRecordProjection.maxAttempts) return true;
        if (intent.status === 'claimed' && (intent.claimExpiresAt ?? 0) > input.now) return false;
        if (intent.status === 'pending' || intent.status === 'failed') {
          return (intent.nextAttemptAt ?? intent.createdAt) <= input.now;
        }
        return true;
      })
      .sort(
        (left, right) =>
          left.createdAt - right.createdAt ||
          left.revision - right.revision ||
          compareStrings(left.operationId, right.operationId),
      );

    const claimed: HarnessSessionRecordProjectionIntent[] = [];
    for (const candidate of candidates) {
      const current = this.db.harnessSessionRecordProjectionIntents.get(candidate.id);
      if (!current || current.status === 'applied' || current.status === 'dead') continue;
      if (current.status === 'claimed' && (current.claimExpiresAt ?? 0) > input.now) continue;
      if (current.attempts >= this.sessionRecordProjection.maxAttempts) {
        current.status = 'dead';
        current.deadAt = input.now;
        current.failedAt = input.now;
        current.claimId = undefined;
        current.claimExpiresAt = undefined;
        current.nextAttemptAt = undefined;
        current.updatedAt = input.now;
        current.lastError = { code: 'session_projection.max_attempts', message: 'Maximum projection attempts reached' };
        continue;
      }
      const fence = this.db.harnessSessionRecordProjectionFences.get(
        projectionFenceKey(current.harnessName, current.sessionId),
      );
      if (!projectionFenceMatches(fence, current, 'active')) {
        current.status = 'dead';
        current.deadAt = input.now;
        current.updatedAt = input.now;
        current.lastError = { code: 'session_projection.fenced', message: 'Session projection lifetime is fenced' };
        continue;
      }
      if (hasProjectionPredecessor(this.db.harnessSessionRecordProjectionIntents, current)) continue;
      if (
        (current.status === 'pending' || current.status === 'failed') &&
        (current.nextAttemptAt ?? current.createdAt) > input.now
      ) {
        continue;
      }
      current.status = 'claimed';
      current.attempts += 1;
      current.claimId = input.claimId;
      current.claimExpiresAt = input.now + input.claimTtlMs;
      current.updatedAt = input.now;
      claimed.push(cloneJson(current));
      if (claimed.length >= input.limit) break;
    }
    return claimed;
  }

  async renewSessionRecordProjectionClaim(
    input: RenewSessionRecordProjectionClaimInput,
  ): Promise<{ claimExpiresAt: number; storageNow: number }> {
    this.assertProjectionEnabled();
    assertProjectionRenewInput(input);
    const namespace = resolveHarnessName(input.harnessName, this.harnessName);
    const intent = this.findProjectionIntent(input.operationId, namespace);
    this.assertProjectionIntentIdentity(
      intent,
      input.sessionId,
      input.sessionIncarnation,
      input.revision,
      input.payloadDigest,
    );
    const fence = this.db.harnessSessionRecordProjectionFences.get(
      projectionFenceKey(intent.harnessName, intent.sessionId),
    );
    if (!projectionFenceMatches(fence, intent, 'active'))
      throw new HarnessStorageSessionProjectionClaimConflictError(intent.operationId);
    if (intent.status !== 'claimed' || intent.claimId !== input.claimId || (intent.claimExpiresAt ?? 0) <= input.now) {
      throw new HarnessStorageSessionProjectionClaimConflictError(intent.operationId, input.claimId);
    }
    intent.claimExpiresAt = input.now + input.claimTtlMs;
    intent.updatedAt = input.now;
    return { claimExpiresAt: intent.claimExpiresAt, storageNow: input.now };
  }

  async ackSessionRecordProjection(input: AckSessionRecordProjectionInput): Promise<AckSessionRecordProjectionResult> {
    this.assertProjectionEnabled();
    assertProjectionAckInput(input);
    const namespace = resolveHarnessName(input.harnessName, this.harnessName);
    const intent = this.findProjectionIntent(input.operationId, namespace);
    this.assertProjectionIntentIdentity(
      intent,
      input.sessionId,
      input.sessionIncarnation,
      input.revision,
      input.payloadDigest,
    );
    const fence = this.db.harnessSessionRecordProjectionFences.get(
      projectionFenceKey(intent.harnessName, intent.sessionId),
    );
    if (!projectionFenceMatches(fence, intent, 'active')) {
      return projectionAckResult(intent, 'fenced');
    }
    if (intent.status === 'applied') return projectionAckResult(intent, 'duplicate');
    const acknowledgedAt = input.acknowledgedAt ?? Date.now();
    if (
      intent.status !== 'claimed' ||
      intent.claimId !== input.claimId ||
      (intent.claimExpiresAt ?? 0) <= acknowledgedAt
    ) {
      throw new HarnessStorageSessionProjectionClaimConflictError(intent.operationId, input.claimId);
    }
    intent.status = 'applied';
    intent.appliedAt = acknowledgedAt;
    intent.claimId = undefined;
    intent.claimExpiresAt = undefined;
    intent.nextAttemptAt = undefined;
    intent.updatedAt = acknowledgedAt;
    return projectionAckResult(intent, 'applied');
  }

  async failSessionRecordProjection(
    input: FailSessionRecordProjectionInput,
  ): Promise<HarnessSessionRecordProjectionIntent> {
    this.assertProjectionEnabled();
    assertProjectionFailInput(input);
    const namespace = resolveHarnessName(input.harnessName, this.harnessName);
    const intent = this.findProjectionIntent(input.operationId, namespace);
    this.assertProjectionIntentIdentity(
      intent,
      input.sessionId,
      input.sessionIncarnation,
      input.revision,
      input.payloadDigest,
    );
    const fence = this.db.harnessSessionRecordProjectionFences.get(
      projectionFenceKey(intent.harnessName, intent.sessionId),
    );
    if (!projectionFenceMatches(fence, intent, 'active'))
      throw new HarnessStorageSessionProjectionClaimConflictError(intent.operationId);
    const failedAt = input.failedAt ?? Date.now();
    if (intent.status !== 'claimed' || intent.claimId !== input.claimId || (intent.claimExpiresAt ?? 0) <= failedAt) {
      throw new HarnessStorageSessionProjectionClaimConflictError(intent.operationId, input.claimId);
    }
    const terminal =
      input.dead === true ||
      input.error.retryable === false ||
      intent.attempts >= this.sessionRecordProjection.maxAttempts;
    intent.status = terminal ? 'dead' : 'failed';
    intent.failedAt = failedAt;
    intent.deadAt = terminal ? failedAt : undefined;
    intent.nextAttemptAt = terminal ? undefined : (input.retryAt ?? failedAt);
    intent.claimId = undefined;
    intent.claimExpiresAt = undefined;
    intent.lastError = { ...input.error };
    intent.updatedAt = failedAt;
    return cloneJson(intent);
  }

  async getSessionRecordProjectionQueuePressure(
    input: SessionRecordProjectionQueuePressureInput,
  ): Promise<SessionRecordProjectionQueuePressure> {
    this.assertProjectionEnabled();
    const namespace = resolveHarnessName(input.harnessName, this.harnessName);
    const intents = [...this.db.harnessSessionRecordProjectionIntents.values()].filter(
      intent =>
        intent.harnessName === namespace &&
        (input.resourceId === undefined || intent.resourceId === input.resourceId) &&
        (input.sessionId === undefined || intent.sessionId === input.sessionId),
    );
    const pending = intents.filter(
      intent => intent.status === 'pending' || intent.status === 'claimed' || intent.status === 'failed',
    );
    const pendingIntents = pending.length;
    const pendingBytes = pending.reduce((total, intent) => total + intent.payloadBytes, 0);
    return {
      pendingIntents,
      pendingBytes,
      claimedIntents: intents.filter(intent => intent.status === 'claimed').length,
      failedIntents: intents.filter(intent => intent.status === 'failed').length,
      deadIntents: intents.filter(intent => intent.status === 'dead').length,
      appliedIntents: intents.filter(intent => intent.status === 'applied').length,
      oldestPendingAt: pending.length > 0 ? Math.min(...pending.map(intent => intent.createdAt)) : undefined,
      maxPendingIntents: this.sessionRecordProjection.maxPendingIntents,
      maxPendingBytes: this.sessionRecordProjection.maxPendingBytes,
      overLimit:
        pendingIntents >= this.sessionRecordProjection.maxPendingIntents ||
        pendingBytes >= this.sessionRecordProjection.maxPendingBytes,
    };
  }

  private assertProjectionEnabled(): void {
    if (!this.sessionRecordProjection.enabled) {
      throw new HarnessStorageSessionRecordProjectionUnsupportedError();
    }
  }

  private assertProjectionIncarnation(
    record: SessionRecord,
  ): asserts record is SessionRecord & { sessionIncarnation: string } {
    if (record.sessionIncarnation === undefined || record.sessionIncarnation.length === 0) {
      throw new HarnessStorageSessionProjectionIncarnationError(record.id);
    }
  }

  private projectionSessionIncarnation(record: SessionRecord, existing: SessionRecord | undefined): string | undefined {
    if (!this.sessionRecordProjection.enabled) return record.sessionIncarnation;
    if (existing !== undefined) {
      this.assertProjectionIncarnation(existing);
      if (record.sessionIncarnation !== undefined && record.sessionIncarnation !== existing.sessionIncarnation) {
        throw new HarnessStorageSessionProjectionIncarnationError(record.id);
      }
      if (record.resourceId !== existing.resourceId) {
        throw new HarnessStorageSessionProjectionIdentityError(record.id, 'resourceId');
      }
      if (record.threadId !== existing.threadId) {
        throw new HarnessStorageSessionProjectionIdentityError(record.id, 'threadId');
      }
      return existing.sessionIncarnation;
    }
    return randomUUID();
  }

  private prepareProjectionWrite(
    record: SessionRecord,
    sessionIncarnation: string | undefined,
    revision: number,
    createdAt = Date.now(),
  ):
    | {
        intent: HarnessSessionRecordProjectionIntent;
        fence: ReturnType<typeof projectHarnessSessionRecordProjectionFence>;
      }
    | undefined {
    if (!this.sessionRecordProjection.enabled || sessionIncarnation === undefined) return undefined;
    const intent = buildHarnessSessionRecordProjectionIntent(record, {
      sessionIncarnation,
      revision,
      createdAt,
      maxPayloadBytes: this.sessionRecordProjection.maxPayloadBytes,
    });
    return {
      intent,
      fence: projectHarnessSessionRecordProjectionFence(record, {
        sessionIncarnation,
        state: 'active',
        revision,
        updatedAt: createdAt,
      }),
    };
  }

  private assertProjectionCapacity(intent: HarnessSessionRecordProjectionIntent): void {
    let count = 0;
    let bytes = 0;
    for (const existing of this.db.harnessSessionRecordProjectionIntents.values()) {
      if (existing.harnessName !== intent.harnessName) continue;
      if (existing.status !== 'pending' && existing.status !== 'claimed' && existing.status !== 'failed') continue;
      count += 1;
      bytes += existing.payloadBytes;
    }
    if (
      count + 1 > this.sessionRecordProjection.maxPendingIntents ||
      bytes + intent.payloadBytes > this.sessionRecordProjection.maxPendingBytes
    ) {
      throw new HarnessStorageSessionProjectionBackpressureError(count, bytes);
    }
  }

  private commitProjectionWrite(projection: {
    intent: HarnessSessionRecordProjectionIntent;
    fence: ReturnType<typeof projectHarnessSessionRecordProjectionFence>;
  }): void {
    this.db.harnessSessionRecordProjectionFences.set(
      projectionFenceKey(projection.fence.harnessName, projection.fence.sessionId),
      projection.fence,
    );
    this.db.harnessSessionRecordProjectionIntents.set(projection.intent.id, projection.intent);
  }

  private assertProjectionFence(record: SessionRecord, state: 'active' | 'deleted', revision: number): void {
    const fence = this.db.harnessSessionRecordProjectionFences.get(projectionFenceKey(record.harnessName, record.id));
    if (
      !fence ||
      fence.state !== state ||
      fence.sessionIncarnation !== record.sessionIncarnation ||
      fence.revision !== revision
    ) {
      throw new HarnessStorageSessionProjectionIncarnationError(record.id);
    }
  }

  private findProjectionIntent(operationId: string, harnessName: string): HarnessSessionRecordProjectionIntent {
    const intent = this.db.harnessSessionRecordProjectionIntents.get(operationId);
    if (!intent || intent.harnessName !== harnessName) {
      throw new HarnessStorageSessionProjectionClaimConflictError(operationId);
    }
    return intent;
  }

  private assertProjectionIntentIdentity(
    intent: HarnessSessionRecordProjectionIntent,
    sessionId: string,
    sessionIncarnation: string,
    revision: number,
    payloadDigest: string,
  ): void {
    if (
      intent.sessionId !== sessionId ||
      intent.sessionIncarnation !== sessionIncarnation ||
      intent.revision !== revision ||
      intent.payloadDigest !== payloadDigest
    ) {
      throw new HarnessStorageSessionProjectionClaimConflictError(intent.operationId);
    }
  }

  private async cleanupDeletedSession({
    namespace,
    sessionId,
    resourceId,
    threadId,
  }: {
    namespace: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
  }): Promise<void> {
    await this.deleteOperationAdmissionTombstonesForSession({
      harnessName: namespace,
      sessionId,
      resourceId,
      threadId,
    });
    for (const [key, event] of this.db.harnessSessionEvents) {
      if (event.harnessName === namespace && event.sessionId === sessionId) {
        this.db.harnessSessionEvents.delete(key);
      }
    }
    for (const [key, entry] of this.db.harnessWorkspaceActionJournal) {
      if (entry.harnessName === namespace && entry.sessionId === sessionId) {
        this.db.harnessWorkspaceActionJournal.delete(key);
      }
    }
    // §14.1: channel bindings are session-scoped. A deleted session must not leave
    // a binding behind, or it would still win loadChannelBindingByExternal /
    // resolveChannelBinding and block rebinding that conversation to a replacement
    // session. (PG/LibSQL binding storage — PF-824 — must mirror this on delete.)
    for (const [key, binding] of this.db.harnessChannelBindings) {
      if (binding.harnessName === namespace && binding.sessionId === sessionId) {
        this.db.harnessChannelBindings.delete(key);
      }
    }
    // §5.2g: the whole plan-task tree owned by this session is cascade-deleted
    // (every node — listed by session, so descendants are covered regardless of
    // tree shape). PG/LibSQL mirror this on session delete.
    for (const [key, task] of this.db.harnessPlanTasks) {
      if (task.harnessName === namespace && task.sessionId === sessionId) {
        this.db.harnessPlanTasks.delete(key);
      }
    }
    const refPrefix = `${namespace}\u0000${sessionId}\u0000`;
    for (const key of this.db.harnessAttachmentReferences.keys()) {
      if (key.startsWith(refPrefix)) {
        this.db.harnessAttachmentReferences.delete(key);
      }
    }
    await this.deleteAttachmentsForSession({ harnessName: namespace, sessionId });
  }

  // -------------------------------------------------------------------------
  // Session leases
  // -------------------------------------------------------------------------

  async acquireSessionLease({
    sessionId,
    ownerId,
    ttlMs,
    harnessName,
  }: AcquireSessionLeaseInput): Promise<SessionLeaseResult> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const existing = this.db.harnessSessions.get(sessionKey(namespace, sessionId));
    if (!existing) throw new HarnessStorageSessionNotFoundError(sessionId);

    const now = Date.now();
    const leaseHeld =
      existing.ownerId !== undefined && existing.leaseExpiresAt !== undefined && existing.leaseExpiresAt > now;

    if (leaseHeld && existing.ownerId !== ownerId) {
      throw new HarnessStorageLeaseConflictError(sessionId, existing.ownerId!, existing.leaseExpiresAt!);
    }

    const expiresAt = now + ttlMs;
    const updated: SessionRecord = {
      ...existing,
      ownerId,
      leaseExpiresAt: expiresAt,
    };
    this.db.harnessSessions.set(sessionKey(namespace, sessionId), cloneSessionRecord(updated));
    return { version: existing.version, expiresAt };
  }

  async renewSessionLease({
    sessionId,
    ownerId,
    ttlMs,
    harnessName,
  }: RenewSessionLeaseInput): Promise<SessionLeaseResult> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const existing = this.db.harnessSessions.get(sessionKey(namespace, sessionId));
    if (!existing) throw new HarnessStorageSessionNotFoundError(sessionId);

    const now = Date.now();
    const leaseValid =
      existing.ownerId === ownerId && existing.leaseExpiresAt !== undefined && existing.leaseExpiresAt > now;

    if (!leaseValid) {
      throw new HarnessStorageLeaseConflictError(
        sessionId,
        existing.ownerId ?? '<unowned>',
        existing.leaseExpiresAt ?? 0,
      );
    }

    const expiresAt = now + ttlMs;
    const updated: SessionRecord = { ...existing, leaseExpiresAt: expiresAt };
    this.db.harnessSessions.set(sessionKey(namespace, sessionId), cloneSessionRecord(updated));
    return { version: existing.version, expiresAt };
  }

  async renewSessionLeaseSubtree({
    rootSessionId,
    ownerId,
    ttlMs,
    harnessName,
  }: RenewSessionLeaseSubtreeInput): Promise<SubtreeSessionLeaseResult> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const root = this.db.harnessSessions.get(sessionKey(namespace, rootSessionId));
    if (!root) throw new HarnessStorageSessionNotFoundError(rootSessionId);

    const now = Date.now();
    const rootValid = root.ownerId === ownerId && root.leaseExpiresAt !== undefined && root.leaseExpiresAt > now;
    if (!rootValid) {
      throw new HarnessStorageLeaseConflictError(rootSessionId, root.ownerId ?? '<unowned>', root.leaseExpiresAt ?? 0);
    }

    // Collect every ACTIVE (non-closed) descendant by walking parentSessionId
    // within this namespace. Closed descendants hold no live lease and are
    // skipped. The whole pass is validate-first so a single bad descendant
    // renews NOTHING (§5.8 all-or-nothing — no parent-only success).
    const childrenByParent = new Map<string, SessionRecord[]>();
    for (const record of this.db.harnessSessions.values()) {
      if (record.harnessName !== namespace) continue;
      if (record.parentSessionId === undefined) continue;
      const siblings = childrenByParent.get(record.parentSessionId) ?? [];
      siblings.push(record);
      childrenByParent.set(record.parentSessionId, siblings);
    }
    const descendants: SessionRecord[] = [];
    const queue = [rootSessionId];
    const visited = new Set<string>([rootSessionId]);
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      for (const child of childrenByParent.get(parentId) ?? []) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);
        queue.push(child.id);
        if (child.closedAt !== undefined || child.closingAt !== undefined) continue; // closed/closing → no live lease
        // A descendant owned by a different instance means the subtree was
        // split — fence rather than silently renew a foreign lease.
        if (child.ownerId !== ownerId) {
          throw new HarnessStorageLeaseConflictError(child.id, child.ownerId ?? '<unowned>', child.leaseExpiresAt ?? 0);
        }
        descendants.push(child);
      }
    }

    // Linearized commit: root + every active descendant capped at one expiry.
    const expiresAt = now + ttlMs;
    this.db.harnessSessions.set(
      sessionKey(namespace, rootSessionId),
      cloneSessionRecord({ ...root, leaseExpiresAt: expiresAt }),
    );
    for (const descendant of descendants) {
      this.db.harnessSessions.set(
        sessionKey(namespace, descendant.id),
        cloneSessionRecord({ ...descendant, leaseExpiresAt: expiresAt }),
      );
    }
    return { version: root.version, expiresAt, renewedDescendantCount: descendants.length };
  }

  async releaseSessionLease({ sessionId, ownerId, harnessName }: ReleaseSessionLeaseInput): Promise<void> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const existing = this.db.harnessSessions.get(sessionKey(namespace, sessionId));
    if (!existing) throw new HarnessStorageSessionNotFoundError(sessionId);

    // No-op if we're not the current owner — the spec calls this out:
    // "the common cause is 'we noticed our lease expired and another instance
    // picked it up'".
    if (existing.ownerId !== ownerId) return;

    const updated: SessionRecord = { ...existing, ownerId: undefined, leaseExpiresAt: undefined };
    this.db.harnessSessions.set(sessionKey(namespace, sessionId), cloneSessionRecord(updated));
  }

  // -------------------------------------------------------------------------
  // Attachments
  // -------------------------------------------------------------------------

  async saveAttachment({
    sessionId,
    attachmentId,
    harnessName,
    name,
    mimeType,
    source,
    data,
    semantic,
  }: SaveAttachmentInput): Promise<SaveAttachmentResult> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const key = attachmentKey(namespace, sessionId, attachmentId);
    const existing = this.db.harnessAttachmentRecords.get(key);
    if (existing) {
      return { attachmentId: existing.attachmentId, bytes: existing.bytes, sha256: existing.sha256 };
    }
    const bytes = data.byteLength;
    const sha256 = sha256Hex(data);
    const record: AttachmentRecord = {
      ownerSessionId: sessionId,
      attachmentId,
      name,
      mimeType,
      bytes,
      sha256,
      source,
      ...(semantic?.kind ? { kind: semantic.kind } : {}),
      ...(semantic?.primitiveType ? { primitiveType: semantic.primitiveType } : {}),
      ...(semantic?.elementType ? { elementType: semantic.elementType } : {}),
      ...(semantic?.renderer ? { renderer: { ...semantic.renderer } } : {}),
      ...(semantic?.schemaId ? { schemaId: semantic.schemaId } : {}),
      ...(semantic?.metadata ? { metadata: cloneJsonRecord(semantic.metadata) } : {}),
      ...(semantic?.object ? { object: { ...semantic.object } } : {}),
      createdAt: Date.now(),
    };
    this.db.harnessAttachmentRecords.set(key, record);
    // Copy the bytes so callers can reuse their buffer.
    this.db.harnessAttachmentBytes.set(key, new Uint8Array(data));
    return { attachmentId, bytes, sha256 };
  }

  async loadAttachment({
    sessionId,
    attachmentId,
    harnessName,
  }: {
    sessionId: string;
    attachmentId: string;
    harnessName?: string;
  }): Promise<LoadedAttachment | null> {
    const key = attachmentKey(resolveHarnessName(harnessName, this.harnessName), sessionId, attachmentId);
    const record = this.db.harnessAttachmentRecords.get(key);
    const bytes = this.db.harnessAttachmentBytes.get(key);
    if (!record || !bytes) return null;
    return {
      name: record.name,
      mimeType: record.mimeType,
      bytes: record.bytes,
      sha256: record.sha256,
      data: new Uint8Array(bytes),
      semantic: attachmentSemantic(record),
    };
  }

  async deleteAttachment({
    sessionId,
    attachmentId,
    harnessName,
  }: {
    sessionId: string;
    attachmentId: string;
    harnessName?: string;
  }): Promise<void> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const references = await this.listAttachmentReferences({ harnessName: namespace, sessionId, attachmentId });
    if (references.length > 0) {
      throw new HarnessStorageAttachmentInUseError(sessionId, attachmentId, references);
    }
    const key = attachmentKey(namespace, sessionId, attachmentId);
    this.db.harnessAttachmentRecords.delete(key);
    this.db.harnessAttachmentBytes.delete(key);
  }

  async deleteAttachmentsForSession({
    sessionId,
    harnessName,
  }: {
    sessionId: string;
    harnessName?: string;
  }): Promise<void> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const prefix = `${namespace}\u0000${sessionId}\u0000`;
    for (const key of this.db.harnessAttachmentRecords.keys()) {
      if (key.startsWith(prefix)) {
        const [, , attachmentId] = splitAttachmentKey(key);
        const references = await this.listAttachmentReferences({ harnessName: namespace, sessionId, attachmentId });
        if (references.length > 0) continue;
        this.db.harnessAttachmentRecords.delete(key);
        this.db.harnessAttachmentBytes.delete(key);
      }
    }
  }

  async getAttachmentRecord({
    sessionId,
    attachmentId,
    harnessName,
  }: {
    sessionId: string;
    attachmentId: string;
    harnessName?: string;
  }): Promise<AttachmentRecord | null> {
    return (
      this.db.harnessAttachmentRecords.get(
        attachmentKey(resolveHarnessName(harnessName, this.harnessName), sessionId, attachmentId),
      ) ?? null
    );
  }

  async recordAttachmentReferences(references: SaveAttachmentReferenceInput[]): Promise<void> {
    for (const ref of references) {
      const harnessName = resolveHarnessName(ref.harnessName, this.harnessName);
      this.db.harnessAttachmentReferences.set(attachmentReferenceKey({ ...ref, harnessName }), {
        source: ref.source,
        sourceId: ref.sourceId,
        ...(ref.retainedUntil !== undefined ? { retainedUntil: ref.retainedUntil } : {}),
      });
    }
  }

  async deleteAttachmentReferences(references: SaveAttachmentReferenceInput[]): Promise<void> {
    for (const ref of references) {
      const harnessName = resolveHarnessName(ref.harnessName, this.harnessName);
      this.db.harnessAttachmentReferences.delete(attachmentReferenceKey({ ...ref, harnessName }));
    }
  }

  async listAttachmentReferences({
    sessionId,
    attachmentId,
    harnessName,
  }: {
    sessionId: string;
    attachmentId: string;
    harnessName?: string;
  }): Promise<AttachmentReference[]> {
    const prefix = `${resolveHarnessName(harnessName, this.harnessName)}\u0000${sessionId}\u0000${attachmentId}\u0000`;
    const refs: AttachmentReference[] = [];
    for (const [key, ref] of this.db.harnessAttachmentReferences) {
      if (key.startsWith(prefix)) refs.push({ ...ref });
    }
    return refs.sort((a, b) => a.source.localeCompare(b.source) || a.sourceId.localeCompare(b.sourceId));
  }

  // -------------------------------------------------------------------------
  // Admission/result evidence
  // -------------------------------------------------------------------------

  async loadMessageResultEvidence({
    harnessName,
    sessionId,
    resourceId,
    threadId,
    signalId,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
    signalId: string;
  }): Promise<AgentSignalResultEvidence | OperationAdmissionTombstone | null> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const retained = this.db.harnessMessageResultEvidence.get(messageEvidenceKey(namespace, sessionId, signalId));
    if (retained && retained.resourceId === resourceId && retained.threadId === threadId) {
      return cloneJson(retained);
    }
    const tombstone = this.findTombstone(
      t =>
        t.harnessName === namespace &&
        t.kind === 'signal' &&
        t.sessionId === sessionId &&
        t.resourceId === resourceId &&
        t.threadId === threadId &&
        t.signalId === signalId,
    );
    return tombstone ? cloneJson(tombstone) : null;
  }

  async writeMessageResultEvidence(record: AgentSignalResultEvidence): Promise<WriteMessageResultEvidenceResult> {
    const namespacedRecord = {
      ...record,
      harnessName: resolveHarnessName(record.harnessName, this.harnessName),
    };
    const key = messageEvidenceKey(namespacedRecord.harnessName, namespacedRecord.sessionId, namespacedRecord.signalId);
    const existing = this.db.harnessMessageResultEvidence.get(key);
    if (existing === undefined && namespacedRecord.admissionId !== undefined) {
      // Admission uniqueness is per scoped (resource, thread, admissionId),
      // not per signalId: evidence written before a signal-identity or
      // admission-hash scheme change lives under a legacy signalId this key
      // never sees. Surface it as a storage admission conflict so the caller's
      // duplicate resolver (which knows the legacy-compatible hashes)
      // adjudicates replay vs conflict. The same caller-minted admission id may
      // legitimately occur in another thread, so it must not collide here.
      for (const row of this.db.harnessMessageResultEvidence.values()) {
        if (
          row.harnessName === namespacedRecord.harnessName &&
          row.sessionId === namespacedRecord.sessionId &&
          row.resourceId === namespacedRecord.resourceId &&
          row.threadId === namespacedRecord.threadId &&
          row.admissionId === namespacedRecord.admissionId &&
          row.signalId !== namespacedRecord.signalId
        ) {
          throw new HarnessStorageAdmissionConflictError(
            namespacedRecord.sessionId,
            'signal',
            namespacedRecord.admissionId,
          );
        }
      }
    }
    if (existing && !sameMessageEvidenceIdentity(existing, namespacedRecord)) {
      throw new HarnessStorageAdmissionConflictError(
        namespacedRecord.sessionId,
        'signal',
        namespacedRecord.admissionId ?? namespacedRecord.signalId,
      );
    }
    if (
      existing?.operationKind !== undefined &&
      namespacedRecord.operationKind !== undefined &&
      existing.operationKind !== namespacedRecord.operationKind
    ) {
      throw new HarnessStorageAdmissionConflictError(
        namespacedRecord.sessionId,
        'signal',
        namespacedRecord.admissionId ?? namespacedRecord.signalId,
      );
    }
    if (existing && isTerminalMessageEvidence(existing)) {
      return { created: false, applied: false, evidence: cloneJson(existing) };
    }
    // Once an admitted signal has an explicit durable discriminator or
    // dispatch fence, only the compare-and-swap dispatch/terminal APIs may
    // mutate it. Message admissions deliberately remain on this generic path.
    if (existing && isDispatchFencedAdmission(existing)) {
      return { created: false, applied: false, evidence: cloneJson(existing) };
    }
    const stored = {
      ...namespacedRecord,
      ...(namespacedRecord.dispatch === undefined && existing?.dispatch !== undefined
        ? { dispatch: existing.dispatch }
        : {}),
      ...(namespacedRecord.operationKind === undefined && existing?.operationKind !== undefined
        ? { operationKind: existing.operationKind }
        : {}),
      createdAt: existing?.createdAt ?? namespacedRecord.createdAt,
    };
    this.db.harnessMessageResultEvidence.set(key, cloneJson(stored));
    return existing === undefined
      ? { created: true, applied: true }
      : { created: false, applied: true, evidence: cloneJson(stored) };
  }

  async compareAndSwapSignalDispatch(
    input: CompareAndSwapSignalDispatchInput,
  ): Promise<CompareAndSwapSignalDispatchResult> {
    const harnessName = resolveHarnessName(input.harnessName, this.harnessName);
    const key = messageEvidenceKey(harnessName, input.sessionId, input.signalId);
    const existing = this.db.harnessMessageResultEvidence.get(key);
    if (
      !existing ||
      existing.resourceId !== input.resourceId ||
      existing.threadId !== input.threadId ||
      existing.admissionId !== input.admissionId ||
      existing.admissionHash !== input.admissionHash
    ) {
      throw new HarnessStorageAdmissionConflictError(input.sessionId, 'signal', input.admissionId);
    }
    if (!isSignalAdmissionEvidence(existing)) {
      throw new HarnessStorageAdmissionConflictError(input.sessionId, 'signal', input.admissionId);
    }
    if (isTerminalMessageEvidence(existing)) {
      return { applied: false, evidence: cloneJson(existing) };
    }
    if (!signalDispatchMatches(existing, input.expected)) {
      return { applied: false, evidence: cloneJson(existing) };
    }
    const pending = existing as Extract<AgentSignalResultEvidence, { status: 'pending' }>;
    const next: AgentSignalResultEvidence = {
      ...pending,
      operationKind: 'signal',
      dispatch: cloneJson(input.next),
      ...(input.next.state === 'reserved' ? { runId: undefined } : { runId: input.next.runId }),
      updatedAt: input.updatedAt,
    };
    this.db.harnessMessageResultEvidence.set(key, cloneJson(next));
    return { applied: true, evidence: cloneJson(next) };
  }

  async compareAndSwapSignalTerminal(
    input: CompareAndSwapSignalTerminalInput,
  ): Promise<CompareAndSwapSignalTerminalResult> {
    const harnessName = resolveHarnessName(input.harnessName, this.harnessName);
    const key = messageEvidenceKey(harnessName, input.sessionId, input.signalId);
    const existing = this.db.harnessMessageResultEvidence.get(key);
    if (
      !existing ||
      existing.resourceId !== input.resourceId ||
      existing.threadId !== input.threadId ||
      existing.admissionId !== input.admissionId ||
      existing.admissionHash !== input.admissionHash
    ) {
      throw new HarnessStorageAdmissionConflictError(input.sessionId, 'signal', input.admissionId);
    }
    if (!isSignalAdmissionEvidence(existing)) {
      throw new HarnessStorageAdmissionConflictError(input.sessionId, 'signal', input.admissionId);
    }
    if (isTerminalMessageEvidence(existing)) {
      return { applied: false, evidence: cloneJson(existing) };
    }
    if (!signalDispatchMatches(existing, input.expected)) {
      return { applied: false, evidence: cloneJson(existing) };
    }
    if (
      input.expected.state === 'reserved' ||
      (input.terminal.runId !== undefined && input.terminal.runId !== input.expected.runId)
    ) {
      throw new HarnessStorageAdmissionConflictError(input.sessionId, 'signal', input.admissionId);
    }
    const terminal: AgentSignalResultEvidence = {
      ...existing,
      ...cloneJson(input.terminal),
      harnessName,
      sessionId: input.sessionId,
      resourceId: input.resourceId,
      threadId: input.threadId,
      signalId: input.signalId,
      runId: input.expected.runId,
      admissionId: input.admissionId,
      admissionHash: input.admissionHash,
      operationKind: 'signal',
      modeId: input.terminal.modeId ?? existing.modeId,
      modelId: input.terminal.modelId ?? existing.modelId,
      dispatch: cloneJson(input.expected),
      createdAt: existing.createdAt,
      updatedAt: input.updatedAt,
    };
    this.db.harnessMessageResultEvidence.set(key, cloneJson(terminal));
    return { applied: true, evidence: cloneJson(terminal) };
  }

  async loadQueueResultEvidence({
    harnessName,
    sessionId,
    resourceId,
    queuedItemId,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    queuedItemId: string;
  }): Promise<QueueAdmissionReceipt | OperationAdmissionTombstone | null> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const session = this.db.harnessSessions.get(sessionKey(namespace, sessionId));
    if (session && session.resourceId !== resourceId) return null;
    const receipt = session?.queueAdmissionReceipts?.[queuedItemId];
    if (receipt) return cloneJson(receipt);
    const tombstone = this.findTombstone(
      t =>
        t.harnessName === namespace &&
        t.kind === 'queue' &&
        t.sessionId === sessionId &&
        t.resourceId === resourceId &&
        t.queuedItemId === queuedItemId,
    );
    return tombstone ? cloneJson(tombstone) : null;
  }

  async resolveOperationAdmissionEvidence({
    harnessName,
    sessionId,
    resourceId,
    threadId,
    kind,
    admissionId,
    attemptedAdmissionHash,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId?: string;
    kind: 'signal' | 'queue';
    admissionId: string;
    attemptedAdmissionHash: string;
  }): Promise<{
    status: 'none' | 'duplicate' | 'conflict';
    evidence?: OperationAdmissionEvidence;
    storedAdmissionHash?: string;
  }> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    if (kind === 'signal') {
      for (const evidence of this.db.harnessMessageResultEvidence.values()) {
        if (
          evidence.harnessName !== namespace ||
          evidence.sessionId !== sessionId ||
          evidence.resourceId !== resourceId ||
          (threadId !== undefined && evidence.threadId !== threadId) ||
          evidence.admissionId !== admissionId
        ) {
          continue;
        }
        if (evidence.admissionHash !== attemptedAdmissionHash) {
          return { status: 'conflict', evidence: cloneJson(evidence), storedAdmissionHash: evidence.admissionHash };
        }
        return { status: 'duplicate', evidence: cloneJson(evidence), storedAdmissionHash: evidence.admissionHash };
      }
    }
    if (kind === 'queue') {
      const session = this.db.harnessSessions.get(sessionKey(namespace, sessionId));
      if (session && (session.resourceId !== resourceId || (threadId !== undefined && session.threadId !== threadId))) {
        return { status: 'none' };
      }
      for (const receipt of Object.values(session?.queueAdmissionReceipts ?? {})) {
        if (receipt.admissionId !== admissionId) continue;
        if (receipt.admissionHash !== attemptedAdmissionHash) {
          return { status: 'conflict', evidence: cloneJson(receipt), storedAdmissionHash: receipt.admissionHash };
        }
        return { status: 'duplicate', evidence: cloneJson(receipt), storedAdmissionHash: receipt.admissionHash };
      }
    }

    const tombstone = this.findTombstone(
      t =>
        t.harnessName === namespace &&
        t.sessionId === sessionId &&
        t.resourceId === resourceId &&
        (threadId === undefined || t.threadId === threadId) &&
        t.kind === kind &&
        t.admissionId === admissionId,
    );
    if (!tombstone) return { status: 'none' };
    if (tombstone.admissionHash !== attemptedAdmissionHash) {
      return {
        status: 'conflict',
        evidence: cloneJson(tombstone),
        storedAdmissionHash: tombstone.admissionHash,
      };
    }
    return {
      status: 'duplicate',
      evidence: cloneJson(tombstone),
      storedAdmissionHash: tombstone.admissionHash,
    };
  }

  async writeOperationAdmissionTombstone(record: OperationAdmissionTombstone): Promise<void> {
    const key = tombstoneKey(record);
    const existing = this.db.harnessOperationTombstones.get(key);
    if (existing && !sameTombstoneIdentity(existing, record)) {
      throw new HarnessStorageAdmissionConflictError(record.sessionId, record.kind, record.admissionId ?? key);
    }
    this.db.harnessOperationTombstones.set(key, cloneJson(record));
  }

  async compactOperationResultEvidence({
    harnessName,
    sessionId,
    resourceId,
    kind,
    signalId,
    queuedItemId,
    now,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    kind: 'signal' | 'queue';
    signalId?: string;
    queuedItemId?: string;
    now: number;
  }): Promise<OperationAdmissionTombstone | null> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    if (kind === 'signal') {
      const key = signalId ? messageEvidenceKey(namespace, sessionId, signalId) : undefined;
      const retained = key ? this.db.harnessMessageResultEvidence.get(key) : undefined;
      if (!retained || retained.resourceId !== resourceId || retained.status === 'pending') return null;
      const tombstone: OperationAdmissionTombstone = {
        kind: 'signal',
        harnessName: namespace,
        sessionId,
        resourceId,
        threadId: retained.threadId,
        ...(retained.admissionId !== undefined ? { admissionId: retained.admissionId } : {}),
        ...(retained.admissionHash !== undefined ? { admissionHash: retained.admissionHash } : {}),
        signalId: retained.signalId,
        ...(retained.runId !== undefined ? { runId: retained.runId } : {}),
        terminalAt: retained.updatedAt,
        compactedAt: now,
        expiresAt: now,
      };
      await this.writeOperationAdmissionTombstone(tombstone);
      this.db.harnessMessageResultEvidence.delete(messageEvidenceKey(namespace, sessionId, retained.signalId));
      return cloneJson(tombstone);
    }

    const key = sessionKey(namespace, sessionId);
    return this.withCompactionLock(key, async () => {
      const session = this.db.harnessSessions.get(key);
      if (session && session.resourceId !== resourceId) return null;
      const receipt = queuedItemId ? session?.queueAdmissionReceipts?.[queuedItemId] : undefined;
      if (!session || !receipt) return null;
      if (!isTerminalQueueReceipt(receipt)) return null;
      const tombstone: OperationAdmissionTombstone = {
        kind: 'queue',
        harnessName: namespace,
        sessionId,
        resourceId,
        threadId: session.threadId,
        admissionId: receipt.admissionId,
        admissionHash: receipt.admissionHash,
        queuedItemId: receipt.queuedItemId,
        ...(receipt.signalId !== undefined ? { signalId: receipt.signalId } : {}),
        ...(receipt.runId !== undefined ? { runId: receipt.runId } : {}),
        terminalAt: receipt.completedAt ?? receipt.failedAt ?? receipt.deadAt ?? now,
        compactedAt: now,
        expiresAt: now,
      };
      await this.writeOperationAdmissionTombstone(tombstone);
      const nextReceipts = { ...(session.queueAdmissionReceipts ?? {}) };
      delete nextReceipts[queuedItemId!];
      this.db.harnessSessions.set(key, {
        ...session,
        queueAdmissionReceipts: Object.keys(nextReceipts).length > 0 ? nextReceipts : undefined,
      });
      return cloneJson(tombstone);
    });
  }

  async deleteOperationAdmissionTombstonesForSession({
    harnessName,
    sessionId,
    resourceId,
    threadId,
    signalId,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId?: string;
    signalId?: string;
  }): Promise<void> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    for (const [key, evidence] of this.db.harnessMessageResultEvidence) {
      if (
        evidence.harnessName === namespace &&
        evidence.sessionId === sessionId &&
        evidence.resourceId === resourceId &&
        (threadId === undefined || evidence.threadId === threadId) &&
        (signalId === undefined || evidence.signalId === signalId)
      ) {
        this.db.harnessMessageResultEvidence.delete(key);
      }
    }
    for (const [key, tombstone] of this.db.harnessOperationTombstones) {
      if (
        tombstone.harnessName === namespace &&
        tombstone.sessionId === sessionId &&
        tombstone.resourceId === resourceId &&
        (threadId === undefined || tombstone.threadId === threadId) &&
        (signalId === undefined || tombstone.signalId === signalId)
      ) {
        this.db.harnessOperationTombstones.delete(key);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Session event replay
  // -------------------------------------------------------------------------

  async appendSessionEvent(record: HarnessSessionEventRecord): Promise<void> {
    const namespaced = { ...record, harnessName: resolveHarnessName(record.harnessName, this.harnessName) };
    const session = this.db.harnessSessions.get(sessionKey(namespaced.harnessName, namespaced.sessionId));
    if (!session || session.resourceId !== namespaced.resourceId || session.threadId !== namespaced.threadId) {
      return;
    }
    const key = sessionEventKey(namespaced);
    if (!this.db.harnessSessionEvents.has(key)) {
      this.db.harnessSessionEvents.set(key, cloneJson(namespaced));
    }
  }

  async getSessionEventReplayState({
    harnessName,
    sessionId,
    resourceId,
    threadId,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
  }): Promise<HarnessSessionEventReplayState | null> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const rows = Array.from(this.db.harnessSessionEvents.values()).filter(
      event =>
        event.harnessName === namespace &&
        event.sessionId === sessionId &&
        event.resourceId === resourceId &&
        event.threadId === threadId,
    );
    const epochs = new Set(rows.map(event => event.epoch));
    if (epochs.size !== 1) return null;
    const [epoch] = epochs;
    let state: HarnessSessionEventReplayState = {
      epoch: epoch!,
      oldestSequence: Number.POSITIVE_INFINITY,
      newestSequence: Number.NEGATIVE_INFINITY,
    };
    for (const event of rows) {
      state.oldestSequence = Math.min(state.oldestSequence, event.sequence);
      state.newestSequence = Math.max(state.newestSequence, event.sequence);
    }
    return state;
  }

  async listSessionEvents({
    harnessName,
    sessionId,
    resourceId,
    threadId,
    epoch,
    afterSequence,
    limit,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
    epoch: string;
    afterSequence: number;
    limit: number;
  }): Promise<HarnessSessionEventRecord[]> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const rows = Array.from(this.db.harnessSessionEvents.values()).filter(
      event =>
        event.harnessName === namespace &&
        event.sessionId === sessionId &&
        event.resourceId === resourceId &&
        event.threadId === threadId &&
        event.epoch === epoch &&
        event.sequence > afterSequence,
    );
    rows.sort((a, b) => a.sequence - b.sequence);
    return rows.slice(0, limit).map(row => cloneJson(row));
  }

  async appendWorkspaceActionJournalEntry(
    record: WorkspaceActionJournalEntry,
  ): Promise<AppendWorkspaceActionJournalEntryResult> {
    assertWorkspaceActionTraceScope(record);
    assertWorkspaceActionKindMatches(record);
    const namespaced = { ...record, harnessName: resolveHarnessName(record.harnessName, this.harnessName) };
    const session = this.db.harnessSessions.get(sessionKey(namespaced.harnessName, namespaced.sessionId));
    if (!session || session.resourceId !== namespaced.resourceId || session.threadId !== namespaced.threadId) {
      return { created: false };
    }
    const key = workspaceActionJournalKey(namespaced.harnessName, namespaced.sessionId, namespaced.id);
    if (!this.db.harnessWorkspaceActionJournal.has(key)) {
      this.db.harnessWorkspaceActionJournal.set(key, cloneJson(namespaced));
      return { created: true };
    }
    return { created: false };
  }

  async listWorkspaceActionJournalEntries({
    harnessName,
    sessionId,
    resourceId,
    threadId,
    actionKind,
    operation,
    policyDecision,
    requestId,
    traceId,
    spanId,
    affectedPath,
    after,
    limit,
  }: ListWorkspaceActionJournalInput): Promise<WorkspaceActionJournalEntry[]> {
    if (spanId !== undefined && traceId === undefined) {
      throw new Error('Workspace action journal spanId filter requires traceId');
    }
    if (limit <= 0) return [];
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const rows = Array.from(this.db.harnessWorkspaceActionJournal.values()).filter(entry => {
      if (entry.harnessName !== namespace) return false;
      if (entry.sessionId !== sessionId || entry.resourceId !== resourceId) return false;
      if (threadId !== undefined && entry.threadId !== threadId) return false;
      if (actionKind !== undefined && entry.actionKind !== actionKind) return false;
      if (operation !== undefined && entry.operation !== operation) return false;
      if (policyDecision !== undefined && entry.policyDecision !== policyDecision) return false;
      if (requestId !== undefined && entry.requestId !== requestId) return false;
      if (traceId !== undefined && entry.traceId !== traceId) return false;
      if (spanId !== undefined && entry.spanId !== spanId) return false;
      if (affectedPath !== undefined && !workspaceActionJournalEntryMatchesPath(entry, affectedPath)) return false;
      if (after !== undefined && compareWorkspaceActionJournalCursor(entry, after) <= 0) return false;
      return true;
    });
    rows.sort(compareWorkspaceActionJournalOrder);
    return rows.slice(0, limit).map(row => cloneJson(row));
  }

  // -------------------------------------------------------------------------
  // Provider callback binding ledger
  // -------------------------------------------------------------------------

  async resolveProviderCallbackBinding(
    record: HarnessProviderCallbackBinding,
    opts?: { replaceBindingId?: string },
  ): Promise<ResolveProviderCallbackBindingResult> {
    const incoming: HarnessProviderCallbackBinding = {
      ...record,
      harnessName: resolveHarnessName(record.harnessName, this.harnessName),
    };
    assertValidProviderCallbackBindingState(incoming);
    const active = this.findActiveProviderCallbackBindingBySelector({
      providerId: incoming.providerId,
      selectorKind: incoming.selectorKind,
      selectorValue: incoming.selectorValue,
    });

    if (opts?.replaceBindingId !== undefined) {
      if (opts.replaceBindingId === incoming.id) {
        throw new HarnessStorageProviderCallbackBindingTransitionError(
          incoming.id,
          incoming.status,
          'replaced',
          'replacement target must be different from the incoming binding',
        );
      }
      if (incoming.status !== 'active') {
        throw new HarnessStorageProviderCallbackBindingTransitionError(
          incoming.id,
          incoming.status,
          'active',
          'replacement binding must be active',
        );
      }
      const existingById = this.findProviderCallbackBindingById(incoming.id);
      if (existingById && !providerCallbackBindingsEqual(existingById, incoming)) {
        throw new HarnessStorageProviderCallbackBindingTransitionError(
          incoming.id,
          existingById.status,
          incoming.status,
          'id is already owned by another provider callback binding',
        );
      }
      const previous = this.findProviderCallbackBindingById(opts.replaceBindingId);
      if (
        previous?.status === 'replaced' &&
        previous.replacedByBindingId === incoming.id &&
        existingById &&
        providerCallbackBindingsEqual(existingById, incoming)
      ) {
        return {
          binding: existingById,
          duplicate: true,
          conflict: false,
          replacedBindingId: previous.id,
        };
      }
      if (
        !previous ||
        previous.status !== 'active' ||
        previous.providerId !== incoming.providerId ||
        previous.selectorKind !== incoming.selectorKind ||
        previous.selectorValue !== incoming.selectorValue
      ) {
        throw new HarnessStorageProviderCallbackBindingTransitionError(
          opts.replaceBindingId,
          previous?.status,
          'replaced',
          'replacement target is missing, inactive, or owns a different selector',
        );
      }
      if (active && active.id !== previous.id) {
        if (existingById && providerCallbackBindingsEqual(existingById, incoming)) {
          return { binding: existingById, duplicate: true, conflict: false, replacedBindingId: previous.id };
        }
        return { binding: active, duplicate: true, conflict: true };
      }
      const replacedAt = incoming.createdAt;
      const replacedPrevious: HarnessProviderCallbackBinding = {
        ...previous,
        status: 'replaced',
        replacedAt,
        replacedByBindingId: incoming.id,
        updatedAt: replacedAt,
      };
      this.db.harnessProviderCallbackBindings.set(previous.id, cloneJson(replacedPrevious));
      this.db.harnessProviderCallbackBindings.set(incoming.id, cloneJson(incoming));
      return { binding: cloneJson(incoming), duplicate: false, conflict: false, replacedBindingId: previous.id };
    }

    if (active) {
      return {
        binding: active,
        duplicate: true,
        conflict: !sameProviderCallbackBindingTarget(active, incoming),
      };
    }
    const existingById = this.findProviderCallbackBindingById(incoming.id);
    if (existingById) {
      if (providerCallbackBindingsEqual(existingById, incoming)) {
        return { binding: existingById, duplicate: true, conflict: false };
      }
      throw new HarnessStorageProviderCallbackBindingTransitionError(
        incoming.id,
        existingById.status,
        incoming.status,
        'id is already owned by another provider callback binding',
      );
    }
    this.db.harnessProviderCallbackBindings.set(incoming.id, cloneJson(incoming));
    return { binding: cloneJson(incoming), duplicate: false, conflict: false };
  }

  async loadProviderCallbackBindingBySelector(opts: {
    providerId: string;
    selectorKind: ProviderCallbackSelectorKind;
    selectorValue: string;
  }): Promise<HarnessProviderCallbackBinding | null> {
    return this.findActiveProviderCallbackBindingBySelector(opts);
  }

  async markProviderCallbackBindingStatus(opts: {
    bindingId: string;
    status: Extract<HarnessProviderCallbackBinding['status'], 'active' | 'disabled' | 'undeliverable'>;
    updatedAt?: number;
    lastError?: HarnessProviderCallbackBinding['lastError'];
  }): Promise<HarnessProviderCallbackBinding> {
    const current = this.findProviderCallbackBindingById(opts.bindingId);
    if (!current) {
      throw new HarnessStorageProviderCallbackBindingTransitionError(
        opts.bindingId,
        undefined,
        opts.status,
        'binding was not found',
      );
    }
    if (current.status === 'replaced') {
      throw new HarnessStorageProviderCallbackBindingTransitionError(
        current.id,
        current.status,
        opts.status,
        'replaced bindings are terminal',
      );
    }
    const updatedAt = opts.updatedAt ?? Date.now();
    const active = this.findActiveProviderCallbackBindingBySelector({
      providerId: current.providerId,
      selectorKind: current.selectorKind,
      selectorValue: current.selectorValue,
    });
    if (opts.status === 'active' && active && active.id !== current.id) {
      throw new HarnessStorageProviderCallbackBindingTransitionError(
        current.id,
        current.status,
        opts.status,
        'another active binding owns this selector',
      );
    }
    const next: HarnessProviderCallbackBinding = {
      ...current,
      status: opts.status,
      updatedAt,
      lastError: opts.lastError,
    };
    assertValidProviderCallbackBindingState(next);
    this.db.harnessProviderCallbackBindings.set(next.id, cloneJson(next));
    return cloneJson(next);
  }

  // -------------------------------------------------------------------------
  // Channel bindings (§5.1h / §14.1)
  // -------------------------------------------------------------------------

  async saveChannelBinding(record: ChannelBinding): Promise<void> {
    const namespaced = { ...record, harnessName: resolveHarnessName(record.harnessName, this.harnessName) };
    // §5.2h: active rows are unique at storage level. Reject a write that would
    // create a SECOND active binding for the same conversation tuple (updating
    // the same binding id, or writing a non-active row, is always allowed). The
    // invariant-preserving create/replace path is `resolveChannelBinding`.
    if (namespaced.status === 'active') {
      for (const existing of this.db.harnessChannelBindings.values()) {
        if (
          existing.id !== namespaced.id &&
          existing.harnessName === namespaced.harnessName &&
          existing.status === 'active' &&
          channelBindingTupleMatches(existing, namespaced)
        ) {
          throw new HarnessStorageChannelBindingConflictError(
            namespaced.channelId,
            namespaced.externalThreadId,
            existing.id,
          );
        }
      }
    }
    this.db.harnessChannelBindings.set(channelBindingKey(namespaced.harnessName, namespaced.id), cloneJson(namespaced));
  }

  async touchChannelBindingInbound(opts: {
    harnessName?: string;
    bindingId: string;
    at: number;
  }): Promise<ChannelBinding | null> {
    const ns = resolveHarnessName(opts.harnessName, this.harnessName);
    const key = channelBindingKey(ns, opts.bindingId);
    const found = this.db.harnessChannelBindings.get(key);
    if (!found || found.harnessName !== ns) return null;
    // §14.1 forward-only: advance the activity markers monotonically against the
    // authoritative current row (read + merge + write with no intervening await),
    // so a delayed/older or concurrent same-binding ingress can never clobber a
    // newer marker.
    const nextInbound = Math.max(found.lastInboundAt ?? 0, opts.at);
    const nextUpdated = Math.max(found.updatedAt, opts.at);
    if (nextInbound === (found.lastInboundAt ?? 0) && nextUpdated === found.updatedAt) {
      return cloneJson(found); // no forward movement — skip the write
    }
    const merged: ChannelBinding = { ...found, lastInboundAt: nextInbound, updatedAt: nextUpdated };
    this.db.harnessChannelBindings.set(key, cloneJson(merged));
    return cloneJson(merged);
  }

  async loadChannelBinding(opts: { bindingId: string }): Promise<ChannelBinding | null> {
    const ns = resolveHarnessName(undefined, this.harnessName);
    const found = this.db.harnessChannelBindings.get(channelBindingKey(ns, opts.bindingId));
    return found && found.harnessName === ns ? cloneJson(found) : null;
  }

  async loadChannelBindingByExternal(opts: {
    harnessName: string;
    channelId: string;
    platform: string;
    externalTenantId?: string;
    externalChannelId?: string;
    externalThreadId: string;
  }): Promise<ChannelBinding | null> {
    const ns = resolveHarnessName(opts.harnessName, this.harnessName);
    for (const binding of this.db.harnessChannelBindings.values()) {
      if (
        binding.harnessName === ns &&
        binding.status === 'active' &&
        binding.channelId === opts.channelId &&
        binding.platform === opts.platform &&
        normalizeExternalId(binding.externalTenantId) === normalizeExternalId(opts.externalTenantId) &&
        normalizeExternalId(binding.externalChannelId) === normalizeExternalId(opts.externalChannelId) &&
        binding.externalThreadId === opts.externalThreadId
      ) {
        return cloneJson(binding);
      }
    }
    return null;
  }

  async resolveChannelBinding(opts: {
    candidate: ChannelBinding;
    replaceBindingId?: string;
  }): Promise<ResolveChannelBindingResult> {
    const ns = resolveHarnessName(opts.candidate.harnessName, this.harnessName);
    const candidate = opts.candidate;
    const sameTuple = (b: ChannelBinding): boolean =>
      b.harnessName === ns &&
      b.channelId === candidate.channelId &&
      b.platform === candidate.platform &&
      normalizeExternalId(b.externalTenantId) === normalizeExternalId(candidate.externalTenantId) &&
      normalizeExternalId(b.externalChannelId) === normalizeExternalId(candidate.externalChannelId) &&
      b.externalThreadId === candidate.externalThreadId;
    // The tuple's current active binding is authoritative for the §14.1
    // one-active-per-tuple invariant (regardless of the caller-supplied
    // replaceBindingId, which is only a hint about the prior generation).
    const existingActive = await this.loadChannelBindingByExternal({
      harnessName: ns,
      channelId: candidate.channelId,
      platform: candidate.platform,
      ...(candidate.externalTenantId !== undefined ? { externalTenantId: candidate.externalTenantId } : {}),
      ...(candidate.externalChannelId !== undefined ? { externalChannelId: candidate.externalChannelId } : {}),
      externalThreadId: candidate.externalThreadId,
    });

    // Generation is storage-managed and monotonic per tuple ("starts at 1;
    // increments on replacement"): a new binding never regresses below the max
    // generation any binding for this tuple has ever held (active or fenced).
    let maxTupleGeneration = 0;
    for (const b of this.db.harnessChannelBindings.values()) {
      if (sameTuple(b)) maxTupleGeneration = Math.max(maxTupleGeneration, b.generation);
    }

    if (opts.replaceBindingId !== undefined) {
      // §14.1 replacement: fence the tuple's existing active binding to
      // `replaced` (never an unrelated conversation named by a stale id) and
      // commit the candidate with an incremented generation. Exactly one active
      // binding remains for the tuple.
      const fenceIds = new Set<string>([opts.replaceBindingId, ...(existingActive ? [existingActive.id] : [])]);
      for (const id of fenceIds) {
        const prior = this.db.harnessChannelBindings.get(channelBindingKey(ns, id));
        if (prior !== undefined && prior.status === 'active' && sameTuple(prior)) {
          this.db.harnessChannelBindings.set(
            channelBindingKey(ns, prior.id),
            cloneJson({
              ...prior,
              status: 'replaced' as const,
              replacedByBindingId: candidate.id,
              updatedAt: candidate.updatedAt,
            }),
          );
        }
      }
      const committed: ChannelBinding = {
        ...candidate,
        harnessName: ns,
        status: 'active',
        generation: maxTupleGeneration + 1,
      };
      this.db.harnessChannelBindings.set(channelBindingKey(ns, committed.id), cloneJson(committed));
      return {
        binding: cloneJson(committed),
        created: true,
        ...(existingActive !== null ? { replacedBindingId: existingActive.id } : {}),
      };
    }

    // No replacement: an existing active binding for the tuple wins (idempotent
    // resolution); otherwise commit the candidate as the new active binding.
    if (existingActive !== null) return { binding: existingActive, created: false };
    const committed: ChannelBinding = {
      ...candidate,
      harnessName: ns,
      status: 'active',
      generation: maxTupleGeneration + 1,
    };
    this.db.harnessChannelBindings.set(channelBindingKey(ns, committed.id), cloneJson(committed));
    return { binding: cloneJson(committed), created: true };
  }

  async listChannelBindingsForSession(opts: { sessionId: string }): Promise<ChannelBinding[]> {
    const ns = resolveHarnessName(undefined, this.harnessName);
    const out: ChannelBinding[] = [];
    for (const binding of this.db.harnessChannelBindings.values()) {
      if (binding.harnessName === ns && binding.sessionId === opts.sessionId) out.push(cloneJson(binding));
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  async listActiveChannelBindingsForScope(opts: {
    harnessName: string;
    channelId?: string;
    limit: number;
    cursor?: string;
  }): Promise<ListActiveChannelBindingsResult> {
    const ns = resolveHarnessName(opts.harnessName, this.harnessName);
    const all: ChannelBinding[] = [];
    for (const binding of this.db.harnessChannelBindings.values()) {
      if (
        binding.harnessName === ns &&
        binding.status === 'active' &&
        (opts.channelId === undefined || binding.channelId === opts.channelId)
      ) {
        all.push(binding);
      }
    }
    // §14.8 binding ordering: (lastOutboundAt DESC, bindingId DESC), using
    // lastInboundAt when no outbound time exists.
    const activityAt = (b: ChannelBinding): number => b.lastOutboundAt ?? b.lastInboundAt ?? 0;
    all.sort((a, b) => activityAt(b) - activityAt(a) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    let start = 0;
    if (opts.cursor !== undefined) {
      const idx = all.findIndex(b => b.id === opts.cursor);
      // An unknown/stale cursor must not silently restart at page 1 (which would
      // duplicate already-seen rows); treat it as the end of the result set.
      start = idx === -1 ? all.length : idx + 1;
    }
    const page = all.slice(start, start + opts.limit);
    const hasMore = start + opts.limit < all.length;
    const nextCursor = hasMore ? page[page.length - 1]?.id : undefined;
    return { bindings: page.map(cloneJson), ...(nextCursor !== undefined ? { nextCursor } : {}) };
  }

  async deleteChannelBinding(opts: { bindingId: string }): Promise<void> {
    const ns = resolveHarnessName(undefined, this.harnessName);
    this.db.harnessChannelBindings.delete(channelBindingKey(ns, opts.bindingId));
  }

  // -------------------------------------------------------------------------
  // Channel inbox ledger
  // -------------------------------------------------------------------------

  async saveChannelInboxItem(record: ChannelInboxItem): Promise<void> {
    const namespaced = { ...record, harnessName: resolveHarnessName(record.harnessName, this.harnessName) };
    assertValidChannelInboxState(namespaced);
    const existingByKey = this.findChannelInboxByIdempotencyKey({
      harnessName: namespaced.harnessName,
      channelId: namespaced.channelId,
      idempotencyKey: namespaced.idempotencyKey,
    });
    if (existingByKey && existingByKey.id !== namespaced.id) {
      throw new HarnessStorageChannelInboxTransitionError(
        namespaced.id,
        undefined,
        namespaced.status,
        'idempotency key is already owned by another inbox item',
      );
    }
    const existing = this.findChannelInboxById(namespaced.id);
    if (existing) {
      if (channelInboxItemsEqual(existing, namespaced)) return;
      assertLegalChannelInboxUpdate(existing, namespaced);
    }
    this.db.harnessChannelInbox.set(channelInboxKey(namespaced.harnessName, namespaced.id), cloneJson(namespaced));
  }

  async createOrLoadChannelInboxItem(
    record: ChannelInboxItem,
    opts?: { initialClaim?: { claimId: string; now: number; claimTtlMs: number } },
  ): Promise<CreateOrLoadChannelInboxItemResult> {
    const namespace = resolveHarnessName(record.harnessName, this.harnessName);
    const incoming: ChannelInboxItem = { ...record, harnessName: namespace };
    assertValidChannelInboxState(incoming);
    const existing = this.findChannelInboxByIdempotencyKey({
      harnessName: namespace,
      channelId: incoming.channelId,
      idempotencyKey: incoming.idempotencyKey,
    });
    if (existing) {
      const conflict = existing.payloadHash !== incoming.payloadHash;
      let claimed = false;
      let item = existing;
      if (!conflict && opts?.initialClaim && isChannelInboxClaimable(existing, opts.initialClaim.now)) {
        item = {
          ...existing,
          claimId: opts.initialClaim.claimId,
          claimExpiresAt: opts.initialClaim.now + opts.initialClaim.claimTtlMs,
          updatedAt: opts.initialClaim.now,
        };
        this.db.harnessChannelInbox.set(channelInboxKey(namespace, item.id), cloneJson(item));
        claimed = true;
      }
      return { item: cloneJson(item), duplicate: true, conflict, claimed };
    }
    const existingById = this.findChannelInboxById(incoming.id);
    if (existingById) {
      throw new HarnessStorageChannelInboxTransitionError(
        incoming.id,
        existingById.status,
        incoming.status,
        'id is already owned by another inbox item',
      );
    }

    const item =
      opts?.initialClaim === undefined
        ? incoming
        : {
            ...incoming,
            claimId: opts.initialClaim.claimId,
            claimExpiresAt: opts.initialClaim.now + opts.initialClaim.claimTtlMs,
            updatedAt: opts.initialClaim.now,
          };
    this.db.harnessChannelInbox.set(channelInboxKey(namespace, item.id), cloneJson(item));
    return { item: cloneJson(item), duplicate: false, conflict: false, claimed: opts?.initialClaim !== undefined };
  }

  async loadChannelInboxItemByIdempotencyKey(opts: {
    harnessName: string;
    channelId: string;
    idempotencyKey: string;
  }): Promise<ChannelInboxItem | null> {
    const item = this.findChannelInboxByIdempotencyKey({
      ...opts,
      harnessName: resolveHarnessName(opts.harnessName, this.harnessName),
    });
    return item ? cloneJson(item) : null;
  }

  async claimChannelInboxItems({
    harnessName,
    channelId,
    statuses,
    claimId,
    limit,
    now,
    claimTtlMs,
  }: {
    harnessName: string;
    channelId?: string;
    statuses: Array<'received' | 'admitted' | 'failed'>;
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<ChannelInboxItem[]> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const claimed: ChannelInboxItem[] = [];
    const sorted = Array.from(this.db.harnessChannelInbox.values()).sort((a, b) => a.receivedAt - b.receivedAt);
    for (const item of sorted) {
      if (claimed.length >= limit) break;
      if (item.harnessName !== namespace) continue;
      if (channelId !== undefined && item.channelId !== channelId) continue;
      if (!statuses.includes(item.status as 'received' | 'admitted' | 'failed')) continue;
      if (!isChannelInboxClaimable(item, now)) continue;
      const next = {
        ...item,
        claimId,
        claimExpiresAt: now + claimTtlMs,
        updatedAt: now,
      };
      this.db.harnessChannelInbox.set(channelInboxKey(namespace, next.id), cloneJson(next));
      claimed.push(cloneJson(next));
    }
    return claimed;
  }

  async renewChannelInboxClaim({
    inboxItemId,
    claimId,
    now,
    claimTtlMs,
  }: {
    inboxItemId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }> {
    const current = this.findChannelInboxById(inboxItemId);
    if (
      !current ||
      current.claimId !== claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= now ||
      isTerminalChannelInboxStatus(current.status)
    ) {
      throw new HarnessStorageChannelInboxClaimConflictError(inboxItemId, claimId);
    }
    const claimExpiresAt = now + claimTtlMs;
    const next = { ...current, claimExpiresAt, updatedAt: now };
    this.db.harnessChannelInbox.set(channelInboxKey(next.harnessName, next.id), cloneJson(next));
    return { claimExpiresAt, storageNow: now };
  }

  async updateChannelInboxItem(record: ChannelInboxItem, opts: { claimId: string }): Promise<void> {
    const namespace = resolveHarnessName(record.harnessName, this.harnessName);
    const current = this.db.harnessChannelInbox.get(channelInboxKey(namespace, record.id));
    const storageNow = Date.now();
    if (
      !current ||
      current.claimId !== opts.claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= storageNow ||
      isTerminalChannelInboxStatus(current.status)
    ) {
      throw new HarnessStorageChannelInboxClaimConflictError(record.id, opts.claimId);
    }
    // Claim-field contract: a KEEP-claim write (record still carries `claimId`)
    // must NOT let the caller's possibly-stale `claimExpiresAt` roll back a
    // concurrent `renewChannelInboxClaim` heartbeat — the live expiry is
    // storage-owned, so preserve `current.claimId`/`claimExpiresAt`. A RELEASE
    // write (record clears `claimId`) is the explicit "drop the claim" signal
    // (e.g. a worker failing a row so it reclaims at `nextAttemptAt`) and is
    // honored as-is.
    const next =
      record.claimId === undefined
        ? { ...record, harnessName: namespace }
        : { ...record, harnessName: namespace, claimId: current.claimId, claimExpiresAt: current.claimExpiresAt };
    assertLegalChannelInboxUpdate(current, next);
    this.db.harnessChannelInbox.set(channelInboxKey(namespace, record.id), cloneJson(next));
  }

  // -------------------------------------------------------------------------
  // Channel action token and receipt ledger
  // -------------------------------------------------------------------------

  async createOrLoadChannelActionToken(record: ChannelActionToken): Promise<CreateOrLoadChannelActionTokenResult> {
    const token = { ...record, harnessName: resolveHarnessName(record.harnessName, this.harnessName) };
    const existing = this.findChannelActionTokenById({
      harnessName: token.harnessName,
      channelId: token.channelId,
      actionTokenId: token.actionTokenId,
    });
    if (existing) {
      return { token: cloneJson(existing), duplicate: true, conflict: !channelActionTokensEquivalent(existing, token) };
    }
    const transportOwner = this.findChannelActionTokenByTransportHash({
      harnessName: token.harnessName,
      channelId: token.channelId,
      transportHash: token.transportHash,
    });
    if (transportOwner) {
      return { token: cloneJson(transportOwner), duplicate: true, conflict: true };
    }
    const pendingOwner = this.findChannelActionTokenForPendingItem({
      harnessName: token.harnessName,
      channelId: token.channelId,
      bindingId: token.bindingId,
      bindingGeneration: token.bindingGeneration,
      owningSessionId: token.owningSessionId,
      itemId: token.itemId,
      kind: token.kind,
      runId: token.runId,
      pendingRequestedAt: token.pendingRequestedAt,
      metadataHash: token.metadataHash,
    });
    if (pendingOwner) {
      return { token: cloneJson(pendingOwner), duplicate: true, conflict: true };
    }
    this.db.harnessChannelActionTokens.set(
      channelActionTokenKey(token.harnessName, token.channelId, token.actionTokenId),
      cloneJson(token),
    );
    return { token: cloneJson(token), duplicate: false, conflict: false };
  }

  async loadChannelActionTokenById(opts: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
  }): Promise<ChannelActionToken | null> {
    const token = this.findChannelActionTokenById({
      ...opts,
      harnessName: resolveHarnessName(opts.harnessName, this.harnessName),
    });
    return token ? cloneJson(token) : null;
  }

  async loadChannelActionTokenByTransportHash(opts: {
    harnessName: string;
    channelId: string;
    transportHash: string;
  }): Promise<ChannelActionToken | null> {
    const token = this.findChannelActionTokenByTransportHash({
      ...opts,
      harnessName: resolveHarnessName(opts.harnessName, this.harnessName),
    });
    return token ? cloneJson(token) : null;
  }

  async loadChannelActionTokenForPendingItem(opts: {
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
  }): Promise<ChannelActionToken | null> {
    const token = this.findChannelActionTokenForPendingItem({
      ...opts,
      harnessName: resolveHarnessName(opts.harnessName, this.harnessName),
    });
    return token ? cloneJson(token) : null;
  }

  async revokeChannelActionToken(opts: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
    revokedAt?: number;
    revokedReason?: ChannelActionToken['revokedReason'];
  }): Promise<ChannelActionToken> {
    const namespace = resolveHarnessName(opts.harnessName, this.harnessName);
    const key = channelActionTokenKey(namespace, opts.channelId, opts.actionTokenId);
    const token = this.db.harnessChannelActionTokens.get(key);
    if (!token) throw new HarnessStorageChannelActionTokenConflictError(opts.actionTokenId, 'token was not found');
    const revokedAt = opts.revokedAt ?? Date.now();
    const next = { ...token, revokedAt, revokedReason: opts.revokedReason, updatedAt: revokedAt };
    this.db.harnessChannelActionTokens.set(key, cloneJson(next));
    return cloneJson(next);
  }

  async saveChannelActionReceipt(record: ChannelActionReceipt): Promise<void> {
    const receipt = { ...record, harnessName: resolveHarnessName(record.harnessName, this.harnessName) };
    assertValidChannelActionReceiptState(receipt);
    const existing = this.findChannelActionReceiptById(receipt.id);
    if (existing) {
      if (channelActionReceiptsEqual(existing, receipt)) return;
      assertLegalChannelActionReceiptUpdate(existing, receipt);
    }
    const existingByToken = this.findChannelActionReceiptByTokenId({
      harnessName: receipt.harnessName,
      channelId: receipt.channelId,
      actionTokenId: receipt.actionTokenId,
    });
    if (existingByToken && existingByToken.id !== receipt.id) {
      throw new HarnessStorageChannelActionReceiptTransitionError(
        receipt.id,
        existingByToken.status,
        receipt.status,
        'action token is already owned by another receipt',
      );
    }
    this.db.harnessChannelActionReceipts.set(
      channelActionReceiptKey(receipt.harnessName, receipt.id),
      cloneJson(receipt),
    );
  }

  async createOrLoadChannelActionReceipt(
    record: ChannelActionReceipt,
    opts?: { initialClaim?: { claimId: string; now: number; claimTtlMs: number } },
  ): Promise<CreateOrLoadChannelActionReceiptResult> {
    const namespace = resolveHarnessName(record.harnessName, this.harnessName);
    const incoming: ChannelActionReceipt = { ...record, harnessName: namespace };
    assertValidChannelActionReceiptState(incoming);
    const existing = this.findChannelActionReceiptByTokenId({
      harnessName: namespace,
      channelId: incoming.channelId,
      actionTokenId: incoming.actionTokenId,
    });
    if (existing) {
      const conflict = !channelActionReceiptsEquivalentForCreate(existing, incoming);
      let claimed = false;
      let receipt = existing;
      if (!conflict && opts?.initialClaim && isChannelActionReceiptClaimable(existing, opts.initialClaim.now)) {
        receipt = {
          ...existing,
          claimId: opts.initialClaim.claimId,
          claimExpiresAt: opts.initialClaim.now + opts.initialClaim.claimTtlMs,
          updatedAt: opts.initialClaim.now,
        };
        this.db.harnessChannelActionReceipts.set(channelActionReceiptKey(namespace, receipt.id), cloneJson(receipt));
        claimed = true;
      }
      return { receipt: cloneJson(receipt), duplicate: true, conflict, claimed };
    }
    const existingById = this.findChannelActionReceiptById(incoming.id);
    if (existingById) {
      throw new HarnessStorageChannelActionReceiptTransitionError(
        incoming.id,
        existingById.status,
        incoming.status,
        'id is already owned by another action receipt',
      );
    }
    const receipt =
      opts?.initialClaim === undefined
        ? incoming
        : {
            ...incoming,
            claimId: opts.initialClaim.claimId,
            claimExpiresAt: opts.initialClaim.now + opts.initialClaim.claimTtlMs,
            updatedAt: opts.initialClaim.now,
          };
    this.db.harnessChannelActionReceipts.set(channelActionReceiptKey(namespace, receipt.id), cloneJson(receipt));
    return {
      receipt: cloneJson(receipt),
      duplicate: false,
      conflict: false,
      claimed: opts?.initialClaim !== undefined,
    };
  }

  async loadChannelActionReceiptByActionId(opts: {
    harnessName: string;
    channelId: string;
    actionId: string;
  }): Promise<ChannelActionReceipt | null> {
    const namespace = resolveHarnessName(opts.harnessName, this.harnessName);
    const receipt = Array.from(this.db.harnessChannelActionReceipts.values())
      .filter(
        item => item.harnessName === namespace && item.channelId === opts.channelId && item.actionId === opts.actionId,
      )
      .sort((a, b) => a.createdAt - b.createdAt)[0];
    return receipt ? cloneJson(receipt) : null;
  }

  async loadChannelActionReceiptByTokenId(opts: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
  }): Promise<ChannelActionReceipt | null> {
    const receipt = this.findChannelActionReceiptByTokenId({
      ...opts,
      harnessName: resolveHarnessName(opts.harnessName, this.harnessName),
    });
    return receipt ? cloneJson(receipt) : null;
  }

  async claimChannelActionReceipts({
    harnessName,
    channelId,
    statuses,
    claimId,
    limit,
    now,
    claimTtlMs,
  }: {
    harnessName: string;
    channelId?: string;
    statuses: Array<'received' | 'accepted' | 'failed'>;
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<ChannelActionReceipt[]> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const claimed: ChannelActionReceipt[] = [];
    const sorted = Array.from(this.db.harnessChannelActionReceipts.values()).sort((a, b) => a.createdAt - b.createdAt);
    for (const receipt of sorted) {
      if (claimed.length >= limit) break;
      if (receipt.harnessName !== namespace) continue;
      if (channelId !== undefined && receipt.channelId !== channelId) continue;
      if (!statuses.includes(receipt.status as 'received' | 'accepted' | 'failed')) continue;
      if (!isChannelActionReceiptClaimable(receipt, now)) continue;
      const next = { ...receipt, claimId, claimExpiresAt: now + claimTtlMs, updatedAt: now };
      this.db.harnessChannelActionReceipts.set(channelActionReceiptKey(namespace, next.id), cloneJson(next));
      claimed.push(cloneJson(next));
    }
    return claimed;
  }

  async renewChannelActionReceiptClaim({
    receiptId,
    claimId,
    now,
    claimTtlMs,
  }: {
    receiptId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }> {
    const current = this.findChannelActionReceiptById(receiptId);
    if (
      !current ||
      current.claimId !== claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= now ||
      isTerminalChannelActionReceiptStatus(current.status)
    ) {
      throw new HarnessStorageChannelActionClaimConflictError(receiptId, claimId);
    }
    const claimExpiresAt = now + claimTtlMs;
    const next = { ...current, claimExpiresAt, updatedAt: now };
    this.db.harnessChannelActionReceipts.set(channelActionReceiptKey(next.harnessName, next.id), cloneJson(next));
    return { claimExpiresAt, storageNow: now };
  }

  async updateChannelActionReceipt(record: ChannelActionReceipt, opts: { claimId: string }): Promise<void> {
    const namespace = resolveHarnessName(record.harnessName, this.harnessName);
    const current = this.db.harnessChannelActionReceipts.get(channelActionReceiptKey(namespace, record.id));
    const storageNow = Date.now();
    if (
      !current ||
      current.claimId !== opts.claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= storageNow ||
      isTerminalChannelActionReceiptStatus(current.status)
    ) {
      throw new HarnessStorageChannelActionClaimConflictError(record.id, opts.claimId);
    }
    // Claim-field contract (mirrors updateChannelInboxItem): a KEEP-claim write
    // (record still carries `claimId`) must NOT let the caller's possibly-stale
    // `claimExpiresAt` roll back a concurrent `renewChannelActionReceiptClaim`
    // heartbeat — the live expiry is storage-owned, so preserve
    // `current.claimId`/`claimExpiresAt`. A RELEASE write (record clears `claimId`)
    // is the explicit "drop the claim" signal and is honored as-is.
    const next =
      record.claimId === undefined
        ? { ...record, harnessName: namespace }
        : { ...record, harnessName: namespace, claimId: current.claimId, claimExpiresAt: current.claimExpiresAt };
    assertLegalChannelActionReceiptUpdate(current, next);
    this.db.harnessChannelActionReceipts.set(channelActionReceiptKey(namespace, record.id), cloneJson(next));
  }

  // -------------------------------------------------------------------------
  // Channel outbox ledger
  // -------------------------------------------------------------------------

  async enqueueChannelOutbox(record: ChannelOutboxItem): Promise<{
    outboxItemId: string;
    duplicate: boolean;
    conflict: boolean;
  }> {
    const item = { ...record, harnessName: resolveHarnessName(record.harnessName, this.harnessName) };
    assertValidChannelOutboxState(item);
    const existing = this.findChannelOutboxByIdempotencyKey({
      harnessName: item.harnessName,
      bindingId: item.bindingId,
      idempotencyKey: item.idempotencyKey,
    });
    if (existing) {
      return {
        outboxItemId: existing.id,
        duplicate: true,
        conflict: !channelOutboxItemsEquivalentForEnqueue(existing, item),
      };
    }
    const existingById = this.findChannelOutboxById(item.id);
    if (existingById) {
      throw new HarnessStorageChannelOutboxTransitionError(
        item.id,
        existingById.status,
        item.status,
        'id is already owned by another outbox item',
      );
    }
    this.db.harnessChannelOutbox.set(channelOutboxKey(item.harnessName, item.id), cloneJson(item));
    return { outboxItemId: item.id, duplicate: false, conflict: false };
  }

  async claimChannelOutbox({
    harnessName,
    channelId,
    claimId,
    limit,
    now,
    claimTtlMs,
  }: {
    harnessName: string;
    channelId?: string;
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<ChannelOutboxItem[]> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const claimed: ChannelOutboxItem[] = [];
    const sorted = Array.from(this.db.harnessChannelOutbox.values()).sort(compareChannelOutboxOrder);
    for (const item of sorted) {
      if (claimed.length >= limit) break;
      if (item.harnessName !== namespace) continue;
      if (channelId !== undefined && item.channelId !== channelId) continue;
      if (!isChannelOutboxClaimable(item, now)) continue;
      if (this.hasEarlierUnsettledChannelOutboxItem(item)) continue;
      const next: ChannelOutboxItem = {
        ...item,
        status: 'claimed',
        attempts: item.attempts + 1,
        claimId,
        claimExpiresAt: now + claimTtlMs,
        nextAttemptAt: undefined,
        failedAt: undefined,
        lastError: undefined,
        updatedAt: now,
      };
      this.db.harnessChannelOutbox.set(channelOutboxKey(namespace, next.id), cloneJson(next));
      claimed.push(cloneJson(next));
    }
    return claimed;
  }

  async renewChannelOutboxClaim({
    outboxItemId,
    claimId,
    now,
    claimTtlMs,
  }: {
    outboxItemId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }> {
    const current = this.findChannelOutboxById(outboxItemId);
    if (
      !current ||
      current.status !== 'claimed' ||
      current.claimId !== claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= now
    ) {
      throw new HarnessStorageChannelOutboxClaimConflictError(outboxItemId, claimId);
    }
    const claimExpiresAt = now + claimTtlMs;
    const next = { ...current, claimExpiresAt, updatedAt: now };
    this.db.harnessChannelOutbox.set(channelOutboxKey(next.harnessName, next.id), cloneJson(next));
    return { claimExpiresAt, storageNow: now };
  }

  async markChannelOutboxSent({
    outboxItemId,
    claimId,
    sentAt,
    providerMessageId,
    providerReceipt,
  }: {
    outboxItemId: string;
    claimId: string;
    sentAt?: number;
    providerMessageId?: string;
    providerReceipt?: ChannelProviderDeliveryReceipt;
  }): Promise<void> {
    const current = this.claimedChannelOutboxItem(outboxItemId, claimId);
    const storageNow = Date.now();
    const next: ChannelOutboxItem = {
      ...current,
      status: 'sent',
      claimId: undefined,
      claimExpiresAt: undefined,
      nextAttemptAt: undefined,
      failedAt: undefined,
      deadAt: undefined,
      lastError: undefined,
      sentAt: sentAt ?? storageNow,
      providerMessageId,
      providerReceipt,
      updatedAt: storageNow,
    };
    assertLegalChannelOutboxUpdate(current, next);
    this.db.harnessChannelOutbox.set(channelOutboxKey(next.harnessName, next.id), cloneJson(next));
  }

  async markChannelOutboxFailed({
    outboxItemId,
    claimId,
    retryAt,
    dead,
    error,
  }: {
    outboxItemId: string;
    claimId: string;
    retryAt?: number;
    dead?: boolean;
    error: NonNullable<ChannelOutboxItem['lastError']>;
  }): Promise<void> {
    const current = this.claimedChannelOutboxItem(outboxItemId, claimId);
    const storageNow = Date.now();
    const terminal = dead === true || error.retryable === false;
    const next: ChannelOutboxItem = {
      ...current,
      status: terminal ? 'dead' : 'failed',
      claimId: undefined,
      claimExpiresAt: undefined,
      nextAttemptAt: terminal ? undefined : retryAt,
      failedAt: terminal ? current.failedAt : storageNow,
      deadAt: terminal ? storageNow : undefined,
      lastError: {
        ...error,
        retryable: terminal ? false : (error.retryable ?? true),
      },
      updatedAt: storageNow,
    };
    assertLegalChannelOutboxUpdate(current, next);
    this.db.harnessChannelOutbox.set(channelOutboxKey(next.harnessName, next.id), cloneJson(next));
  }

  async listChannelDiagnosticsRows(opts: ListChannelDiagnosticsInput): Promise<ChannelDiagnosticsRows> {
    const namespace = resolveHarnessName(opts.harnessName, this.harnessName);
    const limit = opts.limit ?? 50;
    if (limit <= 0 || opts.sessionIds.length === 0) {
      return { inbox: [], actionTokens: [], actionReceipts: [], outbox: [] };
    }
    const sessionIds = new Set(opts.sessionIds);
    const byRecentUpdate = <T extends { id?: string; actionTokenId?: string; updatedAt: number }>(a: T, b: T) =>
      b.updatedAt - a.updatedAt || String(b.id ?? b.actionTokenId).localeCompare(String(a.id ?? a.actionTokenId));

    const inbox = Array.from(this.db.harnessChannelInbox.values())
      .filter(
        item =>
          item.harnessName === namespace &&
          item.resourceId === opts.resourceId &&
          item.sessionId !== undefined &&
          sessionIds.has(item.sessionId),
      )
      .sort(byRecentUpdate)
      .slice(0, limit)
      .map(item => cloneJson(item));
    const actionTokens = Array.from(this.db.harnessChannelActionTokens.values())
      .filter(
        token =>
          token.harnessName === namespace &&
          token.resourceId === opts.resourceId &&
          sessionIds.has(token.owningSessionId),
      )
      .sort(byRecentUpdate)
      .slice(0, limit)
      .map(token => cloneJson(token));
    const actionReceipts = Array.from(this.db.harnessChannelActionReceipts.values())
      .filter(
        receipt =>
          receipt.harnessName === namespace &&
          receipt.resourceId === opts.resourceId &&
          sessionIds.has(receipt.owningSessionId),
      )
      .sort(byRecentUpdate)
      .slice(0, limit)
      .map(receipt => cloneJson(receipt));
    const outbox = Array.from(this.db.harnessChannelOutbox.values())
      .filter(
        item =>
          item.harnessName === namespace &&
          item.resourceId === opts.resourceId &&
          ((item.sessionId !== undefined && sessionIds.has(item.sessionId)) ||
            (item.owningSessionId !== undefined && sessionIds.has(item.owningSessionId))),
      )
      .sort(byRecentUpdate)
      .slice(0, limit)
      .map(item => cloneJson(item));

    return { inbox, actionTokens, actionReceipts, outbox };
  }

  // -------------------------------------------------------------------------
  // Wakeup ledger
  // -------------------------------------------------------------------------

  async createOrLoadHarnessWakeupItem(
    record: HarnessWakeupItem,
    opts?: { initialClaim?: { claimId: string; now: number; claimTtlMs: number } },
  ): Promise<CreateOrLoadHarnessWakeupItemResult> {
    const namespace = resolveHarnessName(record.harnessName, this.harnessName);
    const incoming: HarnessWakeupItem = { ...record, harnessName: namespace };
    if (incoming.status !== 'due') {
      throw new HarnessStorageWakeupTransitionError(
        incoming.id,
        undefined,
        incoming.status,
        'new wakeups must start as due',
      );
    }
    assertValidHarnessWakeupState(incoming);
    const existing = this.findHarnessWakeupByIdempotencyKey({
      harnessName: namespace,
      idempotencyKey: incoming.idempotencyKey,
    });
    if (existing) {
      const conflict = !harnessWakeupItemsEquivalentForCreate(existing, incoming);
      let claimed = false;
      let item = existing;
      if (!conflict && opts?.initialClaim && isHarnessWakeupClaimable(existing, opts.initialClaim.now)) {
        item = claimHarnessWakeupItem(
          existing,
          opts.initialClaim.claimId,
          opts.initialClaim.now,
          opts.initialClaim.claimTtlMs,
        );
        this.db.harnessWakeupItems.set(harnessWakeupKey(namespace, item.id), cloneJson(item));
        claimed = true;
      }
      return { item: cloneJson(item), duplicate: true, conflict, claimed };
    }
    const existingBySourceFire = this.findHarnessWakeupBySourceFire({
      harnessName: namespace,
      source: incoming.source,
      sourceId: incoming.sourceId,
      fireId: incoming.fireId,
    });
    if (existingBySourceFire) {
      return {
        item: cloneJson(existingBySourceFire),
        duplicate: true,
        conflict: !harnessWakeupItemsEquivalentForCreate(existingBySourceFire, incoming),
        claimed: false,
      };
    }
    const existingById = this.findHarnessWakeupById(incoming.id);
    if (existingById) {
      throw new HarnessStorageWakeupTransitionError(
        incoming.id,
        existingById.status,
        incoming.status,
        'id is already owned by another wakeup item',
      );
    }
    const canInitialClaim =
      opts?.initialClaim !== undefined && isHarnessWakeupClaimable(incoming, opts.initialClaim.now);
    const item = canInitialClaim
      ? claimHarnessWakeupItem(
          incoming,
          opts.initialClaim!.claimId,
          opts.initialClaim!.now,
          opts.initialClaim!.claimTtlMs,
        )
      : incoming;
    assertValidHarnessWakeupState(item);
    this.db.harnessWakeupItems.set(harnessWakeupKey(namespace, item.id), cloneJson(item));
    return { item: cloneJson(item), duplicate: false, conflict: false, claimed: canInitialClaim };
  }

  async loadHarnessWakeupItemByIdempotencyKey(opts: {
    harnessName: string;
    idempotencyKey: string;
  }): Promise<HarnessWakeupItem | null> {
    const item = this.findHarnessWakeupByIdempotencyKey({
      harnessName: resolveHarnessName(opts.harnessName, this.harnessName),
      idempotencyKey: opts.idempotencyKey,
    });
    return item ? cloneJson(item) : null;
  }

  async loadHarnessWakeupItemBySourceFire(opts: {
    harnessName: string;
    source: HarnessWakeupItem['source'];
    sourceId: string;
    fireId: string;
  }): Promise<HarnessWakeupItem | null> {
    const item = this.findHarnessWakeupBySourceFire({
      ...opts,
      harnessName: resolveHarnessName(opts.harnessName, this.harnessName),
    });
    return item ? cloneJson(item) : null;
  }

  async claimHarnessWakeupItems({
    harnessName,
    source,
    statuses,
    claimId,
    limit,
    now,
    claimTtlMs,
  }: {
    harnessName: string;
    source?: HarnessWakeupItem['source'];
    statuses: HarnessWakeupClaimStatus[];
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<HarnessWakeupItem[]> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const claimed: HarnessWakeupItem[] = [];
    const sorted = Array.from(this.db.harnessWakeupItems.values()).sort(compareHarnessWakeupOrder);
    for (const item of sorted) {
      if (claimed.length >= limit) break;
      if (item.harnessName !== namespace) continue;
      if (source !== undefined && item.source !== source) continue;
      if (!statuses.includes(item.status as HarnessWakeupClaimStatus)) continue;
      if (!isHarnessWakeupClaimable(item, now)) continue;
      const next = claimHarnessWakeupItem(item, claimId, now, claimTtlMs);
      this.db.harnessWakeupItems.set(harnessWakeupKey(namespace, next.id), cloneJson(next));
      claimed.push(cloneJson(next));
    }
    return claimed;
  }

  async renewHarnessWakeupClaim({
    wakeupItemId,
    claimId,
    now,
    claimTtlMs,
  }: {
    wakeupItemId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }> {
    const current = this.findHarnessWakeupById(wakeupItemId);
    if (
      !current ||
      current.claimId !== claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= now ||
      current.status !== 'claimed'
    ) {
      throw new HarnessStorageWakeupClaimConflictError(wakeupItemId, claimId);
    }
    const claimExpiresAt = now + claimTtlMs;
    const next = { ...current, claimExpiresAt, updatedAt: now };
    this.db.harnessWakeupItems.set(harnessWakeupKey(next.harnessName, next.id), cloneJson(next));
    return { claimExpiresAt, storageNow: now };
  }

  async updateHarnessWakeupItem(record: HarnessWakeupItem, opts: { claimId: string }): Promise<void> {
    const namespace = resolveHarnessName(record.harnessName, this.harnessName);
    const current = this.db.harnessWakeupItems.get(harnessWakeupKey(namespace, record.id));
    const storageNow = Date.now();
    if (
      !current ||
      current.claimId !== opts.claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= storageNow ||
      current.status !== 'claimed'
    ) {
      throw new HarnessStorageWakeupClaimConflictError(record.id, opts.claimId);
    }
    const next = { ...record, harnessName: namespace };
    assertLegalHarnessWakeupUpdate(current, next);
    this.db.harnessWakeupItems.set(harnessWakeupKey(namespace, record.id), cloneJson(next));
  }

  private findChannelInboxByIdempotencyKey({
    harnessName,
    channelId,
    idempotencyKey,
  }: {
    harnessName: string;
    channelId: string;
    idempotencyKey: string;
  }): ChannelInboxItem | null {
    for (const item of this.db.harnessChannelInbox.values()) {
      if (item.harnessName === harnessName && item.channelId === channelId && item.idempotencyKey === idempotencyKey) {
        return cloneJson(item);
      }
    }
    return null;
  }

  private findProviderCallbackBindingById(bindingId: string): HarnessProviderCallbackBinding | null {
    const binding = this.db.harnessProviderCallbackBindings.get(bindingId);
    return binding ? cloneJson(binding) : null;
  }

  private findActiveProviderCallbackBindingBySelector({
    providerId,
    selectorKind,
    selectorValue,
  }: {
    providerId: string;
    selectorKind: ProviderCallbackSelectorKind;
    selectorValue: string;
  }): HarnessProviderCallbackBinding | null {
    for (const binding of this.db.harnessProviderCallbackBindings.values()) {
      if (
        binding.status === 'active' &&
        binding.providerId === providerId &&
        binding.selectorKind === selectorKind &&
        binding.selectorValue === selectorValue
      ) {
        return cloneJson(binding);
      }
    }
    return null;
  }

  private findChannelActionTokenById({
    harnessName,
    channelId,
    actionTokenId,
  }: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
  }): ChannelActionToken | null {
    const token = this.db.harnessChannelActionTokens.get(channelActionTokenKey(harnessName, channelId, actionTokenId));
    return token ? cloneJson(token) : null;
  }

  private findChannelActionTokenByTransportHash({
    harnessName,
    channelId,
    transportHash,
  }: {
    harnessName: string;
    channelId: string;
    transportHash: string;
  }): ChannelActionToken | null {
    for (const token of this.db.harnessChannelActionTokens.values()) {
      if (token.harnessName === harnessName && token.channelId === channelId && token.transportHash === transportHash) {
        return cloneJson(token);
      }
    }
    return null;
  }

  private findChannelActionTokenForPendingItem(input: {
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
  }): ChannelActionToken | null {
    for (const token of this.db.harnessChannelActionTokens.values()) {
      if (
        token.harnessName === input.harnessName &&
        token.channelId === input.channelId &&
        token.bindingId === input.bindingId &&
        token.bindingGeneration === input.bindingGeneration &&
        token.owningSessionId === input.owningSessionId &&
        token.itemId === input.itemId &&
        token.kind === input.kind &&
        token.runId === input.runId &&
        token.pendingRequestedAt === input.pendingRequestedAt &&
        token.metadataHash === input.metadataHash
      ) {
        return cloneJson(token);
      }
    }
    return null;
  }

  private findChannelActionReceiptById(receiptId: string): ChannelActionReceipt | null {
    for (const receipt of this.db.harnessChannelActionReceipts.values()) {
      if (receipt.id === receiptId) return cloneJson(receipt);
    }
    return null;
  }

  private findChannelActionReceiptByTokenId({
    harnessName,
    channelId,
    actionTokenId,
  }: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
  }): ChannelActionReceipt | null {
    for (const receipt of this.db.harnessChannelActionReceipts.values()) {
      if (
        receipt.harnessName === harnessName &&
        receipt.channelId === channelId &&
        receipt.actionTokenId === actionTokenId
      ) {
        return cloneJson(receipt);
      }
    }
    return null;
  }

  private findChannelInboxById(inboxItemId: string): ChannelInboxItem | null {
    for (const item of this.db.harnessChannelInbox.values()) {
      if (item.id === inboxItemId) return cloneJson(item);
    }
    return null;
  }

  private findChannelOutboxById(outboxItemId: string): ChannelOutboxItem | null {
    for (const item of this.db.harnessChannelOutbox.values()) {
      if (item.id === outboxItemId) return cloneJson(item);
    }
    return null;
  }

  private findChannelOutboxByIdempotencyKey({
    harnessName,
    bindingId,
    idempotencyKey,
  }: {
    harnessName: string;
    bindingId: string;
    idempotencyKey: string;
  }): ChannelOutboxItem | null {
    for (const item of this.db.harnessChannelOutbox.values()) {
      if (item.harnessName === harnessName && item.bindingId === bindingId && item.idempotencyKey === idempotencyKey) {
        return cloneJson(item);
      }
    }
    return null;
  }

  private hasEarlierUnsettledChannelOutboxItem(candidate: ChannelOutboxItem): boolean {
    for (const item of this.db.harnessChannelOutbox.values()) {
      if (item.id === candidate.id) continue;
      if (item.harnessName !== candidate.harnessName || item.bindingId !== candidate.bindingId) continue;
      if (isTerminalChannelOutboxStatus(item.status)) continue;
      if (compareChannelOutboxOrder(item, candidate) < 0) return true;
    }
    return false;
  }

  private claimedChannelOutboxItem(outboxItemId: string, claimId: string): ChannelOutboxItem {
    const current = this.findChannelOutboxById(outboxItemId);
    const storageNow = Date.now();
    if (
      !current ||
      current.status !== 'claimed' ||
      current.claimId !== claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= storageNow
    ) {
      throw new HarnessStorageChannelOutboxClaimConflictError(outboxItemId, claimId);
    }
    return current;
  }

  private findHarnessWakeupByIdempotencyKey({
    harnessName,
    idempotencyKey,
  }: {
    harnessName: string;
    idempotencyKey: string;
  }): HarnessWakeupItem | null {
    for (const item of this.db.harnessWakeupItems.values()) {
      if (item.harnessName === harnessName && item.idempotencyKey === idempotencyKey) return cloneJson(item);
    }
    return null;
  }

  private findHarnessWakeupBySourceFire({
    harnessName,
    source,
    sourceId,
    fireId,
  }: {
    harnessName: string;
    source: HarnessWakeupItem['source'];
    sourceId: string;
    fireId: string;
  }): HarnessWakeupItem | null {
    for (const item of this.db.harnessWakeupItems.values()) {
      if (
        item.harnessName === harnessName &&
        item.source === source &&
        item.sourceId === sourceId &&
        item.fireId === fireId
      ) {
        return cloneJson(item);
      }
    }
    return null;
  }

  private findHarnessWakeupById(wakeupItemId: string): HarnessWakeupItem | null {
    for (const item of this.db.harnessWakeupItems.values()) {
      if (item.id === wakeupItemId) return cloneJson(item);
    }
    return null;
  }

  private findTombstone(
    predicate: (tombstone: OperationAdmissionTombstone) => boolean,
  ): OperationAdmissionTombstone | null {
    for (const tombstone of this.db.harnessOperationTombstones.values()) {
      if (predicate(tombstone)) return tombstone;
    }
    return null;
  }

  private async withCompactionLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.compactionLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => {
      release = resolve;
    });
    const queued = previous.catch(() => undefined).then(() => current);
    this.compactionLocks.set(key, queued);
    await previous.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
      if (this.compactionLocks.get(key) === queued) {
        this.compactionLocks.delete(key);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Plan tasks (§5.1k) — durable, arbitrary-depth, model-authored task tree.
  // All mutators are session-owner-fenced (§5.8): the SESSION is the serialized
  // writer, so writes fence on the session's lease + version, not bare per-row
  // OCC. The per-row `version` is the field-write OCC token inside that fence.
  // -------------------------------------------------------------------------

  /**
   * Verify the session-owner fence: the owning SessionRecord must exist, still be
   * held by `ownerId` under an unexpired lease, and have `version` matching
   * `ifSessionVersion`. Returns the resolved namespace.
   */
  private assertPlanTaskFence(fence: PlanTaskSessionFence): string {
    const namespace = resolveHarnessName(fence.harnessName, this.harnessName);
    const session = this.db.harnessSessions.get(sessionKey(namespace, fence.sessionId));
    if (!session) throw new HarnessStorageSessionNotFoundError(fence.sessionId);
    // Unlike saveSession's reacquisition-friendly fence, a plan-task mutation is
    // only authoritative while this exact owner still holds a live lease. An
    // expired or released lease is not permission for the stale session object
    // to keep mutating its durable plan tree.
    assertUnexpiredLeaseHolder(session, fence.ownerId);
    if (session.version !== fence.ifSessionVersion) {
      throw new HarnessStorageVersionConflictError(fence.sessionId, fence.ifSessionVersion, session.version);
    }
    return namespace;
  }

  async createPlanTask({ fence, task }: CreatePlanTaskInput): Promise<HarnessPlanTask> {
    const namespace = this.assertPlanTaskFence(fence);
    assertPlanTaskCreateIdempotencyInput(task);
    // Idempotent retry: an existing task with the same idempotencyKey in this
    // session returns unchanged (§5.1k).
    if (task.idempotencyKey !== undefined) {
      for (const existing of this.db.harnessPlanTasks.values()) {
        if (
          existing.harnessName === namespace &&
          existing.sessionId === fence.sessionId &&
          existing.idempotencyKey === task.idempotencyKey
        ) {
          return clonePlanTask(existing);
        }
      }
    }
    const now = Date.now();
    const stored: HarnessPlanTask = normalizePlanTask({
      ...task,
      harnessName: namespace,
      sessionId: fence.sessionId,
      createdAt: task.createdAt ?? now,
      updatedAt: now,
      version: 1,
    });
    this.db.harnessPlanTasks.set(planTaskKey(namespace, fence.sessionId, stored.taskId), clonePlanTask(stored));
    return clonePlanTask(stored);
  }

  async updatePlanTask({ fence, taskId, ifVersion, patch }: UpdatePlanTaskInput): Promise<UpdatePlanTaskResult> {
    const namespace = this.assertPlanTaskFence(fence);
    const key = planTaskKey(namespace, fence.sessionId, taskId);
    const existing = this.db.harnessPlanTasks.get(key);
    if (!existing) throw new HarnessStoragePlanTaskNotFoundError(fence.sessionId, taskId);
    if (existing.version !== ifVersion) {
      throw new HarnessStoragePlanTaskVersionConflictError(taskId, ifVersion, existing.version);
    }
    const next = applyPlanTaskPatch(existing, patch, ifVersion + 1);
    this.db.harnessPlanTasks.set(key, clonePlanTask(next));
    return { version: next.version };
  }

  async deletePlanTaskSubtree({ fence, rootTaskId }: DeletePlanTaskSubtreeInput): Promise<DeletePlanTaskSubtreeResult> {
    const namespace = this.assertPlanTaskFence(fence);
    const ids = this.collectPlanTaskSubtreeIds(namespace, fence.sessionId, rootTaskId);
    let deletedCount = 0;
    for (const id of ids) {
      if (this.db.harnessPlanTasks.delete(planTaskKey(namespace, fence.sessionId, id))) deletedCount++;
    }
    return { deletedCount };
  }

  async mutatePlanTasksForSession({ fence, ops }: MutatePlanTasksForSessionInput): Promise<void> {
    const namespace = this.assertPlanTaskFence(fence);
    // Transaction-shaped: validate + stage every op against a working copy, then
    // commit all-or-nothing. A single rejected op throws before any row changes.
    const working = new Map<string, HarnessPlanTask>();
    for (const [key, value] of this.db.harnessPlanTasks) {
      if (value.harnessName === namespace && value.sessionId === fence.sessionId) {
        working.set(value.taskId, clonePlanTask(value));
      }
      void key;
    }
    const now = Date.now();
    for (const op of ops) {
      this.stagePlanTaskOp(working, namespace, fence.sessionId, op, now);
    }
    // Commit: replace this session's rows with the working set.
    for (const value of [...this.db.harnessPlanTasks.values()]) {
      if (value.harnessName === namespace && value.sessionId === fence.sessionId) {
        this.db.harnessPlanTasks.delete(planTaskKey(namespace, fence.sessionId, value.taskId));
      }
    }
    for (const task of working.values()) {
      this.db.harnessPlanTasks.set(planTaskKey(namespace, fence.sessionId, task.taskId), clonePlanTask(task));
    }
  }

  private stagePlanTaskOp(
    working: Map<string, HarnessPlanTask>,
    namespace: string,
    sessionId: string,
    op: PlanTaskMutationOp,
    now: number,
  ): void {
    if (op.kind === 'create') {
      assertPlanTaskCreateIdempotencyInput(op.task);
      if (op.task.idempotencyKey !== undefined) {
        for (const existing of working.values()) {
          if (existing.idempotencyKey === op.task.idempotencyKey) return; // idempotent no-op
        }
      }
      const stored = normalizePlanTask({
        ...op.task,
        harnessName: namespace,
        sessionId,
        createdAt: op.task.createdAt ?? now,
        updatedAt: now,
        version: 1,
      });
      working.set(stored.taskId, stored);
      return;
    }
    if (op.kind === 'update') {
      const existing = working.get(op.taskId);
      if (!existing) throw new HarnessStoragePlanTaskNotFoundError(sessionId, op.taskId);
      if (existing.version !== op.ifVersion) {
        throw new HarnessStoragePlanTaskVersionConflictError(op.taskId, op.ifVersion, existing.version);
      }
      working.set(op.taskId, applyPlanTaskPatch(existing, op.patch, op.ifVersion + 1));
      return;
    }
    // deleteSubtree
    const ids = collectSubtreeIdsFromMap(working, op.rootTaskId);
    for (const id of ids) working.delete(id);
  }

  /**
   * BFS the subtree rooted at `rootTaskId` (inclusive) within this session,
   * walking parentTaskId. A visited set defensively guards a parentTaskId cycle
   * even though full cycle PREVENTION is TM-4.
   */
  private collectPlanTaskSubtreeIds(namespace: string, sessionId: string, rootTaskId: string): string[] {
    const childrenByParent = new Map<string, string[]>();
    let rootExists = false;
    for (const task of this.db.harnessPlanTasks.values()) {
      if (task.harnessName !== namespace || task.sessionId !== sessionId) continue;
      if (task.taskId === rootTaskId) rootExists = true;
      if (task.parentTaskId !== undefined) {
        const siblings = childrenByParent.get(task.parentTaskId) ?? [];
        siblings.push(task.taskId);
        childrenByParent.set(task.parentTaskId, siblings);
      }
    }
    if (!rootExists) return [];
    const result: string[] = [];
    const queue = [rootTaskId];
    const visited = new Set<string>([rootTaskId]);
    while (queue.length > 0) {
      const id = queue.shift()!;
      result.push(id);
      for (const child of childrenByParent.get(id) ?? []) {
        if (visited.has(child)) continue;
        visited.add(child);
        queue.push(child);
      }
    }
    return result;
  }

  async listPlanTasks({ harnessName, sessionId, limit, cursor }: ListPlanTasksInput): Promise<ListPlanTasksResult> {
    if (limit <= 0) return { tasks: [] };
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const matched: HarnessPlanTask[] = [];
    for (const task of this.db.harnessPlanTasks.values()) {
      if (task.harnessName !== namespace || task.sessionId !== sessionId) continue;
      matched.push(task);
    }
    matched.sort(comparePlanTaskOrder);
    // Keyset cursor on the (parentTaskId, order, taskId) sort key — identical token
    // + continuation semantics to PG/LibSQL (a deleted cursor row still continues
    // from its sort position instead of silently restarting from the head).
    const after =
      cursor === undefined ? matched : matched.filter(t => planTaskAfterCursor(t, decodePlanTaskCursor(cursor)));
    const page = after.slice(0, limit);
    const result: ListPlanTasksResult = { tasks: page.map(clonePlanTask) };
    if (after.length > limit && page.length > 0) {
      result.cursor = encodePlanTaskCursor(page[page.length - 1]!);
    }
    return result;
  }

  async loadPlanTaskSubtree({
    harnessName,
    sessionId,
    rootTaskId,
    depth,
    status,
    limit,
  }: LoadPlanTaskSubtreeInput): Promise<LoadPlanTaskSubtreeResult> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const tasks: HarnessPlanTask[] = [];
    for (const task of this.db.harnessPlanTasks.values()) {
      if (task.harnessName !== namespace || task.sessionId !== sessionId) continue;
      tasks.push(task);
    }
    // Shared walk (§5.1k) keeps depth/status/limit semantics identical across adapters.
    return walkPlanTaskSubtree(tasks, { rootTaskId, depth, status, limit });
  }

  async countPlanTasksByStatus({ harnessName, sessionId }: CountPlanTasksByStatusInput): Promise<PlanTaskCountSummary> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const ids = new Set<string>();
    const session: HarnessPlanTask[] = [];
    for (const task of this.db.harnessPlanTasks.values()) {
      if (task.harnessName !== namespace || task.sessionId !== sessionId) continue;
      ids.add(task.taskId);
      session.push(task);
    }
    const byStatus: Partial<Record<HarnessPlanTaskStatus, number>> = {};
    let rootCount = 0;
    for (const task of session) {
      byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
      // A root is a node with no parent OR whose parent is not in the set (orphan),
      // matching `computePlanTaskSummary`'s `indexPlanTasks` root rule exactly.
      if (task.parentTaskId === undefined || !ids.has(task.parentTaskId)) rootCount += 1;
    }
    return { total: session.length, byStatus, rootCount };
  }

  // -------------------------------------------------------------------------
  // Run summaries (span-summary O1/O2)
  // -------------------------------------------------------------------------

  async saveRunSummary({ summary }: SaveRunSummaryInput): Promise<HarnessRunSummary> {
    const namespace = resolveHarnessName(summary.harnessName, this.harnessName);
    const key = `${namespace}::${summary.runId}`;
    const existing = this.db.harnessRunSummaries.get(key);
    // Idempotent: first terminal wins; a later write is a no-op.
    if (existing) return cloneJson(existing);
    const stored: HarnessRunSummary = cloneJson({ ...summary, harnessName: namespace });
    this.db.harnessRunSummaries.set(key, stored);
    return cloneJson(stored);
  }

  async loadRunSummary({ harnessName, runId }: LoadRunSummaryInput): Promise<HarnessRunSummary | null> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const found = this.db.harnessRunSummaries.get(`${namespace}::${runId}`);
    return found ? cloneJson(found) : null;
  }

  async listRunSummaries({
    harnessName,
    sessionId,
    resourceId,
    limit,
    beforeCompletedAt,
    beforeRunId,
  }: ListRunSummariesInput): Promise<ListRunSummariesResult> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    // Composite keyset: a row is "before" the cursor when its completedAt is
    // strictly less, OR equal with a strictly-lesser runId (matches the
    // (completedAt DESC, runId DESC) order) — so same-timestamp rows at a page
    // boundary are neither skipped nor duplicated.
    const beforeCursor = (s: HarnessRunSummary): boolean => {
      if (beforeCompletedAt === undefined) return true;
      if (s.completedAt < beforeCompletedAt) return true;
      if (s.completedAt === beforeCompletedAt && beforeRunId !== undefined) return s.runId < beforeRunId;
      return false;
    };
    const rows = [...this.db.harnessRunSummaries.values()].filter(
      s =>
        s.harnessName === namespace &&
        s.sessionId === sessionId &&
        (resourceId === undefined || s.resourceId === resourceId) &&
        beforeCursor(s),
    );
    // Newest first; ties broken by runId descending for a stable keyset order.
    rows.sort((a, b) => b.completedAt - a.completedAt || (a.runId < b.runId ? 1 : a.runId > b.runId ? -1 : 0));
    const cap = limit ?? 50;
    const page = rows.slice(0, cap);
    const result: ListRunSummariesResult = { summaries: page.map(cloneJson) };
    if (rows.length > cap) {
      const last = page[page.length - 1]!;
      result.nextBeforeCompletedAt = last.completedAt;
      result.nextBeforeRunId = last.runId;
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Test-only
  // -------------------------------------------------------------------------

  async dangerouslyClearAll(): Promise<void> {
    this.db.harnessSessions.clear();
    this.db.harnessAttachmentRecords.clear();
    this.db.harnessAttachmentBytes.clear();
    this.db.harnessAttachmentReferences.clear();
    this.db.harnessMessageResultEvidence.clear();
    this.db.harnessOperationTombstones.clear();
    this.db.harnessSessionEvents.clear();
    this.db.harnessSessionRecordProjectionIntents.clear();
    this.db.harnessSessionRecordProjectionFences.clear();
    this.db.harnessWorkspaceActionJournal.clear();
    this.db.harnessChannelInbox.clear();
    this.db.harnessProviderCallbackBindings.clear();
    this.db.harnessChannelActionTokens.clear();
    this.db.harnessChannelActionReceipts.clear();
    this.db.harnessChannelOutbox.clear();
    this.db.harnessWakeupItems.clear();
    this.db.harnessPlanTasks.clear();
    this.db.harnessRunSummaries.clear();
    this.db.harnessThreadDeleteFences.clear();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Attachments are keyed by `(sessionId, attachmentId)`. Using NUL as the
 * separator means session-prefix scans for `deleteAttachmentsForSession` are
 * unambiguous regardless of the contents of the ids.
 */
function sessionKey(harnessName: string, sessionId: string): string {
  return `${harnessName}\u0000${sessionId}`;
}

function projectionFenceKey(harnessName: string, sessionId: string): string {
  return sessionKey(harnessName, sessionId);
}

function projectionFenceMatches(
  fence: ReturnType<typeof projectHarnessSessionRecordProjectionFence> | undefined,
  intent: HarnessSessionRecordProjectionIntent,
  state: 'active' | 'deleted',
): boolean {
  return (
    fence !== undefined &&
    fence.state === state &&
    fence.sessionIncarnation === intent.sessionIncarnation &&
    fence.resourceId === intent.resourceId &&
    fence.threadId === intent.threadId &&
    fence.revision >= intent.revision
  );
}

function hasProjectionPredecessor(
  intents: Map<string, HarnessSessionRecordProjectionIntent>,
  candidate: HarnessSessionRecordProjectionIntent,
): boolean {
  for (const predecessor of intents.values()) {
    if (
      predecessor.harnessName === candidate.harnessName &&
      predecessor.sessionId === candidate.sessionId &&
      predecessor.sessionIncarnation === candidate.sessionIncarnation &&
      predecessor.revision < candidate.revision &&
      (predecessor.status === 'pending' || predecessor.status === 'claimed' || predecessor.status === 'failed')
    ) {
      return true;
    }
  }
  return false;
}

function projectionAckResult(
  intent: HarnessSessionRecordProjectionIntent,
  status: AckSessionRecordProjectionResult['status'],
): AckSessionRecordProjectionResult {
  return {
    status,
    operationId: intent.operationId,
    sessionId: intent.sessionId,
    sessionIncarnation: intent.sessionIncarnation,
    revision: intent.revision,
    payloadDigest: intent.payloadDigest,
  };
}

function assertProjectionClaimInput(input: ClaimSessionRecordProjectionIntentsInput): void {
  if (input.claimId.length === 0 || !Number.isSafeInteger(input.limit) || input.limit <= 0) {
    throw new RangeError('Session projection claim requires a non-empty claim id and positive limit');
  }
  if (
    !Number.isSafeInteger(input.now) ||
    input.now < 0 ||
    !Number.isSafeInteger(input.claimTtlMs) ||
    input.claimTtlMs <= 0
  ) {
    throw new RangeError('Session projection claim timestamps must be positive safe integers');
  }
}

function assertProjectionRenewInput(input: RenewSessionRecordProjectionClaimInput): void {
  if (
    input.operationId.length === 0 ||
    input.claimId.length === 0 ||
    input.sessionIncarnation.length === 0 ||
    input.payloadDigest.length === 0 ||
    !Number.isSafeInteger(input.revision) ||
    input.revision <= 0 ||
    !Number.isSafeInteger(input.now) ||
    input.now < 0 ||
    !Number.isSafeInteger(input.claimTtlMs) ||
    input.claimTtlMs <= 0
  ) {
    throw new RangeError('Session projection claim renewal input is invalid');
  }
}

function assertProjectionAckInput(input: AckSessionRecordProjectionInput): void {
  if (
    input.operationId.length === 0 ||
    input.claimId.length === 0 ||
    input.sessionIncarnation.length === 0 ||
    input.payloadDigest.length === 0 ||
    !Number.isSafeInteger(input.revision) ||
    input.revision <= 0 ||
    (input.acknowledgedAt !== undefined && (!Number.isSafeInteger(input.acknowledgedAt) || input.acknowledgedAt < 0))
  ) {
    throw new RangeError('Session projection acknowledgement input is invalid');
  }
}

function assertProjectionFailInput(input: FailSessionRecordProjectionInput): void {
  if (
    input.operationId.length === 0 ||
    input.claimId.length === 0 ||
    input.sessionIncarnation.length === 0 ||
    input.payloadDigest.length === 0 ||
    !Number.isSafeInteger(input.revision) ||
    input.revision <= 0 ||
    (input.failedAt !== undefined && (!Number.isSafeInteger(input.failedAt) || input.failedAt < 0)) ||
    (input.retryAt !== undefined && (!Number.isSafeInteger(input.retryAt) || input.retryAt < 0)) ||
    input.error.code.length === 0 ||
    input.error.message.length === 0
  ) {
    throw new RangeError('Session projection failure input is invalid');
  }
}

function attachmentKey(harnessName: string, ownerSessionId: string, attachmentId: string): string {
  return `${harnessName}\u0000${ownerSessionId}\u0000${attachmentId}`;
}

function attachmentReferenceKey(ref: SaveAttachmentReferenceInput): string {
  return `${resolveHarnessName(ref.harnessName, 'default')}\u0000${ref.sessionId}\u0000${ref.attachmentId}\u0000${ref.source}\u0000${ref.sourceId}`;
}

function splitAttachmentKey(key: string): [string, string, string] {
  const [harnessName = '', ownerSessionId = '', attachmentId = ''] = key.split('\u0000');
  return [harnessName, ownerSessionId, attachmentId];
}

function tombstoneKey(record: OperationAdmissionTombstone): string {
  const publicId = record.kind === 'signal' ? record.signalId : record.queuedItemId;
  return `${record.harnessName}\u0000${record.sessionId}\u0000${record.kind}\u0000${publicId ?? record.admissionId ?? record.compactedAt}`;
}

function messageEvidenceKey(harnessName: string, sessionId: string, signalId: string): string {
  return `${harnessName}\u0000${sessionId}\u0000${signalId}`;
}

function sessionEventKey(
  record: Pick<HarnessSessionEventRecord, 'harnessName' | 'sessionId' | 'epoch' | 'sequence'>,
): string {
  return `${record.harnessName}\u0000${record.sessionId}\u0000${record.epoch}\u0000${record.sequence}`;
}

function workspaceActionJournalKey(harnessName: string, sessionId: string, id: string): string {
  return `${harnessName}\u0000${sessionId}\u0000${id}`;
}

function channelBindingKey(_harnessName: string, bindingId: string): string {
  return bindingId;
}

// §14.1: missing optional external IDs normalise to the shared
// CHANNEL_BINDING_EXTERNAL_ID_SENTINEL (defined in ./base) for tuple uniqueness
// (storage must not rely on SQL NULL uniqueness semantics). Sharing the constant
// keeps the storage tuple key aligned with the harness-level idempotency/thread-id
// derivation.
function normalizeExternalId(value: string | undefined): string {
  return value ?? CHANNEL_BINDING_EXTERNAL_ID_SENTINEL;
}

/** True when a binding addresses the same platform-conversation tuple as `b` (§14.1). */
function channelBindingTupleMatches(
  a: ChannelBinding,
  b: {
    channelId: string;
    platform: string;
    externalTenantId?: string;
    externalChannelId?: string;
    externalThreadId: string;
  },
): boolean {
  return (
    a.channelId === b.channelId &&
    a.platform === b.platform &&
    normalizeExternalId(a.externalTenantId) === normalizeExternalId(b.externalTenantId) &&
    normalizeExternalId(a.externalChannelId) === normalizeExternalId(b.externalChannelId) &&
    a.externalThreadId === b.externalThreadId
  );
}

function channelInboxKey(_harnessName: string, inboxItemId: string): string {
  return inboxItemId;
}

function channelActionTokenKey(harnessName: string, channelId: string, actionTokenId: string): string {
  return `${harnessName}\u0000${channelId}\u0000${actionTokenId}`;
}

function channelActionReceiptKey(_harnessName: string, receiptId: string): string {
  return receiptId;
}

function channelOutboxKey(_harnessName: string, outboxItemId: string): string {
  return outboxItemId;
}

function harnessWakeupKey(_harnessName: string, wakeupItemId: string): string {
  return wakeupItemId;
}

function resolveHarnessName(input: string | undefined, fallback: string): string {
  return input ?? fallback;
}

// ---------------------------------------------------------------------------
// Plan-task helpers (§5.1k)
// ---------------------------------------------------------------------------

function planTaskKey(harnessName: string, sessionId: string, taskId: string): string {
  return `${harnessName} ${sessionId} ${taskId}`;
}

function clonePlanTask(task: HarnessPlanTask): HarnessPlanTask {
  return cloneJson(task);
}

/** Drop `undefined` optional fields so stored rows stay shape-stable. */
function normalizePlanTask(task: HarnessPlanTask): HarnessPlanTask {
  const next: HarnessPlanTask = {
    taskId: task.taskId,
    harnessName: task.harnessName,
    sessionId: task.sessionId,
    resourceId: task.resourceId,
    threadId: task.threadId,
    order: task.order,
    status: task.status,
    statusSource: task.statusSource,
    content: task.content,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    version: task.version,
  };
  if (task.idempotencyKey !== undefined) next.idempotencyKey = task.idempotencyKey;
  if (task.idempotencyInputHash !== undefined) next.idempotencyInputHash = task.idempotencyInputHash;
  if (task.parentTaskId !== undefined) next.parentTaskId = task.parentTaskId;
  if (task.activeForm !== undefined) next.activeForm = task.activeForm;
  if (task.priority !== undefined) next.priority = task.priority;
  if (task.blockedBy !== undefined) next.blockedBy = [...task.blockedBy];
  if (task.origin !== undefined) next.origin = task.origin;
  if (task.delegatedSubagentSessionId !== undefined) {
    next.delegatedSubagentSessionId = task.delegatedSubagentSessionId;
  }
  if (task.delegatedSubagentTypeId !== undefined) {
    next.delegatedSubagentTypeId = task.delegatedSubagentTypeId;
  }
  if (task.metadata !== undefined) next.metadata = cloneJson(task.metadata);
  if (task.startedAt !== undefined) next.startedAt = task.startedAt;
  if (task.completedAt !== undefined) next.completedAt = task.completedAt;
  return next;
}

/** BFS subtree id collection over an in-memory working map (cycle-guarded). */
function collectSubtreeIdsFromMap(working: Map<string, HarnessPlanTask>, rootTaskId: string): string[] {
  if (!working.has(rootTaskId)) return [];
  const childrenByParent = new Map<string, string[]>();
  for (const task of working.values()) {
    if (task.parentTaskId !== undefined) {
      const siblings = childrenByParent.get(task.parentTaskId) ?? [];
      siblings.push(task.taskId);
      childrenByParent.set(task.parentTaskId, siblings);
    }
  }
  const result: string[] = [];
  const queue = [rootTaskId];
  const visited = new Set<string>([rootTaskId]);
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    for (const child of childrenByParent.get(id) ?? []) {
      if (visited.has(child)) continue;
      visited.add(child);
      queue.push(child);
    }
  }
  return result;
}

function cloneSessionRecord(record: SessionRecord): SessionRecord {
  return cloneJson(record);
}

function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isDueScannablePendingResume(
  pending: PendingResume | undefined,
): pending is PendingResume & { itemId: string } {
  return (
    pending !== undefined &&
    isPendingResumeKind(pending.kind) &&
    typeof pending.itemId === 'string' &&
    pending.itemId.length > 0 &&
    typeof pending.runId === 'string' &&
    pending.runId.length > 0 &&
    typeof pending.toolCallId === 'string' &&
    pending.toolCallId.length > 0 &&
    Number.isSafeInteger(pending.requestedAt) &&
    pending.requestedAt >= 0 &&
    Number.isSafeInteger(pending.expiresAt) &&
    pending.expiresAt >= 0 &&
    (pending.expiryStartedAt === undefined ||
      (Number.isSafeInteger(pending.expiryStartedAt) && pending.expiryStartedAt >= 0)) &&
    (pending.resumedAt === undefined
      ? pending.resumeRecoveryAt === undefined && pending.resumeRecoveryStartedAt === undefined
      : Number.isSafeInteger(pending.resumedAt) &&
        pending.resumedAt >= 0 &&
        Number.isSafeInteger(pending.resumeRecoveryAt) &&
        pending.resumeRecoveryAt! >= pending.resumedAt &&
        (pending.resumeRecoveryStartedAt === undefined ||
          (Number.isSafeInteger(pending.resumeRecoveryStartedAt) && pending.resumeRecoveryStartedAt >= 0)))
  );
}

function pendingResumeDueAt(pending: PendingResume & { itemId: string }): number {
  return pending.resumedAt === undefined ? pending.expiresAt : pending.resumeRecoveryAt!;
}

function isPendingResumeKind(value: unknown): value is PendingResume['kind'] {
  return (
    value === 'tool-approval' ||
    value === 'tool-suspension' ||
    value === 'question' ||
    value === 'plan-approval' ||
    value === 'sandbox-access'
  );
}

function sameTombstoneIdentity(a: OperationAdmissionTombstone, b: OperationAdmissionTombstone): boolean {
  return (
    a.kind === b.kind &&
    a.harnessName === b.harnessName &&
    a.sessionId === b.sessionId &&
    a.resourceId === b.resourceId &&
    a.threadId === b.threadId &&
    a.admissionId === b.admissionId &&
    a.admissionHash === b.admissionHash &&
    a.queuedItemId === b.queuedItemId &&
    a.signalId === b.signalId &&
    a.runId === b.runId
  );
}

function sameMessageEvidenceIdentity(a: AgentSignalResultEvidence, b: AgentSignalResultEvidence): boolean {
  return (
    a.harnessName === b.harnessName &&
    a.sessionId === b.sessionId &&
    a.resourceId === b.resourceId &&
    a.threadId === b.threadId &&
    a.signalId === b.signalId &&
    a.admissionId === b.admissionId &&
    a.admissionHash === b.admissionHash
  );
}

function normalizedSignalDispatch(record: AgentSignalResultEvidence): AgentSignalDispatchState | undefined {
  if (record.dispatch !== undefined) return record.dispatch;
  return record.status === 'pending' && record.runId === undefined ? { state: 'reserved' } : undefined;
}

function signalDispatchMatches(record: AgentSignalResultEvidence, expected: AgentSignalDispatchState): boolean {
  if (record.dispatch === undefined && record.status === 'pending' && record.runId !== undefined) {
    // This branch is reached only after `isSignalAdmissionEvidence` proved an
    // explicit signal discriminator (or the stable pre-discriminator signal-id
    // namespace). The run id matches state; it never classifies the operation.
    return expected.state === 'accepted' && expected.runId === record.runId;
  }
  return sameSignalDispatch(normalizedSignalDispatch(record), expected);
}

function isSignalAdmissionEvidence(record: AgentSignalResultEvidence): boolean {
  if (record.operationKind !== undefined) return record.operationKind === 'signal';
  return record.dispatch !== undefined || record.signalId.startsWith('harness-channel-signal-');
}

function sameSignalDispatch(a: AgentSignalDispatchState | undefined, b: AgentSignalDispatchState | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  if (a.state !== b.state) return false;
  if (a.state === 'reserved' || b.state === 'reserved') return a.state === b.state;
  if (
    !sameOptionalDispatchField(a.attemptId, b.attemptId) ||
    !sameOptionalDispatchField(a.delivery, b.delivery) ||
    !sameOptionalDispatchField(a.runId, b.runId)
  ) {
    return false;
  }
  if (a.state === 'dispatching' && b.state === 'dispatching') {
    return sameOptionalDispatchField(a.claimExpiresAt, b.claimExpiresAt);
  }
  return a.state === 'accepted' && b.state === 'accepted' && sameOptionalDispatchField(a.acceptedAt, b.acceptedAt);
}

function sameOptionalDispatchField(a: unknown, b: unknown): boolean {
  return (a ?? undefined) === (b ?? undefined);
}

function isTerminalMessageEvidence(record: AgentSignalResultEvidence): boolean {
  return record.status === 'completed' || record.status === 'failed';
}

function isDispatchFencedAdmission(record: AgentSignalResultEvidence): boolean {
  return record.admissionId !== undefined && record.admissionHash !== undefined && isSignalAdmissionEvidence(record);
}

function isTerminalQueueReceipt(receipt: QueueAdmissionReceipt): boolean {
  return receipt.status === 'completed' || receipt.status === 'failed' || receipt.status === 'dead';
}

function isTerminalChannelInboxStatus(status: ChannelInboxItem['status']): boolean {
  return status === 'accepted' || status === 'queued' || status === 'dead';
}

function isTerminalChannelActionReceiptStatus(status: ChannelActionReceipt['status']): boolean {
  return status === 'applied' || status === 'conflict' || status === 'dead';
}

function isTerminalChannelOutboxStatus(status: ChannelOutboxItem['status']): boolean {
  return status === 'sent' || status === 'dead';
}

function isTerminalHarnessWakeupStatus(status: HarnessWakeupItem['status']): boolean {
  return status === 'queued' || status === 'completed' || status === 'dead';
}

function isChannelInboxClaimable(item: ChannelInboxItem, now: number): boolean {
  if (isTerminalChannelInboxStatus(item.status)) return false;
  if (item.nextAttemptAt !== undefined && item.nextAttemptAt > now) return false;
  return item.claimId === undefined || item.claimExpiresAt === undefined || item.claimExpiresAt <= now;
}

function isChannelActionReceiptClaimable(receipt: ChannelActionReceipt, now: number): boolean {
  if (isTerminalChannelActionReceiptStatus(receipt.status)) return false;
  if (receipt.nextAttemptAt !== undefined && receipt.nextAttemptAt > now) return false;
  return receipt.claimId === undefined || receipt.claimExpiresAt === undefined || receipt.claimExpiresAt <= now;
}

function isChannelOutboxClaimable(item: ChannelOutboxItem, now: number): boolean {
  if (item.status !== 'pending' && item.status !== 'failed' && item.status !== 'claimed') return false;
  if (item.nextAttemptAt !== undefined && item.nextAttemptAt > now) return false;
  return item.claimId === undefined || item.claimExpiresAt === undefined || item.claimExpiresAt <= now;
}

function isHarnessWakeupClaimable(item: HarnessWakeupItem, now: number): boolean {
  if (isTerminalHarnessWakeupStatus(item.status)) return false;
  if (item.dueAt > now) return false;
  if (item.nextAttemptAt !== undefined && item.nextAttemptAt > now) return false;
  return item.claimId === undefined || item.claimExpiresAt === undefined || item.claimExpiresAt <= now;
}

function claimHarnessWakeupItem(
  item: HarnessWakeupItem,
  claimId: string,
  now: number,
  claimTtlMs: number,
): HarnessWakeupItem {
  return {
    ...item,
    status: 'claimed',
    attempts: item.attempts + 1,
    claimId,
    claimExpiresAt: now + claimTtlMs,
    claimedAt: now,
    queuedItemId: undefined,
    queuedAt: undefined,
    completedAt: undefined,
    deadAt: undefined,
    runId: undefined,
    signalId: undefined,
    result: undefined,
    nextAttemptAt: undefined,
    failedAt: undefined,
    lastError: undefined,
    updatedAt: now,
  };
}

function compareHarnessWakeupOrder(a: HarnessWakeupItem, b: HarnessWakeupItem): number {
  return a.dueAt - b.dueAt || a.createdAt - b.createdAt || a.id.localeCompare(b.id);
}

function assertLegalChannelInboxUpdate(current: ChannelInboxItem, next: ChannelInboxItem): void {
  const immutableMismatch =
    current.id !== next.id ||
    current.harnessName !== next.harnessName ||
    current.channelId !== next.channelId ||
    current.providerId !== next.providerId ||
    current.idempotencyKey !== next.idempotencyKey ||
    current.payloadHash !== next.payloadHash ||
    current.admissionId !== next.admissionId ||
    current.externalMessageId !== next.externalMessageId ||
    current.receivedAt !== next.receivedAt;
  if (immutableMismatch) {
    throw new HarnessStorageChannelInboxTransitionError(
      current.id,
      current.status,
      next.status,
      'immutable provider identity fields cannot change',
    );
  }

  const allowed =
    current.status === next.status ||
    (current.status === 'received' &&
      (next.status === 'admitted' || next.status === 'failed' || next.status === 'dead')) ||
    (current.status === 'admitted' &&
      (next.status === 'accepted' || next.status === 'queued' || next.status === 'failed' || next.status === 'dead')) ||
    (current.status === 'failed' &&
      (next.status === 'received' || next.status === 'admitted' || next.status === 'failed' || next.status === 'dead'));
  if (!allowed || isTerminalChannelInboxStatus(current.status)) {
    throw new HarnessStorageChannelInboxTransitionError(
      current.id,
      current.status,
      next.status,
      'transition is not legal for channel inbox state machine',
    );
  }
  assertValidChannelInboxState(next, current.status);
}

function assertValidChannelInboxState(record: ChannelInboxItem, currentStatus?: ChannelInboxItem['status']): void {
  if (
    record.status === 'admitted' &&
    (record.delivery === undefined ||
      (record.delivery !== 'signal' && record.delivery !== 'queue') ||
      record.admittedAt == null)
  ) {
    throw new HarnessStorageChannelInboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'admitted rows require delivery and admittedAt',
    );
  }
  if (
    record.status === 'accepted' &&
    (record.delivery !== 'signal' || !record.runId || !record.signalId || record.acceptedAt == null)
  ) {
    throw new HarnessStorageChannelInboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'accepted rows require signal delivery, runId, signalId, and acceptedAt',
    );
  }
  if (record.status === 'queued' && (record.delivery !== 'queue' || !record.queuedItemId || record.queuedAt == null)) {
    throw new HarnessStorageChannelInboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'queued rows require queue delivery, queuedItemId, and queuedAt',
    );
  }
  if ((record.status === 'failed' || record.status === 'dead') && record.lastError == null) {
    throw new HarnessStorageChannelInboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'failed and dead rows require lastError',
    );
  }
}

function channelInboxItemsEqual(a: ChannelInboxItem, b: ChannelInboxItem): boolean {
  const aValues = channelInboxComparableValues(a);
  const bValues = channelInboxComparableValues(b);
  return aValues.length === bValues.length && aValues.every((value, index) => Object.is(value, bValues[index]));
}

function assertLegalHarnessWakeupUpdate(current: HarnessWakeupItem, next: HarnessWakeupItem): void {
  const immutableMismatch =
    current.id !== next.id ||
    current.harnessName !== next.harnessName ||
    current.source !== next.source ||
    current.sourceId !== next.sourceId ||
    current.fireId !== next.fireId ||
    current.idempotencyKey !== next.idempotencyKey ||
    current.payloadHash !== next.payloadHash ||
    current.admissionId !== next.admissionId ||
    current.admissionHash !== next.admissionHash ||
    current.resourceId !== next.resourceId ||
    current.threadId !== next.threadId ||
    current.sessionId !== next.sessionId ||
    current.dueAt !== next.dueAt ||
    current.createdAt !== next.createdAt ||
    current.mode !== next.mode ||
    current.model !== next.model ||
    (current.yolo === true) !== (next.yolo === true) ||
    current.content !== next.content ||
    stableJsonString(current.requestContext) !== stableJsonString(next.requestContext) ||
    stableJsonString(current.attachments) !== stableJsonString(next.attachments);
  if (immutableMismatch) {
    throw new HarnessStorageWakeupTransitionError(
      current.id,
      current.status,
      next.status,
      'immutable wakeup identity fields cannot change',
    );
  }
  const allowed =
    current.status === next.status ||
    (current.status === 'due' && (next.status === 'claimed' || next.status === 'failed' || next.status === 'dead')) ||
    (current.status === 'claimed' &&
      (next.status === 'queued' ||
        next.status === 'completed' ||
        next.status === 'failed' ||
        next.status === 'dead')) ||
    (current.status === 'failed' && (next.status === 'claimed' || next.status === 'failed' || next.status === 'dead'));
  if (!allowed || isTerminalHarnessWakeupStatus(current.status)) {
    throw new HarnessStorageWakeupTransitionError(
      current.id,
      current.status,
      next.status,
      'transition is not legal for wakeup state machine',
    );
  }
  assertValidHarnessWakeupState(next, current.status);
}

function assertValidHarnessWakeupState(record: HarnessWakeupItem, currentStatus?: HarnessWakeupItem['status']): void {
  const hasClaimMetadata = record.claimId != null || record.claimExpiresAt != null || record.claimedAt != null;
  const hasQueueMetadata = record.queuedItemId != null || record.queuedAt != null;
  const hasCompletedMetadata = record.completedAt != null || record.result !== undefined;
  const hasFailedMetadata = record.failedAt != null || record.lastError != null;
  const hasDeadMetadata = record.deadAt != null;

  if (record.source !== 'schedule' && record.source !== 'proactive') {
    throw new HarnessStorageWakeupTransitionError(record.id, currentStatus, record.status, 'source is not supported');
  }
  if (
    record.status !== 'due' &&
    record.status !== 'claimed' &&
    record.status !== 'queued' &&
    record.status !== 'completed' &&
    record.status !== 'failed' &&
    record.status !== 'dead'
  ) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'status is not a known wakeup state',
    );
  }
  if (
    record.status === 'due' &&
    (hasClaimMetadata || hasQueueMetadata || hasCompletedMetadata || hasFailedMetadata || hasDeadMetadata)
  ) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'due wakeups must not include claim, queue, terminal, or error metadata',
    );
  }
  if (
    record.status === 'claimed' &&
    (record.claimId == null || record.claimExpiresAt == null || record.claimedAt == null)
  ) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'claimed wakeups require claimId, claimExpiresAt, and claimedAt',
    );
  }
  if (
    record.status === 'claimed' &&
    (hasQueueMetadata || hasCompletedMetadata || hasFailedMetadata || hasDeadMetadata)
  ) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'claimed wakeups must not include queue, terminal, or error metadata',
    );
  }
  if (record.status !== 'claimed' && hasClaimMetadata) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'only claimed wakeups may carry claim metadata',
    );
  }
  if (record.status === 'queued' && (record.queuedItemId == null || record.queuedAt == null)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'queued wakeups require queuedItemId and queuedAt',
    );
  }
  if (record.status === 'queued' && (hasCompletedMetadata || hasFailedMetadata || hasDeadMetadata)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'queued wakeups must not include terminal or error metadata',
    );
  }
  if (record.status === 'completed' && (record.completedAt == null || record.result === undefined)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'completed wakeups require completedAt and result',
    );
  }
  if (record.status === 'completed' && (hasQueueMetadata || hasFailedMetadata || hasDeadMetadata)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'completed wakeups must not include queue, error, or dead metadata',
    );
  }
  if (record.status === 'failed' && (record.failedAt == null || record.lastError == null)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'failed wakeups require failedAt and lastError',
    );
  }
  if (record.status === 'failed' && (hasQueueMetadata || hasCompletedMetadata || hasDeadMetadata)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'failed wakeups must not include queue, completed, or dead metadata',
    );
  }
  if (record.status === 'dead' && (record.deadAt == null || record.lastError == null)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'dead wakeups require deadAt and lastError',
    );
  }
  if (record.status === 'dead' && (hasQueueMetadata || hasCompletedMetadata || record.failedAt != null)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'dead wakeups must not include queue, completed, or failed metadata',
    );
  }
}

function harnessWakeupItemsEquivalentForCreate(a: HarnessWakeupItem, b: HarnessWakeupItem): boolean {
  return (
    a.harnessName === b.harnessName &&
    a.source === b.source &&
    a.sourceId === b.sourceId &&
    a.fireId === b.fireId &&
    a.idempotencyKey === b.idempotencyKey &&
    a.payloadHash === b.payloadHash &&
    a.admissionId === b.admissionId &&
    a.admissionHash === b.admissionHash &&
    a.resourceId === b.resourceId &&
    a.threadId === b.threadId &&
    a.sessionId === b.sessionId &&
    a.dueAt === b.dueAt &&
    a.mode === b.mode &&
    a.model === b.model &&
    (a.yolo === true) === (b.yolo === true) &&
    stableJsonString(a.requestContext) === stableJsonString(b.requestContext) &&
    a.content === b.content &&
    stableJsonString(a.attachments) === stableJsonString(b.attachments)
  );
}

function assertLegalChannelActionReceiptUpdate(current: ChannelActionReceipt, next: ChannelActionReceipt): void {
  const immutableMismatch =
    current.id !== next.id ||
    current.harnessName !== next.harnessName ||
    current.channelId !== next.channelId ||
    current.providerId !== next.providerId ||
    current.actionTokenId !== next.actionTokenId ||
    current.actionId !== next.actionId ||
    current.bindingId !== next.bindingId ||
    current.bindingGeneration !== next.bindingGeneration ||
    current.resourceId !== next.resourceId ||
    current.owningSessionId !== next.owningSessionId ||
    current.itemId !== next.itemId ||
    current.kind !== next.kind ||
    current.runId !== next.runId ||
    current.pendingRequestedAt !== next.pendingRequestedAt ||
    stableJsonString(current.audience) !== stableJsonString(next.audience) ||
    current.responseHash !== next.responseHash;
  if (immutableMismatch) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      current.id,
      current.status,
      next.status,
      'immutable token, item, and response identity fields cannot change',
    );
  }
  const allowed =
    current.status === next.status ||
    (current.status === 'received' &&
      (next.status === 'accepted' ||
        next.status === 'failed' ||
        next.status === 'conflict' ||
        next.status === 'dead')) ||
    (current.status === 'accepted' &&
      (next.status === 'applied' || next.status === 'failed' || next.status === 'dead')) ||
    (current.status === 'failed' &&
      (next.status === 'received' || next.status === 'accepted' || next.status === 'failed' || next.status === 'dead'));
  if (!allowed || isTerminalChannelActionReceiptStatus(current.status)) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      current.id,
      current.status,
      next.status,
      'transition is not legal for channel action receipt state machine',
    );
  }
  assertValidChannelActionReceiptState(next, current.status);
}

function assertValidChannelActionReceiptState(
  record: ChannelActionReceipt,
  currentStatus?: ChannelActionReceipt['status'],
): void {
  const validStatus =
    record.status === 'received' ||
    record.status === 'accepted' ||
    record.status === 'applied' ||
    record.status === 'conflict' ||
    record.status === 'failed' ||
    record.status === 'dead';
  if (!validStatus) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'status is not a known channel action receipt state',
    );
  }
  if (record.status === 'accepted' && record.acceptedAt == null) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'accepted receipts require acceptedAt',
    );
  }
  if (record.status === 'applied' && (record.appliedAt == null || record.result === undefined)) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'applied receipts require appliedAt and result',
    );
  }
  if (record.status === 'conflict' && record.conflictReason == null) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'conflict receipts require conflictReason',
    );
  }
  if (record.status === 'failed' && (record.failedAt == null || record.lastError == null)) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'failed receipts require failedAt and lastError',
    );
  }
  if (record.status === 'dead' && (record.deadAt == null || record.lastError == null)) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'dead receipts require deadAt and lastError',
    );
  }
  if (
    record.conflictReason !== undefined &&
    record.conflictReason !== 'response_mismatch' &&
    record.conflictReason !== 'stale_item' &&
    record.conflictReason !== 'kind_mismatch' &&
    record.conflictReason !== 'run_mismatch' &&
    record.conflictReason !== 'binding_mismatch' &&
    record.conflictReason !== 'session_closed' &&
    record.conflictReason !== 'actor_not_allowed' &&
    record.conflictReason !== 'token_expired' &&
    record.conflictReason !== 'token_revoked'
  ) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'conflictReason is not a known channel action receipt reason',
    );
  }
}

function channelActionTokensEquivalent(a: ChannelActionToken, b: ChannelActionToken): boolean {
  return (
    a.actionTokenId === b.actionTokenId &&
    a.harnessName === b.harnessName &&
    a.channelId === b.channelId &&
    a.providerId === b.providerId &&
    a.resourceId === b.resourceId &&
    a.owningSessionId === b.owningSessionId &&
    a.itemId === b.itemId &&
    a.kind === b.kind &&
    a.bindingId === b.bindingId &&
    a.bindingGeneration === b.bindingGeneration &&
    a.runId === b.runId &&
    a.pendingRequestedAt === b.pendingRequestedAt &&
    stableJsonString(a.audience) === stableJsonString(b.audience) &&
    a.metadataHash === b.metadataHash &&
    a.transportHash === b.transportHash &&
    a.keyId === b.keyId &&
    a.expiresAt === b.expiresAt
  );
}

function channelActionReceiptsEquivalentForCreate(a: ChannelActionReceipt, b: ChannelActionReceipt): boolean {
  return (
    a.harnessName === b.harnessName &&
    a.channelId === b.channelId &&
    a.providerId === b.providerId &&
    a.actionTokenId === b.actionTokenId &&
    a.actionId === b.actionId &&
    a.bindingId === b.bindingId &&
    a.bindingGeneration === b.bindingGeneration &&
    a.resourceId === b.resourceId &&
    a.owningSessionId === b.owningSessionId &&
    a.itemId === b.itemId &&
    a.kind === b.kind &&
    a.runId === b.runId &&
    a.pendingRequestedAt === b.pendingRequestedAt &&
    stableJsonString(a.audience) === stableJsonString(b.audience) &&
    a.responseHash === b.responseHash
  );
}

function channelActionReceiptsEqual(a: ChannelActionReceipt, b: ChannelActionReceipt): boolean {
  const aValues = channelActionReceiptComparableValues(a);
  const bValues = channelActionReceiptComparableValues(b);
  return aValues.length === bValues.length && aValues.every((value, index) => Object.is(value, bValues[index]));
}

function channelActionReceiptComparableValues(record: ChannelActionReceipt): unknown[] {
  return [
    record.id,
    record.harnessName,
    record.channelId,
    record.providerId,
    record.actionTokenId,
    record.actionId,
    record.bindingId,
    record.bindingGeneration,
    record.resourceId,
    record.owningSessionId,
    record.itemId,
    record.kind,
    record.runId,
    record.pendingRequestedAt,
    stableJsonString(record.audience),
    stableJsonString(record.verifiedActor),
    record.responseHash,
    stableJsonString(record.response),
    record.status,
    record.conflictReason,
    record.attempts,
    record.claimId,
    record.claimExpiresAt,
    record.nextAttemptAt,
    record.acceptedAt,
    record.appliedAt,
    record.failedAt,
    record.deadAt,
    stableJsonString(record.result),
    record.lastError ? stableJsonString(record.lastError) : undefined,
    record.createdAt,
    record.updatedAt,
  ];
}

function assertLegalChannelOutboxUpdate(current: ChannelOutboxItem, next: ChannelOutboxItem): void {
  const immutableMismatch =
    current.id !== next.id ||
    current.harnessName !== next.harnessName ||
    current.channelId !== next.channelId ||
    current.providerId !== next.providerId ||
    current.bindingId !== next.bindingId ||
    current.bindingGeneration !== next.bindingGeneration ||
    current.idempotencyKey !== next.idempotencyKey ||
    current.payloadHash !== next.payloadHash ||
    current.resourceId !== next.resourceId ||
    current.threadId !== next.threadId ||
    current.sessionId !== next.sessionId ||
    current.owningSessionId !== next.owningSessionId ||
    stableJsonString(current.source) !== stableJsonString(next.source) ||
    stableJsonString(current.target) !== stableJsonString(next.target) ||
    current.kind !== next.kind ||
    current.operationKind !== next.operationKind ||
    current.operationName !== next.operationName ||
    stableJsonString(current.payload) !== stableJsonString(next.payload) ||
    current.deliverySemantics !== next.deliverySemantics ||
    current.createdAt !== next.createdAt;
  if (immutableMismatch) {
    throw new HarnessStorageChannelOutboxTransitionError(
      current.id,
      current.status,
      next.status,
      'immutable delivery identity fields cannot change',
    );
  }
  const allowed =
    current.status === next.status ||
    ((current.status === 'pending' || current.status === 'failed' || current.status === 'claimed') &&
      (next.status === 'claimed' || next.status === 'failed' || next.status === 'sent' || next.status === 'dead'));
  if (!allowed || isTerminalChannelOutboxStatus(current.status)) {
    throw new HarnessStorageChannelOutboxTransitionError(
      current.id,
      current.status,
      next.status,
      'transition is not legal for channel outbox state machine',
    );
  }
  assertValidChannelOutboxState(next, current.status);
}

function assertValidChannelOutboxState(record: ChannelOutboxItem, currentStatus?: ChannelOutboxItem['status']): void {
  const validStatus =
    record.status === 'pending' ||
    record.status === 'claimed' ||
    record.status === 'sent' ||
    record.status === 'failed' ||
    record.status === 'dead';
  if (!validStatus) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'status is not a known channel outbox state',
    );
  }
  if (currentStatus === undefined && record.status !== 'pending') {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'new outbox rows must start pending',
    );
  }
  if (record.status === 'pending' && record.attempts !== 0) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'new pending rows must start with zero attempts',
    );
  }
  if (
    record.status === 'pending' &&
    (record.claimId !== undefined ||
      record.claimExpiresAt !== undefined ||
      record.nextAttemptAt !== undefined ||
      record.sentAt !== undefined ||
      record.failedAt !== undefined ||
      record.deadAt !== undefined ||
      record.providerMessageId !== undefined ||
      record.providerReceipt !== undefined ||
      record.lastError !== undefined)
  ) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'pending rows must not include claim, retry, terminal, provider, or error metadata',
    );
  }
  if (record.status === 'claimed' && (!record.claimId || record.claimExpiresAt == null)) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'claimed rows require claimId and claimExpiresAt',
    );
  }
  if (record.status === 'sent' && record.sentAt == null) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'sent rows require sentAt',
    );
  }
  if (record.status === 'failed' && (record.failedAt == null || record.lastError == null)) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'failed rows require failedAt and lastError',
    );
  }
  if (record.status === 'dead' && (record.deadAt == null || record.lastError == null)) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'dead rows require deadAt and lastError',
    );
  }
}

function channelOutboxItemsEquivalentForEnqueue(a: ChannelOutboxItem, b: ChannelOutboxItem): boolean {
  return (
    a.harnessName === b.harnessName &&
    a.channelId === b.channelId &&
    a.providerId === b.providerId &&
    a.bindingId === b.bindingId &&
    a.bindingGeneration === b.bindingGeneration &&
    a.idempotencyKey === b.idempotencyKey &&
    a.resourceId === b.resourceId &&
    a.threadId === b.threadId &&
    a.sessionId === b.sessionId &&
    a.owningSessionId === b.owningSessionId &&
    stableJsonString(a.source) === stableJsonString(b.source) &&
    stableJsonString(a.target) === stableJsonString(b.target) &&
    a.kind === b.kind &&
    a.payloadHash === b.payloadHash &&
    stableJsonString(a.payload) === stableJsonString(b.payload) &&
    a.operationKind === b.operationKind &&
    a.operationName === b.operationName &&
    a.deliverySemantics === b.deliverySemantics
  );
}

function compareChannelOutboxOrder(a: ChannelOutboxItem, b: ChannelOutboxItem): number {
  return a.createdAt - b.createdAt || a.id.localeCompare(b.id);
}

function channelInboxComparableValues(record: ChannelInboxItem): unknown[] {
  return [
    record.id,
    record.harnessName,
    record.channelId,
    record.providerId,
    record.idempotencyKey,
    record.payloadHash,
    record.admissionHash,
    record.admissionId,
    record.bindingId,
    record.resourceId,
    record.threadId,
    record.sessionId,
    record.runId,
    record.signalId,
    record.queuedItemId,
    record.externalMessageId,
    record.receivedAt,
    record.admittedAt,
    record.acceptedAt,
    record.queuedAt,
    record.failedAt,
    record.deadAt,
    record.updatedAt,
    record.status,
    record.delivery,
    record.mode,
    record.model,
    record.attempts,
    record.claimId,
    record.claimExpiresAt,
    record.nextAttemptAt,
    stableJsonString(record.requestContext),
    record.content,
    stableJsonString(record.attachments),
    record.rawFiles ? stableJsonString(record.rawFiles) : undefined,
    record.lastError ? stableJsonString(record.lastError) : undefined,
  ];
}

function providerCallbackBindingsEqual(a: HarnessProviderCallbackBinding, b: HarnessProviderCallbackBinding): boolean {
  return (
    stableJsonString(providerCallbackBindingComparableValues(a)) ===
    stableJsonString(providerCallbackBindingComparableValues(b))
  );
}

function sameProviderCallbackBindingTarget(
  a: HarnessProviderCallbackBinding,
  b: HarnessProviderCallbackBinding,
): boolean {
  return (
    a.harnessName === b.harnessName &&
    a.channelId === b.channelId &&
    stableJsonString(a.origin) === stableJsonString(b.origin)
  );
}

function providerCallbackBindingComparableValues(record: HarnessProviderCallbackBinding): unknown[] {
  return [
    record.id,
    record.providerId,
    record.selectorKind,
    record.selectorValue,
    record.harnessName,
    record.channelId,
    stableJsonString(record.origin),
    record.status,
    record.createdAt,
    record.updatedAt,
    record.replacedAt,
    record.replacedByBindingId,
    record.lastError ? stableJsonString(record.lastError) : undefined,
  ];
}

function assertValidProviderCallbackBindingState(record: HarnessProviderCallbackBinding): void {
  if (!['installation', 'route-key', 'external-tenant'].includes(record.selectorKind)) {
    throw new HarnessStorageProviderCallbackBindingTransitionError(
      record.id,
      undefined,
      record.status,
      `invalid selector kind "${record.selectorKind}"`,
    );
  }
  if (!['active', 'disabled', 'undeliverable', 'replaced'].includes(record.status)) {
    throw new HarnessStorageProviderCallbackBindingTransitionError(
      record.id,
      undefined,
      record.status,
      `invalid status "${record.status}"`,
    );
  }
  if (record.status === 'replaced') {
    if (record.replacedAt === undefined || record.replacedByBindingId === undefined) {
      throw new HarnessStorageProviderCallbackBindingTransitionError(
        record.id,
        undefined,
        record.status,
        'replaced bindings require replacedAt and replacedByBindingId',
      );
    }
    return;
  }
  if (record.replacedAt !== undefined || record.replacedByBindingId !== undefined) {
    throw new HarnessStorageProviderCallbackBindingTransitionError(
      record.id,
      undefined,
      record.status,
      'non-replaced bindings cannot carry replacement metadata',
    );
  }
}

function stableJsonString(value: unknown): string {
  return JSON.stringify(canonicalJsonValue(value));
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonicalJsonValue(entry)]),
    );
  }
  return value;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * `saveSession` rejects writes from anyone other than the current lease
 * holder. An expired lease is treated as no holder — the caller can still
 * re-acquire via `acquireSessionLease`.
 */
function assertLeaseHolder(existing: SessionRecord, ownerId: string): void {
  if (existing.ownerId === undefined) return;
  const now = Date.now();
  if (existing.leaseExpiresAt !== undefined && existing.leaseExpiresAt <= now) return;
  if (existing.ownerId === ownerId) return;
  throw new HarnessStorageLeaseConflictError(existing.id, existing.ownerId, existing.leaseExpiresAt ?? 0);
}

/** Plan-task writes require the caller to hold the current, unexpired lease. */
function assertUnexpiredLeaseHolder(existing: SessionRecord, ownerId: string): void {
  const leaseExpiresAt = existing.leaseExpiresAt ?? 0;
  if (existing.ownerId === ownerId && leaseExpiresAt > Date.now()) return;
  throw new HarnessStorageLeaseConflictError(existing.id, existing.ownerId ?? '<unowned>', leaseExpiresAt);
}

function assertDeleteGuard(record: SessionRecord, opts: DeleteSessionOptions): void {
  const mismatch = getDeleteGuardMismatch(record, opts);
  if (!mismatch) return;
  throw new HarnessStorageDeleteGuardConflictError(
    record.id,
    mismatch,
    opts.ifVersion ?? record.version,
    record.version,
  );
}

function getDeleteGuardMismatch(
  record: Pick<SessionRecord, 'version' | 'resourceId' | 'threadId' | 'parentSessionId' | 'createdAt' | 'closedAt'>,
  opts: DeleteSessionOptions,
): ConstructorParameters<typeof HarnessStorageDeleteGuardConflictError>[1] | undefined {
  if (opts.ifVersion !== undefined && record.version !== opts.ifVersion) return 'ifVersion';
  if (opts.expectedResourceId !== undefined && record.resourceId !== opts.expectedResourceId)
    return 'expectedResourceId';
  if (opts.expectedThreadId !== undefined && record.threadId !== opts.expectedThreadId) return 'expectedThreadId';
  if (opts.expectedParentSessionId !== undefined && (record.parentSessionId ?? null) !== opts.expectedParentSessionId) {
    return 'expectedParentSessionId';
  }
  if (opts.expectedCreatedAt !== undefined && record.createdAt !== opts.expectedCreatedAt) return 'expectedCreatedAt';
  if (opts.requireClosed === true && record.closedAt === undefined) return 'requireClosed';
  return undefined;
}

function toSummary(record: SessionRecord): SessionSummary {
  return {
    harnessName: record.harnessName,
    id: record.id,
    resourceId: record.resourceId,
    threadId: record.threadId,
    parentSessionId: record.parentSessionId,
    origin: record.origin,
    modeId: record.modeId,
    modelId: record.modelId,
    lastActivityAt: record.lastActivityAt,
    closingAt: record.closingAt,
    closeDeadlineAt: record.closeDeadlineAt,
    closedAt: record.closedAt,
  };
}

function attachmentSemantic(record: AttachmentRecord): AttachmentSemanticMetadata {
  return {
    kind: record.kind ?? 'file',
    ...(record.primitiveType ? { primitiveType: record.primitiveType } : {}),
    ...(record.elementType ? { elementType: record.elementType } : {}),
    ...(record.renderer ? { renderer: { ...record.renderer } } : {}),
    ...(record.schemaId ? { schemaId: record.schemaId } : {}),
    ...(record.metadata ? { metadata: cloneJsonRecord(record.metadata) } : {}),
    ...(record.object ? { object: { ...record.object } } : {}),
  };
}

function compareWorkspaceActionJournalOrder(a: WorkspaceActionJournalEntry, b: WorkspaceActionJournalEntry): number {
  return a.createdAt - b.createdAt || compareWorkspaceActionJournalId(a.id, b.id);
}

function compareWorkspaceActionJournalCursor(
  entry: WorkspaceActionJournalEntry,
  cursor: NonNullable<ListWorkspaceActionJournalInput['after']>,
): number {
  return entry.createdAt - cursor.createdAt || compareWorkspaceActionJournalId(entry.id, cursor.id);
}

function compareWorkspaceActionJournalId(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function workspaceActionJournalEntryMatchesPath(
  entry: WorkspaceActionJournalEntry,
  filter: NonNullable<ListWorkspaceActionJournalInput['affectedPath']>,
): boolean {
  if (!workspaceActionJournalPathFilterHasSelector(filter)) return false;
  return (
    workspaceActionJournalPathMatches(entry.path, filter) ||
    (filter.includeToPath === true && workspaceActionJournalPathMatches(entry.toPath, filter))
  );
}

function workspaceActionJournalPathMatches(
  path: WorkspaceActionJournalEntry['path'],
  filter: NonNullable<ListWorkspaceActionJournalInput['affectedPath']>,
): boolean {
  if (path === undefined) return false;
  if (filter.rootId !== undefined && path.rootId !== filter.rootId) return false;
  if (filter.path !== undefined && path.path !== filter.path) return false;
  if (filter.relativePath !== undefined && path.relativePath !== filter.relativePath) return false;
  return true;
}

function workspaceActionJournalPathFilterHasSelector(
  filter: NonNullable<ListWorkspaceActionJournalInput['affectedPath']>,
): boolean {
  return filter.rootId !== undefined || filter.path !== undefined || filter.relativePath !== undefined;
}

function assertWorkspaceActionKindMatches(record: WorkspaceActionJournalEntry): void {
  const action = record.action;
  if (action && typeof action === 'object' && !Array.isArray(action) && 'kind' in action) {
    const actionKind = (action as { kind?: unknown }).kind;
    if (actionKind !== undefined && actionKind !== record.actionKind) {
      throw new Error(`Workspace action journal kind mismatch: ${String(actionKind)} != ${record.actionKind}`);
    }
  }
}

function assertWorkspaceActionTraceScope(record: WorkspaceActionJournalEntry): void {
  if (record.spanId !== undefined && record.traceId === undefined) {
    throw new Error('Workspace action journal spanId requires traceId');
  }
}

function cloneJsonRecord(value: Record<string, JsonValue>): Record<string, JsonValue> {
  return JSON.parse(JSON.stringify(value)) as Record<string, JsonValue>;
}
