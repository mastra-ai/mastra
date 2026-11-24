import { knowledgeSearchWords } from '@internal/core/knowledge-compat';
import { createKnowledgeUlid, KnowledgeNotFoundError } from './base';
import type { KnowledgePage, KnowledgeReadScope } from './pages';
import {
  checkKnowledgeTimelineEntryInput,
  checkKnowledgeTimelineReadLimit,
  decodeKnowledgeTimelineCursor,
  encodeKnowledgeTimelineCursor,
  isStaleKnowledgeTimelineEdit,
  KnowledgeTimelineNotFoundError,
  KnowledgeTimelineNotLeafError,
  KnowledgeTimelinePurgeRefusedError,
  KnowledgeTimelinesStorage,
  sameKnowledgeTimelineEntry,
} from './timelines';
import type {
  KnowledgeTimelineEntriesPage,
  KnowledgeTimelineEntryRecord,
  KnowledgeTimelineEntryRemoveResult,
  KnowledgeTimelineEntryUpsertResult,
  KnowledgeTimelinePurgeResult,
  ListKnowledgeTimelineEntriesInput,
  SearchKnowledgeTimelineEntriesInput,
  UpsertKnowledgeTimelineEntryInput,
} from './timelines';

interface State {
  timelines: Map<string, Date>;
  /** By `JSON.stringify([timelineId, externalId])`. */
  entries: Map<string, KnowledgeTimelineEntryRecord>;
}

type PageLookup = (
  id: string,
  read?: KnowledgeReadScope,
) => { page: KnowledgePage; hasChildren: boolean; readable: boolean } | undefined;

const keyOf = (timelineId: string, externalId: string) => JSON.stringify([timelineId, externalId]);
const copy = (entry: KnowledgeTimelineEntryRecord) => structuredClone(entry);

