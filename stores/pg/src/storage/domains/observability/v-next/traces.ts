/**
 * Trace / branch list reads for the v-next Postgres observability domain.
 *
 * - `listTraces` / `getRootSpan` filter by `parentSpanId IS NULL`. The partial
 *   indexes declared in ddl.ts make this predicate selective enough to act as
 *   the root-span projection without a separate table.
 * - `listBranches` filters by `spanType IN (BRANCH_SPAN_TYPES)` (or the
 *   user-supplied spanType when it's a branch type). Branches include nested
 *   anchors as well as root spans of the listed types.
 */

import {
  BRANCH_SPAN_TYPES,
  listBranchesArgsSchema,
  listTracesArgsSchema,
  TraceStatus,
  toTraceSpans,
} from '@mastra/core/storage';
import type {
  GetRootSpanArgs,
  GetRootSpanResponse,
  ListBranchesArgs,
  ListBranchesResponse,
  ListTracesArgs,
  ListTracesResponse,
  SpanRecord,
} from '@mastra/core/storage';

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_SPAN_EVENTS } from './ddl';
import { rowToSpanRecord } from './helpers';
import { assertDeltaPollingEnabled, deltaPollingFeatureEnabled, encodeDeltaCursor, validateCursorId } from './polling';
import { SPAN_SELECT_COLUMNS } from './sql';

export async function getRootSpan(
  client: DbClient,
  schema: string,
  args: GetRootSpanArgs,
): Promise<GetRootSpanResponse | null> {
  const table = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const row = await client.oneOrNone<Record<string, any>>(
    `SELECT ${SPAN_SELECT_COLUMNS}
     FROM ${table}
     WHERE "traceId" = $1 AND "parentSpanId" IS NULL
     ORDER BY "endedAt" DESC
     LIMIT 1`,
    [args.traceId],
  );
  if (!row) return null;
  return { span: rowToSpanRecord(row) };
}

/**
 * Build the WHERE conditions and bind params for a listTraces query against
 * `mastra_span_events r`. Always prepends the root-span predicate so the
 * partial root indexes (and the partial cursor index) get picked up by the
 * planner. Starts numbering from `nextParamIdx`.
 */
