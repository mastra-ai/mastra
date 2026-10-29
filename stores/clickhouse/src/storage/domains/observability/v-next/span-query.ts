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
import { BRANCH_SPAN_TYPE_VALUES, TABLE_METRIC_EVENTS, TABLE_SPAN_EVENTS, TABLE_TRACE_BRANCHES } from './ddl';
import { buildSpanQueryResponse } from './preview-compat';
import { needsPreviewPayloads, PREVIEW_COLUMNS, resolveStoredPreviews } from './previews';
import {
  compileSpanQueryPredicate,
  runWithClickHouseTraceQueryTimeout,
  timeToFirstChunkSupported,
  timeToFirstTokenSupported,
} from './trace-query';
import type { ClickHouseParameterType, ParameterBuilder } from './trace-query';

const identityFields = ['organizationId', 'resourceId', 'traceId', 'spanId'] as const;
const identities = identityFields.join(', ');
// Preserve NULL versus empty scope IDs when hydrating page identities.
const identitySetColumns =
  "isNull(organizationId), ifNull(organizationId, ''), isNull(resourceId), ifNull(resourceId, ''), traceId, spanId";
const displayFields = [
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
  'startedAt',
  'endedAt',
  'model',
  'provider',
  'durationMs',
  'timeToFirstChunkMs',
  'timeToFirstTokenMs',
  'status',
];

class Parameters {
  values: Record<string, string | number> = {};
  add(value: string | number, type: ClickHouseParameterType = typeof value === 'number' ? 'UInt64' : 'String') {
    const name = `span_${Object.keys(this.values).length}`;
    this.values[name] =
      type === "DateTime64(3, 'UTC')" ? new Date(value).toISOString().replace('T', ' ').replace(/Z$/, '') : value;
    return `{${name}:${type}}`;
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
  const field = `s.${plan.orderBy.field}`;
  const terms: string[] = [];
  const equal: string[] = [];
  // Empty values sort last in both directions: they follow every value, and after an empty value
  // only empty values remain.
  if (cursor.sortValue === null) equal.push(`isNull(${field})`);
  else {
    const numeric = plan.orderBy.field === 'timeToFirstChunkMs' || plan.orderBy.field === 'timeToFirstTokenMs';
    const value = parameters.add(cursor.sortValue, numeric ? 'Float64' : "DateTime64(3, 'UTC')");
    terms.push(`${field} ${plan.orderBy.direction === 'asc' ? '>' : '<'} ${value}`);
    if (numeric) terms.push(`isNull(${field})`);
    equal.push(`${field} = ${value}`);
  }
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
  const from = parameters.add(plan.timeRange.from, "DateTime64(3, 'UTC')");
  const to = parameters.add(plan.timeRange.to, "DateTime64(3, 'UTC')");
  const scope: string[] = [];
  if (plan.scope) {
    scope.push(`organizationId = ${parameters.add(plan.scope.organizationId)}`);
    if (plan.scope.resourceId !== undefined) scope.push(`resourceId = ${parameters.add(plan.scope.resourceId)}`);
  }
  const predicate = plan.where ? compileSpanQueryPredicate(plan.where) : { sql: '1', params: {} };
  const selectionFields = [
    ...new Set(['startedAt', 'endedAt', plan.orderBy.field, ...predicateFields(plan.where)]),
  ].filter(field => !new Set<string>(identityFields).has(field));
  const expressions = selectionFields.map(fieldExpression);
  // Completed insert-only records: latest endedAt wins. Equal-version retries must be identical.
  // Copies of a span share startedAt, so the time range can be applied before selecting the latest copy.
  // Read only filter/sort fields before pagination; mutable predicates follow current-record selection.
  const after = afterCursor(plan, parameters);
  const query = `WITH candidates AS (
    SELECT ${identities}, ${selectionFields.map((field, index) => `${expressions[index]} AS ${field}`).join(', ')}
    FROM ${TABLE_SPAN_EVENTS} e
    PREWHERE e.endedAt >= ${from}
    WHERE e.startedAt >= ${from} AND e.startedAt < ${to} ${scope.length ? `AND ${scope.join(' AND ')}` : ''}
    ORDER BY ${identities}, e.endedAt DESC
    LIMIT 1 BY ${identities}
  )
  SELECT ${[...new Set([...identityFields, 'startedAt', 'endedAt', plan.orderBy.field])].map(field => `s.${field}`).join(', ')}
  FROM candidates s WHERE s.startedAt >= ${from} AND s.startedAt < ${to} AND (${predicate.sql}) AND ${after}
  ORDER BY s.${plan.orderBy.field} ${plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, ${identityFields.map(field => `s.${field} ASC NULLS LAST`).join(', ')}
  LIMIT ${parameters.add(plan.limit + 1)}`;
  return { query, query_params: { ...parameters.values, ...predicate.params } };
}

const branchSpanTypes = new Set<string>(BRANCH_SPAN_TYPE_VALUES);

const sameColumn = (field: string) => [field] as const;
/**
 * Span fields `trace_branches` can serve, as the `trace_branches` columns each one reads. The two
 * tables are expected to diverge, so this list is explicit: a selection whose fields are not all
 * listed reads `span_events`. A new span-query field has to be classified here deliberately, and a
 * missing column then costs speed, not correctness.
 */
export const TRACE_BRANCHES_SPAN_FIELD_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  ...Object.fromEntries(
    [
      'organizationId',
      'resourceId',
      'traceId',
      'spanId',
      'parentSpanId',
      'name',
      'spanType',
      'startedAt',
      'endedAt',
      'timeToFirstChunkMs',
      'timeToFirstTokenMs',
      'threadId',
      'runId',
      'sessionId',
      'userId',
      'requestId',
      'serviceName',
      'experimentId',
      'environment',
      'executionSource',
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
    ].map(field => [field, sameColumn(field)]),
  ),
  status: ['error'],
  error: ['error'],
  durationMs: ['startedAt', 'endedAt'],
};