function compare(a: KnowledgeTimelineEntryRecord, b: KnowledgeTimelineEntryRecord): number {
  const time = a.occurredAt.getTime() - b.occurredAt.getTime();
  return time !== 0 ? time : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * In-memory timelines. One process, no locks: the owning store runs transactions one at a time and
 * rolls them back by restoring {@link snapshot}.
 */
export class InMemoryKnowledgeTimelinesStorage extends KnowledgeTimelinesStorage {
  #s: State = { timelines: new Map(), entries: new Map() };

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
    this.#s = { timelines: new Map(), entries: new Map() };
  }

  #liveTimeline(timelineId: string): void {
    const found = this.lookup(timelineId);
    if (!this.#s.timelines.has(timelineId) || !found || found.page.deletedAt) {
      throw new KnowledgeTimelineNotFoundError(timelineId);
    }
  }

  async markTimeline({ pageId }: { pageId: string }): Promise<{ status: 'created' | 'unchanged' }> {
    const found = this.lookup(pageId);
    if (!found || found.page.deletedAt) throw new KnowledgeNotFoundError('page', pageId);
    if (this.#s.timelines.has(pageId)) return { status: 'unchanged' };
    if (found.hasChildren) throw new KnowledgeTimelineNotLeafError(pageId);
    this.#s.timelines.set(pageId, new Date());
    return { status: 'created' };
  }

  async listTimelineIds({ pageIds }: { pageIds: string[] }): Promise<string[]> {
    return pageIds.filter(id => this.#s.timelines.has(id));
  }

  async upsertEntry(input: UpsertKnowledgeTimelineEntryInput): Promise<KnowledgeTimelineEntryUpsertResult> {
    checkKnowledgeTimelineEntryInput(input);
    this.#liveTimeline(input.timelineId);
    const key = keyOf(input.timelineId, input.externalId);
    const stored = this.#s.entries.get(key);
    const fields = {
      occurredAt: new Date(input.occurredAt),
      editedAt: input.editedAt ? new Date(input.editedAt) : null,
      author: input.author ? { ...input.author } : null,
      threadExternalId: input.threadExternalId ?? null,
      body: input.body,
      writtenBy: input.writtenBy,
    };
    if (!stored) {
      const entry: KnowledgeTimelineEntryRecord = {
        id: createKnowledgeUlid(),
        timelineId: input.timelineId,
        externalId: input.externalId,
        writtenAt: new Date(),
        deletedAt: null,
        version: 1,
        ...fields,
      };
      this.#s.entries.set(key, entry);
      return { status: 'created', entry: copy(entry) };
    }
    if (stored.deletedAt && !input.restore) return { status: 'ignored', reason: 'deleted', entry: copy(stored) };
    if (!stored.deletedAt) {
      if (sameKnowledgeTimelineEntry(stored, input)) return { status: 'unchanged', entry: copy(stored) };
      if (isStaleKnowledgeTimelineEdit(stored, input))
        return { status: 'ignored', reason: 'stale', entry: copy(stored) };
    }
    const entry = { ...stored, ...fields, deletedAt: null, version: stored.version + 1 };
    this.#s.entries.set(key, entry);
    return { status: 'updated', entry: copy(entry) };
  }

  async removeEntry(input: {
    timelineId: string;
    externalId: string;
    writtenBy: string;
    deletedAt?: Date;
  }): Promise<KnowledgeTimelineEntryRemoveResult> {
    this.#liveTimeline(input.timelineId);
    const key = keyOf(input.timelineId, input.externalId);
    const stored = this.#s.entries.get(key);
    if (!stored) return { status: 'missing' };
    if (stored.deletedAt) return { status: 'unchanged', entry: copy(stored) };
    const entry = {
      ...stored,
      body: '',
      deletedAt: input.deletedAt ?? new Date(),
      writtenBy: input.writtenBy,
      version: stored.version + 1,
    };
    this.#s.entries.set(key, entry);
    return { status: 'removed', entry: copy(entry) };
  }

  async listEntries(input: ListKnowledgeTimelineEntriesInput): Promise<KnowledgeTimelineEntriesPage> {
    checkKnowledgeTimelineReadLimit(input.limit);
    const after = input.cursor ? decodeKnowledgeTimelineCursor(input.cursor) : undefined;
    if (!this.#s.timelines.has(input.timelineId) || !this.lookup(input.timelineId, input.read)?.readable) {
      return { entries: [], nextCursor: null };
    }
    const desc = (input.order ?? 'desc') === 'desc';
    const since = input.since?.getTime();
    const until = input.until?.getTime();
    const matching = [...this.#s.entries.values()]
      .filter(entry => {
        if (entry.timelineId !== input.timelineId) return false;
        if (entry.deletedAt && !input.includeDeleted) return false;
        const time = entry.occurredAt.getTime();
        if (since !== undefined && time < since) return false;
        if (until !== undefined && time >= until) return false;
        if (
          input.threadExternalId !== undefined &&
          entry.externalId !== input.threadExternalId &&
          entry.threadExternalId !== input.threadExternalId
        ) {
          return false;
        }
        if (after) {
          const position = compare(entry, {
            occurredAt: new Date(after.occurredAt),
            id: after.id,
          } as KnowledgeTimelineEntryRecord);
          if (desc ? position >= 0 : position <= 0) return false;
        }
        return true;
      })
      .sort((a, b) => (desc ? compare(b, a) : compare(a, b)));
    const entries = matching.slice(0, input.limit).map(copy);
    const last = entries.at(-1);
    return { entries, nextCursor: matching.length > input.limit && last ? encodeKnowledgeTimelineCursor(last) : null };
  }

  async searchEntries(input: SearchKnowledgeTimelineEntriesInput): Promise<KnowledgeTimelineEntryRecord[]> {
    checkKnowledgeTimelineReadLimit(input.limit);
    const words = knowledgeSearchWords(input.query);
    if (!words.length) return [];
    const visible = new Set<string>();
    for (const id of input.timelineIds ?? this.#s.timelines.keys()) {
      if (!this.#s.timelines.has(id)) continue;
      const found = this.lookup(id, input.read);
      if (!found?.readable || found.page.deletedAt) continue;
      if (input.scopeIds && !input.scopeIds.includes(found.page.scopeId)) continue;
      visible.add(id);
    }
    const since = input.since?.getTime();
    const until = input.until?.getTime();
    return [...this.#s.entries.values()]
      .filter(entry => {
        if (!visible.has(entry.timelineId) || entry.deletedAt) return false;
        const time = entry.occurredAt.getTime();
        return (since === undefined || time >= since) && (until === undefined || time < until);
      })
      .map(entry => {
        const body = entry.body.toLowerCase();
        return { entry, matched: words.filter(word => body.includes(word)).length };
      })
      .filter(hit => hit.matched > 0)
      .sort(
        (a, b) =>
          b.matched - a.matched ||
          b.entry.occurredAt.getTime() - a.entry.occurredAt.getTime() ||
          (a.entry.id < b.entry.id ? -1 : 1),
      )
      .slice(0, input.limit)
      .map(hit => copy(hit.entry));
  }

  async purgeEntries(input: {
    timelineId: string;
    deletedBefore: Date;
    limit: number;
  }): Promise<KnowledgeTimelinePurgeResult> {
    const found = this.lookup(input.timelineId);
    const deletedAt = found?.page.deletedAt;
    if (found && (!deletedAt || deletedAt.getTime() >= input.deletedBefore.getTime())) {
      throw new KnowledgeTimelinePurgeRefusedError(input.timelineId);
    }
    const batch = [...this.#s.entries.entries()].filter(([, entry]) => entry.timelineId === input.timelineId);
    const purged = batch.slice(0, input.limit);
    for (const [key] of purged) this.#s.entries.delete(key);
    const done = purged.length === batch.length;
    if (done) this.#s.timelines.delete(input.timelineId);
    return { purgedIds: purged.map(([, entry]) => entry.id), done };
  }
}
