import type { ClickHouseClient } from '@clickhouse/client';
import * as coreStorage from '@mastra/core/storage';
import type {
  TraceQueryCanonicalField,
  TraceQueryField,
  TraceQueryResponse,
  TraceQueryScoreField,
  TraceQuerySpanField,
  TrustedTraceQueryPlan,
  TrustedTraceQueryPredicate,
  TrustedTraceQueryScalarPredicate,
} from '@mastra/core/storage';

import { TABLE_SCORE_EVENTS, TABLE_SPAN_EVENTS, TABLE_TRACE_ROOTS } from './ddl';
import { CH_SETTINGS } from './helpers';

type ClickHouseParameterType = 'String' | 'Float64' | 'UInt64' | "DateTime64(3, 'UTC')";
type FieldDefinition = { sql: string; parameterType: ClickHouseParameterType };
type FieldRegistry<TField extends string> = Record<TField, FieldDefinition>;
type QueryParams = Record<string, string | number>;
type SqlFragment = { sql: string; params: QueryParams };

const TRACE_STATUS_SQL = `if(isNotNull(r.error), 'error', 'success')`;

const TRACE_FIELDS = {
  traceId: { sql: 'r.traceId', parameterType: 'String' },
  threadId: { sql: 'r.threadId', parameterType: 'String' },
  resourceId: { sql: 'r.resourceId', parameterType: 'String' },
  startedAt: { sql: 'r.startedAt', parameterType: "DateTime64(3, 'UTC')" },
  endedAt: { sql: 'r.endedAt', parameterType: "DateTime64(3, 'UTC')" },
  entityName: { sql: 'r.entityName', parameterType: 'String' },
  entityType: { sql: 'r.entityType', parameterType: 'String' },
  environment: { sql: 'r.environment', parameterType: 'String' },
  status: { sql: TRACE_STATUS_SQL, parameterType: 'String' },
} satisfies FieldRegistry<TraceQueryField>;

const SPAN_FIELDS = {
  spanType: { sql: 's.spanType', parameterType: 'String' },
  error: { sql: 's.error', parameterType: 'String' },
} satisfies FieldRegistry<TraceQuerySpanField>;

const SCORE_FIELDS = {
  scorerId: { sql: 's.scorerId', parameterType: 'String' },
  score: { sql: 's.score', parameterType: 'Float64' },
} satisfies FieldRegistry<TraceQueryScoreField>;

const TRACE_SELECT = `
  r.traceId AS traceId,
  r.spanId AS rootSpanId,
  r.threadId AS threadId,
  r.resourceId AS resourceId,
  r.startedAt AS startedAt,
  r.endedAt AS endedAt,
  r.entityName AS entityName,
  r.entityType AS entityType,
  r.environment AS environment,
  ${TRACE_STATUS_SQL} AS status`;

class ParameterBuilder {
  readonly params: QueryParams = {};
  #next = 1;

  add(value: string | number, type: ClickHouseParameterType): string {
    const name = `trace_query_${this.#next++}`;
    this.params[name] =
      type === "DateTime64(3, 'UTC')" ? new Date(value).toISOString().replace('T', ' ').replace(/Z$/, '') : value;
    return `{${name}:${type}}`;
  }
}

function fieldDefinition<TField extends string>(
  registry: Partial<FieldRegistry<TField>>,
  field: TraceQueryCanonicalField,
): FieldDefinition {
  const definition = registry[field as TField];
  if (definition === undefined) throw new Error(`Unsupported trusted trace-query field: ${field}`);
  return definition;
}

function resolveOrderField(field: string): 'startedAt' | 'endedAt' {
  if (field === 'startedAt' || field === 'endedAt') return field;
  throw new Error(`Unsupported trusted trace-query field: ${field}`);
}

