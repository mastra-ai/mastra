import type {
  CreateSpanArgs,
  UpdateSpanArgs,
  GetSpanArgs,
  GetSpanResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetTraceArgs,
  GetTraceResponse,
  ListTracesArgs,
  ListTracesResponse,
  BatchCreateSpansArgs,
  BatchUpdateSpansArgs,
  BatchDeleteTracesArgs,
} from '@mastra/core/storage';
import { toTraceSpans } from '@mastra/core/storage';
import type { DuckDBConnection } from '../../db/index';
import { buildWhereClause, buildOrderByClause, buildPaginationClause } from './filters';
import { v, jsonV, rowToSpanRecord } from './helpers';

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
 * so that partial update events (with NULLs for unchanged fields) don't overwrite
 * values set by earlier events.
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

function buildHasChildErrorClause(hasChildError: boolean | undefined): string {
  if (hasChildError === undefined) return '';
  const base = `SELECT 1 FROM reconstructed_spans c WHERE c.traceId = root_spans.traceId AND c.error IS NOT NULL`;
  return hasChildError ? `EXISTS (${base})` : `NOT EXISTS (${base})`;
}

// ============================================================================
// Row builder — used by both create and update
// ============================================================================

/**
 * A span event row to be inserted into the span_events table.
 *
 * `timestamp` is the event ordering key, computed internally from the eventType:
 *   - 'start'  → the span's actual start time
 *   - 'update' → now (wall-clock time the update was recorded)
 *   - 'end'    → now (wall-clock time the end was recorded)
 *
 * The reconstruction query derives `startedAt` from
 * `min(timestamp) FILTER (WHERE eventType = 'start')`.
 */
interface SpanEventRow {
  eventType: 'start' | 'update' | 'end';
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

function createSpanRow(s: CreateSpanArgs['span']): SpanEventRow {
  return {
    eventType: 'start',
    timestamp: s.startedAt,
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

function updateSpanRow(args: UpdateSpanArgs): SpanEventRow {
  const u = args.updates;
  return {
    eventType: u.endedAt ? 'end' : 'update',
    timestamp: new Date(),
    traceId: args.traceId,
    spanId: args.spanId,
    parentSpanId: null,
    name: u.name ?? null,
    spanType: u.spanType ?? null,
    isEvent: u.isEvent ?? null,
    endedAt: u.endedAt ?? null,
    experimentId: null,
    entityType: null,
    entityId: null,
    entityName: null,
    userId: null,
    organizationId: null,
    resourceId: null,
    runId: null,
    sessionId: null,
    threadId: null,
    requestId: null,
    environment: null,
    source: null,
    serviceName: null,
    attributes: (u.attributes as Record<string, unknown>) ?? null,
    metadata: (u.metadata as Record<string, unknown>) ?? null,
    tags: null,
    scope: (u.scope as Record<string, unknown>) ?? null,
    links: u.links ?? null,
    input: (u.input as Record<string, unknown>) ?? null,
    output: (u.output as Record<string, unknown>) ?? null,
    error: (u.error as Record<string, unknown>) ?? null,
    requestContext: null,
  };
}

/** Insert a 'start' event for a new span. */
export async function createSpan(db: DuckDBConnection, args: CreateSpanArgs): Promise<void> {
  await insertSpanEvents(db, [createSpanRow(args.span)]);
}

/** Insert an 'update' or 'end' event for an existing span. */
export async function updateSpan(db: DuckDBConnection, args: UpdateSpanArgs): Promise<void> {
  await insertSpanEvents(db, [updateSpanRow(args)]);
}

/** Insert 'start' events for multiple spans in a single statement. */
export async function batchCreateSpans(db: DuckDBConnection, args: BatchCreateSpansArgs): Promise<void> {
  if (args.records.length === 0) return;
  await insertSpanEvents(db, args.records.map(createSpanRow));
}

/** Insert 'update'/'end' events for multiple spans in a single statement. */
export async function batchUpdateSpans(db: DuckDBConnection, args: BatchUpdateSpansArgs): Promise<void> {
  if (args.records.length === 0) return;
  const rows = args.records.map(record =>
    updateSpanRow({ traceId: record.traceId, spanId: record.spanId, updates: record.updates }),
  );
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
  const childErrorClause = buildHasChildErrorClause(filters.hasChildError);
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
