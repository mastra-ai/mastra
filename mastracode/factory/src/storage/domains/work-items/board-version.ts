import { randomUUID } from 'node:crypto';
import type { CollectionSchema, CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';

import {
  FACTORY_BOARD_ITEMS_SCHEMA,
  FACTORY_WORK_ITEMS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCES_SCHEMA,
} from './work-item-schema.js';

/**
 * One row per project whose `version` is replaced after every committed write to that project's
 * cards (board items and work items). Readers of the full card list compare it against the version their snapshot was
 * taken at, so an unchanged board costs one indexed row read instead of every card.
 */
export const FACTORY_BOARD_VERSIONS_SCHEMA: CollectionSchema = {
  name: 'factory_board_versions',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    version: { type: 'text' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'factory_board_versions_scope_unique', columns: ['org_id', 'factory_project_id'] }],
};

/** A project, or every project in an org when a write's filter only names the org. */
export interface BoardScope {
  orgId: string;
  factoryProjectId?: string;
}

/** The cards a write touched: by placement id (the card's own id), or by the work item behind it. */
export interface CardIds {
  boardItemIds: Set<string>;
  workItemIds: Set<string>;
}

/** A board a write changed. No `cards` when the write's filter named no card: only a full re-read is safe then. */
export interface BoardWrite extends BoardScope {
  cards?: CardIds;
}

/** A version bump. `previous` is the version it replaced, set only when the bump proved no other write came between the two. */
export interface BoardBump extends BoardWrite {
  version: string;
  previous?: string;
}

/**
 * Past this many cards, re-reading the board is cheaper than following a write, so the write
 * stops naming its cards. Also bounds what a tracked write holds in memory.
 */
export const MAX_TRACKED_CARDS = 200;

export const cardCount = (cards: CardIds): number => cards.boardItemIds.size + cards.workItemIds.size;

/** The tables a card is stored in: a write to one changes the card list, so it bumps the version. */
export const CARD_TABLES: ReadonlySet<string> = new Set([
  FACTORY_BOARD_ITEMS_SCHEMA.name,
  FACTORY_WORK_ITEMS_SCHEMA.name,
  FACTORY_WORK_ITEM_SOURCES_SCHEMA.name,
  'work_items',
]);

const DECISIONS = 'factory_deferred_decisions';

/** What a board shows beside its cards; a write here moves no card, so the card list stays cached. */
export const DECISION_TABLES: ReadonlySet<string> = new Set([DECISIONS]);

/**
 * A decision that stays leased shows the same everywhere: only its lease moved. Renewing that lease
 * every few seconds therefore reports nothing; every other decision write does.
 */
function isLeased(collection: string, row: unknown): boolean {
  if (collection !== DECISIONS || typeof row !== 'object' || row === null || !('status' in row)) return false;
  return row.status === 'leased';
}

const scopeKey = (scope: BoardScope) => `${scope.orgId}\u0000${scope.factoryProjectId ?? ''}`;

/** Tables whose row id is the card's id; the work and source tables name the work item instead. */
const PLACEMENT_TABLES: ReadonlySet<string> = new Set([FACTORY_BOARD_ITEMS_SCHEMA.name, 'work_items']);

function idsOf(value: unknown): string[] | undefined {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object' && 'in' in value && Array.isArray(value.in)) {
    return value.in.every(id => typeof id === 'string') ? value.in : undefined;
  }
  return undefined;
}

/** The cards a written row or a write's filter names, read from the column that identifies the card in `collection`. */
function cardsOf(collection: string, fields: Record<string, unknown>): CardIds | undefined {
  const placement = PLACEMENT_TABLES.has(collection);
  const ids = idsOf(placement || collection === FACTORY_WORK_ITEMS_SCHEMA.name ? fields.id : fields.work_item_id);
  if (!ids || ids.length > MAX_TRACKED_CARDS) return undefined;
  return placement
    ? { boardItemIds: new Set(ids), workItemIds: new Set() }
    : { boardItemIds: new Set(), workItemIds: new Set(ids) };
}

function writeOf(collection: string, fields: Record<string, unknown> | null): BoardWrite | undefined {
  if (!fields || typeof fields.org_id !== 'string') return undefined;
  const cards = cardsOf(collection, fields);
  return typeof fields.factory_project_id === 'string'
    ? { orgId: fields.org_id, factoryProjectId: fields.factory_project_id, cards }
    : { orgId: fields.org_id, cards };
}

/**
 * Wrap `ops` so every write to one of `tables` reports the board it changed, once the write has
 * resolved. Writes outside any tenant (`dangerouslyClearAll`) report nothing.
 */
