import type { KnowledgeReadScope } from './pages';

/**
 * Sequences: a page whose dated items (chat messages, events) live in their own table, keyed by
 * the source's ID, instead of one page per item. Reached through {@link KnowledgeStorage.sequences},
 * so on a transaction view it writes in the same transaction as the page writes.
 *
 * Items carry no scope: they are read through their sequence page, so moving or deleting the page
 * moves or hides every item at once, with no item rewritten.
 *
 * @experimental
 */

/** At most this many items come back from one read; more continue by cursor. */
export const MAX_KNOWLEDGE_SEQUENCE_READ_LIMIT = 100;

export interface KnowledgeSequenceItemAuthor {
  /** The person's ID at the source. */
  sourceId: string;
  name?: string;
}

export interface KnowledgeSequenceItemRecord {
  /** Store ID, stable for the item's life: edits keep it. */
  id: string;
  /** The sequence page's ID. */
  sequenceId: string;
  /** The source's own ID for the item, unique within its sequence. Compared byte for byte. */
  externalId: string;
  /** When it happened at the source. Items are ordered by this, then by `id`. */
  occurredAt: Date;
  /** When Knowledge first stored it. */
  writtenAt: Date;
  /** When the source last edited it, or null. */
  editedAt: Date | null;
  /** Set when the source deleted it. The body is cleared and the row kept, so a replay can't bring it back. */
  deletedAt: Date | null;
  author: KnowledgeSequenceItemAuthor | null;
  /** The `externalId` of the thread's root item, for a reply. */
  threadExternalId: string | null;
  body: string;
  /** Starts at 1 and goes up by one with each change. */
  version: number;
  /** The Knowledge writer of the last change, e.g. `importer:slack`. */
  writtenBy: string;
}

export interface UpsertKnowledgeSequenceItemInput {
  sequenceId: string;
  externalId: string;
  occurredAt: Date;
  editedAt?: Date | null;
  author?: KnowledgeSequenceItemAuthor | null;
  threadExternalId?: string | null;
  body: string;
  writtenBy: string;
  /** Bring back an item the source deleted. Without it, a deleted item stays deleted. */
  restore?: boolean;
}

export type KnowledgeSequenceItemUpsertResult =
  | { status: 'created' | 'updated' | 'unchanged'; item: KnowledgeSequenceItemRecord }
  /**
   * Nothing changed: the item is deleted (and `restore` wasn't set), or the stored edit is newer
   * than this one, so an out-of-order replay can't roll an edit back.
   */
  | { status: 'ignored'; reason: 'deleted' | 'stale'; item: KnowledgeSequenceItemRecord };

export type KnowledgeSequenceItemRemoveResult =
  | { status: 'removed' | 'unchanged'; item: KnowledgeSequenceItemRecord }
  /** No item with that `externalId`; nothing was stored. */
  | { status: 'missing' };

export interface ListKnowledgeSequenceItemsInput {
  sequenceId: string;
  /** The sequence page must be live and readable under this scope, or the read finds nothing. */
  read: KnowledgeReadScope;
  /** `occurredAt >= since`. */
  since?: Date;
  /** `occurredAt < until`. */
  until?: Date;
  /** Only the thread with this root `externalId`: the root and its replies. */
  threadExternalId?: string;
  /** Newest first (`desc`, the default) or oldest first. */
  order?: 'asc' | 'desc';
  /** At most {@link MAX_KNOWLEDGE_SEQUENCE_READ_LIMIT}. */
  limit: number;
  /** The `nextCursor` of the previous read, with the same other arguments. */
  cursor?: string;
  /** Include deleted items (body cleared). Off by default. */
  includeDeleted?: boolean;
}

export interface KnowledgeSequenceItemsPage {
  items: KnowledgeSequenceItemRecord[];
  nextCursor: string | null;
}

export interface SearchKnowledgeSequenceItemsInput {
  /** Matched by word, as page search does (`knowledgeSearchWords`): an item matches any word in its body. */
  query: string;
  /** Only items of live sequence pages readable under this scope. */
  read: KnowledgeReadScope;
  /** Only these sequences. */
  sequenceIds?: string[];
  /** Only sequences whose page is in one of these scopes. */
  scopeIds?: string[];
  /** `occurredAt >= since`. */
  since?: Date;
  /** `occurredAt < until`. */
  until?: Date;
  /** At most {@link MAX_KNOWLEDGE_SEQUENCE_READ_LIMIT}. */
  limit: number;
}

export type KnowledgeSequencePurgeResult = { purgedIds: string[]; done: boolean };

/** The page has child pages, so it can't become a sequence. Nothing was written. */
export class KnowledgeSequenceNotLeafError extends Error {
  constructor(readonly pageId: string) {
    super(`Knowledge page ${pageId} has child pages, so it can't be a sequence.`);
    this.name = 'KnowledgeSequenceNotLeafError';
  }
}

/** The page isn't a live sequence. */
export class KnowledgeSequenceNotFoundError extends Error {
  constructor(readonly pageId: string) {
    super(`Knowledge page ${pageId} is not a live sequence.`);
    this.name = 'KnowledgeSequenceNotFoundError';
  }
}

/** Items of a sequence are only purged once its page has been deleted longer than the caller's cutoff. */
export class KnowledgeSequencePurgeRefusedError extends Error {
  constructor(readonly pageId: string) {
    super(`Knowledge sequence ${pageId} is live or was deleted after the purge cutoff; nothing was purged.`);
    this.name = 'KnowledgeSequencePurgeRefusedError';
  }
}

