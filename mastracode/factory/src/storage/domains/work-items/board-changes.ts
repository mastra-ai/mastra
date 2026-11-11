/**
 * Commit-ordered change tracking for a project's cards.
 *
 * Every transaction that writes a card table runs through {@link withCardTransaction}. Its writes are
 * tracked, and as its last statements one unstamped entry per card it touched, deleted cards included,
 * is inserted into the change log (`factory_board_changes`). The entries commit with the cards, so a
 * committed card write always has its entry.
 *
 * {@link stampPendingChanges} then locks the project's counter row (in `factory_board_versions`),
 * advances it, and stamps every committed unstamped entry with the new `change_seq` in the same
 * transaction. It runs right after each card transaction and before every read of the card list. Stamps
 * commit in counter order, so a reader that sees counter `C` sees every entry stamped `<= C`.
 *
 * The card transaction itself never touches the counter: card transactions that run serializable would
 * otherwise all conflict on that one row. Writers only insert log rows, and stamping locks the counter
 * and then log rows no card transaction updates, so the log adds no lock a card write can wait on.
 */

import { randomUUID } from 'node:crypto';

import { UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, CollectionWhere, FactoryStorage, FactoryStorageOps } from '@mastra/core/storage';

import { CARD_TABLES, FACTORY_BOARD_VERSIONS_SCHEMA, markBoardsForeign } from './board-version.js';
import type { BoardScope, BoardVersionRow } from './board-version.js';
import {
  FACTORY_BOARD_ITEMS_SCHEMA,
  FACTORY_WORK_ITEMS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCES_SCHEMA,
} from './work-item-schema.js';
import type { BoardItemDbRecord } from './work-item-schema.js';

const BOARD_ITEMS = FACTORY_BOARD_ITEMS_SCHEMA.name;
const WORK_ITEMS = FACTORY_WORK_ITEMS_SCHEMA.name;
const SOURCES = FACTORY_WORK_ITEM_SOURCES_SCHEMA.name;
const VERSIONS = FACTORY_BOARD_VERSIONS_SCHEMA.name;
const ID_BATCH = 500;

/**
 * One change to a card: unstamped (`change_seq` null) from its transaction until stamped after commit.
 * Only a card's latest entry is kept; an entry for a card that no longer exists is its deletion record.
 */
export const FACTORY_BOARD_CHANGES_SCHEMA: CollectionSchema = {
  name: 'factory_board_changes',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    board_item_id: { type: 'text' },
    change_seq: { type: 'bigint', nullable: true },
    changed_at: { type: 'timestamp' },
  },
  indexes: [
    { name: 'factory_board_changes_seq_idx', columns: ['org_id', 'factory_project_id', 'change_seq', 'id'] },
    { name: 'factory_board_changes_item_idx', columns: ['board_item_id'] },
  ],
};

/**
 * Log entries older than this are pruned; a reader whose list is older than the pruned horizon re-reads
 * it. Far longer than any reader follows the log before reading in full again, and short enough that
 * the entries of deleted cards, which nothing else removes, do not pile up.
 */
export const CHANGE_RETENTION_MS = 24 * 60 * 60 * 1000;

const CHANGES = FACTORY_BOARD_CHANGES_SCHEMA.name;
const MIN_UUID = '00000000-0000-0000-0000-000000000000';
/** Sorts after every uuid, so a `(change_seq, id)` cursor at it skips the whole `change_seq`. */
const MAX_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const PRUNE_BATCH = 200;

const BY_SEQ: [string, 'asc'][] = [
  ['change_seq', 'asc'],
  ['id', 'asc'],
];

type ChangeRow = {
  id: string;
  board_item_id: string;
  change_seq: number | null;
  changed_at: Date;
};

export interface ProjectScope {
  orgId: string;
  factoryProjectId: string;
}

class CounterMissingError extends Error {
  constructor(readonly scope: ProjectScope) {
    super(`[board-changes] no change counter for ${scope.orgId}/${scope.factoryProjectId}`);
  }
}

/**
 * A counter row whose version a stamp wrote. Any other version means a write that logged nothing
 * happened since: an older Factory replica, the legacy table, or a project that predates the log.
 */
export function isStampedVersion(row: Pick<BoardVersionRow, 'version' | 'change_seq'> | null | undefined): boolean {
  return !!row && row.change_seq != null && row.version === `seq:${row.change_seq}`;
}

/**
 * The counter's next value. After a write that logged nothing, the horizon moves up with it: that
 * write is in no log entry, so every list read before it has to be read again in full.
 */
function advance(row: BoardVersionRow, now: Date): Partial<BoardVersionRow> {
  const change_seq = (row.change_seq ?? 0) + 1;
  return {
    change_seq,
    version: `seq:${change_seq}`,
    updated_at: now,
    ...(isStampedVersion(row) ? {} : { pruned_seq: change_seq }),
  };
}

