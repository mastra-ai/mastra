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
} from '@mastra/core/storage';

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_SPAN_EVENTS } from './ddl';
import { rowToLightSpanRecord, rowToSpanRecord, spanRecordToRow } from './helpers';
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
