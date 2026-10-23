import type { AggregateTracesResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { DrilldownScope } from '../drilldown';
import { useMetricsCostBreakdown } from '../hooks/use-metrics-cost-breakdown';
import { useMetricsScope } from '../hooks/use-metrics-scope';
import type { SpanAggregateScope } from '../hooks/use-metrics-span-aggregate';
import { useMetricsSpanAggregate, useSpanAggregateGate } from '../hooks/use-metrics-span-aggregate';
import { useMetricsTokenSeries } from '../hooks/use-metrics-token-series';
import type { TokenSeriesOptions } from '../hooks/use-metrics-token-series';
import type { TraceAggregateScope } from '../hooks/use-metrics-trace-aggregate';
import { useMetricsTraceAggregate, useTraceAggregateGate } from '../hooks/use-metrics-trace-aggregate';
import { projectsAggregateRequest } from '../lib/breakdown';
import { formatCount, formatDuration, formatPercent, formatUsd } from '../lib/chart-format';
import {
  MOVER_ENTITY_GROUP_BY,
  buildMovers,
  costFromGroups,
  costFromSeries,
  figuresFromAggregate,
  moverEntitiesRequest,
  moverTrend,
  previousWindow,
  windowLength,
  withCost,
} from '../lib/movers';
import type { Mover, MoverMetric } from '../lib/movers';
import { AGGREGATE_PRIORITY } from '../lib/request-limiter';
import { toTraceAggregateTimeRange } from '../lib/trace-aggregate';
import { ChartCard } from './chart-card';
import { ChartCardError } from './chart-card-error';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { Table } from '@/ds/components/Table';
import { Txt } from '@/ds/components/Txt';

const TITLE = 'Biggest movers';
const DASH = '—';

const FORMAT: Record<MoverMetric, (value: number) => string> = {
  count: formatCount,
  errorRate: formatPercent,
  p95: formatDuration,
  cost: formatUsd,
};

const TREND_CLASS = { good: 'text-badge-green-foreground', bad: 'text-badge-red-foreground' } as const;

const ENTITY_TYPE_LABEL: Record<string, string> = { agent_run: 'Agent', workflow_run: 'Workflow' };

/** Model usage is attributed to the agent whose context made the call; the Breakdown card's Agents tab asks the same. */
const AGENT_USAGE: TokenSeriesOptions = { groupBy: ['entityName'], filters: { entityType: 'agent' } };

export type MoversCardProps = {
  /** Called with the clicked row as a drilldown scope: `span` for an agent or workflow, `projectId` for a project. */
  onRowClick?: (scope: DrilldownScope) => void;
};

/**
 * What changed most against the previous window of the same length: agents and workflows on a
 * project page, projects on an organization page. Ranked by the absolute change.
 */
export function MoversCard({ onRowClick }: MoversCardProps) {
  const byProject = useMetricsScope().projectLabel !== undefined;
  const traceGate = useTraceAggregateGate();
  const spanGate = useSpanAggregateGate();
  const [metric, setMetric] = useState<MoverMetric>('count');
  const gate = byProject ? traceGate : spanGate;

  if (traceGate.status === 'unavailable' || spanGate.status === 'unavailable') return null;
  const frame = { metric, onMetricChange: setMetric, byProject };
  if (gate.status === 'loading') {
    return (
      <ChartCard title={TITLE}>
        <MetricsCard.Loading />
      </ChartCard>
    );
  }
  if (gate.status === 'unsupported-filter') {
    return (
      <MoversFrame {...frame}>
        <MetricsCard.NoData message="Not available with the current filters." />
      </MoversFrame>
    );
  }
  if (byProject && traceGate.status === 'ready') {
    return <ProjectMovers {...frame} scope={traceGate.scope} onRowClick={onRowClick} />;
  }
  if (spanGate.status === 'ready') {
    return <EntityMovers {...frame} scope={spanGate.scope} onRowClick={onRowClick} />;
  }
  return null;
}

type FrameProps = { metric: MoverMetric; onMetricChange: (metric: MoverMetric) => void; byProject: boolean };
type RowClick = { onRowClick?: (scope: DrilldownScope) => void };

function ProjectMovers({ scope, onRowClick, ...frame }: FrameProps & RowClick & { scope: TraceAggregateScope }) {
  const projectLabel = useMetricsScope().projectLabel;
  const before = previousWindow(scope.window);
  // The current window's requests are the Breakdown card's Projects tab's: React Query sends them once.
  const current = useMetricsTraceAggregate(projectsAggregateRequest(scope));
  const tokens = useMetricsTokenSeries({ groupBy: ['projectId'] });
  const previous = useMetricsTraceAggregate(
    projectsAggregateRequest({ timeRange: toTraceAggregateTimeRange(before), where: scope.where }),
    { priority: AGGREGATE_PRIORITY.last },
  );
  const previousCost = useMetricsCostBreakdown({ groupBy: ['projectId'], window: before });
  const same = (key: string) => key;

  return (
    <LoadedMovers
      {...frame}
      window={scope.window}
      current={current}
      previous={previous}
      groupBy={['projectId']}
      currentCost={costSource(tokens, costFromSeries(tokens.data?.series ?? [], same))}
      previousCost={costSource(previousCost, costFromGroups(previousCost.data?.groups ?? [], 'projectId', same))}
      label={key => projectLabel?.(key) ?? key}
      onRowClick={onRowClick && (key => onRowClick({ projectId: key }))}
    />
  );
}

function EntityMovers({ scope, onRowClick, ...frame }: FrameProps & RowClick & { scope: SpanAggregateScope }) {
  const before = previousWindow(scope.window);
  const current = useMetricsSpanAggregate(moverEntitiesRequest(scope));
  const previous = useMetricsSpanAggregate(
    moverEntitiesRequest({ timeRange: toTraceAggregateTimeRange(before), where: scope.where }),
    { priority: AGGREGATE_PRIORITY.last },
  );
  const tokens = useMetricsTokenSeries(AGENT_USAGE);
  const previousCost = useMetricsCostBreakdown({ ...AGENT_USAGE, window: before });
  const agent = (name: string) => `agent_run|${name}`;

  return (
    <LoadedMovers
      {...frame}
      window={scope.window}
      current={current}
      previous={previous}
      groupBy={MOVER_ENTITY_GROUP_BY}
      currentCost={costSource(tokens, costFromSeries(tokens.data?.series ?? [], agent))}
      previousCost={costSource(previousCost, costFromGroups(previousCost.data?.groups ?? [], 'entityName', agent))}
      label={key => <EntityLabel entityKey={key} />}
      onRowClick={
        onRowClick &&
        (key => {
          const [spanType = '', ...name] = key.split('|');
          onRowClick({ span: { spanTypes: [spanType], entityName: name.join('|') } });
        })
      }
    />
  );
}

type Source = { isLoading: boolean; isError: boolean; refetch: () => unknown };
type CostSource = Source & { costs: [string, number | null][] };

const costSource = ({ isLoading, isError, refetch }: Source, costs: CostSource['costs']): CostSource => ({
  isLoading,
  isError,
  refetch,
  costs,
});

function LoadedMovers({
  window,
  current,
  previous,
  groupBy,
  currentCost,
  previousCost,
  label,
  onRowClick,
  ...frame
}: FrameProps & {
  window: { start: Date; end: Date };
  current: UseQueryResult<AggregateTracesResponse>;
  previous: UseQueryResult<AggregateTracesResponse>;
  groupBy: string[];
  currentCost: CostSource;
  previousCost: CostSource;
  label: (key: string) => ReactNode;
  onRowClick?: (key: string) => void;
}) {
  const { metric } = frame;
  const length = windowLength(window);
  // Cost compares the two token queries; the rest compare the two aggregates.
  const sources: Source[] = metric === 'cost' ? [currentCost, previousCost] : [current, previous];
  const failed = sources.filter(s => s.isError);

  if (failed.length > 0) {
    return (
      <MoversFrame {...frame} length={length}>
        <ChartCardError onRetry={() => failed.forEach(s => void s.refetch())} />
      </MoversFrame>
    );
  }
  if (sources.some(s => s.isLoading)) {
    return (
      <MoversFrame {...frame} length={length}>
        <MetricsCard.Loading />
      </MoversFrame>
    );
  }

  const movers =
    metric === 'cost'
      ? buildMovers(withCost(new Map(), currentCost.costs), withCost(new Map(), previousCost.costs), metric)
      : buildMovers(
          figuresFromAggregate(current.data?.rows ?? [], groupBy),
          figuresFromAggregate(previous.data?.rows ?? [], groupBy),
          metric,
        );

  if (movers.length === 0) {
    return (
      <MoversFrame {...frame} length={length}>
        <MetricsCard.NoData message={`Nothing changed compared with the previous ${length}.`} />
      </MoversFrame>
    );
  }

  const format = FORMAT[metric];
  return (
    <MoversFrame {...frame} length={length} isUpdating={current.isPlaceholderData}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Table variant="inset" aria-label={TITLE}>
          <Table.Header>
            <Table.Row>
              <Table.Head className="w-full">{frame.byProject ? 'Project' : 'Entity'}</Table.Head>
              <Table.Head align="end">Now</Table.Head>
              <Table.Head align="end">Before</Table.Head>
              <Table.Head align="end">Change</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {movers.map(mover => {
              const trend = moverTrend(mover, metric);
              return (
                <Table.Row key={mover.key}>
                  <Table.Cell>
                    {onRowClick ? (
                      <Table.RowButton onClick={() => onRowClick(mover.key)}>{label(mover.key)}</Table.RowButton>
                    ) : (
                      label(mover.key)
                    )}
                  </Table.Cell>
                  <Table.Cell align="end">{format(mover.current)}</Table.Cell>
                  <Table.Cell align="end" tone="muted">
                    {mover.previous === null ? DASH : format(mover.previous)}
                  </Table.Cell>
                  <Table.Cell align="end">
                    <span className={trend ? TREND_CLASS[trend] : undefined}>{formatChange(mover, metric)}</span>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      </div>
    </MoversFrame>
  );
}

function formatChange(mover: Mover, metric: MoverMetric) {
  if (mover.change === null) return mover.previous === null ? 'New' : DASH;
  const sign = mover.change > 0 ? '+' : '−';
  const size = Math.abs(mover.change);
  if (metric !== 'errorRate') return `${sign}${formatPercent(size)}`;
  // Under 0.05 points rounds to "+0.0 pt", which reads as no change.
  return size < 0.0005 ? `${sign}<0.1 pt` : `${sign}${(size * 100).toFixed(1)} pt`;
}

function EntityLabel({ entityKey }: { entityKey: string }) {
  const [spanType = '', ...rest] = entityKey.split('|');
  const name = rest.join('|') || 'Unnamed';
  return (
    <span className="flex min-w-0 items-baseline gap-2" title={name}>
      <span className="truncate">{name}</span>
      <Txt as="span" variant="caption" tone="muted">
        {ENTITY_TYPE_LABEL[spanType] ?? spanType}
      </Txt>
    </span>
  );
}

function MoversFrame({
  metric,
  onMetricChange,
  byProject,
  length,
  isUpdating,
  children,
}: FrameProps & { length?: string; isUpdating?: boolean; children: ReactNode }) {
  const what = byProject ? 'Projects' : 'Agents and workflows';
  return (
    <ChartCard
      title={TITLE}
      description={`${what} that changed most compared with the previous ${length ?? 'period'}.`}
      isUpdating={isUpdating}
      toolbar={
        <MetricsCard.Toolbar>
          <MetricsCard.Tabs<MoverMetric> value={metric} onValueChange={onMetricChange}>
            <MetricsCard.Tab value="count">{byProject ? 'Traces' : 'Runs'}</MetricsCard.Tab>
            <MetricsCard.Tab value="errorRate">Errors</MetricsCard.Tab>
            <MetricsCard.Tab value="p95">P95</MetricsCard.Tab>
            <MetricsCard.Tab value="cost">Cost</MetricsCard.Tab>
          </MetricsCard.Tabs>
        </MetricsCard.Toolbar>
      }
    >
      {children}
    </ChartCard>
  );
}
