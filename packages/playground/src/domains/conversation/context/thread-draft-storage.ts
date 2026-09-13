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
  signouts: { key: string; value: string };
}
type DraftStore = IDBPObjectStore<DraftDatabase, ['drafts', 'signouts'], 'drafts', 'readwrite'>;
type SignoutStore = IDBPObjectStore<DraftDatabase, ['drafts', 'signouts'], 'signouts', 'readwrite'>;
interface DraftVersion {
  revision: string | undefined;
  logoutVersion?: string;
}

const draftKeySchema = z.tuple([z.string().nullish(), z.string().nullish(), z.string().min(1), z.string(), z.string()]);
export function getDraftUserScope(key: string): string | undefined {
  try {
    const parsed = draftKeySchema.safeParse(JSON.parse(key));
    return parsed.success ? JSON.stringify(parsed.data.slice(0, 3)) : undefined;
  } catch {
    return undefined;
  }
}

export class DraftSignedOutError extends Error {
  constructor() {
    super('This draft was cleared because you signed out. Reload before composing again.');
  }
}

export class DraftLimitError extends Error {}
export class CorruptedDraftError extends Error {
  constructor(readonly logoutVersion?: string) {
    super('The saved draft is unreadable.');
  }
}
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
function transaction<T>(operation: (store: DraftStore, signouts: SignoutStore) => Promise<T>): Promise<T> {
  const result = pending.then(async () => {
    const db = await openDB<DraftDatabase>(DATABASE, 3, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 3) db.createObjectStore('signouts');
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
    const tx = db.transaction(['drafts', 'signouts'], 'readwrite');
    const done = tx.done;
    try {
      const value = await operation(tx.objectStore('drafts'), tx.objectStore('signouts'));
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

export function loadThreadDraft(key: string): Promise<{ draft: ThreadDraft } & DraftVersion> {
  return transaction(async (store, signouts) => {
    const scope = getDraftUserScope(key);
    const logoutVersion = scope ? await signouts.get(scope) : undefined;
    const raw = await store.get(key);
    if (!raw) return { draft: { text: '', attachments: [] }, revision: undefined, logoutVersion };
    const parsed = recordSchema.safeParse(raw);
    if (!parsed.success) throw new CorruptedDraftError(logoutVersion);
    const record = parsed.data;
    if (!isFresh(record.updatedAt)) {
      await store.delete(key);
      return { draft: { text: '', attachments: [] }, revision: undefined, logoutVersion };
    }
    if (byteSize(record) > MAX_DRAFT_BYTES) throw new DraftLimitError('Saved draft exceeds the 10 MB limit.');
    return {
      revision: record.revision,
      logoutVersion,
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

export function discardCorruptedThreadDraft(key: string, expected: DraftVersion): Promise<void> {
  return transaction(async (store, signouts) => {
    await checkSignedIn(signouts, key, expected);
    const raw = await store.get(key);
    if (raw && recordSchema.safeParse(raw).success) throw new DraftConflictError();
    await store.delete(key);
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
  return revision;
}

async function checkSignedIn(signouts: SignoutStore, key: string, expected?: DraftVersion) {
  const scope = getDraftUserScope(key);
  if (expected && scope && (await signouts.get(scope)) !== expected.logoutVersion) throw new DraftSignedOutError();
}

export function clearUserThreadDrafts(scope: string): Promise<string> {
  return transaction(async (store, signouts) => {
    const version = uuid();
    await signouts.put(version, scope);
    for (const key of await store.getAllKeys()) {
      if (getDraftUserScope(key) === scope) await store.delete(key);
    }
    return version;
  });
}

export function writeThreadDraft(
  key: string,
  draft: ThreadDraft,
  expected?: DraftVersion,
): Promise<string | undefined> {
  return transaction(async (store, signouts) => {
    await checkSignedIn(signouts, key, expected);
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
  return transaction(async (store, signouts) => {
    await checkSignedIn(signouts, from, current);
    await checkSignedIn(signouts, to, current);
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
