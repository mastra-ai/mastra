import * as coreStorage from '@mastra/core/storage';
import type {
  TraceQueryCanonicalField,
  TraceQueryFeedbackField,
  TraceQueryField,
  TraceQueryPredicateField,
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
  name: { sql: 's.name', parameterType: 'scalar' },
  spanType: { sql: 's.spanType', parameterType: 'scalar' },
  model: { sql: 's.model', parameterType: 'scalar' },
  provider: { sql: 's.provider', parameterType: 'scalar' },
  startedAt: { sql: 's.startedAt', parameterType: 'timestamp' },
  endedAt: { sql: 's.endedAt', parameterType: 'timestamp' },
  durationMs: { sql: 's.durationMs', parameterType: 'scalar' },
  status: { sql: 's.status', parameterType: 'scalar' },
  error: { sql: 's.error', parameterType: 'scalar' },
  entityType: { sql: 's.entityType', parameterType: 'scalar' },
  entityId: { sql: 's.entityId', parameterType: 'scalar' },
  entityName: { sql: 's.entityName', parameterType: 'scalar' },
  entityVersionId: { sql: 's.entityVersionId', parameterType: 'scalar' },
  parentEntityVersionId: { sql: 's.parentEntityVersionId', parameterType: 'scalar' },
  rootEntityVersionId: { sql: 's.rootEntityVersionId', parameterType: 'scalar' },
} satisfies FieldRegistry<TraceQuerySpanField>;

const SCORE_FIELDS = {
  scorerId: { sql: 's.scorerId', parameterType: 'scalar' },
  scorerVersion: { sql: 's.scorerVersion', parameterType: 'scalar' },
  scoreSource: { sql: 's.scoreSource', parameterType: 'scalar' },
  score: { sql: 's.score', parameterType: 'scalar' },
  timestamp: { sql: 's.timestamp', parameterType: 'timestamp' },
  spanId: { sql: 's.spanId', parameterType: 'scalar' },
  entityVersionId: { sql: 's.entityVersionId', parameterType: 'scalar' },
  parentEntityVersionId: { sql: 's.parentEntityVersionId', parameterType: 'scalar' },
  rootEntityVersionId: { sql: 's.rootEntityVersionId', parameterType: 'scalar' },
} satisfies FieldRegistry<TraceQueryScoreField>;

const FEEDBACK_FIELDS = {
  feedbackType: { sql: 's.feedbackType', parameterType: 'scalar' },
  feedbackSource: { sql: 's.feedbackSource', parameterType: 'scalar' },
  feedbackUserId: { sql: 's.feedbackUserId', parameterType: 'scalar' },
  sourceId: { sql: 's.sourceId', parameterType: 'scalar' },
  entityVersionId: { sql: 's.entityVersionId', parameterType: 'scalar' },
  parentEntityVersionId: { sql: 's.parentEntityVersionId', parameterType: 'scalar' },
  rootEntityVersionId: { sql: 's.rootEntityVersionId', parameterType: 'scalar' },
  timestamp: { sql: 's.timestamp', parameterType: 'timestamp' },
  comment: { sql: 's.comment', parameterType: 'scalar' },
} satisfies FieldRegistry<Exclude<TraceQueryFeedbackField, 'value'>>;

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

function isMetadataField(field: TraceQueryPredicateField): field is `metadata.${string}` {
  return field.startsWith('metadata.');
}

