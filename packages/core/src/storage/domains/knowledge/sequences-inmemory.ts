import { knowledgeSearchWords } from '@internal/core/knowledge-compat';
import { createKnowledgeUlid, KnowledgeNotFoundError } from './base';
import type { KnowledgePage, KnowledgeReadScope } from './pages';
import {
  checkKnowledgeSequenceItemInput,
  checkKnowledgeSequenceReadLimit,
  decodeKnowledgeSequenceCursor,
  encodeKnowledgeSequenceCursor,
  isStaleKnowledgeSequenceEdit,
  knowledgeSequenceItemContent,
  knowledgeSequenceItemPosition,
  knowledgeSequenceItemSearchText,
  knowledgeSequenceTypeFilter,
  knowledgeSequenceTypeMatches,
  KnowledgeSequenceNotFoundError,
  KnowledgeSequenceNotLeafError,
  KnowledgeSequenceOrderByChangeError,
  KnowledgeSequenceParentNestedError,
  KnowledgeSequenceParentNotFoundError,
  KnowledgeSequencePurgeRefusedError,
  KnowledgeSequencesStorage,
  sameKnowledgeSequenceItem,
} from './sequences';
import type {
  KnowledgeSequenceOrderBy,
  KnowledgeSequenceItemsPage,
  KnowledgeSequenceItemRecord,
  KnowledgeSequenceItemRemoveResult,
  KnowledgeSequenceItemUpsertResult,
  KnowledgeSequencePurgeResult,
  ListKnowledgeSequenceItemsInput,
  SearchKnowledgeSequenceItemsInput,
  UpsertKnowledgeSequenceItemInput,
} from './sequences';

interface State {
  sequences: Map<string, { createdAt: Date; orderBy: KnowledgeSequenceOrderBy }>;
  /** By `JSON.stringify([sequenceId, externalId])`. */
  items: Map<string, KnowledgeSequenceItemRecord>;
}

type PageLookup = (
  id: string,
  read?: KnowledgeReadScope,
) => { page: KnowledgePage; hasChildren: boolean; readable: boolean } | undefined;

const keyOf = (sequenceId: string, externalId: string) => JSON.stringify([sequenceId, externalId]);
const copy = (item: KnowledgeSequenceItemRecord) => structuredClone(item);

type OrderKey = Pick<KnowledgeSequenceItemRecord, 'occurredAt' | 'position' | 'id'>;

