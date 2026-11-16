import * as coreStorage from '@mastra/core/storage';
import type {
  SpanQueryCostMetric,
  SpanQueryIdentity,
  SpanQueryPayload,
  SpanQuerySelectedRow,
  TrustedSpanQueryPlan,
} from '@mastra/core/storage';
import { DuckDBQueryTimeoutError } from '../../db';
import type { DuckDBConnection } from '../../db';
import { spanQueryOutcomeFieldsSupported, timeToFirstChunkSupported, timeToFirstTokenSupported } from '../../features';
import { parseJson, payloadColumnSql, timeRangeOf } from './helpers';
import { buildSpanQueryResponse, needsPreview, readPreview } from './preview-compat';
import { compileSpanQueryPredicate } from './trace-query';

const identityFields = ['organizationId', 'resourceId', 'traceId', 'spanId'] as const;
/** Span rows store the execution source as `source`. */
const columnSql = (field: string) => (field === 'executionSource' ? 'e.source AS executionSource' : `e.${field}`);
const identities = identityFields.join(', ');
const fields = [
  ...identityFields,
  'parentSpanId',
  'name',
  'spanType',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'parentEntityVersionId',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
  'rootEntityVersionId',
  'threadId',
  'runId',
  'sessionId',
  'userId',
  'requestId',
  'serviceName',
  'experimentId',
  'environment',
  'executionSource',
  'timeToFirstChunkMs',
  'timeToFirstTokenMs',
  'outcome',
  'stopReason',
];

function keys(rows: SpanQueryIdentity[], values: unknown[], alias = ''): string {
  return rows
    .map(
      row =>
        `(${identityFields
          .map(field => {
            values.push(row[field]);
            return `${alias}${field} IS NOT DISTINCT FROM ?`;
          })
          .join(' AND ')})`,
    )
    .join(' OR ');
}

function sortColumn(plan: TrustedSpanQueryPlan): string {
  const column = `s.${plan.orderBy.field}`;
  return plan.orderBy.field === 'model' || plan.orderBy.field === 'provider' ? `${column} COLLATE "C"` : column;
}

function afterCursor(plan: TrustedSpanQueryPlan): { sql: string; values: unknown[] } {
  if (!plan.cursor) return { sql: 'TRUE', values: [] };
  const cursor = plan.cursor;
  const sort = sortColumn(plan);
  const empty = cursor.sortValue === null;
  const stringSort = plan.orderBy.field === 'model' || plan.orderBy.field === 'provider';
  const value = stringSort
    ? 'CAST(? AS VARCHAR) COLLATE "C"'
    : `CAST(? AS ${typeof cursor.sortValue === 'number' ? 'DOUBLE' : 'TIMESTAMP'})`;
  // Empty values sort last: a set cursor is followed by every empty value, an empty cursor only by its ties.
  const comparisons = empty
    ? []
    : [`${sort} ${plan.orderBy.direction === 'asc' ? '>' : '<'} ${value}`, `${sort} IS NULL`];
  const values: unknown[] = empty ? [] : [cursor.sortValue];
  for (let i = 0; i < identityFields.length; i++) {
    const field = identityFields[i]!;
    if (cursor[field] === null) continue;
    const equal = [empty ? `${sort} IS NULL` : `${sort} = ${value}`];
    if (!empty) values.push(cursor.sortValue);
    for (const prior of identityFields.slice(0, i)) {
      equal.push(`s.${prior} IS NOT DISTINCT FROM ?`);
      values.push(cursor[prior]);
    }
    values.push(cursor[field]);
    comparisons.push(`(${equal.join(' AND ')} AND (s.${field} > ? OR s.${field} IS NULL))`);
  }
  return { sql: `(${comparisons.join(' OR ')})`, values };
}

/**
 * The spans `querySpans()` selects, as CTEs ending in `selected`: the current completed copy of
 * each span that started in the window and matches `where`. Values are in placeholder order.
 */
