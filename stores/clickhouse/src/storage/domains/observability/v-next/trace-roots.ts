/**
 * Trace-roots operations for ClickHouse v-next observability.
 *
 * Owns: listTraces, getRootSpan
 * Reads from: trace_roots (populated by incremental MV from span_events)
 */

import type { ClickHouseClient } from '@clickhouse/client';
import { toTraceSpans } from '@mastra/core/storage';
import type {
  GetRootSpanArgs,
  GetRootSpanResponse,
  ListTracesArgs,
  ListTracesResponse,
  LiveCursor,
} from '@mastra/core/storage';

import { TABLE_SPAN_EVENTS, TABLE_TRACE_LIST_CURSOR_EVENTS, TABLE_TRACE_ROOTS } from './ddl';
import { buildTraceFilterConditions, buildTraceOrderByClause } from './filters';
import {
  appendWhereClause,
  buildFirstSeenCursorSql,
  CH_SETTINGS,
  createOpaqueLiveCursor,
  normalizeObservabilityListArgs,
  rowToOpaqueLiveCursor,
  rowToSpanRecord,
  getOpaqueLiveCursorValue,
  toBooleanOrUndefined,
  toDateRangeOrUndefined,
  toStringOrUndefined,
  toStringRecordOrUndefined,
  toUnknownRecordOrUndefined,
} from './helpers';

type NormalizedTraceFilters = Parameters<typeof buildTraceFilterConditions>[0];
type TracesOrderBy = { field: 'startedAt' | 'endedAt'; direction: 'ASC' | 'DESC' };
type NormalizedTraceStatus = Exclude<NormalizedTraceFilters, undefined>['status'];

const TRACE_FIRST_SEEN_SQL = buildFirstSeenCursorSql(TABLE_TRACE_LIST_CURSOR_EVENTS, ['traceId']);

function normalizeTraceFilters(filters: ListTracesArgs['filters']): NormalizedTraceFilters {
  const record = toUnknownRecordOrUndefined(filters);
  if (!record) return undefined;

  return {
    ...record,
    traceId: toStringOrUndefined(record.traceId),
    startedAt: toDateRangeOrUndefined(record.startedAt),
    endedAt: toDateRangeOrUndefined(record.endedAt),
    spanType: toStringOrUndefined(record.spanType),
    entityType: toStringOrUndefined(record.entityType),
    entityId: toStringOrUndefined(record.entityId),
    entityName: toStringOrUndefined(record.entityName),
    entityVersionId: toStringOrUndefined(record.entityVersionId),
    parentEntityVersionId: toStringOrUndefined(record.parentEntityVersionId),
    parentEntityType: toStringOrUndefined(record.parentEntityType),
    parentEntityId: toStringOrUndefined(record.parentEntityId),
    parentEntityName: toStringOrUndefined(record.parentEntityName),
    rootEntityVersionId: toStringOrUndefined(record.rootEntityVersionId),
    rootEntityType: toStringOrUndefined(record.rootEntityType),
    rootEntityId: toStringOrUndefined(record.rootEntityId),
    rootEntityName: toStringOrUndefined(record.rootEntityName),
    experimentId: toStringOrUndefined(record.experimentId),
    userId: toStringOrUndefined(record.userId),
    organizationId: toStringOrUndefined(record.organizationId),
    resourceId: toStringOrUndefined(record.resourceId),
    runId: toStringOrUndefined(record.runId),
    sessionId: toStringOrUndefined(record.sessionId),
    threadId: toStringOrUndefined(record.threadId),
    requestId: toStringOrUndefined(record.requestId),
    environment: toStringOrUndefined(record.environment),
    source: toStringOrUndefined(record.source),
    serviceName: toStringOrUndefined(record.serviceName),
    metadata: toStringRecordOrUndefined(record.metadata),
    hasChildError: toBooleanOrUndefined(record.hasChildError),
    status: record.status as NormalizedTraceStatus,
  } as NormalizedTraceFilters;
}

