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

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_SCORE_EVENTS, TABLE_SPAN_EVENTS } from './ddl';

type SqlFragment = { sql: string; values: unknown[] };
type FieldRegistry<TField extends string> = Record<TField, string>;

const TRACE_STATUS_SQL = `CASE WHEN r."error" IS NOT NULL THEN 'error' ELSE 'success' END`;

const TRACE_FIELDS = {
  traceId: 'r."traceId"',
  threadId: 'r."threadId"',
  resourceId: 'r."resourceId"',
  startedAt: 'r."startedAt"',
  endedAt: 'r."endedAt"',
  entityName: 'r."entityName"',
  entityType: 'r."entityType"',
  environment: 'r."environment"',
  status: TRACE_STATUS_SQL,
} satisfies FieldRegistry<TraceQueryField>;

const SPAN_FIELDS = {
  spanType: 's."spanType"',
  error: 's."error"',
} satisfies FieldRegistry<TraceQuerySpanField>;

const SCORE_FIELDS = {
  scorerId: 's."scorerId"',
  score: 's."score"',
} satisfies FieldRegistry<TraceQueryScoreField>;

const TRACE_SELECT = `
  r."traceId" AS "traceId",
  r."spanId" AS "rootSpanId",
  r."threadId" AS "threadId",
  r."resourceId" AS "resourceId",
  r."startedAt" AS "startedAt",
  r."endedAt" AS "endedAt",
  r."entityName" AS "entityName",
  r."entityType" AS "entityType",
  r."environment" AS "environment",
  ${TRACE_STATUS_SQL} AS "status"`;

function fieldSql<TField extends string>(
  registry: Partial<FieldRegistry<TField>>,
  field: TraceQueryCanonicalField,
): string {
  const sql = registry[field as TField];
  if (sql === undefined) throw new Error(`Unsupported trusted trace-query field: ${field}`);
  return sql;
}

function placeholders(values: readonly unknown[], offset: number): string {
  return values.map((_, index) => `$${offset + index}`).join(', ');
}

function compileScalarPredicate<TField extends string>(
  predicate: TrustedTraceQueryScalarPredicate,
  registry: Partial<FieldRegistry<TField>>,
  parameterOffset: number,
): SqlFragment {
  if (predicate.type === 'boolean') {
    const values: unknown[] = [];
    const parts = predicate.args.map(arg => {
      const compiled = compileScalarPredicate(arg, registry, parameterOffset + values.length);
      values.push(...compiled.values);
      return `(${compiled.sql})`;
    });
    return { sql: parts.join(predicate.operator === 'and' ? ' AND ' : ' OR '), values };
  }

  if (predicate.type === 'not') {
    const compiled = compileScalarPredicate(predicate.arg, registry, parameterOffset);
    return { sql: `NOT (${compiled.sql})`, values: compiled.values };
  }

  const field = fieldSql(registry, predicate.field);
  if (predicate.type === 'presence') {
    return {
      sql: `${field} IS ${predicate.operator === 'exists' ? 'NOT ' : ''}NULL`,
      values: [],
    };
  }

  if (predicate.type === 'membership') {
    const list = placeholders(predicate.values, parameterOffset);
    if (predicate.operator === 'in') {
      return { sql: `${field} IS NOT NULL AND ${field} IN (${list})`, values: predicate.values };
    }
    return { sql: `${field} IS NULL OR ${field} NOT IN (${list})`, values: predicate.values };
  }

  const parameter = `$${parameterOffset}`;
  const operators = { lt: '<', lte: '<=', gt: '>', gte: '>=' } as const;
  if (predicate.operator === 'eq') {
    return { sql: `${field} IS NOT DISTINCT FROM ${parameter}`, values: [predicate.value] };
  }
  if (predicate.operator === 'ne') {
    return { sql: `${field} IS DISTINCT FROM ${parameter}`, values: [predicate.value] };
  }
  const operator = operators[predicate.operator];
  if (operator === undefined) throw new Error(`Unsupported trusted trace-query operator: ${predicate.operator}`);
  return { sql: `${field} IS NOT NULL AND ${field} ${operator} ${parameter}`, values: [predicate.value] };
}

function latestRootPredicate(spanTable: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM ${spanTable} newer
    WHERE newer."traceId" = r."traceId"
      AND newer."parentSpanId" IS NULL
      AND newer."cursorId" > r."cursorId"
  )`;
}

function latestSpanPredicate(spanTable: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM ${spanTable} newer
    WHERE newer."traceId" = s."traceId"
      AND newer."spanId" = s."spanId"
      AND (newer."isPending" < s."isPending" OR (newer."isPending" = s."isPending" AND newer."cursorId" > s."cursorId"))
  )`;
}

