import { randomUUID } from 'node:crypto';
import type { CollectionSchema, CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';

/**
 * One row per project whose `version` is replaced after every committed write to that project's
 * `work_items`. Readers of the full card list compare it against the version their snapshot was
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

/**
 * One row per deleted card, so a board that synced before the delete learns to drop it. Board
 * syncs older than {@link WORK_ITEM_TOMBSTONE_TTL_MS} reload instead of reading these.
 */
export const FACTORY_WORK_ITEM_TOMBSTONES_SCHEMA: CollectionSchema = {
  name: 'factory_work_item_tombstones',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    work_item_id: { type: 'text' },
    deleted_at: { type: 'timestamp' },
  },
  indexes: [{ name: 'factory_work_item_tombstones_scope', columns: ['org_id', 'factory_project_id', 'deleted_at'] }],
};

export const WORK_ITEM_TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** A project, or every project in an org when a write's filter only names the org. */
export interface BoardScope {
  orgId: string;
  factoryProjectId?: string;
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
 * A card write that changes something moves `changed_at`, so board syncs can ask for what
 * changed since. It is not `updated_at`: counter recounts and other bookkeeping change the
 * board without counting as an edit to the card.
 */
function stamped(patch: unknown): unknown {
  if (patch === null || typeof patch !== 'object' || Object.keys(patch).length === 0) return patch;
  return { ...(patch as Record<string, unknown>), changed_at: new Date() };
}

/**
 * Wrap `ops` so every write to `work_items` reports the board it changed, once the write has
 * resolved, and stamps `changed_at` on every card it writes. Writes outside any tenant
 * (`dangerouslyClearAll`) report nothing.
 */
export function trackBoardWrites(
  ops: FactoryStorageOps,
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
            const row = await value.call(
              target,
              collection,
              where,
              async (current: unknown) => {
                const patch = await updater(current);
                patched = patch != null;
                return collection === 'work_items' ? stamped(patch) : patch;
              },
              ...args,
            );
            if (collection === 'work_items' && patched) await report(scopeOfRow(row));
            return row;
          };
        case 'insertOne':
        case 'upsertOne':
          return async (collection: string, ...args: unknown[]) => {
            if (collection === 'work_items') {
              const at = property === 'insertOne' ? 0 : 1;
              args[at] = stamped(args[at]);
            }
            const row = await value.call(target, collection, ...args);
            if (collection === 'work_items') await report(scopeOfRow(row));
            return row;
          };
        case 'updateMany':
        case 'deleteMany':
          return async (collection: string, where: CollectionWhere, ...args: unknown[]) => {
            if (property === 'updateMany' && collection === 'work_items') args[0] = stamped(args[0]);
            const count: number = await value.call(target, collection, where, ...args);
            if (collection === 'work_items' && count > 0) await report(scopeOfWhere(where));
            return count;
          };
        default:
          return value.bind(target);
      }
    },
  });
}

/** Collects the boards a transaction changed so they can be bumped once it has committed. */
export class BoardScopes {
  readonly #scopes = new Map<string, BoardScope>();

  add = (scope: BoardScope): void => {
    this.#scopes.set(scopeKey(scope), scope);
  };

  values(): BoardScope[] {
    return [...this.#scopes.values()];
  }
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
