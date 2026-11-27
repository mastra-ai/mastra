import { knowledgePositionBetween } from './pages';
import type { KnowledgeReadScope } from './pages';

/**
 * Sequences: a page whose ordered items (chat messages, deploys, milestones) live in their own table, keyed by
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

/**
 * How a sequence orders its items, fixed when the page is marked: `timeline` by `occurredAt`, or
 * `position` by a fractional key set where the item goes.
 */
export type KnowledgeSequenceOrderBy = 'timeline' | 'position';

/** A position key: `[0-9a-z]`, never ending in `0`, as `knowledgePositionBetween` makes. */
export const KNOWLEDGE_SEQUENCE_POSITION = /^[0-9a-z]*[1-9a-z]$/;

/** At most this many properties in one properties schema. */
export const MAX_KNOWLEDGE_SEQUENCE_SCHEMA_PROPERTIES = 50;
/** At most this many entries in a scalar array property, and the largest `maxItems`. */
export const MAX_KNOWLEDGE_SEQUENCE_SCHEMA_ARRAY_ITEMS = 1000;
/** At most this many declared item types on one sequence. */
export const MAX_KNOWLEDGE_SEQUENCE_ITEM_TYPES = 50;
/** At most this many bytes for a sequence's `itemTypes`, and for its `propertiesSchema`, as JSON. */
export const MAX_KNOWLEDGE_SEQUENCE_DECLARATION_BYTES = 64 * 1024;
/** At most this many levels of objects and arrays in item properties or a declaration, the outer object counting as one. */
export const MAX_KNOWLEDGE_SEQUENCE_JSON_DEPTH = 64;
export const MAX_KNOWLEDGE_SEQUENCE_ITEM_TYPE_LABEL = 80;
export const MAX_KNOWLEDGE_SEQUENCE_ITEM_TYPE_DESCRIPTION = 500;

/** One property of a properties schema: a scalar, an ISO 8601 `date` string, or an array of scalars. */
export type KnowledgeSequencePropertySchema =
  | { type: 'string'; enum?: string[]; description?: string }
  | { type: 'number'; enum?: number[]; description?: string }
  | { type: 'boolean'; description?: string }
  | { type: 'date'; description?: string }
  | {
      type: 'array';
      items: { type: 'string' | 'number' };
      /** At most {@link MAX_KNOWLEDGE_SEQUENCE_SCHEMA_ARRAY_ITEMS}, which is also the default. */
      maxItems?: number;
      description?: string;
    };

/**
 * A small JSON Schema subset for item properties, the same one page properties will use. Keys it
 * doesn't name are allowed and unchecked (`additionalProperties` is always true).
 */
export interface KnowledgeSequencePropertiesSchema {
  type: 'object';
  /** At most {@link MAX_KNOWLEDGE_SEQUENCE_SCHEMA_PROPERTIES}. */
  properties: Record<string, KnowledgeSequencePropertySchema>;
  /** Keys of `properties` an item must have. */
  required?: string[];
}

/** A declared item type: how to show it, and the schema its items' properties must meet, if any. */
export interface KnowledgeSequenceItemType {
  label?: string;
  description?: string;
  propertiesSchema?: KnowledgeSequencePropertiesSchema;
}

/** Declared item types by type key. Items may also use types that aren't declared; those are free-form. */
export type KnowledgeSequenceItemTypes = Record<string, KnowledgeSequenceItemType>;

/** What a sequence was marked with. */
export interface KnowledgeSequenceRecord {
  pageId: string;
  orderBy: KnowledgeSequenceOrderBy;
  /** The schema for untyped items; null for none. */
  propertiesSchema: KnowledgeSequencePropertiesSchema | null;
  itemTypes: KnowledgeSequenceItemTypes | null;
}

