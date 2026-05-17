import { describe, expect, it } from 'vitest';

import { InMemoryDB } from '../inmemory-db';
import {
  HarnessStorageParentSessionUnavailableError,
  HarnessStorageThreadDeleteFenceConflictError,
  HarnessStorageVersionConflictError,
} from './base';
import { InMemoryHarness } from './inmemory';
import type { SessionRecord } from './types';

describe('InMemoryHarness admission storage contract', () => {
  it('creates or returns one active session for a namespace/resource/thread key', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const first = await storage.createOrLoadActiveSession(sampleSession({ id: 'first' }), {
      initialLease: { ownerId: 'h-1', ttlMs: 30_000 },
    });
    const second = await storage.createOrLoadActiveSession(sampleSession({ id: 'second' }), {
      initialLease: { ownerId: 'h-2', ttlMs: 30_000 },
    });

    expect(first).toMatchObject({ created: true, leaseAcquired: true, version: 1 });
    expect(second).toMatchObject({
      created: false,
      leaseAcquired: false,
      record: expect.objectContaining({ id: 'first', ownerId: 'h-1' }),
    });
    await expect(storage.loadSession({ sessionId: 'second' })).resolves.toBeNull();
  });

  it('rejects direct first writes that would create duplicate active sessions', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(sampleSession({ id: 'first' }), { ownerId: 'h-1', ifVersion: 0 });

    await expect(
      storage.saveSession(sampleSession({ id: 'second' }), { ownerId: 'h-2', ifVersion: 0 }),
    ).rejects.toBeInstanceOf(HarnessStorageVersionConflictError);
    await expect(storage.loadSession({ sessionId: 'second' })).resolves.toBeNull();
  });

  it('rejects child admission when the parent is closing', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(sampleSession({ id: 'parent', closingAt: 1000, closeDeadlineAt: 2000 }), {
      ownerId: 'h-1',
      ifVersion: 0,
    });

    await expect(
      storage.createOrLoadActiveSession(
        sampleSession({
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
    await expect(storage.loadSession({ sessionId: 'child' })).resolves.toBeNull();
  });

  it('returns an existing active child session before re-validating a now-closing parent', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(sampleSession({ id: 'parent' }), { ownerId: 'h-1', ifVersion: 0 });
    await storage.saveSession(
      sampleSession({
        id: 'child',
        threadId: 'thread-child',
        parentSessionId: 'parent',
      }),
      { ownerId: 'h-2', ifVersion: 0 },
    );
    const parent = await storage.loadSession({ sessionId: 'parent' });
    if (!parent) throw new Error('expected parent session');
    await storage.saveSession(
      {
        ...parent,
        closingAt: 1000,
        closeDeadlineAt: 2000,
      },
      { ownerId: 'h-1', ifVersion: parent.version },
    );

    await expect(
      storage.createOrLoadActiveSession(
        sampleSession({
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
    await expect(storage.loadSession({ sessionId: 'retry-child' })).resolves.toBeNull();
  });

  it('isolates sessions by harness namespace', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });

    await storage.saveSession(sampleSession({ harnessName: 'harness-a', modeId: 'build' }), {
      harnessName: 'harness-a',
      ownerId: 'h',
      ifVersion: 0,
    });
    await storage.saveSession(sampleSession({ harnessName: 'harness-b', modeId: 'review' }), {
      harnessName: 'harness-b',
      ownerId: 'h',
      ifVersion: 0,
    });

    await expect(storage.loadSession({ harnessName: 'harness-a', sessionId: 'session-1' })).resolves.toMatchObject({
      harnessName: 'harness-a',
      modeId: 'build',
    });
    await expect(storage.loadSession({ harnessName: 'harness-b', sessionId: 'session-1' })).resolves.toMatchObject({
      harnessName: 'harness-b',
      modeId: 'review',
    });
  });

  it('lists sessions by exact resource/thread and can include closed records', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(
      sampleSession({ id: 'closed-a', resourceId: 'r1', threadId: 'thread-a', closedAt: 2000, lastActivityAt: 2000 }),
      { ownerId: 'h', ifVersion: 0 },
    );
    await storage.saveSession(sampleSession({ id: 'active-a', resourceId: 'r1', threadId: 'thread-a' }), {
      ownerId: 'h',
      ifVersion: 0,
    });
    await storage.saveSession(sampleSession({ id: 'other-resource', resourceId: 'r2', threadId: 'thread-a' }), {
      ownerId: 'h',
      ifVersion: 0,
    });
    await storage.saveSession(sampleSession({ id: 'other-thread', resourceId: 'r1', threadId: 'thread-b' }), {
      ownerId: 'h',
      ifVersion: 0,
    });

    await expect(storage.listSessionsByThread({ resourceId: 'r1', threadId: 'thread-a' })).resolves.toEqual([
      expect.objectContaining({ id: 'active-a' }),
    ]);
    await expect(
      storage.listSessionsByThread({ resourceId: 'r1', threadId: 'thread-a', includeClosed: true }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'closed-a' }),
      expect.objectContaining({ id: 'active-a' }),
    ]);
    const allThreadSessions = await storage.listSessionsByThread({ threadId: 'thread-a', includeClosed: true });
    expect(allThreadSessions).toHaveLength(3);
    expect(allThreadSessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'closed-a' }),
        expect.objectContaining({ id: 'active-a' }),
        expect.objectContaining({ id: 'other-resource' }),
      ]),
    );
  });

  it('lists active sessions by thread across resources and harness namespaces', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(sampleSession({ id: 'r1-active', resourceId: 'r1', threadId: 'shared-thread' }), {
      ownerId: 'h',
      ifVersion: 0,
    });
    await storage.saveSession(
      sampleSession({ id: 'r2-active', resourceId: 'r2', threadId: 'shared-thread', lastActivityAt: 2000 }),
      { ownerId: 'h', ifVersion: 0 },
    );
    await storage.saveSession(
      sampleSession({ id: 'r3-closed', resourceId: 'r3', threadId: 'shared-thread', closedAt: 3000 }),
      { ownerId: 'h', ifVersion: 0 },
    );
    await storage.saveSession(
      sampleSession({
        harnessName: 'other',
        id: 'other-namespace',
        resourceId: 'r4',
        threadId: 'shared-thread',
        lastActivityAt: 3000,
      }),
      { harnessName: 'other', ownerId: 'h', ifVersion: 0 },
    );

    await expect(storage.listActiveSessionsByThread({ threadId: 'shared-thread' })).resolves.toEqual([
      expect.objectContaining({ id: 'other-namespace', resourceId: 'r4' }),
      expect.objectContaining({ id: 'r2-active', resourceId: 'r2' }),
      expect.objectContaining({ id: 'r1-active', resourceId: 'r1' }),
    ]);
    await expect(
      storage.listActiveSessionsByThread({ harnessName: 'other', threadId: 'shared-thread' }),
    ).resolves.toEqual([expect.objectContaining({ id: 'other-namespace' })]);
  });

  it('blocks new thread admission while a delete fence is active', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.createOrLoadActiveSession(
      sampleSession({ id: 'existing', resourceId: 'existing', threadId: 'shared-thread' }),
      {
        initialLease: { ownerId: 'h', ttlMs: 30_000 },
      },
    );

    await storage.withThreadDeleteFence({ threadId: 'shared-thread', ownerId: 'deleter', ttlMs: 30_000 }, async () => {
      await expect(
        storage.createOrLoadActiveSession(
          sampleSession({ id: 'blocked', resourceId: 'other', threadId: 'shared-thread' }),
          {
            initialLease: { ownerId: 'h', ttlMs: 30_000 },
          },
        ),
      ).rejects.toBeInstanceOf(HarnessStorageThreadDeleteFenceConflictError);
      await expect(
        storage.createOrLoadActiveSession(
          sampleSession({ id: 'attach-blocked', resourceId: 'existing', threadId: 'shared-thread' }),
          {
            initialLease: { ownerId: 'h', ttlMs: 30_000 },
          },
        ),
      ).rejects.toBeInstanceOf(HarnessStorageThreadDeleteFenceConflictError);
      await expect(
        storage.saveSession(sampleSession({ id: 'direct-blocked', resourceId: 'other', threadId: 'shared-thread' }), {
          ownerId: 'h',
          ifVersion: 0,
        }),
      ).rejects.toBeInstanceOf(HarnessStorageThreadDeleteFenceConflictError);
      await expect(storage.loadSession({ sessionId: 'blocked' })).resolves.toBeNull();
      await expect(storage.loadSession({ sessionId: 'attach-blocked' })).resolves.toBeNull();
      await expect(storage.loadSession({ sessionId: 'direct-blocked' })).resolves.toBeNull();
    });

    await expect(
      storage.createOrLoadActiveSession(
        sampleSession({ id: 'allowed', resourceId: 'other', threadId: 'shared-thread' }),
        {
          initialLease: { ownerId: 'h', ttlMs: 30_000 },
        },
      ),
    ).resolves.toMatchObject({ created: true });
  });

  it('renews delete fences while protected work exceeds the original ttl', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });

    await storage.withThreadDeleteFence({ threadId: 'slow-thread', ownerId: 'deleter', ttlMs: 120 }, async () => {
      await new Promise(resolve => setTimeout(resolve, 260));
      await expect(
        storage.createOrLoadActiveSession(sampleSession({ id: 'blocked', threadId: 'slow-thread' }), {
          initialLease: { ownerId: 'h', ttlMs: 30_000 },
        }),
      ).rejects.toBeInstanceOf(HarnessStorageThreadDeleteFenceConflictError);
    });

    await expect(
      storage.createOrLoadActiveSession(sampleSession({ id: 'allowed', threadId: 'slow-thread' }), {
        initialLease: { ownerId: 'h', ttlMs: 30_000 },
      }),
    ).resolves.toMatchObject({ created: true });
  });

  it('detects lost delete fence ownership before destructive work', async () => {
    const db = new InMemoryDB();
    const storage = new InMemoryHarness({ db });

    await storage.withThreadDeleteFence({ threadId: 'lost-thread', ownerId: 'deleter', ttlMs: 30_000 }, async fence => {
      db.harnessThreadDeleteFences.set('lost-thread', {
        threadId: 'lost-thread',
        ownerId: 'other-owner',
        createdAt: Date.now(),
        expiresAt: Date.now() + 30_000,
      });

      await expect(fence.assertActive()).rejects.toBeInstanceOf(HarnessStorageThreadDeleteFenceConflictError);
    });
  });

  it('does not revive an expired delete fence before destructive work', async () => {
    const db = new InMemoryDB();
    const storage = new InMemoryHarness({ db });

    await storage.withThreadDeleteFence({ threadId: 'expired-thread', ownerId: 'deleter', ttlMs: 30_000 }, async fence => {
      db.harnessThreadDeleteFences.set('expired-thread', {
        threadId: 'expired-thread',
        ownerId: 'deleter',
        createdAt: Date.now() - 60_000,
        expiresAt: Date.now() - 1,
      });

      await expect(fence.assertActive()).rejects.toBeInstanceOf(HarnessStorageThreadDeleteFenceConflictError);
    });
  });

  it('compacts terminal queue receipts into namespace-scoped tombstones', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(
      sampleSession({
        queueAdmissionReceipts: {
          'queued-1': {
            admissionId: 'admission-1',
            admissionHash: 'hash-1',
            queuedItemId: 'queued-1',
            status: 'completed',
            attempts: 1,
            enqueuedAt: 1000,
            completedAt: 2000,
            updatedAt: 2000,
            runId: 'run-1',
            signalId: 'signal-1',
          },
        },
      }),
      { ownerId: 'h', ifVersion: 0 },
    );

    const tombstone = await storage.compactOperationResultEvidence({
      sessionId: 'session-1',
      resourceId: 'resource-1',
      kind: 'queue',
      queuedItemId: 'queued-1',
      now: 3000,
    });

    expect(tombstone).toMatchObject({
      harnessName: 'default',
      admissionId: 'admission-1',
      admissionHash: 'hash-1',
      queuedItemId: 'queued-1',
      terminalAt: 2000,
      compactedAt: 3000,
    });
    await expect(
      storage.loadQueueResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        queuedItemId: 'queued-1',
      }),
    ).resolves.toEqual(tombstone);
  });

  it('resolves queue admission duplicates and conflicts from retained receipts', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(
      sampleSession({
        queueAdmissionReceipts: {
          'queued-1': {
            admissionId: 'admission-1',
            admissionHash: 'hash-1',
            queuedItemId: 'queued-1',
            status: 'queued',
            attempts: 0,
            enqueuedAt: 1000,
            updatedAt: 1000,
          },
        },
      }),
      { ownerId: 'h', ifVersion: 0 },
    );

    await expect(
      storage.resolveOperationAdmissionEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        kind: 'queue',
        admissionId: 'admission-1',
        attemptedAdmissionHash: 'hash-1',
      }),
    ).resolves.toMatchObject({ status: 'duplicate', storedAdmissionHash: 'hash-1' });
    await expect(
      storage.resolveOperationAdmissionEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        kind: 'queue',
        admissionId: 'admission-1',
        attemptedAdmissionHash: 'different-hash',
      }),
    ).resolves.toMatchObject({ status: 'conflict', storedAdmissionHash: 'hash-1' });
    await expect(
      storage.loadQueueResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        queuedItemId: 'queued-1',
      }),
    ).resolves.toMatchObject({ admissionId: 'admission-1', status: 'queued' });
  });
});

function sampleSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    harnessName: 'default',
    id: 'session-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    origin: 'top-level',
    ownsThread: false,
    modeId: 'build',
    modelId: 'model-1',
    subagentModelOverrides: {},
    permissionRules: { categories: {}, tools: {} },
    sessionGrants: { categories: [], tools: [] },
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    pendingQueue: [],
    state: {},
    createdAt: 1000,
    lastActivityAt: 1000,
    version: 0,
    ...overrides,
  };
}
