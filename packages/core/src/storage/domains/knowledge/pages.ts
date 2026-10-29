/**
 * Knowledge storage contract, schema 4: pages, notes, stamps, mentions and pins.
 *
 * The store holds structure and filters by a read scope that core computes from the run's scopes and
 * the Knowledge declarations; it holds no access policy of its own (no grant rows, no roles). Core
 * checks roles before every write, and resolves every write target through the run's read scope first,
 * so a page or note the run can't read behaves exactly like a missing id.
 *
 * Every adapter must implement these semantics; the physical layout (tables, columns, denormalized
 * filter columns, how a large read scope is passed to the database) is the adapter's choice. Any
 * denormalized scope column (a note's page scope, its stamp scopes' addresses, its mentions' home
 * scopes) must be updated in the same transaction as the move or merge that changes it.
 *
 * @experimental Knowledge APIs are experimental and may change without notice.
 */

/**
 * Who changed something, recorded on every page and note change.
 *
 * @experimental
 */
export interface KnowledgeProvenance {
  /** The writer, e.g. `agent:alex` or `host`. */
  author: string;
  /** The thread the change was made from, when there was one. */
  sourceThreadId?: string;
}

/**
 * One prefix entry of a read scope. A scope page matches when it was created from `declaration` and
 * its address starts with `prefix`. Prefix entries let a rule such as "`role:acme:admin` is editor on
 * every `team:$orgId:$teamId`" reach every Acme team without listing them, while template children
 * (`account:acme:1/internal`, declaration `account:$orgId:$accountId/internal`) never match a prefix
 * entry for their parent's declaration.
 *
 * @experimental
 */
export interface KnowledgeScopePrefix {
  /** The declaration key the scope page was materialized from, e.g. `team:$orgId:$teamId`. */
  declaration: string;
  /**
   * Address prefix, e.g. `team:acme:`. Empty matches every scope of the declaration. Core only emits
   * prefixes that end at a segment boundary (empty, or ending in `:`), so `team:acme:` never matches
   * `team:acmecorp:x`.
   */
  prefix: string;
}

/**
 * One tree-parent entry of a read scope, for a rule bound through the target type's `belongsTo`
 * (e.g. `role:$orgId:admin` is viewer on every `resource:$resourceId` that belongs to `org:$orgId`).
 * A scope page matches when it was created from `declaration` and its tree parent is `parentId`.
 *
 * @experimental
 */
export interface KnowledgeScopeChildren {
  declaration: string;
  /** Page id of the scope the rule's params bound (`org:acme`'s page). */
  parentId: string;
}

/**
 * The scopes a read may see, at viewer or above. `'all'` reads without an access filter and is only
 * for host surfaces behind their own auth (Studio); agent runs always pass a computed read scope.
 *
 * A scope page is readable when its address is in `addresses`, or it matches a `prefixes` or
 * `children` entry.
 * Matching is exact and case-sensitive by UTF-16 code unit, as in {@link knowledgeScopeReadable}. SQL
 * adapters must not use `LIKE` for prefixes: `_` and `%` are legal in addresses, and SQLite/MySQL
 * `LIKE` folds ASCII case. Compare a substring (or a binary range) instead.
 *
 * @experimental
 */
export type KnowledgeReadScope =
  | 'all'
  | {
      addresses: string[];
      prefixes: KnowledgeScopePrefix[];
      children: KnowledgeScopeChildren[];
    };

/**
 * A topic or entity. A scope is a page marked as a boundary (`isScope`, with an `address`). Every
 * page belongs to exactly one home scope (`scopeId`, the nearest scope page at or above it); a scope
 * page's `scopeId` is its own id.
 *
 * @experimental
 */