/** The input to {@link KnowledgeSequencesStorage.markSequence}. */
export interface MarkKnowledgeSequenceInput {
  pageId: string;
  /** Default `timeline`. Fixed once marked. */
  orderBy?: KnowledgeSequenceOrderBy;
  /** The schema for untyped items. Left out means none. */
  propertiesSchema?: KnowledgeSequencePropertiesSchema | null;
  /** Left out means none. */
  itemTypes?: KnowledgeSequenceItemTypes | null;
}

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
  /**
   * When it happened at the source. A `timeline` sequence orders by this, then by `id`; a `position`
   * one may leave it null.
   */
  occurredAt: Date | null;
  /** Its order key on a `position` sequence (then by `id`); null on a `timeline` one. */
  position: string | null;
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
  /** Required on a `timeline` sequence. */
  occurredAt?: Date | null;
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
  /**
   * Where it goes on a `position` sequence, at most one of: an explicit `position` key, or `after` /
   * `before` another item's `externalId`. Left out, a new item goes last and an existing one stays
   * put. Refused on a `timeline` sequence.
   */
  position?: string;
  after?: string;
  before?: string;
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
  /**
   * Along the sequence's order, descending or ascending. Defaults to `desc` (newest first) on a
   * `timeline` sequence and `asc` (first position first) on a `position` one.
   */
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

