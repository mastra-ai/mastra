/**
 * Shared WHERE-clause builder for the v-next Postgres observability domain.
 *
 * Translates the cross-signal `commonFilterFields` (defined in
 * @internal/core/storage/shared) into parameterized SQL conditions.
 * Signal-specific extensions (e.g. log `level`, metric `name`,
 * trace `status`) are added by the caller.
 */

export interface FilterAccumulator {
  conditions: string[];
  params: unknown[];
  /** Next bind index. Mutates as conditions are pushed. */
  next: number;
}

export function newFilterAccumulator(startIndex = 1): FilterAccumulator {
  return { conditions: [], params: [], next: startIndex };
}

function pushEq(acc: FilterAccumulator, column: string, value: unknown, prefix = ''): void {
  if (value === undefined) return;
  acc.conditions.push(`${prefix}"${column}" = $${acc.next++}`);
  acc.params.push(value);
}

function pushIn(acc: FilterAccumulator, column: string, values: readonly unknown[], prefix = ''): void {
  if (!values.length) return;
  const placeholders = values.map(() => `$${acc.next++}`).join(', ');
  acc.conditions.push(`${prefix}"${column}" IN (${placeholders})`);
  acc.params.push(...values);
}

/**
 * Apply common filter fields (shared across logs / metrics / scores / feedback).
 * `timestampColumn` allows the caller to use a different time column name on
 * tables where the time column is not literally `timestamp` (the tracing
 * tables use `endedAt`).
 */
export function applyCommonFilters(
  acc: FilterAccumulator,
  filters: Record<string, any> | undefined,
  options: { timestampColumn?: string; prefix?: string } = {},
): void {
  if (!filters) return;
  const tsCol = options.timestampColumn ?? 'timestamp';
  const prefix = options.prefix ?? '';

  if (filters.timestamp?.start) {
    const op = filters.timestamp.startExclusive ? '>' : '>=';
    acc.conditions.push(`${prefix}"${tsCol}" ${op} $${acc.next++}`);
    acc.params.push(filters.timestamp.start.toISOString());
  }
  if (filters.timestamp?.end) {
    const op = filters.timestamp.endExclusive ? '<' : '<=';
    acc.conditions.push(`${prefix}"${tsCol}" ${op} $${acc.next++}`);
    acc.params.push(filters.timestamp.end.toISOString());
  }
  pushEq(acc, 'traceId', filters.traceId, prefix);
  pushEq(acc, 'spanId', filters.spanId, prefix);
  pushEq(acc, 'entityType', filters.entityType, prefix);
  pushEq(acc, 'entityName', filters.entityName, prefix);
  pushEq(acc, 'entityVersionId', filters.entityVersionId, prefix);
  pushEq(acc, 'parentEntityType', filters.parentEntityType, prefix);
  pushEq(acc, 'parentEntityName', filters.parentEntityName, prefix);
  pushEq(acc, 'parentEntityVersionId', filters.parentEntityVersionId, prefix);
  pushEq(acc, 'rootEntityType', filters.rootEntityType, prefix);
  pushEq(acc, 'rootEntityName', filters.rootEntityName, prefix);
  pushEq(acc, 'rootEntityVersionId', filters.rootEntityVersionId, prefix);
  pushEq(acc, 'userId', filters.userId, prefix);
  pushEq(acc, 'organizationId', filters.organizationId, prefix);
  pushEq(acc, 'resourceId', filters.resourceId, prefix);
  pushEq(acc, 'runId', filters.runId, prefix);
  pushEq(acc, 'sessionId', filters.sessionId, prefix);
  pushEq(acc, 'threadId', filters.threadId, prefix);
  pushEq(acc, 'requestId', filters.requestId, prefix);
  pushEq(acc, 'experimentId', filters.experimentId, prefix);
  pushEq(acc, 'environment', filters.environment, prefix);
  pushEq(acc, 'serviceName', filters.serviceName, prefix);
  // `source` is the deprecated legacy field name across logs / metrics /
  // scores / feedback. New code should set `executionSource`; we accept
  // both at the storage layer so old callers keep working. `executionSource`
  // wins when both are set.
  pushEq(acc, 'executionSource', filters.executionSource ?? filters.source, prefix);

  if (filters.tags != null && Array.isArray(filters.tags) && filters.tags.length > 0) {
    acc.conditions.push(`${prefix}"tags" @> $${acc.next++}::text[]`);
    acc.params.push(filters.tags);
  }
}

/** Single-value or array-of-values equality filter (e.g. logs.level, metrics.name). */
export function applySingleOrArrayFilter(
  acc: FilterAccumulator,
  column: string,
  value: string | string[] | undefined,
  prefix = '',
): void {
  if (value === undefined) return;
  if (Array.isArray(value)) {
    pushIn(acc, column, value, prefix);
  } else {
    pushEq(acc, column, value, prefix);
  }
}

export function whereOrEmpty(acc: FilterAccumulator): string {
  return acc.conditions.length ? `WHERE ${acc.conditions.join(' AND ')}` : '';
}
