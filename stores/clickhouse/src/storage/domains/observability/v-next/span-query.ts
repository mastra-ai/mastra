import { TupleParam } from '@clickhouse/client';
import type { ClickHouseClient } from '@clickhouse/client';
import * as coreStorage from '@mastra/core/storage';
import type {
  SpanQueryCostMetric,
  SpanQueryIdentity,
  SpanQueryPayload,
  SpanQuerySelectedRow,
  TrustedSpanQueryPlan,
  TrustedTraceQueryScalarPredicate,
} from '@mastra/core/storage';
import { TABLE_METRIC_EVENTS, TABLE_SPAN_EVENTS } from './ddl';
import { compileSpanQueryPredicate, runWithClickHouseTraceQueryTimeout } from './trace-query';

const identityFields = ['organizationId', 'resourceId', 'traceId', 'spanId'] as const;
const identities = identityFields.join(', ');
// Preserve NULL versus empty scope IDs when matching candidate identities.
const identitySetColumns =
  "isNull(organizationId), ifNull(organizationId, ''), isNull(resourceId), ifNull(resourceId, ''), traceId, spanId";
const identitySetKey = `tuple(${identitySetColumns})`;
const displayFields = [
  'parentSpanId',
  'name',
  'spanType',
  'entityType',
  'entityId',
  'entityName',
  'startedAt',
  'endedAt',
  'model',
  'provider',
  'durationMs',
  'status',
];

class Parameters {
  values: Record<string, string | number> = {};
  add(value: string | number, timestamp = false) {
    const name = `span_${Object.keys(this.values).length}`;
    this.values[name] = timestamp ? new Date(value).toISOString().replace('T', ' ').replace(/Z$/, '') : value;
    return `{${name}:${timestamp ? "DateTime64(3, 'UTC')" : typeof value === 'number' ? 'UInt64' : 'String'}}`;
  }
}

function identityValues(row: SpanQueryIdentity): Array<string | number> {
  return [
    row.organizationId === null ? 1 : 0,
    row.organizationId ?? '',
    row.resourceId === null ? 1 : 0,
    row.resourceId ?? '',
    row.traceId,
    row.spanId,
  ];
}

function afterCursor(plan: TrustedSpanQueryPlan, parameters: Parameters): string {
  if (!plan.cursor) return '1';
  const cursor = plan.cursor;
  const timestamp = parameters.add(cursor.sortValue, true);
  const field = `s.${plan.orderBy.field}`;
  const terms = [`${field} ${plan.orderBy.direction === 'asc' ? '>' : '<'} ${timestamp}`];
  const equal = [`${field} = ${timestamp}`];
  for (const key of identityFields) {
    const value = cursor[key];
    if (value === null) equal.push(`isNull(s.${key})`);
    else {
      const parameter = parameters.add(value);
      terms.push(`(${equal.join(' AND ')} AND (s.${key} > ${parameter} OR isNull(s.${key})))`);
      equal.push(`s.${key} = ${parameter}`);
    }
  }
  return `(${terms.join(' OR ')})`;
}

function predicateFields(
  predicate: TrustedTraceQueryScalarPredicate | undefined,
  fields = new Set<string>(),
): Set<string> {
  if (!predicate) return fields;
  if (predicate.type === 'boolean') for (const arg of predicate.args) predicateFields(arg, fields);
  else if (predicate.type === 'not') predicateFields(predicate.arg, fields);
  else fields.add(predicate.field);
  return fields;
}

function fieldExpression(field: string): string {
  if (field === 'model' || field === 'provider')
    return `if(JSONType(e.attributes, '${field}') = 'String', JSONExtractString(e.attributes, '${field}'), NULL)`;
  if (field === 'durationMs') return "dateDiff('millisecond', e.startedAt, e.endedAt)";
  if (field === 'status') return "if(isNull(e.error), 'success', 'error')";
  if (field === 'error') return "if(isNull(e.error), NULL, 'error')";
  return `e.${field}`;
}

export function compileClickHouseSpanQuery(plan: TrustedSpanQueryPlan) {
  const parameters = new Parameters();
  const from = parameters.add(plan.timeRange.from, true);
  const to = parameters.add(plan.timeRange.to, true);
  const scope: string[] = [];
  if (plan.scope) {
    scope.push(`organizationId = ${parameters.add(plan.scope.organizationId)}`);
    if (plan.scope.resourceId !== undefined) scope.push(`resourceId = ${parameters.add(plan.scope.resourceId)}`);
  }
  const predicate = plan.where ? compileSpanQueryPredicate(plan.where) : { sql: '1', params: {} };
  const selectionFields = [...new Set(['startedAt', 'endedAt', ...predicateFields(plan.where)])].filter(
    field => !new Set<string>(identityFields).has(field),
  );
  const expressions = selectionFields.map(fieldExpression);
  // Completed insert-only records: latest endedAt wins. Equal-version retries must be identical.
  // Read only filter/sort fields before pagination; mutable predicates follow current-record selection.
  const after = afterCursor(plan, parameters);
  const query = `WITH candidate_ids AS (
    SELECT ${identitySetKey} AS identity FROM ${TABLE_SPAN_EVENTS}
    PREWHERE endedAt >= ${from}
    WHERE startedAt >= ${from} AND startedAt < ${to} ${scope.length ? `AND ${scope.join(' AND ')}` : ''}
  ), candidates AS (
    SELECT ${identities}, ${selectionFields.map((field, index) => `${expressions[index]} AS ${field}`).join(', ')}
    FROM ${TABLE_SPAN_EVENTS} e
    PREWHERE e.endedAt >= ${from}
    WHERE ${identitySetKey} IN (SELECT identity FROM candidate_ids) ${scope.length ? `AND ${scope.join(' AND ')}` : ''}
    ORDER BY ${identities}, e.endedAt DESC
    LIMIT 1 BY ${identities}
  )
  SELECT ${[...identityFields, 'startedAt', 'endedAt'].map(field => `s.${field}`).join(', ')}
  FROM candidates s WHERE s.startedAt >= ${from} AND s.startedAt < ${to} AND (${predicate.sql}) AND ${after}
  ORDER BY s.${plan.orderBy.field} ${plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC'}, ${identityFields.map(field => `s.${field} ASC NULLS LAST`).join(', ')}
  LIMIT ${parameters.add(plan.limit + 1)}`;
  return { query, query_params: { ...parameters.values, ...predicate.params } };
}

