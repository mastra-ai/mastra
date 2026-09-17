import { openDB } from 'idb';
import type { DBSchema, IDBPObjectStore } from 'idb';
import { z } from 'zod';
import type { ComposerAttachment } from '@/lib/ai-ui/attachments/composer-attachments';

export interface ThreadDraft {
  text: string;
  attachments: ComposerAttachment[];
}

const DATABASE = 'mastra-composer-drafts';
const MAX_DRAFTS = 20;
const MAX_LENGTH = 50_000;
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_DRAFT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const recordSchema = z.object({
  key: z.string(),
  text: z.string().max(MAX_LENGTH),
  updatedAt: z.number().finite(),
  bytes: z.number().nonnegative().finite().optional(),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        contentType: z.string(),
        kind: z.enum(['image', 'pdf', 'video', 'text', 'file']),
        isUrl: z.boolean(),
        file: z.custom<Blob>(value => value instanceof Blob),
        fileName: z.string(),
        lastModified: z.number().finite(),
      }),
    )
    .max(20),
});
type DraftRecord = z.infer<typeof recordSchema>;
interface DraftDatabase extends DBSchema {
  drafts: { key: string; value: DraftRecord; indexes: { retention: [number, number] } };
}
type DraftStore = IDBPObjectStore<DraftDatabase, ['drafts'], 'drafts', 'readwrite'>;
const draftKeySchema = z.tuple([z.string().nullish(), z.string().nullish(), z.string().min(1), z.string(), z.string()]);
export function getDraftUserScope(key: string): string | undefined {
  try {
    const parsed = draftKeySchema.safeParse(JSON.parse(key));
    return parsed.success ? JSON.stringify(parsed.data.slice(0, 3)) : undefined;
  } catch {
    return undefined;
  }
}

export class DraftLimitError extends Error {}
const isFresh = (updatedAt: number) => updatedAt <= Date.now() && Date.now() - updatedAt < MAX_AGE;
const byteSize = (record: DraftRecord) =>
  record.text.length * 2 +
  record.attachments.reduce(
    (total, attachment) => total + attachment.file.size + (attachment.name.length + attachment.contentType.length) * 2,
    0,
  );

// Serialize reads as well as writes so a remount sees the outgoing controller's flush.
let pending: Promise<unknown> = Promise.resolve();
function transaction<T>(operation: (store: DraftStore) => Promise<T>): Promise<T> {
  const result = pending.then(async () => {
    const db = await openDB<DraftDatabase>(DATABASE, 3, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        const store = oldVersion < 1 ? db.createObjectStore('drafts', { keyPath: 'key' }) : tx.objectStore('drafts');
        if (oldVersion < 2) {
          store.createIndex('retention', ['updatedAt', 'bytes']);
          let cursor = await store.openCursor();
          while (cursor) {
            const parsed = recordSchema.safeParse(cursor.value);
            if (parsed.success) await cursor.update({ ...parsed.data, bytes: byteSize(parsed.data) });
            cursor = await cursor.continue();
          }
        }
      },
    });
    const tx = db.transaction(['drafts'], 'readwrite');
    const done = tx.done;
    try {
      const value = await operation(tx.objectStore('drafts'));
      await done;
      return value;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* The failed transaction may already have aborted. */
      }
      await done.catch(() => {});
      throw error;
    } finally {
      db.close();
    }
  });
  pending = result.catch(() => {});
  return result;
}

export function readThreadDraft(key: string): Promise<ThreadDraft> {
  return transaction(async store => {
    const parsed = recordSchema.safeParse(await store.get(key));
    if (!parsed.success || !isFresh(parsed.data.updatedAt) || byteSize(parsed.data) > MAX_DRAFT_BYTES) {
      await store.delete(key);
      return { text: '', attachments: [] };
    }
    const record = parsed.data;
    return {
      text: record.text,
      attachments: record.attachments.map(({ fileName, lastModified, ...attachment }) => ({
        ...attachment,
        file: new File([attachment.file], fileName, { type: attachment.file.type, lastModified }),
      })),
    };
  });
}

async function putDraft(store: DraftStore, key: string, draft: ThreadDraft): Promise<void> {
  if (!draft.text && draft.attachments.length === 0) {
    await store.delete(key);
    return;
  }
  if (draft.text.length > MAX_LENGTH) throw new DraftLimitError('Draft text exceeds 50,000 characters.');
  if (draft.attachments.length > 20) throw new DraftLimitError('Drafts can save at most 20 attachments.');
  const record: DraftRecord = {
    key,
    text: draft.text,
    updatedAt: Date.now(),
    attachments: draft.attachments.map(attachment => ({
      ...attachment,
      fileName: attachment.file.name,
      lastModified: attachment.file.lastModified,
    })),
  };
  let bytes = byteSize(record);
  if (bytes > MAX_DRAFT_BYTES) throw new DraftLimitError('Draft exceeds the 10 MB local storage limit.');
  record.bytes = bytes;
  let count = 1;
  // Index keys contain only timestamps and byte counts, not cloned attachment blobs.
  let cursor = await store.index('retention').openKeyCursor(undefined, 'prev');
  while (cursor) {
    if (cursor.primaryKey !== key) {
      const [updatedAt, size] = cursor.key;
      if (!isFresh(updatedAt) || count >= MAX_DRAFTS || bytes + size > MAX_TOTAL_BYTES) {
        await store.delete(cursor.primaryKey);
      } else {
        bytes += size;
        count++;
      }
    }
    cursor = await cursor.continue();
  }
  await store.put(record);
}

export function clearUserThreadDrafts(scope: string): Promise<void> {
  return transaction(async store => {
    for (const key of await store.getAllKeys()) {
      if (getDraftUserScope(key) === scope) await store.delete(key);
    }
  });
}

export function writeThreadDraft(key: string, draft: ThreadDraft): Promise<void> {
  return transaction(store => putDraft(store, key, draft));
}

export function moveThreadDraft(from: string, to: string, draft: ThreadDraft): Promise<void> {
  return transaction(async store => {
    await store.delete(from);
    await putDraft(store, to, draft);
  });
}
