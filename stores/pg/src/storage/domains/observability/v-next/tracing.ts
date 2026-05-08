/**
 * Tracing operations for the v-next Postgres observability domain.
 *
 * Insert-only: only ended spans are persisted. Retry idempotency is provided
 * by `ON CONFLICT ("traceId", "spanId", "endedAt") DO NOTHING` on the
 * partitioned span table.
 */

import type {
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  CreateSpanArgs,
  GetSpanArgs,
  GetSpanResponse,
  GetTraceArgs,
  GetTraceResponse,
  GetTraceLightResponse,
  LightSpanRecord,
} from '@mastra/core/storage';

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_SPAN_EVENTS, TABLE_TRACE_ROOTS } from './ddl';
import { rowToSpanRecord, spanRecordToRow } from './helpers';
import { buildInsert, SPAN_LIGHT_SELECT_COLUMNS, SPAN_SELECT_COLUMNS } from './sql';

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createSpan(client: DbClient, schema: string, args: CreateSpanArgs): Promise<void> {
  const row = spanRecordToRow(args.span);
  const insert = buildInsert(schema, TABLE_SPAN_EVENTS, [row]);
  if (insert) await client.query(insert.text, insert.values);
}

export async function batchCreateSpans(client: DbClient, schema: string, args: BatchCreateSpansArgs): Promise<void> {
  if (args.records.length === 0) return;
  const rows = args.records.map(spanRecordToRow);
  const insert = buildInsert(schema, TABLE_SPAN_EVENTS, rows);
  if (insert) await client.query(insert.text, insert.values);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getSpan(client: DbClient, schema: string, args: GetSpanArgs): Promise<GetSpanResponse | null> {
  const table = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const row = await client.oneOrNone<Record<string, any>>(
    `SELECT ${SPAN_SELECT_COLUMNS}
     FROM ${table}
     WHERE "traceId" = $1 AND "spanId" = $2
     ORDER BY "endedAt" DESC
     LIMIT 1`,
    [args.traceId, args.spanId],
  );
  if (!row) return null;
  return { span: rowToSpanRecord(row) };
}

export async function getTrace(client: DbClient, schema: string, args: GetTraceArgs): Promise<GetTraceResponse | null> {
  const table = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const rows = await client.manyOrNone<Record<string, any>>(
    `SELECT ${SPAN_SELECT_COLUMNS}
     FROM ${table}
     WHERE "traceId" = $1
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
    `SELECT ${SPAN_LIGHT_SELECT_COLUMNS}
     FROM ${table}
     WHERE "traceId" = $1
     ORDER BY "startedAt" ASC`,
    [args.traceId],
  );
  if (!rows.length) return null;
  return {
    traceId: args.traceId,
    spans: rows.map(row => rowToSpanRecord(row) as unknown as LightSpanRecord),
  };
}

// ---------------------------------------------------------------------------
// Deletes
// ---------------------------------------------------------------------------

export async function batchDeleteTraces(client: DbClient, schema: string, args: BatchDeleteTracesArgs): Promise<void> {
  if (args.traceIds.length === 0) return;
  const span = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const roots = qualifiedTable(schema, TABLE_TRACE_ROOTS);
  const placeholders = args.traceIds.map((_, i) => `$${i + 1}`).join(', ');
  await Promise.all([
    client.query(`DELETE FROM ${span} WHERE "traceId" IN (${placeholders})`, args.traceIds),
    client.query(`DELETE FROM ${roots} WHERE "traceId" IN (${placeholders})`, args.traceIds),
  ]);
}

/** Truncate the tracing tables. */
export async function dangerouslyClearTracing(client: DbClient, schema: string): Promise<void> {
  const span = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const roots = qualifiedTable(schema, TABLE_TRACE_ROOTS);
  // CASCADE so the trigger function (which has a dependency on span_events) is
  // not affected, but partitions are.
  await Promise.all([client.none(`TRUNCATE TABLE ${span}`), client.none(`TRUNCATE TABLE ${roots}`)]);
}
