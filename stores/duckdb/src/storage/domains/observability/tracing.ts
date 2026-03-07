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
import type { DuckDBConnection } from '../../db/index.js';
import { buildWhereClause, buildOrderByClause, buildPaginationClause } from './filters.js';
import { v, jsonV, rowToSpanRecord } from './helpers.js';

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
  'startedAt',
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
    min(timestamp) FILTER (WHERE eventType = 'start') as startedAt,
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
    ${argMaxNonNull('error')}
  FROM span_events
`;

// ============================================================================
// Row builder — used by both create and update
// ============================================================================

/**
 * A span event row to be inserted into the span_events table.
 *
 * `timestamp` is intentionally absent — it's the event ordering key, computed
 * internally from the eventType:
 *   - 'start'  → startedAt (the span's actual start time)
 *   - 'update' → now       (wall-clock time the update was recorded)
 *   - 'end'    → now       (wall-clock time the end was recorded)
 *
 * This is distinct from startedAt/endedAt which are the span's logical times.
 */
interface SpanEventRow {
  eventType: 'start' | 'update' | 'end';
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string | null;
  spanType: string | null;
  isEvent: boolean | null;
  startedAt: Date | null;
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
}

function eventTimestamp(row: SpanEventRow): Date {
  return row.eventType === 'start' && row.startedAt ? row.startedAt : new Date();
}

function toValuesTuple(row: SpanEventRow): string {
  return [
    v(row.eventType),
    v(eventTimestamp(row)),
    v(row.traceId),
    v(row.spanId),
    v(row.parentSpanId),
    v(row.name),
    v(row.spanType),
    v(row.isEvent),
    v(row.startedAt),
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
    traceId: s.traceId,
    spanId: s.spanId,
    parentSpanId: s.parentSpanId ?? null,
    name: s.name,
    spanType: s.spanType,
    isEvent: s.isEvent,
    startedAt: s.startedAt,
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
  };
}

function updateSpanRow(args: UpdateSpanArgs): SpanEventRow {
  const u = args.updates;
  return {
    eventType: u.endedAt ? 'end' : 'update',
    traceId: args.traceId,
    spanId: args.spanId,
    parentSpanId: null,
    name: u.name ?? null,
    spanType: u.spanType ?? null,
    isEvent: u.isEvent ?? null,
    startedAt: null,
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
  };
}

export async function createSpan(db: DuckDBConnection, args: CreateSpanArgs): Promise<void> {
  await insertSpanEvents(db, [createSpanRow(args.span)]);
}

export async function updateSpan(db: DuckDBConnection, args: UpdateSpanArgs): Promise<void> {
  await insertSpanEvents(db, [updateSpanRow(args)]);
}

export async function batchCreateSpans(db: DuckDBConnection, args: BatchCreateSpansArgs): Promise<void> {
  if (args.records.length === 0) return;
  await insertSpanEvents(db, args.records.map(createSpanRow));
}

export async function batchUpdateSpans(db: DuckDBConnection, args: BatchUpdateSpansArgs): Promise<void> {
  if (args.records.length === 0) return;
  const rows = args.records.map(record =>
    updateSpanRow({ traceId: record.traceId, spanId: record.spanId, updates: record.updates }),
  );
  await insertSpanEvents(db, rows);
}

export async function batchDeleteTraces(db: DuckDBConnection, args: BatchDeleteTracesArgs): Promise<void> {
  if (args.traceIds.length === 0) return;
  const placeholders = args.traceIds.map(() => '?').join(', ');
  await db.execute(`DELETE FROM span_events WHERE traceId IN (${placeholders})`, args.traceIds);
}

// ============================================================================
// Read / Reconstruction
// ============================================================================

export async function getSpan(db: DuckDBConnection, args: GetSpanArgs): Promise<GetSpanResponse | null> {
  const rows = await db.query(`${SPAN_RECONSTRUCT_SELECT} WHERE traceId = ? AND spanId = ? GROUP BY traceId, spanId`, [
    args.traceId,
    args.spanId,
  ]);
  if (rows.length === 0) return null;
  return { span: rowToSpanRecord(rows[0]!) };
}

export async function getRootSpan(db: DuckDBConnection, args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
  const rows = await db.query(
    `${SPAN_RECONSTRUCT_SELECT} WHERE traceId = ? GROUP BY traceId, spanId HAVING arg_max(parentSpanId, timestamp) IS NULL LIMIT 1`,
    [args.traceId],
  );
  if (rows.length === 0) return null;
  return { span: rowToSpanRecord(rows[0]!) };
}

export async function getTrace(db: DuckDBConnection, args: GetTraceArgs): Promise<GetTraceResponse | null> {
  const rows = await db.query(`${SPAN_RECONSTRUCT_SELECT} WHERE traceId = ? GROUP BY traceId, spanId`, [args.traceId]);
  if (rows.length === 0) return null;
  return {
    traceId: args.traceId,
    spans: rows.map(row => rowToSpanRecord(row as Record<string, unknown>)),
  };
}

export async function listTraces(db: DuckDBConnection, args: ListTracesArgs): Promise<ListTracesResponse> {
  const filters = args.filters ?? {};
  const page = args.pagination?.page ?? 0;
  const perPage = args.pagination?.perPage ?? 10;
  const orderBy = { field: args.orderBy?.field ?? 'startedAt', direction: args.orderBy?.direction ?? 'DESC' };

  const { clause: filterClause, params: filterParams } = buildWhereClause(filters as Record<string, unknown>);
  const orderByClause = buildOrderByClause(orderBy);
  const { clause: paginationClause, params: paginationParams } = buildPaginationClause({ page, perPage });

  const countSql = `
    WITH reconstructed AS (
      ${SPAN_RECONSTRUCT_SELECT}
      GROUP BY traceId, spanId
      HAVING arg_max(parentSpanId, timestamp) IS NULL
    )
    SELECT COUNT(*) as total FROM reconstructed ${filterClause}
  `;
  const countResult = await db.query<{ total: number }>(countSql, filterParams);
  const total = Number(countResult[0]?.total ?? 0);

  const dataSql = `
    WITH reconstructed AS (
      ${SPAN_RECONSTRUCT_SELECT}
      GROUP BY traceId, spanId
      HAVING arg_max(parentSpanId, timestamp) IS NULL
    )
    SELECT * FROM reconstructed ${filterClause} ${orderByClause} ${paginationClause}
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
