/**
 * Trace-roots reads for the v-next Postgres observability domain.
 *
 * `mastra_trace_roots` is populated by an AFTER INSERT trigger on
 * `mastra_span_events` (see ddl.ts). It contains exactly the root spans
 * (`parentSpanId IS NULL`) and is the read target for `listTraces` and
 * `getRootSpan`.
 */

import { listTracesArgsSchema, TraceStatus, toTraceSpans } from '@mastra/core/storage';
import type {
  GetRootSpanArgs,
  GetRootSpanResponse,
  ListTracesArgs,
  ListTracesResponse,
  SpanRecord,
} from '@mastra/core/storage';

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_SPAN_EVENTS, TABLE_TRACE_ROOTS } from './ddl';
import { rowToSpanRecord } from './helpers';
import { SPAN_SELECT_COLUMNS } from './sql';

export async function getRootSpan(
  client: DbClient,
  schema: string,
  args: GetRootSpanArgs,
): Promise<GetRootSpanResponse | null> {
  const table = qualifiedTable(schema, TABLE_TRACE_ROOTS);
  const row = await client.oneOrNone<Record<string, any>>(
    `SELECT ${SPAN_SELECT_COLUMNS}
     FROM ${table}
     WHERE "traceId" = $1
     ORDER BY "endedAt" DESC
     LIMIT 1`,
    [args.traceId],
  );
  if (!row) return null;
  return { span: rowToSpanRecord(row) };
}

export async function listTraces(client: DbClient, schema: string, args: ListTracesArgs): Promise<ListTracesResponse> {
  const { filters, pagination, orderBy } = listTracesArgsSchema.parse(args);
  const page = pagination?.page ?? 0;
  const perPage = pagination?.perPage ?? 10;

  const roots = qualifiedTable(schema, TABLE_TRACE_ROOTS);
  const span = qualifiedTable(schema, TABLE_SPAN_EVENTS);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (filters) {
    if (filters.startedAt?.start) {
      conditions.push(`r."startedAt" >= $${i++}`);
      params.push(filters.startedAt.start.toISOString());
    }
    if (filters.startedAt?.end) {
      conditions.push(`r."startedAt" <= $${i++}`);
      params.push(filters.startedAt.end.toISOString());
    }
    if (filters.endedAt?.start) {
      conditions.push(`r."endedAt" >= $${i++}`);
      params.push(filters.endedAt.start.toISOString());
    }
    if (filters.endedAt?.end) {
      conditions.push(`r."endedAt" <= $${i++}`);
      params.push(filters.endedAt.end.toISOString());
    }
    if (filters.spanType !== undefined) {
      conditions.push(`r."spanType" = $${i++}`);
      params.push(filters.spanType);
    }
    if (filters.entityType !== undefined) {
      conditions.push(`r."entityType" = $${i++}`);
      params.push(filters.entityType);
    }
    if (filters.entityId !== undefined) {
      conditions.push(`r."entityId" = $${i++}`);
      params.push(filters.entityId);
    }
    if (filters.entityName !== undefined) {
      conditions.push(`r."entityName" = $${i++}`);
      params.push(filters.entityName);
    }
    if (filters.userId !== undefined) {
      conditions.push(`r."userId" = $${i++}`);
      params.push(filters.userId);
    }
    if (filters.organizationId !== undefined) {
      conditions.push(`r."organizationId" = $${i++}`);
      params.push(filters.organizationId);
    }
    if (filters.resourceId !== undefined) {
      conditions.push(`r."resourceId" = $${i++}`);
      params.push(filters.resourceId);
    }
    if (filters.runId !== undefined) {
      conditions.push(`r."runId" = $${i++}`);
      params.push(filters.runId);
    }
    if (filters.sessionId !== undefined) {
      conditions.push(`r."sessionId" = $${i++}`);
      params.push(filters.sessionId);
    }
    if (filters.threadId !== undefined) {
      conditions.push(`r."threadId" = $${i++}`);
      params.push(filters.threadId);
    }
    if (filters.requestId !== undefined) {
      conditions.push(`r."requestId" = $${i++}`);
      params.push(filters.requestId);
    }
    if (filters.environment !== undefined) {
      conditions.push(`r."environment" = $${i++}`);
      params.push(filters.environment);
    }
    if (filters.source !== undefined) {
      conditions.push(`r."executionSource" = $${i++}`);
      params.push(filters.source);
    }
    if (filters.serviceName !== undefined) {
      conditions.push(`r."serviceName" = $${i++}`);
      params.push(filters.serviceName);
    }
    if (filters.metadata != null) {
      conditions.push(`r."metadataSearch" @> $${i++}::jsonb`);
      params.push(JSON.stringify(filters.metadata));
    }
    if (filters.tags != null && filters.tags.length > 0) {
      conditions.push(`r."tags" @> $${i++}::text[]`);
      params.push(filters.tags);
    }
    if (filters.status !== undefined) {
      switch (filters.status) {
        case TraceStatus.ERROR:
          conditions.push(`r."error" IS NOT NULL`);
          break;
        case TraceStatus.RUNNING:
          // Insert-only contract: only ended spans are persisted.
          conditions.push(`FALSE`);
          break;
        case TraceStatus.SUCCESS:
          conditions.push(`r."error" IS NULL`);
          break;
      }
    }
    if (filters.hasChildError !== undefined) {
      const sub = `EXISTS (
        SELECT 1 FROM ${span} c
        WHERE c."traceId" = r."traceId" AND c."spanId" <> r."spanId" AND c."error" IS NOT NULL
      )`;
      conditions.push(filters.hasChildError ? sub : `NOT ${sub}`);
    }
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderField = orderBy?.field ?? 'startedAt';
  const orderDir = orderBy?.direction ?? 'DESC';
  const orderClause =
    orderField === 'endedAt'
      ? `ORDER BY r."endedAt" ${orderDir} NULLS ${orderDir === 'DESC' ? 'FIRST' : 'LAST'}`
      : `ORDER BY r."${orderField}" ${orderDir}`;

  const countRow = await client.oneOrNone<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${roots} r ${whereClause}`,
    params,
  );
  const count = Number(countRow?.count ?? 0);

  if (count === 0) {
    return {
      pagination: { total: 0, page, perPage, hasMore: false },
      spans: [],
    };
  }

  const rows = await client.manyOrNone<Record<string, any>>(
    `SELECT ${SPAN_SELECT_COLUMNS.replace(/\n/g, ' ')
      .split(',')
      .map(c => `r.${c.trim()}`)
      .join(', ')}
     FROM ${roots} r
     ${whereClause}
     ${orderClause}
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, perPage, page * perPage],
  );

  const spans: SpanRecord[] = rows.map(rowToSpanRecord);
  return {
    pagination: { total: count, page, perPage, hasMore: (page + 1) * perPage < count },
    spans: toTraceSpans(spans),
  };
}
