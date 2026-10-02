import * as coreStorage from '@mastra/core/storage';
import type {
  SpanQueryCostMetric,
  SpanQueryIdentity,
  SpanQueryPayload,
  SpanQuerySelectedRow,
  TrustedSpanQueryPlan,
} from '@mastra/core/storage';
import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_METRIC_EVENTS, TABLE_SPAN_EVENTS } from './ddl';
import { compileSpanQueryPredicate, runWithPostgresTraceQueryTimeout } from './trace-query';

const identityFields = ['organizationId', 'resourceId', 'traceId', 'spanId'] as const;
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
const identities = identityFields.map(field => `"${field}"`).join(', ');
const identityOrder = identityFields.map(field => `"${field}" COLLATE "C" ASC NULLS LAST`).join(', ');

function selectedKeys(rows: SpanQueryIdentity[], values: unknown[]): string {
  return rows
    .map(
      row =>
        `(${identityFields
          .map(field => {
            values.push(row[field]);
            const operator = field === 'traceId' || field === 'spanId' ? '=' : 'IS NOT DISTINCT FROM';
            return `"${field}" ${operator} $${values.length}::text`;
          })
          .join(' AND ')})`,
    )
    .join(' OR ');
}

function afterCursor(plan: TrustedSpanQueryPlan, values: unknown[]): string {
  if (!plan.cursor) return 'TRUE';
  const cursor = plan.cursor;
  values.push(cursor.sortValue);
  const timestamp = `$${values.length}::timestamptz`;
  const field = `s."${plan.orderBy.field}"`;
  const terms = [`${field} ${plan.orderBy.direction === 'asc' ? '>' : '<'} ${timestamp}`];
  const equal = [`${field} = ${timestamp}`];
  for (const key of identityFields) {
    const ref = `s."${key}" COLLATE "C"`;
    const value = cursor[key];
    if (value === null) {
      equal.push(`${ref} IS NULL`);
    } else {
      values.push(value);
      const parameter = `$${values.length}::text COLLATE "C"`;
      terms.push(`(${equal.join(' AND ')} AND (${ref} > ${parameter} OR ${ref} IS NULL))`);
      equal.push(`${ref} = ${parameter}`);
    }
  }
  return `(${terms.join(' OR ')})`;
}

export function compilePostgresSpanQuery(schema: string, plan: TrustedSpanQueryPlan) {
  const values: unknown[] = [plan.timeRange.from, plan.timeRange.to];
  const scope: string[] = [];
  if (plan.scope) {
    values.push(plan.scope.organizationId);
    scope.push(`"organizationId" = $${values.length}`);
    if (plan.scope.resourceId !== undefined) {
      values.push(plan.scope.resourceId);
      scope.push(`"resourceId" = $${values.length}`);
    }
  }
  const predicate = plan.where ? compileSpanQueryPredicate(plan.where, values.length + 1) : { sql: 'TRUE', values: [] };
  values.push(...predicate.values);
  const after = afterCursor(plan, values);
  values.push(plan.limit + 1);
  const table = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  // Completed records win; the greatest end time follows existing getSpan semantics.
  // Payload columns are read only after page selection, inside the same snapshot.
  // A completed span ends at or after it starts, so the end-time bound only prunes partitions.
  const text = `WITH candidate_ids AS MATERIALIZED (
    SELECT DISTINCT ${identities} FROM ${table}
    WHERE "startedAt" >= $1 AND "startedAt" < $2 AND "endedAt" >= $1 AND NOT "isPending"
      ${scope.length ? `AND ${scope.join(' AND ')}` : ''}
  ), current_spans AS MATERIALIZED (
    SELECT DISTINCT ON (${identities})
      ${fields.map(field => `"${field}"`).join(', ')}, "startedAt", "endedAt", "cursorId"::text AS version,
      CASE WHEN jsonb_typeof(attributes -> 'model') = 'string' THEN attributes ->> 'model' END AS model,
      CASE WHEN jsonb_typeof(attributes -> 'provider') = 'string' THEN attributes ->> 'provider' END AS provider,
      (EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) * 1000)::float8 AS "durationMs",
      CASE WHEN error IS NULL THEN 'success' ELSE 'error' END AS status,
      error IS NOT NULL AS "hasError"
    FROM ${table} e
    WHERE NOT "isPending" AND "endedAt" >= $1 AND (
      "organizationId" IS NULL, COALESCE("organizationId", ''), "resourceId" IS NULL, COALESCE("resourceId", ''), "traceId", "spanId"
    ) IN (
      SELECT "organizationId" IS NULL, COALESCE("organizationId", ''), "resourceId" IS NULL, COALESCE("resourceId", ''), "traceId", "spanId" FROM candidate_ids
    ) ${scope.length ? `AND ${scope.join(' AND ')}` : ''}
    ORDER BY ${identities}, "endedAt" DESC, "cursorId" DESC
  ), candidates AS (
    SELECT *, CASE WHEN "hasError" THEN 'error' ELSE NULL END AS error FROM current_spans
  )
  SELECT ${[...identityFields, 'parentSpanId', 'name', 'spanType', 'entityType', 'entityId', 'entityName', 'model', 'provider', 'startedAt', 'endedAt', 'durationMs', 'status', 'version'].map(field => `s."${field}"`).join(', ')}
  FROM candidates s WHERE s."startedAt" >= $1 AND s."startedAt" < $2 AND (${predicate.sql}) AND ${after}
  ORDER BY s."${plan.orderBy.field}" ${plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC'}, ${identityOrder}
  LIMIT $${values.length}`;
  return { text, values };
}

