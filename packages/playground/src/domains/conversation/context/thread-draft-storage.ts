import { v4 as uuid } from '@lukeed/uuid';
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
  revision: z.string().optional(),
  text: z.string().max(MAX_LENGTH),
  updatedAt: z.number().finite(),
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
  drafts: { key: string; value: DraftRecord };
}
type DraftStore = IDBPObjectStore<DraftDatabase, ['drafts'], 'drafts', 'readwrite'>;
interface DraftVersion {
  revision: string | undefined;
}

export class DraftLimitError extends Error {}
export class DraftConflictError extends Error {
  constructor() {
    super('This draft changed in another tab. Your edits are kept in this tab; copy them before reloading.');
  }
}

const isFresh = (updatedAt: number) => updatedAt <= Date.now() && Date.now() - updatedAt < MAX_AGE;
const byteSize = (record: DraftRecord) =>
  record.text.length * 2 +
  record.attachments.reduce(
    (total, attachment) => total + attachment.file.size + (attachment.name.length + attachment.contentType.length) * 2,
    0,
  );

// This queue preserves this tab's IO order; revision checks inside transactions protect other tabs.
let pending: Promise<unknown> = Promise.resolve();
function transaction<T>(operation: (store: DraftStore) => Promise<T>): Promise<T> {
  const result = pending.then(async () => {
    const db = await openDB<DraftDatabase>(DATABASE, 1, {
      upgrade(db) {
        db.createObjectStore('drafts', { keyPath: 'key' });
      },
    });
    const tx = db.transaction('drafts', 'readwrite');
    const done = tx.done;
    try {
      const value = await operation(tx.store);
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

export function loadThreadDraft(key: string): Promise<{ draft: ThreadDraft; revision: string | undefined }> {
  return transaction(async store => {
    const raw = await store.get(key);
    if (!raw) return { draft: { text: '', attachments: [] }, revision: undefined };
    const record = recordSchema.parse(raw);
    if (!isFresh(record.updatedAt)) {
      await store.delete(key);
      return { draft: { text: '', attachments: [] }, revision: undefined };
    }
    if (byteSize(record) > MAX_DRAFT_BYTES) throw new DraftLimitError('Saved draft exceeds the 10 MB limit.');
    return {
      revision: record.revision,
      draft: {
        text: record.text,
        attachments: record.attachments.map(({ fileName, lastModified, ...attachment }) => ({
          ...attachment,
          file: new File([attachment.file], fileName, { type: attachment.file.type, lastModified }),
        })),
      },
    };
  });
}

export async function readThreadDraft(key: string): Promise<ThreadDraft> {
  return (await loadThreadDraft(key)).draft;
}

async function putDraft(store: DraftStore, key: string, draft: ThreadDraft): Promise<string | undefined> {
  if (!draft.text && draft.attachments.length === 0) {
    await store.delete(key);
    return undefined;
  }
  if (draft.text.length > MAX_LENGTH) throw new DraftLimitError('Draft text exceeds 50,000 characters.');
  if (draft.attachments.length > 20) throw new DraftLimitError('Drafts can save at most 20 attachments.');
  const revision = uuid();
  const record: DraftRecord = {
    key,
    revision,
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
  let count = 1;
  const others = (await store.getAll()).filter(entry => entry.key !== key).sort((a, b) => b.updatedAt - a.updatedAt);
  for (const entry of others) {
    const parsed = recordSchema.safeParse(entry);
    if (
      !parsed.success ||
      !isFresh(parsed.data.updatedAt) ||
      count >= MAX_DRAFTS ||
      bytes + byteSize(parsed.data) > MAX_TOTAL_BYTES
    ) {
      await store.delete(entry.key);
    } else {
      bytes += byteSize(parsed.data);
      count++;
    }
  }
  await store.put(record);
  return revision;
}

export function writeThreadDraft(
  key: string,
  draft: ThreadDraft,
  expected?: DraftVersion,
): Promise<string | undefined> {
  return transaction(async store => {
    if (expected && (await store.get(key))?.revision !== expected.revision) throw new DraftConflictError();
    return putDraft(store, key, draft);
  });
}

export function moveThreadDraft(
  from: string,
  to: string,
  current?: DraftVersion & { draft: ThreadDraft },
): Promise<string | undefined> {
  if (from === to) return Promise.resolve(undefined);
  return transaction(async store => {
    const record = await store.get(from);
    if (current) {
      if (record?.revision !== current.revision || (await store.get(to))) throw new DraftConflictError();
      await store.delete(from);
      return putDraft(store, to, current.draft);
    }
    if (record) {
      const parsed = recordSchema.parse(record);
      if (isFresh(parsed.updatedAt)) await store.put({ ...parsed, key: to });
      await store.delete(from);
      return parsed.revision;
    }
    return undefined;
  });
}
