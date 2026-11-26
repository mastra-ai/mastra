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
  knowledgeSequenceItemSearchText,
  knowledgeSequenceTypeFilter,
  knowledgeSequenceTypeMatches,
  KnowledgeSequenceNotFoundError,
  KnowledgeSequenceNotLeafError,
  KnowledgeSequenceParentNestedError,
  KnowledgeSequenceParentNotFoundError,
  KnowledgeSequencePurgeRefusedError,
  KnowledgeSequencesStorage,
  sameKnowledgeSequenceItem,
} from './sequences';
import type {
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
  sequences: Map<string, Date>;
  /** By `JSON.stringify([sequenceId, externalId])`. */
  items: Map<string, KnowledgeSequenceItemRecord>;
}

type PageLookup = (
  id: string,
  read?: KnowledgeReadScope,
) => { page: KnowledgePage; hasChildren: boolean; readable: boolean } | undefined;

const keyOf = (sequenceId: string, externalId: string) => JSON.stringify([sequenceId, externalId]);
const copy = (item: KnowledgeSequenceItemRecord) => structuredClone(item);

function compare(a: KnowledgeSequenceItemRecord, b: KnowledgeSequenceItemRecord): number {
  const time = a.occurredAt.getTime() - b.occurredAt.getTime();
  return time !== 0 ? time : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * In-memory sequences. One process, no locks: the owning store runs transactions one at a time and
 * rolls them back by restoring {@link snapshot}.
 */
export class InMemoryKnowledgeSequencesStorage extends KnowledgeSequencesStorage {
  #s: State = { sequences: new Map(), items: new Map() };

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

  #liveSequence(sequenceId: string): void {
    const found = this.lookup(sequenceId);
    if (!this.#s.sequences.has(sequenceId) || !found || found.page.deletedAt) {
      throw new KnowledgeSequenceNotFoundError(sequenceId);
    }
  }

  async markSequence({ pageId }: { pageId: string }): Promise<{ status: 'created' | 'unchanged' }> {
    const found = this.lookup(pageId);
    if (!found || found.page.deletedAt) throw new KnowledgeNotFoundError('page', pageId);
    if (this.#s.sequences.has(pageId)) return { status: 'unchanged' };
    if (found.hasChildren) throw new KnowledgeSequenceNotLeafError(pageId);
    this.#s.sequences.set(pageId, new Date());
    return { status: 'created' };
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

  async upsertItem(input: UpsertKnowledgeSequenceItemInput): Promise<KnowledgeSequenceItemUpsertResult> {
    checkKnowledgeSequenceItemInput(input);
    this.#liveSequence(input.sequenceId);
    const key = keyOf(input.sequenceId, input.externalId);
    const stored = this.#s.items.get(key);
    const fields = {
      occurredAt: new Date(input.occurredAt),
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
      if (sameKnowledgeSequenceItem(stored, input)) return { status: 'unchanged', item: copy(stored) };
      if (isStaleKnowledgeSequenceEdit(stored, input))
        return { status: 'ignored', reason: 'stale', item: copy(stored) };
    }
    this.#checkParent(input.sequenceId, input.externalId, fields.externalParentId);
    const item = { ...stored, ...fields, deletedAt: null, version: stored.version + 1 };
    this.#s.items.set(key, item);
    return { status: 'updated', item: copy(item) };
  }

  async removeItem(input: {
    sequenceId: string;
    externalId: string;
    writtenBy: string;
    deletedAt?: Date;
  }): Promise<KnowledgeSequenceItemRemoveResult> {
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
    const after = input.cursor ? decodeKnowledgeSequenceCursor(input.cursor) : undefined;
    if (!this.#s.sequences.has(input.sequenceId) || !this.lookup(input.sequenceId, input.read)?.readable) {
      return { items: [], nextCursor: null };
    }
    const desc = (input.order ?? 'desc') === 'desc';
    const since = input.since?.getTime();
    const until = input.until?.getTime();
    const matching = [...this.#s.items.values()]
      .filter(item => {
        if (item.sequenceId !== input.sequenceId) return false;
        if (item.deletedAt && !input.includeDeleted) return false;
        const time = item.occurredAt.getTime();
        if (since !== undefined && time < since) return false;
        if (until !== undefined && time >= until) return false;
        if (
          input.externalParentId !== undefined &&
          item.externalId !== input.externalParentId &&
          item.externalParentId !== input.externalParentId
        ) {
          return false;
        }
        if (!knowledgeSequenceTypeMatches(typeFilter, item.type)) return false;
        if (after) {
          const position = compare(item, {
            occurredAt: new Date(after.occurredAt),
            id: after.id,
          } as KnowledgeSequenceItemRecord);
          if (desc ? position >= 0 : position <= 0) return false;
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
        const time = item.occurredAt.getTime();
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
          b.item.occurredAt.getTime() - a.item.occurredAt.getTime() ||
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
