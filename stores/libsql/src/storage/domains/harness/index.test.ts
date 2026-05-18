import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import {
  TABLE_HARNESS_ATTACHMENT_REFERENCES,
  TABLE_HARNESS_ATTACHMENTS,
  TABLE_HARNESS_CHANNEL_INBOX,
  TABLE_HARNESS_MESSAGE_RESULTS,
  TABLE_HARNESS_SESSIONS,
  TABLE_HARNESS_THREAD_DELETE_FENCES,
  HarnessStorageChannelInboxClaimConflictError,
  HarnessStorageChannelInboxTransitionError,
  HarnessStorageDeleteGuardConflictError,
  HarnessStorageThreadDeleteFenceConflictError,
  HarnessStorageVersionConflictError,
} from '@mastra/core/storage';
import type {
  ChannelInboxItem,
  SessionRecord,
  HarnessStorageParentSessionUnavailableError,
} from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HarnessLibSQL } from './index';

let harnessDbCounter = 0;

function createHarnessTestClient() {
  harnessDbCounter += 1;
  const dbPath = join(tmpdir(), `mastra-harness-libsql-${process.pid}-${harnessDbCounter}-${randomUUID()}.db`);
  return createClient({
    url: pathToFileURL(dbPath).href,
  });
}

describe('HarnessLibSQL attachments', () => {
  let storage: HarnessLibSQL;

  beforeEach(async () => {
    const client = createHarnessTestClient();
    storage = new HarnessLibSQL({ client });
    await storage.init();
  });

  it('stores bytes with digest/source metadata and deletes by owning session', async () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const expectedSha256 = createHash('sha256').update(data).digest('hex');

    const saved = await storage.saveAttachment({
      sessionId: 'session-1',
      attachmentId: 'a1',
      name: 'note.txt',
      mimeType: 'text/plain',
      source: 'preupload',
      data,
    });
    expect(saved).toEqual({ attachmentId: 'a1', bytes: 4, sha256: expectedSha256 });

    const record = await storage.getAttachmentRecord({ sessionId: 'session-1', attachmentId: 'a1' });
    expect(record).toMatchObject({
      ownerSessionId: 'session-1',
      attachmentId: 'a1',
      name: 'note.txt',
      mimeType: 'text/plain',
      bytes: 4,
      sha256: expectedSha256,
      source: 'preupload',
    });

    const loaded = await storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' });
    expect(loaded).toMatchObject({
      name: 'note.txt',
      mimeType: 'text/plain',
      bytes: 4,
      sha256: expectedSha256,
    });
    expect(Array.from(loaded?.data ?? [])).toEqual([1, 2, 3, 4]);

    await storage.deleteAttachment({ sessionId: 'session-1', attachmentId: 'a1' });
    await expect(storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' })).resolves.toBeNull();
  });

  it('persists attachment semantic metadata and provider object pointers', async () => {
    const data = new TextEncoder().encode('{"kind":"primitive"}');
    const expectedSha256 = createHash('sha256').update(data).digest('hex');

    const saved = await storage.saveAttachment({
      sessionId: 'session-1',
      attachmentId: 'semantic-1',
      name: 'primitive.json',
      mimeType: 'application/json',
      source: 'provider',
      data,
      semantic: {
        kind: 'primitive',
        primitiveType: 'json',
        metadata: { label: 'Primitive payload' },
        object: {
          providerId: 'r2-dev',
          objectKey: 'harness/default/sessions/session-1/attachments/semantic-1/hash',
          etag: 'etag-1',
          storageClass: 'standard',
        },
      },
    });
    expect(saved).toEqual({ attachmentId: 'semantic-1', bytes: data.byteLength, sha256: expectedSha256 });

    await expect(storage.getAttachmentRecord({ sessionId: 'session-1', attachmentId: 'semantic-1' })).resolves.toEqual(
      expect.objectContaining({
        kind: 'primitive',
        primitiveType: 'json',
        source: 'provider',
        metadata: { label: 'Primitive payload' },
        object: {
          providerId: 'r2-dev',
          objectKey: 'harness/default/sessions/session-1/attachments/semantic-1/hash',
          etag: 'etag-1',
          storageClass: 'standard',
        },
      }),
    );
    await expect(storage.loadAttachment({ sessionId: 'session-1', attachmentId: 'semantic-1' })).resolves.toMatchObject(
      {
        semantic: {
          kind: 'primitive',
          primitiveType: 'json',
          object: { providerId: 'r2-dev' },
        },
      },
    );
  });

  it('backfills digest/source metadata when init sees the old attachment table shape', async () => {
    const client = createClient({ url: ':memory:' });
    const data = new Uint8Array([9, 8, 7]);
    const dataB64 = Buffer.from(data).toString('base64');
    const expectedSha256 = createHash('sha256').update(data).digest('hex');

    await client.execute(`
      CREATE TABLE ${TABLE_HARNESS_ATTACHMENTS} (
        session_id TEXT NOT NULL,
        attachment_id TEXT NOT NULL,
        name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        data_b64 TEXT NOT NULL,
        PRIMARY KEY (session_id, attachment_id)
      )
    `);
    await client.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENTS}
            (session_id, attachment_id, name, mime_type, size_bytes, created_at, data_b64)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: ['session-1', 'a1', 'legacy.bin', 'application/octet-stream', data.byteLength, Date.now(), dataB64],
    });

    const legacyStorage = new HarnessLibSQL({ client });
    await legacyStorage.init();

    const loaded = await legacyStorage.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' });
    expect(loaded).toMatchObject({
      name: 'legacy.bin',
      mimeType: 'application/octet-stream',
      bytes: 3,
      sha256: expectedSha256,
    });
    expect(Array.from(loaded?.data ?? [])).toEqual([9, 8, 7]);

    const record = await legacyStorage.getAttachmentRecord({ sessionId: 'session-1', attachmentId: 'a1' });
    expect(record).toMatchObject({ source: 'preupload', sha256: expectedSha256, bytes: 3, kind: 'file' });
    await expect(primaryKeyColumns(client, TABLE_HARNESS_ATTACHMENTS)).resolves.toEqual([
      'harness_name',
      'session_id',
      'attachment_id',
    ]);
    await expect(
      client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENTS}
              (harness_name, session_id, attachment_id, name, mime_type, size_bytes, sha256, source, created_at, data_b64)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          'secondary',
          'session-1',
          'a1',
          'secondary.bin',
          'application/octet-stream',
          1,
          createHash('sha256')
            .update(new Uint8Array([1]))
            .digest('hex'),
          'preupload',
          Date.now(),
          Buffer.from([1]).toString('base64'),
        ],
      }),
    ).resolves.toBeDefined();

    await legacyStorage.init();
    await expect(legacyStorage.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' })).resolves.toMatchObject({
      bytes: 3,
      sha256: expectedSha256,
    });
  });
});

