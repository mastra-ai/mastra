/**
 * Commit-ordered change log for a project's cards.
 *
 * Every transaction that writes a card table runs through {@link withCardTransaction}. As its last
 * statements it inserts one unstamped entry per card it wrote, deleted cards included, into
 * `factory_board_changes`. The entries commit with the cards, so a committed card write always has
 * its entry.
 *
 * {@link stampPendingChanges} then locks the project's counter row (in `factory_board_versions`),
 * advances it, and stamps every pending entry with the new `change_seq`, all in one transaction. It
 * runs right after each card transaction and before every read of the card list. Stamps commit in
 * counter order, so a reader that sees counter `C` sees every entry stamped `<= C`.
 *
 * The card transaction itself never touches the counter: serializable card transactions would
 * otherwise all conflict on that one row.
 */

import { randomUUID } from 'node:crypto';

import { UniqueViolationError } from '@mastra/core/storage';
import type {
  CollectionListOptions,
  CollectionSchema,
  CollectionWhere,
  FactoryStorage,
  FactoryStorageOps,
} from '@mastra/core/storage';

import {
  BoardScopes,
  CARD_TABLES,
  FACTORY_BOARD_VERSIONS_SCHEMA,
  markBoardsForeign,
  trackBoardWrites,
} from './board-version.js';
import type { BoardScope, BoardVersionRow } from './board-version.js';
import {
  FACTORY_BOARD_ITEMS_SCHEMA,
  FACTORY_WORK_ITEMS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCES_SCHEMA,
  WORK_ITEMS_SCHEMA,
} from './work-item-schema.js';
import type { BoardItemDbRecord } from './work-item-schema.js';

const BOARD_ITEMS = FACTORY_BOARD_ITEMS_SCHEMA.name;
const WORK_ITEMS = FACTORY_WORK_ITEMS_SCHEMA.name;
const SOURCES = FACTORY_WORK_ITEM_SOURCES_SCHEMA.name;
const VERSIONS = FACTORY_BOARD_VERSIONS_SCHEMA.name;

/** The tables a card is stored in since the work item split: every write to one is logged. */
const LOGGED_TABLES: ReadonlySet<string> = new Set([BOARD_ITEMS, WORK_ITEMS, SOURCES]);
/** The table cards lived in before the split. Its writes are not logged; they mark the board instead. */
const LEGACY_TABLES: ReadonlySet<string> = new Set([WORK_ITEMS_SCHEMA.name]);

/** One card write: unstamped (`change_seq` null) from its transaction until it is stamped after commit. */
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
  indexes: [{ name: 'factory_board_changes_seq_idx', columns: ['org_id', 'factory_project_id', 'change_seq'] }],
};

/**
 * Entries stamped longer ago than this are dropped. A list follows the log for minutes before it is
 * read in full again (`LIST_FULL_READ_INTERVAL_MS`), so no reader still needs an entry this old.
 */
export const CHANGE_RETENTION_MS = 24 * 60 * 60 * 1000;

const CHANGES = FACTORY_BOARD_CHANGES_SCHEMA.name;
const ID_BATCH = 500;
const PRUNE_BATCH = 200;

type ChangeRow = {
  id: string;
  board_item_id: string;
  change_seq: number | null;
  changed_at: Date;
};

type ProjectScope = Required<BoardScope>;

const whereProject = (scope: ProjectScope) => ({ org_id: scope.orgId, factory_project_id: scope.factoryProjectId });

/** The entries stamped after `seq`, oldest first. An unstamped entry never compares greater, so it is left out. */
const stampedAfter = (seq: number, limit: number): CollectionListOptions => ({
  orderBy: [['change_seq', 'asc']],
  cursor: { values: [seq] },
  limit,
});

/**
 * Whether a stamp wrote this counter row's version. Any other version means a write that logged
 * nothing came after it: an older Factory replica, the legacy table, or a project from before the log.
 */
export function isStampedVersion(row: BoardVersionRow): boolean {
  return row.change_seq != null && row.version === `seq:${row.change_seq}`;
}

/**
 * The counter's next value. Over a write that logged nothing, the horizon moves up with it: that
 * write is in no entry, so a list read before it cannot be brought up to date from the log.
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

/** The cards one transaction wrote, per project: named by their own row, or by the work item behind them. */
class CardWrites {
  readonly projects = new Map<string, { scope: ProjectScope; boardItemIds: Set<string>; workItemIds: Set<string> }>();

