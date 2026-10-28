import type { AggregateTracesResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import { useMetricsScope } from '../../hooks/use-metrics-scope';
import type { useMetricsUsageTotals } from '../../hooks/use-metrics-usage-totals';
import { buildBreakdownRows, hasErrors, previousFigures, rowChange, threadResources } from '../../lib/breakdown';
import type { BreakdownRow, BreakdownTab, ChangeMetric } from '../../lib/breakdown';
import {
  DASH,
  comparedLabel,
  countDescription,
  drilldownFor,
  isChangeMetric,
  rowLabel,
  showsProject,
  tableMinWidth,
  tableRows,
  volumeLabel,
} from '../../lib/breakdown-table';
import { formatCount, formatDuration, formatPercent } from '../../lib/chart-format';
import { ChartArea } from '../chart-area';
import { ChartCardError } from '../chart-card-error';
import { BreakdownChangeCell } from './breakdown-change-cell';
import { BreakdownChangeDescription } from './breakdown-change-description';
import { BreakdownCostCell } from './breakdown-cost-cell';
import { BreakdownFrame } from './breakdown-frame';
import type { BreakdownFrameProps } from './breakdown-frame';
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
  /** Tokens and cost per row. */
  totals?: UsageTotals;
  /** Model spans per row (Models tab). */
  spans?: UsageTotals;
  /** Rows naming each thread's resource (Threads tab). */
  resources?: UseQueryResult<AggregateTracesResponse>;
  previousAggregate?: UseQueryResult<AggregateTracesResponse>;
  previousUsage?: UsageTotals;
  previousSpans?: UsageTotals;
  /** The server's row cap, named when it truncates. */
  limit: number;
};

/** One tab's sortable table, with % Change against the previous window. */
export function BreakdownTable({
  tab,
  groupBy,
  window,
  aggregate,
  totals,
  spans,
  resources,
  previousAggregate,
  previousUsage,
  previousSpans,
  limit,
  ...frame
}: BreakdownTableProps) {
  const scope = useMetricsScope();
  const [sort, setSort] = useState<MetricsShareListSort>({ key: 'count', direction: 'descending' });
  const [metric, setMetric] = useState<ChangeMetric>('count');
  const onSortChange = (next: MetricsShareListSort) => {
    setSort(next);
    if (isChangeMetric(next.key)) setMetric(next.key);
  };

  const current = [aggregate, totals, spans].filter(q => q !== undefined);
  if (current.some(q => q.isError)) {
    return (
      <BreakdownFrame {...frame} tab={tab}>
        <ChartCardError onRetry={() => current.forEach(q => q.isError && void q.refetch())} />
      </BreakdownFrame>
    );
  }

  const isLoading = current.some(q => q.isLoading);
  const errors = hasErrors(tab);
  const usage = totals !== undefined;
  const project = showsProject(tab, frame.byProject);
  const truncated = aggregate?.data?.truncated === true;
  const built = isLoading
    ? []
    : buildBreakdownRows({
        tab,
        groupBy,
        aggregateRows: aggregate?.data?.rows,
        usageGroups: totals?.data?.groups,
        spanGroups: spans?.data?.groups,
        // The resource is a nicety: the table doesn't wait for it, and shows a dash without it.
        resources: resources?.data ? threadResources(resources.data.rows) : undefined,
      });
  // The previous window never holds the table up: until it answers, or if it fails, Change shows a dash.
  const previousSettled = [previousAggregate, previousUsage, previousSpans].every(
    q => !q || (!q.isLoading && !q.isError),
  );
  const previous =
    previousSettled && !isLoading
      ? previousFigures({
          tab,
          groupBy,
          aggregateRows: previousAggregate?.data?.rows,
          usageGroups: previousUsage?.data?.groups,
          spanGroups: previousSpans?.data?.groups,
        })
      : undefined;
  const rows = tableRows({ tab, built, previous, truncated, groupBy, usage });
  const volume = volumeLabel(tab);

  const columns: MetricsShareListColumn[] = [
    ...(project ? [{ label: 'Project', width: 'w-52', align: 'left' as const }] : []),
    ...(tab === 'threads' ? [{ label: 'Resource', width: 'w-32', align: 'left' as const }] : []),
    ...(errors
      ? [
          { label: 'Errors', sortKey: 'errorRate' },
          { label: 'P95 latency', sortKey: 'p95', width: 'w-24' },
        ]
      : []),
    ...(usage ? [{ label: 'Tokens', sortKey: 'tokens' }] : []),
    ...(usage ? [{ label: 'Cost', sortKey: 'cost' }] : []),
    { label: volume, sortKey: 'count', width: 'w-24', emphasis: true, description: countDescription(tab) },
  ];

  const toShareRow = (row: BreakdownRow): MetricsShareListRow => {
    const name = rowLabel(tab, row, scope.projectLabel);
    const change = previous ? rowChange(row, previous.get(row.key), metric) : undefined;
    const projectName = row.projectId ? (scope.projectLabel?.(row.projectId) ?? row.projectId) : DASH;
    return {
      key: row.key,
      label: name,
      share: row.count,
      value: <BreakdownChangeCell change={change} metric={metric} />,
      sortValues: {
        count: row.count,
        errorRate: row.errorRate,
        p95: row.p95,
        tokens: row.tokens,
        cost: row.cost,
        // Sorted by the change shown: biggest rise first, biggest fall first the other way. New rows
        // have no change to rank, so they sort last.
        change: change?.change,
      },
      cells: [
        ...(project
          ? [
              <span key="project" title={projectName}>
                {projectName}
              </span>,
            ]
          : []),
        ...(tab === 'threads'
          ? [
              <span key="resource" title={row.resource}>
                {row.resource ?? DASH}
              </span>,
            ]
          : []),
        ...(errors
          ? [
              row.errorRate === undefined ? DASH : formatPercent(row.errorRate),
              row.p95 === undefined ? DASH : formatDuration(row.p95),
            ]
          : []),
        ...(usage ? [row.tokens === undefined ? DASH : formatCount(row.tokens)] : []),
        ...(usage ? [<BreakdownCostCell key="cost" row={row} />] : []),
        formatCount(row.count),
      ],
      onClick: frame.onRowClick && (() => frame.onRowClick?.(drilldownFor(tab, row))),
    };
  };

  return (
    <BreakdownFrame {...frame} tab={tab} isUpdating={aggregate?.isPlaceholderData}>
      <ChartArea>
        {/* The columns don't fit a phone or tablet: the table scrolls sideways, names stay readable.
            The padding holds the rows' hover background, which reaches 8px past the list. */}
        <div className="-mx-2 min-w-0 overflow-x-auto px-2">
          <MetricsShareList
            className={tableMinWidth(project, tab === 'threads')}
            rows={rows.map(toShareRow)}
            columns={columns}
            valueLabel="% Change"
            valueWidth="w-28"
            valueSortKey="change"
            valueDescription={<BreakdownChangeDescription window={window} label={comparedLabel(tab, metric)} />}
            showShare={false}
            showStrip={false}
            sort={sort}
            onSortChange={onSortChange}
            limit={LIMIT}
            overflow="more"
            pageSize={PAGE_SIZE}
            emptyState={EMPTY[tab]}
            isLoading={isLoading}
          />
        </div>
        {!isLoading && truncated && (
          <Txt variant="caption" tone="muted" className="pt-2">
            Showing the {formatCount(limit)} busiest; sorting covers only these.
          </Txt>
        )}
      </ChartArea>
    </BreakdownFrame>
  );
}
