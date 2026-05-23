import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import {
  TABLE_HARNESS_ATTACHMENT_REFERENCES,
  TABLE_HARNESS_ATTACHMENTS,
  TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS,
  TABLE_HARNESS_CHANNEL_INBOX,
  TABLE_HARNESS_CHANNEL_OUTBOX,
  TABLE_HARNESS_MESSAGE_RESULTS,
  TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS,
  TABLE_HARNESS_SESSIONS,
  TABLE_HARNESS_THREAD_DELETE_FENCES,
  TABLE_HARNESS_WAKEUPS,
  TABLE_HARNESS_WORKSPACE_ACTIONS,
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
} from '@mastra/core/storage';
import type {
  ChannelActionReceipt,
  ChannelActionToken,
  ChannelInboxItem,
  ChannelOutboxItem,
  HarnessProviderCallbackBinding,
  HarnessWakeupItem,
  SessionRecord,
  WorkspaceActionJournalEntry,
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

  it('keeps §15 attachment-reference admission atomic and delete-guarded', async () => {
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

  it('hard-deletes all session event replay rows for the session id', async () => {
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
      expect.objectContaining({ id: 'a', actionKind: 'file', path: expect.objectContaining({ rootId: 'project' }) }),
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

  it('filters workspace action journal rows by thread, kind, operation, and policy decision', async () => {
    await storage.saveSession(sampleSession(), { ownerId: 'h-1', ifVersion: 0 });
    await storage.saveSession(sampleSession({ harnessName: 'other-harness' }), { ownerId: 'h-1', ifVersion: 0 });

    await expect(
      storage.appendWorkspaceActionJournalEntry(
        sampleWorkspaceActionJournalEntry({ id: 'wrong-thread', threadId: 'thread-2' }),
      ),
    ).resolves.toEqual({ created: false });
    await storage.appendWorkspaceActionJournalEntry(sampleWorkspaceActionJournalEntry({ id: 'a', createdAt: 1000 }));
    await storage.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'b',
        operation: 'read',
        action: { kind: 'file', operation: 'read', path: 'notes.md' },
        policyDecision: 'allow',
        createdAt: 1000,
      }),
    );
    await storage.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'c',
        actionKind: 'command',
        operation: 'run',
        action: { kind: 'command', operation: 'run', command: 'pnpm test' },
        policyDecision: 'deny',
        path: undefined,
        createdAt: 1100,
      }),
    );
    await storage.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'd',
        actionKind: 'mcp',
        operation: 'call',
        action: { kind: 'mcp', operation: 'call', serverKey: 'filesystem' },
        policyDecision: 'allow',
        path: undefined,
        createdAt: 1200,
      }),
    );
    await storage.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'e',
        actionKind: 'network',
        operation: 'fetch',
        action: { kind: 'network', operation: 'fetch', url: 'https://example.test' },
        path: undefined,
        createdAt: 1300,
      }),
    );
    await storage.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        harnessName: 'other-harness',
        id: 'other-namespace',
        createdAt: 900,
      }),
    );

    const listIds = async (
      overrides: Partial<Parameters<typeof storage.listWorkspaceActionJournalEntries>[0]>,
    ): Promise<string[]> =>
      (
        await storage.listWorkspaceActionJournalEntries({
          sessionId: 'session-1',
          resourceId: 'resource-1',
          limit: 10,
          ...overrides,
        })
      ).map(entry => entry.id);

    await expect(listIds({ threadId: 'thread-1' })).resolves.toEqual(['a', 'b', 'c', 'd', 'e']);
    await expect(listIds({ threadId: 'thread-2' })).resolves.toEqual([]);
    await expect(listIds({ sessionId: 'other-session' })).resolves.toEqual([]);
    await expect(listIds({ resourceId: 'other-resource' })).resolves.toEqual([]);
    await expect(listIds({ actionKind: 'file' })).resolves.toEqual(['a', 'b']);
    await expect(listIds({ operation: 'write' })).resolves.toEqual(['a']);
    await expect(listIds({ policyDecision: 'ask' })).resolves.toEqual(['a', 'e']);
    await expect(listIds({ actionKind: 'mcp', policyDecision: 'allow' })).resolves.toEqual(['d']);
    await expect(listIds({ actionKind: 'command', operation: 'run', policyDecision: 'deny' })).resolves.toEqual(['c']);
    await expect(listIds({ actionKind: 'file', after: { createdAt: 1000, id: 'a' } })).resolves.toEqual(['b']);
    await expect(listIds({ harnessName: 'other-harness' })).resolves.toEqual(['other-namespace']);
  });

  it('round-trips workspace action journal observability correlation fields', async () => {
    await storage.saveSession(sampleSession(), { ownerId: 'h-1', ifVersion: 0 });

    await storage.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'with-span',
        traceId: 'trace-1',
        spanId: 'span-1',
      }),
    );
    await storage.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'other-span',
        traceId: 'trace-2',
        spanId: 'span-2',
      }),
    );

    await expect(
      storage.listWorkspaceActionJournalEntries({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        traceId: 'trace-1',
        spanId: 'span-1',
        limit: 10,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'with-span',
        requestId: 'request-1',
        traceId: 'trace-1',
        spanId: 'span-1',
      }),
    ]);
    await expect(
      storage.listWorkspaceActionJournalEntries({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        traceId: 'trace-1',
        limit: 10,
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 'with-span' })]);
    await expect(
      storage.listWorkspaceActionJournalEntries({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        traceId: 'trace-2',
        spanId: 'span-2',
        limit: 10,
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 'other-span' })]);
    await expect(
      storage.listWorkspaceActionJournalEntries({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        spanId: 'span-2',
        limit: 10,
      }),
    ).rejects.toThrow('spanId filter requires traceId');
    await expect(
      storage.appendWorkspaceActionJournalEntry(
        sampleWorkspaceActionJournalEntry({
          id: 'invalid-span',
          spanId: 'span-without-trace',
        }),
      ),
    ).rejects.toThrow('spanId requires traceId');
  });

  it('widens existing workspace action journal tables with observability columns', async () => {
    const client = createHarnessTestClient();
    await client.execute({
      sql: `CREATE TABLE ${TABLE_HARNESS_WORKSPACE_ACTIONS} (
        id TEXT NOT NULL,
        harness_name TEXT NOT NULL,
        session_id TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        action_kind TEXT NOT NULL,
        operation TEXT,
        action TEXT NOT NULL,
        policy_decision TEXT NOT NULL,
        policy_reasons TEXT NOT NULL,
        matched_rules TEXT NOT NULL,
        path TEXT,
        to_path TEXT,
        cwd TEXT,
        actor TEXT,
        request_id TEXT,
        result TEXT,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (harness_name, session_id, id)
      )`,
      args: [],
    });
    const storage = new HarnessLibSQL({ client });
    await storage.init();
    await storage.saveSession(sampleSession(), { ownerId: 'h-1', ifVersion: 0 });
    await expect(
      storage.appendWorkspaceActionJournalEntry(
        sampleWorkspaceActionJournalEntry({
          id: 'with-span',
          traceId: 'trace-1',
          spanId: 'span-1',
        }),
      ),
    ).resolves.toEqual({ created: true });
    await expect(
      storage.listWorkspaceActionJournalEntries({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        traceId: 'trace-1',
        limit: 10,
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 'with-span', spanId: 'span-1' })]);
  });

  it('filters workspace action journal rows by request and affected path', async () => {
    await storage.saveSession(sampleSession(), { ownerId: 'h-1', ifVersion: 0 });

    await storage.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'write-readme',
        requestId: 'turn-1',
        path: {
          rootId: 'project',
          rootPath: '/workspace',
          path: '/workspace/README.md',
          relativePath: 'README.md',
        },
        action: { kind: 'file', operation: 'write', path: 'README.md' },
        createdAt: 1000,
      }),
    );
    await storage.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'rename-source',
        requestId: 'turn-1',
        operation: 'rename',
        action: { kind: 'file', operation: 'rename', path: 'src/old.ts', toPath: 'src/new.ts' },
        path: {
          rootId: 'project',
          rootPath: '/workspace',
          path: '/workspace/src/old.ts',
          relativePath: 'src/old.ts',
        },
        toPath: {
          rootId: 'project',
          rootPath: '/workspace',
          path: '/workspace/src/new.ts',
          relativePath: 'src/new.ts',
        },
        createdAt: 1100,
      }),
    );
    await storage.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'write-docs-readme',
        requestId: 'turn-2',
        path: {
          rootId: 'project',
          rootPath: '/workspace',
          path: '/workspace/docs/README.md',
          relativePath: 'docs/README.md',
        },
        action: { kind: 'file', operation: 'write', path: 'docs/README.md' },
        createdAt: 1200,
      }),
    );
    await storage.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'run-command',
        requestId: 'turn-1',
        actionKind: 'command',
        operation: 'run',
        action: { kind: 'command', operation: 'run', command: 'pnpm test' },
        path: undefined,
        createdAt: 1300,
      }),
    );

    const listIds = async (
      overrides: Partial<Parameters<typeof storage.listWorkspaceActionJournalEntries>[0]>,
    ): Promise<string[]> =>
      (
        await storage.listWorkspaceActionJournalEntries({
          sessionId: 'session-1',
          resourceId: 'resource-1',
          limit: 10,
          ...overrides,
        })
      ).map(entry => entry.id);

    await expect(listIds({ requestId: 'turn-1' })).resolves.toEqual(['write-readme', 'rename-source', 'run-command']);
    await expect(listIds({ requestId: 'turn-2', affectedPath: { relativePath: 'docs/README.md' } })).resolves.toEqual([
      'write-docs-readme',
    ]);
    await expect(listIds({ affectedPath: { rootId: 'project', relativePath: 'README.md' } })).resolves.toEqual([
      'write-readme',
    ]);
    await expect(listIds({ affectedPath: { path: '/workspace/src/old.ts' } })).resolves.toEqual(['rename-source']);
    await expect(listIds({ affectedPath: { relativePath: 'src/new.ts' } })).resolves.toEqual([]);
    await expect(listIds({ affectedPath: { relativePath: 'src/new.ts', includeToPath: true } })).resolves.toEqual([
      'rename-source',
    ]);
    await expect(listIds({ affectedPath: { rootId: 'other', relativePath: 'README.md' } })).resolves.toEqual([]);
    await expect(listIds({ affectedPath: {} })).resolves.toEqual([]);
    await expect(listIds({ affectedPath: { includeToPath: true } })).resolves.toEqual([]);
  });

  it('ignores duplicate or mismatched workspace action journal appends and deletes rows with the session', async () => {
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

describe('HarnessLibSQL provider callback binding ledger', () => {
  let storage: HarnessLibSQL;
  let client: Client;

  beforeEach(async () => {
    client = createHarnessTestClient();
    storage = new HarnessLibSQL({ client });
    await storage.init();
  });

  it('dedupes exact active selector bindings and creates active-selector indexes lazily', async () => {
    const client = createHarnessTestClient();
    const lazyStorage = new HarnessLibSQL({ client });
    const executeSpy = vi.spyOn(client, 'execute');

    await expect(lazyStorage.resolveProviderCallbackBinding(sampleProviderCallbackBinding())).resolves.toMatchObject({
      duplicate: false,
      conflict: false,
      binding: { id: 'callback-binding-1', status: 'active' },
    });
    await expect(
      lazyStorage.resolveProviderCallbackBinding(sampleProviderCallbackBinding({ id: 'callback-binding-retry' })),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: false,
      binding: { id: 'callback-binding-1' },
    });
    await expect(indexNames(client, TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS)).resolves.toEqual(
      expect.arrayContaining([
        'idx_harness_provider_callback_active_selector',
        'idx_harness_provider_callback_selector_status',
      ]),
    );
    expect(indexCreateStatements(executeSpy.mock.calls, 'idx_harness_provider_callback_')).toHaveLength(2);
  });

  it('reports same selector with a different target as a conflict without retargeting', async () => {
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

  it('rejects replacement retries when the previous owner was not replaced by the duplicate id', async () => {
    await storage.resolveProviderCallbackBinding(sampleProviderCallbackBinding());
    const stalledReplacement = sampleProviderCallbackBinding({
      id: 'callback-binding-2',
      status: 'disabled',
      harnessName: 'support-v2',
      channelId: 'support-v2',
      createdAt: 2000,
      updatedAt: 2000,
      origin: { route: 'support-events-v2' },
    });
    await client.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS}
            (id, provider_id, selector_kind, selector_value, harness_name, channel_id, origin, status,
             created_at, updated_at, replaced_at, replaced_by_binding_id, last_error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        stalledReplacement.id,
        stalledReplacement.providerId,
        stalledReplacement.selectorKind,
        stalledReplacement.selectorValue,
        stalledReplacement.harnessName,
        stalledReplacement.channelId,
        JSON.stringify(stalledReplacement.origin),
        stalledReplacement.status,
        stalledReplacement.createdAt,
        stalledReplacement.updatedAt,
        null,
        null,
        null,
      ],
    });

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
    ).rejects.toBeInstanceOf(HarnessStorageProviderCallbackBindingTransitionError);
    await expect(
      storage.loadProviderCallbackBindingBySelector({
        providerId: 'slack',
        selectorKind: 'installation',
        selectorValue: 'installation-1',
      }),
    ).resolves.toMatchObject({ id: 'callback-binding-1', status: 'active' });
  });

  it('loads provider binding JSON columns when the driver returns parsed values', async () => {
    await storage.resolveProviderCallbackBinding(sampleProviderCallbackBinding());
    await storage.markProviderCallbackBindingStatus({
      bindingId: 'callback-binding-1',
      status: 'undeliverable',
      updatedAt: 2000,
      lastError: { code: 'worker_unavailable', message: 'provider missing', retryable: true },
    });
    const originalExecute = client.execute.bind(client);
    vi.spyOn(client, 'execute').mockImplementation(async args => {
      const result = await originalExecute(args as Parameters<typeof client.execute>[0]);
      if (typeof args === 'object' && 'sql' in args && args.sql.includes(TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS)) {
        return {
          ...result,
          rows: result.rows.map(row => ({
            ...row,
            origin: typeof row.origin === 'string' ? JSON.parse(row.origin) : row.origin,
            last_error: typeof row.last_error === 'string' ? JSON.parse(row.last_error) : row.last_error,
          })),
        };
      }
      return result;
    });

    await expect(
      storage.markProviderCallbackBindingStatus({ bindingId: 'callback-binding-1', status: 'active', updatedAt: 3000 }),
    ).resolves.toMatchObject({
      id: 'callback-binding-1',
      origin: { route: 'support-events' },
      status: 'active',
      lastError: undefined,
    });
  });

  it('allows disabled or undeliverable bindings to reactivate when no active selector owner exists', async () => {
    await storage.resolveProviderCallbackBinding(sampleProviderCallbackBinding());

    await expect(
      storage.markProviderCallbackBindingStatus({
        bindingId: 'callback-binding-1',
        status: 'disabled',
        updatedAt: 2000,
        lastError: { code: 'worker_unavailable', message: 'provider disabled', retryable: true },
      }),
    ).resolves.toMatchObject({ status: 'disabled', lastError: { code: 'worker_unavailable' } });
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
    await expect(
      storage.markProviderCallbackBindingStatus({
        bindingId: 'callback-binding-1',
        status: 'undeliverable',
        updatedAt: 4000,
        lastError: { code: 'worker_unavailable', message: 'provider undeliverable', retryable: true },
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
      storage.markProviderCallbackBindingStatus({ bindingId: 'callback-binding-1', status: 'active', updatedAt: 5000 }),
    ).resolves.toMatchObject({ status: 'active', lastError: undefined });
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

describe('HarnessLibSQL wakeup ledger', () => {
  let storage: HarnessLibSQL;
  let client: Client;

  beforeEach(async () => {
    client = createHarnessTestClient();
    storage = new HarnessLibSQL({ client });
    await storage.init();
  });

  it('dedupes exact wakeups and reports source-fire key conflicts', async () => {
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

  it('creates wakeup idempotency, source-fire, and claim indexes on the lazy ensure path', async () => {
    const client = createHarnessTestClient();
    const lazyStorage = new HarnessLibSQL({ client });
    const executeSpy = vi.spyOn(client, 'execute');

    await lazyStorage.createOrLoadHarnessWakeupItem(sampleWakeup());

    await expect(indexNames(client, TABLE_HARNESS_WAKEUPS)).resolves.toEqual(
      expect.arrayContaining([
        'idx_harness_wakeups_idempotency',
        'idx_harness_wakeups_source_fire',
        'idx_harness_wakeups_claim',
      ]),
    );
    expect(indexCreateStatements(executeSpy.mock.calls, 'idx_harness_wakeups_')).toHaveLength(3);
  });

  it('flags same idempotency key with a different payload as a conflict', async () => {
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
    await storage.createOrLoadHarnessWakeupItem(sampleWakeup({ yolo: false }));

    await expect(storage.createOrLoadHarnessWakeupItem(sampleWakeup({ id: 'wakeup-retry' }))).resolves.toMatchObject({
      duplicate: true,
      conflict: false,
      item: { id: 'wakeup-1' },
    });
  });

  it('claims due and retryable failed wakeups while respecting backoff', async () => {
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
    await storage.createOrLoadHarnessWakeupItem(sampleWakeup(), {
      initialClaim: { claimId: 'stale', now: 10_000, claimTtlMs: 1000 },
    });
    await client.execute({
      sql: `UPDATE ${TABLE_HARNESS_WAKEUPS}
            SET queued_item_id = ?, queued_at = ?, completed_at = ?, dead_at = ?, run_id = ?, signal_id = ?, result = ?
            WHERE id = ?`,
      args: [
        'stale-queued',
        10_010,
        10_020,
        10_030,
        'stale-run',
        'stale-signal',
        JSON.stringify({ stale: true }),
        'wakeup-1',
      ],
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
    const result = await client.execute({
      sql: `SELECT queued_item_id, queued_at, completed_at, dead_at, run_id, signal_id, result
            FROM ${TABLE_HARNESS_WAKEUPS}
            WHERE id = ?`,
      args: ['wakeup-1'],
    });
    expect(result.rows[0]).toMatchObject({
      queued_item_id: null,
      queued_at: null,
      completed_at: null,
      dead_at: null,
      run_id: null,
      signal_id: null,
      result: null,
    });
  });

  it('reclaims expired claimed duplicate wakeups on create', async () => {
    await storage.createOrLoadHarnessWakeupItem(sampleWakeup(), {
      initialClaim: { claimId: 'stale', now: 10_000, claimTtlMs: 1000 },
    });
    await client.execute({
      sql: `UPDATE ${TABLE_HARNESS_WAKEUPS}
            SET queued_item_id = ?, queued_at = ?, completed_at = ?, dead_at = ?, run_id = ?, signal_id = ?, result = ?
            WHERE id = ?`,
      args: [
        'stale-queued',
        10_010,
        10_020,
        10_030,
        'stale-run',
        'stale-signal',
        JSON.stringify({ stale: true }),
        'wakeup-1',
      ],
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
    const result = await client.execute({
      sql: `SELECT queued_item_id, queued_at, completed_at, dead_at, run_id, signal_id, result
            FROM ${TABLE_HARNESS_WAKEUPS}
            WHERE id = ?`,
      args: ['wakeup-1'],
    });
    expect(result.rows[0]).toMatchObject({
      queued_item_id: null,
      queued_at: null,
      completed_at: null,
      dead_at: null,
      run_id: null,
      signal_id: null,
      result: null,
    });
  });

  it('preserves a null completed wakeup result', async () => {
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(10_050);
    try {
      await storage.createOrLoadHarnessWakeupItem(sampleWakeup(), {
        initialClaim: { claimId: 'claim-1', now: 10_000, claimTtlMs: 5000 },
      });
      await storage.updateHarnessWakeupItem(
        sampleWakeup({
          status: 'completed',
          attempts: 1,
          completedAt: 10_050,
          result: null,
          claimId: undefined,
          claimExpiresAt: undefined,
          updatedAt: 10_050,
        }),
        { claimId: 'claim-1' },
      );

      await expect(
        storage.loadHarnessWakeupItemByIdempotencyKey({ harnessName: 'default', idempotencyKey: 'wake-key-1' }),
      ).resolves.toMatchObject({ status: 'completed', result: null });
    } finally {
      dateNow.mockRestore();
    }
  });

  it('guards renewal and terminal updates by owner claim', async () => {
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

describe('HarnessLibSQL channel action ledger', () => {
  let storage: HarnessLibSQL;
  let client: Client;

  beforeEach(async () => {
    client = createHarnessTestClient();
    storage = new HarnessLibSQL({ client });
    await storage.init();
  });

  it('dedupes exact action tokens and flags immutable token mismatches', async () => {
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

  it('creates receipt indexes on the lazy ensure path', async () => {
    const client = createHarnessTestClient();
    const lazyStorage = new HarnessLibSQL({ client });

    await lazyStorage.createOrLoadChannelActionReceipt(sampleChannelActionReceipt());
    await lazyStorage.loadChannelActionReceiptByTokenId({
      harnessName: 'default',
      channelId: 'support',
      actionTokenId: 'action-token-1',
    });

    await expect(indexNames(client, TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS)).resolves.toEqual(
      expect.arrayContaining([
        'idx_harness_channel_action_receipts_token',
        'idx_harness_channel_action_receipts_action',
        'idx_harness_channel_action_receipts_claim',
      ]),
    );
  });

  it('dedupes exact action receipts and does not steal an active initial claim', async () => {
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

  it('does not treat non-positive claim limits as unbounded', async () => {
    await storage.createOrLoadChannelActionReceipt(sampleChannelActionReceipt());

    await expect(
      storage.claimChannelActionReceipts({
        harnessName: 'default',
        statuses: ['received'],
        claimId: 'claim-1',
        limit: -1,
        now: 2000,
        claimTtlMs: 1000,
      }),
    ).resolves.toEqual([]);
  });

  it('guards action receipt renewal and applied updates by owner claim', async () => {
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

  it('rejects stale same-claim action receipt updates after another writer changes the row', async () => {
    const now = 10_000;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now + 100);
    await storage.createOrLoadChannelActionReceipt(sampleChannelActionReceipt(), {
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
          sql.includes(`SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}`) &&
          sql.includes('WHERE harness_name = ? AND id = ?')
        ) {
          injectConcurrentUpdate = false;
          await originalExecute({
            sql: `UPDATE ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
                  SET attempts = ?
                  WHERE id = ?`,
            args: [1, 'receipt-1'],
          });
        }
        return result;
      });
      injectConcurrentUpdate = true;

      await expect(
        storage.updateChannelActionReceipt(
          sampleChannelActionReceipt({
            status: 'accepted',
            acceptedAt: now + 100,
            attempts: 2,
            updatedAt: now + 100,
            claimId: 'claim-1',
            claimExpiresAt: now + 5000,
          }),
          { claimId: 'claim-1' },
        ),
      ).rejects.toBeInstanceOf(HarnessStorageChannelActionClaimConflictError);
    } finally {
      dateNow.mockRestore();
    }
  });

  it('validates new action receipt rows before insert and keeps terminal saves idempotent', async () => {
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

describe('HarnessLibSQL channel outbox ledger', () => {
  let client: Client;
  let storage: HarnessLibSQL;

  beforeEach(async () => {
    client = createHarnessTestClient();
    storage = new HarnessLibSQL({ client });
    await storage.init();
  });

  it('dedupes exact outbound projections and flags same-key delivery conflicts', async () => {
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
  });

  it('claims at most the oldest due row for one binding while allowing different bindings', async () => {
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

  it('rechecks per-binding head-of-line ordering in the claim update', async () => {
    await storage.enqueueChannelOutbox(
      sampleChannelOutbox({ id: 'outbox-later', idempotencyKey: 'key-later', createdAt: 1001 }),
    );
    const execute = client.execute.bind(client);
    const executeSpy = vi.spyOn(client, 'execute').mockImplementation(async statement => {
      if (
        typeof statement === 'object' &&
        typeof statement.sql === 'string' &&
        statement.sql.includes(`UPDATE ${TABLE_HARNESS_CHANNEL_OUTBOX}`) &&
        statement.sql.includes("SET status = 'claimed'")
      ) {
        executeSpy.mockRestore();
        await storage.enqueueChannelOutbox(
          sampleChannelOutbox({ id: 'outbox-earlier', idempotencyKey: 'key-earlier', createdAt: 1000 }),
        );
      }
      return execute(statement);
    });

    await expect(
      storage.claimChannelOutbox({
        harnessName: 'default',
        claimId: 'claim-race',
        limit: 1,
        now: 2000,
        claimTtlMs: 5000,
      }),
    ).resolves.toEqual([]);

    const claimed = await storage.claimChannelOutbox({
      harnessName: 'default',
      claimId: 'claim-next',
      limit: 1,
      now: 2000,
      claimTtlMs: 5000,
    });
    expect(claimed).toEqual([expect.objectContaining({ id: 'outbox-earlier', claimId: 'claim-next' })]);
  });

  it('clears stale failure metadata when reclaiming retryable outbox rows', async () => {
    const now = 10_000;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      await storage.enqueueChannelOutbox(sampleChannelOutbox());
      await storage.claimChannelOutbox({
        harnessName: 'default',
        claimId: 'first',
        limit: 1,
        now,
        claimTtlMs: 1000,
      });
      await storage.markChannelOutboxFailed({
        outboxItemId: 'outbox-1',
        claimId: 'first',
        retryAt: now + 2000,
        error: { code: 'worker_unavailable', message: 'provider timeout' },
      });
    } finally {
      dateNow.mockRestore();
    }

    const retried = await storage.claimChannelOutbox({
      harnessName: 'default',
      claimId: 'retry',
      limit: 10,
      now: now + 2000,
      claimTtlMs: 1000,
    });
    expect(retried).toEqual([
      expect.objectContaining({
        id: 'outbox-1',
        status: 'claimed',
        attempts: 2,
        claimId: 'retry',
        claimExpiresAt: now + 3000,
      }),
    ]);
    expect(retried[0]?.nextAttemptAt).toBeUndefined();
    expect(retried[0]?.failedAt).toBeUndefined();
    expect(retried[0]?.lastError).toBeUndefined();
  });

  it('does not starve due rows for other bindings behind one blocked binding', async () => {
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

  it('guards sent and failed transitions by the active outbox claim', async () => {
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

  it('clears stale provider metadata when marking outbox rows sent without provider metadata', async () => {
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
      await client.execute({
        sql: `UPDATE ${TABLE_HARNESS_CHANNEL_OUTBOX}
              SET provider_message_id = ?, provider_receipt = ?
              WHERE id = ?`,
        args: ['stale-provider-message', JSON.stringify({ deliveryId: 'stale-delivery' }), 'outbox-1'],
      });

      await storage.markChannelOutboxSent({
        outboxItemId: 'outbox-1',
        claimId: 'claim-1',
        sentAt: now + 200,
      });

      const result = await client.execute({
        sql: `SELECT provider_message_id, provider_receipt
              FROM ${TABLE_HARNESS_CHANNEL_OUTBOX}
              WHERE id = ?`,
        args: ['outbox-1'],
      });
      expect(result.rows[0]).toMatchObject({
        provider_message_id: null,
        provider_receipt: null,
      });
    } finally {
      dateNow.mockRestore();
    }
  });

  it('treats non-retryable outbox delivery failures as terminal', async () => {
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
      const result = await client.execute({
        sql: `SELECT status, dead_at, next_attempt_at, last_error
              FROM ${TABLE_HARNESS_CHANNEL_OUTBOX}
              WHERE id = ?`,
        args: ['outbox-1'],
      });
      expect(result.rows[0]).toMatchObject({
        status: 'dead',
        dead_at: now,
        next_attempt_at: null,
      });
      expect(JSON.parse(String(result.rows[0]?.last_error))).toMatchObject({ retryable: false });
    } finally {
      dateNow.mockRestore();
    }
  });

  it('validates new outbox rows before insert', async () => {
    await expect(
      storage.enqueueChannelOutbox(sampleChannelOutbox({ status: 'sent', sentAt: 1001 })),
    ).rejects.toBeInstanceOf(HarnessStorageChannelOutboxTransitionError);
  });
});

describe('HarnessLibSQL channel diagnostics', () => {
  let storage: HarnessLibSQL;

  beforeEach(async () => {
    const client = createHarnessTestClient();
    storage = new HarnessLibSQL({ client });
    await storage.init();
  });

  it('lists resource and session scoped diagnostics rows across channel ledgers', async () => {
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

function indexCreateStatements(
  calls: Parameters<Client['execute']>[],
  prefix = 'idx_harness_channel_inbox_',
): string[] {
  return calls
    .map(([statement]) => (typeof statement === 'string' ? statement : statement.sql))
    .filter(sql => sql.includes(prefix));
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
