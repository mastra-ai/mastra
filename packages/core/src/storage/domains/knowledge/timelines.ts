import type { KnowledgeReadScope } from './pages';

/**
 * Timelines: a page whose dated entries (chat messages, events) live in their own table, keyed by
 * the source's ID, instead of one page per entry. Reached through {@link KnowledgeStorage.timelines},
 * so on a transaction view it writes in the same transaction as the page writes.
 *
 * Entries carry no scope: they are read through their timeline page, so moving or deleting the page
 * moves or hides every entry at once, with no entry rewritten.
 *
 * @experimental
 */

/** At most this many entries come back from one read; more continue by cursor. */
export const MAX_KNOWLEDGE_TIMELINE_READ_LIMIT = 100;

export interface KnowledgeTimelineEntryAuthor {
  /** The person's ID at the source. */
  sourceId: string;
  name?: string;
}

export interface KnowledgeTimelineEntryRecord {
  /** Store ID, stable for the entry's life: edits keep it. */
  id: string;
  /** The timeline page's ID. */
  timelineId: string;
  /** The source's own ID for the entry, unique within its timeline. Compared byte for byte. */
  externalId: string;
  /** When it happened at the source. Entries are ordered by this, then by `id`. */
  occurredAt: Date;
  /** When Knowledge first stored it. */
  writtenAt: Date;
  /** When the source last edited it, or null. */
  editedAt: Date | null;
  /** Set when the source deleted it. The body is cleared and the row kept, so a replay can't bring it back. */
  deletedAt: Date | null;
  author: KnowledgeTimelineEntryAuthor | null;
  /** The `externalId` of the thread's root entry, for a reply. */
  threadExternalId: string | null;
  body: string;
  /** Starts at 1 and goes up by one with each change. */
  version: number;
  /** The Knowledge writer of the last change, e.g. `importer:slack`. */
  writtenBy: string;
}

export interface UpsertKnowledgeTimelineEntryInput {
  timelineId: string;
  externalId: string;
  occurredAt: Date;
  editedAt?: Date | null;
  author?: KnowledgeTimelineEntryAuthor | null;
  threadExternalId?: string | null;
  body: string;
  writtenBy: string;
  /** Bring back an entry the source deleted. Without it, a deleted entry stays deleted. */
  restore?: boolean;
}

export type KnowledgeTimelineEntryUpsertResult =
  | { status: 'created' | 'updated' | 'unchanged'; entry: KnowledgeTimelineEntryRecord }
  /**
   * Nothing changed: the entry is deleted (and `restore` wasn't set), or the stored edit is newer
   * than this one, so an out-of-order replay can't roll an edit back.
   */
  | { status: 'ignored'; reason: 'deleted' | 'stale'; entry: KnowledgeTimelineEntryRecord };

export type KnowledgeTimelineEntryRemoveResult =
  | { status: 'removed' | 'unchanged'; entry: KnowledgeTimelineEntryRecord }
  /** No entry with that `externalId`; nothing was stored. */
  | { status: 'missing' };

export interface ListKnowledgeTimelineEntriesInput {
  timelineId: string;
  /** The timeline page must be live and readable under this scope, or the read finds nothing. */
  read: KnowledgeReadScope;
  /** `occurredAt >= since`. */
  since?: Date;
  /** `occurredAt < until`. */
  until?: Date;
  /** Only the thread with this root `externalId`: the root and its replies. */
  threadExternalId?: string;
  /** Newest first (`desc`, the default) or oldest first. */
  order?: 'asc' | 'desc';
  /** At most {@link MAX_KNOWLEDGE_TIMELINE_READ_LIMIT}. */
  limit: number;
  /** The `nextCursor` of the previous read, with the same other arguments. */
  cursor?: string;
  /** Include deleted entries (body cleared). Off by default. */
  includeDeleted?: boolean;
}

export interface KnowledgeTimelineEntriesPage {
  entries: KnowledgeTimelineEntryRecord[];
  nextCursor: string | null;
}

export type KnowledgeTimelinePurgeResult = { purgedIds: string[]; done: boolean };

/** The page has child pages, so it can't become a timeline. Nothing was written. */
export class KnowledgeTimelineNotLeafError extends Error {
  constructor(readonly pageId: string) {
    super(`Knowledge page ${pageId} has child pages, so it can't be a timeline.`);
    this.name = 'KnowledgeTimelineNotLeafError';
  }
}

/** The page isn't a live timeline. */
export class KnowledgeTimelineNotFoundError extends Error {
  constructor(readonly pageId: string) {
    super(`Knowledge page ${pageId} is not a live timeline.`);
    this.name = 'KnowledgeTimelineNotFoundError';
  }
}

