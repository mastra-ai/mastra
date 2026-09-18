import * as coreStorage from '@mastra/core/storage';
import type {
  GetTraceQueryValuesResponse,
  QueryThreadsResult,
  TraceQueryCanonicalField,
  TraceQueryObservedFieldsResult,
  TraceQueryFeedbackField,
  TraceQueryField,
  TraceQueryPredicateField,
  TraceQueryResponse,
  TraceQueryScoreField,
  TraceQuerySpanField,
  TrustedThreadPredicate,
  TrustedThreadQueryPlan,
  TrustedTraceQueryObservedFieldsPlan,
  TrustedTraceQueryPlan,
  TrustedTraceQueryValuesPlan,
  TrustedTraceQueryPredicate,
  TrustedTraceQueryScalarPredicate,
} from '@mastra/core/storage';

import type { DuckDBConnection } from '../../db/index';
import { parseJson } from './helpers';

type ParameterType = 'scalar' | 'timestamp';
type FieldDefinition = { sql: string; parameterType: ParameterType };
type FieldRegistry<TField extends string> = Record<TField, FieldDefinition>;
type SqlFragment = { sql: string; values: unknown[] };
type RelatedCollection = 'spans' | 'scores' | 'feedback';

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
  r.name AS name,
  r.entityId AS entityId,
  r.parentSpanId AS parentSpanId,
  r.metadata AS metadata,
  r.input AS input,
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
  return typeof field === 'string' && field.startsWith('metadata.');
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
  if (Array.isArray(predicate.field)) {
    if (!allowMetadata || predicate.field[0] !== 'metadata')
      throw new Error('Unsupported structured trace-query field');
    const path =
      '$' +
      predicate.field
        .slice(1)
        .map(segment => `.${JSON.stringify(segment)}`)
        .join('');
    const sample =
      predicate.type === 'comparison'
        ? predicate.value
        : predicate.type === 'membership'
          ? predicate.values[0]
          : undefined;
    const kind = typeof sample;
    const types =
      sample === undefined
        ? "'VARCHAR', 'BIGINT', 'UBIGINT', 'DOUBLE', 'BOOLEAN'"
        : kind === 'number'
          ? "'BIGINT', 'UBIGINT', 'DOUBLE'"
          : kind === 'boolean'
            ? "'BOOLEAN'"
            : "'VARCHAR'";
    const extract =
      kind === 'number'
        ? 'TRY_CAST(json_extract_string(r.metadata, ?) AS DOUBLE)'
        : kind === 'boolean'
          ? 'TRY_CAST(json_extract_string(r.metadata, ?) AS BOOLEAN)'
          : 'json_extract_string(r.metadata, ?)';
    field = { sql: `CASE WHEN json_type(r.metadata, ?) IN (${types}) THEN ${extract} END`, parameterType: 'scalar' };
    fieldValues = [path, path];
  } else if (isMetadataField(predicate.field)) {
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
    values: [...fieldValues, ...fieldValues, predicate.value],
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
    return { sql: `s.value IS ${predicate.operator === 'exists' ? 'NOT ' : ''}NULL`, values: [] };
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

function compileThreadPredicate(predicate: TrustedThreadPredicate): SqlFragment {
  if (predicate.type === 'relation') {
    const compiled = compilePredicate(predicate.predicate);
    const existence = `EXISTS (
      SELECT 1 FROM eligible_roots r
      WHERE r.threadId = t.threadId
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
      const compiled = compileThreadPredicate(arg);
      values.push(...compiled.values);
      return `(${compiled.sql})`;
    });
    return { sql: parts.join(predicate.operator === 'and' ? ' AND ' : ' OR '), values };
  }
  const compiled = compileThreadPredicate(predicate.arg);
  return { sql: `NOT (${compiled.sql})`, values: compiled.values };
}

function collectRelatedCollections(
  predicate: TrustedTraceQueryPredicate | undefined,
  collections = new Set<RelatedCollection>(),
): Set<RelatedCollection> {
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

function collectThreadRelatedCollections(
  predicate: TrustedThreadPredicate | undefined,
  collections: Set<RelatedCollection>,
): Set<RelatedCollection> {
  if (!predicate) return collections;
  if (predicate.type === 'relation') {
    collectRelatedCollections(predicate.predicate, collections);
  } else if (predicate.type === 'boolean') {
    for (const arg of predicate.args) collectThreadRelatedCollections(arg, collections);
  } else {
    collectThreadRelatedCollections(predicate.arg, collections);
  }
  return collections;
}

export interface CompiledDuckDBTraceQuery {
  sql: string;
  values: unknown[];
}

function compileDuckDBTraceScope(relatedCollections: Set<RelatedCollection>): string[] {
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
    )`);
  }

  return ctes;
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
  const ctes = compileDuckDBTraceScope(relatedCollections);

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

export function compileDuckDBThreadQuery(plan: TrustedThreadQueryPlan): CompiledDuckDBTraceQuery {
  const values: unknown[] = [plan.traces.timeRange.from, plan.traces.timeRange.to];
  const relatedCollections = collectRelatedCollections(plan.traces.where);
  collectThreadRelatedCollections(plan.where, relatedCollections);
  const ctes = compileDuckDBTraceScope(relatedCollections);

  let eligibilitySql = 'TRUE';
  if (plan.traces.where) {
    const eligibility = compilePredicate(plan.traces.where);
    eligibilitySql = eligibility.sql;
    values.push(...eligibility.values);
  }
  ctes.push(`eligible_roots AS (
      SELECT *
      FROM root_scope r
      WHERE ${eligibilitySql}
    )`);
  ctes.push(`thread_ids AS (
      SELECT threadId
      FROM eligible_roots
      WHERE threadId IS NOT NULL
      GROUP BY threadId
    )`);

  let threadPredicateSql = 'TRUE';
  if (plan.where) {
    const predicate = compileThreadPredicate(plan.where);
    threadPredicateSql = predicate.sql;
    values.push(...predicate.values);
  }
  ctes.push(`qualified_threads AS (
      SELECT t.threadId
      FROM thread_ids t
      WHERE ${threadPredicateSql}
    )`);

  const pageCondition = plan.cursor ? `WHERE threadId > ?` : '';
  if (plan.cursor) values.push(plan.cursor.threadId);
  values.push(plan.limit + 1);
  return {
    sql: `WITH ${ctes.join(',\n  ')}
SELECT threadId
FROM qualified_threads
${pageCondition}
ORDER BY threadId ASC
LIMIT ?`,
    values,
  };
}

function discoveryRegistry(scope: TrustedTraceQueryValuesPlan['predicateScope']): Partial<FieldRegistry<string>> {
  if (scope === 'trace') return TRACE_FIELDS;
  if (scope === 'spans') return SPAN_FIELDS;
  if (scope === 'scores') return SCORE_FIELDS;
  return FEEDBACK_FIELDS;
}

function discoverySource(scope: TrustedTraceQueryValuesPlan['predicateScope']): string {
  if (scope === 'trace') return 'root_scope r';
  if (scope === 'spans') return 'current_spans s';
  if (scope === 'scores') return 'current_scores s';
  return 'current_feedback s';
}

function discoveryCollections(scope: TrustedTraceQueryValuesPlan['predicateScope']): Set<RelatedCollection> {
  return scope === 'trace' ? new Set() : new Set([scope]);
}

export function compileDuckDBTraceQueryObservedFields(
  plan: TrustedTraceQueryObservedFieldsPlan,
): CompiledDuckDBTraceQuery {
  const values: unknown[] = [plan.timeRange.from, plan.timeRange.to];
  if (plan.search) values.push(plan.search);
  values.push(plan.limit + 1);
  const search = plan.search ? `AND strpos(lower(array_to_string(segments, '.')), lower(?)) > 0` : '';
  return {
    sql: `WITH RECURSIVE ${compileDuckDBTraceScope(new Set()).join(',\n  ')}, metadata_tree AS (
  SELECT ['metadata'] AS segments, r.metadata AS leaf FROM root_scope r
  UNION ALL
  SELECT list_append(segments, entry.key), entry.value
  FROM metadata_tree, LATERAL json_each(CASE WHEN json_type(leaf) = 'OBJECT' THEN leaf ELSE '{}'::JSON END) entry
  WHERE len(segments) < ${coreStorage.TRACE_QUERY_MAX_PATH_SEGMENTS}
    AND entry.key <> '' AND strpos(entry.key, chr(0)) = 0
    AND octet_length(encode(entry.key)) <= ${coreStorage.TRACE_QUERY_MAX_PATH_SEGMENT_BYTES}
    AND octet_length(encode(array_to_string(list_append(segments, entry.key), '.'))) <= ${coreStorage.TRACE_QUERY_MAX_PATH_BYTES}
), fields AS (
  SELECT segments, CASE WHEN len(segments) = 2 AND strpos(segments[2], '.') = 0
    AND json_type(leaf) = 'VARCHAR' AND trim(json_extract_string(leaf, '$')) <> ''
    THEN 'metadata.' || segments[2] ELSE CAST(to_json(segments) AS VARCHAR) END AS path
  FROM metadata_tree
  WHERE json_type(leaf) IN ('VARCHAR', 'BIGINT', 'UBIGINT', 'DOUBLE', 'BOOLEAN')
    AND (json_type(leaf) <> 'VARCHAR' OR octet_length(encode(json_extract_string(leaf, '$'))) <= ${coreStorage.TRACE_QUERY_MAX_STRING_BYTES})
)
SELECT path, count(*) AS occurrences
FROM fields
WHERE true ${search}
GROUP BY path
ORDER BY occurrences DESC, path ASC
LIMIT ?`,
    values,
  };
}

export function compileDuckDBTraceQueryValues(plan: TrustedTraceQueryValuesPlan): CompiledDuckDBTraceQuery {
  const values: unknown[] = [plan.timeRange.from, plan.timeRange.to];
  const ctes = compileDuckDBTraceScope(discoveryCollections(plan.predicateScope));
  let fieldSql: string;
  if (Array.isArray(plan.path)) {
    if (plan.predicateScope !== 'trace' || plan.path[0] !== 'metadata')
      throw new Error('Unsupported structured discovery path');
    const jsonPath =
      '$' +
      plan.path
        .slice(1)
        .map(segment => `.${JSON.stringify(segment)}`)
        .join('');
    fieldSql = `CASE WHEN json_type(r.metadata, ?) IN ('VARCHAR', 'BIGINT', 'UBIGINT', 'DOUBLE', 'BOOLEAN') THEN json_extract(r.metadata, ?) END`;
    values.push(jsonPath, jsonPath);
  } else if (plan.predicateScope === 'trace' && plan.path.startsWith('metadata.')) {
    const jsonPath = `$.${JSON.stringify(plan.path.slice('metadata.'.length))}`;
    fieldSql = `NULLIF(trim(CASE WHEN json_type(r.metadata, ?) = 'VARCHAR' THEN json_extract_string(r.metadata, ?) END), '')`;
    values.push(jsonPath, jsonPath);
  } else {
    fieldSql = fieldDefinition(discoveryRegistry(plan.predicateScope), plan.path as TraceQueryCanonicalField).sql;
  }
  if (plan.search) values.push(plan.search);
  values.push(plan.limit + 1);
  const searchableValue = Array.isArray(plan.path) ? `json_extract_string(value, '$')` : 'CAST(value AS VARCHAR)';
  const search = plan.search ? `AND strpos(lower(${searchableValue}), lower(?)) > 0` : '';
  return {
    sql: `WITH ${ctes.join(',\n  ')}, extracted AS (
  SELECT ${fieldSql} AS value FROM ${discoverySource(plan.predicateScope)}
)
SELECT CAST(value AS VARCHAR) AS value, count(*) AS count
FROM extracted
WHERE value IS NOT NULL
  AND octet_length(encode(${searchableValue})) <= ${coreStorage.TRACE_QUERY_MAX_STRING_BYTES}
  ${search}
GROUP BY value
ORDER BY count DESC, value ASC
LIMIT ?`,
    values,
  };
}

function isDuckDBResourceLimit(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('out of memory');
}

async function runDuckDBDiscoveryQuery(
  db: DuckDBConnection,
  query: CompiledDuckDBTraceQuery,
): Promise<Record<string, unknown>[]> {
  try {
    return await db.query<Record<string, unknown>>(query.sql, query.values);
  } catch (error) {
    if (isDuckDBResourceLimit(error)) throw new coreStorage.TraceQueryResourceLimitError();
    throw error;
  }
}

export async function getTraceQueryObservedFields(
  db: DuckDBConnection,
  plan: TrustedTraceQueryObservedFieldsPlan,
): Promise<TraceQueryObservedFieldsResult> {
  if (plan.predicateScope !== 'trace') return { observedFields: [], observedFieldsTruncated: false };
  const query = compileDuckDBTraceQueryObservedFields(plan);
  const rows = await runDuckDBDiscoveryQuery(db, query);
  return {
    observedFields: rows
      .slice(0, plan.limit)
      .map(row =>
        coreStorage.createTraceQueryObservedFieldDescriptor(
          String(row.path).startsWith('[') ? JSON.parse(String(row.path)) : String(row.path),
          Number(row.occurrences),
        ),
      ),
    observedFieldsTruncated: rows.length > plan.limit,
  };
}

export async function getTraceQueryValues(
  db: DuckDBConnection,
  plan: TrustedTraceQueryValuesPlan,
): Promise<GetTraceQueryValuesResponse> {
  const query = compileDuckDBTraceQueryValues(plan);
  const rows = await runDuckDBDiscoveryQuery(db, query);
  return coreStorage.getTraceQueryValuesResponseSchema.parse({
    values: rows.slice(0, plan.limit).map(row => ({
      value: Array.isArray(plan.path) ? JSON.parse(String(row.value)) : String(row.value),
      count: Number(row.count),
    })),
    valuesTruncated: rows.length > plan.limit,
  });
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
    name: row.name,
    entityId: row.entityId ?? null,
    parentSpanId: row.parentSpanId ?? null,
    createdAt: asIsoTimestamp(row.startedAt),
    metadata: parseJson(row.metadata) ?? null,
    inputPreview: coreStorage.buildInputPreview(row.input) ?? null,
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

export async function queryThreads(db: DuckDBConnection, plan: TrustedThreadQueryPlan): Promise<QueryThreadsResult> {
  const query = compileDuckDBThreadQuery(plan);
  const rows = await db.query<Record<string, unknown>>(query.sql, query.values);
  const threads = rows.slice(0, plan.limit).map(row => ({ threadId: String(row.threadId) }));
  const last = threads.at(-1);
  return coreStorage.queryThreadsResultSchema.parse({
    threads,
    page: {
      next:
        rows.length > plan.limit && last
          ? coreStorage.encodeTraceQueryCursor(plan, { result: 'threads', threadId: last.threadId })
          : null,
    },
  });
}