function latestScorePredicate(scoreTable: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM ${scoreTable} newer
    WHERE newer."scoreId" = s."scoreId"
      AND newer."cursorId" > s."cursorId"
  )`;
}

function compilePredicate(
  predicate: TrustedTraceQueryPredicate,
  spanTable: string,
  scoreTable: string,
  parameterOffset: number,
): SqlFragment {
  if (predicate.type === 'relation') {
    const registry = predicate.collection === 'spans' ? SPAN_FIELDS : SCORE_FIELDS;
    const compiled = compileScalarPredicate(predicate.predicate, registry, parameterOffset);
    const table = predicate.collection === 'spans' ? spanTable : scoreTable;
    const currentPredicate =
      predicate.collection === 'spans' ? latestSpanPredicate(spanTable) : latestScorePredicate(scoreTable);
    const existence = `EXISTS (
      SELECT 1 FROM ${table} s
      WHERE s."traceId" IS NOT NULL
        AND s."traceId" = r."traceId"
        AND ${currentPredicate}
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
      const compiled = compilePredicate(arg, spanTable, scoreTable, parameterOffset + values.length);
      values.push(...compiled.values);
      return `(${compiled.sql})`;
    });
    return { sql: parts.join(predicate.operator === 'and' ? ' AND ' : ' OR '), values };
  }

  if (predicate.type === 'not') {
    const compiled = compilePredicate(predicate.arg, spanTable, scoreTable, parameterOffset);
    return { sql: `NOT (${compiled.sql})`, values: compiled.values };
  }

  return compileScalarPredicate(predicate, TRACE_FIELDS, parameterOffset);
}

export interface CompiledPostgresTraceQuery {
  text: string;
  values: unknown[];
}

export function compilePostgresTraceQuery(schema: string, plan: TrustedTraceQueryPlan): CompiledPostgresTraceQuery {
  const spanTable = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const scoreTable = qualifiedTable(schema, TABLE_SCORE_EVENTS);
  const values: unknown[] = [plan.timeRange.from, plan.timeRange.to];
  const conditions = [
    `r."parentSpanId" IS NULL`,
    latestRootPredicate(spanTable),
    `NOT r."isPending"`,
    `r."startedAt" >= $1`,
    `r."startedAt" < $2`,
  ];

  if (plan.where) {
    const predicate = compilePredicate(plan.where, spanTable, scoreTable, values.length + 1);
    conditions.push(`(${predicate.sql})`);
    values.push(...predicate.values);
  }

  const candidates = `WITH candidates AS (
    SELECT ${TRACE_SELECT}
    FROM ${spanTable} r
    WHERE ${conditions.join('\n      AND ')}
  )`;

  if (plan.result === 'groups') {
    const pageCondition = plan.cursor ? `AND "threadId" > $${values.length + 1}` : '';
    if (plan.cursor) values.push(plan.cursor.threadId);
    values.push(plan.limit + 1);
    return {
      text: `${candidates}
SELECT "threadId"
FROM candidates
WHERE "threadId" IS NOT NULL ${pageCondition}
GROUP BY "threadId"
ORDER BY "threadId" ASC
LIMIT $${values.length}`,
      values,
    };
  }

  const orderField = plan.orderBy.field === 'startedAt' ? '"startedAt"' : '"endedAt"';
  const direction = plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC';
  let pageCondition = '';
  if (plan.cursor) {
    const comparison = plan.orderBy.direction === 'asc' ? '>' : '<';
    const sortParameter = `$${values.length + 1}`;
    const idParameter = `$${values.length + 2}`;
    pageCondition = `WHERE (${orderField} ${comparison} ${sortParameter} OR (${orderField} = ${sortParameter} AND "traceId" > ${idParameter}))`;
    values.push(plan.cursor.sortValue, plan.cursor.traceId);
  }
  values.push(plan.limit + 1);

  return {
    text: `${candidates}
SELECT *
FROM candidates
${pageCondition}
ORDER BY ${orderField} ${direction}, "traceId" ASC
LIMIT $${values.length}`,
    values,
  };
}

function asIsoTimestamp(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(value as string | number).toISOString();
}

export async function queryTraces(
  client: DbClient,
  schema: string,
  plan: TrustedTraceQueryPlan,
): Promise<TraceQueryResponse> {
  const query = compilePostgresTraceQuery(schema, plan);
  const rows = await client.any<Record<string, unknown>>(query.text, query.values);
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
