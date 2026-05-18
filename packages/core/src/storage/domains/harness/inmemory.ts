import { createHash, randomUUID } from 'node:crypto';

import type { InMemoryDB } from '../inmemory-db';
import {
  HarnessStorage,
  HarnessStorageAdmissionConflictError,
  HarnessStorageAttachmentInUseError,
  HarnessStorageAttachmentUnavailableError,
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
  CreateOrLoadActiveSessionOptions,
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
    this.db.harnessMessageResultEvidence.set(
      key,
      cloneJson(stored),
    );
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
