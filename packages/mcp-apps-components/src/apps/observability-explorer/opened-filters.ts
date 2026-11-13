import type { PropertyFilterToken } from '@mastra/playground-ui/components/PropertyFilter';
import { applyLogsPropertyFilterTokens, buildLogsListFilters } from '@mastra/playground-ui/domains/logs/log-filters';
import {
  METRICS_PROPERTY_FILTER_PARAM_BY_FIELD,
  METRICS_ROOT_ENTITY_TYPE_PARAM,
  getMetricsPropertyFilterTokens,
} from '@mastra/playground-ui/domains/metrics/metrics-filters';
import {
  DEFAULT_TRACES_FILTERS,
  buildTracesQueryRequest,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer/traces-explorer-actions';
import type { TracesFilters } from '@mastra/playground-ui/domains/traces/components/traces-explorer/traces-explorer-actions';
import {
  TRACE_DATE_FROM_PARAM,
  TRACE_DATE_PRESET_PARAM,
  TRACE_DATE_PRESET_VALUES,
  TRACE_DATE_TO_PARAM,
  applyTracePropertyFilterTokens,
  getTraceFilterGroups,
  getTracePropertyFilterTokens,
} from '@mastra/playground-ui/domains/traces/trace-filters';
import type {
  TraceFilterGroup,
  TraceFilterNode,
  TraceFilterOperatorId,
  TraceFilterToken,
} from '@mastra/playground-ui/domains/traces/trace-query-filters';

type Args = Record<string, unknown>;
type Predicate = Record<string, any>;

/**
 * Turns the model's `query_traces` predicate into the filter bar's chips, so the user sees and edits the
 * filters the model applied. A conjunct becomes chips only if Studio, given those chips (after a trip through
 * Studio's URL params, which the "Open in Studio" link uses), builds the very same predicate back. The
 * conjuncts that can't round-trip stay in `rest`, still applied to every query.
 */
export function whereToTraceFilters(where: unknown): {
  tokens: TraceFilterToken[];
  groups: TraceFilterGroup[];
  rest?: Predicate;
} {
  const tokens: TraceFilterToken[] = [];
  const groups: TraceFilterGroup[] = [];
  const accepted: Predicate[] = [];
  const rest: Predicate[] = [];
  const ids = { next: 0 };

  for (const conjunct of conjuncts(where)) {
    const nodes = toNodes(conjunct, ids, false);
    const nextTokens = [...tokens, ...(nodes?.filter(isToken) ?? [])];
    const nextGroups = [...groups, ...(nodes?.filter(isGroup) ?? [])];
    if (nodes && rebuilds({ tokens: nextTokens, groups: nextGroups }, [...accepted, conjunct])) {
      tokens.splice(0, tokens.length, ...nextTokens);
      groups.splice(0, groups.length, ...nextGroups);
      accepted.push(conjunct);
    } else {
      rest.push(conjunct);
    }
  }
  return {
    tokens,
    groups,
    ...(rest.length > 0 ? { rest: rest.length === 1 ? rest[0] : { op: 'and', args: rest } } : {}),
  };
}

/** The `list_logs` filters Studio's logs filter bar draws, as its URL params; `rest` is the remainder. */
export function logArgsToParams(logs: Args, params: URLSearchParams): { params: URLSearchParams; rest?: Args } {
  const tokens: { fieldId: string; value: string | string[] }[] = [];
  const rest: Args = {};
  let rootEntityType: string | undefined;
  for (const [key, value] of Object.entries(logs)) {
    const fieldId = LOG_FIELD_BY_ARG[key];
    const level = key === 'level' && Array.isArray(value) && value.length === 1 ? value[0] : value;
    if (key === 'rootEntityType' && typeof value === 'string') rootEntityType = value;
    else if (key === 'tags' && Array.isArray(value) && value.every(tag => typeof tag === 'string') && value.length > 0)
      tokens.push({ fieldId: 'tags', value: value as string[] });
    else if (fieldId && typeof level === 'string' && level.trim()) tokens.push({ fieldId, value: level });
    else rest[key] = value;
  }
  const drawn = Object.fromEntries(
    Object.entries(logs)
      .filter(([key]) => !(key in rest))
      .map(([key, value]) => [key, key === 'level' && Array.isArray(value) ? value[0] : value]),
  );
  // Only draw the filters if the logs tab, given them, asks for the same thing.
  if (canonical(buildLogsListFilters({ rootEntityType, tokens })) !== canonical(drawn)) {
    return { params, ...(Object.keys(logs).length > 0 ? { rest: logs } : {}) };
  }
  const next = new URLSearchParams(params);
  applyLogsPropertyFilterTokens(next, [
    ...(rootEntityType ? [{ fieldId: 'rootEntityType', value: rootEntityType }] : []),
    ...tokens,
  ]);
  return { params: next, ...(Object.keys(rest).length > 0 ? { rest } : {}) };
}

/** `list_logs` filters and the logs filter bar's field for each. */
const LOG_FIELD_BY_ARG: Record<string, string> = {
  level: 'level',
  rootEntityName: 'entityName',
  traceId: 'traceId',
  spanId: 'spanId',
  runId: 'runId',
  threadId: 'threadId',
  sessionId: 'sessionId',
  requestId: 'requestId',
  resourceId: 'resourceId',
  userId: 'userId',
  organizationId: 'organizationId',
  serviceName: 'serviceName',
  environment: 'environment',
  experimentId: 'experimentId',
};

const isToken = (node: TraceFilterNode): node is TraceFilterToken => !('nodes' in node);
const isGroup = (node: TraceFilterNode): node is TraceFilterGroup => 'nodes' in node;

function conjuncts(where: unknown): Predicate[] {
  if (!where || typeof where !== 'object') return [];
  const predicate = where as Predicate;
  return predicate.op === 'and' && Array.isArray(predicate.args) ? predicate.args.flatMap(conjuncts) : [predicate];
}

/** The traces filters in a Studio traces URL, as Studio's traces page reads them. */
/**
 * Turns `analyze_metrics` filters into the dashboard's starting time range and filter chips, through Studio's
 * metrics URL params. `unapplied` names the filters the dashboard has no chip for, so the app can say the
 * dashboard's totals ignore them. `name` picks the analyzed metric, not a scope, so it's left out.
 */
export function metricsArgsToFilters(filters: unknown): {
  tokens: PropertyFilterToken[];
  range?: { from?: Date; to?: Date };
  unapplied: string[];
} {
  const { timestamp, name: _name, ...dimensions } = (filters ?? {}) as Args;
  const params = new URLSearchParams();
  const unapplied: string[] = [];
  const paramFor: Record<string, string> = {
    ...METRICS_PROPERTY_FILTER_PARAM_BY_FIELD,
    rootEntityType: METRICS_ROOT_ENTITY_TYPE_PARAM,
  };
  for (const [key, value] of Object.entries(dimensions)) {
    if (value == null) continue;
    const param = paramFor[key];
    const values = Array.isArray(value) ? value : [value];
    if (!param || values.length === 0 || !values.every(item => typeof item === 'string')) unapplied.push(key);
    else for (const item of values) params.append(param, item);
  }
  const { start, end } = (timestamp ?? {}) as { start?: string; end?: string };
  const range =
    start || end ? { from: start ? new Date(start) : undefined, to: end ? new Date(end) : undefined } : undefined;
  return { tokens: getMetricsPropertyFilterTokens(params), range, unapplied };
}

export function decodeTraceFilters(params: URLSearchParams): TracesFilters {
  const parseDate = (raw: string | null) => {
    const date = raw ? new Date(raw) : undefined;
    return date && !Number.isNaN(date.getTime()) ? date : undefined;
  };
  const preset = params.get(TRACE_DATE_PRESET_PARAM) as TracesFilters['datePreset'] | null;
  return {
    datePreset:
      preset && preset !== 'all' && TRACE_DATE_PRESET_VALUES.has(preset) ? preset : DEFAULT_TRACES_FILTERS.datePreset,
    dateFrom: parseDate(params.get(TRACE_DATE_FROM_PARAM)),
    dateTo: parseDate(params.get(TRACE_DATE_TO_PARAM)),
    tokens: getTracePropertyFilterTokens(params),
    groups: getTraceFilterGroups(params),
  };
}

/** The traces filters as a Studio traces URL's params, the inverse of `decodeTraceFilters`. */
export function encodeTraceFilters(filters: TracesFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.datePreset) params.set(TRACE_DATE_PRESET_PARAM, filters.datePreset);
  if (filters.dateFrom) params.set(TRACE_DATE_FROM_PARAM, filters.dateFrom.toISOString());
  if (filters.dateTo) params.set(TRACE_DATE_TO_PARAM, filters.dateTo.toISOString());
  applyTracePropertyFilterTokens(params, filters.tokens, filters.groups);
  return params;
}

