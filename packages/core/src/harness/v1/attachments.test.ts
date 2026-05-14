import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { setupHarness } from './__test-utils__';

describe('Harness.attachments', () => {
  it('uploads attachments with digest metadata and deletes them by attachment id', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const source = Buffer.from('hello attachment');
    const expectedSha256 = createHash('sha256').update(source).digest('hex');
    const result = await harness.attachments.upload({
      sessionId: session.id,
      data: source,
      filename: 'note.txt',
      contentType: 'text/plain',
    });

    expect(result.resourceId).toBe('u');
    expect(result.ownerSessionId).toBe(session.id);
    expect(result.bytes).toBe(source.length);
    expect(result.sha256).toBe(expectedSha256);
    expect(result.source).toBe('preupload');

    const record = await storage.getAttachmentRecord({
      sessionId: session.id,
      attachmentId: result.attachmentId,
    });
    expect(record).not.toBeNull();
    expect(record).toMatchObject({
      ownerSessionId: session.id,
      name: 'note.txt',
      mimeType: 'text/plain',
      bytes: source.length,
      sha256: expectedSha256,
      source: 'preupload',
    });

    source[0] = 'j'.charCodeAt(0);

    const loaded = await storage.loadAttachment({
      sessionId: session.id,
      attachmentId: result.attachmentId,
    });
    expect(loaded).not.toBeNull();
    expect(loaded).toMatchObject({
      name: 'note.txt',
      mimeType: 'text/plain',
      bytes: source.length,
      sha256: expectedSha256,
    });
    expect(Buffer.from(loaded!.data).toString()).toBe('hello attachment');

    await harness.attachments.delete({ attachmentId: result.attachmentId, sessionId: session.id });

    await expect(
      storage.getAttachmentRecord({
        sessionId: session.id,
        attachmentId: result.attachmentId,
      }),
    ).resolves.toBeNull();
    await expect(
      storage.loadAttachment({
        sessionId: session.id,
        attachmentId: result.attachmentId,
      }),
    ).resolves.toBeNull();
  });

  it('uses the explicit owning session instead of the most-recent resource session', async () => {
    const { harness, storage } = setupHarness();
    const older = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const newer = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const result = await harness.attachments.upload({
      sessionId: older.id,
      resourceId: 'u',
      data: new Uint8Array([1, 2, 3]),
      filename: 'older.bin',
      contentType: 'application/octet-stream',
    });

    await expect(
      storage.getAttachmentRecord({
        sessionId: older.id,
        attachmentId: result.attachmentId,
      }),
    ).resolves.toMatchObject({ ownerSessionId: older.id });
    await expect(
      storage.getAttachmentRecord({
        sessionId: newer.id,
        attachmentId: result.attachmentId,
      }),
    ).resolves.toBeNull();

    await harness.attachments.delete({ sessionId: older.id, attachmentId: result.attachmentId });

    await expect(
      storage.getAttachmentRecord({
        sessionId: older.id,
        attachmentId: result.attachmentId,
      }),
    ).resolves.toBeNull();
  });
});
