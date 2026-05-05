import type {
  CreateSpanArgs,
  GetSpanArgs,
  GetSpanResponse,
  GetSpansArgs,
  GetSpansResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetTraceArgs,
  GetTraceResponse,
  GetTraceLightResponse,
  LightSpanRecord,
  ListBranchesArgs,
  ListBranchesResponse,
  ListTracesArgs,
  ListTracesResponse,
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  SpanRecord,
} from '@mastra/core/storage';
import { BRANCH_SPAN_TYPES, toTraceSpans } from '@mastra/core/storage';
import type { DuckDBConnection } from '../../db/index';
import { buildWhereClause, buildOrderByClause, buildPaginationClause } from './filters';
import { v, jsonV, parseJson, parseJsonArray, toDate, toDateOrNull } from './helpers';

// ============================================================================
// Columns & Reconstruction
// ============================================================================

const COLUMNS = [
  'eventType',
  'timestamp',
  'traceId',
  'spanId',
  'parentSpanId',
  'name',
  'spanType',
  'isEvent',
  'endedAt',
  'experimentId',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'source',
  'serviceName',
  'attributes',
  'metadata',
  'tags',
  'scope',
  'links',
  'input',
  'output',
  'error',
  'requestContext',
] as const;

const COLUMNS_SQL = COLUMNS.join(', ');

/**
 * Reconstruction query uses `arg_max(field, timestamp) FILTER (WHERE field IS NOT NULL)`
 * so that the final end event supplies the terminal span fields without wiping
 * stable values emitted on the start event.
 */
function argMaxNonNull(col: string): string {
  return `arg_max(${col}, timestamp) FILTER (WHERE ${col} IS NOT NULL) as ${col}`;
}

const SPAN_RECONSTRUCT_SELECT = `
  SELECT
    traceId, spanId,
    ${argMaxNonNull('name')},
    ${argMaxNonNull('spanType')},
    ${argMaxNonNull('parentSpanId')},
    ${argMaxNonNull('isEvent')},
    coalesce(min(timestamp) FILTER (WHERE eventType = 'start'), min(timestamp)) as startedAt,
    ${argMaxNonNull('endedAt')},
    ${argMaxNonNull('experimentId')},
    ${argMaxNonNull('entityType')},
    ${argMaxNonNull('entityId')},
    ${argMaxNonNull('entityName')},
    ${argMaxNonNull('entityVersionId')},
    ${argMaxNonNull('userId')},
    ${argMaxNonNull('organizationId')},
    ${argMaxNonNull('resourceId')},
    ${argMaxNonNull('runId')},
    ${argMaxNonNull('sessionId')},
    ${argMaxNonNull('threadId')},
    ${argMaxNonNull('requestId')},
    ${argMaxNonNull('environment')},
    ${argMaxNonNull('source')},
    ${argMaxNonNull('serviceName')},
    ${argMaxNonNull('attributes')},
    ${argMaxNonNull('metadata')},
    ${argMaxNonNull('tags')},
    ${argMaxNonNull('scope')},
    ${argMaxNonNull('links')},
    ${argMaxNonNull('input')},
    ${argMaxNonNull('output')},
    ${argMaxNonNull('error')},
    ${argMaxNonNull('requestContext')}
  FROM span_events
`;

/** Lightweight variant — only timeline-relevant columns. */
const SPAN_RECONSTRUCT_SELECT_LIGHT = `
  SELECT
    traceId, spanId,
    ${argMaxNonNull('name')},
    ${argMaxNonNull('spanType')},
    ${argMaxNonNull('parentSpanId')},
    ${argMaxNonNull('isEvent')},
    coalesce(min(timestamp) FILTER (WHERE eventType = 'start'), min(timestamp)) as startedAt,
    ${argMaxNonNull('endedAt')},
    ${argMaxNonNull('entityType')},
    ${argMaxNonNull('entityId')},
    ${argMaxNonNull('entityName')},
    ${argMaxNonNull('error')}
  FROM span_events
`;

