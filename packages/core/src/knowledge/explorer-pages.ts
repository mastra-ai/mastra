import type {
  KnowledgeNote,
  KnowledgePage,
  KnowledgePageActivityEvent,
  KnowledgePageLinkCounts,
  KnowledgePageLinkEdge,
  KnowledgePageSearchHit,
  KnowledgePageStore,
  KnowledgePin,
  KnowledgeReadScope,
} from '../storage';
import {
  KnowledgeUnsupportedCapabilityError,
  knowledgeScopeReadable,
  MAX_KNOWLEDGE_PAGE_LIST_LIMIT,
  parseKnowledgePageRef,
} from '../storage';
import type { KnowledgeRole } from './declarations';

/**
 * Read-only views over the schema-4 page store for browsing UIs (Mastra Studio, Factory).
 *
 * Every reader takes the caller's `read` scope and passes it to each store call, so a page or note the
 * caller can't read behaves like a missing id. `'all'` is for host surfaces behind their own auth.
 * Scope pages are structure the store lists without a read filter; these readers only return the
 * scope pages `read` allows, and hoist readable scopes found below an unreadable one so a bound
 * viewer still reaches them. These functions never write.
 *
 * @experimental Knowledge APIs are experimental and may change without notice.
 */

/** Most scope pages one tree or ancestor walk looks at before it stops and reports truncation. */
export const MAX_KNOWLEDGE_EXPLORER_SCOPE_SCAN = 1_000;

function scopeVisible(page: KnowledgePage, read: KnowledgeReadScope): boolean {
  return page.isScope && knowledgeScopeReadable(page, read);
}

async function allChildScopes(
  store: KnowledgePageStore,
  parentId: string | null,
  budget: { remaining: number },
): Promise<{ scopes: KnowledgePage[]; truncated: boolean }> {
  const scopes: KnowledgePage[] = [];
  let cursor: string | undefined;
  do {
    if (budget.remaining <= 0) return { scopes, truncated: true };
    const limit = Math.min(MAX_KNOWLEDGE_PAGE_LIST_LIMIT, budget.remaining);
    const result = await store.listChildScopes({ parentId, cursor, limit });
    budget.remaining -= result.pages.length;
    scopes.push(...result.pages);
    cursor = result.nextCursor;
  } while (cursor);
  return { scopes, truncated: false };
}

/**
 * Child scopes of `parentId` that `read` allows. An unreadable child scope is not returned, but its
 * own readable descendant scopes are, in its place.
 */
async function visibleChildScopes(
  store: KnowledgePageStore,
  parentId: string | null,
  read: KnowledgeReadScope,
  budget: { remaining: number },
): Promise<{ scopes: KnowledgePage[]; truncated: boolean }> {
  const direct = await allChildScopes(store, parentId, budget);
  let truncated = direct.truncated;
  const scopes: KnowledgePage[] = [];
  for (const scope of direct.scopes) {
    if (scopeVisible(scope, read)) {
      scopes.push(scope);
      continue;
    }
    if (read === 'all') continue;
    const hoisted = await visibleChildScopes(store, scope.id, read, budget);
    scopes.push(...hoisted.scopes);
    truncated ||= hoisted.truncated;
  }
  return { scopes, truncated };
}

/** A page in one tree level, with how many readable children sit directly under it. */
export type KnowledgeTreePage = KnowledgePage & {
  /**
   * Readable child pages, plus readable child scopes for a scope. Left out when the store can't count
   * (an adapter older than `countChildPages`), so a UI can tell "none" from "unknown".
   */
  childCount?: number;
  /**
   * Set when the child-scope walk for this page hit {@link MAX_KNOWLEDGE_EXPLORER_SCOPE_SCAN}, so
   * `childCount` is a lower bound: show it as "at least" (e.g. `1000+`), not as the exact number.
   */
  childCountCapped?: true;
};

