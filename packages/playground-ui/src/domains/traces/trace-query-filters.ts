import type { QueryTracesInput } from '@mastra/client-js';
import type { TraceQueryPredicate, TraceQueryScalarPredicate } from '@mastra/core/storage';
import type { buildTraceListFilters, TraceStatusFilter } from './trace-filters';
import type { PropertyFilterToken } from '@/ds/components/PropertyFilter/types';

export const TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS = new Set([
  'tags',
  'runId',
  'sessionId',
  'requestId',
  'userId',
  'organizationId',
  'serviceName',
  'experimentId',
]);

export const TRACE_FILTER_OPERATOR_IDS = [
  'is',
  'isNot',
  'in',
  'notIn',
  'exists',
  'notExists',
  'gt',
  'gte',
  'lt',
  'lte',
  'matches',
  'notMatches',
] as const;
export type TraceFilterOperatorId = (typeof TRACE_FILTER_OPERATOR_IDS)[number];

export const isTraceFilterOperatorId = (value: string): value is TraceFilterOperatorId =>
  (TRACE_FILTER_OPERATOR_IDS as readonly string[]).includes(value);

/** A trace filter chip: `operatorId` defaults to `is` (equality / set membership). */
export type TraceFilterToken = PropertyFilterToken & {
  operatorId?: TraceFilterOperatorId;
  /** Only set for tokens inside a group: a group may hold several tokens on the same field. */
  id?: string;
};

export type TraceFilterLogic = 'and' | 'or';

/** An advanced filter: a nested boolean combination of tokens. */
export type TraceFilterGroup = { id: string; logic: TraceFilterLogic; nodes: TraceFilterNode[] };
export type TraceFilterNode = TraceFilterToken | TraceFilterGroup;

export const isTraceFilterGroup = (node: TraceFilterNode): node is TraceFilterGroup => 'nodes' in node;

const TRACE_FILTER_OPERATOR_TO_QUERY_OP = {
  is: 'eq',
  isNot: 'ne',
  in: 'in',
  notIn: 'notIn',
  exists: 'exists',
  notExists: 'notExists',
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
  matches: 'matches',
  notMatches: 'notMatches',
} as const satisfies Record<TraceFilterOperatorId, TraceQueryScalarPredicate['op']>;

/** Fields whose values must be sent as numbers. Non-numeric input is dropped. */
export const TRACE_QUERY_NUMERIC_FIELD_IDS = new Set(['spans.durationMs', 'scores.score', 'feedback.value']);

const TRACE_QUERY_TRACE_FIELD_IDS = new Set([
  'entityType',
  'status',
  'entityName',
  'environment',
  'traceId',
  'threadId',
  'resourceId',
]);

/** Trace-level fields that may be unset. "is not X" on these must also keep traces
 *  where the field is missing, so the predicate is `or[ne, notExists]`. */
export const TRACE_QUERY_OPTIONAL_TRACE_FIELD_IDS = new Set(['threadId', 'resourceId', 'environment']);

/** Negative operators are expressed as `none(<positive>)` on related collections. */
const NEGATIVE_TO_POSITIVE = {
  isNot: 'is',
  notIn: 'in',
  notExists: 'exists',
  notMatches: 'matches',
} as const satisfies Partial<Record<TraceFilterOperatorId, TraceFilterOperatorId>>;
type NegativeOperatorId = keyof typeof NEGATIVE_TO_POSITIVE;
const isNegativeOperator = (op: TraceFilterOperatorId): op is NegativeOperatorId => op in NEGATIVE_TO_POSITIVE;

const TRACE_QUERY_RELATED_SCOPES = ['spans', 'scores', 'feedback'] as const;
export type TraceQueryRelatedScope = (typeof TRACE_QUERY_RELATED_SCOPES)[number];

/** Split a field id into its related scope (`spans.` / `scores.` / `feedback.`) and
 *  the path inside that scope. Trace-level fields have no scope. `entityId` is the
 *  legacy id for `spans.entityId`. */