function compileScalarPredicate<TField extends string>(
  predicate: TrustedTraceQueryScalarPredicate,
  registry: Partial<FieldRegistry<TField>>,
  parameters: ParameterBuilder,
): string {
  if (predicate.type === 'boolean') {
    const parts = predicate.args.map(arg => `(${compileScalarPredicate(arg, registry, parameters)})`);
    return parts.join(predicate.operator === 'and' ? ' AND ' : ' OR ');
  }

  if (predicate.type === 'not') return `NOT (${compileScalarPredicate(predicate.arg, registry, parameters)})`;

  const field = fieldDefinition(registry, predicate.field);
  if (predicate.type === 'presence') {
    return `${predicate.operator === 'exists' ? 'isNotNull' : 'isNull'}(${field.sql})`;
  }

  if (predicate.type === 'membership') {
    const values = predicate.values.map(value => parameters.add(value, field.parameterType)).join(', ');
    const expression = `${field.sql} ${predicate.operator === 'in' ? 'IN' : 'NOT IN'} (${values})`;
    return `ifNull(${expression}, ${predicate.operator === 'in' ? '0' : '1'})`;
  }

  const parameter = parameters.add(predicate.value, field.parameterType);
  const operators = { eq: '=', ne: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=' } as const;
  const operator = operators[predicate.operator];
  if (operator === undefined) throw new Error(`Unsupported trusted trace-query operator: ${predicate.operator}`);
  return `ifNull(${field.sql} ${operator} ${parameter}, ${predicate.operator === 'ne' ? '1' : '0'})`;
}

function collectRelationCollections(
  predicate: TrustedTraceQueryPredicate | undefined,
  collections = new Set<'spans' | 'scores'>(),
): Set<'spans' | 'scores'> {
  if (!predicate) return collections;
  if (predicate.type === 'relation') {
    collections.add(predicate.collection);
  } else if (predicate.type === 'boolean') {
    for (const arg of predicate.args) collectRelationCollections(arg, collections);
  } else if (predicate.type === 'not') {
    collectRelationCollections(predicate.arg, collections);
  }
  return collections;
}

function compilePredicate(predicate: TrustedTraceQueryPredicate, parameters: ParameterBuilder): string {
  if (predicate.type === 'relation') {
    const registry = predicate.collection === 'spans' ? SPAN_FIELDS : SCORE_FIELDS;
    const table = predicate.collection === 'spans' ? 'current_spans' : 'current_scores';
    const nested = compileScalarPredicate(predicate.predicate, registry, parameters);
    const existence = `EXISTS (
      SELECT 1 FROM ${table} s
      WHERE s.traceId = r.traceId
        AND (${nested})
    )`;
    return predicate.quantifier === 'some' ? existence : `NOT ${existence}`;
  }

  if (predicate.type === 'boolean') {
    const parts = predicate.args.map(arg => `(${compilePredicate(arg, parameters)})`);
    return parts.join(predicate.operator === 'and' ? ' AND ' : ' OR ');
  }

  if (predicate.type === 'not') return `NOT (${compilePredicate(predicate.arg, parameters)})`;
  return compileScalarPredicate(predicate, TRACE_FIELDS, parameters);
}

export interface CompiledClickHouseTraceQuery {
  query: string;
  query_params: QueryParams;
}

export function compileClickHouseTraceQuery(plan: TrustedTraceQueryPlan): CompiledClickHouseTraceQuery {
  const parameters = new ParameterBuilder();
  const from = parameters.add(plan.timeRange.from, "DateTime64(3, 'UTC')");
  const to = parameters.add(plan.timeRange.to, "DateTime64(3, 'UTC')");
  const relationCollections = collectRelationCollections(plan.where);
  const ctes = [
    `current_roots AS (
    SELECT * FROM (
      SELECT *
      FROM ${TABLE_TRACE_ROOTS}
      ORDER BY dedupeKey
      LIMIT 1 BY dedupeKey
    )
    ORDER BY traceId, dedupeKey
    LIMIT 1 BY traceId
  )`,
    `root_scope AS (
    SELECT *
    FROM current_roots
    WHERE startedAt >= ${from}
      AND startedAt < ${to}
  )`,
  ];

  if (relationCollections.has('spans')) {
    ctes.push(`current_spans AS (
    SELECT traceId, spanType, error
    FROM ${TABLE_SPAN_EVENTS}
    WHERE traceId IN (SELECT traceId FROM root_scope)
    ORDER BY dedupeKey
    LIMIT 1 BY dedupeKey
  )`);
  }
  if (relationCollections.has('scores')) {
    ctes.push(`current_scores AS (
    SELECT traceId, scorerId, score
    FROM ${TABLE_SCORE_EVENTS}
    WHERE isNotNull(traceId)
      AND traceId IN (SELECT traceId FROM root_scope)
  )`);
  }

  const predicate = plan.where ? compilePredicate(plan.where, parameters) : '1';
  ctes.push(`candidates AS (
    SELECT ${TRACE_SELECT}
    FROM root_scope r
    WHERE ${predicate}
  )`);
  const candidates = `WITH ${ctes.join(',\n')}`;

  if (plan.result === 'groups') {
    const pageCondition = plan.cursor ? `AND threadId > ${parameters.add(plan.cursor.threadId, 'String')}` : '';
    const limit = parameters.add(plan.limit + 1, 'UInt64');
    return {
      query: `${candidates}
SELECT threadId
FROM candidates
WHERE isNotNull(threadId) ${pageCondition}
GROUP BY threadId
ORDER BY threadId ASC
LIMIT ${limit}`,
      query_params: parameters.params,
    };
  }

  const orderField = resolveOrderField(plan.orderBy.field);
  const direction = plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC';
  let pageCondition = '';
  if (plan.cursor) {
    const comparison = plan.orderBy.direction === 'asc' ? '>' : '<';
    const sortValue = parameters.add(plan.cursor.sortValue, "DateTime64(3, 'UTC')");
    const traceId = parameters.add(plan.cursor.traceId, 'String');
    pageCondition = `WHERE (${orderField} ${comparison} ${sortValue} OR (${orderField} = ${sortValue} AND traceId > ${traceId}))`;
  }
  const limit = parameters.add(plan.limit + 1, 'UInt64');
  return {
    query: `${candidates}
SELECT *
FROM candidates
${pageCondition}
ORDER BY ${orderField} ${direction}, traceId ASC
LIMIT ${limit}`,
    query_params: parameters.params,
  };
}

function asIsoTimestamp(value: unknown): string {
  return new Date(value as string | number | Date).toISOString();
}

function isClickHouseExecutionTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; type?: unknown };
  return String(candidate.code ?? '') === '159' || candidate.type === 'TIMEOUT_EXCEEDED';
}

