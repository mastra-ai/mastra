/**
 * ClickHouse v-next filter builders.
 *
 * Produces { conditions: string[], params: Record<string, unknown> } tuples
 * that get AND-joined into WHERE clauses with parameterized values.
 */

import { TraceStatus } from '@mastra/core/storage';
import type {
  ListTracesArgs,
  ListLogsArgs,
  ListMetricsArgs,
  ListScoresArgs,
  ListFeedbackArgs,
  tracesFilterSchema,
  logsFilterSchema,
  metricsFilterSchema,
  scoresFilterSchema,
  feedbackFilterSchema,
} from '@mastra/core/storage';
import type { z } from 'zod/v4';

type TracesFilter = z.infer<typeof tracesFilterSchema>;
type LogsFilter = z.infer<typeof logsFilterSchema>;
type MetricsFilter = z.infer<typeof metricsFilterSchema>;
type ScoresFilter = z.infer<typeof scoresFilterSchema>;
type FeedbackFilter = z.infer<typeof feedbackFilterSchema>;
type TracesOrderBy = Extract<ListTracesArgs, { pagination?: unknown }>['orderBy'];
type LogsOrderBy = Extract<ListLogsArgs, { pagination?: unknown }>['orderBy'];
type MetricsOrderBy = Extract<ListMetricsArgs, { pagination?: unknown }>['orderBy'];
type ScoresOrderBy = Extract<ListScoresArgs, { pagination?: unknown }>['orderBy'];
type FeedbackOrderBy = Extract<ListFeedbackArgs, { pagination?: unknown }>['orderBy'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterResult {
  conditions: string[];
  params: Record<string, unknown>;
}

interface DateRange {
  start?: Date;
  end?: Date;
  startExclusive?: boolean;
  endExclusive?: boolean;
}

function assertNoDeprecatedSourceFilter(
  source: string | undefined,
  replacement: string,
  signalName: 'logs' | 'metrics' | 'scores' | 'feedback',
): void {
  if (source === undefined) return;
  throw new Error(`Deprecated \`source\` filter is not supported for ${signalName}; use \`${replacement}\` instead.`);
}

// ---------------------------------------------------------------------------
// Date range helper
// ---------------------------------------------------------------------------

function addDateRange(column: string, range: DateRange | undefined, prefix: string, out: FilterResult): void {
  if (!range) return;
  if (range.start) {
    const op = range.startExclusive ? '>' : '>=';
    const param = `${prefix}Start`;
    out.conditions.push(`${column} ${op} {${param}:DateTime64(3)}`);
    out.params[param] = range.start.getTime();
  }
  if (range.end) {
    const op = range.endExclusive ? '<' : '<=';
    const param = `${prefix}End`;
    out.conditions.push(`${column} ${op} {${param}:DateTime64(3)}`);
    out.params[param] = range.end.getTime();
  }
}

// ---------------------------------------------------------------------------
// Simple equality helper
// ---------------------------------------------------------------------------

function addEq(column: string, value: unknown, paramName: string, paramType: string, out: FilterResult): void {
  if (value == null) return;
  out.conditions.push(`${column} = {${paramName}:${paramType}}`);
  out.params[paramName] = value;
}

function addIn(column: string, values: string[] | undefined, paramName: string, out: FilterResult): void {
  if (!values?.length) return;
  out.conditions.push(`${column} IN {${paramName}:Array(String)}`);
  out.params[paramName] = values;
}

function addTags(column: string, tags: unknown, out: FilterResult): void {
  if (!Array.isArray(tags) || tags.length === 0) return;
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (typeof tag !== 'string' || tag.trim() === '') continue;
    const param = `tag_${i}`;
    out.conditions.push(`has(${column}, {${param}:String})`);
    out.params[param] = tag;
  }
}

function addStringMapFilters(
  column: string,
  values: Record<string, unknown> | null | undefined,
  keyPrefix: string,
  valuePrefix: string,
  out: FilterResult,
): void {
  if (values == null || typeof values !== 'object') return;
  let i = 0;
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'string') continue;
    const keyParam = `${keyPrefix}_${i}`;
    const valParam = `${valuePrefix}_${i}`;
    out.conditions.push(`${column}[{${keyParam}:String}] = {${valParam}:String}`);
    out.params[keyParam] = key;
    out.params[valParam] = value;
    i++;
  }
}

