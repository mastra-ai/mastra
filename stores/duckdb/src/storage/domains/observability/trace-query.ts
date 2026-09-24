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

import type { DuckDBConnection } from '../../db/index';
import { parseJson } from './helpers';
import { assertDeltaPollingEnabled, deltaPollingFeatureEnabled } from './polling';

type ParameterType = 'scalar' | 'timestamp';
type FieldDefinition = { sql: string; parameterType: ParameterType };
type FieldRegistry<TField extends string> = Record<TField, FieldDefinition>;
type SqlFragment = { sql: string; values: unknown[] };
type RelatedCollection = 'spans' | 'scores' | 'feedback';

const TRACE_STATUS_SQL = `CASE WHEN r.error IS NOT NULL THEN 'error' ELSE 'success' END`;

function durationMsSql(startedAt: string, endedAt: string): string {
  return `date_diff('millisecond', ${startedAt}, ${endedAt})`;
}

const TRACE_FIELDS = {
  traceId: { sql: 'r.traceId', parameterType: 'scalar' },
  threadId: { sql: 'r.threadId', parameterType: 'scalar' },
  resourceId: { sql: 'r.resourceId', parameterType: 'scalar' },
  startedAt: { sql: 'r.startedAt', parameterType: 'timestamp' },
  endedAt: { sql: 'r.endedAt', parameterType: 'timestamp' },
  durationMs: { sql: durationMsSql('r.startedAt', 'r.endedAt'), parameterType: 'scalar' },
  modelCost: { sql: 'r.modelCost', parameterType: 'scalar' },
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

/** The table summary needs the root output and tags; other queries leave the blobs off the read path. */
function traceSelect(plan: TrustedTraceQueryPlan): string {
  let select = TRACE_SELECT;
  if (plan.result === 'traces' && plan.tableSummary) select += `,\n  r.output AS output,\n  r.tags AS tags`;
  if (coreStorage.traceQueryUsesModelCost(plan)) select += `,\n  r.modelCost AS modelCost`;
  return select;
}

/**
 * Complete model cost per trace from the current total-token metric rows, mirroring
 * `traceQueryModelCost` in core: sum per model call, then per trace, unavailable (NULL) when
 * any call is unpriced, errored, negative, non-finite, or priced in a unit other than USD.
 * `metricId` is the primary key, so retried exports never produce a second row.
 *
 * Positional parameters: the cost unit, the metric names, then `traceScope.values`.
 */
function traceCostsSql(traceScope: { sql: string; values: unknown[] }): SqlFragment {
  const names = coreStorage.TRACE_QUERY_MODEL_COST_METRICS.map(() => '?').join(', ');
  return {
    sql: `SELECT
      traceId,
      CASE WHEN bool_and(priced) AND NOT bool_or(invalid) THEN sum(cost) END AS modelCost
    FROM (
      SELECT
        m.traceId,
        sum(m.estimatedCost) AS cost,
        bool_or(m.estimatedCost IS NOT NULL) AS priced,
        bool_or(
          json_extract_string(m.costMetadata, '$.error') IS NOT NULL
          OR (
            m.estimatedCost IS NOT NULL
            AND (
              NOT (isfinite(m.estimatedCost) AND m.estimatedCost >= 0)
              OR m.costUnit IS NULL
              OR upper(m.costUnit) <> ?
            )
          )
        ) AS invalid
      FROM metric_events m
      WHERE m.name IN (${names})
        AND ${traceScope.sql}
      GROUP BY m.traceId, m.spanId
    ) calls
    GROUP BY traceId`,
    values: [
      coreStorage.TRACE_QUERY_MODEL_COST_UNIT,
      ...coreStorage.TRACE_QUERY_MODEL_COST_METRICS,
      ...traceScope.values,
    ],
  };
}

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

function compileDuckDBTraceScope(
  relatedCollections: Set<RelatedCollection>,
  scope: TraceQueryTenantScope | undefined,
  usesModelCost = false,
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
    `${usesModelCost ? 'root_scope_base' : 'root_scope'} AS (
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
  if (usesModelCost) {
    // Cost is rolled up once for the roots in scope and joined as a plain column, so
    // predicates, ordering, and keyset cursors treat it like any other root field.
    const costs = traceCostsSql({
      sql: ['m.traceId IN (SELECT traceId FROM root_scope_base)', ...tenantConditions('m')].join('\n        AND '),
      values: tenantValues,
    });
    ctes.push(
      `trace_costs AS (
      ${costs.sql}
    )`,
      `root_scope AS (
      SELECT b.*, tc.modelCost AS modelCost
      FROM root_scope_base b
      LEFT JOIN trace_costs tc ON tc.traceId = b.traceId
    )`,
    );
    values.push(...costs.values);
  }

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
        ${durationMsSql('startedAt', 'endedAt')} AS durationMs,
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
  const { ctes, values: scopeValues } = compileDuckDBTraceScope(
    relatedCollections,
    plan.scope,
    coreStorage.traceQueryUsesModelCost(plan),
  );
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
    SELECT ${traceSelect(plan)}${plan.paginationMode === 'delta' ? ', r.cursorId AS deltaWatermark' : ''}
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
  // Unavailable costs sort last in both directions so they never rank as cheapest or dearest.
  const direction = `${plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC'}${orderField === 'modelCost' ? ' NULLS LAST' : ''}`;
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
    if (plan.cursor.sortValue === null) {
      // The cursor sits inside the trailing unavailable block, where only traceId advances.
      pageCondition = `WHERE ${orderField} IS NULL AND traceId > ?`;
      values.push(plan.cursor.traceId);
    } else {
      const sortParameter = orderField === 'modelCost' ? '?' : 'CAST(? AS TIMESTAMP)';
      pageCondition = `WHERE (${orderField} ${comparison} ${sortParameter} OR (${orderField} = ${sortParameter} AND traceId > ?)${orderField === 'modelCost' ? ` OR ${orderField} IS NULL` : ''})`;
      values.push(plan.cursor.sortValue, plan.cursor.sortValue, plan.cursor.traceId);
    }
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
  const { ctes, values: scopeValues } = compileDuckDBTraceScope(
    relatedCollections,
    plan.scope,
    coreStorage.traceQueryUsesModelCost(plan),
  );
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

export function compileDuckDBTraceQueryObservedFields(
  plan: TrustedTraceQueryObservedFieldsPlan,
): CompiledDuckDBTraceQuery {
  const { ctes, values: scopeValues } = compileDuckDBTraceScope(new Set(), plan.scope);
  const values: unknown[] = [plan.timeRange.from, plan.timeRange.to, ...scopeValues];
  if (plan.search) values.push(plan.search);
  values.push(plan.limit + 1);
  const search = plan.search ? `AND strpos(lower('metadata.' || entry.key), lower(?)) > 0` : '';
  return {
    sql: `WITH ${ctes.join(',\n  ')}
SELECT 'metadata.' || entry.key AS path, count(*) AS occurrences
FROM root_scope r, LATERAL json_each(r.metadata) entry
WHERE entry.type = 'VARCHAR'
  AND trim(json_extract_string(entry.value, '$')) <> ''
  AND entry.key <> ''
  AND strpos(entry.key, '.') = 0
  AND octet_length(encode('metadata.' || entry.key)) <= ${coreStorage.TRACE_QUERY_MAX_PATH_BYTES}
  AND octet_length(encode(json_extract_string(entry.value, '$'))) <= ${coreStorage.TRACE_QUERY_MAX_STRING_BYTES}
  ${search}
GROUP BY entry.key
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
  if (plan.predicateScope === 'trace' && plan.path === 'tags') {
    // One row per (current root, distinct tag); unnest of NULL yields no rows.
    fieldSql = 'unnest(list_distinct(TRY_CAST(r.tags AS VARCHAR[])))';
    source = `${source} WHERE r.tags IS NOT NULL`;
  } else if (plan.predicateScope === 'trace' && plan.path.startsWith('metadata.')) {
    const jsonPath = `$.${JSON.stringify(plan.path.slice('metadata.'.length))}`;
    fieldSql = `NULLIF(trim(CASE WHEN json_type(r.metadata, ?) = 'VARCHAR' THEN json_extract_string(r.metadata, ?) END), '')`;
    values.push(jsonPath, jsonPath);
  } else {
    fieldSql = fieldDefinition(discoveryRegistry(plan.predicateScope), plan.path as TraceQueryCanonicalField).sql;
  }
  if (plan.search) values.push(plan.search);
  values.push(plan.limit + 1);
  const search = plan.search ? 'AND strpos(lower(CAST(value AS VARCHAR)), lower(?)) > 0' : '';
  return {
    sql: `WITH ${ctes.join(',\n  ')}, extracted AS (
  SELECT ${fieldSql} AS value FROM ${source}
)
SELECT CAST(value AS VARCHAR) AS value, count(*) AS count
FROM extracted
WHERE value IS NOT NULL
  AND octet_length(encode(CAST(value AS VARCHAR))) <= ${coreStorage.TRACE_QUERY_MAX_STRING_BYTES}
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
      .map(row => coreStorage.createTraceQueryObservedFieldDescriptor(String(row.path), Number(row.occurrences))),
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
    values: rows.slice(0, plan.limit).map(row => ({ value: String(row.value), count: Number(row.count) })),
    valuesTruncated: rows.length > plan.limit,
  });
}

function asIsoTimestamp(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(value as string | number).toISOString();
}

type TableSummaryRollup = NonNullable<coreStorage.TraceQueryTableSummaryInput['spans']> & {
  promptCacheReadTokens: number | null;
  promptCacheCreationTokens: number | null;
};

interface TableSummaryRows {
  rollups: Map<string, TableSummaryRollup>;
  feedback: Map<string, coreStorage.TraceQueryFeedbackSummary[]>;
  scores: Map<string, coreStorage.TraceQueryScoreSummary[]>;
  costs: Map<string, number | null>;
}

/**
 * Bounded side queries for the selected page only. Each reads the same current-record
 * shape as the trace scope, restricted to the page's trace IDs, and never touches
 * ordering or totals: the page query already fixed them.
 */
export function compileDuckDBTableSummaryQueries(
  scope: TraceQueryTenantScope | undefined,
  traceIds: string[],
): {
  rollups: CompiledDuckDBTraceQuery;
  feedback: CompiledDuckDBTraceQuery;
  scores: CompiledDuckDBTraceQuery;
  costs: CompiledDuckDBTraceQuery;
} {
  const ids = traceIds.map(() => '?').join(', ');
  const tenantConditions = (alias: string): string[] =>
    scope
      ? [`${alias}.organizationId = ?`, ...(scope.resourceId === undefined ? [] : [`${alias}.resourceId = ?`])]
      : [];
  const tenantValues = scope
    ? scope.resourceId === undefined
      ? [scope.organizationId]
      : [scope.organizationId, scope.resourceId]
    : [];
  const where = (alias: string): { sql: string; values: unknown[] } => ({
    sql: [`${alias}.traceId IN (${ids})`, ...tenantConditions(alias)].join('\n        AND '),
    values: [...traceIds, ...tenantValues],
  });
  const list = (types: readonly string[]) => types.map(type => `'${type}'`).join(', ');
  const relatedLimit = coreStorage.TRACE_QUERY_TABLE_SUMMARY_RELATED_LIMIT + 1;

  const spanWhere = where('e');
  const metricWhere = where('m');
  const rollups: CompiledDuckDBTraceQuery = {
    sql: `WITH current_span_rows AS (
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
      WHERE ${spanWhere.sql}
    ),
    current_spans AS (
      SELECT traceId, spanId, spanType, error, startedAt, attributes
      FROM current_span_rows
      WHERE currentRank = 1
    ),
    model_spans AS (
      SELECT
        traceId,
        CASE WHEN json_type(attributes, '$.model') = 'VARCHAR' THEN json_extract_string(attributes, '$.model') END AS model,
        ${durationMsSql('startedAt', `TRY_CAST(json_extract_string(attributes, '$.completionStartTime') AS TIMESTAMP)`)} AS timeToFirstTokenMs,
        row_number() OVER (PARTITION BY traceId ORDER BY startedAt ASC, spanId ASC) AS modelRank
      FROM current_spans
      WHERE spanType IN (${list(coreStorage.TRACE_QUERY_TABLE_SUMMARY_MODEL_SPAN_TYPES)})
    ),
    metric_sums AS (
      SELECT
        m.traceId,
        sum(m.value) FILTER (WHERE m.name = ?) AS promptCacheReadTokens,
        sum(m.value) FILTER (WHERE m.name = ?) AS promptCacheCreationTokens
      FROM metric_events m
      INNER JOIN current_spans c ON c.traceId = m.traceId AND c.spanId = m.spanId
      WHERE ${metricWhere.sql}
        AND m.name IN (?, ?)
      GROUP BY m.traceId
    )
SELECT
  c.traceId AS traceId,
  count(*) FILTER (WHERE c.error IS NOT NULL) AS errorTotal,
  count(*) FILTER (WHERE c.error IS NOT NULL AND c.spanType IN (${list(coreStorage.TRACE_QUERY_TABLE_SUMMARY_LLM_SPAN_TYPES)})) AS errorLlm,
  count(*) FILTER (WHERE c.error IS NOT NULL AND c.spanType IN (${list(coreStorage.TRACE_QUERY_TABLE_SUMMARY_TOOL_SPAN_TYPES)})) AS errorTool,
  any_value(ms.model) AS model,
  any_value(ms.timeToFirstTokenMs) AS timeToFirstTokenMs,
  any_value(mt.promptCacheReadTokens) AS promptCacheReadTokens,
  any_value(mt.promptCacheCreationTokens) AS promptCacheCreationTokens
FROM current_spans c
LEFT JOIN model_spans ms ON ms.traceId = c.traceId AND ms.modelRank = 1
LEFT JOIN metric_sums mt ON mt.traceId = c.traceId
GROUP BY c.traceId`,
    values: [
      ...spanWhere.values,
      coreStorage.TRACE_QUERY_TABLE_SUMMARY_METRICS.promptCacheReadTokens,
      coreStorage.TRACE_QUERY_TABLE_SUMMARY_METRICS.promptCacheCreationTokens,
      ...metricWhere.values,
      coreStorage.TRACE_QUERY_TABLE_SUMMARY_METRICS.promptCacheReadTokens,
      coreStorage.TRACE_QUERY_TABLE_SUMMARY_METRICS.promptCacheCreationTokens,
    ],
  };

  const feedbackWhere = where('f');
  const feedback: CompiledDuckDBTraceQuery = {
    sql: `SELECT *
FROM (
  SELECT
    f.traceId, f.feedbackId, f.feedbackType, f.feedbackSource, f.value, f.valueString, f.valueNumber, f.comment, f.timestamp,
    row_number() OVER (PARTITION BY f.traceId ORDER BY f.timestamp DESC, f.feedbackId ASC) AS relatedRank
  FROM feedback_events f
  WHERE ${feedbackWhere.sql}
)
WHERE relatedRank <= ?
ORDER BY traceId ASC, relatedRank ASC`,
    values: [...feedbackWhere.values, relatedLimit],
  };

  const scoreWhere = where('s');
  const scores: CompiledDuckDBTraceQuery = {
    sql: `SELECT *
FROM (
  SELECT
    s.traceId, s.scoreId, s.scorerId, s.scorerVersion, s.scoreSource, s.score, s.timestamp, s.spanId,
    row_number() OVER (PARTITION BY s.traceId ORDER BY s.timestamp DESC, s.scoreId ASC) AS relatedRank
  FROM score_events s
  WHERE ${scoreWhere.sql}
)
WHERE relatedRank <= ?
ORDER BY traceId ASC, relatedRank ASC`,
    values: [...scoreWhere.values, relatedLimit],
  };

  const costs = traceCostsSql(where('m'));

  return { rollups, feedback, scores, costs };
}

function nullableNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}

async function loadTableSummaryRows(
  db: DuckDBConnection,
  scope: TraceQueryTenantScope | undefined,
  traceIds: string[],
): Promise<TableSummaryRows> {
  const result: TableSummaryRows = { rollups: new Map(), feedback: new Map(), scores: new Map(), costs: new Map() };
  if (traceIds.length === 0) return result;
  const queries = compileDuckDBTableSummaryQueries(scope, traceIds);
  const [rollupRows, feedbackRows, scoreRows, costRows] = await Promise.all([
    db.query<Record<string, unknown>>(queries.rollups.sql, queries.rollups.values),
    db.query<Record<string, unknown>>(queries.feedback.sql, queries.feedback.values),
    db.query<Record<string, unknown>>(queries.scores.sql, queries.scores.values),
    db.query<Record<string, unknown>>(queries.costs.sql, queries.costs.values),
  ]);
  for (const row of costRows) result.costs.set(String(row.traceId), nullableNumber(row.modelCost));
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
      value: row.valueNumber != null ? Number(row.valueNumber) : String(row.valueString ?? row.value ?? ''),
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
            modelCost: summaries.costs.get(traceId) ?? null,
          }),
        }
      : {}),
  };
}