function rowToLightSpanRecord(row: Record<string, unknown>): LightSpanRecord {
  return {
    traceId: row.traceId as string,
    spanId: row.spanId as string,
    name: row.name as string,
    spanType: row.spanType as LightSpanRecord['spanType'],
    parentSpanId: (row.parentSpanId as string) ?? null,
    isEvent: row.isEvent as boolean,
    startedAt: toDate(row.startedAt),
    endedAt: toDateOrNull(row.endedAt),
    entityType: (row.entityType as LightSpanRecord['entityType']) ?? null,
    entityId: (row.entityId as string) ?? null,
    entityName: (row.entityName as string) ?? null,
    error: parseJson(row.error),
    createdAt: toDate(row.startedAt), // DuckDB event-sourced — use startedAt as proxy
    updatedAt: toDateOrNull(row.endedAt),
  };
}

function rowToSpanRecord(row: Record<string, unknown>): SpanRecord {
  return {
    traceId: row.traceId as string,
    spanId: row.spanId as string,
    name: row.name as string,
    spanType: row.spanType as SpanRecord['spanType'],
    parentSpanId: (row.parentSpanId as string) ?? null,
    isEvent: row.isEvent as boolean,
    startedAt: toDate(row.startedAt),
    endedAt: toDateOrNull(row.endedAt),
    experimentId: (row.experimentId as string) ?? null,
    entityType: (row.entityType as SpanRecord['entityType']) ?? null,
    entityId: (row.entityId as string) ?? null,
    entityName: (row.entityName as string) ?? null,
    entityVersionId: (row.entityVersionId as string) ?? null,
    userId: (row.userId as string) ?? null,
    organizationId: (row.organizationId as string) ?? null,
    resourceId: (row.resourceId as string) ?? null,
    runId: (row.runId as string) ?? null,
    sessionId: (row.sessionId as string) ?? null,
    threadId: (row.threadId as string) ?? null,
    requestId: (row.requestId as string) ?? null,
    environment: (row.environment as string) ?? null,
    source: (row.source as string) ?? null,
    serviceName: (row.serviceName as string) ?? null,
    attributes: parseJson(row.attributes) as Record<string, unknown> | null,
    metadata: parseJson(row.metadata) as Record<string, unknown> | null,
    tags: parseJsonArray(row.tags) as string[] | null,
    scope: parseJson(row.scope) as Record<string, unknown> | null,
    links: parseJsonArray(row.links),
    input: parseJson(row.input) as Record<string, unknown> | null,
    output: parseJson(row.output) as Record<string, unknown> | null,
    error: parseJson(row.error) as Record<string, unknown> | null,
    requestContext: parseJson(row.requestContext) as Record<string, unknown> | null,
    createdAt: toDate(row.startedAt),
    updatedAt: null,
  };
}

function buildHasChildErrorClause(hasChildError: boolean | undefined, rootAlias: string): string {
  if (hasChildError === undefined) return '';
  // Run directly against raw span_events so we never pay for full-table reconstruction.
  const base = `SELECT 1 FROM span_events c WHERE c.traceId = ${rootAlias}.traceId AND c.spanId != ${rootAlias}.spanId AND c.error IS NOT NULL`;
  return hasChildError ? `EXISTS (${base})` : `NOT EXISTS (${base})`;
}

// ============================================================================
// listTraces / listBranches filter classification
// ============================================================================

/**
 * Filter keys that can be evaluated directly against raw `span_events` start
 * rows. These are stable scalar columns whose value on the start row matches
 * the reconstructed span value, so pushing them down before reconstruction is
 * observation-equivalent to reconstructing first and filtering after.
 */
const PREFILTER_KEYS = new Set([
  'traceId',
  'spanId',
  'parentSpanId',
  'name',
  'spanType',
  'source',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'experimentId',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'serviceName',
]);

/**
 * Order-by fields whose start-row value matches the reconstructed root-span
 * value, so ordering inside the prefilter (before GROUP BY) yields the same
 * sequence as ordering on reconstructed rows. Anything outside this set must
 * fall back to the slow path so pagination stays correct.
 *
 * `endedAt` is intentionally excluded — start rows always have NULL `endedAt`,
 * so ordering by it on raw rows would compare NULLs and produce wrong pages.
 */
const SAFE_PREFILTER_ORDER_FIELDS = new Set(['startedAt']);

type DateRangeBounds = {
  start?: Date;
  startExclusive?: boolean;
  end?: Date;
  endExclusive?: boolean;
};

/**
 * Intersect the existing prefilter timestamp range with an incoming bound.
 * Each bound is an exact constraint on the start-row `timestamp`, so the
 * intersection is the **tighter** of the two on each side: the later `start`
 * wins, the earlier `end` wins. When two bounds tie on a side, the result is
 * exclusive if either input was exclusive (the union of exclusivity).
 *
 * Required for cases like `{ startedAt: { end: B }, endedAt: { end: C } }`:
 * both bound the start-row timestamp from above and we want `min(B, C)`,
 * regardless of insertion order.
 */