/**
 * Adds shared context filter conditions (commonFilterFields) to the output.
 * Used by logs, metrics, scores, and feedback filter builders.
 */
function addCommonFilterFields(
  filters: {
    timestamp?: unknown;
    traceId?: string;
    spanId?: string;
    entityType?: string;
    entityName?: string;
    entityVersionId?: string;
    parentEntityVersionId?: string;
    parentEntityType?: string;
    parentEntityName?: string;
    rootEntityVersionId?: string;
    rootEntityType?: string;
    rootEntityName?: string;
    userId?: string;
    organizationId?: string;
    experimentId?: string;
    resourceId?: string;
    runId?: string;
    sessionId?: string;
    threadId?: string;
    requestId?: string;
    serviceName?: string;
    environment?: string;
    executionSource?: string;
    tags?: string[];
  },
  tableAlias: string | undefined,
  out: FilterResult,
): void {
  const col = (name: string) => (tableAlias ? `${tableAlias}.${name}` : name);

  addDateRange(col('timestamp'), filters.timestamp as DateRange | undefined, 'timestamp', out);
  addEq(col('traceId'), filters.traceId, 'traceId', 'String', out);
  addEq(col('spanId'), filters.spanId, 'spanId', 'String', out);
  addEq(col('entityType'), filters.entityType, 'entityType', 'String', out);
  addEq(col('entityName'), filters.entityName, 'entityName', 'String', out);
  addEq(col('entityVersionId'), filters.entityVersionId, 'entityVersionId', 'String', out);
  addEq(col('parentEntityVersionId'), filters.parentEntityVersionId, 'parentEntityVersionId', 'String', out);
  addEq(col('parentEntityType'), filters.parentEntityType, 'parentEntityType', 'String', out);
  addEq(col('parentEntityName'), filters.parentEntityName, 'parentEntityName', 'String', out);
  addEq(col('rootEntityVersionId'), filters.rootEntityVersionId, 'rootEntityVersionId', 'String', out);
  addEq(col('rootEntityType'), filters.rootEntityType, 'rootEntityType', 'String', out);
  addEq(col('rootEntityName'), filters.rootEntityName, 'rootEntityName', 'String', out);
  addEq(col('userId'), filters.userId, 'userId', 'String', out);
  addEq(col('organizationId'), filters.organizationId, 'organizationId', 'String', out);
  addEq(col('experimentId'), filters.experimentId, 'experimentId', 'String', out);
  addEq(col('resourceId'), filters.resourceId, 'resourceId', 'String', out);
  addEq(col('runId'), filters.runId, 'runId', 'String', out);
  addEq(col('sessionId'), filters.sessionId, 'sessionId', 'String', out);
  addEq(col('threadId'), filters.threadId, 'threadId', 'String', out);
  addEq(col('requestId'), filters.requestId, 'requestId', 'String', out);
  addEq(col('serviceName'), filters.serviceName, 'serviceName', 'String', out);
  addEq(col('environment'), filters.environment, 'environment', 'String', out);
  addEq(col('executionSource'), filters.executionSource, 'executionSource', 'String', out);
  addTags(col('tags'), filters.tags, out);
}

// ---------------------------------------------------------------------------
// Trace filter builder (for trace_roots table)
// ---------------------------------------------------------------------------

