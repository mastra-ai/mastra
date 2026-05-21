import { describe, expect, it, vi } from 'vitest';

import { InMemoryDB } from '../inmemory-db';
import type { HarnessStorageParentSessionUnavailableError } from './base';
import {
  HarnessStorageAttachmentInUseError,
  HarnessStorageAttachmentUnavailableError,
  HarnessStorageChannelActionClaimConflictError,
  HarnessStorageChannelActionReceiptTransitionError,
  HarnessStorageChannelInboxClaimConflictError,
  HarnessStorageChannelInboxTransitionError,
  HarnessStorageChannelOutboxClaimConflictError,
  HarnessStorageChannelOutboxTransitionError,
  HarnessStorageDeleteGuardConflictError,
  HarnessStorageProviderCallbackBindingTransitionError,
  HarnessStorageThreadDeleteFenceConflictError,
  HarnessStorageVersionConflictError,
  HarnessStorageWakeupClaimConflictError,
  HarnessStorageWakeupTransitionError,
} from './base';
import { InMemoryHarness } from './inmemory';
import type {
  ChannelActionReceipt,
  ChannelActionToken,
  ChannelInboxItem,
  ChannelOutboxItem,
  HarnessProviderCallbackBinding,
  HarnessWakeupItem,
  SessionRecord,
  WorkspaceActionJournalEntry,
} from './types';

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

  it('does not hard-delete when the guarded version is stale', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(sampleSession({ id: 'closed', closedAt: 2000, lastActivityAt: 2000 }), {
      ownerId: 'h-1',
      ifVersion: 0,
    });
    const observed = await storage.loadSession({ sessionId: 'closed' });
    if (!observed) throw new Error('expected session');
    await storage.saveSession(
      {
        ...observed,
        state: { changed: true },
      },
      { ownerId: 'h-1', ifVersion: observed.version },
    );

    await expect(
      storage.deleteSession({
        sessionId: 'closed',
        ifVersion: observed.version,
        expectedResourceId: observed.resourceId,
        expectedThreadId: observed.threadId,
        expectedParentSessionId: observed.parentSessionId ?? null,
        expectedCreatedAt: observed.createdAt,
        requireClosed: true,
      }),
    ).rejects.toBeInstanceOf(HarnessStorageVersionConflictError);
    await expect(storage.loadSession({ sessionId: 'closed' })).resolves.toMatchObject({
      id: 'closed',
      version: observed.version + 1,
    });
  });

  it('does not hard-delete when non-version guards fail', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(sampleSession({ id: 'guarded', closedAt: 2000, lastActivityAt: 2000 }), {
      ownerId: 'h-1',
      ifVersion: 0,
    });
    const observed = await storage.loadSession({ sessionId: 'guarded' });
    if (!observed) throw new Error('expected guarded session');

    const guardMismatches = [
      { expectedResourceId: 'other-resource' },
      { expectedThreadId: 'other-thread' },
      { expectedParentSessionId: 'other-parent' },
      { expectedCreatedAt: observed.createdAt + 1 },
    ];

    for (const mismatch of guardMismatches) {
      await expect(
        storage.deleteSession({
          sessionId: 'guarded',
          ifVersion: observed.version,
          ...mismatch,
        }),
      ).rejects.toBeInstanceOf(HarnessStorageDeleteGuardConflictError);
      await expect(storage.loadSession({ sessionId: 'guarded' })).resolves.toMatchObject({ id: 'guarded' });
    }

    await storage.saveSession(sampleSession({ id: 'active', threadId: 'active-thread' }), {
      ownerId: 'h-1',
      ifVersion: 0,
    });
    const active = await storage.loadSession({ sessionId: 'active' });
    if (!active) throw new Error('expected active session');

    await expect(
      storage.deleteSession({
        sessionId: 'active',
        ifVersion: active.version,
        requireClosed: true,
      }),
    ).rejects.toBeInstanceOf(HarnessStorageDeleteGuardConflictError);
    await expect(storage.loadSession({ sessionId: 'active' })).resolves.toMatchObject({ id: 'active' });
  });

  it('rejects guarded batch delete without deleting earlier rows', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(sampleSession({ id: 'parent', closedAt: 2000, lastActivityAt: 2000 }), {
      ownerId: 'h-1',
      ifVersion: 0,
    });
    await storage.saveSession(
      sampleSession({
        id: 'child',
        threadId: 'child-thread',
        parentSessionId: 'parent',
        closedAt: 2000,
        lastActivityAt: 2000,
      }),
      { ownerId: 'h-1', ifVersion: 0 },
    );
    const parent = await storage.loadSession({ sessionId: 'parent' });
    const child = await storage.loadSession({ sessionId: 'child' });
    if (!parent || !child) throw new Error('expected parent and child sessions');

    await storage.saveSession(
      {
        ...parent,
        state: { changed: true },
      },
      { ownerId: 'h-1', ifVersion: parent.version },
    );

    await expect(
      storage.deleteSessions({
        sessions: [
          {
            sessionId: 'child',
            ifVersion: child.version,
            expectedResourceId: child.resourceId,
            expectedThreadId: child.threadId,
            expectedParentSessionId: child.parentSessionId ?? null,
            expectedCreatedAt: child.createdAt,
            requireClosed: true,
          },
          {
            sessionId: 'parent',
            ifVersion: parent.version,
            expectedResourceId: parent.resourceId,
            expectedThreadId: parent.threadId,
            expectedParentSessionId: parent.parentSessionId ?? null,
            expectedCreatedAt: parent.createdAt,
            requireClosed: true,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(HarnessStorageDeleteGuardConflictError);
    await expect(storage.loadSession({ sessionId: 'child' })).resolves.toMatchObject({ id: 'child' });
    await expect(storage.loadSession({ sessionId: 'parent' })).resolves.toMatchObject({
      id: 'parent',
      version: parent.version + 1,
    });
  });

  it('rejects duplicate guarded batch entries before deleting the row', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(sampleSession({ id: 'duplicate', closedAt: 2000, lastActivityAt: 2000 }), {
      ownerId: 'h-1',
      ifVersion: 0,
    });
    const observed = await storage.loadSession({ sessionId: 'duplicate' });
    if (!observed) throw new Error('expected duplicate session');

    await expect(
      storage.deleteSessions({
        sessions: [
          {
            sessionId: 'duplicate',
            ifVersion: observed.version,
            requireClosed: true,
          },
          {
            sessionId: 'duplicate',
            ifVersion: observed.version,
            expectedThreadId: 'other-thread',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(HarnessStorageDeleteGuardConflictError);
    await expect(storage.loadSession({ sessionId: 'duplicate' })).resolves.toMatchObject({ id: 'duplicate' });
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

  it('persists session events for replay by epoch and sequence and refuses ambiguous epochs', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(sampleSession({ harnessName: 'default' }), { ownerId: 'h-1', ifVersion: 0 });

    await storage.appendSessionEvent({
      harnessName: 'default',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      eventId: 'harness-v1:epoch:1',
      epoch: 'epoch',
      sequence: 1,
      event: { type: 'app.event', id: 'harness-v1:epoch:1', timestamp: 1000 },
      emittedAt: 1000,
      storedAt: 1000,
    });
    await storage.appendSessionEvent({
      harnessName: 'default',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      eventId: 'harness-v1:epoch:2',
      epoch: 'epoch',
      sequence: 2,
      event: { type: 'app.event', id: 'harness-v1:epoch:2', timestamp: 1001 },
      emittedAt: 1001,
      storedAt: 1001,
    });

    await expect(
      storage.getSessionEventReplayState({
        harnessName: 'default',
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
      }),
    ).resolves.toEqual({ epoch: 'epoch', oldestSequence: 1, newestSequence: 2 });
    await expect(
      storage.listSessionEvents({
        harnessName: 'default',
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        epoch: 'epoch',
        afterSequence: 1,
        limit: 10,
      }),
    ).resolves.toMatchObject([{ eventId: 'harness-v1:epoch:2', sequence: 2 }]);

    await storage.appendSessionEvent({
      harnessName: 'default',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      eventId: 'harness-v1:other:0',
      epoch: 'other',
      sequence: 0,
      event: { type: 'app.event', id: 'harness-v1:other:0', timestamp: 900 },
      emittedAt: 900,
      storedAt: 2000,
    });
    await expect(
      storage.getSessionEventReplayState({
        harnessName: 'default',
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
      }),
    ).resolves.toBeNull();
  });

  it('hard-deletes all session event replay rows for the session id', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(sampleSession({ harnessName: 'default' }), { ownerId: 'h-1', ifVersion: 0 });
    await storage.appendSessionEvent({
      harnessName: 'default',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      eventId: 'harness-v1:epoch:1',
      epoch: 'epoch',
      sequence: 1,
      event: { type: 'app.event', id: 'harness-v1:epoch:1', timestamp: 1000 },
      emittedAt: 1000,
      storedAt: 1000,
    });

    const active = await storage.loadSession({ sessionId: 'session-1' });
    if (!active) throw new Error('expected session');
    await storage.saveSession(
      { ...active, threadId: 'thread-2', closedAt: 2000, lastActivityAt: 2000 },
      { ownerId: 'h-1', ifVersion: active.version },
    );
    const closed = await storage.loadSession({ sessionId: 'session-1' });
    if (!closed) throw new Error('expected session');

    await storage.deleteSession({
      sessionId: 'session-1',
      ifVersion: closed.version,
      expectedResourceId: closed.resourceId,
      expectedThreadId: closed.threadId,
      expectedParentSessionId: closed.parentSessionId ?? null,
      expectedCreatedAt: closed.createdAt,
      requireClosed: true,
    });

    await expect(
      storage.getSessionEventReplayState({
        harnessName: 'default',
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
      }),
    ).resolves.toBeNull();
  });

  it('appends and pages workspace action journal rows by session/resource', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(sampleSession(), { ownerId: 'h-1', ifVersion: 0 });
    await storage.saveSession(sampleSession({ id: 'other-session', resourceId: 'other-resource' }), {
      ownerId: 'h-1',
      ifVersion: 0,
    });

    await storage.appendWorkspaceActionJournalEntry(sampleWorkspaceActionJournalEntry({ id: 'b', createdAt: 1000 }));
    await storage.appendWorkspaceActionJournalEntry(sampleWorkspaceActionJournalEntry({ id: 'a', createdAt: 1000 }));
    await storage.appendWorkspaceActionJournalEntry(sampleWorkspaceActionJournalEntry({ id: 'c', createdAt: 1100 }));
    await storage.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'other-resource-entry',
        sessionId: 'other-session',
        resourceId: 'other-resource',
      }),
    );

    await expect(
      storage.listWorkspaceActionJournalEntries({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        limit: 2,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'a', actionKind: 'file' }),
      expect.objectContaining({ id: 'b', actionKind: 'file' }),
    ]);
    await expect(
      storage.listWorkspaceActionJournalEntries({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        after: { createdAt: 1000, id: 'b' },
        limit: 10,
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 'c' })]);
    await expect(
      storage.listWorkspaceActionJournalEntries({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        limit: -1,
      }),
    ).resolves.toEqual([]);
  });

  it('ignores duplicate or mismatched workspace action journal appends and deletes rows with the session', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(sampleSession({ closedAt: 2000, lastActivityAt: 2000 }), {
      ownerId: 'h-1',
      ifVersion: 0,
    });

    await expect(
      storage.appendWorkspaceActionJournalEntry(sampleWorkspaceActionJournalEntry({ id: 'entry-1' })),
    ).resolves.toEqual({ created: true });
    await expect(
      storage.appendWorkspaceActionJournalEntry(
        sampleWorkspaceActionJournalEntry({ id: 'entry-1', result: { status: 'changed' } }),
      ),
    ).resolves.toEqual({ created: false });
    await expect(
      storage.appendWorkspaceActionJournalEntry(
        sampleWorkspaceActionJournalEntry({ id: 'wrong-resource', resourceId: 'other-resource' }),
      ),
    ).resolves.toEqual({ created: false });

    await expect(
      storage.listWorkspaceActionJournalEntries({ sessionId: 'session-1', resourceId: 'resource-1', limit: 10 }),
    ).resolves.toEqual([expect.objectContaining({ id: 'entry-1', result: { status: 'ok' } })]);

    const closed = await storage.loadSession({ sessionId: 'session-1' });
    if (!closed) throw new Error('expected closed session');
    await storage.deleteSession({
      sessionId: 'session-1',
      ifVersion: closed.version,
      expectedResourceId: closed.resourceId,
      expectedThreadId: closed.threadId,
      expectedParentSessionId: closed.parentSessionId ?? null,
      expectedCreatedAt: closed.createdAt,
      requireClosed: true,
    });

    await expect(
      storage.listWorkspaceActionJournalEntries({ sessionId: 'session-1', resourceId: 'resource-1', limit: 10 }),
    ).resolves.toEqual([]);
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
    ).resolves.toEqual([expect.objectContaining({ id: 'closed-a' }), expect.objectContaining({ id: 'active-a' })]);
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
        leaseId: 'other-lease',
        createdAt: Date.now(),
        expiresAt: Date.now() + 30_000,
      });

      await expect(fence.assertActive()).rejects.toBeInstanceOf(HarnessStorageThreadDeleteFenceConflictError);
    });
  });

  it('does not revive an expired delete fence before destructive work', async () => {
    const db = new InMemoryDB();
    const storage = new InMemoryHarness({ db });

    await storage.withThreadDeleteFence(
      { threadId: 'expired-thread', ownerId: 'deleter', ttlMs: 30_000 },
      async fence => {
        db.harnessThreadDeleteFences.set('expired-thread', {
          threadId: 'expired-thread',
          ownerId: 'deleter',
          leaseId: 'expired-lease',
          createdAt: Date.now() - 60_000,
          expiresAt: Date.now() - 1,
        });

        await expect(fence.assertActive()).rejects.toBeInstanceOf(HarnessStorageThreadDeleteFenceConflictError);
      },
    );
  });

  it('keeps §15 attachment-reference admission atomic and delete-guarded', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(sampleSession(), { ownerId: 'h', ifVersion: 0 });
    const initial = await storage.loadSession({ sessionId: 'session-1' });
    if (!initial) throw new Error('expected session');

    await storage.saveAttachment({
      sessionId: 'session-1',
      attachmentId: 'attachment-1',
      name: 'note.txt',
      mimeType: 'text/plain',
      source: 'preupload',
      data: new Uint8Array([1, 2, 3]),
    });
    await expect(
      storage.saveSessionWithAttachmentReferences(
        { ...initial, state: { admitted: 'missing-ref' } },
        { ownerId: 'h', ifVersion: initial.version },
        [
          { sessionId: 'session-1', attachmentId: 'attachment-1', source: 'queued_item', sourceId: 'queued-valid' },
          { sessionId: 'session-1', attachmentId: 'missing', source: 'queued_item', sourceId: 'queued-missing' },
        ],
      ),
    ).rejects.toBeInstanceOf(HarnessStorageAttachmentUnavailableError);
    await expect(storage.loadSession({ sessionId: 'session-1' })).resolves.toMatchObject({
      version: initial.version,
      state: {},
    });
    await expect(
      storage.listAttachmentReferences({ sessionId: 'session-1', attachmentId: 'attachment-1' }),
    ).resolves.toEqual([]);

    const saved = await storage.saveSessionWithAttachmentReferences(
      { ...initial, state: { admitted: 'queued-ref' } },
      { ownerId: 'h', ifVersion: initial.version },
      [{ sessionId: 'session-1', attachmentId: 'attachment-1', source: 'queued_item', sourceId: 'queued-1' }],
    );

    expect(saved.version).toBe(initial.version + 1);
    await expect(
      storage.listAttachmentReferences({ sessionId: 'session-1', attachmentId: 'attachment-1' }),
    ).resolves.toEqual([{ source: 'queued_item', sourceId: 'queued-1' }]);
    await expect(
      storage.deleteAttachment({ sessionId: 'session-1', attachmentId: 'attachment-1' }),
    ).rejects.toBeInstanceOf(HarnessStorageAttachmentInUseError);
    await expect(
      storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'attachment-1' }),
    ).resolves.toMatchObject({
      name: 'note.txt',
      data: new Uint8Array([1, 2, 3]),
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
        threadId: 'thread-1',
        kind: 'queue',
        admissionId: 'admission-1',
        attemptedAdmissionHash: 'hash-1',
      }),
    ).resolves.toMatchObject({ status: 'duplicate', storedAdmissionHash: 'hash-1' });
    await expect(
      storage.resolveOperationAdmissionEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
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

  it('scopes admission resolution and hard-delete evidence cleanup by thread', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveSession(sampleSession({ closedAt: 2000, lastActivityAt: 2000 }), {
      ownerId: 'h',
      ifVersion: 0,
    });
    await storage.writeMessageResultEvidence({
      harnessName: 'default',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      signalId: 'signal-1',
      runId: 'run-1',
      admissionId: 'admission-1',
      admissionHash: 'hash-1',
      status: 'completed',
      result: { text: 'old' },
      createdAt: 1000,
      updatedAt: 1000,
    });
    await storage.writeMessageResultEvidence({
      harnessName: 'default',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-2',
      signalId: 'signal-2',
      runId: 'run-2',
      admissionId: 'admission-1',
      admissionHash: 'hash-2',
      status: 'completed',
      result: { text: 'new' },
      createdAt: 1000,
      updatedAt: 1000,
    });

    await expect(
      storage.resolveOperationAdmissionEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-2',
        kind: 'message',
        admissionId: 'admission-1',
        attemptedAdmissionHash: 'hash-2',
      }),
    ).resolves.toMatchObject({ status: 'duplicate', storedAdmissionHash: 'hash-2' });

    const stored = await storage.loadSession({ sessionId: 'session-1' });
    if (!stored) throw new Error('expected session');
    await storage.deleteSession({
      sessionId: 'session-1',
      ifVersion: stored.version,
      expectedResourceId: stored.resourceId,
      expectedThreadId: stored.threadId,
      expectedParentSessionId: stored.parentSessionId ?? null,
      expectedCreatedAt: stored.createdAt,
      requireClosed: true,
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
        threadId: 'thread-2',
        signalId: 'signal-2',
      }),
    ).resolves.toMatchObject({ status: 'completed', result: { text: 'new' } });
  });
});