export interface KnowledgeTreeChildren {
  /** Readable child scopes (all of them, on the first page only), then readable child pages in order. */
  pages: KnowledgeTreePage[];
  /** Cursor for more child pages; child scopes are never paged. */
  nextCursor?: string;
  /** True when the scope walk hit {@link MAX_KNOWLEDGE_EXPLORER_SCOPE_SCAN}. */
  truncated: boolean;
}

/**
 * One level of the page tree. `parentId: null` lists the root scopes `read` reaches. Child scopes come
 * first (they're structure), then the parent's ordinary child pages, paged with `cursor`/`limit`.
 */
export async function listKnowledgeTreeChildren(
  store: KnowledgePageStore,
  input: { parentId: string | null; read: KnowledgeReadScope; cursor?: string; limit?: number },
): Promise<KnowledgeTreeChildren> {
  const { parentId, read, cursor, limit } = input;
  if (parentId !== null && !(await store.getPage({ id: parentId, read }))) {
    return { pages: [], truncated: false };
  }
  const scopes =
    cursor === undefined
      ? await visibleChildScopes(store, parentId, read, { remaining: MAX_KNOWLEDGE_EXPLORER_SCOPE_SCAN })
      : { scopes: [], truncated: false };
  if (parentId === null) {
    const counted = await withChildCounts(store, scopes.scopes, read);
    return { pages: counted.pages, truncated: scopes.truncated || counted.truncated };
  }
  const children = await store.listChildPages({ parentId, read, cursor, limit });
  const counted = await withChildCounts(store, [...scopes.scopes, ...children.pages], read);
  return {
    pages: counted.pages,
    ...(children.nextCursor ? { nextCursor: children.nextCursor } : {}),
    truncated: scopes.truncated || counted.truncated,
  };
}

/** Child counts for one level: one `countChildPages` call, plus a child-scope walk per scope page. */
async function withChildCounts(
  store: KnowledgePageStore,
  pages: KnowledgePage[],
  read: KnowledgeReadScope,
): Promise<{ pages: KnowledgeTreePage[]; truncated: boolean }> {
  if (pages.length === 0 || typeof store.countChildPages !== 'function') return { pages, truncated: false };
  let counts: Record<string, number>;
  try {
    counts = await store.countChildPages({ parentIds: pages.map(page => page.id), read });
  } catch (error) {
    if (error instanceof KnowledgeUnsupportedCapabilityError) return { pages, truncated: false };
    throw error;
  }
  const budget = { remaining: MAX_KNOWLEDGE_EXPLORER_SCOPE_SCAN };
  let truncated = false;
  const counted: KnowledgeTreePage[] = [];
  for (const page of pages) {
    let childCount = Object.hasOwn(counts, page.id) ? (counts[page.id] ?? 0) : 0;
    let capped = false;
    if (page.isScope) {
      const childScopes = await visibleChildScopes(store, page.id, read, budget);
      childCount += childScopes.scopes.length;
      capped = childScopes.truncated;
      truncated ||= capped;
    }
    counted.push(capped ? { ...page, childCount, childCountCapped: true } : { ...page, childCount });
  }
  return { pages: counted, truncated };
}

/**
 * Readable ancestors of a readable page, root first, so a UI can open the tree down to it. Unreadable
 * ancestors are skipped, matching how {@link listKnowledgeTreeChildren} hoists readable scopes.
 */
async function readableAncestors(
  store: KnowledgePageStore,
  page: KnowledgePage,
  read: KnowledgeReadScope,
): Promise<KnowledgePage[]> {
  const path: KnowledgePage[] = [];
  const seen = new Set([page.id]);
  let parentId = page.parentId;
  while (parentId && !seen.has(parentId) && seen.size <= MAX_KNOWLEDGE_EXPLORER_SCOPE_SCAN) {
    seen.add(parentId);
    // Structure lookup only: the page is returned only when `read` allows it.
    const parent = await store.getPage({ id: parentId, read: 'all' });
    if (!parent) break;
    const visible = parent.isScope ? scopeVisible(parent, read) : !!(await store.getPage({ id: parent.id, read }));
    if (visible) path.unshift(parent);
    parentId = parent.parentId;
  }
  return path;
}