interface ProjectChanges {
  scope: ProjectScope;
  boards: Set<string>;
  works: Set<string>;
  deleted: Set<string>;
}

type ScopedRow = { org_id: string; factory_project_id: string };

/** What one transaction wrote to card tables. */
class CardChanges {
  readonly #projects = new Map<string, ProjectChanges>();
  readonly #foreign = new Map<string, BoardScope>();

  #project(row: ScopedRow): ProjectChanges {
    const key = `${row.org_id}\u0000${row.factory_project_id}`;
    let project = this.#projects.get(key);
    if (!project) {
      project = {
        scope: { orgId: row.org_id, factoryProjectId: row.factory_project_id },
        boards: new Set(),
        works: new Set(),
        deleted: new Set(),
      };
      this.#projects.set(key, project);
    }
    return project;
  }

  /** A row of a card table was written (or, for a board item with `deleted`, removed). */
  record(collection: string, row: unknown, { deleted = false } = {}): void {
    if (typeof row !== 'object' || row === null) return;
    const { id, org_id, factory_project_id, work_item_id } = row as Record<string, unknown>;
    if (typeof org_id !== 'string' || typeof factory_project_id !== 'string') {
      throw new Error(`[board-changes] ${collection} row written without its org and project.`);
    }
    const project = this.#project({ org_id, factory_project_id });
    if (collection !== BOARD_ITEMS) project.works.add((collection === WORK_ITEMS ? id : work_item_id) as string);
    else if (deleted) project.deleted.add(id as string);
    else project.boards.add(id as string);
  }

  /** A write to the frozen legacy table, which is never logged. */
  foreign(scope: BoardScope | undefined): void {
    if (scope) this.#foreign.set(`${scope.orgId}\u0000${scope.factoryProjectId ?? ''}`, scope);
  }

  projects(): ProjectChanges[] {
    return [...this.#projects.values()];
  }

  foreignScopes(): BoardScope[] {
    return [...this.#foreign.values()];
  }
}

function scopeOf(value: unknown): BoardScope | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { org_id, factory_project_id } = value as Record<string, unknown>;
  if (typeof org_id !== 'string') return undefined;
  return typeof factory_project_id === 'string'
    ? { orgId: org_id, factoryProjectId: factory_project_id }
    : { orgId: org_id };
}

const isLogged = (collection: string) =>
  collection === BOARD_ITEMS || collection === WORK_ITEMS || collection === SOURCES;

/** Wrap a transaction's ops so every card-table write is recorded in `changes`. */
function trackCardChanges(ops: FactoryStorageOps, changes: CardChanges): FactoryStorageOps {
  return new Proxy(ops, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      const call = (...args: unknown[]) => value.apply(target, args);
      switch (property) {
        case 'insertOne':
        case 'upsertOne':
          return async (collection: string, ...args: unknown[]) => {
            const written = await call(collection, ...args);
            if (isLogged(collection)) changes.record(collection, written);
            else if (CARD_TABLES.has(collection)) changes.foreign(scopeOf(written));
            return written;
          };
        case 'updateAtomic':
          return async (
            collection: string,
            where: CollectionWhere,
            updater: (row: Record<string, unknown>) => unknown,
            ...args: unknown[]
          ) => {
            if (!CARD_TABLES.has(collection)) return call(collection, where, updater, ...args);
            let patched = false;
            const row = await call(
              collection,
              where,
              async (current: Record<string, unknown>) => {
                const patch = await updater(current);
                patched = patch != null;
                return patch;
              },
              ...args,
            );
            if (!patched || !row) return row;
            if (isLogged(collection)) changes.record(collection, row);
            else changes.foreign(scopeOf(row));
            return row;
          };
        case 'updateMany':
        case 'deleteMany':
          return async (collection: string, where: CollectionWhere, ...args: unknown[]) => {
            if (!CARD_TABLES.has(collection)) return call(collection, where, ...args);
            if (!isLogged(collection)) {
              const count = (await call(collection, where, ...args)) as number;
              if (count > 0) changes.foreign(scopeOf(where));
              return count;
            }
            // Write row by row exactly the rows recorded: a row that came to match `where` after the
            // read would otherwise be written without an entry.
            const rows = await ops.findMany<Record<string, unknown>>(collection, where, { orderBy: [['id', 'asc']] });
            let count = 0;
            for (const row of rows) {
              const written = (await call(collection, { ...where, id: row.id as string }, ...args)) as number;
              if (!written) continue;
              count += written;
              changes.record(collection, row, { deleted: property === 'deleteMany' });
            }
            return count;
          };
        default:
          return value.bind(target);
      }
    },
  });
}

