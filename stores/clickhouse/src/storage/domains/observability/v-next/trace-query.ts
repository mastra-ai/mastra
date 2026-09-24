import type { ClickHouseClient } from '@clickhouse/client';
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
  TraceQueryTenantScope,
  TrustedThreadPredicate,
  TrustedThreadQueryPlan,
  TrustedTraceQueryObservedFieldsPlan,
  TrustedTraceQueryPlan,
  TrustedTraceQueryValuesPlan,
  TrustedTraceQueryPredicate,
  TrustedTraceQueryScalarPredicate,
} from '@mastra/core/storage';
import { z } from 'zod/v4';

import {
  TABLE_FEEDBACK_EVENTS,
  TABLE_METRIC_EVENTS,
  TABLE_SPAN_EVENTS,
  TABLE_TRACE_ROOTS,
  TABLE_TRACE_ROOTS_DELTA,
} from './ddl';
import { CH_SETTINGS, parseJson } from './helpers';
import type { ClickHouseDeltaCursorStrategy } from './polling';
import { assertDeltaPollingSupported, deltaPollingSupported } from './polling';
import { currentScoresRelation } from './scores';

type ClickHouseParameterType = 'String' | 'Float64' | 'UInt64' | "DateTime64(3, 'UTC')" | 'Array(String)';
type FieldDefinition = { sql: string; parameterType: ClickHouseParameterType };
type FieldRegistry<TField extends string> = Record<TField, FieldDefinition>;
type QueryParams = Record<string, string | number | string[]>;
type SqlFragment = { sql: string; params: QueryParams };
type RelatedCollection = 'spans' | 'scores' | 'feedback';
type TraceSelection = {
  timeRange: { from: string; to: string };
  where?: TrustedTraceQueryPredicate;
};

const TRACE_STATUS_SQL = `if(isNotNull(r.error), 'error', 'success')`;

function durationMsSql(startedAt: string, endedAt: string): string {
  return `dateDiff('millisecond', ${startedAt}, ${endedAt})`;
}

const TRACE_FIELDS = {
  traceId: { sql: 'r.traceId', parameterType: 'String' },
  threadId: { sql: 'r.threadId', parameterType: 'String' },
  resourceId: { sql: 'r.resourceId', parameterType: 'String' },
  startedAt: { sql: 'r.startedAt', parameterType: "DateTime64(3, 'UTC')" },
  endedAt: { sql: 'r.endedAt', parameterType: "DateTime64(3, 'UTC')" },
  durationMs: { sql: durationMsSql('r.startedAt', 'r.endedAt'), parameterType: 'Float64' },
  entityName: { sql: 'r.entityName', parameterType: 'String' },
  entityType: { sql: 'r.entityType', parameterType: 'String' },
  environment: { sql: 'r.environment', parameterType: 'String' },
  status: { sql: TRACE_STATUS_SQL, parameterType: 'String' },
  tags: { sql: 'r.tags', parameterType: 'String' },
} satisfies FieldRegistry<TraceQueryField>;

const SPAN_FIELDS = {
  name: { sql: 's.name', parameterType: 'String' },
  spanType: { sql: 's.spanType', parameterType: 'String' },
  model: { sql: 's.model', parameterType: 'String' },
  provider: { sql: 's.provider', parameterType: 'String' },
  startedAt: { sql: 's.startedAt', parameterType: "DateTime64(3, 'UTC')" },
  endedAt: { sql: 's.endedAt', parameterType: "DateTime64(3, 'UTC')" },
  durationMs: { sql: 's.durationMs', parameterType: 'Float64' },
  status: { sql: 's.status', parameterType: 'String' },
  error: { sql: 's.error', parameterType: 'String' },
  entityType: { sql: 's.entityType', parameterType: 'String' },
  entityId: { sql: 's.entityId', parameterType: 'String' },
  entityName: { sql: 's.entityName', parameterType: 'String' },
  entityVersionId: { sql: 's.entityVersionId', parameterType: 'String' },
  parentEntityVersionId: { sql: 's.parentEntityVersionId', parameterType: 'String' },
  rootEntityVersionId: { sql: 's.rootEntityVersionId', parameterType: 'String' },
} satisfies FieldRegistry<TraceQuerySpanField>;

const SCORE_FIELDS = {
  scorerId: { sql: 's.scorerId', parameterType: 'String' },
  scorerVersion: { sql: 's.scorerVersion', parameterType: 'String' },
  scoreSource: { sql: 's.scoreSource', parameterType: 'String' },
  score: { sql: 's.score', parameterType: 'Float64' },
  timestamp: { sql: 's.timestamp', parameterType: "DateTime64(3, 'UTC')" },
  spanId: { sql: 's.spanId', parameterType: 'String' },
  entityVersionId: { sql: 's.entityVersionId', parameterType: 'String' },
  parentEntityVersionId: { sql: 's.parentEntityVersionId', parameterType: 'String' },
  rootEntityVersionId: { sql: 's.rootEntityVersionId', parameterType: 'String' },
} satisfies FieldRegistry<TraceQueryScoreField>;