/** Entries of a timeline are only purged once its page has been deleted longer than the caller's cutoff. */
export class KnowledgeTimelinePurgeRefusedError extends Error {
  constructor(readonly pageId: string) {
    super(`Knowledge timeline ${pageId} is live or was deleted after the purge cutoff; nothing was purged.`);
    this.name = 'KnowledgeTimelinePurgeRefusedError';
  }
}

export abstract class KnowledgeTimelinesStorage {
  /**
   * Makes a live page a timeline. Refuses with {@link KnowledgeTimelineNotLeafError} when it has
   * live child pages, and `KnowledgeNotFoundError` when it isn't live. Repeating it is `unchanged`.
   */
  abstract markTimeline(input: { pageId: string }): Promise<{ status: 'created' | 'unchanged' }>;
  /** The timelines among `pageIds`, live or deleted. */
  abstract listTimelineIds(input: { pageIds: string[] }): Promise<string[]>;
  /**
   * Upserts by `(timelineId, externalId)`. Unchanged content (body, author, times, thread) is
   * `unchanged` and writes nothing. The timeline must be live.
   */
  abstract upsertEntry(input: UpsertKnowledgeTimelineEntryInput): Promise<KnowledgeTimelineEntryUpsertResult>;
  /** Marks the entry deleted and clears its body. Only on a positive signal from the source. */
  abstract removeEntry(input: {
    timelineId: string;
    externalId: string;
    writtenBy: string;
    deletedAt?: Date;
  }): Promise<KnowledgeTimelineEntryRemoveResult>;
  abstract listEntries(input: ListKnowledgeTimelineEntriesInput): Promise<KnowledgeTimelineEntriesPage>;
  /**
   * Deletes up to `limit` entries of a timeline whose page was deleted before `deletedBefore`, and
   * the timeline mark with the last batch (`done`). Refuses a live page, or one deleted since.
   */
  abstract purgeEntries(input: {
    timelineId: string;
    deletedBefore: Date;
    limit: number;
  }): Promise<KnowledgeTimelinePurgeResult>;
}

/** The fields an upsert compares to decide `unchanged`. */
export function sameKnowledgeTimelineEntry(
  stored: KnowledgeTimelineEntryRecord,
  input: UpsertKnowledgeTimelineEntryInput,
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
export function isStaleKnowledgeTimelineEdit(
  stored: KnowledgeTimelineEntryRecord,
  input: UpsertKnowledgeTimelineEntryInput,
): boolean {
  if (!stored.editedAt) return false;
  return !input.editedAt || input.editedAt.getTime() < stored.editedAt.getTime();
}

export function checkKnowledgeTimelineEntryInput(input: UpsertKnowledgeTimelineEntryInput): void {
  if (!input.externalId) throw new TypeError('A timeline entry needs an externalId.');
  for (const [name, value] of [
    ['occurredAt', input.occurredAt],
    ['editedAt', input.editedAt],
  ] as const) {
    if (value != null && (!(value instanceof Date) || Number.isNaN(value.getTime()))) {
      throw new TypeError(`A timeline entry's ${name} must be a valid Date.`);
    }
  }
}

export function checkKnowledgeTimelineReadLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_KNOWLEDGE_TIMELINE_READ_LIMIT) {
    throw new RangeError(`A timeline read takes a limit from 1 to ${MAX_KNOWLEDGE_TIMELINE_READ_LIMIT}.`);
  }
}

/** Opaque `(occurredAt, id)` position after the last entry returned. */
export function encodeKnowledgeTimelineCursor(entry: { occurredAt: Date; id: string }): string {
  return `t${entry.occurredAt.getTime()}_${entry.id}`;
}

export function decodeKnowledgeTimelineCursor(cursor: string): { occurredAt: number; id: string } {
  const match = /^t(-?\d+)_(.+)$/.exec(cursor);
  const occurredAt = Number(match?.[1]);
  if (!match || !Number.isSafeInteger(occurredAt)) throw new TypeError('Not a timeline cursor.');
  return { occurredAt, id: match[2]! };
}

const ISO_PARTS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-](\d{2}):(\d{2}))$/;

/**
 * Reads an ISO 8601 date-time with a zone into a Date, refusing a calendar-impossible one
 * (`2026-02-30`, `25:00`) that `Date.parse` would roll over into another day.
 */
export function parseKnowledgeTimelineTime(value: string): Date | undefined {
  const parts = ISO_PARTS.exec(value);
  if (!parts) return undefined;
  const [y, mo, d, h, mi, s, oh, om] = parts.slice(1).map(part => Number(part ?? 0));
  const day = new Date(Date.UTC(y!, mo! - 1, d!));
  if (day.getUTCMonth() !== mo! - 1 || day.getUTCDate() !== d!) return undefined;
  if (h! > 23 || mi! > 59 || s! > 59 || oh! > 23 || om! > 59) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time);
}
