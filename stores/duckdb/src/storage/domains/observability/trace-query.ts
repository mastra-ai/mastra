import { encodeTraceQueryCursor, traceQueryResponseSchema } from '@mastra/core/storage';
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

import type { DuckDBConnection } from '../../db/index';

type ParameterType = 'scalar' | 'timestamp';
type FieldDefinition = { sql: string; parameterType: ParameterType };
type FieldRegistry<TField extends string> = Record<TField, FieldDefinition>;
type SqlFragment = { sql: string; values: unknown[] };

const TRACE_STATUS_SQL = `CASE WHEN r.error IS NOT NULL THEN 'error' ELSE 'success' END`;

const TRACE_FIELDS = {
  traceId: { sql: 'r.traceId', parameterType: 'scalar' },
  threadId: { sql: 'r.threadId', parameterType: 'scalar' },
  resourceId: { sql: 'r.resourceId', parameterType: 'scalar' },
  startedAt: { sql: 'r.startedAt', parameterType: 'timestamp' },
  endedAt: { sql: 'r.endedAt', parameterType: 'timestamp' },
  entityName: { sql: 'r.entityName', parameterType: 'scalar' },
  entityType: { sql: 'r.entityType', parameterType: 'scalar' },
  environment: { sql: 'r.environment', parameterType: 'scalar' },
  status: { sql: TRACE_STATUS_SQL, parameterType: 'scalar' },
} satisfies FieldRegistry<TraceQueryField>;

const SPAN_FIELDS = {
  spanType: { sql: 's.spanType', parameterType: 'scalar' },
  error: { sql: 's.error', parameterType: 'scalar' },
} satisfies FieldRegistry<TraceQuerySpanField>;