function intersectTimestampRange(existing: DateRangeBounds | undefined, incoming: DateRangeBounds): DateRangeBounds {
  if (!existing) return { ...incoming };
  const merged: DateRangeBounds = { ...existing };

  if (incoming.start !== undefined) {
    if (merged.start === undefined || incoming.start.getTime() > merged.start.getTime()) {
      merged.start = incoming.start;
      merged.startExclusive = incoming.startExclusive;
    } else if (incoming.start.getTime() === merged.start.getTime()) {
      merged.startExclusive = (merged.startExclusive ?? false) || (incoming.startExclusive ?? false);
    }
  }

  if (incoming.end !== undefined) {
    if (merged.end === undefined || incoming.end.getTime() < merged.end.getTime()) {
      merged.end = incoming.end;
      merged.endExclusive = incoming.endExclusive;
    } else if (incoming.end.getTime() === merged.end.getTime()) {
      merged.endExclusive = (merged.endExclusive ?? false) || (incoming.endExclusive ?? false);
    }
  }

  return merged;
}

/**
 * Split a span-anchor filter set into a `prefilter` half (pushed to raw
 * `span_events` start rows) and a `postAgg` half (applied after the
 * reconstruction GROUP BY). Used by both `listTraces` and `listBranches`.
 *
 * `hasChildError` is split out separately since it doesn't run via
 * `buildWhereClause` — `listTraces` wires it up via EXISTS, `listBranches`
 * never sees it (not in `branchesFilterSchema`).
 */
function partitionAnchorFilters(filters: Record<string, unknown>): {
  prefilter: Record<string, unknown>;
  postAgg: Record<string, unknown>;
  hasChildError: boolean | undefined;
} {
  const prefilter: Record<string, unknown> = {};
  const postAgg: Record<string, unknown> = {};
  let hasChildError: boolean | undefined;

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;

    if (key === 'hasChildError') {
      if (typeof value === 'boolean') hasChildError = value;
      continue;
    }

    if (key === 'startedAt') {
      // startedAt == min(timestamp) on the start row, so a startedAt range is
      // exactly the start-row timestamp range. Intersect with anything already
      // pushed down (e.g. an endedAt-derived upper bound from a prior iter).
      prefilter.timestamp = intersectTimestampRange(
        prefilter.timestamp as DateRangeBounds | undefined,
        value as DateRangeBounds,
      );
      continue;
    }

    if (key === 'endedAt') {
      // endedAt lives on the end event and can only be checked after reconstruct.
      postAgg.endedAt = value;
      // Safe over-approximation: a span that started after `endedAt.end` can't
      // have ended before it, so `endedAt.end` is also a valid upper bound on
      // the start-row timestamp. Intersect with whatever's already there.
      const dateRange = value as DateRangeBounds;
      if (dateRange?.end) {
        prefilter.timestamp = intersectTimestampRange(prefilter.timestamp as DateRangeBounds | undefined, {
          end: dateRange.end,
          endExclusive: dateRange.endExclusive,
        });
      }
      continue;
    }

    if (PREFILTER_KEYS.has(key)) {
      prefilter[key] = value;
      continue;
    }

    // Everything that lands here (status, metadata, scope, tags, labels, ...)
    // depends on reconstructed values and runs after span reconstruction.
    postAgg[key] = value;
  }

  return { prefilter, postAgg, hasChildError };
}

// ============================================================================
// Row builder — used by both create and update
// ============================================================================

/**
 * A span event row to be inserted into the span_events table.
 *
 * `timestamp` is the event ordering key:
 *   - 'start' → the span's actual start time
 *   - 'end'   → the span's actual end time
 *
 * The reconstruction query derives `startedAt` from
 * `min(timestamp) FILTER (WHERE eventType = 'start')`.
 */
interface SpanEventRow {
  eventType: 'start' | 'end';
  timestamp: Date;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string | null;
  spanType: string | null;
  isEvent: boolean | null;
  endedAt: Date | null;
  experimentId: string | null;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  entityVersionId: string | null;
  userId: string | null;
  organizationId: string | null;
  resourceId: string | null;
  runId: string | null;
  sessionId: string | null;
  threadId: string | null;
  requestId: string | null;
  environment: string | null;
  source: string | null;
  serviceName: string | null;
  attributes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  tags: string[] | null;
  scope: Record<string, unknown> | null;
  links: unknown[] | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  requestContext: Record<string, unknown> | null;
}

