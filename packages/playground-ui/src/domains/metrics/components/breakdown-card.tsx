import type { AggregateTracesResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { DrilldownScope } from '../drilldown';
import { useMetricsScope } from '../hooks/use-metrics-scope';
import type { SpanAggregateScope } from '../hooks/use-metrics-span-aggregate';
import { useMetricsSpanAggregate, useSpanAggregateGate } from '../hooks/use-metrics-span-aggregate';
import { useMetricsTokenSeries } from '../hooks/use-metrics-token-series';
import type { TraceAggregateScope } from '../hooks/use-metrics-trace-aggregate';
import { useMetricsTraceAggregate, useTraceAggregateGate } from '../hooks/use-metrics-trace-aggregate';
import {
  BREAKDOWN_GROUP_LIMIT,
  BREAKDOWN_SPAN_TYPES,
  buildBreakdownRows,
  entitiesAggregateRequest,
  environmentsAggregateRequest,
  hasUsage,
  isEntityTab,
  projectsAggregateRequest,
} from '../lib/breakdown';
import type { BreakdownEntityTab, BreakdownRow, BreakdownTab } from '../lib/breakdown';
import { formatCount, formatDuration, formatPercent, formatUsd } from '../lib/chart-format';
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
  environments: 'Environments',
};

const DESCRIPTION: Record<BreakdownTab, string> = {
  projects: 'Traces, errors, latency and spend per project.',
  agents: 'Every agent run, nested ones included, with errors, latency and spend.',
  workflows: 'Every workflow run, nested ones included, with errors and latency.',
  tools: 'Every tool call, MCP tools included, with errors and latency.',
  environments: 'Traces, errors, latency and spend per environment.',
};

const EMPTY: Record<BreakdownTab, string> = {
  projects: 'No traces in this range.',
  agents: 'No agent runs in this range.',
  workflows: 'No workflow runs in this range.',
  tools: 'No tool calls in this range.',
  environments: 'No traces in this range.',
};

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
      <ChartCard title={TITLE}>
        <MetricsCard.Loading />
      </ChartCard>
    );
  }

  const tabs: BreakdownTab[] = [
    ...(byProject ? (['projects'] as const) : []),
    'agents',
    'workflows',
    'tools',
    'environments',
  ];
  const frame = { tabs, onTabChange: setChosen, onRowClick, byProject };

  if (byProject && traceGate.status === 'ready') {
    // An organization page always asks for projects (Biggest movers shares the request), and opens
    // on them only when there are at least two to compare.
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
  if (traceGate.status === 'ready' && (tab === 'projects' || tab === 'environments')) {
    return <TraceTab key={tab} {...frame} tab={tab} scope={traceGate.scope} />;
  }
  return null;
}

function EntityTab({ tab, scope, ...frame }: FrameProps & { tab: BreakdownEntityTab; scope: SpanAggregateScope }) {
  const groupBy = frame.byProject ? ['projectId', 'entityName'] : ['entityName'];
  const aggregate = useMetricsSpanAggregate(entitiesAggregateRequest(tab, scope, frame.byProject));
  // Model usage is attributed to the agent whose context made the call: workflows and tools have none.
  const tokens = useMetricsTokenSeries({ groupBy, filters: { entityType: 'agent' }, enabled: hasUsage(tab) });
  return (
    <LoadedTab
      {...frame}
      tab={tab}
      groupBy={groupBy}
      aggregate={aggregate}
      tokens={hasUsage(tab) ? tokens : undefined}
      limit={BREAKDOWN_GROUP_LIMIT.span}
    />
  );
}

function TraceTab({
  tab,
  scope,
  ...frame
}: FrameProps & { tab: 'projects' | 'environments'; scope: TraceAggregateScope }) {
  const projects = tab === 'projects';
  const groupBy = projects ? ['projectId'] : ['environment'];
  const aggregate = useMetricsTraceAggregate(
    projects ? projectsAggregateRequest(scope) : environmentsAggregateRequest(scope),
  );
  const tokens = useMetricsTokenSeries({ groupBy });
  return (
    <LoadedTab
      {...frame}
      tab={tab}
      groupBy={groupBy}
      aggregate={aggregate}
      tokens={tokens}
      limit={BREAKDOWN_GROUP_LIMIT.trace}
    />
  );
}

