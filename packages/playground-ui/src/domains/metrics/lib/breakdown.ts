/**
 * Rows of the Metrics Breakdown card: one per project, agent, workflow, tool, model, thread or
 * environment, merged from an aggregate (traces or spans, errors, P95) and metrics totals (tokens, cost).
 */
import type { AggregateSpansArgs, AggregateTracesArgs, AggregateTracesResponse, MastraClient } from '@mastra/client-js';

export type BreakdownTab = 'projects' | 'agents' | 'workflows' | 'tools' | 'models' | 'threads' | 'environments';

type AggregateRow = AggregateTracesResponse['rows'][number];
type UsageGroup = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>['groups'][number];
type SpanPredicate = NonNullable<AggregateSpansArgs['where']>;

/** The span types each entity tab counts. MCP tools count as tools. */
export const BREAKDOWN_SPAN_TYPES = {
  agents: ['agent_run'],
  workflows: ['workflow_run'],
  tools: ['tool_call', 'mcp_tool_call'],
} as const satisfies Partial<Record<BreakdownTab, readonly string[]>>;

export type BreakdownEntityTab = keyof typeof BREAKDOWN_SPAN_TYPES;

export const isEntityTab = (tab: BreakdownTab): tab is BreakdownEntityTab => tab in BREAKDOWN_SPAN_TYPES;

export function spanTypeWhere(tab: BreakdownEntityTab): SpanPredicate {
  const types: readonly string[] = BREAKDOWN_SPAN_TYPES[tab];
  if (types.length === 1) return { op: 'eq', left: { path: 'spanType' }, right: { literal: types[0] ?? '' } };
  return { op: 'in', value: { path: 'spanType' }, set: [...types] };
}

/**
 * Whether a tab has tokens and cost. Model usage is attributed to agents only (its `entityType` is
 * always `agent`), and tool spans carry none, so workflows and tools would show a column of dashes.
 */
export const hasUsage = (tab: BreakdownTab) => tab !== 'workflows' && tab !== 'tools';

/** Whether a tab has errors and P95. Models don't: their spans come from metrics, which have neither. */
export const hasErrors = (tab: BreakdownTab) => tab !== 'models';

/**
 * What the count column counts. Agents and workflows count the traces they ran in, so a nested
 * agent that runs 4 times in one request counts once. Tools and models count spans: one call each.
 */
export const countsSpans = (tab: BreakdownTab) => tab === 'tools' || tab === 'models';

/**
 * The dimensions that identify a row, at project scope; org-wide, every tab but Projects also
 * groups by project. Usage totals group by the same dimensions, so the two merge by key.
 */
export function breakdownGroupBy(tab: BreakdownTab, byProject: boolean): string[] {
  if (tab === 'projects') return ['projectId'];
  const by = (...dimensions: string[]) => (byProject ? ['projectId', ...dimensions] : dimensions);
  if (tab === 'environments') return by('environment');
  if (tab === 'threads') return by('threadId');
  // Provider first, so a row's name (its last dimension) is still the model, with its provider known.
  if (tab === 'models') return by('provider', 'model');
  return by('entityName');
}

type Scope = Pick<AggregateTracesArgs, 'timeRange' | 'where'>;

/** Rows the server returns per tab at most. Entity groups are capped lower: there can be thousands of tools. */
export const BREAKDOWN_GROUP_LIMIT = { trace: 1000, span: 500 } as const;

/** Traces, errors, P95, resources and threads per project. */
export function projectsAggregateRequest({ timeRange, where }: Scope): AggregateTracesArgs {
  return {
    timeRange,
    ...(where ? { where } : {}),
    groupBy: ['projectId'],
    measures: ['count', 'errorRate', 'duration.p95', 'countDistinct.resourceId', 'countDistinct.threadId'],
    limit: BREAKDOWN_GROUP_LIMIT.trace,
  };
}

export function environmentsAggregateRequest({ timeRange, where }: Scope, byProject: boolean): AggregateTracesArgs {
  return {
    timeRange,
    ...(where ? { where } : {}),
    groupBy: breakdownGroupBy('environments', byProject),
    measures: ['count', 'errorRate', 'duration.p95'],
    limit: BREAKDOWN_GROUP_LIMIT.trace,
  };
}

function withThread(where: Scope['where']): NonNullable<AggregateTracesArgs['where']> {
  const hasThread: NonNullable<AggregateTracesArgs['where']> = { op: 'exists', path: 'threadId' };
  return where ? { op: 'and', args: [hasThread, where] } : hasThread;
}

/**
 * Traces, errors and P95 per thread; traces without a thread aren't listed. A thread belongs to
 * one resource, so at project scope the second dimension names it for free. Org-wide the second
 * dimension is the project, and {@link threadResourcesRequest} names the resource.
 */
export function threadsAggregateRequest({ timeRange, where }: Scope, byProject: boolean): AggregateTracesArgs {
  return {
    timeRange,
    where: withThread(where),
    groupBy: byProject ? ['projectId', 'threadId'] : ['resourceId', 'threadId'],
    measures: ['count', 'errorRate', 'duration.p95'],
    limit: BREAKDOWN_GROUP_LIMIT.trace,
  };
}