export const DEFAULT_KNOWLEDGE_PAGE_NOTE_LIMIT = 50;

export interface KnowledgePageView {
  page: KnowledgePage;
  /** Readable ancestors, root first. */
  ancestors: KnowledgePage[];
  notes: KnowledgeNote[];
  notesNextCursor?: string;
  pin: KnowledgePin | null;
  /** Readable pages the notes mention or are stamped to, for names and links. Unreadable ids are left out. */
  related: KnowledgePage[];
  /** Readable notes on other pages that mention this page (first page). */
  mentionedBy: KnowledgeNote[];
}

/**
 * A page by id, or by the reference a tool result names it with: a scope address (`site:mastra`) or
 * `<scope>#<key>[/<key>…]`. Read-gated like the id lookup: an unreadable scope or page is not found.
 * Scope addresses and refs always hold a `:`, which page ids never do, so an id never takes the ref path.
 */
async function pageByIdOrRef(store: KnowledgePageStore, ref: string, read: KnowledgeReadScope) {
  const byId = await store.getPage({ id: ref, read });
  if (byId || !ref.includes(':')) return byId;
  const parsed = ref.includes('#') ? parseKnowledgePageRef(ref) : { scope: ref, path: [] };
  if (!parsed) return null;
  const [scope] = await store.getScopesByAddress([parsed.scope]);
  if (!scope || !knowledgeScopeReadable(scope, read)) return null;
  if (parsed.path.length === 0) return store.getPage({ id: scope.id, read });
  return store.getPageByPath({ scopeId: scope.id, path: parsed.path, read });
}

/** One page with its notes, pin and the pages they reference. Null when `read` can't see the page. */
export async function readKnowledgePage(
  store: KnowledgePageStore,
  input: { pageId: string; read: KnowledgeReadScope; noteCursor?: string; noteLimit?: number },
): Promise<KnowledgePageView | null> {
  const { read } = input;
  const page = await pageByIdOrRef(store, input.pageId, read);
  if (!page) return null;
  const pageId = page.id;
  const [notes, pins, mentionedBy, ancestors] = await Promise.all([
    store.listNotes({
      pageId,
      read,
      cursor: input.noteCursor,
      limit: input.noteLimit ?? DEFAULT_KNOWLEDGE_PAGE_NOTE_LIMIT,
    }),
    store.listPins({ audience: 'all', read, kind: 'page', pageIds: [pageId], limit: 1 }),
    store.listNotesMentioning({ pageId, read, limit: DEFAULT_KNOWLEDGE_PAGE_NOTE_LIMIT }),
    readableAncestors(store, page, read),
  ]);
  const known = new Set([page.id, ...ancestors.map(ancestor => ancestor.id)]);
  const wanted = new Set<string>();
  for (const note of [...notes.notes, ...mentionedBy.notes]) {
    for (const id of [...note.mentions, ...note.stampScopeIds, note.pageId]) if (!known.has(id)) wanted.add(id);
  }
  if (!known.has(page.scopeId)) wanted.add(page.scopeId);
  const readable = async (ids: Iterable<string>) =>
    (await Promise.all([...ids].map(id => store.getPage({ id, read })))).filter(
      (candidate): candidate is KnowledgePage => candidate !== null,
    );
  const related = await readable(wanted);
  // A note names a page by `scope#path`, so reading its ref takes the page's scope too.
  const scopes = new Set(related.map(candidate => candidate.scopeId).filter(id => !known.has(id) && !wanted.has(id)));
  related.push(...(await readable(scopes)));
  return {
    page,
    ancestors,
    notes: notes.notes,
    ...(notes.nextCursor ? { notesNextCursor: notes.nextCursor } : {}),
    pin: pins.pins[0] ?? null,
    related,
    mentionedBy: mentionedBy.notes.filter(note => note.pageId !== pageId),
  };
}

