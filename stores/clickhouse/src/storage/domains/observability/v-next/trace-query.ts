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
  TrustedTraceQueryTracesPlan,
  TrustedTraceQueryValuesPlan,
  TrustedTraceQueryPredicate,
  TrustedTraceQueryScalarPredicate,
} from '@mastra/core/storage';
import { z } from 'zod/v4';

import { TABLE_FEEDBACK_EVENTS, TABLE_SPAN_EVENTS, TABLE_TRACE_ROOTS, TABLE_TRACE_ROOTS_DELTA } from './ddl';
import { CH_SETTINGS, parseJson } from './helpers';
import type { ClickHouseDeltaCursorStrategy } from './polling';
import { assertDeltaPollingSupported, deltaPollingSupported } from './polling';
import { currentScoresRelation } from './scores';

export type ClickHouseParameterType = 'String' | 'Float64' | 'UInt64' | "DateTime64(3, 'UTC')";
type FieldDefinition = { sql: string; parameterType: ClickHouseParameterType };
type FieldRegistry<TField extends string> = Record<TField, FieldDefinition>;
export type QueryParams = Record<string, string | number>;
type SqlFragment = { sql: string; params: QueryParams };
type RelatedCollection = 'spans' | 'scores' | 'feedback';
type TraceSelection = {
  timeRange: { from: string; to: string };
  where?: TrustedTraceQueryPredicate;
};

export const TRACE_STATUS_SQL = `if(isNotNull(r.error), 'error', 'success')`;

export function durationMsSql(startedAt: string, endedAt: string): string {
  return `dateDiff('millisecond', ${startedAt}, ${endedAt})`;
}

/** Top-level metadata string value on a trace root (alias `r`); `key` is a bound parameter placeholder. */
export function traceMetadataValueSql(key: string): string {
  return `coalesce(if(mapContains(r.metadataSearch, ${key}), r.metadataSearch[${key}], NULL), nullIf(trim(JSONExtractString(r.metadataRaw, ${key})), ''))`;
}