export type BreakdownTraceTabName = 'projects' | 'environments' | 'threads';

/** The trace aggregate behind a Projects, Environments or Threads tab. */
export function traceTabRequest(tab: BreakdownTraceTabName, scope: Scope, byProject: boolean): AggregateTracesArgs {
  if (tab === 'projects') return projectsAggregateRequest(scope);
  if (tab === 'environments') return environmentsAggregateRequest(scope, byProject);
  return threadsAggregateRequest(scope, byProject);
}

/** Each thread's resource, org-wide, where the threads request has no dimension left for it. */
export function threadResourcesRequest({ timeRange, where }: Scope): AggregateTracesArgs {
  return {
    timeRange,
    where: withThread(where),
    groupBy: ['resourceId', 'threadId'],
    measures: ['count'],
    limit: BREAKDOWN_GROUP_LIMIT.trace,
  };
}

/** Each thread's resource id, from a threads request at project scope or {@link threadResourcesRequest}. */
export function threadResources(rows: AggregateRow[]): Map<string, string> {
  const resources = new Map<string, string>();
  for (const row of rows) {
    const resource = dimension(row, 'resourceId');
    if (resource) resources.set(dimension(row, 'threadId'), resource);
  }
  return resources;
}

/** The measure a tab's count column reads from its aggregate. */
const countMeasure = (tab: BreakdownTab) =>
  tab === 'agents' || tab === 'workflows' ? 'countDistinct.traceId' : 'count';

/**
 * Traces (agents, workflows) or spans (tools), errors and P95 per entity. Errors and P95 are per
 * run, nested runs included.
 */
export function entitiesAggregateRequest(
  tab: BreakdownEntityTab,
  { timeRange, where }: Pick<AggregateSpansArgs, 'timeRange' | 'where'>,
  byProject: boolean,
): AggregateSpansArgs {
  const types = spanTypeWhere(tab);
  return {
    timeRange,
    where: where ? { op: 'and', args: [types, where] } : types,
    groupBy: breakdownGroupBy(tab, byProject),
    measures: [
      'count',
      ...(countMeasure(tab) === 'count' ? [] : (['countDistinct.traceId'] as const)),
      'errorCount',
      'errorRate',
      'duration.p95',
    ],
    limit: BREAKDOWN_GROUP_LIMIT.span,
  };
}

export type BreakdownRow = {
  /** The row's key dimensions ({@link breakdownGroupBy}) joined with `|`. */
  key: string;
  /** Set when the rows group by project (org scope). */
  projectId?: string;
  /** The model's provider (Models tab); `''` when the usage has none. */
  provider?: string;
  /** The entity, environment, model, thread or project id; `''` when the group has no value. */
  name: string;
  /** Traces or spans, by tab ({@link countsSpans}). */
  count: number;
  /** Unset without runs. */
  errorRate?: number;
  p95?: number;
  resources?: number;
  threads?: number;
  /** The thread's resource (Threads tab). */
  resource?: string;
  /** Unset on tabs without model usage. */
  tokens?: number;
  /** Unset when the usage has no price. */
  cost?: number;
  costUnit?: string;
};