const FEEDBACK_FIELDS = {
  feedbackType: { sql: 's.feedbackType', parameterType: 'String' },
  feedbackSource: { sql: 's.feedbackSource', parameterType: 'String' },
  feedbackUserId: { sql: 's.feedbackUserId', parameterType: 'String' },
  sourceId: { sql: 's.sourceId', parameterType: 'String' },
  entityVersionId: { sql: 's.entityVersionId', parameterType: 'String' },
  parentEntityVersionId: { sql: 's.parentEntityVersionId', parameterType: 'String' },
  rootEntityVersionId: { sql: 's.rootEntityVersionId', parameterType: 'String' },
  timestamp: { sql: 's.timestamp', parameterType: "DateTime64(3, 'UTC')" },
  comment: { sql: 's.comment', parameterType: 'String' },
} satisfies FieldRegistry<Exclude<TraceQueryFeedbackField, 'value'>>;

const TRACE_SELECT = `
  r.traceId AS traceId,
  r.spanId AS rootSpanId,
  r.name AS name,
  r.entityId AS entityId,
  r.parentSpanId AS parentSpanId,
  r.metadataRaw AS metadata,
  r.input AS input,
  r.threadId AS threadId,
  r.resourceId AS resourceId,
  r.startedAt AS startedAt,
  r.endedAt AS endedAt,
  r.entityName AS entityName,
  r.entityType AS entityType,
  r.environment AS environment,
  ${TRACE_STATUS_SQL} AS status`;

/** The table summary needs the root output and tags; other queries leave the blobs off the read path. */
function traceSelect(plan: TrustedTraceQueryPlan): string {
  return plan.result === 'traces' && plan.tableSummary
    ? `${TRACE_SELECT},\n  r.output AS output,\n  r.tags AS tags`
    : TRACE_SELECT;
}

class ParameterBuilder {
  readonly params: QueryParams = {};
  #next = 1;