describe('InMemoryHarness provider callback binding ledger', () => {
  it('dedupes exact active selector bindings and preserves the first target', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });

    await expect(storage.resolveProviderCallbackBinding(sampleProviderCallbackBinding())).resolves.toMatchObject({
      duplicate: false,
      conflict: false,
      binding: { id: 'callback-binding-1', status: 'active' },
    });
    await expect(
      storage.resolveProviderCallbackBinding(sampleProviderCallbackBinding({ id: 'callback-binding-retry' })),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: false,
      binding: { id: 'callback-binding-1' },
    });
  });

  it('reports same selector with a different target as a conflict without retargeting', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.resolveProviderCallbackBinding(sampleProviderCallbackBinding());

    await expect(
      storage.resolveProviderCallbackBinding(
        sampleProviderCallbackBinding({
          id: 'callback-binding-2',
          channelId: 'sales',
          origin: { route: 'sales-events' },
        }),
      ),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: true,
      binding: { id: 'callback-binding-1', channelId: 'support' },
    });
    await expect(
      storage.loadProviderCallbackBindingBySelector({
        providerId: 'slack',
        selectorKind: 'installation',
        selectorValue: 'installation-1',
      }),
    ).resolves.toMatchObject({ id: 'callback-binding-1', channelId: 'support' });
  });

  it('replaces active selector bindings and keeps replaced rows terminal', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.resolveProviderCallbackBinding(sampleProviderCallbackBinding());

    await expect(
      storage.resolveProviderCallbackBinding(sampleProviderCallbackBinding(), {
        replaceBindingId: 'callback-binding-1',
      }),
    ).rejects.toBeInstanceOf(HarnessStorageProviderCallbackBindingTransitionError);
    await expect(
      storage.resolveProviderCallbackBinding(
        sampleProviderCallbackBinding({
          id: 'callback-binding-disabled',
          status: 'disabled',
          harnessName: 'support-disabled',
          channelId: 'support-disabled',
          createdAt: 1500,
          updatedAt: 1500,
          origin: { route: 'support-events-disabled' },
        }),
        { replaceBindingId: 'callback-binding-1' },
      ),
    ).rejects.toBeInstanceOf(HarnessStorageProviderCallbackBindingTransitionError);
    await expect(
      storage.loadProviderCallbackBindingBySelector({
        providerId: 'slack',
        selectorKind: 'installation',
        selectorValue: 'installation-1',
      }),
    ).resolves.toMatchObject({ id: 'callback-binding-1', status: 'active' });
    await expect(
      storage.resolveProviderCallbackBinding(
        sampleProviderCallbackBinding({
          id: 'callback-binding-2',
          harnessName: 'support-v2',
          channelId: 'support-v2',
          createdAt: 2000,
          updatedAt: 2000,
          origin: { route: 'support-events-v2' },
        }),
        { replaceBindingId: 'callback-binding-1' },
      ),
    ).resolves.toMatchObject({
      duplicate: false,
      conflict: false,
      replacedBindingId: 'callback-binding-1',
      binding: { id: 'callback-binding-2', harnessName: 'support-v2', status: 'active' },
    });
    await expect(
      storage.loadProviderCallbackBindingBySelector({
        providerId: 'slack',
        selectorKind: 'installation',
        selectorValue: 'installation-1',
      }),
    ).resolves.toMatchObject({ id: 'callback-binding-2' });
    await expect(
      storage.resolveProviderCallbackBinding(
        sampleProviderCallbackBinding({
          id: 'callback-binding-2',
          harnessName: 'support-v2',
          channelId: 'support-v2',
          createdAt: 2000,
          updatedAt: 2000,
          origin: { route: 'support-events-v2' },
        }),
        { replaceBindingId: 'callback-binding-1' },
      ),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: false,
      replacedBindingId: 'callback-binding-1',
      binding: { id: 'callback-binding-2', status: 'active' },
    });
    await expect(
      storage.markProviderCallbackBindingStatus({ bindingId: 'callback-binding-1', status: 'active', updatedAt: 3000 }),
    ).rejects.toBeInstanceOf(HarnessStorageProviderCallbackBindingTransitionError);
  });

  it('allows disabled or undeliverable bindings to reactivate when no active selector owner exists', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.resolveProviderCallbackBinding(sampleProviderCallbackBinding());

    await expect(
      storage.markProviderCallbackBindingStatus({
        bindingId: 'callback-binding-1',
        status: 'undeliverable',
        updatedAt: 2000,
        lastError: { code: 'worker_unavailable', message: 'provider missing', retryable: true },
      }),
    ).resolves.toMatchObject({ status: 'undeliverable', lastError: { code: 'worker_unavailable' } });
    await expect(
      storage.loadProviderCallbackBindingBySelector({
        providerId: 'slack',
        selectorKind: 'installation',
        selectorValue: 'installation-1',
      }),
    ).resolves.toBeNull();
    await expect(
      storage.markProviderCallbackBindingStatus({ bindingId: 'callback-binding-1', status: 'active', updatedAt: 3000 }),
    ).resolves.toMatchObject({ status: 'active', lastError: undefined });
  });
});

