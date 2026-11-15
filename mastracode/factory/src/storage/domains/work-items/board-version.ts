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

/**
 * One card row written. Board rows and legacy cards name the card, and the work item behind it when
 * the row says so. Work item and source rows only name the work item, which `cardsNamed` resolves to
 * its card once the write has committed.
 */
export type CardRowWrite = { card: string; workItem?: string } | { card?: undefined; workItem: string };

/** The card rows a write changed: none for a decision, or `undefined` when the write cannot tell which. */
export type ChangedCards = readonly CardRowWrite[] | undefined;

const text = (value: unknown) => (typeof value === 'string' ? value : undefined);

function cardsOf(collection: string, fields: Record<string, unknown> | null): ChangedCards {
  const id = text(fields?.id);
  const workItem = text(fields?.work_item_id);
  switch (collection) {
    case FACTORY_BOARD_ITEMS_SCHEMA.name:
      if (id) return [{ card: id, workItem }];
      return workItem ? [{ workItem }] : undefined;
    case FACTORY_WORK_ITEM_SOURCES_SCHEMA.name:
      return workItem ? [{ workItem }] : undefined;
    case FACTORY_WORK_ITEMS_SCHEMA.name:
      return id ? [{ workItem: id }] : undefined;
    case 'work_items':
      return id ? [{ card: id, workItem: id }] : undefined;
    default:
      return [];
  }
}

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
 * Wrap `ops` so every write to one of `tables` reports the board and the cards it changed, once the
 * write has resolved. Writes outside any tenant (`dangerouslyClearAll`) report nothing.
 */
export function trackBoardWrites(
  ops: FactoryStorageOps,
  tables: ReadonlySet<string>,
  changed: (scope: BoardScope, cards: ChangedCards) => void | Promise<void>,
): FactoryStorageOps {
  const report = async (scope: BoardScope | undefined, cards: ChangedCards) => {
    if (scope) await changed(scope, cards);
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
            if (tables.has(collection) && patched && !leaseOnly)
              await report(scopeOfRow(row), cardsOf(collection, row));
            return row;
          };
        case 'insertOne':
        case 'upsertOne':
          return async (collection: string, ...args: unknown[]) => {
            const row = await value.call(target, collection, ...args);
            if (tables.has(collection)) await report(scopeOfRow(row), cardsOf(collection, row));
            return row;
          };
        case 'updateMany':
        case 'deleteMany':
          return async (collection: string, where: CollectionWhere, ...args: unknown[]) => {
            const count: number = await value.call(target, collection, where, ...args);
            if (tables.has(collection) && count > 0) await report(scopeOfWhere(where), cardsOf(collection, where));
            return count;
          };
        default:
          return value.bind(target);
      }
    },
  });
}

interface CardRowWrites {
  cards: Set<string>;
  /** Work items whose card no write in the same batch named. */
  workItems: Set<string>;
  /** Work items a board row write named the card of. */
  carded: Set<string>;
}

/** Collects the boards a transaction changed, and their card rows, so they can be bumped and announced once it has committed. */
export class BoardChanges {
  readonly #changes = new Map<string, { scope: BoardScope; writes: CardRowWrites | undefined }>();

  add = (scope: BoardScope, cards: ChangedCards): void => {
    const key = scopeKey(scope);
    const known = this.#changes.get(key) ?? {
      scope,
      writes: { cards: new Set<string>(), workItems: new Set<string>(), carded: new Set<string>() },
    };
    this.#changes.set(key, known);
    if (!cards) known.writes = undefined;
    const writes = known.writes;
    if (!writes) return;
    for (const { card, workItem } of cards ?? []) {
      if (card) writes.cards.add(card);
      if (workItem) (card ? writes.carded : writes.workItems).add(workItem);
    }
  };

  scopes(): BoardScope[] {
    return [...this.#changes.values()].map(change => change.scope);
  }

  changes(): { scope: BoardScope; cards: ChangedCards }[] {
    return [...this.#changes.values()].map(({ scope, writes }) => ({
      scope,
      cards: writes && [
        ...[...writes.cards].map(card => ({ card })),
        ...[...writes.workItems].filter(workItem => !writes.carded.has(workItem)).map(workItem => ({ workItem })),
      ],
    }));
  }
}

/**
 * The card ids behind committed card row writes, reading the board row of each work item no board
 * row write named. `undefined` when any of them has no board row left to read.
 */
export async function cardsNamed(
  ops: FactoryStorageOps,
  scope: Required<BoardScope>,
  cards: ChangedCards,
): Promise<string[] | undefined> {
  if (!cards) return undefined;
  const named = new Set<string>();
  const unnamed = new Set<string>();
  for (const write of cards) {
    if (write.card !== undefined) named.add(write.card);
    else unnamed.add(write.workItem);
  }
  if (unnamed.size === 0) return [...named];
  const rows = await ops.findMany<{ id: string }>(FACTORY_BOARD_ITEMS_SCHEMA.name, {
    org_id: scope.orgId,
    factory_project_id: scope.factoryProjectId,
    work_item_id: { in: [...unnamed] },
  });
  if (rows.length < unnamed.size) return undefined;
  for (const row of rows) named.add(row.id);
  return [...named];
}

export async function bumpBoardVersions(ops: FactoryStorageOps, scopes: readonly BoardScope[]): Promise<void> {
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