/** The page is already a sequence with the other `orderBy`, which can't change. Nothing was written. */
export class KnowledgeSequenceOrderByChangeError extends Error {
  constructor(
    readonly pageId: string,
    readonly orderBy: KnowledgeSequenceOrderBy,
  ) {
    super(`Knowledge sequence ${pageId} is ordered by ${orderBy}, which can't change.`);
    this.name = 'KnowledgeSequenceOrderByChangeError';
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

/**
 * The item's properties don't meet the schema that applies to it: its type's, or the sequence's for
 * an untyped item. Names the type (null when untyped) and the first failing key. Nothing was written.
 */
export class KnowledgeSequenceItemPropertiesError extends KnowledgeSequenceItemInvalidError {
  constructor(
    readonly itemType: string | null,
    readonly key: string,
    problem: string,
  ) {
    super(
      'properties',
      `A sequence item's ${JSON.stringify(key)} property ${problem} (${itemType ? `type ${JSON.stringify(itemType)}` : 'untyped item'}).`,
    );
    this.name = 'KnowledgeSequenceItemPropertiesError';
  }
}

/** A sequence's `propertiesSchema` or `itemTypes` breaks the schema rules or a limit. Nothing was written. */
export class KnowledgeSequenceSchemaInvalidError extends TypeError {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`A sequence's ${path} ${message}`);
    this.name = 'KnowledgeSequenceSchemaInvalidError';
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
   * live child pages, `KnowledgeNotFoundError` when it isn't live, and
   * {@link KnowledgeSequenceSchemaInvalidError} for a bad schema. Marking it again is a whole
   * re-declaration: the same `orderBy` and schemas (key order aside) are `unchanged` and write
   * nothing; changed schemas replace the stored ones in place (`updated`), checking no existing item;
   * another `orderBy` (default `timeline`) is {@link KnowledgeSequenceOrderByChangeError}.
   */
  abstract markSequence(input: MarkKnowledgeSequenceInput): Promise<{ status: 'created' | 'unchanged' | 'updated' }>;
  /** What the page was marked with, live or deleted, or null when it isn't a sequence. For the host; no read scope. */
  abstract getSequence(input: { pageId: string }): Promise<KnowledgeSequenceRecord | null>;
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
   * `occurredAt` (undated last), then `id`. Deleted items never match. The visibility filter applies before the
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

/** The fields an upsert compares to decide `unchanged`; `position` is the key the upsert resolved. */
export function sameKnowledgeSequenceItem(
  stored: KnowledgeSequenceItemRecord,
  input: UpsertKnowledgeSequenceItemInput,
  position: string | null,
): boolean {
  const next = knowledgeSequenceItemContent(input);
  return (
    (stored.occurredAt?.getTime() ?? null) === (input.occurredAt?.getTime() ?? null) &&
    stored.position === position &&
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

function schemaInvalid(path: string, message: string): never {
  throw new KnowledgeSequenceSchemaInvalidError(path, message);
}

function checkKeys(value: object, allowed: string[], path: string): void {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) schemaInvalid(path, `takes no ${JSON.stringify(key)}.`);
}

function checkDescription(value: unknown, path: string): void {
  if (value === undefined) return;
  if (typeof value !== 'string' || value.length > MAX_KNOWLEDGE_SEQUENCE_ITEM_TYPE_DESCRIPTION) {
    schemaInvalid(path, `must be a string of at most ${MAX_KNOWLEDGE_SEQUENCE_ITEM_TYPE_DESCRIPTION} characters.`);
  }
}

function checkPropertySchema(value: unknown, path: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) schemaInvalid(path, 'must be an object.');
  const property = value as Record<string, unknown>;
  checkDescription(property.description, `${path}.description`);
  switch (property.type) {
    case 'string':
    case 'number': {
      checkKeys(property, ['type', 'enum', 'description'], path);
      if (property.enum === undefined) return;
      if (
        !Array.isArray(property.enum) ||
        property.enum.length === 0 ||
        !property.enum.every(entry =>
          property.type === 'string' ? typeof entry === 'string' : typeof entry === 'number' && Number.isFinite(entry),
        )
      ) {
        schemaInvalid(`${path}.enum`, `must be a non-empty list of ${property.type}s.`);
      }
      return;
    }
    case 'boolean':
    case 'date':
      checkKeys(property, ['type', 'description'], path);
      return;
    case 'array': {
      checkKeys(property, ['type', 'items', 'maxItems', 'description'], path);
      const items = property.items as Record<string, unknown> | undefined;
      if (!items || typeof items !== 'object' || (items.type !== 'string' && items.type !== 'number')) {
        schemaInvalid(`${path}.items`, "must be { type: 'string' } or { type: 'number' }.");
      }
      checkKeys(items, ['type'], `${path}.items`);
      const { maxItems } = property;
      if (
        maxItems !== undefined &&
        (!Number.isInteger(maxItems) ||
          (maxItems as number) < 0 ||
          (maxItems as number) > MAX_KNOWLEDGE_SEQUENCE_SCHEMA_ARRAY_ITEMS)
      ) {
        schemaInvalid(
          `${path}.maxItems`,
          `must be a whole number from 0 to ${MAX_KNOWLEDGE_SEQUENCE_SCHEMA_ARRAY_ITEMS}.`,
        );
      }
      return;
    }
    default:
      schemaInvalid(`${path}.type`, "must be 'string', 'number', 'boolean', 'date' or 'array'.");
  }
}

function checkPropertiesSchema(value: unknown, path: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) schemaInvalid(path, 'must be an object.');
  const schema = value as Record<string, unknown>;
  checkKeys(schema, ['type', 'properties', 'required'], path);
  if (schema.type !== 'object') schemaInvalid(`${path}.type`, "must be 'object'.");
  const properties = schema.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    schemaInvalid(`${path}.properties`, 'must be an object.');
  }
  const keys = Object.keys(properties);
  if (keys.length > MAX_KNOWLEDGE_SEQUENCE_SCHEMA_PROPERTIES) {
    schemaInvalid(`${path}.properties`, `are at most ${MAX_KNOWLEDGE_SEQUENCE_SCHEMA_PROPERTIES}.`);
  }
  for (const key of keys)
    checkPropertySchema((properties as Record<string, unknown>)[key], `${path}.properties.${key}`);
  if (schema.required !== undefined) {
    if (
      !Array.isArray(schema.required) ||
      !schema.required.every(key => typeof key === 'string' && keys.includes(key))
    ) {
      schemaInvalid(`${path}.required`, 'must list keys of properties.');
    }
  }
}

function checkDeclarationSize(value: unknown, path: string): void {
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_KNOWLEDGE_SEQUENCE_DECLARATION_BYTES) {
    schemaInvalid(path, `is at most ${MAX_KNOWLEDGE_SEQUENCE_DECLARATION_BYTES} bytes as JSON.`);
  }
}