export abstract class KnowledgeSequencesStorage {
  /**
   * Makes a live page a sequence. Refuses with {@link KnowledgeSequenceNotLeafError} when it has
   * live child pages, and `KnowledgeNotFoundError` when it isn't live. Repeating it is `unchanged`.
   */
  abstract markSequence(input: { pageId: string }): Promise<{ status: 'created' | 'unchanged' }>;
  /** The sequences among `pageIds`, live or deleted. */
  abstract listSequenceIds(input: { pageIds: string[] }): Promise<string[]>;
  /**
   * Upserts by `(sequenceId, externalId)`. Unchanged content (body, author, times, thread) is
   * `unchanged` and writes nothing. The sequence must be live.
   */
  abstract upsertItem(input: UpsertKnowledgeSequenceItemInput): Promise<KnowledgeSequenceItemUpsertResult>;
  /** Marks the item deleted and clears its body. Only on a positive signal from the source. */
  abstract removeItem(input: {
    sequenceId: string;
    externalId: string;
    writtenBy: string;
    deletedAt?: Date;
  }): Promise<KnowledgeSequenceItemRemoveResult>;
  /**
   * One item by its store `id`, deleted ones included (body cleared), or null when the sequence
   * isn't a live sequence page readable under `read` or has no such item.
   */
  abstract getItem(input: {
    sequenceId: string;
    id: string;
    read: KnowledgeReadScope;
  }): Promise<KnowledgeSequenceItemRecord | null>;
  abstract listItems(input: ListKnowledgeSequenceItemsInput): Promise<KnowledgeSequenceItemsPage>;
  /**
   * Keyword search over item bodies. Ranked by how many query words match, then newest
   * `occurredAt`, then `id`. Deleted items never match. The visibility filter applies before the
   * limit, so a hidden sequence can't take a slot.
   */
  abstract searchItems(input: SearchKnowledgeSequenceItemsInput): Promise<KnowledgeSequenceItemRecord[]>;
  /**
   * Deletes up to `limit` items of a sequence whose page was deleted before `deletedBefore`, and
   * the sequence mark with the last batch (`done`). Refuses a live page, or one deleted since.
   * `purgedIds` come in no particular order. Until the purge, deleting the page only hides its
   * items: the mark and every item stay stored.
   */
  abstract purgeItems(input: {
    sequenceId: string;
    deletedBefore: Date;
    limit: number;
  }): Promise<KnowledgeSequencePurgeResult>;
}

/** The fields an upsert compares to decide `unchanged`. */
export function sameKnowledgeSequenceItem(
  stored: KnowledgeSequenceItemRecord,
  input: UpsertKnowledgeSequenceItemInput,
): boolean {
  return (
    stored.body === input.body &&
    stored.occurredAt.getTime() === input.occurredAt.getTime() &&
    (stored.editedAt?.getTime() ?? null) === (input.editedAt?.getTime() ?? null) &&
    stored.threadExternalId === (input.threadExternalId ?? null) &&
    stored.author?.sourceId === input.author?.sourceId &&
    (stored.author?.name ?? null) === (input.author?.name ?? null)
  );
}

/** Older than what's stored: an edit time before the stored one, or none when one is stored. */
export function isStaleKnowledgeSequenceEdit(
  stored: KnowledgeSequenceItemRecord,
  input: UpsertKnowledgeSequenceItemInput,
): boolean {
  if (!stored.editedAt) return false;
  return !input.editedAt || input.editedAt.getTime() < stored.editedAt.getTime();
}

export function checkKnowledgeSequenceItemInput(input: UpsertKnowledgeSequenceItemInput): void {
  if (!input.externalId) throw new TypeError('A sequence item needs an externalId.');
  for (const [name, value] of [
    ['occurredAt', input.occurredAt],
    ['editedAt', input.editedAt],
  ] as const) {
    if (value != null && (!(value instanceof Date) || Number.isNaN(value.getTime()))) {
      throw new TypeError(`A sequence item's ${name} must be a valid Date.`);
    }
  }
}

export function checkKnowledgeSequenceReadLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_KNOWLEDGE_SEQUENCE_READ_LIMIT) {
    throw new RangeError(`A sequence read takes a limit from 1 to ${MAX_KNOWLEDGE_SEQUENCE_READ_LIMIT}.`);
  }
}

/** Opaque `(occurredAt, id)` position after the last item returned. */
export function encodeKnowledgeSequenceCursor(item: { occurredAt: Date; id: string }): string {
  return `t${item.occurredAt.getTime()}_${item.id}`;
}

export function decodeKnowledgeSequenceCursor(cursor: string): { occurredAt: number; id: string } {
  const match = /^t(-?\d+)_(.+)$/.exec(cursor);
  const occurredAt = Number(match?.[1]);
  if (!match || !Number.isSafeInteger(occurredAt)) throw new TypeError('Not a sequence cursor.');
  return { occurredAt, id: match[2]! };
}

const ISO_PARTS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-](\d{2}):(\d{2}))$/;

/**
 * Reads an ISO 8601 date-time with a zone into a Date, refusing a calendar-impossible one
 * (`2026-02-30`, `25:00`) that `Date.parse` would roll over into another day.
 */
export function parseKnowledgeSequenceTime(value: string): Date | undefined {
  const parts = ISO_PARTS.exec(value);
  if (!parts) return undefined;
  const [y, mo, d, h, mi, s, oh, om] = parts.slice(1).map(part => Number(part ?? 0));
  const day = new Date(Date.UTC(y!, mo! - 1, d!));
  if (day.getUTCMonth() !== mo! - 1 || day.getUTCDate() !== d!) return undefined;
  if (h! > 23 || mi! > 59 || s! > 59 || oh! > 23 || om! > 59) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time);
}