  record(collection: string, row: Record<string, unknown>): void {
    const { id, org_id, factory_project_id, work_item_id } = row;
    if (typeof org_id !== 'string' || typeof factory_project_id !== 'string') {
      throw new Error(`[board-changes] ${collection} row written without its org and project.`);
    }
    const key = `${org_id}\u0000${factory_project_id}`;
    let project = this.projects.get(key);
    if (!project) {
      const scope = { orgId: org_id, factoryProjectId: factory_project_id };
      this.projects.set(key, (project = { scope, boardItemIds: new Set(), workItemIds: new Set() }));
    }
    if (collection === BOARD_ITEMS) project.boardItemIds.add(String(id));
    else project.workItemIds.add(String(collection === WORK_ITEMS ? id : work_item_id));
  }
}

/** Wrap a transaction's ops so every row it writes to a logged table is recorded in `writes`. */
function trackCardWrites(ops: FactoryStorageOps, writes: CardWrites): FactoryStorageOps {
  return new Proxy(ops, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      const call = (...args: unknown[]) => value.apply(target, args);
      switch (property) {
        case 'insertOne':
        case 'upsertOne':
          return async (collection: string, ...args: unknown[]) => {
            const row = await call(collection, ...args);
            if (LOGGED_TABLES.has(collection)) writes.record(collection, row);
            return row;
          };
        case 'updateAtomic':
          return async (
            collection: string,
            where: CollectionWhere,
            updater: (row: Record<string, unknown>) => unknown,
            ...args: unknown[]
          ) => {
            if (!LOGGED_TABLES.has(collection)) return call(collection, where, updater, ...args);
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
            if (patched && row) writes.record(collection, row);
            return row;
          };
        case 'updateMany':
        case 'deleteMany':
          return async (collection: string, where: CollectionWhere, ...args: unknown[]) => {
            if (!LOGGED_TABLES.has(collection)) return call(collection, where, ...args);
            // The write only returns a count, so the rows are read first and written one by one: a
            // row that came to match `where` after the read would otherwise be written unrecorded.
            const rows = await target.findMany<Record<string, unknown>>(collection, where, {
              orderBy: [['id', 'asc']],
            });
            let count = 0;
            for (const row of rows) {
              const written: number = await call(collection, { ...where, id: row.id }, ...args);
              if (!written) continue;
              count += written;
              writes.record(collection, row);
            }
            return count;
          };
        default:
          return value.bind(target);
      }
    },
  });
}

const WRITES: ReadonlySet<string | symbol> = new Set([
  'insertOne',
  'upsertOne',
  'updateAtomic',
  'updateMany',
  'deleteMany',
]);

/** Wrap ops used outside {@link withCardTransaction} so a card write there fails loudly instead of going unlogged. */
export function rejectCardWrites(ops: FactoryStorageOps): FactoryStorageOps {
  return new Proxy(ops, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      if (!WRITES.has(property)) return value.bind(target);
      return (collection: string, ...args: unknown[]) => {
        if (CARD_TABLES.has(collection)) {
          throw new Error(`[board-changes] card table ${collection} written outside a card transaction.`);
        }
        return value.call(target, collection, ...args);
      };
    },
  });
}

/**
 * Insert one unstamped entry per card the transaction wrote, as its last statements. A card whose
 * work item or sources changed is found through its board item; one deleted with them is already
 * named by its own row. Returns the projects that got entries.
 */
async function logCardWrites(ops: FactoryStorageOps, writes: CardWrites): Promise<ProjectScope[]> {
  const logged: ProjectScope[] = [];
  for (const { scope, boardItemIds, workItemIds } of writes.projects.values()) {
    const works = [...workItemIds];
    for (let start = 0; start < works.length; start += ID_BATCH) {
      const boards = await ops.findMany<BoardItemDbRecord>(BOARD_ITEMS, {
        work_item_id: { in: works.slice(start, start + ID_BATCH) },
      });
      for (const board of boards) boardItemIds.add(board.id);
    }
    if (!boardItemIds.size) continue;
    const changed_at = new Date();
    for (const board_item_id of boardItemIds) {
      await ops.insertOne(CHANGES, { ...whereProject(scope), board_item_id, change_seq: null, changed_at });
    }
    logged.push(scope);
  }
  return logged;
}

