import type { KnowledgeScopeDeclarations } from '../../../knowledge/declarations';
import { StorageDomain } from '../base';
import type { KnowledgeImportersStorage } from './importers';
import { KnowledgeMoveTooLargeError, MAX_KNOWLEDGE_MOVE_PAGES } from './pages';
import type { KnowledgePageStore } from './pages';

/** @experimental Knowledge APIs are experimental and may change without notice. */
export const KNOWLEDGE_STORAGE_CONTRACT_VERSION = 4 as const;
/** @experimental Knowledge APIs are experimental and may change without notice. */
export const KNOWLEDGE_STORAGE_SCHEMA_VERSION = 4 as const;

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface KnowledgeStorageCapabilities {
  contractVersion: typeof KNOWLEDGE_STORAGE_CONTRACT_VERSION;
  schemaVersion: 1 | typeof KNOWLEDGE_STORAGE_SCHEMA_VERSION;
  supportsSchemaInspection: boolean;
  supportsExplicitReset: boolean;
  /**
   * The adapter stores a pin `kind` (`page` or `list`) with a list pin's `depth`. Adapters from before
   * pin kinds don't report it, and core refuses listing pins on them rather than store a page pin.
   */
  supportsPinKinds?: boolean;
  /** The adapter implements {@link KnowledgeStorage.transaction}. */
  supportsTransactions?: boolean;
  /**
   * The adapter enforces {@link KnowledgeTransactionOptions.deadlineAt}. Without it, the option is
   * ignored and nothing bounds how long a transaction runs.
   */
  enforcesTransactionDeadline?: boolean;
  /**
   * `listPageActivity` accepts `since`, `until` and `before` (dated mode). Adapters without it don't
   * report it, and core refuses dated activity reads on them rather than return unbounded history.
   */
  supportsActivityDateRange?: boolean;
  /**
   * `listPageActivity` accepts `order: 'asc'` and `after` (oldest first). Adapters without it don't
   * report it, and core refuses oldest-first activity reads on them.
   */
  supportsActivityAscending?: boolean;
}

