import { KnowledgeConflictError, KnowledgeNotFoundError } from '../storage/domains/knowledge/base';
import type { KnowledgeStorage } from '../storage/domains/knowledge/base';
import { assertKnowledgeNoteTextWithinBound, knowledgePagePath } from '../storage/domains/knowledge/pages';
import type {
  KnowledgeNote,
  KnowledgePage,
  KnowledgeProvenance,
  MoveKnowledgePageInput,
} from '../storage/domains/knowledge/pages';
import { knowledgeSubtree, refreshKnowledgeLinksTo, syncKnowledgePageBodyLinks, updateKnowledgeLinks } from './links';
import { knowledgePageRefs } from './page-refs';
import type { KnowledgeScopeRuntime } from './scope-runtime';
import { knowledgeEmbedFailedWarning } from './semantic';
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
   * again updates that page. Keys can't contain `#` or `%`. A leading, trailing or doubled `/` is
   * dropped (`guides/` is `guides`). Missing pages along the path are created with their key as name.
   */
  path: string;
  name: string;
  /** At most 100 tokens. Left as it is when omitted. */
  description?: string;
  /** Left as it is when omitted. */
  body?: string;
  /** Recorded as the writer. Default `host`. */
  author?: string;
  /**
   * The page as the caller read it, by id and version. The call refuses unless `scope#path` holds
   * that page at that version when it looks the page up, then updates that page by id, guarded by its
   * version. If the page was edited, moved, removed, or replaced by a new page at the same path, it
   * throws `KnowledgeConflictError` and writes nothing: no page, scope or parent is created. A write
   * prepared from a stale read never replaces someone else's edit. The path is checked at lookup only:
   * a parent page moved between the lookup and the write carries the page with it, and the write
   * still lands on that same page.
   */
  expected?: { id: string; version: number };
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
  /**
   * The page as the caller read it, by id and version, as in {@link KnowledgeUpsertPageInput}. The
   * call refuses unless `scope#path` holds that page at that version, and deletes it guarded by that
   * version. If the page was edited, removed, or replaced by a new page at the same path, before or
   * after the lookup, it throws `KnowledgeConflictError` and deletes nothing.
   */
  expected?: { id: string; version: number };
}

/** @experimental */
export interface KnowledgeMovePageInput {
  /** Scope address and key path of the page to move, as in {@link KnowledgeUpsertPageInput}. */
  scope: string;
  path: string;
  /** Key path of the new parent in the destination scope. Left out or empty: the top of the scope. */
  parent?: string;
  /** Destination scope address. Default `scope`. Created on first write, like `upsertPage`. */
  toScope?: string;
  /** The page's version as you read it. Default: its current version. */
  expectedVersion?: number;
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
  const keys = knowledgePagePath(path);
  if (keys.length === 0) throw new Error(`Knowledge page path "${path}" needs at least one key.`);
  return keys;
}

/** Search re-reads every vector hit, so a vector left behind by a removed page or note never surfaces. */
const UNEMBED_FAILED =
  'Knowledge semantic index removal failed; the removed content may keep its vectors, but search skips content that no longer exists';

async function embed(
  host: KnowledgeHostWriter,
  work: (index: KnowledgeSemanticIndex) => Promise<unknown>,
  failure: string | (() => Promise<string>),
) {
  if (!host.semantic) return;
  try {
    await work(host.semantic);
  } catch (error) {
    host.warn(`${typeof failure === 'string' ? failure : await failure()}: ${String(error)}`);
  }
}

/** The embed-failure warning for `page`, naming its ref; only looked up when every try failed. */
function pageEmbedFailed(storage: KnowledgeStorage, page: KnowledgePage): () => Promise<string> {
  return async () => {
    const { refs } = await knowledgePageRefs(storage, 'all', [page]).catch(() => ({ refs: new Map<string, string>() }));
    return knowledgeEmbedFailedWarning(`page "${refs.get(page.id) ?? page.id}"`);
  };
}