export interface KnowledgePage {
  id: string;
  /** The home scope's page id. Equal to `id` for a scope page. */
  scopeId: string;
  /** Tree parent. `null` only for root scope pages. */
  parentId: string | null;
  isScope: boolean;
  /** Canonical `type:value` address; scope pages only. */
  address?: string;
  /** Declaration key the scope page was materialized from; scope pages only. */
  declaration?: string;
  /** Stable key within the home scope (`org:acme#support-policy`); ordinary pages only, optional. */
  key?: string;
  /** Fractional ordering key among siblings; compare as code-unit strings. */
  position: string;
  name: string;
  /** Bounded synopsis, at most {@link MAX_KNOWLEDGE_PAGE_DESCRIPTION_TOKENS}. */
  description?: string;
  /** Curated long-form body. Unbounded. */
  body?: string;
  version: number;
  /** Set when the page was merged into another page. */
  mergedInto?: string;
  createdBy: KnowledgeProvenance;
  updatedBy: KnowledgeProvenance;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  deletedBy?: string;
}

/**
 * A short, attributed piece of durable knowledge attached to one page. Visible when its page is
 * visible, at least one stamp scope is readable, and every page it mentions is visible.
 *
 * @experimental
 */
export interface KnowledgeNote {
  id: string;
  pageId: string;
  text: string;
  /** When the fact was true or observed, if the writer gave one. */
  when?: Date;
  /** Scope page ids that narrow who can see the note (OR). Never empty. */
  stampScopeIds: string[];
  /**
   * Page ids resolved from `[[mentions]]` in `text` at write time. A resolved mention hides its note
   * unless the run can read the mentioned page's scope; the mentioned page's deleted or live state
   * doesn't affect visibility. Unresolved mentions have no entry and never hide a note.
   */
  mentions: string[];
  provenance: KnowledgeProvenance;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  deletedBy?: string;
}

/**
 * A reference to a page plus the run scopes it's delivered to (OR). One pin per page; pinning again
 * adds audience entries.
 *
 * @experimental
 */
