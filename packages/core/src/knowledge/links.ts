import type { KnowledgePage, KnowledgePageBodyLink, KnowledgeStorage } from '../storage/domains/knowledge';
import {
  KnowledgeUnsupportedCapabilityError,
  knowledgeLinkRefKey,
  MAX_KNOWLEDGE_MOVE_PAGES,
  MAX_KNOWLEDGE_PAGE_BODY_LINKS,
  MAX_KNOWLEDGE_PAGE_LINK_REF_LENGTH,
  parseKnowledgePageRef,
} from '../storage/domains/knowledge';

const WIKILINK = /\[\[([^\]]+)\]\]/g;
// Code is shown as written, so a `[[ref]]` inside it is not a link (as the explorer renders it).
const FENCED_CODE = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\1[ \t]*$|(?![\s\S]))/gm;
const INLINE_CODE = /(`+)[\s\S]*?\1/g;
const LIST_PAGE = 100;

/** The `[[ref]]`s in a markdown body outside code, trimmed, with how many times each appears. */
export function knowledgeBodyLinkRefs(body: string | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  if (!body) return counts;
  const prose = body.replace(FENCED_CODE, '').replace(INLINE_CODE, '');
  for (const match of prose.matchAll(WIKILINK)) {
    const ref = match[1]!.trim();
    if (!ref) continue;
    if (!counts.has(ref) && counts.size >= MAX_KNOWLEDGE_PAGE_BODY_LINKS) continue;
    counts.set(ref, (counts.get(ref) ?? 0) + 1);
  }
  return counts;
}

/**
 * Resolves body `[[ref]]`s the way `run.page(ref)` does (id, `scope#key/key` path, scope address,
 * unique name), but over the whole store: the index must not depend on who wrote the body, and reads
 * gate every link by the reader's scopes. A name resolves to the one live page with that name in the
 * source page's home scope, else to the one in the whole store; an ambiguous name stays unresolved.
 * Ids and scope addresses are looked up in one batch per call, and answers are kept for the
 * resolver's life, so pages re-synced together share their lookups.
 */
class BodyLinkResolver {
  readonly #storage: KnowledgeStorage;
  readonly #answers = new Map<string, string | null>();
  /** Refs looked up in the store so far (answers reused from earlier calls don't count). */
  looked = 0;

  constructor(storage: KnowledgeStorage) {
    this.#storage = storage;
  }

