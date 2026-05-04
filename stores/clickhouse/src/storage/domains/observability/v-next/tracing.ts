/**
 * Tracing operations for ClickHouse v-next observability.
 *
 * Owns: batchCreateSpans, getSpan, getTrace, batchDeleteTraces, dangerouslyClearSpanEvents
 * Delegates to trace-roots.ts: listTraces, getRootSpan
 */

import type { ClickHouseClient } from '@clickhouse/client';
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
  SpanRecord,
} from '@mastra/core/storage';

import { TABLE_SPAN_EVENTS, TABLE_TRACE_ROOTS } from './ddl';
import { CH_SETTINGS, CH_INSERT_SETTINGS, spanRecordToRow, rowToSpanRecord } from './helpers';

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/** Insert a single completed span. */
export async function createSpan(client: ClickHouseClient, args: CreateSpanArgs): Promise<void> {
  const row = spanRecordToRow(args.span);
  await client.insert({
    table: TABLE_SPAN_EVENTS,
    values: [row],
    format: 'JSONEachRow',
    clickhouse_settings: CH_INSERT_SETTINGS,
  });
}

/** Insert a batch of completed spans. */
export async function batchCreateSpans(client: ClickHouseClient, args: BatchCreateSpansArgs): Promise<void> {
  if (args.records.length === 0) return;

  const rows = args.records.map(spanRecordToRow);
  await client.insert({
    table: TABLE_SPAN_EVENTS,
    values: rows,
    format: 'JSONEachRow',
    clickhouse_settings: CH_INSERT_SETTINGS,
  });
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/** Get a single span by (traceId, spanId). Uses ordinary LIMIT 1. */
export async function getSpan(client: ClickHouseClient, args: GetSpanArgs): Promise<GetSpanResponse | null> {
  const result = await client.query({
    query: `
      SELECT *
      FROM ${TABLE_SPAN_EVENTS}
      WHERE traceId = {traceId:String} AND spanId = {spanId:String}
      LIMIT 1
    `,
    query_params: { traceId: args.traceId, spanId: args.spanId },
    format: 'JSONEachRow',
    clickhouse_settings: CH_SETTINGS,
  });

  const rows = (await result.json()) as Record<string, any>[];
  if (!rows || rows.length === 0) return null;

  return { span: rowToSpanRecord(rows[0]!) };
}

/**
 * Get all spans for a trace.
 *
 * Uses two-stage query for ReplacingMergeTree deduplication:
 *   Inner: narrow to traceId → deterministic ORDER BY → LIMIT 1 BY dedupeKey
 *   Outer: no additional ordering needed (caller sorts)
 */
export async function getTrace(client: ClickHouseClient, args: GetTraceArgs): Promise<GetTraceResponse | null> {
  const result = await client.query({
    query: `
      SELECT * FROM (
        SELECT *
        FROM ${TABLE_SPAN_EVENTS}
        WHERE traceId = {traceId:String}
        ORDER BY dedupeKey, endedAt DESC
        LIMIT 1 BY dedupeKey
      )
      ORDER BY startedAt ASC
    `,
    query_params: { traceId: args.traceId },
    format: 'JSONEachRow',
    clickhouse_settings: CH_SETTINGS,
  });

  const rows = (await result.json()) as Record<string, any>[];
  if (!rows || rows.length === 0) return null;

  const spans: SpanRecord[] = rows.map(rowToSpanRecord);
  return { traceId: args.traceId, spans };
}

/**
 * Lightweight trace fetch — only timeline-relevant columns.
 */
export async function getTraceLight(
  client: ClickHouseClient,
  args: GetTraceArgs,
): Promise<GetTraceLightResponse | null> {
  const result = await client.query({
    query: `
      SELECT traceId, spanId, parentSpanId, name,
        entityType, entityId, entityName,
        spanType, error, isEvent,
        startedAt, endedAt
      FROM (
        SELECT *
        FROM ${TABLE_SPAN_EVENTS}
        WHERE traceId = {traceId:String}
        ORDER BY dedupeKey, endedAt DESC
        LIMIT 1 BY dedupeKey
      )
      ORDER BY startedAt ASC
    `,
    query_params: { traceId: args.traceId },
    format: 'JSONEachRow',
    clickhouse_settings: CH_SETTINGS,
  });

  const rows = (await result.json()) as Record<string, any>[];
  if (!rows || rows.length === 0) return null;

  const spans: LightSpanRecord[] = rows.map(rowToSpanRecord);
  return { traceId: args.traceId, spans };
}

// ---------------------------------------------------------------------------
// Delete operations
// ---------------------------------------------------------------------------

/**
 * Delete traces by traceId.
 * Issues lightweight DELETE against both span_events and trace_roots.
 *
 * Targets rows by tracing identity: traceId + dedupeKey (which starts with traceId).
 * The dedupeKey condition is redundant for correctness (dedupeKey = traceId:spanId)
 * but satisfies the design-doc requirement that trace deletes reference dedupeKey
 * and helps the engine narrow within the sorted ORDER BY key.
 */
export async function batchDeleteTraces(client: ClickHouseClient, args: BatchDeleteTracesArgs): Promise<void> {
  if (args.traceIds.length === 0) return;

  // Build parameterized IN list and dedupeKey prefix conditions
  const params: Record<string, string> = {};
  const traceInPlaceholders: string[] = [];
  const dedupeOrParts: string[] = [];
  for (let i = 0; i < args.traceIds.length; i++) {
    const tidParam = `tid_${i}`;
    const dkPrefix = `dk_${i}`;
    params[tidParam] = args.traceIds[i]!;
    params[dkPrefix] = `${args.traceIds[i]!}:`;
    traceInPlaceholders.push(`{${tidParam}:String}`);
    dedupeOrParts.push(`startsWith(dedupeKey, {${dkPrefix}:String})`);
  }
  const traceInList = traceInPlaceholders.join(', ');
  const dedupeCondition = dedupeOrParts.length === 1 ? dedupeOrParts[0] : `(${dedupeOrParts.join(' OR ')})`;

  // Lightweight deletes (DELETE FROM) are immediately visible to subsequent reads,
  // unlike ALTER TABLE ... DELETE which schedules an async mutation.
  await Promise.all([
    client.command({
      query: `DELETE FROM ${TABLE_SPAN_EVENTS} WHERE traceId IN (${traceInList}) AND ${dedupeCondition}`,
      query_params: params,
    }),
    client.command({
      query: `DELETE FROM ${TABLE_TRACE_ROOTS} WHERE traceId IN (${traceInList}) AND ${dedupeCondition}`,
      query_params: params,
    }),
  ]);
}

/** Truncate all tracing tables (span_events + trace_roots). */
export async function dangerouslyClearSpanEvents(client: ClickHouseClient): Promise<void> {
  await Promise.all([
    client.command({ query: `TRUNCATE TABLE IF EXISTS ${TABLE_SPAN_EVENTS}` }),
    client.command({ query: `TRUNCATE TABLE IF EXISTS ${TABLE_TRACE_ROOTS}` }),
  ]);
}