describe('InMemoryHarness channel inbox ledger', () => {
  it('dedupes exact provider callbacks and does not steal an active initial claim', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const first = await storage.createOrLoadChannelInboxItem(sampleChannelInbox(), {
      initialClaim: { claimId: 'claim-1', now: 1000, claimTtlMs: 5000 },
    });
    const duplicate = await storage.createOrLoadChannelInboxItem(sampleChannelInbox({ id: 'inbox-retry' }), {
      initialClaim: { claimId: 'claim-2', now: 2000, claimTtlMs: 5000 },
    });

    expect(first).toMatchObject({ duplicate: false, conflict: false, claimed: true });
    expect(duplicate).toMatchObject({
      duplicate: true,
      conflict: false,
      claimed: false,
      item: { id: 'inbox-1', claimId: 'claim-1', claimExpiresAt: 6000 },
    });
  });

  it('flags same idempotency key with a different payload hash as a conflict', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.createOrLoadChannelInboxItem(sampleChannelInbox());

    await expect(
      storage.createOrLoadChannelInboxItem(sampleChannelInbox({ id: 'inbox-2', payloadHash: 'payload-hash-2' })),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: true,
      claimed: false,
      item: { id: 'inbox-1', payloadHash: 'payload-hash-1' },
    });
  });

  it('rejects duplicate global ids and save-time idempotency collisions', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.createOrLoadChannelInboxItem(sampleChannelInbox());

    await expect(
      storage.saveChannelInboxItem(sampleChannelInbox({ id: 'inbox-2', admissionId: 'inbox-2' })),
    ).rejects.toBeInstanceOf(HarnessStorageChannelInboxTransitionError);
    await expect(
      storage.saveChannelInboxItem(
        sampleChannelInbox({
          harnessName: 'other',
          channelId: 'other-support',
          idempotencyKey: 'other-provider-event',
          admissionId: 'other-inbox-1',
        }),
      ),
    ).rejects.toBeInstanceOf(HarnessStorageChannelInboxTransitionError);
    await expect(
      storage.createOrLoadChannelInboxItem(
        sampleChannelInbox({
          harnessName: 'other',
          channelId: 'other-support',
          idempotencyKey: 'other-provider-event-2',
          admissionId: 'other-inbox-2',
        }),
      ),
    ).rejects.toBeInstanceOf(HarnessStorageChannelInboxTransitionError);
  });

  it('reclaims crashed received work after claim expiry but respects nextAttemptAt backoff', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.createOrLoadChannelInboxItem(sampleChannelInbox({ nextAttemptAt: 7000 }), {
      initialClaim: { claimId: 'claim-1', now: 1000, claimTtlMs: 1000 },
    });

    await expect(
      storage.claimChannelInboxItems({
        harnessName: 'default',
        statuses: ['received'],
        claimId: 'early',
        limit: 10,
        now: 6500,
        claimTtlMs: 1000,
      }),
    ).resolves.toEqual([]);

    await expect(
      storage.claimChannelInboxItems({
        harnessName: 'default',
        statuses: ['received'],
        claimId: 'recovery',
        limit: 10,
        now: 7000,
        claimTtlMs: 1000,
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 'inbox-1', claimId: 'recovery', claimExpiresAt: 8000 })]);
  });

  it('guards claim renewal and terminal dead updates by owner claim', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const now = 10_000;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      await storage.createOrLoadChannelInboxItem(sampleChannelInbox(), {
        initialClaim: { claimId: 'claim-1', now, claimTtlMs: 5000 },
      });

      await expect(
        storage.renewChannelInboxClaim({ inboxItemId: 'inbox-1', claimId: 'other', now: now + 100, claimTtlMs: 5000 }),
      ).rejects.toBeInstanceOf(HarnessStorageChannelInboxClaimConflictError);
      await expect(
        storage.renewChannelInboxClaim({
          inboxItemId: 'inbox-1',
          claimId: 'claim-1',
          now: now + 100,
          claimTtlMs: 5000,
        }),
      ).resolves.toEqual({ claimExpiresAt: now + 5100, storageNow: now + 100 });

      await storage.updateChannelInboxItem(
        sampleChannelInbox({
          status: 'dead',
          deadAt: now + 200,
          updatedAt: now + 200,
          claimId: undefined,
          claimExpiresAt: undefined,
          lastError: { code: 'live_session_limit', message: 'capacity exhausted', retryable: false },
        }),
        { claimId: 'claim-1' },
      );
      await expect(
        storage.renewChannelInboxClaim({
          inboxItemId: 'inbox-1',
          claimId: 'claim-1',
          now: now + 300,
          claimTtlMs: 5000,
        }),
      ).rejects.toBeInstanceOf(HarnessStorageChannelInboxClaimConflictError);
    } finally {
      dateNow.mockRestore();
    }
  });

  it('rejects renewals and updates from expired claims', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.createOrLoadChannelInboxItem(sampleChannelInbox(), {
      initialClaim: { claimId: 'claim-1', now: 1000, claimTtlMs: 1000 },
    });

    await expect(
      storage.renewChannelInboxClaim({ inboxItemId: 'inbox-1', claimId: 'claim-1', now: 2001, claimTtlMs: 1000 }),
    ).rejects.toBeInstanceOf(HarnessStorageChannelInboxClaimConflictError);
    await expect(
      storage.updateChannelInboxItem(
        sampleChannelInbox({
          status: 'failed',
          attempts: 1,
          failedAt: 2001,
          updatedAt: 2001,
          lastError: { code: 'session_locked', message: 'locked', retryable: true },
        }),
        { claimId: 'claim-1' },
      ),
    ).rejects.toBeInstanceOf(HarnessStorageChannelInboxClaimConflictError);
  });

  it('records retryable failed evidence, releases the claim, and reclaims after backoff', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const now = Date.now();
    await storage.createOrLoadChannelInboxItem(sampleChannelInbox(), {
      initialClaim: { claimId: 'claim-1', now, claimTtlMs: 5000 },
    });

    await storage.updateChannelInboxItem(
      sampleChannelInbox({
        status: 'failed',
        attempts: 1,
        failedAt: now + 100,
        updatedAt: now + 100,
        claimId: undefined,
        claimExpiresAt: undefined,
        nextAttemptAt: now + 200,
        lastError: { code: 'session_locked', message: 'locked', retryable: true },
      }),
      { claimId: 'claim-1' },
    );

    await expect(
      storage.claimChannelInboxItems({
        harnessName: 'default',
        statuses: ['failed'],
        claimId: 'too-soon',
        limit: 10,
        now: now + 150,
        claimTtlMs: 1000,
      }),
    ).resolves.toEqual([]);
    await expect(
      storage.claimChannelInboxItems({
        harnessName: 'default',
        statuses: ['failed'],
        claimId: 'retry',
        limit: 10,
        now: now + 200,
        claimTtlMs: 1000,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'inbox-1',
        status: 'failed',
        attempts: 1,
        claimId: 'retry',
        lastError: { code: 'session_locked', message: 'locked', retryable: true },
      }),
    ]);
  });

  it('validates new channel inbox rows before insert', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });

    await expect(
      storage.createOrLoadChannelInboxItem(sampleChannelInbox({ status: 'admitted' })),
    ).rejects.toBeInstanceOf(HarnessStorageChannelInboxTransitionError);
    await expect(storage.saveChannelInboxItem(sampleChannelInbox({ status: 'queued' }))).rejects.toBeInstanceOf(
      HarnessStorageChannelInboxTransitionError,
    );
    await expect(
      storage.saveChannelInboxItem(
        sampleChannelInbox({
          status: 'dead',
          deadAt: 0,
          lastError: null as any,
        }),
      ),
    ).rejects.toBeInstanceOf(HarnessStorageChannelInboxTransitionError);
  });

  it('keeps identical terminal channel inbox saves idempotent', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const terminal = sampleChannelInbox({
      status: 'accepted',
      delivery: 'message',
      runId: 'run-1',
      signalId: 'signal-1',
      acceptedAt: 0,
      updatedAt: 1500,
      requestContext: { metadata: { b: 2, a: 1 } },
    });
    const replay = { ...terminal, requestContext: { metadata: { a: 1, b: 2 } } };

    await storage.saveChannelInboxItem(terminal);
    await expect(storage.saveChannelInboxItem(replay)).resolves.toBeUndefined();
    await expect(
      storage.saveChannelInboxItem({ ...terminal, content: 'changed', updatedAt: 1600 }),
    ).rejects.toBeInstanceOf(HarnessStorageChannelInboxTransitionError);
  });

  it('rejects illegal accepted transitions without message evidence', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const now = Date.now();
    await storage.createOrLoadChannelInboxItem(
      sampleChannelInbox({ status: 'admitted', delivery: 'message', admittedAt: now + 50 }),
      {
        initialClaim: { claimId: 'claim-1', now, claimTtlMs: 5000 },
      },
    );

    await expect(
      storage.updateChannelInboxItem(
        sampleChannelInbox({ status: 'accepted', delivery: 'message', acceptedAt: now + 100, admittedAt: now + 50 }),
        { claimId: 'claim-1' },
      ),
    ).rejects.toBeInstanceOf(HarnessStorageChannelInboxTransitionError);
  });
});