describe('HarnessLibSQL legacy Harness table migrations', () => {
  it('rebuilds a pre-namespace sessions table with the namespace-aware primary key', async () => {
    const client = createClient({ url: ':memory:' });
    const legacySession = sampleSession({
      ownsThread: true,
      version: 7,
      ownerId: 'owner-1',
      leaseExpiresAt: 3000,
    });
    await createLegacySessionsTable(client);
    await insertLegacySession(client, legacySession);

    const legacyStorage = new HarnessLibSQL({ client });
    await legacyStorage.init();

    await expect(primaryKeyColumns(client, TABLE_HARNESS_SESSIONS)).resolves.toEqual(['harness_name', 'id']);
    await expect(legacyStorage.loadSession({ sessionId: 'session-1' })).resolves.toEqual(legacySession);
    await expect(
      legacyStorage.saveSession(sampleSession({ harnessName: 'secondary' }), { ownerId: 'h', ifVersion: 0 }),
    ).resolves.toMatchObject({ version: 1 });
  });

  it('rebuilds pre-namespace attachment references with the namespace-aware primary key', async () => {
    const client = createClient({ url: ':memory:' });
    await client.execute(`
      CREATE TABLE ${TABLE_HARNESS_ATTACHMENT_REFERENCES} (
        session_id TEXT NOT NULL,
        attachment_id TEXT NOT NULL,
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        retained_until INTEGER,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (session_id, attachment_id, source, source_id)
      )
    `);
    await client.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
            (session_id, attachment_id, source, source_id, retained_until, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['session-1', 'a1', 'queued_item', 'queued-1', 2000, 1000],
    });

    const legacyStorage = new HarnessLibSQL({ client });
    await legacyStorage.init();

    await expect(primaryKeyColumns(client, TABLE_HARNESS_ATTACHMENT_REFERENCES)).resolves.toEqual([
      'harness_name',
      'session_id',
      'attachment_id',
      'source',
      'source_id',
    ]);
    await expect(
      legacyStorage.listAttachmentReferences({ sessionId: 'session-1', attachmentId: 'a1' }),
    ).resolves.toEqual([{ source: 'queued_item', sourceId: 'queued-1', retainedUntil: 2000 }]);
    await expect(
      client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
              (harness_name, session_id, attachment_id, source, source_id, retained_until, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: ['secondary', 'session-1', 'a1', 'queued_item', 'queued-1', 3000, 1000],
      }),
    ).resolves.toBeDefined();
  });

  it('reports duplicate active legacy sessions before creating the active-session index', async () => {
    const client = createClient({ url: ':memory:' });
    await createLegacySessionsTable(client);
    await insertLegacySession(client, { id: 'session-1', resourceId: 'resource-1', threadId: 'thread-1' });
    await insertLegacySession(client, { id: 'session-2', resourceId: 'resource-1', threadId: 'thread-1' });

    const legacyStorage = new HarnessLibSQL({ client });
    await expect(legacyStorage.init()).rejects.toThrow(
      'Cannot create Harness active-session uniqueness index while duplicate active rows exist',
    );
    await expect(primaryKeyColumns(client, TABLE_HARNESS_SESSIONS)).resolves.toEqual(['id']);
  });
});

