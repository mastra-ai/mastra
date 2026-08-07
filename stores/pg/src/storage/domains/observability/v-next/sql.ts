/**
 * SQL helpers for the v-next Postgres observability domain.
 *
 * Provides a multi-row INSERT builder with `ON CONFLICT DO NOTHING` for
 * insert-only retry idempotency, and explicit jsonb / text[] casts so the
 * pg driver doesn't have to guess column types.
 */

import { parseSqlIdentifier } from '@mastra/core/utils';
import { qualifiedTable } from './ddl';
import {
  buildNamedSelectColumns,
  buildSelectColumns,
  FEEDBACK_EVENT_COLUMNS,
  JSONB_COLUMNS,
  LOG_EVENT_COLUMNS,
  METRIC_EVENT_COLUMNS,
  SCORE_EVENT_COLUMNS,
  SPAN_EVENT_COLUMNS,
  SPAN_LIGHT_SELECT_COLUMN_NAMES,
  TEXT_ARRAY_COLUMNS,
} from './signal-schema';

/**
 * Encode a JS value for a `$N::jsonb` cast. Always `JSON.stringify` so a
 * plain string like `"hello"` becomes `"hello"` (a valid JSON scalar) and
 * not the bare word `hello`, which Postgres rejects when cast to jsonb.
 */
function encodeJsonb(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

/**
 * Build a multi-row INSERT with explicit column types and ON CONFLICT DO NOTHING.
 *
 * @param schema     Schema name.
 * @param table      Table name.
 * @param records    Array of records (each is a column-name → value object).
 *                   All records must have identical key sets.
 * @returns          { text, values } ready to pass to `client.query`.
 */
export function buildInsert(
  schema: string,
  table: string,
  records: Record<string, unknown>[],
): { text: string; values: unknown[] } | null {
  if (records.length === 0) return null;
  const columns = Object.keys(records[0]!).map(c => parseSqlIdentifier(c, 'column name'));
  const quotedColumns = columns.map(c => `"${c}"`).join(', ');

  const values: unknown[] = [];
  const rowPlaceholders: string[] = [];
  let p = 1;

  for (const record of records) {
    const placeholders = columns.map(col => {
      const raw = (record as Record<string, unknown>)[col];
      if (JSONB_COLUMNS.has(col)) {
        values.push(encodeJsonb(raw));
        return `$${p++}::jsonb`;
      }
      if (TEXT_ARRAY_COLUMNS.has(col)) {
        values.push(Array.isArray(raw) ? raw : []);
        return `$${p++}::text[]`;
      }
      values.push(raw === undefined ? null : raw);
      return `$${p++}`;
    });
    rowPlaceholders.push(`(${placeholders.join(', ')})`);
  }

  const text = `INSERT INTO ${qualifiedTable(schema, table)} (${quotedColumns})
VALUES ${rowPlaceholders.join(', ')}
ON CONFLICT DO NOTHING`;

  return { text, values };
}

/**
 * Standard SELECT column list for tracing tables. The select projects every
 * column the row→record converters expect.
 */
export const SPAN_SELECT_COLUMNS = `
${buildSelectColumns(SPAN_EVENT_COLUMNS)}`;

export const SPAN_LIGHT_SELECT_COLUMNS = `
${buildNamedSelectColumns(SPAN_LIGHT_SELECT_COLUMN_NAMES)}`;

export const METRIC_SELECT_COLUMNS = `
${buildSelectColumns(METRIC_EVENT_COLUMNS)}`;

export const LOG_SELECT_COLUMNS = `
${buildSelectColumns(LOG_EVENT_COLUMNS)}`;

export const SCORE_SELECT_COLUMNS = `
${buildSelectColumns(SCORE_EVENT_COLUMNS)}`;

export const FEEDBACK_SELECT_COLUMNS = `
${buildSelectColumns(FEEDBACK_EVENT_COLUMNS)}`;
