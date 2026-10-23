import type { AggregateTracesResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { DrilldownScope } from '../drilldown';
import { useMetricsFilters } from '../hooks/use-metrics-filters';
import { useMetricsScope } from '../hooks/use-metrics-scope';
import type { SpanAggregateScope } from '../hooks/use-metrics-span-aggregate';
import { useMetricsSpanAggregate, useSpanAggregateGate } from '../hooks/use-metrics-span-aggregate';
import { useMetricsTokenSeries } from '../hooks/use-metrics-token-series';
import type { TokenSeriesOptions } from '../hooks/use-metrics-token-series';
import type { TraceAggregateScope } from '../hooks/use-metrics-trace-aggregate';
import { useMetricsTraceAggregate, useTraceAggregateGate } from '../hooks/use-metrics-trace-aggregate';
import { useMetricsUsageTotals } from '../hooks/use-metrics-usage-totals';
import {
  BREAKDOWN_GROUP_LIMIT,
  BREAKDOWN_SPAN_TYPES,
  breakdownGroupBy,
  buildBreakdownRows,
  changeTrend,
  entitiesAggregateRequest,
  environmentsAggregateRequest,
  hasRuns,
  hasTrend,
  hasUsage,
  isEntityTab,
  previousFigures,
  projectsAggregateRequest,
  rowChange,
  threadsAggregateRequest,
  withDropped,
} from '../lib/breakdown';
import type { BreakdownEntityTab, BreakdownRow, BreakdownTab, Change, ChangeMetric } from '../lib/breakdown';
import { formatCount, formatDuration, formatPercent, formatUsd } from '../lib/chart-format';
import { AGGREGATE_PRIORITY } from '../lib/request-limiter';
import { previousWindow, windowLength } from '../lib/time-window';
import { toTraceAggregateTimeRange } from '../lib/trace-aggregate';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { ChartCardError } from './chart-card-error';
import { Sparkline } from './sparkline';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type {
  MetricsShareListColumn,
  MetricsShareListRow,
  MetricsShareListSort,
} from '@/ds/components/MetricsShareList';
import { MetricsShareList } from '@/ds/components/MetricsShareList';
import { Txt } from '@/ds/components/Txt';

const TITLE = 'Breakdown';
const DASH = '—';

const TAB_LABEL: Record<BreakdownTab, string> = {
  projects: 'Projects',
  agents: 'Agents',
  workflows: 'Workflows',
  tools: 'Tools',
  models: 'Models',
  threads: 'Threads',
  environments: 'Environments',
};

const DESCRIPTION: Record<BreakdownTab, string> = {
  projects: 'Traces, errors, latency and spend per project.',
  agents: 'Every agent run, nested ones included, with errors, latency and spend.',
  workflows: 'Every workflow run, nested ones included, with errors and latency.',
  tools: 'Every tool call, MCP tools included, with errors and latency.',
  models: 'Tokens and spend per model.',
  threads: 'Traces, errors, latency and spend per thread.',
  environments: 'Traces, errors, latency and spend per environment.',
};

const EMPTY: Record<BreakdownTab, string> = {
  projects: 'No traces in this range.',
  agents: 'No agent runs in this range.',
  workflows: 'No workflow runs in this range.',
  tools: 'No tool calls in this range.',
  models: 'No model usage in this range.',
  threads: 'No traces with a thread in this range.',
  environments: 'No traces in this range.',
};

const AGENT_FILTER: TokenSeriesOptions['filters'] = { entityType: 'agent' };

const FILTER_NAMES: Record<string, string> = {
  serviceName: 'service',
  requestId: 'request ID',
  experimentId: 'experiment',
  tags: 'tags',
  provider: 'provider',
  model: 'model',
};

/** Rows shown before "Show more", then per page. */
const LIMIT = 10;
const PAGE_SIZE = 20;

export type BreakdownCardProps = {
  /**
   * Called with the clicked row as a drilldown scope: `span` for an agent, workflow or tool (its
   * runs, nested ones included), `projectId` for a project, `environment` for an environment.
   * Rows of an organization-wide page also carry their `projectId`.
   */
  onRowClick?: (scope: DrilldownScope) => void;
};

/**
 * One table for "where is the volume, the failures, the latency and the spend": per project
 * (organization pages only), agent, workflow, tool or environment. Columns sort; the strip and
 * the Share column always show the share of runs or traces, whatever the sort.
 */
export function BreakdownCard({ onRowClick }: BreakdownCardProps) {
  const byProject = useMetricsScope().projectLabel !== undefined;
  const traceGate = useTraceAggregateGate();
  const spanGate = useSpanAggregateGate();
  const [chosen, setChosen] = useState<BreakdownTab>();

  if (traceGate.status === 'unavailable' || spanGate.status === 'unavailable') return null;
  if (traceGate.status === 'loading' || spanGate.status === 'loading') {
    return (
      <ChartCard title={TITLE} bodyHeight="fit">
        <MetricsCard.Loading />
      </ChartCard>
    );
  }

  const tabs: BreakdownTab[] = [
    ...(byProject ? (['projects'] as const) : []),
    'agents',
    'workflows',
    'tools',
    'models',
    'threads',
    'environments',
  ];
  const frame = { tabs, onTabChange: setChosen, onRowClick, byProject };

  if (byProject && traceGate.status === 'ready') {
    // An organization page asks for projects first, and opens on them only when there are at least
    // two to compare.
    return <ProjectsFirst {...frame} chosen={chosen} traceScope={traceGate.scope} spanGate={spanGate} />;
  }
  const tab = chosen ?? 'agents';
  return <TabBody {...frame} tab={tab} traceGate={traceGate} spanGate={spanGate} />;
}

type Gate<Scope> = { status: 'ready'; scope: Scope } | { status: 'unsupported-filter'; unsupportedFields: string[] };

type FrameProps = {
  tabs: BreakdownTab[];
  onTabChange: (tab: BreakdownTab) => void;
  onRowClick?: (scope: DrilldownScope) => void;
  byProject: boolean;
};

function ProjectsFirst({
  chosen,
  traceScope,
  spanGate,
  ...frame
}: FrameProps & { chosen?: BreakdownTab; traceScope: TraceAggregateScope; spanGate: Gate<SpanAggregateScope> }) {
  const projects = useMetricsTraceAggregate(projectsAggregateRequest(traceScope));
  const withData = projects.data?.rows.filter(r => (r.measures.count ?? 0) > 0).length;
  const tab = chosen ?? (withData === undefined || withData >= 2 ? 'projects' : 'agents');
  return <TabBody {...frame} tab={tab} traceGate={{ status: 'ready', scope: traceScope }} spanGate={spanGate} />;
}

function TabBody({
  tab,
  traceGate,
  spanGate,
  ...frame
}: FrameProps & { tab: BreakdownTab; traceGate: Gate<TraceAggregateScope>; spanGate: Gate<SpanAggregateScope> }) {
  // Metrics answer every page filter.
  if (tab === 'models') return <ModelsTab key={tab} {...frame} />;
  const gate = isEntityTab(tab) ? spanGate : traceGate;
  if (gate.status === 'unsupported-filter') {
    return (
      <BreakdownFrame {...frame} tab={tab}>
        <MetricsCard.NoData
          message={`Not available with a ${gate.unsupportedFields.map(f => FILTER_NAMES[f] ?? f).join(' or ')} filter.`}
        />
      </BreakdownFrame>
    );
  }
  if (isEntityTab(tab) && spanGate.status === 'ready') {
    return <EntityTab key={tab} {...frame} tab={tab} scope={spanGate.scope} />;
  }
  if (traceGate.status === 'ready' && !isEntityTab(tab)) {
    return <TraceTab key={tab} {...frame} tab={tab} scope={traceGate.scope} />;
  }
  return null;
}

type UsageTotals = ReturnType<typeof useMetricsUsageTotals>;

/** The previous window's requests for a tab; sent last, so the table never waits on them. */
function usePrevious<Scope extends TraceAggregateScope | SpanAggregateScope>(scope: Scope) {
  const before = previousWindow(scope.window);
  return { before, scope: { ...scope, timeRange: toTraceAggregateTimeRange(before) } };
}

function EntityTab({ tab, scope, ...frame }: FrameProps & { tab: BreakdownEntityTab; scope: SpanAggregateScope }) {
  const groupBy = breakdownGroupBy(tab, frame.byProject);
  const usage = hasUsage(tab);
  const previous = usePrevious(scope);
  const aggregate = useMetricsSpanAggregate(entitiesAggregateRequest(tab, scope, frame.byProject));
  const previousAggregate = useMetricsSpanAggregate(entitiesAggregateRequest(tab, previous.scope, frame.byProject), {
    priority: AGGREGATE_PRIORITY.last,
  });
  // Model usage is attributed to the agent whose context made the call: workflows and tools have none.
  const tokens = useMetricsTokenSeries({ groupBy, filters: AGENT_FILTER, enabled: usage });
  const previousUsage = useMetricsUsageTotals({
    groupBy,
    filters: AGENT_FILTER,
    window: previous.before,
    enabled: usage,
  });
  return (
    <LoadedTab
      {...frame}
      tab={tab}
      groupBy={groupBy}
      window={scope.window}
      aggregate={aggregate}
      tokens={usage ? tokens : undefined}
      previousAggregate={previousAggregate}
      previousUsage={usage ? previousUsage : undefined}
      limit={BREAKDOWN_GROUP_LIMIT.span}
    />
  );
}

const TRACE_REQUEST = {
  projects: projectsAggregateRequest,
  environments: environmentsAggregateRequest,
  threads: threadsAggregateRequest,
};

function TraceTab({
  tab,
  scope,
  ...frame
}: FrameProps & { tab: keyof typeof TRACE_REQUEST; scope: TraceAggregateScope }) {
  const groupBy = breakdownGroupBy(tab, frame.byProject);
  const trend = hasTrend(tab);
  const previous = usePrevious(scope);
  const aggregate = useMetricsTraceAggregate(TRACE_REQUEST[tab](scope));
  const previousAggregate = useMetricsTraceAggregate(TRACE_REQUEST[tab](previous.scope), {
    priority: AGGREGATE_PRIORITY.last,
  });
  const tokens = useMetricsTokenSeries({ groupBy, enabled: trend });
  const totals = useMetricsUsageTotals({ groupBy, window: scope.window, enabled: !trend });
  const previousUsage = useMetricsUsageTotals({ groupBy, window: previous.before });
  return (
    <LoadedTab
      {...frame}
      tab={tab}
      groupBy={groupBy}
      window={scope.window}
      aggregate={aggregate}
      tokens={trend ? tokens : undefined}
      totals={trend ? undefined : totals}
      previousAggregate={previousAggregate}
      previousUsage={previousUsage}
      limit={BREAKDOWN_GROUP_LIMIT.trace}
    />
  );
}

/** Models have tokens and cost but no runs: a run isn't tied to one model. Metrics only. */
function ModelsTab(frame: FrameProps) {
  const groupBy = breakdownGroupBy('models', frame.byProject);
  const { timestamp } = useMetricsFilters();
  const totals = useMetricsUsageTotals({ groupBy, window: timestamp });
  const previousUsage = useMetricsUsageTotals({ groupBy, window: previousWindow(timestamp) });
  return (
    <LoadedTab
      {...frame}
      tab="models"
      groupBy={groupBy}
      window={timestamp}
      totals={totals}
      previousUsage={previousUsage}
      limit={BREAKDOWN_GROUP_LIMIT.trace}
    />
  );
}

/** What the Before and Change columns compare: the sorted column, or the last one sorted. */
const CHANGE_METRICS: readonly ChangeMetric[] = ['count', 'errorRate', 'p95', 'tokens', 'cost'];
const isChangeMetric = (key: string): key is ChangeMetric => (CHANGE_METRICS as readonly string[]).includes(key);

/** The compared column's header, so "Cost before" sits beside Cost. Volume is named per tab. */
const METRIC_LABEL: Record<Exclude<ChangeMetric, 'count'>, string> = {
  errorRate: 'Errors',
  p95: 'P95',
  tokens: 'Tokens',
  cost: 'Cost',
};

function LoadedTab({
  tab,
  groupBy,
  window,
  aggregate,
  tokens,
  totals,
  previousAggregate,
  previousUsage,
  limit,
  ...frame
}: FrameProps & {
  tab: BreakdownTab;
  groupBy: string[];
  window: { start: Date; end: Date };
  aggregate?: UseQueryResult<AggregateTracesResponse>;
  /** Tokens per bucket, for tabs with a Trend column. */
  tokens?: ReturnType<typeof useMetricsTokenSeries>;
  /** Tokens as totals, for tabs without one. */
  totals?: UsageTotals;
  previousAggregate?: UseQueryResult<AggregateTracesResponse>;
  previousUsage?: UsageTotals;
  limit: number;
}) {
  const scope = useMetricsScope();
  const runs = hasRuns(tab);
  const volumeKey: ChangeMetric = runs ? 'count' : 'tokens';
  const [sort, setSort] = useState<MetricsShareListSort>({ key: volumeKey, direction: 'descending' });
  const [metric, setMetric] = useState<ChangeMetric>(volumeKey);
  const onSortChange = (next: MetricsShareListSort) => {
    setSort(next);
    if (isChangeMetric(next.key)) setMetric(next.key);
  };

  const current = [aggregate, tokens, totals].filter(q => q !== undefined);
  if (current.some(q => q.isError)) {
    return (
      <BreakdownFrame {...frame} tab={tab}>
        <ChartCardError onRetry={() => current.forEach(q => q.isError && void q.refetch())} />
      </BreakdownFrame>
    );
  }

  const isLoading = current.some(q => q.isLoading);
  const grid = tokens?.grid ?? { buckets: [], stepHours: 1 };
  const built = isLoading
    ? []
    : buildBreakdownRows(aggregate?.data?.rows ?? [], groupBy, tokens?.data?.series, grid, totals?.data?.groups);
  // The previous window never holds the table up: until it answers, or if it fails, Before and Change show a dash.
  const previousReady =
    !(previousAggregate?.isLoading || previousUsage?.isLoading) &&
    !(previousAggregate?.isError || previousUsage?.isError);
  const previous = previousReady
    ? previousFigures(previousAggregate?.data?.rows ?? [], groupBy, previousUsage?.data?.groups ?? [])
    : undefined;
  const usage = tokens !== undefined || totals !== undefined;
  const truncated = aggregate?.data?.truncated === true;
  // Traces without a thread aren't a thread; threads that ended are the norm, so aren't listed as dropped.
  const rows =
    tab === 'threads'
      ? built.filter(r => r.name !== '')
      : previous && !truncated && !isLoading
        ? withDropped(built, previous, groupBy, usage)
        : built;
  const changes = new Map(
    rows.map(row => [row.key, previous ? rowChange(row, previous.get(row.key), metric) : undefined]),
  );

  const volume = isEntityTab(tab) ? (tab === 'tools' ? 'Calls' : 'Runs') : runs ? 'Traces' : 'Tokens';
  const compared = metric === 'count' ? volume : METRIC_LABEL[metric];
  const columns: MetricsShareListColumn[] = [
    ...(runs
      ? [
          { label: 'Errors', sortKey: 'errorRate' },
          { label: 'P95', sortKey: 'p95' },
        ]
      : []),
    ...(usage && runs ? [{ label: 'Tokens', sortKey: 'tokens' }] : []),
    ...(usage ? [{ label: 'Cost', sortKey: 'cost' }] : []),
    ...(tokens ? [{ label: 'Trend', width: 'w-16' }] : []),
    { label: `${compared} before`, sortKey: 'before', width: 'w-24' },
    { label: `${compared} change`, sortKey: 'change', width: 'w-24' },
  ];

  const label = (row: BreakdownRow) => {
    if (tab === 'projects') return scope.projectLabel?.(row.key) ?? row.key;
    if (row.name) return row.name;
    if (tab === 'environments') return 'No environment';
    if (tab === 'models') return 'Unknown model';
    return 'Unnamed';
  };
  const projectOf = (row: BreakdownRow) => (tab === 'projects' ? row.key : row.projectId);
  const format = (value: number) => FORMAT[metric](value, rows[0]?.costUnit ?? null);

  const shareRows: MetricsShareListRow[] = rows.map(row => {
    const projectId = projectOf(row);
    const name = label(row);
    const change = changes.get(row.key);
    const before = previous?.get(row.key)?.[metric];
    const trend = change ? changeTrend(change, metric) : null;
    const share = runs ? row.count : (row.tokens ?? 0);
    return {
      key: row.key,
      label:
        frame.byProject && isEntityTab(tab) && row.projectId ? (
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate">{name}</span>
            <Txt as="span" variant="caption" tone="muted" className="truncate">
              {scope.projectLabel?.(row.projectId) ?? row.projectId}
            </Txt>
          </span>
        ) : (
          name
        ),
      title: name,
      share,
      value: formatCount(share),
      sortValues: {
        count: row.count,
        errorRate: row.errorRate,
        p95: row.p95,
        tokens: row.tokens,
        cost: row.cost,
        before: before ?? null,
        // Sorted by the change shown: biggest rise first, biggest fall first the other way. New rows
        // have no change to rank, so they sort last.
        change: change?.change ?? null,
      },
      color: tab === 'projects' && projectId ? scope.projectColor?.(projectId) : undefined,
      cells: [
        ...(runs
          ? [
              row.errorRate === null ? DASH : formatPercent(row.errorRate),
              row.p95 === null ? DASH : formatDuration(row.p95),
            ]
          : []),
        ...(usage && runs ? [row.tokens === null ? DASH : formatCount(row.tokens)] : []),
        ...(usage ? [<CostCell key="cost" row={row} />] : []),
        ...(tokens ? [<Sparkline key="trend" values={row.trend} label={`${name} tokens over time`} />] : []),
        before == null ? DASH : format(before),
        <span key="change" className={trend ? TREND_CLASS[trend] : undefined}>
          {change ? formatChange(change, metric) : DASH}
        </span>,
      ],
      onClick: frame.onRowClick && (() => frame.onRowClick?.(drilldownFor(tab, row, projectId))),
    };
  });

  return (
    <BreakdownFrame {...frame} tab={tab} isUpdating={aggregate?.isPlaceholderData}>
      <ChartArea>
        <MetricsShareList
          rows={shareRows}
          columns={columns}
          valueLabel={volume}
          valueSortKey={volumeKey}
          sort={sort}
          onSortChange={onSortChange}
          palette="hues"
          limit={LIMIT}
          overflow="more"
          pageSize={PAGE_SIZE}
          emptyState={EMPTY[tab]}
          isLoading={isLoading}
        />
        {!isLoading && rows.length > 0 && (
          <Txt variant="caption" tone="muted" className="pt-2">
            Before and change: the previous {windowLength(window)}. Sort a column to compare it.
            {truncated && ` Showing the ${formatCount(limit)} busiest; sorting covers only these.`}
          </Txt>
        )}
      </ChartArea>
    </BreakdownFrame>
  );
}

const TREND_CLASS = { good: 'text-badge-green-foreground', bad: 'text-badge-red-foreground' } as const;

const FORMAT: Record<ChangeMetric, (value: number, costUnit: string | null) => string> = {
  count: formatCount,
  errorRate: formatPercent,
  p95: formatDuration,
  tokens: formatCount,
  cost: (value, unit) => (unit && unit !== 'USD' ? `${formatCount(value)} ${unit}` : formatUsd(value)),
};

function formatChange(change: Change, metric: ChangeMetric) {
  if (change.isNew) return 'New';
  if (change.change === null) return DASH;
  if (change.change === 0) return metric === 'errorRate' ? '0 pt' : '0%';
  const sign = change.change > 0 ? '+' : '−';
  const size = Math.abs(change.change);
  if (metric !== 'errorRate') return `${sign}${formatPercent(size)}`;
  // Under 0.05 points rounds to "+0.0 pt", which reads as no change.
  return size < 0.0005 ? `${sign}<0.1 pt` : `${sign}${(size * 100).toFixed(1)} pt`;
}

function CostCell({ row }: { row: BreakdownRow }) {
  if (row.cost === null) {
    // Tokens without a price: say so rather than show $0.
    return row.tokens ? <span title="No price for this model">Not priced</span> : DASH;
  }
  return row.costUnit && row.costUnit !== 'USD' ? `${formatCount(row.cost)} ${row.costUnit}` : formatUsd(row.cost);
}

function drilldownFor(tab: BreakdownTab, row: BreakdownRow, projectId: string | undefined): DrilldownScope {
  const project = projectId ? { projectId } : {};
  if (isEntityTab(tab)) return { ...project, span: { spanTypes: BREAKDOWN_SPAN_TYPES[tab], entityName: row.name } };
  if (tab === 'environments') return row.name ? { environment: row.name } : {};
  if (tab === 'threads') return { threadId: row.name };
  if (tab === 'models') return row.name ? { model: row.name } : {};
  return project;
}

function BreakdownFrame({
  tab,
  tabs,
  onTabChange,
  isUpdating,
  children,
}: FrameProps & { tab: BreakdownTab; isUpdating?: boolean; children: ReactNode }) {
  return (
    <ChartCard
      title={TITLE}
      description={DESCRIPTION[tab]}
      isUpdating={isUpdating}
      bodyHeight="fit"
      toolbar={
        <MetricsCard.Toolbar>
          <MetricsCard.Tabs<BreakdownTab> value={tab} onValueChange={onTabChange}>
            {tabs.map(t => (
              <MetricsCard.Tab key={t} value={t}>
                {TAB_LABEL[t]}
              </MetricsCard.Tab>
            ))}
          </MetricsCard.Tabs>
        </MetricsCard.Toolbar>
      }
    >
      {children}
    </ChartCard>
  );
}
