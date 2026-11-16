import {
  KNOWLEDGE_SEARCH_WEIGHTS,
  knowledgePageKeyProblem,
  knowledgeSearchWords,
} from '@internal/core/knowledge-compat';
import { KnowledgeConflictError, KnowledgeNotFoundError } from './base';
import {
  assertKnowledgeNoteTextWithinBound,
  assertKnowledgePageDescriptionWithinBound,
  canonicalKnowledgeName,
  KnowledgeMoveTooLargeError,
  KnowledgePageDepthError,
  KnowledgePageHasChildrenError,
  KnowledgePageKeyConflictError,
  knowledgePinDepth,
  knowledgePositionBetween,
  knowledgeScopeReadable,
  MAX_KNOWLEDGE_MOVE_PAGES,
  MAX_KNOWLEDGE_PAGE_DEPTH,
  MAX_KNOWLEDGE_PAGE_LINKS,
  MAX_KNOWLEDGE_PAGE_LIST_LIMIT,
} from './pages';
import type {
  KnowledgeNote,
  KnowledgePage,
  KnowledgePageActivityAction,
  KnowledgePageActivityEvent,
  KnowledgePageBodyLink,
  KnowledgePageLinkCounts,
  KnowledgePageLinkEdge,
  KnowledgePageLinkKind,
  KnowledgePageSearchHit,
  KnowledgePageStore,
  KnowledgePin,
  KnowledgePinKind,
  KnowledgeProvenance,
  KnowledgeReadScope,
} from './pages';

type Store = KnowledgePageStore;
type Subtree = Array<{ page: KnowledgePage; relativeDepth: number }>;

const DEFAULT_SEARCH_LIMIT = 20;

function pageSize(limit: number | undefined): number {
  if (limit === undefined) return MAX_KNOWLEDGE_PAGE_LIST_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError(`Knowledge list limit must be a positive integer`);
  return Math.min(limit, MAX_KNOWLEDGE_PAGE_LIST_LIMIT);
}

function paginate<T>(items: T[], cursor: string | undefined, limit: number | undefined) {
  const start = cursor === undefined ? 0 : Number(cursor);
  if (!Number.isInteger(start) || start < 0) throw new RangeError(`Invalid Knowledge cursor: ${cursor}`);
  const size = pageSize(limit);
  const slice = items.slice(start, start + size);
  return { items: slice, nextCursor: start + size < items.length ? String(start + size) : undefined };
}

const compareCodeUnits = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const byPosition = (a: KnowledgePage, b: KnowledgePage) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const byName = (a: KnowledgePage, b: KnowledgePage) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const newestFirst = <T extends { createdAt: Date; id: string }>(a: T, b: T) =>
  b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
const oldestFirst = <T extends { createdAt: Date; id: string }>(a: T, b: T) => newestFirst(b, a);

const clone = <T>(value: T): T => structuredClone(value);

const PIN_KINDS: KnowledgePinKind[] = ['page', 'list'];
const pinKey = (pageId: string, kind: KnowledgePinKind) => `${kind}:${pageId}`;

/**
 * In-memory schema-4 page store: the reference implementation of {@link KnowledgePageStore} that the
 * shared contract suite checks every adapter against.
 *
 * @experimental
 */
export class InMemoryKnowledgePageStore implements KnowledgePageStore {
  #pages = new Map<string, KnowledgePage>();
  #notes = new Map<string, KnowledgeNote>();
  #pins = new Map<string, KnowledgePin>();
  #activity: KnowledgePageActivityEvent[] = [];
  #bodyLinks = new Map<string, KnowledgePageBodyLink[]>();
  #clock = 0;

  /** Drops every page, note, pin, body link and event. */
  clear(): void {
    this.#pages.clear();
    this.#notes.clear();
    this.#pins.clear();
    this.#bodyLinks.clear();
    this.#activity = [];
  }

  /** Strictly increasing timestamps keep newest-first orderings deterministic within one millisecond. */
  #now(): Date {
    this.#clock = Math.max(Date.now(), this.#clock + 1);
    return new Date(this.#clock);
  }