export interface KnowledgePageGraphLimits {
  /** Most pages walked from the root. */
  maxPages: number;
  /** Most notes read across the graph when collecting mentions; each page's notes are read in full until then. */
  maxNotes: number;
  /** Most mentioned pages outside the walk added as endpoints. */
  maxOutsidePages: number;
}

const NOTE_BATCH = 100;

export const DEFAULT_KNOWLEDGE_PAGE_GRAPH_LIMITS: KnowledgePageGraphLimits = {
  maxPages: 200,
  maxNotes: 5000,
  maxOutsidePages: 50,
};

export interface KnowledgePageGraphEdge {
  source: string;
  target: string;
  kind: 'parent' | 'mention';
  /** Mention edges: how many readable notes on `source` mention `target`. */
  count?: number;
}

export interface KnowledgePageGraph {
  /** Pages in the walk, then readable mentioned pages outside it. */
  pages: KnowledgePage[];
  /** Ids of `pages` that are outside the walk (mention endpoints only). */
  outsideIds: string[];
  edges: KnowledgePageGraphEdge[];
  /** Page ids that have pins. */
  pinnedIds: string[];
  /** True when a limit stopped the walk or the endpoint list. */
  truncated: boolean;
}

/** Runs a per-id count over `pages` in list-limit batches; null when the store can't count. */
async function countInBatches(
  pages: KnowledgePage[],
  count: (ids: string[]) => Promise<Record<string, number>>,
): Promise<Record<string, number> | null> {
  const counts: Record<string, number> = {};
  try {
    for (let start = 0; start < pages.length; start += MAX_KNOWLEDGE_PAGE_LIST_LIMIT) {
      Object.assign(
        counts,
        await count(pages.slice(start, start + MAX_KNOWLEDGE_PAGE_LIST_LIMIT).map(page => page.id)),
      );
    }
  } catch (error) {
    if (error instanceof KnowledgeUnsupportedCapabilityError) return null;
    throw error;
  }
  return counts;
}

/**
 * Children of every parent in one graph level, in the tree's order: readable child scopes of scope
 * parents (scope pages only sit under scopes), then child pages, listed only for parents the level's
 * one count says have some. `null` lists the root scopes.
 */
async function graphLevelChildren(
  store: KnowledgePageStore,
  level: Array<string | null>,
  read: KnowledgeReadScope,
  byId: Map<string, KnowledgePage>,
): Promise<{ byParent: KnowledgePage[][]; truncated: boolean }> {
  let truncated = false;
  const parents = level.flatMap(id => (id === null ? [] : [byId.get(id)!]));
  const pageCounts = await countInBatches(parents, ids => store.countChildPages({ parentIds: ids, read }));
  const byParent: KnowledgePage[][] = [];
  for (const parentId of level) {
    const parent = parentId === null ? null : byId.get(parentId)!;
    const children: KnowledgePage[] = [];
    if (!parent || parent.isScope) {
      const scopes = await visibleChildScopes(store, parentId, read, { remaining: MAX_KNOWLEDGE_EXPLORER_SCOPE_SCAN });
      truncated ||= scopes.truncated;
      children.push(...scopes.scopes);
    }
    if (parent && (!pageCounts || pageCounts[parent.id])) {
      let cursor: string | undefined;
      do {
        const result = await store.listChildPages({ parentId: parent.id, read, cursor });
        children.push(...result.pages);
        cursor = result.nextCursor;
      } while (cursor);
    }
    byParent.push(children);
  }
  return { byParent, truncated };
}

/**
 * A bounded graph: pages breadth-first under `rootId` (or every root scope `read` reaches), parent
 * edges between them, and mention edges from their readable notes. A hidden note never contributes
 * an edge, so the graph shows only links the caller could read.
 */
