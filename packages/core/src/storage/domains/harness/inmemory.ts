import type { InMemoryDB } from '../inmemory-db';
import {
  HarnessStorage,
  HarnessStorageAdmissionConflictError,
  HarnessStorageLeaseConflictError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageVersionConflictError,
} from './base';
import type { WriteMessageResultEvidenceResult } from './base';
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

/**
 * In-memory `HarnessStorage` adapter - backs onto the shared `InMemoryDB`
 * Maps so it composes naturally with the other in-memory domains.
 *
 * Records are stored by reference; reads return the live row, callers should
 * treat returned `SessionRecord`s as read-only and pass a fresh object to
 * `saveSession` for updates. This matches the pattern used by `InMemoryMemory`.
 */
export class InMemoryHarness extends HarnessStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async loadSession({ sessionId }: { sessionId: string }): Promise<SessionRecord | null> {
    return this.db.harnessSessions.get(sessionId) ?? null;
  }

  async loadSessionByThread({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId: string;
  }): Promise<SessionRecord | null> {
    let candidate: SessionRecord | null = null;
    for (const record of this.db.harnessSessions.values()) {
      if (record.threadId !== threadId || record.resourceId !== resourceId) continue;
      if (record.closedAt !== undefined) continue;
      if (candidate === null || record.lastActivityAt > candidate.lastActivityAt) {
        candidate = record;
      }
    }
    return candidate;
  }

  async listSessions({
    resourceId,
    includeClosed = false,
    parentSessionId,
  }: ListSessionsInput): Promise<SessionSummary[]> {
    const matched: SessionRecord[] = [];
    for (const record of this.db.harnessSessions.values()) {
      if (record.resourceId !== resourceId) continue;
      if (!includeClosed && record.closedAt !== undefined) continue;
      if (parentSessionId !== undefined && record.parentSessionId !== parentSessionId) continue;
      matched.push(record);
    }
    matched.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    return matched.map(toSummary);
  }

  async saveSession(record: SessionRecord, opts: SaveSessionOptions): Promise<SaveSessionResult> {
    const existing = this.db.harnessSessions.get(record.id);

    if (existing) {
      assertLeaseHolder(existing, opts.ownerId);

      if (existing.version !== opts.ifVersion) {
        throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, existing.version);
      }
    } else if (opts.ifVersion !== 0) {
      throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, 0);
    }

    const nextVersion = opts.ifVersion + 1;
    const stored: SessionRecord = {
      ...record,
      version: nextVersion,
      // Preserve current lease metadata - `saveSession` does not mutate it.
      ownerId: existing?.ownerId,
      leaseExpiresAt: existing?.leaseExpiresAt,
    };

    this.db.harnessSessions.set(record.id, stored);
    return { version: nextVersion };
  }

  async deleteSession({ sessionId }: { sessionId: string }): Promise<void> {
    this.db.harnessSessions.delete(sessionId);
    await this.deleteAttachmentsForSession({ sessionId });
    this.deleteAdmissionEvidenceForSession({ sessionId });
  }

  async acquireSessionLease({ sessionId, ownerId, ttlMs }: AcquireSessionLeaseInput): Promise<SessionLeaseResult> {
    const existing = this.db.harnessSessions.get(sessionId);
    if (!existing) throw new HarnessStorageSessionNotFoundError(sessionId);

    const now = Date.now();
    const heldBy = existing.ownerId;
    const heldUntil = existing.leaseExpiresAt;
    const leaseHeld = heldBy !== undefined && heldUntil !== undefined && heldUntil > now;

    if (leaseHeld && heldBy !== ownerId) {
      throw new HarnessStorageLeaseConflictError(sessionId, heldBy, heldUntil);
    }

    const expiresAt = now + ttlMs;
    const updated: SessionRecord = {
      ...existing,
      ownerId,
      leaseExpiresAt: expiresAt,
    };
    this.db.harnessSessions.set(sessionId, updated);
    return { version: existing.version, expiresAt };
  }

  async renewSessionLease({ sessionId, ownerId, ttlMs }: RenewSessionLeaseInput): Promise<SessionLeaseResult> {
    const existing = this.db.harnessSessions.get(sessionId);
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
    this.db.harnessSessions.set(sessionId, updated);
    return { version: existing.version, expiresAt };
  }

  async releaseSessionLease({ sessionId, ownerId }: ReleaseSessionLeaseInput): Promise<void> {
    const existing = this.db.harnessSessions.get(sessionId);
    if (!existing) throw new HarnessStorageSessionNotFoundError(sessionId);

    if (existing.ownerId !== ownerId) return;

    const updated: SessionRecord = { ...existing, ownerId: undefined, leaseExpiresAt: undefined };
    this.db.harnessSessions.set(sessionId, updated);
  }

  async saveAttachment({ sessionId, attachmentId, name, mimeType, data }: SaveAttachmentInput): Promise<void> {
    const key = attachmentKey(sessionId, attachmentId);
    const record: AttachmentRecord = {
      attachmentId,
      sessionId,
      name,
      mimeType,
      sizeBytes: data.byteLength,
      createdAt: Date.now(),
    };
    this.db.harnessAttachmentRecords.set(key, record);
    // Copy the bytes so callers can reuse their buffer.
    this.db.harnessAttachmentBytes.set(key, new Uint8Array(data));
  }

  async loadAttachment({
    sessionId,
    attachmentId,
  }: {
    sessionId: string;
    attachmentId: string;
  }): Promise<LoadedAttachment | null> {
    const key = attachmentKey(sessionId, attachmentId);
    const record = this.db.harnessAttachmentRecords.get(key);
    const bytes = this.db.harnessAttachmentBytes.get(key);
    if (!record || !bytes) return null;
    return { name: record.name, mimeType: record.mimeType, data: new Uint8Array(bytes) };
  }

  async deleteAttachment({ sessionId, attachmentId }: { sessionId: string; attachmentId: string }): Promise<void> {
    const key = attachmentKey(sessionId, attachmentId);
    this.db.harnessAttachmentRecords.delete(key);
    this.db.harnessAttachmentBytes.delete(key);
  }

  async deleteAttachmentsForSession({ sessionId }: { sessionId: string }): Promise<void> {
    const prefix = `${sessionId}\u0000`;
    for (const key of this.db.harnessAttachmentRecords.keys()) {
      if (key.startsWith(prefix)) {
        this.db.harnessAttachmentRecords.delete(key);
        this.db.harnessAttachmentBytes.delete(key);
      }
    }
  }

  async getAttachmentRecord({
    sessionId,
    attachmentId,
  }: {
    sessionId: string;
    attachmentId: string;
  }): Promise<AttachmentRecord | null> {
    return this.db.harnessAttachmentRecords.get(attachmentKey(sessionId, attachmentId)) ?? null;
  }

  async loadMessageResultEvidence({
    sessionId,
    resourceId,
    threadId,
    signalId,
  }: {
    sessionId: string;
    resourceId: string;
    threadId: string;
    signalId: string;
  }): Promise<AgentSignalResultStatus | OperationAdmissionTombstone | null> {
    const retained = this.db.harnessMessageResultEvidence.get(messageEvidenceKey(sessionId, signalId));
    if (retained && retained.resourceId === resourceId && retained.threadId === threadId) {
      return clone(retained);
    }
    const tombstone = this.findTombstone(
      t =>
        t.kind === 'message' &&
        t.sessionId === sessionId &&
        t.resourceId === resourceId &&
        t.threadId === threadId &&
        t.signalId === signalId,
    );
    return tombstone ? clone(tombstone) : null;
  }

  async writeMessageResultEvidence(record: AgentSignalResultEvidence): Promise<WriteMessageResultEvidenceResult> {
    const key = messageEvidenceKey(record.sessionId, record.signalId);
    if (record.admissionId !== undefined) {
      for (const [existingKey, existing] of this.db.harnessMessageResultEvidence) {
        if (existingKey === key) continue;
        if (
          existing.sessionId !== record.sessionId ||
          existing.resourceId !== record.resourceId ||
          existing.threadId !== record.threadId ||
          existing.admissionId !== record.admissionId
        ) {
          continue;
        }
        if (existing.admissionHash !== record.admissionHash) {
          throw new HarnessStorageAdmissionConflictError(record.sessionId, 'message', record.admissionId);
        }
        return { created: false, evidence: clone(existing) };
      }

      const tombstone = this.findTombstone(
        existing =>
          existing.kind === 'message' &&
          existing.sessionId === record.sessionId &&
          existing.resourceId === record.resourceId &&
          existing.threadId === record.threadId &&
          existing.admissionId === record.admissionId,
      );
      if (tombstone) {
        if (tombstone.admissionHash !== record.admissionHash) {
          throw new HarnessStorageAdmissionConflictError(record.sessionId, 'message', record.admissionId);
        }
        return { created: false, evidence: clone(tombstone) };
      }
    }
    const existing = this.db.harnessMessageResultEvidence.get(key);
    if (existing && !sameMessageEvidenceIdentity(existing, record)) {
      throw new HarnessStorageAdmissionConflictError(
        record.sessionId,
        'message',
        record.admissionId ?? record.signalId,
      );
    }
    if (existing && isTerminalMessageEvidence(existing)) {
      return { created: false, evidence: clone(existing) };
    }
    const stored = {
      ...record,
      createdAt: existing?.createdAt ?? record.createdAt,
    };
    this.db.harnessMessageResultEvidence.set(key, clone(stored));
    return existing === undefined ? { created: true } : { created: false, evidence: clone(stored) };
  }

  async loadQueueResultEvidence({
    sessionId,
    resourceId,
    queuedItemId,
  }: {
    sessionId: string;
    resourceId: string;
    queuedItemId: string;
  }): Promise<QueueAdmissionReceipt | OperationAdmissionTombstone | null> {
    const session = this.db.harnessSessions.get(sessionId);
    if (session && session.resourceId !== resourceId) return null;
    const receipt = session?.queueAdmissionReceipts?.[queuedItemId];
    if (receipt) return clone(receipt);
    const tombstone = this.findTombstone(
      t =>
        t.kind === 'queue' &&
        t.sessionId === sessionId &&
        t.resourceId === resourceId &&
        t.queuedItemId === queuedItemId,
    );
    return tombstone ? clone(tombstone) : null;
  }

  async resolveOperationAdmissionEvidence({
    sessionId,
    resourceId,
    threadId,
    kind,
    admissionId,
    attemptedAdmissionHash,
  }: {
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
    if (kind === 'message') {
      for (const evidence of this.db.harnessMessageResultEvidence.values()) {
        if (
          evidence.sessionId !== sessionId ||
          evidence.resourceId !== resourceId ||
          (threadId !== undefined && evidence.threadId !== threadId) ||
          evidence.admissionId !== admissionId
        ) {
          continue;
        }
        if (evidence.admissionHash !== attemptedAdmissionHash) {
          return { status: 'conflict', evidence: clone(evidence), storedAdmissionHash: evidence.admissionHash };
        }
        return { status: 'duplicate', evidence: clone(evidence), storedAdmissionHash: evidence.admissionHash };
      }
    }

    if (kind === 'queue') {
      const session = this.db.harnessSessions.get(sessionId);
      if (session && (session.resourceId !== resourceId || (threadId !== undefined && session.threadId !== threadId))) {
        return { status: 'none' };
      }
      for (const receipt of Object.values(session?.queueAdmissionReceipts ?? {})) {
        if (receipt.admissionId !== admissionId) continue;
        if (receipt.admissionHash !== attemptedAdmissionHash) {
          return { status: 'conflict', evidence: clone(receipt), storedAdmissionHash: receipt.admissionHash };
        }
        return { status: 'duplicate', evidence: clone(receipt), storedAdmissionHash: receipt.admissionHash };
      }
    }

    const tombstone = this.findTombstone(
      t =>
        t.sessionId === sessionId &&
        t.resourceId === resourceId &&
        (threadId === undefined || t.threadId === threadId) &&
        t.kind === kind &&
        t.admissionId === admissionId,
    );
    if (!tombstone) return { status: 'none' };
    if (tombstone.admissionHash !== attemptedAdmissionHash) {
      return { status: 'conflict', evidence: clone(tombstone), storedAdmissionHash: tombstone.admissionHash };
    }
    return { status: 'duplicate', evidence: clone(tombstone), storedAdmissionHash: tombstone.admissionHash };
  }

  async writeOperationAdmissionTombstone(record: OperationAdmissionTombstone): Promise<void> {
    this.writeOperationAdmissionTombstoneSync(record);
  }

  private writeOperationAdmissionTombstoneSync(record: OperationAdmissionTombstone): void {
    const key = tombstoneKey(record);
    if (record.admissionId !== undefined) {
      for (const [existingKey, existing] of this.db.harnessOperationTombstones) {
        if (existingKey === key) continue;
        if (
          existing.sessionId !== record.sessionId ||
          existing.resourceId !== record.resourceId ||
          existing.threadId !== record.threadId ||
          existing.kind !== record.kind ||
          existing.admissionId !== record.admissionId
        ) {
          continue;
        }
        if (existing.admissionHash !== record.admissionHash) {
          throw new HarnessStorageAdmissionConflictError(record.sessionId, record.kind, record.admissionId);
        }
        return;
      }
    }
    const existing = this.db.harnessOperationTombstones.get(key);
    if (existing && !sameTombstoneIdentity(existing, record)) {
      throw new HarnessStorageAdmissionConflictError(record.sessionId, record.kind, record.admissionId ?? key);
    }
    this.db.harnessOperationTombstones.set(key, clone(record));
  }

  async compactOperationResultEvidence({
    sessionId,
    resourceId,
    kind,
    signalId,
    queuedItemId,
    now,
  }: {
    sessionId: string;
    resourceId: string;
    kind: 'message' | 'queue';
    signalId?: string;
    queuedItemId?: string;
    now: number;
  }): Promise<OperationAdmissionTombstone | null> {
    if (kind === 'message') {
      const key = signalId ? messageEvidenceKey(sessionId, signalId) : undefined;
      const retained = key ? this.db.harnessMessageResultEvidence.get(key) : undefined;
      if (!retained || retained.resourceId !== resourceId || retained.status === 'pending') return null;
      const tombstone: OperationAdmissionTombstone = {
        kind: 'message',
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
      this.writeOperationAdmissionTombstoneSync(tombstone);
      this.db.harnessMessageResultEvidence.delete(messageEvidenceKey(sessionId, retained.signalId));
      return clone(tombstone);
    }

    const session = this.db.harnessSessions.get(sessionId);
    if (session && session.resourceId !== resourceId) return null;
    const receipt = queuedItemId ? session?.queueAdmissionReceipts?.[queuedItemId] : undefined;
    if (!session || !receipt) return null;
    if (!isTerminalQueueReceipt(receipt)) return null;
    const tombstone: OperationAdmissionTombstone = {
      kind: 'queue',
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
    this.writeOperationAdmissionTombstoneSync(tombstone);
    const nextReceipts = { ...(session.queueAdmissionReceipts ?? {}) };
    delete nextReceipts[queuedItemId!];
    this.db.harnessSessions.set(sessionId, {
      ...session,
      queueAdmissionReceipts: Object.keys(nextReceipts).length > 0 ? nextReceipts : undefined,
      version: session.version + 1,
    });
    return clone(tombstone);
  }

  async deleteOperationAdmissionTombstonesForSession({
    sessionId,
    resourceId,
    threadId,
    signalId,
  }: {
    sessionId: string;
    resourceId: string;
    threadId?: string;
    signalId?: string;
  }): Promise<void> {
    for (const [key, evidence] of this.db.harnessMessageResultEvidence) {
      if (
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
        tombstone.sessionId === sessionId &&
        tombstone.resourceId === resourceId &&
        (threadId === undefined || tombstone.threadId === threadId) &&
        (signalId === undefined || tombstone.signalId === signalId)
      ) {
        this.db.harnessOperationTombstones.delete(key);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.harnessSessions.clear();
    this.db.harnessAttachmentRecords.clear();
    this.db.harnessAttachmentBytes.clear();
    this.db.harnessMessageResultEvidence.clear();
    this.db.harnessOperationTombstones.clear();
  }

  private deleteAdmissionEvidenceForSession({ sessionId }: { sessionId: string }): void {
    for (const [key, evidence] of this.db.harnessMessageResultEvidence) {
      if (evidence.sessionId === sessionId) {
        this.db.harnessMessageResultEvidence.delete(key);
      }
    }

    for (const [key, tombstone] of this.db.harnessOperationTombstones) {
      if (tombstone.sessionId === sessionId) {
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
}

function attachmentKey(sessionId: string, attachmentId: string): string {
  return `${sessionId}\u0000${attachmentId}`;
}

function messageEvidenceKey(sessionId: string, signalId: string): string {
  return `${sessionId}\u0000${signalId}`;
}

function tombstoneKey(record: OperationAdmissionTombstone): string {
  const publicId = record.kind === 'message' ? record.signalId : record.queuedItemId;
  return `${record.sessionId}\u0000${record.kind}\u0000${publicId ?? record.admissionId ?? record.compactedAt}`;
}

function isTerminalMessageEvidence(record: AgentSignalResultEvidence): boolean {
  return record.status === 'completed' || record.status === 'failed';
}

function isTerminalQueueReceipt(receipt: QueueAdmissionReceipt): boolean {
  return receipt.status === 'completed' || receipt.status === 'failed' || receipt.status === 'dead';
}

function sameMessageEvidenceIdentity(a: AgentSignalResultEvidence, b: AgentSignalResultEvidence): boolean {
  return (
    a.sessionId === b.sessionId &&
    a.resourceId === b.resourceId &&
    a.threadId === b.threadId &&
    a.signalId === b.signalId &&
    a.admissionId === b.admissionId &&
    a.admissionHash === b.admissionHash
  );
}

function sameTombstoneIdentity(a: OperationAdmissionTombstone, b: OperationAdmissionTombstone): boolean {
  return (
    a.kind === b.kind &&
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

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assertLeaseHolder(existing: SessionRecord, ownerId: string): void {
  if (existing.ownerId === undefined) return;
  const now = Date.now();
  if (existing.leaseExpiresAt !== undefined && existing.leaseExpiresAt <= now) return;
  if (existing.ownerId === ownerId) return;
  throw new HarnessStorageLeaseConflictError(existing.id, existing.ownerId, existing.leaseExpiresAt ?? 0);
}

function toSummary(record: SessionRecord): SessionSummary {
  return {
    id: record.id,
    resourceId: record.resourceId,
    threadId: record.threadId,
    parentSessionId: record.parentSessionId,
    origin: record.origin,
    modeId: record.modeId,
    modelId: record.modelId,
    lastActivityAt: record.lastActivityAt,
    closedAt: record.closedAt,
  };
}
