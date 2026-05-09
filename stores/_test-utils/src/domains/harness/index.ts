import {
  HarnessStorageLeaseConflictError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageVersionConflictError,
} from '@mastra/core/storage';
import type { HarnessStorage, MastraStorage } from '@mastra/core/storage';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSampleSessionRecord } from './data';

export interface HarnessTestOptions {
  storage: MastraStorage;
}

/**
 * Shared HarnessStorage conformance suite. Every adapter that registers the
 * harness domain (`storage.getStore('harness')`) gets the same coverage —
 * CAS write contract, lease lifecycle, scoped lookups, attachment isolation,
 * cascade-delete, JSON round-trips.
 *
 * Adapters without the domain are skipped silently.
 */
export function createHarnessTest({ storage }: HarnessTestOptions) {
  let harness: HarnessStorage | undefined;

  beforeAll(async () => {
    harness = await storage.getStore('harness');
  });

  beforeEach(async () => {
    if (!harness) return;
    await harness.dangerouslyClearAll();
  });

  afterEach(async () => {
    if (!harness) return;
    await harness.dangerouslyClearAll();
  });

  // The domain is optional, so wrap the whole suite in a `describe.skip` when
  // missing so vitest still surfaces the missing coverage without blowing up.
  describe('Harness', () => {
    describe('saveSession / loadSession', () => {
      it('skips when storage adapter does not register the harness domain', () => {
        if (!harness) return;
      });

      it('inserts a fresh record with ifVersion=0 and bumps to version 1', async () => {
        if (!harness) return;
        const result = await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 0 });
        expect(result.version).toBe(1);

        const loaded = await harness.loadSession({ sessionId: 'session-1' });
        expect(loaded?.version).toBe(1);
        expect(loaded?.id).toBe('session-1');
      });

      it('returns null when the session does not exist', async () => {
        if (!harness) return;
        expect(await harness.loadSession({ sessionId: 'missing' })).toBeNull();
      });

      it('rejects first insert when ifVersion is non-zero', async () => {
        if (!harness) return;
        await expect(
          harness.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 1 }),
        ).rejects.toBeInstanceOf(HarnessStorageVersionConflictError);
      });

      it('rejects update with stale ifVersion', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 0 });
        await harness.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

        await expect(
          harness.saveSession(createSampleSessionRecord({ modeId: 'plan' }), { ownerId: 'h-1', ifVersion: 0 }),
        ).rejects.toBeInstanceOf(HarnessStorageVersionConflictError);
      });

      it('accepts sequential updates with monotonic ifVersion', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 0 });
        await harness.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

        const second = await harness.saveSession(createSampleSessionRecord({ modeId: 'plan' }), {
          ownerId: 'h-1',
          ifVersion: 1,
        });
        expect(second.version).toBe(2);

        const third = await harness.saveSession(createSampleSessionRecord({ modeId: 'review' }), {
          ownerId: 'h-1',
          ifVersion: 2,
        });
        expect(third.version).toBe(3);

        const loaded = await harness.loadSession({ sessionId: 'session-1' });
        expect(loaded?.modeId).toBe('review');
        expect(loaded?.version).toBe(3);
      });

      it('rejects writes from a different lease holder', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 0 });
        await harness.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

        await expect(
          harness.saveSession(createSampleSessionRecord({ modeId: 'plan' }), { ownerId: 'h-2', ifVersion: 1 }),
        ).rejects.toBeInstanceOf(HarnessStorageLeaseConflictError);
      });

      it('preserves lease metadata across saves', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 0 });
        const lease = await harness.acquireSessionLease({
          sessionId: 'session-1',
          ownerId: 'h-1',
          ttlMs: 30_000,
        });

        await harness.saveSession(createSampleSessionRecord({ modeId: 'plan' }), { ownerId: 'h-1', ifVersion: 1 });

        const loaded = await harness.loadSession({ sessionId: 'session-1' });
        expect(loaded?.ownerId).toBe('h-1');
        expect(loaded?.leaseExpiresAt).toBe(lease.expiresAt);
      });

      it('persists JSON-encoded fields losslessly', async () => {
        if (!harness) return;
        const record = createSampleSessionRecord({
          permissionRules: {
            categories: { write: 'ask' },
            tools: { dangerous_tool: 'deny' },
          },
          tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          state: { foo: { bar: [1, 2, 3] }, n: 42 },
          goal: { id: 'g1', objective: 'finish', status: 'active', turnsUsed: 3, maxTurns: 50 },
        });

        await harness.saveSession(record, { ownerId: 'h-1', ifVersion: 0 });
        const loaded = await harness.loadSession({ sessionId: 'session-1' });
        expect(loaded?.permissionRules).toEqual(record.permissionRules);
        expect(loaded?.tokenUsage).toEqual(record.tokenUsage);
        expect(loaded?.state).toEqual(record.state);
        expect(loaded?.goal).toEqual(record.goal);
      });

      it('round-trips owns_thread booleans correctly', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ ownsThread: true }), { ownerId: 'h', ifVersion: 0 });
        const loaded = await harness.loadSession({ sessionId: 'session-1' });
        expect(loaded?.ownsThread).toBe(true);
      });
    });

    describe('loadSessionByThread', () => {
      it('returns the active record for (threadId, resourceId)', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 0 });

        const loaded = await harness.loadSessionByThread({
          threadId: 'thread-1',
          resourceId: 'resource-1',
        });
        expect(loaded?.id).toBe('session-1');
      });

      it('skips closed records and returns null when only closed exist', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ closedAt: Date.now() }), {
          ownerId: 'h-1',
          ifVersion: 0,
        });

        expect(await harness.loadSessionByThread({ threadId: 'thread-1', resourceId: 'resource-1' })).toBeNull();
      });

      it('does not leak across resourceId', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 0 });

        expect(await harness.loadSessionByThread({ threadId: 'thread-1', resourceId: 'other-resource' })).toBeNull();
      });

      it('returns the most recent active record when multiple match', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ id: 'a', lastActivityAt: 1000 }), {
          ownerId: 'h-1',
          ifVersion: 0,
        });
        await harness.saveSession(createSampleSessionRecord({ id: 'b', lastActivityAt: 2000 }), {
          ownerId: 'h-1',
          ifVersion: 0,
        });

        const loaded = await harness.loadSessionByThread({
          threadId: 'thread-1',
          resourceId: 'resource-1',
        });
        expect(loaded?.id).toBe('b');
      });
    });

    describe('listSessions', () => {
      it('lists active records for a resource, ordered by lastActivityAt desc', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ id: 'a', lastActivityAt: 1000 }), {
          ownerId: 'h',
          ifVersion: 0,
        });
        await harness.saveSession(createSampleSessionRecord({ id: 'b', threadId: 't2', lastActivityAt: 3000 }), {
          ownerId: 'h',
          ifVersion: 0,
        });
        await harness.saveSession(createSampleSessionRecord({ id: 'c', threadId: 't3', lastActivityAt: 2000 }), {
          ownerId: 'h',
          ifVersion: 0,
        });

        const summaries = await harness.listSessions({ resourceId: 'resource-1' });
        expect(summaries.map(s => s.id)).toEqual(['b', 'c', 'a']);
      });

      it('omits closed records by default and includes them when includeClosed=true', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ id: 'open' }), { ownerId: 'h', ifVersion: 0 });
        await harness.saveSession(createSampleSessionRecord({ id: 'shut', threadId: 't2', closedAt: Date.now() }), {
          ownerId: 'h',
          ifVersion: 0,
        });

        expect((await harness.listSessions({ resourceId: 'resource-1' })).map(s => s.id)).toEqual(['open']);

        expect(
          (await harness.listSessions({ resourceId: 'resource-1', includeClosed: true })).map(s => s.id).sort(),
        ).toEqual(['open', 'shut']);
      });

      it('filters by parentSessionId', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ id: 'parent' }), { ownerId: 'h', ifVersion: 0 });
        await harness.saveSession(
          createSampleSessionRecord({ id: 'child-1', threadId: 't2', parentSessionId: 'parent' }),
          {
            ownerId: 'h',
            ifVersion: 0,
          },
        );
        await harness.saveSession(createSampleSessionRecord({ id: 'unrelated', threadId: 't3' }), {
          ownerId: 'h',
          ifVersion: 0,
        });

        const summaries = await harness.listSessions({
          resourceId: 'resource-1',
          parentSessionId: 'parent',
        });
        expect(summaries.map(s => s.id)).toEqual(['child-1']);
      });
    });

    describe('deleteSession', () => {
      it('removes the session record', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h', ifVersion: 0 });

        await harness.deleteSession({ sessionId: 'session-1' });

        expect(await harness.loadSession({ sessionId: 'session-1' })).toBeNull();
      });

      it('is a no-op when the session does not exist', async () => {
        if (!harness) return;
        await expect(harness.deleteSession({ sessionId: 'missing' })).resolves.toBeUndefined();
      });

      it('cascades to attachments owned by the session', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h', ifVersion: 0 });
        await harness.saveAttachment({
          sessionId: 'session-1',
          attachmentId: 'a1',
          name: 'note.txt',
          mimeType: 'text/plain',
          data: new Uint8Array([1, 2, 3]),
        });

        await harness.deleteSession({ sessionId: 'session-1' });

        expect(await harness.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' })).toBeNull();
      });
    });

    describe('leases', () => {
      it('throws when acquiring a lease on a missing session', async () => {
        if (!harness) return;
        await expect(
          harness.acquireSessionLease({ sessionId: 'missing', ownerId: 'h', ttlMs: 30_000 }),
        ).rejects.toBeInstanceOf(HarnessStorageSessionNotFoundError);
      });

      it('acquires a lease on an unowned session', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h', ifVersion: 0 });

        const result = await harness.acquireSessionLease({
          sessionId: 'session-1',
          ownerId: 'h-1',
          ttlMs: 30_000,
        });

        expect(result.version).toBe(1);
        expect(result.expiresAt).toBeGreaterThan(Date.now());

        const loaded = await harness.loadSession({ sessionId: 'session-1' });
        expect(loaded?.ownerId).toBe('h-1');
      });

      it('is idempotent for the same owner', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h', ifVersion: 0 });
        await harness.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

        const second = await harness.acquireSessionLease({
          sessionId: 'session-1',
          ownerId: 'h-1',
          ttlMs: 60_000,
        });

        const loaded = await harness.loadSession({ sessionId: 'session-1' });
        expect(loaded?.leaseExpiresAt).toBe(second.expiresAt);
      });

      it('rejects acquire from a different owner while lease is valid', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h', ifVersion: 0 });
        await harness.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

        await expect(
          harness.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-2', ttlMs: 30_000 }),
        ).rejects.toBeInstanceOf(HarnessStorageLeaseConflictError);
      });

      it('allows acquire from a different owner after the lease expires', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h', ifVersion: 0 });
        await harness.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 1 });

        await new Promise(resolve => setTimeout(resolve, 5));

        const result = await harness.acquireSessionLease({
          sessionId: 'session-1',
          ownerId: 'h-2',
          ttlMs: 30_000,
        });
        expect(result.expiresAt).toBeGreaterThan(Date.now());

        const loaded = await harness.loadSession({ sessionId: 'session-1' });
        expect(loaded?.ownerId).toBe('h-2');
      });

      it('renews an existing lease for the current owner', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h', ifVersion: 0 });
        const first = await harness.acquireSessionLease({
          sessionId: 'session-1',
          ownerId: 'h-1',
          ttlMs: 30_000,
        });

        await new Promise(resolve => setTimeout(resolve, 5));

        const renewed = await harness.renewSessionLease({
          sessionId: 'session-1',
          ownerId: 'h-1',
          ttlMs: 60_000,
        });

        expect(renewed.expiresAt).toBeGreaterThan(first.expiresAt);
      });

      it('rejects renewal from a non-owner', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h', ifVersion: 0 });
        await harness.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

        await expect(
          harness.renewSessionLease({ sessionId: 'session-1', ownerId: 'h-2', ttlMs: 30_000 }),
        ).rejects.toBeInstanceOf(HarnessStorageLeaseConflictError);
      });

      it('rejects renewal of an expired lease', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h', ifVersion: 0 });
        await harness.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 1 });
        await new Promise(resolve => setTimeout(resolve, 5));

        await expect(
          harness.renewSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 }),
        ).rejects.toBeInstanceOf(HarnessStorageLeaseConflictError);
      });

      it('releases a lease for the current owner', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h', ifVersion: 0 });
        await harness.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

        await harness.releaseSessionLease({ sessionId: 'session-1', ownerId: 'h-1' });

        const loaded = await harness.loadSession({ sessionId: 'session-1' });
        expect(loaded?.ownerId).toBeUndefined();
        expect(loaded?.leaseExpiresAt).toBeUndefined();
      });

      it('release is a no-op for a non-owner', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h', ifVersion: 0 });
        await harness.acquireSessionLease({ sessionId: 'session-1', ownerId: 'h-1', ttlMs: 30_000 });

        await expect(harness.releaseSessionLease({ sessionId: 'session-1', ownerId: 'h-2' })).resolves.toBeUndefined();

        const loaded = await harness.loadSession({ sessionId: 'session-1' });
        expect(loaded?.ownerId).toBe('h-1');
      });

      it('release throws when the session is missing', async () => {
        if (!harness) return;
        await expect(harness.releaseSessionLease({ sessionId: 'missing', ownerId: 'h-1' })).rejects.toBeInstanceOf(
          HarnessStorageSessionNotFoundError,
        );
      });
    });

    describe('attachments', () => {
      it('saves and loads an attachment', async () => {
        if (!harness) return;
        await harness.saveAttachment({
          sessionId: 'session-1',
          attachmentId: 'a1',
          name: 'note.txt',
          mimeType: 'text/plain',
          data: new Uint8Array([1, 2, 3, 4]),
        });

        const loaded = await harness.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' });
        expect(loaded?.name).toBe('note.txt');
        expect(loaded?.mimeType).toBe('text/plain');
        expect(Array.from(loaded?.data ?? [])).toEqual([1, 2, 3, 4]);
      });

      it('returns null for missing attachments', async () => {
        if (!harness) return;
        expect(await harness.loadAttachment({ sessionId: 'session-1', attachmentId: 'missing' })).toBeNull();
      });

      it('isolates attachments by sessionId', async () => {
        if (!harness) return;
        await harness.saveAttachment({
          sessionId: 'session-a',
          attachmentId: 'shared',
          name: 'a.txt',
          mimeType: 'text/plain',
          data: new Uint8Array([1]),
        });
        await harness.saveAttachment({
          sessionId: 'session-b',
          attachmentId: 'shared',
          name: 'b.txt',
          mimeType: 'text/plain',
          data: new Uint8Array([2]),
        });

        const a = await harness.loadAttachment({ sessionId: 'session-a', attachmentId: 'shared' });
        const b = await harness.loadAttachment({ sessionId: 'session-b', attachmentId: 'shared' });
        expect(a?.name).toBe('a.txt');
        expect(b?.name).toBe('b.txt');
      });

      it('upserts on duplicate (session_id, attachment_id)', async () => {
        if (!harness) return;
        await harness.saveAttachment({
          sessionId: 'session-1',
          attachmentId: 'a1',
          name: 'first.txt',
          mimeType: 'text/plain',
          data: new Uint8Array([1]),
        });
        await harness.saveAttachment({
          sessionId: 'session-1',
          attachmentId: 'a1',
          name: 'second.txt',
          mimeType: 'text/plain',
          data: new Uint8Array([2, 3]),
        });

        const loaded = await harness.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' });
        expect(loaded?.name).toBe('second.txt');
        expect(Array.from(loaded?.data ?? [])).toEqual([2, 3]);
      });

      it('preserves arbitrary binary content (non-UTF8 bytes)', async () => {
        if (!harness) return;
        const random = new Uint8Array(256);
        for (let i = 0; i < 256; i++) random[i] = i;

        await harness.saveAttachment({
          sessionId: 'session-1',
          attachmentId: 'a1',
          name: 'bin',
          mimeType: 'application/octet-stream',
          data: random,
        });

        const loaded = await harness.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' });
        expect(loaded?.data.length).toBe(256);
        expect(Array.from(loaded?.data ?? [])).toEqual(Array.from(random));
      });

      it('returns metadata via getAttachmentRecord', async () => {
        if (!harness) return;
        await harness.saveAttachment({
          sessionId: 'session-1',
          attachmentId: 'a1',
          name: 'n.txt',
          mimeType: 'text/plain',
          data: new Uint8Array([1, 2, 3]),
        });

        const record = await harness.getAttachmentRecord({
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
        if (!harness) return;
        await harness.saveAttachment({
          sessionId: 'session-1',
          attachmentId: 'a1',
          name: 'n',
          mimeType: 'text/plain',
          data: new Uint8Array([1]),
        });

        await harness.deleteAttachment({ sessionId: 'session-1', attachmentId: 'a1' });

        expect(await harness.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' })).toBeNull();
      });

      it('deletes only attachments for the requested session in deleteAttachmentsForSession', async () => {
        if (!harness) return;
        await harness.saveAttachment({
          sessionId: 'session-a',
          attachmentId: 'a1',
          name: 'n',
          mimeType: 'text/plain',
          data: new Uint8Array([1]),
        });
        await harness.saveAttachment({
          sessionId: 'session-b',
          attachmentId: 'a2',
          name: 'n',
          mimeType: 'text/plain',
          data: new Uint8Array([2]),
        });

        await harness.deleteAttachmentsForSession({ sessionId: 'session-a' });

        expect(await harness.loadAttachment({ sessionId: 'session-a', attachmentId: 'a1' })).toBeNull();
        expect(await harness.loadAttachment({ sessionId: 'session-b', attachmentId: 'a2' })).not.toBeNull();
      });
    });

    describe('dangerouslyClearAll', () => {
      it('clears sessions and attachments', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h', ifVersion: 0 });
        await harness.saveAttachment({
          sessionId: 'session-1',
          attachmentId: 'a1',
          name: 'n',
          mimeType: 'text/plain',
          data: new Uint8Array([1]),
        });

        await harness.dangerouslyClearAll();

        expect(await harness.loadSession({ sessionId: 'session-1' })).toBeNull();
        expect(await harness.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' })).toBeNull();
      });
    });
  });
}
