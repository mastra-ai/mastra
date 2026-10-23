import { useMetricsTokenSeries } from '../../hooks/use-metrics-token-series';
import type { TraceAggregateScope } from '../../hooks/use-metrics-trace-aggregate';
import { useMetricsTraceAggregate } from '../../hooks/use-metrics-trace-aggregate';
import { useMetricsUsageTotals } from '../../hooks/use-metrics-usage-totals';
import {
  BREAKDOWN_GROUP_LIMIT,
  breakdownGroupBy,
  environmentsAggregateRequest,
  hasTrend,
  projectsAggregateRequest,
  threadsAggregateRequest,
} from '../../lib/breakdown';
import { previousScope } from '../../lib/breakdown-table';
import { AGGREGATE_PRIORITY } from '../../lib/request-limiter';
import type { BreakdownFrameProps } from './breakdown-frame';
import { BreakdownTable } from './breakdown-table';

const TRACE_REQUEST = {
  projects: projectsAggregateRequest,
  environments: environmentsAggregateRequest,
  threads: threadsAggregateRequest,
};

export type BreakdownTraceTabName = keyof typeof TRACE_REQUEST;

/** Projects, environments or threads: traces from trace aggregates. */
export function BreakdownTraceTab({
  tab,
  scope,
  ...frame
}: BreakdownFrameProps & { tab: BreakdownTraceTabName; scope: TraceAggregateScope }) {
  const groupBy = breakdownGroupBy(tab, frame.byProject);
  const trend = hasTrend(tab);
  const previous = previousScope(scope);
  const aggregate = useMetricsTraceAggregate(TRACE_REQUEST[tab](scope));
  // The previous window is sent last, so the table never waits on it.
  const previousAggregate = useMetricsTraceAggregate(TRACE_REQUEST[tab](previous), {
    priority: AGGREGATE_PRIORITY.last,
  });
  const tokens = useMetricsTokenSeries({ groupBy, enabled: trend });
  const totals = useMetricsUsageTotals({ groupBy, window: scope.window, enabled: !trend });
  const previousUsage = useMetricsUsageTotals({ groupBy, window: previous.window });
  return (
    <BreakdownTable
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
