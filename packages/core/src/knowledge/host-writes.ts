import { KnowledgeNotFoundError } from '../storage/domains/knowledge/base';
import type { KnowledgeStorage } from '../storage/domains/knowledge/base';
import { assertKnowledgeNoteTextWithinBound } from '../storage/domains/knowledge/pages';
import type { KnowledgeNote, KnowledgePage, KnowledgeProvenance } from '../storage/domains/knowledge/pages';
import type { KnowledgeScopeRuntime } from './scope-runtime';
import type { KnowledgeSemanticIndex } from './semantic';

/**
 * A page an app writes from outside an agent run, e.g. a doc synced from a docs site.
 * @experimental
 */
export interface KnowledgeUpsertPageInput {
  /** Canonical scope address the page lives in, e.g. `docs:acme`. Created on first write. */
  scope: string;
  /**
   * Key path below the scope, e.g. `guides/install`. It is the page's identity: writing the same path
   * again updates that page. Keys can't contain `#` or `%`. Missing pages along the path are
   * created with their key as name.
   */
  path: string;
  name: string;
  /** At most 100 tokens. Left as it is when omitted. */
  description?: string;
  /** Left as it is when omitted. */
  body?: string;
  /** Recorded as the writer. Default `host`. */
  author?: string;
}

/** @experimental */
export interface KnowledgeUpsertPageResult {
  page: KnowledgePage;
  /** `unchanged` writes nothing: no new version, no change event, no re-embedding. */
  status: 'created' | 'updated' | 'unchanged';
}

/** @experimental */
export interface KnowledgeRemovePageInput {
  scope: string;
  path: string;
  author?: string;
}

/**
 * A note an app adds to a page from outside an agent run, e.g. a comment synced from a docs site.
 * @experimental
 */
export interface KnowledgeAddNoteInput {
  /** Scope address and key path of the page, as in {@link KnowledgeUpsertPageInput}. */
  scope: string;
  path: string;
  /** At most 250 tokens. `[[scope#path]]` mentions link to that page; other `[[...]]` stay text. */
  text: string;
  /** When the note's fact happened or applies. */
  when?: Date;
  /** Scope addresses whose readers see the note. Default: the page's scope. */
  stamps?: string[];
  author?: string;
}

/** @experimental */
export interface KnowledgeUpdateNoteInput {
  /** The note's id, from `addNote`. */
  id: string;
  text: string;
  /** Left as they were when omitted. */
  when?: Date;
  stamps?: string[];
  author?: string;
}

/** @internal */
export interface KnowledgeHostWriter {
  runtime: KnowledgeScopeRuntime;
  getStorage(): Promise<KnowledgeStorage>;
  semantic?: KnowledgeSemanticIndex;
  warn(message: string): void;
}

/**
 * A concurrent writer can win the read-then-write race on one path; retry against its result. Each
 * lost race means another writer committed, so a handful of attempts covers parallel sync workers.
 */
const MAX_ATTEMPTS = 8;

function splitPath(path: string): string[] {
  const keys = path.split('/');
  if (!path || keys.some(key => !key)) throw new Error(`Knowledge page path "${path}" needs non-empty keys.`);
  return keys;
}

async function embed(host: KnowledgeHostWriter, work: (index: KnowledgeSemanticIndex) => Promise<void>) {
  if (!host.semantic) return;
  try {
    await work(host.semantic);
  } catch (error) {
    host.warn(`Knowledge semantic index update failed; run knowledge.reindex() to repair: ${String(error)}`);
  }
}

