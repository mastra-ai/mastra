import { randomUUID } from 'node:crypto';
import type { CollectionSchema, CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';

import {
  FACTORY_BOARD_ITEMS_SCHEMA,
  FACTORY_WORK_ITEMS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCES_SCHEMA,
} from './work-item-schema.js';

/**
 * One row per project: its card change counter and a `version` readers of the full card list compare
 * against the version their snapshot was taken at, so an unchanged board costs one indexed row read
 * instead of every card.
 *
 * A Factory that stamps `change_seq` (board-changes.ts) writes `version = 'seq:<change_seq>'` in the same
 * transaction as the cards. Any other version means a write that stamped nothing (an older Factory, or
 * the legacy table) happened since, so the project's cards must be reconciled before deltas are trusted.
 */
export const FACTORY_BOARD_VERSIONS_SCHEMA: CollectionSchema = {
  name: 'factory_board_versions',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    version: { type: 'text' },
    /** The `change_seq` of the last committed card transaction. */
    change_seq: { type: 'bigint', nullable: true },
    /** Deletion records at or below this seq were pruned; a cursor older than it must resync. */
    pruned_seq: { type: 'bigint', nullable: true },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'factory_board_versions_scope_unique', columns: ['org_id', 'factory_project_id'] }],
};

export interface BoardVersionRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  version: string;
  change_seq: number | null;
  pruned_seq: number | null;
  updated_at: Date;
}

/** A project, or every project in an org when a write's filter only names the org. */
export interface BoardScope {
  orgId: string;
  factoryProjectId?: string;
}

/** The tables a card is stored in: a write to one changes the card list. */
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

function scopeOfRow(row: Record<string, unknown> | null): BoardScope | undefined {
  if (!row || typeof row.org_id !== 'string') return undefined;
  return typeof row.factory_project_id === 'string'
    ? { orgId: row.org_id, factoryProjectId: row.factory_project_id }
    : { orgId: row.org_id };
}

function scopeOfWhere(where: CollectionWhere): BoardScope | undefined {
  if (typeof where.org_id !== 'string') return undefined;
  return typeof where.factory_project_id === 'string'
    ? { orgId: where.org_id, factoryProjectId: where.factory_project_id }
    : { orgId: where.org_id };
}

/**
 * Wrap `ops` so every write to one of `tables` reports the board it changed, once the write has
 * resolved. Writes outside any tenant (`dangerouslyClearAll`) report nothing.
 */
export function trackBoardWrites(
  ops: FactoryStorageOps,
  tables: ReadonlySet<string>,
  changed: (scope: BoardScope) => void | Promise<void>,
): FactoryStorageOps {
  const report = async (scope: BoardScope | undefined) => {
    if (scope) await changed(scope);
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
            if (tables.has(collection) && patched && !leaseOnly) await report(scopeOfRow(row));
            return row;
          };
        case 'insertOne':
        case 'upsertOne':
          return async (collection: string, ...args: unknown[]) => {
            const row = await value.call(target, collection, ...args);
            if (tables.has(collection)) await report(scopeOfRow(row));
            return row;
          };
        case 'updateMany':
        case 'deleteMany':
          return async (collection: string, where: CollectionWhere, ...args: unknown[]) => {
            const count: number = await value.call(target, collection, where, ...args);
            if (tables.has(collection) && count > 0) await report(scopeOfWhere(where));
            return count;
          };
        default:
          return value.bind(target);
      }
    },
  });
}

/** Collects the boards a transaction changed so they can be announced once it has committed. */
export class BoardScopes {
  readonly #scopes = new Map<string, BoardScope>();

  add = (scope: BoardScope): void => {
    this.#scopes.set(scopeKey(scope), scope);
  };

  values(): BoardScope[] {
    return [...this.#scopes.values()];
  }
}

/**
 * Record that cards in `scopes` changed without a `change_seq` stamp: replaces the version with one
 * that is not `seq:<n>`, leaving the counter alone, so readers drop cached lists and reconcile.
 */
export async function markBoardsForeign(ops: FactoryStorageOps, scopes: readonly BoardScope[]): Promise<void> {
  for (const scope of scopes) {
    const version = randomUUID();
    const updated_at = new Date();
    if (scope.factoryProjectId) {
      await ops.upsertOne(FACTORY_BOARD_VERSIONS_SCHEMA.name, ['org_id', 'factory_project_id'], {
        org_id: scope.orgId,
        factory_project_id: scope.factoryProjectId,
        version,
        updated_at,
      });
    } else {
      // Projects without a row yet have no version, which never matches a snapshot.
      await ops.updateMany(FACTORY_BOARD_VERSIONS_SCHEMA.name, { org_id: scope.orgId }, { version, updated_at });
    }
  }
}

export async function readBoardVersionRow(
  ops: FactoryStorageOps,
  orgId: string,
  factoryProjectId: string,
): Promise<BoardVersionRow | null> {
  return ops.findOne<BoardVersionRow>(FACTORY_BOARD_VERSIONS_SCHEMA.name, {
    org_id: orgId,
    factory_project_id: factoryProjectId,
  });
}

/**
 * A token that changes on every committed card write: the counter advances on stamped writes, and an
 * unstamped (older Factory) write replaces the version.
 */
export async function readBoardVersion(
  ops: FactoryStorageOps,
  orgId: string,
  factoryProjectId: string,
): Promise<string | undefined> {
  const row = await readBoardVersionRow(ops, orgId, factoryProjectId);
  return row ? `${row.version}/${row.change_seq ?? ''}` : undefined;
}
