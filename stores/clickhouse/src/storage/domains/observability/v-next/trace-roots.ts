/**
 * Trace-roots operations for ClickHouse v-next observability.
 *
 * Owns: listTraces, getRootSpan
 * Reads from: trace_roots (populated by incremental MV from span_events)
 */

import type { ClickHouseClient } from '@clickhouse/client';
import { listTracesArgsSchema, toTraceSpans } from '@mastra/core/storage';
import type {
  GetRootSpanArgs,
  GetRootSpanResponse,
  ListTracesArgs,
  ListTracesLightResponse,
  ListTracesResponse,
} from '@mastra/core/storage';

import { TABLE_SPAN_EVENTS, TABLE_TRACE_ROOTS, TABLE_TRACE_ROOTS_DELTA } from './ddl';
import { buildTraceFilterConditions, buildTraceOrderByClause } from './filters';
import { CH_SETTINGS, rowToLightSpanRecord, rowToSpanRecord } from './helpers';
import type { ClickHouseDeltaCursorStrategy } from './polling';
import { appendWhere, assertDeltaPollingSupported, deltaPollingSupported, validateCursorId } from './polling';

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

/** Projections for one list variant: page-mode inner/outer selects plus the delta-join select. */
type TraceRootProjection = {
  innerSelect: string;
  outerSelect: string;
  deltaSelect: string;
};

/**
 * Columns a trace list renders. `input` is selected only so the row mapper can
 * derive a short `inputPreview` at read time (see `rowToLightSpanRecord`); the
 * raw blob itself never leaves the store.
 */
const LIGHT_TRACE_ROOT_FIELDS = [
  'traceId',
  'spanId',
  'parentSpanId',
  'name',
  'spanType',
  'isEvent',
  'startedAt',
  'endedAt',
  'entityType',
  'entityId',
  'entityName',
  'threadId',
  'resourceId',
  'error',
  'metadataRaw',
  'input',
];

const FULL_PROJECTION: TraceRootProjection = {
  innerSelect: '*',
  outerSelect: '*',
  deltaSelect: 'r.* EXCEPT(startedAt, traceId, dedupeKey)',
};

const LIGHT_PROJECTION: TraceRootProjection = {
  // `LIMIT 1 BY dedupeKey` runs after projection, so the inner select must keep dedupeKey.
  innerSelect: ['dedupeKey', ...LIGHT_TRACE_ROOT_FIELDS].join(', '),
  outerSelect: LIGHT_TRACE_ROOT_FIELDS.join(', '),
  // startedAt/traceId are re-selected by the delta join itself.
  deltaSelect: LIGHT_TRACE_ROOT_FIELDS.filter(field => field !== 'startedAt' && field !== 'traceId')
    .map(field => `r.${field}`)
    .join(', '),
};

/**
 * Shared implementation behind listTraces and listTracesLight.
 *
 * Reads from trace_roots (root spans only).
 * Page mode uses a two-stage query for ReplacingMergeTree deduplication:
 *   Inner: filter + deterministic ORDER BY + LIMIT 1 BY dedupeKey
 *   Outer: final ordering + pagination
 * Delta mode joins the append-only delta table and returns only rows past the cursor.
 *
 * hasChildError is handled via EXISTS subquery against span_events.
 */
