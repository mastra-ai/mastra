/**
 * Trace-roots operations for ClickHouse v-next observability.
 *
 * Owns: listTraces, getRootSpan
 * Reads from: trace_roots (populated by incremental MV from span_events)
 */

import type { ClickHouseClient } from '@clickhouse/client';
import { listTracesArgsSchema, toTraceSpans } from '@mastra/core/storage';
import type { GetRootSpanArgs, GetRootSpanResponse, ListTracesArgs, ListTracesResponse } from '@mastra/core/storage';

import { TABLE_SPAN_EVENTS, TABLE_TRACE_ROOTS, TABLE_TRACE_ROOTS_DELTA } from './ddl';
import { buildTraceFilterConditions, buildTraceOrderByClause } from './filters';
import { CH_SETTINGS, rowToSpanRecord } from './helpers';
import { assertDeltaPollingEnabled, decodeLiveCursor, deltaPollingFeatureEnabled, encodeLiveCursor } from './polling';

// ---------------------------------------------------------------------------
// getRootSpan
// ---------------------------------------------------------------------------

/**
 * Get the root span for a trace, reading from trace_roots as compatibility path.
 * Uses ordinary LIMIT 1 (duplicates are byte-identical per design).
 */
export async function getRootSpan(
  client: ClickHouseClient,
  args: GetRootSpanArgs,
): Promise<GetRootSpanResponse | null> {
  const result = await client.query({
    query: `
      SELECT *
      FROM ${TABLE_TRACE_ROOTS}
      WHERE traceId = {traceId:String}
      LIMIT 1
    `,
    query_params: { traceId: args.traceId },
    format: 'JSONEachRow',
    clickhouse_settings: CH_SETTINGS,
  });

  const rows = (await result.json()) as Record<string, any>[];
  if (!rows || rows.length === 0) return null;

  return { span: rowToSpanRecord(rows[0]!) };
}

// ---------------------------------------------------------------------------
// listTraces
// ---------------------------------------------------------------------------

/**
 * List traces with optional filtering, pagination, and ordering.
 *
 * Reads from trace_roots (root spans only).
 * Uses two-stage query for ReplacingMergeTree deduplication:
 *   Inner: filter + deterministic ORDER BY + LIMIT 1 BY dedupeKey
 *   Outer: final ordering + pagination
 *
 * hasChildError is handled via EXISTS subquery against span_events.
 */
