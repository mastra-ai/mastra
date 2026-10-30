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
  showsProject,
  tableRows,
  volumeLabel,
} from '../../lib/breakdown-table';
import { formatCount, formatDuration, formatPercent } from '../../lib/chart-format';
import { ChartArea } from '../chart-area';
import { ChartCardError } from '../chart-card-error';
import { BreakdownChangeCell } from './breakdown-change-cell';
import { BreakdownChangeDescription } from './breakdown-change-description';
import { BreakdownCostCell } from './breakdown-cost-cell';
import { BreakdownFigure } from './breakdown-figure';
import { BreakdownFrame } from './breakdown-frame';
import type { BreakdownFrameProps } from './breakdown-frame';
import { BreakdownRowName } from './breakdown-row-name';
import { BreakdownText } from './breakdown-text';
import { MetricsTable } from '@/ds/components/MetricsTable';
import type { MetricsTableColumn, MetricsTableSort } from '@/ds/components/MetricsTable';
import { Txt } from '@/ds/components/Txt';

type UsageTotals = ReturnType<typeof useMetricsUsageTotals>;

const PAGE_SIZE = 13;

/** Busiest first; where a third click on a column's header returns to. */
const DEFAULT_SORT: MetricsTableSort = { column: 'count', direction: 'desc' };

/** The first column's header: what each row is. */
const NAME_HEADER: Record<BreakdownTab, string> = {
  projects: 'Project',
  agents: 'Agent',
  workflows: 'Workflow',
  tools: 'Tool',
  models: 'Model',
  threads: 'Thread',
  environments: 'Environment',
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
  const [sort, setSort] = useState<MetricsTableSort>(DEFAULT_SORT);
  const [metric, setMetric] = useState<ChangeMetric>('count');
  const onSortChange = (next = DEFAULT_SORT) => {
    setSort(next);
    if (isChangeMetric(next.column)) setMetric(next.column);
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

  const changeOf = (row: BreakdownRow) => (previous ? rowChange(row, previous.get(row.key), metric) : undefined);
  const projectName = (row: BreakdownRow) => {
    if (!row.projectId) return DASH;
    return scope.projectLabel?.(row.projectId) ?? row.projectId;
  };

  const nameColumn: MetricsTableColumn<BreakdownRow> = {
    id: 'name',
    header: NAME_HEADER[tab],
    width: 'minmax(12rem,3fr)',
    cell: row => <BreakdownRowName tab={tab} row={row} />,
  };
  const projectColumn: MetricsTableColumn<BreakdownRow> = {
    id: 'project',
    header: 'Project',
    width: 'minmax(8rem,2fr)',
    cell: row => <BreakdownText text={projectName(row)} />,
  };
  const resourceColumn: MetricsTableColumn<BreakdownRow> = {
    id: 'resource',
    header: 'Resource',
    width: 'minmax(6rem,1fr)',
    cell: row => <BreakdownText text={row.resource ?? DASH} />,
  };
  const errorColumns: MetricsTableColumn<BreakdownRow>[] = [
    {
      id: 'errorRate',
      header: 'Errors',
      align: 'end',
      sortValue: row => row.errorRate,
      cell: row => (
        <BreakdownFigure muted>{row.errorRate === undefined ? DASH : formatPercent(row.errorRate)}</BreakdownFigure>
      ),
    },
    {
      id: 'p95',
      header: 'P95 latency',
      align: 'end',
      sortValue: row => row.p95,
      cell: row => <BreakdownFigure muted>{row.p95 === undefined ? DASH : formatDuration(row.p95)}</BreakdownFigure>,
    },
  ];
  const usageColumns: MetricsTableColumn<BreakdownRow>[] = [
    {
      id: 'tokens',
      header: 'Tokens',
      align: 'end',
      sortValue: row => row.tokens,
      cell: row => <BreakdownFigure muted>{row.tokens === undefined ? DASH : formatCount(row.tokens)}</BreakdownFigure>,
    },
    {
      id: 'cost',
      header: 'Cost',
      align: 'end',
      sortValue: row => row.cost,
      cell: row => (
        <BreakdownFigure muted>
          <BreakdownCostCell row={row} />
        </BreakdownFigure>
      ),
    },
  ];
  const countColumn: MetricsTableColumn<BreakdownRow> = {
    id: 'count',
    header: volume,
    align: 'end',
    description: countDescription(tab),
    sortValue: row => row.count,
    cell: row => <BreakdownFigure>{formatCount(row.count)}</BreakdownFigure>,
  };
  const changeColumn: MetricsTableColumn<BreakdownRow> = {
    id: 'change',
    header: '% Change',
    align: 'end',
    description: <BreakdownChangeDescription window={window} label={comparedLabel(tab, metric)} />,
    // Sorted by the change shown: biggest rise first, biggest fall first the other way. New rows
    // have no change to rank, so they sort last.
    sortValue: row => changeOf(row)?.change,
    cell: row => (
      <BreakdownFigure>
        <BreakdownChangeCell change={changeOf(row)} metric={metric} />
      </BreakdownFigure>
    ),
  };
  const columns = [
    nameColumn,
    ...(project ? [projectColumn] : []),
    ...(tab === 'threads' ? [resourceColumn] : []),
    ...(errors ? errorColumns : []),
    ...(usage ? usageColumns : []),
    countColumn,
    changeColumn,
  ];

  return (
    <BreakdownFrame {...frame} tab={tab} isUpdating={aggregate?.isPlaceholderData}>
      <ChartArea>
        <MetricsTable
          key={tab}
          aria-label={`${NAME_HEADER[tab]} breakdown`}
          columns={columns}
          rows={rows}
          getRowKey={row => row.key}
          sort={sort}
          defaultSort={DEFAULT_SORT}
          onSortChange={onSortChange}
          onRowClick={frame.onRowClick && (row => frame.onRowClick?.(drilldownFor(tab, row)))}
          pageSize={PAGE_SIZE}
          isLoading={isLoading}
          empty={EMPTY[tab]}
        />
        {!isLoading && truncated && (
          <Txt variant="caption" tone="muted" className="pt-2">
            Showing the {formatCount(limit)} busiest; sorting covers only these.
          </Txt>
        )}
      </ChartArea>
    </BreakdownFrame>
  );
}
