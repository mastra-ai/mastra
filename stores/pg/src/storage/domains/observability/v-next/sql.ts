/**
 * SQL helpers for the v-next Postgres observability domain.
 *
 * Provides a multi-row INSERT builder with a configurable conflict clause
 * (`ON CONFLICT DO NOTHING` by default, for retry idempotency), and explicit
 * jsonb / text[] casts so the pg driver doesn't have to guess column types.
 */

import { parseSqlIdentifier } from '@mastra/core/utils';
import { sanitizeJsonForPg } from '../../../db/sanitize-json';
import { qualifiedTable, TABLE_SPAN_EVENTS } from './ddl';
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
 *
 * The result is sanitized because Postgres rejects some sequences that are
 * legal in JSON: NUL (`\u0000`) fails with 22P05 and unpaired UTF-16
 * surrogates fail with 22P02. Inserts here are batched into a single
 * multi-row statement, so one bad value would otherwise reject the whole
 * batch of observability events.
 */
function encodeJsonb(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return sanitizeJsonForPg(JSON.stringify(value));
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
  onConflict = 'ON CONFLICT DO NOTHING',
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
${onConflict}`;

  return { text, values };
}

/** Primary key of the span table; also the conflict target for span upserts. */
const SPAN_KEY_COLUMNS = ['traceId', 'spanId', 'endedAt'];

/**
 * Conflict clause for span writes.
 *
 * A span is written twice under the event-sourced strategy: once when it starts
 * (`isPending = true`, `endedAt` synthesized from `startedAt`) and once when it
 * ends. Those two rows normally differ in `endedAt` and so coexist under the
 * primary key. A zero-duration span is the exception — its real `endedAt`
 * equals its `startedAt`, so the end row collides with the pending row. Letting
 * `DO NOTHING` win there would strand the span as permanently running, so the
 * end row overwrites the pending one instead.
 *
 * The `WHERE` guard keeps the clause a no-op for every other conflict, which
 * preserves insert-only retry idempotency: a replayed end row cannot clobber
 * the row it duplicates, and a late-arriving start row cannot revert an ended
 * span to pending.
 */
export function spanConflictClause(columns: readonly string[]): string {
  const assignments = columns
    .filter(column => !SPAN_KEY_COLUMNS.includes(column))
    .map(column => `"${column}" = EXCLUDED."${column}"`)
    .join(', ');
  return `ON CONFLICT ("traceId", "spanId", "endedAt") DO UPDATE SET ${assignments}
WHERE ${TABLE_SPAN_EVENTS}."isPending" AND NOT EXCLUDED."isPending"`;
}

/**
 * Ordering that picks the winning row for a span under the event-sourced write
 * model. An ended row always beats a pending row for the same span; among rows
 * of the same kind the latest write wins, with `cursorId` breaking ties between
 * rows that share a timestamp. Combine with `DISTINCT ON` (or `LIMIT 1`) after
 * the grouping key to collapse a span's rows down to one.
 */
export const SPAN_COLLAPSE_ORDER = '"isPending" ASC, "endedAt" DESC, "cursorId" DESC';

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