/**
 * Whether a span selection reads `trace_branches`: `where` must restrict `spanType` to branch
 * types, and `trace_branches` must serve every selected field (`served`, for tests).
 */
export function readsTraceBranches(
  where: TrustedTraceQueryScalarPredicate | undefined,
  fields: Iterable<string>,
  served: Readonly<Record<string, readonly string[]>> = TRACE_BRANCHES_SPAN_FIELD_COLUMNS,
): boolean {
  const branchOnly = positiveSpanConjuncts(where).some(
    ({ field, values }) =>
      field === 'spanType' && values.length > 0 && values.every(value => branchSpanTypes.has(String(value))),
  );
  return branchOnly && [...fields].every(field => Object.hasOwn(served, field));
}

/**
 * Top-level `spanType` / `name` equality or `in` conditions. Every span the predicate can match
 * satisfies them, and copies of a span never differ in either field, so they can be applied
 * before collapsing copies.
 */
function positiveSpanConjuncts(where: TrustedTraceQueryScalarPredicate | undefined) {
  const conjuncts = where?.type === 'boolean' && where.operator === 'and' ? where.args : where ? [where] : [];
  return conjuncts.flatMap(conjunct => {
    if (conjunct.type !== 'comparison' && conjunct.type !== 'membership') return [];
    if (conjunct.field !== 'spanType' && conjunct.field !== 'name') return [];
    if (conjunct.type === 'comparison' && conjunct.operator === 'eq')
      return [{ field: conjunct.field, values: [conjunct.value] }];
    if (conjunct.type === 'membership' && conjunct.operator === 'in')
      return [{ field: conjunct.field, values: conjunct.values }];
    return [];
  });
}

/**
 * The spans `querySpans()` selects, as CTEs ending in `selected` (alias each row as you like):
 * one row per current completed span with `startedAt` in the window, matching `where`, carrying
 * the identity, `startedAt`, `endedAt`, `status`, and `fields`.
 *
 * Copies of a span collapse to the copy with the latest `endedAt`. When `where` requires branch
 * span types (agent and workflow runs, tool calls, …) and `trace_branches` serves every selected
 * field, the spans are read from `trace_branches`, whose sort key starts with `spanType`, instead of
 * every span in the window. That path can differ from `querySpans()` in two ways:
 * - `trace_branches` is filled only by its materialized view, with no backfill, so an install that
 *   upgraded from @mastra/clickhouse 1.4–1.6 has no branch rows for spans written before then.
 * - It is a `ReplacingMergeTree` without a version column, so once a background merge collapses a
 *   retried span's copies it keeps the last-inserted copy, not the one with the latest `endedAt`.
 *   Counts are unaffected; `status` and duration of an out-of-order retry can differ.
 *
 * Like `querySpans()`, the read has no upper bound on `endedAt` (`PREWHERE endedAt >= from` only,
 * since a span that starts in the window can end any time later), so a historical window reads
 * every span that ended since `from`.
 */