export async function listTraces(client: ClickHouseClient, args: ListTracesArgs): Promise<ListTracesResponse> {
  // Parse args through schema to apply defaults
  const { mode, filters, pagination, orderBy, after, limit } = listTracesArgsSchema.parse(args);
  const page = pagination?.page ?? 0;
  const perPage = pagination?.perPage ?? 10;

  // Build filter conditions
  const { conditions, params } = buildTraceFilterConditions(filters, 'r');

  // hasChildError: EXISTS subquery against span_events
  if (filters?.hasChildError != null) {
    if (filters.hasChildError) {
      conditions.push(`EXISTS (
        SELECT 1 FROM ${TABLE_SPAN_EVENTS} c
        WHERE c.traceId = r.traceId
          AND c.parentSpanId IS NOT NULL
          AND c.error IS NOT NULL
      )`);
    } else {
      conditions.push(`NOT EXISTS (
        SELECT 1 FROM ${TABLE_SPAN_EVENTS} c
        WHERE c.traceId = r.traceId
          AND c.parentSpanId IS NOT NULL
          AND c.error IS NOT NULL
      )`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const liveCursorEnabled = deltaPollingFeatureEnabled();

  if (mode === 'delta') {
    assertDeltaPollingEnabled();

    const currentLiveCursor = await getTraceLiveCursor(client, whereClause, params);
    if (after === undefined) {
      return {
        spans: [],
        delta: { limit, hasMore: false },
        liveCursor: currentLiveCursor,
      };
    }

    const rows = (await (
      await client.query({
        query: `
          SELECT
            r.* EXCEPT(startedAt, traceId, dedupeKey),
            r.startedAt AS startedAt,
            r.traceId AS traceId,
            r.dedupeKey AS dedupeKey,
            toString(d.cursorId) AS cursorId
          FROM ${TABLE_TRACE_ROOTS_DELTA} d
          INNER JOIN ${TABLE_TRACE_ROOTS} r
            ON r.startedAt = d.startedAt
           AND r.traceId = d.traceId
           AND r.dedupeKey = d.dedupeKey
          ${whereClause ? `${whereClause} AND d.cursorId > {afterCursor:UInt64}` : 'WHERE d.cursorId > {afterCursor:UInt64}'}
          ORDER BY d.cursorId ASC, r.dedupeKey ASC
          LIMIT {fetchLimit:UInt32}
        `,
        query_params: {
          ...params,
          afterCursor: decodeLiveCursor(after),
          fetchLimit: limit + 1,
        },
        format: 'JSONEachRow',
        clickhouse_settings: CH_SETTINGS,
      })
    ).json()) as Array<Record<string, any> & { cursorId?: string }>;

    const visibleRows = rows.slice(0, limit);

    return {
      spans: toTraceSpans(visibleRows.map(rowToSpanRecord)),
      delta: { limit, hasMore: rows.length > limit },
      liveCursor:
        visibleRows.length > 0
          ? encodeLiveCursor(visibleRows[visibleRows.length - 1]?.cursorId ?? null)
          : currentLiveCursor,
    };
  }

  // Outer ORDER BY must not use table alias — the outer SELECT wraps an anonymous subquery
  const orderClause = buildTraceOrderByClause(orderBy);

  // Count query (deduplicated)
  const countResult = await client.query({
    query: `
      SELECT count() as cnt FROM (
        SELECT dedupeKey
        FROM ${TABLE_TRACE_ROOTS} r
        ${whereClause}
        ORDER BY dedupeKey
        LIMIT 1 BY dedupeKey
      )
    `,
    query_params: params,
    format: 'JSONEachRow',
    clickhouse_settings: CH_SETTINGS,
  });

  const countRows = (await countResult.json()) as Array<{ cnt: string | number }>;
  const total = Number(countRows[0]?.cnt ?? 0);

  if (total === 0) {
    return {
      pagination: { total: 0, page, perPage, hasMore: false },
      spans: [],
      ...(liveCursorEnabled ? { liveCursor: null } : {}),
    };
  }

  // Data query: two-stage dedupe + pagination
  const dataResult = await client.query({
    query: `
      SELECT * FROM (
        SELECT *
        FROM ${TABLE_TRACE_ROOTS} r
        ${whereClause}
        ORDER BY dedupeKey
        LIMIT 1 BY dedupeKey
      )
      ORDER BY ${orderClause}
      LIMIT {limit:UInt32}
      OFFSET {offset:UInt32}
    `,
    query_params: {
      ...params,
      limit: perPage,
      offset: page * perPage,
    },
    format: 'JSONEachRow',
    clickhouse_settings: CH_SETTINGS,
  });

  const rows = (await dataResult.json()) as Record<string, any>[];
  const spans = rows.map(rowToSpanRecord);

  return {
    pagination: {
      total,
      page,
      perPage,
      hasMore: (page + 1) * perPage < total,
    },
    spans: toTraceSpans(spans),
    ...(liveCursorEnabled ? { liveCursor: await getTraceLiveCursor(client, whereClause, params) } : {}),
  };
}

async function getTraceLiveCursor(
  client: ClickHouseClient,
  whereClause: string,
  params: Record<string, unknown>,
): Promise<string | null> {
  const rows = (await (
    await client.query({
      query: `
        SELECT toString(max(d.cursorId)) AS cursorId
        FROM ${TABLE_TRACE_ROOTS_DELTA} d
        INNER JOIN ${TABLE_TRACE_ROOTS} r
          ON r.startedAt = d.startedAt
         AND r.traceId = d.traceId
         AND r.dedupeKey = d.dedupeKey
        ${whereClause}
      `,
      query_params: params,
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as Array<{ cursorId?: string | null }>;

  return encodeLiveCursor(rows[0]?.cursorId ?? null);
}
