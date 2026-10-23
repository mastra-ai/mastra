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
 * Wrap `ops` so every write to `work_items` reports the board it changed, once the write has
 * resolved. Writes outside any tenant (`dangerouslyClearAll`) report nothing.
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
                return patch;
              },
              ...args,
            );
            if (collection === 'work_items' && patched) await report(scopeOfRow(row));
            return row;
          };
        case 'insertOne':
        case 'upsertOne':
          return async (collection: string, ...args: unknown[]) => {
            const row = await value.call(target, collection, ...args);
            if (collection === 'work_items') await report(scopeOfRow(row));
            return row;
          };
        case 'updateMany':
        case 'deleteMany':
          return async (collection: string, where: CollectionWhere, ...args: unknown[]) => {
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