describe('InMemoryHarness wakeup ledger', () => {
  it('dedupes exact wakeups and reports source-fire key conflicts', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });

    await expect(storage.createOrLoadHarnessWakeupItem(sampleWakeup())).resolves.toMatchObject({
      duplicate: false,
      conflict: false,
      claimed: false,
    });
    await expect(storage.createOrLoadHarnessWakeupItem(sampleWakeup({ id: 'wakeup-retry' }))).resolves.toMatchObject({
      duplicate: true,
      conflict: false,
      item: { id: 'wakeup-1', payloadHash: 'payload-hash-1' },
    });
    await expect(
      storage.createOrLoadHarnessWakeupItem(sampleWakeup({ id: 'wakeup-source-retry', idempotencyKey: 'wake-key-2' })),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: true,
      item: { id: 'wakeup-1', fireId: 'fire-1' },
    });
  });

  it('flags same idempotency key with a different payload as a conflict', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.createOrLoadHarnessWakeupItem(sampleWakeup());

    await expect(
      storage.createOrLoadHarnessWakeupItem(sampleWakeup({ id: 'wakeup-2', payloadHash: 'payload-hash-2' })),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: true,
      item: { id: 'wakeup-1', payloadHash: 'payload-hash-1' },
    });
    await expect(
      storage.createOrLoadHarnessWakeupItem(sampleWakeup({ id: 'wakeup-3', mode: 'review', model: 'model-2' })),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: true,
      item: { id: 'wakeup-1', mode: 'build', model: 'model-1' },
    });
  });

  it('preserves wakeup yolo admission overrides', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });

    await expect(storage.createOrLoadHarnessWakeupItem(sampleWakeup({ yolo: true }))).resolves.toMatchObject({
      duplicate: false,
      conflict: false,
      item: { yolo: true },
    });
    await expect(
      storage.loadHarnessWakeupItemByIdempotencyKey({ harnessName: 'default', idempotencyKey: 'wake-key-1' }),
    ).resolves.toMatchObject({ yolo: true });
  });

  it('treats omitted and false wakeup yolo overrides as the same idempotent input', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.createOrLoadHarnessWakeupItem(sampleWakeup({ yolo: false }));

    await expect(storage.createOrLoadHarnessWakeupItem(sampleWakeup({ id: 'wakeup-retry' }))).resolves.toMatchObject({
      duplicate: true,
      conflict: false,
      item: { id: 'wakeup-1' },
    });
  });

  it('claims due and retryable failed wakeups while respecting backoff', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.createOrLoadHarnessWakeupItem(sampleWakeup({ dueAt: 5000, nextAttemptAt: 7000 }));

    await expect(
      storage.claimHarnessWakeupItems({
        harnessName: 'default',
        statuses: ['due'],
        claimId: 'early',
        limit: 10,
        now: 6500,
        claimTtlMs: 1000,
      }),
    ).resolves.toEqual([]);
    await expect(
      storage.claimHarnessWakeupItems({
        harnessName: 'default',
        statuses: ['due'],
        claimId: 'claim-1',
        limit: 10,
        now: 7000,
        claimTtlMs: 1000,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'wakeup-1',
        status: 'claimed',
        attempts: 1,
        claimId: 'claim-1',
        claimExpiresAt: 8000,
        nextAttemptAt: undefined,
      }),
    ]);
  });

  it('does not initial-claim future wakeups before they are due', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });

    const result = await storage.createOrLoadHarnessWakeupItem(sampleWakeup({ dueAt: 5000 }), {
      initialClaim: { claimId: 'early', now: 4000, claimTtlMs: 1000 },
    });
    expect(result).toMatchObject({
      duplicate: false,
      conflict: false,
      claimed: false,
      item: { status: 'due', attempts: 0 },
    });
    expect(result.item.claimId).toBeUndefined();
  });

  it('initial-claims due wakeups without carrying stale attempt identifiers', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });

    await expect(
      storage.createOrLoadHarnessWakeupItem(sampleWakeup({ runId: 'stale-run', signalId: 'stale-signal' }), {
        initialClaim: { claimId: 'claim-1', now: 2000, claimTtlMs: 1000 },
      }),
    ).resolves.toMatchObject({
      claimed: true,
      item: { status: 'claimed', runId: undefined, signalId: undefined },
    });
  });

  it('reclaims expired claimed wakeups', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.createOrLoadHarnessWakeupItem(sampleWakeup(), {
      initialClaim: { claimId: 'stale', now: 10_000, claimTtlMs: 1000 },
    });

    await expect(
      storage.claimHarnessWakeupItems({
        harnessName: 'default',
        statuses: ['claimed'],
        claimId: 'retry',
        limit: 10,
        now: 10_500,
        claimTtlMs: 1000,
      }),
    ).resolves.toEqual([]);
    await expect(
      storage.claimHarnessWakeupItems({
        harnessName: 'default',
        statuses: ['claimed'],
        claimId: 'retry',
        limit: 10,
        now: 11_000,
        claimTtlMs: 1000,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'wakeup-1',
        status: 'claimed',
        attempts: 2,
        claimId: 'retry',
        claimExpiresAt: 12_000,
        claimedAt: 11_000,
      }),
    ]);
  });

  it('reclaims expired claimed duplicate wakeups on create', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.createOrLoadHarnessWakeupItem(sampleWakeup(), {
      initialClaim: { claimId: 'stale', now: 10_000, claimTtlMs: 1000 },
    });

    await expect(
      storage.createOrLoadHarnessWakeupItem(sampleWakeup({ id: 'wakeup-retry' }), {
        initialClaim: { claimId: 'retry', now: 11_000, claimTtlMs: 1000 },
      }),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: false,
      claimed: true,
      item: { id: 'wakeup-1', status: 'claimed', attempts: 2, claimId: 'retry' },
    });
  });

  it('guards renewal and terminal updates by owner claim', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const now = 10_000;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now + 100);
    try {
      await storage.createOrLoadHarnessWakeupItem(sampleWakeup(), {
        initialClaim: { claimId: 'claim-1', now, claimTtlMs: 5000 },
      });

      await expect(
        storage.renewHarnessWakeupClaim({
          wakeupItemId: 'wakeup-1',
          claimId: 'other',
          now: now + 50,
          claimTtlMs: 5000,
        }),
      ).rejects.toBeInstanceOf(HarnessStorageWakeupClaimConflictError);
      await expect(
        storage.renewHarnessWakeupClaim({
          wakeupItemId: 'wakeup-1',
          claimId: 'claim-1',
          now: now + 50,
          claimTtlMs: 5000,
        }),
      ).resolves.toEqual({ claimExpiresAt: now + 5050, storageNow: now + 50 });

      await expect(
        storage.updateHarnessWakeupItem(
          sampleWakeup({
            status: 'failed',
            attempts: 1,
            failedAt: now + 100,
            nextAttemptAt: now + 200,
            claimId: undefined,
            claimExpiresAt: undefined,
            claimedAt: now,
            updatedAt: now + 100,
            lastError: { code: 'worker_unavailable', message: 'temporary failure', retryable: true },
          }),
          { claimId: 'claim-1' },
        ),
      ).rejects.toBeInstanceOf(HarnessStorageWakeupTransitionError);

      await storage.updateHarnessWakeupItem(
        sampleWakeup({
          status: 'queued',
          attempts: 1,
          queuedItemId: 'queued-1',
          queuedAt: now + 100,
          claimId: undefined,
          claimExpiresAt: undefined,
          updatedAt: now + 100,
        }),
        { claimId: 'claim-1' },
      );
      await expect(
        storage.renewHarnessWakeupClaim({
          wakeupItemId: 'wakeup-1',
          claimId: 'claim-1',
          now: now + 200,
          claimTtlMs: 5000,
        }),
      ).rejects.toBeInstanceOf(HarnessStorageWakeupClaimConflictError);
    } finally {
      dateNow.mockRestore();
    }
  });

  it('rejects payload mutation while a wakeup claim is held', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const now = 10_000;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now + 100);
    try {
      await storage.createOrLoadHarnessWakeupItem(sampleWakeup(), {
        initialClaim: { claimId: 'claim-1', now, claimTtlMs: 5000 },
      });

      await expect(
        storage.updateHarnessWakeupItem(
          sampleWakeup({
            status: 'queued',
            content: 'mutated work',
            attempts: 1,
            queuedItemId: 'queued-1',
            queuedAt: now + 100,
            claimId: undefined,
            claimExpiresAt: undefined,
            updatedAt: now + 100,
          }),
          { claimId: 'claim-1' },
        ),
      ).rejects.toBeInstanceOf(HarnessStorageWakeupTransitionError);
    } finally {
      dateNow.mockRestore();
    }
  });

  it('reclaims retryable failures and clears stale failure metadata', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const now = 10_000;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now + 50);
    try {
      await storage.createOrLoadHarnessWakeupItem(sampleWakeup(), {
        initialClaim: { claimId: 'claim-1', now, claimTtlMs: 5000 },
      });
      await storage.updateHarnessWakeupItem(
        sampleWakeup({
          status: 'failed',
          attempts: 1,
          failedAt: now + 50,
          nextAttemptAt: now + 100,
          runId: 'stale-run',
          signalId: 'stale-signal',
          claimId: undefined,
          claimExpiresAt: undefined,
          updatedAt: now + 50,
          lastError: { code: 'session_locked', message: 'locked', retryable: true },
        }),
        { claimId: 'claim-1' },
      );

      await expect(
        storage.claimHarnessWakeupItems({
          harnessName: 'default',
          statuses: ['failed'],
          claimId: 'retry',
          limit: 10,
          now: now + 100,
          claimTtlMs: 1000,
        }),
      ).resolves.toEqual([
        expect.objectContaining({
          status: 'claimed',
          attempts: 2,
          failedAt: undefined,
          nextAttemptAt: undefined,
          runId: undefined,
          signalId: undefined,
          lastError: undefined,
        }),
      ]);
    } finally {
      dateNow.mockRestore();
    }
  });

  it('validates wakeup state transitions', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });

    await expect(storage.createOrLoadHarnessWakeupItem(sampleWakeup({ status: 'queued' }))).rejects.toBeInstanceOf(
      HarnessStorageWakeupTransitionError,
    );
    await expect(
      storage.createOrLoadHarnessWakeupItem(
        sampleWakeup({
          status: 'completed',
          completedAt: 2000,
          result: { ok: true },
        }),
      ),
    ).rejects.toBeInstanceOf(HarnessStorageWakeupTransitionError);

    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(2100);
    try {
      await storage.createOrLoadHarnessWakeupItem(sampleWakeup(), {
        initialClaim: { claimId: 'claim-1', now: 2000, claimTtlMs: 1000 },
      });
      await expect(
        storage.updateHarnessWakeupItem(
          sampleWakeup({
            status: 'completed',
            completedAt: 2100,
            result: { ok: true },
            queuedItemId: 'stale-queue',
            queuedAt: 2050,
            updatedAt: 2100,
          }),
          { claimId: 'claim-1' },
        ),
      ).rejects.toBeInstanceOf(HarnessStorageWakeupTransitionError);
      await expect(
        storage.updateHarnessWakeupItem(
          sampleWakeup({
            status: 'queued',
            queuedItemId: 'queue-1',
            queuedAt: 2100,
            lastError: { code: 'stale', message: 'stale' },
            updatedAt: 2100,
          }),
          { claimId: 'claim-1' },
        ),
      ).rejects.toBeInstanceOf(HarnessStorageWakeupTransitionError);
    } finally {
      dateNow.mockRestore();
    }
  });
});

