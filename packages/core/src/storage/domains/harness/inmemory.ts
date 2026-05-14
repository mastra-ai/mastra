import { createHash } from 'node:crypto';

import type { InMemoryDB } from '../inmemory-db';
import {
  HarnessStorage,
  HarnessStorageAttachmentInUseError,
  HarnessStorageAttachmentUnavailableError,
  HarnessStorageLeaseConflictError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageVersionConflictError,
} from './base';
import type {
  AcquireSessionLeaseInput,
  AttachmentReference,
  AttachmentRecord,
  ListSessionsInput,
  LoadedAttachment,
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

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  // -------------------------------------------------------------------------
  // Session records
  // -------------------------------------------------------------------------

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
    }

    const nextVersion = opts.ifVersion + 1;
    const stored: SessionRecord = {
      ...record,
      version: nextVersion,
      // Preserve current lease metadata — `saveSession` does not mutate it.
      ownerId: existing?.ownerId,
      leaseExpiresAt: existing?.leaseExpiresAt,
    };

    this.db.harnessSessions.set(record.id, stored);
    return { version: nextVersion };
  }

  async saveSessionWithAttachmentReferences(
    record: SessionRecord,
    opts: SaveSessionOptions,
    references: SaveAttachmentReferenceInput[],
  ): Promise<SaveSessionResult> {
    const existing = this.db.harnessSessions.get(record.id);

    if (existing) {
      assertLeaseHolder(existing, opts.ownerId);

      if (existing.version !== opts.ifVersion) {
        throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, existing.version);
      }
    } else {
      throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, 0);
    }

    for (const ref of references) {
      if (!this.db.harnessAttachmentRecords.has(attachmentKey(ref.sessionId, ref.attachmentId))) {
        throw new HarnessStorageAttachmentUnavailableError(ref.sessionId, ref.attachmentId);
      }
    }

    const nextVersion = opts.ifVersion + 1;
    const stored: SessionRecord = {
      ...record,
      version: nextVersion,
      ownerId: existing.ownerId,
      leaseExpiresAt: existing.leaseExpiresAt,
    };
    this.db.harnessSessions.set(record.id, stored);
    for (const ref of references) {
      this.db.harnessAttachmentReferences.set(attachmentReferenceKey(ref), {
        source: ref.source,
        sourceId: ref.sourceId,
        ...(ref.retainedUntil !== undefined ? { retainedUntil: ref.retainedUntil } : {}),
      });
    }
    return { version: nextVersion };
  }

  async deleteSession({ sessionId }: { sessionId: string }): Promise<void> {
    this.db.harnessSessions.delete(sessionId);
    await this.deleteAttachmentsForSession({ sessionId });
  }

  // -------------------------------------------------------------------------
  // Session leases
  // -------------------------------------------------------------------------

  async acquireSessionLease({ sessionId, ownerId, ttlMs }: AcquireSessionLeaseInput): Promise<SessionLeaseResult> {
    const existing = this.db.harnessSessions.get(sessionId);
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

    // No-op if we're not the current owner — the spec calls this out:
    // "the common cause is 'we noticed our lease expired and another instance
    // picked it up'".
    if (existing.ownerId !== ownerId) return;

    const updated: SessionRecord = { ...existing, ownerId: undefined, leaseExpiresAt: undefined };
    this.db.harnessSessions.set(sessionId, updated);
  }

  // -------------------------------------------------------------------------
  // Attachments
  // -------------------------------------------------------------------------

  async saveAttachment({
    sessionId,
    attachmentId,
    name,
    mimeType,
    source,
    data,
  }: SaveAttachmentInput): Promise<SaveAttachmentResult> {
    const key = attachmentKey(sessionId, attachmentId);
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
  }: {
    sessionId: string;
    attachmentId: string;
  }): Promise<LoadedAttachment | null> {
    const key = attachmentKey(sessionId, attachmentId);
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

  async deleteAttachment({ sessionId, attachmentId }: { sessionId: string; attachmentId: string }): Promise<void> {
    const references = await this.listAttachmentReferences({ sessionId, attachmentId });
    if (references.length > 0) {
      throw new HarnessStorageAttachmentInUseError(sessionId, attachmentId, references);
    }
    const key = attachmentKey(sessionId, attachmentId);
    this.db.harnessAttachmentRecords.delete(key);
    this.db.harnessAttachmentBytes.delete(key);
  }

  async deleteAttachmentsForSession({ sessionId }: { sessionId: string }): Promise<void> {
    const prefix = `${sessionId}\u0000`;
    for (const key of this.db.harnessAttachmentRecords.keys()) {
      if (key.startsWith(prefix)) {
        const [, attachmentId] = splitAttachmentKey(key);
        const references = await this.listAttachmentReferences({ sessionId, attachmentId });
        if (references.length > 0) continue;
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

  async recordAttachmentReferences(references: SaveAttachmentReferenceInput[]): Promise<void> {
    for (const ref of references) {
      this.db.harnessAttachmentReferences.set(attachmentReferenceKey(ref), {
        source: ref.source,
        sourceId: ref.sourceId,
        ...(ref.retainedUntil !== undefined ? { retainedUntil: ref.retainedUntil } : {}),
      });
    }
  }

  async deleteAttachmentReferences(references: SaveAttachmentReferenceInput[]): Promise<void> {
    for (const ref of references) {
      this.db.harnessAttachmentReferences.delete(attachmentReferenceKey(ref));
    }
  }

  async listAttachmentReferences({
    sessionId,
    attachmentId,
  }: {
    sessionId: string;
    attachmentId: string;
  }): Promise<AttachmentReference[]> {
    const prefix = `${sessionId}\u0000${attachmentId}\u0000`;
    const refs: AttachmentReference[] = [];
    for (const [key, ref] of this.db.harnessAttachmentReferences) {
      if (key.startsWith(prefix)) refs.push({ ...ref });
    }
    return refs.sort((a, b) => a.source.localeCompare(b.source) || a.sourceId.localeCompare(b.sourceId));
  }

  // -------------------------------------------------------------------------
  // Test-only
  // -------------------------------------------------------------------------

  async dangerouslyClearAll(): Promise<void> {
    this.db.harnessSessions.clear();
    this.db.harnessAttachmentRecords.clear();
    this.db.harnessAttachmentBytes.clear();
    this.db.harnessAttachmentReferences.clear();
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
function attachmentKey(ownerSessionId: string, attachmentId: string): string {
  return `${ownerSessionId}\u0000${attachmentId}`;
}

function splitAttachmentKey(key: string): [string, string] {
  const [ownerSessionId = '', attachmentId = ''] = key.split('\u0000');
  return [ownerSessionId, attachmentId];
}

function attachmentReferenceKey(ref: SaveAttachmentReferenceInput): string {
  return `${ref.sessionId}\u0000${ref.attachmentId}\u0000${ref.source}\u0000${ref.sourceId}`;
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
