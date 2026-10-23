import type { AggregateTracesResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import { useMetricsScope } from '../../hooks/use-metrics-scope';
import type { useMetricsTokenSeries } from '../../hooks/use-metrics-token-series';
import type { useMetricsUsageTotals } from '../../hooks/use-metrics-usage-totals';
import { buildBreakdownRows, hasRuns, isEntityTab, previousFigures, rowChange } from '../../lib/breakdown';
import type { BreakdownRow, BreakdownTab, ChangeMetric } from '../../lib/breakdown';
import {
  DASH,
  comparedLabel,
  drilldownFor,
  formatMetric,
  isChangeMetric,
  rowLabel,
  rowProject,
  tableRows,
  volumeLabel,
  volumeMetric,
} from '../../lib/breakdown-table';
import { formatCount, formatDuration, formatPercent } from '../../lib/chart-format';
import { windowLength } from '../../lib/time-window';
import { ChartArea } from '../chart-area';
import { ChartCardError } from '../chart-card-error';
import { Sparkline } from '../sparkline';
import { BreakdownChangeCell } from './breakdown-change-cell';
import { BreakdownCostCell } from './breakdown-cost-cell';
import { BreakdownFrame } from './breakdown-frame';
import type { BreakdownFrameProps } from './breakdown-frame';
import { BreakdownRowLabel } from './breakdown-row-label';
import type {
  MetricsShareListColumn,
  MetricsShareListRow,
  MetricsShareListSort,
} from '@/ds/components/MetricsShareList';
import { MetricsShareList } from '@/ds/components/MetricsShareList';
import { Txt } from '@/ds/components/Txt';

type UsageTotals = ReturnType<typeof useMetricsUsageTotals>;

/** Rows shown before "Show more", then per page. */
const LIMIT = 10;
const PAGE_SIZE = 20;

const EMPTY: Record<BreakdownTab, string> = {
  projects: 'No traces in this range.',
  agents: 'No agent runs in this range.',
  workflows: 'No workflow runs in this range.',
  tools: 'No tool calls in this range.',
  models: 'No model usage in this range.',
  threads: 'No traces with a thread in this range.',
  environments: 'No traces in this range.',
};

export type BreakdownTableProps = BreakdownFrameProps & {
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
  /** The server's row cap, named when it truncates. */
  limit: number;
};

/** One tab's sortable table, with Before and Change against the previous window. */
export function BreakdownTable({
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
}: BreakdownTableProps) {
  const scope = useMetricsScope();
  const volumeKey = volumeMetric(tab);
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
  const runs = hasRuns(tab);
  const usage = tokens !== undefined || totals !== undefined;
  const truncated = aggregate?.data?.truncated === true;
  const built = isLoading
    ? []
    : buildBreakdownRows(
        aggregate?.data?.rows ?? [],
        groupBy,
        tokens?.data?.series,
        tokens?.grid ?? { buckets: [], stepHours: 1 },
        totals?.data?.groups,
      );
  // The previous window never holds the table up: until it answers, or if it fails, Before and Change show a dash.
  const previousSettled = [previousAggregate, previousUsage].every(q => !q || (!q.isLoading && !q.isError));
  const previous =
    previousSettled && !isLoading
      ? previousFigures(previousAggregate?.data?.rows ?? [], groupBy, previousUsage?.data?.groups ?? [])
      : undefined;
  const rows = tableRows({ tab, built, previous, truncated, groupBy, usage });
  const volume = volumeLabel(tab);
  const compared = comparedLabel(tab, metric);
  const costUnit = rows[0]?.costUnit;

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

  const toShareRow = (row: BreakdownRow): MetricsShareListRow => {
    const projectId = rowProject(tab, row);
    const name = rowLabel(tab, row, scope.projectLabel);
    const change = previous ? rowChange(row, previous.get(row.key), metric) : undefined;
    const before = previous?.get(row.key)?.[metric];
    const share = runs ? row.count : (row.tokens ?? 0);
    const entityProject = frame.byProject && isEntityTab(tab) ? row.projectId : undefined;
    return {
      key: row.key,
      label: entityProject ? (
        <BreakdownRowLabel name={name} project={scope.projectLabel?.(entityProject) ?? entityProject} />
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
        before,
        // Sorted by the change shown: biggest rise first, biggest fall first the other way. New rows
        // have no change to rank, so they sort last.
        change: change?.change,
      },
      color: tab === 'projects' && projectId ? scope.projectColor?.(projectId) : undefined,
      cells: [
        ...(runs
          ? [
              row.errorRate === undefined ? DASH : formatPercent(row.errorRate),
              row.p95 === undefined ? DASH : formatDuration(row.p95),
            ]
          : []),
        ...(usage && runs ? [row.tokens === undefined ? DASH : formatCount(row.tokens)] : []),
        ...(usage ? [<BreakdownCostCell key="cost" row={row} />] : []),
        ...(tokens ? [<Sparkline key="trend" values={row.trend} label={`${name} tokens over time`} />] : []),
        before === undefined ? DASH : formatMetric(metric, before, costUnit),
        <BreakdownChangeCell key="change" change={change} metric={metric} />,
      ],
      onClick: frame.onRowClick && (() => frame.onRowClick?.(drilldownFor(tab, row))),
    };
  };

  return (
    <BreakdownFrame {...frame} tab={tab} isUpdating={aggregate?.isPlaceholderData}>
      <ChartArea>
        {/* Nine columns don't fit a phone or tablet: the table scrolls sideways, names stay readable. */}
        <div className="min-w-0 overflow-x-auto">
          <MetricsShareList
            className="min-w-240"
            rows={rows.map(toShareRow)}
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
        </div>
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
