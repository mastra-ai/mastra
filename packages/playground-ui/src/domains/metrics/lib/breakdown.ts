/**
 * Rows of the Metrics Breakdown card: one per project, agent, workflow, tool or environment,
 * merged from an aggregate (runs or traces, errors, P95) and a token series (tokens, cost, trend).
 */
import type { AggregateSpansArgs, AggregateTracesArgs, AggregateTracesResponse, MastraClient } from '@mastra/client-js';
import type { BucketLabels } from './metrics-buckets';
import { gridIndex } from './metrics-buckets';

export type BreakdownTab = 'projects' | 'agents' | 'workflows' | 'tools' | 'models' | 'threads' | 'environments';

type AggregateRow = AggregateTracesResponse['rows'][number];
type TimeSeries = Awaited<ReturnType<MastraClient['getMetricTimeSeries']>>['series'][number];
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

/**
 * Whether a tab's tokens come per bucket, with a Trend column. Threads are too many for a series
 * per thread, and models have no runs to put beside one: both take totals from a metrics breakdown.
 */
export const hasTrend = (tab: BreakdownTab) => tab === 'projects' || tab === 'agents' || tab === 'environments';

/** Whether a tab has runs or traces. Models don't: a run isn't tied to one model. */
export const hasRuns = (tab: BreakdownTab) => tab !== 'models';

