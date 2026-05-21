import { createHash } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InMemoryDB } from '../inmemory-db';
import {
  HarnessStorageAdmissionConflictError,
  HarnessStorageLeaseConflictError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageVersionConflictError,
} from './base';
import { InMemoryHarness } from './inmemory';
import type { SessionRecord } from './types';

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'session-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    origin: 'top-level',
    subagentDepth: 0,
    ownsThread: true,
    modeId: 'default',
    modelId: 'openai:gpt-4o-mini',
    subagentModelOverrides: {},
    permissionRules: { categories: {}, tools: {} },
    sessionGrants: { categories: [], tools: [] },
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    pendingQueue: [],
    state: {},
    createdAt: 1_000,
    lastActivityAt: 1_000,
    version: 0,
    ...overrides,
  };
}

describe('InMemoryHarness', () => {
  let db: InMemoryDB;
  let storage: InMemoryHarness;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new InMemoryHarness({ db });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves and loads a session with optimistic version increments', async () => {
    const record = makeSession();

    await expect(storage.saveSession(record, { ownerId: 'owner-1', ifVersion: 0 })).resolves.toEqual({ version: 1 });

    expect(await storage.loadSession({ sessionId: 'session-1' })).toEqual({ ...record, version: 1 });

    await expect(
      storage.saveSession({ ...record, state: { step: 2 }, version: 1 }, { ownerId: 'owner-1', ifVersion: 1 }),
    ).resolves.toEqual({ version: 2 });

    expect(await storage.loadSession({ sessionId: 'session-1' })).toMatchObject({
      id: 'session-1',
      state: { step: 2 },
      version: 2,
    });
  });

  it('rejects stale save versions', async () => {
    const record = makeSession();
    await storage.saveSession(record, { ownerId: 'owner-1', ifVersion: 0 });

    await expect(
      storage.saveSession({ ...record, version: 1 }, { ownerId: 'owner-1', ifVersion: 0 }),
    ).rejects.toBeInstanceOf(HarnessStorageVersionConflictError);

    await expect(
      storage.saveSession(makeSession({ id: 'new-session' }), { ownerId: 'owner-1', ifVersion: 2 }),
    ).rejects.toBeInstanceOf(HarnessStorageVersionConflictError);
  });

  it('enforces active leases on save', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    const record = makeSession();
    await storage.saveSession(record, { ownerId: 'owner-1', ifVersion: 0 });
    await storage.acquireSessionLease({ sessionId: 'session-1', ownerId: 'owner-1', ttlMs: 1_000 });

    await expect(
      storage.saveSession({ ...record, version: 1 }, { ownerId: 'owner-2', ifVersion: 1 }),
    ).rejects.toBeInstanceOf(HarnessStorageLeaseConflictError);

    vi.setSystemTime(11_001);

    await expect(
      storage.saveSession(
        { ...record, state: { afterExpiry: true }, version: 1 },
        { ownerId: 'owner-2', ifVersion: 1 },
      ),
    ).resolves.toEqual({ version: 2 });
  });

  it('acquires, renews, and releases session leases', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);

    await storage.saveSession(makeSession(), { ownerId: 'owner-1', ifVersion: 0 });

    await expect(
      storage.acquireSessionLease({ sessionId: 'missing', ownerId: 'owner-1', ttlMs: 100 }),
    ).rejects.toBeInstanceOf(HarnessStorageSessionNotFoundError);

    await expect(
      storage.acquireSessionLease({ sessionId: 'session-1', ownerId: 'owner-1', ttlMs: 100 }),
    ).resolves.toEqual({
      version: 1,
      expiresAt: 20_100,
    });

    await expect(
      storage.acquireSessionLease({ sessionId: 'session-1', ownerId: 'owner-2', ttlMs: 100 }),
    ).rejects.toBeInstanceOf(HarnessStorageLeaseConflictError);

    vi.setSystemTime(20_050);
    await expect(
      storage.renewSessionLease({ sessionId: 'session-1', ownerId: 'owner-1', ttlMs: 200 }),
    ).resolves.toEqual({
      version: 1,
      expiresAt: 20_250,
    });

    await storage.releaseSessionLease({ sessionId: 'session-1', ownerId: 'owner-2' });
    expect(await storage.loadSession({ sessionId: 'session-1' })).toMatchObject({
      ownerId: 'owner-1',
      leaseExpiresAt: 20_250,
    });

    await storage.releaseSessionLease({ sessionId: 'session-1', ownerId: 'owner-1' });
    expect(await storage.loadSession({ sessionId: 'session-1' })).toMatchObject({
      ownerId: undefined,
      leaseExpiresAt: undefined,
    });
  });

  it('rejects renew after the lease expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(30_000);

    await storage.saveSession(makeSession(), { ownerId: 'owner-1', ifVersion: 0 });
    await storage.acquireSessionLease({ sessionId: 'session-1', ownerId: 'owner-1', ttlMs: 100 });

    vi.setSystemTime(30_101);

    await expect(
      storage.renewSessionLease({ sessionId: 'session-1', ownerId: 'owner-1', ttlMs: 100 }),
    ).rejects.toBeInstanceOf(HarnessStorageLeaseConflictError);
  });

  it('loads the most recent active session for a thread and resource', async () => {
    await storage.saveSession(makeSession({ id: 'old-active', lastActivityAt: 1_000 }), {
      ownerId: 'owner-1',
      ifVersion: 0,
    });
    await storage.saveSession(makeSession({ id: 'new-active', lastActivityAt: 2_000 }), {
      ownerId: 'owner-1',
      ifVersion: 0,
    });
    await storage.saveSession(makeSession({ id: 'closed', lastActivityAt: 3_000, closedAt: 3_000 }), {
      ownerId: 'owner-1',
      ifVersion: 0,
    });
    await storage.saveSession(makeSession({ id: 'other-resource', resourceId: 'resource-2', lastActivityAt: 4_000 }), {
      ownerId: 'owner-1',
      ifVersion: 0,
    });

    expect(await storage.loadSessionByThread({ threadId: 'thread-1', resourceId: 'resource-1' })).toMatchObject({
      id: 'new-active',
    });
  });

  it('lists sessions by resource, parent, closed state, and activity order', async () => {
    await storage.saveSession(makeSession({ id: 'parent', lastActivityAt: 1_000 }), {
      ownerId: 'owner-1',
      ifVersion: 0,
    });
    await storage.saveSession(makeSession({ id: 'child-1', parentSessionId: 'parent', lastActivityAt: 3_000 }), {
      ownerId: 'owner-1',
      ifVersion: 0,
    });
    await storage.saveSession(
      makeSession({ id: 'child-2', parentSessionId: 'parent', lastActivityAt: 2_000, closedAt: 2_500 }),
      {
        ownerId: 'owner-1',
        ifVersion: 0,
      },
    );
    await storage.saveSession(makeSession({ id: 'other-resource', resourceId: 'resource-2', lastActivityAt: 4_000 }), {
      ownerId: 'owner-1',
      ifVersion: 0,
    });

    await expect(storage.listSessions({ resourceId: 'resource-1' })).resolves.toEqual([
      expect.objectContaining({ id: 'child-1' }),
      expect.objectContaining({ id: 'parent' }),
    ]);

    await expect(
      storage.listSessions({ resourceId: 'resource-1', parentSessionId: 'parent', includeClosed: true }),
    ).resolves.toEqual([expect.objectContaining({ id: 'child-1' }), expect.objectContaining({ id: 'child-2' })]);
  });

  it('stores attachment metadata and copied bytes', async () => {
    const data = new Uint8Array([1, 2, 3]);
    const expectedSha256 = createHash('sha256').update(data).digest('hex');
    await expect(
      storage.saveAttachment({
        sessionId: 'session-1',
        attachmentId: 'attachment-1',
        name: 'file.txt',
        mimeType: 'text/plain',
        source: 'preupload',
        data,
        semantic: { kind: 'primitive', primitiveType: 'selection', metadata: { label: 'Selected' } },
      }),
    ).resolves.toEqual({
      attachmentId: 'attachment-1',
      bytes: 3,
      sha256: expectedSha256,
    });
    await expect(
      storage.saveAttachment({
        sessionId: 'session-1',
        attachmentId: 'attachment-1',
        name: 'ignored.txt',
        mimeType: 'application/octet-stream',
        source: 'inline',
        data: new Uint8Array([9]),
      }),
    ).resolves.toEqual({
      attachmentId: 'attachment-1',
      bytes: 3,
      sha256: expectedSha256,
    });
    data[0] = 9;

    const loaded = await storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'attachment-1' });
    expect(loaded).toEqual({
      name: 'file.txt',
      mimeType: 'text/plain',
      bytes: 3,
      sha256: expectedSha256,
      data: new Uint8Array([1, 2, 3]),
      semantic: { kind: 'primitive', primitiveType: 'selection', metadata: { label: 'Selected' } },
    });

    loaded!.data[1] = 9;
    loaded!.semantic!.metadata!.label = 'Changed';
    await expect(
      storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'attachment-1' }),
    ).resolves.toMatchObject({
      data: new Uint8Array([1, 2, 3]),
      semantic: { metadata: { label: 'Selected' } },
    });

    await expect(
      storage.getAttachmentRecord({ sessionId: 'session-1', attachmentId: 'attachment-1' }),
    ).resolves.toEqual(
      expect.objectContaining({
        attachmentId: 'attachment-1',
        ownerSessionId: 'session-1',
        sessionId: 'session-1',
        name: 'file.txt',
        mimeType: 'text/plain',
        bytes: 3,
        sha256: expectedSha256,
        source: 'preupload',
        kind: 'primitive',
        primitiveType: 'selection',
        metadata: { label: 'Selected' },
      }),
    );
  });

  it('stores attachment bytes when semantic metadata is omitted', async () => {
    const data = new Uint8Array([1, 2, 3]);
    await storage.saveAttachment({
      sessionId: 'session-1',
      attachmentId: 'attachment-1',
      name: 'file.txt',
      mimeType: 'text/plain',
      source: 'preupload',
      data,
    });

    const loaded = await storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'attachment-1' });
    expect(loaded?.semantic).toBeUndefined();
  });

  it('deletes single attachments, session attachments, and attachments on session delete', async () => {
    await storage.saveSession(makeSession(), { ownerId: 'owner-1', ifVersion: 0 });
    await storage.saveAttachment({
      sessionId: 'session-1',
      attachmentId: 'a',
      name: 'a.txt',
      mimeType: 'text/plain',
      source: 'preupload',
      data: new Uint8Array([1]),
    });
    await storage.saveAttachment({
      sessionId: 'session-1',
      attachmentId: 'b',
      name: 'b.txt',
      mimeType: 'text/plain',
      source: 'preupload',
      data: new Uint8Array([2]),
    });

    await storage.deleteAttachment({ sessionId: 'session-1', attachmentId: 'a' });
    await expect(storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'a' })).resolves.toBeNull();
    await expect(storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'b' })).resolves.not.toBeNull();

    await storage.deleteSession({ sessionId: 'session-1' });
    await expect(storage.loadSession({ sessionId: 'session-1' })).resolves.toBeNull();
    await expect(storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'b' })).resolves.toBeNull();
  });

  it('deletes admission evidence on session delete', async () => {
    await storage.saveSession(makeSession(), { ownerId: 'owner-1', ifVersion: 0 });
    await storage.writeMessageResultEvidence({
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      signalId: 'signal-1',
      admissionId: 'admission-1',
      admissionHash: 'hash-1',
      status: 'pending',
      createdAt: 1_000,
      updatedAt: 1_000,
    });
    await storage.writeOperationAdmissionTombstone({
      kind: 'message',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      signalId: 'signal-2',
      admissionId: 'admission-2',
      admissionHash: 'hash-2',
      terminalAt: 1_100,
      compactedAt: 1_200,
      expiresAt: 1_300,
    });

    await storage.deleteSession({ sessionId: 'session-1' });

    await expect(
      storage.loadMessageResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        signalId: 'signal-1',
      }),
    ).resolves.toBeNull();
    await expect(
      storage.resolveOperationAdmissionEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        kind: 'message',
        admissionId: 'admission-2',
        attemptedAdmissionHash: 'hash-2',
      }),
    ).resolves.toEqual({ status: 'none' });
  });

  it('stores message admission evidence and detects duplicate admission hashes', async () => {
    const evidence = {
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      signalId: 'signal-1',
      admissionId: 'admission-1',
      admissionHash: 'hash-1',
      status: 'pending' as const,
      createdAt: 1_000,
      updatedAt: 1_000,
    };

    await expect(storage.writeMessageResultEvidence(evidence)).resolves.toEqual({ created: true });
    await expect(
      storage.writeMessageResultEvidence({
        ...evidence,
        status: 'completed',
        runId: 'run-1',
        result: { ok: true },
        updatedAt: 1_100,
      }),
    ).resolves.toMatchObject({
      created: false,
      evidence: { createdAt: 1_000, updatedAt: 1_100 },
    });

    await expect(
      storage.resolveOperationAdmissionEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        kind: 'message',
        admissionId: 'admission-1',
        attemptedAdmissionHash: 'hash-1',
      }),
    ).resolves.toMatchObject({ status: 'duplicate', storedAdmissionHash: 'hash-1' });

    await expect(
      storage.resolveOperationAdmissionEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        kind: 'message',
        admissionId: 'admission-1',
        attemptedAdmissionHash: 'hash-2',
      }),
    ).resolves.toMatchObject({ status: 'conflict', storedAdmissionHash: 'hash-1' });

    await expect(
      storage.writeMessageResultEvidence({
        ...evidence,
        signalId: 'signal-2',
        status: 'pending',
        updatedAt: 1_200,
      }),
    ).resolves.toMatchObject({
      created: false,
      evidence: { signalId: 'signal-1', admissionId: 'admission-1' },
    });

    await expect(storage.writeMessageResultEvidence({ ...evidence, admissionHash: 'hash-2' })).rejects.toBeInstanceOf(
      HarnessStorageAdmissionConflictError,
    );
    await expect(
      storage.writeMessageResultEvidence({
        ...evidence,
        signalId: 'signal-3',
        admissionHash: 'hash-2',
      }),
    ).rejects.toBeInstanceOf(HarnessStorageAdmissionConflictError);
  });

  it('compacts terminal message evidence into tombstones', async () => {
    await storage.writeMessageResultEvidence({
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      signalId: 'signal-1',
      runId: 'run-1',
      admissionId: 'admission-1',
      admissionHash: 'hash-1',
      status: 'completed',
      result: { ok: true },
      createdAt: 1_000,
      updatedAt: 1_200,
    });

    await expect(
      storage.compactOperationResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        kind: 'message',
        signalId: 'signal-1',
        now: 2_000,
      }),
    ).resolves.toMatchObject({
      kind: 'message',
      sessionId: 'session-1',
      signalId: 'signal-1',
      admissionId: 'admission-1',
      admissionHash: 'hash-1',
      terminalAt: 1_200,
      compactedAt: 2_000,
    });

    await expect(
      storage.loadMessageResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        signalId: 'signal-1',
      }),
    ).resolves.toMatchObject({ kind: 'message', admissionId: 'admission-1' });

    await expect(
      storage.writeMessageResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        signalId: 'signal-2',
        admissionId: 'admission-1',
        admissionHash: 'hash-1',
        status: 'pending',
        createdAt: 2_100,
        updatedAt: 2_100,
      }),
    ).resolves.toMatchObject({
      created: false,
      evidence: { kind: 'message', admissionId: 'admission-1' },
    });
    await expect(
      storage.writeMessageResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        signalId: 'signal-3',
        admissionId: 'admission-1',
        admissionHash: 'hash-2',
        status: 'pending',
        createdAt: 2_200,
        updatedAt: 2_200,
      }),
    ).rejects.toBeInstanceOf(HarnessStorageAdmissionConflictError);
  });

  it('rejects conflicting tombstones for the same admission id', async () => {
    await storage.writeOperationAdmissionTombstone({
      kind: 'message',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      signalId: 'signal-1',
      admissionId: 'admission-1',
      admissionHash: 'hash-1',
      terminalAt: 1_000,
      compactedAt: 1_000,
      expiresAt: 1_000,
    });

    await expect(
      storage.writeOperationAdmissionTombstone({
        kind: 'message',
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        signalId: 'signal-2',
        admissionId: 'admission-1',
        admissionHash: 'hash-2',
        terminalAt: 1_100,
        compactedAt: 1_100,
        expiresAt: 1_100,
      }),
    ).rejects.toBeInstanceOf(HarnessStorageAdmissionConflictError);

    await expect(
      storage.writeOperationAdmissionTombstone({
        kind: 'message',
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        signalId: 'signal-2',
        admissionId: 'admission-1',
        admissionHash: 'hash-1',
        terminalAt: 1_100,
        compactedAt: 1_100,
        expiresAt: 1_100,
      }),
    ).resolves.toBeUndefined();
    expect(db.harnessOperationTombstones.size).toBe(1);
  });

  it('resolves queue admission receipts and compacts terminal queue evidence', async () => {
    await storage.saveSession(
      makeSession({
        queueAdmissionReceipts: {
          'queued-1': {
            admissionId: 'admission-1',
            admissionHash: 'hash-1',
            queuedItemId: 'queued-1',
            status: 'completed',
            runId: 'run-1',
            signalId: 'signal-1',
            result: { ok: true },
            attempts: 1,
            enqueuedAt: 1_000,
            completedAt: 1_500,
            updatedAt: 1_500,
          },
        },
      }),
      { ownerId: 'owner-1', ifVersion: 0 },
    );

    await expect(
      storage.resolveOperationAdmissionEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        kind: 'queue',
        admissionId: 'admission-1',
        attemptedAdmissionHash: 'hash-1',
      }),
    ).resolves.toMatchObject({ status: 'duplicate', storedAdmissionHash: 'hash-1' });

    await expect(
      storage.loadQueueResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        queuedItemId: 'queued-1',
      }),
    ).resolves.toMatchObject({ status: 'completed', admissionId: 'admission-1' });

    const compacted = storage.compactOperationResultEvidence({
      sessionId: 'session-1',
      resourceId: 'resource-1',
      kind: 'queue',
      queuedItemId: 'queued-1',
      now: 2_000,
    });
    await expect(storage.loadSession({ sessionId: 'session-1' })).resolves.toMatchObject({
      version: 2,
      queueAdmissionReceipts: undefined,
    });
    await expect(compacted).resolves.toMatchObject({
      kind: 'queue',
      queuedItemId: 'queued-1',
      admissionId: 'admission-1',
      terminalAt: 1_500,
    });

    await expect(
      storage.loadQueueResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        queuedItemId: 'queued-1',
      }),
    ).resolves.toMatchObject({ kind: 'queue', admissionId: 'admission-1' });

    await expect(
      storage.saveSession(
        makeSession({
          version: 1,
          queueAdmissionReceipts: {
            'queued-1': {
              admissionId: 'admission-1',
              admissionHash: 'hash-1',
              queuedItemId: 'queued-1',
              status: 'completed',
              attempts: 1,
              enqueuedAt: 1_000,
              updatedAt: 1_500,
            },
          },
        }),
        { ownerId: 'owner-1', ifVersion: 1 },
      ),
    ).rejects.toBeInstanceOf(HarnessStorageVersionConflictError);
  });

  it('deletes admission evidence scoped to a session and resource', async () => {
    await storage.writeMessageResultEvidence({
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      signalId: 'signal-1',
      runId: 'run-1',
      admissionId: 'admission-1',
      admissionHash: 'hash-1',
      status: 'completed',
      result: {},
      createdAt: 1_000,
      updatedAt: 1_000,
    });
    await storage.writeOperationAdmissionTombstone({
      kind: 'message',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      signalId: 'signal-2',
      admissionId: 'admission-2',
      admissionHash: 'hash-2',
      terminalAt: 1_000,
      compactedAt: 1_000,
      expiresAt: 1_000,
    });

    await storage.deleteOperationAdmissionTombstonesForSession({
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
    });

    await expect(
      storage.loadMessageResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        signalId: 'signal-1',
      }),
    ).resolves.toBeNull();
    await expect(
      storage.loadMessageResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        signalId: 'signal-2',
      }),
    ).resolves.toBeNull();
  });

  it('clears all harness records from the shared in-memory database', async () => {
    await storage.saveSession(makeSession(), { ownerId: 'owner-1', ifVersion: 0 });
    await storage.saveAttachment({
      sessionId: 'session-1',
      attachmentId: 'attachment-1',
      name: 'file.txt',
      mimeType: 'text/plain',
      source: 'preupload',
      data: new Uint8Array([1]),
    });

    await storage.dangerouslyClearAll();

    expect(db.harnessSessions.size).toBe(0);
    expect(db.harnessAttachmentRecords.size).toBe(0);
    expect(db.harnessAttachmentBytes.size).toBe(0);
    expect(db.harnessMessageResultEvidence.size).toBe(0);
    expect(db.harnessOperationTombstones.size).toBe(0);
  });
});