/** Wrap ops used outside {@link withCardTransaction} so a card write there fails loudly instead of going unlogged. */
export function rejectCardWrites(ops: FactoryStorageOps): FactoryStorageOps {
  return new Proxy(ops, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      if (!['insertOne', 'upsertOne', 'updateAtomic', 'updateMany', 'deleteMany'].includes(property as string))
        return value.bind(target);
      return (collection: string, ...args: unknown[]) => {
        if (CARD_TABLES.has(collection))
          throw new Error(`[board-changes] card table ${collection} written outside a card transaction.`);
        return value.call(target, collection, ...args);
      };
    },
  });
}

async function findIn<T extends Record<string, unknown>>(
  ops: FactoryStorageOps,
  collection: string,
  column: string,
  values: readonly string[],
): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; start < values.length; start += ID_BATCH) {
    rows.push(...(await ops.findMany<T>(collection, { [column]: { in: values.slice(start, start + ID_BATCH) } })));
  }
  return rows;
}

/**
 * Insert one unstamped log entry per card the transaction touched, as its last statements. A card whose
 * work item or sources changed is found through its board item; one deleted with them leaves only its
 * deletion. Returns the projects that got entries.
 */
async function recordCardChanges(ops: FactoryStorageOps, changes: CardChanges): Promise<ProjectScope[]> {
  const changed: ProjectScope[] = [];
  for (const project of changes.projects()) {
    const ids = new Set([...project.boards, ...project.deleted]);
    for (const board of await findIn<BoardItemDbRecord>(ops, BOARD_ITEMS, 'work_item_id', [...project.works])) {
      ids.add(board.id);
    }
    if (!ids.size) continue;
    const changed_at = new Date();
    for (const board_item_id of ids) {
      await ops.insertOne(CHANGES, {
        org_id: project.scope.orgId,
        factory_project_id: project.scope.factoryProjectId,
        board_item_id,
        change_seq: null,
        changed_at,
      });
    }
    changed.push(project.scope);
  }
  return changed;
}

/** Drop log entries past retention, oldest first, and raise the horizon to the last one dropped. */
async function pruneChanges(ops: FactoryStorageOps, scope: ProjectScope, now: Date): Promise<void> {
  const where = { org_id: scope.orgId, factory_project_id: scope.factoryProjectId };
  const isExpired = (row: ChangeRow) => now.getTime() - new Date(row.changed_at).getTime() > CHANGE_RETENTION_MS;
  // Past every stamped entry's lower bound; unstamped (null) entries never compare greater, so are skipped.
  const oldest = (limit: number) =>
    ops.findMany<ChangeRow>(CHANGES, where, { orderBy: BY_SEQ, cursor: { values: [0, MIN_UUID] }, limit });
  // Almost every stamp finds nothing to prune, so it reads one row to find that out.
  if (!(await oldest(1)).some(isExpired)) return;
  const expired: ChangeRow[] = [];
  // Only a prefix, so the horizon never passes an entry that is still kept.
  for (const row of await oldest(PRUNE_BATCH)) {
    if (!isExpired(row)) break;
    expired.push(row);
  }
  await ops.deleteMany(CHANGES, { id: { in: expired.map(row => row.id) } });
  const horizon = expired.at(-1)!.change_seq!;
  await ops.updateAtomic<BoardVersionRow>(VERSIONS, where, row =>
    (row.pruned_seq ?? 0) >= horizon ? null : { pruned_seq: horizon },
  );
}

/** Create a project's counter row outside any transaction, unstamped so its first stamp sets the horizon. */
async function createCounter(ops: FactoryStorageOps, scope: ProjectScope): Promise<void> {
  try {
    await ops.insertOne(VERSIONS, {
      org_id: scope.orgId,
      factory_project_id: scope.factoryProjectId,
      version: randomUUID(),
      change_seq: null,
      pruned_seq: null,
      updated_at: new Date(),
    });
  } catch (error) {
    if (!(error instanceof UniqueViolationError)) throw error;
  }
}

/**
 * Stamp the project's committed, unstamped changes with the next `change_seq`, under the counter lock,
 * so a reader that sees counter `C` sees every entry stamped `<= C` committed with it. Run after every
 * card transaction commits, and by readers before reading, which also covers a writer that died between
 * its commit and its stamp. Returns the counter, or `undefined` when there was nothing to stamp.
 */
