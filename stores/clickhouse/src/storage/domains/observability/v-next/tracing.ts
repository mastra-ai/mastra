/**
 * Tracing operations for ClickHouse v-next observability.
 *
 * Owns: batchCreateSpans, getSpan, getSpans, getTrace, getTraceLight,
 *       listBranches, batchDeleteTraces, dangerouslyClearSpanEvents.
 * Delegates to trace-roots.ts: listTraces, getRootSpan.
 *
 * `listBranches` reads from the MV-fed `mastra_trace_branches` table (one row
 * per branch anchor span). It lives here -- alongside the other read paths
 * over the trace data -- since branches are conceptually a subset of traces.
 */

import type { ClickHouseClient } from '@clickhouse/client';
import { BRANCH_SPAN_TYPES, listBranchesArgsSchema, toTraceSpans, TraceStatus } from '@mastra/core/storage';
import type {
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  CreateSpanArgs,
  GetSpanArgs,
  GetSpanResponse,
  GetSpansArgs,
  GetSpansResponse,
  GetTraceArgs,
  GetTraceResponse,
  GetTraceLightResponse,
  LightSpanRecord,
  ListBranchesArgs,
  ListBranchesResponse,
  SpanRecord,
} from '@mastra/core/storage';

import { TABLE_SPAN_EVENTS, TABLE_TRACE_BRANCHES, TABLE_TRACE_ROOTS } from './ddl';
import { CH_SETTINGS, CH_INSERT_SETTINGS, spanRecordToRow, rowToSpanRecord } from './helpers';

const BRANCH_SPAN_TYPE_SQL_LIST = BRANCH_SPAN_TYPES.map(t => `'${t}'`).join(', ');

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

/**
 * Batch-fetch spans by spanId within a trace. Single SELECT keyed by
 * `(traceId, spanId)`; the span_events ORDER BY `(traceId, endedAt, spanId, dedupeKey)`
 * means traceId narrowing is index-prefixed and the spanId IN(...) filter is
 * cheap to evaluate within that range.
 *
 * Returns spans in arbitrary order; caller is expected to sort. Spans not
 * found are silently omitted (callers handle the empty/partial case).
 */
export async function getSpans(client: ClickHouseClient, args: GetSpansArgs): Promise<GetSpansResponse> {
  if (args.spanIds.length === 0) {
    return { traceId: args.traceId, spans: [] };
  }

  const result = await client.query({
    query: `
      SELECT * FROM (
        SELECT *
        FROM ${TABLE_SPAN_EVENTS}
        WHERE traceId = {traceId:String}
          AND spanId IN {spanIds:Array(String)}
        ORDER BY dedupeKey, endedAt DESC
        LIMIT 1 BY dedupeKey
      )
    `,
    query_params: { traceId: args.traceId, spanIds: args.spanIds },
    format: 'JSONEachRow',
    clickhouse_settings: CH_SETTINGS,
  });

  const rows = (await result.json()) as Record<string, any>[];
  const spans: SpanRecord[] = rows.map(rowToSpanRecord);
  return { traceId: args.traceId, spans };
}

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

// ---------------------------------------------------------------------------
// listBranches — read from MV-fed mastra_trace_branches table
// ---------------------------------------------------------------------------

/**
 * List trace branches with optional filtering, pagination, and ordering.
 *
 * Reads from `mastra_trace_branches` (one row per branch anchor span). Uses
 * the same two-stage dedupe + paginate pattern as listTraces.
 *
 * Filters apply to the anchor span itself (not to a containing trace root) --
 * which is the whole point of this surface.
 */
