import type { GetWorkflowResponse } from '@mastra/client-js';
import { EntityType } from '@mastra/core/observability';
import {
  formatCount,
  formatDuration,
  formatPercent,
  percentChange,
} from '@mastra/playground-ui/domains/metrics/lib/chart-format';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { useWorkflowsRunCounts } from '@mastra/react/hooks/workflows';
import {
  isWorkflowActive,
  workflowRegressions,
  workflowSortAccessors,
} from '../components/workflows-overview/workflow-roster-row';
import type { WorkflowRosterRow, WorkflowSortKey } from '../components/workflows-overview/workflow-roster-row';
import type { WorkflowsRosterActivity } from '../components/workflows-overview/workflows-roster';
import { useWorkflowsActivity } from './use-workflows-activity';
import type { PeriodTotal } from '@/domains/overview/components/period-totals';
import { matchesSearch, orderRoster } from '@/domains/overview/order-roster';
import type { OverviewRange } from '@/domains/overview/overview-period';
import { emptyRunActivity, errorRateOf, sumRunTotals } from '@/domains/overview/run-activity';
import type { RunTotals } from '@/domains/overview/run-activity';
import { useOverviewWindow } from '@/domains/overview/use-overview-window';
import { useRootRunLatency } from '@/domains/overview/use-root-run-latency';
import type { Latency } from '@/domains/overview/use-root-run-latency';

function workflowsTotals(runs: RunTotals, latency: Latency | undefined, suspended: number | undefined): PeriodTotal[] {
  const failureRate = errorRateOf(runs.runs, runs.errors);
  const previousFailureRate = errorRateOf(runs.previousRuns, runs.previousErrors);
  return [
    {
      label: 'Runs',
      value: formatCount(runs.runs),
      changePercent: percentChange(runs.runs, runs.previousRuns),
      previousValue: formatCount(runs.previousRuns),
    },
    {
      label: 'Failure rate',
      value: failureRate === null ? '–' : formatPercent(failureRate),
      changePercent:
        failureRate === null || previousFailureRate === null
          ? undefined
          : percentChange(failureRate, previousFailureRate),
      previousValue: previousFailureRate === null ? undefined : formatPercent(previousFailureRate),
      lowerIsBetter: true,
      alert: runs.errors > 0,
    },
    ...(latency
      ? [
          {
            label: 'p95 latency',
            value: latency.p95 === null ? '–' : formatDuration(latency.p95),
            changePercent:
              latency.p95 === null || latency.previousP95 === null
                ? undefined
                : percentChange(latency.p95, latency.previousP95),
            previousValue: latency.previousP95 === null ? undefined : formatDuration(latency.previousP95),
            lowerIsBetter: true,
          },
        ]
      : []),
    ...(suspended === undefined ? [] : [{ label: 'Waiting for input', value: formatCount(suspended) }]),
  ];
}

export function useWorkflowsOverview({
  workflows,
  range,
  search,
  sort,
  showsActivity,
}: {
  workflows: Record<string, GetWorkflowResponse>;
  range: OverviewRange;
  search: string;
  sort: ListSort<WorkflowSortKey>;
  showsActivity: boolean;
}) {
  const { paths } = useLinkComponent();
  const { window, windowKey } = useOverviewWindow(range);
  const activity = useWorkflowsActivity({ range, window, windowKey, enabled: showsActivity });
  const latency = useRootRunLatency({
    entityType: EntityType.WORKFLOW_RUN,
    window,
    windowKey,
    enabled: showsActivity,
  });
  const runCounts = useWorkflowsRunCounts();

  const bucketCount = activity.data?.bucketCount ?? 0;
  const rows: WorkflowRosterRow[] = Object.entries(workflows).map(([id, workflow]) => ({
    id,
    name: workflow.name,
    workflow,
    activity: showsActivity
      ? (activity.data?.byEntityId.get(workflow.name) ?? emptyRunActivity(bucketCount))
      : undefined,
    latency: latency.data?.byName.get(workflow.name),
    running: runCounts[id]?.running ?? 0,
    suspended: runCounts[id]?.suspended ?? 0,
  }));
  const matching = rows.filter(row => matchesSearch(search, [row.name, row.id, row.workflow.description]));
  const ordered = orderRoster(matching, { sort, accessors: workflowSortAccessors, isActive: isWorkflowActive });
  const showsSuspended = Object.keys(runCounts).length > 0;
  const suspended = showsSuspended ? rows.reduce((sum, row) => sum + row.suspended, 0) : undefined;

  const rosterActivity: WorkflowsRosterActivity | undefined =
    showsActivity && activity.data ? { range, nowMs: window.end.getTime(), latencyStatus: latency.status } : undefined;
  const totals = activity.data
    ? workflowsTotals(sumRunTotals(activity.data.byEntityId.values()), latency.data?.total, suspended)
    : undefined;

  return {
    isLoading: showsActivity && activity.isLoading,
    error: activity.error,
    rows: ordered,
    rosterActivity,
    showsSuspended,
    totals,
    regressions: workflowRegressions(rows, paths.workflowLink),
  };
}