function toValuesTuple(row: SpanEventRow): string {
  return [
    v(row.eventType),
    v(row.timestamp),
    v(row.traceId),
    v(row.spanId),
    v(row.parentSpanId),
    v(row.name),
    v(row.spanType),
    v(row.isEvent),
    v(row.endedAt),
    v(row.experimentId),
    v(row.entityType),
    v(row.entityId),
    v(row.entityName),
    v(row.entityVersionId),
    v(row.userId),
    v(row.organizationId),
    v(row.resourceId),
    v(row.runId),
    v(row.sessionId),
    v(row.threadId),
    v(row.requestId),
    v(row.environment),
    v(row.source),
    v(row.serviceName),
    jsonV(row.attributes),
    jsonV(row.metadata),
    jsonV(row.tags),
    jsonV(row.scope),
    jsonV(row.links),
    jsonV(row.input),
    jsonV(row.output),
    jsonV(row.error),
    jsonV(row.requestContext),
  ].join(', ');
}

async function insertSpanEvents(db: DuckDBConnection, rows: SpanEventRow[]): Promise<void> {
  if (rows.length === 0) return;
  const tuples = rows.map(row => `(${toValuesTuple(row)})`).join(',\n');
  await db.execute(`INSERT INTO span_events (${COLUMNS_SQL}) VALUES ${tuples}`);
}

// ============================================================================
// Public API
// ============================================================================

function createStartSpanRow(s: CreateSpanArgs['span']): SpanEventRow {
  return {
    eventType: 'start',
    timestamp: s.startedAt,
    traceId: s.traceId,
    spanId: s.spanId,
    parentSpanId: s.parentSpanId ?? null,
    name: s.name,
    spanType: s.spanType,
    isEvent: s.isEvent,
    endedAt: null,
    experimentId: s.experimentId ?? null,
    entityType: s.entityType ?? null,
    entityId: s.entityId ?? null,
    entityName: s.entityName ?? null,
    entityVersionId: s.entityVersionId ?? null,
    userId: s.userId ?? null,
    organizationId: s.organizationId ?? null,
    resourceId: s.resourceId ?? null,
    runId: s.runId ?? null,
    sessionId: s.sessionId ?? null,
    threadId: s.threadId ?? null,
    requestId: s.requestId ?? null,
    environment: s.environment ?? null,
    source: s.source ?? null,
    serviceName: s.serviceName ?? null,
    attributes: (s.attributes as Record<string, unknown>) ?? null,
    metadata: (s.metadata as Record<string, unknown>) ?? null,
    tags: s.tags ?? null,
    scope: (s.scope as Record<string, unknown>) ?? null,
    links: null,
    input: (s.input as Record<string, unknown>) ?? null,
    output: null,
    error: null,
    requestContext: (s.requestContext as Record<string, unknown>) ?? null,
  };
}

function createEndSpanRow(s: CreateSpanArgs['span']): SpanEventRow {
  return {
    eventType: 'end',
    timestamp: s.endedAt!,
    traceId: s.traceId,
    spanId: s.spanId,
    parentSpanId: s.parentSpanId ?? null,
    name: s.name,
    spanType: s.spanType,
    isEvent: s.isEvent,
    endedAt: s.endedAt ?? null,
    experimentId: s.experimentId ?? null,
    entityType: s.entityType ?? null,
    entityId: s.entityId ?? null,
    entityName: s.entityName ?? null,
    entityVersionId: s.entityVersionId ?? null,
    userId: s.userId ?? null,
    organizationId: s.organizationId ?? null,
    resourceId: s.resourceId ?? null,
    runId: s.runId ?? null,
    sessionId: s.sessionId ?? null,
    threadId: s.threadId ?? null,
    requestId: s.requestId ?? null,
    environment: s.environment ?? null,
    source: s.source ?? null,
    serviceName: s.serviceName ?? null,
    attributes: (s.attributes as Record<string, unknown>) ?? null,
    metadata: (s.metadata as Record<string, unknown>) ?? null,
    tags: s.tags ?? null,
    scope: (s.scope as Record<string, unknown>) ?? null,
    links: s.links ?? null,
    input: (s.input as Record<string, unknown>) ?? null,
    output: (s.output as Record<string, unknown>) ?? null,
    error: (s.error as Record<string, unknown>) ?? null,
    requestContext: (s.requestContext as Record<string, unknown>) ?? null,
  };
}