function resolveTraceQueryPath(fieldId: string): { scope?: TraceQueryRelatedScope; path: string } {
  if (fieldId === 'entityId') return { scope: 'spans', path: 'entityId' };
  for (const scope of TRACE_QUERY_RELATED_SCOPES) {
    if (fieldId.startsWith(`${scope}.`) && fieldId.length > scope.length + 1) {
      return { scope, path: fieldId.slice(scope.length + 1) };
    }
  }
  return { path: fieldId };
}

function scalarPredicate(
  op: TraceFilterOperatorId,
  path: string,
  values: (string | number)[],
): TraceQueryScalarPredicate | undefined {
  const queryOp = TRACE_FILTER_OPERATOR_TO_QUERY_OP[op];
  switch (queryOp) {
    case 'exists':
    case 'notExists':
      return { op: queryOp, path };
    case 'in':
    case 'notIn':
      return values.length ? { op: queryOp, value: { path }, set: values } : undefined;
    case 'matches':
    case 'notMatches': {
      const [literal] = values;
      return typeof literal === 'string' ? { op: queryOp, left: { path }, right: { literal } } : undefined;
    }
    default: {
      if (!values.length) return undefined;
      // `is` with several values is set membership; `isNot` with several is exclusion.
      if (values.length > 1) {
        if (queryOp === 'eq') return { op: 'in', value: { path }, set: values };
        if (queryOp === 'ne') return { op: 'notIn', value: { path }, set: values };
      }
      const [literal] = values;
      return literal === undefined ? undefined : { op: queryOp, left: { path }, right: { literal } };
    }
  }
}

type TokenPredicate =
  | { predicate: TraceQueryPredicate }
  /** A positive predicate on a related row; the caller decides how to wrap it in `some`. */
  | { scope: TraceQueryRelatedScope; predicate: TraceQueryScalarPredicate };

function tokenToTraceQueryPredicate(token: TraceFilterToken): TokenPredicate | undefined {
  if (TRACE_QUERY_UNSUPPORTED_FILTER_FIELDS.has(token.fieldId)) return undefined;
  const operatorId = token.operatorId ?? 'is';
  const isPresence = operatorId === 'exists' || operatorId === 'notExists';

  const rawValues = (Array.isArray(token.value) ? token.value : [token.value]).filter(
    (value): value is string => typeof value === 'string' && Boolean(value.trim()) && value !== 'Any',
  );
  if (!rawValues.length && !isPresence) return undefined;

  let fieldId = token.fieldId;
  let values: (string | number)[] = rawValues;
  // Discovered metadata fields: the field id is already the predicate path (`metadata.<key>`).
  if (fieldId.startsWith('metadata.')) {
    if (fieldId.length === 'metadata.'.length) return undefined;
  } else if (fieldId === 'rootEntityType' || fieldId === 'entityType') {
    fieldId = 'entityType';
  } else if (fieldId === 'status') {
    values = rawValues.filter(value => value !== 'running');
    if (!values.length && !isPresence) return undefined;
  } else if (TRACE_QUERY_NUMERIC_FIELD_IDS.has(fieldId)) {
    values = rawValues.map(Number).filter(value => !Number.isNaN(value));
    if (!values.length && !isPresence) return undefined;
  }

  const { scope, path } = resolveTraceQueryPath(fieldId);
  const isMetadata = fieldId.startsWith('metadata.');
  if (!scope && !isMetadata && !TRACE_QUERY_TRACE_FIELD_IDS.has(fieldId)) return undefined;

  if (scope && isNegativeOperator(operatorId)) {
    // `some(model ne X)` matches any trace with one span that differs; the user
    // means "no span with model X", which is `none(model eq X)`.
    const positive = scalarPredicate(NEGATIVE_TO_POSITIVE[operatorId], path, values);
    return positive ? { predicate: { [scope]: { none: positive } } as TraceQueryPredicate } : undefined;
  }

  const predicate = scalarPredicate(operatorId, path, values);
  if (!predicate) return undefined;
  if (scope) return { scope, predicate };
  if (
    (operatorId === 'isNot' || operatorId === 'notIn') &&
    (isMetadata || TRACE_QUERY_OPTIONAL_TRACE_FIELD_IDS.has(fieldId))
  ) {
    return { predicate: { op: 'or', args: [predicate, { op: 'notExists', path }] } };
  }
  return { predicate };
}

