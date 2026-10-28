import type { AggregateTracesResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
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
import { modelNameParts, ProviderMark } from '@/domains/llm';
import { MetricsTable } from '@/ds/components/MetricsTable';
import type { MetricsTableColumn, MetricsTableSort } from '@/ds/components/MetricsTable';
import { SegmentedName } from '@/ds/components/SegmentedName';
import { SeriesMark } from '@/ds/components/SeriesMark';
import { Txt } from '@/ds/components/Txt';
import { AgentIcon, AiIcon, ToolsIcon, WorkflowIcon } from '@/ds/icons';

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

/** Tabs whose rows are one kind of entity, marked by its icon before each name. */
const ENTITY_ICON: Partial<Record<BreakdownTab, typeof AgentIcon>> = {
  agents: AgentIcon,
  workflows: WorkflowIcon,
  tools: ToolsIcon,
};

/** A figure beside the one the table is about: muted, in fixed-width digits. */
const muted = (value: ReactNode) => <span className="text-muted-foreground tabular-nums">{value}</span>;

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
  const EntityIcon = ENTITY_ICON[tab];
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
  const projectName = (row: BreakdownRow) =>
    row.projectId ? (scope.projectLabel?.(row.projectId) ?? row.projectId) : DASH;

  const columns: MetricsTableColumn<BreakdownRow>[] = [
    {
      id: 'name',
      header: NAME_HEADER[tab],
      width: 'minmax(12rem,3fr)',
      cell: row => {
        const name = rowLabel(tab, row, scope.projectLabel);
        return (
          <span className="flex min-w-0 items-center gap-2">
            {EntityIcon && <SeriesMark icon={<EntityIcon className="size-3" />} />}
            {tab === 'models' &&
              (row.provider ? (
                <ProviderMark provider={row.provider} />
              ) : (
                <SeriesMark icon={<AiIcon className="size-3" />} />
              ))}
            <span className="truncate" title={name}>
              {tab === 'models' && row.name ? <SegmentedName parts={modelNameParts(row.name, row.provider)} /> : name}
            </span>
          </span>
        );
      },
    },
    ...(project
      ? [
          {
            id: 'project',
            header: 'Project',
            width: 'minmax(8rem,2fr)',
            cell: (row: BreakdownRow) => (
              <span className="truncate text-muted-foreground" title={projectName(row)}>
                {projectName(row)}
              </span>
            ),
          },
        ]
      : []),
    ...(tab === 'threads'
      ? [
          {
            id: 'resource',
            header: 'Resource',
            width: 'minmax(6rem,1fr)',
            cell: (row: BreakdownRow) => (
              <span className="truncate text-muted-foreground" title={row.resource}>
                {row.resource ?? DASH}
              </span>
            ),
          },
        ]
      : []),
    ...(errors
      ? [
          {
            id: 'errorRate',
            header: 'Errors',
            align: 'end' as const,
            sortValue: (row: BreakdownRow) => row.errorRate,
            cell: (row: BreakdownRow) => muted(row.errorRate === undefined ? DASH : formatPercent(row.errorRate)),
          },
          {
            id: 'p95',
            header: 'P95 latency',
            align: 'end' as const,
            sortValue: (row: BreakdownRow) => row.p95,
            cell: (row: BreakdownRow) => muted(row.p95 === undefined ? DASH : formatDuration(row.p95)),
          },
        ]
      : []),
    ...(usage
      ? [
          {
            id: 'tokens',
            header: 'Tokens',
            align: 'end' as const,
            sortValue: (row: BreakdownRow) => row.tokens,
            cell: (row: BreakdownRow) => muted(row.tokens === undefined ? DASH : formatCount(row.tokens)),
          },
          {
            id: 'cost',
            header: 'Cost',
            align: 'end' as const,
            sortValue: (row: BreakdownRow) => row.cost,
            cell: (row: BreakdownRow) => muted(<BreakdownCostCell row={row} />),
          },
        ]
      : []),
    {
      id: 'count',
      header: volume,
      align: 'end',
      description: countDescription(tab),
      sortValue: row => row.count,
      cell: row => <span className="tabular-nums">{formatCount(row.count)}</span>,
    },
    {
      id: 'change',
      header: '% Change',
      align: 'end',
      description: <BreakdownChangeDescription window={window} label={comparedLabel(tab, metric)} />,
      // Sorted by the change shown: biggest rise first, biggest fall first the other way. New rows
      // have no change to rank, so they sort last.
      sortValue: row => changeOf(row)?.change,
      cell: row => (
        <span className="tabular-nums">
          <BreakdownChangeCell change={changeOf(row)} metric={metric} />
        </span>
      ),
    },
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
