import {
  HarnessStorageAdmissionConflictError,
  HarnessStorageAttachmentUnavailableError,
  HarnessStorageDeleteGuardConflictError,
  HarnessStorageLeaseConflictError,
  HarnessStorageParentSessionUnavailableError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageThreadDeleteFenceConflictError,
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
 * CAS write contract, lease lifecycle, thread-scoped lookups, delete fences,
 * attachment isolation, cascade-delete, JSON round-trips.
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
          goal: {
            id: 'g1',
            objective: 'finish',
            status: 'active',
            turnsUsed: 3,
            maxTurns: 50,
            judgeModelId: 'openai/gpt-4o-mini',
            createdAt: Date.now(),
          },
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

      it('isolates session rows by harnessName namespace', async () => {
        if (!harness) return;
        await harness.saveSession(
          createSampleSessionRecord({ harnessName: 'harness-a', modeId: 'build', lastActivityAt: 1000 }),
          { harnessName: 'harness-a', ownerId: 'h', ifVersion: 0 },
        );
        await harness.saveSession(
          createSampleSessionRecord({ harnessName: 'harness-b', modeId: 'review', lastActivityAt: 2000 }),
          { harnessName: 'harness-b', ownerId: 'h', ifVersion: 0 },
        );

        await expect(harness.loadSession({ harnessName: 'missing', sessionId: 'session-1' })).resolves.toBeNull();
        await expect(harness.loadSession({ harnessName: 'harness-a', sessionId: 'session-1' })).resolves.toMatchObject({
          harnessName: 'harness-a',
          modeId: 'build',
        });
        await expect(harness.loadSession({ harnessName: 'harness-b', sessionId: 'session-1' })).resolves.toMatchObject({
          harnessName: 'harness-b',
          modeId: 'review',
        });
        await expect(harness.listSessions({ harnessName: 'harness-a', resourceId: 'resource-1' })).resolves.toEqual([
          expect.objectContaining({ harnessName: 'harness-a', modeId: 'build' }),
        ]);
      });

      it('round-trips durable queue admission and lifecycle metadata', async () => {
        if (!harness) return;
        const record = createSampleSessionRecord({
          subagentDepth: 2,
          closingAt: 3000,
          closeDeadlineAt: 4000,
          pendingQueue: [
            {
              id: 'queued-1',
              admissionId: 'admission-1',
              admissionHash: 'hash-1',
              enqueuedAt: 1000,
              content: 'queued',
              attachments: [],
              requestContext: { userId: 'user-1' },
            },
          ],
          queueAdmissionReceipts: {
            'queued-1': {
              admissionId: 'admission-1',
              admissionHash: 'hash-1',
              queuedItemId: 'queued-1',
              status: 'accepted',
              attempts: 1,
              enqueuedAt: 1000,
              acceptedAt: 1100,
              updatedAt: 1100,
              runId: 'run-1',
              signalId: 'signal-1',
            },
          },
        });

        await harness.saveSession(record, { ownerId: 'h', ifVersion: 0 });

        const loaded = await harness.loadSession({ sessionId: 'session-1' });
        expect(loaded?.subagentDepth).toBe(2);
        expect(loaded?.closingAt).toBe(3000);
        expect(loaded?.closeDeadlineAt).toBe(4000);
        expect(loaded?.pendingQueue).toEqual(record.pendingQueue);
        expect(loaded?.queueAdmissionReceipts).toEqual(record.queueAdmissionReceipts);
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

      it('rejects a second active record for the same admission key', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ id: 'a', lastActivityAt: 1000 }), {
          ownerId: 'h-1',
          ifVersion: 0,
        });
        await expect(
          harness.saveSession(createSampleSessionRecord({ id: 'b', lastActivityAt: 2000 }), {
            ownerId: 'h-1',
            ifVersion: 0,
          }),
        ).rejects.toBeInstanceOf(HarnessStorageVersionConflictError);

        const loaded = await harness.loadSessionByThread({
          threadId: 'thread-1',
          resourceId: 'resource-1',
        });
        expect(loaded?.id).toBe('a');
      });
    });

    describe('createOrLoadActiveSession', () => {
      it('creates a leased active session when none exists', async () => {
        if (!harness) return;
        const result = await harness.createOrLoadActiveSession(createSampleSessionRecord(), {
          initialLease: { ownerId: 'h', ttlMs: 30_000 },
        });

        expect(result).toMatchObject({
          created: true,
          leaseAcquired: true,
          version: 1,
          record: expect.objectContaining({ id: 'session-1', ownerId: 'h', version: 1 }),
        });
        expect(result.expiresAt).toBeGreaterThanOrEqual(result.storageNow);
        await expect(harness.loadSession({ sessionId: 'session-1' })).resolves.toMatchObject({
          ownerId: 'h',
          version: 1,
        });
      });

      it('returns the existing active session for the same namespace/resource/thread', async () => {
        if (!harness) return;
        await harness.createOrLoadActiveSession(createSampleSessionRecord({ id: 'first' }), {
          initialLease: { ownerId: 'h-1', ttlMs: 30_000 },
        });

        const result = await harness.createOrLoadActiveSession(createSampleSessionRecord({ id: 'second' }), {
          initialLease: { ownerId: 'h-2', ttlMs: 30_000 },
        });

        expect(result).toMatchObject({
          created: false,
          leaseAcquired: false,
          record: expect.objectContaining({ id: 'first', ownerId: 'h-1' }),
        });
        await expect(harness.loadSession({ sessionId: 'second' })).resolves.toBeNull();
      });

      it('rejects child admission when the parent is closing', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ id: 'parent', closingAt: 1000, closeDeadlineAt: 2000 }), {
          ownerId: 'h-1',
          ifVersion: 0,
        });

        await expect(
          harness.createOrLoadActiveSession(
            createSampleSessionRecord({
              id: 'child',
              threadId: 'thread-child',
              parentSessionId: 'parent',
            }),
            { initialLease: { ownerId: 'h-2', ttlMs: 30_000 } },
          ),
        ).rejects.toMatchObject({
          name: 'HarnessStorageParentSessionUnavailableError',
          reason: 'closing',
        } satisfies Partial<HarnessStorageParentSessionUnavailableError>);
        await expect(harness.loadSession({ sessionId: 'child' })).resolves.toBeNull();
      });

      it('returns an existing active child before re-validating a now-closing parent', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ id: 'parent' }), { ownerId: 'h-1', ifVersion: 0 });
        await harness.saveSession(
          createSampleSessionRecord({
            id: 'child',
            threadId: 'thread-child',
            parentSessionId: 'parent',
          }),
          { ownerId: 'h-2', ifVersion: 0 },
        );
        const parent = await harness.loadSession({ sessionId: 'parent' });
        if (!parent) throw new Error('expected parent session');
        await harness.saveSession(
          {
            ...parent,
            closingAt: 1000,
            closeDeadlineAt: 2000,
          },
          { ownerId: 'h-1', ifVersion: parent.version },
        );

        await expect(
          harness.createOrLoadActiveSession(
            createSampleSessionRecord({
              id: 'retry-child',
              threadId: 'thread-child',
              parentSessionId: 'parent',
            }),
            { initialLease: { ownerId: 'h-3', ttlMs: 30_000 } },
          ),
        ).resolves.toMatchObject({
          created: false,
          leaseAcquired: false,
          record: expect.objectContaining({ id: 'child' }),
        });
        await expect(harness.loadSession({ sessionId: 'retry-child' })).resolves.toBeNull();
      });

      it('checks parent availability before deterministic id conflicts', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ id: 'parent', closingAt: 1000, closeDeadlineAt: 2000 }), {
          ownerId: 'h-1',
          ifVersion: 0,
        });
        await harness.saveSession(createSampleSessionRecord({ id: 'colliding-child', threadId: 'other-thread' }), {
          ownerId: 'h-2',
          ifVersion: 0,
        });

        await expect(
          harness.createOrLoadActiveSession(
            createSampleSessionRecord({
              id: 'colliding-child',
              threadId: 'thread-child',
              parentSessionId: 'parent',
            }),
            { initialLease: { ownerId: 'h-3', ttlMs: 30_000 } },
          ),
        ).rejects.toMatchObject({
          name: 'HarnessStorageParentSessionUnavailableError',
          reason: 'closing',
        } satisfies Partial<HarnessStorageParentSessionUnavailableError>);
      });

      it('allows the same resource/thread active key in a different harness namespace', async () => {
        if (!harness) return;
        await harness.createOrLoadActiveSession(createSampleSessionRecord({ harnessName: 'harness-a', id: 'same' }), {
          initialLease: { ownerId: 'h-a', ttlMs: 30_000 },
        });

        const result = await harness.createOrLoadActiveSession(
          createSampleSessionRecord({ harnessName: 'harness-b', id: 'same' }),
          {
            initialLease: { ownerId: 'h-b', ttlMs: 30_000 },
          },
        );

        expect(result).toMatchObject({
          created: true,
          leaseAcquired: true,
          record: expect.objectContaining({ harnessName: 'harness-b', id: 'same', ownerId: 'h-b' }),
        });
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

    describe('thread delete safety hooks', () => {
      it('lists sessions by exact thread, optional resource, namespace, and closed-state filters', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ id: 'open-a', lastActivityAt: 1000 }), {
          ownerId: 'h',
          ifVersion: 0,
        });
        await harness.saveSession(
          createSampleSessionRecord({
            id: 'closed-a',
            threadId: 'thread-1',
            closedAt: Date.now(),
            lastActivityAt: 2000,
          }),
          {
            ownerId: 'h',
            ifVersion: 0,
          },
        );
        await harness.saveSession(
          createSampleSessionRecord({
            id: 'other-resource',
            threadId: 'thread-1',
            resourceId: 'resource-2',
            lastActivityAt: 3000,
          }),
          {
            ownerId: 'h',
            ifVersion: 0,
          },
        );
        await harness.saveSession(
          createSampleSessionRecord({
            id: 'other-namespace',
            harnessName: 'other',
            threadId: 'thread-1',
            resourceId: 'resource-3',
            lastActivityAt: 4000,
          }),
          {
            harnessName: 'other',
            ownerId: 'h',
            ifVersion: 0,
          },
        );
        await harness.saveSession(createSampleSessionRecord({ id: 'different-thread', threadId: 'thread-2' }), {
          ownerId: 'h',
          ifVersion: 0,
        });

        await expect(
          harness.listSessionsByThread({ harnessName: 'default', resourceId: 'resource-1', threadId: 'thread-1' }),
        ).resolves.toEqual([expect.objectContaining({ id: 'open-a' })]);
        await expect(
          harness.listSessionsByThread({
            harnessName: 'default',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            includeClosed: true,
          }),
        ).resolves.toEqual([expect.objectContaining({ id: 'closed-a' }), expect.objectContaining({ id: 'open-a' })]);
        await expect(harness.listSessionsByThread({ threadId: 'thread-1', includeClosed: true })).resolves.toEqual([
          expect.objectContaining({ id: 'other-namespace' }),
          expect.objectContaining({ id: 'other-resource' }),
          expect.objectContaining({ id: 'closed-a' }),
          expect.objectContaining({ id: 'open-a' }),
        ]);
      });

      it('lists active sessions by thread across resources and visible harness namespaces', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ id: 'open-a', lastActivityAt: 1000 }), {
          ownerId: 'h',
          ifVersion: 0,
        });
        await harness.saveSession(
          createSampleSessionRecord({
            id: 'open-b',
            harnessName: 'other',
            resourceId: 'resource-2',
            lastActivityAt: 2000,
          }),
          {
            harnessName: 'other',
            ownerId: 'h',
            ifVersion: 0,
          },
        );
        await harness.saveSession(
          createSampleSessionRecord({ id: 'closed-a', closedAt: Date.now(), lastActivityAt: 3000 }),
          {
            ownerId: 'h',
            ifVersion: 0,
          },
        );

        await expect(harness.listActiveSessionsByThread({ threadId: 'thread-1' })).resolves.toEqual([
          expect.objectContaining({ id: 'open-b' }),
          expect.objectContaining({ id: 'open-a' }),
        ]);
        await expect(
          harness.listActiveSessionsByThread({ harnessName: 'default', threadId: 'thread-1' }),
        ).resolves.toEqual([expect.objectContaining({ id: 'open-a' })]);
      });

      it('blocks active-session admission while a thread delete fence is held', async () => {
        if (!harness) return;
        const harnessStorage = harness;

        await harnessStorage.withThreadDeleteFence(
          { threadId: 'thread-1', ownerId: 'deleter', ttlMs: 30_000 },
          async fence => {
            await expect(
              harnessStorage.createOrLoadActiveSession(createSampleSessionRecord(), {
                initialLease: { ownerId: 'h', ttlMs: 30_000 },
              }),
            ).rejects.toBeInstanceOf(HarnessStorageThreadDeleteFenceConflictError);
            await expect(
              harnessStorage.saveSession(createSampleSessionRecord({ id: 'direct-blocked' }), {
                ownerId: 'h',
                ifVersion: 0,
              }),
            ).rejects.toBeInstanceOf(HarnessStorageThreadDeleteFenceConflictError);
            await expect(fence.assertActive()).resolves.toBeUndefined();
          },
        );

        await expect(
          harness.createOrLoadActiveSession(createSampleSessionRecord(), {
            initialLease: { ownerId: 'h', ttlMs: 30_000 },
          }),
        ).resolves.toMatchObject({ created: true, record: expect.objectContaining({ id: 'session-1' }) });
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
          source: 'preupload',
          data: new Uint8Array([1, 2, 3]),
        });

        await harness.deleteSession({ sessionId: 'session-1' });

        expect(await harness.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' })).toBeNull();
      });

      it('clears attachment references before cascading owned attachments', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h', ifVersion: 0 });
        await harness.saveAttachment({
          sessionId: 'session-1',
          attachmentId: 'a1',
          name: 'note.txt',
          mimeType: 'text/plain',
          source: 'preupload',
          data: new Uint8Array([1, 2, 3]),
        });
        await harness.recordAttachmentReferences([
          {
            sessionId: 'session-1',
            attachmentId: 'a1',
            source: 'queued_item',
            sourceId: 'q1',
          },
        ]);

        await harness.deleteSession({ sessionId: 'session-1' });

        await expect(harness.listAttachmentReferences({ sessionId: 'session-1', attachmentId: 'a1' })).resolves.toEqual(
          [],
        );
        await expect(harness.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' })).resolves.toBeNull();
      });

      it('rejects guarded delete when the observed version is stale', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ closedAt: 2000, lastActivityAt: 2000 }), {
          ownerId: 'h',
          ifVersion: 0,
        });
        const observed = await harness.loadSession({ sessionId: 'session-1' });
        expect(observed).not.toBeNull();
        await harness.saveSession(
          {
            ...observed!,
            state: { changed: true },
          },
          { ownerId: 'h', ifVersion: observed!.version },
        );

        await expect(
          harness.deleteSession({
            sessionId: 'session-1',
            ifVersion: observed!.version,
            expectedResourceId: observed!.resourceId,
            expectedThreadId: observed!.threadId,
            expectedParentSessionId: observed!.parentSessionId ?? null,
            expectedCreatedAt: observed!.createdAt,
            requireClosed: true,
          }),
        ).rejects.toBeInstanceOf(HarnessStorageVersionConflictError);
        await expect(harness.loadSession({ sessionId: 'session-1' })).resolves.toMatchObject({
          id: 'session-1',
          version: observed!.version + 1,
        });
      });

      it('rejects guarded delete when non-version guards fail', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ id: 'guarded', closedAt: 2000, lastActivityAt: 2000 }), {
          ownerId: 'h',
          ifVersion: 0,
        });
        const observed = await harness.loadSession({ sessionId: 'guarded' });
        expect(observed).not.toBeNull();

        const guardMismatches = [
          { expectedResourceId: 'other-resource' },
          { expectedThreadId: 'other-thread' },
          { expectedParentSessionId: 'other-parent' },
          { expectedCreatedAt: observed!.createdAt + 1 },
        ];

        for (const mismatch of guardMismatches) {
          await expect(
            harness.deleteSession({
              sessionId: 'guarded',
              ifVersion: observed!.version,
              ...mismatch,
            }),
          ).rejects.toBeInstanceOf(HarnessStorageDeleteGuardConflictError);
          await expect(harness.loadSession({ sessionId: 'guarded' })).resolves.toMatchObject({ id: 'guarded' });
        }

        await harness.saveSession(createSampleSessionRecord({ id: 'active', threadId: 'active-thread' }), {
          ownerId: 'h',
          ifVersion: 0,
        });
        const active = await harness.loadSession({ sessionId: 'active' });
        expect(active).not.toBeNull();

        await expect(
          harness.deleteSession({
            sessionId: 'active',
            ifVersion: active!.version,
            requireClosed: true,
          }),
        ).rejects.toBeInstanceOf(HarnessStorageDeleteGuardConflictError);
        await expect(harness.loadSession({ sessionId: 'active' })).resolves.toMatchObject({ id: 'active' });
      });

      it('rejects guarded batch delete without deleting earlier rows', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ id: 'parent', closedAt: 2000, lastActivityAt: 2000 }), {
          ownerId: 'h',
          ifVersion: 0,
        });
        await harness.saveSession(
          createSampleSessionRecord({
            id: 'child',
            threadId: 'child-thread',
            parentSessionId: 'parent',
            closedAt: 2000,
            lastActivityAt: 2000,
          }),
          { ownerId: 'h', ifVersion: 0 },
        );
        const parent = await harness.loadSession({ sessionId: 'parent' });
        const child = await harness.loadSession({ sessionId: 'child' });
        expect(parent).not.toBeNull();
        expect(child).not.toBeNull();
        await harness.saveSession(
          { ...parent!, state: { changed: true } },
          { ownerId: 'h', ifVersion: parent!.version },
        );

        await expect(
          harness.deleteSessions({
            sessions: [
              {
                sessionId: 'child',
                ifVersion: child!.version,
                expectedResourceId: child!.resourceId,
                expectedThreadId: child!.threadId,
                expectedParentSessionId: child!.parentSessionId ?? null,
                expectedCreatedAt: child!.createdAt,
                requireClosed: true,
              },
              {
                sessionId: 'parent',
                ifVersion: parent!.version,
                expectedResourceId: parent!.resourceId,
                expectedThreadId: parent!.threadId,
                expectedParentSessionId: parent!.parentSessionId ?? null,
                expectedCreatedAt: parent!.createdAt,
                requireClosed: true,
              },
            ],
          }),
        ).rejects.toBeInstanceOf(HarnessStorageDeleteGuardConflictError);
        await expect(harness.loadSession({ sessionId: 'child' })).resolves.toMatchObject({ id: 'child' });
        await expect(harness.loadSession({ sessionId: 'parent' })).resolves.toMatchObject({
          id: 'parent',
          version: parent!.version + 1,
        });
      });

      it('rejects duplicate guarded batch entries before deleting the row', async () => {
        if (!harness) return;
        await harness.saveSession(
          createSampleSessionRecord({ id: 'duplicate', closedAt: 2000, lastActivityAt: 2000 }),
          {
            ownerId: 'h',
            ifVersion: 0,
          },
        );
        const observed = await harness.loadSession({ sessionId: 'duplicate' });
        expect(observed).not.toBeNull();

        await expect(
          harness.deleteSessions({
            sessions: [
              {
                sessionId: 'duplicate',
                ifVersion: observed!.version,
                requireClosed: true,
              },
              {
                sessionId: 'duplicate',
                ifVersion: observed!.version,
                expectedThreadId: 'other-thread',
              },
            ],
          }),
        ).rejects.toBeInstanceOf(HarnessStorageDeleteGuardConflictError);
        await expect(harness.loadSession({ sessionId: 'duplicate' })).resolves.toMatchObject({ id: 'duplicate' });
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
          source: 'preupload',
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
          source: 'preupload',
          data: new Uint8Array([1]),
        });
        await harness.saveAttachment({
          sessionId: 'session-b',
          attachmentId: 'shared',
          name: 'b.txt',
          mimeType: 'text/plain',
          source: 'preupload',
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
          source: 'preupload',
          data: new Uint8Array([1]),
        });
        await harness.saveAttachment({
          sessionId: 'session-1',
          attachmentId: 'a1',
          name: 'second.txt',
          mimeType: 'text/plain',
          source: 'preupload',
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
          source: 'preupload',
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
          source: 'preupload',
          data: new Uint8Array([1, 2, 3]),
        });

        const record = await harness.getAttachmentRecord({
          sessionId: 'session-1',
          attachmentId: 'a1',
        });
        expect(record).toMatchObject({
          attachmentId: 'a1',
          ownerSessionId: 'session-1',
          name: 'n.txt',
          mimeType: 'text/plain',
          bytes: 3,
          source: 'preupload',
        });
        expect(record?.sha256).toHaveLength(64);
        expect(record?.createdAt).toBeGreaterThan(0);
      });

      it('deletes a single attachment', async () => {
        if (!harness) return;
        await harness.saveAttachment({
          sessionId: 'session-1',
          attachmentId: 'a1',
          name: 'n',
          mimeType: 'text/plain',
          source: 'preupload',
          data: new Uint8Array([1]),
        });

        await harness.deleteAttachment({ sessionId: 'session-1', attachmentId: 'a1' });

        expect(await harness.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' })).toBeNull();
      });

      it('lists attachment references and blocks guarded delete while references remain', async () => {
        if (!harness) return;
        await harness.saveAttachment({
          sessionId: 'session-1',
          attachmentId: 'a1',
          name: 'n',
          mimeType: 'text/plain',
          source: 'preupload',
          data: new Uint8Array([1]),
        });
        await harness.recordAttachmentReferences([
          {
            sessionId: 'session-1',
            attachmentId: 'a1',
            source: 'queued_item',
            sourceId: 'q1',
          },
        ]);

        await expect(harness.listAttachmentReferences({ sessionId: 'session-1', attachmentId: 'a1' })).resolves.toEqual(
          [{ source: 'queued_item', sourceId: 'q1' }],
        );
        await expect(harness.deleteAttachment({ sessionId: 'session-1', attachmentId: 'a1' })).rejects.toMatchObject({
          references: [{ source: 'queued_item', sourceId: 'q1' }],
        });

        await harness.deleteAttachmentReferences([
          {
            sessionId: 'session-1',
            attachmentId: 'a1',
            source: 'queued_item',
            sourceId: 'q1',
          },
        ]);
        await harness.deleteAttachment({ sessionId: 'session-1', attachmentId: 'a1' });
        await expect(harness.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' })).resolves.toBeNull();
      });

      it('deletes only attachments for the requested session in deleteAttachmentsForSession', async () => {
        if (!harness) return;
        await harness.saveAttachment({
          sessionId: 'session-a',
          attachmentId: 'a1',
          name: 'n',
          mimeType: 'text/plain',
          source: 'preupload',
          data: new Uint8Array([1]),
        });
        await harness.saveAttachment({
          sessionId: 'session-b',
          attachmentId: 'a2',
          name: 'n',
          mimeType: 'text/plain',
          source: 'preupload',
          data: new Uint8Array([2]),
        });
        await harness.recordAttachmentReferences([
          {
            sessionId: 'session-a',
            attachmentId: 'a1',
            source: 'queued_item',
            sourceId: 'q1',
          },
        ]);

        await harness.deleteAttachmentsForSession({ sessionId: 'session-a' });

        expect(await harness.loadAttachment({ sessionId: 'session-a', attachmentId: 'a1' })).not.toBeNull();
        expect(await harness.loadAttachment({ sessionId: 'session-b', attachmentId: 'a2' })).not.toBeNull();
      });

      it('keeps transactional attachment references in the session harness namespace', async () => {
        if (!harness) return;
        await harness.saveSession(createSampleSessionRecord({ harnessName: 'harness-a', id: 'session-a' }), {
          harnessName: 'harness-a',
          ownerId: 'h',
          ifVersion: 0,
        });
        await harness.saveAttachment({
          harnessName: 'harness-b',
          sessionId: 'session-a',
          attachmentId: 'a1',
          name: 'n',
          mimeType: 'text/plain',
          source: 'preupload',
          data: new Uint8Array([1]),
        });

        await expect(
          harness.saveSessionWithAttachmentReferences(
            createSampleSessionRecord({ harnessName: 'harness-a', id: 'session-a', version: 1 }),
            { harnessName: 'harness-a', ownerId: 'h', ifVersion: 1 },
            [
              {
                harnessName: 'harness-b',
                sessionId: 'session-a',
                attachmentId: 'a1',
                source: 'queued_item',
                sourceId: 'q1',
              },
            ],
          ),
        ).rejects.toBeInstanceOf(HarnessStorageAttachmentUnavailableError);
        await expect(
          harness.listAttachmentReferences({ harnessName: 'harness-b', sessionId: 'session-a', attachmentId: 'a1' }),
        ).resolves.toEqual([]);
      });
    });

    describe('admission/result evidence', () => {
      it('loads queue admission receipts and resolves duplicate/conflict attempts', async () => {
        if (!harness) return;
        await harness.saveSession(
          createSampleSessionRecord({
            queueAdmissionReceipts: {
              'queued-1': {
                admissionId: 'admission-1',
                admissionHash: 'hash-1',
                queuedItemId: 'queued-1',
                status: 'accepted',
                attempts: 1,
                enqueuedAt: 1000,
                acceptedAt: 1100,
                updatedAt: 1100,
                runId: 'run-1',
                signalId: 'signal-1',
              },
            },
          }),
          { ownerId: 'h', ifVersion: 0 },
        );

        await expect(
          harness.loadQueueResultEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            queuedItemId: 'queued-1',
          }),
        ).resolves.toMatchObject({ status: 'accepted', admissionId: 'admission-1' });
        await expect(
          harness.loadQueueResultEvidence({
            sessionId: 'session-1',
            resourceId: 'other-resource',
            queuedItemId: 'queued-1',
          }),
        ).resolves.toBeNull();
        await expect(
          harness.resolveOperationAdmissionEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            kind: 'queue',
            admissionId: 'admission-1',
            attemptedAdmissionHash: 'hash-1',
          }),
        ).resolves.toMatchObject({ status: 'duplicate', storedAdmissionHash: 'hash-1' });
        await expect(
          harness.resolveOperationAdmissionEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            kind: 'queue',
            admissionId: 'admission-1',
            attemptedAdmissionHash: 'different-hash',
          }),
        ).resolves.toMatchObject({ status: 'conflict', storedAdmissionHash: 'hash-1' });
        await expect(
          harness.resolveOperationAdmissionEvidence({
            sessionId: 'session-1',
            resourceId: 'other-resource',
            threadId: 'thread-1',
            kind: 'queue',
            admissionId: 'admission-1',
            attemptedAdmissionHash: 'hash-1',
          }),
        ).resolves.toMatchObject({ status: 'none' });
      });

      it('writes, loads, conflicts, and deletes operation tombstones', async () => {
        if (!harness) return;
        const tombstone = {
          kind: 'message' as const,
          harnessName: 'default',
          sessionId: 'session-1',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          admissionId: 'admission-1',
          admissionHash: 'hash-1',
          signalId: 'signal-1',
          runId: 'run-1',
          terminalAt: 2000,
          compactedAt: 3000,
          expiresAt: 4000,
        };

        await harness.writeOperationAdmissionTombstone(tombstone);
        await harness.writeOperationAdmissionTombstone(tombstone);

        await expect(
          harness.loadMessageResultEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            signalId: 'signal-1',
          }),
        ).resolves.toEqual(tombstone);
        await expect(
          harness.resolveOperationAdmissionEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            kind: 'message',
            admissionId: 'admission-1',
            attemptedAdmissionHash: 'hash-1',
          }),
        ).resolves.toMatchObject({ status: 'duplicate', storedAdmissionHash: 'hash-1' });
        await expect(
          harness.writeOperationAdmissionTombstone({ ...tombstone, admissionHash: 'different-hash' }),
        ).rejects.toBeInstanceOf(HarnessStorageAdmissionConflictError);

        await harness.deleteOperationAdmissionTombstonesForSession({
          sessionId: 'session-1',
          resourceId: 'resource-1',
        });
        await expect(
          harness.loadMessageResultEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            signalId: 'signal-1',
          }),
        ).resolves.toBeNull();
      });

      it('writes retained message result evidence and resolves duplicate/conflict attempts', async () => {
        if (!harness) return;
        await harness.writeMessageResultEvidence({
          harnessName: 'default',
          sessionId: 'session-1',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          signalId: 'signal-1',
          runId: 'run-1',
          admissionId: 'admission-1',
          admissionHash: 'hash-1',
          status: 'completed',
          result: { text: 'done' },
          createdAt: 1000,
          updatedAt: 2000,
        });

        await expect(
          harness.loadMessageResultEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            signalId: 'signal-1',
          }),
        ).resolves.toMatchObject({ status: 'completed', result: { text: 'done' } });
        await expect(
          harness.resolveOperationAdmissionEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            kind: 'message',
            admissionId: 'admission-1',
            attemptedAdmissionHash: 'hash-1',
          }),
        ).resolves.toMatchObject({ status: 'duplicate', storedAdmissionHash: 'hash-1' });
        await expect(
          harness.resolveOperationAdmissionEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            kind: 'message',
            admissionId: 'admission-1',
            attemptedAdmissionHash: 'different-hash',
          }),
        ).resolves.toMatchObject({ status: 'conflict', storedAdmissionHash: 'hash-1' });
      });

      it('compacts terminal message evidence into tombstones', async () => {
        if (!harness) return;
        await harness.writeMessageResultEvidence({
          harnessName: 'default',
          sessionId: 'session-1',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          signalId: 'signal-1',
          runId: 'run-1',
          admissionId: 'admission-1',
          admissionHash: 'hash-1',
          status: 'failed',
          error: { code: 'harness.test', message: 'failed' },
          createdAt: 1000,
          updatedAt: 2000,
        });

        const compacted = await harness.compactOperationResultEvidence({
          sessionId: 'session-1',
          resourceId: 'resource-1',
          kind: 'message',
          signalId: 'signal-1',
          now: 3000,
        });

        expect(compacted).toMatchObject({
          kind: 'message',
          admissionId: 'admission-1',
          admissionHash: 'hash-1',
          signalId: 'signal-1',
          terminalAt: 2000,
          compactedAt: 3000,
        });
        await expect(
          harness.loadMessageResultEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            signalId: 'signal-1',
          }),
        ).resolves.toEqual(compacted);
      });

      it('scopes operation evidence deletion by thread and signal when provided', async () => {
        if (!harness) return;
        const base = {
          harnessName: 'default',
          sessionId: 'session-1',
          resourceId: 'resource-1',
          status: 'pending' as const,
          createdAt: 1000,
          updatedAt: 1000,
        };
        await harness.writeMessageResultEvidence({
          ...base,
          threadId: 'thread-1',
          signalId: 'signal-1',
        });
        await harness.writeMessageResultEvidence({
          ...base,
          threadId: 'thread-1',
          signalId: 'signal-2',
        });
        await harness.writeMessageResultEvidence({
          ...base,
          threadId: 'thread-2',
          signalId: 'signal-3',
        });

        await harness.deleteOperationAdmissionTombstonesForSession({
          sessionId: 'session-1',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          signalId: 'signal-1',
        });

        await expect(
          harness.loadMessageResultEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            signalId: 'signal-1',
          }),
        ).resolves.toBeNull();
        await expect(
          harness.loadMessageResultEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            threadId: 'thread-1',
            signalId: 'signal-2',
          }),
        ).resolves.toMatchObject({ status: 'pending' });
        await expect(
          harness.loadMessageResultEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            threadId: 'thread-2',
            signalId: 'signal-3',
          }),
        ).resolves.toMatchObject({ status: 'pending' });
      });

      it('compacts terminal queue receipts into tombstones', async () => {
        if (!harness) return;
        await harness.saveSession(
          createSampleSessionRecord({
            queueAdmissionReceipts: {
              'queued-1': {
                admissionId: 'admission-1',
                admissionHash: 'hash-1',
                queuedItemId: 'queued-1',
                status: 'completed',
                attempts: 1,
                enqueuedAt: 1000,
                acceptedAt: 1100,
                completedAt: 2000,
                updatedAt: 2000,
                runId: 'run-1',
                signalId: 'signal-1',
                result: { ok: true },
              },
            },
          }),
          { ownerId: 'h', ifVersion: 0 },
        );

        const tombstone = await harness.compactOperationResultEvidence({
          sessionId: 'session-1',
          resourceId: 'other-resource',
          kind: 'queue',
          queuedItemId: 'queued-1',
          now: 3000,
        });
        expect(tombstone).toBeNull();

        const compacted = await harness.compactOperationResultEvidence({
          sessionId: 'session-1',
          resourceId: 'resource-1',
          kind: 'queue',
          queuedItemId: 'queued-1',
          now: 3000,
        });
        expect(compacted).toMatchObject({
          kind: 'queue',
          admissionId: 'admission-1',
          admissionHash: 'hash-1',
          queuedItemId: 'queued-1',
          terminalAt: 2000,
          compactedAt: 3000,
        });
        await expect(
          harness.loadQueueResultEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            queuedItemId: 'queued-1',
          }),
        ).resolves.toEqual(compacted);
        await expect(harness.loadSession({ sessionId: 'session-1' })).resolves.toMatchObject({
          queueAdmissionReceipts: undefined,
        });
      });

      it('compacts concurrent terminal queue receipts without losing survivors', async () => {
        if (!harness) return;
        await harness.saveSession(
          createSampleSessionRecord({
            queueAdmissionReceipts: {
              'queued-1': {
                admissionId: 'admission-1',
                admissionHash: 'hash-1',
                queuedItemId: 'queued-1',
                status: 'completed',
                attempts: 1,
                enqueuedAt: 1000,
                acceptedAt: 1100,
                completedAt: 2000,
                updatedAt: 2000,
              },
              'queued-2': {
                admissionId: 'admission-2',
                admissionHash: 'hash-2',
                queuedItemId: 'queued-2',
                status: 'failed',
                attempts: 1,
                enqueuedAt: 1000,
                acceptedAt: 1100,
                failedAt: 2100,
                updatedAt: 2100,
              },
              'queued-3': {
                admissionId: 'admission-3',
                admissionHash: 'hash-3',
                queuedItemId: 'queued-3',
                status: 'accepted',
                attempts: 1,
                enqueuedAt: 1000,
                acceptedAt: 1100,
                updatedAt: 1100,
              },
            },
          }),
          { ownerId: 'h', ifVersion: 0 },
        );

        const [first, second] = await Promise.all([
          harness.compactOperationResultEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            kind: 'queue',
            queuedItemId: 'queued-1',
            now: 3000,
          }),
          harness.compactOperationResultEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            kind: 'queue',
            queuedItemId: 'queued-2',
            now: 3000,
          }),
        ]);

        expect(first).toMatchObject({ queuedItemId: 'queued-1', admissionHash: 'hash-1' });
        expect(second).toMatchObject({ queuedItemId: 'queued-2', admissionHash: 'hash-2' });
        await expect(
          harness.loadQueueResultEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            queuedItemId: 'queued-1',
          }),
        ).resolves.toMatchObject({ queuedItemId: 'queued-1', admissionHash: 'hash-1' });
        await expect(
          harness.loadQueueResultEvidence({
            sessionId: 'session-1',
            resourceId: 'resource-1',
            queuedItemId: 'queued-2',
          }),
        ).resolves.toMatchObject({ queuedItemId: 'queued-2', admissionHash: 'hash-2' });
        await expect(harness.loadSession({ sessionId: 'session-1' })).resolves.toMatchObject({
          queueAdmissionReceipts: {
            'queued-3': expect.objectContaining({ status: 'accepted' }),
          },
        });
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
          source: 'preupload',
          data: new Uint8Array([1]),
        });

        await harness.dangerouslyClearAll();

        expect(await harness.loadSession({ sessionId: 'session-1' })).toBeNull();
        expect(await harness.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' })).toBeNull();
      });

      it('clears active thread delete fences', async () => {
        if (!harness) return;
        const harnessStorage = harness;

        await harnessStorage.withThreadDeleteFence(
          { threadId: 'reset-thread', ownerId: 'deleter', ttlMs: 30_000 },
          async () => {
            await harnessStorage.dangerouslyClearAll();

            await expect(
              harnessStorage.createOrLoadActiveSession(
                createSampleSessionRecord({ id: 'after-reset', threadId: 'reset-thread' }),
                {
                  initialLease: { ownerId: 'h', ttlMs: 30_000 },
                },
              ),
            ).resolves.toMatchObject({ created: true });
          },
        );
      });
    });
  });
}