/**
 * Checks a sequence declaration's `propertiesSchema` and `itemTypes` (plain JSON, the schema subset,
 * the limits) and returns them in stored form: absent and null both become null.
 * Refuses with {@link KnowledgeSequenceSchemaInvalidError}.
 */
export function checkKnowledgeSequenceDeclaration(
  input: Pick<MarkKnowledgeSequenceInput, 'propertiesSchema' | 'itemTypes'>,
): Pick<KnowledgeSequenceRecord, 'propertiesSchema' | 'itemTypes'> {
  const propertiesSchema = input.propertiesSchema ?? null;
  const itemTypes = input.itemTypes ?? null;
  if (propertiesSchema !== null) {
    checkDeclarationJson(propertiesSchema, 'propertiesSchema', 'must be plain JSON.');
    checkDeclarationSize(propertiesSchema, 'propertiesSchema');
    checkPropertiesSchema(propertiesSchema, 'propertiesSchema');
  }
  if (itemTypes !== null) {
    if (!itemTypes || typeof itemTypes !== 'object' || Array.isArray(itemTypes)) {
      schemaInvalid('itemTypes', 'must be a plain JSON object.');
    }
    checkDeclarationJson(itemTypes, 'itemTypes', 'must be a plain JSON object.');
    checkDeclarationSize(itemTypes, 'itemTypes');
    const keys = Object.keys(itemTypes);
    if (keys.length > MAX_KNOWLEDGE_SEQUENCE_ITEM_TYPES) {
      schemaInvalid('itemTypes', `are at most ${MAX_KNOWLEDGE_SEQUENCE_ITEM_TYPES}.`);
    }
    for (const key of keys) {
      const path = `itemTypes.${key}`;
      if (!KNOWLEDGE_SEQUENCE_ITEM_TYPE.test(key)) schemaInvalid(path, 'must be keyed by an item type key.');
      const entry = itemTypes[key] as unknown;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) schemaInvalid(path, 'must be an object.');
      const declared = entry as Record<string, unknown>;
      checkKeys(declared, ['label', 'description', 'propertiesSchema'], path);
      if (
        declared.label !== undefined &&
        (typeof declared.label !== 'string' || declared.label.length > MAX_KNOWLEDGE_SEQUENCE_ITEM_TYPE_LABEL)
      ) {
        schemaInvalid(
          `${path}.label`,
          `must be a string of at most ${MAX_KNOWLEDGE_SEQUENCE_ITEM_TYPE_LABEL} characters.`,
        );
      }
      checkDescription(declared.description, `${path}.description`);
      if (declared.propertiesSchema !== undefined)
        checkPropertiesSchema(declared.propertiesSchema, `${path}.propertiesSchema`);
    }
  }
  return { propertiesSchema, itemTypes };
}

/** Whether two stored declarations are the same, key order aside. */
export function sameKnowledgeSequenceDeclaration(
  a: Pick<KnowledgeSequenceRecord, 'propertiesSchema' | 'itemTypes'>,
  b: Pick<KnowledgeSequenceRecord, 'propertiesSchema' | 'itemTypes'>,
): boolean {
  return (
    canonicalJson(a.propertiesSchema) === canonicalJson(b.propertiesSchema) &&
    canonicalJson(a.itemTypes) === canonicalJson(b.itemTypes)
  );
}

/**
 * The one schema an item's properties must meet: its type's when that type is declared with one;
 * the sequence's for an untyped item; otherwise none (free-form).
 */
export function knowledgeSequenceItemSchema(
  sequence: Pick<KnowledgeSequenceRecord, 'propertiesSchema' | 'itemTypes'>,
  type: string | null,
): KnowledgeSequencePropertiesSchema | null {
  if (type === null) return sequence.propertiesSchema;
  return sequence.itemTypes?.[type]?.propertiesSchema ?? null;
}