async function listTraceRows<TSpan>(
  client: ClickHouseClient,
  args: ListTracesArgs,
  strategy: ClickHouseDeltaCursorStrategy | null,
  projection: TraceRootProjection,
  mapRows: (rows: Record<string, any>[]) => TSpan[],
): Promise<{
  pagination?: { total: number; page: number; perPage: number; hasMore: boolean };
  delta?: { limit: number; hasMore: boolean };
  deltaCursor?: string;
  spans: TSpan[];
}> {
  const { mode, filters, pagination, orderBy, after, limit } = listTracesArgsSchema.parse(args);
  const page = pagination?.page ?? 0;
  const perPage = pagination?.perPage ?? 10;

  const { conditions, params } = buildTraceFilterConditions(filters, 'r');

  if (filters?.hasChildError != null) {
    // Set-based rather than a correlated EXISTS. When other filters are set,
    // the span scan is limited to the matching traces so span_events is read
    // by its traceId sort-key prefix instead of in full.
    const scope = buildTraceFilterConditions(filters, 'scope_r');
    const traceScope = scope.conditions.length
      ? `c.traceId IN (SELECT scope_r.traceId FROM ${TABLE_TRACE_ROOTS} scope_r WHERE ${scope.conditions.join(' AND ')})
          AND `
      : '';
    conditions.push(`r.traceId ${filters.hasChildError ? 'IN' : 'NOT IN'} (
        SELECT c.traceId FROM ${TABLE_SPAN_EVENTS} c
        WHERE ${traceScope}c.parentSpanId IS NOT NULL
          AND c.error IS NOT NULL
      )`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const deltaCursorEnabled = deltaPollingSupported(strategy);

  if (mode === 'delta') {
    assertDeltaPollingSupported(strategy);

    const streamHeadCursor = await getStreamHeadCursor(client);
    if (after === undefined) {
      return {
        spans: [],
        delta: { limit, hasMore: false },
        deltaCursor: streamHeadCursor,
      };
    }

    const afterCursor = validateCursorId(after);
    const rows = await queryTracesAfterCursor(client, projection.deltaSelect, whereClause, params, limit, afterCursor);
    const visibleRows = rows.slice(0, limit);

    return {
      spans: mapRows(visibleRows),
      delta: { limit, hasMore: rows.length > limit },
      deltaCursor: visibleRows.length > 0 ? buildTraceCursor(visibleRows[visibleRows.length - 1]!) : streamHeadCursor,
    };
  }

  const orderClause = buildTraceOrderByClause(orderBy);
  const currentDeltaCursor = deltaCursorEnabled ? await getDeltaCursor(client, whereClause, params) : undefined;

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
      ...(deltaCursorEnabled ? { deltaCursor: currentDeltaCursor } : {}),
    };
  }

  const dataResult = await client.query({
    query: `
      SELECT ${projection.outerSelect} FROM (
        -- Deferred join: pick the page's sort keys from a narrow sort, then
        -- read full rows only for those keys. LIMIT 1 BY disables ClickHouse's
        -- own lazy materialization, so sorting SELECT * directly would carry
        -- every matching row's payload columns through the sort. The filter is
        -- applied again on the re-read: a dedupeKey can have unmerged versions
        -- (in different endedAt partitions) and only a matching one may win.
        SELECT ${projection.innerSelect}
        FROM ${TABLE_TRACE_ROOTS} r
        ${appendWhere(
          whereClause,
          `(r.startedAt, r.traceId, r.dedupeKey) IN (
          SELECT startedAt, traceId, dedupeKey
          FROM ${TABLE_TRACE_ROOTS} r
          ${whereClause}
          ORDER BY ${orderClause}, dedupeKey ASC
          LIMIT 1 BY dedupeKey
          LIMIT {limit:UInt32}
          OFFSET {offset:UInt32}
        )`,
        )}
        ORDER BY ${orderClause}, dedupeKey ASC
        LIMIT 1 BY dedupeKey
      )
      ORDER BY ${orderClause}, dedupeKey ASC
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

  return {
    pagination: {
      total,
      page,
      perPage,
      hasMore: (page + 1) * perPage < total,
    },
    spans: mapRows(rows),
    ...(deltaCursorEnabled ? { deltaCursor: currentDeltaCursor } : {}),
  };
}

/** List traces with optional filtering, pagination, and ordering. */
export async function listTraces(
  client: ClickHouseClient,
  args: ListTracesArgs,
  strategy: ClickHouseDeltaCursorStrategy | null,
): Promise<ListTracesResponse> {
  return listTraceRows(client, args, strategy, FULL_PROJECTION, rows => toTraceSpans(rows.map(rowToSpanRecord)));
}

/**
 * List traces projecting only the columns a trace list renders.
 * Skips the attributes/output blobs and reduces `input` to a short preview in
 * the mapper, so the response payload stays flat as traces grow.
 */
export async function listTracesLight(
  client: ClickHouseClient,
  args: ListTracesArgs,
  strategy: ClickHouseDeltaCursorStrategy | null,
): Promise<ListTracesLightResponse> {
  return listTraceRows(client, args, strategy, LIGHT_PROJECTION, rows => rows.map(rowToLightSpanRecord));
}

type TraceDeltaRow = Record<string, any> & {
  cursorId?: string;
  startedAt: string;
  traceId: string;
  dedupeKey: string;
};

async function queryTracesAfterCursor(
  client: ClickHouseClient,
  deltaSelect: string,
  whereClause: string,
  params: Record<string, unknown>,
  limit: number,
  cursorId: string,
): Promise<TraceDeltaRow[]> {
  // trace_roots drives the scan and is narrowed to the delta keys by its full
  // sort key, so only the rows past the cursor are read. Only the small delta
  // slice is built into the join's hash table.
  const deltaKeys = `SELECT startedAt, traceId, dedupeKey FROM ${TABLE_TRACE_ROOTS_DELTA} WHERE cursorId > {afterCursor:UInt64}`;
  return (await (
    await client.query({
      query: `
        SELECT
          ${deltaSelect},
          r.startedAt AS startedAt,
          r.traceId AS traceId,
          r.dedupeKey AS dedupeKey,
          toString(d.cursorId) AS cursorId
        FROM ${TABLE_TRACE_ROOTS} r
        INNER JOIN (
          SELECT cursorId, startedAt, traceId, dedupeKey
          FROM ${TABLE_TRACE_ROOTS_DELTA}
          WHERE cursorId > {afterCursor:UInt64}
        ) d
          ON r.startedAt = d.startedAt
         AND r.traceId = d.traceId
         AND r.dedupeKey = d.dedupeKey
        ${appendWhere(whereClause, `(r.startedAt, r.traceId, r.dedupeKey) IN (${deltaKeys})`)}
        ORDER BY d.cursorId ASC
        LIMIT {fetchLimit:UInt32}
      `,
      query_params: {
        ...params,
        afterCursor: cursorId,
        fetchLimit: limit + 1,
      },
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as TraceDeltaRow[];
}

/**
 * Newest delta cursor whose trace root matches the filters. Without filters
 * every delta row qualifies, so this is the stream head. With filters, the
 * root scan is bounded below by the oldest `startedAt` still in the delta
 * table (a 2-day TTL window) instead of reading all of trace_roots.
 */
async function getDeltaCursor(
  client: ClickHouseClient,
  whereClause: string,
  params: Record<string, unknown>,
): Promise<string> {
  if (!whereClause) return getStreamHeadCursor(client);

  const rows = (await (
    await client.query({
      query: `
        SELECT toString(max(d.cursorId)) AS cursorId
        FROM ${TABLE_TRACE_ROOTS_DELTA} d
        WHERE (d.startedAt, d.traceId, d.dedupeKey) IN (
          SELECT r.startedAt, r.traceId, r.dedupeKey
          FROM ${TABLE_TRACE_ROOTS} r
          ${appendWhere(whereClause, `r.startedAt >= (SELECT min(startedAt) FROM ${TABLE_TRACE_ROOTS_DELTA})`)}
        )
      `,
      query_params: params,
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as Array<{ cursorId?: string | null }>;

  const cursorId = rows[0]?.cursorId ?? null;
  if (cursorId) {
    return cursorId;
  }

  return getStreamHeadCursor(client);
}

async function getStreamHeadCursor(client: ClickHouseClient): Promise<string> {
  const streamRows = (await (
    await client.query({
      query: `SELECT toString(max(cursorId)) AS cursorId FROM ${TABLE_TRACE_ROOTS_DELTA}`,
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as Array<{ cursorId?: string | null }>;

  return streamRows[0]?.cursorId ?? '0';
}

function buildTraceCursor(row: TraceDeltaRow): string {
  return row.cursorId ?? '0';
}