describe('InMemoryHarness channel action ledger', () => {
  it('dedupes exact action tokens and flags immutable token mismatches', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await expect(storage.createOrLoadChannelActionToken(sampleChannelActionToken())).resolves.toMatchObject({
      duplicate: false,
      conflict: false,
    });

    await expect(storage.createOrLoadChannelActionToken(sampleChannelActionToken())).resolves.toMatchObject({
      duplicate: true,
      conflict: false,
      token: { actionTokenId: 'action-token-1', metadataHash: 'metadata-hash-1' },
    });
    await expect(
      storage.createOrLoadChannelActionToken(sampleChannelActionToken({ metadataHash: 'metadata-hash-2' })),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: true,
      token: { actionTokenId: 'action-token-1', metadataHash: 'metadata-hash-1' },
    });
    await expect(
      storage.createOrLoadChannelActionToken(
        sampleChannelActionToken({ actionTokenId: 'action-token-2', transportHash: 'transport-hash-1' }),
      ),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: true,
      token: { actionTokenId: 'action-token-1', transportHash: 'transport-hash-1' },
    });
  });

  it('dedupes exact action receipts and does not steal an active initial claim', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const first = await storage.createOrLoadChannelActionReceipt(sampleChannelActionReceipt(), {
      initialClaim: { claimId: 'claim-1', now: 1000, claimTtlMs: 5000 },
    });
    const duplicate = await storage.createOrLoadChannelActionReceipt(sampleChannelActionReceipt({ id: 'receipt-2' }), {
      initialClaim: { claimId: 'claim-2', now: 2000, claimTtlMs: 5000 },
    });

    expect(first).toMatchObject({ duplicate: false, conflict: false, claimed: true });
    expect(duplicate).toMatchObject({
      duplicate: true,
      conflict: false,
      claimed: false,
      receipt: { id: 'receipt-1', claimId: 'claim-1', claimExpiresAt: 6000 },
    });
  });

  it('flags same action token with a different response hash as a conflict', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.createOrLoadChannelActionReceipt(sampleChannelActionReceipt());

    await expect(
      storage.createOrLoadChannelActionReceipt(
        sampleChannelActionReceipt({ id: 'receipt-2', responseHash: 'response-hash-2' }),
      ),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: true,
      claimed: false,
      receipt: { id: 'receipt-1', responseHash: 'response-hash-1' },
    });
  });

  it('treats action receipt provider action ids as immutable identity', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.createOrLoadChannelActionReceipt(sampleChannelActionReceipt());

    await expect(
      storage.createOrLoadChannelActionReceipt(
        sampleChannelActionReceipt({ id: 'receipt-2', actionId: 'provider-action-2' }),
      ),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: true,
      claimed: false,
      receipt: { id: 'receipt-1', actionId: 'provider-action-1' },
    });
    await expect(
      storage.saveChannelActionReceipt(sampleChannelActionReceipt({ actionId: 'provider-action-2', updatedAt: 1200 })),
    ).rejects.toBeInstanceOf(HarnessStorageChannelActionReceiptTransitionError);
  });

  it('reclaims crashed action receipts after claim expiry but respects nextAttemptAt backoff', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.createOrLoadChannelActionReceipt(sampleChannelActionReceipt({ nextAttemptAt: 7000 }), {
      initialClaim: { claimId: 'claim-1', now: 1000, claimTtlMs: 1000 },
    });

    await expect(
      storage.claimChannelActionReceipts({
        harnessName: 'default',
        statuses: ['received'],
        claimId: 'early',
        limit: 10,
        now: 6500,
        claimTtlMs: 1000,
      }),
    ).resolves.toEqual([]);
    await expect(
      storage.claimChannelActionReceipts({
        harnessName: 'default',
        statuses: ['received'],
        claimId: 'recovery',
        limit: 10,
        now: 7000,
        claimTtlMs: 1000,
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 'receipt-1', claimId: 'recovery', claimExpiresAt: 8000 })]);
  });

  it('guards action receipt renewal and applied updates by owner claim', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const now = 10_000;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      await storage.createOrLoadChannelActionReceipt(sampleChannelActionReceipt(), {
        initialClaim: { claimId: 'claim-1', now, claimTtlMs: 5000 },
      });

      await expect(
        storage.renewChannelActionReceiptClaim({
          receiptId: 'receipt-1',
          claimId: 'other',
          now: now + 100,
          claimTtlMs: 5000,
        }),
      ).rejects.toBeInstanceOf(HarnessStorageChannelActionClaimConflictError);
      await expect(
        storage.renewChannelActionReceiptClaim({
          receiptId: 'receipt-1',
          claimId: 'claim-1',
          now: now + 100,
          claimTtlMs: 5000,
        }),
      ).resolves.toEqual({ claimExpiresAt: now + 5100, storageNow: now + 100 });

      await storage.updateChannelActionReceipt(
        sampleChannelActionReceipt({
          status: 'accepted',
          acceptedAt: now + 200,
          updatedAt: now + 200,
          claimId: 'claim-1',
          claimExpiresAt: now + 5100,
        }),
        { claimId: 'claim-1' },
      );
      await storage.updateChannelActionReceipt(
        sampleChannelActionReceipt({
          status: 'applied',
          acceptedAt: now + 200,
          appliedAt: now + 300,
          result: { ok: true },
          updatedAt: now + 300,
          claimId: undefined,
          claimExpiresAt: undefined,
        }),
        { claimId: 'claim-1' },
      );
      await expect(
        storage.renewChannelActionReceiptClaim({
          receiptId: 'receipt-1',
          claimId: 'claim-1',
          now: now + 400,
          claimTtlMs: 5000,
        }),
      ).rejects.toBeInstanceOf(HarnessStorageChannelActionClaimConflictError);
    } finally {
      dateNow.mockRestore();
    }
  });

  it('validates new action receipt rows before insert and keeps terminal saves idempotent', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await expect(
      storage.createOrLoadChannelActionReceipt(sampleChannelActionReceipt({ status: 'accepted' })),
    ).rejects.toBeInstanceOf(HarnessStorageChannelActionReceiptTransitionError);
    await expect(
      storage.createOrLoadChannelActionReceipt(sampleChannelActionReceipt({ status: 'mystery' as any })),
    ).rejects.toBeInstanceOf(HarnessStorageChannelActionReceiptTransitionError);
    await expect(
      storage.createOrLoadChannelActionReceipt(
        sampleChannelActionReceipt({ status: 'conflict', conflictReason: 'mystery' as any }),
      ),
    ).rejects.toBeInstanceOf(HarnessStorageChannelActionReceiptTransitionError);
    const terminal = sampleChannelActionReceipt({
      status: 'applied',
      acceptedAt: 1200,
      appliedAt: 1300,
      result: { b: 2, a: 1 },
      updatedAt: 1300,
    });
    const replay = { ...terminal, result: { a: 1, b: 2 } };

    await storage.saveChannelActionReceipt(terminal);
    await expect(storage.saveChannelActionReceipt(replay)).resolves.toBeUndefined();
    await expect(
      storage.saveChannelActionReceipt({ ...terminal, result: { changed: true }, updatedAt: 1400 }),
    ).rejects.toBeInstanceOf(HarnessStorageChannelActionReceiptTransitionError);
  });
});

