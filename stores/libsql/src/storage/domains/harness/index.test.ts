import { createClient } from '@libsql/client';
import {
  HarnessStorageLeaseConflictError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageVersionConflictError,
} from '@mastra/core/storage';
import type { SessionRecord } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HarnessLibSQL } from './index';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  const now = Date.now();
  return {
    id: 'session-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    origin: 'top-level',
    ownsThread: false,
    modeId: 'build',
    modelId: 'claude-opus-4-7',
    subagentModelOverrides: {},
    permissionRules: { categories: {}, tools: {} },
    sessionGrants: { categories: [], tools: [] },
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    pendingQueue: [],
    state: {},
    createdAt: now,
    lastActivityAt: now,
    version: 0,
    ...overrides,
  };
}

describe('HarnessLibSQL', () => {
  let storage: HarnessLibSQL;

  beforeEach(async () => {
    // Each test gets a fresh in-memory database. `:memory:` without
    // `cache=shared` is per-connection, but libsql opens one connection per
    // client so this is genuinely isolated.
    const client = createClient({ url: 'file::memory:' });
    storage = new HarnessLibSQL({ client });
    await storage.init();
  });

  afterEach(async () => {
    await storage.dangerouslyClearAll();
  });

  // ==========================================================================
  // saveSession / loadSession
  // ==========================================================================

  describe('saveSession / loadSession', () => {
    it('inserts a fresh record with ifVersion=0 and bumps to version 1', async () => {
      const result = await storage.saveSession(makeRecord(), { ownerId: 'h-1', ifVersion: 0 });
      expect(result.version).toBe(1);

      const loaded = await storage.loadSession({ sessionId: 'session-1' });
      expect(loaded?.version).toBe(1);
      expect(loaded?.id).toBe('session-1');
    });

    it('returns null when the session does not exist', async () => {
      expect(await storage.loadSession({ sessionId: 'missing' })).toBeNull();
    });

    it('rejects first insert when ifVersion is non-zero', async () => {
      await expect(storage.saveSession(makeRecord(), { ownerId: 'h-1', ifVersion: 1 })).rejects.toBeInstanceOf(
        HarnessStorageVersionConflictError,
      );
    });

    it('rejects update with stale ifVersion', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h-1', ifVersion: 0 });
      await storage.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

      await expect(
        storage.saveSession(makeRecord({ modeId: 'plan' }), { ownerId: 'h-1', ifVersion: 0 }),
      ).rejects.toBeInstanceOf(HarnessStorageVersionConflictError);
    });

    it('accepts sequential updates with monotonic ifVersion', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h-1', ifVersion: 0 });
      await storage.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

      const second = await storage.saveSession(makeRecord({ modeId: 'plan' }), {
        ownerId: 'h-1',
        ifVersion: 1,
      });
      expect(second.version).toBe(2);

      const third = await storage.saveSession(makeRecord({ modeId: 'review' }), {
        ownerId: 'h-1',
        ifVersion: 2,
      });
      expect(third.version).toBe(3);

      const loaded = await storage.loadSession({ sessionId: 'session-1' });
      expect(loaded?.modeId).toBe('review');
      expect(loaded?.version).toBe(3);
    });

    it('rejects writes from a different lease holder', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h-1', ifVersion: 0 });
      await storage.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

      await expect(
        storage.saveSession(makeRecord({ modeId: 'plan' }), { ownerId: 'h-2', ifVersion: 1 }),
      ).rejects.toBeInstanceOf(HarnessStorageLeaseConflictError);
    });

    it('preserves lease metadata across saves', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h-1', ifVersion: 0 });
      const lease = await storage.acquireSessionLease({
        sessionId: 'session-1',
        ownerId: 'h-1',
        ttlMs: 30_000,
      });

      await storage.saveSession(makeRecord({ modeId: 'plan' }), { ownerId: 'h-1', ifVersion: 1 });

      const loaded = await storage.loadSession({ sessionId: 'session-1' });
      expect(loaded?.ownerId).toBe('h-1');
      expect(loaded?.leaseExpiresAt).toBe(lease.expiresAt);
    });

    it('persists JSON-encoded fields losslessly', async () => {
      const record = makeRecord({
        permissionRules: {
          categories: { write: 'ask' },
          tools: { dangerous_tool: 'deny' },
        },
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        state: { foo: { bar: [1, 2, 3] }, n: 42 },
        goal: { id: 'g1', objective: 'finish', status: 'active', turnsUsed: 3, maxTurns: 50 },
      });

      await storage.saveSession(record, { ownerId: 'h-1', ifVersion: 0 });
      const loaded = await storage.loadSession({ sessionId: 'session-1' });
      expect(loaded?.permissionRules).toEqual(record.permissionRules);
      expect(loaded?.tokenUsage).toEqual(record.tokenUsage);
      expect(loaded?.state).toEqual(record.state);
      expect(loaded?.goal).toEqual(record.goal);
    });

    it('round-trips owns_thread booleans correctly', async () => {
      await storage.saveSession(makeRecord({ ownsThread: true }), { ownerId: 'h', ifVersion: 0 });
      const loaded = await storage.loadSession({ sessionId: 'session-1' });
      expect(loaded?.ownsThread).toBe(true);
    });
  });

  // ==========================================================================
  // loadSessionByThread
  // ==========================================================================

  describe('loadSessionByThread', () => {
    it('returns the active record for (threadId, resourceId)', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h-1', ifVersion: 0 });

      const loaded = await storage.loadSessionByThread({
        threadId: 'thread-1',
        resourceId: 'resource-1',
      });
      expect(loaded?.id).toBe('session-1');
    });

    it('skips closed records and returns null when only closed exist', async () => {
      await storage.saveSession(makeRecord({ closedAt: Date.now() }), {
        ownerId: 'h-1',
        ifVersion: 0,
      });

      expect(await storage.loadSessionByThread({ threadId: 'thread-1', resourceId: 'resource-1' })).toBeNull();
    });

    it('does not leak across resourceId', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h-1', ifVersion: 0 });

      expect(await storage.loadSessionByThread({ threadId: 'thread-1', resourceId: 'other-resource' })).toBeNull();
    });

    it('returns the most recent active record when multiple match', async () => {
      await storage.saveSession(makeRecord({ id: 'a', lastActivityAt: 1000 }), { ownerId: 'h-1', ifVersion: 0 });
      await storage.saveSession(makeRecord({ id: 'b', lastActivityAt: 2000 }), { ownerId: 'h-1', ifVersion: 0 });

      const loaded = await storage.loadSessionByThread({
        threadId: 'thread-1',
        resourceId: 'resource-1',
      });
      expect(loaded?.id).toBe('b');
    });
  });

  // ==========================================================================
  // listSessions
  // ==========================================================================

  describe('listSessions', () => {
    it('lists active records for a resource, ordered by lastActivityAt desc', async () => {
      await storage.saveSession(makeRecord({ id: 'a', lastActivityAt: 1000 }), {
        ownerId: 'h',
        ifVersion: 0,
      });
      await storage.saveSession(makeRecord({ id: 'b', threadId: 't2', lastActivityAt: 3000 }), {
        ownerId: 'h',
        ifVersion: 0,
      });
      await storage.saveSession(makeRecord({ id: 'c', threadId: 't3', lastActivityAt: 2000 }), {
        ownerId: 'h',
        ifVersion: 0,
      });

      const summaries = await storage.listSessions({ resourceId: 'resource-1' });
      expect(summaries.map(s => s.id)).toEqual(['b', 'c', 'a']);
    });

    it('omits closed records by default and includes them when includeClosed=true', async () => {
      await storage.saveSession(makeRecord({ id: 'open' }), { ownerId: 'h', ifVersion: 0 });
      await storage.saveSession(makeRecord({ id: 'shut', threadId: 't2', closedAt: Date.now() }), {
        ownerId: 'h',
        ifVersion: 0,
      });

      expect((await storage.listSessions({ resourceId: 'resource-1' })).map(s => s.id)).toEqual(['open']);

      expect(
        (await storage.listSessions({ resourceId: 'resource-1', includeClosed: true })).map(s => s.id).sort(),
      ).toEqual(['open', 'shut']);
    });

    it('filters by parentSessionId', async () => {
      await storage.saveSession(makeRecord({ id: 'parent' }), { ownerId: 'h', ifVersion: 0 });
      await storage.saveSession(makeRecord({ id: 'child-1', threadId: 't2', parentSessionId: 'parent' }), {
        ownerId: 'h',
        ifVersion: 0,
      });
      await storage.saveSession(makeRecord({ id: 'unrelated', threadId: 't3' }), { ownerId: 'h', ifVersion: 0 });

      const summaries = await storage.listSessions({
        resourceId: 'resource-1',
        parentSessionId: 'parent',
      });
      expect(summaries.map(s => s.id)).toEqual(['child-1']);
    });
  });

  // ==========================================================================
  // deleteSession + cascade
  // ==========================================================================

  describe('deleteSession', () => {
    it('removes the session record', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h', ifVersion: 0 });

      await storage.deleteSession({ sessionId: 'session-1' });

      expect(await storage.loadSession({ sessionId: 'session-1' })).toBeNull();
    });

    it('is a no-op when the session does not exist', async () => {
      await expect(storage.deleteSession({ sessionId: 'missing' })).resolves.toBeUndefined();
    });

    it('cascades to attachments owned by the session', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h', ifVersion: 0 });
      await storage.saveAttachment({
        sessionId: 'session-1',
        attachmentId: 'a1',
        name: 'note.txt',
        mimeType: 'text/plain',
        data: new Uint8Array([1, 2, 3]),
      });

      await storage.deleteSession({ sessionId: 'session-1' });

      expect(await storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' })).toBeNull();
    });
  });

  // ==========================================================================
  // Lease lifecycle
  // ==========================================================================

  describe('leases', () => {
    it('throws when acquiring a lease on a missing session', async () => {
      await expect(
        storage.acquireSessionLease({ sessionId: 'missing', ownerId: 'h', ttlMs: 30_000 }),
      ).rejects.toBeInstanceOf(HarnessStorageSessionNotFoundError);
    });

    it('acquires a lease on an unowned session', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h', ifVersion: 0 });

      const result = await storage.acquireSessionLease({
        sessionId: 'session-1',
        ownerId: 'h-1',
        ttlMs: 30_000,
      });

      expect(result.version).toBe(1);
      expect(result.expiresAt).toBeGreaterThan(Date.now());

      const loaded = await storage.loadSession({ sessionId: 'session-1' });
      expect(loaded?.ownerId).toBe('h-1');
    });

    it('is idempotent for the same owner', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h', ifVersion: 0 });
      await storage.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

      const second = await storage.acquireSessionLease({
        sessionId: 'session-1',
        ownerId: 'h-1',
        ttlMs: 60_000,
      });

      const loaded = await storage.loadSession({ sessionId: 'session-1' });
      expect(loaded?.leaseExpiresAt).toBe(second.expiresAt);
    });

    it('rejects acquire from a different owner while lease is valid', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h', ifVersion: 0 });
      await storage.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

      await expect(
        storage.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-2', ttlMs: 30_000 }),
      ).rejects.toBeInstanceOf(HarnessStorageLeaseConflictError);
    });

    it('allows acquire from a different owner after the lease expires', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h', ifVersion: 0 });
      await storage.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 1 });

      await new Promise(resolve => setTimeout(resolve, 5));

      const result = await storage.acquireSessionLease({
        sessionId: 'session-1',
        ownerId: 'h-2',
        ttlMs: 30_000,
      });
      expect(result.expiresAt).toBeGreaterThan(Date.now());

      const loaded = await storage.loadSession({ sessionId: 'session-1' });
      expect(loaded?.ownerId).toBe('h-2');
    });

    it('renews an existing lease for the current owner', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h', ifVersion: 0 });
      const first = await storage.acquireSessionLease({
        sessionId: 'session-1',
        ownerId: 'h-1',
        ttlMs: 30_000,
      });

      await new Promise(resolve => setTimeout(resolve, 2));

      const renewed = await storage.renewSessionLease({
        sessionId: 'session-1',
        ownerId: 'h-1',
        ttlMs: 60_000,
      });

      expect(renewed.expiresAt).toBeGreaterThan(first.expiresAt);
    });

    it('rejects renewal from a non-owner', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h', ifVersion: 0 });
      await storage.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

      await expect(
        storage.renewSessionLease({ sessionId: 'session-1', ownerId: 'h-2', ttlMs: 30_000 }),
      ).rejects.toBeInstanceOf(HarnessStorageLeaseConflictError);
    });

    it('rejects renewal of an expired lease', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h', ifVersion: 0 });
      await storage.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 1 });
      await new Promise(resolve => setTimeout(resolve, 5));

      await expect(
        storage.renewSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 }),
      ).rejects.toBeInstanceOf(HarnessStorageLeaseConflictError);
    });

    it('releases a lease for the current owner', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h', ifVersion: 0 });
      await storage.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

      await storage.releaseSessionLease({ sessionId: 'session-1', ownerId: 'h-1' });

      const loaded = await storage.loadSession({ sessionId: 'session-1' });
      expect(loaded?.ownerId).toBeUndefined();
      expect(loaded?.leaseExpiresAt).toBeUndefined();
    });

    it('release is a no-op for a non-owner', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h', ifVersion: 0 });
      await storage.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

      await expect(storage.releaseSessionLease({ sessionId: 'session-1', ownerId: 'h-2' })).resolves.toBeUndefined();

      const loaded = await storage.loadSession({ sessionId: 'session-1' });
      expect(loaded?.ownerId).toBe('h-1');
    });

    it('release throws when the session is missing', async () => {
      await expect(storage.releaseSessionLease({ sessionId: 'missing', ownerId: 'h-1' })).rejects.toBeInstanceOf(
        HarnessStorageSessionNotFoundError,
      );
    });
  });

  // ==========================================================================
  // Attachments
  // ==========================================================================

  describe('attachments', () => {
    it('saves and loads an attachment', async () => {
      await storage.saveAttachment({
        sessionId: 'session-1',
        attachmentId: 'a1',
        name: 'note.txt',
        mimeType: 'text/plain',
        data: new Uint8Array([1, 2, 3, 4]),
      });

      const loaded = await storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' });
      expect(loaded?.name).toBe('note.txt');
      expect(loaded?.mimeType).toBe('text/plain');
      expect(Array.from(loaded?.data ?? [])).toEqual([1, 2, 3, 4]);
    });

    it('returns null for missing attachments', async () => {
      expect(await storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'missing' })).toBeNull();
    });

    it('isolates attachments by sessionId', async () => {
      await storage.saveAttachment({
        sessionId: 'session-a',
        attachmentId: 'shared',
        name: 'a.txt',
        mimeType: 'text/plain',
        data: new Uint8Array([1]),
      });
      await storage.saveAttachment({
        sessionId: 'session-b',
        attachmentId: 'shared',
        name: 'b.txt',
        mimeType: 'text/plain',
        data: new Uint8Array([2]),
      });

      const a = await storage.loadAttachment({ sessionId: 'session-a', attachmentId: 'shared' });
      const b = await storage.loadAttachment({ sessionId: 'session-b', attachmentId: 'shared' });
      expect(a?.name).toBe('a.txt');
      expect(b?.name).toBe('b.txt');
    });

    it('upserts on duplicate (session_id, attachment_id)', async () => {
      await storage.saveAttachment({
        sessionId: 'session-1',
        attachmentId: 'a1',
        name: 'first.txt',
        mimeType: 'text/plain',
        data: new Uint8Array([1]),
      });
      await storage.saveAttachment({
        sessionId: 'session-1',
        attachmentId: 'a1',
        name: 'second.txt',
        mimeType: 'text/plain',
        data: new Uint8Array([2, 3]),
      });

      const loaded = await storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' });
      expect(loaded?.name).toBe('second.txt');
      expect(Array.from(loaded?.data ?? [])).toEqual([2, 3]);
    });

    it('preserves arbitrary binary content (non-UTF8 bytes)', async () => {
      const random = new Uint8Array(256);
      for (let i = 0; i < 256; i++) random[i] = i;

      await storage.saveAttachment({
        sessionId: 'session-1',
        attachmentId: 'a1',
        name: 'bin',
        mimeType: 'application/octet-stream',
        data: random,
      });

      const loaded = await storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' });
      expect(loaded?.data.length).toBe(256);
      expect(Array.from(loaded?.data ?? [])).toEqual(Array.from(random));
    });

    it('returns metadata via getAttachmentRecord', async () => {
      await storage.saveAttachment({
        sessionId: 'session-1',
        attachmentId: 'a1',
        name: 'n.txt',
        mimeType: 'text/plain',
        data: new Uint8Array([1, 2, 3]),
      });

      const record = await storage.getAttachmentRecord({
        sessionId: 'session-1',
        attachmentId: 'a1',
      });
      expect(record).toMatchObject({
        attachmentId: 'a1',
        sessionId: 'session-1',
        name: 'n.txt',
        mimeType: 'text/plain',
        sizeBytes: 3,
      });
      expect(record?.createdAt).toBeGreaterThan(0);
    });

    it('deletes a single attachment', async () => {
      await storage.saveAttachment({
        sessionId: 'session-1',
        attachmentId: 'a1',
        name: 'n',
        mimeType: 'text/plain',
        data: new Uint8Array([1]),
      });

      await storage.deleteAttachment({ sessionId: 'session-1', attachmentId: 'a1' });

      expect(await storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' })).toBeNull();
    });

    it('deletes only attachments for the requested session in deleteAttachmentsForSession', async () => {
      await storage.saveAttachment({
        sessionId: 'session-a',
        attachmentId: 'a1',
        name: 'n',
        mimeType: 'text/plain',
        data: new Uint8Array([1]),
      });
      await storage.saveAttachment({
        sessionId: 'session-b',
        attachmentId: 'a2',
        name: 'n',
        mimeType: 'text/plain',
        data: new Uint8Array([2]),
      });

      await storage.deleteAttachmentsForSession({ sessionId: 'session-a' });

      expect(await storage.loadAttachment({ sessionId: 'session-a', attachmentId: 'a1' })).toBeNull();
      expect(await storage.loadAttachment({ sessionId: 'session-b', attachmentId: 'a2' })).not.toBeNull();
    });
  });

  // ==========================================================================
  // dangerouslyClearAll
  // ==========================================================================

  describe('dangerouslyClearAll', () => {
    it('clears sessions and attachments', async () => {
      await storage.saveSession(makeRecord(), { ownerId: 'h', ifVersion: 0 });
      await storage.saveAttachment({
        sessionId: 'session-1',
        attachmentId: 'a1',
        name: 'n',
        mimeType: 'text/plain',
        data: new Uint8Array([1]),
      });

      await storage.dangerouslyClearAll();

      expect(await storage.loadSession({ sessionId: 'session-1' })).toBeNull();
      expect(await storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' })).toBeNull();
    });
  });
});