export async function stampPendingChanges(
  storage: Pick<FactoryStorage, 'withTransaction' | 'ops'>,
  scope: ProjectScope,
): Promise<number | undefined> {
  const where = { org_id: scope.orgId, factory_project_id: scope.factoryProjectId };
  if (!(await storage.ops.findOne(CHANGES, { ...where, change_seq: null }))) return undefined;
  for (let attempt = 0; ; attempt++) {
    try {
      return await storage.withTransaction(async ops => {
        // Lock the counter before reading what is pending: an entry committed after that read waits
        // for the next stamp, and one another stamp already took is no longer pending.
        if (!(await ops.updateAtomic<BoardVersionRow>(VERSIONS, where, () => null))) {
          throw new CounterMissingError(scope);
        }
        const pending = await ops.findMany<ChangeRow>(CHANGES, { ...where, change_seq: null });
        if (!pending.length) return undefined;
        const now = new Date();
        const counter = await ops.updateAtomic<BoardVersionRow>(VERSIONS, where, row => advance(row, now));
        const changeSeq = counter!.change_seq!;
        // Only a card's latest entry matters to a reader, so each card keeps one of those this stamp
        // takes and loses its stamped ones. That keeps the log card-sized. An entry committed since
        // the read above is neither: it stays for the next stamp.
        const taken = new Set(pending.map(row => row.id));
        const kept = new Set(new Map(pending.map(row => [row.board_item_id, row.id])).values());
        const cardIds = [...new Set(pending.map(row => row.board_item_id))];
        const superseded = (await findIn<ChangeRow>(ops, CHANGES, 'board_item_id', cardIds)).filter(
          row => !kept.has(row.id) && (row.change_seq != null || taken.has(row.id)),
        );
        await ops.updateMany(CHANGES, { id: { in: [...kept] } }, { change_seq: changeSeq, changed_at: now });
        if (superseded.length) await ops.deleteMany(CHANGES, { id: { in: superseded.map(row => row.id) } });
        await pruneChanges(ops, scope, now);
        return changeSeq;
      });
    } catch (error) {
      if (!(error instanceof CounterMissingError) || attempt >= 1) throw error;
      await createCounter(storage.ops, scope);
    }
  }
}

/**
 * Give a project whose version no stamp wrote a stamped one, with the horizon at it, so lists read
 * before the unlogged write are read again in full and later changes can be followed through the log.
 * Returns the counter row, or null when the project has none (no card was ever written to it).
 */
export async function closeForeignVersion(
  ops: FactoryStorageOps,
  scope: ProjectScope,
): Promise<BoardVersionRow | null> {
  return ops.updateAtomic<BoardVersionRow>(
    VERSIONS,
    { org_id: scope.orgId, factory_project_id: scope.factoryProjectId },
    row => (isStampedVersion(row) ? null : advance(row, new Date())),
  );
}

/**
 * Ids of the cards logged after `since`, oldest change first, or `undefined` when there are more than
 * `limit`. A card that no longer exists was deleted.
 */
export async function readChangedCardIds(
  ops: FactoryStorageOps,
  scope: ProjectScope,
  since: number,
  limit: number,
): Promise<string[] | undefined> {
  const logged = await ops.findMany<ChangeRow>(
    CHANGES,
    { org_id: scope.orgId, factory_project_id: scope.factoryProjectId },
    { orderBy: BY_SEQ, cursor: { values: [since, MAX_UUID] }, limit: limit + 1 },
  );
  if (logged.length > limit) return undefined;
  return [...new Set(logged.map(entry => entry.board_item_id))];
}

export interface CardTransactionResult<T> {
  result: T;
  /** Every board the transaction changed. */
  changed: BoardScope[];
}

/**
 * `storage.withTransaction` for any write to card tables: tracks the writes, logs them before commit, and
 * stamps them right after.
 */
export async function withCardTransaction<T>(
  storage: Pick<FactoryStorage, 'withTransaction' | 'ops'>,
  fn: (ops: FactoryStorageOps) => Promise<T>,
  options?: { isolationLevel?: 'serializable' },
): Promise<CardTransactionResult<T>> {
  let changes = new CardChanges();
  let logged: ProjectScope[] = [];
  const result = await storage.withTransaction(async ops => {
    // Fresh per attempt: the backend may rerun this callback (Postgres serialization retries).
    changes = new CardChanges();
    const value = await fn(trackCardChanges(ops, changes));
    logged = await recordCardChanges(ops, changes);
    return value;
  }, options);
  const foreign = changes.foreignScopes();
  try {
    // After commit, like the stamp: inside a serializable transaction every legacy write would
    // conflict on the version row.
    await markBoardsForeign(storage.ops, foreign);
    for (const scope of logged) await stampPendingChanges(storage, scope);
  } catch (error) {
    // Committed already: the next reader stamps what is still pending.
    console.error('[board-changes] stamping committed card changes failed', error);
  }
  return { result, changed: [...logged, ...foreign] };
}