function checkItemProperties(
  schema: KnowledgeSequencePropertiesSchema,
  type: string | null,
  properties: Record<string, unknown> | null,
): void {
  const required = new Set(schema.required ?? []);
  for (const [key, property] of Object.entries(schema.properties)) {
    const fail = (problem: string): never => {
      throw new KnowledgeSequenceItemPropertiesError(type, key, problem);
    };
    if (!properties || !Object.hasOwn(properties, key)) {
      if (required.has(key)) fail('is required');
      continue;
    }
    const value = properties[key];
    switch (property.type) {
      case 'string':
      case 'number':
        if (property.type === 'string' ? typeof value !== 'string' : typeof value !== 'number') {
          fail(`must be a ${property.type}`);
        }
        if (property.enum && !(property.enum as unknown[]).includes(value)) fail('is not one of its allowed values');
        break;
      case 'boolean':
        if (typeof value !== 'boolean') fail('must be a boolean');
        break;
      case 'date':
        if (typeof value !== 'string' || !parseKnowledgeSequenceTime(value)) fail('must be an ISO 8601 date');
        break;
      case 'array': {
        const max = property.maxItems ?? MAX_KNOWLEDGE_SEQUENCE_SCHEMA_ARRAY_ITEMS;
        if (!Array.isArray(value)) fail(`must be a list of ${property.items.type}s`);
        if ((value as unknown[]).length > max) fail(`takes at most ${max} entries`);
        if (!(value as unknown[]).every(entry => typeof entry === property.items.type)) {
          fail(`must be a list of ${property.items.type}s`);
        }
        break;
      }
    }
  }
}

/**
 * Whether `value` survives JSON unchanged, so what's validated, measured, compared and stored is
 * the same value: plain objects and arrays of own, enumerable data properties (no getters, symbol
 * keys, hidden `toJSON` hooks or holes), no cycles, finite numbers, strings, booleans and null.
 */
function isJsonValue(root: unknown): boolean | 'too-deep' {
  // An explicit stack, not recursion: a deeply nested value within the size limits is checked
  // without exhausting the call stack.
  const ancestors = new Set<object>();
  const stack: { value: object; children: unknown[]; next: number }[] = [];
  const enter = (value: unknown): boolean => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value !== 'object' || ancestors.has(value)) return false;
    const array = Array.isArray(value);
    const proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) return false;
    const keys = Reflect.ownKeys(value).filter(key => !(array && key === 'length'));
    if (array && !keys.every((key, index) => key === String(index))) return false;
    if (array && keys.length !== (value as unknown[]).length) return false;
    const children: unknown[] = [];
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor)) return false;
      children.push(descriptor.value);
    }
    ancestors.add(value);
    stack.push({ value, children, next: 0 });
    return true;
  };
  if (!enter(root)) return false;
  while (stack.length > 0) {
    // Deeper values can't be measured, compared or stored without risking the call stack.
    if (stack.length > MAX_KNOWLEDGE_SEQUENCE_JSON_DEPTH) return 'too-deep';
    const top = stack.at(-1)!;
    if (top.next === top.children.length) {
      ancestors.delete(top.value);
      stack.pop();
    } else if (!enter(top.children[top.next++])) {
      return false;
    }
  }
  return true;
}

/** Refuses a declaration part that isn't plain JSON or nests too deep. */
function checkDeclarationJson(value: unknown, path: string, message: string): void {
  const json = isJsonValue(value);
  if (json === 'too-deep') schemaInvalid(path, `nests at most ${MAX_KNOWLEDGE_SEQUENCE_JSON_DEPTH} levels.`);
  if (!json) schemaInvalid(path, message);
}

function invalid(field: string, message: string): never {
  throw new KnowledgeSequenceItemInvalidError(field, `A sequence item's ${field} ${message}`);
}

/**
 * Checks an item against the item rules and the schema that applies to it
 * ({@link knowledgeSequenceItemSchema}). Refuses with {@link KnowledgeSequenceItemInvalidError}, or
 * {@link KnowledgeSequenceItemPropertiesError} for the schema.
 */