/** What each tab groups by, at project scope; org-wide entity tabs also group by project. */
export function breakdownGroupBy(tab: BreakdownTab, byProject: boolean): string[] {
  if (tab === 'projects') return ['projectId'];
  if (tab === 'environments') return ['environment'];
  if (tab === 'threads') return ['threadId'];
  if (tab === 'models') return ['model'];
  return byProject ? ['projectId', 'entityName'] : ['entityName'];
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

export function environmentsAggregateRequest({ timeRange, where }: Scope): AggregateTracesArgs {
  return {
    timeRange,
    ...(where ? { where } : {}),
    groupBy: ['environment'],
    measures: ['count', 'errorRate', 'duration.p95'],
    limit: BREAKDOWN_GROUP_LIMIT.trace,
  };
}

/** Traces, errors and P95 per thread; traces without a thread aren't listed. */
export function threadsAggregateRequest({ timeRange, where }: Scope): AggregateTracesArgs {
  const hasThread: NonNullable<AggregateTracesArgs['where']> = { op: 'exists', path: 'threadId' };
  return {
    timeRange,
    where: where ? { op: 'and', args: [hasThread, where] } : hasThread,
    groupBy: ['threadId'],
    measures: ['count', 'errorRate', 'duration.p95'],
    limit: BREAKDOWN_GROUP_LIMIT.trace,
  };
}

/** Runs, errors and P95 per agent, workflow or tool: every run, nested ones included. */
export function entitiesAggregateRequest(
  tab: BreakdownEntityTab,
  { timeRange, where }: Pick<AggregateSpansArgs, 'timeRange' | 'where'>,
  byProject: boolean,
): AggregateSpansArgs {
  const types = spanTypeWhere(tab);
  return {
    timeRange,
    where: where ? { op: 'and', args: [types, where] } : types,
    groupBy: byProject ? ['projectId', 'entityName'] : ['entityName'],
    measures: ['count', 'errorCount', 'errorRate', 'duration.p95'],
    limit: BREAKDOWN_GROUP_LIMIT.span,
  };
}

export type BreakdownRow = {
  /** The group's dimension values joined with `|`, as metric series name them. */
  key: string;
  /** Set when the rows group by project (org scope). */
  projectId?: string;
  /** The entity, environment or project id; `''` when the group has no value. */
  name: string;
  count: number;
  /** Unset without runs. */
  errorRate?: number;
  p95?: number;
  resources?: number;
  threads?: number;
  /** Unset on tabs without model usage. */
  tokens?: number;
  /** Unset when the usage has no price. */
  cost?: number;
  costUnit?: string;
  /** Tokens per bucket, oldest first. */
  trend: number[];
};

const measure = (row: AggregateRow, name: keyof AggregateRow['measures']) => {
  const value = row.measures[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const dimension = (row: AggregateRow, name: string) => {
  const value = row.dimensions?.[name];
  return value == null ? '' : String(value);
};

/**
 * One row per aggregate group, with tokens, cost and a trend from the series of the same group.
 * A group with usage but no runs in the window still gets a row, so spend is never dropped.
 */
export function buildBreakdownRows(
  aggregateRows: AggregateRow[],
  groupBy: readonly string[],
  series: TimeSeries[] | undefined,
  grid: { buckets: BucketLabels[]; stepHours: number },
  /** Tokens and cost per group as totals, for tabs without a series (threads, models). */
  usageGroups?: UsageGroup[],
): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow>();
  const rowFor = (values: string[]) => {
    const key = values.join('|');
    let row = rows.get(key);
    if (!row) {
      const projectAt = groupBy.indexOf('projectId');
      row = {
        key,
        ...(projectAt >= 0 ? { projectId: values[projectAt] ?? '' } : {}),
        name: values[values.length - 1] ?? '',
        count: 0,
        ...(series || usageGroups ? { tokens: 0 } : {}),
        trend: [],
      };
      rows.set(key, row);
    }
    return row;
  };

  for (const aggregate of aggregateRows) {
    const row = rowFor(groupBy.map(d => dimension(aggregate, d)));
    row.count = measure(aggregate, 'count') ?? 0;
    row.errorRate = measure(aggregate, 'errorRate');
    row.p95 = measure(aggregate, 'duration.p95');
    row.resources = measure(aggregate, 'countDistinct.resourceId');
    row.threads = measure(aggregate, 'countDistinct.threadId');
  }

  const indexOf = gridIndex(grid.buckets, grid.stepHours);
  for (const s of series ?? []) {
    const row = rowFor(s.name.split('|'));
    const trend = grid.buckets.map(() => 0);
    let cost: number | undefined;
    for (const point of s.points) {
      const i = indexOf(point);
      if (i === undefined) continue;
      trend[i] = (trend[i] ?? 0) + point.value;
      if (point.estimatedCost != null) cost = (cost ?? 0) + point.estimatedCost;
    }
    row.trend = trend;
    row.tokens = trend.reduce((sum, v) => sum + v, 0);
    row.cost = cost;
    row.costUnit = cost === undefined ? undefined : (s.costUnit ?? undefined);
  }

  for (const group of usageGroups ?? []) {
    const row = rowFor(groupBy.map(d => (group.dimensions[d] == null ? '' : String(group.dimensions[d]))));
    row.tokens = group.value;
    row.cost = group.estimatedCost ?? undefined;
    row.costUnit = row.cost === undefined ? undefined : (group.costUnit ?? undefined);
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

/** The previous window's figures per row key, from its aggregate and its metrics breakdown. */
export function previousFigures(
  aggregateRows: AggregateRow[],
  groupBy: readonly string[],
  usageGroups: UsageGroup[],
): Map<string, PreviousFigures> {
  const figures = new Map<string, PreviousFigures>();
  const at = (key: string) => {
    let f = figures.get(key);
    if (!f) figures.set(key, (f = {}));
    return f;
  };
  for (const row of aggregateRows) {
    const f = at(groupBy.map(d => dimension(row, d)).join('|'));
    f.count = measure(row, 'count') ?? 0;
    f.errorRate = measure(row, 'errorRate');
    f.p95 = measure(row, 'duration.p95');
  }
  for (const group of usageGroups) {
    const f = at(groupBy.map(d => (group.dimensions[d] == null ? '' : String(group.dimensions[d]))).join('|'));
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
  const dropped: BreakdownRow[] = [];
  for (const [key, before] of previous) {
    if (listed.has(key) || !((before.count ?? 0) > 0 || (before.tokens ?? 0) > 0)) continue;
    const values = key.split('|');
    dropped.push({
      key,
      ...(projectAt >= 0 ? { projectId: values[projectAt] ?? '' } : {}),
      name: values[values.length - 1] ?? '',
      count: 0,
      ...(usage ? { tokens: 0 } : {}),
      ...(usage && before.cost !== undefined ? { cost: 0 } : {}),
      trend: [],
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

/** Whether a change is good news: more runs is; a higher error rate, P95, tokens or cost isn't. */
export function changeTrend(change: Change, metric: ChangeMetric): 'good' | 'bad' | undefined {
  if (change.delta === undefined || change.delta === 0) return undefined;
  return change.delta > 0 === (metric === 'count') ? 'good' : 'bad';
}