const SCORE_FIELDS = {
  scorerId: { sql: 's.scorerId', parameterType: 'scalar' },
  score: { sql: 's.score', parameterType: 'scalar' },
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

function fieldDefinition<TField extends string>(
  registry: Partial<FieldRegistry<TField>>,
  field: TraceQueryCanonicalField,
): FieldDefinition {
  const definition = registry[field as TField];
  if (definition === undefined) throw new Error(`Unsupported trusted trace-query field: ${field}`);
  return definition;
}

function parameterSql(type: ParameterType): string {
  return type === 'timestamp' ? 'CAST(? AS TIMESTAMP)' : '?';
}

function compileScalarPredicate<TField extends string>(
  predicate: TrustedTraceQueryScalarPredicate,
  registry: Partial<FieldRegistry<TField>>,
): SqlFragment {
  if (predicate.type === 'boolean') {
    const values: unknown[] = [];
    const parts = predicate.args.map(arg => {
      const compiled = compileScalarPredicate(arg, registry);
      values.push(...compiled.values);
      return `(${compiled.sql})`;
    });
    return { sql: parts.join(predicate.operator === 'and' ? ' AND ' : ' OR '), values };
  }

  if (predicate.type === 'not') {
    const compiled = compileScalarPredicate(predicate.arg, registry);
    return { sql: `NOT (${compiled.sql})`, values: compiled.values };
  }

  const field = fieldDefinition(registry, predicate.field);
  if (predicate.type === 'presence') {
    return {
      sql: `${field.sql} IS ${predicate.operator === 'exists' ? 'NOT ' : ''}NULL`,
      values: [],
    };
  }

  if (predicate.type === 'membership') {
    const list = predicate.values.map(() => parameterSql(field.parameterType)).join(', ');
    if (predicate.operator === 'in') {
      return { sql: `${field.sql} IS NOT NULL AND ${field.sql} IN (${list})`, values: predicate.values };
    }
    return { sql: `${field.sql} IS NULL OR ${field.sql} NOT IN (${list})`, values: predicate.values };
  }

  const parameter = parameterSql(field.parameterType);
  const operators = { lt: '<', lte: '<=', gt: '>', gte: '>=' } as const;
  if (predicate.operator === 'eq') {
    return { sql: `${field.sql} IS NOT DISTINCT FROM ${parameter}`, values: [predicate.value] };
  }
  if (predicate.operator === 'ne') {
    return { sql: `${field.sql} IS DISTINCT FROM ${parameter}`, values: [predicate.value] };
  }
  const operator = operators[predicate.operator];
  if (operator === undefined) throw new Error(`Unsupported trusted trace-query operator: ${predicate.operator}`);
  return {
    sql: `${field.sql} IS NOT NULL AND ${field.sql} ${operator} ${parameter}`,
    values: [predicate.value],
  };
}

function compilePredicate(predicate: TrustedTraceQueryPredicate): SqlFragment {
  if (predicate.type === 'relation') {
    const registry = predicate.collection === 'spans' ? SPAN_FIELDS : SCORE_FIELDS;
    const compiled = compileScalarPredicate(predicate.predicate, registry);
    const table = predicate.collection === 'spans' ? 'current_spans' : 'score_events';
    const existence = `EXISTS (
      SELECT 1 FROM ${table} s
      WHERE s.traceId IS NOT NULL
        AND s.traceId = r.traceId
        AND (${compiled.sql})
    )`;
    return {
      sql: predicate.quantifier === 'some' ? existence : `NOT ${existence}`,
      values: compiled.values,
    };
  }

  if (predicate.type === 'boolean') {
    const values: unknown[] = [];
    const parts = predicate.args.map(arg => {
      const compiled = compilePredicate(arg);
      values.push(...compiled.values);
      return `(${compiled.sql})`;
    });
    return { sql: parts.join(predicate.operator === 'and' ? ' AND ' : ' OR '), values };
  }

  if (predicate.type === 'not') {
    const compiled = compilePredicate(predicate.arg);
    return { sql: `NOT (${compiled.sql})`, values: compiled.values };
  }

  return compileScalarPredicate(predicate, TRACE_FIELDS);
}

export interface CompiledDuckDBTraceQuery {
  sql: string;
  values: unknown[];
}

export function compileDuckDBTraceQuery(plan: TrustedTraceQueryPlan): CompiledDuckDBTraceQuery {
  const values: unknown[] = [plan.timeRange.from, plan.timeRange.to];
  const conditions = [
    `r.endedAt IS NOT NULL`,
    `r.startedAt >= CAST(? AS TIMESTAMP)`,
    `r.startedAt < CAST(? AS TIMESTAMP)`,
  ];

  if (plan.where) {
    const predicate = compilePredicate(plan.where);
    conditions.push(`(${predicate.sql})`);
    values.push(...predicate.values);
  }

  const candidates = `WITH current_spans AS (
    SELECT
      traceId,
      spanId,
      arg_max(parentSpanId, timestamp) AS parentSpanId,
      arg_max(spanType, timestamp) AS spanType,
      arg_max(error, timestamp) FILTER (WHERE error IS NOT NULL) AS error,
      arg_max(threadId, timestamp) FILTER (WHERE threadId IS NOT NULL) AS threadId,
      arg_max(resourceId, timestamp) FILTER (WHERE resourceId IS NOT NULL) AS resourceId,
      min(timestamp) FILTER (WHERE eventType = 'start') AS startedAt,
      arg_max(endedAt, timestamp) FILTER (WHERE endedAt IS NOT NULL) AS endedAt,
      arg_max(entityName, timestamp) FILTER (WHERE entityName IS NOT NULL) AS entityName,
      arg_max(entityType, timestamp) FILTER (WHERE entityType IS NOT NULL) AS entityType,
      arg_max(environment, timestamp) FILTER (WHERE environment IS NOT NULL) AS environment,
      max(cursorId) AS cursorId
    FROM span_events
    GROUP BY traceId, spanId
  ), current_roots AS (
    SELECT * EXCLUDE (rootRank)
    FROM (
      SELECT *, row_number() OVER (PARTITION BY traceId ORDER BY cursorId DESC) AS rootRank
      FROM current_spans
      WHERE parentSpanId IS NULL
    )
    WHERE rootRank = 1
  ), candidates AS (
    SELECT ${TRACE_SELECT}
    FROM current_roots r
    WHERE ${conditions.join('\n      AND ')}
  )`;

  if (plan.result === 'groups') {
    const pageCondition = plan.cursor ? `AND threadId > ?` : '';
    if (plan.cursor) values.push(plan.cursor.threadId);
    values.push(plan.limit + 1);
    return {
      sql: `${candidates}
SELECT threadId
FROM candidates
WHERE threadId IS NOT NULL ${pageCondition}
GROUP BY threadId
ORDER BY threadId ASC
LIMIT ?`,
      values,
    };
  }

  const orderField = plan.orderBy.field;
  const direction = plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC';
  let pageCondition = '';
  if (plan.cursor) {
    const comparison = plan.orderBy.direction === 'asc' ? '>' : '<';
    pageCondition = `WHERE (${orderField} ${comparison} CAST(? AS TIMESTAMP) OR (${orderField} = CAST(? AS TIMESTAMP) AND traceId > ?))`;
    values.push(plan.cursor.sortValue, plan.cursor.sortValue, plan.cursor.traceId);
  }
  values.push(plan.limit + 1);

  return {
    sql: `${candidates}
SELECT *
FROM candidates
${pageCondition}
ORDER BY ${orderField} ${direction}, traceId ASC
LIMIT ?`,
    values,
  };
}

function asIsoTimestamp(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(value as string | number).toISOString();
}

export async function queryTraces(db: DuckDBConnection, plan: TrustedTraceQueryPlan): Promise<TraceQueryResponse> {
  const query = compileDuckDBTraceQuery(plan);
  const rows = await db.query<Record<string, unknown>>(query.sql, query.values);
  const visibleRows = rows.slice(0, plan.limit);

  if (plan.result === 'groups') {
    const groups = visibleRows.map(row => ({ threadId: String(row.threadId) }));
    const last = groups.at(-1);
    return traceQueryResponseSchema.parse({
      groups,
      page: {
        next:
          rows.length > plan.limit && last
            ? encodeTraceQueryCursor(plan, { result: 'groups', threadId: last.threadId })
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
  return traceQueryResponseSchema.parse({
    traces,
    page: {
      next:
        rows.length > plan.limit && last
          ? encodeTraceQueryCursor(plan, {
              result: 'traces',
              sortValue: last[plan.orderBy.field],
              traceId: last.traceId,
            })
          : null,
    },
  });
}