export interface KnowledgePin {
  id: string;
  pageId: string;
  /** Scope addresses; a run holding any of them receives the pin if it can read the page. */
  audience: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Most levels a page may sit below its root scope. Creates and moves past it are refused.
 *
 * @experimental
 */
export const MAX_KNOWLEDGE_PAGE_DEPTH = 10;

/**
 * Most pages one move may carry (the page and everything under it). Larger moves are refused with
 * {@link KnowledgeMoveTooLargeError} instead of running in the background.
 *
 * @experimental
 */
export const MAX_KNOWLEDGE_MOVE_PAGES = 500;

/** @experimental */
export const MAX_KNOWLEDGE_PAGE_LIST_LIMIT = 100;

/**
 * Maximum page description in estimated tokens (tokenx), enforced by every adapter on create and
 * update.
 *
 * @experimental
 */
export const MAX_KNOWLEDGE_PAGE_DESCRIPTION_TOKENS = 100;

/**
 * Maximum note text in estimated tokens (tokenx), enforced by every adapter on add. Long-form text
 * belongs in a page body.
 *
 * @experimental
 */
export const MAX_KNOWLEDGE_NOTE_TOKENS = 250;

/** @experimental */
export class KnowledgeMoveTooLargeError extends Error {
  constructor(
    readonly pageId: string,
    readonly pages: number,
  ) {
    super(
      `Moving page ${pageId} would move ${pages} pages; at most ${MAX_KNOWLEDGE_MOVE_PAGES} move at once. Move smaller subtrees one at a time.`,
    );
    this.name = 'KnowledgeMoveTooLargeError';
  }
}

/** @experimental */
export class KnowledgePageDepthError extends Error {
  constructor(pageId: string) {
    super(`Page ${pageId} would sit more than ${MAX_KNOWLEDGE_PAGE_DEPTH} levels below its root scope.`);
    this.name = 'KnowledgePageDepthError';
  }
}

/** @experimental */
export class KnowledgePageHasChildrenError extends Error {
  constructor(pageId: string) {
    super(`Page ${pageId} has child pages. Move or delete them first.`);
    this.name = 'KnowledgePageHasChildrenError';
  }
}

/**
 * Canonical form used for exact-name lookup. Computed in JS so every adapter (and SQL collations)
 * agree on non-ASCII names; adapters store it rather than computing `lower()` in SQL.
 *
 * @experimental
 */
export function canonicalKnowledgeName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Whether a scope page is readable under `read`. Adapters that filter in memory use this; SQL
 * adapters must match it exactly.
 *
 * @experimental
 */
export function knowledgeScopeReadable(
  scope: Pick<KnowledgePage, 'address' | 'declaration' | 'parentId'>,
  read: KnowledgeReadScope,
): boolean {
  if (read === 'all') return true;
  const { address, declaration, parentId } = scope;
  if (!address) return false;
  if (read.addresses.includes(address)) return true;
  if (read.prefixes.some(entry => entry.declaration === declaration && address.startsWith(entry.prefix))) return true;
  return read.children.some(entry => entry.declaration === declaration && entry.parentId === parentId);
}

const POSITION_DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

function positionMidpoint(low: string, high: string | null): string {
  if (high !== null) {
    let common = 0;
    while ((low[common] ?? '0') === high[common]) common++;
    if (common > 0) return high.slice(0, common) + positionMidpoint(low.slice(common), high.slice(common));
  }
  const lowDigit = low ? POSITION_DIGITS.indexOf(low[0]!) : 0;
  const highDigit = high !== null ? POSITION_DIGITS.indexOf(high[0]!) : POSITION_DIGITS.length;
  if (highDigit - lowDigit > 1) return POSITION_DIGITS[Math.round((lowDigit + highDigit) / 2)]!;
  if (high !== null && high.length > 1) return high.slice(0, 1);
  return POSITION_DIGITS[lowDigit]! + positionMidpoint(low.slice(1), null);
}

/**
 * A position key strictly between `before` and `after` (either may be absent), for fractional
 * sibling ordering. Keys are base-36 strings compared by code unit and never end in `0`, so there's
 * always room between two keys.
 *
 * @experimental
 */
export function knowledgePositionBetween(before?: string, after?: string): string {
  if (before !== undefined && after !== undefined && before >= after) {
    throw new Error(`Invalid position range: ${before} >= ${after}`);
  }
  return positionMidpoint(before ?? '', after ?? null);
}

/**
 * A scope to materialize, with the child scopes and keyed pages its declaration creates with it.
 *
 * @experimental
 */
export interface MaterializeKnowledgeScopeInput {
  address: string;
  declaration: string;
  name: string;
  description?: string;
  /**
   * Tree parent for a newly created scope page (from `belongsTo`). Ignored when the scope already
   * exists: the first link is kept, and the result reports the conflict.
   */
  parentId?: string | null;
  children?: Array<{ address: string; declaration: string; name: string; description?: string }>;
  pages?: Array<{ key: string; name: string; description?: string }>;
  provenance: KnowledgeProvenance;
}

/** @experimental */
export interface MaterializeKnowledgeScopeResult {
  scope: KnowledgePage;
  /** True when this call created the scope page. */
  created: boolean;
  /** Set when the scope already existed under a different parent than the one requested. */
  parentConflict?: { existingParentId: string | null; requestedParentId: string | null };
}

/** @experimental */
export interface KnowledgePageListOutput {
  pages: KnowledgePage[];
  nextCursor?: string;
}

/** @experimental */
export interface KnowledgeNoteListOutput {
  notes: KnowledgeNote[];
  nextCursor?: string;
}

/** @experimental */
export interface CreateKnowledgePageInput {
  id?: string;
  /** The tree parent: a scope page for a top-level page, or any page in the same scope. */
  parentId: string;
  key?: string;
  name: string;
  description?: string;
  body?: string;
  /** Defaults to after the last sibling. */
  position?: string;
  provenance: KnowledgeProvenance;
}

/** @experimental */
export interface UpdateKnowledgePageInput {
  id: string;
  expectedVersion: number;
  name?: string;
  /** Empty string clears it. */
  description?: string;
  body?: string;
  provenance: KnowledgeProvenance;
}

/** @experimental */
export interface MoveKnowledgePageInput {
  id: string;
  expectedVersion: number;
  /** New tree parent. A different scope moves the page and its subtree to that scope. */
  parentId: string;
  /** Defaults to after the last sibling. */
  position?: string;
  provenance: KnowledgeProvenance;
}

/** @experimental */
export interface MergeKnowledgePagesInput {
  sourceId: string;
  sourceVersion: number;
  targetId: string;
  provenance: KnowledgeProvenance;
}

/** @experimental */
export interface AddKnowledgeNoteInput {
  id?: string;
  pageId: string;
  text: string;
  when?: Date;
  /** Non-empty; scope page ids. */
  stampScopeIds: string[];
  /** Resolved mention targets (page ids). Unresolved mentions stay plain text and aren't passed. */
  mentions: string[];
  provenance: KnowledgeProvenance;
}

/** @experimental */
export interface SearchKnowledgePagesInput {
  query: string;
  read: KnowledgeReadScope;
  /** Narrows to pages (and notes on pages) whose home scope is one of these scope page ids. */
  scopeIds?: string[];
  limit?: number;
}

/** @experimental */
export type KnowledgePageSearchHit =
  | { type: 'page'; page: KnowledgePage }
  | { type: 'note'; note: KnowledgeNote; page: KnowledgePage };

/** @experimental */
export type KnowledgePageActivityAction =
  | 'scope-created'
  | 'page-created'
  | 'page-updated'
  | 'page-moved'
  | 'page-merged'
  | 'page-deleted'
  | 'note-added'
  | 'note-restamped'
  | 'note-removed'
  | 'note-restored'
  | 'pin-added'
  | 'pin-removed';

/** @experimental */
export interface KnowledgePageActivityEvent {
  id: string;
  action: KnowledgePageActivityAction;
  /** The page's home scope at the time of the change (the target scope for a move). */
  scopeId: string;
  pageId: string;
  noteId?: string;
  provenance: KnowledgeProvenance;
  createdAt: Date;
}

/**
 * The schema-4 store surface. Reads take a {@link KnowledgeReadScope} and return only what it can
 * see: a hidden page or note is indistinguishable from a missing one, and filtering happens before
 * ordering, limits and cursors. Writes take ids that core has already resolved through the run's
 * read scope and checked against the run's roles; the store enforces structure (same-scope parents,
 * depth, move size, versions, key uniqueness, token bounds), never access.
 *
 * @experimental
 */
export interface KnowledgePageStore {
  // Scopes
  materializeScope(input: MaterializeKnowledgeScopeInput): Promise<MaterializeKnowledgeScopeResult>;
  /** Scope pages by address, unfiltered (names and descriptions are not secret to the host). */
  getScopesByAddress(addresses: string[]): Promise<KnowledgePage[]>;
  /**
   * Scope pages directly under a page (`parentId: null` lists root scopes), unfiltered, by position
   * then id; core decides which to list and which as restricted.
   */
  listChildScopes(input: {
    parentId: string | null;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgePageListOutput>;

  // Pages
  getPage(input: { id: string; read: KnowledgeReadScope }): Promise<KnowledgePage | null>;
  getPageByKey(input: { scopeId: string; key: string; read: KnowledgeReadScope }): Promise<KnowledgePage | null>;
  /** Exact canonical-name matches among readable live pages, newest first. */
  findPagesByName(input: {
    name: string;
    read: KnowledgeReadScope;
    scopeId?: string;
    limit?: number;
  }): Promise<KnowledgePage[]>;
  /** Readable live ordinary pages under a parent, by position then id. Scope pages are not included. */
  listChildPages(input: {
    parentId: string;
    read: KnowledgeReadScope;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgePageListOutput>;
  /** Readable live ordinary pages, optionally in one scope and by name prefix, by name then id. */
  listPages(input: {
    read: KnowledgeReadScope;
    scopeId?: string;
    namePrefix?: string;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgePageListOutput>;
  createPage(input: CreateKnowledgePageInput): Promise<KnowledgePage>;
  updatePage(input: UpdateKnowledgePageInput): Promise<KnowledgePage>;
  /** Moves the page and its subtree in one transaction; refuses scope pages, cycles, depth and size. */
  movePage(input: MoveKnowledgePageInput): Promise<KnowledgePage>;
  /**
   * Moves the source's notes, child pages and pin audience to the target, retargets mentions of the
   * source, and soft-deletes the source with `mergedInto`. Notes keep their stamps and text. Refuses
   * scope pages on either side, a target inside the source's subtree (or the source itself), and
   * merges past the depth limit or {@link MAX_KNOWLEDGE_MOVE_PAGES} carried pages, like `movePage`.
   */
  mergePages(input: MergeKnowledgePagesInput): Promise<KnowledgePage>;
  /** Soft-deletes an ordinary page with no live children and drops its pin; refuses scope pages. */
  deletePage(input: { id: string; expectedVersion: number; deletedBy: string }): Promise<KnowledgePage>;

  // Notes
  getNote(input: { id: string; read: KnowledgeReadScope; includeDeleted?: boolean }): Promise<KnowledgeNote | null>;
  /** Visible notes on a page, oldest first. */
  listNotes(input: {
    pageId: string;
    read: KnowledgeReadScope;
    cursor?: string;
    limit?: number;
    includeDeleted?: boolean;
  }): Promise<KnowledgeNoteListOutput>;
  /** Visible notes on other pages that mention this page, newest first. */
  listNotesMentioning(input: {
    pageId: string;
    read: KnowledgeReadScope;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeNoteListOutput>;
  addNote(input: AddKnowledgeNoteInput): Promise<KnowledgeNote>;
  restampNote(input: {
    id: string;
    expectedVersion: number;
    stampScopeIds: string[];
    provenance: KnowledgeProvenance;
  }): Promise<KnowledgeNote>;
  removeNote(input: { id: string; deletedBy: string; provenance: KnowledgeProvenance }): Promise<KnowledgeNote>;
  restoreNote(input: { id: string; provenance: KnowledgeProvenance }): Promise<KnowledgeNote>;

  // Search and activity
  /** Lexical search over page names, descriptions, bodies and note text; access filtered first. */
  searchPages(input: SearchKnowledgePagesInput): Promise<KnowledgePageSearchHit[]>;
  /**
   * Events on readable scopes, newest first. An event's scope is the page's home scope after the
   * change (the target scope for a move or merge). Note events are returned only while the note
   * itself is visible under `read` (page visible, a stamp readable, every mention visible), so the
   * log never reveals a hidden note's id, author or source thread.
   */
  listPageActivity(input: {
    read: KnowledgeReadScope;
    scopeId?: string;
    pageId?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ events: KnowledgePageActivityEvent[]; nextCursor?: string }>;

  // Pins
  /** Adds audience entries to the page's pin, creating it if needed. */
  addPinAudience(input: { pageId: string; audience: string[]; createdBy: string }): Promise<KnowledgePin>;
  /** Removes audience entries; the pin is deleted when none remain. Returns null when no pin is left. */
  removePinAudience(input: { pageId: string; audience: string[]; removedBy: string }): Promise<KnowledgePin | null>;
  /**
   * Pins on readable live pages, newest first: those whose audience intersects `audience`, or every
   * pin for `'all'`. `'all'` is for host surfaces behind their own auth (Studio); runs always pass
   * their own scopes. `pageIds` narrows to those pages.
   */
  listPins(input: {
    audience: string[] | 'all';
    read: KnowledgeReadScope;
    pageIds?: string[];
    cursor?: string;
    limit?: number;
  }): Promise<{ pins: KnowledgePin[]; nextCursor?: string }>;
}
