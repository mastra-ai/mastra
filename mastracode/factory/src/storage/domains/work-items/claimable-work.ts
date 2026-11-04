import type { FactoryStorageOps } from '@mastra/core/storage';

/** The project a write queued claimable dispatcher work for. */
export interface FactoryClaimableWorkScope {
  orgId: string;
  factoryProjectId: string;
}

export const LEASE_TABLES = ['factory_deferred_decisions', 'factory_pending_starts'] as const;
const CLAIMABLE_STATUSES = new Set(['pending', 'retry']);

function claimableScope(collection: string, row: unknown): FactoryClaimableWorkScope | undefined {
  if (!(LEASE_TABLES as readonly string[]).includes(collection) || !row || typeof row !== 'object') return undefined;
  const { status, org_id, factory_project_id } = row as Record<string, unknown>;
  if (typeof status !== 'string' || !CLAIMABLE_STATUSES.has(status)) return undefined;
  if (typeof org_id !== 'string' || typeof factory_project_id !== 'string') return undefined;
  return { orgId: org_id, factoryProjectId: factory_project_id };
}

/**
 * Wrap `ops` so every write that leaves a lease-table row `pending` or `retry` reports its
 * project once the write has resolved. The dispatcher sleeps while nothing is claimable, so
 * this is how new work reaches it; doing it at the ops layer means a new write site can't
 * forget to.
 */
export function trackClaimableWrites(
  ops: FactoryStorageOps,
  queued: (scope: FactoryClaimableWorkScope) => void,
): FactoryStorageOps {
  const report = (collection: string, row: unknown) => {
    const scope = claimableScope(collection, row);
    if (scope) queued(scope);
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
            if (patched) report(collection, row);
            return row;
          };
        case 'insertOne':
        case 'upsertOne':
          return async (collection: string, ...args: unknown[]) => {
            const row = await value.call(target, collection, ...args);
            report(collection, row);
            return row;
          };
        default:
          return value.bind(target);
      }
    },
  });
}