/** @experimental */
export interface KnowledgeTransactionOptions {
  /**
   * Absolute time (epoch ms) by which the transaction's work must be done, on adapters with
   * `enforcesTransactionDeadline`: waiting for a connection, every statement and every lock wait
   * share it, and no new work starts once it has passed. Past it the transaction rolls back and
   * fails with {@link KnowledgeTransactionDeadlineError}. It bounds when work starts and how long
   * statements run, not every round trip: BEGIN, ROLLBACK and a COMMIT already sent can overrun
   * it, so leave a margin. Ignored by a view's nested `transaction`, which shares the outer
   * deadline.
   */
  deadlineAt?: number;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export type KnowledgeSchemaInspection =
  | { status: 'compatible'; schemaVersion: typeof KNOWLEDGE_STORAGE_SCHEMA_VERSION }
  | { status: 'uninitialized'; schemaVersion: null }
  | { status: 'incompatible-reset-required'; schemaVersion: number | null; reason: string }
  | { status: 'unavailable'; schemaVersion: null; reason: string };

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface KnowledgeSchemaSnapshot {
  available: boolean;
  tableNames: readonly string[];
  schemaVersion?: number;
  reason?: string;
}

/**
 * Classifies an adapter-provided, read-only schema snapshot. Adapters own the physical probe; this
 * helper owns version negotiation and never mutates the snapshot or backing store.
 *
 * @experimental Knowledge APIs are experimental and may change without notice.
 */
export function inspectKnowledgeSchema(snapshot: KnowledgeSchemaSnapshot): KnowledgeSchemaInspection {
  if (!snapshot.available) {
    return {
      status: 'unavailable',
      schemaVersion: null,
      reason: snapshot.reason ?? 'The Knowledge storage adapter is unavailable.',
    };
  }
  if (snapshot.tableNames.length === 0) return { status: 'uninitialized', schemaVersion: null };
  if (snapshot.schemaVersion === KNOWLEDGE_STORAGE_SCHEMA_VERSION) {
    return { status: 'compatible', schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION };
  }
  return {
    status: 'incompatible-reset-required',
    schemaVersion: snapshot.schemaVersion ?? null,
    reason:
      snapshot.reason ??
      `Existing experimental Knowledge tables are not compatible with schema version ${KNOWLEDGE_STORAGE_SCHEMA_VERSION}.`,
  };
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export class KnowledgeConflictError extends Error {
  constructor(id: string) {
    super(`Knowledge record version conflict: ${id}`);
    this.name = 'KnowledgeConflictError';
  }
}

export class KnowledgeNotFoundError extends Error {
  constructor(type: string, id: string) {
    super(`Knowledge ${type} not found: ${id}`);
    this.name = 'KnowledgeNotFoundError';
  }
}

export class KnowledgeSchemaResetRequiredError extends Error {
  readonly inspection: Extract<KnowledgeSchemaInspection, { status: 'incompatible-reset-required' }>;

  constructor(inspection: Extract<KnowledgeSchemaInspection, { status: 'incompatible-reset-required' }>) {
    super(
      `Knowledge schema reset required: ${inspection.reason}. Existing Knowledge data is not migrated. To replace it, call \`await storage.stores?.knowledge?.dangerouslyReset()\`, which deletes every Knowledge row and nothing else.`,
    );
    this.name = 'KnowledgeSchemaResetRequiredError';
    this.inspection = inspection;
  }
}

export class KnowledgeUnsupportedCapabilityError extends Error {
  constructor(capability: string) {
    super(`This Knowledge storage adapter does not expose ${capability}.`);
    this.name = 'KnowledgeUnsupportedCapabilityError';
  }
}

/** A transaction ran past its `deadlineAt` and was rolled back; nothing in it was applied. Retrying is safe. */
export class KnowledgeTransactionDeadlineError extends Error {
  readonly retryable = true;
  constructor(options?: { cause?: unknown }) {
    super('The Knowledge transaction ran past its deadline and was rolled back.', options);
    this.name = 'KnowledgeTransactionDeadlineError';
  }
}

export function assertKnowledgeSchemaCompatible(inspection: KnowledgeSchemaInspection): void {
  if (inspection.status === 'compatible' || inspection.status === 'uninitialized') return;
  if (inspection.status === 'incompatible-reset-required') {
    throw new KnowledgeSchemaResetRequiredError(inspection);
  }
  throw new Error(`Knowledge schema inspection unavailable: ${inspection.reason}`);
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let lastUlidTime = -1;
let lastUlidRandom = 0n;

export function parseKnowledgeWikilinks(text: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  let contentStart = -1;

  for (let index = 0; index < text.length - 1; index++) {
    const pair = text.slice(index, index + 2);
    if (pair === '[[') {
      contentStart = index + 2;
      index++;
      continue;
    }
    if (pair !== ']]' || contentStart < 0) continue;

    const name = text.slice(contentStart, index).trim();
    const key = name.toLocaleLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
    contentStart = -1;
    index++;
  }

  return names;
}

function encodeCrockford(value: bigint, length: number): string {
  let encoded = '';
  for (let index = 0; index < length; index++) {
    encoded = CROCKFORD[Number(value & 31n)] + encoded;
    value >>= 5n;
  }
  return encoded;
}

export function createKnowledgeUlid(now = Date.now()): string {
  if (now <= lastUlidTime) {
    now = lastUlidTime;
    lastUlidRandom = (lastUlidRandom + 1n) & ((1n << 80n) - 1n);
  } else {
    lastUlidTime = now;
    lastUlidRandom = globalThis.crypto
      .getRandomValues(new Uint8Array(10))
      .reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
  }
  return `${encodeCrockford(BigInt(now), 10)}${encodeCrockford(lastUlidRandom, 16)}`;
}

export abstract class KnowledgeStorage extends StorageDomain implements KnowledgePageStore {
  readonly #storageIsolationKey: unknown;

  constructor(config: { storageIsolationKey?: unknown } = {}) {
    super({ component: 'STORAGE', name: 'KNOWLEDGE' });
    this.#storageIsolationKey = config.storageIsolationKey ?? this;
  }

  /** Identifies the physical Knowledge backend and namespace used by this domain. */
  getStorageIsolationKey(): unknown {
    return this.#storageIsolationKey;
  }

  getCapabilities(): KnowledgeStorageCapabilities {
    return {
      contractVersion: KNOWLEDGE_STORAGE_CONTRACT_VERSION,
      schemaVersion: 1,
      supportsSchemaInspection: false,
      supportsExplicitReset: false,
    };
  }

  /**
   * Runs `operation` against a view of this store whose reads and writes all belong to one
   * transaction: it commits when `operation` resolves and rolls back when it throws, and no other
   * connection sees its writes until it commits. A store method that fails inside the view undoes
   * only its own writes, so the caller can catch it and go on. `transaction` on the view joins the
   * same transaction the same way. Adapters in the same package can write their own tables through
   * the view, so they commit with the page writes.
   *
   * Calls on this store (not the view) while `operation` runs are outside the transaction. Await
   * calls on the view one at a time, as on a single connection.
   *
   * @experimental
   */
  transaction<T>(_operation: (tx: KnowledgeStorage) => Promise<T>, _options?: KnowledgeTransactionOptions): Promise<T> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('transactions'));
  }

  /**
   * On a {@link transaction} view: locks the pages' rows against other writers until commit. A no-op
   * on stores whose transactions already exclude every other writer (one write transaction at a
   * time).
   *
   * @experimental
   */
  lockPages(_ids: string[]): Promise<void> {
    return Promise.resolve();
  }

  /**
   * On a {@link transaction} view: the ids of the live pages under `rootId` (not the root itself),
   * locked so no page can be added under, moved out of or removed from that subtree until commit.
   * A later {@link movePage} of `rootId` in the same transaction moves exactly these pages. Throws
   * {@link KnowledgeMoveTooLargeError} past {@link MAX_KNOWLEDGE_MOVE_PAGES}. The default walks the
   * children without locking, which holds on stores whose transactions exclude every other writer.
   *
   * @experimental
   */
  async lockSubtree(rootId: string): Promise<string[]> {
    const ids: string[] = [];
    const parents = [rootId];
    while (parents.length) {
      const parentId = parents.shift()!;
      let cursor: string | undefined;
      do {
        const page = await this.listChildPages({ parentId, read: 'all', ...(cursor ? { cursor } : {}) });
        for (const child of page.pages) {
          ids.push(child.id);
          parents.push(child.id);
        }
        // With the root, MAX_KNOWLEDGE_MOVE_PAGES descendants are already one page too many.
        if (ids.length >= MAX_KNOWLEDGE_MOVE_PAGES) throw new KnowledgeMoveTooLargeError(rootId, ids.length + 1);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
    }
    return ids;
  }

  /**
   * Importer bookkeeping on the same database and namespace as the pages, or undefined when the
   * adapter has none. On a {@link transaction} view it belongs to that transaction.
   *
   * @experimental
   */
  get importers(): KnowledgeImportersStorage | undefined {
    return undefined;
  }

  async inspectSchema(): Promise<KnowledgeSchemaInspection> {
    return {
      status: 'unavailable',
      schemaVersion: null,
      reason: 'This Knowledge storage adapter does not support schema inspection.',
    };
  }

  async dangerouslyReset(): Promise<void> {
    throw new Error('This Knowledge storage adapter does not support an explicit Knowledge-only reset.');
  }

  /**
   * Scope declarations the store supplies itself, such as the scopes a hosted store's importers write
   * to, with their access rules. Knowledge merges them under its config's, reusing the answer for a
   * short window, so a declaration the store adds, removes or changes (revoking access included)
   * applies within it; a key the config declares keeps the config's declaration. None by default.
   *
   * @experimental
   */
  async getScopeDeclarations(): Promise<KnowledgeScopeDeclarations> {
    return {};
  }

  // Schema-4 page store (see ./pages.ts). Adapters override every method; the defaults refuse, so an
  // adapter that hasn't moved to schema 4 fails loudly instead of returning empty results.
  materializeScope(
    _input: Parameters<KnowledgePageStore['materializeScope']>[0],
  ): ReturnType<KnowledgePageStore['materializeScope']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('materializeScope'));
  }
  getScopesByAddress(
    _input: Parameters<KnowledgePageStore['getScopesByAddress']>[0],
  ): ReturnType<KnowledgePageStore['getScopesByAddress']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('getScopesByAddress'));
  }
  listScopeDeclarations(): ReturnType<KnowledgePageStore['listScopeDeclarations']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listScopeDeclarations'));
  }
  renameScopeDeclaration(
    _input: Parameters<KnowledgePageStore['renameScopeDeclaration']>[0],
  ): ReturnType<KnowledgePageStore['renameScopeDeclaration']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('renameScopeDeclaration'));
  }
  listChildScopes(
    _input: Parameters<KnowledgePageStore['listChildScopes']>[0],
  ): ReturnType<KnowledgePageStore['listChildScopes']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listChildScopes'));
  }
  countChildScopes(
    _input: Parameters<KnowledgePageStore['countChildScopes']>[0],
  ): ReturnType<KnowledgePageStore['countChildScopes']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('countChildScopes'));
  }
  getPage(_input: Parameters<KnowledgePageStore['getPage']>[0]): ReturnType<KnowledgePageStore['getPage']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('getPage'));
  }
  getPages(_input: Parameters<KnowledgePageStore['getPages']>[0]): ReturnType<KnowledgePageStore['getPages']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('getPages'));
  }

  getPageByPath(
    _input: Parameters<KnowledgePageStore['getPageByPath']>[0],
  ): ReturnType<KnowledgePageStore['getPageByPath']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('getPageByPath'));
  }
  findPagesByName(
    _input: Parameters<KnowledgePageStore['findPagesByName']>[0],
  ): ReturnType<KnowledgePageStore['findPagesByName']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('findPagesByName'));
  }
  listChildPages(
    _input: Parameters<KnowledgePageStore['listChildPages']>[0],
  ): ReturnType<KnowledgePageStore['listChildPages']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listChildPages'));
  }
  listPages(_input: Parameters<KnowledgePageStore['listPages']>[0]): ReturnType<KnowledgePageStore['listPages']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listPages'));
  }
  createPage(_input: Parameters<KnowledgePageStore['createPage']>[0]): ReturnType<KnowledgePageStore['createPage']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('createPage'));
  }
  updatePage(_input: Parameters<KnowledgePageStore['updatePage']>[0]): ReturnType<KnowledgePageStore['updatePage']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('updatePage'));
  }
  movePage(_input: Parameters<KnowledgePageStore['movePage']>[0]): ReturnType<KnowledgePageStore['movePage']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('movePage'));
  }
  mergePages(_input: Parameters<KnowledgePageStore['mergePages']>[0]): ReturnType<KnowledgePageStore['mergePages']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('mergePages'));
  }
  deletePage(_input: Parameters<KnowledgePageStore['deletePage']>[0]): ReturnType<KnowledgePageStore['deletePage']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('deletePage'));
  }
  getNote(_input: Parameters<KnowledgePageStore['getNote']>[0]): ReturnType<KnowledgePageStore['getNote']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('getNote'));
  }
  countChildPages(
    _input: Parameters<KnowledgePageStore['countChildPages']>[0],
  ): ReturnType<KnowledgePageStore['countChildPages']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('countChildPages'));
  }
  replacePageBodyLinks(
    _input: Parameters<KnowledgePageStore['replacePageBodyLinks']>[0],
  ): ReturnType<KnowledgePageStore['replacePageBodyLinks']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('replacePageBodyLinks'));
  }
  listPageBodyLinkSources(
    _input: Parameters<KnowledgePageStore['listPageBodyLinkSources']>[0],
  ): ReturnType<KnowledgePageStore['listPageBodyLinkSources']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listPageBodyLinkSources'));
  }
  countPageLinks(
    _input: Parameters<KnowledgePageStore['countPageLinks']>[0],
  ): ReturnType<KnowledgePageStore['countPageLinks']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('countPageLinks'));
  }
  listPageLinks(
    _input: Parameters<KnowledgePageStore['listPageLinks']>[0],
  ): ReturnType<KnowledgePageStore['listPageLinks']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listPageLinks'));
  }
  countNotes(_input: Parameters<KnowledgePageStore['countNotes']>[0]): ReturnType<KnowledgePageStore['countNotes']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('countNotes'));
  }
  listNotes(_input: Parameters<KnowledgePageStore['listNotes']>[0]): ReturnType<KnowledgePageStore['listNotes']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listNotes'));
  }
  listNotesMentioning(
    _input: Parameters<KnowledgePageStore['listNotesMentioning']>[0],
  ): ReturnType<KnowledgePageStore['listNotesMentioning']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listNotesMentioning'));
  }
  addNote(_input: Parameters<KnowledgePageStore['addNote']>[0]): ReturnType<KnowledgePageStore['addNote']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('addNote'));
  }
  restampNote(_input: Parameters<KnowledgePageStore['restampNote']>[0]): ReturnType<KnowledgePageStore['restampNote']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('restampNote'));
  }
  removeNote(_input: Parameters<KnowledgePageStore['removeNote']>[0]): ReturnType<KnowledgePageStore['removeNote']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('removeNote'));
  }
  restoreNote(_input: Parameters<KnowledgePageStore['restoreNote']>[0]): ReturnType<KnowledgePageStore['restoreNote']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('restoreNote'));
  }
  searchPages(_input: Parameters<KnowledgePageStore['searchPages']>[0]): ReturnType<KnowledgePageStore['searchPages']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('searchPages'));
  }
  listPageActivity(
    _input: Parameters<KnowledgePageStore['listPageActivity']>[0],
  ): ReturnType<KnowledgePageStore['listPageActivity']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listPageActivity'));
  }
  addPinAudience(
    _input: Parameters<KnowledgePageStore['addPinAudience']>[0],
  ): ReturnType<KnowledgePageStore['addPinAudience']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('addPinAudience'));
  }
  removePinAudience(
    _input: Parameters<KnowledgePageStore['removePinAudience']>[0],
  ): ReturnType<KnowledgePageStore['removePinAudience']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('removePinAudience'));
  }
  listPins(_input: Parameters<KnowledgePageStore['listPins']>[0]): ReturnType<KnowledgePageStore['listPins']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listPins'));
  }
}