function compileScalarPredicate<TField extends string>(
  predicate: TrustedTraceQueryScalarPredicate,
  registry: Partial<FieldRegistry<TField>>,
  allowMetadata = false,
): SqlFragment {
  if (predicate.type === 'boolean') {
    const values: unknown[] = [];
    const parts = predicate.args.map(arg => {
      const compiled = compileScalarPredicate(arg, registry, allowMetadata);
      values.push(...compiled.values);
      return `(${compiled.sql})`;
    });
    return { sql: parts.join(predicate.operator === 'and' ? ' AND ' : ' OR '), values };
  }

  if (predicate.type === 'not') {
    const compiled = compileScalarPredicate(predicate.arg, registry, allowMetadata);
    return { sql: `NOT (${compiled.sql})`, values: compiled.values };
  }

  let field: FieldDefinition;
  let fieldValues: unknown[] = [];
  if (isMetadataField(predicate.field)) {
    if (!allowMetadata) throw new Error(`Unsupported trusted trace-query field: ${predicate.field}`);
    const key = predicate.field.slice('metadata.'.length);
    const path = `$.${JSON.stringify(key)}`;
    field = {
      sql: `NULLIF(trim(CASE WHEN json_type(r.metadata, ?) = 'VARCHAR' THEN json_extract_string(r.metadata, ?) END), '')`,
      parameterType: 'scalar',
    };
    fieldValues = [path, path];
  } else {
    field = fieldDefinition(registry, predicate.field);
  }

  if (predicate.type === 'presence') {
    return {
      sql: `${field.sql} IS ${predicate.operator === 'exists' ? 'NOT ' : ''}NULL`,
      values: fieldValues,
    };
  }

  if (predicate.type === 'membership') {
    const list = predicate.values.map(() => parameterSql(field.parameterType)).join(', ');
    if (predicate.operator === 'in') {
      return {
        sql: `${field.sql} IS NOT NULL AND ${field.sql} IN (${list})`,
        values: [...fieldValues, ...fieldValues, ...predicate.values],
      };
    }
    return {
      sql: `${field.sql} IS NULL OR ${field.sql} NOT IN (${list})`,
      values: [...fieldValues, ...fieldValues, ...predicate.values],
    };
  }

  const parameter = parameterSql(field.parameterType);
  const operators = { lt: '<', lte: '<=', gt: '>', gte: '>=' } as const;
  if (predicate.operator === 'eq') {
    return { sql: `${field.sql} IS NOT DISTINCT FROM ${parameter}`, values: [...fieldValues, predicate.value] };
  }
  if (predicate.operator === 'ne') {
    return { sql: `${field.sql} IS DISTINCT FROM ${parameter}`, values: [...fieldValues, predicate.value] };
  }
  const operator = operators[predicate.operator];
  if (operator === undefined) throw new Error(`Unsupported trusted trace-query operator: ${predicate.operator}`);
  return {
    sql: `${field.sql} IS NOT NULL AND ${field.sql} ${operator} ${parameter}`,
    values: [...fieldValues, predicate.value],
  };
}

function compileFeedbackScalarPredicate(predicate: TrustedTraceQueryScalarPredicate): SqlFragment {
  if (predicate.type === 'boolean') {
    const values: unknown[] = [];
    const parts = predicate.args.map(arg => {
      const compiled = compileFeedbackScalarPredicate(arg);
      values.push(...compiled.values);
      return `(${compiled.sql})`;
    });
    return { sql: parts.join(predicate.operator === 'and' ? ' AND ' : ' OR '), values };
  }
  if (predicate.type === 'not') {
    const compiled = compileFeedbackScalarPredicate(predicate.arg);
    return { sql: `NOT (${compiled.sql})`, values: compiled.values };
  }
  if (predicate.field !== 'value') return compileScalarPredicate(predicate, FEEDBACK_FIELDS);
  if (predicate.type === 'presence') {
    const present = `(s.valueString IS NOT NULL OR s.valueNumber IS NOT NULL OR s.value IS NOT NULL)`;
    return { sql: predicate.operator === 'exists' ? present : `NOT ${present}`, values: [] };
  }
  const sample = predicate.type === 'membership' ? predicate.values[0] : predicate.value;
  const field = typeof sample === 'number' ? 's.valueNumber' : 's.valueString';
  return compileScalarPredicate(predicate, { value: { sql: field, parameterType: 'scalar' } });
}

