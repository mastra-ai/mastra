/**
 * SQL helpers for the v-next Postgres observability domain.
 *
 * Provides a multi-row INSERT builder with a configurable conflict clause
 * (`ON CONFLICT DO NOTHING` by default, for retry idempotency), and explicit
 * jsonb / text[] casts so the pg driver doesn't have to guess column types.
 */

import { parseSqlIdentifier } from '@mastra/core/utils';
import type { DbClient } from '../../../client';
import { toPgJson } from '../../../db/sanitize-json';
import { qualifiedTable, SIGNAL_TIME_COLUMN, TABLE_SPAN_EVENTS } from './ddl';
import type { SignalTable } from './ddl';
import { ensureDayPartitions, isMissingPartitionError, resolveMode, withinPartitionWindow } from './partitioning';
import type { PartitioningOptions } from './partitioning';
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
  if (value instanceof EncodedJsonb) return value.json;
  return toPgJson(value);
}

/**
 * A jsonb value the caller already serialized with `toPgJson`, so `buildInsert`
 * sends it as is instead of serializing it again. Span writes serialize their
 * payloads up front because the stored previews are built from that same text.
 */
export class EncodedJsonb {
  constructor(readonly json: string) {}
}

/** Serialize a value for a jsonb column once, for callers that also need the text. */
export function encodeJsonbValue(value: unknown): EncodedJsonb | null {
  if (value === null || value === undefined) return null;
  const json = toPgJson(value);
  return json === undefined ? null : new EncodedJsonb(json);
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

/**
 * Insert into a signal table. In native partition mode, a row whose day is
 * inside the partition window but has no partition yet gets one created, then
 * the insert runs once more. TimescaleDB and pg_partman own their partitions,
 * so in those modes the original error propagates untouched. The mode is the
 * one the store resolved; a store that never ran init() (`disableInit`)
 * detects it here, after the failed insert, so the hot path stays one query.
 */
export async function insertRows(
  client: DbClient,
  schema: string,
  table: SignalTable,
  records: Record<string, unknown>[],
  partitioning: PartitioningOptions,
  onConflict?: string,
): Promise<void> {
  const insert = buildInsert(schema, table, records, onConflict);
  if (!insert) return;
  try {
    await client.query(insert.text, insert.values);
  } catch (error) {
    if (!isMissingPartitionError(error) || (await resolveMode(client, partitioning)) !== 'native') throw error;
    const days = withinPartitionWindow(recordDays(records, SIGNAL_TIME_COLUMN[table]), partitioning);
    if (days.length === 0) throw error;
    // One day at a time, so a failure names the day that could not be
    // created rather than every day in the batch.
    for (const day of days) {
      await ensureDayPartitions(client, schema, table, [day]).catch((cause: unknown) => {
        throw new Error(partitionCreateFailure({ table, day, cause }), { cause });
      });
    }
    await client.query(insert.text, insert.values);
  }
}

/**
 * The usual cause is a role that may create tables but does not own the
 * signal tables, so it cannot attach a partition to them.
 */
function partitionCreateFailure({ table, day, cause }: { table: SignalTable; day: Date; cause: unknown }) {
  const reason = cause instanceof Error ? cause.message : String(cause);
  return (
    `Could not create the ${table} partition for ${day.toISOString().slice(0, 10)} (UTC): ${reason}. ` +
    'Create the partitions as the table owner, for example by calling ensurePartitions() on a schedule ' +
    'with a role that owns the observability tables.'
  );
}

function recordDays(records: Record<string, unknown>[], timeColumn: string): Date[] {
  const days = new Map<string, Date>();
  for (const record of records) {
    const value = record[timeColumn];
    if (value == null) continue;
    const d = new Date(value as string | number | Date);
    if (isNaN(d.getTime())) continue;
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    days.set(day.toISOString(), day);
  }
  return [...days.values()];
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
