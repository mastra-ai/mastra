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

/** At most this many links on one item. */
export const MAX_KNOWLEDGE_SEQUENCE_ITEM_LINKS = 10;
/** At most this many characters in an item's one-line title (and a link's title). */
export const MAX_KNOWLEDGE_SEQUENCE_ITEM_TITLE = 300;
/** At most this many bytes of an item's properties, serialized as JSON. */
export const MAX_KNOWLEDGE_SEQUENCE_ITEM_PROPERTIES_BYTES = 16 * 1024;
/** At most this many types in one `types` read filter. */
export const MAX_KNOWLEDGE_SEQUENCE_TYPE_FILTER = 20;
/** An item type key: lowercase letters, digits, `_` and `-`, starting with a letter or digit, at most 64 characters. */
export const KNOWLEDGE_SEQUENCE_ITEM_TYPE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export interface KnowledgeSequenceItemLink {
  /** An http(s) URL. */
  url: string;
  title?: string;
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
  /**
   * Set when the source deleted it. Its title, body, links and properties are cleared and the row
   * kept, so a replay can't bring it back.
   */
  deletedAt: Date | null;
  author: KnowledgeSequenceItemAuthor | null;
  /**
   * The `externalId` of the item this one sits under, on the same sequence. One level: a parent has
   * no parent of its own.
   */
  externalParentId: string | null;
  /** The item's kind, e.g. `deploy`; null when untyped. A delete keeps it. */
  type: string | null;
  /** One line. */
  title: string | null;
  /** Markdown. */
  body: string | null;
  links: KnowledgeSequenceItemLink[];
  /** A JSON object. */
  properties: Record<string, unknown> | null;
  /** Starts at 1 and goes up by one with each change. */
  version: number;
  /** The Knowledge writer of the last change, e.g. `importer:slack`. */
  writtenBy: string;
}

/**
 * The whole item: an upsert replaces every field, so one left out is cleared. It needs some content:
 * a title, body, link or property.
 */
export interface UpsertKnowledgeSequenceItemInput {
  sequenceId: string;
  externalId: string;
  occurredAt: Date;
  editedAt?: Date | null;
  author?: KnowledgeSequenceItemAuthor | null;
  /** Refused with {@link KnowledgeSequenceParentNotFoundError} unless it names an item of this sequence. */
  externalParentId?: string | null;
  type?: string | null;
  /** One line, at most {@link MAX_KNOWLEDGE_SEQUENCE_ITEM_TITLE} characters. */
  title?: string | null;
  body?: string | null;
  /** At most {@link MAX_KNOWLEDGE_SEQUENCE_ITEM_LINKS}. */
  links?: KnowledgeSequenceItemLink[] | null;
  /** A JSON object of at most {@link MAX_KNOWLEDGE_SEQUENCE_ITEM_PROPERTIES_BYTES} bytes. */
  properties?: Record<string, unknown> | null;
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
  /** Only the item with this `externalId` and the items under it. */
  externalParentId?: string;
  /** Newest first (`desc`, the default) or oldest first. */
  order?: 'asc' | 'desc';
  /** At most {@link MAX_KNOWLEDGE_SEQUENCE_READ_LIMIT}. */
  limit: number;
  /** The `nextCursor` of the previous read, with the same other arguments. */
  cursor?: string;
  /** Include deleted items (content cleared). Off by default. */
  includeDeleted?: boolean;
  /** See {@link knowledgeSequenceTypeFilter}. */
  types?: string[];
  untyped?: boolean;
}

export interface KnowledgeSequenceItemsPage {
  items: KnowledgeSequenceItemRecord[];
  nextCursor: string | null;
}

export interface SearchKnowledgeSequenceItemsInput {
  /**
   * Matched by word, as page search does (`knowledgeSearchWords`): an item matches any word in its
   * title, body, link titles or string property values ({@link knowledgeSequenceItemSearchText}).
   */
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
  /** See {@link knowledgeSequenceTypeFilter}. */
  types?: string[];
  untyped?: boolean;
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

/** An item field breaks the item rules (no content, a field over its limit, a bad type key). Nothing was written. */
export class KnowledgeSequenceItemInvalidError extends TypeError {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = 'KnowledgeSequenceItemInvalidError';
  }
}

/** `externalParentId` names no item of the item's own sequence. Nothing was written. */
export class KnowledgeSequenceParentNotFoundError extends Error {
  constructor(
    readonly sequenceId: string,
    readonly externalParentId: string,
  ) {
    super(`Knowledge sequence ${sequenceId} has no item ${JSON.stringify(externalParentId)} to put an item under.`);
    this.name = 'KnowledgeSequenceParentNotFoundError';
  }
}