export function buildTraceFilterConditions(filters: TracesFilter | undefined, tableAlias?: string): FilterResult {
  const out: FilterResult = { conditions: [], params: {} };
  if (!filters) return out;

  const col = (name: string) => (tableAlias ? `${tableAlias}.${name}` : name);

  addDateRange(col('startedAt'), filters.startedAt as DateRange | undefined, 'startedAt', out);
  addDateRange(col('endedAt'), filters.endedAt as DateRange | undefined, 'endedAt', out);
  addEq(col('spanType'), filters.spanType, 'spanType', 'String', out);
  addEq(col('entityType'), filters.entityType, 'entityType', 'String', out);
  addEq(col('entityId'), filters.entityId, 'entityId', 'String', out);
  addEq(col('entityName'), filters.entityName, 'entityName', 'String', out);
  addEq(col('entityVersionId'), filters.entityVersionId, 'entityVersionId', 'String', out);
  addEq(col('parentEntityVersionId'), filters.parentEntityVersionId, 'parentEntityVersionId', 'String', out);
  addEq(col('parentEntityType'), filters.parentEntityType, 'parentEntityType', 'String', out);
  addEq(col('parentEntityId'), filters.parentEntityId, 'parentEntityId', 'String', out);
  addEq(col('parentEntityName'), filters.parentEntityName, 'parentEntityName', 'String', out);
  addEq(col('rootEntityVersionId'), filters.rootEntityVersionId, 'rootEntityVersionId', 'String', out);
  addEq(col('rootEntityType'), filters.rootEntityType, 'rootEntityType', 'String', out);
  addEq(col('rootEntityId'), filters.rootEntityId, 'rootEntityId', 'String', out);
  addEq(col('rootEntityName'), filters.rootEntityName, 'rootEntityName', 'String', out);
  addEq(col('experimentId'), filters.experimentId, 'experimentId', 'String', out);
  addEq(col('userId'), filters.userId, 'userId', 'String', out);
  addEq(col('organizationId'), filters.organizationId, 'organizationId', 'String', out);
  addEq(col('resourceId'), filters.resourceId, 'resourceId', 'String', out);
  addEq(col('runId'), filters.runId, 'runId', 'String', out);
  addEq(col('sessionId'), filters.sessionId, 'sessionId', 'String', out);
  addEq(col('threadId'), filters.threadId, 'threadId', 'String', out);
  addEq(col('requestId'), filters.requestId, 'requestId', 'String', out);
  addEq(col('environment'), filters.environment, 'environment', 'String', out);
  // Trace filters still accept `source`, but it maps to the `executionSource` DB column.
  addEq(col('executionSource'), filters.source, 'source', 'String', out);
  addEq(col('serviceName'), filters.serviceName, 'serviceName', 'String', out);

  addTags(col('tags'), filters.tags, out);
  addStringMapFilters(col('metadataSearch'), filters.metadata, 'meta_k', 'meta_v', out);

  if (filters.status === TraceStatus.ERROR) {
    out.conditions.push(`${col('error')} IS NOT NULL`);
  } else if (filters.status === TraceStatus.SUCCESS) {
    out.conditions.push(`${col('error')} IS NULL`);
  } else if (filters.status === TraceStatus.RUNNING) {
    out.conditions.push('1 = 0');
  }

  return out;
}

export function buildLogsFilterConditions(filters: LogsFilter | undefined, tableAlias?: string): FilterResult {
  const out: FilterResult = { conditions: [], params: {} };
  if (!filters) return out;

  const col = (name: string) => (tableAlias ? `${tableAlias}.${name}` : name);
  assertNoDeprecatedSourceFilter(filters.source, 'executionSource', 'logs');
  addCommonFilterFields(filters, tableAlias, out);

  if (typeof filters.level === 'string') {
    addEq(col('level'), filters.level, 'level', 'String', out);
  } else if (Array.isArray(filters.level)) {
    addIn(col('level'), filters.level, 'levels', out);
  }

  return out;
}

export function buildMetricsFilterConditions(filters: MetricsFilter | undefined, tableAlias?: string): FilterResult {
  const out: FilterResult = { conditions: [], params: {} };
  if (!filters) return out;

  const col = (name: string) => (tableAlias ? `${tableAlias}.${name}` : name);
  assertNoDeprecatedSourceFilter(filters.source, 'executionSource', 'metrics');
  addCommonFilterFields(filters, tableAlias, out);
  addIn(col('name'), filters.name, 'metricNames', out);
  addEq(col('provider'), filters.provider, 'provider', 'String', out);
  addEq(col('model'), filters.model, 'model', 'String', out);
  addEq(col('costUnit'), filters.costUnit, 'costUnit', 'String', out);
  addStringMapFilters(col('labels'), filters.labels, 'label_k', 'label_v', out);

  return out;
}