describe('HarnessLibSQL active session admission', () => {
  let storage: HarnessLibSQL;
  let client: Client;

  beforeEach(async () => {
    client = createHarnessTestClient();
    storage = new HarnessLibSQL({ client });
    await storage.init();
  });

  it('rejects child admission when the parent is closing', async () => {
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

  it('does not hard-delete when the guarded version is stale', async () => {
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

  it('lists sessions by exact resource/thread and can include closed records', async () => {
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
    await storage.withThreadDeleteFence({ threadId: 'slow-thread', ownerId: 'deleter', ttlMs: 500 }, async () => {
      await new Promise(resolve => setTimeout(resolve, 750));
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
    await storage.withThreadDeleteFence({ threadId: 'lost-thread', ownerId: 'deleter', ttlMs: 30_000 }, async fence => {
      await client.execute({
        sql: `UPDATE ${TABLE_HARNESS_THREAD_DELETE_FENCES}
              SET owner_id = ?
              WHERE thread_id = ?`,
        args: ['other-owner', 'lost-thread'],
      });

      await expect(fence.assertActive()).rejects.toBeInstanceOf(HarnessStorageThreadDeleteFenceConflictError);
    });
  });

  it('does not revive an expired delete fence before destructive work', async () => {
    await storage.withThreadDeleteFence(
      { threadId: 'expired-thread', ownerId: 'deleter', ttlMs: 30_000 },
      async fence => {
        await client.execute({
          sql: `UPDATE ${TABLE_HARNESS_THREAD_DELETE_FENCES}
              SET expires_at = ?
              WHERE thread_id = ?`,
          args: [Date.now() - 1, 'expired-thread'],
        });

        await expect(fence.assertActive()).rejects.toBeInstanceOf(HarnessStorageThreadDeleteFenceConflictError);
      },
    );
  });
});

describe('HarnessLibSQL message result evidence', () => {
  let storage: HarnessLibSQL;
  let client: Client;

  beforeEach(async () => {
    client = createHarnessTestClient();
    storage = new HarnessLibSQL({ client });
    await storage.init();
  });

  it('stores retained message evidence and resolves duplicate/conflict admissions', async () => {
    await expect(
      storage.writeMessageResultEvidence({
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
      }),
    ).resolves.toEqual({ created: true });

    await expect(
      storage.writeMessageResultEvidence({
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
      }),
    ).resolves.toMatchObject({
      created: false,
      evidence: { admissionId: 'admission-1', admissionHash: 'hash-1', status: 'completed' },
    });

    await expect(
      storage.writeMessageResultEvidence({
        harnessName: 'default',
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        signalId: 'signal-1',
        runId: 'run-1',
        admissionId: 'admission-1',
        admissionHash: 'hash-1',
        status: 'pending',
        createdAt: 3000,
        updatedAt: 3000,
      }),
    ).resolves.toMatchObject({
      created: false,
      evidence: { admissionId: 'admission-1', admissionHash: 'hash-1', status: 'completed' },
    });

    await expect(
      storage.loadMessageResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        signalId: 'signal-1',
      }),
    ).resolves.toMatchObject({ status: 'completed', result: { text: 'done' } });
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
        attemptedAdmissionHash: 'different-hash',
      }),
    ).resolves.toMatchObject({ status: 'conflict', storedAdmissionHash: 'hash-1' });
  });

  it('rejects completed message evidence without a run id', async () => {
    await expect(
      storage.writeMessageResultEvidence({
        harnessName: 'default',
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        signalId: 'signal-1',
        admissionId: 'admission-1',
        admissionHash: 'hash-1',
        status: 'completed',
        result: { text: 'done' },
        createdAt: 1000,
        updatedAt: 2000,
      } as unknown as Parameters<HarnessLibSQL['writeMessageResultEvidence']>[0]),
    ).rejects.toThrow('completed status requires run_id');

    await client.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_MESSAGE_RESULTS}
            (id, harness_name, session_id, resource_id, thread_id, signal_id, run_id,
             admission_id, admission_hash, status, result, error, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'default\0session-1\0signal-1',
        'default',
        'session-1',
        'resource-1',
        'thread-1',
        'signal-1',
        null,
        'admission-1',
        'hash-1',
        'completed',
        JSON.stringify({ text: 'done' }),
        null,
        1000,
        2000,
      ],
    });

    await expect(
      storage.loadMessageResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        signalId: 'signal-1',
      }),
    ).rejects.toThrow('completed status requires run_id');
  });

  it('compacts terminal message evidence into tombstones', async () => {
    await storage.writeMessageResultEvidence({
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

    const compacted = await storage.compactOperationResultEvidence({
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
      storage.loadMessageResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        signalId: 'signal-1',
      }),
    ).resolves.toEqual(compacted);
  });
});