function LoadedTab({
  tab,
  groupBy,
  aggregate,
  tokens,
  limit,
  ...frame
}: FrameProps & {
  tab: BreakdownTab;
  groupBy: string[];
  aggregate: UseQueryResult<AggregateTracesResponse>;
  tokens?: ReturnType<typeof useMetricsTokenSeries>;
  limit: number;
}) {
  const scope = useMetricsScope();
  const [sort, setSort] = useState<MetricsShareListSort>({ key: 'count', direction: 'descending' });

  if (aggregate.isError || tokens?.isError) {
    return (
      <BreakdownFrame {...frame} tab={tab}>
        <ChartCardError />
      </BreakdownFrame>
    );
  }

  const isLoading = aggregate.isLoading || (tokens?.isLoading ?? false);
  const grid = tokens?.grid ?? { buckets: [], stepHours: 1 };
  const rows = isLoading ? [] : buildBreakdownRows(aggregate.data?.rows ?? [], groupBy, tokens?.data?.series, grid);
  const usage = tokens !== undefined;
  const volume = isEntityTab(tab) ? (tab === 'tools' ? 'Calls' : 'Runs') : 'Traces';
  const columns: MetricsShareListColumn[] = [
    { label: 'Errors', sortKey: 'errorRate' },
    { label: 'P95', sortKey: 'p95' },
    ...(usage
      ? [
          { label: 'Tokens', sortKey: 'tokens' },
          { label: 'Cost', sortKey: 'cost' },
          { label: 'Trend', width: 'w-16' },
        ]
      : []),
  ];

  const label = (row: BreakdownRow) => {
    if (tab === 'projects') return scope.projectLabel?.(row.key) ?? row.key;
    if (row.name) return row.name;
    return tab === 'environments' ? 'No environment' : 'Unnamed';
  };
  const projectOf = (row: BreakdownRow) => (tab === 'projects' ? row.key : row.projectId);

  const shareRows: MetricsShareListRow[] = rows.map(row => {
    const projectId = projectOf(row);
    const name = label(row);
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
      share: row.count,
      value: formatCount(row.count),
      sortValues: {
        count: row.count,
        errorRate: row.errorRate,
        p95: row.p95,
        tokens: row.tokens,
        cost: row.cost,
      },
      color: tab === 'projects' && projectId ? scope.projectColor?.(projectId) : undefined,
      cells: [
        row.errorRate === null ? DASH : formatPercent(row.errorRate),
        row.p95 === null ? DASH : formatDuration(row.p95),
        ...(usage
          ? [
              row.tokens === null ? DASH : formatCount(row.tokens),
              <CostCell key="cost" row={row} />,
              <Sparkline key="trend" values={row.trend} label={`${name} tokens over time`} />,
            ]
          : []),
      ],
      onClick: frame.onRowClick && (() => frame.onRowClick?.(drilldownFor(tab, row, projectId))),
    };
  });

  const truncated = aggregate.data?.truncated === true;

  return (
    <BreakdownFrame {...frame} tab={tab} isUpdating={aggregate.isPlaceholderData}>
      <ChartArea>
        <MetricsShareList
          rows={shareRows}
          columns={columns}
          valueLabel={volume}
          valueSortKey="count"
          sort={sort}
          onSortChange={setSort}
          palette="hues"
          limit={LIMIT}
          overflow="more"
          pageSize={PAGE_SIZE}
          emptyState={EMPTY[tab]}
          isLoading={isLoading}
        />
        {truncated && (
          <Txt variant="caption" tone="muted" className="pt-2">
            Showing the {formatCount(limit)} busiest; sorting covers only these.
          </Txt>
        )}
      </ChartArea>
    </BreakdownFrame>
  );
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