export async function readKnowledgePageGraph(
  store: KnowledgePageStore,
  input: { read: KnowledgeReadScope; rootId?: string | null; limits?: Partial<KnowledgePageGraphLimits> },
): Promise<KnowledgePageGraph | null> {
  const { read } = input;
  const limits = { ...DEFAULT_KNOWLEDGE_PAGE_GRAPH_LIMITS, ...input.limits };
  const rootId = input.rootId ?? null;
  const pages: KnowledgePage[] = [];
  const byId = new Map<string, KnowledgePage>();
  const add = (page: KnowledgePage) => {
    if (byId.has(page.id)) return;
    byId.set(page.id, page);
    pages.push(page);
  };
  let truncated = false;
  let queue: Array<string | null>;
  if (rootId === null) {
    queue = [null];
  } else {
    const root = await store.getPage({ id: rootId, read });
    if (!root) return null;
    add(root);
    queue = [root.id];
  }
  // Tree parent of each walked page as the tree shows it (hoisted scopes attach to their visible parent).
  // The walk goes a level at a time: one child-page count for the whole level, then a listing only for
  // the parents that have children, so a tree of mostly leaf pages costs a few calls per level.
  const treeParent = new Map<string, string>();
  walk: while (queue.length) {
    const level = queue;
    queue = [];
    const children = await graphLevelChildren(store, level, read, byId);
    truncated ||= children.truncated;
    for (const [i, parentId] of level.entries()) {
      for (const child of children.byParent[i]!) {
        if (byId.has(child.id)) continue;
        if (pages.length >= limits.maxPages) {
          truncated = true;
          break walk;
        }
        add(child);
        if (parentId !== null) treeParent.set(child.id, parentId);
        queue.push(child.id);
      }
    }
  }

  const edges: KnowledgePageGraphEdge[] = [];
  for (const [child, parent] of treeParent) edges.push({ source: parent, target: child, kind: 'parent' });

  const walked = [...pages];
  const noteCounts = await countInBatches(walked, ids => store.countNotes({ pageIds: ids, read }));
  const mentionCounts = new Map<string, Map<string, number>>();
  const outsideWanted = new Set<string>();
  let notesLeft = limits.maxNotes;
  notes: for (const page of walked) {
    if (noteCounts && !noteCounts[page.id]) continue;
    let cursor: string | undefined;
    do {
      if (notesLeft <= 0) {
        truncated = true;
        break notes;
      }
      const batch = await store.listNotes({ pageId: page.id, read, cursor, limit: Math.min(NOTE_BATCH, notesLeft) });
      notesLeft -= batch.notes.length;
      for (const note of batch.notes) {
        for (const target of new Set(note.mentions)) {
          if (target === page.id) continue;
          let counts = mentionCounts.get(page.id);
          if (!counts) mentionCounts.set(page.id, (counts = new Map()));
          counts.set(target, (counts.get(target) ?? 0) + 1);
          if (!byId.has(target)) outsideWanted.add(target);
        }
      }
      cursor = batch.nextCursor;
    } while (cursor);
  }

  const outsideIds: string[] = [];
  const wanted = [...outsideWanted];
  outside: for (let start = 0; start < wanted.length; start += MAX_KNOWLEDGE_PAGE_LIST_LIMIT) {
    const ids = wanted.slice(start, start + MAX_KNOWLEDGE_PAGE_LIST_LIMIT);
    const found = new Map((await store.getPages({ ids, read })).map(page => [page.id, page]));
    for (const id of ids) {
      const page = found.get(id);
      if (!page || page.deletedAt || page.mergedInto) continue;
      if (outsideIds.length >= limits.maxOutsidePages) {
        truncated = true;
        break outside;
      }
      add(page);
      outsideIds.push(page.id);
    }
  }

  for (const [source, counts] of mentionCounts) {
    for (const [target, count] of counts) {
      if (byId.has(target)) edges.push({ source, target, kind: 'mention', count });
    }
  }

  const pinnedIds: string[] = [];
  const ids = pages.map(page => page.id);
  for (let start = 0; start < ids.length; start += MAX_KNOWLEDGE_PAGE_LIST_LIMIT) {
    let cursor: string | undefined;
    do {
      const result = await store.listPins({
        audience: 'all',
        read,
        kind: 'page',
        pageIds: ids.slice(start, start + MAX_KNOWLEDGE_PAGE_LIST_LIMIT),
        cursor,
      });
      pinnedIds.push(...result.pins.map(pin => pin.pageId));
      cursor = result.nextCursor;
    } while (cursor);
  }

  return { pages, outsideIds, edges, pinnedIds, truncated };
}

