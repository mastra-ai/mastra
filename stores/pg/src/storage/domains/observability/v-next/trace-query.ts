import * as coreStorage from '@mastra/core/storage';
import type {
  GetTraceQueryValuesResponse,
  QueryThreadsResult,
  TraceQueryCanonicalField,
  TraceQueryObservedFieldsResult,
  TraceQueryFeedbackField,
  TraceQueryField,
  TraceQueryPredicateField,
  TraceQueryTenantScope,
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

import type { DbClient, TxClient } from '../../../client';
import {
  qualifiedTable,
  TABLE_FEEDBACK_EVENTS,
  TABLE_METRIC_EVENTS,
  TABLE_SCORE_EVENTS,
  TABLE_SPAN_EVENTS,
} from './ddl';
import {
  assertDeltaPollingEnabled,
  decodeDeltaCursor,
  deltaPollingFeatureEnabled,
  encodeDeltaCursor,
  readSafeXactHorizon,
} from './polling';
import { latestScorePredicate } from './scores';

type SqlFragment = { sql: string; values: unknown[] };
type FieldRegistry<TField extends string> = Record<TField, string>;
type RelatedCollection = 'spans' | 'scores' | 'feedback';
type TraceSelection = {
  timeRange: { from: string; to: string };
  where?: TrustedTraceQueryPredicate;
};

const TRACE_STATUS_SQL = `CASE WHEN r."error" IS NOT NULL THEN 'error' ELSE 'success' END`;

function durationMsSql(startedAt: string, endedAt: string): string {
  return `EXTRACT(EPOCH FROM (${endedAt} - ${startedAt}))::numeric * 1000`;
}

const TRACE_FIELDS = {
  traceId: 'r."traceId"',
  threadId: 'r."threadId"',
  resourceId: 'r."resourceId"',
  startedAt: 'r."startedAt"',
  endedAt: 'r."endedAt"',
  durationMs: durationMsSql('r."startedAt"', 'r."endedAt"'),
  entityName: 'r."entityName"',
  entityType: 'r."entityType"',
  environment: 'r."environment"',
  status: TRACE_STATUS_SQL,
  tags: 'r."tags"',
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

const FEEDBACK_FIELDS = {
  feedbackType: 's."feedbackType"',
  feedbackSource: 's."feedbackSource"',
  feedbackUserId: 's."feedbackUserId"',
  sourceId: 's."sourceId"',
  entityVersionId: 's."entityVersionId"',
  parentEntityVersionId: 's."parentEntityVersionId"',
  rootEntityVersionId: 's."rootEntityVersionId"',
  timestamp: 's."timestamp"',
  comment: 's."comment"',
} satisfies FieldRegistry<Exclude<TraceQueryFeedbackField, 'value'>>;

const TRACE_SELECT = `
  r."traceId" AS "traceId",
  r."spanId" AS "rootSpanId",
  r."name" AS "name",
  r."entityId" AS "entityId",
  r."parentSpanId" AS "parentSpanId",
  r."metadataRaw" AS "metadata",
  r."input" AS "input",
  r."threadId" AS "threadId",
  r."resourceId" AS "resourceId",
  r."startedAt" AS "startedAt",
  r."endedAt" AS "endedAt",
  r."entityName" AS "entityName",
  r."entityType" AS "entityType",
  r."environment" AS "environment",
  ${TRACE_STATUS_SQL} AS "status"`;

/** The table summary needs the root output and tags; other queries leave the blobs off the read path. */
function traceSelect(plan: TrustedTraceQueryPlan): string {
  return plan.result === 'traces' && plan.tableSummary
    ? `${TRACE_SELECT},\n  r."output" AS "output",\n  r."tags" AS "tags"`
    : TRACE_SELECT;
}

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
    field = `COALESCE(
      CASE WHEN jsonb_typeof(r."metadataSearch" -> ${keyParameter}) = 'string' THEN r."metadataSearch" ->> ${keyParameter} END,
      CASE WHEN jsonb_typeof(r."metadataRaw" -> ${keyParameter}) = 'string' THEN NULLIF(btrim(r."metadataRaw" ->> ${keyParameter}), '') END
    )`;
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

  if (predicate.type === 'collection') {
    // `tags` is `text[] NOT NULL DEFAULT '{}'`, so an empty list is the only "no tags" shape.
    if (predicate.operator === 'includes' || predicate.operator === 'notIncludes') {
      const contains = `${field} @> ARRAY[$${parameterOffset}]::text[]`;
      return {
        sql: predicate.operator === 'includes' ? contains : `cardinality(${field}) > 0 AND NOT (${contains})`,
        values: [...fieldValues, predicate.value],
      };
    }
    return { sql: `cardinality(${field}) ${predicate.operator === 'empty' ? '=' : '>'} 0`, values: fieldValues };
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

function compileFeedbackScalarPredicate(
  predicate: TrustedTraceQueryScalarPredicate,
  parameterOffset: number,
): SqlFragment {
  if (predicate.type === 'boolean') {
    const values: unknown[] = [];
    const parts = predicate.args.map(arg => {
      const compiled = compileFeedbackScalarPredicate(arg, parameterOffset + values.length);
      values.push(...compiled.values);
      return `(${compiled.sql})`;
    });
    return { sql: parts.join(predicate.operator === 'and' ? ' AND ' : ' OR '), values };
  }
  if (predicate.type === 'not') {
    const compiled = compileFeedbackScalarPredicate(predicate.arg, parameterOffset);
    return { sql: `NOT (${compiled.sql})`, values: compiled.values };
  }
  if (predicate.field !== 'value') {
    return compileScalarPredicate(predicate, FEEDBACK_FIELDS, parameterOffset);
  }
  if (predicate.type === 'collection') throw new Error(`Unsupported trusted trace-query field: ${predicate.field}`);
  if (predicate.type === 'presence') {
    const present = `(s."valueString" IS NOT NULL OR s."valueNumber" IS NOT NULL)`;
    return { sql: predicate.operator === 'exists' ? present : `NOT ${present}`, values: [] };
  }
  const sample = predicate.type === 'membership' ? predicate.values[0] : predicate.value;
  const field = typeof sample === 'number' ? 's."valueNumber"' : 's."valueString"';
  return compileScalarPredicate(predicate, { value: field }, parameterOffset);
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

function latestFeedbackPredicate(feedbackTable: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM ${feedbackTable} newer
    WHERE newer."feedbackId" = s."feedbackId"
      AND newer."cursorId" > s."cursorId"
  )`;
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

function compilePredicate(predicate: TrustedTraceQueryPredicate, parameterOffset: number): SqlFragment {
  if (predicate.type === 'relation') {
    const compiled =
      predicate.collection === 'feedback'
        ? compileFeedbackScalarPredicate(predicate.predicate, parameterOffset)
        : compileScalarPredicate(
            predicate.predicate,
            predicate.collection === 'spans' ? SPAN_FIELDS : SCORE_FIELDS,
            parameterOffset,
          );
    const table =
      predicate.collection === 'spans'
        ? 'current_spans'
        : predicate.collection === 'scores'
          ? 'current_scores'
          : 'current_feedback';
    const existence = `EXISTS (
      SELECT 1 FROM ${table} s
      WHERE s."traceId" IS NOT NULL
        AND s."traceId" = r."traceId"
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

function compileThreadPredicate(predicate: TrustedThreadPredicate, parameterOffset: number): SqlFragment {
  if (predicate.type === 'relation') {
    const compiled = compilePredicate(predicate.predicate, parameterOffset);
    const existence = `EXISTS (
      SELECT 1 FROM eligible_roots r
      WHERE r."threadId" = t."threadId"
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
      const compiled = compileThreadPredicate(arg, parameterOffset + values.length);
      values.push(...compiled.values);
      return `(${compiled.sql})`;
    });
    return { sql: parts.join(predicate.operator === 'and' ? ' AND ' : ' OR '), values };
  }

  const compiled = compileThreadPredicate(predicate.arg, parameterOffset);
  return { sql: `NOT (${compiled.sql})`, values: compiled.values };
}

export interface CompiledPostgresTraceQuery {
  text: string;
  values: unknown[];
}

function compilePostgresTraceScope(
  schema: string,
  selection: TraceSelection,
  relationCollections: Set<RelatedCollection>,
  scope: TraceQueryTenantScope | undefined,
  deltaWindow?: { xactId: string; cursorId: string; safeHorizon: string },
): { ctes: string[]; values: unknown[] } {
  const spanTable = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const scoreTable = qualifiedTable(schema, TABLE_SCORE_EVENTS);
  const feedbackTable = qualifiedTable(schema, TABLE_FEEDBACK_EVENTS);
  const values: unknown[] = [selection.timeRange.from, selection.timeRange.to];
  // The delta window binds fixed positions $3..$5, so it must be pushed before the
  // dynamically numbered tenant scope values.
  const deltaConditions: string[] = [];
  if (deltaWindow) {
    values.push(deltaWindow.xactId, deltaWindow.cursorId, deltaWindow.safeHorizon);
    // Restrict candidates before materializing roots and their related records.
    // latestRootPredicate must still see replacements outside this interval.
    deltaConditions.push(`(r."xactId", r."cursorId") > ($3::xid8, $4::bigint)`, `r."xactId" < $5::xid8`);
  }
  // Tenant scope is ANDed into every scan (roots and related signals) so a related
  // row from another tenant sharing a traceId can never match.
  const scopeConditions: string[] = [];
  if (scope) {
    values.push(scope.organizationId);
    scopeConditions.push(`"organizationId" = $${values.length}`);
    if (scope.resourceId !== undefined) {
      values.push(scope.resourceId);
      scopeConditions.push(`"resourceId" = $${values.length}`);
    }
  }
  const scopeSql = (alias: string): string =>
    scopeConditions.map(condition => `\n      AND ${alias}.${condition}`).join('');
  const rootConditions = [
    `r."parentSpanId" IS NULL`,
    latestRootPredicate(spanTable),
    `NOT r."isPending"`,
    `r."endedAt" IS NOT NULL`,
    `r."startedAt" >= $1`,
    `r."startedAt" < $2`,
    ...deltaConditions,
    ...scopeConditions.map(condition => `r.${condition}`),
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
        ELSE ${durationMsSql('s."startedAt"', 's."endedAt"')}
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
      AND ${latestSpanPredicate(spanTable)}${scopeSql('s')}
  )`);
  }
  if (relationCollections.has('scores')) {
    ctes.push(`current_scores AS MATERIALIZED (
    SELECT
      s."traceId",
      s."spanId",
      s."timestamp",
      s."scorerId",
      s."scorerVersion",
      s."scoreSource",
      s."score",
      s."entityVersionId",
      s."parentEntityVersionId",
      s."rootEntityVersionId"
    FROM ${scoreTable} s
    WHERE s."traceId" IS NOT NULL
      AND s."traceId" IN (SELECT "traceId" FROM root_scope)
      AND ${latestScorePredicate(scoreTable)}${scopeSql('s')}
  )`);
  }
  if (relationCollections.has('feedback')) {
    ctes.push(`current_feedback AS MATERIALIZED (
    SELECT
      s."traceId",
      s."feedbackType",
      s."feedbackSource",
      s."feedbackUserId",
      s."sourceId",
      s."valueString",
      s."valueNumber",
      s."comment",
      s."timestamp",
      s."entityVersionId",
      s."parentEntityVersionId",
      s."rootEntityVersionId"
    FROM ${feedbackTable} s
    WHERE s."traceId" IS NOT NULL
      AND s."traceId" IN (SELECT "traceId" FROM root_scope)
      AND ${latestFeedbackPredicate(feedbackTable)}${scopeSql('s')}
  )`);
  }

  return { ctes, values };
}

export function compilePostgresTraceQuery(
  schema: string,
  plan: TrustedTraceQueryPlan,
  mode: 'data' | 'count' = 'data',
  safeHorizon?: string,
): CompiledPostgresTraceQuery {
  const relationCollections = collectRelationCollections(plan.where);
  let deltaWindow: { xactId: string; cursorId: string; safeHorizon: string } | undefined;
  if (plan.paginationMode === 'delta') {
    const watermark = coreStorage.getTraceQueryDeltaWatermark(plan, 'pg');
    if (watermark === undefined || safeHorizon === undefined)
      throw new Error('Delta query requires a cursor and safe horizon');
    deltaWindow = { ...decodeTraceDeltaWatermark(watermark), safeHorizon };
  }
  const { ctes, values } = compilePostgresTraceScope(schema, plan, relationCollections, plan.scope, deltaWindow);

  let predicateSql = 'TRUE';
  if (plan.where) {
    const predicate = compilePredicate(plan.where, values.length + 1);
    predicateSql = predicate.sql;
    values.push(...predicate.values);
  }
  ctes.push(`candidates AS (
    SELECT ${traceSelect(plan)}${plan.paginationMode === 'delta' ? ', r."xactId", r."cursorId"' : ''}
    FROM root_scope r
    WHERE ${predicateSql}
  )`);
  const candidates = `WITH ${ctes.join(',\n')}`;

  if (plan.paginationMode === 'page' && mode === 'count') {
    return {
      text: `${candidates}
SELECT COUNT(*)::text AS count
FROM candidates`,
      values,
    };
  }

  if (plan.paginationMode === 'delta') {
    values.push(plan.limit + 1);
    return {
      text: `${candidates}
SELECT * FROM candidates
ORDER BY "xactId" ASC, "cursorId" ASC
LIMIT $${values.length}`,
      values,
    };
  }

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
  if (plan.paginationMode === 'page') {
    values.push(plan.perPage, plan.page * plan.perPage);
    return {
      text: `${candidates}
SELECT *
FROM candidates
ORDER BY ${orderField} ${direction}, "traceId" ASC
LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    };
  }

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

export function compilePostgresThreadQuery(schema: string, plan: TrustedThreadQueryPlan): CompiledPostgresTraceQuery {
  const relationCollections = collectRelationCollections(plan.traces.where);
  collectThreadRelationCollections(plan.where, relationCollections);
  const { ctes, values } = compilePostgresTraceScope(schema, plan.traces, relationCollections, plan.scope);

  let eligibilitySql = 'TRUE';
  if (plan.traces.where) {
    const eligibility = compilePredicate(plan.traces.where, values.length + 1);
    eligibilitySql = eligibility.sql;
    values.push(...eligibility.values);
  }
  ctes.push(`eligible_roots AS MATERIALIZED (
    SELECT *
    FROM root_scope r
    WHERE ${eligibilitySql}
  )`);
  ctes.push(`thread_ids AS (
    SELECT "threadId" COLLATE "C" AS "threadId"
    FROM eligible_roots
    WHERE "threadId" IS NOT NULL
    GROUP BY "threadId" COLLATE "C"
  )`);

  let threadPredicateSql = 'TRUE';
  if (plan.where) {
    const predicate = compileThreadPredicate(plan.where, values.length + 1);
    threadPredicateSql = predicate.sql;
    values.push(...predicate.values);
  }
  ctes.push(`qualified_threads AS (
    SELECT t."threadId"
    FROM thread_ids t
    WHERE ${threadPredicateSql}
  )`);

  const pageCondition = plan.cursor ? `WHERE "threadId" > $${values.length + 1}` : '';
  if (plan.cursor) values.push(plan.cursor.threadId);
  values.push(plan.limit + 1);

  return {
    text: `WITH ${ctes.join(',\n')}
SELECT "threadId"
FROM qualified_threads
${pageCondition}
ORDER BY "threadId" ASC
LIMIT $${values.length}`,
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

export function compilePostgresTraceQueryObservedFields(
  schema: string,
  plan: TrustedTraceQueryObservedFieldsPlan,
): CompiledPostgresTraceQuery {
  const { ctes, values } = compilePostgresTraceScope(schema, plan, new Set(), plan.scope);
  const searchParameter = values.length + 1;
  const search = plan.search ? `AND strpos(lower('metadata.' || entry.key), lower($${searchParameter})) > 0` : '';
  if (plan.search) values.push(plan.search);
  values.push(plan.limit + 1);
  return {
    text: `WITH ${ctes.join(',\n')}
SELECT 'metadata.' || entry.key AS path, count(*)::bigint AS occurrences
FROM root_scope r
CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(r."metadataRaw") = 'object' THEN r."metadataRaw" ELSE '{}'::jsonb END) entry
WHERE jsonb_typeof(entry.value) = 'string'
  AND btrim(entry.value #>> '{}') <> ''
  AND entry.key <> ''
  AND strpos(entry.key, '.') = 0
  AND octet_length('metadata.' || entry.key) <= ${coreStorage.TRACE_QUERY_MAX_PATH_BYTES}
  AND octet_length(entry.value #>> '{}') <= ${coreStorage.TRACE_QUERY_MAX_STRING_BYTES}
  ${search}
GROUP BY entry.key
ORDER BY occurrences DESC, ('metadata.' || entry.key) COLLATE "C" ASC
LIMIT $${values.length}`,
    values,
  };
}

export function compilePostgresTraceQueryValues(
  schema: string,
  plan: TrustedTraceQueryValuesPlan,
): CompiledPostgresTraceQuery {
  const { ctes, values } = compilePostgresTraceScope(
    schema,
    plan,
    discoveryCollections(plan.predicateScope),
    plan.scope,
  );
  let extracted: string;
  if (plan.predicateScope === 'trace' && plan.path === 'tags') {
    // One row per (trace, distinct tag) so the outer count is a per-trace count.
    extracted = `SELECT value FROM (SELECT DISTINCT r."traceId", UNNEST(r."tags") AS value FROM root_scope r) t`;
  } else if (plan.predicateScope === 'trace' && plan.path.startsWith('metadata.')) {
    const keyParameter = `$${values.length + 1}`;
    extracted = `SELECT COALESCE(
      CASE WHEN jsonb_typeof(r."metadataSearch" -> ${keyParameter}) = 'string' THEN r."metadataSearch" ->> ${keyParameter} END,
      CASE WHEN jsonb_typeof(r."metadataRaw" -> ${keyParameter}) = 'string' THEN NULLIF(btrim(r."metadataRaw" ->> ${keyParameter}), '') END
    )::text AS value FROM root_scope r`;
    values.push(plan.path.slice('metadata.'.length));
  } else {
    const field = fieldSql(discoveryRegistry(plan.predicateScope), plan.path as TraceQueryCanonicalField);
    extracted = `SELECT ${field}::text AS value FROM ${discoverySource(plan.predicateScope)}`;
  }
  const searchParameter = values.length + 1;
  const search = plan.search ? `AND strpos(lower(value), lower($${searchParameter})) > 0` : '';
  if (plan.search) values.push(plan.search);
  values.push(plan.limit + 1);
  return {
    text: `WITH ${ctes.join(',\n')}, extracted AS (
  ${extracted}
)
SELECT value, count(*)::bigint AS count
FROM extracted
WHERE value IS NOT NULL
  AND octet_length(value) <= ${coreStorage.TRACE_QUERY_MAX_STRING_BYTES}
  ${search}
GROUP BY value
ORDER BY count DESC, value COLLATE "C" ASC
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

function isPostgresResourceLimit(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown };
  return candidate.code === '53200' || candidate.code === '53400';
}

export async function runWithPostgresTraceQueryTimeout<T>(
  client: DbClient,
  timeoutMs: number,
  execute: (transaction: TxClient) => Promise<T>,
  options: { repeatableRead?: boolean } = {},
): Promise<T> {
  const resolvedTimeoutMs = coreStorage.resolveTraceQueryTimeoutMs(timeoutMs);
  try {
    return await client.tx(async transaction => {
      if (options.repeatableRead) {
        await transaction.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      }
      await transaction.query(`SELECT set_config('statement_timeout', $1, true)`, [`${resolvedTimeoutMs}ms`]);
      return execute(transaction);
    });
  } catch (error) {
    if (isPostgresStatementTimeout(error)) throw new coreStorage.TraceQueryExecutionError();
    if (isPostgresResourceLimit(error)) throw new coreStorage.TraceQueryResourceLimitError();
    throw error;
  }
}

export async function getTraceQueryObservedFields(
  client: DbClient,
  schema: string,
  plan: TrustedTraceQueryObservedFieldsPlan,
  timeoutMs: number,
): Promise<TraceQueryObservedFieldsResult> {
  if (plan.predicateScope !== 'trace') return { observedFields: [], observedFieldsTruncated: false };
  const query = compilePostgresTraceQueryObservedFields(schema, plan);
  const rows = await runWithPostgresTraceQueryTimeout(client, timeoutMs, transaction =>
    transaction.any<Record<string, unknown>>(query.text, query.values),
  );
  return {
    observedFields: rows
      .slice(0, plan.limit)
      .map(row => coreStorage.createTraceQueryObservedFieldDescriptor(String(row.path), Number(row.occurrences))),
    observedFieldsTruncated: rows.length > plan.limit,
  };
}

export async function getTraceQueryValues(
  client: DbClient,
  schema: string,
  plan: TrustedTraceQueryValuesPlan,
  timeoutMs: number,
): Promise<GetTraceQueryValuesResponse> {
  const query = compilePostgresTraceQueryValues(schema, plan);
  const rows = await runWithPostgresTraceQueryTimeout(client, timeoutMs, transaction =>
    transaction.any<Record<string, unknown>>(query.text, query.values),
  );
  return coreStorage.getTraceQueryValuesResponseSchema.parse({
    values: rows.slice(0, plan.limit).map(row => ({ value: String(row.value), count: Number(row.count) })),
    valuesTruncated: rows.length > plan.limit,
  });
}

function decodeTraceDeltaWatermark(watermark: string) {
  try {
    return decodeDeltaCursor(watermark);
  } catch {
    throw new coreStorage.TraceQueryCursorError('TRACE_QUERY_CURSOR_MALFORMED');
  }
}

function emptyDeltaWatermark(horizon: string, watermark?: string): string {
  // Preserve monotonicity if a query envelope contains a future native watermark.
  if (watermark !== undefined && BigInt(decodeTraceDeltaWatermark(watermark).xactId) >= BigInt(horizon))
    return watermark;
  return encodeDeltaCursor(horizon, 0);
}

async function setRemainingTimeout(transaction: TxClient, deadline: number): Promise<void> {
  const remainingTimeoutMs = Math.floor(deadline - performance.now());
  if (remainingTimeoutMs <= 0) throw new coreStorage.TraceQueryExecutionError();
  await transaction.query(`SELECT set_config('statement_timeout', $1, true)`, [`${remainingTimeoutMs}ms`]);
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

const ISO_TIMESTAMP_PATTERN = String.raw`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$`;

/**
 * Bounded side queries for the selected page only. Each reads the same current-record
 * shape as the trace scope, restricted to the page's trace IDs, and never touches
 * ordering or totals: the page query already fixed them.
 */
export function compilePostgresTableSummaryQueries(
  schema: string,
  scope: TraceQueryTenantScope | undefined,
  traceIds: string[],
): { rollups: CompiledPostgresTraceQuery; feedback: CompiledPostgresTraceQuery; scores: CompiledPostgresTraceQuery } {
  const spanTable = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const metricTable = qualifiedTable(schema, TABLE_METRIC_EVENTS);
  const scoreTable = qualifiedTable(schema, TABLE_SCORE_EVENTS);
  const feedbackTable = qualifiedTable(schema, TABLE_FEEDBACK_EVENTS);
  const list = (types: readonly string[]) => types.map(type => `'${type}'`).join(', ');
  const relatedLimit = coreStorage.TRACE_QUERY_TABLE_SUMMARY_RELATED_LIMIT + 1;

  // $1 is always the trace ID array; tenant scope binds the next positions.
  const values: unknown[] = [traceIds];
  const scopeConditions: string[] = [];
  if (scope) {
    values.push(scope.organizationId);
    scopeConditions.push(`"organizationId" = $${values.length}`);
    if (scope.resourceId !== undefined) {
      values.push(scope.resourceId);
      scopeConditions.push(`"resourceId" = $${values.length}`);
    }
  }
  const scopeSql = (alias: string): string =>
    scopeConditions.map(condition => `\n      AND ${alias}.${condition}`).join('');
  const readMetric = `$${values.length + 1}`;
  const writeMetric = `$${values.length + 2}`;
  const rollupValues = [
    ...values,
    coreStorage.TRACE_QUERY_TABLE_SUMMARY_METRICS.promptCacheReadTokens,
    coreStorage.TRACE_QUERY_TABLE_SUMMARY_METRICS.promptCacheCreationTokens,
  ];
  const completionStartTime = `CASE
          WHEN jsonb_typeof("attributes" -> 'completionStartTime') = 'string'
            AND ("attributes" ->> 'completionStartTime') ~ '${ISO_TIMESTAMP_PATTERN}'
          THEN ("attributes" ->> 'completionStartTime')::timestamptz
        END`;
  const rollups: CompiledPostgresTraceQuery = {
    text: `WITH current_spans AS (
    SELECT s."traceId", s."spanId", s."spanType", s."error", s."startedAt", s."attributes"
    FROM ${spanTable} s
    WHERE s."traceId" = ANY($1::text[])
      AND ${latestSpanPredicate(spanTable)}${scopeSql('s')}
  ),
  model_spans AS (
    SELECT DISTINCT ON ("traceId")
      "traceId",
      CASE WHEN jsonb_typeof("attributes" -> 'model') = 'string' THEN "attributes" ->> 'model' END AS "model",
      floor(${durationMsSql('"startedAt"', completionStartTime)})::bigint AS "timeToFirstTokenMs"
    FROM current_spans
    WHERE "spanType" IN (${list(coreStorage.TRACE_QUERY_TABLE_SUMMARY_MODEL_SPAN_TYPES)})
    ORDER BY "traceId", "startedAt" ASC, "spanId" ASC
  ),
  metric_sums AS (
    SELECT
      m."traceId",
      sum(m."value") FILTER (WHERE m."name" = ${readMetric}) AS "promptCacheReadTokens",
      sum(m."value") FILTER (WHERE m."name" = ${writeMetric}) AS "promptCacheCreationTokens"
    FROM ${metricTable} m
    INNER JOIN current_spans c ON c."traceId" = m."traceId" AND c."spanId" = m."spanId"
    WHERE m."traceId" = ANY($1::text[])
      AND m."name" IN (${readMetric}, ${writeMetric})${scopeSql('m')}
    GROUP BY m."traceId"
  )
SELECT
  c."traceId" AS "traceId",
  count(*) FILTER (WHERE c."error" IS NOT NULL) AS "errorTotal",
  count(*) FILTER (WHERE c."error" IS NOT NULL AND c."spanType" IN (${list(coreStorage.TRACE_QUERY_TABLE_SUMMARY_LLM_SPAN_TYPES)})) AS "errorLlm",
  count(*) FILTER (WHERE c."error" IS NOT NULL AND c."spanType" IN (${list(coreStorage.TRACE_QUERY_TABLE_SUMMARY_TOOL_SPAN_TYPES)})) AS "errorTool",
  max(ms."model") AS "model",
  max(ms."timeToFirstTokenMs") AS "timeToFirstTokenMs",
  max(mt."promptCacheReadTokens") AS "promptCacheReadTokens",
  max(mt."promptCacheCreationTokens") AS "promptCacheCreationTokens"
FROM current_spans c
LEFT JOIN model_spans ms ON ms."traceId" = c."traceId"
LEFT JOIN metric_sums mt ON mt."traceId" = c."traceId"
GROUP BY c."traceId"`,
    values: rollupValues,
  };

  const feedback: CompiledPostgresTraceQuery = {
    text: `SELECT *
FROM (
  SELECT
    s."traceId", s."feedbackId", s."feedbackType", s."feedbackSource", s."valueString", s."valueNumber", s."comment", s."timestamp",
    row_number() OVER (PARTITION BY s."traceId" ORDER BY s."timestamp" DESC, s."feedbackId" ASC) AS "relatedRank"
  FROM ${feedbackTable} s
  WHERE s."traceId" = ANY($1::text[])
    AND ${latestFeedbackPredicate(feedbackTable)}${scopeSql('s')}
) ranked
WHERE "relatedRank" <= $${values.length + 1}
ORDER BY "traceId" ASC, "relatedRank" ASC`,
    values: [...values, relatedLimit],
  };

  const scores: CompiledPostgresTraceQuery = {
    text: `SELECT *
FROM (
  SELECT
    s."traceId", s."scoreId", s."scorerId", s."scorerVersion", s."scoreSource", s."score", s."timestamp", s."spanId",
    row_number() OVER (PARTITION BY s."traceId" ORDER BY s."timestamp" DESC, s."scoreId" ASC) AS "relatedRank"
  FROM ${scoreTable} s
  WHERE s."traceId" = ANY($1::text[])
    AND ${latestScorePredicate(scoreTable)}${scopeSql('s')}
) ranked
WHERE "relatedRank" <= $${values.length + 1}
ORDER BY "traceId" ASC, "relatedRank" ASC`,
    values: [...values, relatedLimit],
  };

  return { rollups, feedback, scores };
}

function nullableNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}

async function loadTableSummaryRows(
  transaction: TxClient,
  schema: string,
  scope: TraceQueryTenantScope | undefined,
  traceIds: string[],
): Promise<TableSummaryRows> {
  const result: TableSummaryRows = { rollups: new Map(), feedback: new Map(), scores: new Map() };
  if (traceIds.length === 0) return result;
  const queries = compilePostgresTableSummaryQueries(schema, scope, traceIds);
  const rollupRows = await transaction.any<Record<string, unknown>>(queries.rollups.text, queries.rollups.values);
  const feedbackRows = await transaction.any<Record<string, unknown>>(queries.feedback.text, queries.feedback.values);
  const scoreRows = await transaction.any<Record<string, unknown>>(queries.scores.text, queries.scores.values);
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
    metadata: row.metadata ?? null,
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

/** Maps page rows and, when the plan asks for it, enriches them inside the same transaction. */
async function mapTraceRows(
  transaction: TxClient,
  schema: string,
  plan: TrustedTraceQueryPlan,
  rows: Record<string, unknown>[],
  deadline?: number,
) {
  let summaries: TableSummaryRows | undefined;
  if (plan.result === 'traces' && plan.tableSummary) {
    if (deadline !== undefined) await setRemainingTimeout(transaction, deadline);
    summaries = await loadTableSummaryRows(
      transaction,
      schema,
      plan.scope,
      rows.map(row => String(row.traceId)),
    );
  }
  return rows.map(row => traceRowToResult(row, summaries));
}

export async function queryTraces(
  client: DbClient,
  schema: string,
  plan: TrustedTraceQueryPlan,
  timeoutMs: number,
): Promise<TraceQueryResponse> {
  if (plan.paginationMode === 'delta') {
    assertDeltaPollingEnabled();
    const watermark = coreStorage.getTraceQueryDeltaWatermark(plan, 'pg');
    if (watermark !== undefined) decodeTraceDeltaWatermark(watermark);
    const resolvedTimeoutMs = coreStorage.resolveTraceQueryTimeoutMs(timeoutMs);
    const deadline = performance.now() + resolvedTimeoutMs;
    return runWithPostgresTraceQueryTimeout(
      client,
      resolvedTimeoutMs,
      async transaction => {
        await setRemainingTimeout(transaction, deadline);
        const horizon = await readSafeXactHorizon(transaction);
        let rows: Record<string, unknown>[] = [];
        if (watermark !== undefined) {
          await setRemainingTimeout(transaction, deadline);
          const query = compilePostgresTraceQuery(schema, plan, 'data', horizon);
          rows = await transaction.any<Record<string, unknown>>(query.text, query.values);
        }
        const visible = rows.slice(0, plan.limit);
        const last = visible.at(-1);
        return coreStorage.traceQueryResponseSchema.parse({
          traces: await mapTraceRows(transaction, schema, plan, visible, deadline),
          delta: { limit: plan.limit, hasMore: rows.length > plan.limit },
          deltaCursor: coreStorage.encodeTraceQueryDeltaCursor(
            plan,
            'pg',
            last ? encodeDeltaCursor(last.xactId, last.cursorId) : emptyDeltaWatermark(horizon, watermark),
          ),
        });
      },
      { repeatableRead: true },
    );
  }
  if (plan.paginationMode === 'page') {
    const resolvedTimeoutMs = coreStorage.resolveTraceQueryTimeoutMs(timeoutMs);
    const deadline = performance.now() + resolvedTimeoutMs;
    const countQuery = compilePostgresTraceQuery(schema, plan, 'count');
    const dataQuery = compilePostgresTraceQuery(schema, plan);
    const { total, traces, deltaCursor } = await runWithPostgresTraceQueryTimeout(
      client,
      resolvedTimeoutMs,
      async transaction => {
        // The list-polling feature predates the trace-query cursor encoder.
        let deltaCursor: string | undefined;
        if (deltaPollingFeatureEnabled() && typeof coreStorage.encodeTraceQueryDeltaCursor === 'function') {
          await setRemainingTimeout(transaction, deadline);
          const horizon = await readSafeXactHorizon(transaction);
          deltaCursor = coreStorage.encodeTraceQueryDeltaCursor(plan, 'pg', encodeDeltaCursor(horizon, 0));
        }
        if (deltaCursor !== undefined) await setRemainingTimeout(transaction, deadline);
        const countRows = await transaction.any<{ count: string }>(countQuery.text, countQuery.values);
        const remainingTimeoutMs = Math.floor(deadline - performance.now());
        if (remainingTimeoutMs <= 0) throw new coreStorage.TraceQueryExecutionError();
        await transaction.query(`SELECT set_config('statement_timeout', $1, true)`, [`${remainingTimeoutMs}ms`]);
        const rows = await transaction.any<Record<string, unknown>>(dataQuery.text, dataQuery.values);
        const traces = await mapTraceRows(transaction, schema, plan, rows, deadline);
        return { total: Number(countRows[0]?.count ?? 0), traces, deltaCursor };
      },
      { repeatableRead: true },
    );
    return coreStorage.traceQueryResponseSchema.parse({
      traces,
      ...(deltaCursor === undefined ? {} : { deltaCursor }),
      pagination: {
        total,
        page: plan.page,
        perPage: plan.perPage,
        hasMore: (plan.page + 1) * plan.perPage < total,
      },
    });
  }

  const query = compilePostgresTraceQuery(schema, plan);
  const keysetTimeoutMs = coreStorage.resolveTraceQueryTimeoutMs(timeoutMs);
  const keysetDeadline = performance.now() + keysetTimeoutMs;
  const { rows, traces } = await runWithPostgresTraceQueryTimeout(client, keysetTimeoutMs, async transaction => {
    const rows = await transaction.any<Record<string, unknown>>(query.text, query.values);
    const visible = rows.slice(0, plan.limit);
    return {
      rows,
      // The side queries share the request budget instead of each getting a fresh timeout.
      traces: plan.result === 'groups' ? [] : await mapTraceRows(transaction, schema, plan, visible, keysetDeadline),
    };
  });
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

export async function queryThreads(
  client: DbClient,
  schema: string,
  plan: TrustedThreadQueryPlan,
  timeoutMs: number,
): Promise<QueryThreadsResult> {
  const query = compilePostgresThreadQuery(schema, plan);
  const rows = await runWithPostgresTraceQueryTimeout(client, timeoutMs, transaction =>
    transaction.any<Record<string, unknown>>(query.text, query.values),
  );
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