export function compileDuckDBSpanSelection(plan: Pick<TrustedSpanQueryPlan, 'timeRange' | 'scope' | 'where'>): {
  ctes: string[];
  values: unknown[];
} {
  const values: unknown[] = [plan.timeRange.from, plan.timeRange.to];
  const scope: string[] = [];
  if (plan.scope) {
    scope.push('organizationId = ?');
    values.push(plan.scope.organizationId);
    if (plan.scope.resourceId !== undefined) {
      scope.push('resourceId = ?');
      values.push(plan.scope.resourceId);
    }
  }
  const predicate = plan.where ? compileSpanQueryPredicate(plan.where) : { sql: 'TRUE', values: [] };
  values.push(plan.timeRange.from, plan.timeRange.to, ...predicate.values);
  const join = identityFields.map(field => `e.${field} IS NOT DISTINCT FROM c.${field}`).join(' AND ');
  const partition = identityFields.map(field => `e.${field}`).join(', ');
  // Start timestamps select identities; all events for those identities participate in reconstruction.
  // `model` and `provider` filters read only their dedicated columns, never span attributes.
  const ctes = [
    `candidates AS MATERIALIZED (
    SELECT ${identities} FROM span_events
    WHERE eventType = 'start' AND timestamp >= CAST(? AS TIMESTAMP) AND timestamp < CAST(? AS TIMESTAMP)
      ${scope.length ? `AND ${scope.join(' AND ')}` : ''}
    GROUP BY ${identities}
  )`,
    `span_versions AS (
    SELECT ${fields.map(columnSql).join(', ')},
      min(e.timestamp) FILTER (WHERE e.eventType = 'start') OVER (PARTITION BY ${partition}) AS startedAt, e.endedAt, e.cursorId,
      e.model, e.provider,
      date_diff('millisecond', min(e.timestamp) FILTER (WHERE e.eventType = 'start') OVER (PARTITION BY ${partition}), e.endedAt) AS durationMs,
      CASE WHEN e.error IS NULL THEN 'success' ELSE 'error' END AS status,
      CASE WHEN e.error IS NULL THEN NULL ELSE 'error' END AS error,
      row_number() OVER (PARTITION BY ${partition}
        ORDER BY CASE WHEN e.endedAt IS NULL THEN 1 ELSE 0 END, e.cursorId DESC NULLS LAST, e.endedAt DESC) AS rank
    FROM span_events e INNER JOIN candidates c ON ${join}
  )`,
    `selected AS (
    SELECT * FROM span_versions s
    WHERE rank = 1 AND endedAt IS NOT NULL AND startedAt >= CAST(? AS TIMESTAMP) AND startedAt < CAST(? AS TIMESTAMP) AND (${predicate.sql})
  )`,
  ];
  return { ctes, values };
}

export function compileDuckDBSpanQuery(plan: TrustedSpanQueryPlan) {
  const { ctes, values } = compileDuckDBSpanSelection(plan);
  const after = afterCursor(plan);
  values.push(...after.values, plan.limit + 1);
  const sql = `WITH ${ctes.join(', ')}
  SELECT ${[...fields, 'startedAt', 'endedAt', 'durationMs', 'status', 'cursorId', 'model', 'provider'].map(field => `s.${field}`).join(', ')}
  FROM selected s WHERE ${after.sql}
  ORDER BY ${sortColumn(plan)} ${plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, ${identityFields.map(field => `s.${field} ASC NULLS LAST`).join(', ')}
  LIMIT ?`;
  return { sql, values };
}

const previewPayloads = [
  ['inputPreview', payloadColumnSql('input')],
  ['outputPreview', payloadColumnSql('output')],
  ['errorPreview', 'error'],
] as const;

type Selected = Omit<SpanQuerySelectedRow, 'startedAt' | 'endedAt'> & {
  startedAt: Date;
  endedAt: Date;
  cursorId: number | null;
};

type LookupRow = SpanQueryIdentity &
  Record<(typeof previewPayloads)[number][0] | 'model' | 'provider' | 'stopReasonContext', string | null>;

function eventRowsFilter(rows: Selected[]) {
  const values: unknown[] = timeRangeOf(rows.map(row => row.endedAt));
  const conditions = rows.map(row => {
    const key = keys([row], values);
    values.push(row.cursorId, row.endedAt);
    return `(${key} AND cursorId IS NOT DISTINCT FROM ? AND endedAt = ?)`;
  });
  return { sql: `endedAt BETWEEN ? AND ? AND (${conditions.join(' OR ')})`, values };
}

