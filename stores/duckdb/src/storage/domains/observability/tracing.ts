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

function buildHasChildErrorClause(hasChildError: boolean | undefined): string {
  if (hasChildError === undefined) return '';
  const base = `SELECT 1 FROM reconstructed_spans c WHERE c.traceId = root_spans.traceId AND c.spanId != root_spans.spanId AND c.error IS NOT NULL`;
  return hasChildError ? `EXISTS (${base})` : `NOT EXISTS (${base})`;
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

/** List root spans (traces) with filtering, ordering, and pagination. */
export async function listTraces(db: DuckDBConnection, args: ListTracesArgs): Promise<ListTracesResponse> {
  const filters = args.filters ?? {};
  const page = Number(args.pagination?.page ?? 0);
  const perPage = Number(args.pagination?.perPage ?? 10);
  const orderBy = { field: args.orderBy?.field ?? 'startedAt', direction: args.orderBy?.direction ?? 'DESC' } as const;

  const { clause: filterClause, params: filterParams } = buildWhereClause(filters as Record<string, unknown>);
  const orderByClause = buildOrderByClause(orderBy);
  const { clause: paginationClause, params: paginationParams } = buildPaginationClause({ page, perPage });

  const filterParts = [];
  if (filterClause) filterParts.push(filterClause.replace(/^WHERE\s+/i, ''));
  const hasChildError = typeof filters.hasChildError === 'boolean' ? filters.hasChildError : undefined;
  const childErrorClause = buildHasChildErrorClause(hasChildError);
  if (childErrorClause) filterParts.push(childErrorClause);
  const combinedFilterClause = filterParts.length > 0 ? `WHERE ${filterParts.join(' AND ')}` : '';

  const cteSql = `
    WITH reconstructed_spans AS (
      ${SPAN_RECONSTRUCT_SELECT}
      GROUP BY traceId, spanId
    ),
    root_spans AS (
      SELECT * FROM reconstructed_spans
      WHERE parentSpanId IS NULL
    )
  `;

  const countSql = `
    ${cteSql}
    SELECT COUNT(*) as total FROM root_spans ${combinedFilterClause}
  `;
  const countResult = await db.query<{ total: number }>(countSql, filterParams);
  const total = Number(countResult[0]?.total ?? 0);

  const dataSql = `
    ${cteSql}
    SELECT * FROM root_spans ${combinedFilterClause} ${orderByClause} ${paginationClause}
  `;
  const rows = await db.query(dataSql, [...filterParams, ...paginationParams]);

  const spans = rows.map(row => rowToSpanRecord(row as Record<string, unknown>));

  return {
    pagination: {
      total,
      page,
      perPage,
      hasMore: (page + 1) * perPage < total,
    },
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
 * filtering, ordering, and pagination. Pre-filters raw `span_events` by
 * `spanType IN (branch types)` before the reconstruct GROUP BY, so we don't
 * pay reconstruction cost for the high-volume sub-operation events
 * (MODEL_STEP, MODEL_CHUNK, etc.) that are never anchors.
 */
export async function listBranches(db: DuckDBConnection, args: ListBranchesArgs): Promise<ListBranchesResponse> {
  const filters = args.filters ?? {};
  const page = Number(args.pagination?.page ?? 0);
  const perPage = Number(args.pagination?.perPage ?? 10);
  const orderBy = { field: args.orderBy?.field ?? 'startedAt', direction: args.orderBy?.direction ?? 'DESC' } as const;

  // spanType is consumed by the prefilter; pass the rest of the filter set
  // through buildWhereClause unchanged.
  const { spanType, ...passthroughFilters } = filters as Record<string, unknown>;
  const { clause: filterClause, params: filterParams } = buildWhereClause(passthroughFilters);
  const orderByClause = buildOrderByClause(orderBy);
  const { clause: paginationClause, params: paginationParams } = buildPaginationClause({ page, perPage });

  // Prefilter raw events to branch-anchor types. Unlike the ClickHouse path
  // which reads from an MV-filtered table, DuckDB queries raw span_events
  // directly, so this guard is what enforces "listBranches only returns
  // branches" here. Caller-supplied spanType narrows further; if it's not a
  // branch type, the intersection is empty and we short-circuit to no rows
  // (instead of silently widening to all branches or leaking the non-branch
  // type through).
  let prefilterClause: string;
  let prefilterParams: unknown[];
  if (typeof spanType === 'string') {
    if (!(BRANCH_SPAN_TYPES as readonly string[]).includes(spanType)) {
      // Caller asked for a non-branch span type; "branch anchors with that
      // type" is an empty set by definition.
      return {
        pagination: { total: 0, page, perPage, hasMore: false },
        branches: [],
      };
    }
    prefilterClause = `WHERE spanType = ?`;
    prefilterParams = [spanType];
  } else {
    prefilterClause = `WHERE spanType IN (${BRANCH_SPAN_TYPE_PLACEHOLDERS})`;
    prefilterParams = [...BRANCH_SPAN_TYPES];
  }

  const cteSql = `
    WITH branch_anchors AS (
      ${SPAN_RECONSTRUCT_SELECT}
      ${prefilterClause}
      GROUP BY traceId, spanId
    )
  `;

  const countSql = `
    ${cteSql}
    SELECT COUNT(*) as total FROM branch_anchors ${filterClause}
  `;
  const countResult = await db.query<{ total: number }>(countSql, [...prefilterParams, ...filterParams]);
  const total = Number(countResult[0]?.total ?? 0);

  if (total === 0) {
    return {
      pagination: { total: 0, page, perPage, hasMore: false },
      branches: [],
    };
  }

  const dataSql = `
    ${cteSql}
    SELECT * FROM branch_anchors ${filterClause} ${orderByClause} ${paginationClause}
  `;
  const rows = await db.query(dataSql, [...prefilterParams, ...filterParams, ...paginationParams]);
  const spans = rows.map(row => rowToSpanRecord(row as Record<string, unknown>));

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