describe('HarnessLibSQL queue admission evidence', () => {
  let storage: HarnessLibSQL;
  let client: Client;

  beforeEach(async () => {
    client = createHarnessTestClient();
    storage = new HarnessLibSQL({ client });
    await storage.init();
  });

  it('resolves queue admission duplicates and conflicts from retained receipts', async () => {
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

  it('reports queue compaction retry conflicts with receipt context', async () => {
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
            updatedAt: 2000,
            completedAt: 3000,
            result: { ok: true },
          },
        },
      }),
      { ownerId: 'h', ifVersion: 0 },
    );

    const originalExecute = client.execute.bind(client);
    vi.spyOn(client, 'execute').mockImplementation(async (statement: Parameters<Client['execute']>[0]) => {
      const sql = typeof statement === 'string' ? statement : statement.sql;
      if (sql.includes(`UPDATE ${TABLE_HARNESS_SESSIONS}`) && sql.includes('queue_admission_receipts')) {
        const result = await originalExecute('SELECT 1');
        return { ...result, rowsAffected: 0 };
      }
      return originalExecute(statement);
    });

    await expect(
      storage.compactOperationResultEvidence({
        harnessName: 'default',
        sessionId: 'session-1',
        resourceId: 'resource-1',
        kind: 'queue',
        queuedItemId: 'queued-1',
        now: 4000,
      }),
    ).rejects.toThrow(
      'Harness LibSQL queue compaction for harness "default" session "session-1" resource "resource-1" queued item "queued-1" admission "admission-1" conflicted after retries',
    );
  });
});

describe('HarnessLibSQL inbox response receipts', () => {
  let storage: HarnessLibSQL;

  beforeEach(async () => {
    const client = createHarnessTestClient();
    storage = new HarnessLibSQL({ client });
    await storage.init();
  });

  it('round-trips inbox response receipts on session records', async () => {
    await storage.saveSession(
      sampleSession({
        inboxResponseReceipts: {
          'response-1': {
            responseId: 'response-1',
            responseHash: 'hash-1',
            resumeAttemptId: 'response-1',
            itemId: 'question:tool-1',
            kind: 'question',
            runId: 'run-1',
            toolCallId: 'tool-1',
            pendingRequestedAt: 1000,
            response: { answer: 'red' },
            status: 'applied',
            result: { text: 'done', finishReason: 'stop', runId: 'run-1' },
            acceptedAt: 1100,
            appliedAt: 1200,
            updatedAt: 1200,
          },
        },
      }),
      { ownerId: 'h', ifVersion: 0 },
    );

    await expect(storage.loadSession({ sessionId: 'session-1' })).resolves.toMatchObject({
      inboxResponseReceipts: {
        'response-1': {
          responseId: 'response-1',
          resumeAttemptId: 'response-1',
          itemId: 'question:tool-1',
          status: 'applied',
          response: { answer: 'red' },
          result: { text: 'done', finishReason: 'stop', runId: 'run-1' },
        },
      },
    });
  });
});