/** Insert a 'start' event for a new span. */
export async function createSpan(db: DuckDBConnection, args: CreateSpanArgs): Promise<void> {
  const rows = [createStartSpanRow(args.span)];
  if (args.span.endedAt) {
    rows.push(createEndSpanRow(args.span));
  }
  await insertSpanEvents(db, rows);
}

/** Insert 'start' events for multiple spans in a single statement. */
export async function batchCreateSpans(db: DuckDBConnection, args: BatchCreateSpansArgs): Promise<void> {
  if (args.records.length === 0) return;
  const rows = args.records.flatMap(record => {
    const events = [createStartSpanRow(record)];
    if (record.endedAt) {
      events.push(createEndSpanRow(record));
    }
    return events;
  });
  await insertSpanEvents(db, rows);
}

/** Delete all span events for the given trace IDs. */
export async function batchDeleteTraces(db: DuckDBConnection, args: BatchDeleteTracesArgs): Promise<void> {
  if (args.traceIds.length === 0) return;
  const placeholders = args.traceIds.map(() => '?').join(', ');
  await db.execute(`DELETE FROM span_events WHERE traceId IN (${placeholders})`, args.traceIds);
}

// ============================================================================
// Read / Reconstruction
// ============================================================================

/** Reconstruct a single span from its event history. */
export async function getSpan(db: DuckDBConnection, args: GetSpanArgs): Promise<GetSpanResponse | null> {
  const rows = await db.query(`${SPAN_RECONSTRUCT_SELECT} WHERE traceId = ? AND spanId = ? GROUP BY traceId, spanId`, [
    args.traceId,
    args.spanId,
  ]);
  if (rows.length === 0) return null;
  return { span: rowToSpanRecord(rows[0]!) };
}

/** Reconstruct the root span (no parent) for a trace. */
export async function getRootSpan(db: DuckDBConnection, args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
  const rows = await db.query(
    `${SPAN_RECONSTRUCT_SELECT} WHERE traceId = ? GROUP BY traceId, spanId HAVING arg_max(parentSpanId, timestamp) IS NULL LIMIT 1`,
    [args.traceId],
  );
  if (rows.length === 0) return null;
  return { span: rowToSpanRecord(rows[0]!) };
}

/** Reconstruct all spans belonging to a trace. */
export async function getTrace(db: DuckDBConnection, args: GetTraceArgs): Promise<GetTraceResponse | null> {
  const rows = await db.query(`${SPAN_RECONSTRUCT_SELECT} WHERE traceId = ? GROUP BY traceId, spanId`, [args.traceId]);
  if (rows.length === 0) return null;
  return {
    traceId: args.traceId,
    spans: rows.map(row => rowToSpanRecord(row as Record<string, unknown>)),
  };
}

/** Reconstruct lightweight spans belonging to a trace (timeline fields only). */
export async function getTraceLight(db: DuckDBConnection, args: GetTraceArgs): Promise<GetTraceLightResponse | null> {
  const rows = await db.query(`${SPAN_RECONSTRUCT_SELECT_LIGHT} WHERE traceId = ? GROUP BY traceId, spanId`, [
    args.traceId,
  ]);
  if (rows.length === 0) return null;
  return {
    traceId: args.traceId,
    spans: rows.map(row => rowToLightSpanRecord(row as Record<string, unknown>)),
  };
}

/**
 * List root spans (traces) with filtering, ordering, and pagination.
 *
 * Instead of reconstructing every span in the table and then filtering, we:
 *   1. Pick candidate root `(traceId, spanId)` tuples from raw `span_events`
 *      by looking only at rows where `eventType = 'start'` and
 *      `parentSpanId IS NULL`. All scalar filters (entity*, *Id, service,
 *      environment, startedAt range, ...) run here, against raw columns.
 *   2. Fully reconstruct spans only for that narrowed set, then apply
 *      post-aggregation filters (status/tags/metadata/scope/endedAt/
 *      hasChildError).
 *
 * When there are no post-aggregation filters, ordering + pagination happen
 * inside the prefilter CTE so reconstruction runs on at most `perPage` rows.
 */