  add(value: string | number | string[], type: ClickHouseParameterType): string {
    const name = `trace_query_${this.#next++}`;
    this.params[name] =
      type === "DateTime64(3, 'UTC')" && !Array.isArray(value)
        ? new Date(value).toISOString().replace('T', ' ').replace(/Z$/, '')
        : value;
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

function isMetadataField(field: TraceQueryPredicateField): field is `metadata.${string}` {
  return field.startsWith('metadata.');
}

function compileScalarPredicate<TField extends string>(
  predicate: TrustedTraceQueryScalarPredicate,
  registry: Partial<FieldRegistry<TField>>,
  parameters: ParameterBuilder,
  allowMetadata = false,
): string {
  if (predicate.type === 'boolean') {
    const parts = predicate.args.map(arg => `(${compileScalarPredicate(arg, registry, parameters, allowMetadata)})`);
    return parts.join(predicate.operator === 'and' ? ' AND ' : ' OR ');
  }

  if (predicate.type === 'not') {
    return `NOT (${compileScalarPredicate(predicate.arg, registry, parameters, allowMetadata)})`;
  }

  const field = isMetadataField(predicate.field)
    ? (() => {
        if (!allowMetadata) throw new Error(`Unsupported trusted trace-query field: ${predicate.field}`);
        const key = parameters.add(predicate.field.slice('metadata.'.length), 'String');
        return {
          sql: `coalesce(if(mapContains(r.metadataSearch, ${key}), r.metadataSearch[${key}], NULL), nullIf(trim(JSONExtractString(r.metadataRaw, ${key})), ''))`,
          parameterType: 'String' as const,
        };
      })()
    : fieldDefinition(registry, predicate.field);
  if (predicate.type === 'presence') {
    return `${predicate.operator === 'exists' ? 'isNotNull' : 'isNull'}(${field.sql})`;
  }

  if (predicate.type === 'collection') {
    // Arrays are never NULL in ClickHouse; `DEFAULT []` makes missing and empty the same.
    if (!('value' in predicate)) return `${predicate.operator}(${field.sql})`;
    const member = parameters.add(predicate.value, field.parameterType);
    return predicate.operator === 'includes'
      ? `has(${field.sql}, ${member})`
      : `notEmpty(${field.sql}) AND NOT has(${field.sql}, ${member})`;
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

function compileFeedbackScalarPredicate(
  predicate: TrustedTraceQueryScalarPredicate,
  parameters: ParameterBuilder,
): string {
  if (predicate.type === 'boolean') {
    const parts = predicate.args.map(arg => `(${compileFeedbackScalarPredicate(arg, parameters)})`);
    return parts.join(predicate.operator === 'and' ? ' AND ' : ' OR ');
  }
  if (predicate.type === 'not') return `NOT (${compileFeedbackScalarPredicate(predicate.arg, parameters)})`;
  if (predicate.field !== 'value') return compileScalarPredicate(predicate, FEEDBACK_FIELDS, parameters);
  if (predicate.type === 'presence') {
    const present = `(isNotNull(s.valueString) OR isNotNull(s.valueNumber))`;
    return predicate.operator === 'exists' ? present : `NOT ${present}`;
  }
  if (predicate.type === 'collection') throw new Error('Unsupported trusted trace-query field: value');
  const sample = predicate.type === 'membership' ? predicate.values[0] : predicate.value;
  const field =
    typeof sample === 'number'
      ? { value: { sql: 's.valueNumber', parameterType: 'Float64' as const } }
      : { value: { sql: 's.valueString', parameterType: 'String' as const } };
  return compileScalarPredicate(predicate, field, parameters);
}

function collectRelationCollections(
  predicate: TrustedTraceQueryPredicate | undefined,
  collections = new Set<RelatedCollection>(),
): Set<RelatedCollection> {
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

function collectThreadRelationCollections(
  predicate: TrustedThreadPredicate | undefined,
  collections: Set<RelatedCollection>,
): Set<RelatedCollection> {
  if (!predicate) return collections;
  if (predicate.type === 'relation') {
    collectRelationCollections(predicate.predicate, collections);
  } else if (predicate.type === 'boolean') {
    for (const arg of predicate.args) collectThreadRelationCollections(arg, collections);
  } else {
    collectThreadRelationCollections(predicate.arg, collections);
  }
  return collections;
}

function compilePredicate(predicate: TrustedTraceQueryPredicate, parameters: ParameterBuilder): string {
  if (predicate.type === 'relation') {
    const table =
      predicate.collection === 'spans'
        ? 'current_spans'
        : predicate.collection === 'scores'
          ? 'current_scores'
          : 'current_feedback';
    const nested =
      predicate.collection === 'feedback'
        ? compileFeedbackScalarPredicate(predicate.predicate, parameters)
        : compileScalarPredicate(
            predicate.predicate,
            predicate.collection === 'spans' ? SPAN_FIELDS : SCORE_FIELDS,
            parameters,
          );
    const existence = `EXISTS (
      SELECT 1 FROM ${table} s
      WHERE isNotNull(s.traceId)
        AND s.traceId = r.traceId
        AND (${nested})
    )`;
    return predicate.quantifier === 'some' ? existence : `NOT ${existence}`;
  }

  if (predicate.type === 'boolean') {
    const parts = predicate.args.map(arg => `(${compilePredicate(arg, parameters)})`);
    return parts.join(predicate.operator === 'and' ? ' AND ' : ' OR ');
  }

  if (predicate.type === 'not') return `NOT (${compilePredicate(predicate.arg, parameters)})`;
  return compileScalarPredicate(predicate, TRACE_FIELDS, parameters, true);
}

function compileThreadPredicate(predicate: TrustedThreadPredicate, parameters: ParameterBuilder): string {
  if (predicate.type === 'relation') {
    const existence = `EXISTS (
      SELECT 1 FROM eligible_roots r
      WHERE r.threadId = t.threadId
        AND (${compilePredicate(predicate.predicate, parameters)})
    )`;
    return predicate.quantifier === 'some' ? existence : `NOT ${existence}`;
  }
  if (predicate.type === 'boolean') {
    const parts = predicate.args.map(arg => `(${compileThreadPredicate(arg, parameters)})`);
    return parts.join(predicate.operator === 'and' ? ' AND ' : ' OR ');
  }
  return `NOT (${compileThreadPredicate(predicate.arg, parameters)})`;
}

export interface CompiledClickHouseTraceQuery {
  query: string;
  query_params: QueryParams;
  sharedSnapshot?: boolean;
}

/**
 * Tenant conditions ANDed into every root and related-signal scan. Columns are
 * `Nullable(String)`, so rows without a tenant never match a scope.
 */
function compileTenantScope(scope: TraceQueryTenantScope | undefined, parameters: ParameterBuilder): string {
  if (!scope) return '';
  let sql = `\n      AND organizationId = ${parameters.add(scope.organizationId, 'String')}`;
  if (scope.resourceId !== undefined) sql += `\n      AND resourceId = ${parameters.add(scope.resourceId, 'String')}`;
  return sql;
}

function compileClickHouseTraceScope(
  selection: TraceSelection,
  relationCollections: Set<RelatedCollection>,
  parameters: ParameterBuilder,
  scope: TraceQueryTenantScope | undefined,
): string[] {
  const from = parameters.add(selection.timeRange.from, "DateTime64(3, 'UTC')");
  const to = parameters.add(selection.timeRange.to, "DateTime64(3, 'UTC')");
  const tenant = compileTenantScope(scope, parameters);
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
      AND startedAt < ${to}${tenant}
  )`,
  ];

  if (relationCollections.has('spans')) {
    ctes.push(`current_spans AS (
    SELECT
      traceId,
      name,
      spanType,
      if(JSONType(attributes, 'model') = 'String', JSONExtractString(attributes, 'model'), NULL) AS model,
      if(JSONType(attributes, 'provider') = 'String', JSONExtractString(attributes, 'provider'), NULL) AS provider,
      startedAt,
      endedAt,
      ${durationMsSql('startedAt', 'endedAt')} AS durationMs,
      if(isNotNull(error), 'error', 'success') AS status,
      error,
      entityType,
      entityId,
      entityName,
      entityVersionId,
      parentEntityVersionId,
      rootEntityVersionId
    FROM ${TABLE_SPAN_EVENTS}
    WHERE isNotNull(traceId)
      AND traceId IN (SELECT traceId FROM root_scope)${tenant}
    ORDER BY dedupeKey
    LIMIT 1 BY dedupeKey
  )`);
  }
  if (relationCollections.has('scores')) {
    ctes.push(`current_scores AS (
    SELECT
      traceId,
      spanId,
      timestamp,
      scorerId,
      scorerVersion,
      scoreSource,
      score,
      entityVersionId,
      parentEntityVersionId,
      rootEntityVersionId
    FROM ${currentScoresRelation()} AS current
    WHERE isNotNull(current.traceId)
      AND current.traceId IN (SELECT traceId FROM root_scope)${tenant}
  )`);
  }
  if (relationCollections.has('feedback')) {
    ctes.push(`current_feedback AS (
    SELECT
      traceId,
      feedbackType,
      feedbackSource,
      feedbackUserId,
      sourceId,
      valueString,
      valueNumber,
      comment,
      timestamp,
      entityVersionId,
      parentEntityVersionId,
      rootEntityVersionId
    FROM (
      SELECT *
      FROM ${TABLE_FEEDBACK_EVENTS} FINAL
      ORDER BY feedbackId, writeVersion DESC, timestamp DESC
      LIMIT 1 BY feedbackId
    ) AS current
    WHERE isNotNull(traceId)
      AND traceId IN (SELECT traceId FROM root_scope)${tenant}
  )`);
  }

  return ctes;
}

const deltaWatermarkSchema = z
  .object({
    cursorId: z
      .string()
      .regex(/^\d+$/)
      .refine(value => BigInt(value) <= 18446744073709551615n),
    traceId: z.string(),
  })
  .strict();
type DeltaWatermark = z.infer<typeof deltaWatermarkSchema>;

function parseDeltaWatermark(value: string): DeltaWatermark {
  try {
    return deltaWatermarkSchema.parse(JSON.parse(value));
  } catch {
    throw new coreStorage.TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
  }
}

export function compileClickHouseTraceQuery(
  plan: TrustedTraceQueryPlan,
  deltaHead?: DeltaWatermark,
): CompiledClickHouseTraceQuery {
  const parameters = new ParameterBuilder();
  const relationCollections = collectRelationCollections(plan.where);
  const ctes = compileClickHouseTraceScope(plan, relationCollections, parameters, plan.scope);

  const predicate = plan.where ? compilePredicate(plan.where, parameters) : '1';
  ctes.push(`candidates AS (
    SELECT ${traceSelect(plan)}
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

  if (plan.paginationMode === 'delta') {
    const watermark = coreStorage.getTraceQueryDeltaWatermark(plan, 'clickhouse');
    const after = watermark ? parseDeltaWatermark(watermark) : { cursorId: '0', traceId: '' };
    const lower = `tuple(${parameters.add(after.cursorId, 'UInt64')}, ${parameters.add(after.traceId, 'String')})`;
    const upper = deltaHead
      ? `AND tuple(cursorId, traceId) <= tuple(${parameters.add(deltaHead.cursorId, 'UInt64')}, ${parameters.add(deltaHead.traceId, 'String')})`
      : '';
    const limit = parameters.add(plan.limit + 1, 'UInt64');
    return {
      query: `${candidates}, delta_candidates AS (
  SELECT traceId, max(cursorId) AS latestCursorId
  FROM ${TABLE_TRACE_ROOTS_DELTA}
  WHERE tuple(cursorId, traceId) > ${lower} ${upper}
  GROUP BY traceId
)
SELECT c.*, toString(d.latestCursorId) AS __delta_cursor
FROM candidates c
INNER JOIN delta_candidates d ON c.traceId = d.traceId
ORDER BY d.latestCursorId ASC, c.traceId ASC
LIMIT ${limit}`,
      query_params: parameters.params,
      sharedSnapshot: true,
    };
  }

  const orderField = resolveOrderField(plan.orderBy.field);
  const direction = plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC';
  if (plan.paginationMode === 'page') {
    const limit = parameters.add(plan.perPage, 'UInt64');
    const offset = parameters.add(plan.page * plan.perPage, 'UInt64');
    return {
      query: `${candidates},
page_rows AS (
  SELECT *, row_number() OVER (ORDER BY ${orderField} ${direction}, traceId ASC) AS __row_position
  FROM candidates
  ORDER BY ${orderField} ${direction}, traceId ASC
  LIMIT ${limit} OFFSET ${offset}
),
page_total AS (
  SELECT count() AS total
  FROM candidates
)
SELECT page_rows.*, page_total.total, 0 AS __metadata
FROM page_rows
CROSS JOIN page_total
UNION ALL
SELECT
  '' AS traceId,
  '' AS rootSpanId,
  '' AS name,
  CAST(NULL, 'Nullable(String)') AS entityId,
  CAST(NULL, 'Nullable(String)') AS parentSpanId,
  CAST(NULL, 'Nullable(String)') AS metadata,
  CAST(NULL, 'Nullable(String)') AS input,
  CAST(NULL, 'Nullable(String)') AS threadId,
  CAST(NULL, 'Nullable(String)') AS resourceId,
  toDateTime64(0, 3, 'UTC') AS startedAt,
  toDateTime64(0, 3, 'UTC') AS endedAt,
  CAST(NULL, 'Nullable(String)') AS entityName,
  CAST(NULL, 'Nullable(String)') AS entityType,
  CAST(NULL, 'Nullable(String)') AS environment,
  '' AS status,${plan.tableSummary ? `\n  CAST(NULL, 'Nullable(String)') AS output,\n  CAST([], 'Array(String)') AS tags,` : ''}
  0 AS __row_position,
  page_total.total AS total,
  1 AS __metadata
FROM page_total
ORDER BY __metadata ASC, __row_position ASC`,
      query_params: parameters.params,
      sharedSnapshot: true,
    };
  }

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

export function compileClickHouseThreadQuery(plan: TrustedThreadQueryPlan): CompiledClickHouseTraceQuery {
  const parameters = new ParameterBuilder();
  const relationCollections = collectRelationCollections(plan.traces.where);
  collectThreadRelationCollections(plan.where, relationCollections);
  const ctes = compileClickHouseTraceScope(plan.traces, relationCollections, parameters, plan.scope);

  const eligibility = plan.traces.where ? compilePredicate(plan.traces.where, parameters) : '1';
  ctes.push(`eligible_roots AS (
    SELECT *
    FROM root_scope r
    WHERE ${eligibility}
  )`);
  ctes.push(`thread_ids AS (
    SELECT threadId
    FROM eligible_roots
    WHERE isNotNull(threadId)
    GROUP BY threadId
  )`);

  const threadPredicate = plan.where ? compileThreadPredicate(plan.where, parameters) : '1';
  ctes.push(`qualified_threads AS (
    SELECT t.threadId
    FROM thread_ids t
    WHERE ${threadPredicate}
  )`);

  const pageCondition = plan.cursor ? `WHERE threadId > ${parameters.add(plan.cursor.threadId, 'String')}` : '';
  const limit = parameters.add(plan.limit + 1, 'UInt64');
  return {
    query: `WITH ${ctes.join(',\n')}
SELECT threadId
FROM qualified_threads
${pageCondition}
ORDER BY threadId ASC
LIMIT ${limit}`,
    query_params: parameters.params,
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

export function compileClickHouseTraceQueryObservedFields(
  plan: TrustedTraceQueryObservedFieldsPlan,
): CompiledClickHouseTraceQuery {
  const parameters = new ParameterBuilder();
  const ctes = compileClickHouseTraceScope(plan, new Set(), parameters, plan.scope);
  const search = plan.search
    ? `AND positionCaseInsensitiveUTF8(concat('metadata.', key), ${parameters.add(plan.search, 'String')}) > 0`
    : '';
  const limit = parameters.add(plan.limit + 1, 'UInt64');
  ctes.push(`metadata_entries AS (
    SELECT
      entry.1 AS key,
      entry.2 AS rawValue,
      JSONExtractString(entry.2) AS value
    FROM root_scope r
    ARRAY JOIN JSONExtractKeysAndValuesRaw(ifNull(r.metadataRaw, '{}')) AS entry
  )`);
  return {
    query: `WITH ${ctes.join(',\n')}
SELECT concat('metadata.', key) AS path, count() AS occurrences
FROM metadata_entries
WHERE JSONType(rawValue) = 'String'
  AND trim(value) != ''
  AND key != ''
  AND position(key, '.') = 0
  AND length(concat('metadata.', key)) <= ${coreStorage.TRACE_QUERY_MAX_PATH_BYTES}
  AND length(value) <= ${coreStorage.TRACE_QUERY_MAX_STRING_BYTES}
  ${search}
GROUP BY key
ORDER BY occurrences DESC, path ASC
LIMIT ${limit}`,
    query_params: parameters.params,
  };
}

export function compileClickHouseTraceQueryValues(plan: TrustedTraceQueryValuesPlan): CompiledClickHouseTraceQuery {
  const parameters = new ParameterBuilder();
  const ctes = compileClickHouseTraceScope(plan, discoveryCollections(plan.predicateScope), parameters, plan.scope);
  let field: string;
  if (plan.predicateScope === 'trace' && plan.path.startsWith('metadata.')) {
    const key = parameters.add(plan.path.slice('metadata.'.length), 'String');
    field = `coalesce(if(mapContains(r.metadataSearch, ${key}), r.metadataSearch[${key}], NULL), nullIf(trim(JSONExtractString(r.metadataRaw, ${key})), ''))`;
  } else if (plan.predicateScope === 'trace' && plan.path === 'tags') {
    // One row per (root, distinct tag) so the count is traces carrying the tag, not tag occurrences.
    field = `arrayJoin(arrayDistinct(${TRACE_FIELDS.tags.sql}))`;
  } else {
    field = fieldDefinition(discoveryRegistry(plan.predicateScope), plan.path as TraceQueryCanonicalField).sql;
  }
  const search = plan.search
    ? `AND positionCaseInsensitiveUTF8(value, ${parameters.add(plan.search, 'String')}) > 0`
    : '';
  const limit = parameters.add(plan.limit + 1, 'UInt64');
  return {
    query: `WITH ${ctes.join(',\n')}, extracted AS (
  SELECT toString(${field}) AS value FROM ${discoverySource(plan.predicateScope)}
)
SELECT value, count() AS count
FROM extracted
WHERE value IS NOT NULL
  AND length(value) <= ${coreStorage.TRACE_QUERY_MAX_STRING_BYTES}
  ${search}
GROUP BY value
ORDER BY count DESC, value ASC
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

function isClickHouseResourceLimit(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; type?: unknown };
  return String(candidate.code ?? '') === '241' || candidate.type === 'MEMORY_LIMIT_EXCEEDED';
}

export type ClickHouseTraceQueryExecutionLimits = {
  timeoutMs: number;
  memoryLimitBytes?: number;
};

export async function runWithClickHouseTraceQueryTimeout(
  client: ClickHouseClient,
  limits: ClickHouseTraceQueryExecutionLimits,
  compiled: CompiledClickHouseTraceQuery,
  queryId?: string,
): Promise<Record<string, unknown>[]> {
  const resolvedTimeoutMs = coreStorage.resolveTraceQueryTimeoutMs(limits.timeoutMs);
  try {
    const result = await client.query({
      query: compiled.query,
      query_params: compiled.query_params,
      query_id: queryId,
      format: 'JSONEachRow',
      clickhouse_settings: {
        ...CH_SETTINGS,
        max_execution_time: resolvedTimeoutMs / 1000,
        ...(limits.memoryLimitBytes === undefined ? {} : { max_memory_usage: String(limits.memoryLimitBytes) }),
        ...(compiled.sharedSnapshot ? { enable_shared_storage_snapshot_in_query: 1 } : {}),
      },
    });
    return (await result.json()) as Record<string, unknown>[];
  } catch (error) {
    if (isClickHouseExecutionTimeout(error)) throw new coreStorage.TraceQueryExecutionError();
    if (isClickHouseResourceLimit(error)) throw new coreStorage.TraceQueryResourceLimitError();
    throw error;
  }
}

export async function getTraceQueryObservedFields(
  client: ClickHouseClient,
  plan: TrustedTraceQueryObservedFieldsPlan,
  limits: ClickHouseTraceQueryExecutionLimits,
): Promise<TraceQueryObservedFieldsResult> {
  if (plan.predicateScope !== 'trace') return { observedFields: [], observedFieldsTruncated: false };
  const rows = await runWithClickHouseTraceQueryTimeout(
    client,
    limits,
    compileClickHouseTraceQueryObservedFields(plan),
  );
  return {
    observedFields: rows
      .slice(0, plan.limit)
      .map(row => coreStorage.createTraceQueryObservedFieldDescriptor(String(row.path), Number(row.occurrences))),
    observedFieldsTruncated: rows.length > plan.limit,
  };
}

export async function getTraceQueryValues(
  client: ClickHouseClient,
  plan: TrustedTraceQueryValuesPlan,
  limits: ClickHouseTraceQueryExecutionLimits,
): Promise<GetTraceQueryValuesResponse> {
  const rows = await runWithClickHouseTraceQueryTimeout(client, limits, compileClickHouseTraceQueryValues(plan));
  return coreStorage.getTraceQueryValuesResponseSchema.parse({
    values: rows.slice(0, plan.limit).map(row => ({ value: String(row.value), count: Number(row.count) })),
    valuesTruncated: rows.length > plan.limit,
  });
}

type TableSummaryRollup = NonNullable<coreStorage.TraceQueryTableSummaryInput['spans']> & {
  promptCacheReadTokens: number | null;
  promptCacheCreationTokens: number | null;
};

interface TableSummaryRows {
  rollups: Map<string, TableSummaryRollup>;
  feedback: Map<string, coreStorage.TraceQueryFeedbackSummary[]>;
  scores: Map<string, coreStorage.TraceQueryScoreSummary[]>;
}

/**
 * Bounded side queries for the selected page only. Each reads the same current-record
 * shape as the trace scope, restricted to the page's trace IDs, and never touches
 * ordering or totals: the page query already fixed them.
 */
export function compileClickHouseTableSummaryQueries(
  scope: TraceQueryTenantScope | undefined,
  traceIds: string[],
): {
  rollups: CompiledClickHouseTraceQuery;
  feedback: CompiledClickHouseTraceQuery;
  scores: CompiledClickHouseTraceQuery;
} {
  const list = (types: readonly string[]) => types.map(type => `'${type}'`).join(', ');
  const relatedLimit = coreStorage.TRACE_QUERY_TABLE_SUMMARY_RELATED_LIMIT + 1;
  const compile = (build: (parameters: ParameterBuilder, ids: string, tenant: string) => string) => {
    const parameters = new ParameterBuilder();
    const ids = parameters.add(traceIds, 'Array(String)');
    const tenant = compileTenantScope(scope, parameters);
    return { query: build(parameters, ids, tenant), query_params: parameters.params };
  };

  const rollups = compile((parameters, ids, tenant) => {
    const read = parameters.add(coreStorage.TRACE_QUERY_TABLE_SUMMARY_METRICS.promptCacheReadTokens, 'String');
    const write = parameters.add(coreStorage.TRACE_QUERY_TABLE_SUMMARY_METRICS.promptCacheCreationTokens, 'String');
    return `WITH current_spans AS (
    SELECT traceId, spanId, spanType, error, startedAt, attributes
    FROM ${TABLE_SPAN_EVENTS}
    WHERE traceId IN ${ids}${tenant}
    ORDER BY dedupeKey
    LIMIT 1 BY dedupeKey
  ),
  model_spans AS (
    SELECT
      traceId,
      argMin(if(JSONType(attributes, 'model') = 'String', JSONExtractString(attributes, 'model'), NULL), (startedAt, spanId)) AS model,
      argMin(
        ${durationMsSql('startedAt', "parseDateTime64BestEffortOrNull(JSONExtractString(attributes, 'completionStartTime'), 3)")},
        (startedAt, spanId)
      ) AS timeToFirstTokenMs
    FROM current_spans
    WHERE spanType IN (${list(coreStorage.TRACE_QUERY_TABLE_SUMMARY_MODEL_SPAN_TYPES)})
    GROUP BY traceId
  ),
  metric_sums AS (
    SELECT
      traceId,
      if(countIf(name = ${read}) > 0, sumIf(value, name = ${read}), NULL) AS promptCacheReadTokens,
      if(countIf(name = ${write}) > 0, sumIf(value, name = ${write}), NULL) AS promptCacheCreationTokens
    FROM (
      SELECT traceId, spanId, name, value
      FROM ${TABLE_METRIC_EVENTS}
      WHERE traceId IN ${ids}
        AND name IN (${read}, ${write})${tenant}
      ORDER BY metricId
      LIMIT 1 BY metricId
    )
    WHERE (traceId, spanId) IN (SELECT traceId, spanId FROM current_spans)
    GROUP BY traceId
  )
SELECT
  c.traceId AS traceId,
  countIf(isNotNull(c.error)) AS errorTotal,
  countIf(isNotNull(c.error) AND c.spanType IN (${list(coreStorage.TRACE_QUERY_TABLE_SUMMARY_LLM_SPAN_TYPES)})) AS errorLlm,
  countIf(isNotNull(c.error) AND c.spanType IN (${list(coreStorage.TRACE_QUERY_TABLE_SUMMARY_TOOL_SPAN_TYPES)})) AS errorTool,
  any(ms.model) AS model,
  any(ms.timeToFirstTokenMs) AS timeToFirstTokenMs,
  any(mt.promptCacheReadTokens) AS promptCacheReadTokens,
  any(mt.promptCacheCreationTokens) AS promptCacheCreationTokens
FROM current_spans c
LEFT JOIN model_spans ms ON ms.traceId = c.traceId
LEFT JOIN metric_sums mt ON mt.traceId = c.traceId
GROUP BY c.traceId`;
  });

  const feedback = compile(
    (parameters, ids, tenant) => `SELECT *
FROM (
  SELECT
    traceId, feedbackId, feedbackType, feedbackSource, valueString, valueNumber, comment, timestamp,
    row_number() OVER (PARTITION BY traceId ORDER BY timestamp DESC, feedbackId ASC) AS relatedRank
  FROM (
    SELECT *
    FROM ${TABLE_FEEDBACK_EVENTS} FINAL
    WHERE traceId IN ${ids}${tenant}
    ORDER BY feedbackId, writeVersion DESC, timestamp DESC
    LIMIT 1 BY feedbackId
  )
)
WHERE relatedRank <= ${parameters.add(relatedLimit, 'UInt64')}
ORDER BY traceId ASC, relatedRank ASC`,
  );

  const scores = compile(
    (parameters, ids, tenant) => `SELECT *
FROM (
  SELECT
    traceId, scoreId, scorerId, scorerVersion, scoreSource, score, timestamp, spanId,
    row_number() OVER (PARTITION BY traceId ORDER BY timestamp DESC, scoreId ASC) AS relatedRank
  FROM ${currentScoresRelation()} AS current
  WHERE traceId IN ${ids}${tenant}
)
WHERE relatedRank <= ${parameters.add(relatedLimit, 'UInt64')}
ORDER BY traceId ASC, relatedRank ASC`,
  );

  return { rollups, feedback, scores };
}

function nullableNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}

async function loadTableSummaryRows(
  client: ClickHouseClient,
  scope: TraceQueryTenantScope | undefined,
  traceIds: string[],
  timeoutMs: () => number,
): Promise<TableSummaryRows> {
  const result: TableSummaryRows = { rollups: new Map(), feedback: new Map(), scores: new Map() };
  if (traceIds.length === 0) return result;
  const queries = compileClickHouseTableSummaryQueries(scope, traceIds);
  const [rollupRows, feedbackRows, scoreRows] = await Promise.all([
    runWithClickHouseTraceQueryTimeout(client, { timeoutMs: timeoutMs() }, queries.rollups),
    runWithClickHouseTraceQueryTimeout(client, { timeoutMs: timeoutMs() }, queries.feedback),
    runWithClickHouseTraceQueryTimeout(client, { timeoutMs: timeoutMs() }, queries.scores),
  ]);
  for (const row of rollupRows) {
    result.rollups.set(String(row.traceId), {
      errorTotal: Number(row.errorTotal ?? 0),
      errorLlm: Number(row.errorLlm ?? 0),
      errorTool: Number(row.errorTool ?? 0),
      model: row.model == null ? null : String(row.model),
      timeToFirstTokenMs: nullableNumber(row.timeToFirstTokenMs),
      promptCacheReadTokens: nullableNumber(row.promptCacheReadTokens),
      promptCacheCreationTokens: nullableNumber(row.promptCacheCreationTokens),
    });
  }
  for (const row of feedbackRows) {
    const traceId = String(row.traceId);
    const records = result.feedback.get(traceId) ?? [];
    records.push({
      feedbackId: String(row.feedbackId),
      feedbackType: String(row.feedbackType),
      feedbackSource: String(row.feedbackSource),
      value: row.valueNumber != null ? Number(row.valueNumber) : String(row.valueString ?? ''),
      comment: row.comment == null ? null : String(row.comment),
      timestamp: asIsoTimestamp(row.timestamp),
    });
    result.feedback.set(traceId, records);
  }
  for (const row of scoreRows) {
    const traceId = String(row.traceId);
    const records = result.scores.get(traceId) ?? [];
    records.push({
      scoreId: String(row.scoreId),
      scorerId: String(row.scorerId),
      scorerVersion: row.scorerVersion == null ? null : String(row.scorerVersion),
      scoreSource: row.scoreSource == null ? null : String(row.scoreSource),
      score: Number(row.score),
      timestamp: asIsoTimestamp(row.timestamp),
      spanId: row.spanId == null ? null : String(row.spanId),
    });
    result.scores.set(traceId, records);
  }
  return result;
}

function traceRowToResult(row: Record<string, unknown>, summaries?: TableSummaryRows) {
  const traceId = String(row.traceId);
  const rollup = summaries?.rollups.get(traceId);
  return {
    traceId,
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
    ...(summaries
      ? {
          tableSummary: coreStorage.buildTraceQueryTableSummary({
            output: row.output,
            tags: row.tags,
            spans: rollup ?? null,
            feedback: summaries.feedback.get(traceId) ?? [],
            scores: summaries.scores.get(traceId) ?? [],
            promptCacheReadTokens: rollup?.promptCacheReadTokens ?? null,
            promptCacheCreationTokens: rollup?.promptCacheCreationTokens ?? null,
          }),
        }
      : {}),
  };
}

async function mapTraceRows(
  client: ClickHouseClient,
  plan: TrustedTraceQueryPlan,
  rows: Record<string, unknown>[],
  timeoutMs: () => number,
) {
  const summaries =
    plan.result === 'traces' && plan.tableSummary
      ? await loadTableSummaryRows(
          client,
          plan.scope,
          rows.map(row => String(row.traceId)),
          timeoutMs,
        )
      : undefined;
  return rows.map(row => traceRowToResult(row, summaries));
}

export async function queryTraces(
  client: ClickHouseClient,
  plan: TrustedTraceQueryPlan,
  timeoutMs: number,
  strategy: ClickHouseDeltaCursorStrategy | null = null,
): Promise<TraceQueryResponse> {
  const deadline = performance.now() + coreStorage.resolveTraceQueryTimeoutMs(timeoutMs);
  const remaining = () => {
    const value = Math.floor(deadline - performance.now());
    if (value <= 0) throw new coreStorage.TraceQueryExecutionError();
    return value;
  };
  let deltaHead: DeltaWatermark | undefined;
  if (plan.paginationMode === 'delta') {
    assertDeltaPollingSupported(strategy);
    const watermark = coreStorage.getTraceQueryDeltaWatermark(plan, 'clickhouse');
    if (watermark) parseDeltaWatermark(watermark);
  }
  // The list-polling feature predates the trace-query cursor encoder.
  if (
    plan.paginationMode === 'delta' ||
    (plan.paginationMode === 'page' &&
      deltaPollingSupported(strategy) &&
      typeof coreStorage.encodeTraceQueryDeltaCursor === 'function')
  ) {
    const head = await runWithClickHouseTraceQueryTimeout(
      client,
      { timeoutMs: remaining() },
      {
        query: `SELECT toString(cursorId) AS cursorId, traceId FROM ${TABLE_TRACE_ROOTS_DELTA} ORDER BY cursorId DESC, traceId DESC LIMIT 1`,
        query_params: {},
      },
    );
    deltaHead = head[0] ? parseDeltaWatermark(JSON.stringify(head[0])) : { cursorId: '0', traceId: '' };
    if (plan.paginationMode === 'delta' && !plan.deltaCursor) {
      return coreStorage.traceQueryResponseSchema.parse({
        traces: [],
        delta: { limit: plan.limit, hasMore: false },
        deltaCursor: coreStorage.encodeTraceQueryDeltaCursor(plan, 'clickhouse', JSON.stringify(deltaHead)),
      });
    }
  }
  if (plan.paginationMode === 'page') {
    const rows = await runWithClickHouseTraceQueryTimeout(
      client,
      { timeoutMs: deltaHead ? remaining() : timeoutMs },
      compileClickHouseTraceQuery(plan, deltaHead),
    );
    const total = Number(rows.at(-1)?.total ?? 0);
    const traces = await mapTraceRows(
      client,
      plan,
      rows.filter(row => Number(row.__metadata) === 0),
      remaining,
    );
    return coreStorage.traceQueryResponseSchema.parse({
      traces,
      ...(deltaHead
        ? { deltaCursor: coreStorage.encodeTraceQueryDeltaCursor(plan, 'clickhouse', JSON.stringify(deltaHead)) }
        : {}),
      pagination: {
        total,
        page: plan.page,
        perPage: plan.perPage,
        hasMore: (plan.page + 1) * plan.perPage < total,
      },
    });
  }

  const rows = await runWithClickHouseTraceQueryTimeout(
    client,
    { timeoutMs: deltaHead ? remaining() : timeoutMs },
    compileClickHouseTraceQuery(plan, deltaHead),
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

  const traces = await mapTraceRows(client, plan, visibleRows, remaining);
  const last = traces.at(-1);
  if (plan.paginationMode === 'delta') {
    const lastRow = visibleRows.at(-1);
    let watermark = lastRow
      ? { cursorId: String(lastRow.__delta_cursor), traceId: String(lastRow.traceId) }
      : deltaHead!;
    const previous = parseDeltaWatermark(coreStorage.getTraceQueryDeltaWatermark(plan, 'clickhouse')!);
    // Retention can empty the index; never move a continuation cursor backwards.
    if (
      BigInt(previous.cursorId) > BigInt(watermark.cursorId) ||
      (previous.cursorId === watermark.cursorId && previous.traceId > watermark.traceId)
    )
      watermark = previous;
    return coreStorage.traceQueryResponseSchema.parse({
      traces,
      delta: { limit: plan.limit, hasMore: rows.length > plan.limit },
      deltaCursor: coreStorage.encodeTraceQueryDeltaCursor(plan, 'clickhouse', JSON.stringify(watermark)),
    });
  }
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

export async function queryThreads(
  client: ClickHouseClient,
  plan: TrustedThreadQueryPlan,
  timeoutMs: number,
): Promise<QueryThreadsResult> {
  const rows = await runWithClickHouseTraceQueryTimeout(client, { timeoutMs }, compileClickHouseThreadQuery(plan));
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
