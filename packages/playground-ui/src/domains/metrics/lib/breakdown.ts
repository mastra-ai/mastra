/**
 * Rows of the Metrics Breakdown card: one per project, agent, workflow, tool or environment,
 * merged from an aggregate (runs or traces, errors, P95) and a token series (tokens, cost, trend).
 */
import type { AggregateSpansArgs, AggregateTracesArgs, AggregateTracesResponse, MastraClient } from '@mastra/client-js';
import type { BucketLabels } from './metrics-buckets';
import { gridIndex } from './metrics-buckets';

export type BreakdownTab = 'projects' | 'agents' | 'workflows' | 'tools' | 'environments';

type AggregateRow = AggregateTracesResponse['rows'][number];
type TimeSeries = Awaited<ReturnType<MastraClient['getMetricTimeSeries']>>['series'][number];
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
export const hasUsage = (tab: BreakdownTab) => tab === 'projects' || tab === 'agents' || tab === 'environments';

type Scope = Pick<AggregateTracesArgs, 'timeRange' | 'where'>;

/** Rows the server returns per tab at most. Entity groups are capped lower: there can be thousands of tools. */
export const BREAKDOWN_GROUP_LIMIT = { trace: 1000, span: 500 } as const;

/**
 * Traces, errors, P95, resources and threads per project. The Biggest movers card at org scope
 * sends the same request, so React Query sends it once.
 */
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
  errorRate: number | null;
  p95: number | null;
  resources: number | null;
  threads: number | null;
  tokens: number | null;
  cost: number | null;
  costUnit: string | null;
  /** Tokens per bucket, oldest first. */
  trend: number[];
};

const measure = (row: AggregateRow, name: keyof AggregateRow['measures']) => {
  const value = row.measures[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
        errorRate: null,
        p95: null,
        resources: null,
        threads: null,
        tokens: series ? 0 : null,
        cost: null,
        costUnit: null,
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
    let cost: number | null = null;
    for (const point of s.points) {
      const i = indexOf(point);
      if (i === undefined) continue;
      trend[i] = (trend[i] ?? 0) + point.value;
      if (point.estimatedCost != null) cost = (cost ?? 0) + point.estimatedCost;
    }
    row.trend = trend;
    row.tokens = trend.reduce((sum, v) => sum + v, 0);
    row.cost = cost;
    row.costUnit = cost == null ? null : (s.costUnit ?? null);
  }

  return [...rows.values()];
}