export function compileClickHouseSpanSelection(
  plan: Pick<TrustedSpanQueryPlan, 'timeRange' | 'scope' | 'where'>,
  fields: readonly string[],
  parameters: ParameterBuilder,
): string[] {
  const from = parameters.add(plan.timeRange.from, "DateTime64(3, 'UTC')");
  const to = parameters.add(plan.timeRange.to, "DateTime64(3, 'UTC')");
  const conjuncts = positiveSpanConjuncts(plan.where);
  const prefilter = conjuncts
    .map(({ field, values }) =>
      values.length
        ? `\n      AND e.${field} IN (${values.map(value => parameters.add(String(value), 'String')).join(', ')})`
        : '\n      AND 0',
    )
    .join('');
  const predicate = plan.where ? compileSpanQueryPredicate(plan.where, parameters).sql : '1';
  let tenant = '';
  if (plan.scope) {
    tenant += `\n      AND e.organizationId = ${parameters.add(plan.scope.organizationId, 'String')}`;
    if (plan.scope.resourceId !== undefined)
      tenant += `\n      AND e.resourceId = ${parameters.add(plan.scope.resourceId, 'String')}`;
  }
  const selectionFields = [
    ...new Set(['startedAt', 'endedAt', 'status', ...fields, ...predicateFields(plan.where)]),
  ].filter(field => !new Set<string>(identityFields).has(field));
  const branches = readsTraceBranches(plan.where, selectionFields);
  const scan = `FROM ${branches ? TABLE_TRACE_BRANCHES : TABLE_SPAN_EVENTS} e
    PREWHERE e.endedAt >= ${from}
    WHERE e.startedAt >= ${from} AND e.startedAt < ${to}${tenant}${prefilter}`;
  // Branch rows are few: collapse them with one hash aggregation (X50). Elsewhere keep
  // `querySpans()`'s sort, which X46 measured within budget per project.
  const candidates = branches
    ? `SELECT ${identityFields.map(field => `e.${field} AS ${field}`).join(', ')}, ${selectionFields
        .map(field =>
          field === 'endedAt'
            ? 'max(e.endedAt) AS endedAt'
            : // Tuple-wrapped so a NULL in the latest copy wins (argMax skips NULL arguments).
              `argMax(tuple(${fieldExpression(field)}), e.endedAt).1 AS ${field}`,
        )
        .join(', ')}
    ${scan}
    GROUP BY ${identityFields.map(field => `e.${field}`).join(', ')}`
    : `SELECT ${identities}, ${selectionFields.map(field => `${fieldExpression(field)} AS ${field}`).join(', ')}
    ${scan}
    ORDER BY ${identities}, e.endedAt DESC
    LIMIT 1 BY ${identities}`;
  return [
    `span_candidates AS (
    ${candidates}
  )`,
    `selected AS (
    SELECT * FROM span_candidates s
    WHERE s.startedAt >= ${from} AND s.startedAt < ${to} AND (${predicate})
  )`,
  ];
}

type StoredPreviewRow = Record<(typeof PREVIEW_COLUMNS)[number], string | null>;