/** Whether Studio, given these filters, queries exactly `expected`. */
function rebuilds(filters: Pick<TracesFilters, 'tokens' | 'groups'>, expected: Predicate[]): boolean {
  const roundTripped = decodeTraceFilters(encodeTraceFilters({ datePreset: 'custom', ...filters }));
  const { where } = buildTracesQueryRequest({
    filters: roundTripped,
    now: new Date(),
    withRootDuration: true,
    withTimeToFirstChunk: true,
    withTimeToFirstToken: true,
    withOutcomeFields: true,
  });
  const built = new Set(conjuncts(where).map(canonical));
  const wanted = new Set(expected.map(canonical));
  return built.size === wanted.size && [...built].every(item => wanted.has(item));
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

const OPERATOR_BY_OP: Record<string, TraceFilterOperatorId> = {
  eq: 'is',
  ne: 'isNot',
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
  matches: 'matches',
  notMatches: 'notMatches',
};
const NEGATED: Partial<Record<TraceFilterOperatorId, TraceFilterOperatorId>> = {
  is: 'isNot',
  in: 'notIn',
  exists: 'notExists',
  matches: 'notMatches',
};
const RELATED_SCOPES = ['spans', 'scores', 'feedback'] as const;

const literal = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
const fieldFor = (path: unknown) =>
  path === 'entityType' ? 'rootEntityType' : typeof path === 'string' ? path : undefined;

/** A scalar comparison as one chip, or undefined when no chip draws it. */
function scalarToken(predicate: Predicate, prefix = ''): TraceFilterToken | undefined {
  const { op } = predicate;
  if (op === 'exists' || op === 'notExists') {
    const fieldId = fieldFor(predicate.path);
    return fieldId ? { fieldId: prefix + fieldId, operatorId: op, value: '' } : undefined;
  }
  if (op === 'in' || op === 'notIn') {
    const fieldId = fieldFor(predicate.value?.path);
    const values = Array.isArray(predicate.set) ? predicate.set.map(literal) : [];
    if (!fieldId || values.length === 0 || values.some(v => v === undefined)) return undefined;
    return { fieldId: prefix + fieldId, operatorId: op, value: values as string[] };
  }
  const operatorId = OPERATOR_BY_OP[op];
  const fieldId = fieldFor(predicate.left?.path);
  const value = literal(predicate.right?.literal);
  if (!operatorId || !fieldId || value === undefined) return undefined;
  return { fieldId: prefix + fieldId, operatorId, value };
}

/** Tag membership, as Studio builds it: `includes` per tag, `or`-ed; exclusion also keeps untagged traces. */
function tagsToken(predicate: Predicate): TraceFilterToken | undefined {
  const tagsOf = (p: Predicate, op: string): string[] | undefined => {
    if (p.op === op && p.path === 'tags' && typeof p.value === 'string') return [p.value];
    const logic = op === 'includes' ? 'or' : 'and';
    if (p.op !== logic || !Array.isArray(p.args)) return undefined;
    const tags = p.args.map((arg: Predicate) => (arg.op === op && arg.path === 'tags' ? arg.value : undefined));
    return tags.every((tag: unknown) => typeof tag === 'string') ? tags : undefined;
  };
  const included = tagsOf(predicate, 'includes');
  if (included) return { fieldId: 'tags', operatorId: 'in', value: included };
  if (predicate.op !== 'or' || predicate.args?.length !== 2) return undefined;
  const [excluded, untagged] = predicate.args as Predicate[];
  const tags = tagsOf(excluded!, 'notIncludes');
  return tags && untagged?.op === 'notExists' && untagged.path === 'tags'
    ? { fieldId: 'tags', operatorId: 'notIn', value: tags }
    : undefined;
}

/** One conjunct of the model's predicate as chips or an advanced filter group, or undefined if neither fits. */
function toNodes(predicate: Predicate, ids: { next: number }, inGroup: boolean): TraceFilterNode[] | undefined {
  const withId = (token: TraceFilterToken) => (inGroup ? { ...token, id: `opened-${ids.next++}` } : token);
  const tags = tagsToken(predicate);
  if (tags) return [withId(tags)];

  for (const scope of RELATED_SCOPES) {
    const related = predicate[scope] as Predicate | undefined;
    if (!related) continue;
    if (related.some) {
      const parts = related.some.op === 'and' ? (related.some.args as Predicate[]) : [related.some as Predicate];
      const tokens = parts.map(part => scalarToken(part, `${scope}.`));
      return tokens.every(Boolean) ? (tokens as TraceFilterToken[]).map(withId) : undefined;
    }
    const positive = related.none ? scalarToken(related.none, `${scope}.`) : undefined;
    const operatorId = positive && NEGATED[positive.operatorId ?? 'is'];
    return positive && operatorId ? [withId({ ...positive, operatorId })] : undefined;
  }

  if (predicate.op === 'or' || predicate.op === 'and') {
    const args = predicate.args as Predicate[] | undefined;
    // Studio's "is not" on an optional field also keeps traces without it: `or[ne, notExists]`.
    const [negative, missing] = args ?? [];
    if (predicate.op === 'or' && args?.length === 2 && missing?.op === 'notExists') {
      const token = scalarToken(negative!);
      const path = negative?.left?.path ?? negative?.value?.path;
      if (token && (token.operatorId === 'isNot' || token.operatorId === 'notIn') && path === missing.path) {
        return [withId(token)];
      }
    }
    const nodes = args?.map(arg => toNodes(arg, ids, true));
    if (!nodes || nodes.some(node => !node)) return undefined;
    return [{ id: `opened-${ids.next++}`, logic: predicate.op, nodes: nodes.flat() as TraceFilterNode[] }];
  }

  const token = scalarToken(predicate);
  return token ? [withId(token)] : undefined;
}