const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Position keys ascending, items without one last. */
const byPosition = (a: string | null, b: string | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : byCode(a, b);

/** Along the sequence's order: `(position, id)` when positioned, else `(occurredAt, id)`. */
function compare(a: OrderKey, b: OrderKey): number {
  const key =
    a.position !== null && b.position !== null
      ? byCode(a.position, b.position)
      : (a.occurredAt?.getTime() ?? 0) - (b.occurredAt?.getTime() ?? 0);
  return key !== 0 ? key : byCode(a.id, b.id);
}

/**
 * In-memory sequences. One process, no locks: the owning store runs transactions one at a time and
 * rolls them back by restoring {@link snapshot}.
 */
export class InMemoryKnowledgeSequencesStorage extends KnowledgeSequencesStorage {
  #s: State = { sequences: new Map(), items: new Map() };
  /** Item writes run one at a time, as a row lock makes them on SQL stores, so placements don't race. */
  #writes: Promise<unknown> = Promise.resolve();

  #serialized<R>(write: () => Promise<R>): Promise<R> {
    const run = this.#writes.then(write, write);
    this.#writes = run.catch(() => undefined);
    return run;
  }

  constructor(private readonly lookup: PageLookup) {
    super();
  }

  snapshot(): State {
    return structuredClone(this.#s);
  }
  restore(state: State): void {
    this.#s = state;
  }
  clear(): void {
    this.#s = { sequences: new Map(), items: new Map() };
  }

  #liveSequence(sequenceId: string): KnowledgeSequenceOrderBy {
    const found = this.lookup(sequenceId);
    const sequence = this.#s.sequences.get(sequenceId);
    if (!sequence || !found || found.page.deletedAt) throw new KnowledgeSequenceNotFoundError(sequenceId);
    return sequence.orderBy;
  }

  async markSequence({
    pageId,
    orderBy = 'timeline',
  }: {
    pageId: string;
    orderBy?: KnowledgeSequenceOrderBy;
  }): Promise<{ status: 'created' | 'unchanged' }> {
    const found = this.lookup(pageId);
    if (!found || found.page.deletedAt) throw new KnowledgeNotFoundError('page', pageId);
    const marked = this.#s.sequences.get(pageId);
    if (marked) {
      if (marked.orderBy !== orderBy) throw new KnowledgeSequenceOrderByChangeError(pageId, marked.orderBy);
      return { status: 'unchanged' };
    }
    if (found.hasChildren) throw new KnowledgeSequenceNotLeafError(pageId);
    this.#s.sequences.set(pageId, { createdAt: new Date(), orderBy });
    return { status: 'created' };
  }

  #positioned(sequenceId: string, skip: string): KnowledgeSequenceItemRecord[] {
    return [...this.#s.items.values()]
      .filter(item => item.sequenceId === sequenceId && item.externalId !== skip && item.position !== null)
      .sort(compare);
  }

  async #position(input: UpsertKnowledgeSequenceItemInput, stored: KnowledgeSequenceItemRecord | undefined) {
    return knowledgeSequenceItemPosition(input, stored, {
      neighbour: async (externalId, side) => {
        const items = this.#positioned(input.sequenceId, input.externalId);
        const at = items.findIndex(item => item.externalId === externalId);
        if (at < 0) return null;
        return { position: items[at]!.position!, next: items[side === 'after' ? at + 1 : at - 1]?.position ?? null };
      },
      last: async () => this.#positioned(input.sequenceId, input.externalId).at(-1)?.position ?? null,
      taken: async position =>
        this.#positioned(input.sequenceId, input.externalId).some(item => item.position === position),
    });
  }

  async listSequenceIds({ pageIds }: { pageIds: string[] }): Promise<string[]> {
    return pageIds.filter(id => this.#s.sequences.has(id));
  }

  /** Refuses a parent that isn't an item of this sequence, is itself under one, or an item with items under it. */
  #checkParent(sequenceId: string, externalId: string, externalParentId: string | null): void {
    if (!externalParentId) return;
    const parent = this.#s.items.get(keyOf(sequenceId, externalParentId));
    if (!parent) throw new KnowledgeSequenceParentNotFoundError(sequenceId, externalParentId);
    if (parent.externalParentId) throw new KnowledgeSequenceParentNestedError(sequenceId, externalId);
    for (const item of this.#s.items.values()) {
      if (item.sequenceId === sequenceId && item.externalParentId === externalId) {
        throw new KnowledgeSequenceParentNestedError(sequenceId, externalId);
      }
    }
  }

  upsertItem(input: UpsertKnowledgeSequenceItemInput): Promise<KnowledgeSequenceItemUpsertResult> {
    return this.#serialized(() => this.#upsertItem(input));
  }

  async #upsertItem(input: UpsertKnowledgeSequenceItemInput): Promise<KnowledgeSequenceItemUpsertResult> {
    const orderBy = this.#liveSequence(input.sequenceId);
    checkKnowledgeSequenceItemInput(input, orderBy);
    const key = keyOf(input.sequenceId, input.externalId);
    const stored = this.#s.items.get(key);
    const position = orderBy === 'position' ? await this.#position(input, stored) : null;
    const fields = {
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : null,
      position,
      editedAt: input.editedAt ? new Date(input.editedAt) : null,
      author: input.author ? { ...input.author } : null,
      ...structuredClone(knowledgeSequenceItemContent(input)),
      writtenBy: input.writtenBy,
    };
    if (!stored) {
      this.#checkParent(input.sequenceId, input.externalId, fields.externalParentId);
      const item: KnowledgeSequenceItemRecord = {
        id: createKnowledgeUlid(),
        sequenceId: input.sequenceId,
        externalId: input.externalId,
        writtenAt: new Date(),
        deletedAt: null,
        version: 1,
        ...fields,
      };
      this.#s.items.set(key, item);
      return { status: 'created', item: copy(item) };
    }
    if (stored.deletedAt && !input.restore) return { status: 'ignored', reason: 'deleted', item: copy(stored) };
    if (!stored.deletedAt) {
      if (sameKnowledgeSequenceItem(stored, input, position)) return { status: 'unchanged', item: copy(stored) };
      if (isStaleKnowledgeSequenceEdit(stored, input))
        return { status: 'ignored', reason: 'stale', item: copy(stored) };
    }
    this.#checkParent(input.sequenceId, input.externalId, fields.externalParentId);
    const item = { ...stored, ...fields, deletedAt: null, version: stored.version + 1 };
    this.#s.items.set(key, item);
    return { status: 'updated', item: copy(item) };
  }

  removeItem(input: {
    sequenceId: string;
    externalId: string;
    writtenBy: string;
    deletedAt?: Date;
  }): Promise<KnowledgeSequenceItemRemoveResult> {
    return this.#serialized(async () => this.#removeItem(input));
  }

  #removeItem(input: {
    sequenceId: string;
    externalId: string;
    writtenBy: string;
    deletedAt?: Date;
  }): KnowledgeSequenceItemRemoveResult {
    this.#liveSequence(input.sequenceId);
    const key = keyOf(input.sequenceId, input.externalId);
    const stored = this.#s.items.get(key);
    if (!stored) return { status: 'missing' };
    if (stored.deletedAt) return { status: 'unchanged', item: copy(stored) };
    const item = {
      ...stored,
      title: null,
      body: null,
      links: [],
      properties: null,
      deletedAt: input.deletedAt ?? new Date(),
      writtenBy: input.writtenBy,
      version: stored.version + 1,
    };
    this.#s.items.set(key, item);
    return { status: 'removed', item: copy(item) };
  }

  async getItem(input: {
    sequenceId: string;
    id: string;
    read: KnowledgeReadScope;
  }): Promise<KnowledgeSequenceItemRecord | null> {
    if (!this.#s.sequences.has(input.sequenceId) || !this.lookup(input.sequenceId, input.read)?.readable) return null;
    const item = [...this.#s.items.values()].find(e => e.id === input.id && e.sequenceId === input.sequenceId);
    return item ? copy(item) : null;
  }

  async listItems(input: ListKnowledgeSequenceItemsInput): Promise<KnowledgeSequenceItemsPage> {
    checkKnowledgeSequenceReadLimit(input.limit);
    const typeFilter = knowledgeSequenceTypeFilter(input);
    const sequence = this.#s.sequences.get(input.sequenceId);
    if (!sequence || !this.lookup(input.sequenceId, input.read)?.readable) {
      if (input.cursor) decodeKnowledgeSequenceCursor(input.cursor, sequence?.orderBy ?? 'timeline');
      return { items: [], nextCursor: null };
    }
    const cursor = input.cursor ? decodeKnowledgeSequenceCursor(input.cursor, sequence.orderBy) : undefined;
    const after: OrderKey | undefined = cursor && {
      id: cursor.id,
      occurredAt: cursor.orderBy === 'timeline' ? new Date(cursor.occurredAt) : null,
      position: cursor.orderBy === 'position' ? cursor.position : null,
    };
    const desc = (input.order ?? (sequence.orderBy === 'position' ? 'asc' : 'desc')) === 'desc';
    const since = input.since?.getTime();
    const until = input.until?.getTime();
    const matching = [...this.#s.items.values()]
      .filter(item => {
        if (item.sequenceId !== input.sequenceId) return false;
        if (item.deletedAt && !input.includeDeleted) return false;
        const time = item.occurredAt?.getTime();
        if (since !== undefined && (time === undefined || time < since)) return false;
        if (until !== undefined && (time === undefined || time >= until)) return false;
        if (
          input.externalParentId !== undefined &&
          item.externalId !== input.externalParentId &&
          item.externalParentId !== input.externalParentId
        ) {
          return false;
        }
        if (!knowledgeSequenceTypeMatches(typeFilter, item.type)) return false;
        if (after) {
          const side = compare(item, after);
          if (desc ? side >= 0 : side <= 0) return false;
        }
        return true;
      })
      .sort((a, b) => (desc ? compare(b, a) : compare(a, b)));
    const items = matching.slice(0, input.limit).map(copy);
    const last = items.at(-1);
    return { items, nextCursor: matching.length > input.limit && last ? encodeKnowledgeSequenceCursor(last) : null };
  }

  async searchItems(input: SearchKnowledgeSequenceItemsInput): Promise<KnowledgeSequenceItemRecord[]> {
    checkKnowledgeSequenceReadLimit(input.limit);
    const typeFilter = knowledgeSequenceTypeFilter(input);
    const words = knowledgeSearchWords(input.query);
    if (!words.length) return [];
    const visible = new Set<string>();
    for (const id of input.sequenceIds ?? this.#s.sequences.keys()) {
      if (!this.#s.sequences.has(id)) continue;
      const found = this.lookup(id, input.read);
      if (!found?.readable || found.page.deletedAt) continue;
      if (input.scopeIds && !input.scopeIds.includes(found.page.scopeId)) continue;
      visible.add(id);
    }
    const since = input.since?.getTime();
    const until = input.until?.getTime();
    return [...this.#s.items.values()]
      .filter(item => {
        if (!visible.has(item.sequenceId) || item.deletedAt) return false;
        if (!knowledgeSequenceTypeMatches(typeFilter, item.type)) return false;
        const time = item.occurredAt?.getTime();
        if (time === undefined) return since === undefined && until === undefined;
        return (since === undefined || time >= since) && (until === undefined || time < until);
      })
      .map(item => {
        const text = knowledgeSequenceItemSearchText(item);
        return { item, matched: words.filter(word => text.includes(word)).length };
      })
      .filter(hit => hit.matched > 0)
      .sort(
        (a, b) =>
          b.matched - a.matched ||
          (b.item.occurredAt?.getTime() ?? -Infinity) - (a.item.occurredAt?.getTime() ?? -Infinity) ||
          byPosition(a.item.position, b.item.position) ||
          (a.item.id < b.item.id ? -1 : 1),
      )
      .slice(0, input.limit)
      .map(hit => copy(hit.item));
  }

  async purgeItems(input: {
    sequenceId: string;
    deletedBefore: Date;
    limit: number;
  }): Promise<KnowledgeSequencePurgeResult> {
    const found = this.lookup(input.sequenceId);
    const deletedAt = found?.page.deletedAt;
    if (found && (!deletedAt || deletedAt.getTime() >= input.deletedBefore.getTime())) {
      throw new KnowledgeSequencePurgeRefusedError(input.sequenceId);
    }
    const batch = [...this.#s.items.entries()].filter(([, item]) => item.sequenceId === input.sequenceId);
    const purged = batch.slice(0, input.limit);
    for (const [key] of purged) this.#s.items.delete(key);
    const done = purged.length === batch.length;
    if (done) this.#s.sequences.delete(input.sequenceId);
    return { purgedIds: purged.map(([, item]) => item.id), done };
  }
}