export async function runWithClickHouseTraceQueryTimeout(
  client: ClickHouseClient,
  timeoutMs: number,
  compiled: CompiledClickHouseTraceQuery,
  queryId?: string,
): Promise<Record<string, unknown>[]> {
  const resolvedTimeoutMs = coreStorage.resolveTraceQueryTimeoutMs(timeoutMs);
  try {
    const result = await client.query({
      query: compiled.query,
      query_params: compiled.query_params,
      query_id: queryId,
      format: 'JSONEachRow',
      clickhouse_settings: { ...CH_SETTINGS, max_execution_time: resolvedTimeoutMs / 1000 },
    });
    return (await result.json()) as Record<string, unknown>[];
  } catch (error) {
    if (isClickHouseExecutionTimeout(error)) throw new coreStorage.TraceQueryExecutionError();
    throw error;
  }
}

export async function queryTraces(
  client: ClickHouseClient,
  plan: TrustedTraceQueryPlan,
  timeoutMs: number,
): Promise<TraceQueryResponse> {
  const rows = await runWithClickHouseTraceQueryTimeout(client, timeoutMs, compileClickHouseTraceQuery(plan));
  const visibleRows = rows.slice(0, plan.limit);

  if (plan.result === 'groups') {
    const groups = visibleRows.map(row => ({ threadId: String(row.threadId) }));
    const last = groups.at(-1);
    return coreStorage.traceQueryResponseSchema.parse({
      groups,
      page: {
        next:
          rows.length > plan.limit && last
            ? coreStorage.encodeTraceQueryCursor(plan, { result: 'groups', threadId: last.threadId })
            : null,
      },
    });
  }

  const traces = visibleRows.map(row => ({
    traceId: String(row.traceId),
    rootSpanId: String(row.rootSpanId),
    threadId: row.threadId == null ? null : String(row.threadId),
    resourceId: row.resourceId == null ? null : String(row.resourceId),
    startedAt: asIsoTimestamp(row.startedAt),
    endedAt: asIsoTimestamp(row.endedAt),
    entityName: row.entityName == null ? null : String(row.entityName),
    entityType: row.entityType == null ? null : String(row.entityType),
    environment: row.environment == null ? null : String(row.environment),
    status: row.status,
  }));
  const last = traces.at(-1);
  return coreStorage.traceQueryResponseSchema.parse({
    traces,
    page: {
      next:
        rows.length > plan.limit && last
          ? coreStorage.encodeTraceQueryCursor(plan, {
              result: 'traces',
              sortValue: last[plan.orderBy.field],
              traceId: last.traceId,
            })
          : null,
    },
  });
}
