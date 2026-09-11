// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { deleteDB, openDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { moveThreadDraft, readThreadDraft, writeThreadDraft } from './thread-draft-storage';
import type { ThreadDraft } from './thread-draft-storage';

const DATABASE = 'mastra-composer-drafts';
const empty: ThreadDraft = { text: '', attachments: [] };
const textDraft = (text: string): ThreadDraft => ({ text, attachments: [] });
const withFile = (size = 4): ThreadDraft => ({
  text: 'Read it',
  attachments: [
    {
      id: 'file-1',
      name: 'report.pdf',
      contentType: 'application/pdf',
      kind: 'pdf',
      isUrl: false,
      file: new File([new Uint8Array(size)], 'original.pdf', { type: 'application/pdf', lastModified: 1234 }),
    },
  ],
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await deleteDB(DATABASE);
});

describe('complete draft storage', () => {
  it('atomically rejects competing writes and stale clears', async () => {
    const revision = await writeThreadDraft('one', withFile());
    const results = await Promise.allSettled([
      writeThreadDraft('one', textDraft('First tab'), { revision }),
      writeThreadDraft('one', textDraft('Second tab'), { revision }),
    ]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    await expect(writeThreadDraft('one', empty, { revision })).rejects.toThrow('another tab');
    expect((await readThreadDraft('one')).text).toBe('First tab');
  });

  it('never replaces a destination draft during a handoff', async () => {
    const revision = await writeThreadDraft('new', withFile());
    await writeThreadDraft('created', textDraft('Keep destination'));
    await expect(moveThreadDraft('new', 'created', { revision, draft: withFile() })).rejects.toThrow('another tab');
    expect((await readThreadDraft('new')).attachments).toHaveLength(1);
    expect((await readThreadDraft('created')).text).toBe('Keep destination');
  });

  it('rolls back a handoff when the current draft cannot be saved', async () => {
    const revision = await writeThreadDraft('new', withFile());
    await expect(moveThreadDraft('new', 'created', { revision, draft: textDraft('x'.repeat(50_001)) })).rejects.toThrow(
      '50,000',
    );
    expect((await readThreadDraft('new')).attachments).toHaveLength(1);
    expect((await readThreadDraft('created')).text).toBe('');
  });
  it('restores exact text and original file bytes and metadata', async () => {
    const draft = withFile();
    draft.text = '  Zoë\r\n你好\n';
    draft.attachments[0].file = new File([new Uint8Array([0, 255, 13, 10])], 'original.pdf', {
      type: 'application/pdf',
      lastModified: 1234,
    });
    await writeThreadDraft('one', draft);
    const restored = await readThreadDraft('one');
    expect(restored.text).toBe(draft.text);
    expect(restored.attachments[0]).toMatchObject({ id: 'file-1', name: 'report.pdf', kind: 'pdf', isUrl: false });
    expect(restored.attachments[0].file.name).toBe('original.pdf');
    expect(restored.attachments[0].file.lastModified).toBe(1234);
    expect(restored.attachments[0].file.type).toBe('application/pdf');
    expect(new Uint8Array(await restored.attachments[0].file.arrayBuffer())).toEqual(new Uint8Array([0, 255, 13, 10]));
  });

  it('preserves URL identity and attachment order, including file-only drafts', async () => {
    const draft = withFile();
    draft.text = '';
    draft.attachments.push({
      id: 'url',
      name: 'https://example.com/report.pdf',
      contentType: 'application/pdf',
      kind: 'pdf',
      isUrl: true,
      file: new File([], 'https://example.com/report.pdf', { type: 'application/pdf' }),
    });
    await writeThreadDraft('one', draft);
    const restored = await readThreadDraft('one');
    expect(restored.attachments.map(a => a.id)).toEqual(['file-1', 'url']);
    expect(restored.attachments[1]).toMatchObject({ name: 'https://example.com/report.pdf', isUrl: true });
    expect(restored.attachments[1].file.size).toBe(0);
  });

  it('isolates scopes and persists attachment removal', async () => {
    await writeThreadDraft('one', withFile());
    await writeThreadDraft('two', textDraft('Second'));
    await writeThreadDraft('one', textDraft('First'));
    expect(await readThreadDraft('one')).toEqual(textDraft('First'));
    expect(await readThreadDraft('two')).toEqual(textDraft('Second'));
  });

  it('orders saves and clear so a late write cannot resurrect a submitted draft', async () => {
    await Promise.all([
      writeThreadDraft('one', withFile()),
      writeThreadDraft('one', textDraft('Edit')),
      writeThreadDraft('one', empty),
    ]);
    expect(await readThreadDraft('one')).toEqual(empty);
    const db = await openDB(DATABASE);
    expect(await db.get('drafts', 'one')).toBeUndefined();
    db.close();
  });

  it('moves the complete follow-up draft and removes the New Chat slot', async () => {
    await writeThreadDraft('new', withFile());
    await moveThreadDraft('new', 'created');
    expect((await readThreadDraft('created')).attachments).toHaveLength(1);
    expect(await readThreadDraft('new')).toEqual(empty);
    await moveThreadDraft('missing', 'created');
    expect((await readThreadDraft('created')).attachments).toHaveLength(1);
  });

  it('expires drafts after seven days and keeps only twenty recent drafts', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    for (let i = 0; i < 21; i++) {
      clock.mockReturnValue(1000 + i);
      await writeThreadDraft(String(i), textDraft(String(i)));
    }
    expect(await readThreadDraft('0')).toEqual(empty);
    expect(await readThreadDraft('1')).toEqual(textDraft('1'));
    clock.mockReturnValue(1020 + 7 * 24 * 60 * 60 * 1000);
    expect(await readThreadDraft('20')).toEqual(empty);
  });

  it('rejects oversized drafts without replacing the last complete version', async () => {
    await writeThreadDraft('one', withFile());
    await expect(writeThreadDraft('one', textDraft('a'.repeat(50_001)))).rejects.toThrow('50,000');
    await expect(writeThreadDraft('one', withFile(10 * 1024 * 1024))).rejects.toThrow('10 MB');
    expect((await readThreadDraft('one')).attachments).toHaveLength(1);
  });

  it('retains drafts through the last moment of the seven-day window', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    await writeThreadDraft('one', withFile());
    clock.mockReturnValue(now + 7 * 24 * 60 * 60 * 1000 - 1);
    expect((await readThreadDraft('one')).attachments).toHaveLength(1);
  });

  it('accepts the text and attachment count limits without truncation', async () => {
    const draft = withFile();
    draft.text = 'a'.repeat(50_000);
    draft.attachments = Array.from({ length: 20 }, (_, index) => ({ ...draft.attachments[0], id: String(index) }));
    await writeThreadDraft('one', draft);
    expect((await readThreadDraft('one')).text).toHaveLength(50_000);
    expect((await readThreadDraft('one')).attachments).toHaveLength(20);
    await expect(
      writeThreadDraft('one', { ...draft, attachments: [...draft.attachments, draft.attachments[0]] }),
    ).rejects.toThrow('20 attachments');
  });

  it('counts text and files together against the draft size limit', async () => {
    const draft = withFile(10 * 1024 * 1024 - 30_000);
    draft.text = 'a'.repeat(20_000);
    await expect(writeThreadDraft('one', draft)).rejects.toThrow('10 MB');
  });

  it('bounds combined file storage by evicting older complete drafts', async () => {
    const clock = vi.spyOn(Date, 'now');
    for (let i = 0; i < 6; i++) {
      clock.mockReturnValue(1000 + i);
      await writeThreadDraft(String(i), withFile(9 * 1024 * 1024));
    }
    expect(await readThreadDraft('0')).toEqual(empty);
    expect((await readThreadDraft('1')).attachments).toHaveLength(1);
    expect((await readThreadDraft('5')).attachments).toHaveLength(1);
  });

  it('rolls back a failed move and permits later operations', async () => {
    await writeThreadDraft('new', withFile());
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    await expect(moveThreadDraft('new', 'created')).rejects.toThrow('Full');
    put.mockRestore();
    expect((await readThreadDraft('new')).attachments).toHaveLength(1);
    expect(await readThreadDraft('created')).toEqual(empty);
    await writeThreadDraft('other', textDraft('Works'));
    expect(await readThreadDraft('other')).toEqual(textDraft('Works'));
  });

  it('surfaces unavailable storage rather than claiming a save succeeded', async () => {
    const open = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    await expect(writeThreadDraft('one', withFile())).rejects.toThrow('Blocked');
    open.mockRestore();
  });

  it('does not delete a draft when a repeated handoff uses the same key', async () => {
    await writeThreadDraft('one', withFile());
    await moveThreadDraft('one', 'one');
    expect((await readThreadDraft('one')).attachments).toHaveLength(1);
  });

  it('rejects corrupted records', async () => {
    await writeThreadDraft('one', withFile());
    const db = await openDB(DATABASE);
    await db.put('drafts', { key: 'one', text: 42 });
    db.close();
    await expect(readThreadDraft('one')).rejects.toThrow();
  });
});
