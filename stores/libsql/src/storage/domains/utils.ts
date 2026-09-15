import type { DatasetTenancyFilters, ExperimentTenancyFilters } from '@mastra/core/storage';

import type { SqliteInValue as InValue } from '../db/client';

/**
 * Tenancy scope shape shared by domains that carry `organizationId` / `projectId`
 * columns (datasets, experiments, ...). Aliases the core tenancy filter types so
 * this helper stays in sync if the core shape ever changes.
 */
export type TenancyScope = DatasetTenancyFilters | ExperimentTenancyFilters;

/**
 * Build additional `AND col = ?` conditions for a tenancy read-scope filter.
 * Returned in the shape expected by libsql's parameterized SQL builders.
 * When `filters` is undefined or empty, returns empty arrays (no scoping).
 *
 * Shared across domains (datasets, experiments, ...) so tenancy predicates stay
 * consistent and cross-tenant reads/deletes do not leak.
 */
export function tenancyWhere(filters?: TenancyScope): { conditions: string[]; params: InValue[] } {
  const conditions: string[] = [];
  const params: InValue[] = [];
  if (filters?.organizationId !== undefined) {
    conditions.push('organizationId = ?');
    params.push(filters.organizationId);
  }
  if (filters?.projectId !== undefined) {
    conditions.push('projectId = ?');
    params.push(filters.projectId);
  }
  return { conditions, params };
}

/**
 * Build a WHERE clause that scopes a query to `<idColumn> = ?` plus any tenancy
 * predicates. Small DRY helper on top of {@link tenancyWhere} for the common
 * pattern used by tenancy-aware getters and deletes.
 *
 * @example
 *   const { sql, args } = buildScopedWhere('id', args.id, args.filters);
 *   await client.execute({ sql: `SELECT * FROM t WHERE ${sql}`, args });
 */
export function buildScopedWhere(
  idColumn: string,
  idValue: InValue,
  filters?: TenancyScope,
): { sql: string; args: InValue[] } {
  const { conditions, params } = tenancyWhere(filters);
  return {
    sql: [`${idColumn} = ?`, ...conditions].join(' AND '),
    args: [idValue, ...params],
  };
}
