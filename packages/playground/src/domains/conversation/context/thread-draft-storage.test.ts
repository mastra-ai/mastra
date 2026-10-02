// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { deleteDB, openDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearUserThreadDrafts, moveThreadDraft, readThreadDraft, writeThreadDraft } from './thread-draft-storage';
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
  await deleteDB(DATABASE);
});

describe('draft storage', () => {
  describe('when saving a complete draft', () => {
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
      expect(new Uint8Array(await restored.attachments[0].file.arrayBuffer())).toEqual(
        new Uint8Array([0, 255, 13, 10]),
      );
    });

    it('preserves URL identity and attachment order in file-only drafts', async () => {
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

    it('isolates keys and persists attachment removal', async () => {
      await writeThreadDraft('one', withFile());
      await writeThreadDraft('two', textDraft('Second'));
      await writeThreadDraft('one', textDraft('First'));
      expect(await readThreadDraft('one')).toEqual(textDraft('First'));
      expect(await readThreadDraft('two')).toEqual(textDraft('Second'));
    });
  });

  describe('when multiple operations are queued in this tab', () => {
    it('finishes the latest write before a subsequent read', async () => {
      await Promise.all([writeThreadDraft('one', textDraft('First')), writeThreadDraft('one', textDraft('Latest'))]);
      expect(await readThreadDraft('one')).toEqual(textDraft('Latest'));
    });

    it('deletes submitted drafts after earlier writes finish', async () => {
      await Promise.all([writeThreadDraft('one', withFile()), writeThreadDraft('one', empty)]);
      expect(await readThreadDraft('one')).toEqual(empty);
      const db = await openDB(DATABASE);
      expect(await db.get('drafts', 'one')).toBeUndefined();
      db.close();
    });
  });

  describe('when New Chat is handed off', () => {
    it('moves the complete snapshot and removes the New Chat slot', async () => {
      await writeThreadDraft('new', textDraft('Old'));
      await moveThreadDraft('new', 'created', withFile());
      expect((await readThreadDraft('created')).attachments).toHaveLength(1);
      expect(await readThreadDraft('new')).toEqual(empty);
    });

    it('rolls back a failed handoff without breaking subsequent saves', async () => {
      await writeThreadDraft('new', withFile());
      const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
        throw new DOMException('Full', 'QuotaExceededError');
      });
      await expect(moveThreadDraft('new', 'created', withFile())).rejects.toThrow('Full');
      put.mockRestore();
      expect((await readThreadDraft('new')).attachments).toHaveLength(1);
      expect(await readThreadDraft('created')).toEqual(empty);
      await writeThreadDraft('other', textDraft('Works'));
      expect(await readThreadDraft('other')).toEqual(textDraft('Works'));
    });
  });

  describe('when retention limits apply', () => {
    it('keeps only twenty recent drafts and expires them after seven days', async () => {
      const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
      for (let i = 0; i < 21; i++) {
        clock.mockReturnValue(1000 + i);
        await writeThreadDraft(String(i), textDraft(String(i)));
      }
      expect(await readThreadDraft('0')).toEqual(empty);
      expect(await readThreadDraft('1')).toEqual(textDraft('1'));
      clock.mockReturnValue(1020 + 7 * 24 * 60 * 60 * 1000 - 1);
      expect(await readThreadDraft('20')).toEqual(textDraft('20'));
      clock.mockReturnValue(1020 + 7 * 24 * 60 * 60 * 1000);
      expect(await readThreadDraft('20')).toEqual(empty);
    });

    it('bounds total storage without loading every attachment for eviction', async () => {
      const clock = vi.spyOn(Date, 'now');
      const getAll = vi.spyOn(IDBObjectStore.prototype, 'getAll');
      for (let i = 0; i < 6; i++) {
        clock.mockReturnValue(1000 + i);
        await writeThreadDraft(String(i), withFile(9 * 1024 * 1024));
      }
      expect(getAll).not.toHaveBeenCalled();
      expect(await readThreadDraft('0')).toEqual(empty);
      expect((await readThreadDraft('1')).attachments).toHaveLength(1);
      expect((await readThreadDraft('5')).attachments).toHaveLength(1);
    });

    it('accepts exact limits without truncating content', async () => {
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

    it('rejects oversized content without replacing the last successful save', async () => {
      await writeThreadDraft('one', withFile());
      await expect(writeThreadDraft('one', textDraft('a'.repeat(50_001)))).rejects.toThrow('50,000');
      await expect(writeThreadDraft('one', withFile(10 * 1024 * 1024))).rejects.toThrow('10 MB');
      await expect(
        writeThreadDraft('one', { ...withFile(10 * 1024 * 1024 - 30_000), text: 'a'.repeat(20_000) }),
      ).rejects.toThrow('10 MB');
      expect((await readThreadDraft('one')).attachments).toHaveLength(1);
    });
  });

  describe('when the user signs out', () => {
    it('removes only that user’s server-scoped drafts', async () => {
      const scope = ['http://localhost:4111', '/api', 'user-one'];
      const key = JSON.stringify([...scope, 'agent', 'new']);
      const others = [
        JSON.stringify([scope[0], scope[1], 'user-two', 'agent', 'new']),
        JSON.stringify([scope[0], scope[1], undefined, 'agent', 'new']),
        JSON.stringify(['http://localhost:4222', scope[1], scope[2], 'agent', 'new']),
      ];
      for (const entry of [key, ...others]) await writeThreadDraft(entry, withFile());
      await clearUserThreadDrafts(JSON.stringify(scope));
      expect(await readThreadDraft(key)).toEqual(empty);
      for (const other of others) expect((await readThreadDraft(other)).attachments).toHaveLength(1);
    });
  });

  describe('when opening a database from an earlier preview', () => {
    it('indexes existing drafts without losing their attachments', async () => {
      const db = await openDB(DATABASE, 1, {
        upgrade(database) {
          database.createObjectStore('drafts', { keyPath: 'key' });
        },
      });
      const draft = withFile();
      await db.put('drafts', {
        key: 'legacy',
        ...draft,
        updatedAt: Date.now(),
        attachments: draft.attachments.map(attachment => ({
          ...attachment,
          fileName: attachment.file.name,
          lastModified: attachment.file.lastModified,
        })),
      });
      db.close();
      await writeThreadDraft('new', textDraft('New'));
      const restored = await readThreadDraft('legacy');
      expect(restored.text).toBe(draft.text);
      expect(new Uint8Array(await restored.attachments[0].file.arrayBuffer())).toEqual(new Uint8Array(4));
      const upgraded = await openDB(DATABASE);
      expect(await upgraded.countFromIndex('drafts', 'retention')).toBe(2);
      upgraded.close();
    });
  });
});