/** Convert tokens to predicates. With `mergeRelated`, tokens on the same related
 *  collection must match the same row (e.g. scorer X AND score < 0.6), so they are
 *  merged into a single `some`. Inside an `or` group each token stands alone. */
function predicatesForTokens(tokens: TraceFilterToken[], { mergeRelated }: { mergeRelated: boolean }) {
  const args: TraceQueryPredicate[] = [];
  const related: Record<TraceQueryRelatedScope, TraceQueryScalarPredicate[]> = { spans: [], scores: [], feedback: [] };

  for (const token of tokens) {
    const result = tokenToTraceQueryPredicate(token);
    if (!result) continue;
    if (!('scope' in result)) {
      args.push(result.predicate);
    } else if (mergeRelated) {
      related[result.scope].push(result.predicate);
    } else {
      args.push({ [result.scope]: { some: result.predicate } } as TraceQueryPredicate);
    }
  }

  for (const scope of TRACE_QUERY_RELATED_SCOPES) {
    const [first, ...rest] = related[scope];
    if (!first) continue;
    const some = rest.length ? { op: 'and' as const, args: [first, ...rest] } : first;
    args.push({ [scope]: { some } } as TraceQueryPredicate);
  }

  return args;
}

function groupToTraceQueryPredicate(group: TraceFilterGroup): TraceQueryPredicate | undefined {
  const tokens = group.nodes.filter((node): node is TraceFilterToken => !isTraceFilterGroup(node));
  const args = predicatesForTokens(tokens, { mergeRelated: group.logic === 'and' });
  for (const node of group.nodes) {
    if (!isTraceFilterGroup(node)) continue;
    const predicate = groupToTraceQueryPredicate(node);
    if (predicate) args.push(predicate);
  }
  if (args.length === 0) return undefined;
  return args.length === 1 ? args[0] : { op: group.logic, args };
}

export function buildTraceQueryRequest({
  rootEntityType,
  status,
  dateFrom,
  dateTo,
  tokens,
  groups = [],
  now,
}: Omit<Parameters<typeof buildTraceListFilters>[0], 'tokens' | 'status'> & {
  status?: TraceStatusFilter;
  tokens: TraceFilterToken[];
  groups?: TraceFilterGroup[];
  now: Date;
}): Pick<QueryTracesInput, 'timeRange' | 'where'> {
  const args: TraceQueryPredicate[] = [];

  if (rootEntityType) args.push({ op: 'eq', left: { path: 'entityType' }, right: { literal: rootEntityType } });
  if (status && status !== 'running') args.push({ op: 'eq', left: { path: 'status' }, right: { literal: status } });

  args.push(...predicatesForTokens(tokens, { mergeRelated: true }));

  for (const group of groups) {
    const predicate = groupToTraceQueryPredicate(group);
    if (predicate) args.push(predicate);
  }

  return {
    timeRange: {
      from: (dateFrom ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).toISOString(),
      to: (dateTo ?? now).toISOString(),
    },
    ...(args.length ? { where: { op: 'and' as const, args } } : {}),
  };
}

export const TRACE_QUERY_DISCOVERY_MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

/** Discovery endpoints reject ranges wider than 31 days (and `from >= to`); clamp
 *  the page's selected range so wide custom ranges still get field suggestions
 *  for the most recent window. */
export function clampTraceDiscoveryTimeRange(timeRange: { from: string; to: string }): { from: string; to: string } {
  const to = new Date(timeRange.to).getTime();
  const from = new Date(timeRange.from).getTime();
  const minFrom = to - TRACE_QUERY_DISCOVERY_MAX_RANGE_MS;
  if (from >= minFrom && from < to) return timeRange;
  return { from: new Date(minFrom).toISOString(), to: timeRange.to };
}