/** Creates or updates the page at `path` in `scopeId`; `overwrite: false` only fills a missing page. */
async function upsertAt(
  storage: KnowledgeStorage,
  scopeId: string,
  parentId: string,
  path: string[],
  fields: { name: string; description?: string; body?: string },
  provenance: KnowledgeProvenance,
  overwrite: boolean,
): Promise<KnowledgeUpsertPageResult> {
  for (let attempt = 1; ; attempt++) {
    const existing = await storage.getPageByPath({ scopeId, path, read: 'all' });
    try {
      if (!existing) {
        const page = await storage.createPage({ parentId, key: path[path.length - 1], ...fields, provenance });
        return { page, status: 'created' };
      }
      if (
        !overwrite ||
        (fields.name === existing.name &&
          (fields.description === undefined || fields.description === (existing.description ?? '')) &&
          (fields.body === undefined || fields.body === (existing.body ?? '')))
      ) {
        return { page: existing, status: 'unchanged' };
      }
      const page = await storage.updatePage({
        id: existing.id,
        expectedVersion: existing.version,
        ...fields,
        provenance,
      });
      return { page, status: 'updated' };
    } catch (error) {
      // By name: an adapter may load its own copy of core, where instanceof fails.
      const name = (error as Error | undefined)?.name;
      const raced = name === 'KnowledgePageKeyConflictError' || name === 'KnowledgeConflictError';
      if (!raced || attempt >= MAX_ATTEMPTS) throw error;
    }
  }
}

/** @internal */
export async function upsertKnowledgePage(
  host: KnowledgeHostWriter,
  input: KnowledgeUpsertPageInput,
): Promise<KnowledgeUpsertPageResult> {
  const keys = splitPath(input.path);
  const provenance: KnowledgeProvenance = { author: input.author ?? 'host' };
  // No principals: the host is trusted, and the scope is placed (belongsTo) by the first run that holds it.
  const scope = await host.runtime.materializeScope(input.scope, [], provenance);
  const storage = await host.getStorage();
  let parentId = scope.id;
  for (let depth = 1; depth < keys.length; depth++) {
    const path = keys.slice(0, depth);
    const parent = await upsertAt(storage, scope.id, parentId, path, { name: path.at(-1)! }, provenance, false);
    if (parent.status === 'created') await embed(host, index => index.indexPage(parent.page));
    parentId = parent.page.id;
  }
  const result = await upsertAt(
    storage,
    scope.id,
    parentId,
    keys,
    { name: input.name, description: input.description, body: input.body },
    provenance,
    true,
  );
  if (result.status !== 'unchanged') await embed(host, index => index.indexPage(result.page));
  return result;
}

/** @internal */
export async function removeKnowledgePage(
  host: KnowledgeHostWriter,
  input: KnowledgeRemovePageInput,
): Promise<KnowledgePage | null> {
  const keys = splitPath(input.path);
  await host.runtime.checkDeclarations();
  const storage = await host.getStorage();
  const [scope] = await storage.getScopesByAddress([input.scope]);
  if (!scope) return null;
  const page = await storage.getPageByPath({ scopeId: scope.id, path: keys, read: 'all' });
  if (!page) return null;
  const template = await host.runtime.templatePageRef(page);
  if (template) throw new Error(`"${template}" is declared in config; change the scope's pages to remove it.`);
  let deleted: KnowledgePage;
  try {
    deleted = await storage.deletePage({
      id: page.id,
      expectedVersion: page.version,
      deletedBy: input.author ?? 'host',
    });
  } catch (error) {
    if ((error as Error | undefined)?.name === 'KnowledgePageHasChildrenError') {
      throw new Error(`"${input.scope}#${input.path}" has child pages; remove them first.`);
    }
    throw error;
  }
  await embed(host, index => index.remove([`page:${page.id}`]));
  return deleted;
}

const MENTION = /\[\[([^[\]]+)\]\]/g;

