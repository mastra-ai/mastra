import type { InValue } from '@libsql/client';

/**
 * Tenancy scope shape shared by domains that carry `organizationId` / `projectId`
 * columns (datasets, experiments, etc.). Structurally compatible with
 * `DatasetTenancyFilters` and `ExperimentTenancyFilters` in `@mastra/core/storage`.
 */
export type TenancyScope = {
  organizationId?: string;
  projectId?: string;
};

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