type Selected = Omit<SpanQuerySelectedRow, 'startedAt' | 'endedAt'> & {
  startedAt: Date;
  endedAt: Date;
  version: string;
};

export async function querySpans(client: DbClient, schema: string, plan: TrustedSpanQueryPlan, timeoutMs: number) {
  const deadline = performance.now() + coreStorage.resolveTraceQueryTimeoutMs(timeoutMs);
  return runWithPostgresTraceQueryTimeout(
    client,
    timeoutMs,
    async tx => {
      const query = compilePostgresSpanQuery(schema, plan);
      const rows = await tx.any<Selected>(query.text, query.values);
      const selected = rows.map(({ version: _version, startedAt, endedAt, ...row }) => ({
        ...row,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
      }));
      const page = rows.slice(0, plan.limit);
      if (!page.length) return coreStorage.buildSpanQueryResponse(plan, selected, [], []);
      const remaining = async () => {
        const ms = Math.floor(deadline - performance.now());
        if (ms <= 0) throw new coreStorage.TraceQueryExecutionError();
        await tx.query(`SELECT set_config('statement_timeout', $1, true)`, [`${ms}ms`]);
      };
      await remaining();
      const payloadValues: unknown[] = [];
      const payloadWhere = page
        .map(row => {
          const key = selectedKeys([row], payloadValues);
          payloadValues.push(row.version);
          return `(${key} AND "cursorId" = $${payloadValues.length}::bigint)`;
        })
        .join(' OR ');
      const payloads = await tx.any<SpanQueryPayload>(
        `SELECT ${identities},
      left(input::text, ${coreStorage.SPAN_QUERY_MAX_PREVIEW_CHARACTERS + 1}) AS "inputPreview", left(output::text, ${coreStorage.SPAN_QUERY_MAX_PREVIEW_CHARACTERS + 1}) AS "outputPreview"
      FROM ${qualifiedTable(schema, TABLE_SPAN_EVENTS)} WHERE ${payloadWhere}`,
        payloadValues,
      );
      await remaining();
      const metricValues: unknown[] = [];
      const metricWhere = selectedKeys(page, metricValues);
      const metrics = await tx.any<SpanQueryCostMetric>(
        `SELECT ${identities}, name, "estimatedCost", "costUnit",
      "costMetadata" ->> 'allocation' AS allocation, COALESCE("costMetadata" ? 'error', false) AS "costError"
      FROM (SELECT DISTINCT ON (${identities}, "metricId") ${identities}, name, "estimatedCost", "costUnit", "costMetadata" FROM ${qualifiedTable(schema, TABLE_METRIC_EVENTS)}
        WHERE (${metricWhere}) AND name LIKE 'mastra_model_%'
        ORDER BY ${identities}, "metricId", "cursorId" DESC) m
      LIMIT ${coreStorage.SPAN_QUERY_MAX_COST_METRICS + 1}`,
        metricValues,
      );
      if (metrics.length > coreStorage.SPAN_QUERY_MAX_COST_METRICS)
        throw new coreStorage.TraceQueryResourceLimitError();
      return coreStorage.buildSpanQueryResponse(plan, selected, payloads, metrics);
    },
    { repeatableRead: true },
  );
}