function compilePredicate(predicate: TrustedTraceQueryPredicate): SqlFragment {
  if (predicate.type === 'relation') {
    const compiled =
      predicate.collection === 'feedback'
        ? compileFeedbackScalarPredicate(predicate.predicate)
        : compileScalarPredicate(predicate.predicate, predicate.collection === 'spans' ? SPAN_FIELDS : SCORE_FIELDS);
    const table =
      predicate.collection === 'spans'
        ? 'current_spans'
        : predicate.collection === 'scores'
          ? 'current_scores'
          : 'current_feedback';
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

  return compileScalarPredicate(predicate, TRACE_FIELDS, true);
}

function collectRelatedCollections(
  predicate: TrustedTraceQueryPredicate | undefined,
  collections = new Set<'spans' | 'scores' | 'feedback'>(),
): Set<'spans' | 'scores' | 'feedback'> {
  if (!predicate) return collections;
  if (predicate.type === 'relation') {
    collections.add(predicate.collection);
  } else if (predicate.type === 'boolean') {
    for (const arg of predicate.args) collectRelatedCollections(arg, collections);
  } else if (predicate.type === 'not') {
    collectRelatedCollections(predicate.arg, collections);
  }
  return collections;
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

  const relatedCollections = collectRelatedCollections(plan.where);
  const ctes = [
    `root_events AS (
      SELECT
        *,
        CASE
          WHEN eventType = 'start' THEN timestamp
          ELSE lag(timestamp) OVER (PARTITION BY traceId, spanId ORDER BY cursorId)
        END AS startedAt
      FROM span_events
      WHERE parentSpanId IS NULL
    )`,
    `current_roots AS (
      SELECT * EXCLUDE (rootRank)
      FROM (
        SELECT *, row_number() OVER (PARTITION BY traceId ORDER BY cursorId DESC) AS rootRank
        FROM root_events
      )
      WHERE rootRank = 1
    )`,
    `root_scope AS (
      SELECT *
      FROM current_roots r
      WHERE r.endedAt IS NOT NULL
        AND r.startedAt >= CAST(? AS TIMESTAMP)
        AND r.startedAt < CAST(? AS TIMESTAMP)
    )`,
  ];

  if (relatedCollections.has('spans')) {
    ctes.push(`current_span_rows AS (
      SELECT
        e.*,
        coalesce(
          min(e.timestamp) FILTER (WHERE e.eventType = 'start') OVER (PARTITION BY e.traceId, e.spanId),
          min(e.timestamp) OVER (PARTITION BY e.traceId, e.spanId)
        ) AS startedAt,
        row_number() OVER (
          PARTITION BY e.traceId, e.spanId
          ORDER BY CASE WHEN e.endedAt IS NULL THEN 1 ELSE 0 END ASC, e.cursorId DESC
        ) AS currentRank
      FROM span_events e
      INNER JOIN root_scope roots ON roots.traceId = e.traceId
    ),
    current_spans AS (
      SELECT
        traceId,
        name,
        spanType,
        CASE
          WHEN json_type(attributes, '$.model') = 'VARCHAR' THEN json_extract_string(attributes, '$.model')
        END AS model,
        CASE
          WHEN json_type(attributes, '$.provider') = 'VARCHAR' THEN json_extract_string(attributes, '$.provider')
        END AS provider,
        startedAt,
        endedAt,
        date_diff('millisecond', startedAt, endedAt) AS durationMs,
        CASE WHEN error IS NOT NULL THEN 'error' ELSE 'success' END AS status,
        error,
        entityType,
        entityId,
        entityName,
        entityVersionId,
        parentEntityVersionId,
        rootEntityVersionId
      FROM current_span_rows
      WHERE currentRank = 1
    )`);
  }

  if (relatedCollections.has('scores')) {
    ctes.push(`current_scores AS (
      SELECT s.*
      FROM score_events s
      INNER JOIN root_scope roots ON roots.traceId = s.traceId
    )`);
  }

  if (relatedCollections.has('feedback')) {
    ctes.push(`current_feedback AS (
      SELECT f.*
      FROM feedback_events f
      INNER JOIN root_scope roots ON roots.traceId = f.traceId
      WHERE f.traceId IS NOT NULL
    )`);
  }

  ctes.push(`candidates AS (
    SELECT ${TRACE_SELECT}
    FROM root_scope r
    WHERE ${conditions.slice(3).join('\n      AND ') || 'TRUE'}
  )`);

  const candidates = `WITH ${ctes.join(',\n  ')}`;

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
