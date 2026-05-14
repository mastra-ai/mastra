import { createHash } from 'node:crypto';

import { createClient } from '@libsql/client';
import { TABLE_HARNESS_ATTACHMENTS } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

import { HarnessLibSQL } from './index';

describe('HarnessLibSQL attachments', () => {
  let storage: HarnessLibSQL;

  beforeEach(async () => {
    const client = createClient({ url: ':memory:' });
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