const TRACE_FIELDS = {
  traceId: { sql: 'r.traceId', parameterType: 'String' },
  threadId: { sql: 'r.threadId', parameterType: 'String' },
  resourceId: { sql: 'r.resourceId', parameterType: 'String' },
  runId: { sql: 'r.runId', parameterType: 'String' },
  sessionId: { sql: 'r.sessionId', parameterType: 'String' },
  userId: { sql: 'r.userId', parameterType: 'String' },
  organizationId: { sql: 'r.organizationId', parameterType: 'String' },
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
  runId: { sql: 's.runId', parameterType: 'String' },
  sessionId: { sql: 's.sessionId', parameterType: 'String' },
  userId: { sql: 's.userId', parameterType: 'String' },
  organizationId: { sql: 's.organizationId', parameterType: 'String' },
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
  r.inputPreview AS inputPreview,
  r.threadId AS threadId,
  r.resourceId AS resourceId,
  r.startedAt AS startedAt,
  r.endedAt AS endedAt,
  r.entityName AS entityName,
  r.entityType AS entityType,
  r.environment AS environment,
  ${TRACE_STATUS_SQL} AS status`;

/** Candidate columns carried through the page-mode window sort (no payload blobs). */
const TRACE_PAGE_COLUMNS = [
  'traceId',
  'rootSpanId',
  'name',
  'entityId',
  'parentSpanId',
  'threadId',
  'resourceId',
  'startedAt',
  'endedAt',
  'entityName',
  'entityType',
  'environment',
  'status',
];

export class ParameterBuilder {
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
          sql: traceMetadataValueSql(key),
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

  if (predicate.type === 'text') {
    // Same normalization as `normalizeTraceQueryText`: NFC, lowercase, words = runs of
    // letters, marks, and digits. `lowerUTF8('İ')` is `i` plus a combining dot, so fold `İ` after NFC composes it.
    const words = `concat(' ', replaceAll(lowerUTF8(replaceRegexpAll(replaceAll(normalizeUTF8NFC(${field.sql}), 'İ', 'i'), '[^\\\\p{L}\\\\p{M}\\\\p{N}]+', ' ')), 'ς', 'σ'), ' ')`;
    const found = `position(${words}, ${parameters.add(` ${predicate.value} `, 'String')}) > 0`;
    return `ifNull(${predicate.operator === 'matches' ? found : `NOT (${found})`}, 0)`;
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
    // Uncorrelated IN keeps the related scan set-based: the subquery runs once
    // instead of being decorrelated into a join per reference.
    const matching = `(
      SELECT s.traceId FROM ${table} s
      WHERE isNotNull(s.traceId)
        AND (${nested})
    )`;
    return `r.traceId ${predicate.quantifier === 'some' ? 'IN' : 'NOT IN'} ${matching}`;
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
    const matching = `(
      SELECT r.threadId FROM eligible_roots r
      WHERE isNotNull(r.threadId)
        AND (${compilePredicate(predicate.predicate, parameters)})
    )`;
    return `t.threadId ${predicate.quantifier === 'some' ? 'IN' : 'NOT IN'} ${matching}`;
  }
  if (predicate.type === 'boolean') {
    const parts = predicate.args.map(arg => `(${compileThreadPredicate(arg, parameters)})`);
    return parts.join(predicate.operator === 'and' ? ' AND ' : ' OR ');
  }
  return `NOT (${compileThreadPredicate(predicate.arg, parameters)})`;
}

export interface CompiledClickHouseTraceQuery {
  query: string;
  query_params: Record<string, unknown>;
  sharedSnapshot?: boolean;
}

/**
 * Tenant conditions ANDed into every root and related-signal scan. Columns are
 * `Nullable(String)`, so rows without a tenant never match a scope.
 */
export function compileTenantScope(scope: TraceQueryTenantScope | undefined, parameters: ParameterBuilder): string {
  if (!scope) return '';
  let sql = `\n      AND organizationId = ${parameters.add(scope.organizationId, 'String')}`;
  if (scope.resourceId !== undefined) sql += `\n      AND resourceId = ${parameters.add(scope.resourceId, 'String')}`;
  return sql;
}

/**
 * Trace scope options. `queryTraces()` uses all of them; `aggregateTraces()` can opt into `oneRootPerTrace`.
 * - `oneRootPerTrace`: a trace has exactly one root span, so `root_scope` is the window's root rows,
 *   read once without re-deriving a current root from all of a trace's roots. It may hold
 *   unmerged copies of a root, so consumers collapse by `traceId`. A trace written with several
 *   root spans (a writer bug) is listed under one of them.
 * - `spanExistence`: spans are only tested for existence (`traceId IN`), which copies of a span
 *   cannot change, so the span dedupe is skipped.
 */
export type TraceScopeOptions = {
  oneRootPerTrace?: boolean;
  spanExistence?: boolean;
  /** Delta mode: the delta index rows to page over; emits `delta_candidates` and seeds the scope with its traces. */
  delta?: string;
};

function compileClickHouseTraceScope(
  selection: TraceSelection,
  relationCollections: Set<RelatedCollection>,
  parameters: ParameterBuilder,
  scope: TraceQueryTenantScope | undefined,
  seedConjuncts: TrustedTraceQueryPredicate[] = [],
  options: TraceScopeOptions = {},
): string[] {
  const from = parameters.add(selection.timeRange.from, "DateTime64(3, 'UTC')");
  const to = parameters.add(selection.timeRange.to, "DateTime64(3, 'UTC')");
  const tenant = compileTenantScope(scope, parameters);
  const seedFilter = seedConjuncts
    .map(conjunct => `\n          AND (${compilePredicate(conjunct, parameters)})`)
    .join('');
  const bound = options.delta ? `\n          AND (traceId IN (SELECT traceId FROM delta_candidates))` : '';
  // Traces with any root row in the window, for seeding related-signal scans.
  const windowTraces = (more: string) => `
        SELECT traceId
        FROM ${TABLE_TRACE_ROOTS} w
        WHERE startedAt >= ${from}
          AND startedAt < ${to}${tenant}${more}
      `;
  // The delta index has no tenant columns, so keep only its traces with a root row in this
  // tenant's window before grouping; the root scope applies the same window anyway.
  const delta = options.delta
    ? [
        `delta_candidates AS (
    SELECT traceId, max(cursorId) AS latestCursorId
    FROM ${TABLE_TRACE_ROOTS_DELTA}
    WHERE ${options.delta}
      AND traceId IN (${windowTraces('')})
    GROUP BY traceId
  )`,
      ]
    : [];
  const ctes = options.oneRootPerTrace
    ? [
        ...delta,
        // A trace has one root span, so the window's root rows are the traces' roots. Unmerged
        // copies of a root stay; consumers collapse them by traceId.
        `root_scope AS (
    SELECT *
    FROM ${TABLE_TRACE_ROOTS} r
    WHERE startedAt >= ${from}
      AND startedAt < ${to}${tenant}${seedFilter}${bound}
  )`,
      ]
    : [
        // ClickHouse cannot push the time range through `LIMIT 1 BY`, so narrow the dedupe to
        // traces with a root in the range first. All roots of those traces stay in, so a
        // non-current root inside the range cannot resurrect a trace whose current root is outside it.
        // The re-read carries the tenant scope so it reads only the tenant's rows, and another
        // tenant's root with the same traceId cannot win the dedupe. One `LIMIT 1 BY traceId`
        // picks the same root as deduping by dedupeKey first: the lowest dedupeKey of the trace.
        `current_roots AS (
    SELECT *
    FROM ${TABLE_TRACE_ROOTS}
    WHERE traceId IN (
      SELECT traceId
      FROM ${TABLE_TRACE_ROOTS} r
      WHERE startedAt >= ${from}
        AND startedAt < ${to}${tenant}${seedFilter}
    )${tenant}
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
      rootEntityVersionId,
      runId,
      sessionId,
      userId,
      organizationId
    FROM ${TABLE_SPAN_EVENTS}
    WHERE isNotNull(traceId)
      AND traceId IN (${
        // Existence checks only meet root_scope's traces in `candidates`, so the window's
        // traces are a large enough seed without the root filters.
        options.spanExistence && options.oneRootPerTrace ? windowTraces(bound) : 'SELECT traceId FROM root_scope'
      })${tenant}${
        options.spanExistence
          ? ''
          : `
    ORDER BY dedupeKey
    LIMIT 1 BY dedupeKey`
      }
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
      -- ClickHouse cannot push the scope filter through LIMIT 1 BY, so keep
      -- every version of each feedbackId that ever pointed into the scope
      -- (traceId leads the sort key). A rewrite may move a feedback to another
      -- trace, so the current version is still filtered below.
      WHERE feedbackId IN (
        SELECT feedbackId
        FROM ${TABLE_FEEDBACK_EVENTS}
        WHERE traceId IN (SELECT traceId FROM root_scope)
      )
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

/**
 * Builds the CTE chain ending in `candidates`: the completed, current trace roots in the
 * selection's time range and tenant scope that match its `where` predicate. Trace queries and
 * trace aggregates both select from this CTE so they always see the same population.
 */
export function compileClickHouseTraceCandidates(
  selection: TraceSelection & { scope?: TraceQueryTenantScope },
  columns: string,
  parameters: ParameterBuilder,
  options: TraceScopeOptions = {},
): string[] {
  // Top-level `where` conjuncts that only read the root row are copied into the window seed so
  // the retry-collapse sorts only see traces that can match. This cannot drop a result: a trace's
  // current root is itself a root row in the window that satisfies the conjunct. `candidates`
  // still applies the full `where` to the current root, so traces seeded only by an older root
  // are filtered out there.
  const rootConjuncts = selection.where
    ? (selection.where.type === 'boolean' && selection.where.operator === 'and'
        ? selection.where.args
        : [selection.where]
      ).filter(conjunct => collectRelationCollections(conjunct).size === 0)
    : [];
  const ctes = compileClickHouseTraceScope(
    selection,
    collectRelationCollections(selection.where),
    parameters,
    selection.scope,
    rootConjuncts,
    options,
  );
  const predicate = selection.where ? compilePredicate(selection.where, parameters) : '1';
  ctes.push(`candidates AS (
    SELECT ${columns}
    FROM root_scope r
    WHERE ${predicate}
  )`);
  return ctes;
}

/**
 * `queryTraces()` statements read one root per trace and only test spans for existence
 * (TraceScopeOptions). The list statements carry narrow columns; `metadata` / `inputPreview` are fetched
 * for the returned rows afterwards (compileClickHouseTraceRootPayloads).
 */
const QUERY_TRACES_SCOPE = { oneRootPerTrace: true, spanExistence: true } as const;

const TRACE_LIST_SELECT = TRACE_SELECT.split('\n')
  .filter(line => !/ AS (metadata|inputPreview),$/.test(line))
  .join('\n');

type TraceOrder = { field: 'startedAt' | 'endedAt'; direction: 'ASC' | 'DESC' };

function traceOrder(plan: TrustedTraceQueryTracesPlan): TraceOrder {
  return {
    field: resolveOrderField(plan.orderBy.field),
    direction: plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC',
  };
}

function keysetCursorCondition(
  plan: TrustedTraceQueryTracesPlan,
  order: TraceOrder,
  parameters: ParameterBuilder,
): string {
  if (plan.paginationMode !== 'keyset' || !plan.cursor) return '';
  const comparison = order.direction === 'ASC' ? '>' : '<';
  const sortValue = parameters.add(plan.cursor.sortValue, "DateTime64(3, 'UTC')");
  const traceId = parameters.add(plan.cursor.traceId, 'String');
  return `(${order.field} ${comparison} ${sortValue} OR (${order.field} = ${sortValue} AND traceId > ${traceId}))`;
}

/**
 * First statement of keyset and page mode: the page's traces (after the keyset cursor, `limit + 1`
 * for keyset mode, `perPage` at the page offset for page mode) as root keys, and the
 * number of matching traces on every row. Per trace, the root row that sorts first gives the sort
 * value and the key, so the key always names a row with that sort value. No blob columns are read.
 */
export function compileClickHouseTraceQueryKeys(plan: TrustedTraceQueryTracesPlan): CompiledClickHouseTraceQuery {
  if (plan.paginationMode === 'delta') throw new Error('Delta trace queries have no keys statement');
  const parameters = new ParameterBuilder();
  const order = traceOrder(plan);
  const ctes = compileClickHouseTraceCandidates(
    plan,
    'r.traceId AS traceId, r.dedupeKey AS dedupeKey, r.startedAt AS startedAt, r.endedAt AS endedAt',
    parameters,
    QUERY_TRACES_SCOPE,
  );
  const cursor = keysetCursorCondition(plan, order, parameters);
  const pick = order.direction === 'DESC' ? 'max' : 'min';
  const limit =
    plan.paginationMode === 'page'
      ? `LIMIT ${parameters.add(plan.perPage, 'UInt64')} OFFSET ${parameters.add(plan.page * plan.perPage, 'UInt64')}`
      : `LIMIT ${parameters.add(plan.limit + 1, 'UInt64')}`;
  return {
    query: `WITH ${ctes.join(',\n')},
per_trace AS (
  SELECT traceId, ${pick}(${order.field}) AS sortValue,
    ${pick === 'max' ? 'argMax' : 'argMin'}((dedupeKey, startedAt), ${order.field}) AS root
  FROM candidates${cursor ? `\n  WHERE ${cursor}` : ''}
  GROUP BY traceId
)
SELECT traceId, root.1 AS dedupeKey, sortValue, root.2 AS rootStartedAt, count() OVER () AS __total
FROM per_trace
ORDER BY sortValue ${order.direction}, traceId ASC
${limit}`,
    query_params: parameters.params,
    sharedSnapshot: true,
  };
}

export type ClickHouseTraceRootKey = { traceId: string; dedupeKey: string; sortValue: string; rootStartedAt: string };

/**
 * Second statement of keyset and page mode: the rows of the keyed roots, with `metadata`
 * and `inputPreview`, read by sort-key tuple. Unmerged copies of a root key are redeliveries of one
 * span; the relation-free `where` conjuncts are re-applied so a copy that doesn't match isn't
 * returned, and the copy that sorts first is kept, as in the keys statement.
 */
export function compileClickHouseTraceRowsByKey(
  plan: TrustedTraceQueryTracesPlan,
  keys: ClickHouseTraceRootKey[],
): CompiledClickHouseTraceQuery {
  const parameters = new ParameterBuilder();
  const order = traceOrder(plan);
  const ts = (value: string) => parameters.add(value, "DateTime64(3, 'UTC')");
  const byEnd = order.field === 'endedAt';
  const tuples = keys.map(key => {
    const started = ts(byEnd ? key.rootStartedAt : key.sortValue);
    const id = `${parameters.add(key.traceId, 'String')}, ${parameters.add(key.dedupeKey, 'String')}`;
    return byEnd ? `(${started}, ${id}, ${ts(key.sortValue)})` : `(${started}, ${id})`;
  });
  const conjuncts = plan.where
    ? (plan.where.type === 'boolean' && plan.where.operator === 'and' ? plan.where.args : [plan.where]).filter(
        conjunct => collectRelationCollections(conjunct).size === 0,
      )
    : [];
  const predicate = conjuncts.map(conjunct => `\n  AND (${compilePredicate(conjunct, parameters)})`).join('');
  return {
    query: `SELECT ${TRACE_SELECT}
FROM ${TABLE_TRACE_ROOTS} r
WHERE (r.startedAt, r.traceId, r.dedupeKey${byEnd ? ', r.endedAt' : ''}) IN (${tuples.join(', ')})${compileTenantScope(plan.scope, parameters)}${predicate}
ORDER BY ${order.field} ${order.direction}, traceId ASC
LIMIT 1 BY traceId`,
    query_params: parameters.params,
  };
}

/** Number of matching traces, for numbered pages past the last one (the keys statement returns no rows). */
export function compileClickHouseTraceQueryTotal(plan: TrustedTraceQueryTracesPlan): CompiledClickHouseTraceQuery {
  const parameters = new ParameterBuilder();
  const ctes = compileClickHouseTraceCandidates(plan, 'r.traceId AS traceId', parameters, QUERY_TRACES_SCOPE);
  return {
    query: `WITH ${ctes.join(',\n')}
SELECT uniqExact(traceId) AS traces
FROM candidates`,
    query_params: parameters.params,
    sharedSnapshot: true,
  };
}

/**
 * The list statement of groups and delta mode, and a single-statement keyset / page list (rows
 * without `metadata` / `inputPreview`). `queryTraces()` lists keyset and page mode with
 * compileClickHouseTraceQueryKeys and compileClickHouseTraceRowsByKey instead.
 */
export function compileClickHouseTraceQuery(
  plan: TrustedTraceQueryPlan,
  deltaHead?: DeltaWatermark,
): CompiledClickHouseTraceQuery {
  const parameters = new ParameterBuilder();

  if (plan.result === 'groups') {
    const ctes = compileClickHouseTraceCandidates(plan, TRACE_LIST_SELECT, parameters, QUERY_TRACES_SCOPE);
    const pageCondition = plan.cursor ? `AND threadId > ${parameters.add(plan.cursor.threadId, 'String')}` : '';
    const limit = parameters.add(plan.limit + 1, 'UInt64');
    return {
      query: `WITH ${ctes.join(',\n')}
SELECT threadId
FROM candidates
WHERE isNotNull(threadId) ${pageCondition}
GROUP BY threadId
ORDER BY threadId ASC
LIMIT ${limit}`,
      query_params: parameters.params,
      sharedSnapshot: true,
    };
  }

  if (plan.paginationMode === 'delta') {
    const watermark = coreStorage.getTraceQueryDeltaWatermark(plan, 'clickhouse');
    const after = watermark ? parseDeltaWatermark(watermark) : { cursorId: '0', traceId: '' };
    const lowerCursor = parameters.add(after.cursorId, 'UInt64');
    // The plain `cursorId >=` bound lets the delta primary key prune; the tuple
    // comparison alone is not used for index analysis.
    const lower = `tuple(${lowerCursor}, ${parameters.add(after.traceId, 'String')})`;
    const upper = deltaHead
      ? `AND tuple(cursorId, traceId) <= tuple(${parameters.add(deltaHead.cursorId, 'UInt64')}, ${parameters.add(deltaHead.traceId, 'String')})`
      : '';
    // Only traces with a delta row can join, so the scope is seeded with them alone.
    const ctes = compileClickHouseTraceCandidates(plan, TRACE_LIST_SELECT, parameters, {
      ...QUERY_TRACES_SCOPE,
      delta: `cursorId >= ${lowerCursor} AND tuple(cursorId, traceId) > ${lower} ${upper}`,
    });
    const limit = parameters.add(plan.limit + 1, 'UInt64');
    return {
      query: `WITH ${ctes.join(',\n')}
SELECT c.*, toString(d.latestCursorId) AS __delta_cursor
FROM candidates c
INNER JOIN delta_candidates d ON c.traceId = d.traceId
ORDER BY d.latestCursorId ASC, c.traceId ASC
LIMIT 1 BY c.traceId
LIMIT ${limit}`,
      query_params: parameters.params,
      sharedSnapshot: true,
    };
  }

  const order = traceOrder(plan);
  const ctes = compileClickHouseTraceCandidates(plan, TRACE_LIST_SELECT, parameters, QUERY_TRACES_SCOPE);
  const cursor = keysetCursorCondition(plan, order, parameters);
  // `root_scope` can hold unmerged copies of a root; keep the copy that sorts first.
  const orderBy = `ORDER BY ${order.field} ${order.direction}, traceId ASC
LIMIT 1 BY traceId`;
  const limit =
    plan.paginationMode === 'page'
      ? `LIMIT ${parameters.add(plan.perPage, 'UInt64')} OFFSET ${parameters.add(plan.page * plan.perPage, 'UInt64')}`
      : `LIMIT ${parameters.add(plan.limit + 1, 'UInt64')}`;
  return {
    query: `WITH ${ctes.join(',\n')}
SELECT *
FROM candidates${cursor ? `\nWHERE ${cursor}` : ''}
${orderBy}
${limit}`,
    query_params: parameters.params,
    sharedSnapshot: true,
  };
}

/**
 * Fetches payloads for listed rows: `metadata` and the stored `inputPreview`, or `input` alone
 * for rows written before `inputPreview` existed. Looks rows up by the
 * trace_roots sort-key prefix `(startedAt, traceId)`, so only the page's
 * granules are read. A root can have unmerged versions in different `endedAt`
 * partitions, so `endedAt` is part of the key: the payload comes from the same
 * version as the listed row. The tenant scope is repeated so the lookup stays
 * inside the tenant's rows.
 */
export function compileClickHouseTraceRootPayloads(
  keys: Array<{ traceId: string; rootSpanId: string; startedAt: string; endedAt: string }>,
  scope?: TraceQueryTenantScope,
  columns: 'payload' | 'input' = 'payload',
): CompiledClickHouseTraceQuery {
  const parameters = new ParameterBuilder();
  const tuples = keys.map(
    key =>
      `(${parameters.add(key.startedAt, "DateTime64(3, 'UTC')")}, ${parameters.add(key.traceId, 'String')}, ${parameters.add(key.rootSpanId, 'String')}, ${parameters.add(key.endedAt, "DateTime64(3, 'UTC')")})`,
  );
  return {
    query: `SELECT traceId, spanId AS rootSpanId, ${columns === 'payload' ? 'metadataRaw AS metadata, inputPreview' : 'input'}
FROM ${TABLE_TRACE_ROOTS}
WHERE (startedAt, traceId, spanId, endedAt) IN (${tuples.join(', ')})${compileTenantScope(scope, parameters)}
LIMIT 1 BY traceId, spanId`,
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
    field = traceMetadataValueSql(key);
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
  // The first statement gets the whole budget; later ones get what is left of it.
  let first = !deltaHead;
  const run = (compiled: CompiledClickHouseTraceQuery) => {
    const budget = first ? timeoutMs : remaining();
    first = false;
    return runWithClickHouseTraceQueryTimeout(client, { timeoutMs: budget }, compiled);
  };

  if (plan.result === 'groups') {
    const rows = await run(compileClickHouseTraceQuery(plan));
    const groups = rows.slice(0, plan.limit).map(row => ({ threadId: String(row.threadId) }));
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

  const rootKey = (row: Record<string, unknown>) => `${row.traceId}\u0000${row.rootSpanId}`;
  const payloadKeys = (rows: Record<string, unknown>[]) =>
    rows.map(row => ({
      traceId: String(row.traceId),
      rootSpanId: String(row.rootSpanId),
      startedAt: asIsoTimestamp(row.startedAt),
      endedAt: asIsoTimestamp(row.endedAt),
    }));
  /** Rows written before `inputPreview` existed have none stored; their preview is built from `input`. */
  const toTraceRecords = async (rows: Record<string, unknown>[]) => {
    const missing = rows.filter(row => row.inputPreview == null);
    const previews = new Map<string, string>();
    if (missing.length > 0) {
      const inputs = await run(compileClickHouseTraceRootPayloads(payloadKeys(missing), plan.scope, 'input'));
      for (const row of inputs) previews.set(rootKey(row), coreStorage.buildInputPreview(row.input) ?? '');
    }
    return rows.map(row =>
      toTraceRecord(row.inputPreview == null ? { ...row, inputPreview: previews.get(rootKey(row)) } : row),
    );
  };
  /** Lists rows, then fetches `metadata` / `inputPreview` for the rows that are returned. */
  const listTraces = async (rows: Record<string, unknown>[]) => {
    const payloads = new Map<string, Record<string, unknown>>();
    if (rows.length > 0) {
      const payloadRows = await run(compileClickHouseTraceRootPayloads(payloadKeys(rows), plan.scope));
      for (const payload of payloadRows) payloads.set(rootKey(payload), payload);
    }
    return toTraceRecords(rows.map(row => ({ ...row, ...payloads.get(rootKey(row)) })));
  };
  const toTraceRecord = (row: Record<string, unknown>) => ({
    traceId: String(row.traceId),
    rootSpanId: String(row.rootSpanId),
    name: row.name,
    entityId: row.entityId ?? null,
    parentSpanId: row.parentSpanId ?? null,
    createdAt: asIsoTimestamp(row.startedAt),
    metadata: parseJson(row.metadata) ?? null,
    inputPreview: row.inputPreview ? String(row.inputPreview) : null,
    threadId: row.threadId == null ? null : String(row.threadId),
    resourceId: row.resourceId == null ? null : String(row.resourceId),
    startedAt: asIsoTimestamp(row.startedAt),
    endedAt: asIsoTimestamp(row.endedAt),
    entityName: row.entityName == null ? null : String(row.entityName),
    entityType: row.entityType == null ? null : String(row.entityType),
    environment: row.environment == null ? null : String(row.environment),
    status: row.status,
  });

  if (plan.paginationMode === 'delta') {
    const rows = await run(compileClickHouseTraceQuery(plan, deltaHead));
    const visibleRows = rows.slice(0, plan.limit);
    const traces = await listTraces(visibleRows);
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

  // Keyset and page mode: the page's root keys (and the total), then those rows with
  // their payloads.
  const keys = await run(compileClickHouseTraceQueryKeys(plan));
  let total = Number(keys[0]?.__total ?? 0);
  if (plan.paginationMode === 'page' && keys.length === 0 && plan.page > 0) {
    const [stats] = await run(compileClickHouseTraceQueryTotal(plan));
    total = Number(stats?.traces ?? 0);
  }
  // Keyset keys carry one look-ahead trace, which only decides whether there is a next page.
  const visible = plan.paginationMode === 'page' ? keys : keys.slice(0, plan.limit);
  const rows =
    visible.length > 0
      ? await run(
          compileClickHouseTraceRowsByKey(
            plan,
            visible.map(key => ({
              traceId: String(key.traceId),
              dedupeKey: String(key.dedupeKey),
              sortValue: asIsoTimestamp(key.sortValue),
              rootStartedAt: asIsoTimestamp(key.rootStartedAt),
            })),
          ),
        )
      : [];

  if (plan.paginationMode === 'page') {
    return coreStorage.traceQueryResponseSchema.parse({
      traces: await toTraceRecords(rows),
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

  const traces = await toTraceRecords(rows);
  const last = traces.at(-1);
  return coreStorage.traceQueryResponseSchema.parse({
    traces,
    page: {
      next:
        keys.length > plan.limit && last
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

/** Compile a span-row filter with exactly the same rules as trace span predicates. */
export function compileSpanQueryPredicate(predicate: TrustedTraceQueryScalarPredicate): SqlFragment {
  const parameters = new ParameterBuilder();
  const sql = compileScalarPredicate(predicate, SPAN_FIELDS, parameters);
  return { sql, params: parameters.params };
}
