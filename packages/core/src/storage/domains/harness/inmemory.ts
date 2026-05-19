import { createHash, randomUUID } from 'node:crypto';

import type { InMemoryDB } from '../inmemory-db';
import {
  HarnessStorage,
  HarnessStorageAdmissionConflictError,
  HarnessStorageAttachmentInUseError,
  HarnessStorageAttachmentUnavailableError,
  HarnessStorageChannelActionClaimConflictError,
  HarnessStorageChannelActionReceiptTransitionError,
  HarnessStorageChannelActionTokenConflictError,
  HarnessStorageChannelInboxClaimConflictError,
  HarnessStorageChannelInboxTransitionError,
  HarnessStorageChannelOutboxClaimConflictError,
  HarnessStorageChannelOutboxTransitionError,
  HarnessStorageDeleteGuardConflictError,
  HarnessStorageLeaseConflictError,
  HarnessStorageParentSessionUnavailableError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageThreadDeleteFenceConflictError,
  HarnessStorageVersionConflictError,
} from './base';
import type { WriteMessageResultEvidenceResult } from './base';
import type {
  AcquireSessionLeaseInput,
  AgentSignalResultEvidence,
  AgentSignalResultStatus,
  AttachmentReference,
  AttachmentRecord,
  AttachmentSemanticMetadata,
  ChannelActionReceipt,
  ChannelActionToken,
  ChannelInboxItem,
  ChannelOutboxItem,
  ChannelProviderDeliveryReceipt,
  CreateOrLoadActiveSessionOptions,
  CreateOrLoadChannelActionReceiptResult,
  CreateOrLoadChannelActionTokenResult,
  CreateOrLoadChannelInboxItemResult,
  CreateOrLoadActiveSessionResult,
  DeleteSessionOptions,
  ListActiveSessionsByThreadInput,
  ListSessionsByThreadInput,
  ListSessionsInput,
  LoadedAttachment,
  JsonValue,
  OperationAdmissionEvidence,
  OperationAdmissionTombstone,
  QueueAdmissionReceipt,
  ReleaseSessionLeaseInput,
  RenewSessionLeaseInput,
  SaveAttachmentReferenceInput,
  SaveAttachmentInput,
  SaveAttachmentResult,
  SaveSessionOptions,
  SaveSessionResult,
  SessionLeaseResult,
  SessionRecord,
  SessionSummary,
  ThreadDeleteFenceLease,
  WithThreadDeleteFenceInput,
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

  constructor({ db, harnessName = 'default' }: { db: InMemoryDB; harnessName?: string }) {
    super();
    this.db = db;
    this.harnessName = harnessName;
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
      if (record.closedAt !== undefined) continue;
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
    const stored: SessionRecord = {
      ...record,
      harnessName,
      version: nextVersion,
      // Preserve current lease metadata — `saveSession` does not mutate it.
      ownerId: existing?.ownerId,
      leaseExpiresAt: existing?.leaseExpiresAt,
    };

    this.db.harnessSessions.set(sessionKey(harnessName, record.id), cloneSessionRecord(stored));
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
    const stored: SessionRecord = {
      ...record,
      harnessName,
      version: nextVersion,
      ownerId: existing.ownerId,
      leaseExpiresAt: existing.leaseExpiresAt,
    };
    this.db.harnessSessions.set(sessionKey(harnessName, record.id), cloneSessionRecord(stored));
    for (const ref of references) {
      this.db.harnessAttachmentReferences.set(attachmentReferenceKey({ ...ref, harnessName }), {
        source: ref.source,
        sourceId: ref.sourceId,
        ...(ref.retainedUntil !== undefined ? { retainedUntil: ref.retainedUntil } : {}),
      });
    }
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
      if (existing.closedAt !== undefined) continue;
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
        throw new HarnessStorageParentSessionUnavailableError(record.parentSessionId, 'closing');
      }
    }

    const key = sessionKey(namespace, record.id);
    const existingById = this.db.harnessSessions.get(key);
    if (existingById) {
      throw new HarnessStorageVersionConflictError(record.id, 0, existingById.version);
    }

    const expiresAt = storageNow + opts.initialLease.ttlMs;
    const stored: SessionRecord = {
      ...record,
      harnessName: namespace,
      version: 1,
      ownerId: opts.initialLease.ownerId,
      leaseExpiresAt: expiresAt,
    };
    this.db.harnessSessions.set(key, cloneSessionRecord(stored));
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
      existingSessions.set(sessionKey(namespace, sessionId), { namespace, sessionId, record: existing });
    }

    for (const { namespace, sessionId } of existingSessions.values()) {
      this.db.harnessSessions.delete(sessionKey(namespace, sessionId));
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
  }): Promise<AgentSignalResultStatus | OperationAdmissionTombstone | null> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const retained = this.db.harnessMessageResultEvidence.get(messageEvidenceKey(namespace, sessionId, signalId));
    if (retained && retained.resourceId === resourceId && retained.threadId === threadId) {
      return cloneJson(retained);
    }
    const tombstone = this.findTombstone(
      t =>
        t.harnessName === namespace &&
        t.kind === 'message' &&
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
    if (existing && !sameMessageEvidenceIdentity(existing, namespacedRecord)) {
      throw new HarnessStorageAdmissionConflictError(
        namespacedRecord.sessionId,
        'message',
        namespacedRecord.admissionId ?? namespacedRecord.signalId,
      );
    }
    if (existing && isTerminalMessageEvidence(existing)) {
      return { created: false, evidence: cloneJson(existing) };
    }
    const stored = {
      ...namespacedRecord,
      createdAt: existing?.createdAt ?? namespacedRecord.createdAt,
    };
    this.db.harnessMessageResultEvidence.set(key, cloneJson(stored));
    return existing === undefined ? { created: true } : { created: false, evidence: cloneJson(stored) };
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
    kind: 'message' | 'queue';
    admissionId: string;
    attemptedAdmissionHash: string;
  }): Promise<{
    status: 'none' | 'duplicate' | 'conflict';
    evidence?: OperationAdmissionEvidence;
    storedAdmissionHash?: string;
  }> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    if (kind === 'message') {
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
    kind: 'message' | 'queue';
    signalId?: string;
    queuedItemId?: string;
    now: number;
  }): Promise<OperationAdmissionTombstone | null> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    if (kind === 'message') {
      const key = signalId ? messageEvidenceKey(namespace, sessionId, signalId) : undefined;
      const retained = key ? this.db.harnessMessageResultEvidence.get(key) : undefined;
      if (!retained || retained.resourceId !== resourceId || retained.status === 'pending') return null;
      const tombstone: OperationAdmissionTombstone = {
        kind: 'message',
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
    const next = { ...record, harnessName: namespace };
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
    const next = { ...record, harnessName: namespace };
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
  // Test-only
  // -------------------------------------------------------------------------

  async dangerouslyClearAll(): Promise<void> {
    this.db.harnessSessions.clear();
    this.db.harnessAttachmentRecords.clear();
    this.db.harnessAttachmentBytes.clear();
    this.db.harnessAttachmentReferences.clear();
    this.db.harnessMessageResultEvidence.clear();
    this.db.harnessOperationTombstones.clear();
    this.db.harnessChannelInbox.clear();
    this.db.harnessChannelActionTokens.clear();
    this.db.harnessChannelActionReceipts.clear();
    this.db.harnessChannelOutbox.clear();
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
  const publicId = record.kind === 'message' ? record.signalId : record.queuedItemId;
  return `${record.harnessName}\u0000${record.sessionId}\u0000${record.kind}\u0000${publicId ?? record.admissionId ?? record.compactedAt}`;
}

function messageEvidenceKey(harnessName: string, sessionId: string, signalId: string): string {
  return `${harnessName}\u0000${sessionId}\u0000${signalId}`;
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

function resolveHarnessName(input: string | undefined, fallback: string): string {
  return input ?? fallback;
}

function cloneSessionRecord(record: SessionRecord): SessionRecord {
  return cloneJson(record);
}

function cloneJson<T>(value: T): T {
  return structuredClone(value);
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

function isTerminalMessageEvidence(record: AgentSignalResultEvidence): boolean {
  return record.status === 'completed' || record.status === 'failed';
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
      (record.delivery !== 'message' && record.delivery !== 'queue') ||
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
    (record.delivery !== 'message' || !record.runId || !record.signalId || record.acceptedAt == null)
  ) {
    throw new HarnessStorageChannelInboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'accepted rows require message delivery, runId, signalId, and acceptedAt',
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
    record.lastError ? stableJsonString(record.lastError) : undefined,
  ];
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

function cloneJsonRecord(value: Record<string, JsonValue>): Record<string, JsonValue> {
  return JSON.parse(JSON.stringify(value)) as Record<string, JsonValue>;
}
