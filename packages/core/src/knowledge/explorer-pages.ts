import type {
  KnowledgeNote,
  KnowledgePage,
  KnowledgePageActivityEvent,
  KnowledgePageSearchHit,
  KnowledgePageStore,
  KnowledgePin,
  KnowledgeReadScope,
} from '../storage';
import { knowledgeScopeReadable, MAX_KNOWLEDGE_PAGE_LIST_LIMIT } from '../storage';
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

export interface KnowledgeTreeChildren {
  /** Readable child scopes (all of them, on the first page only), then readable child pages in order. */
  pages: KnowledgePage[];
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
  if (parentId === null) return { pages: scopes.scopes, truncated: scopes.truncated };
  const children = await store.listChildPages({ parentId, read, cursor, limit });
  return {
    pages: [...scopes.scopes, ...children.pages],
    ...(children.nextCursor ? { nextCursor: children.nextCursor } : {}),
    truncated: scopes.truncated,
  };
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

/** One page with its notes, pin and the pages they reference. Null when `read` can't see the page. */
export async function readKnowledgePage(
  store: KnowledgePageStore,
  input: { pageId: string; read: KnowledgeReadScope; noteCursor?: string; noteLimit?: number },
): Promise<KnowledgePageView | null> {
  const { pageId, read } = input;
  const page = await store.getPage({ id: pageId, read });
  if (!page) return null;
  const [notes, pins, mentionedBy, ancestors] = await Promise.all([
    store.listNotes({
      pageId,
      read,
      cursor: input.noteCursor,
      limit: input.noteLimit ?? DEFAULT_KNOWLEDGE_PAGE_NOTE_LIMIT,
    }),
    store.listPins({ audience: 'all', read, pageIds: [pageId], limit: 1 }),
    store.listNotesMentioning({ pageId, read, limit: DEFAULT_KNOWLEDGE_PAGE_NOTE_LIMIT }),
    readableAncestors(store, page, read),
  ]);
  const known = new Set([page.id, ...ancestors.map(ancestor => ancestor.id)]);
  const wanted = new Set<string>();
  for (const note of [...notes.notes, ...mentionedBy.notes]) {
    for (const id of [...note.mentions, ...note.stampScopeIds, note.pageId]) if (!known.has(id)) wanted.add(id);
  }
  if (!known.has(page.scopeId)) wanted.add(page.scopeId);
  const related = (await Promise.all([...wanted].map(id => store.getPage({ id, read })))).filter(
    (candidate): candidate is KnowledgePage => candidate !== null,
  );
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
  const treeParent = new Map<string, string>();
  walk: while (queue.length) {
    const parentId = queue.shift()!;
    let cursor: string | undefined;
    do {
      const level = await listKnowledgeTreeChildren(store, { parentId, read, cursor });
      truncated ||= level.truncated;
      for (const child of level.pages) {
        if (byId.has(child.id)) continue;
        if (pages.length >= limits.maxPages) {
          truncated = true;
          break walk;
        }
        add(child);
        if (parentId !== null) treeParent.set(child.id, parentId);
        queue.push(child.id);
      }
      cursor = level.nextCursor;
    } while (cursor);
  }

  const edges: KnowledgePageGraphEdge[] = [];
  for (const [child, parent] of treeParent) edges.push({ source: parent, target: child, kind: 'parent' });

  const walked = [...pages];
  const mentionCounts = new Map<string, Map<string, number>>();
  const outsideWanted = new Set<string>();
  let notesLeft = limits.maxNotes;
  notes: for (const page of walked) {
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
  for (const id of outsideWanted) {
    if (outsideIds.length >= limits.maxOutsidePages) {
      truncated = true;
      break;
    }
    const page = await store.getPage({ id, read });
    if (!page || page.deletedAt || page.mergedInto) continue;
    add(page);
    outsideIds.push(page.id);
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
