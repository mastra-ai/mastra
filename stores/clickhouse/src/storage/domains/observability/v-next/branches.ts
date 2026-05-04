/**
 * Trace-branches operations for ClickHouse v-next observability.
 *
 * Owns: listBranches
 * Reads from: trace_branches (populated by incremental MV from span_events,
 *             one row per branch anchor span -- AGENT_RUN, WORKFLOW_RUN,
 *             PROCESSOR_RUN, SCORER_RUN, RAG_INGESTION, TOOL_CALL,
 *             MCP_TOOL_CALL).
 */

import type { ClickHouseClient } from '@clickhouse/client';
import { BRANCH_SPAN_TYPES, listBranchesArgsSchema, toTraceSpans, TraceStatus } from '@mastra/core/storage';
import type { ListBranchesArgs, ListBranchesResponse } from '@mastra/core/storage';

import { TABLE_TRACE_BRANCHES } from './ddl';
import { CH_SETTINGS, rowToSpanRecord } from './helpers';

const ALLOWED_SPAN_TYPES_LIST = BRANCH_SPAN_TYPES.map(t => `'${t}'`).join(', ');

/**
 * List trace branches with optional filtering, pagination, and ordering.
 *
 * Reads from `mastra_trace_branches` (one row per branch anchor span). Uses the
 * same two-stage dedupe + paginate pattern as listTraces.
 *
 * Filters apply to the anchor span itself (not to a containing trace root)
 * -- which is the whole point of this surface.
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
    conditions.push(`spanType IN (${ALLOWED_SPAN_TYPES_LIST})`);
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
      ORDER BY ${sortField} ${sortDirection}
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