const measure = (row: AggregateRow, name: keyof AggregateRow['measures']) => {
  const value = row.measures[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const dimension = (row: AggregateRow, name: string) => {
  const value = row.dimensions?.[name];
  return value == null ? '' : String(value);
};

const groupKey = (group: UsageGroup, groupBy: readonly string[]) =>
  groupBy.map(d => (group.dimensions[d] == null ? '' : String(group.dimensions[d]))).join('|');

/** What a tab's rows are built from; every part is optional, keyed by the tab's {@link breakdownGroupBy}. */
export type BreakdownSources = {
  tab: BreakdownTab;
  groupBy: readonly string[];
  aggregateRows?: AggregateRow[];
  /** Tokens and cost per group. */
  usageGroups?: UsageGroup[];
  /** Model spans per group (Models tab), as counted metric events. */
  spanGroups?: UsageGroup[];
  /** Resource per thread id (Threads tab). */
  resources?: Map<string, string>;
};

/**
 * One row per group from the aggregate, with tokens and cost from the usage totals of the same
 * group. A group with usage but no runs in the window still gets a row, so spend is never dropped.
 */
export function buildBreakdownRows({
  tab,
  groupBy,
  aggregateRows = [],
  usageGroups,
  spanGroups = [],
  resources,
}: BreakdownSources): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow>();
  const projectAt = groupBy.indexOf('projectId');
  const providerAt = groupBy.indexOf('provider');
  const rowFor = (key: string) => {
    let row = rows.get(key);
    if (!row) {
      const values = key.split('|');
      row = {
        key,
        ...(projectAt >= 0 ? { projectId: values[projectAt] ?? '' } : {}),
        ...(providerAt >= 0 ? { provider: values[providerAt] ?? '' } : {}),
        name: values[values.length - 1] ?? '',
        count: 0,
        ...(usageGroups ? { tokens: 0 } : {}),
      };
      rows.set(key, row);
    }
    return row;
  };

  const count = countMeasure(tab);
  for (const aggregate of aggregateRows) {
    const row = rowFor(groupBy.map(d => dimension(aggregate, d)).join('|'));
    row.count = measure(aggregate, count) ?? 0;
    row.errorRate = measure(aggregate, 'errorRate');
    row.p95 = measure(aggregate, 'duration.p95');
    row.resources = measure(aggregate, 'countDistinct.resourceId');
    row.threads = measure(aggregate, 'countDistinct.threadId');
  }

  for (const group of spanGroups) rowFor(groupKey(group, groupBy)).count = group.value;

  for (const group of usageGroups ?? []) {
    const row = rowFor(groupKey(group, groupBy));
    row.tokens = group.value;
    row.cost = group.estimatedCost ?? undefined;
    row.costUnit = row.cost === undefined ? undefined : (group.costUnit ?? undefined);
  }

  if (resources) {
    for (const row of rows.values()) {
      const resource = resources.get(row.name);
      if (resource) row.resource = resource;
    }
  }

  return [...rows.values()];
}

/** A row's figures over the previous window, to compare with. */
export type PreviousFigures = {
  count?: number;
  errorRate?: number;
  p95?: number;
  tokens?: number;
  cost?: number;
};

/** The previous window's figures per row key, from the same sources as the current rows. */
export function previousFigures({
  tab,
  groupBy,
  aggregateRows = [],
  usageGroups = [],
  spanGroups = [],
}: Omit<BreakdownSources, 'resources'>): Map<string, PreviousFigures> {
  const figures = new Map<string, PreviousFigures>();
  const at = (key: string) => {
    let f = figures.get(key);
    if (!f) figures.set(key, (f = {}));
    return f;
  };
  const count = countMeasure(tab);
  for (const row of aggregateRows) {
    const f = at(groupBy.map(d => dimension(row, d)).join('|'));
    f.count = measure(row, count) ?? 0;
    f.errorRate = measure(row, 'errorRate');
    f.p95 = measure(row, 'duration.p95');
  }
  for (const group of spanGroups) at(groupKey(group, groupBy)).count = group.value;
  for (const group of usageGroups) {
    const f = at(groupKey(group, groupBy));
    f.tokens = group.value;
    f.cost = group.estimatedCost ?? undefined;
  }
  return figures;
}

/**
 * Adds a row for each group that had runs or usage in the previous window but none now, so a
 * stopped agent or a dropped model still shows, at zero and −100%.
 */
export function withDropped(
  rows: BreakdownRow[],
  previous: Map<string, PreviousFigures>,
  groupBy: readonly string[],
  usage: boolean,
): BreakdownRow[] {
  const listed = new Set(rows.map(r => r.key));
  const projectAt = groupBy.indexOf('projectId');
  const providerAt = groupBy.indexOf('provider');
  const dropped: BreakdownRow[] = [];
  for (const [key, before] of previous) {
    if (listed.has(key) || !((before.count ?? 0) > 0 || (before.tokens ?? 0) > 0)) continue;
    const values = key.split('|');
    dropped.push({
      key,
      ...(projectAt >= 0 ? { projectId: values[projectAt] ?? '' } : {}),
      ...(providerAt >= 0 ? { provider: values[providerAt] ?? '' } : {}),
      name: values[values.length - 1] ?? '',
      count: 0,
      ...(usage ? { tokens: 0 } : {}),
      ...(usage && before.cost !== undefined ? { cost: 0 } : {}),
    });
  }
  return [...rows, ...dropped];
}

export type ChangeMetric = 'count' | 'errorRate' | 'p95' | 'tokens' | 'cost';

export type Change = {
  /** Now minus before; unset when there is nothing to compare. */
  delta?: number;
  /** Relative change (0.5 = +50%); for error rate, the difference as a ratio (0.02 = +2 points). */
  change?: number;
  /** No figure in the previous window. */
  isNew: boolean;
};

/**
 * How a row's `metric` moved against the previous window. Runs, tokens and cost count a missing
 * previous figure as new; error rate and P95 have no figure without runs, so there's no change.
 */
export function rowChange(row: BreakdownRow, previous: PreviousFigures | undefined, metric: ChangeMetric): Change {
  const now = row[metric];
  if (now === undefined) return { isNew: false };
  const before = previous?.[metric];
  if (before === undefined) {
    return {
      isNew: metric === 'count' || metric === 'tokens' || metric === 'cost' ? now > 0 : false,
    };
  }
  const delta = now - before;
  return { delta, change: relativeChange(metric, delta, before), isNew: false };
}

function relativeChange(metric: ChangeMetric, delta: number, before: number) {
  if (metric === 'errorRate') return delta;
  return before > 0 ? delta / before : undefined;
}

/** Whether a change is good news: more traces or spans is; a higher error rate, P95, tokens or cost isn't. */
export function changeTrend(change: Change, metric: ChangeMetric): 'good' | 'bad' | undefined {
  if (change.delta === undefined || change.delta === 0) return undefined;
  return change.delta > 0 === (metric === 'count') ? 'good' : 'bad';
}