export function trackBoardWrites(
  ops: FactoryStorageOps,
  tables: ReadonlySet<string>,
  changed: (write: BoardWrite) => void | Promise<void>,
): FactoryStorageOps {
  const report = async (write: BoardWrite | undefined) => {
    if (write) await changed(write);
  };
  return new Proxy(ops, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      switch (property) {
        case 'updateAtomic':
          return async (collection: string, where: unknown, updater: (row: unknown) => unknown, ...args: unknown[]) => {
            let patched = false;
            let wasLeased = false;
            const row = await value.call(
              target,
              collection,
              where,
              async (current: unknown) => {
                wasLeased = isLeased(collection, current);
                const patch = await updater(current);
                patched = patch != null;
                return patch;
              },
              ...args,
            );
            const leaseOnly = wasLeased && isLeased(collection, row);
            if (tables.has(collection) && patched && !leaseOnly) await report(writeOf(collection, row));
            return row;
          };
        case 'insertOne':
        case 'upsertOne':
          return async (collection: string, ...args: unknown[]) => {
            const row = await value.call(target, collection, ...args);
            if (tables.has(collection)) await report(writeOf(collection, row));
            return row;
          };
        case 'updateMany':
        case 'deleteMany':
          return async (collection: string, where: CollectionWhere, ...args: unknown[]) => {
            const count: number = await value.call(target, collection, where, ...args);
            if (tables.has(collection) && count > 0) await report(writeOf(collection, where));
            return count;
          };
        default:
          return value.bind(target);
      }
    },
  });
}

/** Collects the boards a transaction changed, and the cards it wrote on each, so they can be bumped once it has committed. */
export class BoardScopes {
  readonly #writes = new Map<string, BoardWrite>();

  add = (write: BoardWrite): void => {
    const key = scopeKey(write);
    const seen = this.#writes.get(key);
    if (!seen) {
      const { cards } = write;
      this.#writes.set(key, {
        orgId: write.orgId,
        ...(write.factoryProjectId ? { factoryProjectId: write.factoryProjectId } : {}),
        cards: cards && { boardItemIds: new Set(cards.boardItemIds), workItemIds: new Set(cards.workItemIds) },
      });
      return;
    }
    // One write that named no card makes the whole board unknown.
    if (!seen.cards || !write.cards) {
      seen.cards = undefined;
      return;
    }
    for (const id of write.cards.boardItemIds) seen.cards.boardItemIds.add(id);
    for (const id of write.cards.workItemIds) seen.cards.workItemIds.add(id);
    if (cardCount(seen.cards) > MAX_TRACKED_CARDS) seen.cards = undefined;
  };

  values(): BoardWrite[] {
    return [...this.#writes.values()];
  }
}

/**
 * Replace the version of every board in `writes`. `expected` names the version this replica last
 * knew a project's board to have. While that is still the stored version, one statement replaces
 * it and the bump reports it as `previous`: no write came between the two, so a list cached at
 * `previous` can catch up on this write's cards alone. Otherwise the bump overwrites whatever is
 * stored and reports no `previous`. Either way it costs one statement, two when `expected` was stale.
 */
export async function bumpBoardVersions(
  ops: FactoryStorageOps,
  writes: readonly BoardWrite[],
  expected: (write: BoardWrite) => string | undefined = () => undefined,
): Promise<BoardBump[]> {
  const bumps: BoardBump[] = [];
  for (const write of writes) {
    const version = randomUUID();
    const updated_at = new Date();
    if (!write.factoryProjectId) {
      // Projects without a row yet have no version, which never matches a snapshot.
      await ops.updateMany(FACTORY_BOARD_VERSIONS_SCHEMA.name, { org_id: write.orgId }, { version, updated_at });
      bumps.push({ ...write, version });
      continue;
    }
    const where = { org_id: write.orgId, factory_project_id: write.factoryProjectId };
    const set = { version, updated_at };
    const previous = expected(write);
    // One UPDATE filtered on the version: atomic on every backend, which a read followed by a
    // write is not once two replicas share the database.
    const replaced =
      previous !== undefined &&
      (await ops.updateMany(FACTORY_BOARD_VERSIONS_SCHEMA.name, { ...where, version: previous }, set)) > 0;
    // Otherwise overwrite whatever is stored. Only a project's first bump finds no row.
    if (!replaced && (await ops.updateMany(FACTORY_BOARD_VERSIONS_SCHEMA.name, where, set)) === 0) {
      await ops.upsertOne(FACTORY_BOARD_VERSIONS_SCHEMA.name, ['org_id', 'factory_project_id'], { ...where, ...set });
    }
    bumps.push({ ...write, version, previous: replaced ? previous : undefined });
  }
  return bumps;
}

export async function readBoardVersion(
  ops: FactoryStorageOps,
  orgId: string,
  factoryProjectId: string,
): Promise<string | undefined> {
  const row = await ops.findOne<{ version: string }>(FACTORY_BOARD_VERSIONS_SCHEMA.name, {
    org_id: orgId,
    factory_project_id: factoryProjectId,
  });
  return row?.version;
}