export const DEFAULT_KNOWLEDGE_PAGE_SEARCH_LIMIT = 20;

/** Pages (name, synopsis, body) and notes matching `query` that `read` allows, optionally within scopes. */
export function searchKnowledgeExplorerPages(
  store: KnowledgePageStore,
  input: { query: string; read: KnowledgeReadScope; scopeIds?: string[]; limit?: number },
): Promise<KnowledgePageSearchHit[]> {
  return store.searchPages({ ...input, limit: input.limit ?? DEFAULT_KNOWLEDGE_PAGE_SEARCH_LIMIT });
}

export const DEFAULT_KNOWLEDGE_PAGE_ACTIVITY_LIMIT = 25;

/** Activity newest first, filtered by what `read` can see now. */
export function readKnowledgePageActivity(
  store: KnowledgePageStore,
  input: { read: KnowledgeReadScope; scopeId?: string; pageId?: string; cursor?: string; limit?: number },
): Promise<{ events: KnowledgePageActivityEvent[]; nextCursor?: string }> {
  return store.listPageActivity({ ...input, limit: input.limit ?? DEFAULT_KNOWLEDGE_PAGE_ACTIVITY_LIMIT });
}

/** An access grant drawn between scopes in a browsing graph. @experimental */
export interface KnowledgeGraphScopeGrant {
  /** The principal scope address, e.g. `role:acme:support`. */
  principal: string;
  /** Its scope page id, when it has one; absent for a declared principal nothing was written to yet. */
  principalId?: string;
  /** The granted scope's page id. */
  target: string;
  role: KnowledgeRole;
}

/**
 * The declared grants onto the scope pages in `pages`, for drawing who can reach what. `grantsFor` is
 * `knowledge.scopeGrants`. A principal is kept only when `read` can read its scope page; with `'all'`,
 * a declared principal with no scope page yet comes back without `principalId`.
 */
export async function readKnowledgeScopeGrants(
  store: KnowledgePageStore,
  input: {
    pages: readonly KnowledgePage[];
    read: KnowledgeReadScope;
    grantsFor: (scope: { address: string; parentAddress?: string | null }) => Array<{
      principal: string;
      role: KnowledgeRole;
    }>;
  },
): Promise<KnowledgeGraphScopeGrant[]> {
  const { pages, read } = input;
  const byId = new Map(pages.map(page => [page.id, page]));
  const wanted: Array<{ principal: string; target: string; role: KnowledgeRole }> = [];
  for (const page of pages) {
    if (!page.isScope || !page.address || page.deletedAt || page.mergedInto) continue;
    const parentAddress = page.parentId ? (byId.get(page.parentId)?.address ?? null) : null;
    for (const grant of input.grantsFor({ address: page.address, parentAddress })) {
      if (grant.principal !== page.address) wanted.push({ ...grant, target: page.id });
    }
  }
  if (!wanted.length) return [];

  const principals = [...new Set(wanted.map(grant => grant.principal))];
  const scopes = new Map<string, KnowledgePage>();
  for (let start = 0; start < principals.length; start += MAX_KNOWLEDGE_PAGE_LIST_LIMIT) {
    for (const scope of await store.getScopesByAddress(
      principals.slice(start, start + MAX_KNOWLEDGE_PAGE_LIST_LIMIT),
    )) {
      if (scope.address) scopes.set(scope.address, scope);
    }
  }
  const grants: KnowledgeGraphScopeGrant[] = [];
  for (const grant of wanted) {
    const scope = scopes.get(grant.principal);
    if (scope) {
      if (knowledgeScopeReadable(scope, read)) grants.push({ ...grant, principalId: scope.id });
    } else if (read === 'all') {
      grants.push(grant);
    }
  }
  return grants;
}