export async function listTraces(db: DuckDBConnection, args: ListTracesArgs): Promise<ListTracesResponse> {
  const filters = args.filters ?? {};
  const page = Number(args.pagination?.page ?? 0);
  const perPage = Number(args.pagination?.perPage ?? 10);
  const orderBy = { field: args.orderBy?.field ?? 'startedAt', direction: args.orderBy?.direction ?? 'DESC' } as const;

  const { prefilter, postAgg, hasChildError } = partitionAnchorFilters(filters as Record<string, unknown>);

  // Stage 1 — cheap prefilter against raw span_events (start-row only).
  const { clause: prefilterClause, params: prefilterParams } = buildWhereClause(prefilter);
  const prefilterParts = [`eventType = 'start'`, `parentSpanId IS NULL`];
  if (prefilterClause) prefilterParts.push(prefilterClause.replace(/^WHERE\s+/i, ''));
  const prefilterWhere = `WHERE ${prefilterParts.join(' AND ')}`;

  const outerAlias = 'outer_root';

  const orderDir = orderBy.direction.toUpperCase();
  if (orderDir !== 'ASC' && orderDir !== 'DESC') {
    throw new Error(`Invalid sort direction: ${orderBy.direction}`);
  }

  // The fast path orders + paginates on raw `span_events` start rows. That's
  // only safe when the order field's start-row value matches the reconstructed
  // value — otherwise pagination would slice on the wrong column. Anything not
  // in SAFE_PREFILTER_ORDER_FIELDS forces the slow path.
  const canOrderInPrefilter = SAFE_PREFILTER_ORDER_FIELDS.has(orderBy.field);
  const hasPostAggFilters = Object.keys(postAgg).length > 0 || hasChildError !== undefined || !canOrderInPrefilter;

  if (!hasPostAggFilters) {
    // Fast path: order + paginate in the prefilter, reconstruct only the page.
    // Only `startedAt` reaches here (per SAFE_PREFILTER_ORDER_FIELDS), and on
    // start rows it lives in the `timestamp` column.
    const prefilterOrderBy = `ORDER BY timestamp ${orderDir}`;
    const offset = page * perPage;

    const countSql = `
      SELECT COUNT(*) as total
      FROM span_events AS ${outerAlias}
      ${prefilterWhere}
    `;
    const countResult = await db.query<{ total: number }>(countSql, prefilterParams);
    const total = Number(countResult[0]?.total ?? 0);

    const pageSql = `
      WITH page_roots AS (
        SELECT traceId, spanId
        FROM span_events AS ${outerAlias}
        ${prefilterWhere}
        ${prefilterOrderBy}
        LIMIT ? OFFSET ?
      )
      ${SPAN_RECONSTRUCT_SELECT}
      WHERE (traceId, spanId) IN (SELECT traceId, spanId FROM page_roots)
      GROUP BY traceId, spanId
      ${buildOrderByClause(orderBy)}
    `;
    const rows = await db.query(pageSql, [...prefilterParams, perPage, offset]);
    const spans = rows.map(row => rowToSpanRecord(row as Record<string, unknown>));

    return {
      pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
      spans: toTraceSpans(spans),
    };
  }

  // Slow path: reconstruct the prefilter set, then apply post-agg filters.
  const { clause: postAggClause, params: postAggParams } = buildWhereClause(postAgg);
  const postAggParts: string[] = [];
  if (postAggClause) postAggParts.push(postAggClause.replace(/^WHERE\s+/i, ''));
  const childErrorClause = buildHasChildErrorClause(hasChildError, 'root_spans');
  if (childErrorClause) postAggParts.push(childErrorClause);
  const postAggWhere = postAggParts.length > 0 ? `WHERE ${postAggParts.join(' AND ')}` : '';

  const cteSql = `
    WITH candidate_roots AS (
      SELECT traceId, spanId
      FROM span_events AS ${outerAlias}
      ${prefilterWhere}
    ),
    root_spans AS (
      ${SPAN_RECONSTRUCT_SELECT}
      WHERE (traceId, spanId) IN (SELECT traceId, spanId FROM candidate_roots)
      GROUP BY traceId, spanId
    )
  `;

  const orderByClause = buildOrderByClause(orderBy);
  const { clause: paginationClause, params: paginationParams } = buildPaginationClause({ page, perPage });

  const countSql = `
    ${cteSql}
    SELECT COUNT(*) as total FROM root_spans ${postAggWhere}
  `;
  const countResult = await db.query<{ total: number }>(countSql, [...prefilterParams, ...postAggParams]);
  const total = Number(countResult[0]?.total ?? 0);

  const dataSql = `
    ${cteSql}
    SELECT * FROM root_spans ${postAggWhere} ${orderByClause} ${paginationClause}
  `;
  const rows = await db.query(dataSql, [...prefilterParams, ...postAggParams, ...paginationParams]);
  const spans = rows.map(row => rowToSpanRecord(row as Record<string, unknown>));

  return {
    pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
    spans: toTraceSpans(spans),
  };
}

