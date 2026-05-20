import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InMemoryDB } from '../inmemory-db';
import {
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
    await storage.saveAttachment({
      sessionId: 'session-1',
      attachmentId: 'attachment-1',
      name: 'file.txt',
      mimeType: 'text/plain',
      data,
    });
    data[0] = 9;

    const loaded = await storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'attachment-1' });
    expect(loaded).toEqual({
      name: 'file.txt',
      mimeType: 'text/plain',
      data: new Uint8Array([1, 2, 3]),
    });

    loaded!.data[1] = 9;
    await expect(
      storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'attachment-1' }),
    ).resolves.toMatchObject({
      data: new Uint8Array([1, 2, 3]),
    });

    await expect(
      storage.getAttachmentRecord({ sessionId: 'session-1', attachmentId: 'attachment-1' }),
    ).resolves.toEqual(
      expect.objectContaining({
        attachmentId: 'attachment-1',
        sessionId: 'session-1',
        name: 'file.txt',
        mimeType: 'text/plain',
        sizeBytes: 3,
      }),
    );
  });

  it('deletes single attachments, session attachments, and attachments on session delete', async () => {
    await storage.saveSession(makeSession(), { ownerId: 'owner-1', ifVersion: 0 });
    await storage.saveAttachment({
      sessionId: 'session-1',
      attachmentId: 'a',
      name: 'a.txt',
      mimeType: 'text/plain',
      data: new Uint8Array([1]),
    });
    await storage.saveAttachment({
      sessionId: 'session-1',
      attachmentId: 'b',
      name: 'b.txt',
      mimeType: 'text/plain',
      data: new Uint8Array([2]),
    });

    await storage.deleteAttachment({ sessionId: 'session-1', attachmentId: 'a' });
    await expect(storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'a' })).resolves.toBeNull();
    await expect(storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'b' })).resolves.not.toBeNull();

    await storage.deleteSession({ sessionId: 'session-1' });
    await expect(storage.loadSession({ sessionId: 'session-1' })).resolves.toBeNull();
    await expect(storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'b' })).resolves.toBeNull();
  });

  it('clears all harness records from the shared in-memory database', async () => {
    await storage.saveSession(makeSession(), { ownerId: 'owner-1', ifVersion: 0 });
    await storage.saveAttachment({
      sessionId: 'session-1',
      attachmentId: 'attachment-1',
      name: 'file.txt',
      mimeType: 'text/plain',
      data: new Uint8Array([1]),
    });

    await storage.dangerouslyClearAll();

    expect(db.harnessSessions.size).toBe(0);
    expect(db.harnessAttachmentRecords.size).toBe(0);
    expect(db.harnessAttachmentBytes.size).toBe(0);
  });
});