describe('InMemoryHarness channel outbox ledger', () => {
  it('dedupes exact outbound projections and flags same-key delivery conflicts', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await expect(storage.enqueueChannelOutbox(sampleChannelOutbox())).resolves.toEqual({
      outboxItemId: 'outbox-1',
      duplicate: false,
      conflict: false,
    });
    await expect(storage.enqueueChannelOutbox(sampleChannelOutbox({ id: 'outbox-retry' }))).resolves.toEqual({
      outboxItemId: 'outbox-1',
      duplicate: true,
      conflict: false,
    });
    await expect(
      storage.enqueueChannelOutbox(sampleChannelOutbox({ id: 'outbox-conflict', payloadHash: 'payload-hash-2' })),
    ).resolves.toEqual({
      outboxItemId: 'outbox-1',
      duplicate: true,
      conflict: true,
    });
    await expect(
      storage.enqueueChannelOutbox(
        sampleChannelOutbox({
          id: 'outbox-target-conflict',
          target: {
            platform: 'slack',
            externalTenantId: 'tenant-1',
            externalChannelId: 'channel-1',
            externalThreadId: 'different-thread',
          },
        }),
      ),
    ).resolves.toEqual({
      outboxItemId: 'outbox-1',
      duplicate: true,
      conflict: true,
    });
    await expect(
      storage.enqueueChannelOutbox(
        sampleChannelOutbox({
          id: 'outbox-operation-conflict',
          operationKind: 'message-edit',
        }),
      ),
    ).resolves.toEqual({
      outboxItemId: 'outbox-1',
      duplicate: true,
      conflict: true,
    });
    await expect(
      storage.enqueueChannelOutbox(
        sampleChannelOutbox({
          id: 'outbox-delivery-semantics-conflict',
          deliverySemantics: 'at-least-once',
        }),
      ),
    ).resolves.toEqual({
      outboxItemId: 'outbox-1',
      duplicate: true,
      conflict: true,
    });
  });

  it('claims at most the oldest due row for one binding while allowing different bindings', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.enqueueChannelOutbox(
      sampleChannelOutbox({ id: 'outbox-1', idempotencyKey: 'key-1', createdAt: 1000 }),
    );
    await storage.enqueueChannelOutbox(
      sampleChannelOutbox({ id: 'outbox-2', idempotencyKey: 'key-2', createdAt: 1001 }),
    );
    await storage.enqueueChannelOutbox(
      sampleChannelOutbox({
        id: 'outbox-3',
        bindingId: 'binding-2',
        idempotencyKey: 'key-3',
        createdAt: 1002,
      }),
    );

    await expect(
      storage.claimChannelOutbox({
        harnessName: 'default',
        claimId: 'claim-1',
        limit: 10,
        now: 2000,
        claimTtlMs: 5000,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'outbox-1', claimId: 'claim-1', status: 'claimed' }),
      expect.objectContaining({ id: 'outbox-3', claimId: 'claim-1', status: 'claimed' }),
    ]);
  });

  it('does not starve due rows for other bindings behind one blocked binding', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.enqueueChannelOutbox(
      sampleChannelOutbox({ id: 'outbox-1', idempotencyKey: 'key-1', createdAt: 1000 }),
    );
    await storage.claimChannelOutbox({
      harnessName: 'default',
      claimId: 'blocked-binding-claim',
      limit: 1,
      now: 2000,
      claimTtlMs: 5000,
    });
    for (let i = 2; i <= 6; i += 1) {
      await storage.enqueueChannelOutbox(
        sampleChannelOutbox({ id: `outbox-${i}`, idempotencyKey: `key-${i}`, createdAt: 1000 + i }),
      );
    }
    await storage.enqueueChannelOutbox(
      sampleChannelOutbox({
        id: 'outbox-other-binding',
        bindingId: 'binding-2',
        idempotencyKey: 'key-other',
        createdAt: 2000,
      }),
    );

    await expect(
      storage.claimChannelOutbox({
        harnessName: 'default',
        claimId: 'other-binding-claim',
        limit: 1,
        now: 2500,
        claimTtlMs: 5000,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'outbox-other-binding', claimId: 'other-binding-claim', status: 'claimed' }),
    ]);
  });

  it('reclaims retryable outbox rows after claim expiry and respects retry backoff', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(6000);
    try {
      await storage.enqueueChannelOutbox(sampleChannelOutbox());
      await storage.claimChannelOutbox({
        harnessName: 'default',
        claimId: 'first',
        limit: 1,
        now: 6000,
        claimTtlMs: 1000,
      });
      await storage.markChannelOutboxFailed({
        outboxItemId: 'outbox-1',
        claimId: 'first',
        retryAt: 7000,
        error: { code: 'worker_unavailable', message: 'provider timeout' },
      });
    } finally {
      dateNow.mockRestore();
    }
    await expect(
      storage.claimChannelOutbox({
        harnessName: 'default',
        claimId: 'early',
        limit: 10,
        now: 6500,
        claimTtlMs: 1000,
      }),
    ).resolves.toEqual([]);
    const retried = await storage.claimChannelOutbox({
      harnessName: 'default',
      claimId: 'retry',
      limit: 10,
      now: 7000,
      claimTtlMs: 1000,
    });
    expect(retried).toEqual([
      expect.objectContaining({
        id: 'outbox-1',
        status: 'claimed',
        attempts: 2,
        claimId: 'retry',
        claimExpiresAt: 8000,
      }),
    ]);
    expect(retried[0]?.nextAttemptAt).toBeUndefined();
    expect(retried[0]?.failedAt).toBeUndefined();
    expect(retried[0]?.lastError).toBeUndefined();
  });

  it('guards sent and failed transitions by the active outbox claim', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const now = 10_000;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      await storage.enqueueChannelOutbox(sampleChannelOutbox());
      await storage.claimChannelOutbox({
        harnessName: 'default',
        claimId: 'claim-1',
        limit: 1,
        now,
        claimTtlMs: 5000,
      });

      await expect(
        storage.renewChannelOutboxClaim({
          outboxItemId: 'outbox-1',
          claimId: 'other',
          now: now + 100,
          claimTtlMs: 5000,
        }),
      ).rejects.toBeInstanceOf(HarnessStorageChannelOutboxClaimConflictError);
      await expect(
        storage.renewChannelOutboxClaim({
          outboxItemId: 'outbox-1',
          claimId: 'claim-1',
          now: now + 100,
          claimTtlMs: 5000,
        }),
      ).resolves.toEqual({ claimExpiresAt: now + 5100, storageNow: now + 100 });

      await storage.markChannelOutboxSent({
        outboxItemId: 'outbox-1',
        claimId: 'claim-1',
        sentAt: now + 200,
        providerMessageId: 'provider-message-1',
        providerReceipt: { providerMessageId: 'provider-message-1', deliveryId: 'delivery-1' },
      });
      await expect(
        storage.markChannelOutboxFailed({
          outboxItemId: 'outbox-1',
          claimId: 'claim-1',
          error: { code: 'unknown', message: 'too late' },
        }),
      ).rejects.toBeInstanceOf(HarnessStorageChannelOutboxClaimConflictError);
    } finally {
      dateNow.mockRestore();
    }
  });

  it('records retryable and terminal outbox delivery failures as durable evidence', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const now = 20_000;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      await storage.enqueueChannelOutbox(sampleChannelOutbox());
      await storage.claimChannelOutbox({
        harnessName: 'default',
        claimId: 'claim-1',
        limit: 1,
        now,
        claimTtlMs: 5000,
      });
      await storage.markChannelOutboxFailed({
        outboxItemId: 'outbox-1',
        claimId: 'claim-1',
        retryAt: now + 1000,
        error: { code: 'worker_unavailable', message: 'provider timeout' },
      });

      await expect(
        storage.claimChannelOutbox({
          harnessName: 'default',
          claimId: 'claim-2',
          limit: 1,
          now: now + 1000,
          claimTtlMs: 5000,
        }),
      ).resolves.toEqual([
        expect.objectContaining({
          id: 'outbox-1',
          status: 'claimed',
          attempts: 2,
          nextAttemptAt: undefined,
          failedAt: undefined,
          lastError: undefined,
        }),
      ]);

      await storage.markChannelOutboxFailed({
        outboxItemId: 'outbox-1',
        claimId: 'claim-2',
        dead: true,
        error: { code: 'provider_payload_invalid', message: 'bad payload' },
      });
      await expect(
        storage.claimChannelOutbox({
          harnessName: 'default',
          claimId: 'claim-3',
          limit: 1,
          now: now + 2000,
          claimTtlMs: 5000,
        }),
      ).resolves.toEqual([]);
    } finally {
      dateNow.mockRestore();
    }
  });

  it('treats non-retryable outbox delivery failures as terminal', async () => {
    const db = new InMemoryDB();
    const storage = new InMemoryHarness({ db });
    const now = 30_000;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      await storage.enqueueChannelOutbox(sampleChannelOutbox());
      await storage.claimChannelOutbox({
        harnessName: 'default',
        claimId: 'claim-1',
        limit: 1,
        now,
        claimTtlMs: 5000,
      });
      await storage.markChannelOutboxFailed({
        outboxItemId: 'outbox-1',
        claimId: 'claim-1',
        retryAt: now + 1000,
        error: { code: 'provider_payload_invalid', message: 'bad payload', retryable: false },
      });

      await expect(
        storage.claimChannelOutbox({
          harnessName: 'default',
          claimId: 'claim-2',
          limit: 1,
          now: now + 1000,
          claimTtlMs: 5000,
        }),
      ).resolves.toEqual([]);
      expect([...db.harnessChannelOutbox.values()][0]).toMatchObject({
        status: 'dead',
        deadAt: now,
        nextAttemptAt: undefined,
        lastError: { retryable: false },
      });
    } finally {
      dateNow.mockRestore();
    }
  });

  it('validates new outbox rows before insert', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await expect(
      storage.enqueueChannelOutbox(sampleChannelOutbox({ status: 'sent', sentAt: 1001 })),
    ).rejects.toBeInstanceOf(HarnessStorageChannelOutboxTransitionError);
  });
});