export async function listBranches(client: ClickHouseClient, args: ListBranchesArgs): Promise<ListBranchesResponse> {
  const { filters, pagination, orderBy } = listBranchesArgsSchema.parse(args);
  const page = pagination?.page ?? 0;
  const perPage = pagination?.perPage ?? 10;

  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters?.spanType) {
    conditions.push(`spanType = {spanType:String}`);
    params.spanType = filters.spanType;
  } else {
    // Defense in depth: the MV WHERE clause already restricts the table to
    // these span types, but pinning the predicate at query time also prunes
    // any row that may have leaked in via direct insertion.
    conditions.push(`spanType IN (${BRANCH_SPAN_TYPE_SQL_LIST})`);
  }

  if (filters?.startedAt?.start) {
    const op = filters.startedAt.startExclusive ? '>' : '>=';
    conditions.push(`startedAt ${op} {startedAtStart:DateTime64(3)}`);
    params.startedAtStart = filters.startedAt.start.getTime();
  }
  if (filters?.startedAt?.end) {
    const op = filters.startedAt.endExclusive ? '<' : '<=';
    conditions.push(`startedAt ${op} {startedAtEnd:DateTime64(3)}`);
    params.startedAtEnd = filters.startedAt.end.getTime();
  }
  if (filters?.endedAt?.start) {
    const op = filters.endedAt.startExclusive ? '>' : '>=';
    conditions.push(`endedAt ${op} {endedAtStart:DateTime64(3)}`);
    params.endedAtStart = filters.endedAt.start.getTime();
  }
  if (filters?.endedAt?.end) {
    const op = filters.endedAt.endExclusive ? '<' : '<=';
    conditions.push(`endedAt ${op} {endedAtEnd:DateTime64(3)}`);
    params.endedAtEnd = filters.endedAt.end.getTime();
  }

  // All other filters apply to the anchor span itself.
  type EqDef = { col: string; value: unknown; param: string };
  const eq: EqDef[] = [
    { col: 'traceId', value: filters?.traceId, param: 'traceId' },
    { col: 'entityType', value: filters?.entityType, param: 'entityType' },
    { col: 'entityId', value: filters?.entityId, param: 'entityId' },
    { col: 'entityName', value: filters?.entityName, param: 'entityName' },
    { col: 'entityVersionId', value: filters?.entityVersionId, param: 'entityVersionId' },
    { col: 'parentEntityVersionId', value: filters?.parentEntityVersionId, param: 'parentEntityVersionId' },
    { col: 'parentEntityType', value: filters?.parentEntityType, param: 'parentEntityType' },
    { col: 'parentEntityId', value: filters?.parentEntityId, param: 'parentEntityId' },
    { col: 'parentEntityName', value: filters?.parentEntityName, param: 'parentEntityName' },
    { col: 'rootEntityVersionId', value: filters?.rootEntityVersionId, param: 'rootEntityVersionId' },
    { col: 'rootEntityType', value: filters?.rootEntityType, param: 'rootEntityType' },
    { col: 'rootEntityId', value: filters?.rootEntityId, param: 'rootEntityId' },
    { col: 'rootEntityName', value: filters?.rootEntityName, param: 'rootEntityName' },
    { col: 'experimentId', value: filters?.experimentId, param: 'experimentId' },
    { col: 'userId', value: filters?.userId, param: 'userId' },
    { col: 'organizationId', value: filters?.organizationId, param: 'organizationId' },
    { col: 'resourceId', value: filters?.resourceId, param: 'resourceId' },
    { col: 'runId', value: filters?.runId, param: 'runId' },
    { col: 'sessionId', value: filters?.sessionId, param: 'sessionId' },
    { col: 'threadId', value: filters?.threadId, param: 'threadId' },
    { col: 'requestId', value: filters?.requestId, param: 'requestId' },
    { col: 'environment', value: filters?.environment, param: 'environment' },
    { col: 'executionSource', value: filters?.source, param: 'source' },
    { col: 'serviceName', value: filters?.serviceName, param: 'serviceName' },
  ];
  for (const { col, value, param } of eq) {
    if (value == null) continue;
    conditions.push(`${col} = {${param}:String}`);
    params[param] = value;
  }

  if (filters?.tags && filters.tags.length > 0) {
    for (let i = 0; i < filters.tags.length; i++) {
      const tag = filters.tags[i];
      if (typeof tag !== 'string' || tag.trim() === '') continue;
      const param = `tag_${i}`;
      conditions.push(`has(tags, {${param}:String})`);
      params[param] = tag;
    }
  }

  if (filters?.metadata != null && typeof filters.metadata === 'object') {
    let i = 0;
    for (const [key, value] of Object.entries(filters.metadata)) {
      if (typeof value !== 'string') continue;
      const keyParam = `meta_k_${i}`;
      const valParam = `meta_v_${i}`;
      conditions.push(`metadataSearch[{${keyParam}:String}] = {${valParam}:String}`);
      params[keyParam] = key;
      params[valParam] = value;
      i++;
    }
  }

  // scope is stored as JSON-encoded text (Nullable(String)) -- match the
  // semantics used by in-memory and DuckDB backends: every key/value in the
  // filter object must equal the same key in the row's scope. JSON-encoded
  // values (objects, arrays, numbers) are matched after JSON.stringify so a
  // caller can pass either a stringified scalar or the original value.
  if (filters?.scope != null && typeof filters.scope === 'object') {
    let i = 0;
    for (const [key, value] of Object.entries(filters.scope)) {
      if (value === undefined) continue;
      const normalized = typeof value === 'string' ? value : JSON.stringify(value);
      if (normalized == null) continue;
      const keyParam = `scope_k_${i}`;
      const valParam = `scope_v_${i}`;
      conditions.push(`JSONExtractString(scope, {${keyParam}:String}) = {${valParam}:String}`);
      params[keyParam] = key;
      params[valParam] = normalized;
      i++;
    }
  }

  if (filters?.status === TraceStatus.ERROR) {
    conditions.push(`error IS NOT NULL`);
  } else if (filters?.status === TraceStatus.SUCCESS) {
    conditions.push(`error IS NULL`);
  } else if (filters?.status === TraceStatus.RUNNING) {
    // listBranches reads completed-span data; running spans are not surfaced.
    conditions.push('1 = 0');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortField = orderBy?.field === 'endedAt' ? 'endedAt' : 'startedAt';
  const sortDirection = orderBy?.direction === 'ASC' ? 'ASC' : 'DESC';

  // Count (deduplicated)
  const countResult = await client.query({
    query: `
      SELECT count() as cnt FROM (
        SELECT dedupeKey
        FROM ${TABLE_TRACE_BRANCHES}
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
      branches: [],
    };
  }

  const dataResult = await client.query({
    query: `
      SELECT * FROM (
        SELECT *
        FROM ${TABLE_TRACE_BRANCHES}
        ${whereClause}
        ORDER BY dedupeKey
        LIMIT 1 BY dedupeKey
      )
      ORDER BY ${sortField} ${sortDirection}, dedupeKey ASC
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
    branches: toTraceSpans(spans),
  };
}
