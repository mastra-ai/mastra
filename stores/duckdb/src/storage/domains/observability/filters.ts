import type { DateRange } from '@mastra/core/storage';
import { parseFieldKey } from '@mastra/core/utils';

export function buildJsonPath(key: string): string {
  try {
    return `$.${parseFieldKey(key)}`;
  } catch {
    const escaped = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `$["${escaped}"]`;
  }
}

function normalizeJsonFilterValue(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value === 'string') return value;
  const json = JSON.stringify(value);
  return json ?? null;
}

function sanitizeColumn(column: string): string {
  return parseFieldKey(column);
}

/**
 * Build a WHERE clause from a filter object.
 * Returns { clause, params } for parameterized queries.
 */
export function buildWhereClause(
  filters: Record<string, unknown> | undefined,
  fieldMappings?: Record<string, string>,
): { clause: string; params: unknown[] } {
  if (!filters) return { clause: '', params: [] };

  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;

    const column = sanitizeColumn(fieldMappings?.[key] ?? key);

    if (key === 'timestamp' || key === 'startedAt' || key === 'endedAt') {
      const dateRange = value as DateRange;
      if (dateRange.start) {
        const op = dateRange.startExclusive ? '>' : '>=';
        conditions.push(`${column} ${op} ?`);
        params.push(dateRange.start);
      }
      if (dateRange.end) {
        const op = dateRange.endExclusive ? '<' : '<=';
        conditions.push(`${column} ${op} ?`);
        params.push(dateRange.end);
      }
      continue;
    }

    if (key === 'labels') {
      const labelsObj = value as Record<string, string>;
      for (const [labelKey, labelValue] of Object.entries(labelsObj)) {
        conditions.push(`json_extract_string(${column}, ?) = ?`);
        params.push(buildJsonPath(labelKey), labelValue);
      }
      continue;
    }

    if (key === 'tags') {
      const tags = value as string[];
      for (const tag of tags) {
        conditions.push(`list_contains(CAST(${column} AS VARCHAR[]), ?)`);
        params.push(tag);
      }
      continue;
    }

    if (key === 'status') {
      // Derived field for traces
      const status = value as string;
      if (status === 'error') {
        conditions.push(`error IS NOT NULL`);
      } else if (status === 'running') {
        conditions.push(`endedAt IS NULL AND error IS NULL`);
      } else if (status === 'success') {
        conditions.push(`endedAt IS NOT NULL AND error IS NULL`);
      }
      continue;
    }

    if (key === 'hasChildError') {
      // Handled at query level, skip for now
      continue;
    }

    if (key === 'metadata' || key === 'scope') {
      const jsonObj = value as Record<string, unknown>;
      for (const [jsonKey, jsonValue] of Object.entries(jsonObj)) {
        const normalized = normalizeJsonFilterValue(jsonValue);
        if (normalized === null) continue;
        conditions.push(`json_extract_string(${column}, ?) = ?`);
        params.push(buildJsonPath(jsonKey), normalized);
      }
      continue;
    }

    // Array values => IN clause
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      const placeholders = value.map(() => '?').join(', ');
      conditions.push(`${column} IN (${placeholders})`);
      params.push(...value);
      continue;
    }

    // Simple equality
    conditions.push(`${column} = ?`);
    params.push(value);
  }

  const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { clause, params };
}

/**
 * Build an ORDER BY clause from orderBy config.
 */
export function buildOrderByClause(orderBy?: { field: string; direction: string }): string {
  if (!orderBy) return '';
  const dir = orderBy.direction.toUpperCase();
  if (dir !== 'ASC' && dir !== 'DESC') {
    throw new Error(`Invalid sort direction: ${orderBy.direction}`);
  }
  const field = parseFieldKey(orderBy.field);
  return `ORDER BY ${field} ${dir}`;
}

/**
 * Build a LIMIT/OFFSET clause from pagination config.
 */
export function buildPaginationClause(pagination?: { page: number; perPage: number }): {
  clause: string;
  params: unknown[];
} {
  if (!pagination) return { clause: '', params: [] };
  if (!Number.isInteger(pagination.page) || pagination.page < 0) {
    throw new Error(`Invalid page: ${pagination.page}`);
  }
  if (!Number.isInteger(pagination.perPage) || pagination.perPage <= 0) {
    throw new Error(`Invalid perPage: ${pagination.perPage}`);
  }
  const offset = pagination.page * pagination.perPage;
  return {
    clause: `LIMIT ? OFFSET ?`,
    params: [pagination.perPage, offset],
  };
}
