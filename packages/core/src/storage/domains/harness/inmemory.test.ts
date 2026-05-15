import { describe, expect, it } from 'vitest';

import { InMemoryDB } from '../inmemory-db';
import { HarnessStorageVersionConflictError } from './base';
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
