import type { AggregateTracesResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMetricsScope } from '../../hooks/use-metrics-scope';
import type { useMetricsUsageTotals } from '../../hooks/use-metrics-usage-totals';
import { buildBreakdownRows, hasErrors, previousFigures, threadResources } from '../../lib/breakdown';
import type { BreakdownTab } from '../../lib/breakdown';
import {
  BREAKDOWN_COLUMN_LABELS,
  countDescription,
  drilldownFor,
  rowLabel,
  showsProject,
  tableRows,
  volumeLabel,
} from '../../lib/breakdown-table';
import { ChartCardError } from '../chart-card-error';
import { BreakdownFrame } from './breakdown-frame';
import type { BreakdownFrameProps } from './breakdown-frame';
import { BreakdownShareTable } from './breakdown-share-table';

type UsageTotals = ReturnType<typeof useMetricsUsageTotals>;

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

  const current = [aggregate, totals, spans].filter(q => q !== undefined);
  if (current.some(q => q.isError)) {
    return (
      <BreakdownFrame {...frame} tab={tab}>
        <ChartCardError onRetry={() => current.forEach(q => q.isError && void q.refetch())} />
      </BreakdownFrame>
    );
  }

  const isLoading = current.some(q => q.isLoading);
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
  const usage = totals !== undefined;

  return (
    <BreakdownFrame {...frame} tab={tab} isUpdating={aggregate?.isPlaceholderData}>
      <BreakdownShareTable
        rows={tableRows({ tab, built, previous, truncated, groupBy, usage })}
        previous={previous}
        columns={{
          project: showsProject(tab, frame.byProject),
          resource: tab === 'threads',
          errors: hasErrors(tab),
          usage,
        }}
        labels={{ ...BREAKDOWN_COLUMN_LABELS, count: volumeLabel(tab) }}
        countDescription={countDescription(tab)}
        rowLabel={row => rowLabel(tab, row, scope.projectLabel)}
        onRowClick={frame.onRowClick && (row => frame.onRowClick?.(drilldownFor(tab, row)))}
        emptyState={EMPTY[tab]}
        window={window}
        isLoading={isLoading}
        {...(truncated ? { truncatedAt: limit } : {})}
      />
    </BreakdownFrame>
  );
}