/** Most pages one {@link readKnowledgePageLinkCounts} call counts. */
export const MAX_KNOWLEDGE_LINK_COUNT_PAGES = 200;
/** Most links one {@link readKnowledgePageLinks} call returns. */
export const MAX_KNOWLEDGE_EXPLORER_PAGE_LINKS = 200;

/**
 * How many distinct other pages link to each page (`in`) and are linked from it (`out`), by body `[[ref]]`
 * or note mention, counted by the store over every page it holds rather than only the ones a UI has
 * loaded. Pages `read` can't reach count as zero, the same as pages that don't exist. Returns `null`
 * when the store has no link index.
 */
export async function readKnowledgePageLinkCounts(
  store: KnowledgePageStore,
  input: { pageIds: string[]; read: KnowledgeReadScope },
): Promise<Record<string, KnowledgePageLinkCounts> | null> {
  const pageIds = [...new Set(input.pageIds)].slice(0, MAX_KNOWLEDGE_LINK_COUNT_PAGES);
  if (pageIds.length === 0) return {};
  try {
    return await store.countPageLinks({ pageIds, read: input.read });
  } catch (error) {
    if (error instanceof KnowledgeUnsupportedCapabilityError) return null;
    throw error;
  }
}

/** One page's links, with the pages at their other ends so a UI can name and place them. */
export interface KnowledgePageLinks {
  edges: KnowledgePageLinkEdge[];
  /** The pages at the other end of `edges` that `read` can reach. */
  pages: KnowledgePage[];
  /** True when the page has more links than {@link MAX_KNOWLEDGE_EXPLORER_PAGE_LINKS}. */
  truncated: boolean;
}

/**
 * The links into and out of one readable page, by body `[[ref]]` or note mention. A page `read` can't
 * reach has none. Returns `null` when the store has no link index.
 */
export async function readKnowledgePageLinks(
  store: KnowledgePageStore,
  input: { pageId: string; read: KnowledgeReadScope; direction?: 'in' | 'out' | 'both' },
): Promise<KnowledgePageLinks | null> {
  if (!(await store.getPage({ id: input.pageId, read: input.read }))) return { edges: [], pages: [], truncated: false };
  let listed: KnowledgePageLinkEdge[];
  try {
    listed = await store.listPageLinks({
      pageIds: [input.pageId],
      read: input.read,
      direction: input.direction ?? 'both',
      limit: MAX_KNOWLEDGE_EXPLORER_PAGE_LINKS + 1,
    });
  } catch (error) {
    if (error instanceof KnowledgeUnsupportedCapabilityError) return null;
    throw error;
  }
  const truncated = listed.length > MAX_KNOWLEDGE_EXPLORER_PAGE_LINKS;
  const edges = listed.slice(0, MAX_KNOWLEDGE_EXPLORER_PAGE_LINKS);
  const others = [
    ...new Set(edges.flatMap(edge => [edge.fromPageId, edge.toPageId]).filter(id => id !== input.pageId)),
  ];
  const pages: KnowledgePage[] = [];
  for (let start = 0; start < others.length; start += MAX_KNOWLEDGE_PAGE_LIST_LIMIT) {
    pages.push(
      ...(await store.getPages({ ids: others.slice(start, start + MAX_KNOWLEDGE_PAGE_LIST_LIMIT), read: input.read })),
    );
  }
  return { edges, pages, truncated };
}
