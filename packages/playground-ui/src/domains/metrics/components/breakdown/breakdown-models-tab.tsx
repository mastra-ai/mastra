import { useMetricsFilters } from '../../hooks/use-metrics-filters';
import { useMetricsUsageTotals } from '../../hooks/use-metrics-usage-totals';
import { BREAKDOWN_GROUP_LIMIT, breakdownGroupBy } from '../../lib/breakdown';
import { previousWindow } from '../../lib/time-window';
import type { BreakdownFrameProps } from './breakdown-frame';
import { BreakdownTable } from './breakdown-table';

/** Spans, tokens and spend per model. Metrics only: model isn't a span aggregate dimension. */
export function BreakdownModelsTab(frame: BreakdownFrameProps) {
  const groupBy = breakdownGroupBy('models', frame.byProject);
  const { timestamp } = useMetricsFilters();
  const previous = previousWindow(timestamp);
  const totals = useMetricsUsageTotals({ groupBy, window: timestamp });
  const spans = useMetricsUsageTotals({ groupBy, window: timestamp, measure: 'modelSpans' });
  const previousUsage = useMetricsUsageTotals({ groupBy, window: previous });
  const previousSpans = useMetricsUsageTotals({ groupBy, window: previous, measure: 'modelSpans' });
  return (
    <BreakdownTable
      {...frame}
      tab="models"
      groupBy={groupBy}
      window={timestamp}
      totals={totals}
      spans={spans}
      previousUsage={previousUsage}
      previousSpans={previousSpans}
      limit={BREAKDOWN_GROUP_LIMIT.trace}
    />
  );
}