describe('InMemoryHarness channel diagnostics', () => {
  it('lists resource and session scoped diagnostics rows across channel ledgers', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });

    await storage.saveChannelInboxItem(
      sampleChannelInbox({
        id: 'inbox-root',
        idempotencyKey: 'event-root',
        admissionId: 'admission-root',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        sessionId: 'session-1',
      }),
    );
    await storage.saveChannelInboxItem(
      sampleChannelInbox({
        id: 'inbox-child',
        idempotencyKey: 'event-child',
        admissionId: 'admission-child',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        sessionId: 'child-1',
        updatedAt: 1200,
      }),
    );
    await storage.saveChannelInboxItem(
      sampleChannelInbox({
        id: 'inbox-other-resource',
        idempotencyKey: 'event-other-resource',
        admissionId: 'admission-other-resource',
        resourceId: 'resource-2',
        threadId: 'thread-1',
        sessionId: 'session-1',
      }),
    );
    await storage.saveChannelInboxItem(
      sampleChannelInbox({
        id: 'inbox-unbound',
        idempotencyKey: 'event-unbound',
        admissionId: 'admission-unbound',
        resourceId: undefined,
        sessionId: undefined,
      }),
    );
    await storage.createOrLoadChannelActionToken(sampleChannelActionToken({ owningSessionId: 'child-1' }));
    await storage.createOrLoadChannelActionReceipt(sampleChannelActionReceipt({ owningSessionId: 'child-1' }));
    await storage.enqueueChannelOutbox(
      sampleChannelOutbox({
        id: 'outbox-owned-child',
        idempotencyKey: 'outbox-owned-child',
        sessionId: undefined,
        owningSessionId: 'child-1',
      }),
    );
    await storage.enqueueChannelOutbox(
      sampleChannelOutbox({
        id: 'outbox-hidden',
        idempotencyKey: 'outbox-hidden',
        sessionId: 'hidden-session',
        owningSessionId: 'hidden-session',
      }),
    );

    const rows = await storage.listChannelDiagnosticsRows({
      harnessName: 'default',
      resourceId: 'resource-1',
      sessionIds: ['session-1', 'child-1'],
      limit: 10,
    });

    expect(rows.inbox.map(row => row.id)).toEqual(['inbox-child', 'inbox-root']);
    expect(rows.actionTokens.map(row => row.actionTokenId)).toEqual(['action-token-1']);
    expect(rows.actionReceipts.map(row => row.id)).toEqual(['receipt-1']);
    expect(rows.outbox.map(row => row.id)).toEqual(['outbox-owned-child']);
  });

  it('short-circuits empty or non-positive diagnostics requests', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    await storage.saveChannelInboxItem(sampleChannelInbox());

    await expect(
      storage.listChannelDiagnosticsRows({
        harnessName: 'default',
        resourceId: 'resource-1',
        sessionIds: [],
        limit: 10,
      }),
    ).resolves.toEqual({ inbox: [], actionTokens: [], actionReceipts: [], outbox: [] });
    await expect(
      storage.listChannelDiagnosticsRows({
        harnessName: 'default',
        resourceId: 'resource-1',
        sessionIds: ['session-1'],
        limit: 0,
      }),
    ).resolves.toEqual({ inbox: [], actionTokens: [], actionReceipts: [], outbox: [] });
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

function sampleWorkspaceActionJournalEntry(
  overrides: Partial<WorkspaceActionJournalEntry> = {},
): WorkspaceActionJournalEntry {
  return {
    id: 'workspace-action-1',
    harnessName: 'default',
    sessionId: 'session-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    actionKind: 'file',
    operation: 'write',
    action: { kind: 'file', operation: 'write', path: 'notes.md' },
    policyDecision: 'ask',
    policyReasons: ['workspace.default_ask'],
    matchedRules: [],
    path: {
      rootId: 'project',
      rootPath: '/workspace',
      path: '/workspace/notes.md',
      relativePath: 'notes.md',
    },
    actor: { type: 'user', id: 'user-1' },
    requestId: 'request-1',
    result: { status: 'ok' },
    createdAt: 1000,
    ...overrides,
  };
}

function sampleChannelInbox(overrides: Partial<ChannelInboxItem> = {}): ChannelInboxItem {
  return {
    id: 'inbox-1',
    harnessName: 'default',
    channelId: 'support',
    providerId: 'slack',
    idempotencyKey: 'provider-event-1',
    payloadHash: 'payload-hash-1',
    admissionId: 'inbox-1',
    externalMessageId: 'message-1',
    receivedAt: 1000,
    updatedAt: 1000,
    status: 'received',
    attempts: 0,
    requestContext: {
      channel: {
        origin: 'inbound',
        harnessName: 'default',
        channelId: 'support',
        providerId: 'slack',
        platform: 'slack',
        externalThreadId: 'thread-ext-1',
        externalMessageId: 'message-1',
      },
    },
    content: 'hello',
    attachments: [],
    ...overrides,
  };
}

function sampleProviderCallbackBinding(
  overrides: Partial<HarnessProviderCallbackBinding> = {},
): HarnessProviderCallbackBinding {
  return {
    id: 'callback-binding-1',
    providerId: 'slack',
    selectorKind: 'installation',
    selectorValue: 'installation-1',
    harnessName: 'default',
    channelId: 'support',
    origin: { route: 'support-events' },
    status: 'active',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function sampleWakeup(overrides: Partial<HarnessWakeupItem> = {}): HarnessWakeupItem {
  return {
    id: 'wakeup-1',
    harnessName: 'default',
    source: 'schedule',
    sourceId: 'schedule-1',
    fireId: 'fire-1',
    idempotencyKey: 'wake-key-1',
    payloadHash: 'payload-hash-1',
    admissionId: 'wake-admission-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    sessionId: 'session-1',
    dueAt: 1000,
    createdAt: 1000,
    updatedAt: 1000,
    status: 'due',
    mode: 'build',
    model: 'model-1',
    attempts: 0,
    content: 'scheduled work',
    attachments: [],
    requestContext: { metadata: { source: 'schedule' } },
    ...overrides,
  };
}

function sampleChannelActionToken(overrides: Partial<ChannelActionToken> = {}): ChannelActionToken {
  return {
    actionTokenId: 'action-token-1',
    harnessName: 'default',
    channelId: 'support',
    providerId: 'slack',
    resourceId: 'resource-1',
    owningSessionId: 'session-1',
    itemId: 'question-1',
    kind: 'question',
    bindingId: 'binding-1',
    bindingGeneration: 1,
    runId: 'run-1',
    pendingRequestedAt: 1000,
    audience: { platformUserIds: ['user-1'] },
    metadataHash: 'metadata-hash-1',
    transportHash: 'transport-hash-1',
    keyId: 'key-1',
    expiresAt: 10_000,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function sampleChannelActionReceipt(overrides: Partial<ChannelActionReceipt> = {}): ChannelActionReceipt {
  return {
    id: 'receipt-1',
    harnessName: 'default',
    channelId: 'support',
    providerId: 'slack',
    actionTokenId: 'action-token-1',
    actionId: 'provider-action-1',
    bindingId: 'binding-1',
    bindingGeneration: 1,
    resourceId: 'resource-1',
    owningSessionId: 'session-1',
    itemId: 'question-1',
    kind: 'question',
    runId: 'run-1',
    pendingRequestedAt: 1000,
    audience: { platformUserIds: ['user-1'] },
    verifiedActor: { platformUserId: 'user-1', displayName: 'User One' },
    responseHash: 'response-hash-1',
    response: { answer: 'approved' },
    status: 'received',
    attempts: 0,
    createdAt: 1100,
    updatedAt: 1100,
    ...overrides,
  };
}

function sampleChannelOutbox(overrides: Partial<ChannelOutboxItem> = {}): ChannelOutboxItem {
  return {
    id: 'outbox-1',
    harnessName: 'default',
    channelId: 'support',
    providerId: 'slack',
    bindingId: 'binding-1',
    bindingGeneration: 1,
    idempotencyKey: 'outbox-key-1',
    payloadHash: 'payload-hash-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    sessionId: 'session-1',
    owningSessionId: 'session-1',
    target: {
      platform: 'slack',
      externalTenantId: 'tenant-1',
      externalChannelId: 'channel-1',
      externalThreadId: 'thread-ext-1',
    },
    kind: 'assistant-message',
    operationKind: 'message-create',
    payload: { text: 'hello' },
    deliverySemantics: 'native-idempotency',
    status: 'pending',
    attempts: 0,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}