describe('HarnessLibSQL channel inbox ledger', () => {
  let storage: HarnessLibSQL;

  beforeEach(async () => {
    const client = createHarnessTestClient();
    storage = new HarnessLibSQL({ client });
    await storage.init();
  });

  it('dedupes exact provider callbacks and does not steal an active initial claim', async () => {
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

  it('creates claim and idempotency indexes on the lazy ensure path', async () => {
    const client = createHarnessTestClient();
    const lazyStorage = new HarnessLibSQL({ client });
    const executeSpy = vi.spyOn(client, 'execute');

    await lazyStorage.createOrLoadChannelInboxItem(sampleChannelInbox());
    await lazyStorage.loadChannelInboxItemByIdempotencyKey({
      harnessName: 'default',
      channelId: 'support',
      idempotencyKey: 'provider-event-1',
    });

    await expect(indexNames(client, TABLE_HARNESS_CHANNEL_INBOX)).resolves.toEqual(
      expect.arrayContaining(['idx_harness_channel_inbox_idempotency', 'idx_harness_channel_inbox_claim']),
    );
    expect(indexCreateStatements(executeSpy.mock.calls)).toHaveLength(2);
  });

  it('flags same idempotency key with a different payload hash as a conflict', async () => {
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

  it('rejects stale same-claim updates when another writer changes the row after the validation read', async () => {
    const client = createHarnessTestClient();
    storage = new HarnessLibSQL({ client });
    await storage.init();
    const now = 10_000;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now + 100);
    await storage.createOrLoadChannelInboxItem(sampleChannelInbox(), {
      initialClaim: { claimId: 'claim-1', now, claimTtlMs: 5000 },
    });
    const originalExecute = client.execute.bind(client);
    let injectConcurrentUpdate = false;
    try {
      vi.spyOn(client, 'execute').mockImplementation(async statement => {
        const result = await originalExecute(statement);
        const sql = typeof statement === 'string' ? statement : statement.sql;
        if (
          injectConcurrentUpdate &&
          sql.includes(`SELECT * FROM ${TABLE_HARNESS_CHANNEL_INBOX}`) &&
          sql.includes('WHERE harness_name = ? AND id = ?')
        ) {
          injectConcurrentUpdate = false;
          await originalExecute({
            sql: `UPDATE ${TABLE_HARNESS_CHANNEL_INBOX}
                  SET attempts = ?
                  WHERE id = ?`,
            args: [1, 'inbox-1'],
          });
        }
        return result;
      });
      injectConcurrentUpdate = true;

      await expect(
        storage.updateChannelInboxItem(
          sampleChannelInbox({
            attempts: 2,
            claimId: 'claim-1',
            claimExpiresAt: now + 5000,
            updatedAt: now + 100,
          }),
          { claimId: 'claim-1' },
        ),
      ).rejects.toBeInstanceOf(HarnessStorageChannelInboxClaimConflictError);
    } finally {
      dateNow.mockRestore();
    }
  });

  it('allows same-claim updates after a concurrent lease renewal and preserves the renewed expiry', async () => {
    const client = createHarnessTestClient();
    storage = new HarnessLibSQL({ client });
    await storage.init();
    const now = 10_000;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now + 100);
    await storage.createOrLoadChannelInboxItem(sampleChannelInbox(), {
      initialClaim: { claimId: 'claim-1', now, claimTtlMs: 5000 },
    });
    await storage.renewChannelInboxClaim({
      inboxItemId: 'inbox-1',
      claimId: 'claim-1',
      now: now + 50,
      claimTtlMs: 8950,
    });
    const originalExecute = client.execute.bind(client);
    let injectRenewal = false;
    try {
      vi.spyOn(client, 'execute').mockImplementation(async statement => {
        const result = await originalExecute(statement);
        const sql = typeof statement === 'string' ? statement : statement.sql;
        if (
          injectRenewal &&
          sql.includes(`SELECT * FROM ${TABLE_HARNESS_CHANNEL_INBOX}`) &&
          sql.includes('WHERE harness_name = ? AND id = ?')
        ) {
          injectRenewal = false;
          await originalExecute({
            sql: `UPDATE ${TABLE_HARNESS_CHANNEL_INBOX}
                  SET claim_expires_at = ?, updated_at = ?
                  WHERE id = ? AND claim_id = ?`,
            args: [now + 10_000, now + 75, 'inbox-1', 'claim-1'],
          });
        }
        return result;
      });
      injectRenewal = true;

      await storage.updateChannelInboxItem(
        sampleChannelInbox({
          status: 'admitted',
          delivery: 'message',
          admittedAt: now + 100,
          updatedAt: now + 100,
          claimId: 'claim-1',
          claimExpiresAt: now + 5000,
        }),
        { claimId: 'claim-1' },
      );

      await expect(
        storage.loadChannelInboxItemByIdempotencyKey({
          harnessName: 'default',
          channelId: 'support',
          idempotencyKey: 'provider-event-1',
        }),
      ).resolves.toMatchObject({
        status: 'admitted',
        claimId: 'claim-1',
        claimExpiresAt: now + 10_000,
      });
    } finally {
      dateNow.mockRestore();
    }
  });

  it('records retryable failed evidence, releases the claim, and reclaims after backoff', async () => {
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

async function primaryKeyColumns(client: Client, tableName: string): Promise<string[]> {
  const result = await client.execute({ sql: `PRAGMA table_info("${tableName}")`, args: [] });
  return result.rows
    .map(row => ({ name: String(row.name), order: Number(row.pk ?? 0) }))
    .filter(row => row.order > 0)
    .sort((a, b) => a.order - b.order)
    .map(row => row.name);
}

async function indexNames(client: Client, tableName: string): Promise<string[]> {
  const result = await client.execute({ sql: `PRAGMA index_list("${tableName}")`, args: [] });
  return result.rows.map(row => String(row.name));
}

function indexCreateStatements(calls: Parameters<Client['execute']>[]): string[] {
  return calls
    .map(([statement]) => (typeof statement === 'string' ? statement : statement.sql))
    .filter(sql => sql.includes('idx_harness_channel_inbox_'));
}

async function createLegacySessionsTable(client: Client): Promise<void> {
  await client.execute(`
    CREATE TABLE ${TABLE_HARNESS_SESSIONS} (
      id TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      parent_session_id TEXT,
      origin TEXT NOT NULL,
      owns_thread INTEGER NOT NULL,
      mode_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      subagent_model_overrides TEXT NOT NULL,
      permission_rules TEXT NOT NULL,
      session_grants TEXT NOT NULL,
      token_usage TEXT NOT NULL,
      pending_queue TEXT NOT NULL,
      pending_resume TEXT,
      observational_memory TEXT,
      goal TEXT,
      workspace TEXT,
      state TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_activity_at INTEGER NOT NULL,
      closed_at INTEGER,
      version INTEGER NOT NULL,
      owner_id TEXT,
      lease_expires_at INTEGER,
      PRIMARY KEY (id)
    )
  `);
}

async function insertLegacySession(client: Client, overrides: Partial<SessionRecord> = {}): Promise<void> {
  const session = sampleSession(overrides);
  await client.execute({
    sql: `INSERT INTO ${TABLE_HARNESS_SESSIONS}
          (id, resource_id, thread_id, parent_session_id, origin, owns_thread, mode_id, model_id,
           subagent_model_overrides, permission_rules, session_grants, token_usage, pending_queue, pending_resume,
           observational_memory, goal, workspace, state, created_at, last_activity_at, closed_at, version,
           owner_id, lease_expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      session.id,
      session.resourceId,
      session.threadId,
      session.parentSessionId ?? null,
      session.origin,
      session.ownsThread ? 1 : 0,
      session.modeId,
      session.modelId,
      JSON.stringify(session.subagentModelOverrides),
      JSON.stringify(session.permissionRules),
      JSON.stringify(session.sessionGrants),
      JSON.stringify(session.tokenUsage),
      JSON.stringify(session.pendingQueue),
      session.pendingResume ? JSON.stringify(session.pendingResume) : null,
      session.observationalMemory ? JSON.stringify(session.observationalMemory) : null,
      session.goal ? JSON.stringify(session.goal) : null,
      session.workspace ? JSON.stringify(session.workspace) : null,
      JSON.stringify(session.state),
      session.createdAt,
      session.lastActivityAt,
      session.closedAt ?? null,
      session.version,
      session.ownerId ?? null,
      session.leaseExpiresAt ?? null,
    ],
  });
}
