import type { TraceAggregateScope } from '../../hooks/use-metrics-trace-aggregate';
import { useMetricsTraceAggregate } from '../../hooks/use-metrics-trace-aggregate';
import { useMetricsUsageTotals } from '../../hooks/use-metrics-usage-totals';
import { BREAKDOWN_GROUP_LIMIT, breakdownGroupBy, threadResourcesRequest, traceTabRequest } from '../../lib/breakdown';
import type { BreakdownTraceTabName } from '../../lib/breakdown';
import { previousScope } from '../../lib/breakdown-table';
import { AGGREGATE_PRIORITY } from '../../lib/request-limiter';
import type { BreakdownFrameProps } from './breakdown-frame';
import { BreakdownTable } from './breakdown-table';

/** Projects, environments or threads: traces from trace aggregates. */
export function BreakdownTraceTab({
  tab,
  scope,
  ...frame
}: BreakdownFrameProps & { tab: BreakdownTraceTabName; scope: TraceAggregateScope }) {
  const groupBy = breakdownGroupBy(tab, frame.byProject);
  const previous = previousScope(scope);
  const aggregate = useMetricsTraceAggregate(traceTabRequest(tab, scope, frame.byProject));
  // The previous window is sent last, so the table never waits on it.
  const previousAggregate = useMetricsTraceAggregate(traceTabRequest(tab, previous, frame.byProject), {
    priority: AGGREGATE_PRIORITY.last,
  });
  // Org-wide the threads request groups by project, so each thread's resource takes its own request.
  const resources = useMetricsTraceAggregate(threadResourcesRequest(scope), {
    enabled: tab === 'threads' && frame.byProject,
  });
  const totals = useMetricsUsageTotals({ groupBy, window: scope.window });
  const threadRows = frame.byProject ? resources : aggregate;
  const previousUsage = useMetricsUsageTotals({ groupBy, window: previous.window });
  return (
    <BreakdownTable
      {...frame}
      tab={tab}
      groupBy={groupBy}
      window={scope.window}
      aggregate={aggregate}
      totals={totals}
      resources={tab === 'threads' ? threadRows : undefined}
      previousAggregate={previousAggregate}
      previousUsage={previousUsage}
      limit={BREAKDOWN_GROUP_LIMIT.trace}
    />
  );
}