export function checkKnowledgeSequenceItemInput(
  input: UpsertKnowledgeSequenceItemInput,
  sequence: Pick<KnowledgeSequenceRecord, 'orderBy' | 'propertiesSchema' | 'itemTypes'>,
): void {
  const { orderBy } = sequence;
  if (!input.externalId) throw new TypeError('A sequence item needs an externalId.');
  const placements = [input.position, input.after, input.before].filter(value => value !== undefined);
  if (orderBy === 'timeline') {
    if (!input.occurredAt) invalid('occurredAt', 'is required on a timeline sequence.');
    if (placements.length) invalid('position', 'is set only on a position sequence.');
  } else {
    if (placements.length > 1) invalid('position', 'takes one of position, after or before.');
    if (input.position !== undefined && !KNOWLEDGE_SEQUENCE_POSITION.test(input.position)) {
      invalid('position', 'must be [0-9a-z] and not end in 0.');
    }
    if (input.after === input.externalId || input.before === input.externalId) {
      invalid('position', "can't be placed next to itself.");
    }
  }
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
    const json = isJsonValue(properties);
    if (json === 'too-deep') invalid('properties', `nest at most ${MAX_KNOWLEDGE_SEQUENCE_JSON_DEPTH} levels.`);
    if (!json) {
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
  const schema = knowledgeSequenceItemSchema(sequence, content.type);
  if (schema) checkItemProperties(schema, content.type, content.properties);
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

/**
 * The key a new or moved item takes on a `position` sequence. `neighbour(externalId, side)` returns
 * that item's position and the position next to it on `side`, skipping the item being written, or
 * null when there's no such item; `last()` the highest position, or null when empty.
 */
export async function knowledgeSequenceItemPosition(
  input: UpsertKnowledgeSequenceItemInput,
  stored: KnowledgeSequenceItemRecord | undefined,
  find: {
    neighbour(externalId: string, side: 'after' | 'before'): Promise<{ position: string; next: string | null } | null>;
    last(): Promise<string | null>;
    /** Whether another item of the sequence holds `position`. */
    taken(position: string): Promise<boolean>;
  },
): Promise<string> {
  if (input.position !== undefined) {
    // Keys stay unique, so an anchor's neighbour never shares its key and there's always room beside it.
    if (input.position !== stored?.position && (await find.taken(input.position))) {
      invalid('position', `${JSON.stringify(input.position)} is held by another item.`);
    }
    return input.position;
  }
  for (const side of ['after', 'before'] as const) {
    const anchor = input[side];
    if (anchor === undefined) continue;
    const found = await find.neighbour(anchor, side);
    if (!found) invalid('position', `names no item ${JSON.stringify(anchor)} to go ${side}.`);
    return side === 'after'
      ? knowledgePositionBetween(found.position, found.next ?? undefined)
      : knowledgePositionBetween(found.next ?? undefined, found.position);
  }
  if (stored?.position) return stored.position;
  return knowledgePositionBetween((await find.last()) ?? undefined);
}

/** Opaque position after the last item returned: `(occurredAt, id)` or `(position, id)`. */
export function encodeKnowledgeSequenceCursor(item: {
  occurredAt: Date | null;
  position: string | null;
  id: string;
}): string {
  return item.position !== null ? `p${item.position}_${item.id}` : `t${item.occurredAt!.getTime()}_${item.id}`;
}

export type KnowledgeSequenceCursor =
  | { orderBy: 'timeline'; occurredAt: number; id: string }
  | { orderBy: 'position'; position: string; id: string };

/** Refuses (TypeError) a malformed cursor or one of the other order mode. */
export function decodeKnowledgeSequenceCursor(
  cursor: string,
  orderBy: KnowledgeSequenceOrderBy,
): KnowledgeSequenceCursor {
  if (orderBy === 'position') {
    const match = /^p([0-9a-z]+)_(.+)$/.exec(cursor);
    if (!match) throw new TypeError('Not a position sequence cursor.');
    return { orderBy, position: match[1]!, id: match[2]! };
  }
  const match = /^t(-?\d+)_(.+)$/.exec(cursor);
  const occurredAt = Number(match?.[1]);
  if (!match || !Number.isSafeInteger(occurredAt)) throw new TypeError('Not a timeline sequence cursor.');
  return { orderBy, occurredAt, id: match[2]! };
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