/** Resolves `[[scope#path]]` mentions to page ids; anything else stays plain text. */
async function resolveMentions(storage: KnowledgeStorage, text: string): Promise<string[]> {
  const ids = new Set<string>();
  for (const [, raw] of text.matchAll(MENTION)) {
    const ref = raw!.trim();
    const hash = ref.indexOf('#');
    if (hash <= 0) continue;
    const [scope] = await storage.getScopesByAddress([ref.slice(0, hash)]);
    const keys = ref.slice(hash + 1).split('/');
    if (!scope || keys.some(key => !key)) continue;
    const page = await storage.getPageByPath({ scopeId: scope.id, path: keys, read: 'all' });
    if (page) ids.add(page.id);
  }
  return [...ids];
}

async function stampScopeIds(host: KnowledgeHostWriter, stamps: string[], provenance: KnowledgeProvenance) {
  const ids: string[] = [];
  for (const address of new Set(stamps)) ids.push((await host.runtime.materializeScope(address, [], provenance)).id);
  return ids;
}

/** @internal */
export async function addKnowledgeNote(
  host: KnowledgeHostWriter,
  input: KnowledgeAddNoteInput,
): Promise<KnowledgeNote> {
  const keys = splitPath(input.path);
  const provenance: KnowledgeProvenance = { author: input.author ?? 'host' };
  const storage = await host.getStorage();
  const [scope] = await storage.getScopesByAddress([input.scope]);
  const page = scope ? await storage.getPageByPath({ scopeId: scope.id, path: keys, read: 'all' }) : null;
  if (!scope || !page) throw new KnowledgeNotFoundError('page', `${input.scope}#${input.path}`);
  const note = await storage.addNote({
    pageId: page.id,
    text: input.text,
    when: input.when,
    stampScopeIds: input.stamps?.length ? await stampScopeIds(host, input.stamps, provenance) : [scope.id],
    mentions: await resolveMentions(storage, input.text),
    provenance,
  });
  await embed(host, index => index.indexNote(note));
  return note;
}

/** @internal */
export async function updateKnowledgeNote(
  host: KnowledgeHostWriter,
  input: KnowledgeUpdateNoteInput,
): Promise<KnowledgeNote> {
  assertKnowledgeNoteTextWithinBound(input.text);
  const provenance: KnowledgeProvenance = { author: input.author ?? 'host' };
  const storage = await host.getStorage();
  const old = await storage.getNote({ id: input.id, read: 'all' });
  if (!old) throw new KnowledgeNotFoundError('note', input.id);
  // Notes are immutable: add the new one first so a failed write never loses the old text.
  const note = await storage.addNote({
    pageId: old.pageId,
    text: input.text,
    when: input.when ?? old.when,
    stampScopeIds: input.stamps?.length ? await stampScopeIds(host, input.stamps, provenance) : old.stampScopeIds,
    mentions: await resolveMentions(storage, input.text),
    provenance,
  });
  try {
    await storage.removeNote({ id: old.id, deletedBy: provenance.author, provenance });
  } catch (error) {
    // Someone else removed or replaced the old note since the read: drop ours rather than leave a second copy.
    if ((error as Error | undefined)?.name === 'KnowledgeNotFoundError') {
      await storage.removeNote({ id: note.id, deletedBy: provenance.author, provenance });
    }
    throw error;
  }
  await embed(host, async index => {
    await index.remove([`note:${old.id}`]);
    await index.indexNote(note);
  });
  return note;
}

/** @internal */
export async function removeKnowledgeNote(
  host: KnowledgeHostWriter,
  input: { id: string; author?: string },
): Promise<KnowledgeNote | null> {
  const author = input.author ?? 'host';
  const storage = await host.getStorage();
  const note = await storage.getNote({ id: input.id, read: 'all' });
  if (!note) return null;
  let removed: KnowledgeNote;
  try {
    removed = await storage.removeNote({ id: note.id, deletedBy: author, provenance: { author } });
  } catch (error) {
    // Removed by someone else since the read.
    if ((error as Error | undefined)?.name === 'KnowledgeNotFoundError') return null;
    throw error;
  }
  await embed(host, index => index.remove([`note:${note.id}`]));
  return removed;
}