// ============================================================================
// listBranches / getSpans
// ============================================================================

const BRANCH_SPAN_TYPE_PLACEHOLDERS = BRANCH_SPAN_TYPES.map(() => '?').join(', ');

/**
 * Reconstruct multiple spans by spanId within a single trace. Single round-trip
 * fetch used by the optimized {@link import('@mastra/core/storage').getBranch}
 * path: getStructure walks the skeleton to identify branch spanIds, then this
 * pulls full data for only those spans instead of the whole trace.
 */
export async function getSpans(db: DuckDBConnection, args: GetSpansArgs): Promise<GetSpansResponse> {
  if (args.spanIds.length === 0) {
    return { traceId: args.traceId, spans: [] };
  }

  const placeholders = args.spanIds.map(() => '?').join(', ');
  const rows = await db.query(
    `${SPAN_RECONSTRUCT_SELECT}
     WHERE traceId = ? AND spanId IN (${placeholders})
     GROUP BY traceId, spanId`,
    [args.traceId, ...args.spanIds],
  );

  return {
    traceId: args.traceId,
    spans: rows.map(row => rowToSpanRecord(row as Record<string, unknown>)),
  };
}

/**
 * List branch anchor spans (named-entity invocations) across all traces with
 * filtering, ordering, and pagination.
 *
 * Same two-stage strategy as `listTraces`:
 *   1. Pick candidate anchor `(traceId, spanId)` tuples from raw `span_events`
 *      by looking only at `eventType = 'start'` rows whose `spanType` is in
 *      {@link BRANCH_SPAN_TYPES}. Scalar filters (entity*, *Id, environment,
 *      serviceName, startedAt range, ...) run here, against raw columns. This
 *      avoids paying reconstruction cost for the high-volume sub-operation
 *      events (MODEL_STEP, MODEL_CHUNK, ...) that are never anchors.
 *   2. Reconstruct full span data only for that narrowed set, then apply
 *      post-aggregation filters (status / metadata / tags / endedAt range).
 *
 * When there are no post-aggregation filters, ordering + pagination happen
 * inside the prefilter so reconstruction runs on at most `perPage` rows.
 */
