import * as coreStorage from '@mastra/core/storage';
import type {
  TraceQueryCanonicalField,
  TraceQueryField,
  TraceQueryPredicateField,
  TraceQueryResponse,
  TraceQueryScoreField,
  TraceQuerySpanField,
  TrustedTraceQueryPlan,
  TrustedTraceQueryPredicate,
  TrustedTraceQueryScalarPredicate,
} from '@mastra/core/storage';

import type { DbClient, TxClient } from '../../../client';
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
  name: 's."name"',
  spanType: 's."spanType"',
  model: 's."model"',
  provider: 's."provider"',
  startedAt: 's."startedAt"',
  endedAt: 's."endedAt"',
  durationMs: 's."durationMs"',
  status: 's."status"',
  error: 's."error"',
  entityType: 's."entityType"',
  entityId: 's."entityId"',
  entityName: 's."entityName"',
  entityVersionId: 's."entityVersionId"',
  parentEntityVersionId: 's."parentEntityVersionId"',
  rootEntityVersionId: 's."rootEntityVersionId"',
} satisfies FieldRegistry<TraceQuerySpanField>;

const SCORE_FIELDS = {
  scorerId: 's."scorerId"',
  scorerVersion: 's."scorerVersion"',
  scoreSource: 's."scoreSource"',
  score: 's."score"',
  timestamp: 's."timestamp"',
  spanId: 's."spanId"',
  entityVersionId: 's."entityVersionId"',
  parentEntityVersionId: 's."parentEntityVersionId"',
  rootEntityVersionId: 's."rootEntityVersionId"',
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

function isMetadataField(field: TraceQueryPredicateField): field is `metadata.${string}` {
  return field.startsWith('metadata.');
}

function placeholders(values: readonly unknown[], offset: number): string {
  return values.map((_, index) => `$${offset + index}`).join(', ');
}

function compileScalarPredicate<TField extends string>(
  predicate: TrustedTraceQueryScalarPredicate,
  registry: Partial<FieldRegistry<TField>>,
  parameterOffset: number,
  allowMetadata = false,
): SqlFragment {
  if (predicate.type === 'boolean') {
    const values: unknown[] = [];
    const parts = predicate.args.map(arg => {
      const compiled = compileScalarPredicate(arg, registry, parameterOffset + values.length, allowMetadata);
      values.push(...compiled.values);
      return `(${compiled.sql})`;
    });
    return { sql: parts.join(predicate.operator === 'and' ? ' AND ' : ' OR '), values };
  }

  if (predicate.type === 'not') {
    const compiled = compileScalarPredicate(predicate.arg, registry, parameterOffset, allowMetadata);
    return { sql: `NOT (${compiled.sql})`, values: compiled.values };
  }

  let field: string;
  let fieldValues: unknown[] = [];
  if (isMetadataField(predicate.field)) {
    if (!allowMetadata) throw new Error(`Unsupported trusted trace-query field: ${predicate.field}`);
    const keyParameter = `$${parameterOffset++}`;
    field = `CASE WHEN jsonb_typeof(r."metadataSearch" -> ${keyParameter}) = 'string' THEN r."metadataSearch" ->> ${keyParameter} END`;
    fieldValues = [predicate.field.slice('metadata.'.length)];
  } else {
    field = fieldSql(registry, predicate.field);
  }

  if (predicate.type === 'presence') {
    return {
      sql: `${field} IS ${predicate.operator === 'exists' ? 'NOT ' : ''}NULL`,
      values: fieldValues,
    };
  }

  if (predicate.type === 'membership') {
    const list = placeholders(predicate.values, parameterOffset);
    if (predicate.operator === 'in') {
      return { sql: `${field} IS NOT NULL AND ${field} IN (${list})`, values: [...fieldValues, ...predicate.values] };
    }
    return { sql: `${field} IS NULL OR ${field} NOT IN (${list})`, values: [...fieldValues, ...predicate.values] };
  }

  const parameter = `$${parameterOffset}`;
  const operators = { lt: '<', lte: '<=', gt: '>', gte: '>=' } as const;
  if (predicate.operator === 'eq') {
    return { sql: `${field} IS NOT DISTINCT FROM ${parameter}`, values: [...fieldValues, predicate.value] };
  }
  if (predicate.operator === 'ne') {
    return { sql: `${field} IS DISTINCT FROM ${parameter}`, values: [...fieldValues, predicate.value] };
  }
  const operator = operators[predicate.operator];
  if (operator === undefined) throw new Error(`Unsupported trusted trace-query operator: ${predicate.operator}`);
  return {
    sql: `${field} IS NOT NULL AND ${field} ${operator} ${parameter}`,
    values: [...fieldValues, predicate.value],
  };
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

function compilePredicate(predicate: TrustedTraceQueryPredicate, parameterOffset: number): SqlFragment {
  if (predicate.type === 'relation') {
    const registry = predicate.collection === 'spans' ? SPAN_FIELDS : SCORE_FIELDS;
    const compiled = compileScalarPredicate(predicate.predicate, registry, parameterOffset);
    const table = predicate.collection === 'spans' ? 'current_spans' : 'current_scores';
    const existence = `EXISTS (
      SELECT 1 FROM ${table} s
      WHERE s."traceId" = r."traceId"
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
      const compiled = compilePredicate(arg, parameterOffset + values.length);
      values.push(...compiled.values);
      return `(${compiled.sql})`;
    });
    return { sql: parts.join(predicate.operator === 'and' ? ' AND ' : ' OR '), values };
  }

  if (predicate.type === 'not') {
    const compiled = compilePredicate(predicate.arg, parameterOffset);
    return { sql: `NOT (${compiled.sql})`, values: compiled.values };
  }

  return compileScalarPredicate(predicate, TRACE_FIELDS, parameterOffset, true);
}

export interface CompiledPostgresTraceQuery {
  text: string;
  values: unknown[];
}

export function compilePostgresTraceQuery(schema: string, plan: TrustedTraceQueryPlan): CompiledPostgresTraceQuery {
  const spanTable = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const scoreTable = qualifiedTable(schema, TABLE_SCORE_EVENTS);
  const values: unknown[] = [plan.timeRange.from, plan.timeRange.to];
  const relationCollections = collectRelationCollections(plan.where);
  const rootConditions = [
    `r."parentSpanId" IS NULL`,
    latestRootPredicate(spanTable),
    `NOT r."isPending"`,
    `r."endedAt" IS NOT NULL`,
    `r."startedAt" >= $1`,
    `r."startedAt" < $2`,
  ];
  const ctes = [
    `root_scope AS MATERIALIZED (
    SELECT *
    FROM ${spanTable} r
    WHERE ${rootConditions.join('\n      AND ')}
  )`,
  ];

  if (relationCollections.has('spans')) {
    ctes.push(`current_spans AS MATERIALIZED (
    SELECT
      s."traceId",
      s."name",
      s."spanType",
      CASE WHEN jsonb_typeof(s."attributes" -> 'model') = 'string' THEN s."attributes" ->> 'model' END AS "model",
      CASE WHEN jsonb_typeof(s."attributes" -> 'provider') = 'string' THEN s."attributes" ->> 'provider' END AS "provider",
      s."startedAt",
      CASE WHEN s."isPending" THEN NULL ELSE s."endedAt" END AS "endedAt",
      CASE
        WHEN s."isPending" THEN NULL
        ELSE EXTRACT(EPOCH FROM (s."endedAt" - s."startedAt")) * 1000
      END AS "durationMs",
      CASE WHEN s."error" IS NOT NULL THEN 'error' ELSE 'success' END AS "status",
      s."error",
      s."entityType",
      s."entityId",
      s."entityName",
      s."entityVersionId",
      s."parentEntityVersionId",
      s."rootEntityVersionId"
    FROM ${spanTable} s
    WHERE s."traceId" IS NOT NULL
      AND s."traceId" IN (SELECT "traceId" FROM root_scope)
      AND ${latestSpanPredicate(spanTable)}
  )`);
  }
  if (relationCollections.has('scores')) {
    ctes.push(`current_scores AS MATERIALIZED (
    SELECT
      s."traceId",
      s."scorerId",
      s."scorerVersion",
      s."scoreSource",
      s."score",
      s."timestamp",
      s."spanId",
      s."entityVersionId",
      s."parentEntityVersionId",
      s."rootEntityVersionId"
    FROM ${scoreTable} s
    WHERE s."traceId" IS NOT NULL
      AND s."traceId" IN (SELECT "traceId" FROM root_scope)
      AND ${latestScorePredicate(scoreTable)}
  )`);
  }

  let predicateSql = 'TRUE';
  if (plan.where) {
    const predicate = compilePredicate(plan.where, values.length + 1);
    predicateSql = predicate.sql;
    values.push(...predicate.values);
  }
  ctes.push(`candidates AS (
    SELECT ${TRACE_SELECT}
    FROM root_scope r
    WHERE ${predicateSql}
  )`);
  const candidates = `WITH ${ctes.join(',\n')}`;

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
  if (value === null || value === undefined) throw new Error('Trace query returned a null timestamp');
  return value instanceof Date ? value.toISOString() : new Date(value as string | number).toISOString();
}

function isPostgresStatementTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === '57014' && String(candidate.message ?? '').includes('statement timeout');
}

export async function runWithPostgresTraceQueryTimeout<T>(
  client: DbClient,
  timeoutMs: number,
  execute: (transaction: TxClient) => Promise<T>,
): Promise<T> {
  const resolvedTimeoutMs = coreStorage.resolveTraceQueryTimeoutMs(timeoutMs);
  try {
    return await client.tx(async transaction => {
      await transaction.query(`SELECT set_config('statement_timeout', $1, true)`, [`${resolvedTimeoutMs}ms`]);
      return execute(transaction);
    });
  } catch (error) {
    if (isPostgresStatementTimeout(error)) throw new coreStorage.TraceQueryExecutionError();
    throw error;
  }
}

export async function queryTraces(
  client: DbClient,
  schema: string,
  plan: TrustedTraceQueryPlan,
  timeoutMs: number,
): Promise<TraceQueryResponse> {
  const query = compilePostgresTraceQuery(schema, plan);
  const rows = await runWithPostgresTraceQueryTimeout(client, timeoutMs, transaction =>
    transaction.any<Record<string, unknown>>(query.text, query.values),
  );
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
