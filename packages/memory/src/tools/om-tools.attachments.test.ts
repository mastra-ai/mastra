import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

import { Memory } from '../index';

describe('recall attachment references', () => {
  const threadId = 'attachment-thread';
  const resourceId = 'attachment-owner';
  const options = { observationalMemory: { retrieval: true } };
  let storage: InMemoryStore;
  let memory: Memory;

  beforeEach(async () => {
    storage = new InMemoryStore();
    memory = new Memory({ storage, options });
    await memory.createThread({ threadId, resourceId });
  });

  async function save(parts: Record<string, unknown>[], id = 'attachment-message') {
    await memory.saveMessages({
      messages: [
        {
          id,
          threadId,
          resourceId,
          role: 'user',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          content: { format: 2, parts } as MastraDBMessage['content'],
        },
      ],
    });
  }

  // Recreate Memory so the assertions depend on saved parts, not caller state.
  async function recall(input: Record<string, unknown>, owner = resourceId, currentThreadId = threadId) {
    const reopened = new Memory({ storage, options });
    return reopened.listTools().recall!.execute!(input, {
      memory: reopened,
      agent: { threadId: currentThreadId, resourceId: owner },
    } as any) as Promise<any>;
  }

  const exactInput = { mode: 'messages', cursor: 'attachment-message', partIndex: 0, detail: 'high' };

  it.each([
    ['png', 'image/png'],
    ['mp4', 'video/mp4'],
    ['mp3', 'audio/mpeg'],
    ['pdf', 'application/pdf'],
    ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ])('returns the saved %s source in exact and paged recall', async (extension, mimeType) => {
    const url = `https://example.invalid/original.${extension}?token=Ab%2Fc%3D&version=2`;
    await save([{ type: 'file', data: url, mimeType, filename: `original.${extension}` }]);

    const exact = await recall(exactInput);
    expect(exact).toMatchObject({ messageId: 'attachment-message', partIndex: 0, type: 'file', truncated: false });
    expect(exact.text).toContain(url);
    expect(exact.text).toContain(mimeType);

    // Cursor pagination excludes the cursor itself. Start at the thread to read this message.
    const page = await recall({ mode: 'messages', threadId, anchor: 'start', detail: 'high', limit: 1 });
    expect(page.messages).toContain('[attachment-message]');
    expect(page.messages).toContain(url);
    expect(page.messages).toContain(mimeType);

    const raw = await memory.recall({ threadId, resourceId, perPage: false });
    expect(JSON.stringify(raw.messages)).toContain(url);
  });

  it.each([
    { type: 'file', url: 'https://example.invalid/ui.pdf', mediaType: 'application/pdf' },
    { type: 'image', image: 'https://example.invalid/image.png', mimeType: 'image/png' },
  ])('retains the reference in a $type part', async part => {
    await save([part]);
    const result = await recall(exactInput);
    expect(result.text).toContain(part.url ?? part.image);
    expect(result.text).toContain(part.mediaType ?? part.mimeType);
  });

  it('keeps same-named attachments distinct by message and part', async () => {
    const first = 'https://example.invalid/first.png';
    const second = 'https://example.invalid/second.png';
    await save([
      { type: 'file', data: first, mimeType: 'image/png', filename: 'photo.png' },
      { type: 'file', data: second, mimeType: 'image/png', filename: 'photo.png' },
    ]);
    const a = await recall(exactInput);
    const b = await recall({ ...exactInput, partIndex: 1 });
    expect(a.text).toContain(first);
    expect(a.text).not.toContain(second);
    expect(b.text).toContain(second);
    expect(b.text).not.toContain(first);
    expect(b.partIndex).toBe(1);
  });

  it('recalls an older authorized attachment from another thread without rewriting it', async () => {
    const url = 'https://example.invalid/history.png';
    await save([{ type: 'file', data: url, mimeType: 'image/png' }]);
    await memory.createThread({ threadId: 'new-thread', resourceId });
    const result = await recall(exactInput, resourceId, 'new-thread');
    expect(result.messageId).toBe('attachment-message');
    expect(result.text).toContain(url);
  });

  it('does not reveal a stored attachment to another resource', async () => {
    await save([{ type: 'file', data: 'https://example.invalid/private.png', mimeType: 'image/png' }]);
    await memory.createThread({ threadId: 'foreign-thread', resourceId: 'foreign-owner' });
    await expect(recall(exactInput, 'foreign-owner', 'foreign-thread')).rejects.toThrow();
    await expect(
      recall({ mode: 'messages', threadId, anchor: 'start', detail: 'high' }, 'foreign-owner', 'foreign-thread'),
    ).rejects.toThrow();
  });

  it.each([
    'data:image/png;base64,' + 'INLINE_PAYLOAD'.repeat(4000),
    'blob:https://example.invalid/temporary-blob',
    'file:///private/local.png',
    'not-a-url',
    'https://',
    undefined,
    { secret: 'INLINE_PAYLOAD' },
  ])('does not serialize inline, missing, or unusable references (%#)', async data => {
    await save([{ type: 'file', data, mimeType: 'image/png', filename: 'photo.png' }]);
    const result = await recall(exactInput);
    expect(result.text).toContain('[File: photo.png]');
    expect(result.text).toContain('image/png');
    expect(result.text).not.toContain('INLINE_PAYLOAD');
    expect(result.text).not.toContain('"url"');
    expect(result.text.length).toBeLessThan(200);
  });

  it('preserves a long signed URL through native continuation rather than changing it', async () => {
    const url = `https://example.invalid/long.pdf?signature=${'Ab%2FCd%3D'.repeat(2400)}`;
    await save([{ type: 'file', data: url, mimeType: 'application/pdf', filename: 'long.pdf' }]);
    const low = await recall({ mode: 'messages', threadId, anchor: 'start', detail: 'low', limit: 1 });
    expect(low.messages).toContain('detail="high"');

    let result = await recall(exactInput);
    expect(result.truncated).toBe(true);
    let complete = result.text;
    let calls = 1;
    while (result.truncated && calls < 100) {
      expect(result.nextCharOffset).toBeGreaterThan(result.charOffset);
      result = await recall({ ...exactInput, charOffset: result.nextCharOffset });
      complete += result.text;
      calls++;
    }
    expect(result.truncated).toBe(false);
    expect(complete).toContain(url);
  });
});
