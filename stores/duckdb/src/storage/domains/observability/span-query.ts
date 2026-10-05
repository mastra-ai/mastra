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
import { payloadColumnSql } from './helpers';
import { compileSpanQueryPredicate } from './trace-query';

const identityFields = ['organizationId', 'resourceId', 'traceId', 'spanId'] as const;
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
  'parentEntityVersionId',
  'rootEntityVersionId',
  'runId',
  'sessionId',
  'userId',
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

function afterCursor(plan: TrustedSpanQueryPlan): { sql: string; values: unknown[] } {
  if (!plan.cursor) return { sql: 'TRUE', values: [] };
  const cursor = plan.cursor;
  const comparisons = [`s.${plan.orderBy.field} ${plan.orderBy.direction === 'asc' ? '>' : '<'} CAST(? AS TIMESTAMP)`];
  const values: unknown[] = [cursor.sortValue];
  for (let i = 0; i < identityFields.length; i++) {
    const field = identityFields[i]!;
    if (cursor[field] === null) continue;
    const equal = [`s.${plan.orderBy.field} = CAST(? AS TIMESTAMP)`];
    values.push(cursor.sortValue);
    for (const prior of identityFields.slice(0, i)) {
      equal.push(`s.${prior} IS NOT DISTINCT FROM ?`);
      values.push(cursor[prior]);
    }
    values.push(cursor[field]);
    comparisons.push(`(${equal.join(' AND ')} AND (s.${field} > ? OR s.${field} IS NULL))`);
  }
  return { sql: `(${comparisons.join(' OR ')})`, values };
}

export function compileDuckDBSpanQuery(plan: TrustedSpanQueryPlan) {
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
  const after = afterCursor(plan);
  values.push(plan.timeRange.from, plan.timeRange.to, ...predicate.values, ...after.values, plan.limit + 1);
  const join = identityFields.map(field => `e.${field} IS NOT DISTINCT FROM c.${field}`).join(' AND ');
  // Start timestamps select identities; all events for those identities participate in reconstruction.
  const sql = `WITH candidates AS MATERIALIZED (
    SELECT ${identities} FROM span_events
    WHERE eventType = 'start' AND timestamp >= CAST(? AS TIMESTAMP) AND timestamp < CAST(? AS TIMESTAMP)
      ${scope.length ? `AND ${scope.join(' AND ')}` : ''}
    GROUP BY ${identities}
  ), ranked AS (
    SELECT ${fields.map(field => `e.${field}`).join(', ')},
      min(e.timestamp) FILTER (WHERE e.eventType = 'start') OVER (PARTITION BY ${identityFields.map(field => `e.${field}`).join(', ')}) AS startedAt, e.endedAt, e.cursorId,
      CASE WHEN json_type(e.attributes, '$.model') = 'VARCHAR' THEN json_extract_string(e.attributes, '$.model') END AS model,
      CASE WHEN json_type(e.attributes, '$.provider') = 'VARCHAR' THEN json_extract_string(e.attributes, '$.provider') END AS provider,
      date_diff('millisecond', min(e.timestamp) FILTER (WHERE e.eventType = 'start') OVER (PARTITION BY ${identityFields.map(field => `e.${field}`).join(', ')}), e.endedAt) AS durationMs,
      CASE WHEN e.error IS NULL THEN 'success' ELSE 'error' END AS status,
      CASE WHEN e.error IS NULL THEN NULL ELSE 'error' END AS error,
      row_number() OVER (PARTITION BY ${identityFields.map(field => `e.${field}`).join(', ')}
        ORDER BY CASE WHEN e.endedAt IS NULL THEN 1 ELSE 0 END, e.cursorId DESC NULLS LAST, e.endedAt DESC) AS rank
    FROM span_events e INNER JOIN candidates c ON ${join}
  )
  SELECT ${[...identityFields, 'parentSpanId', 'name', 'spanType', 'entityType', 'entityId', 'entityName', 'model', 'provider', 'startedAt', 'endedAt', 'durationMs', 'status', 'cursorId'].map(field => `s.${field}`).join(', ')}
  FROM ranked s WHERE rank = 1 AND endedAt IS NOT NULL AND startedAt >= CAST(? AS TIMESTAMP) AND startedAt < CAST(? AS TIMESTAMP) AND (${predicate.sql}) AND ${after.sql}
  ORDER BY s.${plan.orderBy.field} ${plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC'}, ${identityFields.map(field => `s.${field} ASC NULLS LAST`).join(', ')}
  LIMIT ?`;
  return { sql, values };
}

type Selected = Omit<SpanQuerySelectedRow, 'startedAt' | 'endedAt'> & {
  startedAt: Date;
  endedAt: Date;
  cursorId: number | null;
};

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
  const selected = rows.map(({ cursorId: _cursorId, startedAt, endedAt, ...row }) => ({
    ...row,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
  }));
  const page = rows.slice(0, plan.limit);
  if (!page.length) return coreStorage.buildSpanQueryResponse(plan, selected, [], []);
  const payloadValues: unknown[] = [];
  const payloadWhere = page
    .map(row => {
      const key = keys([row], payloadValues);
      payloadValues.push(row.cursorId, row.endedAt);
      return `(${key} AND cursorId IS NOT DISTINCT FROM ? AND endedAt = ?)`;
    })
    .join(' OR ');
  const payloads = await query<SpanQueryPayload>(
    `SELECT DISTINCT ${identities},
    substring(CAST(${payloadColumnSql('input')} AS VARCHAR), 1, ${coreStorage.SPAN_QUERY_MAX_PREVIEW_CHARACTERS + 1}) AS inputPreview, substring(CAST(${payloadColumnSql('output')} AS VARCHAR), 1, ${coreStorage.SPAN_QUERY_MAX_PREVIEW_CHARACTERS + 1}) AS outputPreview
    FROM span_events WHERE ${payloadWhere}`,
    payloadValues,
  );
  const metricValues: unknown[] = [];
  const metricWhere = keys(page, metricValues);
  const metrics = await query<SpanQueryCostMetric>(
    `SELECT ${identities}, name, estimatedCost, costUnit,
    json_extract_string(costMetadata, '$.allocation') AS allocation,
    COALESCE(json_exists(costMetadata, '$.error'), false) AS costError
    FROM metric_events WHERE (${metricWhere}) AND name LIKE 'mastra_model_%'
    LIMIT ${coreStorage.SPAN_QUERY_MAX_COST_METRICS + 1}`,
    metricValues,
  );
  if (metrics.length > coreStorage.SPAN_QUERY_MAX_COST_METRICS) throw new coreStorage.TraceQueryResourceLimitError();
  return coreStorage.buildSpanQueryResponse(plan, selected, payloads, metrics);
}