  #log(
    action: KnowledgePageActivityAction,
    page: KnowledgePage,
    provenance: KnowledgeProvenance,
    noteId?: string,
  ): void {
    this.#activity.push({
      id: crypto.randomUUID(),
      action,
      scopeId: page.scopeId,
      pageId: page.id,
      ...(noteId ? { noteId } : {}),
      provenance: clone(provenance),
      createdAt: this.#now(),
    });
  }

  #page(id: string): KnowledgePage {
    const page = this.#pages.get(id);
    if (!page) throw new KnowledgeNotFoundError('page', id);
    return page;
  }

  #livePage(id: string): KnowledgePage {
    const page = this.#page(id);
    if (page.deletedAt) throw new KnowledgeNotFoundError('page', id);
    return page;
  }

  #scopeReadable(scopeId: string, read: KnowledgeReadScope): boolean {
    if (read === 'all') return true;
    const scope = this.#pages.get(scopeId);
    return !!scope && knowledgeScopeReadable(scope, read);
  }

  #pageReadable(page: KnowledgePage, read: KnowledgeReadScope): boolean {
    return this.#scopeReadable(page.scopeId, read);
  }

  /** Visibility ignoring the note's own deleted state (activity keeps removed notes' history). */
  #noteVisible(note: KnowledgeNote, read: KnowledgeReadScope): boolean {
    const page = this.#pages.get(note.pageId);
    if (!page || !this.#pageReadable(page, read)) return false;
    if (!note.stampScopeIds.some(scopeId => this.#scopeReadable(scopeId, read))) return false;
    return note.mentions.every(pageId => {
      const mentioned = this.#pages.get(pageId);
      return !!mentioned && this.#pageReadable(mentioned, read);
    });
  }

  #children(parentId: string | null): KnowledgePage[] {
    return [...this.#pages.values()].filter(page => page.parentId === parentId && !page.deletedAt);
  }

  #nextPosition(parentId: string | null): string {
    const last = this.#children(parentId).sort(byPosition).at(-1);
    return knowledgePositionBetween(last?.position);
  }

  /** Levels below the home scope: a scope page is 0, a page directly under its scope is 1. */
  #depth(page: KnowledgePage): number {
    let depth = 0;
    let current = page;
    while (!current.isScope) {
      depth++;
      current = this.#page(current.parentId!);
    }
    return depth;
  }

  /**
   * The page and every page under it, with each one's depth relative to it. Soft-deleted pages are
   * included (they move with their parent) but flagged, since size and depth count live pages only.
   */
  #subtree(root: KnowledgePage): Subtree {
    const out: Subtree = [];
    const visit = (page: KnowledgePage, relativeDepth: number) => {
      out.push({ page, relativeDepth });
      for (const child of this.#pages.values()) if (child.parentId === page.id) visit(child, relativeDepth + 1);
    };
    visit(root, 0);
    return out;
  }

  #checkVersion(id: string, actual: number, expected: number): void {
    if (actual !== expected) throw new KnowledgeConflictError(id);
  }

  #newPage(fields: {
    id?: string;
    scopeId?: string;
    parentId: string | null;
    isScope: boolean;
    address?: string;
    declaration?: string;
    key?: string;
    position?: string;
    name: string;
    description?: string;
    body?: string;
    provenance: KnowledgeProvenance;
  }): KnowledgePage {
    if (!fields.name.trim()) throw new Error('Knowledge page name must not be empty');
    assertKnowledgePageDescriptionWithinBound(fields.description || undefined);
    const id = fields.id ?? crypto.randomUUID();
    if (this.#pages.has(id)) throw new KnowledgeConflictError(id);
    const now = this.#now();
    const page: KnowledgePage = {
      id,
      scopeId: fields.isScope ? id : fields.scopeId!,
      parentId: fields.parentId,
      isScope: fields.isScope,
      ...(fields.address !== undefined ? { address: fields.address } : {}),
      ...(fields.declaration !== undefined ? { declaration: fields.declaration } : {}),
      ...(fields.key !== undefined ? { key: fields.key } : {}),
      position: fields.position ?? this.#nextPosition(fields.parentId),
      name: fields.name,
      ...(fields.description ? { description: fields.description } : {}),
      ...(fields.body !== undefined ? { body: fields.body } : {}),
      version: 1,
      createdBy: clone(fields.provenance),
      updatedBy: clone(fields.provenance),
      createdAt: now,
      updatedAt: now,
    };
    this.#pages.set(id, page);
    return page;
  }

  #scopeByAddress(address: string): KnowledgePage | undefined {
    for (const page of this.#pages.values()) if (page.isScope && page.address === address) return page;
    return undefined;
  }

  #childByKey(parentId: string, key: string, except?: string): KnowledgePage | undefined {
    for (const page of this.#pages.values()) {
      if (page.parentId === parentId && !page.isScope && page.key === key && !page.deletedAt && page.id !== except) {
        return page;
      }
    }
    return undefined;
  }

  #materializeTemplates(
    scopeId: string,
    parentId: string,
    templates: NonNullable<Parameters<Store['materializeScope']>[0]['pages']>,
    provenance: KnowledgeProvenance,
  ): void {
    for (const template of templates) {
      const problem = knowledgePageKeyProblem(template.key);
      if (problem) throw new Error(problem);
      let page = this.#childByKey(parentId, template.key);
      if (!page) {
        page = this.#newPage({
          scopeId,
          parentId,
          isScope: false,
          key: template.key,
          name: template.name,
          description: template.description,
          provenance,
        });
        this.#log('page-created', page, provenance);
      }
      if (template.pages?.length) this.#materializeTemplates(scopeId, page.id, template.pages, provenance);
    }
  }

  // Scopes

  async materializeScope(input: Parameters<Store['materializeScope']>[0]) {
    let scope = this.#scopeByAddress(input.address);
    const created = !scope;
    let parentConflict: { existingParentId: string | null; requestedParentId: string | null } | undefined;
    if (scope) {
      if (scope.parentId === null && input.parentId != null) {
        if (!this.#page(input.parentId).isScope) {
          throw new Error(`Knowledge scope ${input.address} must be placed under a scope page`);
        }
        if (input.parentId === scope.id || this.#subtree(scope).some(entry => entry.page.id === input.parentId)) {
          throw new Error(`Knowledge scope placement must not form a cycle`);
        }
        scope.parentId = input.parentId;
        scope.position = this.#nextPosition(input.parentId);
        scope.version++;
        scope.updatedAt = this.#now();
        scope.updatedBy = clone(input.provenance);
      } else if (input.parentId != null && input.parentId !== scope.parentId) {
        parentConflict = { existingParentId: scope.parentId, requestedParentId: input.parentId };
      }
    } else {
      const parentId = input.parentId ?? null;
      if (parentId !== null && !this.#page(parentId).isScope) {
        throw new Error(`Knowledge scope ${input.address} must be placed under a scope page`);
      }
      scope = this.#newPage({
        parentId,
        isScope: true,
        address: input.address,
        declaration: input.declaration,
        name: input.name,
        description: input.description,
        provenance: input.provenance,
      });
      this.#log('scope-created', scope, input.provenance);
    }
    for (const child of input.children ?? []) {
      if (this.#scopeByAddress(child.address)) continue;
      const page = this.#newPage({
        parentId: scope.id,
        isScope: true,
        address: child.address,
        declaration: child.declaration,
        name: child.name,
        description: child.description,
        provenance: input.provenance,
      });
      this.#log('scope-created', page, input.provenance);
    }
    this.#materializeTemplates(scope.id, scope.id, input.pages ?? [], input.provenance);
    return { scope: clone(scope), created, ...(parentConflict ? { parentConflict } : {}) };
  }

  async getScopesByAddress(addresses: string[]) {
    const wanted = new Set(addresses);
    return [...this.#pages.values()]
      .filter(page => page.isScope && wanted.has(page.address!))
      .sort(byPosition)
      .map(clone);
  }

  async listScopeDeclarations() {
    const counts = new Map<string, number>();
    for (const page of this.#pages.values()) {
      if (page.isScope && page.declaration) counts.set(page.declaration, (counts.get(page.declaration) ?? 0) + 1);
    }
    return [...counts]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([declaration, scopes]) => ({ declaration, scopes }));
  }

  async renameScopeDeclaration(input: Parameters<Store['renameScopeDeclaration']>[0]) {
    const renamed = [...this.#pages.values()]
      .filter(
        page =>
          page.isScope &&
          page.declaration &&
          (page.declaration === input.from || page.declaration.startsWith(`${input.from}/`)),
      )
      .map(page => ({
        page,
        rename: {
          address: page.address!,
          from: page.declaration!,
          to: input.to + page.declaration!.slice(input.from.length),
        },
      }));
    input.check(renamed.map(({ rename }) => rename));
    for (const { page, rename } of renamed) page.declaration = rename.to;
    return renamed.length;
  }

  async listChildScopes(input: Parameters<Store['listChildScopes']>[0]) {
    const scopes = [...this.#pages.values()]
      .filter(
        page =>
          page.isScope && page.parentId === input.parentId && (!input.read || this.#pageReadable(page, input.read)),
      )
      .sort(byPosition);
    const { items, nextCursor } = paginate(scopes, input.cursor, input.limit);
    return { pages: items.map(clone), ...(nextCursor ? { nextCursor } : {}) };
  }

  // Pages

  async getPage(input: Parameters<Store['getPage']>[0]) {
    const page = this.#pages.get(input.id);
    return page && this.#pageReadable(page, input.read) ? clone(page) : null;
  }

  async getPages(input: Parameters<Store['getPages']>[0]) {
    return [...new Set(input.ids)]
      .map(id => this.#pages.get(id))
      .filter((page): page is KnowledgePage => !!page && !page.deletedAt && this.#pageReadable(page, input.read))
      .map(clone);
  }

  async getPageByPath(input: Parameters<Store['getPageByPath']>[0]) {
    let page: KnowledgePage | undefined;
    let parentId = input.scopeId;
    for (const key of input.path) {
      page = this.#childByKey(parentId, key);
      if (!page || !this.#pageReadable(page, input.read)) return null;
      parentId = page.id;
    }
    return page && this.#pageReadable(page, input.read) ? clone(page) : null;
  }

  async findPagesByName(input: Parameters<Store['findPagesByName']>[0]) {
    const name = canonicalKnowledgeName(input.name);
    return [...this.#pages.values()]
      .filter(
        page =>
          !page.deletedAt &&
          canonicalKnowledgeName(page.name) === name &&
          (input.scopeId === undefined || page.scopeId === input.scopeId) &&
          this.#pageReadable(page, input.read),
      )
      .sort(newestFirst)
      .slice(0, pageSize(input.limit))
      .map(clone);
  }

  async listChildPages(input: Parameters<Store['listChildPages']>[0]) {
    const pages = this.#children(input.parentId)
      .filter(page => !page.isScope && this.#pageReadable(page, input.read))
      .sort(byPosition);
    const { items, nextCursor } = paginate(pages, input.cursor, input.limit);
    return { pages: items.map(clone), ...(nextCursor ? { nextCursor } : {}) };
  }

  async countChildScopes(input: Parameters<Store['countChildScopes']>[0]) {
    const counts = new Map(input.parentIds.map(id => [id, 0]));
    for (const page of this.#pages.values()) {
      if (!page.isScope || page.parentId === null || !counts.has(page.parentId)) continue;
      if (!this.#pageReadable(page, input.read)) continue;
      counts.set(page.parentId, counts.get(page.parentId)! + 1);
    }
    return Object.fromEntries(counts);
  }

  async countChildPages(input: Parameters<Store['countChildPages']>[0]) {
    const counts: Record<string, number> = Object.fromEntries(input.parentIds.map(id => [id, 0]));
    for (const page of this.#pages.values()) {
      if (page.parentId === null || !(page.parentId in counts)) continue;
      if (page.isScope || page.deletedAt || !this.#pageReadable(page, input.read)) continue;
      counts[page.parentId]! += 1;
    }
    return counts;
  }

  async replacePageBodyLinks(input: Parameters<Store['replacePageBodyLinks']>[0]) {
    if (input.links.length === 0) this.#bodyLinks.delete(input.pageId);
    else
      this.#bodyLinks.set(
        input.pageId,
        input.links.map(link => ({ ...link })),
      );
  }

  async listPageBodyLinkSources(input: Parameters<Store['listPageBodyLinkSources']>[0]) {
    const refs = new Set(input.refs ?? []);
    const targets = new Set(input.toPageIds ?? []);
    const sources: string[] = [];
    for (const [pageId, links] of this.#bodyLinks) {
      const matches = links.some(link => (link.toPageId === null ? refs.has(link.ref) : targets.has(link.toPageId)));
      if (matches) sources.push(pageId);
    }
    return sources;
  }

  /** Every resolved link both of whose ends are live and readable, and not a self-link. */
  #visibleLinks(read: KnowledgeReadScope, kinds: KnowledgePageLinkKind[] | undefined): KnowledgePageLinkEdge[] {
    const wanted = new Set(kinds ?? ['body', 'note']);
    const live = (id: string) => {
      const page = this.#pages.get(id);
      return !!page && !page.deletedAt && this.#pageReadable(page, read);
    };
    const edges = new Map<string, KnowledgePageLinkEdge>();
    const add = (fromPageId: string, toPageId: string, kind: KnowledgePageLinkKind, count: number) => {
      if (fromPageId === toPageId || !live(fromPageId) || !live(toPageId)) return;
      const key = `${fromPageId}\u0000${toPageId}\u0000${kind}`;
      const edge = edges.get(key);
      if (edge) edge.count += count;
      else edges.set(key, { fromPageId, toPageId, kind, count });
    };
    if (wanted.has('body')) {
      for (const [pageId, links] of this.#bodyLinks) {
        for (const link of links) if (link.toPageId !== null) add(pageId, link.toPageId, 'body', link.count);
      }
    }
    if (wanted.has('note')) {
      for (const note of this.#notes.values()) {
        if (note.deletedAt || !this.#noteVisible(note, read)) continue;
        for (const pageId of new Set(note.mentions)) add(note.pageId, pageId, 'note', 1);
      }
    }
    return [...edges.values()];
  }

  async countPageLinks(input: Parameters<Store['countPageLinks']>[0]) {
    const linked = new Map<string, { in: Set<string>; out: Set<string> }>(
      input.pageIds.map(id => [id, { in: new Set<string>(), out: new Set<string>() }]),
    );
    for (const edge of this.#visibleLinks(input.read, input.kinds)) {
      linked.get(edge.fromPageId)?.out.add(edge.toPageId);
      linked.get(edge.toPageId)?.in.add(edge.fromPageId);
    }
    return Object.fromEntries(
      [...linked].map(([id, sets]) => [id, { in: sets.in.size, out: sets.out.size }]),
    ) as Record<string, KnowledgePageLinkCounts>;
  }

  async listPageLinks(input: Parameters<Store['listPageLinks']>[0]) {
    const ids = new Set(input.pageIds);
    const direction = input.direction ?? 'both';
    const limit = input.limit ?? 1_000;
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Knowledge link limit must be a positive integer');
    const kindOrder = (kind: KnowledgePageLinkKind) => (kind === 'body' ? 0 : 1);
    return this.#visibleLinks(input.read, input.kinds)
      .filter(
        edge => (direction !== 'in' && ids.has(edge.fromPageId)) || (direction !== 'out' && ids.has(edge.toPageId)),
      )
      .sort(
        (a, b) =>
          compareCodeUnits(a.fromPageId, b.fromPageId) ||
          compareCodeUnits(a.toPageId, b.toPageId) ||
          kindOrder(a.kind) - kindOrder(b.kind),
      )
      .slice(0, Math.min(limit, MAX_KNOWLEDGE_PAGE_LINKS));
  }

  async listPages(input: Parameters<Store['listPages']>[0]) {
    const prefix = input.namePrefix === undefined ? undefined : canonicalKnowledgeName(input.namePrefix);
    const pages = [...this.#pages.values()]
      .filter(
        page =>
          !page.isScope &&
          !page.deletedAt &&
          (input.scopeId === undefined || page.scopeId === input.scopeId) &&
          (prefix === undefined || canonicalKnowledgeName(page.name).startsWith(prefix)) &&
          this.#pageReadable(page, input.read),
      )
      .sort(byName);
    const { items, nextCursor } = paginate(pages, input.cursor, input.limit);
    return { pages: items.map(clone), ...(nextCursor ? { nextCursor } : {}) };
  }

  async createPage(input: Parameters<Store['createPage']>[0]) {
    const parent = this.#livePage(input.parentId);
    const scopeId = parent.isScope ? parent.id : parent.scopeId;
    const id = input.id ?? crypto.randomUUID();
    if (this.#depth(parent) + 1 > MAX_KNOWLEDGE_PAGE_DEPTH) throw new KnowledgePageDepthError(id);
    if (input.key !== undefined) {
      const problem = knowledgePageKeyProblem(input.key);
      if (problem) throw new Error(problem);
      if (this.#childByKey(parent.id, input.key)) throw new KnowledgePageKeyConflictError(input.key, parent.id);
    }
    const page = this.#newPage({ ...input, id, scopeId, isScope: false });
    this.#log('page-created', page, input.provenance);
    return clone(page);
  }

  async updatePage(input: Parameters<Store['updatePage']>[0]) {
    const page = this.#livePage(input.id);
    this.#checkVersion(page.id, page.version, input.expectedVersion);
    if (input.name !== undefined && !input.name.trim()) throw new Error('Knowledge page name must not be empty');
    assertKnowledgePageDescriptionWithinBound(input.description || undefined);
    if (input.name !== undefined) page.name = input.name;
    if (input.description !== undefined) {
      if (input.description) page.description = input.description;
      else delete page.description;
    }
    if (input.body !== undefined) page.body = input.body;
    page.version++;
    page.updatedBy = clone(input.provenance);
    page.updatedAt = this.#now();
    this.#log('page-updated', page, input.provenance);
    return clone(page);
  }

  /**
   * Checks moving `subtree` under `parent`: cycles, depth, size and sibling-key clashes under `parent`
   * (the moved root for a move, the source's live children for a merge). Only live pages count;
   * `rootCounts` is false for a merge, whose root (the source) is deleted.
   */
  #checkCarry(pageId: string, subtree: Subtree, parent: KnowledgePage, rootCounts: boolean): void {
    if (subtree.some(entry => entry.page.id === parent.id)) {
      throw new Error(`Knowledge page ${pageId} can't move under itself or its own subtree`);
    }
    const live = subtree.filter(entry => !entry.page.deletedAt && (rootCounts || entry.relativeDepth > 0));
    if (live.length > MAX_KNOWLEDGE_MOVE_PAGES) throw new KnowledgeMoveTooLargeError(pageId, live.length);
    const height = Math.max(0, ...live.map(entry => entry.relativeDepth));
    const deepest = this.#depth(parent) + (rootCounts ? height + 1 : height);
    if (deepest > MAX_KNOWLEDGE_PAGE_DEPTH) throw new KnowledgePageDepthError(pageId);
    const arriving = rootCounts ? [subtree[0]!.page] : live.filter(entry => entry.relativeDepth === 1).map(e => e.page);
    for (const page of arriving) {
      if (page.key === undefined) continue;
      const clash = this.#childByKey(parent.id, page.key, page.id);
      // A merge deletes the source, so a source that is itself a child of the target frees its key.
      if (clash && (rootCounts || clash.id !== pageId)) {
        throw new KnowledgePageKeyConflictError(page.key, parent.id);
      }
    }
  }

  async movePage(input: Parameters<Store['movePage']>[0]) {
    const page = this.#livePage(input.id);
    if (page.isScope) throw new Error(`Knowledge scope page ${page.id} can't be moved`);
    this.#checkVersion(page.id, page.version, input.expectedVersion);
    const parent = this.#livePage(input.parentId);
    const subtree = this.#subtree(page);
    this.#checkCarry(page.id, subtree, parent, true);
    const scopeId = parent.isScope ? parent.id : parent.scopeId;
    for (const { page: carried } of subtree) carried.scopeId = scopeId;
    page.position = input.position ?? this.#nextPosition(parent.id);
    page.parentId = parent.id;
    page.version++;
    page.updatedBy = clone(input.provenance);
    page.updatedAt = this.#now();
    this.#log('page-moved', page, input.provenance);
    return clone(page);
  }

  async mergePages(input: Parameters<Store['mergePages']>[0]) {
    const source = this.#livePage(input.sourceId);
    const target = this.#livePage(input.targetId);
    if (source.isScope || target.isScope) throw new Error("Knowledge scope pages can't be merged");
    this.#checkVersion(source.id, source.version, input.sourceVersion);
    const subtree = this.#subtree(source);
    this.#checkCarry(source.id, subtree, target, false);

    let position = this.#children(target.id).sort(byPosition).at(-1)?.position;
    for (const child of this.#children(source.id).sort(byPosition)) {
      position = knowledgePositionBetween(position);
      child.parentId = target.id;
      child.position = position;
    }
    for (const { page } of subtree) if (page.id !== source.id) page.scopeId = target.scopeId;
    for (const page of this.#pages.values()) {
      if (page.parentId === source.id && page.deletedAt) page.parentId = target.id;
    }
    for (const note of this.#notes.values()) {
      if (note.pageId === source.id) note.pageId = target.id;
      if (note.mentions.includes(source.id)) {
        note.mentions = [...new Set(note.mentions.map(id => (id === source.id ? target.id : id)))];
      }
    }
    for (const kind of PIN_KINDS) {
      const sourcePin = this.#pins.get(pinKey(source.id, kind));
      if (!sourcePin) continue;
      this.#pins.delete(pinKey(source.id, kind));
      const targetPin = this.#pins.get(pinKey(target.id, kind));
      if (targetPin) {
        targetPin.audience = [...new Set([...targetPin.audience, ...sourcePin.audience])];
        targetPin.updatedAt = this.#now();
      } else {
        this.#pins.set(pinKey(target.id, kind), { ...sourcePin, pageId: target.id, updatedAt: this.#now() });
      }
    }
    const now = this.#now();
    source.scopeId = target.scopeId;
    source.mergedInto = target.id;
    source.deletedAt = now;
    source.deletedBy = input.provenance.author;
    source.version++;
    source.updatedBy = clone(input.provenance);
    source.updatedAt = now;
    this.#log('page-merged', source, input.provenance);
    return clone(target);
  }

  async deletePage(input: Parameters<Store['deletePage']>[0]) {
    const page = this.#livePage(input.id);
    if (page.isScope) throw new Error(`Knowledge scope page ${page.id} can't be deleted`);
    this.#checkVersion(page.id, page.version, input.expectedVersion);
    if (this.#children(page.id).length) throw new KnowledgePageHasChildrenError(page.id);
    const now = this.#now();
    page.deletedAt = now;
    page.deletedBy = input.deletedBy;
    page.version++;
    page.updatedAt = now;
    for (const kind of PIN_KINDS) this.#pins.delete(pinKey(page.id, kind));
    this.#log('page-deleted', page, { author: input.deletedBy });
    return clone(page);
  }

  // Notes

  async getNote(input: Parameters<Store['getNote']>[0]) {
    const note = this.#notes.get(input.id);
    if (!note || (note.deletedAt && !input.includeDeleted) || !this.#noteVisible(note, input.read)) return null;
    return clone(note);
  }

  async countNotes(input: Parameters<Store['countNotes']>[0]) {
    const counts: Record<string, number> = Object.fromEntries(input.pageIds.map(id => [id, 0]));
    for (const note of this.#notes.values()) {
      if (Object.hasOwn(counts, note.pageId) && !note.deletedAt && this.#noteVisible(note, input.read)) {
        counts[note.pageId]! += 1;
      }
    }
    return counts;
  }

  async listNotes(input: Parameters<Store['listNotes']>[0]) {
    const notes = [...this.#notes.values()]
      .filter(
        note =>
          note.pageId === input.pageId &&
          (!note.deletedAt || input.includeDeleted) &&
          this.#noteVisible(note, input.read),
      )
      .sort(oldestFirst);
    const { items, nextCursor } = paginate(notes, input.cursor, input.limit);
    return { notes: items.map(clone), ...(nextCursor ? { nextCursor } : {}) };
  }

  async listNotesMentioning(input: Parameters<Store['listNotesMentioning']>[0]) {
    const notes = [...this.#notes.values()]
      .filter(
        note =>
          note.pageId !== input.pageId &&
          note.mentions.includes(input.pageId) &&
          !note.deletedAt &&
          this.#noteVisible(note, input.read),
      )
      .sort(newestFirst);
    const { items, nextCursor } = paginate(notes, input.cursor, input.limit);
    return { notes: items.map(clone), ...(nextCursor ? { nextCursor } : {}) };
  }

  #checkStamps(stampScopeIds: string[]): void {
    if (!stampScopeIds.length) throw new Error('A Knowledge note needs at least one stamp scope');
    for (const id of stampScopeIds) {
      if (!this.#page(id).isScope) throw new Error(`Knowledge note stamp ${id} is not a scope page`);
    }
  }

  async addNote(input: Parameters<Store['addNote']>[0]) {
    const page = this.#livePage(input.pageId);
    assertKnowledgeNoteTextWithinBound(input.text);
    this.#checkStamps(input.stampScopeIds);
    for (const id of input.mentions) this.#page(id);
    const id = input.id ?? crypto.randomUUID();
    if (this.#notes.has(id)) throw new KnowledgeConflictError(id);
    const now = this.#now();
    const note: KnowledgeNote = {
      id,
      pageId: page.id,
      text: input.text,
      ...(input.when ? { when: new Date(input.when) } : {}),
      stampScopeIds: [...new Set(input.stampScopeIds)],
      mentions: [...new Set(input.mentions)],
      provenance: clone(input.provenance),
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.#notes.set(id, note);
    this.#log('note-added', page, input.provenance, id);
    return clone(note);
  }

  #note(id: string): KnowledgeNote {
    const note = this.#notes.get(id);
    if (!note) throw new KnowledgeNotFoundError('note', id);
    return note;
  }

  async restampNote(input: Parameters<Store['restampNote']>[0]) {
    const note = this.#note(input.id);
    if (note.deletedAt) throw new KnowledgeNotFoundError('note', input.id);
    this.#checkVersion(note.id, note.version, input.expectedVersion);
    this.#checkStamps(input.stampScopeIds);
    note.stampScopeIds = [...new Set(input.stampScopeIds)];
    note.version++;
    note.updatedAt = this.#now();
    this.#log('note-restamped', this.#page(note.pageId), input.provenance, note.id);
    return clone(note);
  }

  async removeNote(input: Parameters<Store['removeNote']>[0]) {
    const note = this.#note(input.id);
    if (note.deletedAt) throw new KnowledgeNotFoundError('note', input.id);
    const now = this.#now();
    note.deletedAt = now;
    note.deletedBy = input.deletedBy;
    note.version++;
    note.updatedAt = now;
    this.#log('note-removed', this.#page(note.pageId), input.provenance, note.id);
    return clone(note);
  }

  async restoreNote(input: Parameters<Store['restoreNote']>[0]) {
    const note = this.#note(input.id);
    if (!note.deletedAt) throw new KnowledgeConflictError(input.id);
    delete note.deletedAt;
    delete note.deletedBy;
    note.version++;
    note.updatedAt = this.#now();
    this.#log('note-restored', this.#page(note.pageId), input.provenance, note.id);
    return clone(note);
  }

  // Search and activity

  async searchPages(input: Parameters<Store['searchPages']>[0]): Promise<KnowledgePageSearchHit[]> {
    const words = knowledgeSearchWords(input.query);
    if (!words.length) return [];
    const phrase = input.query.trim().toLowerCase().replace(/\s+/g, ' ');
    const limit = input.limit === undefined ? DEFAULT_SEARCH_LIMIT : pageSize(input.limit);
    const inScope = (page: KnowledgePage) => !input.scopeIds || input.scopeIds.includes(page.scopeId);
    const lower = (text: string | undefined) => (text ?? '').toLowerCase();
    const pageScore = (page: KnowledgePage) => {
      const name = lower(page.name);
      const description = lower(page.description);
      const body = lower(page.body);
      let matched = 0;
      let score = 0;
      for (const word of words) {
        if (name.includes(word)) score += KNOWLEDGE_SEARCH_WEIGHTS.name;
        else if (description.includes(word)) score += KNOWLEDGE_SEARCH_WEIGHTS.description;
        else if (body.includes(word)) score += KNOWLEDGE_SEARCH_WEIGHTS.body;
        else continue;
        matched++;
      }
      return { matched, score };
    };
    const noteScore = (note: KnowledgeNote) => {
      const text = lower(note.text);
      return words.filter(word => text.includes(word)).length;
    };
    const pageHits = [...this.#pages.values()]
      .filter(page => !page.isScope && !page.deletedAt && inScope(page) && this.#pageReadable(page, input.read))
      .map(page => ({
        page,
        phrase: canonicalKnowledgeName(page.name).includes(phrase) ? 0 : 1,
        ...pageScore(page),
      }))
      .filter(hit => hit.matched > 0)
      .sort(
        (a, b) =>
          a.phrase - b.phrase ||
          b.matched - a.matched ||
          b.score - a.score ||
          b.page.updatedAt.getTime() - a.page.updatedAt.getTime() ||
          (a.page.id < b.page.id ? -1 : 1),
      );
    const noteHits = [...this.#notes.values()]
      .filter(note => {
        const page = this.#pages.get(note.pageId)!;
        return !note.deletedAt && !page.deletedAt && inScope(page) && this.#noteVisible(note, input.read);
      })
      .map(note => ({ note, score: noteScore(note) }))
      .filter(hit => hit.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.note.updatedAt.getTime() - a.note.updatedAt.getTime() ||
          (a.note.id < b.note.id ? 1 : a.note.id > b.note.id ? -1 : 0),
      )
      .map(hit => hit.note);
    return [
      ...pageHits.map(({ page }) => ({ type: 'page' as const, page: clone(page) })),
      ...noteHits.map(note => ({
        type: 'note' as const,
        note: clone(note),
        page: clone(this.#pages.get(note.pageId)!),
      })),
    ].slice(0, limit);
  }

  async listPageActivity(input: Parameters<Store['listPageActivity']>[0]) {
    const events = this.#activity
      .filter(event => {
        const page = this.#pages.get(event.pageId);
        if (!page || !this.#pageReadable(page, input.read)) return false;
        if (input.pageId !== undefined && event.pageId !== input.pageId) return false;
        if (input.scopeId !== undefined && page.scopeId !== input.scopeId) return false;
        if (event.noteId !== undefined) {
          const note = this.#notes.get(event.noteId);
          if (!note || !this.#noteVisible(note, input.read)) return false;
        }
        return true;
      })
      .sort(newestFirst);
    const { items, nextCursor } = paginate(events, input.cursor, input.limit);
    return { events: items.map(clone), ...(nextCursor ? { nextCursor } : {}) };
  }

  // Pins

  async addPinAudience(input: Parameters<Store['addPinAudience']>[0]) {
    const page = this.#livePage(input.pageId);
    if (!input.audience.length) throw new Error('A Knowledge pin needs at least one audience scope');
    const kind = input.kind ?? 'page';
    const depth = knowledgePinDepth(kind, input.depth);
    const now = this.#now();
    const existing = this.#pins.get(pinKey(page.id, kind));
    const pin: KnowledgePin = existing
      ? {
          ...existing,
          ...(depth === undefined ? {} : { depth }),
          audience: [...new Set([...existing.audience, ...input.audience])],
          updatedAt: now,
        }
      : {
          id: crypto.randomUUID(),
          pageId: page.id,
          kind,
          ...(depth === undefined ? {} : { depth }),
          audience: [...new Set(input.audience)],
          createdBy: input.createdBy,
          createdAt: now,
          updatedAt: now,
        };
    this.#pins.set(pinKey(page.id, kind), pin);
    this.#log('pin-added', page, { author: input.createdBy });
    return clone(pin);
  }

  async removePinAudience(input: Parameters<Store['removePinAudience']>[0]) {
    const page = this.#page(input.pageId);
    const key = pinKey(page.id, input.kind ?? 'page');
    const existing = this.#pins.get(key);
    if (!existing) return null;
    const removed = new Set(input.audience);
    const audience = existing.audience.filter(entry => !removed.has(entry));
    if (audience.length === existing.audience.length) return clone(existing);
    this.#log('pin-removed', page, { author: input.removedBy });
    if (!audience.length) {
      this.#pins.delete(key);
      return null;
    }
    const pin = { ...existing, audience, updatedAt: this.#now() };
    this.#pins.set(key, pin);
    return clone(pin);
  }

  async listPins(input: Parameters<Store['listPins']>[0]) {
    const audience = input.audience === 'all' ? null : new Set(input.audience);
    const pins = [...this.#pins.values()]
      .filter(pin => {
        const page = this.#pages.get(pin.pageId);
        if (!page || page.deletedAt || !this.#pageReadable(page, input.read)) return false;
        if (input.kind && pin.kind !== input.kind) return false;
        if (input.pageIds && !input.pageIds.includes(pin.pageId)) return false;
        if (pin.kind === 'page' && input.excludePageIds?.includes(pin.pageId)) return false;
        if (pin.kind === 'page' && input.withBody && !/\S/.test(page.body ?? '')) return false;
        return !audience || pin.audience.some(entry => audience.has(entry));
      })
      .sort(newestFirst);
    const { items, nextCursor } = paginate(pins, input.cursor, input.limit);
    return {
      pins: items.map(pin => ({ ...clone(pin), pageName: this.#pages.get(pin.pageId)!.name })),
      ...(nextCursor ? { nextCursor } : {}),
      ...(input.count ? { total: pins.length } : {}),
    };
  }
}
