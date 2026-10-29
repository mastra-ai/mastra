import { KnowledgeConflictError, KnowledgeNotFoundError } from './base';
import {
  assertKnowledgeNoteTextWithinBound,
  assertKnowledgePageDescriptionWithinBound,
  canonicalKnowledgeName,
  KnowledgeMoveTooLargeError,
  KnowledgePageDepthError,
  KnowledgePageHasChildrenError,
  KnowledgePageKeyConflictError,
  knowledgePositionBetween,
  knowledgeScopeReadable,
  MAX_KNOWLEDGE_MOVE_PAGES,
  MAX_KNOWLEDGE_PAGE_DEPTH,
  MAX_KNOWLEDGE_PAGE_LIST_LIMIT,
} from './pages';
import type {
  KnowledgeNote,
  KnowledgePage,
  KnowledgePageActivityAction,
  KnowledgePageActivityEvent,
  KnowledgePageSearchHit,
  KnowledgePageStore,
  KnowledgePin,
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

const byPosition = (a: KnowledgePage, b: KnowledgePage) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const byName = (a: KnowledgePage, b: KnowledgePage) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const newestFirst = <T extends { createdAt: Date; id: string }>(a: T, b: T) =>
  b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
const oldestFirst = <T extends { createdAt: Date; id: string }>(a: T, b: T) => newestFirst(b, a);

const clone = <T>(value: T): T => structuredClone(value);

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
  #clock = 0;

  /** Drops every page, note, pin and event. */
  clear(): void {
    this.#pages.clear();
    this.#notes.clear();
    this.#pins.clear();
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

  #pageByKey(scopeId: string, key: string): KnowledgePage | undefined {
    for (const page of this.#pages.values()) {
      if (page.scopeId === scopeId && !page.isScope && page.key === key && !page.deletedAt) return page;
    }
    return undefined;
  }

  // Scopes

  async materializeScope(input: Parameters<Store['materializeScope']>[0]) {
    let scope = this.#scopeByAddress(input.address);
    const created = !scope;
    let parentConflict: { existingParentId: string | null; requestedParentId: string | null } | undefined;
    if (scope) {
      if (input.parentId !== undefined && input.parentId !== scope.parentId) {
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
    for (const keyed of input.pages ?? []) {
      if (this.#pageByKey(scope.id, keyed.key)) continue;
      const page = this.#newPage({
        scopeId: scope.id,
        parentId: scope.id,
        isScope: false,
        key: keyed.key,
        name: keyed.name,
        description: keyed.description,
        provenance: input.provenance,
      });
      this.#log('page-created', page, input.provenance);
    }
    return { scope: clone(scope), created, ...(parentConflict ? { parentConflict } : {}) };
  }

  async getScopesByAddress(addresses: string[]) {
    const wanted = new Set(addresses);
    return [...this.#pages.values()]
      .filter(page => page.isScope && wanted.has(page.address!))
      .sort(byPosition)
      .map(clone);
  }

  async listChildScopes(input: Parameters<Store['listChildScopes']>[0]) {
    const scopes = [...this.#pages.values()]
      .filter(page => page.isScope && page.parentId === input.parentId)
      .sort(byPosition);
    const { items, nextCursor } = paginate(scopes, input.cursor, input.limit);
    return { pages: items.map(clone), ...(nextCursor ? { nextCursor } : {}) };
  }

  // Pages

  async getPage(input: Parameters<Store['getPage']>[0]) {
    const page = this.#pages.get(input.id);
    return page && this.#pageReadable(page, input.read) ? clone(page) : null;
  }

  async getPageByKey(input: Parameters<Store['getPageByKey']>[0]) {
    const page = this.#pageByKey(input.scopeId, input.key);
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
    if (input.key !== undefined && this.#pageByKey(scopeId, input.key)) {
      throw new KnowledgePageKeyConflictError(input.key, scopeId);
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
   * Checks moving `subtree` under `parent`: cycles, depth, size and key clashes in the destination
   * scope. Only live pages count; `rootCounts` is false for a merge, whose root (the source) is deleted.
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
    const scopeId = parent.isScope ? parent.id : parent.scopeId;
    for (const { page } of live) {
      if (page.key === undefined || page.scopeId === scopeId) continue;
      if (this.#pageByKey(scopeId, page.key)) throw new KnowledgePageKeyConflictError(page.key, scopeId);
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
    const sourcePin = this.#pins.get(source.id);
    if (sourcePin) {
      this.#pins.delete(source.id);
      const targetPin = this.#pins.get(target.id);
      if (targetPin) {
        targetPin.audience = [...new Set([...targetPin.audience, ...sourcePin.audience])];
        targetPin.updatedAt = this.#now();
      } else {
        this.#pins.set(target.id, { ...sourcePin, pageId: target.id, updatedAt: this.#now() });
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
    this.#pins.delete(page.id);
    this.#log('page-deleted', page, { author: input.deletedBy });
    return clone(page);
  }

  // Notes

  async getNote(input: Parameters<Store['getNote']>[0]) {
    const note = this.#notes.get(input.id);
    if (!note || (note.deletedAt && !input.includeDeleted) || !this.#noteVisible(note, input.read)) return null;
    return clone(note);
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
    const query = input.query.trim().toLowerCase();
    if (!query) return [];
    const limit = input.limit === undefined ? DEFAULT_SEARCH_LIMIT : pageSize(input.limit);
    const inScope = (page: KnowledgePage) => !input.scopeIds || input.scopeIds.includes(page.scopeId);
    const contains = (text: string | undefined) => !!text && text.toLowerCase().includes(query);
    const readablePages = [...this.#pages.values()].filter(
      page => !page.isScope && !page.deletedAt && inScope(page) && this.#pageReadable(page, input.read),
    );
    const byRecency = (a: KnowledgePage, b: KnowledgePage) =>
      b.updatedAt.getTime() - a.updatedAt.getTime() || (a.id < b.id ? -1 : 1);
    const nameHits = readablePages.filter(page => contains(page.name)).sort(byRecency);
    const otherHits = readablePages
      .filter(page => !contains(page.name) && (contains(page.description) || contains(page.body)))
      .sort(byRecency);
    const noteHits = [...this.#notes.values()]
      .filter(note => {
        const page = this.#pages.get(note.pageId)!;
        return (
          !note.deletedAt &&
          !page.deletedAt &&
          inScope(page) &&
          contains(note.text) &&
          this.#noteVisible(note, input.read)
        );
      })
      .sort(newestFirst);
    return [
      ...[...nameHits, ...otherHits].map(page => ({ type: 'page' as const, page: clone(page) })),
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
    const now = this.#now();
    const existing = this.#pins.get(page.id);
    const pin: KnowledgePin = existing
      ? { ...existing, audience: [...new Set([...existing.audience, ...input.audience])], updatedAt: now }
      : {
          id: crypto.randomUUID(),
          pageId: page.id,
          audience: [...new Set(input.audience)],
          createdBy: input.createdBy,
          createdAt: now,
          updatedAt: now,
        };
    this.#pins.set(page.id, pin);
    this.#log('pin-added', page, { author: input.createdBy });
    return clone(pin);
  }

  async removePinAudience(input: Parameters<Store['removePinAudience']>[0]) {
    const page = this.#page(input.pageId);
    const existing = this.#pins.get(page.id);
    if (!existing) return null;
    const removed = new Set(input.audience);
    const audience = existing.audience.filter(entry => !removed.has(entry));
    if (audience.length === existing.audience.length) return clone(existing);
    this.#log('pin-removed', page, { author: input.removedBy });
    if (!audience.length) {
      this.#pins.delete(page.id);
      return null;
    }
    const pin = { ...existing, audience, updatedAt: this.#now() };
    this.#pins.set(page.id, pin);
    return clone(pin);
  }

  async listPins(input: Parameters<Store['listPins']>[0]) {
    const audience = input.audience === 'all' ? null : new Set(input.audience);
    const pins = [...this.#pins.values()]
      .filter(pin => {
        const page = this.#pages.get(pin.pageId);
        if (!page || page.deletedAt || !this.#pageReadable(page, input.read)) return false;
        if (input.pageIds && !input.pageIds.includes(pin.pageId)) return false;
        return !audience || pin.audience.some(entry => audience.has(entry));
      })
      .sort(newestFirst);
    const { items, nextCursor } = paginate(pins, input.cursor, input.limit);
    return { pins: items.map(clone), ...(nextCursor ? { nextCursor } : {}) };
  }
}