function iso(value: string): string {
  return new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`).toISOString();
}

export async function querySpans(client: ClickHouseClient, plan: TrustedSpanQueryPlan, timeoutMs: number) {
  const deadline = performance.now() + coreStorage.resolveTraceQueryTimeoutMs(timeoutMs);
  const run = async <T>(compiled: { query: string; query_params: Record<string, unknown> }) => {
    const remaining = Math.floor(deadline - performance.now());
    if (remaining <= 0) throw new coreStorage.TraceQueryExecutionError();
    return (await runWithClickHouseTraceQueryTimeout(
      client,
      { timeoutMs: remaining, memoryLimitBytes: 512 * 1024 * 1024 },
      compiled,
    )) as T[];
  };
  const rows = await run<SpanQueryIdentity & { startedAt: string; endedAt: string }>(compileClickHouseSpanQuery(plan));
  const selected = rows.map(row => ({
    ...row,
    startedAt: iso(row.startedAt),
    endedAt: iso(row.endedAt),
  }));
  const page = selected.slice(0, plan.limit);
  if (!page.length) return { spans: [], page: { next: null } };
  // One typed array parameter avoids ClickHouse's HTTP form-field limit at large page sizes.
  const payloadWhere = `tuple(${identitySetColumns}, endedAt) IN {page:Array(Tuple(UInt8, String, UInt8, String, String, String, DateTime64(3, 'UTC')))}`;
  const payloads = await run<SpanQuerySelectedRow & SpanQueryPayload>({
    query: `SELECT ${identities}, ${displayFields.map((field, index) => `data.${index + 1} AS ${field}`).join(', ')},
      data.${displayFields.length + 1} AS inputPreview, data.${displayFields.length + 2} AS outputPreview
    FROM (SELECT ${identities}, any(tuple(${displayFields.map(fieldExpression).join(', ')}, substringUTF8(input, 1, ${coreStorage.SPAN_QUERY_MAX_PREVIEW_CHARACTERS + 1}), substringUTF8(output, 1, ${coreStorage.SPAN_QUERY_MAX_PREVIEW_CHARACTERS + 1}))) AS data
      FROM ${TABLE_SPAN_EVENTS} e WHERE ${payloadWhere} GROUP BY ${identities})`,
    query_params: {
      page: page.map(row => new TupleParam([...identityValues(row), row.endedAt.replace('T', ' ').replace(/Z$/, '')])),
    },
  });
  // Metrics can be emitted after the span search window; hydrate costs by selected identity, not that time range.
  const metricWhere = `${identitySetKey} IN {page:Array(Tuple(UInt8, String, UInt8, String, String, String))}`;
  const metrics = await run<SpanQueryCostMetric>({
    query: `SELECT ${identities}, data.1 AS name, data.2 AS estimatedCost,
      data.3 AS costUnit, data.4 AS allocation, data.5 AS costError
    FROM (SELECT ${identities}, metricId, argMax(tuple(name, estimatedCost, costUnit,
        JSONExtractString(costMetadata, 'allocation'), JSONHas(costMetadata, 'error')), timestamp) AS data
      FROM ${TABLE_METRIC_EVENTS} WHERE (${metricWhere}) AND name LIKE 'mastra_model_%'
      GROUP BY ${identities}, metricId)
    LIMIT ${coreStorage.SPAN_QUERY_MAX_COST_METRICS + 1}`,
    query_params: { page: page.map(row => new TupleParam(identityValues(row))) },
  });
  if (metrics.length > coreStorage.SPAN_QUERY_MAX_COST_METRICS) throw new coreStorage.TraceQueryResourceLimitError();
  const byIdentity = new Map(payloads.map(row => [coreStorage.spanQueryIdentityKey(row), row]));
  const hydrated = page.flatMap(identity => {
    const row = byIdentity.get(coreStorage.spanQueryIdentityKey(identity));
    if (!row) return []; // The selected record can be deleted between reads.
    const { inputPreview: _input, outputPreview: _output, ...metadata } = row;
    return [{ ...metadata, ...identity, durationMs: Number(row.durationMs) }];
  });
  const result = coreStorage.buildSpanQueryResponse(plan, hydrated, payloads, metrics);
  const last = page.at(-1)!;
  // Cursor follows the selected page even if a concurrent deletion removed a hydrated row.
  result.page.next =
    selected.length > plan.limit
      ? coreStorage.encodeSpanQueryCursor(plan, {
          organizationId: last.organizationId,
          resourceId: last.resourceId,
          traceId: last.traceId,
          spanId: last.spanId,
          sortValue: last[plan.orderBy.field],
        })
      : null;
  return result;
}