function buildListTracesFilters(
  filters: ListTracesArgs['filters'],
  spanTable: string,
  nextParamIdx: number,
): { conditions: string[]; params: unknown[]; nextParamIdx: number } {
  const conditions: string[] = [`r."parentSpanId" IS NULL`];
  const params: unknown[] = [];
  let i = nextParamIdx;

  if (!filters) {
    return { conditions, params, nextParamIdx: i };
  }

  if (filters.startedAt?.start) {
    conditions.push(`r."startedAt" ${filters.startedAt.startExclusive ? '>' : '>='} $${i++}`);
    params.push(filters.startedAt.start.toISOString());
  }
  if (filters.startedAt?.end) {
    conditions.push(`r."startedAt" ${filters.startedAt.endExclusive ? '<' : '<='} $${i++}`);
    params.push(filters.startedAt.end.toISOString());
  }
  if (filters.endedAt?.start) {
    conditions.push(`r."endedAt" ${filters.endedAt.startExclusive ? '>' : '>='} $${i++}`);
    params.push(filters.endedAt.start.toISOString());
  }
  if (filters.endedAt?.end) {
    conditions.push(`r."endedAt" ${filters.endedAt.endExclusive ? '<' : '<='} $${i++}`);
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
      SELECT 1 FROM ${spanTable} c
      WHERE c."traceId" = r."traceId" AND c."spanId" <> r."spanId" AND c."error" IS NOT NULL
    )`;
    conditions.push(filters.hasChildError ? sub : `NOT ${sub}`);
  }

  return { conditions, params, nextParamIdx: i };
}

/**
 * Project the standard span columns with the `r.` alias prefix.
 *
 * Built by string-munging `SPAN_SELECT_COLUMNS` (a constant in sql.ts) at
 * module load. This works because every entry in that list is a bare
 * column name like `"traceId"` — no expressions, no functions. If anyone
 * ever adds something like `COALESCE(...)` to `SPAN_SELECT_COLUMNS`, the
 * naive split-on-comma breaks. Keep both lists shaped as plain column
 * names; if you need computed columns, switch to a structured
 * array-of-strings representation here.
 */
const SPAN_SELECT_COLUMNS_ALIASED = SPAN_SELECT_COLUMNS.replace(/\n/g, ' ')
  .split(',')
  .map(c => `r.${c.trim()}`)
  .join(', ');

export async function listTraces(client: DbClient, schema: string, args: ListTracesArgs): Promise<ListTracesResponse> {
  const { mode, filters, pagination, orderBy, after, limit } = listTracesArgsSchema.parse(args);
  const span = qualifiedTable(schema, TABLE_SPAN_EVENTS);

  if (mode === 'delta') {
    assertDeltaPollingEnabled();
    return listTracesDelta(client, span, filters, after, limit);
  }

  return listTracesPage(client, span, filters, pagination.page, pagination.perPage, orderBy.field, orderBy.direction);
}

async function listTracesPage(
  client: DbClient,
  span: string,
  filters: ListTracesArgs['filters'],
  page: number,
  perPage: number,
  orderField: 'startedAt' | 'endedAt',
  orderDir: 'ASC' | 'DESC',
): Promise<ListTracesResponse> {
  const { conditions, params, nextParamIdx } = buildListTracesFilters(filters, span, 1);
  let i = nextParamIdx;
  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const orderClause =
    orderField === 'endedAt'
      ? `ORDER BY r."endedAt" ${orderDir} NULLS ${orderDir === 'DESC' ? 'FIRST' : 'LAST'}`
      : `ORDER BY r."${orderField}" ${orderDir}`;

  const countRow = await client.oneOrNone<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${span} r ${whereClause}`,
    params,
  );
  const count = Number(countRow?.count ?? 0);

  let spans: SpanRecord[] = [];
  if (count > 0) {
    const rows = await client.manyOrNone<Record<string, any>>(
      `SELECT ${SPAN_SELECT_COLUMNS_ALIASED}
       FROM ${span} r
       ${whereClause}
       ${orderClause}
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, perPage, page * perPage],
    );
    spans = rows.map(rowToSpanRecord);
  }

  const deltaCursor = deltaPollingFeatureEnabled()
    ? await readTracesStreamHeadCursor(client, span, filters)
    : undefined;

  return {
    pagination: { total: count, page, perPage, hasMore: (page + 1) * perPage < count },
    spans: toTraceSpans(spans),
    ...(deltaCursor !== undefined ? { deltaCursor } : {}),
  };
}

async function listTracesDelta(
  client: DbClient,
  span: string,
  filters: ListTracesArgs['filters'],
  after: string | undefined,
  limit: number,
): Promise<ListTracesResponse> {
  if (after === undefined) {
    const deltaCursor = await readTracesStreamHeadCursor(client, span, filters);
    return { spans: [], delta: { limit, hasMore: false }, deltaCursor };
  }

  const afterId = validateCursorId(after);
  const { conditions, params, nextParamIdx } = buildListTracesFilters(filters, span, 1);
  let i = nextParamIdx;
  conditions.push(`r."cursorId" > $${i++}::bigint`);
  params.push(afterId);

  const rows = await client.manyOrNone<Record<string, any>>(
    `SELECT ${SPAN_SELECT_COLUMNS_ALIASED}
     FROM ${span} r
     WHERE ${conditions.join(' AND ')}
     ORDER BY r."cursorId" ASC
     LIMIT $${i++}`,
    [...params, limit + 1],
  );

  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  const deltaCursor =
    visible.length > 0
      ? encodeDeltaCursor(visible[visible.length - 1]!.cursorId)
      : await readTracesStreamHeadCursor(client, span, filters);

  return {
    spans: toTraceSpans(visible.map(rowToSpanRecord)),
    delta: { limit, hasMore },
    deltaCursor,
  };
}

async function readTracesStreamHeadCursor(
  client: DbClient,
  span: string,
  filters: ListTracesArgs['filters'],
): Promise<string> {
  const { conditions, params } = buildListTracesFilters(filters, span, 1);
  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const filtered = await client.oneOrNone<{ cursorId: string | null }>(
    `SELECT MAX(r."cursorId")::text AS "cursorId" FROM ${span} r ${whereClause}`,
    params,
  );
  if (filtered?.cursorId != null) return encodeDeltaCursor(filtered.cursorId);

  const head = await client.oneOrNone<{ cursorId: string | null }>(
    `SELECT MAX("cursorId")::text AS "cursorId" FROM ${span} WHERE "parentSpanId" IS NULL`,
  );
  return encodeDeltaCursor(head?.cursorId);
}

// ---------------------------------------------------------------------------
// listBranches
// ---------------------------------------------------------------------------

const BRANCH_SPAN_TYPE_SET = new Set<string>(BRANCH_SPAN_TYPES);

/**
 * Build the spanType predicate for a branch query. If the caller supplied a
 * specific branch type, narrow to that one; otherwise match the full
 * BRANCH_SPAN_TYPES set. Pushes the bind params onto `params` and returns the
 * SQL fragment plus the next param index.
 */
function buildBranchSpanTypeClause(
  userSpanType: string | undefined,
  params: unknown[],
  startIdx: number,
): { clause: string; nextIdx: number } | null {
  if (userSpanType !== undefined) {
    if (!BRANCH_SPAN_TYPE_SET.has(userSpanType)) {
      // Caller asked for a non-branch spanType — intersection is empty.
      return null;
    }
    params.push(userSpanType);
    return { clause: `r."spanType" = $${startIdx}`, nextIdx: startIdx + 1 };
  }
  const placeholders: string[] = [];
  for (const t of BRANCH_SPAN_TYPES) {
    placeholders.push(`$${startIdx + placeholders.length}`);
    params.push(t);
  }
  return { clause: `r."spanType" IN (${placeholders.join(', ')})`, nextIdx: startIdx + placeholders.length };
}

/**
 * Apply branch filters (spanType + the shared context surface). Branches do
 * NOT have a `parentSpanId IS NULL` predicate — branches can be nested under
 * other spans. Returns the bound params and the next param index.
 */
function buildListBranchesFilters(
  filters: ListBranchesArgs['filters'],
  spanType: string | undefined,
  nextParamIdx: number,
): { conditions: string[]; params: unknown[]; nextParamIdx: number } | null {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = nextParamIdx;

  const spanTypeClause = buildBranchSpanTypeClause(spanType, params, i);
  if (!spanTypeClause) return null;
  conditions.push(spanTypeClause.clause);
  i = spanTypeClause.nextIdx;

  if (!filters) return { conditions, params, nextParamIdx: i };

  if (filters.startedAt?.start) {
    conditions.push(`r."startedAt" ${filters.startedAt.startExclusive ? '>' : '>='} $${i++}`);
    params.push(filters.startedAt.start.toISOString());
  }
  if (filters.startedAt?.end) {
    conditions.push(`r."startedAt" ${filters.startedAt.endExclusive ? '<' : '<='} $${i++}`);
    params.push(filters.startedAt.end.toISOString());
  }
  if (filters.endedAt?.start) {
    conditions.push(`r."endedAt" ${filters.endedAt.startExclusive ? '>' : '>='} $${i++}`);
    params.push(filters.endedAt.start.toISOString());
  }
  if (filters.endedAt?.end) {
    conditions.push(`r."endedAt" ${filters.endedAt.endExclusive ? '<' : '<='} $${i++}`);
    params.push(filters.endedAt.end.toISOString());
  }
  if (filters.traceId !== undefined) {
    conditions.push(`r."traceId" = $${i++}`);
    params.push(filters.traceId);
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
  if (filters.entityVersionId !== undefined) {
    conditions.push(`r."entityVersionId" = $${i++}`);
    params.push(filters.entityVersionId);
  }
  if (filters.parentEntityType !== undefined) {
    conditions.push(`r."parentEntityType" = $${i++}`);
    params.push(filters.parentEntityType);
  }
  if (filters.parentEntityId !== undefined) {
    conditions.push(`r."parentEntityId" = $${i++}`);
    params.push(filters.parentEntityId);
  }
  if (filters.parentEntityName !== undefined) {
    conditions.push(`r."parentEntityName" = $${i++}`);
    params.push(filters.parentEntityName);
  }
  if (filters.parentEntityVersionId !== undefined) {
    conditions.push(`r."parentEntityVersionId" = $${i++}`);
    params.push(filters.parentEntityVersionId);
  }
  if (filters.rootEntityType !== undefined) {
    conditions.push(`r."rootEntityType" = $${i++}`);
    params.push(filters.rootEntityType);
  }
  if (filters.rootEntityId !== undefined) {
    conditions.push(`r."rootEntityId" = $${i++}`);
    params.push(filters.rootEntityId);
  }
  if (filters.rootEntityName !== undefined) {
    conditions.push(`r."rootEntityName" = $${i++}`);
    params.push(filters.rootEntityName);
  }
  if (filters.rootEntityVersionId !== undefined) {
    conditions.push(`r."rootEntityVersionId" = $${i++}`);
    params.push(filters.rootEntityVersionId);
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
  if (filters.experimentId !== undefined) {
    conditions.push(`r."experimentId" = $${i++}`);
    params.push(filters.experimentId);
  }
  if (filters.environment !== undefined) {
    conditions.push(`r."environment" = $${i++}`);
    params.push(filters.environment);
  }
  if (filters.serviceName !== undefined) {
    conditions.push(`r."serviceName" = $${i++}`);
    params.push(filters.serviceName);
  }
  if (filters.source !== undefined) {
    conditions.push(`r."executionSource" = $${i++}`);
    params.push(filters.source);
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
        // Insert-only: only ended spans persist.
        conditions.push(`FALSE`);
        break;
      case TraceStatus.SUCCESS:
        conditions.push(`r."error" IS NULL`);
        break;
    }
  }

  return { conditions, params, nextParamIdx: i };
}

export async function listBranches(
  client: DbClient,
  schema: string,
  args: ListBranchesArgs,
): Promise<ListBranchesResponse> {
  const { mode, filters, pagination, orderBy, after, limit } = listBranchesArgsSchema.parse(args);
  const span = qualifiedTable(schema, TABLE_SPAN_EVENTS);

  if (mode === 'delta') {
    assertDeltaPollingEnabled();
    return listBranchesDelta(client, span, filters, after, limit);
  }

  return listBranchesPage(client, span, filters, pagination.page, pagination.perPage, orderBy.field, orderBy.direction);
}

async function listBranchesPage(
  client: DbClient,
  span: string,
  filters: ListBranchesArgs['filters'],
  page: number,
  perPage: number,
  orderField: 'startedAt' | 'endedAt',
  orderDir: 'ASC' | 'DESC',
): Promise<ListBranchesResponse> {
  const built = buildListBranchesFilters(filters, filters?.spanType, 1);
  if (!built) {
    // Caller asked for a non-branch spanType — nothing matches by definition.
    const deltaCursor = deltaPollingFeatureEnabled()
      ? await readBranchesStreamHeadCursor(client, span, filters)
      : undefined;
    return {
      pagination: { total: 0, page, perPage, hasMore: false },
      branches: [],
      ...(deltaCursor !== undefined ? { deltaCursor } : {}),
    };
  }

  const { conditions, params, nextParamIdx } = built;
  let i = nextParamIdx;
  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const orderClause =
    orderField === 'endedAt'
      ? `ORDER BY r."endedAt" ${orderDir} NULLS ${orderDir === 'DESC' ? 'FIRST' : 'LAST'}`
      : `ORDER BY r."${orderField}" ${orderDir}`;

  const countRow = await client.oneOrNone<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${span} r ${whereClause}`,
    params,
  );
  const count = Number(countRow?.count ?? 0);

  let spans: SpanRecord[] = [];
  if (count > 0) {
    const rows = await client.manyOrNone<Record<string, any>>(
      `SELECT ${SPAN_SELECT_COLUMNS_ALIASED}
       FROM ${span} r
       ${whereClause}
       ${orderClause}
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, perPage, page * perPage],
    );
    spans = rows.map(rowToSpanRecord);
  }

  const deltaCursor = deltaPollingFeatureEnabled()
    ? await readBranchesStreamHeadCursor(client, span, filters)
    : undefined;

  return {
    pagination: { total: count, page, perPage, hasMore: (page + 1) * perPage < count },
    branches: toTraceSpans(spans),
    ...(deltaCursor !== undefined ? { deltaCursor } : {}),
  };
}

async function listBranchesDelta(
  client: DbClient,
  span: string,
  filters: ListBranchesArgs['filters'],
  after: string | undefined,
  limit: number,
): Promise<ListBranchesResponse> {
  if (after === undefined) {
    const deltaCursor = await readBranchesStreamHeadCursor(client, span, filters);
    return { branches: [], delta: { limit, hasMore: false }, deltaCursor };
  }

  const built = buildListBranchesFilters(filters, filters?.spanType, 1);
  if (!built) {
    return {
      branches: [],
      delta: { limit, hasMore: false },
      deltaCursor: await readBranchesStreamHeadCursor(client, span, filters),
    };
  }

  const { conditions, params, nextParamIdx } = built;
  let i = nextParamIdx;
  const afterId = validateCursorId(after);
  conditions.push(`r."cursorId" > $${i++}::bigint`);
  params.push(afterId);

  const rows = await client.manyOrNone<Record<string, any>>(
    `SELECT ${SPAN_SELECT_COLUMNS_ALIASED}
     FROM ${span} r
     WHERE ${conditions.join(' AND ')}
     ORDER BY r."cursorId" ASC
     LIMIT $${i++}`,
    [...params, limit + 1],
  );

  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  const deltaCursor =
    visible.length > 0
      ? encodeDeltaCursor(visible[visible.length - 1]!.cursorId)
      : await readBranchesStreamHeadCursor(client, span, filters);

  return {
    branches: toTraceSpans(visible.map(rowToSpanRecord)),
    delta: { limit, hasMore },
    deltaCursor,
  };
}

/**
 * Head cursor for branches. Like `readTracesStreamHeadCursor`, falls back to
 * the unfiltered branch stream when the filtered set is empty so polling can
 * resume against the whole branch surface.
 *
 * The fallback `MAX("cursorId") WHERE "spanType" IN (...)` query has no
 * time predicate and so scans every branch row ever inserted. That's fine
 * at the ~100 calls/sec target this adapter is built for; for very large
 * tables the planner can still serve it from `mastra_span_events_cursor_idx`
 * via a backward index scan that stops at the first match.
 */
async function readBranchesStreamHeadCursor(
  client: DbClient,
  span: string,
  filters: ListBranchesArgs['filters'],
): Promise<string> {
  const built = buildListBranchesFilters(filters, filters?.spanType, 1);
  if (built) {
    const filtered = await client.oneOrNone<{ cursorId: string | null }>(
      `SELECT MAX(r."cursorId")::text AS "cursorId" FROM ${span} r WHERE ${built.conditions.join(' AND ')}`,
      built.params,
    );
    if (filtered?.cursorId != null) return encodeDeltaCursor(filtered.cursorId);
  }

  // Fallback: head of the all-branches stream regardless of filter.
  const placeholders: string[] = [];
  const params: unknown[] = [];
  for (let n = 0; n < BRANCH_SPAN_TYPES.length; n++) {
    placeholders.push(`$${n + 1}`);
    params.push(BRANCH_SPAN_TYPES[n]);
  }
  const head = await client.oneOrNone<{ cursorId: string | null }>(
    `SELECT MAX("cursorId")::text AS "cursorId" FROM ${span} WHERE "spanType" IN (${placeholders.join(', ')})`,
    params,
  );
  return encodeDeltaCursor(head?.cursorId);
}