export async function querySpans(db: DuckDBConnection, plan: TrustedSpanQueryPlan) {
  const deadline = performance.now() + coreStorage.TRACE_QUERY_DEFAULT_TIMEOUT_MS;
  const query = async <T>(sql: string, values: unknown[]) => {
    const remaining = Math.floor(deadline - performance.now());
    if (remaining <= 0) throw new coreStorage.TraceQueryExecutionError();
    try {
      return await db.query<T>(sql, values, remaining);
    } catch (error) {
      if (error instanceof DuckDBQueryTimeoutError) throw new coreStorage.TraceQueryExecutionError();
      if (error instanceof Error && /out of memory/i.test(error.message))
        throw new coreStorage.TraceQueryResourceLimitError();
      throw error;
    }
  };
  const compiled = compileDuckDBSpanQuery(plan);
  const rows = await query<Selected>(compiled.sql, compiled.values);
  const selected = rows.map(
    ({
      cursorId: _cursorId,
      startedAt,
      endedAt,
      timeToFirstChunkMs,
      timeToFirstTokenMs,
      outcome,
      stopReason,
      ...row
    }) => ({
      ...row,
      ...((plan.orderBy.field === 'model' || plan.orderBy.field === 'provider') && {
        cursorSortValue: row[plan.orderBy.field],
      }),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      ...(timeToFirstChunkSupported && {
        timeToFirstChunkMs: timeToFirstChunkMs == null ? null : Number(timeToFirstChunkMs),
      }),
      ...(timeToFirstTokenSupported && {
        timeToFirstTokenMs: timeToFirstTokenMs == null ? null : Number(timeToFirstTokenMs),
      }),
      ...(spanQueryOutcomeFieldsSupported && { outcome: outcome ?? null, stopReason: stopReason ?? null }),
    }),
  );
  const page = rows.slice(0, plan.limit);
  if (!page.length) return buildSpanQueryResponse(plan, [], []);
  // Model and provider fall back to span attributes for rows written before their columns existed;
  // that fallback is returned, never filtered or sorted on.
  const lookupColumns = `${identities}, CAST(stopReasonContext AS VARCHAR) AS stopReasonContext,
    COALESCE(model, CASE WHEN json_type(attributes, '$.model') = 'VARCHAR' THEN json_extract_string(attributes, '$.model') END) AS model,
    COALESCE(provider, CASE WHEN json_type(attributes, '$.provider') = 'VARCHAR' THEN json_extract_string(attributes, '$.provider') END) AS provider,
    ${previewPayloads.map(([preview]) => preview).join(', ')}`;
  const pageFilter = eventRowsFilter(page);
  const storedRows = await query<LookupRow>(
    `SELECT DISTINCT ${lookupColumns} FROM span_events WHERE ${pageFilter.sql}`,
    pageFilter.values,
  );
  // DuckDB reads every column a query names, even inside a CASE that discards it, so payloads get
  // their own query.
  const withoutPreview = new Set(
    storedRows
      .filter(row => previewPayloads.some(([preview]) => needsPreview(row[preview])))
      .map(row => coreStorage.spanQueryIdentityKey(row)),
  );
  const rowsWithoutPreview = page.filter(row => withoutPreview.has(coreStorage.spanQueryIdentityKey(row)));
  let previewRows = storedRows;
  if (rowsWithoutPreview.length) {
    const payloadFilter = eventRowsFilter(rowsWithoutPreview);
    const payloadRows = await query<LookupRow>(
      `SELECT DISTINCT ${lookupColumns}, ${previewPayloads.map(([preview, payload]) => `CAST(${payload} AS VARCHAR) AS ${preview}Payload`).join(', ')}
      FROM span_events WHERE ${payloadFilter.sql}`,
      payloadFilter.values,
    );
    previewRows = [
      ...storedRows.filter(row => !withoutPreview.has(coreStorage.spanQueryIdentityKey(row))),
      ...payloadRows,
    ];
  }
  const payloads: SpanQueryPayload[] = previewRows.map(row => {
    const payload: SpanQueryPayload = {
      organizationId: row.organizationId,
      resourceId: row.resourceId,
      traceId: row.traceId,
      spanId: row.spanId,
      inputPreview: null,
      outputPreview: null,
      errorPreview: null,
    };
    for (const [preview] of previewPayloads) {
      const stored = row[preview];
      payload[preview] = readPreview(stored, (row as Record<string, unknown>)[`${preview}Payload`], true);
    }
    return payload;
  });
  const metadata = new Map(previewRows.map(row => [coreStorage.spanQueryIdentityKey(row), row]));
  const hydrated = selected.map(row => ({
    ...row,
    model: metadata.get(coreStorage.spanQueryIdentityKey(row))?.model ?? null,
    provider: metadata.get(coreStorage.spanQueryIdentityKey(row))?.provider ?? null,
    ...(spanQueryOutcomeFieldsSupported && {
      stopReasonContext: (parseJson(metadata.get(coreStorage.spanQueryIdentityKey(row))?.stopReasonContext) ??
        null) as Record<string, unknown> | null,
    }),
  }));
  // Preserve costs only for older core contracts that still return them.
  let metrics: SpanQueryCostMetric[] = [];
  if (!coreStorage.SPAN_QUERY_FIELD_REGISTRY) {
    const metricValues: unknown[] = [];
    const metricWhere = keys(page, metricValues);
    metrics = await query<SpanQueryCostMetric>(
      `SELECT ${identities}, name, estimatedCost, costUnit,
      json_extract_string(costMetadata, '$.allocation') AS allocation,
      COALESCE(json_exists(costMetadata, '$.error'), false) AS costError
      FROM metric_events WHERE (${metricWhere}) AND name LIKE 'mastra_model_%'
      LIMIT ${coreStorage.SPAN_QUERY_MAX_COST_METRICS + 1}`,
      metricValues,
    );
    if (metrics.length > coreStorage.SPAN_QUERY_MAX_COST_METRICS) throw new coreStorage.TraceQueryResourceLimitError();
  }
  return buildSpanQueryResponse(plan, hydrated, payloads, metrics);
}
