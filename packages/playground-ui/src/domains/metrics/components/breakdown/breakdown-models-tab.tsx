import { useMetricsFilters } from '../../hooks/use-metrics-filters';
import { useMetricsUsageTotals } from '../../hooks/use-metrics-usage-totals';
import { BREAKDOWN_GROUP_LIMIT, breakdownGroupBy } from '../../lib/breakdown';
import { previousWindow } from '../../lib/time-window';
import type { BreakdownFrameProps } from './breakdown-frame';
import { BreakdownTable } from './breakdown-table';

/** Models have tokens and cost but no runs: a run isn't tied to one model. Metrics only. */
export function BreakdownModelsTab(frame: BreakdownFrameProps) {
  const groupBy = breakdownGroupBy('models', frame.byProject);
  const { timestamp } = useMetricsFilters();
  const totals = useMetricsUsageTotals({ groupBy, window: timestamp });
  const previousUsage = useMetricsUsageTotals({ groupBy, window: previousWindow(timestamp) });
  return (
    <BreakdownTable
      {...frame}
      tab="models"
      groupBy={groupBy}
      window={timestamp}
      totals={totals}
      previousUsage={previousUsage}
      limit={BREAKDOWN_GROUP_LIMIT.trace}
    />
  );
}
