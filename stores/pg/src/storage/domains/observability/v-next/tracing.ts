/**
 * Tracing operations for the v-next Postgres observability domain.
 *
 * Event-sourced: a span is written when it starts and again when it ends, so a
 * running span is visible before its result exists. The two rows differ in
 * `endedAt` (part of the primary key), so they coexist; reads collapse them
 * back to one span per `(traceId, spanId)`.
 */

import type {
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  CreateSpanArgs,
  GetSpansArgs,
  GetSpansResponse,
  GetSpanArgs,
  GetSpanResponse,
  GetTraceArgs,
  GetTraceResponse,
  GetTraceLightResponse,
} from '@mastra/core/storage';

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_SPAN_EVENTS } from './ddl';
import { rowToLightSpanRecord, rowToSpanRecord, spanRecordToRow } from './helpers';
import {
  buildInsert,
  spanConflictClause,
  SPAN_COLLAPSE_ORDER,
  SPAN_LIGHT_SELECT_COLUMNS,
  SPAN_SELECT_COLUMNS,
} from './sql';

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function writeSpanRows(client: DbClient, schema: string, rows: Record<string, unknown>[]): Promise<void> {
  const deduped = dedupeSpanRows(rows);
  const insert = buildInsert(schema, TABLE_SPAN_EVENTS, deduped, spanConflictClause(Object.keys(deduped[0] ?? {})));
  if (insert) await client.query(insert.text, insert.values);
}

/**
 * Collapse rows that share a primary key within a single batch. Postgres
 * rejects an `ON CONFLICT DO UPDATE` statement whose VALUES list would touch
 * the same row twice, which a batch containing both the start and the end of a
 * zero-duration span would do. The ended row wins, matching what the conflict
 * clause would have done across two separate statements.
 */
function dedupeSpanRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  if (rows.length < 2) return rows;
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = `${row.traceId}\u0000${row.spanId}\u0000${String(row.endedAt)}`;
    const existing = byKey.get(key);
    if (existing && !existing.isPending) continue;
    byKey.set(key, row);
  }
  return [...byKey.values()];
}

export async function createSpan(client: DbClient, schema: string, args: CreateSpanArgs): Promise<void> {
  await writeSpanRows(client, schema, [spanRecordToRow(args.span)]);
}

export async function batchCreateSpans(client: DbClient, schema: string, args: BatchCreateSpansArgs): Promise<void> {
  if (args.records.length === 0) return;
  await writeSpanRows(client, schema, args.records.map(spanRecordToRow));
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getSpans(client: DbClient, schema: string, args: GetSpansArgs): Promise<GetSpansResponse> {
  if (args.spanIds.length === 0) {
    return { traceId: args.traceId, spans: [] };
  }

  const table = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const rows = await client.manyOrNone<Record<string, any>>(
    `SELECT * FROM (
       SELECT DISTINCT ON ("spanId") ${SPAN_SELECT_COLUMNS}
       FROM ${table}
       WHERE "traceId" = $1
         AND "spanId" = ANY($2::text[])
       ORDER BY "spanId", ${SPAN_COLLAPSE_ORDER}
     ) collapsed
     ORDER BY "startedAt" ASC`,
    [args.traceId, args.spanIds],
  );

  return { traceId: args.traceId, spans: rows.map(rowToSpanRecord) };
}

export async function getSpan(client: DbClient, schema: string, args: GetSpanArgs): Promise<GetSpanResponse | null> {
  const table = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const row = await client.oneOrNone<Record<string, any>>(
    `SELECT ${SPAN_SELECT_COLUMNS}
     FROM ${table}
     WHERE "traceId" = $1 AND "spanId" = $2
     ORDER BY ${SPAN_COLLAPSE_ORDER}
     LIMIT 1`,
    [args.traceId, args.spanId],
  );
  if (!row) return null;
  return { span: rowToSpanRecord(row) };
}

export async function getTrace(client: DbClient, schema: string, args: GetTraceArgs): Promise<GetTraceResponse | null> {
  const table = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const rows = await client.manyOrNone<Record<string, any>>(
    `SELECT * FROM (
       SELECT DISTINCT ON ("spanId") ${SPAN_SELECT_COLUMNS}
       FROM ${table}
       WHERE "traceId" = $1
       ORDER BY "spanId", ${SPAN_COLLAPSE_ORDER}
     ) collapsed
     ORDER BY "startedAt" ASC`,
    [args.traceId],
  );
  if (!rows.length) return null;
  return { traceId: args.traceId, spans: rows.map(rowToSpanRecord) };
}

export async function getTraceLight(
  client: DbClient,
  schema: string,
  args: GetTraceArgs,
): Promise<GetTraceLightResponse | null> {
  const table = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const rows = await client.manyOrNone<Record<string, any>>(
    `SELECT * FROM (
       SELECT DISTINCT ON ("spanId") ${SPAN_LIGHT_SELECT_COLUMNS}
       FROM ${table}
       WHERE "traceId" = $1
       ORDER BY "spanId", ${SPAN_COLLAPSE_ORDER}
     ) collapsed
     ORDER BY "startedAt" ASC`,
    [args.traceId],
  );
  if (!rows.length) return null;
  return {
    traceId: args.traceId,
    spans: rows.map(rowToLightSpanRecord),
  };
}

// ---------------------------------------------------------------------------
// Deletes
// ---------------------------------------------------------------------------

export async function batchDeleteTraces(client: DbClient, schema: string, args: BatchDeleteTracesArgs): Promise<void> {
  if (args.traceIds.length === 0) return;
  const span = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const placeholders = args.traceIds.map((_, i) => `$${i + 1}`).join(', ');
  await client.query(`DELETE FROM ${span} WHERE "traceId" IN (${placeholders})`, args.traceIds);
}

/** Truncate the span_events table. */
export async function dangerouslyClearTracing(client: DbClient, schema: string): Promise<void> {
  const span = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  // RESTART IDENTITY resets the owned `cursorId` bigserial sequence so tests
  // that clear and then exercise delta polling start from a known cursor.
  await client.none(`TRUNCATE TABLE ${span} RESTART IDENTITY`);
}