  async resolve(refs: string[], homeScopeId: string): Promise<Map<string, string | null>> {
    const keyOf = (ref: string) => `${homeScopeId}\u0000${ref}`;
    const pending = [...new Set(refs)].filter(ref => !this.#answers.has(keyOf(ref)));
    this.looked += pending.length;
    const answer = (ref: string, id: string | null) => this.#answers.set(keyOf(ref), id);

    const remaining: string[] = [];
    if (pending.length) {
      const byId = new Set((await this.#storage.getPages({ ids: pending, read: 'all' })).map(page => page.id));
      for (const ref of pending) {
        if (byId.has(ref)) answer(ref, ref);
        else remaining.push(ref);
      }
    }

    const paths = new Map<string, ReturnType<typeof parseKnowledgePageRef>>();
    const addresses = new Set<string>();
    for (const ref of remaining) {
      if (ref.indexOf('#') > 0) {
        const parsed = parseKnowledgePageRef(ref);
        paths.set(ref, parsed);
        if (parsed) addresses.add(parsed.scope);
      } else {
        addresses.add(ref);
      }
    }
    const scopes = new Map<string, string>();
    if (addresses.size) {
      for (const scope of await this.#storage.getScopesByAddress([...addresses])) {
        if (!scope.deletedAt && scope.address) scopes.set(scope.address, scope.id);
      }
    }

    for (const ref of remaining) {
      if (paths.has(ref)) {
        const parsed = paths.get(ref);
        const scopeId = parsed && scopes.get(parsed.scope);
        const page = scopeId ? await this.#storage.getPageByPath({ scopeId, path: parsed.path, read: 'all' }) : null;
        answer(ref, page?.id ?? null);
        continue;
      }
      const scopeId = scopes.get(ref);
      if (scopeId) {
        answer(ref, scopeId);
        continue;
      }
      const inHome = await this.#storage.findPagesByName({ name: ref, read: 'all', scopeId: homeScopeId, limit: 2 });
      if (inHome.length) {
        answer(ref, inHome.length === 1 ? inHome[0]!.id : null);
        continue;
      }
      const anywhere = await this.#storage.findPagesByName({ name: ref, read: 'all', limit: 2 });
      answer(ref, anywhere.length === 1 ? anywhere[0]!.id : null);
    }

    return new Map(refs.map(ref => [ref, this.#answers.get(keyOf(ref)) ?? null]));
  }
}

/** Rewrites a page's body-link rows from its current body; a deleted page keeps none. */
export async function syncKnowledgePageBodyLinks(
  storage: KnowledgeStorage,
  page: KnowledgePage,
  resolver = new BodyLinkResolver(storage),
): Promise<void> {
  // Refs that share a match key (differ only in case or spacing) share one row, resolved as first written.
  const byKey = new Map<string, { ref: string; count: number }>();
  if (!page.deletedAt) {
    for (const [ref, count] of knowledgeBodyLinkRefs(page.body)) {
      const key = knowledgeLinkRefKey(ref);
      if (key.length > MAX_KNOWLEDGE_PAGE_LINK_REF_LENGTH) continue;
      const entry = byKey.get(key);
      if (entry) entry.count += count;
      else byKey.set(key, { ref, count });
    }
  }
  const entries = [...byKey];
  const resolved = await resolver.resolve(
    entries.map(([, { ref }]) => ref),
    page.scopeId,
  );
  const links: KnowledgePageBodyLink[] = entries.map(([key, { ref, count }]) => ({
    ref: key,
    toPageId: resolved.get(ref) ?? null,
    count,
  }));
  await storage.replacePageBodyLinks({ pageId: page.id, links });
}

/** The ref keys a page answers to now: its id, name, scope address and `scope#key/key` path. */
async function pageRefKeys(storage: KnowledgeStorage, page: KnowledgePage): Promise<string[]> {
  const keys = [knowledgeLinkRefKey(page.id), knowledgeLinkRefKey(page.name)];
  if (page.isScope) {
    if (page.address) keys.push(knowledgeLinkRefKey(page.address));
    return keys;
  }
  const path: string[] = [];
  let current: KnowledgePage | null = page;
  while (current && !current.isScope) {
    if (!current.key || !current.parentId) return keys;
    path.unshift(current.key);
    current = await storage.getPage({ id: current.parentId, read: 'all' });
  }
  if (current?.address) keys.push(knowledgeLinkRefKey(`${current.address}#${path.join('/')}`));
  return keys;
}

/** The page and its live ordinary descendants, at most {@link MAX_KNOWLEDGE_MOVE_PAGES} + 1. */
async function subtree(storage: KnowledgeStorage, root: KnowledgePage): Promise<KnowledgePage[]> {
  const pages = [root];
  for (let index = 0; index < pages.length && pages.length <= MAX_KNOWLEDGE_MOVE_PAGES; index++) {
    let cursor: string | undefined;
    do {
      const result = await storage.listChildPages({
        parentId: pages[index]!.id,
        read: 'all',
        cursor,
        limit: LIST_PAGE,
      });
      pages.push(...result.pages);
      cursor = result.nextCursor;
    } while (cursor);
  }
  return pages;
}

/**
 * Most linking pages one write re-resolves. Past it, or once a write has looked up
 * {@link MAX_KNOWLEDGE_PAGE_BODY_LINKS} refs, the rest keep their links as they were until they are
 * next written or `knowledge.reindexLinks()` runs; the write reports how many it left.
 */
export const MAX_KNOWLEDGE_LINK_REFRESH_SOURCES = 100;

/**
 * Re-resolves the pages whose body links one of `pages` or names a ref one of them answers to now,
 * after they were created, renamed, moved, merged or deleted, in page id order up to
 * {@link MAX_KNOWLEDGE_LINK_REFRESH_SOURCES}. With `withDescendants`, the pages' subtrees count too
 * (their paths changed with them). Throws after the update when it left linking pages out, so the
 * caller's {@link updateKnowledgeLinks} reports it.
 */
export async function refreshKnowledgeLinksTo(
  storage: KnowledgeStorage,
  pages: KnowledgePage[],
  options: { withDescendants?: boolean } = {},
): Promise<void> {
  const affected = options.withDescendants
    ? (await Promise.all(pages.map(page => subtree(storage, page)))).flat()
    : pages;
  const refs = new Set<string>();
  for (const page of affected) {
    if (page.deletedAt) continue;
    for (const key of await pageRefKeys(storage, page)) refs.add(key);
  }
  const sources = (
    await storage.listPageBodyLinkSources({
      refs: [...refs],
      toPageIds: affected.map(page => page.id),
    })
  ).sort();
  if (!sources.length) return;
  const batch = sources.slice(0, MAX_KNOWLEDGE_LINK_REFRESH_SOURCES);
  const live = new Map((await storage.getPages({ ids: batch, read: 'all' })).map(page => [page.id, page]));
  const resolver = new BodyLinkResolver(storage);
  let done = 0;
  for (const id of batch) {
    if (resolver.looked >= MAX_KNOWLEDGE_PAGE_BODY_LINKS) break;
    const source = live.get(id);
    // A source that is gone keeps no links.
    if (source) await syncKnowledgePageBodyLinks(storage, source, resolver);
    else await storage.replacePageBodyLinks({ pageId: id, links: [] });
    done++;
  }
  const left = sources.length - done;
  if (left > 0) {
    const names = pages.map(page => `"${page.name}"`).join(', ');
    throw new Error(`${left} more pages link to ${names}; their links were left as they were`);
  }
}

/**
 * Runs a link-index update after a write that already landed. A store without the link index skips
 * it silently; any other failure is reported, not thrown, since the write itself succeeded.
 */
export async function updateKnowledgeLinks(
  warn: ((message: string) => void) | undefined,
  work: () => Promise<void>,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    if (error instanceof KnowledgeUnsupportedCapabilityError) return;
    warn?.(`Knowledge link index update failed; run knowledge.reindexLinks() to repair: ${String(error)}`);
  }
}

/** Rebuilds every page's body links from its body. Returns how many pages were indexed. */
export async function reindexKnowledgeLinks(storage: KnowledgeStorage): Promise<number> {
  let count = 0;
  // listPages leaves scope pages out, so walk the scope tree for their bodies.
  const scopeParents: Array<string | null> = [null];
  while (scopeParents.length) {
    const parentId = scopeParents.pop()!;
    let cursor: string | undefined;
    do {
      const { pages, nextCursor } = await storage.listChildScopes({ parentId, cursor, limit: LIST_PAGE });
      for (const scope of pages) {
        await syncKnowledgePageBodyLinks(storage, scope);
        count++;
        scopeParents.push(scope.id);
      }
      cursor = nextCursor;
    } while (cursor);
  }
  let cursor: string | undefined;
  do {
    const { pages, nextCursor } = await storage.listPages({ read: 'all', cursor, limit: LIST_PAGE });
    for (const page of pages) {
      await syncKnowledgePageBodyLinks(storage, page);
      count++;
    }
    cursor = nextCursor;
  } while (cursor);
  return count;
}