async function mapTraceRows(db: DuckDBConnection, plan: TrustedTraceQueryPlan, rows: Record<string, unknown>[]) {
  const summaries =
    plan.result === 'traces' && plan.tableSummary
      ? await loadTableSummaryRows(
          db,
          plan.scope,
          rows.map(row => String(row.traceId)),
        )
      : undefined;
  return rows.map(row => traceRowToResult(row, summaries));
}

export async function queryTraces(db: DuckDBConnection, plan: TrustedTraceQueryPlan): Promise<TraceQueryResponse> {
  if (plan.paginationMode === 'delta') assertDeltaPollingEnabled();
  if (plan.paginationMode === 'page') {
    const query = compileDuckDBTraceQuery(plan);
    const rows = await db.query<Record<string, unknown>>(query.sql, query.values);
    const total = Number(rows[0]?.total ?? 0);
    const traces = await mapTraceRows(
      db,
      plan,
      rows.filter(row => row.traceId != null),
    );
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

  const traces = await mapTraceRows(db, plan, visibleRows);
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
              sortValue: keysetSortValue(plan, visibleRows.at(-1)!, last),
              traceId: last.traceId,
            })
          : null,
    },
  });
}

/** Sort value for the next keyset cursor: the ordered timestamp, or the cost column (null when unavailable). */
function keysetSortValue(
  plan: Extract<TrustedTraceQueryPlan, { result: 'traces' }>,
  row: Record<string, unknown>,
  trace: { startedAt: string; endedAt: string },
): coreStorage.TraceQueryCursorSortValue {
  if (plan.orderBy.field === 'modelCost') return nullableNumber(row.modelCost);
  return trace[plan.orderBy.field];
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
