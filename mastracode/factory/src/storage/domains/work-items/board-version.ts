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

/** A version bump: `previous` is the version it replaced, absent when the project had none. */
export interface BoardBump extends BoardWrite {
  version: string;
  previous?: string;
}

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
  if (PLACEMENT_TABLES.has(collection)) {
    const ids = idsOf(fields.id);
    return ids && { boardItemIds: new Set(ids), workItemIds: new Set() };
  }
  const ids = idsOf(collection === FACTORY_WORK_ITEMS_SCHEMA.name ? fields.id : fields.work_item_id);
  return ids && { boardItemIds: new Set(), workItemIds: new Set(ids) };
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
  };

  values(): BoardWrite[] {
    return [...this.#writes.values()];
  }
}

export async function bumpBoardVersions(ops: FactoryStorageOps, writes: readonly BoardWrite[]): Promise<BoardBump[]> {
  const bumps: BoardBump[] = [];
  for (const write of writes) {
    const version = randomUUID();
    const updated_at = new Date();
    if (write.factoryProjectId) {
      const where = { org_id: write.orgId, factory_project_id: write.factoryProjectId };
      // Atomic, so `previous` is the version this bump replaced: a reader that holds it can
      // catch up on just this write's cards.
      let previous: string | undefined;
      const row = await ops.updateAtomic<{ version: string }>(FACTORY_BOARD_VERSIONS_SCHEMA.name, where, current => {
        previous = current.version;
        return { version, updated_at };
      });
      if (!row) {
        previous = undefined;
        await ops.upsertOne(FACTORY_BOARD_VERSIONS_SCHEMA.name, ['org_id', 'factory_project_id'], {
          ...where,
          version,
          updated_at,
        });
      }
      bumps.push({ ...write, version, previous });
    } else {
      // Projects without a row yet have no version, which never matches a snapshot.
      await ops.updateMany(FACTORY_BOARD_VERSIONS_SCHEMA.name, { org_id: write.orgId }, { version, updated_at });
      bumps.push({ ...write, version });
    }
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
