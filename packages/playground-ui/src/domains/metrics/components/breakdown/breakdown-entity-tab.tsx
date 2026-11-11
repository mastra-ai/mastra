import type { SpanAggregateScope } from '../../hooks/use-metrics-span-aggregate';
import { useMetricsSpanAggregate } from '../../hooks/use-metrics-span-aggregate';
import { useMetricsUsageTotals } from '../../hooks/use-metrics-usage-totals';
import type { UsageTotalsOptions } from '../../hooks/use-metrics-usage-totals';
import { BREAKDOWN_GROUP_LIMIT, breakdownGroupBy, entitiesAggregateRequest, hasUsage } from '../../lib/breakdown';
import type { BreakdownEntityTab } from '../../lib/breakdown';
import { previousScope } from '../../lib/breakdown-table';
import { AGGREGATE_PRIORITY } from '../../lib/request-limiter';
import type { BreakdownFrameProps } from './breakdown-frame';
import { BreakdownTable } from './breakdown-table';

// Model usage is attributed to the agent whose context made the call: workflows and tools have none.
const AGENT_FILTER: UsageTotalsOptions['filters'] = { entityType: 'agent' };

/** Agents, workflows or tools from span aggregates, nested runs included. */
export function BreakdownEntityTab({
  tab,
  scope,
  ...frame
}: BreakdownFrameProps & { tab: BreakdownEntityTab; scope: SpanAggregateScope }) {
  const groupBy = breakdownGroupBy(tab, frame.byProject);
  const usage = hasUsage(tab);
  const previous = previousScope(scope);
  const aggregate = useMetricsSpanAggregate(entitiesAggregateRequest(tab, scope, frame.byProject));
  // The previous window is sent last, so the table never waits on it.
  const previousAggregate = useMetricsSpanAggregate(entitiesAggregateRequest(tab, previous, frame.byProject), {
    priority: AGGREGATE_PRIORITY.last,
  });
  const totals = useMetricsUsageTotals({ groupBy, filters: AGENT_FILTER, window: scope.window, enabled: usage });
  const previousUsage = useMetricsUsageTotals({
    groupBy,
    filters: AGENT_FILTER,
    window: previous.window,
    enabled: usage,
  });
  return (
    <BreakdownTable
      {...frame}
      tab={tab}
      groupBy={groupBy}
      window={scope.window}
      aggregate={aggregate}
      totals={usage ? totals : undefined}
      previousAggregate={previousAggregate}
      previousUsage={usage ? previousUsage : undefined}
      limit={BREAKDOWN_GROUP_LIMIT.span}
    />
  );
}