/** Items nest one level: the parent is itself under another item, or the item has items under it. Nothing was written. */
export class KnowledgeSequenceParentNestedError extends Error {
  constructor(
    readonly sequenceId: string,
    readonly externalId: string,
  ) {
    super(`Knowledge sequence items nest one level only; ${JSON.stringify(externalId)} can't go there.`);
    this.name = 'KnowledgeSequenceParentNestedError';
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
   * Upserts by `(sequenceId, externalId)`. Unchanged fields are `unchanged` and write nothing. The
   * sequence must be live; refuses with {@link KnowledgeSequenceItemInvalidError},
   * {@link KnowledgeSequenceParentNotFoundError} or {@link KnowledgeSequenceParentNestedError}.
   */
  abstract upsertItem(input: UpsertKnowledgeSequenceItemInput): Promise<KnowledgeSequenceItemUpsertResult>;
  /** Marks the item deleted and clears its content, keeping its type. Only on a positive signal from the source. */
  abstract removeItem(input: {
    sequenceId: string;
    externalId: string;
    writtenBy: string;
    deletedAt?: Date;
  }): Promise<KnowledgeSequenceItemRemoveResult>;
  /**
   * One item by its store `id`, deleted ones included (content cleared), or null when the sequence
   * isn't a live sequence page readable under `read` or has no such item.
   */
  abstract getItem(input: {
    sequenceId: string;
    id: string;
    read: KnowledgeReadScope;
  }): Promise<KnowledgeSequenceItemRecord | null>;
  abstract listItems(input: ListKnowledgeSequenceItemsInput): Promise<KnowledgeSequenceItemsPage>;
  /**
   * Keyword search over item text ({@link knowledgeSequenceItemSearchText}). Ranked by how many query words match, then newest
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
  const next = knowledgeSequenceItemContent(input);
  return (
    stored.occurredAt.getTime() === input.occurredAt.getTime() &&
    (stored.editedAt?.getTime() ?? null) === (input.editedAt?.getTime() ?? null) &&
    stored.author?.sourceId === input.author?.sourceId &&
    (stored.author?.name ?? null) === (input.author?.name ?? null) &&
    stored.externalParentId === next.externalParentId &&
    stored.type === next.type &&
    stored.title === next.title &&
    stored.body === next.body &&
    canonicalJson(stored.links) === canonicalJson(next.links) &&
    canonicalJson(stored.properties) === canonicalJson(next.properties)
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

/** JSON with object keys sorted, so two values compare equal whatever their key order. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : inner,
  );
}

/** The stored form of an item's optional fields: absent and empty both become null (or no links). */
export function knowledgeSequenceItemContent(
  input: UpsertKnowledgeSequenceItemInput,
): Pick<KnowledgeSequenceItemRecord, 'externalParentId' | 'type' | 'title' | 'body' | 'links' | 'properties'> {
  return {
    externalParentId: input.externalParentId || null,
    type: input.type ?? null,
    title: input.title || null,
    body: input.body || null,
    links: (input.links ?? []).map(link => (link.title ? { url: link.url, title: link.title } : { url: link.url })),
    properties: input.properties && Object.keys(input.properties).length > 0 ? { ...input.properties } : null,
  };
}

/**
 * The lowercased text search matches: title, body, link titles and string property values (also
 * strings inside arrays), one per line. Property keys, numbers and booleans aren't matched.
 */
export function knowledgeSequenceItemSearchText(
  item: Pick<KnowledgeSequenceItemRecord, 'title' | 'body' | 'links' | 'properties'>,
): string {
  const parts: string[] = [];
  if (item.title) parts.push(item.title);
  if (item.body) parts.push(item.body);
  for (const link of item.links) if (link.title) parts.push(link.title);
  for (const value of Object.values(item.properties ?? {})) {
    for (const inner of Array.isArray(value) ? value : [value]) if (typeof inner === 'string') parts.push(inner);
  }
  return parts.join('\n').toLowerCase();
}

/**
 * Whether `value` survives JSON unchanged, so what's validated, measured, compared and stored is
 * the same value: plain objects and arrays of own, enumerable data properties (no getters, symbol
 * keys, hidden `toJSON` hooks or holes), no cycles, finite numbers, strings, booleans and null.
 */
function isJsonValue(value: unknown, ancestors: Set<object> = new Set()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  const array = Array.isArray(value);
  const proto = Object.getPrototypeOf(value);
  if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) return false;
  const keys = Reflect.ownKeys(value).filter(key => !(array && key === 'length'));
  if (array && keys.length !== (value as unknown[]).length) return false;
  const children: unknown[] = [];
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor)) return false;
    children.push(descriptor.value);
  }
  ancestors.add(value);
  const ok = children.every(child => isJsonValue(child, ancestors));
  ancestors.delete(value);
  return ok;
}