function unchanged(fields: { name: string; description?: string; body?: string }, page: KnowledgePage): boolean {
  return (
    fields.name === page.name &&
    (fields.description === undefined || fields.description === (page.description ?? '')) &&
    (fields.body === undefined || fields.body === (page.body ?? ''))
  );
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
): Promise<KnowledgeUpsertPageResult & { renamed?: boolean }> {
  for (let attempt = 1; ; attempt++) {
    const existing = await storage.getPageByPath({ scopeId, path, read: 'all' });
    try {
      if (!existing) {
        const page = await storage.createPage({ parentId, key: path[path.length - 1], ...fields, provenance });
        return { page, status: 'created' };
      }
      if (!overwrite || unchanged(fields, existing)) {
        return { page: existing, status: 'unchanged' };
      }
      const page = await storage.updatePage({
        id: existing.id,
        expectedVersion: existing.version,
        ...fields,
        provenance,
      });
      return { page, status: 'updated', renamed: page.name !== existing.name };
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
  await host.runtime.resolve();
  const keys = splitPath(input.path);
  const provenance: KnowledgeProvenance = { author: input.author ?? 'host' };
  if (input.expected) return updateExpectedPage(host, input, keys, input.expected, provenance);
  // No principals: the host is trusted, and the scope is placed (belongsTo) by the first run that holds it.
  const scope = await host.runtime.materializeScope(input.scope, [], provenance);
  const storage = await host.getStorage();
  let parentId = scope.id;
  for (let depth = 1; depth < keys.length; depth++) {
    const path = keys.slice(0, depth);
    const parent = await upsertAt(storage, scope.id, parentId, path, { name: path.at(-1)! }, provenance, false);
    if (parent.status === 'created') {
      await embed(host, index => index.indexPage(parent.page), pageEmbedFailed(storage, parent.page));
      await updateKnowledgeLinks(host.warn, () => refreshKnowledgeLinksTo(storage, [parent.page]));
    }
    parentId = parent.page.id;
  }
  const { renamed, ...result } = await upsertAt(
    storage,
    scope.id,
    parentId,
    keys,
    { name: input.name, description: input.description, body: input.body },
    provenance,
    true,
  );
  await afterPageWrite(host, storage, result, renamed);
  return result;
}

/** Re-embeds a written page and syncs its links; nothing for an unchanged write. */
async function afterPageWrite(
  host: KnowledgeHostWriter,
  storage: KnowledgeStorage,
  result: KnowledgeUpsertPageResult,
  renamed: boolean | undefined,
) {
  if (result.status === 'unchanged') return;
  await embed(host, index => index.indexPage(result.page), pageEmbedFailed(storage, result.page));
  await updateKnowledgeLinks(host.warn, async () => {
    await syncKnowledgePageBodyLinks(storage, result.page);
    // An update keeps the page's id and path, so only a new name changes what links can reach it.
    if (result.status === 'created' || renamed) await refreshKnowledgeLinksTo(storage, [result.page]);
  });
}

/**
 * `upsertPage` with `expected`: updates only the page the caller read, at the version it read. Reads
 * only, so a missing scope or parent stays missing; the store's version check makes the write itself
 * atomic against any writer of this page that commits between this read and the update. The path
 * is only how the page is found: moving a parent page bumps neither the page's version nor any
 * field every store keeps, so a parent moved in between is followed, not refused.
 */
async function updateExpectedPage(
  host: KnowledgeHostWriter,
  input: KnowledgeUpsertPageInput,
  keys: string[],
  expected: { id: string; version: number },
  provenance: KnowledgeProvenance,
): Promise<KnowledgeUpsertPageResult> {
  await host.runtime.checkDeclarations();
  const storage = await host.getStorage();
  const [scope] = await storage.getScopesByAddress([input.scope]);
  if (scope) host.runtime.assertCurrentScope(scope);
  const page = scope ? await storage.getPageByPath({ scopeId: scope.id, path: keys, read: 'all' }) : null;
  if (page?.id !== expected.id || page.version !== expected.version) throw new KnowledgeConflictError(expected.id);
  const fields = { name: input.name, description: input.description, body: input.body };
  if (unchanged(fields, page)) return { page, status: 'unchanged' };
  let updated: KnowledgePage;
  try {
    updated = await storage.updatePage({ id: page.id, expectedVersion: expected.version, ...fields, provenance });
  } catch (error) {
    // Removed after the read: the stores report a page they can't find, which is a lost race here.
    if ((error as Error | undefined)?.name === 'KnowledgeNotFoundError') throw new KnowledgeConflictError(expected.id);
    throw error;
  }
  const result: KnowledgeUpsertPageResult = { page: updated, status: 'updated' };
  await afterPageWrite(host, storage, result, updated.name !== page.name);
  return result;
}

/** @internal */
export async function removeKnowledgePage(
  host: KnowledgeHostWriter,
  input: KnowledgeRemovePageInput,
): Promise<KnowledgePage | null> {
  await host.runtime.resolve();
  const keys = splitPath(input.path);
  await host.runtime.checkDeclarations();
  const storage = await host.getStorage();
  const [scope] = await storage.getScopesByAddress([input.scope]);
  const page = scope ? await storage.getPageByPath({ scopeId: scope.id, path: keys, read: 'all' }) : null;
  const expected = input.expected;
  if (expected && (page?.id !== expected.id || page.version !== expected.version)) {
    throw new KnowledgeConflictError(expected.id);
  }
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
    // Removed after the read: a lost race when the caller named the page it read.
    if (expected && (error as Error | undefined)?.name === 'KnowledgeNotFoundError') {
      throw new KnowledgeConflictError(expected.id);
    }
    if ((error as Error | undefined)?.name === 'KnowledgePageHasChildrenError') {
      throw new Error(`"${input.scope}#${input.path}" has child pages; remove them first.`);
    }
    throw error;
  }
  await embed(host, index => index.removePage(page.id), UNEMBED_FAILED);
  await updateKnowledgeLinks(host.warn, async () => {
    await syncKnowledgePageBodyLinks(storage, deleted);
    await refreshKnowledgeLinksTo(storage, [deleted]);
  });
  return deleted;
}

/**
 * Moves a page and its subtree under `parentId`, then re-resolves links: the subtree's
 * `scope#key/key` paths changed, so links by an old path stop resolving and new ones may. The page
 * keeps its id, notes, pins and vectors (the index holds ids only). Shared by the host and the
 * `knowledge_page` tool.
 * @internal
 */
export async function moveKnowledgePageAndRelink(
  storage: KnowledgeStorage,
  warn: ((message: string) => void) | undefined,
  input: MoveKnowledgePageInput,
): Promise<KnowledgePage> {
  const moved = await storage.movePage(input);
  await updateKnowledgeLinks(warn, async () => {
    // Every carried page may now sit in another scope, where its links by name resolve differently.
    for (const page of await knowledgeSubtree(storage, moved)) await syncKnowledgePageBodyLinks(storage, page);
    await refreshKnowledgeLinksTo(storage, [moved], { withDescendants: true });
  });
  return moved;
}

/** @internal */
export async function moveKnowledgePage(
  host: KnowledgeHostWriter,
  input: KnowledgeMovePageInput,
): Promise<KnowledgePage> {
  await host.runtime.resolve();
  const keys = splitPath(input.path);
  const ref = `${input.scope}#${keys.join('/')}`;
  await host.runtime.checkDeclarations();
  const storage = await host.getStorage();
  const [scope] = await storage.getScopesByAddress([input.scope]);
  const page = scope ? await storage.getPageByPath({ scopeId: scope.id, path: keys, read: 'all' }) : null;
  if (!scope || !page) throw new KnowledgeNotFoundError('page', ref);
  const template = await host.runtime.templatePageRef(page);
  if (template) throw new Error(`"${template}" is declared in config; change the scope's pages to move it.`);

  const provenance: KnowledgeProvenance = { author: input.author ?? 'host' };
  const toAddress = input.toScope ?? input.scope;
  const parentKeys = knowledgePagePath(input.parent ?? '');
  if (toAddress === input.scope && keys.every((key, i) => parentKeys[i] === key)) {
    throw new Error(`"${ref}" can't move under itself or its own subtree.`);
  }
  const destination =
    toAddress === input.scope ? scope : await host.runtime.materializeScope(toAddress, [], provenance);
  const parent = parentKeys.length
    ? await storage.getPageByPath({ scopeId: destination.id, path: parentKeys, read: 'all' })
    : destination;
  if (!parent) throw new KnowledgeNotFoundError('page', `${toAddress}#${parentKeys.join('/')}`);

  try {
    return await moveKnowledgePageAndRelink(storage, host.warn, {
      id: page.id,
      expectedVersion: input.expectedVersion ?? page.version,
      parentId: parent.id,
      provenance,
    });
  } catch (error) {
    if ((error as Error | undefined)?.name === 'KnowledgePageKeyConflictError') {
      const at = parentKeys.length ? `${toAddress}#${parentKeys.join('/')}` : toAddress;
      throw new Error(`"${at}" already has a page with key "${page.key}"; move or rename that one first.`);
    }
    throw error;
  }
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
    const keys = knowledgePagePath(ref.slice(hash + 1));
    if (!scope || keys.length === 0) continue;
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
  await host.runtime.resolve();
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
  await embed(host, index => index.indexNote(note), knowledgeEmbedFailedWarning(`note ${note.id}`));
  return note;
}

/** @internal */
export async function updateKnowledgeNote(
  host: KnowledgeHostWriter,
  input: KnowledgeUpdateNoteInput,
): Promise<KnowledgeNote> {
  await host.runtime.resolve();
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
  await embed(
    host,
    async index => {
      await index.remove([`note:${old.id}`]);
      await index.indexNote(note);
    },
    knowledgeEmbedFailedWarning(`note ${note.id}`),
  );
  return note;
}

/** @internal */
export async function removeKnowledgeNote(
  host: KnowledgeHostWriter,
  input: { id: string; author?: string },
): Promise<KnowledgeNote | null> {
  await host.runtime.resolve();
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
  await embed(host, index => index.remove([`note:${note.id}`]), UNEMBED_FAILED);
  return removed;
}
