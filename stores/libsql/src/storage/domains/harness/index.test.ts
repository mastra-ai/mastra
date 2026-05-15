import { createHash, randomUUID } from 'node:crypto';

import { createClient } from '@libsql/client';
import { TABLE_HARNESS_ATTACHMENTS } from '@mastra/core/storage';
import type { SessionRecord } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

import { HarnessLibSQL } from './index';

let harnessDbCounter = 0;

function createHarnessTestClient() {
  harnessDbCounter += 1;
  return createClient({
    url: `file:/tmp/mastra-harness-libsql-${process.pid}-${harnessDbCounter}-${randomUUID()}.db`,
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
    expect(record).toMatchObject({ source: 'preupload', sha256: expectedSha256, bytes: 3 });

    await legacyStorage.init();
    await expect(legacyStorage.loadAttachment({ sessionId: 'session-1', attachmentId: 'a1' })).resolves.toMatchObject({
      bytes: 3,
      sha256: expectedSha256,
    });
  });
});

describe('HarnessLibSQL message result evidence', () => {
  let storage: HarnessLibSQL;

  beforeEach(async () => {
    const client = createHarnessTestClient();
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
    ).resolves.toEqual({ created: false });

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
    ).resolves.toEqual({ created: false });

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
        kind: 'message',
        admissionId: 'admission-1',
        attemptedAdmissionHash: 'hash-1',
      }),
    ).resolves.toMatchObject({ status: 'duplicate', storedAdmissionHash: 'hash-1' });
    await expect(
      storage.resolveOperationAdmissionEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        kind: 'message',
        admissionId: 'admission-1',
        attemptedAdmissionHash: 'different-hash',
      }),
    ).resolves.toMatchObject({ status: 'conflict', storedAdmissionHash: 'hash-1' });
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

  beforeEach(async () => {
    const client = createHarnessTestClient();
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