function rowToTraceLiveCursor(row: Record<string, unknown>): LiveCursor | null {
  return rowToOpaqueLiveCursor(row);
}

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
  const parsed = normalizeObservabilityListArgs<ListTracesArgs['filters'], NormalizedTraceFilters, TracesOrderBy>(
    args,
    {
      orderBy: { field: 'startedAt', direction: 'DESC' } satisfies TracesOrderBy,
      normalizeFilters: normalizeTraceFilters,
    },
  );
  const { filters } = parsed;

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
  const dedupedRootsSql = `
    SELECT *
    FROM ${TABLE_TRACE_ROOTS} r
    ${whereClause}
    ORDER BY dedupeKey
    LIMIT 1 BY dedupeKey
  `;
  const traceFirstSeenSql = `
    ${TRACE_FIRST_SEEN_SQL}
  `;

  if (parsed.mode === 'delta') {
    const liveCursorResult = await client.query({
      query: `
        SELECT toString(cursor.cursorId) AS cursorId
        FROM (${dedupedRootsSql}) AS roots
        INNER JOIN (${traceFirstSeenSql}) AS cursor USING (traceId)
        ORDER BY cursor.cursorId DESC
        LIMIT 1
      `,
      query_params: params,
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    });
    const liveCursorRows = (await liveCursorResult.json()) as Record<string, unknown>[];
    const snapshotCursor =
      (liveCursorRows[0] ? rowToTraceLiveCursor(liveCursorRows[0]) : null) ?? createOpaqueLiveCursor('0');

    if (!parsed.after) {
      return {
        delta: { limit: parsed.limit, hasMore: false },
        liveCursor: snapshotCursor,
        spans: [],
      };
    }

    const deltaResult = await client.query({
      query: `
        SELECT roots.*, toString(cursor.cursorId) AS cursorId
        FROM (${dedupedRootsSql}) AS roots
        INNER JOIN (${traceFirstSeenSql}) AS cursor USING (traceId)
        WHERE cursor.cursorId > {afterCursorId:UInt64}
        ORDER BY cursor.cursorId ASC
        LIMIT {limit:UInt32}
      `,
      query_params: {
        ...params,
        afterCursorId: getOpaqueLiveCursorValue(parsed.after),
        limit: parsed.limit + 1,
      },
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    });

    const deltaRows = (await deltaResult.json()) as Record<string, any>[];
    const pageRows = deltaRows.slice(0, parsed.limit);
    const liveCursor =
      (pageRows.length > 0 ? rowToTraceLiveCursor(pageRows[pageRows.length - 1]!) : null) ?? parsed.after;

    return {
      delta: { limit: parsed.limit, hasMore: deltaRows.length > parsed.limit },
      liveCursor,
      spans: toTraceSpans(pageRows.map(rowToSpanRecord)),
    };
  }

  const pagination = parsed.pagination;
  const orderBy = parsed.orderBy;
  const page = pagination?.page ?? 0;
  const perPage = pagination?.perPage ?? 10;
  // Outer ORDER BY must not use table alias — the outer SELECT wraps an anonymous subquery
  const orderClause = buildTraceOrderByClause(orderBy);
  const liveCursorResult = await client.query({
    query: `
      SELECT toString(cursor.cursorId) AS cursorId
      FROM (${dedupedRootsSql}) AS roots
      INNER JOIN (${traceFirstSeenSql}) AS cursor USING (traceId)
      ORDER BY cursor.cursorId DESC
      LIMIT 1
    `,
    query_params: params,
    format: 'JSONEachRow',
    clickhouse_settings: CH_SETTINGS,
  });
  const liveCursorRows = (await liveCursorResult.json()) as Record<string, unknown>[];
  const snapshotCursor = liveCursorRows[0] ? rowToTraceLiveCursor(liveCursorRows[0]) : null;
  const snapshotCursorWhereClause = snapshotCursor
    ? appendWhereClause('', `(cursor.cursorId IS NULL OR cursor.cursorId <= {snapshotCursorId:UInt64})`)
    : '';
  const snapshotParams = snapshotCursor
    ? { ...params, snapshotCursorId: getOpaqueLiveCursorValue(snapshotCursor) }
    : params;

  // Count query (deduplicated)
  const countResult = await client.query({
    query: `
      SELECT count() as cnt FROM (
        SELECT roots.dedupeKey
        FROM (${dedupedRootsSql}) AS roots
        LEFT JOIN (${traceFirstSeenSql}) AS cursor USING (traceId)
        ${snapshotCursorWhereClause}
      )
    `,
    query_params: snapshotParams,
    format: 'JSONEachRow',
    clickhouse_settings: CH_SETTINGS,
  });

  const countRows = (await countResult.json()) as Array<{ cnt: string | number }>;
  const total = Number(countRows[0]?.cnt ?? 0);

  if (total === 0) {
    return {
      pagination: { total: 0, page, perPage, hasMore: false },
      liveCursor: createOpaqueLiveCursor('0'),
      spans: [],
    };
  }

  // Data query: two-stage dedupe + pagination
  const dataResult = await client.query({
    query: `
      SELECT roots.* FROM (${dedupedRootsSql}) AS roots
      LEFT JOIN (${traceFirstSeenSql}) AS cursor USING (traceId)
      ${snapshotCursorWhereClause}
      ORDER BY ${orderClause}
      LIMIT {limit:UInt32}
      OFFSET {offset:UInt32}
    `,
    query_params: {
      ...snapshotParams,
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
    liveCursor: snapshotCursor ?? createOpaqueLiveCursor('0'),
    spans: toTraceSpans(spans),
  };
}