/** Drop the oldest entries once they are past retention, and raise the horizon over what was dropped. */
async function pruneChanges(ops: FactoryStorageOps, where: CollectionWhere, now: Date): Promise<void> {
  const isExpired = (row: ChangeRow) => now.getTime() - row.changed_at.getTime() > CHANGE_RETENTION_MS;
  const oldest = (limit: number) => ops.findMany<ChangeRow>(CHANGES, where, stampedAfter(0, limit));
  // Almost every stamp finds nothing to drop, and reads one row to find that out.
  if (!(await oldest(1)).some(isExpired)) return;
  const expired = (await oldest(PRUNE_BATCH)).filter(isExpired);
  await ops.deleteMany(CHANGES, { id: { in: expired.map(row => row.id) } });
  const horizon = expired.at(-1)!.change_seq!;
  await ops.updateAtomic<BoardVersionRow>(VERSIONS, where, row =>
    (row.pruned_seq ?? 0) >= horizon ? null : { pruned_seq: horizon },
  );
}

/**
 * Stamp the project's pending entries with the next `change_seq`. Run after every card transaction
 * commits, and by readers before they read, which also covers a writer that stopped between its
 * commit and its stamp.
 */
export async function stampPendingChanges(
  storage: Pick<FactoryStorage, 'withTransaction' | 'ops'>,
  scope: ProjectScope,
): Promise<void> {
  const where = whereProject(scope);
  const pending = { ...where, change_seq: null };
  if (!(await storage.ops.findOne(CHANGES, pending))) return;
  /** False when the project has no counter row to lock yet. */
  const stamp = () =>
    storage.withTransaction(async ops => {
      const now = new Date();
      let advanced = false;
      // The counter row stays locked from here to commit, which is what puts stamps in counter
      // order. What is pending is read under that lock: another stamp may have taken it already.
      const counter = await ops.updateAtomic<BoardVersionRow>(VERSIONS, where, async row => {
        if (!(await ops.findOne(CHANGES, pending))) return null;
        advanced = true;
        return advance(row, now);
      });
      if (!counter) return false;
      if (advanced) {
        await ops.updateMany(CHANGES, pending, { change_seq: counter.change_seq, changed_at: now });
        await pruneChanges(ops, where, now);
      }
      return true;
    });
  if (await stamp()) return;
  // Created outside the transaction, where losing the race to another creator rolls nothing back,
  // and unstamped, so the first stamp puts the horizon at the start of the log.
  try {
    await storage.ops.insertOne(VERSIONS, {
      ...where,
      version: randomUUID(),
      change_seq: null,
      pruned_seq: null,
      updated_at: new Date(),
    });
  } catch (error) {
    if (!(error instanceof UniqueViolationError)) throw error;
  }
  await stamp();
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
  return ops.updateAtomic<BoardVersionRow>(VERSIONS, whereProject(scope), row =>
    isStampedVersion(row) ? null : advance(row, new Date()),
  );
}

/**
 * Ids of the cards logged after `since`, or `undefined` when there are more than `limit` entries.
 * A card that no longer exists was deleted.
 */
export async function readChangedCardIds(
  ops: FactoryStorageOps,
  scope: ProjectScope,
  since: number,
  limit: number,
): Promise<string[] | undefined> {
  const logged = await ops.findMany<ChangeRow>(CHANGES, whereProject(scope), stampedAfter(since, limit + 1));
  if (logged.length > limit) return undefined;
  return [...new Set(logged.map(entry => entry.board_item_id))];
}

/**
 * `storage.withTransaction` for any write to card tables: records the cards it writes, logs them
 * before it commits, and stamps them right after. `changed` is every board the transaction changed.
 */
export async function withCardTransaction<T>(
  storage: Pick<FactoryStorage, 'withTransaction' | 'ops'>,
  fn: (ops: FactoryStorageOps) => Promise<T>,
  options?: { isolationLevel?: 'serializable' },
): Promise<{ result: T; changed: BoardScope[] }> {
  let logged: ProjectScope[] = [];
  let legacy = new BoardScopes();
  const result = await storage.withTransaction(async ops => {
    // Fresh per attempt: Postgres runs this callback again when it retries a serializable transaction.
    const writes = new CardWrites();
    legacy = new BoardScopes();
    const value = await fn(trackCardWrites(trackBoardWrites(ops, LEGACY_TABLES, legacy.add), writes));
    logged = await logCardWrites(ops, writes);
    return value;
  }, options);
  try {
    // After commit, like the stamp: inside a serializable transaction every legacy write would
    // conflict on the version row.
    await markBoardsForeign(storage.ops, legacy.values());
    for (const scope of logged) await stampPendingChanges(storage, scope);
  } catch (error) {
    // The write is committed, so it must not fail here. The next reader stamps what is still
    // pending; a legacy write whose mark failed waits for the list's next full read.
    console.error('[board-changes] recording committed card changes failed', error);
  }
  return { result, changed: [...logged, ...legacy.values()] };
}
