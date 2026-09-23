import * as coreStorage from '@mastra/core/storage';
import type {
  GetTraceQueryValuesResponse,
  QueryThreadsResult,
  TraceQueryCanonicalField,
  TraceQueryObservedFieldsResult,
  TraceQueryFeedbackField,
  TraceQueryPredicateScope,
  TraceQueryField,
  TraceQueryResponse,
  TraceQueryScoreField,
  TraceQuerySpanField,
  TraceQueryStructuredRoot,
  TraceQueryTenantScope,
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
import { assertDeltaPollingEnabled, deltaPollingFeatureEnabled } from './polling';

type ParameterType = 'scalar' | 'timestamp';
type FieldDefinition = { sql: string; parameterType: ParameterType };
type FieldRegistry<TField extends string> = Record<TField, FieldDefinition>;
type StructuredRootExpressions = Partial<Record<TraceQueryStructuredRoot, string>>;
type SqlFragment = { sql: string; values: unknown[] };
type RelatedCollection = 'spans' | 'scores' | 'feedback';

const TRACE_STATUS_SQL = `CASE WHEN r.error IS NOT NULL THEN 'error' ELSE 'success' END`;
const TRACE_STRUCTURED_ROOTS = { metadata: 'r.metadata' } satisfies StructuredRootExpressions;

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
  tags: { sql: 'r.tags', parameterType: 'scalar' },
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

function structuredJsonPointer(segments: string[]): string {
  return `/${segments.map(segment => segment.replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`;
}

function structuredObjectPathGuard(jsonExpression: string, segments: string[]): { sql: string; values: string[] } {
  const values = segments.slice(0, -1).map((_, index) => structuredJsonPointer(segments.slice(0, index + 1)));
  return {
    sql: values.map(() => `json_type(${jsonExpression}, ?) = 'OBJECT'`).join(' AND '),
    values,
  };
}

function compileStructuredScalarField(
  jsonExpression: string,
  segments: string[],
  sample: string | number | boolean | undefined,
): { field: FieldDefinition; values: unknown[] } {
  const path = structuredJsonPointer(segments);
  const objectPathGuard = structuredObjectPathGuard(jsonExpression, segments);
  const guard = objectPathGuard.sql ? `${objectPathGuard.sql} AND ` : '';
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
      ? `TRY_CAST(json_extract_string(${jsonExpression}, ?) AS DOUBLE)`
      : kind === 'boolean'
        ? `TRY_CAST(json_extract_string(${jsonExpression}, ?) AS BOOLEAN)`
        : `json_extract_string(${jsonExpression}, ?)`;
  return {
    field: {
      sql: `CASE WHEN ${guard}json_type(${jsonExpression}, ?) IN (${types}) THEN ${extract} END`,
      parameterType: 'scalar',
    },
    values: [...objectPathGuard.values, path, path],
  };
}

function compileScalarPredicate<TField extends string>(
  predicate: TrustedTraceQueryScalarPredicate,
  registry: Partial<FieldRegistry<TField>>,
  structuredRoots: StructuredRootExpressions = {},
): SqlFragment {
  if (predicate.type === 'boolean') {
    const values: unknown[] = [];
    const parts = predicate.args.map(arg => {
      const compiled = compileScalarPredicate(arg, registry, structuredRoots);
      values.push(...compiled.values);
      return `(${compiled.sql})`;
    });
    return { sql: parts.join(predicate.operator === 'and' ? ' AND ' : ' OR '), values };
  }

  if (predicate.type === 'not') {
    const compiled = compileScalarPredicate(predicate.arg, registry, structuredRoots);
    return { sql: `NOT (${compiled.sql})`, values: compiled.values };
  }

  let field: FieldDefinition;
  let fieldValues: unknown[] = [];
  if (Array.isArray(predicate.field)) {
    const jsonExpression = structuredRoots[predicate.field[0]];
    if (!jsonExpression) throw new Error('Unsupported structured trace-query field');
    const sample =
      predicate.type === 'comparison'
        ? predicate.value
        : predicate.type === 'membership'
          ? predicate.values[0]
          : undefined;
    const compiled = compileStructuredScalarField(jsonExpression, predicate.field.slice(1), sample);
    field = compiled.field;
    fieldValues = compiled.values;
  } else {
    field = fieldDefinition(registry, predicate.field);
  }

  if (predicate.type === 'presence') {
    return {
      sql: `${field.sql} IS ${predicate.operator === 'exists' ? 'NOT ' : ''}NULL`,
      values: fieldValues,
    };
  }

  if (predicate.type === 'collection') {
    // Missing, empty, and non-array JSON all mean "no members", so every branch yields a real boolean.
    const members = `coalesce(TRY_CAST(${field.sql} AS VARCHAR[]), []::VARCHAR[])`;
    if (!('value' in predicate)) {
      return { sql: `len(${members}) ${predicate.operator === 'empty' ? '=' : '>'} 0`, values: fieldValues };
    }
    if (predicate.operator === 'includes') {
      return { sql: `list_contains(${members}, ?)`, values: [...fieldValues, predicate.value] };
    }
    return {
      sql: `len(${members}) > 0 AND NOT list_contains(${members}, ?)`,
      values: [...fieldValues, ...fieldValues, predicate.value],
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
  if (predicate.field !== 'value' || predicate.type === 'collection') {
    return compileScalarPredicate(predicate, FEEDBACK_FIELDS);
  }
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

  return compileScalarPredicate(predicate, TRACE_FIELDS, TRACE_STRUCTURED_ROOTS);
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

function compileDuckDBTraceScope(
  relatedCollections: Set<RelatedCollection>,
  scope: TraceQueryTenantScope | undefined,
): { ctes: string[]; values: unknown[] } {
  // Rows with a NULL organizationId never match a scope: `NULL = ?` is not true.
  const tenantConditions = (alias: string): string[] =>
    scope
      ? [`${alias}.organizationId = ?`, ...(scope.resourceId === undefined ? [] : [`${alias}.resourceId = ?`])]
      : [];
  const tenantValues = scope
    ? scope.resourceId === undefined
      ? [scope.organizationId]
      : [scope.organizationId, scope.resourceId]
    : [];
  const tenantWhere = (alias: string): string => {
    const conditions = tenantConditions(alias);
    return conditions.length ? `\n      WHERE ${conditions.join(' AND ')}` : '';
  };
  const values: unknown[] = [...tenantValues];
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
      WHERE ${[
        'r.endedAt IS NOT NULL',
        'r.startedAt >= CAST(? AS TIMESTAMP)',
        'r.startedAt < CAST(? AS TIMESTAMP)',
        ...tenantConditions('r'),
      ].join('\n        AND ')}
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
      INNER JOIN root_scope roots ON roots.traceId = e.traceId${tenantWhere('e')}
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
    values.push(...tenantValues);
  }

  if (relatedCollections.has('scores')) {
    ctes.push(`current_scores AS (
      SELECT s.*
      FROM score_events s
      INNER JOIN root_scope roots ON roots.traceId = s.traceId${tenantWhere('s')}
    )`);
    values.push(...tenantValues);
  }

  if (relatedCollections.has('feedback')) {
    ctes.push(`current_feedback AS (
      SELECT f.*
      FROM feedback_events f
      INNER JOIN root_scope roots ON roots.traceId = f.traceId${tenantWhere('f')}
    )`);
    values.push(...tenantValues);
  }

  return { ctes, values };
}

export function compileDuckDBTraceQuery(plan: TrustedTraceQueryPlan): CompiledDuckDBTraceQuery {
  const relatedCollections = collectRelatedCollections(plan.where);
  const { ctes, values: scopeValues } = compileDuckDBTraceScope(relatedCollections, plan.scope);
  const values: unknown[] = [plan.timeRange.from, plan.timeRange.to, ...scopeValues];
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

  ctes.push(`candidates AS (
    SELECT ${TRACE_SELECT}${plan.paginationMode === 'delta' ? ', r.cursorId AS deltaWatermark' : ''}
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

  if (plan.paginationMode === 'delta') {
    const watermark = coreStorage.getTraceQueryDeltaWatermark(plan, 'duckdb');
    if (watermark !== undefined && (!/^\d+$/.test(watermark) || BigInt(watermark) > 9223372036854775807n)) {
      throw new coreStorage.TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
    }
    values.push(watermark ?? '0', plan.limit + 1);
    return {
      sql: `${candidates},
  delta_head AS (SELECT coalesce(max(cursorId), 0) AS streamHead FROM root_events),
  delta_rows AS (
    SELECT * FROM candidates
    WHERE deltaWatermark > CAST(? AS BIGINT) ${watermark === undefined ? 'AND FALSE' : ''}
    ORDER BY deltaWatermark ASC, traceId ASC
    LIMIT ?
  )
SELECT delta_rows.*, delta_head.streamHead
FROM delta_head
LEFT JOIN delta_rows ON TRUE
ORDER BY delta_rows.deltaWatermark ASC NULLS LAST, delta_rows.traceId ASC`,
      values,
    };
  }

  const orderField = plan.orderBy.field;
  const direction = plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC';
  if (plan.paginationMode === 'page') {
    values.push(plan.perPage, plan.page * plan.perPage);
    return {
      sql: `${candidates},
  page_rows AS (
    SELECT *, row_number() OVER (ORDER BY ${orderField} ${direction}, traceId ASC) AS __row_position
    FROM candidates
    ORDER BY ${orderField} ${direction}, traceId ASC
    LIMIT ? OFFSET ?
  ),
  page_total AS (
    SELECT COUNT(*) AS total
    FROM candidates
  )
SELECT page_rows.*, page_total.total${deltaPollingFeatureEnabled() ? ', (SELECT coalesce(max(cursorId), 0) FROM root_events) AS streamHead' : ''}
FROM page_total
LEFT JOIN page_rows ON TRUE
ORDER BY page_rows.__row_position ASC NULLS LAST`,
      values,
    };
  }

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
  const relatedCollections = collectRelatedCollections(plan.traces.where);
  collectThreadRelatedCollections(plan.where, relatedCollections);
  const { ctes, values: scopeValues } = compileDuckDBTraceScope(relatedCollections, plan.scope);
  const values: unknown[] = [plan.traces.timeRange.from, plan.traces.timeRange.to, ...scopeValues];

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

type StructuredDiscoveryRoot = {
  root: TraceQueryStructuredRoot;
  relation: string;
  jsonExpression: string;
};

const STRUCTURED_DISCOVERY_ROOTS = {
  trace: [{ root: 'metadata', relation: 'root_scope r', jsonExpression: 'r.metadata' }],
  spans: [],
  scores: [],
  feedback: [],
} as const satisfies Record<TraceQueryPredicateScope, readonly StructuredDiscoveryRoot[]>;

function structuredDiscoveryRoots(plan: TrustedTraceQueryObservedFieldsPlan): readonly StructuredDiscoveryRoot[] {
  return STRUCTURED_DISCOVERY_ROOTS[plan.predicateScope].filter(descriptor =>
    plan.structuredRoots.includes(descriptor.root),
  );
}

function structuredDiscoveryRoot(
  plan: TrustedTraceQueryValuesPlan,
  root: TraceQueryStructuredRoot,
): StructuredDiscoveryRoot {
  const descriptor = structuredDiscoveryRoots(plan).find(candidate => candidate.root === root);
  if (!descriptor) throw new Error('Unsupported structured discovery path');
  return descriptor;
}

export function compileDuckDBTraceQueryObservedFields(
  plan: TrustedTraceQueryObservedFieldsPlan,
): CompiledDuckDBTraceQuery {
  const roots = structuredDiscoveryRoots(plan);
  if (roots.length === 0) throw new Error('Unsupported structured discovery scope');
  const { ctes, values: scopeValues } = compileDuckDBTraceScope(discoveryCollections(plan.predicateScope), plan.scope);
  const values: unknown[] = [plan.timeRange.from, plan.timeRange.to, ...scopeValues];
  if (plan.search) values.push(plan.search);
  values.push(plan.limit + 1);
  const search = plan.search ? `AND strpos(lower(array_to_string(segments, '.')), lower(?)) > 0` : '';
  const seeds = roots
    .map(
      descriptor =>
        `SELECT ['${descriptor.root}'] AS segments, ${descriptor.jsonExpression} AS leaf, false AS requires_exact FROM ${descriptor.relation}`,
    )
    .join('\n  UNION ALL\n  ');
  return {
    sql: `WITH RECURSIVE ${ctes.join(',\n  ')}, structured_tree AS (
  ${seeds}
  UNION ALL
  SELECT list_append(segments, entry.key), entry.value, requires_exact OR strpos(entry.key, '.') > 0
  FROM structured_tree, LATERAL json_each(CASE WHEN json_type(leaf) = 'OBJECT' THEN leaf ELSE '{}'::JSON END) entry
  WHERE len(segments) < ${coreStorage.TRACE_QUERY_MAX_PATH_SEGMENTS}
    AND entry.key <> '' AND strpos(entry.key, chr(0)) = 0
    AND octet_length(encode(entry.key)) <= ${coreStorage.TRACE_QUERY_MAX_PATH_SEGMENT_BYTES}
    AND octet_length(encode(array_to_string(list_append(segments, entry.key), '.'))) <= ${coreStorage.TRACE_QUERY_MAX_PATH_BYTES}
), fields AS (
  SELECT segments,
    CASE WHEN requires_exact THEN CAST(to_json(segments) AS VARCHAR) ELSE array_to_string(segments, '.') END AS path,
    CASE json_type(leaf)
      WHEN 'VARCHAR' THEN 'string'
      WHEN 'BOOLEAN' THEN 'boolean'
      ELSE 'number'
    END AS value_kind
  FROM structured_tree
  WHERE len(segments) > 1
    AND json_type(leaf) IN ('VARCHAR', 'BIGINT', 'UBIGINT', 'DOUBLE', 'BOOLEAN')
    AND (json_type(leaf) <> 'VARCHAR' OR octet_length(encode(json_extract_string(leaf, '$'))) <= ${coreStorage.TRACE_QUERY_MAX_STRING_BYTES})
), grouped_fields AS (
  SELECT path, count(*) AS occurrences,
    CASE WHEN count(DISTINCT value_kind) = 1 THEN min(value_kind) ELSE 'scalar' END AS value_kind
  FROM fields
  WHERE true ${search}
  GROUP BY path
)
SELECT path, occurrences, value_kind
FROM grouped_fields
ORDER BY occurrences DESC, path ASC
LIMIT ?`,
    values,
  };
}

export function compileDuckDBTraceQueryValues(plan: TrustedTraceQueryValuesPlan): CompiledDuckDBTraceQuery {
  const { ctes, values: scopeValues } = compileDuckDBTraceScope(discoveryCollections(plan.predicateScope), plan.scope);
  const values: unknown[] = [plan.timeRange.from, plan.timeRange.to, ...scopeValues];
  let fieldSql: string;
  let source = discoverySource(plan.predicateScope);
  if (Array.isArray(plan.path)) {
    const descriptor = structuredDiscoveryRoot(plan, plan.path[0]);
    const segments = plan.path.slice(1);
    const jsonPointer = structuredJsonPointer(segments);
    const objectPathGuard = structuredObjectPathGuard(descriptor.jsonExpression, segments);
    const guard = objectPathGuard.sql ? `${objectPathGuard.sql} AND ` : '';
    fieldSql = `CASE WHEN ${guard}json_type(${descriptor.jsonExpression}, ?) IN ('VARCHAR', 'BIGINT', 'UBIGINT', 'DOUBLE', 'BOOLEAN') THEN json_extract(${descriptor.jsonExpression}, ?) END`;
    source = descriptor.relation;
    values.push(...objectPathGuard.values, jsonPointer, jsonPointer);
  } else if (plan.predicateScope === 'trace' && plan.path === 'tags') {
    // One row per (current root, distinct tag); unnest of NULL yields no rows.
    fieldSql = 'unnest(list_distinct(TRY_CAST(r.tags AS VARCHAR[])))';
    source = `${source} WHERE r.tags IS NOT NULL`;
  } else {
    fieldSql = fieldDefinition(discoveryRegistry(plan.predicateScope), plan.path as TraceQueryCanonicalField).sql;
  }
  if (plan.search) values.push(plan.search);
  values.push(plan.limit + 1);
  const searchableValue = Array.isArray(plan.path) ? `json_extract_string(value, '$')` : 'CAST(value AS VARCHAR)';
  const search = plan.search ? `AND strpos(lower(${searchableValue}), lower(?)) > 0` : '';
  return {
    sql: `WITH ${ctes.join(',\n  ')}, extracted AS (
  SELECT ${fieldSql} AS value FROM ${source}
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
  if (structuredDiscoveryRoots(plan).length === 0) return { observedFields: [], observedFieldsTruncated: false };
  const query = compileDuckDBTraceQueryObservedFields(plan);
  const rows = await runDuckDBDiscoveryQuery(db, query);
  return {
    observedFields: rows
      .slice(0, plan.limit)
      .map(row =>
        coreStorage.createTraceQueryObservedFieldDescriptor(
          String(row.path).startsWith('[') ? JSON.parse(String(row.path)) : String(row.path),
          Number(row.occurrences),
          coreStorage.traceQueryObservedValueKindSchema.parse(row.value_kind),
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
  if (plan.paginationMode === 'delta') assertDeltaPollingEnabled();
  if (plan.paginationMode === 'page') {
    const query = compileDuckDBTraceQuery(plan);
    const rows = await db.query<Record<string, unknown>>(query.sql, query.values);
    const total = Number(rows[0]?.total ?? 0);
    const traces = rows
      .filter(row => row.traceId != null)
      .map(row => ({
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
    return coreStorage.traceQueryResponseSchema.parse({
      traces,
      // The list-polling feature predates the trace-query cursor encoder.
      ...(deltaPollingFeatureEnabled() && typeof coreStorage.encodeTraceQueryDeltaCursor === 'function'
        ? { deltaCursor: coreStorage.encodeTraceQueryDeltaCursor(plan, 'duckdb', String(rows[0]?.streamHead ?? 0)) }
        : {}),
      pagination: {
        total,
        page: plan.page,
        perPage: plan.perPage,
        hasMore: (plan.page + 1) * plan.perPage < total,
      },
    });
  }

  const query = compileDuckDBTraceQuery(plan);
  const rows = await db.query<Record<string, unknown>>(query.sql, query.values);
  const matchingRows = plan.paginationMode === 'delta' ? rows.filter(row => row.traceId != null) : rows;
  const visibleRows = matchingRows.slice(0, plan.limit);

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
  if (plan.paginationMode === 'delta') {
    const previous = coreStorage.getTraceQueryDeltaWatermark(plan, 'duckdb') ?? '0';
    const head = String(rows[0]?.streamHead ?? 0);
    const watermark = visibleRows.length
      ? String(visibleRows.at(-1)!.deltaWatermark)
      : BigInt(head) > BigInt(previous)
        ? head
        : previous;
    return coreStorage.traceQueryResponseSchema.parse({
      traces,
      delta: { limit: plan.limit, hasMore: matchingRows.length > plan.limit },
      deltaCursor: coreStorage.encodeTraceQueryDeltaCursor(plan, 'duckdb', watermark),
    });
  }
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
