import { createHash } from 'node:crypto';

import type { InMemoryDB } from '../inmemory-db';
import {
  HarnessStorage,
  HarnessStorageAdmissionConflictError,
  HarnessStorageAttachmentInUseError,
  HarnessStorageAttachmentUnavailableError,
  HarnessStorageLeaseConflictError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageVersionConflictError,
} from './base';
import type {
  AcquireSessionLeaseInput,
  AgentSignalResultStatus,
  AttachmentReference,
  AttachmentRecord,
  CreateOrLoadActiveSessionOptions,
  CreateOrLoadActiveSessionResult,
  ListSessionsInput,
  LoadedAttachment,
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
      for (const active of this.db.harnessSessions.values()) {
        if (active.harnessName !== harnessName) continue;
        if (active.resourceId !== record.resourceId || active.threadId !== record.threadId) continue;
        if (active.closedAt !== undefined) continue;
        throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, active.version);
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

  async deleteSession({ sessionId, harnessName }: { sessionId: string; harnessName?: string }): Promise<void> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    const existing = this.db.harnessSessions.get(sessionKey(namespace, sessionId));
    if (existing) {
      await this.deleteOperationAdmissionTombstonesForSession({
        harnessName: namespace,
        sessionId,
        resourceId: existing.resourceId,
      });
    }
    const refPrefix = `${namespace}\u0000${sessionId}\u0000`;
    for (const key of this.db.harnessAttachmentReferences.keys()) {
      if (key.startsWith(refPrefix)) {
        this.db.harnessAttachmentReferences.delete(key);
      }
    }
    this.db.harnessSessions.delete(sessionKey(namespace, sessionId));
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
    kind,
    admissionId,
    attemptedAdmissionHash,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    kind: 'message' | 'queue';
    admissionId: string;
    attemptedAdmissionHash: string;
  }): Promise<{
    status: 'none' | 'duplicate' | 'conflict';
    evidence?: OperationAdmissionEvidence;
    storedAdmissionHash?: string;
  }> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    if (kind === 'queue') {
      const session = this.db.harnessSessions.get(sessionKey(namespace, sessionId));
      if (session && session.resourceId !== resourceId) return { status: 'none' };
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
      return (
        this.findTombstone(
          t =>
            t.harnessName === namespace &&
            t.sessionId === sessionId &&
            t.resourceId === resourceId &&
            t.kind === 'message' &&
            t.signalId === signalId &&
            t.compactedAt <= now,
        ) ?? null
      );
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
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
  }): Promise<void> {
    const namespace = resolveHarnessName(harnessName, this.harnessName);
    for (const [key, tombstone] of this.db.harnessOperationTombstones) {
      if (
        tombstone.harnessName === namespace &&
        tombstone.sessionId === sessionId &&
        tombstone.resourceId === resourceId
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
    this.db.harnessOperationTombstones.clear();
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