// Match Platform's fallback batch size. OSS payloads have no assumed byte limit;
// reduce each batch to previews before reading the next rather than retaining a full page of payloads.
const LEGACY_PAYLOAD_BATCH_ROWS = 32;

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
  const rows = await run<
    SpanQueryIdentity & {
      startedAt: string;
      endedAt: string;
      timeToFirstChunkMs?: number | null;
      timeToFirstTokenMs?: number | null;
    }
  >(compileClickHouseSpanQuery(plan));
  const selected = rows.map(row => ({
    ...row,
    startedAt: iso(row.startedAt),
    endedAt: iso(row.endedAt),
  }));
  const page = selected.slice(0, plan.limit);
  if (!page.length) return { spans: [], page: { next: null } };
  // One typed array parameter avoids ClickHouse's HTTP form-field limit at large page sizes.
  const payloadWhere = `tuple(${identitySetColumns}, endedAt) IN {page:Array(Tuple(UInt8, String, UInt8, String, String, String, DateTime64(3, 'UTC')))}`;
  const pageParameter = (rows: Array<SpanQueryIdentity & { endedAt: string }>) =>
    rows.map(row => new TupleParam([...identityValues(row), row.endedAt.replace('T', ' ').replace(/Z$/, '')]));
  const rowsWithPreviews = await run<SpanQuerySelectedRow & StoredPreviewRow>({
    query: `SELECT ${identities}, ${[...displayFields, ...PREVIEW_COLUMNS].map((field, index) => `data.${index + 1} AS ${field}`).join(', ')}
    FROM (SELECT ${identities}, any(tuple(${[...displayFields.map(fieldExpression), ...PREVIEW_COLUMNS].join(', ')})) AS data
      FROM ${TABLE_SPAN_EVENTS} e WHERE ${payloadWhere} GROUP BY ${identities})`,
    query_params: { page: pageParameter(page) },
  });
  // Rows written before the previews were stored: read the payloads of just those rows.
  const missingKeys = new Set(rowsWithPreviews.filter(needsPreviewPayloads).map(coreStorage.spanQueryIdentityKey));
  const missing = page.filter(row => missingKeys.has(coreStorage.spanQueryIdentityKey(row)));
  const storedByIdentity = new Map(rowsWithPreviews.map(row => [coreStorage.spanQueryIdentityKey(row), row]));
  for (let start = 0; start < missing.length; start += LEGACY_PAYLOAD_BATCH_ROWS) {
    const rows = await run<SpanQueryIdentity & { input: string | null; output: string | null; error: string | null }>({
      query: `SELECT ${identities}, data.1 AS input, data.2 AS output, data.3 AS error
      FROM (SELECT ${identities}, any(tuple(input, output, error)) AS data
        FROM ${TABLE_SPAN_EVENTS} e WHERE ${payloadWhere} GROUP BY ${identities})`,
      query_params: { page: pageParameter(missing.slice(start, start + LEGACY_PAYLOAD_BATCH_ROWS)) },
    });
    for (const row of rows) {
      const stored = storedByIdentity.get(coreStorage.spanQueryIdentityKey(row));
      if (stored) Object.assign(stored, resolveStoredPreviews(stored, row));
    }
  }
  const payloads: Array<SpanQuerySelectedRow & SpanQueryPayload> = rowsWithPreviews.map(row => ({
    ...row,
    ...resolveStoredPreviews(row),
  }));
  const byIdentity = new Map(payloads.map(row => [coreStorage.spanQueryIdentityKey(row), row]));
  const hydrated = page.flatMap(identity => {
    const row = byIdentity.get(coreStorage.spanQueryIdentityKey(identity));
    if (!row) return []; // The selected record can be deleted between reads.
    const {
      inputPreview: _input,
      outputPreview: _output,
      errorPreview: _error,
      timeToFirstChunkMs,
      timeToFirstTokenMs,
      ...metadata
    } = row;
    return [
      {
        ...metadata,
        ...identity,
        durationMs: Number(row.durationMs),
        ...(timeToFirstChunkSupported && {
          timeToFirstChunkMs: timeToFirstChunkMs == null ? null : Number(timeToFirstChunkMs),
        }),
        ...(timeToFirstTokenSupported && {
          timeToFirstTokenMs: timeToFirstTokenMs == null ? null : Number(timeToFirstTokenMs),
        }),
      },
    ];
  });
  // Preserve costs only for older core contracts that still return them.
  let metrics: SpanQueryCostMetric[] = [];
  if (!coreStorage.SPAN_QUERY_FIELD_REGISTRY) {
    const metricWhere = `tuple(${identitySetColumns}) IN {page:Array(Tuple(UInt8, String, UInt8, String, String, String))}`;
    metrics = await run<SpanQueryCostMetric>({
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
  }
  const result = buildSpanQueryResponse(plan, hydrated, payloads, metrics);
  const last = page.at(-1)!;
  // Cursor follows the selected page even if a concurrent deletion removed a hydrated row.
  result.page.next =
    selected.length > plan.limit
      ? coreStorage.encodeSpanQueryCursor(plan, {
          organizationId: last.organizationId,
          resourceId: last.resourceId,
          traceId: last.traceId,
          spanId: last.spanId,
          sortValue: last[plan.orderBy.field] ?? null,
        })
      : null;
  return result;
}