export async function listBranches(db: DuckDBConnection, args: ListBranchesArgs): Promise<ListBranchesResponse> {
  const filters = args.filters ?? {};
  const page = Number(args.pagination?.page ?? 0);
  const perPage = Number(args.pagination?.perPage ?? 10);
  const orderBy = { field: args.orderBy?.field ?? 'startedAt', direction: args.orderBy?.direction ?? 'DESC' } as const;

  // Caller-supplied spanType narrows further; if it's not a branch type, the
  // intersection with BRANCH_SPAN_TYPES is empty and we short-circuit (instead
  // of silently widening to all branches or leaking the non-branch type
  // through).
  const userSpanType = (filters as Record<string, unknown>).spanType;
  if (typeof userSpanType === 'string' && !(BRANCH_SPAN_TYPES as readonly string[]).includes(userSpanType)) {
    return {
      pagination: { total: 0, page, perPage, hasMore: false },
      branches: [],
    };
  }

  // `spanType` is consumed inline below (not via PREFILTER_KEYS) so we always
  // emit the IN-list / equality form regardless of the caller's input.
  const { spanType: _spanType, ...rest } = filters as Record<string, unknown>;
  const { prefilter, postAgg, hasChildError: _hasChildError } = partitionAnchorFilters(rest);

  // Stage 1 — cheap prefilter against raw span_events (start-row only).
  //
  // Unlike the ClickHouse path which reads from an MV-filtered table, DuckDB
  // queries raw span_events directly, so this guard is what enforces
  // "listBranches only returns branches" here.
  const { clause: prefilterClause, params: prefilterFilterParams } = buildWhereClause(prefilter);
  const prefilterParts = [`eventType = 'start'`];
  let spanTypeParams: unknown[];
  if (typeof userSpanType === 'string') {
    prefilterParts.push(`spanType = ?`);
    spanTypeParams = [userSpanType];
  } else {
    prefilterParts.push(`spanType IN (${BRANCH_SPAN_TYPE_PLACEHOLDERS})`);
    spanTypeParams = [...BRANCH_SPAN_TYPES];
  }
  if (prefilterClause) prefilterParts.push(prefilterClause.replace(/^WHERE\s+/i, ''));
  const prefilterWhere = `WHERE ${prefilterParts.join(' AND ')}`;
  const prefilterParams = [...spanTypeParams, ...prefilterFilterParams];

  const outerAlias = 'outer_anchor';

  const orderDir = orderBy.direction.toUpperCase();
  if (orderDir !== 'ASC' && orderDir !== 'DESC') {
    throw new Error(`Invalid sort direction: ${orderBy.direction}`);
  }

  // Same allowlist gate as listTraces — see SAFE_PREFILTER_ORDER_FIELDS.
  const canOrderInPrefilter = SAFE_PREFILTER_ORDER_FIELDS.has(orderBy.field);
  const hasPostAggFilters = Object.keys(postAgg).length > 0 || !canOrderInPrefilter;

  if (!hasPostAggFilters) {
    // Fast path: order + paginate in the prefilter, reconstruct only the page.
    // Only `startedAt` reaches here (per SAFE_PREFILTER_ORDER_FIELDS), and on
    // start rows it lives in the `timestamp` column.
    const prefilterOrderBy = `ORDER BY timestamp ${orderDir}`;
    const offset = page * perPage;

    const countSql = `
      SELECT COUNT(*) as total
      FROM span_events AS ${outerAlias}
      ${prefilterWhere}
    `;
    const countResult = await db.query<{ total: number }>(countSql, prefilterParams);
    const total = Number(countResult[0]?.total ?? 0);

    if (total === 0) {
      return {
        pagination: { total: 0, page, perPage, hasMore: false },
        branches: [],
      };
    }

    const pageSql = `
      WITH page_anchors AS (
        SELECT traceId, spanId
        FROM span_events AS ${outerAlias}
        ${prefilterWhere}
        ${prefilterOrderBy}
        LIMIT ? OFFSET ?
      )
      ${SPAN_RECONSTRUCT_SELECT}
      WHERE (traceId, spanId) IN (SELECT traceId, spanId FROM page_anchors)
      GROUP BY traceId, spanId
      ${buildOrderByClause(orderBy)}
    `;
    const rows = await db.query(pageSql, [...prefilterParams, perPage, offset]);
    const spans = rows.map(row => rowToSpanRecord(row as Record<string, unknown>));

    return {
      pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
      branches: toTraceSpans(spans),
    };
  }

  // Slow path: reconstruct the prefilter set, then apply post-agg filters.
  const { clause: postAggClause, params: postAggParams } = buildWhereClause(postAgg);
  const postAggWhere = postAggClause ? postAggClause : '';
  const orderByClause = buildOrderByClause(orderBy);
  const { clause: paginationClause, params: paginationParams } = buildPaginationClause({ page, perPage });

  const cteSql = `
    WITH candidate_anchors AS (
      SELECT traceId, spanId
      FROM span_events AS ${outerAlias}
      ${prefilterWhere}
    ),
    branch_anchors AS (
      ${SPAN_RECONSTRUCT_SELECT}
      WHERE (traceId, spanId) IN (SELECT traceId, spanId FROM candidate_anchors)
      GROUP BY traceId, spanId
    )
  `;

  const countSql = `
    ${cteSql}
    SELECT COUNT(*) as total FROM branch_anchors ${postAggWhere}
  `;
  const countResult = await db.query<{ total: number }>(countSql, [...prefilterParams, ...postAggParams]);
  const total = Number(countResult[0]?.total ?? 0);

  if (total === 0) {
    return {
      pagination: { total: 0, page, perPage, hasMore: false },
      branches: [],
    };
  }

  const dataSql = `
    ${cteSql}
    SELECT * FROM branch_anchors ${postAggWhere} ${orderByClause} ${paginationClause}
  `;
  const rows = await db.query(dataSql, [...prefilterParams, ...postAggParams, ...paginationParams]);
  const spans = rows.map(row => rowToSpanRecord(row as Record<string, unknown>));

  return {
    pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
    branches: toTraceSpans(spans),
  };
}