export function buildScoresFilterConditions(filters: ScoresFilter | undefined, tableAlias?: string): FilterResult {
  const out: FilterResult = { conditions: [], params: {} };
  if (!filters) return out;
  assertNoDeprecatedSourceFilter(filters.source, 'scoreSource or executionSource', 'scores');

  const col = (name: string) => (tableAlias ? `${tableAlias}.${name}` : name);

  // Shared context filters (scores have dedicated executionSource column)
  addCommonFilterFields(filters, tableAlias, out);

  // Score-specific filters
  addEq(col('scoreSource'), filters.scoreSource, 'scoreSource', 'String', out);

  if (typeof filters.scorerId === 'string') {
    addEq(col('scorerId'), filters.scorerId, 'scorerId', 'String', out);
  } else if (Array.isArray(filters.scorerId)) {
    addIn(col('scorerId'), filters.scorerId, 'scorerIds', out);
  }

  return out;
}

export function buildFeedbackFilterConditions(filters: FeedbackFilter | undefined, tableAlias?: string): FilterResult {
  const out: FilterResult = { conditions: [], params: {} };
  if (!filters) return out;
  assertNoDeprecatedSourceFilter(filters.source, 'feedbackSource or executionSource', 'feedback');

  const col = (name: string) => (tableAlias ? `${tableAlias}.${name}` : name);

  // Shared context filters (feedback has dedicated executionSource column)
  addCommonFilterFields(filters, tableAlias, out);

  // Feedback-specific filters
  const fbActor = filters.feedbackUserId ?? filters.userId;
  // feedbackUserId filter targets the dedicated feedbackUserId column
  addEq(col('feedbackUserId'), fbActor, 'feedbackUserId', 'String', out);

  addEq(col('feedbackSource'), filters.feedbackSource, 'feedbackSource', 'String', out);

  if (typeof filters.feedbackType === 'string') {
    addEq(col('feedbackType'), filters.feedbackType, 'feedbackType', 'String', out);
  } else if (Array.isArray(filters.feedbackType)) {
    addIn(col('feedbackType'), filters.feedbackType, 'feedbackTypes', out);
  }

  return out;
}

export function buildTraceOrderByClause(orderBy: TracesOrderBy, tableAlias?: string): string {
  return buildOrderByClause(['startedAt', 'endedAt'] as const, orderBy, tableAlias, 'startedAt');
}

function buildOrderByClause<TField extends string>(
  allowedFields: readonly TField[],
  orderBy: { field?: TField; direction?: 'ASC' | 'DESC' } | undefined,
  tableAlias: string | undefined,
  defaultField: TField,
): string {
  const field = orderBy?.field && allowedFields.includes(orderBy.field) ? orderBy.field : defaultField;
  const direction = orderBy?.direction === 'ASC' ? 'ASC' : 'DESC';
  const col = tableAlias ? `${tableAlias}.${field}` : field;
  return `${col} ${direction}`;
}

export function buildSignalOrderByClause<TField extends string>(
  allowedFields: readonly TField[],
  orderBy:
    | LogsOrderBy
    | MetricsOrderBy
    | ScoresOrderBy
    | FeedbackOrderBy
    | { field?: TField; direction?: 'ASC' | 'DESC' }
    | undefined,
  tableAlias?: string,
  defaultField = 'timestamp' as TField,
): string {
  return buildOrderByClause(
    allowedFields,
    orderBy as { field?: TField; direction?: 'ASC' | 'DESC' } | undefined,
    tableAlias,
    defaultField,
  );
}

export function buildPaginationClause(pagination: { page?: number; perPage?: number } | undefined): {
  page: number;
  perPage: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(0, Number(pagination?.page ?? 0));
  const perPage = Math.max(1, Number(pagination?.perPage ?? 10));
  return {
    page,
    perPage,
    limit: perPage,
    offset: page * perPage,
  };
}
