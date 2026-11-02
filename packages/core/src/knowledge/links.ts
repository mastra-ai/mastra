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
 * Resolves a body `[[ref]]` the way `run.page(ref)` does (id, `scope#key/key` path, scope address,
 * unique name), but over the whole store: the index must not depend on who wrote the body, and reads
 * gate every link by the reader's scopes. A name resolves to the one live page with that name in the
 * source page's home scope, else to the one in the whole store; an ambiguous name stays unresolved.
 */
async function resolveBodyLinkRef(storage: KnowledgeStorage, ref: string, homeScopeId: string) {
  const byId = await storage.getPage({ id: ref, read: 'all' });
  if (byId && !byId.deletedAt) return byId.id;

  if (ref.indexOf('#') > 0) {
    const parsed = parseKnowledgePageRef(ref);
    if (!parsed) return null;
    const [scope] = await storage.getScopesByAddress([parsed.scope]);
    if (!scope || scope.deletedAt) return null;
    const page = await storage.getPageByPath({ scopeId: scope.id, path: parsed.path, read: 'all' });
    return page?.id ?? null;
  }

  const [scope] = await storage.getScopesByAddress([ref]);
  if (scope && !scope.deletedAt) return scope.id;

  const inHome = await storage.findPagesByName({ name: ref, read: 'all', scopeId: homeScopeId, limit: 2 });
  if (inHome.length === 1) return inHome[0]!.id;
  if (inHome.length > 1) return null;
  const anywhere = await storage.findPagesByName({ name: ref, read: 'all', limit: 2 });
  return anywhere.length === 1 ? anywhere[0]!.id : null;
}

/** Rewrites a page's body-link rows from its current body; a deleted page keeps none. */
export async function syncKnowledgePageBodyLinks(storage: KnowledgeStorage, page: KnowledgePage): Promise<void> {
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
  const links: KnowledgePageBodyLink[] = [];
  for (const [key, { ref, count }] of byKey) {
    links.push({ ref: key, toPageId: await resolveBodyLinkRef(storage, ref, page.scopeId), count });
  }
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
 * Re-resolves every page whose body links one of `pages` or names a ref one of them answers to now,
 * after they were created, renamed, moved, merged or deleted. With `withDescendants`, the pages'
 * subtrees count too (their paths changed with them).
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
  const sources = await storage.listPageBodyLinkSources({
    refs: [...refs],
    toPageIds: affected.map(page => page.id),
  });
  for (const id of sources) {
    const source = await storage.getPage({ id, read: 'all' });
    if (source) await syncKnowledgePageBodyLinks(storage, source);
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