function invalid(field: string, message: string): never {
  throw new KnowledgeSequenceItemInvalidError(field, `A sequence item's ${field} ${message}`);
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
  const { title, links, properties, type, externalParentId } = input;
  if (title && (title.length > MAX_KNOWLEDGE_SEQUENCE_ITEM_TITLE || /[\r\n]/.test(title))) {
    invalid('title', `must be one line of at most ${MAX_KNOWLEDGE_SEQUENCE_ITEM_TITLE} characters.`);
  }
  if (links) {
    if (links.length > MAX_KNOWLEDGE_SEQUENCE_ITEM_LINKS) {
      invalid('links', `are at most ${MAX_KNOWLEDGE_SEQUENCE_ITEM_LINKS}.`);
    }
    for (const link of links) {
      let protocol: string | undefined;
      try {
        protocol = new URL(link.url).protocol;
      } catch {
        protocol = undefined;
      }
      if (protocol !== 'http:' && protocol !== 'https:') invalid('links', 'must be http(s) URLs.');
      if (link.title && link.title.length > MAX_KNOWLEDGE_SEQUENCE_ITEM_TITLE) {
        invalid('links', `titles are at most ${MAX_KNOWLEDGE_SEQUENCE_ITEM_TITLE} characters.`);
      }
    }
  }
  if (properties != null) {
    if (typeof properties !== 'object' || Array.isArray(properties)) invalid('properties', 'must be a JSON object.');
    if (!isJsonValue(properties)) {
      invalid(
        'properties',
        'must be plain JSON: no undefined, holes, cycles, getters, hidden or symbol keys, functions, non-finite numbers or class instances.',
      );
    }
    if (new TextEncoder().encode(JSON.stringify(properties)).length > MAX_KNOWLEDGE_SEQUENCE_ITEM_PROPERTIES_BYTES) {
      invalid('properties', `are at most ${MAX_KNOWLEDGE_SEQUENCE_ITEM_PROPERTIES_BYTES} bytes as JSON.`);
    }
  }
  if (type != null && !KNOWLEDGE_SEQUENCE_ITEM_TYPE.test(type)) {
    invalid('type', 'must be lowercase letters, digits, "_" or "-", starting with a letter or digit, at most 64.');
  }
  if (externalParentId && externalParentId === input.externalId)
    invalid('externalParentId', "can't be the item itself.");
  const content = knowledgeSequenceItemContent(input);
  if (!content.title && !content.body && content.links.length === 0 && !content.properties) {
    invalid('content', 'needs a title, body, link or property.');
  }
}

/**
 * The `types`/`untyped` read filter: `types` alone keeps those types; `untyped` alone keeps untyped
 * items; both keep either; neither keeps everything. Applied before the limit. Refuses (RangeError)
 * an empty `types`, more than {@link MAX_KNOWLEDGE_SEQUENCE_TYPE_FILTER}, or a malformed key.
 * Returns null when nothing is filtered.
 */
export function knowledgeSequenceTypeFilter(input: {
  types?: string[];
  untyped?: boolean;
}): { types: string[]; untyped: boolean } | null {
  const { types, untyped = false } = input;
  if (types !== undefined) {
    if (types.length === 0 || types.length > MAX_KNOWLEDGE_SEQUENCE_TYPE_FILTER) {
      throw new RangeError(`A sequence type filter takes 1 to ${MAX_KNOWLEDGE_SEQUENCE_TYPE_FILTER} types.`);
    }
    if (!types.every(type => KNOWLEDGE_SEQUENCE_ITEM_TYPE.test(type))) {
      throw new RangeError('A sequence type filter takes item type keys only.');
    }
  }
  if (!types && !untyped) return null;
  return { types: types ?? [], untyped };
}

/** Whether an item passes {@link knowledgeSequenceTypeFilter}'s result. */
export function knowledgeSequenceTypeMatches(
  filter: { types: string[]; untyped: boolean } | null,
  type: string | null,
): boolean {
  if (!filter) return true;
  return type === null ? filter.untyped : filter.types.includes(type);
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
